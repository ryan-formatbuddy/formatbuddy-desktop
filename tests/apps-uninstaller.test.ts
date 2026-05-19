import { describe, expect, it, vi } from "vitest";
import { canLaunchUninstall, runUninstall } from "../src/main/apps/uninstaller";
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
  it("exposes whether a request is launchable before taking a restore point", () => {
    expect(canLaunchUninstall({ appName: "Slack" }, baseApp, "win32")).toBe(true);
    expect(canLaunchUninstall({ appName: "Slack", mode: "quiet" }, baseApp, "win32")).toBe(false);
    expect(
      canLaunchUninstall(
        { appName: "Runtime" },
        { ...baseApp, systemComponent: true },
        "win32"
      )
    ).toBe(false);
    expect(canLaunchUninstall({ appName: "Slack" }, undefined, "win32")).toBe(false);
    expect(canLaunchUninstall({ appName: "Slack" }, baseApp, "darwin")).toBe(false);
    expect(
      canLaunchUninstall(
        { appName: "Sketchy" },
        { ...baseApp, uninstallString: '"C:\\Program Files\\Sketchy\\unins000.exe" & calc.exe' },
        "win32"
      )
    ).toBe(false);
  });

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

  it("blocks uninstall strings with unquoted shell control operators", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: "Sketchy" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Sketchy",
          uninstallString: '"C:\\Program Files\\Sketchy\\unins000.exe" & calc.exe'
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks uninstall strings with cmd environment expansion", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const command = '"C:\\Program Files\\Sketchy\\unins000.exe" %COMSPEC%';

    expect(
      canLaunchUninstall(
        { appName: "Sketchy" },
        { ...baseApp, name: "Sketchy", uninstallString: command },
        "win32"
      )
    ).toBe(false);

    const result = await runUninstall(
      { appName: "Sketchy" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Sketchy",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks uninstall strings with cmd escape control", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const command = '"C:\\Program Files\\Sketchy\\unins000.exe" ^& calc.exe';
    const result = await runUninstall(
      { appName: "Sketchy" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Sketchy",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks uninstall strings with cmd grouping outside quotes", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const command = '(MsiExec.exe /X{12345678-1234-1234-1234-123456789012})';

    expect(
      canLaunchUninstall(
        { appName: "Sketchy" },
        { ...baseApp, name: "Sketchy", uninstallString: command },
        "win32"
      )
    ).toBe(false);

    const result = await runUninstall(
      { appName: "Sketchy" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Sketchy",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it.each([
    ["cmd.exe", "cmd.exe /c uninstall.bat"],
    ["PowerShell", "powershell.exe -NoProfile -File uninstall.ps1"],
    ["Windows Script Host", "wscript.exe uninstall.vbs"]
  ])("blocks uninstall strings that start with %s", async (_label, command) => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });

    expect(
      canLaunchUninstall(
        { appName: "Sketchy" },
        { ...baseApp, name: "Sketchy", uninstallString: command },
        "win32"
      )
    ).toBe(false);

    const result = await runUninstall(
      { appName: "Sketchy" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Sketchy",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("allows ordinary MSI uninstall commands", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const command = "MsiExec.exe /X{12345678-1234-1234-1234-123456789012}";
    const result = await runUninstall(
      { appName: "MSI Tool" },
      {
        findApp: () => ({
          ...baseApp,
          name: "MSI Tool",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("launched");
    expect(spawnCmd).toHaveBeenCalledWith(command);
  });

  it("blocks unquoted executable paths with spaces", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const command = "C:\\Program Files\\Friendly Tool\\unins000.exe /remove";

    expect(
      canLaunchUninstall(
        { appName: "Friendly Tool" },
        { ...baseApp, name: "Friendly Tool", uninstallString: command },
        "win32"
      )
    ).toBe(false);

    const result = await runUninstall(
      { appName: "Friendly Tool" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Friendly Tool",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it.each([
    ["batch", '"C:\\Program Files\\Friendly Tool\\uninstall.bat"'],
    ["cmd script", '"C:\\Program Files\\Friendly Tool\\uninstall.cmd" /quiet'],
    ["PowerShell script", '"C:\\Program Files\\Friendly Tool\\uninstall.ps1"'],
    ["VBScript", '"C:\\Program Files\\Friendly Tool\\uninstall.vbs"']
  ])("blocks uninstall strings that target a %s file", async (_label, command) => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });

    expect(
      canLaunchUninstall(
        { appName: "Friendly Tool" },
        { ...baseApp, name: "Friendly Tool", uninstallString: command },
        "win32"
      )
    ).toBe(false);

    const result = await runUninstall(
      { appName: "Friendly Tool" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Friendly Tool",
          uninstallString: command
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("allows parentheses inside a quoted uninstaller path", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const quoted = '"C:\\Program Files (x86)\\Friendly Tool\\unins000.exe" /remove';
    const result = await runUninstall(
      { appName: "Friendly Tool" },
      {
        findApp: () => ({
          ...baseApp,
          name: "Friendly Tool",
          uninstallString: quoted
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("launched");
    expect(spawnCmd).toHaveBeenCalledWith(quoted);
  });

  it("allows shell control characters inside a quoted uninstaller path", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const quoted = '"C:\\Program Files\\A&B Tool\\unins000.exe" /remove';
    const result = await runUninstall(
      { appName: "A&B Tool" },
      {
        findApp: () => ({
          ...baseApp,
          name: "A&B Tool",
          uninstallString: quoted
        }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("launched");
    expect(spawnCmd).toHaveBeenCalledWith(quoted);
  });
});
