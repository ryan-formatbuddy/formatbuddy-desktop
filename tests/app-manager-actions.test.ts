import { describe, expect, it } from "vitest";
import { appLeftoverResultActions } from "../src/renderer/src/pages/appManagerActions";
import type { CleanupExecuteResult } from "../src/shared/types";

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

describe("appLeftoverResultActions", () => {
  it("keeps a complete post-cleanup flow when items can be restored", () => {
    const actions = appLeftoverResultActions({
      result: cleanupResult(),
      restorableCount: 3,
      restoreRecentBusy: false
    });

    expect(actions.map((action) => action.id)).toEqual([
      "rescan",
      "trashRestore",
      "restoreRecent",
      "auditLog"
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "다시 점검해서 효과 보기",
      "복구함 보기",
      "방금 정리 되돌리기",
      "활동 기록 보기"
    ]);
  });

  it("still routes to the activity log when there is nothing to restore", () => {
    const actions = appLeftoverResultActions({
      result: cleanupResult(),
      restorableCount: 0,
      restoreRecentBusy: false
    });

    expect(actions.map((action) => action.id)).toEqual(["rescan", "auditLog"]);
  });

  it("does not show the restore-bin shortcut for non-restore-bin execution modes", () => {
    const actions = appLeftoverResultActions({
      result: cleanupResult({ mode: "permanent" }),
      restorableCount: 2,
      restoreRecentBusy: false
    });

    expect(actions.map((action) => action.id)).toEqual(["rescan", "restoreRecent", "auditLog"]);
    expect(actions.map((action) => action.label)).not.toContain("복구함 보기");
  });

  it("locks only the immediate undo action while restore is running", () => {
    const actions = appLeftoverResultActions({
      result: cleanupResult(),
      restorableCount: 1,
      restoreRecentBusy: true
    });

    expect(actions.find((action) => action.id === "restoreRecent")).toMatchObject({
      label: "되돌리는 중…",
      disabled: true
    });
    const auditAction = actions.find((action) => action.id === "auditLog");
    expect(auditAction).toMatchObject({ label: "활동 기록 보기" });
    expect(auditAction?.disabled).toBeUndefined();
  });
});
