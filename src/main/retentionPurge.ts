import type { CleanupTrashPurgeResult, RegistryBackupPurgeResult } from "@shared/types";

export const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export type RetentionPurgeTrigger = "startup" | "scheduled";

export interface RetentionPurgeTickDeps {
  trigger: RetentionPurgeTrigger;
  purgeTrash: (trigger: RetentionPurgeTrigger) => Promise<CleanupTrashPurgeResult>;
  purgeRegistryBackups: (trigger: RetentionPurgeTrigger) => Promise<RegistryBackupPurgeResult>;
  logInfo?: (message: string) => void;
  logWarn?: (message: string) => void;
}

export interface RetentionPurgeTickResult {
  trash?: CleanupTrashPurgeResult;
  registryBackups?: RegistryBackupPurgeResult;
  failed: Array<{ kind: "trash" | "registry-backups"; message: string }>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

export async function runRetentionPurgeTick(
  deps: RetentionPurgeTickDeps
): Promise<RetentionPurgeTickResult> {
  const result: RetentionPurgeTickResult = { failed: [] };

  try {
    result.trash = await deps.purgeTrash(deps.trigger);
    recordPartialTrashFailure(result, deps);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({ kind: "trash", message });
    deps.logWarn?.(`30일 자동 비움 파일 복구함 실패: ${message}`);
  }

  try {
    result.registryBackups = await deps.purgeRegistryBackups(deps.trigger);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({ kind: "registry-backups", message });
    deps.logWarn?.(`30일 자동 비움 앱 삭제 흔적 백업 실패: ${message}`);
  }

  const trashCount = result.trash?.purgedCount ?? 0;
  const registryCount = result.registryBackups?.purgedCount ?? 0;
  if (trashCount > 0 || registryCount > 0) {
    deps.logInfo?.(
      `30일 자동 비움: 파일 ${trashCount}개, 앱 삭제 흔적 백업 ${registryCount}개`
    );
  }

  return result;
}
