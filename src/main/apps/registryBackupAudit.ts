import type { RegistryBackupPurgeResult } from "@shared/types";
import { appendAuditEntry } from "../audit/log";
import { purgeExpiredRegistryBackups } from "./registryCleanup";

export type RegistryBackupPurgeAuditTrigger =
  | "startup"
  | "app-leftovers"
  | "registry-list"
  | "registry-restore"
  | "manual";

export async function purgeExpiredRegistryBackupsWithAudit(options: {
  userDataDir: string;
  trigger: RegistryBackupPurgeAuditTrigger;
  now?: () => Date;
}): Promise<RegistryBackupPurgeResult> {
  const now = options.now?.() ?? new Date();
  const result = await purgeExpiredRegistryBackups({
    userDataDir: options.userDataDir,
    now: () => now,
    pruneNonRestorable: true
  });

  if (result.purgedCount === 0) return result;

  await appendAuditEntry(
    options.userDataDir,
    {
      category: "cleanup",
      action: `registry-backup-expired-purge-${options.trigger}`,
      summary: `30일이 지난 앱 삭제 흔적 백업 ${result.purgedCount}개를 영구 정리했어요.`,
      detail: {
        ...result,
        trigger: options.trigger
      }
    },
    now
  ).catch(() => {});

  return result;
}
