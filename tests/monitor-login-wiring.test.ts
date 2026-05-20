import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("monitor launch-at-login wiring", () => {
  it("reconciles OS login startup when monitor prefs load or change", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("reconcileLaunchAtLogin(app, next");
    expect(source).toContain("reconcileLaunchAtLogin(app, prefs");
    expect(source).toContain("launchAtLoginEnabled: next.launchAtLoginEnabled");
  });

  it("reconciles Windows scheduled auto-scan when monitor prefs load or change", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("reconcileScheduledAutoScan({");
    expect(source).toContain("prefs: next");
    expect(source).toContain("prefs,");
    expect(source).toContain("shouldStartScheduledScanFromArgs()");
    expect(source).toContain("markAutoScanStarted(app.getPath(\"userData\"))");
    expect(source).toContain("IpcChannels.monitorTriggerScan");
  });

  it("does not leave the app hidden when tray-backed startup cannot be used", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("shouldStartHiddenFromArgs()");
    expect(source).toContain("!prefs.launchAtLoginEnabled || !trayInstance");
    expect(source).toContain("focusMainWindow();");
  });
});
