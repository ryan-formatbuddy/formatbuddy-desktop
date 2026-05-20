import type { StartupDisabledPurgeResult } from "@shared/types";
import { appendAuditEntry } from "../audit/log";
import {
  purgeExpiredStartupFolderEntries,
  type StartupFolderToggleRuntime
} from "./folderToggle";

export type StartupDisabledPurgeAuditTrigger =
  | "startup"
  | "scheduled"
  | "app-leftovers"
  | "startup-list"
  | "startup-restore";

export async function purgeExpiredStartupFolderEntriesWithAudit(
  options: StartupFolderToggleRuntime & {
    trigger: StartupDisabledPurgeAuditTrigger;
    removeEntryDir?: Parameters<typeof purgeExpiredStartupFolderEntries>[0]["removeEntryDir"];
  }
): Promise<StartupDisabledPurgeResult> {
  const now = options.now?.() ?? new Date();
  const result = await purgeExpiredStartupFolderEntries({
    ...options,
    now: () => now
  });

  const failedCount = result.failedIds?.length ?? 0;
  if (result.purgedCount === 0 && failedCount === 0) return result;

  if (result.purgedCount > 0) {
    await appendAuditEntry(
      options.userDataDir,
      {
        category: "cleanup",
        action: `startup-disabled-expired-purge-${options.trigger}`,
        summary: `30일이 지난 잠시 꺼둔 시작 항목 ${result.purgedCount}개를 자동으로 비웠어요.`,
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
        action: `startup-disabled-expired-purge-failed-${options.trigger}`,
        summary: `30일이 지난 잠시 꺼둔 시작 항목 ${failedCount}개를 아직 비우지 못했어요.`,
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
