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

export const CLEANUP_RECENT_RESTORE_EMPTY_MESSAGE = "이 정리에서 바로 되돌릴 항목이 없어요.";

export const CLEANUP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE =
  "방금 정리 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 복구함이나 활동 기록에서 확인해주세요.";

export const CLEANUP_RESTORE_ALL_MISSING_BRIDGE_MESSAGE =
  "모두 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.";

export type CleanupRestorePlan = {
  entryIds: string[];
  registryBackupIds: string[];
  startupDisabledIds: string[];
  scheduledTaskBackupIds: string[];
};

export type CleanupRestoreBridgeAvailability = {
  restoreCleanupTrash: boolean;
  restoreRegistryBackup: boolean;
  restoreStartupAuto: boolean;
  restoreScheduledTaskBackup: boolean;
};

export type CleanupRestoreBridgeHandlers = {
  restoreCleanupTrash?: (request: { entryId: string }) => Promise<CleanupTrashRestoreResult>;
  restoreRegistryBackup?: (request: { backupId: string }) => Promise<RegistryBackupRestoreResult>;
  restoreStartupAuto?: (request: { disabledId: string }) => Promise<StartupFolderToggleResult>;
  restoreScheduledTaskBackup?: (
    request: { backupId: string }
  ) => Promise<ScheduledTaskBackupRestoreResult>;
};

export type CleanupRestoreOutcome = {
  trashResults: CleanupTrashRestoreResult[];
  registryResults: RegistryBackupRestoreResult[];
  unexpectedFailureCount: number;
  startupResults: StartupFolderToggleResult[];
  scheduledTaskResults: ScheduledTaskBackupRestoreResult[];
};

export type CleanupRestoreListItem =
  | { kind: "file"; entry: { id: string } }
  | { kind: "registry"; entry: { id: string } }
  | { kind: "startup"; entry: { id: string } }
  | { kind: "scheduled-task"; entry: { id: string } };

export function cleanupRestorePlanFromResult(
  result: CleanupExecuteResult,
  now = Date.now()
): CleanupRestorePlan {
  return {
    entryIds: restorableTrashEntryIds(result, now),
    registryBackupIds: recoverableRegistryBackupIds(result, now),
    startupDisabledIds: restorableStartupDisabledIds(result, now),
    scheduledTaskBackupIds: recoverableScheduledTaskBackupIds(result, now)
  };
}

export function cleanupRestorePlanFromItems(
  items: readonly CleanupRestoreListItem[]
): CleanupRestorePlan {
  return {
    entryIds: items.filter((item) => item.kind === "file").map((item) => item.entry.id),
    registryBackupIds: items.filter((item) => item.kind === "registry").map((item) => item.entry.id),
    startupDisabledIds: items.filter((item) => item.kind === "startup").map((item) => item.entry.id),
    scheduledTaskBackupIds: items
      .filter((item) => item.kind === "scheduled-task")
      .map((item) => item.entry.id)
  };
}

export function cleanupRestorePlanCount(plan: CleanupRestorePlan): number {
  return (
    plan.entryIds.length +
    plan.registryBackupIds.length +
    plan.startupDisabledIds.length +
    plan.scheduledTaskBackupIds.length
  );
}

export function cleanupRestoreMissingBridge(
  plan: CleanupRestorePlan,
  bridge: CleanupRestoreBridgeAvailability
): boolean {
  return (
    (plan.entryIds.length > 0 && !bridge.restoreCleanupTrash) ||
    (plan.registryBackupIds.length > 0 && !bridge.restoreRegistryBackup) ||
    (plan.startupDisabledIds.length > 0 && !bridge.restoreStartupAuto) ||
    (plan.scheduledTaskBackupIds.length > 0 && !bridge.restoreScheduledTaskBackup)
  );
}

export async function runCleanupRestorePlan(
  plan: CleanupRestorePlan,
  handlers: CleanupRestoreBridgeHandlers
): Promise<CleanupRestoreOutcome> {
  const trashResults: CleanupTrashRestoreResult[] = [];
  const registryResults: RegistryBackupRestoreResult[] = [];
  const startupResults: StartupFolderToggleResult[] = [];
  const scheduledTaskResults: ScheduledTaskBackupRestoreResult[] = [];
  let unexpectedFailureCount = 0;

  for (const entryId of plan.entryIds) {
    try {
      const restoreCleanupTrash = handlers.restoreCleanupTrash;
      if (!restoreCleanupTrash) throw new Error("missing restoreCleanupTrash bridge");
      trashResults.push(await restoreCleanupTrash({ entryId }));
    } catch {
      unexpectedFailureCount += 1;
    }
  }

  for (const backupId of plan.registryBackupIds) {
    try {
      const restoreRegistryBackup = handlers.restoreRegistryBackup;
      if (!restoreRegistryBackup) throw new Error("missing restoreRegistryBackup bridge");
      registryResults.push(await restoreRegistryBackup({ backupId }));
    } catch {
      unexpectedFailureCount += 1;
    }
  }

  for (const disabledId of plan.startupDisabledIds) {
    try {
      const restoreStartupAuto = handlers.restoreStartupAuto;
      if (!restoreStartupAuto) throw new Error("missing restoreStartupAuto bridge");
      startupResults.push(await restoreStartupAuto({ disabledId }));
    } catch {
      unexpectedFailureCount += 1;
    }
  }

  for (const backupId of plan.scheduledTaskBackupIds) {
    try {
      const restoreScheduledTaskBackup = handlers.restoreScheduledTaskBackup;
      if (!restoreScheduledTaskBackup) throw new Error("missing restoreScheduledTaskBackup bridge");
      scheduledTaskResults.push(await restoreScheduledTaskBackup({ backupId }));
    } catch {
      unexpectedFailureCount += 1;
    }
  }

  return {
    trashResults,
    registryResults,
    unexpectedFailureCount,
    startupResults,
    scheduledTaskResults
  };
}

export function cleanupRestoreSummary({
  trashResults,
  registryResults,
  unexpectedFailureCount,
  startupResults,
  scheduledTaskResults
}: CleanupRestoreOutcome): string {
  return summarizeRestoreAllResults(
    trashResults,
    registryResults,
    unexpectedFailureCount,
    startupResults,
    scheduledTaskResults
  );
}
