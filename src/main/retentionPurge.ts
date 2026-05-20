import type {
  CleanupTrashPurgeResult,
  RegistryBackupPurgeResult,
  RestoreBinPurgeResult,
  StartupDisabledPurgeResult
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";

export const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export type RetentionPurgeTrigger = "startup" | "scheduled" | "manual";

export interface RetentionPurgeTickDeps {
  trigger: RetentionPurgeTrigger;
  purgeTrash: (trigger: RetentionPurgeTrigger) => Promise<CleanupTrashPurgeResult>;
  purgeRegistryBackups: (trigger: RetentionPurgeTrigger) => Promise<RegistryBackupPurgeResult>;
  purgeStartupDisabled?: (trigger: RetentionPurgeTrigger) => Promise<StartupDisabledPurgeResult>;
  logInfo?: (message: string) => void;
  logWarn?: (message: string) => void;
}

export type RetentionPurgeTickResult = RestoreBinPurgeResult;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function coerceNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function coerceRetentionDays(value: unknown): number {
  const days = coerceNonNegativeInteger(value);
  return days > 0 ? days : RESTORE_BIN_RETENTION_DAYS;
}

function coerceSafeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (
      typeof item !== "string" ||
      item.length === 0 ||
      item.trim() !== item ||
      item === "." ||
      item === ".." ||
      /\s/.test(item) ||
      /[\/\\]/.test(item) ||
      /[\u0000-\u001f\u007f]/.test(item)
    ) {
      continue;
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function coerceOptionalSafeIdList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? coerceSafeIdList(value) : undefined;
}

function normalizeTrashPurgeResult(result: CleanupTrashPurgeResult): CleanupTrashPurgeResult {
  const purgedEntryIds = coerceSafeIdList(result.purgedEntryIds);
  return {
    ...result,
    purgedCount: purgedEntryIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedEntryIds,
    failedEntryIds: coerceOptionalSafeIdList(result.failedEntryIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeRegistryBackupPurgeResult(
  result: RegistryBackupPurgeResult
): RegistryBackupPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedIds,
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeStartupDisabledPurgeResult(
  result: StartupDisabledPurgeResult
): StartupDisabledPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedIds,
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function recordPartialTrashFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.trash?.failedEntryIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `파일 복구함 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "trash", message });
  deps.logWarn?.(`30일 자동 비움 파일 복구함 일부 실패: ${failedCount}개`);
}

function recordPartialRegistryBackupFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.registryBackups?.failedIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `앱 삭제 흔적 백업 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "registry-backups", message });
  deps.logWarn?.(`30일 자동 비움 앱 삭제 흔적 백업 일부 실패: ${failedCount}개`);
}

function recordPartialStartupDisabledFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.startupDisabled?.failedIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `잠시 꺼둔 시작 항목 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "startup-disabled", message });
  deps.logWarn?.(`30일 자동 비움 잠시 꺼둔 시작 항목 일부 실패: ${failedCount}개`);
}

export async function runRetentionPurgeTick(
  deps: RetentionPurgeTickDeps
): Promise<RetentionPurgeTickResult> {
  const result: RetentionPurgeTickResult = { failed: [] };

  try {
    result.trash = normalizeTrashPurgeResult(await deps.purgeTrash(deps.trigger));
    recordPartialTrashFailure(result, deps);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({ kind: "trash", message });
    deps.logWarn?.(`30일 자동 비움 파일 복구함 실패: ${message}`);
  }

  try {
    result.registryBackups = normalizeRegistryBackupPurgeResult(
      await deps.purgeRegistryBackups(deps.trigger)
    );
    recordPartialRegistryBackupFailure(result, deps);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({ kind: "registry-backups", message });
    deps.logWarn?.(`30일 자동 비움 앱 삭제 흔적 백업 실패: ${message}`);
  }

  if (deps.purgeStartupDisabled) {
    try {
      result.startupDisabled = normalizeStartupDisabledPurgeResult(
        await deps.purgeStartupDisabled(deps.trigger)
      );
      recordPartialStartupDisabledFailure(result, deps);
    } catch (err) {
      const message = errorMessage(err);
      result.failed.push({ kind: "startup-disabled", message });
      deps.logWarn?.(`30일 자동 비움 잠시 꺼둔 시작 항목 실패: ${message}`);
    }
  }

  const trashCount = result.trash?.purgedCount ?? 0;
  const registryCount = result.registryBackups?.purgedCount ?? 0;
  const startupCount = result.startupDisabled?.purgedCount ?? 0;
  if (trashCount > 0 || registryCount > 0 || startupCount > 0) {
    const summary = `파일 ${trashCount}개, 앱 삭제 흔적 백업 ${registryCount}개`;
    deps.logInfo?.(
      result.startupDisabled
        ? `30일 자동 비움: ${summary}, 잠시 꺼둔 시작 항목 ${startupCount}개`
        : `30일 자동 비움: ${summary}`
    );
  }

  return result;
}
