import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED_TYPES = join(__dirname, "..", "src", "shared", "types.ts");

describe("cleanup type contract", () => {
  it("keeps product cleanup requests limited to the 30-day restore bin", () => {
    const source = readFileSync(SHARED_TYPES, "utf8");

    expect(source).toContain('export type CleanupProductExecuteMode = "trash"');
    expect(source).toContain('export type CleanupExecuteMode = CleanupProductExecuteMode | "permanent"');
    expect(source).toContain("mode: CleanupProductExecuteMode");
    expect(source).toContain("Product cleanup always routes through FormatBuddy's 30-day restore bin.");
  });

  it("exposes one purge result shape for every 30-day restore-bin bucket", () => {
    const source = readFileSync(SHARED_TYPES, "utf8");

    expect(source).toContain("export interface RestoreBinPurgeResult");
    expect(source).toContain("export interface CleanupTrashPurgedItem");
    expect(source).toContain("purgedItems?: CleanupTrashPurgedItem[]");
    expect(source).toContain("export interface RegistryBackupPurgedItem");
    expect(source).toContain("purgedItems?: RegistryBackupPurgedItem[]");
    expect(source).toContain("export interface StartupDisabledPurgedItem");
    expect(source).toContain("purgedItems?: StartupDisabledPurgedItem[]");
    expect(source).toContain("export interface ScheduledTaskBackupPurgedItem");
    expect(source).toContain("purgedItems?: ScheduledTaskBackupPurgedItem[]");
    expect(source).toContain("trash?: CleanupTrashPurgeResult");
    expect(source).toContain("registryBackups?: RegistryBackupPurgeResult");
    expect(source).toContain("startupDisabled?: StartupDisabledPurgeResult");
    expect(source).toContain("scheduledTaskBackups?: ScheduledTaskBackupPurgeResult");
    expect(source).toContain('| "scheduled-task-backups"');
  });
});
