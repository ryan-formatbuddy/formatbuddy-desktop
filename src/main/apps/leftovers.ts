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
import { join } from "node:path";
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
  InstalledApp,
  StartupAutoEntry
} from "@shared/types";
import { evaluatePath, normalizePath } from "../cleanup/blocklist";
import { buildLogEntry, recordCleanupExecution } from "../cleanup/log";
import { findLinkedPathPart } from "../cleanup/pathSafety";
import { assertManagedTrashEntryManifest, moveToFormatBuddyTrash } from "../cleanup/trash";
import { disableStartupFolderEntry } from "../startup/folderToggle";
import {
  backupAndDeleteRegistryValue,
  backupAndDeleteRegistryKey,
  defaultRegistryCleanupRunner,
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
  disableStartupFolderEntry?: typeof disableStartupFolderEntry;
  recordCleanupExecution?: typeof recordCleanupExecution;
  onFollowupCleaned?: (app: Pick<InstalledApp, "name" | "publisher">) => void | Promise<void>;
}

const PLAN_TTL_MS = 5 * 60 * 1000;
const MAX_LEFTOVER_DEPTH = 8;
const MAX_LEFTOVER_ITEMS = 50_000;
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
   * False when the uninstall wizard was opened and the scan cache was
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
}

function defaultEnv(home: string, override?: Partial<LeftoverEnv>): LeftoverEnv {
  const roaming =
    override?.roaming ??
    process.env.APPDATA ??
    join(home, "AppData", "Roaming");
  const localAppData =
    override?.localAppData ??
    process.env.LOCALAPPDATA ??
    join(home, "AppData", "Local");
  const programData =
    override?.programData ??
    process.env.ProgramData ??
    "C:\\ProgramData";
  return {
    home: override?.home ?? home,
    roaming,
    localAppData,
    programData
  };
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

function isSafeLeftoverPathKind(value: unknown): value is NonNullable<AppLeftoverPath["kind"]> {
  return (
    value === "folder" ||
    value === "registry" ||
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
    .map((group) =>
      `${group.appName}:${group.paths.map((p) => `${p.id}:${p.exists ? 1 : 0}:${p.sizeBytes ?? 0}:${p.protectedBy ?? ""}`).join(",")}`
    )
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
  for (const entry of entries) {
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
        lastModifiedAt: rootStat.mtime.toISOString()
      };
    }
    if (!rootStat.isDirectory()) return { exists: false };

    let total = 0;
    let latest = rootStat.mtime;
    for await (const file of walkPath(raw)) {
      total += file.size;
      if (file.modified.getTime() > latest.getTime()) latest = file.modified;
    }
    return {
      exists: true,
      sizeBytes: total,
      lastModifiedAt: latest.toISOString()
    };
  } catch (err) {
    if (err instanceof LeftoverMeasurementProtection) {
      return { exists: true, protectedBy: err.message };
    }
    return { exists: false };
  }
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
  const roots = [env.roaming, env.localAppData, env.programData];
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

async function installLocationLeftoverPaths(
  app: InstalledApp,
  env: LeftoverEnv
): Promise<AppLeftoverPath[]> {
  const installLocation = app.installLocation?.trim();
  if (!installLocation) return [];

  const info = await pathInfo(installLocation, env);
  const protectedBy = info.protectedBy ?? personalInstallLocationProtection(installLocation, env);
  return info.exists ? [{ ...info, protectedBy, kind: "folder" }] : [];
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
      const info = await pathInfo(entry.path, env);
      paths.push({
        ...info,
        id: makePathId(`startup-folder:${entry.id}:${entry.path}`),
        kind: "startup-folder",
        startupEntryId: entry.id,
        startupEntryName: entry.name,
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

    const label = `${entry.origin}: ${entry.name}`;
    paths.push({
      id: makePathId(`startup-entry:${entry.id}:${label}`),
      kind: "startup-entry",
      path: label,
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
  return [
    path.kind ?? "folder",
    normalizePath(path.path),
    registryValueName
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
  const installedAppKeys = new Set(apps.map(appIdentityKey));
  const installedAppNames = new Set(apps.map(appNameKey));

  const groups: AppLeftoverGroup[] = [];
  const seenLabels = new Set<string>();

  const candidates = [
    ...(options.extraApps ?? []).map((app) => ({ app, source: "uninstall-launched" as const })),
    ...apps.map((app) => ({ app, source: "installed" as const }))
  ];

  for (const { app, source } of candidates) {
    if (!app.name) continue;
    const cleanupState: AppLeftoverCleanupState | undefined =
      source === "uninstall-launched"
        ? !installedAppsKnown
          ? "not-checked"
          : isStillInstalled(app, installedAppKeys, installedAppNames)
            ? "still-installed"
            : "removed-confirmed"
        : undefined;
    const text = `${app.name} ${app.publisher ?? ""}`;
    const rule = RULES.find((r) => r.match.test(text));
    if (!rule) {
      if (seenLabels.has(app.name)) continue;
      const paths = uniqueLeftoverPaths([
        ...(await genericLeftoverPaths(app, env)),
        ...(await installLocationLeftoverPaths(app, env)),
        ...registryLeftoverPaths(app),
        ...(await startupLeftoverPaths(app, env, options.startupEntries))
      ]);
      if (paths.length === 0) continue;
      seenLabels.add(app.name);
      groups.push({
        appName: app.name,
        publisher: app.publisher,
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
    paths.push(...(await installLocationLeftoverPaths(app, env)));
    paths.push(...registryLeftoverPaths(app));
    paths.push(...(await startupLeftoverPaths(app, env, options.startupEntries)));

    groups.push({
      appName: rule.appLabel,
      publisher: app.publisher,
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

function groupForPath(snapshot: AppLeftoversSnapshot, pathId: string): AppLeftoverGroup | undefined {
  return snapshot.groups.find((group) => group.paths.some((path) => path.id === pathId));
}

function groupIdentityKey(group: Pick<AppLeftoverGroup, "appName" | "publisher">): string {
  return `${(group.appName ?? "").trim().toLowerCase()}|${(group.publisher ?? "").trim().toLowerCase()}`;
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

function followupGroupIsFullyResolved(
  group: AppLeftoverGroup,
  selectedIds: Set<string>,
  resolvedPathIds: Set<string>
): boolean {
  if (!group || group.source !== "uninstall-launched") return false;
  if (group.cleanupState !== "removed-confirmed") return false;
  const existingPaths = group.paths.filter((path) => path.exists);
  if (existingPaths.length === 0) return false;
  return existingPaths.every((path) => selectedIds.has(path.id) && resolvedPathIds.has(path.id));
}

function rememberResolvedFollowupGroup(
  groups: Map<string, Pick<InstalledApp, "name" | "publisher">>,
  group: AppLeftoverGroup,
  selectedIds: Set<string>,
  resolvedPathIds: Set<string>
): void {
  if (!followupGroupIsFullyResolved(group, selectedIds, resolvedPathIds)) return;
  const name = group.appName?.trim();
  if (!name) return;
  groups.set(groupIdentityKey(group), {
    name,
    publisher: group.publisher ?? null
  });
}

function toCleanupItem(path: AppLeftoverPath, snapshot: AppLeftoversSnapshot): CleanupItem {
  const group = groupForPath(snapshot, path.id);
  return {
    id: path.id,
    path: path.path,
    label: group?.appName ?? "앱 잔여 폴더",
    sizeBytes: Math.max(0, Math.round(path.sizeBytes ?? 0)),
    modifiedAt: path.lastModifiedAt ?? undefined,
    categoryId: "app-leftovers",
    riskLevel: "review",
    reason: "앱 제거 후 남은 AppData/ProgramData 후보",
    appName: group?.appName ?? null,
    appPublisher: group?.publisher ?? null
  };
}

function skipReasonFromTrashError(message: string): CleanupSkippedItem["reason"] {
  return /cleanup-trash refuses|링크|보호 경로|protected source path/i.test(message)
    ? "blocked-path"
    : "execute-failed";
}

function leftoverChangedSincePlan(
  planned: AppLeftoverPath,
  measured: Awaited<ReturnType<typeof measurePath>>
): boolean {
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
    if (!isSafeLeftoverPathKind(path.kind)) invalid.push("kind");
    if (typeof path.exists !== "boolean") invalid.push("exists");
    if (!isOptionalPlanSizeBytes(path.sizeBytes)) invalid.push("size");
    if (!isOptionalPlanTimestamp(path.lastModifiedAt)) invalid.push("modified timestamp");
    if (!group || !isUsablePlanString(group.appName)) invalid.push("app name");
    if (group && !isOptionalUsablePlanString(group.publisher)) invalid.push("publisher");
    if (group && !isSafeLeftoverGroupSource(group.source)) invalid.push("source");
    if (group && !isSafeLeftoverCleanupState(group.cleanupState)) invalid.push("cleanup state");
    if (!isOptionalStrictPlanString(path.registryValueName)) invalid.push("registry value name");
    if (!isOptionalStrictPlanString(path.protectedBy)) invalid.push("protection reason");
    if (path.kind === "startup-folder") {
      if (!isStrictPlanString(path.startupEntryId)) invalid.push("startup entry id");
      if (!isStrictPlanString(path.startupEntryName)) invalid.push("startup entry name");
      if (!isStrictPlanString(path.startupOrigin)) invalid.push("startup origin");
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

    if (path.kind === "registry") {
      try {
        const backup = await backupAndDeleteRegistryKey({
          userDataDir: options.userDataDir,
          keyPath: path.path,
          now: options.now,
          runner: options.registryRunner ?? defaultRegistryCleanupRunner(),
          app: group
            ? { name: group.appName, publisher: group.publisher ?? null }
            : undefined
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
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 앱 제거 레지스트리 위치|registry location/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: message
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
          app: group
            ? { name: group.appName, publisher: group.publisher ?? null }
            : undefined
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
        skippedItems.push({
          itemId: path.id,
          path: path.path,
          reason: /지원하는 시작 항목 레지스트리 위치|registry location/i.test(message)
            ? "blocked-path"
            : "execute-failed",
          detail: message
        });
      }
      continue;
    }

    if (path.kind === "startup-folder") {
      const startupEntryId = path.startupEntryId;
      const startupEntryName = path.startupEntryName;
      const startupOrigin = path.startupOrigin;
      if (
        !isStrictPlanString(startupEntryId) ||
        !isStrictPlanString(startupEntryName) ||
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
          detail: message
        });
      }
      continue;
    }

    const linkedPathPart = await findLinkedPathPart(path.path, cached.env.home, true);
    if (linkedPathPart) {
      skippedItems.push({
        itemId: path.id,
        path: path.path,
        reason: "blocked-path",
        detail: LINKED_LEFTOVER_PROTECTION
      });
      continue;
    }

    const decision = evaluatePath(path.path, { allowRoots: [path.path], home: cached.env.home });
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

    const cleanupItem = toCleanupItem(
      {
        ...path,
        sizeBytes: measured.sizeBytes,
        lastModifiedAt: measured.lastModifiedAt
      },
      cached.snapshot
    );
    try {
      const trashEntry = await moveToFormatBuddyTrash({
        userDataDir: options.userDataDir,
        item: cleanupItem,
        sizeBytes: cleanupItem.sizeBytes,
        home: cached.env.home,
        now: options.now
      });
      await assertManagedTrashEntryManifest({
        userDataDir: options.userDataDir,
        entryId: trashEntry.id,
        itemId: cleanupItem.id,
        categoryId: cleanupItem.categoryId,
        sizeBytes: cleanupItem.sizeBytes,
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
        sizeBytes: cleanupItem.sizeBytes,
        categoryId: cleanupItem.categoryId,
        mode: "trash",
        succeeded: true,
        trashEntryId: trashEntry.id,
        expiresAt: trashEntry.expiresAt
      });
      resolvedPathIds.add(path.id);
    } catch (err) {
      const message = (err as Error).message;
      skippedItems.push({
        itemId: cleanupItem.id,
        path: cleanupItem.path,
        reason: skipReasonFromTrashError(message),
        detail: message
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logPersistenceWarning = `정리는 끝났지만 실행 기록을 저장하지 못했어요: ${message}`;
  }
  let followupPersistenceWarning: string | undefined;
  if (options.onFollowupCleaned) {
    for (const group of cached.snapshot.groups) {
      rememberResolvedFollowupGroup(cleanedFollowupGroups, group, selectedIds, resolvedPathIds);
    }
    for (const cleanedApp of cleanedFollowupGroups.values()) {
      try {
        await options.onFollowupCleaned(cleanedApp);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        followupPersistenceWarning = followupPersistenceWarning
          ? `${followupPersistenceWarning}; ${message}`
          : `정리는 끝났지만 제거 후 확인 상태를 저장하지 못했어요: ${message}`;
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

export const __testing = { RULES, defaultEnv, measurePath, PLAN_TTL_MS };
