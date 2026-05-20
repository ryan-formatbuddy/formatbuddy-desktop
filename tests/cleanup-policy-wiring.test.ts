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
        'const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length',
        cleanupStartIndex
      )
    ).toBeGreaterThan(cleanupStartIndex);
    expect(
      source.indexOf(
        'const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length',
        cleanupStartIndex
      )
    ).toBeGreaterThan(cleanupStartIndex);
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
    expect(source.indexOf("notSelectedCount,", cleanupAuditIndex)).toBeGreaterThan(cleanupAuditIndex);
  });

  it("normalizes restore IPC requests before reading ids", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("normalizeCleanupTrashRestoreRequest(request)");
    expect(source).toContain("normalizeRegistryBackupRestoreRequest(request)");
    expect(source).toContain("normalizeStartupFolderRestoreRequest(request)");
    expect(source).toContain("entryId: safeRequest.entryId");
    expect(source).toContain("backupId: safeRequest.backupId");
    expect(source).toContain("disabledId: safeRequest.disabledId");
  });

  it("normalizes startup restore requests before creating restore points", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    const policyIndex = source.indexOf("const safeRequest = normalizeStartupFolderRestoreRequest(request)");
    const restorePointIndex = source.indexOf('await maybeCreateRestorePoint("시작 항목 되돌리기")');
    const restoreIndex = source.indexOf("restoreStartupFolderEntry({", policyIndex);
    expect(policyIndex).toBeGreaterThanOrEqual(0);
    expect(restorePointIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    expect(policyIndex).toBeLessThan(restorePointIndex);
    expect(policyIndex).toBeLessThan(restoreIndex);
    expect(source.indexOf("disabledId: safeRequest.disabledId", restoreIndex)).toBeGreaterThan(restoreIndex);
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

  it("purges all 30-day restore bins before app leftovers cleanup runs", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    const policyIndex = source.indexOf("const safeLeftoversRequest = enforceAppLeftoversCleanupPolicy(request)");
    const trashPurgeIndex = source.indexOf("purgeExpiredTrashWithAudit({", policyIndex);
    const registryPurgeIndex = source.indexOf("purgeExpiredRegistryBackupsWithAudit({", policyIndex);
    const startupPurgeIndex = source.indexOf("purgeExpiredStartupFolderEntriesWithAudit({", policyIndex);
    const currentInstallGuardIndex = source.indexOf("probeInstalledAppsForLeftoverGuard()", policyIndex);
    const cleanupIndex = source.indexOf("cleanupAppLeftovers(safeLeftoversRequest", policyIndex);

    expect(policyIndex).toBeGreaterThanOrEqual(0);
    expect(trashPurgeIndex).toBeGreaterThan(policyIndex);
    expect(registryPurgeIndex).toBeGreaterThan(trashPurgeIndex);
    expect(startupPurgeIndex).toBeGreaterThan(registryPurgeIndex);
    expect(currentInstallGuardIndex).toBeGreaterThan(startupPurgeIndex);
    expect(cleanupIndex).toBeGreaterThan(currentInstallGuardIndex);
    expect(source.indexOf('trigger: "app-leftovers"', trashPurgeIndex)).toBeGreaterThan(trashPurgeIndex);
    expect(source.indexOf('trigger: "app-leftovers"', registryPurgeIndex)).toBeGreaterThan(registryPurgeIndex);
    expect(source.indexOf('trigger: "app-leftovers"', startupPurgeIndex)).toBeGreaterThan(startupPurgeIndex);
    expect(source).toContain("currentInstalledAppsKnown: currentInstalledAppsProbe.known");
    expect(source).toContain("cleanup-trash:purge-before-app-leftovers failed");
    expect(source).toContain("startup-disabled:purge-before-app-leftovers failed");
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
        "const startupDisabledIds = restorableStartupDisabledIds(result)",
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(
      source.indexOf(
        "const removedCount = trashEntryIds.length + registryBackupIds.length + startupDisabledIds.length",
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(
      source.indexOf(
        'const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length',
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(
      source.indexOf(
        'const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length',
        appLeftoversIndex
      )
    ).toBeGreaterThan(appLeftoversIndex);
    expect(source.indexOf("removedCount,", appLeftoversIndex)).toBeGreaterThan(appLeftoversIndex);
    expect(source.indexOf("notSelectedCount,", appLeftoversIndex)).toBeGreaterThan(appLeftoversIndex);
    expect(source.indexOf("startupDisabledIds", appLeftoversIndex)).toBeGreaterThan(appLeftoversIndex);
  });

  it("runs the 30-day restore-bin purge on startup and on a scheduled loop", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("RETENTION_PURGE_INTERVAL_MS");
    expect(source).toContain("runAppRetentionPurgeTick(\"startup\")");
    expect(source).toContain("runAppRetentionPurgeTick(\"scheduled\")");
    expect(source).toContain("reconcileRetentionPurgeTimer()");
    expect(source).toContain("clearInterval(retentionPurgeTimer)");
  });

  it("uses the unified 30-day restore-bin purge for the manual purge IPC", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    const handlerIndex = source.indexOf("IpcChannels.cleanupTrashPurgeExpired");
    const unifiedPurgeIndex = source.indexOf("function runAppRetentionPurgeTick");
    expect(handlerIndex).toBeGreaterThanOrEqual(0);
    expect(unifiedPurgeIndex).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("Promise<RestoreBinPurgeResult>", handlerIndex)).toBeGreaterThan(handlerIndex);
    expect(source.indexOf('runAppRetentionPurgeTick("manual")', handlerIndex)).toBeGreaterThan(handlerIndex);
    expect(source.indexOf("purgeExpiredTrashWithAudit({", unifiedPurgeIndex)).toBeGreaterThan(unifiedPurgeIndex);
    expect(source.indexOf("purgeExpiredRegistryBackupsWithAudit({", unifiedPurgeIndex)).toBeGreaterThan(unifiedPurgeIndex);
    expect(source.indexOf("purgeExpiredStartupFolderEntriesWithAudit({", unifiedPurgeIndex)).toBeGreaterThan(unifiedPurgeIndex);
  });

  it("passes startup traces into app leftover planning", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("const startupEntries = await listStartupAuto");
    expect(source).toContain("apps:leftovers startup traces unavailable");
    expect(source).toContain("startupEntries");
  });
});
