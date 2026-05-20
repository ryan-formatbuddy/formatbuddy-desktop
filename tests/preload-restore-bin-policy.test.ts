import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PRELOAD = join(__dirname, "..", "src", "preload", "index.ts");
const IPC = join(__dirname, "..", "src", "shared", "ipc.ts");

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
    expect(preloadSource).not.toContain("purgeExpiredCleanupTrash");
    expect(preloadSource).not.toContain("cleanupTrashPurgeExpired");
    expect(ipcSource).not.toContain("cleanupTrashPurgeExpired");
  });
});
