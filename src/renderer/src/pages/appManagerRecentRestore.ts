import {
  recoverableRegistryBackupIds,
  recoverableScheduledTaskBackupIds,
  restorableStartupDisabledIds,
  restorableTrashEntryIds,
  summarizeRestoreAllResults
} from "@shared/cleanup-result";
import type {
  CleanupExecuteResult,
  CleanupTrashRestoreResult,
  RegistryBackupRestoreResult,
  ScheduledTaskBackupRestoreResult,
  StartupFolderToggleResult
} from "@shared/types";

export const APP_RECENT_RESTORE_EMPTY_MESSAGE = "이 정리에서 바로 되돌릴 항목이 없어요.";

export const APP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE =
  "방금 정리 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 복구함이나 활동 기록에서 확인해주세요.";

export type AppRecentRestorePlan = {
  entryIds: string[];
  registryBackupIds: string[];
  startupDisabledIds: string[];
  scheduledTaskBackupIds: string[];
};

export type AppRecentRestoreBridgeAvailability = {
  restoreCleanupTrash: boolean;
  restoreRegistryBackup: boolean;
  restoreStartupAuto: boolean;
  restoreScheduledTaskBackup: boolean;
};

export type AppRecentRestoreOutcome = {
  trashResults: CleanupTrashRestoreResult[];
  registryResults: RegistryBackupRestoreResult[];
  unexpectedFailureCount: number;
  startupResults: StartupFolderToggleResult[];
  scheduledTaskResults: ScheduledTaskBackupRestoreResult[];
};

export function appRecentRestorePlan(
  result: CleanupExecuteResult,
  now = Date.now()
): AppRecentRestorePlan {
  return {
    entryIds: restorableTrashEntryIds(result, now),
    registryBackupIds: recoverableRegistryBackupIds(result, now),
    startupDisabledIds: restorableStartupDisabledIds(result, now),
    scheduledTaskBackupIds: recoverableScheduledTaskBackupIds(result, now)
  };
}

export function appRecentRestorePlanCount(plan: AppRecentRestorePlan): number {
  return (
    plan.entryIds.length +
    plan.registryBackupIds.length +
    plan.startupDisabledIds.length +
    plan.scheduledTaskBackupIds.length
  );
}

export function appRecentRestoreMissingBridge(
  plan: AppRecentRestorePlan,
  bridge: AppRecentRestoreBridgeAvailability
): boolean {
  return (
    (plan.entryIds.length > 0 && !bridge.restoreCleanupTrash) ||
    (plan.registryBackupIds.length > 0 && !bridge.restoreRegistryBackup) ||
    (plan.startupDisabledIds.length > 0 && !bridge.restoreStartupAuto) ||
    (plan.scheduledTaskBackupIds.length > 0 && !bridge.restoreScheduledTaskBackup)
  );
}

export function appRecentRestoreSummary({
  trashResults,
  registryResults,
  unexpectedFailureCount,
  startupResults,
  scheduledTaskResults
}: AppRecentRestoreOutcome): string {
  return summarizeRestoreAllResults(
    trashResults,
    registryResults,
    unexpectedFailureCount,
    startupResults,
    scheduledTaskResults
  );
}
