/**
 * Per-app leftover-path catalog.
 *
 * Windows uninstallers routinely leave AppData and ProgramData behind
 * "by design" (preserves user data on reinstall). We surface those
 * leftover paths so Ryan can see what's there, and only move selected
 * paths through the same blocklist + 30-day FormatBuddy Trash flow
 * used by the Phase-1 cleanup engine.
 *
 * Each entry is matched by case-insensitive substring against
 * `${app.name} ${app.publisher}`. Keep patterns narrow — false
 * positives risk pointing the user at the wrong app's data.
 */
import { promises as fs } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  AppLeftoverGroup,
  AppLeftoverPath,
  AppLeftoversCleanupRequest,
  AppLeftoversSnapshot,
  AppLeftoverCleanupState,
  CleanupExecuteResult,
  CleanupExecutedItem,
  CleanupItem,
  CleanupSkippedItem,
  CleanupTrashEntry,
  InstalledApp,
  StartupAutoDisabledEntry,
  StartupAutoEntry
} from "@shared/types";
import {
  CLEANUP_FOLLOWUP_SAVE_WARNING,
  CLEANUP_HISTORY_SAVE_WARNING,
  CLEANUP_RESTORE_SIZE_WARNING
} from "@shared/cleanup-warnings";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import { evaluatePath, normalizePath } from "../cleanup/blocklist";
import { buildLogEntry, recordCleanupExecution } from "../cleanup/log";
import { findLinkedInstallFolderPathPart, findLinkedPathPart } from "../cleanup/pathSafety";
import {
  assertManagedTrashEntryManifest,
  findLinkedManagedTrashStoredPath,
  isManagedTrashEntryStoredPath,
  moveToFormatBuddyTrash
} from "../cleanup/trash";
import {
  disableStartupFolderEntry,
  isManagedStartupStoredPath,
  isSafeStartupDisabledId
} from "../startup/folderToggle";
import {
  backupAndDeleteScheduledTask,
  defaultScheduledTaskBackupRunner,
  isScheduledTaskBackupPreservedError,
  normalizeSafeScheduledTaskName,
  normalizeSafeScheduledTaskPath,
  type ScheduledTaskBackupRunner
} from "../startup/scheduledTaskBackup";
import {
  backupAndRemoveEnvironmentPathSegment,
  backupAndDeleteRegistryValue,
  backupAndDeleteRegistryKey,
  defaultRegistryCleanupRunner,
  isRegistryBackupPreservedError,
  isSafeAppCapabilitiesRegistryKeyPath,
  isSafeAppPathRegistryKeyPath,
  isSafeContextMenuRegistryKeyPath,
  isSafeFileAssociationRegistryKeyPath,
  isSafeShellExtensionRegistryKeyPath,
  isSafeEnvironmentVariableRegistryValuePath,
  isSafeEnvironmentPathRegistryValuePath,
  isSafeFirewallRuleRegistryValuePath,
  isSafeOpenWithRegistryKeyPath,
  isSafeProtocolHandlerRegistryKeyPath,
  isSafeNativeMessagingHostRegistryKeyPath,
  isSafeServiceRegistryKeyPath,
  isSafeRegisteredApplicationRegistryValuePath,
  normalizeSafeServiceName,
  normalizeSafeEnvironmentPathSegment,
  normalizeSafeProtocolScheme,
  normalizeSafeNativeMessagingHostName,
  serviceRegistryKeyPath,
  isSafeStartupRegistryValuePath,
  isSafeUninstallRegistryKeyPath,
  type RegistryCleanupRunner
} from "./registryCleanup";

interface LeftoverRule {
  match: RegExp;
  appLabel: string;
  paths: ((env: LeftoverEnv) => string)[];
}

interface LeftoverEnv {
  home: string;
  roaming: string;
  localAppData: string;
  localLow: string;
  programData: string;
}

interface CachedLeftoversPlan {
  snapshot: AppLeftoversSnapshot;
  env: LeftoverEnv;
  expiresAt: number;
}

interface CleanupAppLeftoversOptions {
  userDataDir: string;
  now?: () => Date;
  registryRunner?: RegistryCleanupRunner;
  scheduledTaskRunner?: ScheduledTaskBackupRunner;
  disableStartupFolderEntry?: typeof disableStartupFolderEntry;
  recordCleanupExecution?: typeof recordCleanupExecution;
  currentInstalledApps?: InstalledApp[];
  currentInstalledAppsKnown?: boolean;
  onFollowupCleaned?: (app: Pick<InstalledApp, "name" | "publisher">) => void | Promise<void>;
}

const PLAN_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 86_400_000;
const RESTORE_BIN_EXPIRY_CLOCK_SKEW_MS = DAY_MS;
const MAX_LEFTOVER_DEPTH = 8;
const MAX_LEFTOVER_ITEMS = 50_000;
const MAX_SHORTCUT_SCAN_DEPTH = 5;
const MAX_SHORTCUT_SCAN_ITEMS = 10_000;
const PLAN_CACHE = new Map<string, CachedLeftoversPlan>();
const LINKED_LEFTOVER_PROTECTION = "링크가 포함된 잔여 폴더라 자동 정리하지 않아요.";
const DEEP_LEFTOVER_PROTECTION = "폴더가 너무 깊어서 자동 정리하지 않아요.";
const UNREADABLE_LEFTOVER_PROTECTION = "권한이 없어 잔여 폴더를 정확히 확인하지 못했어요.";
const UNSAFE_REGISTRY_PROTECTION =
  "지원하는 앱 제거 레지스트리 위치가 아니라 자동 정리하지 않아요.";
const CHANGED_LEFTOVER_PROTECTION =
  "잔여 폴더가 점검 후 바뀌었어요. 다시 점검한 뒤 정리해주세요.";
const PERSONAL_INSTALL_LOCATION_PROTECTION =
  "바탕화면·문서·다운로드·사진·영상·음악 같은 개인 폴더 안이라 자동 정리하지 않아요.";
const STARTUP_TRACE_PROTECTION =
  "서비스·예약 작업·레지스트리 시작 항목은 아직 자동 삭제하지 않아요. 시작 항목 화면에서 확인해주세요.";
const SERVICE_TRACE_PROTECTION =
  "서비스 이름을 안전하게 확인하지 못해서 자동 정리하지 않아요. 시작 항목 화면에서 다시 확인해주세요.";
const SCHEDULED_TASK_TRACE_PROTECTION =
  "예약 작업 위치를 안전하게 확인하지 못해서 자동 정리하지 않아요. 시작 항목 화면에서 다시 확인해주세요.";
const GENERIC_NAME_BLOCKLIST =
  /\b(?:microsoft|windows|visual c\+\+|vc\+\+|\.net|directx|driver|runtime|sdk|update|hotfix|language pack|redistributable)\b/i;

class LeftoverMeasurementProtection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeftoverMeasurementProtection";
  }
}

const RULES: LeftoverRule[] = [
  {
    match: /kakaotalk|kakao talk|카카오톡/i,
    appLabel: "KakaoTalk",
    paths: [
      ({ roaming }) => join(roaming, "KakaoTalk"),
      ({ localAppData }) => join(localAppData, "Kakao", "KakaoTalk")
    ]
  },
  {
    match: /\bchrome\b/i,
    appLabel: "Google Chrome",
    paths: [({ localAppData }) => join(localAppData, "Google", "Chrome", "User Data")]
  },
  {
    match: /\bedge\b/i,
    appLabel: "Microsoft Edge",
    paths: [({ localAppData }) => join(localAppData, "Microsoft", "Edge", "User Data")]
  },
  {
    match: /firefox/i,
    appLabel: "Mozilla Firefox",
    paths: [
      ({ roaming }) => join(roaming, "Mozilla", "Firefox"),
      ({ localAppData }) => join(localAppData, "Mozilla", "Firefox")
    ]
  },
  {
    match: /whale|naver whale/i,
    appLabel: "Naver Whale",
    paths: [({ localAppData }) => join(localAppData, "Naver", "Naver Whale", "User Data")]
  },
  {
    match: /slack/i,
    appLabel: "Slack",
    paths: [
      ({ roaming }) => join(roaming, "Slack"),
      ({ localAppData }) => join(localAppData, "slack")
    ]
  },
  {
    match: /discord/i,
    appLabel: "Discord",
    paths: [
      ({ roaming }) => join(roaming, "discord"),
      ({ localAppData }) => join(localAppData, "Discord")
    ]
  },
  {
    match: /microsoft teams|^teams$/i,
    appLabel: "Microsoft Teams",
    paths: [
      ({ roaming }) => join(roaming, "Microsoft", "Teams"),
      ({ localAppData }) => join(localAppData, "Microsoft", "Teams")
    ]
  },
  {
    match: /zoom/i,
    appLabel: "Zoom",
    paths: [
      ({ roaming }) => join(roaming, "Zoom"),
      ({ localAppData }) => join(localAppData, "Zoom")
    ]
  },
  {
    match: /spotify/i,
    appLabel: "Spotify",
    paths: [
      ({ roaming }) => join(roaming, "Spotify"),
      ({ localAppData }) => join(localAppData, "Spotify")
    ]
  },
  {
    match: /steam/i,
    appLabel: "Steam",
    paths: [({ roaming }) => join(roaming, "Steam")]
  },
  {
    match: /adobe|creative cloud/i,
    appLabel: "Adobe",
    paths: [
      ({ roaming }) => join(roaming, "Adobe"),
      ({ localAppData }) => join(localAppData, "Adobe"),
      ({ programData }) => join(programData, "Adobe")
    ]
  },
  {
    match: /visual studio code|\bvs code\b/i,
    appLabel: "Visual Studio Code",
    paths: [
      ({ roaming }) => join(roaming, "Code"),
      ({ home }) => join(home, ".vscode")
    ]
  },
  {
    match: /cursor/i,
    appLabel: "Cursor",
    paths: [
      ({ roaming }) => join(roaming, "Cursor"),
      ({ home }) => join(home, ".cursor")
    ]
  },
  {
    match: /jetbrains|intellij|pycharm|webstorm|goland/i,
    appLabel: "JetBrains",
    paths: [
      ({ roaming }) => join(roaming, "JetBrains"),
      ({ localAppData }) => join(localAppData, "JetBrains")
    ]
  },

  // ====================================================================
  // v2.0 Round D-3 (B2) — Korean-user leftover dictionary.
  //
  // Ordered by Korean-Windows-install frequency. Every rule lists ONLY
  // app-managed cache / settings paths -- never user-authored documents.
  // Anything that could hold user content (NPKI, browser Login Data,
  // KakaoTalk message DB) is still blocked by cleanup/blocklist.ts;
  // these paths are surfaced only as "candidates" the user reviews
  // before uninstalling, never auto-cleaned.
  // ====================================================================

  // 안티바이러스 / 보안
  {
    match: /(?:^|\s)v3(?:\s|$)|ahnlab|안랩/i,
    appLabel: "안랩 V3",
    paths: [
      ({ programData }) => join(programData, "AhnLab"),
      ({ localAppData }) => join(localAppData, "AhnLab"),
      ({ roaming }) => join(roaming, "AhnLab")
    ]
  },
  {
    match: /알약|alyac/i,
    appLabel: "알약 (ESTsoft)",
    paths: [
      ({ programData }) => join(programData, "ESTsoft", "ALYac"),
      ({ localAppData }) => join(localAppData, "ESTsoft", "ALYac")
    ]
  },

  // 오피스 / 문서
  {
    match: /hancom|한컴|hwp|한글\(?(?:office|오피스)?\)?|hoffice/i,
    appLabel: "한컴 오피스 / 한글",
    paths: [
      ({ roaming }) => join(roaming, "HNC"),
      ({ localAppData }) => join(localAppData, "HNC"),
      ({ programData }) => join(programData, "HNC")
    ]
  },

  // 세무 / 업무 -- "Smart A" is intentionally NOT in this rule's regex
  // because more than one Korean tax/ERP product uses the brand. We
  // match the Korean word "세무사랑" only and let the generic 더존 /
  // 위하고 rules catch the rest, which is more conservative.
  {
    match: /세무사랑/i,
    appLabel: "세무사랑",
    paths: [
      ({ roaming }) => join(roaming, "DUZON"),
      ({ programData }) => join(programData, "Smart A")
    ]
  },
  {
    match: /위하고|wehago/i,
    appLabel: "위하고",
    paths: [
      ({ roaming }) => join(roaming, "WEHAGO"),
      ({ localAppData }) => join(localAppData, "WEHAGO")
    ]
  },
  {
    match: /더존|duzon/i,
    appLabel: "더존",
    paths: [
      ({ roaming }) => join(roaming, "Duzon"),
      ({ localAppData }) => join(localAppData, "Duzon"),
      ({ programData }) => join(programData, "Duzon")
    ]
  },

  // 게임 런처
  {
    match: /kakaogames|카카오게임즈/i,
    appLabel: "카카오게임즈",
    paths: [
      ({ localAppData }) => join(localAppData, "KakaoGames"),
      ({ roaming }) => join(roaming, "KakaoGames")
    ]
  },
  {
    match: /nexon|넥슨/i,
    appLabel: "넥슨 런처",
    paths: [
      ({ localAppData }) => join(localAppData, "Nexon"),
      ({ programData }) => join(programData, "Nexon")
    ]
  },
  {
    match: /wemade|위메이드|미르4|mir4/i,
    appLabel: "위메이드 / 미르4",
    paths: [
      ({ localAppData }) => join(localAppData, "Wemade"),
      ({ roaming }) => join(roaming, "Wemade")
    ]
  },
  {
    match: /엔씨소프트|ncsoft|ncwest|purplelauncher/i,
    appLabel: "엔씨소프트 / Purple",
    paths: [
      ({ localAppData }) => join(localAppData, "NCSOFT"),
      ({ roaming }) => join(roaming, "NCSOFT")
    ]
  },
  {
    match: /pearl ?abyss|펄어비스|black ?desert|검은사막/i,
    appLabel: "펄어비스 / 검은사막",
    paths: [
      ({ localAppData }) => join(localAppData, "PearlAbyss"),
      ({ roaming }) => join(roaming, "PearlAbyss")
    ]
  },

  // 미디어 플레이어
  {
    match: /gom\s*(player|audio|cam|mix|encoder)|곰\s*(플레이어|오디오|캠|믹스|인코더)/i,
    appLabel: "곰플레이어 (GOM)",
    paths: [
      ({ roaming }) => join(roaming, "GRETECH"),
      ({ localAppData }) => join(localAppData, "GRETECH"),
      ({ programData }) => join(programData, "GRETECH")
    ]
  },
  {
    match: /potplayer|팟플레이어/i,
    appLabel: "다음 팟플레이어",
    paths: [
      ({ roaming }) => join(roaming, "PotPlayerMini"),
      ({ roaming: r }) => join(r, "Daum", "PotPlayer")
    ]
  },

  // 금융 / 결제
  {
    match: /toss|토스/i,
    appLabel: "토스",
    paths: [
      ({ roaming }) => join(roaming, "Toss"),
      ({ localAppData }) => join(localAppData, "Toss")
    ]
  },
  {
    match: /신한플레이|shinhan\s*play|신한카드/i,
    appLabel: "신한플레이",
    paths: [
      ({ roaming }) => join(roaming, "ShinhanPlay"),
      ({ localAppData }) => join(localAppData, "ShinhanPlay")
    ]
  }
];

export interface PlanLeftoversOptions {
  home?: string;
  env?: Partial<LeftoverEnv>;
  /**
   * Apps whose Windows uninstaller was launched recently. After a
   * re-scan they may no longer appear in installedApps, but their
   * AppData/ProgramData leftovers are exactly what the user wants to
   * review next.
   */
  extraApps?: InstalledApp[];
  /**
   * False when the uninstall window was opened and the scan cache was
   * invalidated. In that state we can preview leftovers, but must not
   * clean them until a fresh scan confirms the app disappeared.
   */
  installedAppsKnown?: boolean;
  /**
   * Optional deep startup inventory. When an uninstalled app left a
   * startup shortcut / service / task behind, we surface it in the
   * same leftover review so the user doesn't miss a launch trace.
   */
  startupEntries?: StartupAutoEntry[];
  /**
   * Optional registry probe used to verify App Paths, app connection,
   * default-app list, and right-click menu traces before surfacing them.
   * Defaults to reg.exe on Windows and no-op elsewhere.
   */
  registryRunner?: Pick<
    RegistryCleanupRunner,
    "keyExists" | "queryValue" | "valueExists" | "listValues" | "listSubKeys"
  >;
}

function defaultEnv(home: string, override?: Partial<LeftoverEnv>): LeftoverEnv {
  const safeHome = safeEnvRoot(override?.home ?? home, home);
  const roaming = safeEnvRoot(
    override?.roaming ?? process.env.APPDATA,
    join(safeHome, "AppData", "Roaming"),
    { home: safeHome, requireInsideHome: true }
  );
  const localAppData = safeEnvRoot(
    override?.localAppData ?? process.env.LOCALAPPDATA,
    join(safeHome, "AppData", "Local"),
    { home: safeHome, requireInsideHome: true }
  );
  const localLow = safeEnvRoot(
    override?.localLow ?? process.env.LOCALLOW,
    join(safeHome, "AppData", "LocalLow"),
    { home: safeHome, requireInsideHome: true }
  );
  const programData = safeEnvRoot(
    override?.programData ?? process.env.ProgramData,
    "C:\\ProgramData"
  );
  return {
    home: safeHome,
    roaming,
    localAppData,
    localLow,
    programData
  };
}

function safeEnvRoot(
  value: unknown,
  fallback: string,
  options: { home?: string; requireInsideHome?: boolean } = {}
): string {
  if (typeof value !== "string") return fallback;
  if (!isStrictPlanString(value)) return fallback;
  if (!isSupportedFilesystemPlanPath(value)) return fallback;
  if (isUncPath(value)) return fallback;
  if (options.requireInsideHome && options.home && !isAtOrInside(value, options.home)) {
    return fallback;
  }
  return value;
}

function isUncPath(value: string): boolean {
  let path = value.trim();
  if (path.startsWith("\\\\?\\UNC\\")) return true;
  if (path.startsWith("\\\\?\\")) path = path.slice(4);
  return path.startsWith("\\\\");
}

function nowMs(now?: () => Date): number {
  return now?.().getTime() ?? Date.now();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTrimmedString(value: string): boolean {
  return value.trim() === value;
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isUsablePlanString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !hasControlCharacters(value);
}

function isStrictPlanString(value: unknown): value is string {
  return isUsablePlanString(value) && isTrimmedString(value);
}

function isSupportedFilesystemPlanPath(value: string): boolean {
  let path = value.trim();
  if (path.startsWith("\\\\?\\")) path = path.slice(4);
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith("\\\\") || path.startsWith("/");
}

function isFilesystemLeftoverPathKind(value: unknown): boolean {
  return (
    value === undefined ||
    value === "folder" ||
    value === "install-folder" ||
    value === "shortcut" ||
    value === "pinned-shortcut" ||
    value === "shortcut-folder" ||
    value === "startup-folder"
  );
}

function isOptionalUsablePlanString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || value === "" || isUsablePlanString(value);
}

function isOptionalStrictPlanString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || value === "" || isStrictPlanString(value);
}

function isOptionalPlanSizeBytes(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isOptionalPlanTimestamp(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  return isStrictPlanString(value) && Number.isFinite(Date.parse(value));
}

function isOptionalPlanFingerprint(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
}

function isValidIsoDateString(value: unknown): value is string {
  return isStrictPlanString(value) && Number.isFinite(Date.parse(value));
}

function cleanDisplayText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed || undefined;
}

function normalizeAppForPlan(app: InstalledApp): InstalledApp | null {
  const name = cleanDisplayText(app.name);
  if (!name) return null;
  return {
    ...app,
    name,
    publisher: cleanDisplayText(app.publisher) ?? null
  };
}

function ruleForApp(app: InstalledApp): LeftoverRule | undefined {
  const text = `${app.name} ${app.publisher ?? ""}`;
  return RULES.find((rule) => rule.match.test(text));
}

export function leftoverRuleLabelForApp(app: InstalledApp): string | undefined {
  return ruleForApp(app)?.appLabel;
}

function appMatchesRuleLabel(app: InstalledApp, label: string): boolean {
  return leftoverRuleLabelForApp(app) === label;
}

function isWithinRestoreBinWindow(expiresAt: string, now: Date): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  const earliestAllowed =
    now.getTime() + RESTORE_BIN_RETENTION_DAYS * DAY_MS - RESTORE_BIN_EXPIRY_CLOCK_SKEW_MS;
  const latestAllowed =
    now.getTime() + RESTORE_BIN_RETENTION_DAYS * DAY_MS + RESTORE_BIN_EXPIRY_CLOCK_SKEW_MS;
  return expiresAtMs >= earliestAllowed && expiresAtMs <= latestAllowed;
}

function isValidSha256ContentHash(
  value: unknown
): value is NonNullable<StartupAutoDisabledEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<StartupAutoDisabledEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

async function hashStartupHoldingFile(path: string): Promise<string> {
  return createHash("sha256").update(await fs.readFile(path)).digest("hex");
}

function isSafeLeftoverPathKind(value: unknown): value is NonNullable<AppLeftoverPath["kind"]> {
  return (
    value === "folder" ||
    value === "install-folder" ||
    value === "shortcut" ||
    value === "pinned-shortcut" ||
    value === "shortcut-folder" ||
    value === "registry" ||
    value === "registered-app-registry" ||
    value === "app-capabilities-registry" ||
    value === "environment-path-registry" ||
    value === "environment-variable-registry" ||
    value === "firewall-rule-registry" ||
    value === "app-path-registry" ||
    value === "open-with-registry" ||
    value === "file-association-registry" ||
    value === "context-menu-registry" ||
    value === "shell-extension-registry" ||
    value === "protocol-handler-registry" ||
    value === "native-messaging-host-registry" ||
    value === "service-registry" ||
    value === "startup-folder" ||
    value === "startup-registry" ||
    value === "startup-entry"
  );
}

function isSafeLeftoverGroupSource(value: unknown): value is NonNullable<AppLeftoverGroup["source"]> {
  return value === undefined || value === "installed" || value === "uninstall-launched";
}

function isSafeLeftoverCleanupState(value: unknown): value is AppLeftoverCleanupState | undefined {
  return (
    value === undefined ||
    value === "removed-confirmed" ||
    value === "still-installed" ||
    value === "not-checked"
  );
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function appIdentityKey(app: Pick<InstalledApp, "name" | "publisher">): string {
  return `${(app.name ?? "").trim().toLowerCase()}|${(app.publisher ?? "").trim().toLowerCase()}`;
}

function makePathId(path: string): string {
  return createHash("sha1").update(normalizePath(path)).digest("hex").slice(0, 16);
}

function planToken(planId: string, groups: AppLeftoverGroup[]): string {
  const tokenInput = groups
    .map((group) => {
      const pathToken = group.paths
        .map((p) => `${p.id}:${p.exists ? 1 : 0}:${p.sizeBytes ?? 0}:${p.fingerprint ?? ""}:${p.protectedBy ?? ""}`)
        .join(",");
      return `${group.appName}:${group.sourceAppName ?? ""}:${pathToken}`;
    })
    .join("|");
  return createHash("sha256").update(`${planId}|${tokenInput}`).digest("hex");
}

async function* walkPath(
  root: string,
  depth = 0,
  counter = { count: 0 }
): AsyncGenerator<{ path: string; size: number; modified: Date }> {
  if (depth > MAX_LEFTOVER_DEPTH) {
    throw new LeftoverMeasurementProtection(DEEP_LEFTOVER_PROTECTION);
  }
  if (counter.count >= MAX_LEFTOVER_ITEMS) return;

  let stat: Stats;
  try {
    stat = await fs.lstat(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    throw new LeftoverMeasurementProtection(LINKED_LEFTOVER_PROTECTION);
  }
  if (stat.isFile()) {
    counter.count += 1;
    yield { path: root, size: stat.size, modified: stat.mtime };
    return;
  }
  if (!stat.isDirectory()) return;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    throw new LeftoverMeasurementProtection(UNREADABLE_LEFTOVER_PROTECTION);
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (counter.count >= MAX_LEFTOVER_ITEMS) return;
    if (entry.isSymbolicLink()) {
      throw new LeftoverMeasurementProtection(LINKED_LEFTOVER_PROTECTION);
    }
    yield* walkPath(join(root, entry.name), depth + 1, counter);
  }
}

async function measurePath(raw: string): Promise<{
  exists: boolean;
  sizeBytes?: number;
  lastModifiedAt?: string;
  fingerprint?: string;
  protectedBy?: string;
}> {
  try {
    const rootStat = await fs.lstat(raw);
    if (rootStat.isSymbolicLink()) {
      return { exists: true, protectedBy: LINKED_LEFTOVER_PROTECTION };
    }
    if (rootStat.isFile()) {
      return {
        exists: true,
        sizeBytes: rootStat.size,
        lastModifiedAt: rootStat.mtime.toISOString(),
        fingerprint: metadataFingerprint([
          ["file", "", String(rootStat.size), String(Math.round(rootStat.mtimeMs))]
        ])
      };
    }
    if (!rootStat.isDirectory()) return { exists: false };

    let total = 0;
    let latest = rootStat.mtime;
    const fingerprintParts: string[][] = [
      ["dir", "", String(Math.round(rootStat.mtimeMs))]
    ];
    for await (const file of walkPath(raw)) {
      total += file.size;
      if (file.modified.getTime() > latest.getTime()) latest = file.modified;
      fingerprintParts.push([
        "file",
        normalizePath(relativePath(raw, file.path)),
        String(file.size),
        String(Math.round(file.modified.getTime()))
      ]);
    }
    return {
      exists: true,
      sizeBytes: total,
      lastModifiedAt: latest.toISOString(),
      fingerprint: metadataFingerprint(fingerprintParts)
    };
  } catch (err) {
    if (err instanceof LeftoverMeasurementProtection) {
      return { exists: true, protectedBy: err.message };
    }
    return { exists: false };
  }
}

function relativePath(root: string, path: string): string {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  if (normalizedPath === normalizedRoot) return "";
  const prefix = normalizedRoot.endsWith("\\") ? normalizedRoot : `${normalizedRoot}\\`;
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath;
}

function metadataFingerprint(parts: string[][]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part.join("\0"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function pathInfo(
  raw: string,
  env: LeftoverEnv
): Promise<AppLeftoverPath> {
  const normalized = normalizePath(raw);
  // The blocklist tells us whether Cleanup engine could ever touch
  // this path. If not, we mark it `protectedBy` so the UI explains why
  // the user can't enqueue it for deletion. We're not blocking the
  // surface from showing the path — only making the protection
  // transparent.
  const decision = evaluatePath(raw, { allowRoots: [raw], home: env.home });

  const measured = await measurePath(raw);

  return {
    id: makePathId(raw),
    path: raw,
    exists: measured.exists,
    sizeBytes: measured.sizeBytes,
    lastModifiedAt: measured.lastModifiedAt,
    fingerprint: measured.fingerprint,
    protectedBy: decision.allowed ? measured.protectedBy : decision.blockedBy ?? normalized
  };
}

function isUsefulGenericName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  if (GENERIC_NAME_BLOCKLIST.test(trimmed)) return false;
  if (/^kb\d{6,}$/i.test(trimmed)) return false;
  return /[a-z가-힣0-9]/i.test(trimmed);
}

function cleanGenericName(value: string): string {
  return value
    .replace(/[™®©]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/[,.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function genericFolderNames(app: InstalledApp): string[] {
  const raw = cleanGenericName(app.name ?? "");
  const withoutArchitecture = raw
    .replace(/\s*\((?:x64|x86|64-bit|32-bit|user|machine)\)\s*$/i, "")
    .trim();
  const withoutVersion = withoutArchitecture
    .replace(/\s+v?\d+(?:\.\d+){0,4}\s*$/i, "")
    .trim();

  const candidates = [raw, withoutArchitecture, withoutVersion, withoutVersion.replace(/\s+/g, "")]
    .map((value) => value.trim())
    .filter(isUsefulGenericName);

  return Array.from(new Set(candidates));
}

function isRootProgramFilesPath(raw: string, env: LeftoverEnv): boolean {
  const normalized = normalizePath(raw);
  if (/^[a-z]:\\program files(?: \(x86\))?(?:\\|$)/i.test(normalized)) return true;

  const simulatedWindowsRoot = normalizePath(dirname(env.programData));
  if (!simulatedWindowsRoot) return false;
  return (
    normalized === `${simulatedWindowsRoot}\\program files` ||
    normalized.startsWith(`${simulatedWindowsRoot}\\program files\\`) ||
    normalized === `${simulatedWindowsRoot}\\program files (x86)` ||
    normalized.startsWith(`${simulatedWindowsRoot}\\program files (x86)\\`)
  );
}

function hasProgramFilesSegment(raw: string): boolean {
  const normalized = normalizePath(raw);
  return (
    normalized.includes("\\program files\\") ||
    normalized.includes("\\program files (x86)\\")
  );
}

function installFolderNameMatchesApp(raw: string, app: InstalledApp): boolean {
  const folderName = cleanGenericName(basename(raw)).toLowerCase();
  const compactFolderName = folderName.replace(/\s+/g, "");
  if (!folderName || !compactFolderName) return false;

  return genericFolderNames(app)
    .map((name) => cleanGenericName(name).toLowerCase())
    .some((name) => {
      const compactName = name.replace(/\s+/g, "");
      return folderName === name || compactFolderName === compactName;
    });
}

function isTrustedInstallFolderPath(raw: string, app: InstalledApp, env: LeftoverEnv): boolean {
  if (!isRootProgramFilesPath(raw, env)) return false;
  return installFolderNameMatchesApp(raw, app);
}

const PUBLISHER_LEGAL_SUFFIX_PATTERN =
  /\s*(?:,?\s*)?(?:incorporated|inc|llc|ltd|limited|corp|corporation|co|company|gmbh|pte\.?\s*ltd|labs)\.?$/i;

function publisherNameVariants(value: string): string[] {
  const variants: string[] = [];
  let current = cleanGenericName(value);

  for (let attempts = 0; attempts < 4 && current; attempts += 1) {
    variants.push(current);
    const next = cleanGenericName(current.replace(PUBLISHER_LEGAL_SUFFIX_PATTERN, ""));
    if (!next || next === current) break;
    current = next;
  }

  return variants;
}

function genericPublisherFolderNames(app: InstalledApp): string[] {
  const candidates = publisherNameVariants(app.publisher ?? "")
    .flatMap((name) => [name, name.replace(/\s+/g, "")])
    .map((value) => value.trim())
    .filter(isUsefulGenericName);

  return Array.from(new Set(candidates));
}

async function genericLeftoverPaths(
  app: InstalledApp,
  env: LeftoverEnv
): Promise<AppLeftoverPath[]> {
  const names = genericFolderNames(app);
  const publisherNames = genericPublisherFolderNames(app);
  const roots = [env.roaming, env.localAppData, env.localLow, env.programData];
  const paths: AppLeftoverPath[] = [];
  const seen = new Set<string>();

  async function addExistingPath(candidate: string): Promise<void> {
    const key = normalizePath(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const info = await pathInfo(candidate, env);
    if (info.exists) paths.push({ ...info, kind: "folder" });
  }

  for (const root of roots) {
    for (const name of names) {
      await addExistingPath(join(root, name));
    }

    for (const publisherName of publisherNames) {
      for (const name of names) {
        await addExistingPath(join(root, publisherName, name));
      }
    }
  }

  return paths;
}

function shortcutMatchNames(app: InstalledApp): string[] {
  return genericFolderNames(app)
    .map((name) => cleanGenericName(name).toLowerCase())
    .filter(Boolean);
}

function shortcutNameMatchesApp(filePath: string, names: string[]): boolean {
  if (!filePath.toLowerCase().endsWith(".lnk")) return false;
  const rawBaseName = basename(filePath).replace(/\.lnk$/i, "");
  const normalizedBaseName = cleanGenericName(rawBaseName).toLowerCase();
  const compactBaseName = normalizedBaseName.replace(/\s+/g, "");
  if (!normalizedBaseName || !compactBaseName) return false;

  return names.some((name) => {
    const compactName = name.replace(/\s+/g, "");
    return (
      normalizedBaseName === name ||
      compactBaseName === compactName ||
      normalizedBaseName.includes(name) ||
      compactBaseName.includes(compactName)
    );
  });
}

function shortcutRoots(env: LeftoverEnv): string[] {
  return [
    join(env.home, "Desktop"),
    join(dirname(env.home), "Public", "Desktop"),
    join(env.roaming, "Microsoft", "Windows", "Start Menu", "Programs"),
    join(env.programData, "Microsoft", "Windows", "Start Menu", "Programs"),
    ...pinnedShortcutRoots(env)
  ];
}

function shortcutFolderRoots(env: LeftoverEnv): string[] {
  return [
    join(env.roaming, "Microsoft", "Windows", "Start Menu", "Programs"),
    join(env.programData, "Microsoft", "Windows", "Start Menu", "Programs")
  ];
}

function isStartupShortcutFolder(path: string): boolean {
  const normalized = normalizePath(path);
  return (
    normalized.endsWith("\\microsoft\\windows\\start menu\\programs\\startup") ||
    normalized.includes("\\microsoft\\windows\\start menu\\programs\\startup\\")
  );
}

function pinnedShortcutRoots(env: LeftoverEnv): string[] {
  const pinnedRoot = join(
    env.roaming,
    "Microsoft",
    "Internet Explorer",
    "Quick Launch",
    "User Pinned"
  );
  return [join(pinnedRoot, "TaskBar"), join(pinnedRoot, "StartMenu")];
}

function isPinnedShortcutPath(path: string, env: LeftoverEnv): boolean {
  return path.toLowerCase().endsWith(".lnk") &&
    pinnedShortcutRoots(env).some((root) => isAtOrInside(path, root));
}

function isShortcutPathAllowed(path: string, env: LeftoverEnv): boolean {
  return (
    path.toLowerCase().endsWith(".lnk") &&
    !isStartupShortcutFolder(path) &&
    shortcutRoots(env).some((root) => isAtOrInside(path, root))
  );
}

function isShortcutFolderPathAllowed(path: string, env: LeftoverEnv): boolean {
  return (
    !isStartupShortcutFolder(path) &&
    shortcutFolderRoots(env).some((root) => isAtOrInside(path, root) && normalizePath(path) !== normalizePath(root))
  );
}

async function findShortcutFiles(
  root: string,
  names: string[],
  depth = 0,
  counter = { count: 0 }
): Promise<string[]> {
  if (depth > MAX_SHORTCUT_SCAN_DEPTH || counter.count >= MAX_SHORTCUT_SCAN_ITEMS) return [];
  if (isStartupShortcutFolder(root)) return [];

  let stat: Stats;
  try {
    stat = await fs.lstat(root);
  } catch {
    return [];
  }
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) {
    counter.count += 1;
    return shortcutNameMatchesApp(root, names) ? [root] : [];
  }
  if (!stat.isDirectory()) return [];

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    if (counter.count >= MAX_SHORTCUT_SCAN_ITEMS) break;
    if (entry.isSymbolicLink()) continue;
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findShortcutFiles(child, names, depth + 1, counter)));
      continue;
    }
    if (!entry.isFile()) continue;
    counter.count += 1;
    if (shortcutNameMatchesApp(child, names)) found.push(child);
  }
  return found;
}

function shortcutFolderNameMatchesApp(folderPath: string, names: string[]): boolean {
  const normalizedBaseName = cleanGenericName(basename(folderPath)).toLowerCase();
  const compactBaseName = normalizedBaseName.replace(/\s+/g, "");
  if (!normalizedBaseName || !compactBaseName) return false;

  return names.some((name) => {
    const compactName = name.replace(/\s+/g, "");
    return normalizedBaseName === name || compactBaseName === compactName;
  });
}

async function findShortcutFolders(
  root: string,
  names: string[],
  env: LeftoverEnv,
  depth = 0,
  counter = { count: 0 }
): Promise<string[]> {
  if (depth > MAX_SHORTCUT_SCAN_DEPTH || counter.count >= MAX_SHORTCUT_SCAN_ITEMS) return [];
  if (isStartupShortcutFolder(root)) return [];

  let stat: Stats;
  try {
    stat = await fs.lstat(root);
  } catch {
    return [];
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) return [];

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    if (counter.count >= MAX_SHORTCUT_SCAN_ITEMS) break;
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    counter.count += 1;
    const child = join(root, entry.name);
    if (!isShortcutFolderPathAllowed(child, env)) continue;
    if (shortcutFolderNameMatchesApp(child, names)) {
      found.push(child);
      continue;
    }
    found.push(...(await findShortcutFolders(child, names, env, depth + 1, counter)));
  }
  return found;
}

async function shortcutLeftoverPaths(
  app: InstalledApp,
  env: LeftoverEnv
): Promise<AppLeftoverPath[]> {
  const names = shortcutMatchNames(app);
  if (names.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  const seen = new Set<string>();
  const folderPaths: string[] = [];
  for (const root of shortcutFolderRoots(env)) {
    for (const folderPath of await findShortcutFolders(root, names, env)) {
      const key = normalizePath(folderPath);
      if (seen.has(key)) continue;
      seen.add(key);
      folderPaths.push(folderPath);
      const info = await pathInfo(folderPath, env);
      paths.push({
        ...info,
        protectedBy: isShortcutFolderPathAllowed(folderPath, env)
          ? info.protectedBy && !info.protectedBy.includes("ProgramData\\Microsoft")
            ? info.protectedBy
            : undefined
          : info.protectedBy ?? "지원하는 바로가기 폴더 위치가 아니라 자동 정리하지 않아요.",
        kind: "shortcut-folder"
      });
    }
  }

  for (const root of shortcutRoots(env)) {
    for (const shortcutPath of await findShortcutFiles(root, names)) {
      if (folderPaths.some((folderPath) => isAtOrInside(shortcutPath, folderPath))) continue;
      const key = normalizePath(shortcutPath);
      if (seen.has(key)) continue;
      seen.add(key);
      const info = await pathInfo(shortcutPath, env);
      paths.push({
        ...info,
        protectedBy: isShortcutPathAllowed(shortcutPath, env)
          ? info.protectedBy && !info.protectedBy.includes("ProgramData\\Microsoft")
            ? info.protectedBy
            : undefined
          : info.protectedBy ?? "지원하는 바로가기 위치가 아니라 자동 정리하지 않아요.",
        kind: isPinnedShortcutPath(shortcutPath, env) ? "pinned-shortcut" : "shortcut"
      });
    }
  }
  return paths;
}

async function installLocationLeftoverPaths(
  app: InstalledApp,
  env: LeftoverEnv
): Promise<AppLeftoverPath[]> {
  const installLocation = app.installLocation?.trim();
  if (!installLocation) return [];

  const info = await pathInfo(installLocation, env);
  const installStat = await fs.lstat(installLocation).catch(() => null);
  const personalProtection =
    personalInstallLocationProtection(installLocation, env) ??
    userHomeProgramFilesAliasProtection(installLocation, app, env);
  const linkedInstallPath = await findLinkedInstallFolderPathPart(installLocation);
  const trustedInstallFolder =
    !personalProtection &&
    isTrustedInstallFolderPath(installLocation, app, env) &&
    Boolean(installStat?.isDirectory()) &&
    !linkedInstallPath;
  const measured = trustedInstallFolder ? await measurePath(installLocation) : undefined;
  const protectedBy = personalProtection
    ? personalProtection
    : linkedInstallPath
      ? LINKED_LEFTOVER_PROTECTION
      : trustedInstallFolder
        ? measured?.protectedBy
        : info.protectedBy;
  return info.exists
    ? [{ ...info, protectedBy, kind: trustedInstallFolder ? "install-folder" : "folder" }]
    : [];
}

function isAtOrInside(raw: string, root: string): boolean {
  const path = normalizePath(raw);
  const normalizedRoot = normalizePath(root);
  return path === normalizedRoot || path.startsWith(`${normalizedRoot}\\`);
}

function personalInstallLocationProtection(raw: string, env: LeftoverEnv): string | undefined {
  const personalRoots = [
    join(env.home, "Desktop"),
    join(env.home, "Documents"),
    join(env.home, "Downloads"),
    join(env.home, "Pictures"),
    join(env.home, "Videos"),
    join(env.home, "Music")
  ];

  return personalRoots.some((root) => isAtOrInside(raw, root))
    ? PERSONAL_INSTALL_LOCATION_PROTECTION
    : undefined;
}

function userHomeProgramFilesAliasProtection(
  raw: string,
  app: InstalledApp,
  env: LeftoverEnv
): string | undefined {
  return hasProgramFilesSegment(raw) && installFolderNameMatchesApp(raw, app) && isAtOrInside(raw, env.home)
    ? "사용자 폴더 안의 Program Files처럼 보이는 경로라 자동 정리하지 않아요."
    : undefined;
}

function registryLeftoverPaths(app: InstalledApp): AppLeftoverPath[] {
  const registryKeyPath = app.registryKeyPath?.trim();
  if (!registryKeyPath) return [];
  const protectedBy = isSafeUninstallRegistryKeyPath(registryKeyPath)
    ? undefined
    : UNSAFE_REGISTRY_PROTECTION;

  return [
    {
      id: makePathId(`registry:${registryKeyPath}`),
      kind: "registry",
      path: registryKeyPath,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null,
      protectedBy
    }
  ];
}

const APP_PATHS_REGISTRY_ROOTS = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
  "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths"
] as const;

const REGISTERED_APPLICATIONS_REGISTRY_ROOTS = [
  "HKCU\\Software\\RegisteredApplications",
  "HKLM\\Software\\RegisteredApplications"
] as const;

const ENVIRONMENT_PATH_REGISTRY_VALUES = [
  { keyPath: "HKCU\\Environment", valueName: "Path" },
  { keyPath: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", valueName: "Path" }
] as const;

const ENVIRONMENT_VARIABLE_REGISTRY_ROOTS = [
  "HKCU\\Environment",
  "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
] as const;

const PROTOCOL_HANDLER_REGISTRY_ROOTS = [
  "HKCU\\Software\\Classes",
  "HKLM\\Software\\Classes"
] as const;

const NATIVE_MESSAGING_HOST_REGISTRY_ROOTS = [
  "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
  "HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts",
  "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
  "HKLM\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
  "HKCU\\Software\\Mozilla\\NativeMessagingHosts",
  "HKLM\\Software\\Mozilla\\NativeMessagingHosts"
] as const;

const KNOWN_PROTOCOL_HANDLER_SCHEMES: Array<{ match: RegExp; schemes: string[] }> = [
  { match: /zoom/i, schemes: ["zoommtg", "zoomphonecall", "zoomus"] },
  { match: /slack/i, schemes: ["slack"] },
  { match: /discord/i, schemes: ["discord"] },
  { match: /visual studio code|\bvs code\b/i, schemes: ["vscode"] },
  { match: /cursor/i, schemes: ["cursor"] },
  { match: /spotify/i, schemes: ["spotify"] },
  { match: /steam/i, schemes: ["steam"] },
  { match: /kakaotalk|kakao talk|카카오톡/i, schemes: ["kakaotalk"] },
  { match: /\bline\b|라인/i, schemes: ["line"] },
  { match: /notion/i, schemes: ["notion"] },
  { match: /figma/i, schemes: ["figma"] },
  { match: /obsidian/i, schemes: ["obsidian"] }
];

const KNOWN_NATIVE_MESSAGING_HOSTS: Array<{ match: RegExp; hosts: string[] }> = [
  { match: /1password/i, hosts: ["com.1password.1password"] },
  { match: /bitwarden/i, hosts: ["com.8bit.bitwarden"] },
  { match: /grammarly/i, hosts: ["com.grammarly.browserextension"] },
  { match: /keeper/i, hosts: ["com.keepersecurity.passwordmanager"] },
  { match: /lastpass/i, hosts: ["com.lastpass.nplastpass"] }
];

function appExecutableNames(app: InstalledApp): string[] {
  const candidates = new Set<string>();
  const installLocation = app.installLocation?.trim();
  if (installLocation && /\.exe$/i.test(installLocation)) {
    candidates.add(basename(installLocation));
  }

  for (const name of genericFolderNames(app)) {
    const cleaned = cleanGenericName(name);
    if (!cleaned) continue;
    candidates.add(cleaned.endsWith(".exe") ? cleaned : `${cleaned}.exe`);
    const compact = cleaned.replace(/\s+/g, "");
    if (compact) candidates.add(compact.endsWith(".exe") ? compact : `${compact}.exe`);
  }

  return Array.from(candidates)
    .map((name) => name.trim())
    .filter((name) => /^[^\\/:*?"<>|\u0000-\u001f\u007f]+\.exe$/i.test(name))
    .slice(0, 8);
}

function registeredApplicationValueNames(app: InstalledApp): string[] {
  const candidates = new Set<string>();
  for (const name of genericFolderNames(app)) {
    const cleaned = cleanGenericName(name);
    if (!cleaned) continue;
    candidates.add(cleaned);
    const compact = cleaned.replace(/\s+/g, "");
    if (compact) candidates.add(compact);
  }

  return Array.from(candidates)
    .map((name) => name.trim())
    .filter((name) => /^[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128}$/.test(name))
    .slice(0, 8);
}

function protocolHandlerSchemeNames(app: InstalledApp): string[] {
  const text = `${app.name} ${app.publisher ?? ""}`;
  const candidates = new Set<string>();

  for (const mapping of KNOWN_PROTOCOL_HANDLER_SCHEMES) {
    if (mapping.match.test(text)) {
      for (const scheme of mapping.schemes) candidates.add(scheme);
    }
  }

  for (const name of genericFolderNames(app)) {
    const compact = cleanGenericName(name).replace(/\s+/g, "").toLowerCase();
    const scheme = normalizeSafeProtocolScheme(compact);
    if (scheme) candidates.add(scheme);
  }

  for (const executableName of appExecutableNames(app)) {
    const stem = executableName.replace(/\.exe$/i, "").replace(/\s+/g, "").toLowerCase();
    const scheme = normalizeSafeProtocolScheme(stem);
    if (scheme) candidates.add(scheme);
  }

  return Array.from(candidates).slice(0, 12);
}

function nativeMessagingHostNames(app: InstalledApp): string[] {
  const text = `${app.name} ${app.publisher ?? ""}`;
  const candidates = new Set<string>();

  for (const mapping of KNOWN_NATIVE_MESSAGING_HOSTS) {
    if (mapping.match.test(text)) {
      for (const host of mapping.hosts) candidates.add(host);
    }
  }

  for (const name of genericFolderNames(app)) {
    const cleaned = cleanGenericName(name).toLowerCase();
    const compact = cleaned.replace(/\s+/g, "");
    const dotted = cleaned
      .split(/\s+/)
      .map((part) => part.replace(/[^a-z0-9_-]/g, ""))
      .filter(Boolean)
      .join(".");
    for (const host of [compact, dotted ? `com.${dotted}` : ""]) {
      const safeHost = normalizeSafeNativeMessagingHostName(host);
      if (safeHost) candidates.add(safeHost);
    }
  }

  return Array.from(candidates).slice(0, 12);
}

function environmentVariableValueNames(app: InstalledApp): string[] {
  const candidates = new Set<string>();

  for (const name of genericFolderNames(app)) {
    const cleaned = cleanGenericName(name)
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    const compact = cleaned.replace(/_/g, "");
    for (const base of [cleaned, compact]) {
      if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(base)) continue;
      candidates.add(`${base}_HOME`);
      candidates.add(`${base}_ROOT`);
      candidates.add(`${base}_DIR`);
      candidates.add(`${base}_PATH`);
    }
  }

  return Array.from(candidates)
    .filter((name) => isSafeEnvironmentVariableRegistryValuePath("HKCU\\Environment", name))
    .slice(0, 20);
}

function fileAssociationProgIds(app: InstalledApp): string[] {
  const candidates = new Set<string>();

  for (const name of genericFolderNames(app)) {
    const compact = cleanGenericName(name).replace(/[^A-Za-z0-9]+/g, "");
    if (!/^[A-Za-z][A-Za-z0-9]{2,63}$/.test(compact)) continue;
    candidates.add(compact);
    candidates.add(`${compact}.File`);
    candidates.add(`${compact}.Document`);
    candidates.add(`${compact}.Document.1`);
  }

  return Array.from(candidates)
    .filter((progId) => isSafeFileAssociationRegistryKeyPath(`HKCU\\Software\\Classes\\${progId}`))
    .slice(0, 16);
}

async function registryKeyExists(
  keyPath: string,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<boolean> {
  const keyExists =
    runner?.keyExists ??
    (process.platform === "win32" ? defaultRegistryCleanupRunner().keyExists : undefined);
  if (!keyExists) return false;
  try {
    return await keyExists(keyPath);
  } catch {
    return false;
  }
}

async function registryValueExists(
  keyPath: string,
  valueName: string,
  runner?: Pick<RegistryCleanupRunner, "valueExists">
): Promise<boolean> {
  const valueExists =
    runner?.valueExists ??
    (process.platform === "win32" ? defaultRegistryCleanupRunner().valueExists : undefined);
  if (!valueExists) return false;
  try {
    return await valueExists(keyPath, valueName);
  } catch {
    return false;
  }
}

async function registryValueRecord(
  keyPath: string,
  valueName: string,
  runner?: Pick<RegistryCleanupRunner, "queryValue">
): Promise<{ type: string; data: string } | undefined> {
  const queryValue =
    runner?.queryValue ??
    (process.platform === "win32" ? defaultRegistryCleanupRunner().queryValue : undefined);
  if (!queryValue) return undefined;
  try {
    return await queryValue(keyPath, valueName);
  } catch {
    return undefined;
  }
}

async function registryValues(
  keyPath: string,
  runner?: Pick<RegistryCleanupRunner, "listValues">
): Promise<Array<{ valueName: string; type: string; data: string }>> {
  const listValues =
    runner?.listValues ??
    (process.platform === "win32" ? defaultRegistryCleanupRunner().listValues : undefined);
  if (!listValues) return [];
  try {
    return await listValues(keyPath);
  } catch {
    return [];
  }
}

async function registrySubKeys(
  keyPath: string,
  runner?: Pick<RegistryCleanupRunner, "listSubKeys">
): Promise<string[]> {
  const listSubKeys =
    runner?.listSubKeys ??
    (process.platform === "win32" ? defaultRegistryCleanupRunner().listSubKeys : undefined);
  if (!listSubKeys) return [];
  try {
    return await listSubKeys(keyPath);
  } catch {
    return [];
  }
}

async function appPathRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const executableNames = appExecutableNames(app);
  if (executableNames.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of APP_PATHS_REGISTRY_ROOTS) {
    for (const executableName of executableNames) {
      const keyPath = `${root}\\${executableName}`;
      if (!isSafeAppPathRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`app-path-registry:${keyPath}`),
        kind: "app-path-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

const FILE_ASSOCIATION_REGISTRY_ROOTS = [
  "HKCU\\Software\\Classes",
  "HKLM\\Software\\Classes"
] as const;

async function fileAssociationRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const progIds = fileAssociationProgIds(app);
  if (progIds.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of FILE_ASSOCIATION_REGISTRY_ROOTS) {
    for (const progId of progIds) {
      const keyPath = `${root}\\${progId}`;
      if (!isSafeFileAssociationRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`file-association-registry:${keyPath}`),
        kind: "file-association-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

async function registeredApplicationRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "valueExists" | "queryValue" | "keyExists" | "listValues">
): Promise<AppLeftoverPath[]> {
  const valueNames = registeredApplicationValueNames(app);
  if (valueNames.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const keyPath of REGISTERED_APPLICATIONS_REGISTRY_ROOTS) {
    for (const valueName of valueNames) {
      if (!isSafeRegisteredApplicationRegistryValuePath(keyPath, valueName)) continue;
      const record = await registryValueRecord(keyPath, valueName, runner);
      if (!record && !(await registryValueExists(keyPath, valueName, runner))) continue;
      paths.push({
        id: makePathId(`registered-app-registry:${keyPath}:${valueName}`),
        kind: "registered-app-registry",
        path: keyPath,
        registryValueName: valueName,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });

      const capabilitiesKeyPath = record
        ? registeredApplicationCapabilitiesKeyPath(keyPath, record.data)
        : undefined;
      if (!capabilitiesKeyPath) continue;
      if (!(await registryKeyExists(capabilitiesKeyPath, runner))) continue;
      paths.push({
        id: makePathId(`app-capabilities-registry:${capabilitiesKeyPath}`),
        kind: "app-capabilities-registry",
        path: capabilitiesKeyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
      paths.push(...(await capabilitiesFileAssociationRegistryLeftoverPaths(capabilitiesKeyPath, runner)));
      paths.push(...(await capabilitiesUrlAssociationRegistryLeftoverPaths(capabilitiesKeyPath, runner)));
    }
  }
  return paths;
}

function registeredApplicationCapabilitiesKeyPath(
  registeredApplicationsKeyPath: string,
  valueData: string
): string | undefined {
  const root = registeredApplicationsKeyPath.startsWith("HKLM\\") ? "HKLM" : "HKCU";
  const relativePath = valueData.trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
  if (!relativePath || relativePath !== valueData.trim()) return undefined;
  if (!/^Software\\/i.test(relativePath)) return undefined;
  if (/^(?:HKCU|HKLM|HKEY_CURRENT_USER|HKEY_LOCAL_MACHINE)\\/i.test(relativePath)) {
    return undefined;
  }
  const keyPath = `${root}\\${relativePath}`;
  return isSafeAppCapabilitiesRegistryKeyPath(keyPath) ? keyPath : undefined;
}

async function capabilitiesFileAssociationRegistryLeftoverPaths(
  capabilitiesKeyPath: string,
  runner?: Pick<RegistryCleanupRunner, "listValues" | "keyExists">
): Promise<AppLeftoverPath[]> {
  const classRoot = capabilitiesKeyPath.startsWith("HKLM\\")
    ? "HKLM\\Software\\Classes"
    : "HKCU\\Software\\Classes";
  const paths: AppLeftoverPath[] = [];

  for (const record of await registryValues(`${capabilitiesKeyPath}\\FileAssociations`, runner)) {
    if (!/^\.[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(record.valueName)) continue;
    const progId = record.data.trim();
    if (progId !== record.data) continue;
    const keyPath = `${classRoot}\\${progId}`;
    if (!isSafeFileAssociationRegistryKeyPath(keyPath)) continue;
    if (!(await registryKeyExists(keyPath, runner))) continue;
    paths.push({
      id: makePathId(`file-association-registry:${keyPath}`),
      kind: "file-association-registry",
      path: keyPath,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null
    });
  }

  return paths;
}

async function capabilitiesUrlAssociationRegistryLeftoverPaths(
  capabilitiesKeyPath: string,
  runner?: Pick<RegistryCleanupRunner, "listValues" | "keyExists">
): Promise<AppLeftoverPath[]> {
  const classRoot = capabilitiesKeyPath.startsWith("HKLM\\")
    ? "HKLM\\Software\\Classes"
    : "HKCU\\Software\\Classes";
  const paths: AppLeftoverPath[] = [];

  for (const record of await registryValues(`${capabilitiesKeyPath}\\URLAssociations`, runner)) {
    if (normalizeSafeProtocolScheme(record.valueName) !== record.valueName.toLowerCase()) continue;
    const progId = record.data.trim();
    if (progId !== record.data) continue;
    const keyPath = `${classRoot}\\${progId}`;
    if (!isSafeProtocolHandlerRegistryKeyPath(keyPath)) continue;
    if (!(await registryKeyExists(keyPath, runner))) continue;
    paths.push({
      id: makePathId(`protocol-handler-registry:${keyPath}`),
      kind: "protocol-handler-registry",
      path: keyPath,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null
    });
  }

  return paths;
}

async function protocolHandlerRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "valueExists">
): Promise<AppLeftoverPath[]> {
  const schemes = protocolHandlerSchemeNames(app);
  if (schemes.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of PROTOCOL_HANDLER_REGISTRY_ROOTS) {
    for (const scheme of schemes) {
      const keyPath = `${root}\\${scheme}`;
      if (!isSafeProtocolHandlerRegistryKeyPath(keyPath)) continue;
      if (!(await registryValueExists(keyPath, "URL Protocol", runner))) continue;
      paths.push({
        id: makePathId(`protocol-handler-registry:${keyPath}`),
        kind: "protocol-handler-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

async function nativeMessagingHostRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const hosts = nativeMessagingHostNames(app);
  if (hosts.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of NATIVE_MESSAGING_HOST_REGISTRY_ROOTS) {
    for (const host of hosts) {
      const keyPath = `${root}\\${host}`;
      if (!isSafeNativeMessagingHostRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`native-messaging-host-registry:${keyPath}`),
        kind: "native-messaging-host-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

function environmentPathSegments(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function environmentPathSegmentMatchesApp(segment: string, app: InstalledApp): boolean {
  const portableSegment = segment.replace(/\\/g, "/");
  const candidates = [
    portableSegment,
    dirname(portableSegment),
    dirname(dirname(portableSegment))
  ];
  return candidates.some((candidate) => installFolderNameMatchesApp(candidate, app));
}

async function environmentPathRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "queryValue">
): Promise<AppLeftoverPath[]> {
  const paths: AppLeftoverPath[] = [];
  const seen = new Set<string>();

  for (const { keyPath, valueName } of ENVIRONMENT_PATH_REGISTRY_VALUES) {
    if (!isSafeEnvironmentPathRegistryValuePath(keyPath, valueName)) continue;
    const record = await registryValueRecord(keyPath, valueName, runner);
    if (!record?.data) continue;
    for (const rawSegment of environmentPathSegments(record.data)) {
      const segment = normalizeSafeEnvironmentPathSegment(rawSegment);
      if (!segment) continue;
      if (!environmentPathSegmentMatchesApp(segment, app)) continue;
      const key = normalizePath(`${keyPath}\\${valueName}\\${segment}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push({
        id: makePathId(`environment-path-registry:${keyPath}:${valueName}:${segment}`),
        kind: "environment-path-registry",
        path: keyPath,
        registryValueName: valueName,
        environmentPathSegment: segment,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }

  return paths;
}

async function environmentVariableRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "queryValue">
): Promise<AppLeftoverPath[]> {
  const valueNames = environmentVariableValueNames(app);
  if (valueNames.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  const seen = new Set<string>();

  for (const keyPath of ENVIRONMENT_VARIABLE_REGISTRY_ROOTS) {
    for (const valueName of valueNames) {
      if (!isSafeEnvironmentVariableRegistryValuePath(keyPath, valueName)) continue;
      const record = await registryValueRecord(keyPath, valueName, runner);
      if (!record) continue;
      const key = normalizePath(`${keyPath}\\${valueName}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push({
        id: makePathId(`environment-variable-registry:${keyPath}:${valueName}`),
        kind: "environment-variable-registry",
        path: keyPath,
        registryValueName: valueName,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }

  return paths;
}

const FIREWALL_RULES_REGISTRY_KEY =
  "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\FirewallRules";
const SERVICE_REGISTRY_ROOT = "HKLM\\SYSTEM\\CurrentControlSet\\Services";

function firewallRuleFields(data: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const rawPart of data.split("|")) {
    const separatorIndex = rawPart.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = rawPart.slice(0, separatorIndex).trim().toLowerCase();
    const value = rawPart.slice(separatorIndex + 1).trim();
    if (key && value) fields.set(key, value);
  }
  return fields;
}

function executablePathFromCommand(rawPath: string): string | undefined {
  const trimmed = rawPath.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"')) {
    const closingQuoteIndex = trimmed.indexOf('"', 1);
    const quoted = closingQuoteIndex > 1 ? trimmed.slice(1, closingQuoteIndex) : "";
    if (/\.exe$/i.test(quoted)) return quoted;
  }
  return trimmed.match(/^[A-Za-z]:\\.*?\.exe\b/i)?.[0];
}

function executablePathMatchesApp(rawPath: string, app: InstalledApp): boolean {
  const executablePath = executablePathFromCommand(rawPath) ?? rawPath.trim();
  if (!/\.exe$/i.test(executablePath)) return false;
  const normalizedPath = normalizePath(executablePath).toLowerCase();
  const installLocation = app.installLocation?.trim();
  if (installLocation) {
    const normalizedInstall = normalizePath(installLocation).toLowerCase();
    if (/\.exe$/i.test(installLocation) && normalizedPath === normalizedInstall) return true;
    if (!/\.exe$/i.test(installLocation) && isAtOrInside(executablePath, installLocation)) {
      return true;
    }
  }

  const executableBaseName = basename(executablePath).toLowerCase();
  if (appExecutableNames(app).some((candidate) => candidate.toLowerCase() === executableBaseName)) {
    return true;
  }

  const executableStem = cleanGenericName(basename(executablePath).replace(/\.exe$/i, ""))
    .replace(/\s+/g, "")
    .toLowerCase();
  return genericFolderNames(app)
    .map((name) => cleanGenericName(name))
    .some((name) => {
      const lowerName = name.toLowerCase();
      const compactName = lowerName.replace(/\s+/g, "");
      return (
        executableStem === compactName ||
        normalizedPath.includes(`\\${lowerName}\\`) ||
        normalizedPath.includes(`\\${compactName}\\`)
      );
    });
}

function firewallRuleValueMatchesApp(data: string, app: InstalledApp): boolean {
  const fields = firewallRuleFields(data);
  const appPath = fields.get("app");
  if (!appPath) return false;
  return executablePathMatchesApp(appPath, app);
}

async function firewallRuleRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "listValues">
): Promise<AppLeftoverPath[]> {
  const values = await registryValues(FIREWALL_RULES_REGISTRY_KEY, runner);
  const paths: AppLeftoverPath[] = [];
  for (const value of values) {
    if (!isSafeFirewallRuleRegistryValuePath(FIREWALL_RULES_REGISTRY_KEY, value.valueName)) continue;
    if (!/^REG_SZ$/i.test(value.type)) continue;
    if (!firewallRuleValueMatchesApp(value.data, app)) continue;
    paths.push({
      id: makePathId(`firewall-rule-registry:${FIREWALL_RULES_REGISTRY_KEY}:${value.valueName}`),
      kind: "firewall-rule-registry",
      path: FIREWALL_RULES_REGISTRY_KEY,
      registryValueName: value.valueName,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null
    });
  }
  return paths;
}

async function serviceRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "listSubKeys" | "queryValue">
): Promise<AppLeftoverPath[]> {
  const serviceNames = await registrySubKeys(SERVICE_REGISTRY_ROOT, runner);
  if (serviceNames.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const rawServiceName of serviceNames) {
    const serviceName = normalizeSafeServiceName(rawServiceName);
    if (!serviceName) continue;
    const keyPath = serviceRegistryKeyPath(serviceName);
    if (!isSafeServiceRegistryKeyPath(keyPath)) continue;
    const imagePath = await registryValueRecord(keyPath, "ImagePath", runner);
    if (!imagePath?.data || !executablePathMatchesApp(imagePath.data, app)) continue;
    paths.push({
      id: makePathId(`service-registry:${keyPath}`),
      kind: "service-registry",
      path: keyPath,
      serviceName,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null
    });
  }

  return paths;
}

const OPEN_WITH_REGISTRY_ROOTS = [
  "HKCU\\Software\\Classes\\Applications",
  "HKLM\\Software\\Classes\\Applications"
] as const;

async function openWithRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const executableNames = appExecutableNames(app);
  if (executableNames.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of OPEN_WITH_REGISTRY_ROOTS) {
    for (const executableName of executableNames) {
      const keyPath = `${root}\\${executableName}`;
      if (!isSafeOpenWithRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`open-with-registry:${keyPath}`),
        kind: "open-with-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

const CONTEXT_MENU_REGISTRY_ROOTS = [
  "HKCU\\Software\\Classes\\*\\shell",
  "HKCU\\Software\\Classes\\Directory\\shell",
  "HKCU\\Software\\Classes\\Directory\\Background\\shell",
  "HKCU\\Software\\Classes\\Folder\\shell",
  "HKLM\\Software\\Classes\\*\\shell",
  "HKLM\\Software\\Classes\\Directory\\shell",
  "HKLM\\Software\\Classes\\Directory\\Background\\shell",
  "HKLM\\Software\\Classes\\Folder\\shell"
] as const;

const SHELL_EXTENSION_REGISTRY_ROOTS = [
  "HKCU\\Software\\Classes\\*\\shellex\\ContextMenuHandlers",
  "HKCU\\Software\\Classes\\AllFilesystemObjects\\shellex\\ContextMenuHandlers",
  "HKCU\\Software\\Classes\\Directory\\shellex\\ContextMenuHandlers",
  "HKCU\\Software\\Classes\\Directory\\Background\\shellex\\ContextMenuHandlers",
  "HKCU\\Software\\Classes\\Drive\\shellex\\ContextMenuHandlers",
  "HKCU\\Software\\Classes\\Folder\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\*\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\AllFilesystemObjects\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\Directory\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\Directory\\Background\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\Drive\\shellex\\ContextMenuHandlers",
  "HKLM\\Software\\Classes\\Folder\\shellex\\ContextMenuHandlers"
] as const;

function contextMenuNames(app: InstalledApp): string[] {
  const candidates = new Set<string>();
  for (const name of genericFolderNames(app)) {
    const cleaned = cleanGenericName(name);
    if (!cleaned) continue;
    candidates.add(cleaned);
    const compact = cleaned.replace(/\s+/g, "");
    if (compact) candidates.add(compact);
  }

  return Array.from(candidates)
    .map((name) => name.trim())
    .filter((name) => /^[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128}$/.test(name))
    .slice(0, 8);
}

async function contextMenuRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const names = contextMenuNames(app);
  if (names.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of CONTEXT_MENU_REGISTRY_ROOTS) {
    for (const name of names) {
      const keyPath = `${root}\\${name}`;
      if (!isSafeContextMenuRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`context-menu-registry:${keyPath}`),
        kind: "context-menu-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

async function shellExtensionRegistryLeftoverPaths(
  app: InstalledApp,
  runner?: Pick<RegistryCleanupRunner, "keyExists">
): Promise<AppLeftoverPath[]> {
  const names = contextMenuNames(app);
  if (names.length === 0) return [];

  const paths: AppLeftoverPath[] = [];
  for (const root of SHELL_EXTENSION_REGISTRY_ROOTS) {
    for (const name of names) {
      const keyPath = `${root}\\${name}`;
      if (!isSafeShellExtensionRegistryKeyPath(keyPath)) continue;
      if (!(await registryKeyExists(keyPath, runner))) continue;
      paths.push({
        id: makePathId(`shell-extension-registry:${keyPath}`),
        kind: "shell-extension-registry",
        path: keyPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null
      });
    }
  }
  return paths;
}

function startupTextMatchesApp(entry: StartupAutoEntry, app: InstalledApp): boolean {
  const text = `${entry.name} ${entry.publisher ?? ""} ${entry.path ?? ""}`.toLowerCase();
  const appNames = genericFolderNames(app).map((name) => name.toLowerCase());
  if (appNames.some((name) => text.includes(name))) return true;

  const publisherNames = genericPublisherFolderNames(app).map((name) => name.toLowerCase());
  return publisherNames.some((name) => text.includes(name));
}

async function startupLeftoverPaths(
  app: InstalledApp,
  env: LeftoverEnv,
  entries: StartupAutoEntry[] | undefined
): Promise<AppLeftoverPath[]> {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const paths: AppLeftoverPath[] = [];

  for (const entry of entries) {
    if (!startupTextMatchesApp(entry, app)) continue;
    if (entry.kind === "startup-folder" && entry.path) {
      const startupEntryName = cleanDisplayText(entry.name);
      if (!startupEntryName) continue;
      const info = await pathInfo(entry.path, env);
      paths.push({
        ...info,
        id: makePathId(`startup-folder:${entry.id}:${entry.path}`),
        kind: "startup-folder",
        startupEntryId: entry.id,
        startupEntryName,
        startupOrigin: entry.origin
      });
      continue;
    }
    if (entry.kind === "registry" && entry.registryKeyPath && entry.registryValueName) {
      const keyPath = entry.registryKeyPath;
      const valueName = entry.registryValueName;
      const protectedBy = isSafeStartupRegistryValuePath(keyPath, valueName)
        ? undefined
        : STARTUP_TRACE_PROTECTION;
      paths.push({
        id: makePathId(`startup-registry:${entry.id}:${keyPath}:${valueName}`),
        kind: "startup-registry",
        path: keyPath,
        registryValueName: valueName,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null,
        protectedBy
      });
      continue;
    }

    const entryOrigin = cleanDisplayText(entry.origin);
    const entryName = cleanDisplayText(entry.name);
    if (!entryOrigin || !entryName) continue;
    const label = `${entryOrigin}: ${entryName}`;
    if (entry.kind === "scheduled-task") {
      const safeTaskName = normalizeSafeScheduledTaskName(entryName);
      const safeTaskPath = normalizeSafeScheduledTaskPath(entry.path);
      paths.push({
        id: makePathId(`startup-entry:${entry.id}:${label}`),
        kind: "startup-entry",
        path: label,
        startupEntryId: entry.id,
        startupEntryName: entryName,
        startupEntryKind: entry.kind,
        startupOrigin: entryOrigin,
        scheduledTaskPath: safeTaskPath,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null,
        protectedBy: safeTaskName && safeTaskPath ? undefined : SCHEDULED_TASK_TRACE_PROTECTION
      });
      continue;
    }
    if (entry.kind === "service") {
      const safeServiceName = normalizeSafeServiceName(entry.serviceName);
      paths.push({
        id: makePathId(`startup-entry:${entry.id}:${label}`),
        kind: "startup-entry",
        path: label,
        startupEntryId: entry.id,
        startupEntryName: entryName,
        startupEntryKind: entry.kind,
        startupOrigin: entryOrigin,
        serviceName: safeServiceName,
        exists: true,
        sizeBytes: null,
        lastModifiedAt: null,
        protectedBy: safeServiceName ? undefined : SERVICE_TRACE_PROTECTION
      });
      continue;
    }
    paths.push({
      id: makePathId(`startup-entry:${entry.id}:${label}`),
      kind: "startup-entry",
      path: label,
      startupEntryId: entry.id,
      startupEntryName: entryName,
      startupEntryKind: entry.kind,
      startupOrigin: entryOrigin,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null,
      protectedBy: STARTUP_TRACE_PROTECTION
    });
  }

  return paths;
}

function leftoverUniqueKey(path: AppLeftoverPath): string {
  const registryValueName = path.registryValueName?.trim().toLowerCase() ?? "";
  const environmentPathSegment = path.environmentPathSegment?.trim().toLowerCase() ?? "";
  return [
    path.kind ?? "folder",
    normalizePath(path.path),
    registryValueName,
    environmentPathSegment
  ].join("|");
}

function uniqueLeftoverPaths(paths: AppLeftoverPath[]): AppLeftoverPath[] {
  const seen = new Set<string>();
  const unique: AppLeftoverPath[] = [];

  for (const path of paths) {
    const key = leftoverUniqueKey(path);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(path);
  }

  return unique;
}

export async function planAppLeftovers(
  apps: InstalledApp[],
  options: PlanLeftoversOptions = {}
): Promise<AppLeftoversSnapshot> {
  const home = options.home ?? homedir();
  const env = defaultEnv(home, options.env);
  const installedAppsKnown = options.installedAppsKnown ?? true;
  const normalizedApps = apps
    .map(normalizeAppForPlan)
    .filter((app): app is InstalledApp => app !== null);
  const normalizedExtraApps = (options.extraApps ?? [])
    .map(normalizeAppForPlan)
    .filter((app): app is InstalledApp => app !== null);
  const installedAppKeys = new Set(normalizedApps.map(appIdentityKey));
  const installedAppNames = new Set(normalizedApps.map(appNameKey));

  const groups: AppLeftoverGroup[] = [];
  const seenLabels = new Set<string>();

  const candidates = [
    ...normalizedExtraApps.map((app) => ({ app, source: "uninstall-launched" as const })),
    ...normalizedApps.map((app) => ({ app, source: "installed" as const }))
  ];

  for (const { app, source } of candidates) {
    const rule = ruleForApp(app);
    const cleanupState: AppLeftoverCleanupState | undefined =
      source === "uninstall-launched"
        ? !installedAppsKnown
          ? "not-checked"
          : isStillInstalled(app, installedAppKeys, installedAppNames) ||
              (rule !== undefined &&
                normalizedApps.some((installedApp) =>
                  appMatchesRuleLabel(installedApp, rule.appLabel)
                ))
            ? "still-installed"
            : "removed-confirmed"
        : undefined;
    if (!rule) {
      if (seenLabels.has(app.name)) continue;
      const paths = uniqueLeftoverPaths([
        ...(await genericLeftoverPaths(app, env)),
        ...(await shortcutLeftoverPaths(app, env)),
        ...(await installLocationLeftoverPaths(app, env)),
        ...registryLeftoverPaths(app),
        ...(source === "uninstall-launched"
          ? [
              ...(await registeredApplicationRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await environmentPathRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await environmentVariableRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await firewallRuleRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await appPathRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await openWithRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await fileAssociationRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await protocolHandlerRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await nativeMessagingHostRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await serviceRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await contextMenuRegistryLeftoverPaths(app, options.registryRunner)),
              ...(await shellExtensionRegistryLeftoverPaths(app, options.registryRunner))
            ]
          : []),
        ...(await startupLeftoverPaths(app, env, options.startupEntries))
      ]);
      if (paths.length === 0) continue;
      seenLabels.add(app.name);
      groups.push({
        appName: app.name,
        publisher: app.publisher,
        sourceAppName: app.name,
        source,
        cleanupState,
        paths
      });
      continue;
    }

    if (seenLabels.has(rule.appLabel)) continue;
    seenLabels.add(rule.appLabel);
    const paths: AppLeftoverPath[] = [];
    for (const builder of rule.paths) {
      paths.push({ ...(await pathInfo(builder(env), env)), kind: "folder" });
    }
    paths.push(...(await genericLeftoverPaths(app, env)));
    paths.push(...(await shortcutLeftoverPaths(app, env)));
    paths.push(...(await installLocationLeftoverPaths(app, env)));
    paths.push(...registryLeftoverPaths(app));
    if (source === "uninstall-launched") {
      paths.push(...(await registeredApplicationRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await environmentPathRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await environmentVariableRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await firewallRuleRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await appPathRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await openWithRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await fileAssociationRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await protocolHandlerRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await nativeMessagingHostRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await serviceRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await contextMenuRegistryLeftoverPaths(app, options.registryRunner)));
      paths.push(...(await shellExtensionRegistryLeftoverPaths(app, options.registryRunner)));
    }
    paths.push(...(await startupLeftoverPaths(app, env, options.startupEntries)));

    groups.push({
      appName: rule.appLabel,
      publisher: app.publisher,
      sourceAppName: app.name,
      source,
      cleanupState,
      paths: uniqueLeftoverPaths(paths)
    });
  }

  const planId = randomUUID();
  const snapshot: AppLeftoversSnapshot = {
    planId,
    confirmationToken: planToken(planId, groups),
    generatedAt: new Date().toISOString(),
    groups
  };

  PLAN_CACHE.set(planId, {
    snapshot,
    env,
    expiresAt: Date.now() + PLAN_TTL_MS
  });
  pruneExpiredPlans();
  return snapshot;
}

function pruneExpiredPlans(now?: () => Date): void {
  const t = nowMs(now);
  for (const [id, cached] of PLAN_CACHE.entries()) {
    if (cached.expiresAt <= t) PLAN_CACHE.delete(id);
  }
}

function consumeLeftoversPlan(
  planId: string,
  confirmationToken: string,
  now?: () => Date
): CachedLeftoversPlan | undefined {
  pruneExpiredPlans(now);
  const cached = PLAN_CACHE.get(planId);
  if (!cached) return undefined;
  if (cached.snapshot.confirmationToken !== confirmationToken) {
    PLAN_CACHE.delete(planId);
    return undefined;
  }
  PLAN_CACHE.delete(planId);
  return cached;
}

function peekLeftoversPlan(
  planId: string,
  confirmationToken: string,
  now?: () => Date
): CachedLeftoversPlan | undefined {
  pruneExpiredPlans(now);
  const cached = PLAN_CACHE.get(planId);
  if (!cached) return undefined;
  if (cached.snapshot.confirmationToken !== confirmationToken) {
    PLAN_CACHE.delete(planId);
    return undefined;
  }
  return cached;
}

function allPaths(snapshot: AppLeftoversSnapshot): AppLeftoverPath[] {
  return snapshot.groups.flatMap((group) => group.paths);
}

function selectableLeftoverPath(group: AppLeftoverGroup, path: AppLeftoverPath): boolean {
  return (
    group.source === "uninstall-launched" &&
    group.cleanupState === "removed-confirmed" &&
    path.exists &&
    !path.protectedBy
  );
}

function groupForPath(snapshot: AppLeftoversSnapshot, pathId: string): AppLeftoverGroup | undefined {
  return snapshot.groups.find((group) => group.paths.some((path) => path.id === pathId));
}

function groupIdentityKey(
  group: Pick<AppLeftoverGroup, "appName" | "publisher" | "sourceAppName">
): string {
  const name = group.sourceAppName?.trim() || group.appName;
  return `${name.trim().toLowerCase()}|${(group.publisher ?? "").trim().toLowerCase()}`;
}

function appNameKey(app: Pick<InstalledApp, "name">): string {
  return (app.name ?? "").trim().toLowerCase();
}

function isStillInstalled(
  app: InstalledApp,
  installedAppKeys: Set<string>,
  installedAppNames: Set<string>
): boolean {
  return installedAppKeys.has(appIdentityKey(app)) || installedAppNames.has(appNameKey(app));
}

function currentInstallGuardForGroup(
  group: AppLeftoverGroup | undefined,
  options: Pick<CleanupAppLeftoversOptions, "currentInstalledApps" | "currentInstalledAppsKnown">
): "not-checked" | "not-installed" | "installed" | "unknown" {
  if (!group || group.source !== "uninstall-launched" || group.cleanupState !== "removed-confirmed") {
    return "not-checked";
  }
  if (options.currentInstalledAppsKnown === false) return "unknown";
  if (!options.currentInstalledApps) return "unknown";

  const normalizedCurrentApps = options.currentInstalledApps
    .map(normalizeAppForPlan)
    .filter((app): app is InstalledApp => app !== null);
  const installedAppKeys = new Set(normalizedCurrentApps.map(appIdentityKey));
  const installedAppNames = new Set(normalizedCurrentApps.map(appNameKey));
  const installIdentity = groupInstallIdentity(group);
  return isStillInstalled(installIdentity, installedAppKeys, installedAppNames) ||
    normalizedCurrentApps.some((app) => appMatchesRuleLabel(app, group.appName))
    ? "installed"
    : "not-installed";
}

function followupGroupIsFullyResolved(
  group: AppLeftoverGroup,
  selectedIds: Set<string>,
  resolvedPathIds: Set<string>
): boolean {
  if (!group || group.source !== "uninstall-launched") return false;
  if (group.cleanupState !== "removed-confirmed") return false;
  const selectablePaths = group.paths.filter((path) => selectableLeftoverPath(group, path));
  if (selectablePaths.length === 0) return false;
  return selectablePaths.every((path) => selectedIds.has(path.id) && resolvedPathIds.has(path.id));
}

function rememberResolvedFollowupGroup(
  groups: Map<string, Pick<InstalledApp, "name" | "publisher">>,
  group: AppLeftoverGroup,
  selectedIds: Set<string>,
  resolvedPathIds: Set<string>
): void {
  if (!followupGroupIsFullyResolved(group, selectedIds, resolvedPathIds)) return;
  const identity = groupInstallIdentity(group);
  const name = identity.name?.trim();
  if (!name) return;
  groups.set(groupIdentityKey(group), {
    name,
    publisher: identity.publisher ?? null
  });
}

function groupInstallIdentity(group: AppLeftoverGroup): Pick<InstalledApp, "name" | "publisher"> {
  return {
    name: group.sourceAppName?.trim() || group.appName,
    publisher: group.publisher ?? null
  };
}

function toCleanupItem(path: AppLeftoverPath, snapshot: AppLeftoversSnapshot): CleanupItem {
  const group = groupForPath(snapshot, path.id);
  const pathKind =
    path.kind === "folder" || path.kind === "install-folder" || path.kind === "shortcut-folder"
      ? "directory"
      : path.kind === "shortcut" || path.kind === "pinned-shortcut" || path.kind === "startup-folder"
        ? "file"
        : undefined;
  return {
    id: path.id,
    path: path.path,
    pathKind,
    label: group?.appName ?? "앱 잔여 폴더",
    sizeBytes: Math.max(0, Math.round(path.sizeBytes ?? 0)),
    modifiedAt: path.lastModifiedAt ?? undefined,
    categoryId: "app-leftovers",
    riskLevel: "review",
    reason: "앱 제거 후 남은 앱 데이터 후보",
    appName: group?.appName ?? null,
    appPublisher: group?.publisher ?? null
  };
}

function skipReasonFromTrashError(message: string): CleanupSkippedItem["reason"] {
  return /cleanup-trash refuses|링크|보호 경로|protected source path/i.test(message)
    ? "blocked-path"
    : "execute-failed";
}

function preservedRegistryBackupSkipFields(err: unknown): Pick<
  CleanupSkippedItem,
  "registryBackupId" | "expiresAt" | "detail"
> | null {
  if (!isRegistryBackupPreservedError(err)) return null;
  const message = err.message.trim() || "정리 확인을 끝내지 못했어요.";
  return {
    registryBackupId: err.backup.id,
    expiresAt: err.backup.expiresAt,
    detail: `${message} 백업은 30일 복구함에 남겨뒀어요.`
  };
}

function friendlyRegistryLeftoverFailureDetail(message: string): string {
  if (/PATH/i.test(message)) {
    return "PATH에 남은 앱 경로를 안전하게 확인하지 못해서 그대로 뒀어요.";
  }
  if (/지원하는 앱 제거 레지스트리 위치|지원하는 시작 항목 레지스트리 위치|registry location/i.test(message)) {
    return "지원하는 앱 삭제 흔적 위치가 아니라 자동 정리하지 않았어요.";
  }
  if (/export|backup|백업|reg\.exe|access|denied|eacces|eperm|permission/i.test(message)) {
    return "앱 삭제 흔적 백업을 만들지 못해서 정리하지 않았어요.";
  }
  if (/missing|not found|보이지|찾지|disappear/i.test(message)) {
    return "앱 삭제 흔적 백업을 확인하지 못해서 정리하지 않았어요.";
  }
  return "앱 삭제 흔적 정리 중 문제가 생겨서 그대로 뒀어요.";
}

function friendlyStartupHoldingFailureDetail(message: string): string {
  if (/source path still exists|source|원본/i.test(message)) {
    return "시작 항목 원래 위치가 아직 남아 있어서 완료로 보지 않았어요.";
  }
  if (/hash|integrity|무결성|changed/i.test(message)) {
    return "시작 항목 보관 파일이 바뀐 것 같아 정리하지 않았어요.";
  }
  if (/stored file|stored path|holding stored|보관|holding/i.test(message)) {
    return "시작 항목 보관 파일을 확인하지 못해서 정리하지 않았어요.";
  }
  if (/30-day|30일|expiry|expires/i.test(message)) {
    return "30일 보관 기간을 확인하지 못해서 정리하지 않았어요.";
  }
  if (/link|symbolic|링크/i.test(message)) {
    return LINKED_LEFTOVER_PROTECTION;
  }
  if (/access|denied|eacces|eperm|permission/i.test(message)) {
    return "권한 때문에 시작 항목을 보관하지 못했어요.";
  }
  return "시작 항목 보관 중 문제가 생겨서 그대로 뒀어요.";
}

function preservedScheduledTaskBackupSkipFields(err: unknown): Pick<
  CleanupSkippedItem,
  "scheduledTaskBackupId" | "expiresAt" | "detail"
> | null {
  if (!isScheduledTaskBackupPreservedError(err)) return null;
  const message = err.message.trim() || "정리 확인을 끝내지 못했어요.";
  return {
    scheduledTaskBackupId: err.backup.id,
    expiresAt: err.backup.expiresAt,
    detail: `${message} 예약 작업 백업은 30일 복구함에 남겨뒀어요.`
  };
}

function friendlyScheduledTaskFailureDetail(message: string): string {
  if (/예약 작업 정보|scheduled task.*safe|task.*safe/i.test(message)) {
    return "예약 작업 정보가 안전하지 않아 자동 정리하지 않았어요.";
  }
  if (/export|backup|백업|powershell|access|denied|eacces|eperm|permission/i.test(message)) {
    return "예약 작업 백업을 만들지 못해서 정리하지 않았어요.";
  }
  if (/missing|not found|보이지|찾지|disappear/i.test(message)) {
    return "예약 작업 백업을 확인하지 못해서 정리하지 않았어요.";
  }
  if (/still exists|아직/i.test(message)) {
    return "예약 작업이 아직 남아 있어서 완료로 보지 않았어요.";
  }
  return "예약 작업 정리 중 문제가 생겨서 그대로 뒀어요.";
}

function friendlyServiceTraceFailureDetail(message: string): string {
  if (/서비스 이름|service.*name|service.*safe|Windows 서비스 정리 방식/i.test(message)) {
    return "서비스 이름을 안전하게 확인하지 못해서 정리하지 않았어요.";
  }
  if (/export|backup|백업|reg\.exe|access|denied|eacces|eperm|permission/i.test(message)) {
    return "서비스 백업을 만들지 못해서 정리하지 않았어요.";
  }
  if (/missing|not found|보이지|찾지|disappear/i.test(message)) {
    return "서비스 백업을 확인하지 못해서 정리하지 않았어요.";
  }
  if (/still exists|아직|sc\.exe/i.test(message)) {
    return "서비스가 아직 남아 있어서 완료로 보지 않았어요.";
  }
  return "서비스 정리 중 문제가 생겨서 그대로 뒀어요.";
}

function friendlyTrashFailureDetail(message: string): string {
  if (/restore entry size|size is not safe|용량 정보/i.test(message)) {
    return CLEANUP_RESTORE_SIZE_WARNING;
  }
  if (/30-day|30일|expiry|expires|window/i.test(message)) {
    return "30일 보관 기간을 확인하지 못해서 정리하지 않았어요.";
  }
  if (/manifest|복구함 정보/i.test(message)) {
    return "복구함 정보를 확인하지 못해서 정리하지 않았어요.";
  }
  if (/stored trash path|restore entry|managed restore bin|restore bin|stored path/i.test(message)) {
    return "복구함 저장 위치를 안전하게 확인하지 못해서 정리하지 않았어요.";
  }
  if (/source path still exists|still exists|아직 남아/i.test(message)) {
    return "정리 후에도 원래 항목이 남아 있어서 완료로 보지 않았어요.";
  }
  if (/link|symbolic|링크|protected source path|cleanup-trash refuses/i.test(message)) {
    return LINKED_LEFTOVER_PROTECTION;
  }
  if (/access|denied|eacces|eperm|permission|권한/i.test(message)) {
    return "권한 때문에 복구함으로 옮기지 못했어요.";
  }
  if (/locked|busy|사용 중|잠금/i.test(message)) {
    return "다른 프로그램이 사용 중이라 복구함으로 옮기지 못했어요.";
  }
  return "복구함으로 옮기는 중 문제가 생겨서 그대로 뒀어요.";
}

function finalLeftoverTrashSizeBytes(
  trashEntry: Pick<CleanupTrashEntry, "sizeBytes"> | undefined,
  fallbackSizeBytes: number
): number {
  if (trashEntry?.sizeBytes === undefined) return fallbackSizeBytes;
  if (!Number.isFinite(trashEntry.sizeBytes) || trashEntry.sizeBytes < 0) {
    throw new Error(CLEANUP_RESTORE_SIZE_WARNING);
  }
  return Math.max(0, Math.round(trashEntry.sizeBytes));
}

async function movePathBestEffort(
  source: string,
  destination: string,
  options: { destinationBoundary?: string } = {}
): Promise<void> {
  await assertRollbackDestinationHasNoLinkedParent(destination, options.destinationBoundary);
  await fs.mkdir(dirname(destination), { recursive: true });
  await assertRollbackDestinationHasNoLinkedParent(destination, options.destinationBoundary);
  try {
    await fs.rename(source, destination);
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
  }
  await fs.cp(source, destination, { recursive: true, force: false, errorOnExist: true });
  await fs.rm(source, { recursive: true, force: true });
}

async function assertRollbackDestinationHasNoLinkedParent(
  destination: string,
  destinationBoundary?: string
): Promise<void> {
  const linkedDestinationParent = await findLinkedPathPart(
    destination,
    destinationBoundary ?? dirname(destination)
  );
  if (linkedDestinationParent) {
    throw new Error(`Rollback destination parent is a link: ${linkedDestinationParent}`);
  }
}

async function cleanupUnverifiedTrashMove(options: {
  userDataDir: string;
  originalPath: string;
  trashEntry?: Pick<CleanupTrashEntry, "id" | "storedPath">;
  rollbackBoundary?: string;
}): Promise<void> {
  const { trashEntry } = options;
  if (!trashEntry || !isManagedTrashEntryStoredPath(options.userDataDir, trashEntry.id, trashEntry.storedPath)) {
    return;
  }
  const linkedStoredPath = await findLinkedManagedTrashStoredPath(
    options.userDataDir,
    trashEntry.id,
    trashEntry.storedPath
  );
  if (linkedStoredPath) return;

  const linkedOriginalParent = await findLinkedPathPart(
    options.originalPath,
    options.rollbackBoundary ?? dirname(options.originalPath)
  );
  if (linkedOriginalParent) return;

  const storedExists = await fs.lstat(trashEntry.storedPath).then(
    () => true,
    () => false
  );
  if (!storedExists) return;

  const originalExists = await fs.lstat(options.originalPath).then(
    () => true,
    () => false
  );
  if (originalExists) return;
  await movePathBestEffort(trashEntry.storedPath, options.originalPath, {
    destinationBoundary: options.rollbackBoundary ?? dirname(options.originalPath)
  });

  const entryRoot = dirname(dirname(trashEntry.storedPath));
  await fs.rm(entryRoot, { recursive: true, force: true }).catch(() => {});
}

function rollbackBoundaryForPath(path: string, env: LeftoverEnv): string {
  return leftoverLinkBoundaryForPath(path, env);
}

function leftoverLinkBoundaryForPath(path: string, env: LeftoverEnv): string {
  const programFilesRoot = programFilesRootForPath(path, env);
  if (programFilesRoot) return programFilesRoot;
  const roots = [env.home, env.programData, join(dirname(env.home), "Public")];
  return roots.find((root) => isAtOrInside(path, root)) ?? dirname(path);
}

function programFilesRootForPath(path: string, env: LeftoverEnv): string | undefined {
  const winPath = path.replace(/\//g, "\\");
  const driveRoot = winPath.match(/^([a-z]:\\program files(?: \(x86\))?)(?:\\|$)/i)?.[1];
  if (driveRoot) return driveRoot;

  const simulatedWindowsRoot = dirname(env.programData);
  const roots = [
    join(simulatedWindowsRoot, "Program Files"),
    join(simulatedWindowsRoot, "Program Files (x86)")
  ];
  return roots.find((root) => isAtOrInside(path, root));
}

async function assertStartupHoldingCleanupResult(options: {
  entry: StartupAutoDisabledEntry;
  sourcePath: string;
  userDataDir: string;
  now?: () => Date;
}): Promise<void> {
  if (!isSafeStartupDisabledId(options.entry.id)) {
    throw new Error("FormatBuddy startup holding entry id is not safe");
  }
  if (!isStrictPlanString(options.entry.storedPath)) {
    throw new Error("FormatBuddy startup holding stored path was not created");
  }
  if (!isManagedStartupStoredPath(options.userDataDir, options.entry.id, options.entry.storedPath)) {
    throw new Error("FormatBuddy startup holding stored path is outside the managed holding bin");
  }
  if (options.entry.originalPath !== options.sourcePath) {
    throw new Error("FormatBuddy startup holding original path does not match the cleaned item");
  }
  if (!isValidIsoDateString(options.entry.expiresAt)) {
    throw new Error("FormatBuddy startup holding expiry was not created");
  }
  if (!isWithinRestoreBinWindow(options.entry.expiresAt, options.now?.() ?? new Date())) {
    throw new Error("FormatBuddy startup holding expiry is outside the 30-day window");
  }
  const sourceStillExists = await fs.lstat(options.sourcePath).then(
    () => true,
    () => false
  );
  if (sourceStillExists) {
    throw new Error("Startup source path still exists after app leftover cleanup");
  }
  if (options.entry.integrityStatus !== "verified" || !isValidSha256ContentHash(options.entry.contentHash)) {
    throw new Error("FormatBuddy startup holding integrity was not verified");
  }
  const storedStat = await fs.lstat(options.entry.storedPath).catch(() => null);
  if (!storedStat || !storedStat.isFile() || storedStat.isSymbolicLink()) {
    throw new Error("FormatBuddy startup holding stored file was not created");
  }
  const actualHash = await hashStartupHoldingFile(options.entry.storedPath);
  if (actualHash !== options.entry.contentHash.value) {
    throw new Error("FormatBuddy startup holding stored hash does not match the holding entry");
  }
}

function leftoverChangedSincePlan(
  planned: AppLeftoverPath,
  measured: Awaited<ReturnType<typeof measurePath>>
): boolean {
  if (planned.fingerprint && measured.fingerprint && planned.fingerprint !== measured.fingerprint) {
    return true;
  }

  if (
    typeof planned.sizeBytes === "number" &&
    typeof measured.sizeBytes === "number" &&
    Math.round(planned.sizeBytes) !== Math.round(measured.sizeBytes)
  ) {
    return true;
  }

  if (planned.lastModifiedAt && measured.lastModifiedAt) {
    const plannedTime = Date.parse(planned.lastModifiedAt);
    const measuredTime = Date.parse(measured.lastModifiedAt);
    if (Number.isFinite(plannedTime) && Number.isFinite(measuredTime)) {
      return plannedTime !== measuredTime;
    }
  }

  return false;
}

function expectedLeftoverLiveKind(path: AppLeftoverPath): "file" | "directory" | undefined {
  if (path.kind === "folder" || path.kind === "install-folder" || path.kind === "shortcut-folder") {
    return "directory";
  }
  if (path.kind === "shortcut" || path.kind === "pinned-shortcut" || path.kind === "startup-folder") return "file";
  return undefined;
}

async function leftoverLiveKind(path: string): Promise<"file" | "directory" | "other" | null> {
  try {
    const stat = await fs.lstat(path);
    if (stat.isFile()) return "file";
    if (stat.isDirectory()) return "directory";
    return "other";
  } catch {
    return null;
  }
}

async function leftoverKindChangedSincePlan(path: AppLeftoverPath): Promise<boolean> {
  const expected = expectedLeftoverLiveKind(path);
  if (!expected) return false;
  const actual = await leftoverLiveKind(path.path);
  return actual !== null && actual !== expected;
}

function skipChangedLeftoverKind(path: AppLeftoverPath): CleanupSkippedItem {
  return {
    itemId: path.id,
    path: path.path,
    reason: "blocked-path",
    detail: "점검했던 앱 잔여 항목 종류가 바뀌었어요. 다시 점검한 뒤 정리해주세요."
  };
}

function assertSelectedLeftoverPlanMetadataUsable(
  snapshot: AppLeftoversSnapshot,
  selectedIds: Set<string>
): void {
  for (const selectedId of selectedIds) {
    const path = allPaths(snapshot).find((candidate) => candidate.id === selectedId);
    if (!path) continue;
    const group = groupForPath(snapshot, selectedId);
    const invalid: string[] = [];

    if (!isStrictPlanString(path.id)) invalid.push("path id");
    if (!isStrictPlanString(path.path)) invalid.push("path");
    if (
      isStrictPlanString(path.path) &&
      isFilesystemLeftoverPathKind(path.kind) &&
      !isSupportedFilesystemPlanPath(path.path)
    ) {
      invalid.push("absolute path");
    }
    if (!isSafeLeftoverPathKind(path.kind)) invalid.push("kind");
    if (typeof path.exists !== "boolean") invalid.push("exists");
    if (!isOptionalPlanSizeBytes(path.sizeBytes)) invalid.push("size");
    if (!isOptionalPlanTimestamp(path.lastModifiedAt)) invalid.push("modified timestamp");
    if (!isOptionalPlanFingerprint(path.fingerprint)) invalid.push("fingerprint");
    if (!group || !isUsablePlanString(group.appName)) invalid.push("app name");
    if (group && !isOptionalUsablePlanString(group.publisher)) invalid.push("publisher");
    if (
      group &&
      (group.source === "uninstall-launched"
        ? !cleanDisplayText(group.sourceAppName)
        : !isOptionalUsablePlanString(group.sourceAppName))
    ) {
      invalid.push("source app name");
    }
    if (group && !isSafeLeftoverGroupSource(group.source)) invalid.push("source");
    if (group && !isSafeLeftoverCleanupState(group.cleanupState)) invalid.push("cleanup state");
    if (!isOptionalStrictPlanString(path.registryValueName)) invalid.push("registry value name");
    if (!isOptionalStrictPlanString(path.environmentPathSegment)) {
      invalid.push("environment path segment");
    }
    if (!isOptionalStrictPlanString(path.protectedBy)) invalid.push("protection reason");
    if (path.kind === "startup-folder") {
      if (!isStrictPlanString(path.startupEntryId)) invalid.push("startup entry id");
      if (!cleanDisplayText(path.startupEntryName)) invalid.push("startup entry name");
      if (!isStrictPlanString(path.startupOrigin)) invalid.push("startup origin");
    }
    if (path.kind === "startup-entry") {
      if (!isStrictPlanString(path.startupEntryId)) invalid.push("startup entry id");
      if (!cleanDisplayText(path.startupEntryName)) invalid.push("startup entry name");
      if (!cleanDisplayText(path.startupOrigin)) invalid.push("startup origin");
      if (path.startupEntryKind !== "service" && path.startupEntryKind !== "scheduled-task") {
        invalid.push("startup entry kind");
      }
      if (
        path.startupEntryKind === "scheduled-task" &&
        !normalizeSafeScheduledTaskPath(path.scheduledTaskPath)
      ) {
        invalid.push("scheduled task path");
      }
      if (path.startupEntryKind === "service" && !normalizeSafeServiceName(path.serviceName)) {
        invalid.push("service name");
      }
      if (
        path.startupEntryKind !== "scheduled-task" &&
        path.scheduledTaskPath !== undefined &&
        path.scheduledTaskPath !== null
      ) {
        invalid.push("scheduled task path");
      }
      if (
        path.startupEntryKind !== "service" &&
        path.serviceName !== undefined &&
        path.serviceName !== null
      ) {
        invalid.push("service name");
      }
    }
    if (
      path.kind === "startup-registry" &&
      (typeof path.registryValueName !== "string" ||
        !isSafeStartupRegistryValuePath(path.path, path.registryValueName))
    ) {
      invalid.push("startup registry value");
    }
    if (path.kind === "registry" && !isSafeUninstallRegistryKeyPath(path.path)) {
      invalid.push("uninstall registry key");
    }
    if (
      path.kind === "registered-app-registry" &&
      (typeof path.registryValueName !== "string" ||
        !isSafeRegisteredApplicationRegistryValuePath(path.path, path.registryValueName))
    ) {
      invalid.push("registered application registry value");
    }
    if (
      path.kind === "app-capabilities-registry" &&
      !isSafeAppCapabilitiesRegistryKeyPath(path.path)
    ) {
      invalid.push("default app capabilities registry key");
    }
    if (
      path.kind === "environment-path-registry" &&
      (typeof path.registryValueName !== "string" ||
        typeof path.environmentPathSegment !== "string" ||
        !isSafeEnvironmentPathRegistryValuePath(path.path, path.registryValueName) ||
        !normalizeSafeEnvironmentPathSegment(path.environmentPathSegment))
    ) {
      invalid.push("environment PATH registry value");
    }
    if (
      path.kind === "environment-variable-registry" &&
      (typeof path.registryValueName !== "string" ||
        !isSafeEnvironmentVariableRegistryValuePath(path.path, path.registryValueName))
    ) {
      invalid.push("environment variable registry value");
    }
    if (
      path.kind === "firewall-rule-registry" &&
      (typeof path.registryValueName !== "string" ||
        !isSafeFirewallRuleRegistryValuePath(path.path, path.registryValueName))
    ) {
      invalid.push("firewall rule registry value");
    }
    if (path.kind === "app-path-registry" && !isSafeAppPathRegistryKeyPath(path.path)) {
      invalid.push("app paths registry key");
    }
    if (path.kind === "open-with-registry" && !isSafeOpenWithRegistryKeyPath(path.path)) {
      invalid.push("open with registry key");
    }
    if (path.kind === "file-association-registry" && !isSafeFileAssociationRegistryKeyPath(path.path)) {
      invalid.push("file association registry key");
    }
    if (path.kind === "context-menu-registry" && !isSafeContextMenuRegistryKeyPath(path.path)) {
      invalid.push("context menu registry key");
    }
    if (path.kind === "shell-extension-registry" && !isSafeShellExtensionRegistryKeyPath(path.path)) {
      invalid.push("shell extension registry key");
    }
    if (
      path.kind === "protocol-handler-registry" &&
      !isSafeProtocolHandlerRegistryKeyPath(path.path)
    ) {
      invalid.push("protocol handler registry key");
    }
    if (
      path.kind === "native-messaging-host-registry" &&
      !isSafeNativeMessagingHostRegistryKeyPath(path.path)
    ) {
      invalid.push("native messaging host registry key");
    }
    if (
      path.kind === "service-registry" &&
      (!normalizeSafeServiceName(path.serviceName) ||
        !isSafeServiceRegistryKeyPath(path.path) ||
        serviceRegistryKeyPath(normalizeSafeServiceName(path.serviceName) ?? "") !== path.path)
    ) {
      invalid.push("service registry key");
    }
    if (
      path.kind !== "startup-entry" &&
      path.kind !== "service-registry" &&
      path.serviceName !== undefined &&
      path.serviceName !== null
    ) {
      invalid.push("service name");
    }

    if (invalid.length > 0) {
      throw new Error(
        `apps:leftovers-cleanup leftover plan metadata contains unsafe, padded, or empty fields: ${invalid.join(", ")}`
      );
    }
  }
}

export async function cleanupAppLeftovers(
  request: AppLeftoversCleanupRequest,
  options: CleanupAppLeftoversOptions
): Promise<CleanupExecuteResult> {
  if (!isNonEmptyString(request?.planId) || !isNonEmptyString(request?.confirmationToken)) {
    throw new Error("apps:leftovers-cleanup requires planId and confirmationToken");
  }
  if (!isTrimmedString(request.planId) || !isTrimmedString(request.confirmationToken)) {
    throw new Error("apps:leftovers-cleanup requires planId and confirmationToken without whitespace padding");
  }
  if (hasControlCharacters(request.planId) || hasControlCharacters(request.confirmationToken)) {
    throw new Error("apps:leftovers-cleanup requires planId and confirmationToken without control characters");
  }
  if (!Array.isArray(request.selectedPathIds) || request.selectedPathIds.length === 0) {
    throw new Error("apps:leftovers-cleanup requires at least one selected path");
  }
  if (!request.selectedPathIds.every(isNonEmptyString)) {
    throw new Error("apps:leftovers-cleanup requires selectedPathIds to contain only strings");
  }
  if (!request.selectedPathIds.every(isTrimmedString)) {
    throw new Error("apps:leftovers-cleanup requires selectedPathIds without whitespace padding");
  }
  if (request.selectedPathIds.some(hasControlCharacters)) {
    throw new Error("apps:leftovers-cleanup requires selectedPathIds without control characters");
  }
  if (hasDuplicates(request.selectedPathIds)) {
    throw new Error("apps:leftovers-cleanup requires selectedPathIds to be unique without duplicates");
  }

  const currentPlan = peekLeftoversPlan(request.planId, request.confirmationToken, options.now);
  if (!currentPlan) {
    throw new Error("apps:leftovers-cleanup could not match a current plan (expired, wrong token, or already executed)");
  }

  const selectedIds = new Set(request.selectedPathIds);
  const currentIndex = new Map(allPaths(currentPlan.snapshot).map((path) => [path.id, path]));
  const unknownSelectionIds = Array.from(selectedIds).filter((id) => !currentIndex.has(id));
  if (unknownSelectionIds.length > 0) {
    throw new Error(
      `apps:leftovers-cleanup selectedPathIds not present in the leftover plan: ${unknownSelectionIds.join(", ")}`
    );
  }
  assertSelectedLeftoverPlanMetadataUsable(currentPlan.snapshot, selectedIds);

  const cached = consumeLeftoversPlan(request.planId, request.confirmationToken, options.now);
  if (!cached) {
    throw new Error("apps:leftovers-cleanup could not match a current plan (expired, wrong token, or already executed)");
  }

  const index = new Map(allPaths(cached.snapshot).map((path) => [path.id, path]));
  const removedItems: CleanupExecutedItem[] = [];
  const skippedItems: CleanupSkippedItem[] = [];
  const cleanedFollowupGroups = new Map<string, Pick<InstalledApp, "name" | "publisher">>();
  const resolvedPathIds = new Set<string>();

  for (const selectedId of selectedIds) {
    const path = index.get(selectedId);
    if (!path) {
      skippedItems.push({
        itemId: selectedId,
        path: "",
        reason: "not-found",
        detail: "selectedPathIds referenced a path not present in the leftover plan"
      });
      continue;
    }
    if (!path.exists) {
      skippedItems.push({ itemId: path.id, path: path.path, reason: "not-found" });
      continue;
    }
    if (path.protectedBy) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: path.protectedBy
      });
      continue;
    }
    const group = groupForPath(cached.snapshot, path.id);
    if (group?.source !== "uninstall-launched") {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: "앱이 아직 설치된 상태예요. Windows 제거 후 다시 확인해주세요."
      });
      continue;
    }
    if (group.cleanupState !== "removed-confirmed") {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail:
          group.cleanupState === "still-installed"
            ? "아직 앱 목록에 있어요. 다시 점검으로 제거 완료를 확인한 뒤 정리해주세요."
            : "제거 완료 여부를 아직 확인하지 못했어요. 다시 점검 후 정리해주세요."
      });
      continue;
    }
    const currentInstallGuard = currentInstallGuardForGroup(group, options);
    if (currentInstallGuard === "unknown") {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: "앱 제거 완료 여부를 지금 다시 확인하지 못했어요. 다시 점검한 뒤 정리해주세요."
      });
      continue;
    }
    if (currentInstallGuard === "installed") {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: "앱이 다시 설치된 상태예요. 제거가 끝난 뒤 다시 점검하고 정리해주세요."
      });
      continue;
    }

    if (path.kind === "service-registry") {
      const serviceName = normalizeSafeServiceName(path.serviceName);
      if (
        !serviceName ||
        !isSafeServiceRegistryKeyPath(path.path) ||
        serviceRegistryKeyPath(serviceName) !== path.path
      ) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: SERVICE_TRACE_PROTECTION
        });
        continue;
      }
      try {
        const backup = await backupAndDeleteRegistryKey({
          userDataDir: options.userDataDir,
          keyPath: serviceRegistryKeyPath(serviceName),
          backupKind: "service-key",
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `서비스: ${serviceName}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: `서비스: ${serviceName}`,
          reason: /서비스 이름|service.*safe|Windows 서비스 정리 방식/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyServiceTraceFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (
      path.kind === "registry" ||
      path.kind === "app-capabilities-registry" ||
      path.kind === "app-path-registry" ||
      path.kind === "open-with-registry" ||
      path.kind === "file-association-registry" ||
      path.kind === "protocol-handler-registry" ||
      path.kind === "native-messaging-host-registry" ||
      path.kind === "context-menu-registry" ||
      path.kind === "shell-extension-registry"
    ) {
      try {
        const backup = await backupAndDeleteRegistryKey({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          backupKind:
            path.kind === "app-capabilities-registry"
              ? "app-capabilities-key"
              : path.kind === "app-path-registry"
              ? "app-path-key"
              : path.kind === "open-with-registry"
                ? "open-with-key"
                : path.kind === "file-association-registry"
                  ? "file-association-key"
                  : path.kind === "context-menu-registry"
                    ? "context-menu-key"
                    : path.kind === "shell-extension-registry"
                      ? "shell-extension-key"
                      : path.kind === "protocol-handler-registry"
                        ? "protocol-handler-key"
                        : path.kind === "native-messaging-host-registry"
                          ? "native-messaging-host-key"
                          : "key",
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: path.path,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 앱 제거 레지스트리 위치|registry location/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "registered-app-registry") {
      try {
        const valueName = path.registryValueName;
        if (!valueName) {
          throw new Error("기본 앱 목록 값을 확인하지 못했어요.");
        }
        const backup = await backupAndDeleteRegistryValue({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          valueName,
          backupKind: "registered-app-value",
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `${path.path}\\${valueName}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 레지스트리 값 위치|registry value/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "environment-path-registry") {
      try {
        const valueName = path.registryValueName;
        const segment = path.environmentPathSegment;
        if (!valueName || !segment) {
          throw new Error("PATH 경로 정보를 확인하지 못했어요.");
        }
        const backup = await backupAndRemoveEnvironmentPathSegment({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          valueName,
          segment,
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `${path.path}\\${valueName}:${segment}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 PATH|PATH 경로|registry value/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "environment-variable-registry") {
      try {
        const valueName = path.registryValueName;
        if (!valueName) {
          throw new Error("환경 설정 흔적 이름을 확인하지 못했어요.");
        }
        const backup = await backupAndDeleteRegistryValue({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          valueName,
          backupKind: "environment-variable-value",
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `${path.path}\\${valueName}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 레지스트리 값 위치|environment variable|환경 설정/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "firewall-rule-registry") {
      try {
        const valueName = path.registryValueName;
        if (!valueName) {
          throw new Error("방화벽 규칙 이름을 확인하지 못했어요.");
        }
        const backup = await backupAndDeleteRegistryValue({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          valueName,
          backupKind: "firewall-rule-value",
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `${path.path}\\${valueName}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 레지스트리 값 위치|방화벽 규칙|registry value/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "startup-registry") {
      try {
        const valueName = path.registryValueName;
        if (!valueName) {
          throw new Error("시작 항목 레지스트리 값 이름을 확인하지 못했어요.");
        }
        const backup = await backupAndDeleteRegistryValue({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          valueName,
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: `${path.path}\\${valueName}`,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedRegistryBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 시작 항목 레지스트리 위치|registry location/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyRegistryLeftoverFailureDetail(message),
          ...(preservedBackup
            ? {
                registryBackupId: preservedBackup.registryBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    if (path.kind === "startup-folder") {
      const startupEntryId = path.startupEntryId;
      const startupEntryName = cleanDisplayText(path.startupEntryName);
      const startupOrigin = path.startupOrigin;
      if (
        !isStrictPlanString(startupEntryId) ||
        !startupEntryName ||
        !isStrictPlanString(startupOrigin)
      ) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: "시작 항목 원래 위치 정보를 확인하지 못했어요."
        });
        continue;
      }
      const measured = await measurePath(path.path);
      if (!measured.exists) {
        resolvedPathIds.add(path.id);
        skippedItems.push({ itemId: path.id, path: path.path, reason: "not-found" });
        continue;
      }
      if (measured.protectedBy) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: measured.protectedBy
        });
        continue;
      }
      if (leftoverChangedSincePlan(path, measured)) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: CHANGED_LEFTOVER_PROTECTION
        });
        continue;
      }
      if (await leftoverKindChangedSincePlan(path)) {
        skippedItems.push(skipChangedLeftoverKind(path));
        continue;
      }

      try {
        const disableStartup = options.disableStartupFolderEntry ?? disableStartupFolderEntry;
        const disabled = await disableStartup({
          userDataDir: options.userDataDir,
          now: options.now,
          entry: {
            id: startupEntryId,
            kind: "startup-folder",
            name: startupEntryName,
            path: path.path,
            origin: startupOrigin
          }
        });
        if (disabled.status !== "disabled" || !disabled.entry) {
          skippedItems.push({
            itemId: path.id,
            path: path.path,
            reason: disabled.status === "not-found" ? "not-found" : "blocked-path",
            detail: disabled.message
          });
          continue;
        }
        await assertStartupHoldingCleanupResult({
          entry: disabled.entry,
          sourcePath: path.path,
          userDataDir: options.userDataDir,
          now: options.now
        });
        removedItems.push({
          itemId: path.id,
          path: path.path,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: disabled.entry.id,
          expiresAt: disabled.entry.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: skipReasonFromTrashError(message),
          detail: friendlyStartupHoldingFailureDetail(message)
        });
      }
      continue;
    }

    if (path.kind === "startup-entry") {
      if (path.startupEntryKind === "service") {
        const serviceName = normalizeSafeServiceName(path.serviceName);
        if (!serviceName) {
          skippedItems.push({
            itemId: path.id,
            path: path.path,
            reason: "blocked-path",
            detail: SERVICE_TRACE_PROTECTION
          });
          continue;
        }
        try {
          const backup = await backupAndDeleteRegistryKey({
            userDataDir: options.userDataDir,
            keyPath: serviceRegistryKeyPath(serviceName),
            backupKind: "service-key",
            now: options.now,
            runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
            app: group ? groupInstallIdentity(group) : undefined
          });
          removedItems.push({
            itemId: path.id,
            path: path.path,
            sizeBytes: 0,
            categoryId: "app-leftovers",
            mode: "trash",
            succeeded: true,
            registryBackupId: backup.id,
            expiresAt: backup.expiresAt
          });
          resolvedPathIds.add(path.id);
        } catch (err) {
          const message = (err as Error).message;
          const preservedBackup = preservedRegistryBackupSkipFields(err);
          skippedItems.push({
            itemId: path.id,
            path: path.path,
            reason: /서비스 이름|service.*safe|Windows 서비스 정리 방식/i.test(message)
              ? "blocked-path"
              : "execute-failed",
            detail: preservedBackup?.detail ?? friendlyServiceTraceFailureDetail(message),
            ...(preservedBackup
              ? {
                  registryBackupId: preservedBackup.registryBackupId,
                  expiresAt: preservedBackup.expiresAt
                }
              : {})
          });
        }
        continue;
      }
      if (path.startupEntryKind !== "scheduled-task") {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: SERVICE_TRACE_PROTECTION
        });
        continue;
      }
      const taskName = normalizeSafeScheduledTaskName(path.startupEntryName);
      const taskPath = normalizeSafeScheduledTaskPath(path.scheduledTaskPath);
      if (!taskName || !taskPath) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: SCHEDULED_TASK_TRACE_PROTECTION
        });
        continue;
      }

      try {
        const backup = await backupAndDeleteScheduledTask({
          userDataDir: options.userDataDir,
          taskName,
          taskPath,
          now: options.now,
          runner: options.scheduledTaskRunner ?? defaultScheduledTaskBackupRunner(),
          app: group ? groupInstallIdentity(group) : undefined
        });
        removedItems.push({
          itemId: path.id,
          path: path.path,
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          scheduledTaskBackupId: backup.id,
          expiresAt: backup.expiresAt
        });
        resolvedPathIds.add(path.id);
      } catch (err) {
        const message = (err as Error).message;
        const preservedBackup = preservedScheduledTaskBackupSkipFields(err);
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /예약 작업 정보|scheduled task.*safe|task.*safe/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: preservedBackup?.detail ?? friendlyScheduledTaskFailureDetail(message),
          ...(preservedBackup
            ? {
                scheduledTaskBackupId: preservedBackup.scheduledTaskBackupId,
                expiresAt: preservedBackup.expiresAt
              }
            : {})
        });
      }
      continue;
    }

    const linkedPathPart = await findLinkedPathPart(
      path.path,
      leftoverLinkBoundaryForPath(path.path, cached.env),
      true
    );
    if (linkedPathPart) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: LINKED_LEFTOVER_PROTECTION
      });
      continue;
    }

    const trustedAppFolder = path.kind === "install-folder" && isTrustedInstallFolderPath(path.path, {
      name: group?.appName ?? "",
      publisher: group?.publisher ?? null
    }, cached.env);
    const shortcutAllowed =
      ((path.kind === "shortcut" || path.kind === "pinned-shortcut") && isShortcutPathAllowed(path.path, cached.env)) ||
      (path.kind === "shortcut-folder" && isShortcutFolderPathAllowed(path.path, cached.env));
    const decision = shortcutAllowed || trustedAppFolder
      ? { allowed: true as const }
      : evaluatePath(path.path, { allowRoots: [path.path], home: cached.env.home });
    if (!decision.allowed) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: decision.blockedBy
      });
      continue;
    }

    const measured = await measurePath(path.path);
    if (!measured.exists) {
      resolvedPathIds.add(path.id);
      skippedItems.push({ itemId: path.id, path: path.path, reason: "not-found" });
      continue;
    }
    if (measured.protectedBy) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: measured.protectedBy
      });
      continue;
    }
    if (leftoverChangedSincePlan(path, measured)) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: CHANGED_LEFTOVER_PROTECTION
      });
      continue;
    }
    if (await leftoverKindChangedSincePlan(path)) {
      skippedItems.push(skipChangedLeftoverKind(path));
      continue;
    }
    if (path.kind === "shortcut-folder") {
      const currentStat = await fs.lstat(path.path).catch(() => null);
      if (!currentStat?.isDirectory()) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: "점검했던 바로가기 폴더가 폴더가 아니게 바뀌었어요. 다시 점검한 뒤 정리해주세요."
        });
        continue;
      }
    }
    if (path.kind === "install-folder") {
      const currentStat = await fs.lstat(path.path).catch(() => null);
      const linkedInstallPath = await findLinkedInstallFolderPathPart(path.path);
      if (!trustedAppFolder || !currentStat?.isDirectory() || linkedInstallPath) {
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: "blocked-path",
          detail: linkedInstallPath
            ? LINKED_LEFTOVER_PROTECTION
            : "점검했던 앱 설치 폴더를 안전하게 확인하지 못했어요. 다시 점검한 뒤 정리해주세요."
        });
        continue;
      }
    }

    const cleanupItem = toCleanupItem(
      {
        ...path,
        sizeBytes: measured.sizeBytes,
        lastModifiedAt: measured.lastModifiedAt
      },
      cached.snapshot
    );
    let trashEntry: CleanupTrashEntry | undefined;
    try {
      trashEntry = await moveToFormatBuddyTrash({
        userDataDir: options.userDataDir,
        item: cleanupItem,
        sizeBytes: cleanupItem.sizeBytes,
        home: cached.env.home,
        trustedSource: shortcutAllowed
          ? path.kind === "shortcut-folder"
            ? { kind: "app-shortcut-folder", allowRoots: shortcutFolderRoots(cached.env) }
            : {
                kind: "app-shortcut",
                allowRoots: path.kind === "pinned-shortcut" ? pinnedShortcutRoots(cached.env) : shortcutRoots(cached.env)
              }
          : trustedAppFolder
            ? { kind: "app-install-folder", allowRoots: [path.path] }
            : undefined,
        now: options.now
      });
      const finalSizeBytes = finalLeftoverTrashSizeBytes(trashEntry, cleanupItem.sizeBytes);
      await assertManagedTrashEntryManifest({
        userDataDir: options.userDataDir,
        entryId: trashEntry.id,
        itemId: cleanupItem.id,
        categoryId: cleanupItem.categoryId,
        sizeBytes: finalSizeBytes,
        originalPath: cleanupItem.path,
        storedPath: trashEntry.storedPath,
        expiresAt: trashEntry.expiresAt,
        now: options.now
      });
      if ((await measurePath(cleanupItem.path)).exists) {
        throw new Error("Source path still exists after app leftover cleanup");
      }
      removedItems.push({
        itemId: cleanupItem.id,
        path: cleanupItem.path,
        sizeBytes: finalSizeBytes,
        categoryId: cleanupItem.categoryId,
        mode: "trash",
        succeeded: true,
        trashEntryId: trashEntry.id,
        expiresAt: trashEntry.expiresAt
      });
      resolvedPathIds.add(path.id);
    } catch (err) {
      const message = (err as Error).message;
      await cleanupUnverifiedTrashMove({
        userDataDir: options.userDataDir,
        originalPath: cleanupItem.path,
        trashEntry,
        rollbackBoundary: rollbackBoundaryForPath(cleanupItem.path, cached.env)
      }).catch(() => {});
      skippedItems.push({
        itemId: cleanupItem.id,
        path: cleanupItem.path,
        reason: skipReasonFromTrashError(message),
        detail: friendlyTrashFailureDetail(message)
      });
    }
  }

  for (const group of cached.snapshot.groups) {
    for (const path of group.paths) {
      if (selectedIds.has(path.id) || !selectableLeftoverPath(group, path)) continue;
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "not-selected"
      });
    }
  }

  const executedAt = options.now?.().toISOString() ?? new Date().toISOString();
  const logEntry = buildLogEntry({
    mode: "trash",
    executedAt,
    removedItems,
    skippedItems
  });
  let logPersistenceWarning: string | undefined;
  try {
    const recordHistory = options.recordCleanupExecution ?? recordCleanupExecution;
    await recordHistory(options.userDataDir, logEntry);
  } catch {
    logPersistenceWarning = CLEANUP_HISTORY_SAVE_WARNING;
  }
  let followupPersistenceWarning: string | undefined;
  if (options.onFollowupCleaned) {
    for (const group of cached.snapshot.groups) {
      rememberResolvedFollowupGroup(cleanedFollowupGroups, group, selectedIds, resolvedPathIds);
    }
    for (const cleanedApp of cleanedFollowupGroups.values()) {
      try {
        await options.onFollowupCleaned(cleanedApp);
      } catch {
        followupPersistenceWarning = CLEANUP_FOLLOWUP_SAVE_WARNING;
      }
    }
  }

  return {
    planId: cached.snapshot.planId,
    executedAt,
    mode: "trash",
    totalFreedBytes: logEntry.totalFreedBytes,
    removedItems,
    skippedItems,
    logEntry,
    ...(logPersistenceWarning ? { logPersistenceWarning } : {}),
    ...(followupPersistenceWarning ? { followupPersistenceWarning } : {})
  };
}

export function __resetLeftoversPlanCacheForTests(): void {
  PLAN_CACHE.clear();
}

export const __testing = {
  RULES,
  defaultEnv,
  measurePath,
  PLAN_TTL_MS,
  cleanupUnverifiedTrashMove,
  movePathBestEffort,
  programFilesRootForPath,
  rollbackBoundaryForPath,
  friendlyRegistryLeftoverFailureDetail,
  friendlyStartupHoldingFailureDetail,
  friendlyTrashFailureDetail
};
