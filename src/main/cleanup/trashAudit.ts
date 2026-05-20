import type { CleanupTrashPurgeResult } from "@shared/types";
import { appendAuditEntry } from "../audit/log";
import { purgeExpiredTrash, type TrashRuntimeOptions } from "./trash";

export type TrashPurgeAuditTrigger =
  | "startup"
  | "scheduled"
  | "cleanup-plan"
  | "app-leftovers"
  | "trash-list"
  | "restore"
  | "manual";

export async function purgeExpiredTrashWithAudit(
  options: TrashRuntimeOptions & { trigger: TrashPurgeAuditTrigger }
): Promise<CleanupTrashPurgeResult> {
  const now = options.now?.() ?? new Date();
  const result = await purgeExpiredTrash({
    ...options,
    now: () => now
  });

  const failedCount = result.failedEntryIds?.length ?? 0;
  if (result.purgedCount === 0 && failedCount === 0) return result;

  if (result.purgedCount > 0) {
    await appendAuditEntry(
      options.userDataDir,
      {
        category: "cleanup",
        action: `trash-expired-purge-${options.trigger}`,
        summary: `30일이 지난 복구함 항목 ${result.purgedCount}개를 자동으로 비웠어요.`,
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
        action: `trash-expired-purge-failed-${options.trigger}`,
        summary: `30일이 지난 복구함 항목 ${failedCount}개를 아직 비우지 못했어요.`,
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
