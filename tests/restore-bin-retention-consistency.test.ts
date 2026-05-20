import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGISTRY_BACKUP_RETENTION_DAYS } from "../src/main/apps/registryCleanup";
import { FORMATBUDDY_TRASH_RETENTION_DAYS } from "../src/main/cleanup/trash";
import { STARTUP_DISABLED_RETENTION_DAYS } from "../src/main/startup/folderToggle";
import { RESTORE_BIN_RETENTION_DAYS } from "../src/shared/retention";

const ROOT = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("restore-bin retention consistency", () => {
  it("keeps every restorable cleanup bucket on the same 30-day window", () => {
    expect(RESTORE_BIN_RETENTION_DAYS).toBe(30);
    expect(FORMATBUDDY_TRASH_RETENTION_DAYS).toBe(RESTORE_BIN_RETENTION_DAYS);
    expect(REGISTRY_BACKUP_RETENTION_DAYS).toBe(RESTORE_BIN_RETENTION_DAYS);
    expect(STARTUP_DISABLED_RETENTION_DAYS).toBe(RESTORE_BIN_RETENTION_DAYS);
  });

  it("wires the three retention constants to the shared product promise", () => {
    expect(read("src/main/cleanup/trash.ts")).toContain(
      "FORMATBUDDY_TRASH_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS"
    );
    expect(read("src/main/apps/registryCleanup.ts")).toContain(
      "REGISTRY_BACKUP_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS"
    );
    expect(read("src/main/startup/folderToggle.ts")).toContain(
      "STARTUP_DISABLED_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS"
    );
  });

  it("does not reintroduce the old 60-day restore-bin promise in product surfaces", () => {
    const productSurfaces = [
      "README.md",
      "docs/FAQ.md",
      "docs/PRIVACY_POLICY.md",
      "docs/TERMS_OF_SERVICE.md",
      "docs/tone-guide.md",
      "src/renderer/src/pages/Cleanup.tsx",
      "src/renderer/src/pages/TrashRestore.tsx",
      "src/renderer/src/pages/AppManager.tsx",
      "src/renderer/src/pages/StartupAuto.tsx",
      "src/renderer/src/pages/Permissions.tsx",
      "src/shared/copy.ts"
    ];

    for (const relativePath of productSurfaces) {
      expect(read(relativePath), relativePath).not.toMatch(/60\s*일|60-day|60day|sixty days/i);
    }
  });
});
