import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../src/shared/types";
import {
  auditActionLabel,
  auditDetailLines,
  auditRestoreBinAutoEmptySummary,
  isAuditWarning,
  isRestoreBinAuditEntry
} from "../src/renderer/src/pages/auditLogFormat";

function auditEntry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: "entry-1",
    at: "2026-05-21T00:00:00.000Z",
    category: "cleanup",
    action: "trash-expired-purge-app-leftovers",
    summary: "30일이 지난 복구함 항목 1개를 자동으로 비웠어요.",
    ...overrides
  };
}

describe("audit log formatting", () => {
  it("shows app leftover auto-empty records with readable app names", () => {
    const lines = auditDetailLines({
      purgedCount: 4,
      purgedBytes: 5 * 1024 * 1024,
      purgedItems: [
        { label: "Acme Notes", categoryId: "app-leftovers", sizeBytes: 1 },
        { label: "Acme Notes", categoryId: "app-leftovers", sizeBytes: 1 },
        { label: "  Old   Sync\tCache  ", categoryId: "app-leftovers", sizeBytes: 1 },
        { label: "\u0000Printer Helper", categoryId: "app-leftovers", sizeBytes: 1 },
        { label: "Video Tool Cache", categoryId: "app-leftovers", sizeBytes: 1 }
      ]
    });

    expect(lines).toContain("비운 항목 4개");
    expect(lines).toContain("자동 비운 항목 Acme Notes, Old Sync Cache, Printer Helper 외 1개");
    expect(lines).toContain("확보한 공간 5 MB");
    expect(lines.join("\n")).not.toContain("\u0000");
  });

  it("uses friendly labels for app-leftover cleanup and 30-day auto-empty states", () => {
    expect(auditActionLabel(auditEntry({ action: "app-leftovers-trash" }))).toBe("앱 잔여 정리");
    expect(auditActionLabel(auditEntry({ action: "trash-expired-purge-app-leftovers" }))).toBe(
      "30일 자동 비움"
    );
    expect(auditActionLabel(auditEntry({ action: "trash-expired-purge-failed-app-leftovers" }))).toBe(
      "30일 자동 비움 확인"
    );
  });

  it("keeps restore-bin guidance tied to recorded restorable app cleanup entries", () => {
    expect(
      isRestoreBinAuditEntry(
        auditEntry({
          action: "app-leftovers-trash",
          detail: {
            trashEntryIds: ["trash-1"],
            registryBackupIds: ["registry-1"]
          }
        })
      )
    ).toBe(true);

    expect(
      isRestoreBinAuditEntry(
        auditEntry({
          action: "app-leftovers-trash",
          detail: {
            skippedCount: 2
          }
        })
      )
    ).toBe(false);
  });

  it("summarizes auto-empty counts and marks incomplete buckets as needing attention", () => {
    const failed = auditEntry({
      id: "entry-failed",
      at: "2026-05-21T00:01:00.000Z",
      action: "trash-expired-purge-failed-app-leftovers",
      summary: "30일이 지난 복구함 항목 1개를 아직 비우지 못했어요.",
      detail: {
        failedEntryIds: ["busy-entry"],
        failedBucketCount: 1
      }
    });
    const purged = auditEntry({
      id: "entry-purged",
      at: "2026-05-21T00:00:00.000Z",
      detail: {
        purgedCount: 2,
        purgedBytes: 10 * 1024 * 1024
      }
    });

    expect(isAuditWarning(failed)).toBe(true);
    expect(auditRestoreBinAutoEmptySummary([failed, purged])).toEqual({
      entryCount: 2,
      purgedCount: 2,
      failedCount: 2,
      purgedBytes: 10 * 1024 * 1024,
      latestAt: failed.at
    });
  });
});
