import type { MonitorPreferences } from "@shared/types";

export const LAUNCH_AT_LOGIN_BACKGROUND_ARG = "--formatbuddy-background";

interface LoginItemSettings {
  openAtLogin: boolean;
  openAsHidden: boolean;
  args: string[];
}

export interface LoginItemAppBridge {
  setLoginItemSettings: (settings: LoginItemSettings) => void;
}

export function loginItemSettingsForPrefs(prefs: MonitorPreferences): LoginItemSettings {
  return {
    openAtLogin: prefs.launchAtLoginEnabled,
    openAsHidden: true,
    args: prefs.launchAtLoginEnabled ? [LAUNCH_AT_LOGIN_BACKGROUND_ARG] : []
  };
}

export function shouldStartHiddenFromArgs(argv: string[] = process.argv): boolean {
  return argv.includes(LAUNCH_AT_LOGIN_BACKGROUND_ARG);
}

export function reconcileLaunchAtLogin(
  appBridge: LoginItemAppBridge,
  prefs: MonitorPreferences,
  logWarn: (message: string) => void = () => {}
): boolean {
  try {
    appBridge.setLoginItemSettings(loginItemSettingsForPrefs(prefs));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn(`login-item failed: ${message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()}`);
    return false;
  }
}
