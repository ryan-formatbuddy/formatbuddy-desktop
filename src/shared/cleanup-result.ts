import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  RegistryBackupEntry,
  RegistryBackupRestoreResult
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

function parseSortTime(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : fallback;
}

export function daysUntilTrashExpiry(expiresAt: string, now = Date.now()): number {
  return parseTrashExpiryDays(expiresAt, now) ?? 0;
}

export function sortTrashEntriesByExpiry<T extends { expiresAt: string; createdAt?: string; id?: string }>(
  entries: T[]
): T[] {
  return entries.slice().sort((a, b) => {
    const expiryDiff =
      parseSortTime(a.expiresAt, Number.POSITIVE_INFINITY) -
      parseSortTime(b.expiresAt, Number.POSITIVE_INFINITY);
    if (expiryDiff !== 0) return expiryDiff;

    const createdDiff =
      parseSortTime(a.createdAt, Number.POSITIVE_INFINITY) -
      parseSortTime(b.createdAt, Number.POSITIVE_INFINITY);
    if (createdDiff !== 0) return createdDiff;

    return (a.id ?? "").localeCompare(b.id ?? "", "ko-KR");
  });
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

export function restorableRegistryBackupIds(result: CleanupExecuteResult): string[] {
  return result.removedItems
    .filter((item) => item.succeeded && item.mode === "trash" && Boolean(item.registryBackupId))
    .map((item) => item.registryBackupId)
    .filter((id): id is string => typeof id === "string");
}

export function summarizeTrashRestoreResults(
  results: CleanupTrashRestoreResult[]
): string {
  const restored = results.filter((item) => item.status === "restored").length;
  const blocked = results.filter((item) => item.status === "target-exists").length;
  const notFound = results.filter((item) => item.status === "not-found").length;
  const unsafePath = results.filter((item) => item.status === "blocked-path").length;
  const missingStoredItem = results.filter((item) => item.status === "missing-stored-item").length;
  const restoreFailed = results.filter((item) => item.status === "restore-failed").length;
  const parts: string[] = [];

  if (restored > 0) parts.push(`${restored}개를 원래 위치로 되돌렸어요.`);
  if (blocked > 0) parts.push(`${blocked}개는 원래 위치에 같은 이름이 있어 멈췄어요.`);
  if (notFound > 0) parts.push(`${notFound}개는 복구함에서 찾지 못했어요.`);
  if (unsafePath > 0) parts.push(`${unsafePath}개는 안전 확인이 필요해 멈췄어요.`);
  if (missingStoredItem > 0) parts.push(`${missingStoredItem}개는 보관된 파일을 찾지 못했어요.`);
  if (restoreFailed > 0) parts.push(`${restoreFailed}개는 되돌리는 중 문제가 생겼어요.`);

  return parts.length > 0 ? parts.join(" ") : "되돌린 항목이 없어요.";
}

type RegistryBackupKindSource = Pick<RegistryBackupEntry, "backupKind">;

export function isStartupRegistryBackup(entry: RegistryBackupKindSource | null | undefined): boolean {
  return entry?.backupKind === "startup-value";
}

export function registryBackupKindLabel(entry: RegistryBackupKindSource): string {
  return isStartupRegistryBackup(entry) ? "시작 항목 백업" : "앱 삭제 흔적 백업";
}

export function registryBackupRestoreButtonLabel(entry: RegistryBackupKindSource): string {
  return isStartupRegistryBackup(entry) ? "시작 항목 되돌리기" : "앱 흔적 되돌리기";
}

export function summarizeRegistryBackupRestoreResults(
  results: RegistryBackupRestoreResult[]
): string {
  const restored = results.filter((item) => item.status === "restored");
  const restoredAppBackups = restored.filter((item) => !isStartupRegistryBackup(item.entry)).length;
  const restoredStartupBackups = restored.filter((item) => isStartupRegistryBackup(item.entry)).length;
  const notFound = results.filter((item) => item.status === "not-found").length;
  const unsafePath = results.filter((item) => item.status === "blocked-path").length;
  const missingBackup = results.filter((item) => item.status === "missing-backup").length;
  const restoreFailed = results.filter((item) => item.status === "restore-failed").length;
  const parts: string[] = [];

  if (restoredAppBackups > 0) {
    parts.push(`앱 삭제 흔적 백업 ${restoredAppBackups}개를 되돌렸어요.`);
  }
  if (restoredStartupBackups > 0) {
    parts.push(`시작 항목 백업 ${restoredStartupBackups}개를 되돌렸어요.`);
  }
  if (notFound > 0) parts.push(`${notFound}개는 백업 목록에서 찾지 못했어요.`);
  if (missingBackup > 0) parts.push(`${missingBackup}개는 백업 파일을 찾지 못했어요.`);
  if (unsafePath > 0) parts.push(`${unsafePath}개는 안전 확인이 필요해 멈췄어요.`);
  if (restoreFailed > 0) parts.push(`${restoreFailed}개는 되돌리는 중 문제가 생겼어요.`);

  return parts.length > 0 ? parts.join(" ") : "";
}

export function summarizeRestoreAllResults(
  trashResults: CleanupTrashRestoreResult[],
  registryResults: RegistryBackupRestoreResult[],
  unexpectedFailureCount = 0
): string {
  const parts = [
    trashResults.length > 0 ? summarizeTrashRestoreResults(trashResults) : "",
    summarizeRegistryBackupRestoreResults(registryResults),
    unexpectedFailureCount > 0
      ? `${unexpectedFailureCount}개는 연결 문제로 되돌리지 못했어요.`
      : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "되돌린 항목이 없어요.";
}
