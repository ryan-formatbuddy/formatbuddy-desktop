import { describe, expect, it } from "vitest";
import {
  daysUntilTrashExpiry,
  earliestRestoreBinExpiryAt,
  isTrashEntryExpired,
  preservedRegistryBackupIds,
  preservedScheduledTaskBackupIds,
  recoverableRegistryBackupIds,
  recoverableScheduledTaskBackupIds,
  restoreEntryExpiryLabel,
  restoreBinExpiryInsight,
  restorableRegistryBackupIds,
  registryBackupKindLabel,
  registryBackupRestoreButtonLabel,
  restorableScheduledTaskBackupIds,
  restorableTrashEntryIds,
  restorableStartupDisabledIds,
  sortTrashEntriesByExpiry,
  summarizeRegistryBackupRestoreResults,
  summarizeRestoreAllResults,
  summarizeStartupFolderRestoreResults,
  summarizeTrashRestoreResults,
  trashExpirySummary
} from "../src/shared/cleanup-result";
import type {
  CleanupExecuteResult,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  RegistryBackupEntry,
  RegistryBackupRestoreResult,
  ScheduledTaskBackupRestoreResult,
  StartupAutoDisabledEntry,
  StartupFolderToggleResult
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
        trashEntryId: "trash-ok",
        expiresAt: "2026-06-18T00:00:00.000Z"
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
        registryBackupId: "registry-ok",
        expiresAt: "2026-06-18T00:00:00.000Z"
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
      notSelectedCount: 0,
      categories: []
    }
  };
}

describe("restore bin expiry helpers", () => {
  it("finds the earliest automatic-empty date across every restore-bin bucket", () => {
    expect(
      earliestRestoreBinExpiryAt([
        {
          nextExpiryAt: "2026-06-18T00:00:00.000Z",
          entries: [{ expiresAt: "2026-06-19T00:00:00.000Z" }]
        },
        {
          nextExpiryAt: "2026-06-10T00:00:00.000Z",
          entries: [{ expiresAt: "2026-06-12T00:00:00.000Z" }]
        },
        {
          entries: [{ expiresAt: "2026-06-05T00:00:00.000Z" }]
        },
        {
          nextExpiryAt: "not-a-date",
          entries: [{ expiresAt: "2026-06-08T00:00:00.000Z" }]
        }
      ])
    ).toBe("2026-06-05T00:00:00.000Z");
  });

  it("ignores missing and malformed restore-bin expiry values", () => {
    expect(
      earliestRestoreBinExpiryAt([
        undefined,
        null,
        { nextExpiryAt: "not-a-date", entries: [{ expiresAt: "also-bad" }, {}] }
      ])
    ).toBeUndefined();
  });
});

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
  const startupDisabledEntry = (
    overrides: Partial<StartupAutoDisabledEntry>
  ): StartupAutoDisabledEntry => ({
    id: overrides.id ?? "startup-disabled",
    entryId: overrides.entryId ?? "startup-entry",
    name: overrides.name ?? "Acme Helper.lnk",
    originalPath:
      overrides.originalPath ?? "C:\\Users\\Ryan\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Acme Helper.lnk",
    storedPath:
      overrides.storedPath ?? "C:\\Users\\Ryan\\AppData\\Roaming\\FormatBuddy\\startup-disabled\\Acme Helper.lnk",
    sizeBytes: overrides.sizeBytes ?? 12,
    origin: overrides.origin ?? "Startup",
    disabledAt: overrides.disabledAt ?? "2026-05-19T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-06-18T00:00:00.000Z",
    ...overrides
  });

  it("returns only successful 30-day trash entry ids", () => {
    expect(restorableTrashEntryIds(resultWithEntries())).toEqual(["trash-ok"]);
  });

  it("returns only successful registry backup ids for immediate undo", () => {
    expect(restorableRegistryBackupIds(resultWithEntries())).toEqual(["registry-ok"]);
  });

  it("returns only successful scheduled task backup ids for immediate undo", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      removedItems: [
        {
          itemId: "scheduled-task-ok",
          path: "Task Scheduler: Acme Update",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          scheduledTaskBackupId: "scheduled-task-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "scheduled-task-failed",
          path: "Task Scheduler: Broken Update",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: false,
          scheduledTaskBackupId: "scheduled-task-failed",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "scheduled-task-unsafe",
          path: "Task Scheduler: Unsafe Update",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          scheduledTaskBackupId: "scheduled/task-unsafe",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ]
    };

    expect(restorableScheduledTaskBackupIds(result, now)).toEqual(["scheduled-task-ok"]);
  });

  it("returns preserved scheduled task backup ids when cleanup could not confirm deletion", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      removedItems: [
        {
          itemId: "scheduled-task-success",
          path: "Task Scheduler: Acme Update",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          scheduledTaskBackupId: "scheduled-task-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ],
      skippedItems: [
        {
          itemId: "same-preserved-scheduled-task",
          path: "Task Scheduler: Acme Update",
          reason: "execute-failed",
          scheduledTaskBackupId: "scheduled-task-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "preserved-scheduled-task",
          path: "Task Scheduler: Acme Helper",
          reason: "execute-failed",
          scheduledTaskBackupId: "preserved-scheduled-task-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "unsafe-preserved-scheduled-task",
          path: "Task Scheduler: Unsafe Helper",
          reason: "execute-failed",
          scheduledTaskBackupId: "preserved/scheduled-task-bad",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ]
    };

    expect(preservedScheduledTaskBackupIds(result, now)).toEqual([
      "scheduled-task-ok",
      "preserved-scheduled-task-ok"
    ]);
    expect(recoverableScheduledTaskBackupIds(result, now)).toEqual([
      "scheduled-task-ok",
      "preserved-scheduled-task-ok"
    ]);
  });

  it("returns safe preserved registry backup ids from skipped cleanup items", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      skippedItems: [
        {
          itemId: "preserved-registry",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes",
          reason: "execute-failed",
          registryBackupId: "preserved-registry-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "unsafe-preserved-registry",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Unsafe",
          reason: "execute-failed",
          registryBackupId: "../unsafe",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "expired-preserved-registry",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Expired",
          reason: "execute-failed",
          registryBackupId: "expired-registry-ok",
          expiresAt: "2026-05-19T00:00:00.000Z"
        }
      ]
    };

    expect(preservedRegistryBackupIds(result, now)).toEqual(["preserved-registry-ok"]);
    expect(restorableRegistryBackupIds(result, now)).toEqual(["registry-ok"]);
  });

  it("deduplicates recoverable registry backup ids across successful and preserved entries", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      skippedItems: [
        {
          itemId: "same-registry-backup",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes",
          reason: "execute-failed",
          registryBackupId: "registry-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "preserved-registry-backup",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Helper",
          reason: "execute-failed",
          registryBackupId: "preserved-registry-ok",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ]
    };

    expect(recoverableRegistryBackupIds(result, now)).toEqual([
      "registry-ok",
      "preserved-registry-ok"
    ]);
  });

  it("deduplicates immediate undo handles before the renderer calls restore", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      removedItems: [
        {
          itemId: "trash-a",
          path: "C:\\Temp\\a.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          mode: "trash",
          succeeded: true,
          trashEntryId: "same-trash-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "trash-b",
          path: "C:\\Temp\\b.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          mode: "trash",
          succeeded: true,
          trashEntryId: "same-trash-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "registry-a",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: "same-registry-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "registry-b",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: "same-registry-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "startup-a",
          path: "C:\\Users\\Ryan\\Startup\\Acme.lnk",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "same-startup-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "startup-b",
          path: "C:\\Users\\Ryan\\Startup\\Acme.lnk",
          sizeBytes: 0,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "same-startup-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ],
      skippedItems: [
        {
          itemId: "preserved-registry-a",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
          reason: "execute-failed",
          registryBackupId: "same-preserved-registry-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "preserved-registry-b",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
          reason: "execute-failed",
          registryBackupId: "same-preserved-registry-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      ]
    };

    expect(restorableTrashEntryIds(result, now)).toEqual(["same-trash-id"]);
    expect(restorableRegistryBackupIds(result, now)).toEqual(["same-registry-id"]);
    expect(preservedRegistryBackupIds(result, now)).toEqual(["same-preserved-registry-id"]);
    expect(restorableStartupDisabledIds(result, now)).toEqual(["same-startup-id"]);
    expect(recoverableRegistryBackupIds(result, now)).toEqual([
      "same-registry-id",
      "same-preserved-registry-id"
    ]);
  });

  it("returns only safe startup disabled ids for immediate undo", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      ...resultWithEntries(),
      removedItems: [
        {
          itemId: "safe-startup",
          path: "C:\\Users\\Ryan\\Startup\\Acme.lnk",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "safe-startup-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "unsafe-startup",
          path: "C:\\Users\\Ryan\\Startup\\Unsafe.lnk",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "../unsafe-startup-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "expired-startup",
          path: "C:\\Users\\Ryan\\Startup\\Expired.lnk",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "expired-startup-id",
          expiresAt: "2026-05-19T00:00:00.000Z"
        }
      ]
    };

    expect(restorableStartupDisabledIds(result, now)).toEqual(["safe-startup-id"]);
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

  it("summarizes changed restore-bin files as a specific check-needed reason", () => {
    const results: CleanupTrashRestoreResult[] = [
      {
        entryId: "a",
        status: "blocked-path",
        message: "복구함 안의 파일이 바뀐 것 같아요",
        entry: {
          id: "a",
          itemId: "temp-a",
          originalPath: "C:\\Temp\\a.tmp",
          storedPath: "C:\\FormatBuddy\\trash\\a.tmp",
          label: "a.tmp",
          categoryId: "temp-user",
          sizeBytes: 10,
          integrityStatus: "changed",
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      },
      { entryId: "b", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeTrashRestoreResults(results)).toBe(
      "1개는 복구함 안의 파일이 바뀐 것 같아 되돌리지 않았어요. 1개는 안전 확인이 필요해 멈췄어요."
    );
  });

  it("summarizes legacy restore-bin files as a specific check-needed reason", () => {
    const results: CleanupTrashRestoreResult[] = [
      {
        entryId: "a",
        status: "blocked-path",
        message: "복구 기록을 확인할 수 없어요",
        entry: {
          id: "a",
          itemId: "temp-a",
          originalPath: "C:\\Temp\\a.tmp",
          storedPath: "C:\\FormatBuddy\\trash\\a.tmp",
          label: "a.tmp",
          categoryId: "temp-user",
          sizeBytes: 10,
          integrityStatus: "legacy",
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        }
      },
      { entryId: "b", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeTrashRestoreResults(results)).toBe(
      "1개는 복구 기록이 오래되어 자동으로 되돌리지 않았어요. 1개는 안전 확인이 필요해 멈췄어요."
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

  it("summarizes changed registry backups by backup kind", () => {
    const results: RegistryBackupRestoreResult[] = [
      {
        backupId: "a",
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 파일이 바뀐 것 같아요",
        entry: registryBackupEntry({ backupKind: "key", integrityStatus: "changed" })
      },
      {
        backupId: "b",
        status: "blocked-path",
        message: "시작 항목 백업 파일이 바뀐 것 같아요",
        entry: registryBackupEntry({ backupKind: "startup-value", integrityStatus: "changed" })
      },
      { backupId: "c", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeRegistryBackupRestoreResults(results)).toBe(
      "앱 삭제 흔적 백업 1개는 백업 파일이 바뀐 것 같아 되돌리지 않았어요. 시작 항목 백업 1개는 백업 파일이 바뀐 것 같아 되돌리지 않았어요. 1개는 안전 확인이 필요해 멈췄어요."
    );
  });

  it("summarizes legacy registry backups by backup kind", () => {
    const results: RegistryBackupRestoreResult[] = [
      {
        backupId: "a",
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 기록을 확인할 수 없어요",
        entry: registryBackupEntry({ backupKind: "key", integrityStatus: "legacy" })
      },
      {
        backupId: "b",
        status: "blocked-path",
        message: "시작 항목 백업 기록을 확인할 수 없어요",
        entry: registryBackupEntry({ backupKind: "startup-value", integrityStatus: "legacy" })
      },
      { backupId: "c", status: "blocked-path", message: "blocked" }
    ];

    expect(summarizeRegistryBackupRestoreResults(results)).toBe(
      "앱 삭제 흔적 백업 1개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요. 시작 항목 백업 1개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요. 1개는 안전 확인이 필요해 멈췄어요."
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

  it("summarizes disabled startup restore outcomes in the central restore bin tone", () => {
    const results: StartupFolderToggleResult[] = [
      { status: "restored", message: "ok", entry: startupDisabledEntry({ id: "a" }) },
      { status: "target-exists", message: "already there", entry: startupDisabledEntry({ id: "b" }) },
      {
        status: "blocked-path",
        message: "보관 파일이 바뀐 것 같아요",
        entry: startupDisabledEntry({ id: "c", integrityStatus: "changed" })
      },
      {
        status: "blocked-path",
        message: "복구 기록을 확인할 수 없어요",
        entry: startupDisabledEntry({ id: "d", integrityStatus: "legacy" })
      },
      { status: "windows-only", message: "Windows only" }
    ];

    expect(summarizeStartupFolderRestoreResults(results)).toBe(
      "시작 항목 1개를 되돌렸어요. 1개는 원래 위치에 같은 이름이 있어 멈췄어요. 시작 항목 1개는 보관 파일이 바뀐 것 같아 되돌리지 않았어요. 시작 항목 1개는 보관 기록이 오래되어 자동으로 되돌리지 않았어요. 1개는 Windows 앱에서 다시 시도해주세요."
    );
  });

  it("includes disabled startup results in restore-all summaries", () => {
    const startupResults: StartupFolderToggleResult[] = [
      { status: "restored", message: "ok", entry: startupDisabledEntry({ id: "a" }) }
    ];

    expect(summarizeRestoreAllResults([], [], 0, startupResults)).toBe(
      "시작 항목 1개를 되돌렸어요."
    );
  });

  it("includes scheduled task backup results in restore-all summaries", () => {
    const scheduledTaskResults: ScheduledTaskBackupRestoreResult[] = [
      { backupId: "scheduled-task-a", status: "restored", message: "ok" }
    ];

    expect(summarizeRestoreAllResults([], [], 0, [], scheduledTaskResults)).toBe(
      "예약 작업 1개를 되돌렸어요."
    );
  });

  it("labels startup value backups without exposing registry jargon", () => {
    expect(registryBackupKindLabel({ backupKind: "key" })).toBe("앱 삭제 흔적 백업");
    expect(registryBackupKindLabel({ backupKind: "startup-value" })).toBe("시작 항목 백업");
    expect(registryBackupKindLabel({ backupKind: "registered-app-value" })).toBe("기본 앱 목록 백업");
    expect(registryBackupKindLabel({ backupKind: "app-capabilities-key" })).toBe(
      "기본 앱 기능 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "environment-path-value" })).toBe(
      "PATH 경로 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "firewall-rule-value" })).toBe(
      "방화벽 규칙 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "context-menu-key" })).toBe("우클릭 메뉴 백업");
    expect(registryBackupKindLabel({ backupKind: "file-association-key" })).toBe(
      "파일 형식 연결 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "shell-extension-key" })).toBe("우클릭 확장 백업");
    expect(registryBackupKindLabel({ backupKind: "protocol-handler-key" })).toBe(
      "프로토콜 연결 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "native-messaging-host-key" })).toBe(
      "브라우저 연결 도우미 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "com-local-server-key" })).toBe(
      "앱 실행 연결 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "com-app-id-key" })).toBe(
      "앱 실행 연결 정보 백업"
    );
    expect(registryBackupKindLabel({ backupKind: "service-key" })).toBe("서비스 백업");
    expect(registryBackupRestoreButtonLabel({ backupKind: "key" })).toBe("앱 흔적 되돌리기");
    expect(registryBackupRestoreButtonLabel({ backupKind: "startup-value" })).toBe(
      "시작 항목 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "registered-app-value" })).toBe(
      "기본 앱 목록 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "app-capabilities-key" })).toBe(
      "기본 앱 기능 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "environment-path-value" })).toBe(
      "PATH 경로 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "firewall-rule-value" })).toBe(
      "방화벽 규칙 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "context-menu-key" })).toBe(
      "우클릭 메뉴 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "file-association-key" })).toBe(
      "파일 형식 연결 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "shell-extension-key" })).toBe(
      "우클릭 확장 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "protocol-handler-key" })).toBe(
      "프로토콜 연결 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "native-messaging-host-key" })).toBe(
      "브라우저 연결 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "com-local-server-key" })).toBe(
      "앱 실행 연결 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "com-app-id-key" })).toBe(
      "앱 실행 연결 정보 되돌리기"
    );
    expect(registryBackupRestoreButtonLabel({ backupKind: "service-key" })).toBe("서비스 되돌리기");
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

  it("builds restore-bin expiry insight copy from actual expiry dates", () => {
    const now = Date.parse("2026-05-19T00:00:00.000Z");

    expect(
      restoreBinExpiryInsight(
        [
          { expiresAt: "2026-05-18T23:59:59.000Z" },
          { expiresAt: "2026-05-21T00:00:00.000Z" },
          { expiresAt: "2026-05-29T00:00:00.000Z" }
        ],
        now
      )
    ).toEqual({
      tone: "urgent",
      message: "보관 기간이 지난 항목 1개, 3일 안에 보관 기간이 끝나는 항목 1개가 있어요.",
      detail: "필요한 항목은 오래된 것부터 먼저 확인해 주세요."
    });

    expect(
      restoreBinExpiryInsight([{ expiresAt: "2026-05-22T00:00:00.000Z" }], now)
    ).toEqual({
      tone: "urgent",
      message: "1개가 3일 안에 보관 기간이 끝나요.",
      detail: "필요하면 지금 원래 자리로 되돌려 주세요."
    });

    expect(
      restoreBinExpiryInsight([{ expiresAt: "2026-05-29T00:00:00.000Z" }], now)
    ).toEqual({
      tone: "calm",
      message: "가장 가까운 항목은 10일 뒤에 보관 기간이 끝나요.",
      detail: "정리한 항목은 오래된 순서로 먼저 보여드려요."
    });

    expect(restoreBinExpiryInsight([], now)).toBeNull();
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

  it("treats malformed restore-bin expiry data as expired in summaries and ordering", () => {
    const now = Date.parse("2026-05-19T00:00:00.000Z");
    const entries = [
      {
        id: "fresh",
        expiresAt: "2026-05-21T00:00:00.000Z",
        createdAt: "2026-05-18T00:00:00.000Z"
      },
      {
        id: "bad-expiry",
        expiresAt: "not-a-date",
        createdAt: "2026-05-18T00:00:00.000Z"
      }
    ] as CleanupTrashEntry[];

    expect(trashExpirySummary(entries, now)).toEqual({
      nextExpiryDays: 0,
      expiringSoonCount: 2,
      todayCount: 1
    });
    expect(sortTrashEntriesByExpiry(entries).map((entry) => entry.id)).toEqual([
      "bad-expiry",
      "fresh"
    ]);
  });

  it("omits expired entries from recent restore helpers when expiry data is present", () => {
    const now = Date.parse("2026-06-18T00:00:01.000Z");
    const result: CleanupExecuteResult = {
      planId: "plan-expiry",
      executedAt: "2026-05-20T00:00:00.000Z",
      mode: "trash",
      totalFreedBytes: 4,
      skippedItems: [],
      logEntry: {
        id: "log-expiry",
        executedAt: "2026-05-20T00:00:00.000Z",
        mode: "trash",
        totalFreedBytes: 4,
        removedCount: 4,
        skippedCount: 0,
        notSelectedCount: 0,
        categories: []
      },
      removedItems: [
        {
          itemId: "expired-file",
          path: "C:\\Temp\\expired-file.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "expired-file",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "fresh-file",
          path: "C:\\Temp\\fresh-file.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "fresh-file",
          expiresAt: "2026-06-19T00:00:00.000Z"
        },
        {
          itemId: "expired-registry",
          path: "HKCU\\Software\\ExpiredApp",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "expired-registry",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "fresh-registry",
          path: "HKCU\\Software\\FreshApp",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "fresh-registry",
          expiresAt: "2026-06-19T00:00:00.000Z"
        }
      ]
    };

    expect(restorableTrashEntryIds(result, now)).toEqual(["fresh-file"]);
    expect(restorableRegistryBackupIds(result, now)).toEqual(["fresh-registry"]);
    expect(restorableStartupDisabledIds(result, now)).toEqual([]);
  });

  it("omits recent restore ids with unsafe ids or expiry outside the 30-day window", () => {
    const now = Date.parse("2026-05-20T00:00:00.000Z");
    const result: CleanupExecuteResult = {
      planId: "plan-boundary",
      executedAt: "2026-05-19T00:00:00.000Z",
      mode: "trash",
      totalFreedBytes: 4,
      skippedItems: [],
      logEntry: {
        id: "log-boundary",
        executedAt: "2026-05-19T00:00:00.000Z",
        mode: "trash",
        totalFreedBytes: 4,
        removedCount: 4,
        skippedCount: 0,
        notSelectedCount: 0,
        categories: []
      },
      removedItems: [
        {
          itemId: "safe-file",
          path: "C:\\Temp\\safe.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "safe-trash-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "unsafe-file-id",
          path: "C:\\Temp\\unsafe.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "../unsafe-trash-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "too-long-file",
          path: "C:\\Temp\\too-long.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "too-long-trash-id",
          expiresAt: "2026-06-19T00:00:00.000Z"
        },
        {
          itemId: "safe-registry",
          path: "HKCU\\Software\\SafeApp",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "safe-registry-id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "unsafe-registry-id",
          path: "HKCU\\Software\\UnsafeApp",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "unsafe registry id",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        {
          itemId: "too-long-registry",
          path: "HKCU\\Software\\TooLongApp",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "too-long-registry-id",
          expiresAt: "2026-06-19T00:00:00.000Z"
        }
      ]
    };

    expect(restorableTrashEntryIds(result, now)).toEqual(["safe-trash-id"]);
    expect(restorableRegistryBackupIds(result, now)).toEqual(["safe-registry-id"]);
  });

  it("omits recent restore ids when a successful trash result is missing expiry data", () => {
    const result: CleanupExecuteResult = {
      planId: "plan-missing-expiry",
      executedAt: "2026-05-19T00:00:00.000Z",
      mode: "trash",
      totalFreedBytes: 2,
      skippedItems: [],
      logEntry: {
        id: "log-missing-expiry",
        executedAt: "2026-05-19T00:00:00.000Z",
        mode: "trash",
        totalFreedBytes: 2,
        removedCount: 2,
        skippedCount: 0,
        notSelectedCount: 0,
        categories: []
      },
      removedItems: [
        {
          itemId: "missing-file-expiry",
          path: "C:\\Temp\\missing-file-expiry.tmp",
          sizeBytes: 1,
          categoryId: "temp-user",
          succeeded: true,
          mode: "trash",
          trashEntryId: "missing-file-expiry"
        },
        {
          itemId: "missing-registry-expiry",
          path: "HKCU\\Software\\MissingExpiry",
          sizeBytes: 1,
          categoryId: "app-leftovers",
          succeeded: true,
          mode: "trash",
          registryBackupId: "missing-registry-expiry"
        }
      ]
    };

    expect(restorableTrashEntryIds(result)).toEqual([]);
    expect(restorableRegistryBackupIds(result)).toEqual([]);
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
