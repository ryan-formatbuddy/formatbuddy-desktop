import { describe, expect, it } from "vitest";
import { restorableTrashEntryIds } from "../src/shared/cleanup-result";
import type { CleanupExecuteResult } from "../src/shared/types";

function resultWithEntries(): CleanupExecuteResult {
  return {
    planId: "plan-1",
    executedAt: "2026-05-19T00:00:00.000Z",
    mode: "trash",
    totalFreedBytes: 300,
    removedItems: [
      {
        itemId: "ok-trash",
        path: "C:\\Temp\\ok.tmp",
        sizeBytes: 100,
        categoryId: "temp-user",
        mode: "trash",
        succeeded: true,
        trashEntryId: "trash-ok"
      },
      {
        itemId: "ok-permanent",
        path: "C:\\Temp\\gone.tmp",
        sizeBytes: 100,
        categoryId: "temp-user",
        mode: "permanent",
        succeeded: true
      },
      {
        itemId: "failed-trash",
        path: "C:\\Temp\\fail.tmp",
        sizeBytes: 100,
        categoryId: "temp-user",
        mode: "trash",
        succeeded: false,
        trashEntryId: "trash-fail"
      }
    ],
    skippedItems: [],
    logEntry: {
      id: "log-1",
      executedAt: "2026-05-19T00:00:00.000Z",
      mode: "trash",
      totalFreedBytes: 300,
      removedCount: 3,
      skippedCount: 0,
      categories: []
    }
  };
}

describe("Cleanup result undo helper", () => {
  it("returns only successful 30-day trash entry ids", () => {
    expect(restorableTrashEntryIds(resultWithEntries())).toEqual(["trash-ok"]);
  });
});
