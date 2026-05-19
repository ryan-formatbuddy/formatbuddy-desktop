import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult
} from "./types";

const MS_PER_DAY = 86_400_000;

export interface TrashExpirySummary {
  nextExpiryDays: number | null;
  expiringSoonCount: number;
  todayCount: number;
}

function parseTrashExpiryDays(expiresAt: string, now: number): number | null {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - now) / MS_PER_DAY));
}

export function daysUntilTrashExpiry(expiresAt: string, now = Date.now()): number {
  return parseTrashExpiryDays(expiresAt, now) ?? 0;
}

export function trashExpirySummary(
  entries: Pick<CleanupTrashEntry, "expiresAt">[],
  now = Date.now(),
  soonDays = 3
): TrashExpirySummary {
  const days = entries
    .map((entry) => parseTrashExpiryDays(entry.expiresAt, now))
    .filter((day): day is number => day !== null);

  return {
    nextExpiryDays: days.length > 0 ? Math.min(...days) : null,
    expiringSoonCount: days.filter((day) => day <= soonDays).length,
    todayCount: days.filter((day) => day === 0).length
  };
}

export function restorableTrashEntryIds(result: CleanupExecuteResult): string[] {
  return result.removedItems
    .filter((item) => item.succeeded && item.mode === "trash" && Boolean(item.trashEntryId))
    .map((item) => item.trashEntryId)
    .filter((id): id is string => typeof id === "string");
}

export function summarizeTrashRestoreResults(
  results: CleanupTrashRestoreResult[]
): string {
  const restored = results.filter((item) => item.status === "restored").length;
  const blocked = results.filter((item) => item.status === "target-exists").length;
  const failed = results.length - restored - blocked;
  const parts: string[] = [];

  if (restored > 0) parts.push(`${restored}개를 원래 위치로 되돌렸어요.`);
  if (blocked > 0) parts.push(`${blocked}개는 원래 위치에 같은 이름이 있어 멈췄어요.`);
  if (failed > 0) parts.push(`${failed}개는 이미 없거나 되돌리지 못했어요.`);

  return parts.length > 0 ? parts.join(" ") : "되돌린 항목이 없어요.";
}
