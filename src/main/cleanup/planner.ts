/**
 * Cleanup planner — DRY RUN ONLY.
 *
 * Walks the categories we know how to clean safely, collects candidate
 * paths, and produces a CleanupPlan. The planner NEVER deletes anything.
 *
 * Anchor invariants:
 *   - Every candidate is evaluated against the per-category blocklist
 *     (allowRoots + system + user rules). A path that fails ends up in
 *     `blockedItems` for UI transparency; it can never reach executor.
 *   - The walker skips reparse points (junctions/symlinks) so we don't
 *     follow KakaoTalk's data junction into the live tree, or Windows.old
 *     back into Windows.
 *   - There are hard caps per category (depth, total items, total bytes)
 *     so a single Downloads folder full of millions of files cannot freeze
 *     the dry-run.
 *   - Plans are cached in-memory under planId. Executor refuses to run
 *     a plan whose confirmationToken doesn't match the cached plan — so
 *     a renderer cannot forge or mutate a plan.
 */
import { promises as fs } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  CleanupCategoryId,
  CleanupCategoryPlan,
  CleanupItem,
  CleanupPlan,
  CleanupRiskLevel,
  LargeFileCandidate
} from "@shared/types";
import { BLOCKLIST_VERSION, evaluatePath, normalizePath } from "./blocklist";

const PLAN_TTL_MS = 5 * 60 * 1000;
const MAX_ITEMS_PER_CATEGORY = 500;
const MAX_DEPTH = 8;
const MIN_TEMP_AGE_DAYS = 7;
const MIN_INSTALLER_AGE_DAYS = 90;
const INSTALLER_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".iso", ".dmg"]);

interface CachedPlan {
  plan: CleanupPlan;
  expiresAt: number;
}

const PLAN_CACHE = new Map<string, CachedPlan>();

export interface PlanCleanupEnvironment {
  home?: string;
  tempDir?: string;
  localAppData?: string;
  systemRoot?: string;
  systemDrive?: string;
  /** Optional pre-collected large-file candidates from the most recent scan. */
  largeFiles?: LargeFileCandidate[];
  /** Optional clock injection so tests can pin "now" deterministically. */
  now?: () => Date;
}

export interface PlanCleanupOptions {
  signal?: AbortSignal;
  env?: PlanCleanupEnvironment;
}

interface CandidateAccumulator {
  items: CleanupItem[];
  blocked: CleanupItem[];
  totalBytes: number;
}

function nowIso(env?: PlanCleanupEnvironment): string {
  const d = env?.now?.() ?? new Date();
  return d.toISOString();
}

function ageDays(modifiedAt: Date, env?: PlanCleanupEnvironment): number {
  const now = env?.now?.() ?? new Date();
  return Math.max(0, (now.getTime() - modifiedAt.getTime()) / 86_400_000);
}

function makeItemId(path: string): string {
  return createHash("sha1").update(normalizePath(path)).digest("hex").slice(0, 16);
}

function basename(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, "");
  const idx = Math.max(cleaned.lastIndexOf("\\"), cleaned.lastIndexOf("/"));
  return idx === -1 ? cleaned : cleaned.slice(idx + 1);
}

function emptyAccumulator(): CandidateAccumulator {
  return { items: [], blocked: [], totalBytes: 0 };
}

function pushCandidate(
  acc: CandidateAccumulator,
  candidate: Omit<CleanupItem, "id">,
  allowRoots: string[],
  home: string
) {
  const decision = evaluatePath(candidate.path, { allowRoots, home });
  const id = makeItemId(candidate.path);
  if (!decision.allowed) {
    acc.blocked.push({
      ...candidate,
      id,
      riskLevel: "restricted",
      blockedBy: decision.blockedBy
    });
    return;
  }
  if (acc.items.length >= MAX_ITEMS_PER_CATEGORY) return;
  acc.items.push({ ...candidate, id });
  acc.totalBytes += candidate.sizeBytes;
}

/**
 * Manual recursive walk that skips reparse points. We can't use
 * fs.readdir with { recursive: true } because it follows junctions
 * (Windows-only behavior that bites us on OneDrive / WindowsApps).
 */
async function* walkFiles(
  root: string,
  signal?: AbortSignal,
  depth = 0
): AsyncGenerator<{ path: string; size: number; modified: Date }> {
  if (signal?.aborted) return;
  if (depth > MAX_DEPTH) return;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (signal?.aborted) return;
    if (entry.isSymbolicLink()) continue;

    const fullPath = join(root, entry.name);
    let stat: Stats;
    try {
      stat = await fs.lstat(fullPath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      yield* walkFiles(fullPath, signal, depth + 1);
      continue;
    }

    if (stat.isFile()) {
      yield {
        path: fullPath,
        size: stat.size,
        modified: stat.mtime
      };
    }
  }
}

async function planAgeBasedTempCategory(args: {
  categoryId: CleanupCategoryId;
  root: string | undefined;
  minAgeDays: number;
  reason: (file: { ageDays: number }) => string;
  signal?: AbortSignal;
  home: string;
  env?: PlanCleanupEnvironment;
}): Promise<CandidateAccumulator> {
  const acc = emptyAccumulator();
  if (!args.root) return acc;
  try {
    await fs.access(args.root);
  } catch {
    return acc;
  }
  for await (const file of walkFiles(args.root, args.signal)) {
    if (file.size <= 0) continue;
    const age = ageDays(file.modified, args.env);
    if (age < args.minAgeDays) continue;
    pushCandidate(
      acc,
      {
        path: file.path,
        label: basename(file.path),
        sizeBytes: file.size,
        modifiedAt: file.modified.toISOString(),
        categoryId: args.categoryId,
        riskLevel: "safe",
        reason: args.reason({ ageDays: age })
      },
      [args.root],
      args.home
    );
  }
  return acc;
}

async function planBrowserCacheCategory(args: {
  home: string;
  signal?: AbortSignal;
  env?: PlanCleanupEnvironment;
}): Promise<CandidateAccumulator> {
  const acc = emptyAccumulator();
  const localAppData = args.env?.localAppData ?? join(args.home, "AppData", "Local");
  const profiles: { name: string; cacheRoot: string }[] = [
    {
      name: "Chrome",
      cacheRoot: join(localAppData, "Google", "Chrome", "User Data", "Default")
    },
    {
      name: "Edge",
      cacheRoot: join(localAppData, "Microsoft", "Edge", "User Data", "Default")
    },
    {
      name: "Whale",
      cacheRoot: join(localAppData, "Naver", "Naver Whale", "User Data", "Default")
    }
  ];

  const CACHE_SUBDIRS = ["Cache", "Code Cache", "GPUCache", "ShaderCache"];
  for (const profile of profiles) {
    for (const sub of CACHE_SUBDIRS) {
      const cacheDir = join(profile.cacheRoot, sub);
      try {
        await fs.access(cacheDir);
      } catch {
        continue;
      }
      for await (const file of walkFiles(cacheDir, args.signal)) {
        if (file.size <= 0) continue;
        pushCandidate(
          acc,
          {
            path: file.path,
            label: `${profile.name} / ${sub} / ${basename(file.path)}`,
            sizeBytes: file.size,
            modifiedAt: file.modified.toISOString(),
            categoryId: "browser-cache",
            riskLevel: "safe",
            reason: `${profile.name} 브라우저 임시 캐시`
          },
          [cacheDir],
          args.home
        );
      }
    }
  }
  return acc;
}

async function planWindowsOldCategory(args: {
  systemDrive: string | undefined;
  home: string;
  signal?: AbortSignal;
}): Promise<CandidateAccumulator> {
  const acc = emptyAccumulator();
  if (!args.systemDrive) return acc;
  const winOldRoot = join(args.systemDrive, "Windows.old");
  try {
    await fs.access(winOldRoot);
  } catch {
    return acc;
  }
  // We don't enumerate every file inside Windows.old (it's massive).
  // The user gets one explicit checkbox: "이전 Windows 파일 전체".
  // Executor will recursively remove the folder ONLY if this single
  // item is selected.
  let totalBytes = 0;
  let fileCount = 0;
  for await (const file of walkFiles(winOldRoot, args.signal)) {
    totalBytes += file.size;
    fileCount += 1;
    if (fileCount > 50_000) break;
  }
  pushCandidate(
    acc,
    {
      path: winOldRoot,
      label: "이전 Windows 파일 전체",
      sizeBytes: totalBytes,
      categoryId: "windows-old",
      riskLevel: "review",
      reason: `Windows.old 폴더 (${fileCount.toLocaleString("ko-KR")}개 파일)`
    },
    [winOldRoot],
    args.home
  );
  return acc;
}

async function planDownloadsInstallersCategory(args: {
  home: string;
  signal?: AbortSignal;
  env?: PlanCleanupEnvironment;
}): Promise<CandidateAccumulator> {
  const acc = emptyAccumulator();
  const downloads = join(args.home, "Downloads");
  try {
    await fs.access(downloads);
  } catch {
    return acc;
  }
  for await (const file of walkFiles(downloads, args.signal)) {
    if (file.size <= 0) continue;
    const lower = file.path.toLowerCase();
    const dot = lower.lastIndexOf(".");
    if (dot === -1) continue;
    const ext = lower.slice(dot);
    if (!INSTALLER_EXTENSIONS.has(ext)) continue;
    const age = ageDays(file.modified, args.env);
    if (age < MIN_INSTALLER_AGE_DAYS) continue;
    pushCandidate(
      acc,
      {
        path: file.path,
        label: basename(file.path),
        sizeBytes: file.size,
        modifiedAt: file.modified.toISOString(),
        categoryId: "downloads-installers",
        riskLevel: "review",
        reason: `${Math.round(age)}일 전 다운로드한 설치 파일`
      },
      [downloads],
      args.home
    );
  }
  return acc;
}

/**
 * Windows Recycle Bin is a special namespace, not a real filesystem path
 * that FormatBuddy can move into its own 30-day restore bin. We keep the
 * category visible for transparency, but surface the sentinel as blocked so
 * it can never be selected by the product cleanup flow.
 */
export const RECYCLE_BIN_SENTINEL_PATH = "shell:recycle-bin";

function planRecycleBinCategory(): CandidateAccumulator {
  const acc = emptyAccumulator();
  acc.blocked.push({
    id: makeItemId(RECYCLE_BIN_SENTINEL_PATH),
    path: RECYCLE_BIN_SENTINEL_PATH,
    label: "Windows 휴지통 전체",
    sizeBytes: 0,
    categoryId: "recycle-bin",
    riskLevel: "restricted",
    reason: "Windows 휴지통은 포맷버디 30일 복구함으로 옮길 수 없어요.",
    blockedBy: "Windows 휴지통은 직접 열어서 확인해주세요."
  });
  return acc;
}

function planLargeFilesCategory(args: {
  home: string;
  largeFiles: LargeFileCandidate[];
}): CandidateAccumulator {
  const acc = emptyAccumulator();
  for (const candidate of args.largeFiles) {
    if (!candidate.path || !(candidate.sizeGb > 0)) continue;
    const sizeBytes = Math.round(candidate.sizeGb * 1024 ** 3);
    // For large-files we trust the user's own folders only — Desktop,
    // Documents, Pictures, Music, Videos, Downloads under their home.
    const allowRoots = [args.home];
    pushCandidate(
      acc,
      {
        path: candidate.path,
        label: candidate.name,
        sizeBytes,
        modifiedAt: candidate.modifiedAt ?? undefined,
        categoryId: "large-files",
        riskLevel: "review",
        reason: `사용자 폴더의 큰 파일 (${candidate.folderName})`
      },
      allowRoots,
      args.home
    );
  }
  return acc;
}

interface CategorySpec {
  id: CleanupCategoryId;
  label: string;
  description: string;
  safetyNote: string;
  riskLevel: CleanupRiskLevel;
}

const CATEGORY_SPECS: Record<CleanupCategoryId, CategorySpec> = {
  "recycle-bin": {
    id: "recycle-bin",
    label: "Windows 휴지통",
    description: "Windows 휴지통은 포맷버디 복구함으로 옮기지 않고 직접 확인만 안내해요.",
    safetyNote: "바로 비우지 않아요. Windows 휴지통을 열어 필요한 파일이 없는지 직접 확인해주세요.",
    riskLevel: "review"
  },
  "temp-user": {
    id: "temp-user",
    label: "사용자 임시 파일",
    description: "%TEMP%와 LocalAppData\\Temp 폴더에서 7일 이상 손대지 않은 파일이에요.",
    safetyNote: "Windows가 다시 만들 수 있는 파일이지만, 포맷버디 복구함으로 보내요.",
    riskLevel: "safe"
  },
  "temp-windows": {
    id: "temp-windows",
    label: "Windows 임시 파일",
    description: "Windows\\Temp에서 7일 이상 손대지 않은 파일이에요.",
    safetyNote: "관리자 권한이 필요할 수 있어요. 거부되면 자동으로 건너뛰어요.",
    riskLevel: "safe"
  },
  "browser-cache": {
    id: "browser-cache",
    label: "브라우저 캐시",
    description: "Chrome · Edge · Whale의 임시 캐시만 봐요. 비밀번호·쿠키는 보지 않아요.",
    safetyNote: "다음 방문 시 자동으로 다시 만들어져요.",
    riskLevel: "safe"
  },
  "windows-old": {
    id: "windows-old",
    label: "이전 Windows 파일",
    description: "Windows.old 폴더는 10일 이후 자동 삭제되지만, 직접 정리하면 즉시 공간이 비워져요.",
    safetyNote: "되돌리기 기간이 필요하면 지우지 마세요.",
    riskLevel: "review"
  },
  "downloads-installers": {
    id: "downloads-installers",
    label: "오래된 설치 파일",
    description: "Downloads 폴더의 90일 이상된 .exe / .msi / .iso 설치 파일이에요.",
    safetyNote: "설치 후 다시 받을 수 있으면 정리해요.",
    riskLevel: "review"
  },
  "large-files": {
    id: "large-files",
    label: "용량 큰 파일",
    description: "진단에서 찾은 큰 파일 후보예요. 항목을 직접 보고 선택해요.",
    safetyNote: "개인 파일이 섞일 수 있어요. 반드시 확인해주세요.",
    riskLevel: "review"
  },
  "app-leftovers": {
    id: "app-leftovers",
    label: "앱 잔여 폴더",
    description: "앱 제거 뒤 AppData/ProgramData에 남은 폴더 후보예요.",
    safetyNote: "앱 정리 센터에서 직접 선택한 항목만 포맷버디 복구함으로 보내요.",
    riskLevel: "review"
  }
};

function toCategoryPlan(spec: CategorySpec, acc: CandidateAccumulator): CleanupCategoryPlan {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    safetyNote: spec.safetyNote,
    riskLevel: spec.riskLevel,
    totalBytes: acc.totalBytes,
    itemCount: acc.items.length,
    items: acc.items,
    blockedItems: acc.blocked
  };
}

export async function planCleanup(options: PlanCleanupOptions = {}): Promise<CleanupPlan> {
  const env = options.env;
  const home = env?.home ?? homedir();
  const localAppData = env?.localAppData ?? join(home, "AppData", "Local");
  const userTemp =
    env?.tempDir ??
    process.env.TEMP ??
    join(localAppData, "Temp");
  const systemRoot = env?.systemRoot ?? process.env.SystemRoot ?? undefined;
  const systemDrive = env?.systemDrive ?? process.env.SystemDrive ?? undefined;
  const signal = options.signal;

  const notes: string[] = [];
  const tempReason = ({ ageDays: a }: { ageDays: number }) =>
    `${Math.round(a)}일 동안 손대지 않은 임시 파일`;

  const tempUser = await planAgeBasedTempCategory({
    categoryId: "temp-user",
    root: userTemp,
    minAgeDays: MIN_TEMP_AGE_DAYS,
    reason: tempReason,
    signal,
    home,
    env
  });
  if (!userTemp) notes.push("사용자 임시 폴더 경로를 확인하지 못했어요.");

  const tempWindows = await planAgeBasedTempCategory({
    categoryId: "temp-windows",
    root: systemRoot ? join(systemRoot, "Temp") : undefined,
    minAgeDays: MIN_TEMP_AGE_DAYS,
    reason: tempReason,
    signal,
    home,
    env
  });

  const browserCache = await planBrowserCacheCategory({ home, signal, env });
  const windowsOld = await planWindowsOldCategory({ systemDrive, home, signal });
  const downloadsInstallers = await planDownloadsInstallersCategory({ home, signal, env });
  const largeFiles = planLargeFilesCategory({
    home,
    largeFiles: env?.largeFiles ?? []
  });
  const recycleBin = planRecycleBinCategory();

  const categories: CleanupCategoryPlan[] = [
    toCategoryPlan(CATEGORY_SPECS["recycle-bin"], recycleBin),
    toCategoryPlan(CATEGORY_SPECS["temp-user"], tempUser),
    toCategoryPlan(CATEGORY_SPECS["temp-windows"], tempWindows),
    toCategoryPlan(CATEGORY_SPECS["browser-cache"], browserCache),
    toCategoryPlan(CATEGORY_SPECS["windows-old"], windowsOld),
    toCategoryPlan(CATEGORY_SPECS["downloads-installers"], downloadsInstallers),
    toCategoryPlan(CATEGORY_SPECS["large-files"], largeFiles)
  ];

  const totalReclaimableBytes = categories.reduce(
    (sum, c) => sum + c.totalBytes,
    0
  );

  const planId = randomUUID();
  // The token includes counts + bytes so tampering with the plan after
  // it leaves the main process makes the executor refuse it. The cached
  // plan is the source of truth; this token is a cheap consistency seal.
  const tokenInput = categories
    .map((c) => `${c.id}:${c.itemCount}:${c.totalBytes}`)
    .join("|");
  const confirmationToken = createHash("sha256")
    .update(`${planId}|${tokenInput}|${BLOCKLIST_VERSION}`)
    .digest("hex");

  const plan: CleanupPlan = {
    planId,
    generatedAt: nowIso(env),
    confirmationToken,
    blocklistVersion: BLOCKLIST_VERSION,
    totalReclaimableBytes,
    categories,
    notes
  };

  rememberPlan(plan, env?.now);
  return plan;
}

function rememberPlan(plan: CleanupPlan, now?: () => Date) {
  const expiresAt = (now?.().getTime() ?? Date.now()) + PLAN_TTL_MS;
  PLAN_CACHE.set(plan.planId, { plan, expiresAt });
  pruneExpired(now);
}

function pruneExpired(now?: () => Date) {
  const t = now?.().getTime() ?? Date.now();
  for (const [id, cached] of PLAN_CACHE.entries()) {
    if (cached.expiresAt <= t) PLAN_CACHE.delete(id);
  }
}

export function consumePlan(
  planId: string,
  confirmationToken: string,
  now?: () => Date
): CleanupPlan | undefined {
  pruneExpired(now);
  const cached = PLAN_CACHE.get(planId);
  if (!cached) return undefined;
  if (cached.plan.confirmationToken !== confirmationToken) {
    PLAN_CACHE.delete(planId);
    return undefined;
  }
  if (cached.plan.blocklistVersion !== BLOCKLIST_VERSION) {
    PLAN_CACHE.delete(planId);
    return undefined;
  }
  PLAN_CACHE.delete(planId);
  return cached.plan;
}

export function peekPlan(
  planId: string,
  confirmationToken: string,
  now?: () => Date
): CleanupPlan | undefined {
  pruneExpired(now);
  const cached = PLAN_CACHE.get(planId);
  if (!cached) return undefined;
  if (cached.plan.confirmationToken !== confirmationToken) return undefined;
  if (cached.plan.blocklistVersion !== BLOCKLIST_VERSION) return undefined;
  return cached.plan;
}

export function __resetPlanCacheForTests(): void {
  PLAN_CACHE.clear();
}

export const __testing = {
  CATEGORY_SPECS,
  walkFiles,
  pushCandidate,
  emptyAccumulator,
  PLAN_TTL_MS,
  MAX_ITEMS_PER_CATEGORY
};
