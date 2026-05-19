import { describe, expect, it } from "vitest";
import {
  daysUntilTrashExpiry,
  restorableRegistryBackupIds,
  restorableTrashEntryIds,
  summarizeRegistryBackupRestoreResults,
  summarizeTrashRestoreResults,
  trashExpirySummary
} from "../src/shared/cleanup-result";
import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  RegistryBackupRestoreResult
} from "../src/shared/types";

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
        itemId: "ok-registry",
        path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes",
        sizeBytes: 0,
        categoryId: "app-leftovers",
        mode: "trash",
        succeeded: true,
        registryBackupId: "registry-ok"
      },
      {
        itemId: "failed-registry",
        path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Broken Notes",
        sizeBytes: 0,
        categoryId: "app-leftovers",
        mode: "trash",
        succeeded: false,
        registryBackupId: "registry-fail"
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

  it("returns only successful registry backup ids for immediate undo", () => {
    expect(restorableRegistryBackupIds(resultWithEntries())).toEqual(["registry-ok"]);
  });

  it("summarizes recent restore outcomes in friendly Korean", () => {
    const results: CleanupTrashRestoreResult[] = [
      { entryId: "a", status: "restored", message: "ok" },
      { entryId: "b", status: "target-exists", message: "blocked" },
      { entryId: "c", status: "not-found", message: "missing" }
    ];

    expect(summarizeTrashRestoreResults(results)).toBe(
      "1개를 원래 위치로 되돌렸어요. 1개는 원래 위치에 같은 이름이 있어 멈췄어요. 1개는 이미 없거나 되돌리지 못했어요."
    );
  });

  it("summarizes registry backup restore outcomes in friendly Korean", () => {
    const results: RegistryBackupRestoreResult[] = [
      { backupId: "a", status: "restored", message: "ok" },
      { backupId: "b", status: "missing-backup", message: "missing" },
      { backupId: "c", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeRegistryBackupRestoreResults(results)).toBe(
      "레지스트리 백업 1개를 되돌렸어요. 2개는 이미 없거나 확인이 필요해요."
    );
  });

  it("calculates friendly 30-day trash expiry windows", () => {
    const now = Date.parse("2026-05-19T00:00:00.000Z");
    const entries = [
      { expiresAt: "2026-05-19T00:00:00.000Z" },
      { expiresAt: "2026-05-21T00:00:00.000Z" },
      { expiresAt: "2026-05-29T00:00:00.000Z" }
    ] as CleanupTrashEntry[];

    expect(daysUntilTrashExpiry(entries[0].expiresAt, now)).toBe(0);
    expect(daysUntilTrashExpiry(entries[1].expiresAt, now)).toBe(2);
    expect(trashExpirySummary(entries, now)).toEqual({
      nextExpiryDays: 0,
      expiringSoonCount: 2,
      todayCount: 1
    });
  });

  it("returns an empty expiry summary for an empty trash bin", () => {
    expect(trashExpirySummary([], Date.parse("2026-05-19T00:00:00.000Z"))).toEqual({
      nextExpiryDays: null,
      expiringSoonCount: 0,
      todayCount: 0
    });
  });
});
