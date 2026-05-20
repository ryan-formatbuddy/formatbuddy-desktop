import { describe, expect, it } from "vitest";
import {
  daysUntilTrashExpiry,
  isTrashEntryExpired,
  restoreEntryExpiryLabel,
  restorableRegistryBackupIds,
  registryBackupKindLabel,
  registryBackupRestoreButtonLabel,
  restorableTrashEntryIds,
  sortTrashEntriesByExpiry,
  summarizeRegistryBackupRestoreResults,
  summarizeRestoreAllResults,
  summarizeTrashRestoreResults,
  trashExpirySummary
} from "../src/shared/cleanup-result";
import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  RegistryBackupEntry,
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
  const registryBackupEntry = (
    overrides: Partial<RegistryBackupEntry>
  ): RegistryBackupEntry => ({
    id: overrides.id ?? "backup",
    keyPath:
      overrides.keyPath ?? "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
    backupPath: overrides.backupPath ?? "C:\\FormatBuddy\\backup.reg",
    sizeBytes: overrides.sizeBytes ?? 10,
    createdAt: overrides.createdAt ?? "2026-05-19T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-06-18T00:00:00.000Z",
    ...overrides
  });

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
      "1개를 원래 위치로 되돌렸어요. 1개는 원래 위치에 같은 이름이 있어 멈췄어요. 1개는 복구함에서 찾지 못했어요."
    );
  });

  it("summarizes restore failures by reason instead of grouping them together", () => {
    const results: CleanupTrashRestoreResult[] = [
      { entryId: "a", status: "blocked-path", message: "blocked" },
      { entryId: "b", status: "missing-stored-item", message: "missing stored" },
      { entryId: "c", status: "restore-failed", message: "failed" },
      { entryId: "d", status: "expired", message: "expired" }
    ];

    expect(summarizeTrashRestoreResults(results)).toBe(
      "1개는 30일 보관 기간이 지나 되돌릴 수 없어요. 1개는 안전 확인이 필요해 멈췄어요. 1개는 보관된 파일을 찾지 못했어요. 1개는 되돌리는 중 문제가 생겼어요."
    );
  });

  it("summarizes registry backup restore outcomes in friendly Korean", () => {
    const results: RegistryBackupRestoreResult[] = [
      { backupId: "a", status: "restored", message: "ok", entry: registryBackupEntry({ backupKind: "key" }) },
      { backupId: "b", status: "missing-backup", message: "missing" },
      {
        backupId: "c",
        status: "restored",
        message: "ok",
        entry: registryBackupEntry({ backupKind: "startup-value" })
      },
      { backupId: "d", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeRegistryBackupRestoreResults(results)).toBe(
      "앱 삭제 흔적 백업 1개를 되돌렸어요. 시작 항목 백업 1개를 되돌렸어요. 1개는 백업 파일을 찾지 못했어요. 1개는 안전 확인이 필요해 멈췄어요."
    );
  });

  it("summarizes registry restore failures by reason without exposing registry jargon", () => {
    const results: RegistryBackupRestoreResult[] = [
      { backupId: "a", status: "not-found", message: "missing" },
      { backupId: "b", status: "missing-backup", message: "missing file" },
      { backupId: "c", status: "restore-failed", message: "failed" },
      { backupId: "d", status: "expired", message: "expired" }
    ];

    expect(summarizeRegistryBackupRestoreResults(results)).toBe(
      "1개는 백업 목록에서 찾지 못했어요. 1개는 30일 보관 기간이 지나 되돌릴 수 없어요. 1개는 백업 파일을 찾지 못했어요. 1개는 되돌리는 중 문제가 생겼어요."
    );
  });

  it("summarizes mixed restore-all outcomes without hiding per-item failures", () => {
    const trashResults: CleanupTrashRestoreResult[] = [
      { entryId: "a", status: "restored", message: "ok" },
      { entryId: "b", status: "target-exists", message: "blocked" }
    ];
    const registryResults: RegistryBackupRestoreResult[] = [
      { backupId: "c", status: "restored", message: "ok", entry: registryBackupEntry({ backupKind: "startup-value" }) }
    ];

    expect(summarizeRestoreAllResults(trashResults, registryResults, 2)).toBe(
      "1개를 원래 위치로 되돌렸어요. 1개는 원래 위치에 같은 이름이 있어 멈췄어요. 시작 항목 백업 1개를 되돌렸어요. 2개는 연결 문제로 되돌리지 못했어요."
    );
  });

  it("labels startup value backups without exposing registry jargon", () => {
    expect(registryBackupKindLabel({ backupKind: "key" })).toBe("앱 삭제 흔적 백업");
    expect(registryBackupKindLabel({ backupKind: "startup-value" })).toBe("시작 항목 백업");
    expect(registryBackupRestoreButtonLabel({ backupKind: "key" })).toBe("앱 흔적 되돌리기");
    expect(registryBackupRestoreButtonLabel({ backupKind: "startup-value" })).toBe(
      "시작 항목 되돌리기"
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

  it("labels expired restore-bin entries as no longer restorable", () => {
    const now = Date.parse("2026-06-18T00:00:01.000Z");

    expect(isTrashEntryExpired("2026-06-18T00:00:00.000Z", now)).toBe(true);
    expect(isTrashEntryExpired("2026-06-19T00:00:00.000Z", now)).toBe(false);
    expect(restoreEntryExpiryLabel("2026-06-18T00:00:00.000Z", now)).toBe(
      "보관 기간 지남"
    );
    expect(restoreEntryExpiryLabel("2026-06-19T00:00:00.000Z", now)).toBe(
      "1일 뒤 만료"
    );
  });

  it("returns an empty expiry summary for an empty trash bin", () => {
    expect(trashExpirySummary([], Date.parse("2026-05-19T00:00:00.000Z"))).toEqual({
      nextExpiryDays: null,
      expiringSoonCount: 0,
      todayCount: 0
    });
  });

  it("sorts mixed restore-bin entries by expiry before type", () => {
    const entries = [
      {
        id: "file-later",
        kind: "file",
        expiresAt: "2026-06-18T00:00:00.000Z",
        createdAt: "2026-05-19T00:00:00.000Z"
      },
      {
        id: "registry-today",
        kind: "registry",
        expiresAt: "2026-05-20T00:00:00.000Z",
        createdAt: "2026-05-19T00:01:00.000Z"
      },
      {
        id: "file-soon",
        kind: "file",
        expiresAt: "2026-05-22T00:00:00.000Z",
        createdAt: "2026-05-19T00:02:00.000Z"
      }
    ];

    expect(sortTrashEntriesByExpiry(entries).map((entry) => entry.id)).toEqual([
      "registry-today",
      "file-soon",
      "file-later"
    ]);
    expect(entries.map((entry) => entry.id)).toEqual([
      "file-later",
      "registry-today",
      "file-soon"
    ]);
  });
});
