import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENDERER_ROOT = join(__dirname, "..", "src", "renderer", "src");
const APP_TSX = join(RENDERER_ROOT, "App.tsx");
const APP_MANAGER_TSX = join(RENDERER_ROOT, "pages", "AppManager.tsx");
const APP_MANAGER_ACTIONS_TS = join(RENDERER_ROOT, "pages", "appManagerActions.ts");

describe("AppManager uninstall verification flow", () => {
  it("routes the post-uninstall scan back to app cleanup instead of the report page", () => {
    const source = readFileSync(APP_TSX, "utf8");

    expect(source).toContain("scanThenOpenApps");
    expect(source).toContain("afterScanTargetRef");
    expect(source).toContain("autoOpenLeftovers: true");
    expect(source).toContain("onVerifyUninstall={() => void scanThenOpenApps()}");
  });

  it("wires app-leftover cleanup effect checks to the fast rescan path", () => {
    const appSource = readFileSync(APP_TSX, "utf8");
    const managerSource = [
      readFileSync(APP_MANAGER_TSX, "utf8"),
      readFileSync(APP_MANAGER_ACTIONS_TS, "utf8")
    ].join("\n");

    expect(appSource).toContain("onQuickRescan={() => void startScan({ fast: true })}");
    expect(managerSource).toContain("onQuickRescan?: () => void");
    expect(managerSource).toContain("onQuickRescan ?? onRescan");
    expect(managerSource).toContain('id: "rescan"');
    expect(managerSource).toContain("다시 점검해서 효과 보기");
  });

  it("lets app cleanup jump to the startup review when manual traces remain", () => {
    const appSource = readFileSync(APP_TSX, "utf8");
    const managerSource = readFileSync(APP_MANAGER_TSX, "utf8");

    expect(appSource).toContain("onOpenStartupAuto={() => setPhase({ kind: \"startup\" })}");
    expect(managerSource).toContain("onOpenStartupAuto");
    expect(managerSource).toContain("시작 항목에서 확인");
  });

  it("auto-opens leftover candidates when returning from uninstall verification", () => {
    const source = readFileSync(APP_MANAGER_TSX, "utf8");

    expect(source).toContain("autoOpenLeftovers");
    expect(source).toContain("autoOpenedLeftoversRef");
    expect(source).toContain("제거 확인하기");
    expect(source).toContain("제거 확인이 끝나면 남은 항목을 바로 보여드려요");
  });
});
