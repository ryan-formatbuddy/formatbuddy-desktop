import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENDERER_ROOT = join(__dirname, "..", "src", "renderer", "src");
const APP_TSX = join(RENDERER_ROOT, "App.tsx");
const APP_MANAGER_TSX = join(RENDERER_ROOT, "pages", "AppManager.tsx");

describe("AppManager uninstall verification flow", () => {
  it("routes the post-uninstall scan back to app cleanup instead of the report page", () => {
    const source = readFileSync(APP_TSX, "utf8");

    expect(source).toContain("scanThenOpenApps");
    expect(source).toContain("afterScanTargetRef");
    expect(source).toContain("autoOpenLeftovers: true");
    expect(source).toContain("onVerifyUninstall={() => void scanThenOpenApps()}");
  });

  it("auto-opens leftover candidates when returning from uninstall verification", () => {
    const source = readFileSync(APP_MANAGER_TSX, "utf8");

    expect(source).toContain("autoOpenLeftovers");
    expect(source).toContain("autoOpenedLeftoversRef");
    expect(source).toContain("제거 확인하기");
    expect(source).toContain("제거 확인이 끝나면 남은 항목을 바로 보여드려요");
  });
});
