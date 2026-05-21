import { describe, expect, it } from "vitest";
import {
  APP_RECENT_RESTORE_EMPTY_MESSAGE,
  APP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE,
  appRecentRestoreMissingBridge,
  appRecentRestorePlan,
  appRecentRestorePlanCount,
  appRecentRestoreSummary,
  type AppRecentRestorePlan
} from "../src/renderer/src/pages/appManagerRecentRestore";
import type { CleanupExecuteResult } from "../src/shared/types";

const NOW = Date.parse("2026-05-22T00:00:00.000Z");
const EXPIRES_AT = "2026-06-10T00:00:00.000Z";

function cleanupResult(overrides: Partial<CleanupExecuteResult> = {}): CleanupExecuteResult {
  return {
    planId: "plan-1",
    executedAt: "2026-05-21T00:00:00.000Z",
    mode: "trash",
    totalFreedBytes: 0,
    removedItems: [],
    skippedItems: [],
    logEntry: {
      id: "log-1",
      executedAt: "2026-05-21T00:00:00.000Z",
      mode: "trash",
      totalFreedBytes: 0,
      removedCount: 0,
      skippedCount: 0,
      notSelectedCount: 0,
      categories: []
    },
    ...overrides
  };
}

function plan(overrides: Partial<AppRecentRestorePlan> = {}): AppRecentRestorePlan {
  return {
    entryIds: [],
    registryBackupIds: [],
    startupDisabledIds: [],
    scheduledTaskBackupIds: [],
    ...overrides
  };
}

describe("app manager recent restore", () => {
  it("collects every still-restorable channel from a cleanup result", () => {
    const restorePlan = appRecentRestorePlan(
      cleanupResult({
        removedItems: [
          {
            itemId: "file-1",
            path: "C:\\Temp\\file",
            sizeBytes: 1,
            categoryId: "app-leftovers",
            mode: "trash",
            succeeded: true,
            trashEntryId: "trash-1",
            expiresAt: EXPIRES_AT
          },
          {
            itemId: "reg-1",
            path: "HKCU\\Software\\App",
            sizeBytes: 0,
            categoryId: "app-leftovers",
            mode: "trash",
            succeeded: true,
            registryBackupId: "reg-1",
            expiresAt: EXPIRES_AT
          },
          {
            itemId: "startup-1",
            path: "Startup\\App.lnk",
            sizeBytes: 1,
            categoryId: "app-leftovers",
            mode: "trash",
            succeeded: true,
            startupDisabledId: "startup-1",
            expiresAt: EXPIRES_AT
          },
          {
            itemId: "task-1",
            path: "작업 스케줄러: App",
            sizeBytes: 0,
            categoryId: "app-leftovers",
            mode: "trash",
            succeeded: true,
            scheduledTaskBackupId: "task-1",
            expiresAt: EXPIRES_AT
          }
        ]
      }),
      NOW
    );

    expect(restorePlan).toEqual({
      entryIds: ["trash-1"],
      registryBackupIds: ["reg-1"],
      startupDisabledIds: ["startup-1"],
      scheduledTaskBackupIds: ["task-1"]
    });
    expect(appRecentRestorePlanCount(restorePlan)).toBe(4);
  });

  it("uses a friendly empty message when there is nothing to restore", () => {
    expect(appRecentRestorePlanCount(plan())).toBe(0);
    expect(APP_RECENT_RESTORE_EMPTY_MESSAGE).toBe("이 정리에서 바로 되돌릴 항목이 없어요.");
  });

  it("requires only the bridges needed by the selected restore channels", () => {
    expect(
      appRecentRestoreMissingBridge(
        plan({ registryBackupIds: ["reg-1"] }),
        {
          restoreCleanupTrash: false,
          restoreRegistryBackup: true,
          restoreStartupAuto: false,
          restoreScheduledTaskBackup: false
        }
      )
    ).toBe(false);

    expect(
      appRecentRestoreMissingBridge(
        plan({ entryIds: ["trash-1"], scheduledTaskBackupIds: ["task-1"] }),
        {
          restoreCleanupTrash: true,
          restoreRegistryBackup: true,
          restoreStartupAuto: true,
          restoreScheduledTaskBackup: false
        }
      )
    ).toBe(true);
    expect(APP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE).toContain("복구함이나 활동 기록");
  });

  it("summarizes partial restore success without hiding connection failures", () => {
    expect(
      appRecentRestoreSummary({
        trashResults: [
          { entryId: "trash-1", status: "restored", message: "ok" },
          { entryId: "trash-2", status: "target-exists", message: "already exists" }
        ],
        registryResults: [
          { backupId: "reg-1", status: "restored", message: "ok" }
        ],
        unexpectedFailureCount: 2,
        startupResults: [
          { status: "restored", message: "ok" }
        ],
        scheduledTaskResults: [
          { backupId: "task-1", status: "restored", message: "ok" }
        ]
      })
    ).toBe(
      "1개를 원래 위치로 되돌렸어요. 1개는 원래 위치에 같은 이름이 있어 멈췄어요. 앱 삭제 흔적 백업 1개를 되돌렸어요. 시작 항목 1개를 되돌렸어요. 예약 작업 1개를 되돌렸어요. 2개는 연결 문제로 되돌리지 못했어요."
    );
  });
});
