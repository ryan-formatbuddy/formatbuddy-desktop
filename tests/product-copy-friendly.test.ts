import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENDERER_ROOT = join(__dirname, "..", "src", "renderer", "src");

const USER_FACING_FILES = [
  "App.tsx",
  "pages/AuditLog.tsx",
  "pages/AppManager.tsx",
  "pages/Cleanup.tsx",
  "pages/Permissions.tsx",
  "pages/SecurityCenter.tsx",
  "pages/StartupAuto.tsx",
  "pages/TrashRestore.tsx"
];

describe("product copy friendliness", () => {
  it("keeps developer plumbing terms out of user-facing screens", () => {
    const source = USER_FACING_FILES.map((file) =>
      readFileSync(join(RENDERER_ROOT, file), "utf8")
    ).join("\n");

    expect(source).not.toContain("Electron 브리지");
    expect(source).not.toContain("Plan ID");
    expect(source).not.toContain("Blocklist 버전");
    expect(source).not.toContain("PowerShell을 다시 돌리지");
    expect(source).not.toContain("레지스트리 하이브");
  });
});
