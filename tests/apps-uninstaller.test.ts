import { describe, expect, it, vi } from "vitest";
import { runUninstall } from "../src/main/apps/uninstaller";
import type { InstalledApp } from "../src/shared/types";

const baseApp: InstalledApp = {
  name: "Slack",
  publisher: "Slack Technologies",
  uninstallString: '"C:\\Program Files\\Slack\\unins000.exe"',
  quietUninstallString: null,
  installLocation: "C:\\Program Files\\Slack",
  systemComponent: false
};

describe("runUninstall", () => {
  it("launches Windows uninstaller via cmd.exe in interactive mode", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: "Slack", publisher: "Slack Technologies", mode: "interactive" },
      {
        findApp: () => baseApp,
        spawnCmd,
        platform: "win32"
      }
    );
    expect(result.status).toBe("launched");
    expect(spawnCmd).toHaveBeenCalledWith(baseApp.uninstallString);
    expect(result.detail).toMatch(/pid=1234/);
  });

  it("uses quietUninstallString in quiet mode and rejects when missing", async () => {
    const noisy = { ...baseApp, quietUninstallString: "unins000.exe /S" };
    const ok = await runUninstall(
      { appName: noisy.name, mode: "quiet" },
      { findApp: () => noisy, spawnCmd: vi.fn().mockResolvedValue({ pid: 1 }), platform: "win32" }
    );
    expect(ok.status).toBe("launched");

    const missing = await runUninstall(
      { appName: baseApp.name, mode: "quiet" },
      { findApp: () => baseApp, spawnCmd: vi.fn(), platform: "win32" }
    );
    expect(missing.status).toBe("no-uninstall-string");
  });

  it("returns app-not-found when the cached scan has no match", async () => {
    const result = await runUninstall(
      { appName: "Ghost", publisher: "Nobody" },
      { findApp: () => undefined, platform: "win32" }
    );
    expect(result.status).toBe("app-not-found");
  });

  it("blocks Windows system components even with a valid UninstallString", async () => {
    const result = await runUninstall(
      { appName: "Visual C++ Redist" },
      {
        findApp: () => ({
          name: "Visual C++ Redist",
          publisher: "Microsoft",
          uninstallString: "MsiExec.exe /X{abc}",
          systemComponent: true
        }),
        spawnCmd: vi.fn(),
        platform: "win32"
      }
    );
    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/systemComponent=true/);
  });

  it("refuses to run on non-Windows platforms", async () => {
    const result = await runUninstall(
      { appName: "Slack" },
      { findApp: () => baseApp, platform: "darwin" }
    );
    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/Windows/);
  });

  it("returns spawn-failed when cmd.exe rejects", async () => {
    const result = await runUninstall(
      { appName: "Slack" },
      {
        findApp: () => baseApp,
        spawnCmd: vi.fn().mockRejectedValue(new Error("ENOENT")),
        platform: "win32"
      }
    );
    expect(result.status).toBe("spawn-failed");
    expect(result.detail).toMatch(/ENOENT/);
  });
});
