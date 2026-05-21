import type { ScheduledTaskBackupPurgeResult } from "@shared/types";
import { appendAuditEntry } from "../audit/log";
import { purgeExpiredScheduledTaskBackups } from "./scheduledTaskBackup";

export type ScheduledTaskBackupPurgeAuditTrigger =
  | "startup"
  | "scheduled"
  | "cleanup-plan"
  | "cleanup-execute"
  | "app-leftovers"
  | "scheduled-task-list"
  | "scheduled-task-restore";

export async function purgeExpiredScheduledTaskBackupsWithAudit(options: {
  userDataDir: string;
  trigger: ScheduledTaskBackupPurgeAuditTrigger;
  now?: () => Date;
  removeEntryDir?: Parameters<typeof purgeExpiredScheduledTaskBackups>[0]["removeEntryDir"];
}): Promise<ScheduledTaskBackupPurgeResult> {
  const now = options.now?.() ?? new Date();
  const result = await purgeExpiredScheduledTaskBackups({
    userDataDir: options.userDataDir,
    now: () => now,
    pruneNonRestorable: true,
    removeEntryDir: options.removeEntryDir
  });

  const failedCount = result.failedIds?.length ?? 0;
  if (result.purgedCount === 0 && failedCount === 0) return result;

  if (result.purgedCount > 0) {
    await appendAuditEntry(
      options.userDataDir,
      {
        category: "cleanup",
        action: `scheduled-task-backup-expired-purge-${options.trigger}`,
        summary: `30일이 지난 예약 작업 백업 ${result.purgedCount}개를 자동으로 비웠어요.`,
        detail: {
          ...result,
          trigger: options.trigger
        }
      },
      now
    ).catch(() => {});
  }

  if (failedCount > 0) {
    await appendAuditEntry(
      options.userDataDir,
      {
        category: "cleanup",
        action: `scheduled-task-backup-expired-purge-failed-${options.trigger}`,
        summary: `30일이 지난 예약 작업 백업 ${failedCount}개를 아직 비우지 못했어요.`,
        detail: {
          ...result,
          trigger: options.trigger
        }
      },
      now
    ).catch(() => {});
  }

  return result;
}
