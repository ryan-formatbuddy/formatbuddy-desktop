import { describe, expect, it } from "vitest";
import {
  appLeftoverEffectLines,
  appLeftoverRestorableCount,
  appLeftoverRestoreBinBreakdown,
  appLeftoverResultHeadline,
  appLeftoverResultLines,
  appLeftoverSkippedPreviewLines,
  friendlyAppLeftoverBlockedDetail
} from "../src/renderer/src/pages/appManagerResultCopy";
import type { AppLeftoversSnapshot, CleanupExecuteResult } from "../src/shared/types";

const EXECUTED_AT = "2026-05-21T00:00:00.000Z";
const EXPIRES_AT = "2026-06-10T00:00:00.000Z";
const NOW = Date.parse("2026-05-22T00:00:00.000Z");

function cleanupResult(overrides: Partial<CleanupExecuteResult> = {}): CleanupExecuteResult {
  return {
    planId: "plan-1",
    executedAt: EXECUTED_AT,
    mode: "trash",
    totalFreedBytes: 0,
    removedItems: [],
    skippedItems: [],
    logEntry: {
      id: "log-1",
      executedAt: EXECUTED_AT,
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

function afterSnapshot(): AppLeftoversSnapshot {
  return {
    planId: "after-plan",
    confirmationToken: "after-token",
    generatedAt: "2026-05-21T00:02:00.000Z",
    groups: [
      {
        appName: "Still Installed",
        source: "installed",
        paths: [{ id: "installed", path: "C:\\ProgramData\\Still", exists: true }]
      },
      {
        appName: "Protected",
        source: "uninstall-launched",
        cleanupState: "removed-confirmed",
        paths: [
          {
            id: "protected",
            path: "C:\\Users\\Ryan\\AppData\\Roaming\\KakaoTalk",
            exists: true,
            protectedBy: "KakaoTalk"
          }
        ]
      },
      {
        appName: "Manual",
        source: "uninstall-launched",
        cleanupState: "removed-confirmed",
        paths: [
          {
            id: "manual",
            kind: "startup-entry",
            startupEntryKind: "scheduled-task",
            path: "작업 스케줄러: Manual",
            exists: true,
            protectedBy: "서비스·예약 작업은 수동 확인이 필요해요."
          }
        ]
      }
    ]
  };
}

describe("app manager result copy", () => {
  it("summarizes every restorable app-leftover channel in friendly Korean", () => {
    const result = cleanupResult({
      removedItems: [
        {
          itemId: "file-1",
          path: "C:\\Users\\Ryan\\AppData\\Roaming\\Acme",
          sizeBytes: 10,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          trashEntryId: "trash-1",
          expiresAt: EXPIRES_AT
        },
        {
          itemId: "reg-1",
          path: "HKCU\\Software\\Acme",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: "reg-1",
          expiresAt: EXPIRES_AT
        },
        {
          itemId: "startup-1",
          path: "Startup\\Acme.lnk",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "startup-1",
          expiresAt: EXPIRES_AT
        },
        {
          itemId: "task-1",
          path: "작업 스케줄러: Acme",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          scheduledTaskBackupId: "task-1",
          expiresAt: EXPIRES_AT
        },
        {
          itemId: "failed-1",
          path: "C:\\ProgramData\\Busy",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: false,
          error: "busy"
        }
      ],
      skippedItems: [
        {
          itemId: "not-selected",
          path: "C:\\ProgramData\\Left",
          reason: "not-selected"
        }
      ]
    });

    expect(appLeftoverRestorableCount(result, NOW)).toBe(4);
    expect(appLeftoverResultHeadline(result, NOW)).toBe(
      "4개를 정리했고, 4개는 30일 안에 되돌릴 수 있어요."
    );
    expect(appLeftoverResultLines(result, NOW)).toEqual([
      "잔여 파일/폴더 1개는 복구함에 30일 동안 보관해요.",
      "앱 연결 흔적과 Windows 연결 흔적 백업 1개는 30일 안에 되돌릴 수 있어요.",
      "잠시 꺼둔 시작 항목 1개는 30일 안에 되돌릴 수 있어요.",
      "예약 작업 1개는 30일 안에 되돌릴 수 있어요.",
      "건드리지 않은 항목 1개는 그대로 뒀어요.",
      "선택하지 않은 후보 1개는 그대로 남겨뒀어요."
    ]);
    expect(appLeftoverRestoreBinBreakdown(result, NOW).map((row) => `${row.label}:${row.count}`)).toEqual([
      "파일·폴더:1",
      "앱·Windows 연결 흔적:1",
      "시작 항목:1",
      "예약 작업:1"
    ]);
  });

  it("shows preserved backup copy when cleanup could not finish but the backup is recoverable", () => {
    const result = cleanupResult({
      skippedItems: [
        {
          itemId: "reg-preserved",
          path: "HKCU\\Software\\Acme",
          reason: "execute-failed",
          registryBackupId: "reg-preserved",
          expiresAt: EXPIRES_AT
        },
        {
          itemId: "task-preserved",
          path: "작업 스케줄러: Acme",
          reason: "execute-failed",
          scheduledTaskBackupId: "task-preserved",
          expiresAt: EXPIRES_AT
        }
      ]
    });

    expect(appLeftoverResultHeadline(result, NOW)).toBe(
      "정리 확인을 끝내지 못했지만 백업 2개는 30일 안에 되돌릴 수 있어요."
    );
    expect(appLeftoverSkippedPreviewLines(result)).toEqual([
      {
        path: "HKCU\\Software\\Acme",
        message: "정리 확인을 끝내지 못했지만 백업은 30일 복구함에 남겨뒀어요."
      },
      {
        path: "작업 스케줄러: Acme",
        message: "정리 중 문제가 생겨서 그대로 뒀어요. 다시 점검 후 한 번 더 시도해주세요."
      }
    ]);
  });

  it("compares leftover candidates before and after cleanup with remaining reasons", () => {
    const lines = appLeftoverEffectLines({
      beforeSummary: {
        total: 7,
        selectable: 3,
        protected: 1,
        missing: 0,
        installedLocked: 1,
        notChecked: 1,
        manualCheck: 1
      },
      afterSnapshot: afterSnapshot()
    });

    expect(lines).toEqual([
      "정리 전 후보 7개 → 지금 후보 3개",
      "이번 정리로 후보 4개가 줄었어요.",
      "남은 후보: 아직 설치된 앱 데이터 1개 · 보호된 항목 1개 · 수동 확인 항목 1개"
    ]);
  });

  it("keeps raw internal cleanup details out of skipped-item copy", () => {
    expect(friendlyAppLeftoverBlockedDetail("C:\\Users\\Ryan\\AppData\\Local\\Temp")).toBe(
      "보호가 필요한 항목이라 그대로 뒀어요."
    );
    expect(friendlyAppLeftoverBlockedDetail(`Power${"Shell"} ENOENT`)).toBe(
      "보호가 필요한 항목이라 그대로 뒀어요."
    );
    expect(friendlyAppLeftoverBlockedDetail("permission denied")).toBe(
      "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요."
    );
  });

  it("caps skipped previews and sends the rest to Activity Log", () => {
    const result = cleanupResult({
      skippedItems: Array.from({ length: 6 }, (_, index) => ({
        itemId: `skip-${index}`,
        path: `C:\\Left\\${index}`,
        reason: "access-denied" as const
      }))
    });

    expect(appLeftoverSkippedPreviewLines(result)).toEqual([
      { path: "C:\\Left\\0", message: "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요." },
      { path: "C:\\Left\\1", message: "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요." },
      { path: "C:\\Left\\2", message: "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요." },
      { path: "C:\\Left\\3", message: "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요." },
      { path: "추가 확인", message: "2개는 활동 기록에서 이어서 볼 수 있어요." }
    ]);
  });
});
