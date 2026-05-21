import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PRELOAD = join(__dirname, "..", "src", "preload", "index.ts");
const IPC = join(__dirname, "..", "src", "shared", "ipc.ts");
const RETENTION_PURGE = join(__dirname, "..", "src", "main", "retentionPurge.ts");
const TRASH_AUDIT = join(__dirname, "..", "src", "main", "cleanup", "trashAudit.ts");
const REGISTRY_AUDIT = join(__dirname, "..", "src", "main", "apps", "registryBackupAudit.ts");
const STARTUP_AUDIT = join(__dirname, "..", "src", "main", "startup", "folderToggleAudit.ts");
const SCHEDULED_TASK_AUDIT = join(__dirname, "..", "src", "main", "startup", "scheduledTaskBackupAudit.ts");

describe("restore-bin preload policy", () => {
  it("exposes restore actions without exposing a manual empty-bin bridge", () => {
    const preloadSource = readFileSync(PRELOAD, "utf8");
    const ipcSource = readFileSync(IPC, "utf8");

    expect(preloadSource).toContain("getCleanupTrash");
    expect(preloadSource).toContain("restoreCleanupTrash");
    expect(preloadSource).toContain("getRegistryBackups");
    expect(preloadSource).toContain("restoreRegistryBackup");
    expect(preloadSource).toContain("listDisabledStartupAuto");
    expect(preloadSource).toContain("restoreStartupAuto");
    expect(preloadSource).toContain("getScheduledTaskBackups");
    expect(preloadSource).toContain("restoreScheduledTaskBackup");
    expect(preloadSource).not.toContain("purgeExpiredCleanupTrash");
    expect(preloadSource).not.toContain("cleanupTrashPurgeExpired");
    expect(ipcSource).not.toContain("cleanupTrashPurgeExpired");
  });

  it("keeps restore-bin emptying internal and never exposes a manual trigger", () => {
    const retentionSource = readFileSync(RETENTION_PURGE, "utf8");
    const auditSources = [TRASH_AUDIT, REGISTRY_AUDIT, STARTUP_AUDIT, SCHEDULED_TASK_AUDIT].map((file) =>
      readFileSync(file, "utf8")
    );

    expect(retentionSource).toContain('"startup" | "scheduled" | "cleanup-plan" | "cleanup-execute"');
    expect(retentionSource).not.toContain('"manual"');
    for (const source of auditSources) {
      expect(source).not.toContain('| "manual"');
      expect(source).not.toContain('"manual";');
    }
  });
});
