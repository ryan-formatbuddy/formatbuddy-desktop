import { describe, expect, it, vi } from "vitest";
import { defaultPrefs } from "../src/main/monitor";
import {
  LAUNCH_AT_LOGIN_BACKGROUND_ARG,
  loginItemSettingsForPrefs,
  reconcileLaunchAtLogin,
  shouldStartHiddenFromArgs
} from "../src/main/monitorLogin";

describe("monitor launch-at-login bridge", () => {
  it("keeps login startup disabled by default", () => {
    expect(loginItemSettingsForPrefs(defaultPrefs())).toEqual({
      openAtLogin: false,
      openAsHidden: true,
      args: []
    });
  });

  it("starts FormatBuddy hidden when the user opts into PC-start behavior", () => {
    expect(
      loginItemSettingsForPrefs({
        ...defaultPrefs(),
        trayEnabled: true,
        launchAtLoginEnabled: true
      })
    ).toEqual({
      openAtLogin: true,
      openAsHidden: true,
      args: [LAUNCH_AT_LOGIN_BACKGROUND_ARG]
    });
  });

  it("detects the background startup argument", () => {
    expect(shouldStartHiddenFromArgs(["FormatBuddy.exe"])).toBe(false);
    expect(shouldStartHiddenFromArgs(["FormatBuddy.exe", LAUNCH_AT_LOGIN_BACKGROUND_ARG])).toBe(true);
  });

  it("applies login item settings through the Electron app bridge", () => {
    const setLoginItemSettings = vi.fn();
    const ok = reconcileLaunchAtLogin(
      { setLoginItemSettings },
      { ...defaultPrefs(), trayEnabled: true, launchAtLoginEnabled: true }
    );

    expect(ok).toBe(true);
    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      openAsHidden: true,
      args: [LAUNCH_AT_LOGIN_BACKGROUND_ARG]
    });
  });

  it("does not throw raw bridge failures into the settings flow", () => {
    const warn = vi.fn();
    const ok = reconcileLaunchAtLogin(
      {
        setLoginItemSettings: () => {
          throw new Error("bad\nlogin\0setting");
        }
      },
      { ...defaultPrefs(), trayEnabled: true, launchAtLoginEnabled: true },
      warn
    );

    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledWith("login-item failed: bad login setting");
  });
});
