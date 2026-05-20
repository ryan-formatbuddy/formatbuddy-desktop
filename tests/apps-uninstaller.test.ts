import { describe, expect, it, vi } from "vitest";
import { canLaunchUninstall, runUninstall, __testing } from "../src/main/apps/uninstaller";
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
  it("builds cmd.exe arguments with AutoRun disabled for the default launcher", () => {
    expect(__testing.cmdArgsForUninstall('"C:\\Program Files\\Slack\\unins000.exe"')).toEqual([
      "/d",
      "/c",
      '"C:\\Program Files\\Slack\\unins000.exe"'
    ]);
  });

  it("exposes whether a request is launchable before taking a restore point", () => {
    expect(canLaunchUninstall({ appName: "Slack" }, baseApp, "win32")).toBe(true);
    expect(
      canLaunchUninstall(null as unknown as Parameters<typeof canLaunchUninstall>[0], baseApp, "win32")
    ).toBe(false);
    expect(canLaunchUninstall({ appName: " Slack" }, baseApp, "win32")).toBe(false);
    expect(canLaunchUninstall({ appName: "Slack\nBeta" }, baseApp, "win32")).toBe(false);
    expect(
      canLaunchUninstall(
        { appName: "Slack", publisher: " Slack Technologies" },
        baseApp,
        "win32"
      )
    ).toBe(false);
    expect(
      canLaunchUninstall(
        { appName: "Slack", mode: "silent" as unknown as "interactive" },
        baseApp,
        "win32"
      )
    ).toBe(false);
    expect(canLaunchUninstall({ appName: "Slack", mode: "quiet" }, baseApp, "win32")).toBe(false);
    expect(
      canLaunchUninstall(
        { appName: "Slack", mode: "quiet" },
        { ...baseApp, quietUninstallString: "unins000.exe /S" },
        "win32"
      )
    ).toBe(false);
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
    expect(
      canLaunchUninstall(
        { appName: "Broken" },
        { ...baseApp, name: "Broken", uninstallString: 123 as unknown as string },
        "win32"
      )
    ).toBe(false);
  });

  it("blocks malformed uninstall requests before app lookup or process spawn", async () => {
    const findApp = vi.fn(() => baseApp);
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: " Slack\n", publisher: "Slack Technologies" },
      { findApp, spawnCmd, platform: "win32" }
    );

    expect(result.status).toBe("blocked");
    expect(result.appName).toBe("선택한 앱");
    expect(result.message).toMatch(/앱 제거 대상/);
    expect(result.detail).toBe("invalid-uninstall-request");
    expect(findApp).not.toHaveBeenCalled();
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks non-object uninstall requests before app lookup or process spawn", async () => {
    const findApp = vi.fn(() => baseApp);
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(null as unknown as Parameters<typeof runUninstall>[0], {
      findApp,
      spawnCmd,
      platform: "win32"
    });

    expect(result.status).toBe("blocked");
    expect(result.appName).toBe("선택한 앱");
    expect(result.message).toMatch(/앱 제거 대상/);
    expect(result.detail).toBe("invalid-uninstall-request");
    expect(findApp).not.toHaveBeenCalled();
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks corrupted uninstall command values before process spawn", async () => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: "Broken" },
      {
        findApp: () => ({ ...baseApp, name: "Broken", uninstallString: 123 as unknown as string }),
        spawnCmd,
        platform: "win32"
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/Windows 제거 명령/);
    expect(result.detail).toBe("invalid-uninstall-command");
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks malformed uninstall publishers before app lookup or process spawn", async () => {
    const findApp = vi.fn(() => baseApp);
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: "Slack", publisher: " Slack Technologies" },
      { findApp, spawnCmd, platform: "win32" }
    );

    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/앱 제거 정보/);
    expect(result.detail).toBe("invalid-uninstall-request");
    expect(findApp).not.toHaveBeenCalled();
    expect(spawnCmd).not.toHaveBeenCalled();
  });

  it("blocks malformed uninstall modes before app lookup or process spawn", async () => {
    const findApp = vi.fn(() => baseApp);
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
    const result = await runUninstall(
      { appName: "Slack", mode: "silent" as unknown as "interactive" },
      { findApp, spawnCmd, platform: "win32" }
    );

    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/앱 제거 방식/);
    expect(result.detail).toBe("invalid-uninstall-request");
    expect(findApp).not.toHaveBeenCalled();
    expect(spawnCmd).not.toHaveBeenCalled();
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

  it("blocks quiet uninstall mode even when a quiet command exists", async () => {
    const noisy = { ...baseApp, quietUninstallString: "unins000.exe /S" };
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1 });
    const result = await runUninstall(
      { appName: noisy.name, mode: "quiet" },
      { findApp: () => noisy, spawnCmd, platform: "win32" }
    );
    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/Windows 제거 창|직접 확인/);
    expect(result.detail).toBe("quiet-uninstall-blocked");
    expect(spawnCmd).not.toHaveBeenCalled();

    const missing = await runUninstall(
      { appName: baseApp.name, mode: "quiet" },
      { findApp: () => baseApp, spawnCmd: vi.fn(), platform: "win32" }
    );
    expect(missing.status).toBe("blocked");
    expect(missing.detail).toBe("quiet-uninstall-blocked");
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
    ["cmd start wrapper", 'start "" "C:\\Program Files\\Sketchy\\unins000.exe"'],
    ["cmd call wrapper", 'call "C:\\Program Files\\Sketchy\\unins000.exe"'],
    ["PowerShell", "powershell.exe -NoProfile -File uninstall.ps1"],
    ["WMIC", 'wmic.exe product where name="Sketchy" call uninstall'],
    ["Registry utility", 'reg.exe delete HKCU\\Software\\Sketchy /f'],
    ["Task Scheduler", 'schtasks.exe /Run /TN "\\Sketchy\\Uninstall"'],
    ["Control Panel", "control.exe appwiz.cpl"],
    ["Explorer shell host", "explorer.exe shell:AppsFolder\\Sketchy"],
    ["rundll32", "rundll32.exe shell32.dll,Control_RunDLL appwiz.cpl"],
    ["regsvr32", "regsvr32.exe /u sketchy.dll"],
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

  it.each([
    [
      "shell host",
      "powershell.exe -NoProfile -File uninstall.ps1",
      /별도 실행 도구/
    ],
    [
      "script target",
      '"C:\\Program Files\\Friendly Tool\\uninstall.ps1"',
      /스크립트/
    ],
    [
      "unquoted spaced path",
      "C:\\Program Files\\Friendly Tool\\unins000.exe /remove",
      /공백|따옴표/
    ]
  ] as const)("explains blocked runUninstall reason for %s", async (_label, command, expected) => {
    const spawnCmd = vi.fn().mockResolvedValue({ pid: 1234 });
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
    expect(result.message).toMatch(expected);
    expect(result.message).toMatch(/Windows 설정/);
    expect(result.message).not.toMatch(/PowerShell|명령 프롬프트|터미널/);
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

  it.each([
    ["MSI quiet flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /quiet"],
    ["MSI quiet assignment flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /quiet=true"],
    ["MSI no-ui flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /qn"],
    ["MSI no-ui reboot prompt flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /qn+"],
    ["MSI basic-ui flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /qb"],
    ["MSI passive assignment flag", "MsiExec.exe /X{12345678-1234-1234-1234-123456789012} /passive=1"],
    ["Inno silent flag", '"C:\\Program Files\\Friendly Tool\\unins000.exe" /VERYSILENT'],
    ["NSIS silent flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" /S'],
    ["NSIS silent assignment flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" /S=true'],
    ["GNU quiet flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" --quiet'],
    ["GNU quiet assignment flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" --quiet=true'],
    ["GNU silent assignment flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" --silent=true'],
    ["single-dash silent assignment flag", '"C:\\Program Files\\Friendly Tool\\uninstall.exe" -silent=true']
  ])("blocks %s so app removal always stays user-confirmed", async (_label, command) => {
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
    expect(result.message).toMatch(/조용히 제거|Windows 설정|직접 확인/);
    expect(result.message).not.toMatch(/PowerShell|명령 프롬프트|터미널/);
    expect(result.detail).toMatch(/unsafe-uninstall-command/);
    expect(spawnCmd).not.toHaveBeenCalled();
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
