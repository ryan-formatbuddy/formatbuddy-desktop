import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("cleanup policy wiring", () => {
  it("enforces the product cleanup policy before executing cleanup", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("enforceProductCleanupPolicy");
    expect(source).toContain("const safeRequest = enforceProductCleanupPolicy(request)");
    expect(source).toContain("executeCleanup(safeRequest");
  });

  it("records product cleanup as a 30-day restore-bin action only", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).not.toContain("permanent-delete");
    expect(source).not.toContain("영구 삭제했어요");
    expect(source).toContain('action: "trash"');
    expect(source).toContain("포맷버디 복구함으로");
    expect(source).toContain("30일 뒤 자동으로 비워요");
  });

  it("logs only restorable cleanup trash ids in audit details", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    const cleanupStartIndex = source.indexOf("const result = await executeCleanup(safeRequest");
    const cleanupAuditIndex = source.indexOf('action: "trash"');
    expect(cleanupStartIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupAuditIndex).toBeGreaterThanOrEqual(0);
    expect(
      source.indexOf("const trashEntryIds = restorableTrashEntryIds(result)", cleanupStartIndex)
    ).toBeGreaterThan(cleanupStartIndex);
    expect(source.indexOf("const removedCount = trashEntryIds.length", cleanupStartIndex)).toBeGreaterThan(
      cleanupStartIndex
    );
    expect(
      source.indexOf(
        "summary: `포맷버디 복구함으로 ${removedCount}개 항목",
        cleanupAuditIndex
      )
    ).toBeGreaterThan(cleanupAuditIndex);
    expect(
      source.indexOf("trashEntryIds,", cleanupAuditIndex)
    ).toBeGreaterThan(cleanupAuditIndex);
    expect(source.indexOf("removedCount,", cleanupAuditIndex)).toBeGreaterThan(cleanupAuditIndex);
  });

  it("normalizes restore IPC requests before reading ids", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("normalizeCleanupTrashRestoreRequest(request)");
    expect(source).toContain("normalizeRegistryBackupRestoreRequest(request)");
    expect(source).toContain("entryId: safeRequest.entryId");
    expect(source).toContain("backupId: safeRequest.backupId");
  });

  it("enforces the app leftovers cleanup policy before creating restore points", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("enforceAppLeftoversCleanupPolicy");
    expect(source).toContain(
      "const safeLeftoversRequest = enforceAppLeftoversCleanupPolicy(request)"
    );
    expect(source).toContain("cleanupAppLeftovers(safeLeftoversRequest");

    const policyIndex = source.indexOf("const safeLeftoversRequest = enforceAppLeftoversCleanupPolicy(request)");
    const restoreIndex = source.indexOf('await maybeCreateRestorePoint("앱 잔여 폴더 정리")');
    expect(policyIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    expect(policyIndex).toBeLessThan(restoreIndex);
  });

  it("logs only restorable app leftover ids in audit details", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    const appLeftoversIndex = source.indexOf("cleanupAppLeftovers(safeLeftoversRequest");
    expect(appLeftoversIndex).toBeGreaterThanOrEqual(0);
    expect(
      source.indexOf("const trashEntryIds = restorableTrashEntryIds(result)", appLeftoversIndex)
    ).toBeGreaterThan(appLeftoversIndex);
    expect(
      source.indexOf(
        "const registryBackupIds = restorableRegistryBackupIds(result)",
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(
      source.indexOf(
        "const removedCount = trashEntryIds.length + registryBackupIds.length",
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(source.indexOf("removedCount,", appLeftoversIndex)).toBeGreaterThan(appLeftoversIndex);
  });

  it("runs the 30-day restore-bin purge on startup and on a scheduled loop", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("RETENTION_PURGE_INTERVAL_MS");
    expect(source).toContain("runAppRetentionPurgeTick(\"startup\")");
    expect(source).toContain("runAppRetentionPurgeTick(\"scheduled\")");
    expect(source).toContain("reconcileRetentionPurgeTimer()");
    expect(source).toContain("clearInterval(retentionPurgeTimer)");
  });

  it("passes startup traces into app leftover planning", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("const startupEntries = await listStartupAuto");
    expect(source).toContain("apps:leftovers startup traces unavailable");
    expect(source).toContain("startupEntries");
  });
});
