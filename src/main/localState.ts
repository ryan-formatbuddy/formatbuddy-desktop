import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  AppStateSnapshot,
  FormatSeverity,
  IgnoreListState,
  IgnoreListUpdate,
  Recommendation,
  ScanHistoryComparison,
  ScanHistoryEntry,
  ScanReport,
  StatusMonitorSnapshot
} from "@shared/types";
import { normalizePath } from "./cleanup/blocklist";
import { findLinkedPathPart } from "./cleanup/pathSafety";

interface PersistedState {
  version: 1;
  history: ScanHistoryEntry[];
  ignoreList: IgnoreListState;
}

const STATE_FILE = "formatbuddy-state.json";
const MAX_HISTORY = 30;

function statePath(userDataDir: string): string {
  return join(userDataDir, STATE_FILE);
}

function emptyState(): PersistedState {
  return {
    version: 1,
    history: [],
    ignoreList: { cleanupItemIds: [], pathHints: [] }
  };
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function coerceState(value: unknown): PersistedState {
  if (!value || typeof value !== "object") return emptyState();
  const raw = value as Partial<PersistedState>;
  const ignore = raw.ignoreList ?? { cleanupItemIds: [], pathHints: [] };
  return {
    version: 1,
    history: Array.isArray(raw.history) ? raw.history.slice(0, MAX_HISTORY) : [],
    ignoreList: {
      cleanupItemIds: uniq(Array.isArray(ignore.cleanupItemIds) ? ignore.cleanupItemIds : []),
      pathHints: uniq(Array.isArray(ignore.pathHints) ? ignore.pathHints : []),
      updatedAt: typeof ignore.updatedAt === "string" ? ignore.updatedAt : undefined
    }
  };
}

async function loadState(userDataDir: string): Promise<PersistedState> {
  const linkedState = await findLinkedPathPart(statePath(userDataDir), userDataDir, true);
  if (linkedState) {
    if (normalizePath(resolve(linkedState)) === normalizePath(resolve(statePath(userDataDir)))) {
      await rm(statePath(userDataDir), { force: true }).catch(() => {});
    }
    return emptyState();
  }

  try {
    const raw = await readFile(statePath(userDataDir), "utf8");
    return coerceState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

async function saveState(userDataDir: string, state: PersistedState): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  const linkedState = await findLinkedPathPart(statePath(userDataDir), userDataDir, true);
  if (linkedState) {
    if (normalizePath(resolve(linkedState)) !== normalizePath(resolve(statePath(userDataDir)))) {
      throw new Error(`FormatBuddy local state path is behind a link: ${linkedState}`);
    }
    await rm(statePath(userDataDir), { force: true });
  }
  await writeFile(statePath(userDataDir), JSON.stringify(state, null, 2), "utf8");
}

function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return undefined;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function addDays(iso: string, days: number): string | undefined {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return undefined;
  return new Date(time + days * 86_400_000).toISOString();
}

function monitorMessage(entry?: ScanHistoryEntry): string {
  if (!entry) return "아직 점검 기록이 없어요. 첫 점검을 하면 변화까지 같이 챙겨드릴게요.";
  if (entry.severity === "format") return "포맷 전 백업과 직접 확인 항목을 먼저 챙기는 게 좋아요.";
  if (entry.severity === "organize") return "정리 후보와 직접 확인 항목을 먼저 보면 포맷을 미룰 수도 있어요.";
  if (entry.severity === "watch") return "한 번 정리하고 다시 보면 충분히 더 쓸 수 있어요.";
  return "지금은 큰 걱정보다 정기 점검을 유지하면 좋아요.";
}

function monitorFromHistory(history: ScanHistoryEntry[]): StatusMonitorSnapshot {
  const latest = history[0];
  if (!latest) {
    return {
      cleanupLabel: "기록 없음",
      protectionLabel: "기록 없음",
      backupLabel: "기록 없음",
      message: monitorMessage()
    };
  }
  const stale = daysSince(latest.generatedAt);
  return {
    lastScanAt: latest.generatedAt,
    lastScore: latest.score,
    severity: latest.severity,
    staleDays: stale,
    nextSuggestedScanAt: addDays(latest.generatedAt, latest.severity === "safe" ? 30 : 14),
    cleanupLabel: latest.reclaimableGb > 10 ? "정리 후보 많음" : latest.reclaimableGb > 1 ? "가볍게 확인" : "괜찮아요",
    protectionLabel: latest.warningCount > 0 ? "주의 항목 있음" : "괜찮아요",
    backupLabel: latest.directCheckCount > 0 ? "직접 확인 필요" : "괜찮아요",
    message: monitorMessage(latest)
  };
}

function compare(current: ScanHistoryEntry, previous?: ScanHistoryEntry): ScanHistoryComparison {
  if (!previous) return { current };
  return {
    current,
    previous,
    scoreDelta: current.score - previous.score,
    reclaimableDeltaGb: Math.round((current.reclaimableGb - previous.reclaimableGb) * 10) / 10,
    directCheckDelta: current.directCheckCount - previous.directCheckCount,
    warningDelta: current.warningCount - previous.warningCount
  };
}

function entryId(report: ScanReport, recommendation: Recommendation): string {
  return `${Date.parse(report.generatedAt) || Date.now()}-${recommendation.formatScore}`;
}

export function buildHistoryEntry(report: ScanReport, recommendation: Recommendation): ScanHistoryEntry {
  const directCheckCount = recommendation.buddyChecklist.filter((i) => i.status === "needs_user").length;
  const warningCount = recommendation.buddyChecklist.filter((i) => i.status === "warning").length;
  return {
    id: entryId(report, recommendation),
    generatedAt: report.generatedAt,
    score: recommendation.formatScore,
    severity: recommendation.severity as FormatSeverity,
    headline: recommendation.headline,
    reclaimableGb: recommendation.cleanupCenter.reclaimableGb,
    reviewCount: recommendation.cleanupCenter.reviewCount,
    directCheckCount,
    warningCount,
    installedAppCount: recommendation.appInventory.total,
    largeFileCount: recommendation.cleanupCenter.largeFiles.length,
    duplicateGroupCount: recommendation.cleanupCenter.duplicateGroups.length,
    startupCount: recommendation.cleanupCenter.startupItems.length || report.startupPrograms?.count || 0
  };
}

export async function getAppStateSnapshot(userDataDir: string): Promise<AppStateSnapshot> {
  const state = await loadState(userDataDir);
  return {
    history: state.history,
    comparison: state.history[0] ? compare(state.history[0], state.history[1]) : undefined,
    ignoreList: state.ignoreList,
    monitor: monitorFromHistory(state.history)
  };
}

export async function getLatestScanAt(userDataDir: string): Promise<string | undefined> {
  const state = await loadState(userDataDir);
  return state.history[0]?.generatedAt;
}

export async function recordScanResult(
  userDataDir: string,
  report: ScanReport,
  recommendation: Recommendation
): Promise<AppStateSnapshot> {
  const state = await loadState(userDataDir);
  const current = buildHistoryEntry(report, recommendation);
  const deduped = state.history.filter((entry) => entry.id !== current.id);
  state.history = [current, ...deduped].slice(0, MAX_HISTORY);
  await saveState(userDataDir, state);
  return {
    history: state.history,
    comparison: compare(current, state.history[1]),
    ignoreList: state.ignoreList,
    monitor: monitorFromHistory(state.history)
  };
}

export async function updateIgnoreList(
  userDataDir: string,
  update: IgnoreListUpdate
): Promise<IgnoreListState> {
  const state = await loadState(userDataDir);
  const key = update.kind === "cleanup" ? "cleanupItemIds" : "pathHints";
  const values = new Set(state.ignoreList[key]);
  if (update.ignored) values.add(update.id);
  else values.delete(update.id);
  state.ignoreList = {
    ...state.ignoreList,
    [key]: Array.from(values),
    updatedAt: new Date().toISOString()
  };
  await saveState(userDataDir, state);
  return state.ignoreList;
}

export const __testing = {
  coerceState,
  monitorFromHistory,
  compare
};
