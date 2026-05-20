import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  RegistryBackupEntry,
  RegistryBackupRestoreResult,
  StartupFolderToggleResult
} from "./types";
import { RESTORE_BIN_RETENTION_DAYS } from "./retention";

const MS_PER_DAY = 86_400_000;
const RESTORE_WINDOW_MS = RESTORE_BIN_RETENTION_DAYS * MS_PER_DAY;

export interface TrashExpirySummary {
  nextExpiryDays: number | null;
  expiringSoonCount: number;
  todayCount: number;
}

function parseTrashExpiryDays(expiresAt: string, now: number): number | null {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / MS_PER_DAY));
}

function parseSortTime(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : fallback;
}

function parseExpirySortTime(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function daysUntilTrashExpiry(expiresAt: string, now = Date.now()): number {
  return parseTrashExpiryDays(expiresAt, now) ?? 0;
}

export function isTrashEntryExpired(expiresAt: string, now = Date.now()): boolean {
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t <= now;
}

export function restoreEntryExpiryLabel(expiresAt: string, now = Date.now()): string {
  if (isTrashEntryExpired(expiresAt, now)) return "보관 기간 지남";
  return `${daysUntilTrashExpiry(expiresAt, now)}일 뒤 만료`;
}

export function sortTrashEntriesByExpiry<T extends { expiresAt: string; createdAt?: string; id?: string }>(
  entries: T[]
): T[] {
  return entries.slice().sort((a, b) => {
    const expiryDiff =
      parseExpirySortTime(a.expiresAt) - parseExpirySortTime(b.expiresAt);
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

function isSafeRestorableResultId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !/\s/.test(value) &&
    !/[\/\\\u0000-\u001f\u007f]/.test(value)
  );
}

function executedItemStillWithinRestoreWindow(
  expiresAt: string | undefined,
  executedAt: string,
  now: number
): boolean {
  if (!expiresAt) return false;
  const expiryTime = Date.parse(expiresAt);
  const executedTime = Date.parse(executedAt);
  if (!Number.isFinite(expiryTime) || !Number.isFinite(executedTime)) return false;
  if (expiryTime <= now || expiryTime <= executedTime) return false;
  return expiryTime - executedTime <= RESTORE_WINDOW_MS;
}

export function restorableTrashEntryIds(result: CleanupExecuteResult, now = Date.now()): string[] {
  return result.removedItems
    .filter(
      (item) =>
        item.succeeded &&
        item.mode === "trash" &&
        isSafeRestorableResultId(item.trashEntryId) &&
        executedItemStillWithinRestoreWindow(item.expiresAt, result.executedAt, now)
    )
    .map((item) => item.trashEntryId)
    .filter((id): id is string => typeof id === "string");
}

export function restorableRegistryBackupIds(result: CleanupExecuteResult, now = Date.now()): string[] {
  return result.removedItems
    .filter(
      (item) =>
        item.succeeded &&
        item.mode === "trash" &&
        isSafeRestorableResultId(item.registryBackupId) &&
        executedItemStillWithinRestoreWindow(item.expiresAt, result.executedAt, now)
    )
    .map((item) => item.registryBackupId)
    .filter((id): id is string => typeof id === "string");
}

export function preservedRegistryBackupIds(result: CleanupExecuteResult, now = Date.now()): string[] {
  return result.skippedItems
    .filter(
      (item) =>
        item.reason === "execute-failed" &&
        isSafeRestorableResultId(item.registryBackupId) &&
        executedItemStillWithinRestoreWindow(item.expiresAt, result.executedAt, now)
    )
    .map((item) => item.registryBackupId)
    .filter((id): id is string => typeof id === "string");
}

export function recoverableRegistryBackupIds(result: CleanupExecuteResult, now = Date.now()): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [
    ...restorableRegistryBackupIds(result, now),
    ...preservedRegistryBackupIds(result, now)
  ]) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function restorableStartupDisabledIds(result: CleanupExecuteResult, now = Date.now()): string[] {
  return result.removedItems
    .filter(
      (item) =>
        item.succeeded &&
        item.mode === "trash" &&
        isSafeRestorableResultId(item.startupDisabledId) &&
        executedItemStillWithinRestoreWindow(item.expiresAt, result.executedAt, now)
    )
    .map((item) => item.startupDisabledId)
    .filter((id): id is string => typeof id === "string");
}

type IntegrityStatusSource = { integrityStatus?: "verified" | "changed" | "legacy" } | null | undefined;

function isChangedBlockedRestore(
  message: string,
  entry: IntegrityStatusSource
): boolean {
  return entry?.integrityStatus === "changed" || message.includes("바뀐 것 같");
}

function isLegacyBlockedRestore(
  message: string,
  entry: IntegrityStatusSource
): boolean {
  return entry?.integrityStatus === "legacy" || message.includes("복구 기록");
}

export function summarizeTrashRestoreResults(
  results: CleanupTrashRestoreResult[]
): string {
  const restored = results.filter((item) => item.status === "restored").length;
  const blocked = results.filter((item) => item.status === "target-exists").length;
  const notFound = results.filter((item) => item.status === "not-found").length;
  const expired = results.filter((item) => item.status === "expired").length;
  const changedStoredItem = results.filter(
    (item) => item.status === "blocked-path" && isChangedBlockedRestore(item.message, item.entry)
  ).length;
  const legacyStoredItem = results.filter(
    (item) => item.status === "blocked-path" && isLegacyBlockedRestore(item.message, item.entry)
  ).length;
  const unsafePath = results.filter(
    (item) =>
      item.status === "blocked-path" &&
      !isChangedBlockedRestore(item.message, item.entry) &&
      !isLegacyBlockedRestore(item.message, item.entry)
  ).length;
  const missingStoredItem = results.filter((item) => item.status === "missing-stored-item").length;
  const restoreFailed = results.filter((item) => item.status === "restore-failed").length;
  const parts: string[] = [];

  if (restored > 0) parts.push(`${restored}개를 원래 위치로 되돌렸어요.`);
  if (blocked > 0) parts.push(`${blocked}개는 원래 위치에 같은 이름이 있어 멈췄어요.`);
  if (notFound > 0) parts.push(`${notFound}개는 복구함에서 찾지 못했어요.`);
  if (expired > 0) parts.push(`${expired}개는 30일 보관 기간이 지나 되돌릴 수 없어요.`);
  if (changedStoredItem > 0) {
    parts.push(`${changedStoredItem}개는 복구함 안의 파일이 바뀐 것 같아 되돌리지 않았어요.`);
  }
  if (legacyStoredItem > 0) {
    parts.push(`${legacyStoredItem}개는 복구 기록이 오래되어 자동으로 되돌리지 않았어요.`);
  }
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
  const expired = results.filter((item) => item.status === "expired").length;
  const changedBackups = results.filter(
    (item) => item.status === "blocked-path" && isChangedBlockedRestore(item.message, item.entry)
  );
  const changedAppBackups = changedBackups.filter((item) => !isStartupRegistryBackup(item.entry)).length;
  const changedStartupBackups = changedBackups.filter((item) => isStartupRegistryBackup(item.entry)).length;
  const legacyBackups = results.filter(
    (item) => item.status === "blocked-path" && isLegacyBlockedRestore(item.message, item.entry)
  );
  const legacyAppBackups = legacyBackups.filter((item) => !isStartupRegistryBackup(item.entry)).length;
  const legacyStartupBackups = legacyBackups.filter((item) => isStartupRegistryBackup(item.entry)).length;
  const unsafePath = results.filter(
    (item) =>
      item.status === "blocked-path" &&
      !isChangedBlockedRestore(item.message, item.entry) &&
      !isLegacyBlockedRestore(item.message, item.entry)
  ).length;
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
  if (expired > 0) parts.push(`${expired}개는 30일 보관 기간이 지나 되돌릴 수 없어요.`);
  if (missingBackup > 0) parts.push(`${missingBackup}개는 백업 파일을 찾지 못했어요.`);
  if (changedAppBackups > 0) {
    parts.push(`앱 삭제 흔적 백업 ${changedAppBackups}개는 백업 파일이 바뀐 것 같아 되돌리지 않았어요.`);
  }
  if (changedStartupBackups > 0) {
    parts.push(`시작 항목 백업 ${changedStartupBackups}개는 백업 파일이 바뀐 것 같아 되돌리지 않았어요.`);
  }
  if (legacyAppBackups > 0) {
    parts.push(`앱 삭제 흔적 백업 ${legacyAppBackups}개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요.`);
  }
  if (legacyStartupBackups > 0) {
    parts.push(`시작 항목 백업 ${legacyStartupBackups}개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요.`);
  }
  if (unsafePath > 0) parts.push(`${unsafePath}개는 안전 확인이 필요해 멈췄어요.`);
  if (restoreFailed > 0) parts.push(`${restoreFailed}개는 되돌리는 중 문제가 생겼어요.`);

  return parts.length > 0 ? parts.join(" ") : "";
}

export function summarizeStartupFolderRestoreResults(
  results: StartupFolderToggleResult[]
): string {
  const restored = results.filter((item) => item.status === "restored").length;
  const notFound = results.filter((item) => item.status === "not-found").length;
  const expired = results.filter((item) => item.status === "expired").length;
  const targetExists = results.filter((item) => item.status === "target-exists").length;
  const missingStored = results.filter((item) => item.status === "missing-stored-item").length;
  const changed = results.filter(
    (item) => item.status === "blocked-path" && isChangedBlockedRestore(item.message, item.entry)
  ).length;
  const legacy = results.filter(
    (item) => item.status === "blocked-path" && isLegacyBlockedRestore(item.message, item.entry)
  ).length;
  const unsafe = results.filter(
    (item) =>
      item.status === "blocked-path" &&
      !isChangedBlockedRestore(item.message, item.entry) &&
      !isLegacyBlockedRestore(item.message, item.entry)
  ).length;
  const failed = results.filter((item) => item.status === "failed").length;
  const windowsOnly = results.filter((item) => item.status === "windows-only").length;
  const parts: string[] = [];

  if (restored > 0) parts.push(`시작 항목 ${restored}개를 되돌렸어요.`);
  if (notFound > 0) parts.push(`${notFound}개는 시작 항목 보관함에서 찾지 못했어요.`);
  if (expired > 0) parts.push(`${expired}개는 30일 보관 기간이 지나 되돌릴 수 없어요.`);
  if (targetExists > 0) parts.push(`${targetExists}개는 원래 위치에 같은 이름이 있어 멈췄어요.`);
  if (missingStored > 0) parts.push(`${missingStored}개는 보관된 시작 항목 파일을 찾지 못했어요.`);
  if (changed > 0) {
    parts.push(`시작 항목 ${changed}개는 보관 파일이 바뀐 것 같아 되돌리지 않았어요.`);
  }
  if (legacy > 0) {
    parts.push(`시작 항목 ${legacy}개는 보관 기록이 오래되어 자동으로 되돌리지 않았어요.`);
  }
  if (unsafe > 0) parts.push(`${unsafe}개는 안전 확인이 필요해 멈췄어요.`);
  if (failed > 0) parts.push(`${failed}개는 되돌리는 중 문제가 생겼어요.`);
  if (windowsOnly > 0) parts.push(`${windowsOnly}개는 Windows 앱에서 다시 시도해주세요.`);

  return parts.length > 0 ? parts.join(" ") : "";
}

export function summarizeRestoreAllResults(
  trashResults: CleanupTrashRestoreResult[],
  registryResults: RegistryBackupRestoreResult[],
  unexpectedFailureCount = 0,
  startupResults: StartupFolderToggleResult[] = []
): string {
  const parts = [
    trashResults.length > 0 ? summarizeTrashRestoreResults(trashResults) : "",
    summarizeRegistryBackupRestoreResults(registryResults),
    summarizeStartupFolderRestoreResults(startupResults),
    unexpectedFailureCount > 0
      ? `${unexpectedFailureCount}개는 연결 문제로 되돌리지 못했어요.`
      : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "되돌린 항목이 없어요.";
}
