/**
 * Per-app leftover-path catalog.
 *
 * Windows uninstallers routinely leave AppData and ProgramData behind
 * "by design" (preserves user data on reinstall). We surface those
 * leftover paths so Ryan can see what's there — but we DO NOT delete
 * them from this surface. The Phase-1 cleanup engine is the only path
 * that ever removes files; if the user later wants to add a leftover
 * to their cleanup plan they can do it from there, where the blocklist
 * already applies.
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
  CleanupExecuteResult,
  CleanupExecutedItem,
  CleanupItem,
  CleanupSkippedItem,
  InstalledApp
} from "@shared/types";
import { evaluatePath, normalizePath } from "../cleanup/blocklist";
import { buildLogEntry, recordCleanupExecution } from "../cleanup/log";
import { moveToFormatBuddyTrash } from "../cleanup/trash";

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

const PLAN_TTL_MS = 5 * 60 * 1000;
const MAX_LEFTOVER_DEPTH = 8;
const MAX_LEFTOVER_ITEMS = 50_000;
const PLAN_CACHE = new Map<string, CachedLeftoversPlan>();

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
  if (depth > MAX_LEFTOVER_DEPTH || counter.count >= MAX_LEFTOVER_ITEMS) return;

  let stat: Stats;
  try {
    stat = await fs.lstat(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) return;
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
    return;
  }
  for (const entry of entries) {
    if (counter.count >= MAX_LEFTOVER_ITEMS) return;
    if (entry.isSymbolicLink()) continue;
    yield* walkPath(join(root, entry.name), depth + 1, counter);
  }
}

async function measurePath(raw: string): Promise<{
  exists: boolean;
  sizeBytes?: number;
  lastModifiedAt?: string;
}> {
  try {
    const rootStat = await fs.lstat(raw);
    if (rootStat.isSymbolicLink()) return { exists: false };
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
  } catch {
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
    protectedBy: decision.allowed ? undefined : decision.blockedBy ?? normalized
  };
}

export async function planAppLeftovers(
  apps: InstalledApp[],
  options: PlanLeftoversOptions = {}
): Promise<AppLeftoversSnapshot> {
  const home = options.home ?? homedir();
  const env = defaultEnv(home, options.env);

  const groups: AppLeftoverGroup[] = [];
  const seenLabels = new Set<string>();

  for (const app of apps) {
    if (!app.name) continue;
    const text = `${app.name} ${app.publisher ?? ""}`;
    const rule = RULES.find((r) => r.match.test(text));
    if (!rule) continue;
    if (seenLabels.has(rule.appLabel)) continue;
    seenLabels.add(rule.appLabel);

    const paths: AppLeftoverPath[] = [];
    for (const builder of rule.paths) {
      paths.push(await pathInfo(builder(env), env));
    }

    groups.push({
      appName: rule.appLabel,
      publisher: app.publisher,
      paths
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
  if (cached.snapshot.confirmationToken !== confirmationToken) return undefined;
  PLAN_CACHE.delete(planId);
  return cached;
}

function allPaths(snapshot: AppLeftoversSnapshot): AppLeftoverPath[] {
  return snapshot.groups.flatMap((group) => group.paths);
}

function appNameForPath(snapshot: AppLeftoversSnapshot, pathId: string): string {
  return snapshot.groups.find((group) => group.paths.some((path) => path.id === pathId))?.appName ?? "앱 잔여 폴더";
}

function toCleanupItem(path: AppLeftoverPath, snapshot: AppLeftoversSnapshot): CleanupItem {
  return {
    id: path.id,
    path: path.path,
    label: appNameForPath(snapshot, path.id),
    sizeBytes: Math.max(0, Math.round(path.sizeBytes ?? 0)),
    modifiedAt: path.lastModifiedAt ?? undefined,
    categoryId: "app-leftovers",
    riskLevel: "review",
    reason: "앱 제거 후 남은 AppData/ProgramData 후보"
  };
}

export async function cleanupAppLeftovers(
  request: AppLeftoversCleanupRequest,
  options: { userDataDir: string; now?: () => Date } 
): Promise<CleanupExecuteResult> {
  if (!request?.planId || !request?.confirmationToken) {
    throw new Error("apps:leftovers-cleanup requires planId and confirmationToken");
  }
  if (!Array.isArray(request.selectedPathIds) || request.selectedPathIds.length === 0) {
    throw new Error("apps:leftovers-cleanup requires at least one selected path");
  }

  const cached = consumeLeftoversPlan(request.planId, request.confirmationToken, options.now);
  if (!cached) {
    throw new Error("apps:leftovers-cleanup could not match a current plan (expired, wrong token, or already executed)");
  }

  const selectedIds = new Set(request.selectedPathIds);
  const index = new Map(allPaths(cached.snapshot).map((path) => [path.id, path]));
  const removedItems: CleanupExecutedItem[] = [];
  const skippedItems: CleanupSkippedItem[] = [];

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
      skippedItems.push({ itemId: path.id, path: path.path, reason: "not-found" });
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
        now: options.now
      });
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
    } catch (err) {
      skippedItems.push({
        itemId: cleanupItem.id,
        path: cleanupItem.path,
        reason: "execute-failed",
        detail: (err as Error).message
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
  await recordCleanupExecution(options.userDataDir, logEntry);

  return {
    planId: cached.snapshot.planId,
    executedAt,
    mode: "trash",
    totalFreedBytes: logEntry.totalFreedBytes,
    removedItems,
    skippedItems,
    logEntry
  };
}

export function __resetLeftoversPlanCacheForTests(): void {
  PLAN_CACHE.clear();
}

export const __testing = { RULES, defaultEnv, measurePath, PLAN_TTL_MS };
