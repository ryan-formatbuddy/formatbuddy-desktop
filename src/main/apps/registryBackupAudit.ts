import type { RegistryBackupPurgeResult } from "@shared/types";
import { appendAuditEntry } from "../audit/log";
import { purgeExpiredRegistryBackups } from "./registryCleanup";

export type RegistryBackupPurgeAuditTrigger =
  | "startup"
  | "scheduled"
  | "app-leftovers"
  | "registry-list"
  | "registry-restore";

export async function purgeExpiredRegistryBackupsWithAudit(options: {
  userDataDir: string;
  trigger: RegistryBackupPurgeAuditTrigger;
  now?: () => Date;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
}): Promise<RegistryBackupPurgeResult> {
  const now = options.now?.() ?? new Date();
  const result = await purgeExpiredRegistryBackups({
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
        action: `registry-backup-expired-purge-${options.trigger}`,
        summary: `30일이 지난 앱 삭제 흔적 백업 ${result.purgedCount}개를 자동으로 비웠어요.`,
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
        action: `registry-backup-expired-purge-failed-${options.trigger}`,
        summary: `30일이 지난 앱 삭제 흔적 백업 ${failedCount}개를 아직 비우지 못했어요.`,
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
