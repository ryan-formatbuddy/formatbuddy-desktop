/**
 * Periodic reminder + monitor preferences.
 *
 * Two sides:
 *   1. Persistence — load/save formatbuddy-monitor-prefs.json from
 *      userData. Opt-in only: defaults are trayEnabled=false,
 *      launchAtLoginEnabled=false, reminderEnabled=false, reminderDays=14.
 *   2. Decision — shouldRemind(lastScanAt, prefs, now) is the only
 *      place that decides whether the main process should show a
 *      Notification. Keep it pure so tests don't need timers.
 *
 * The main process is responsible for:
 *   - calling shouldRemind() on an hourly cadence
 *   - showing the Notification
 *   - calling recordReminderShown() so we don't spam
 *
 * The tray module is responsible for showing tray icon + menu when
 * prefs.trayEnabled flips on. This module does not touch electron.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  MonitorPreferences,
  ThemeMode,
  UpdateChannel,
  UpdateMonitorPreferencesRequest
} from "@shared/types";
import { normalizePath } from "./cleanup/blocklist";
import { findLinkedPathPart } from "./cleanup/pathSafety";

const PREFS_FILE = "formatbuddy-monitor-prefs.json";
const DEFAULT_REMINDER_DAYS = 14;
const MIN_REMINDER_DAYS = 1;
const MAX_REMINDER_DAYS = 90;
const DEFAULT_UPDATE_CHANNEL: UpdateChannel = "stable";
const DEFAULT_THEME_MODE: ThemeMode = "system";

function coerceChannel(value: unknown): UpdateChannel {
  return value === "beta" ? "beta" : DEFAULT_UPDATE_CHANNEL;
}

function coerceThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") return value;
  return DEFAULT_THEME_MODE;
}

interface PersistedMonitorPrefs {
  version: 1;
  prefs: MonitorPreferences;
}

function prefsPath(userDataDir: string): string {
  return join(userDataDir, PREFS_FILE);
}

export function defaultPrefs(): MonitorPreferences {
  return {
    trayEnabled: false,
    launchAtLoginEnabled: false,
    reminderEnabled: false,
    reminderDays: DEFAULT_REMINDER_DAYS,
    updateChannel: DEFAULT_UPDATE_CHANNEL,
    // v2.0 — Restore Point is ON by default. It is a safety net for
    // every destructive action (cleanup execute, app uninstall) and
    // costs the user nothing when it succeeds.
    restorePointEnabled: true,
    // D-31 — system follow by default so a fresh install picks up
    // whichever theme the OS is already in without any opt-in click.
    themeMode: DEFAULT_THEME_MODE,
    // D-32 — telemetry stays OFF until the user explicitly opts in.
    telemetryOptIn: false
  };
}

function clampReminderDays(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_REMINDER_DAYS;
  return Math.max(MIN_REMINDER_DAYS, Math.min(MAX_REMINDER_DAYS, Math.round(value)));
}

function coerce(value: unknown): MonitorPreferences {
  if (!value || typeof value !== "object") return defaultPrefs();
  const raw = value as Partial<PersistedMonitorPrefs> & {
    prefs?: Partial<MonitorPreferences>;
  };
  const prefs = raw.prefs ?? (raw as unknown as Partial<MonitorPreferences>);
  return {
    trayEnabled: Boolean(prefs?.trayEnabled),
    launchAtLoginEnabled: Boolean(prefs?.launchAtLoginEnabled),
    reminderEnabled: Boolean(prefs?.reminderEnabled),
    reminderDays: clampReminderDays(prefs?.reminderDays),
    updateChannel: coerceChannel(prefs?.updateChannel),
    // Default to ON: any value other than the explicit boolean false
    // keeps the safety net. Older state files without the field opt in.
    restorePointEnabled: prefs?.restorePointEnabled !== false,
    themeMode: coerceThemeMode(prefs?.themeMode),
    // Strict opt-in: only the explicit boolean true keeps telemetry on.
    // Any other shape (undefined, "true", 1, etc.) collapses to false.
    telemetryOptIn: prefs?.telemetryOptIn === true,
    lastReminderAt:
      typeof prefs?.lastReminderAt === "string" ? prefs.lastReminderAt : undefined,
    updatedAt: typeof prefs?.updatedAt === "string" ? prefs.updatedAt : undefined
  };
}

export async function loadPrefs(userDataDir: string): Promise<MonitorPreferences> {
  const linkedPrefs = await findLinkedPathPart(prefsPath(userDataDir), userDataDir, true);
  if (linkedPrefs) {
    if (normalizePath(resolve(linkedPrefs)) === normalizePath(resolve(prefsPath(userDataDir)))) {
      await rm(prefsPath(userDataDir), { force: true }).catch(() => {});
    }
    return defaultPrefs();
  }

  try {
    const raw = await readFile(prefsPath(userDataDir), "utf8");
    return coerce(JSON.parse(raw));
  } catch {
    return defaultPrefs();
  }
}

export async function savePrefs(
  userDataDir: string,
  prefs: MonitorPreferences
): Promise<MonitorPreferences> {
  const stamped: MonitorPreferences = { ...prefs, updatedAt: new Date().toISOString() };
  await mkdir(userDataDir, { recursive: true });
  const linkedPrefs = await findLinkedPathPart(prefsPath(userDataDir), userDataDir, true);
  if (linkedPrefs) {
    if (normalizePath(resolve(linkedPrefs)) !== normalizePath(resolve(prefsPath(userDataDir)))) {
      throw new Error(`FormatBuddy monitor prefs path is behind a link: ${linkedPrefs}`);
    }
    await rm(prefsPath(userDataDir), { force: true });
  }
  const payload: PersistedMonitorPrefs = { version: 1, prefs: stamped };
  await writeFile(prefsPath(userDataDir), JSON.stringify(payload, null, 2), "utf8");
  return stamped;
}

export async function updatePrefs(
  userDataDir: string,
  patch: UpdateMonitorPreferencesRequest
): Promise<MonitorPreferences> {
  const current = await loadPrefs(userDataDir);
  let trayEnabled =
    patch.trayEnabled !== undefined ? Boolean(patch.trayEnabled) : current.trayEnabled;
  let launchAtLoginEnabled =
    patch.launchAtLoginEnabled !== undefined
      ? Boolean(patch.launchAtLoginEnabled)
      : current.launchAtLoginEnabled;

  // Starting hidden without a tray leaves the user with no obvious way
  // back into the app. Treat launch-at-login as a tray-backed mode.
  if (patch.launchAtLoginEnabled === true) trayEnabled = true;
  if (patch.trayEnabled === false) launchAtLoginEnabled = false;
  if (!trayEnabled) launchAtLoginEnabled = false;

  const next: MonitorPreferences = {
    ...current,
    trayEnabled,
    launchAtLoginEnabled,
    ...(patch.reminderEnabled !== undefined
      ? { reminderEnabled: Boolean(patch.reminderEnabled) }
      : {}),
    ...(patch.reminderDays !== undefined
      ? { reminderDays: clampReminderDays(patch.reminderDays) }
      : {}),
    ...(patch.updateChannel !== undefined
      ? { updateChannel: coerceChannel(patch.updateChannel) }
      : {}),
    ...(patch.restorePointEnabled !== undefined
      ? { restorePointEnabled: Boolean(patch.restorePointEnabled) }
      : {}),
    ...(patch.themeMode !== undefined
      ? { themeMode: coerceThemeMode(patch.themeMode) }
      : {}),
    ...(patch.telemetryOptIn !== undefined
      ? { telemetryOptIn: patch.telemetryOptIn === true }
      : {})
  };
  return savePrefs(userDataDir, next);
}

export async function markReminderShown(
  userDataDir: string,
  now: Date = new Date()
): Promise<MonitorPreferences> {
  const current = await loadPrefs(userDataDir);
  return savePrefs(userDataDir, { ...current, lastReminderAt: now.toISOString() });
}

export interface ReminderDecision {
  show: boolean;
  reason:
    | "disabled"
    | "no-scan-yet"
    | "scan-too-fresh"
    | "already-reminded"
    | "due";
  staleDays?: number;
}

/**
 * Pure decision: should we surface a reminder right now?
 *
 * Rules in order:
 *   - reminderEnabled === false           → disabled
 *   - no lastScanAt                       → no-scan-yet
 *   - lastScanAt < reminderDays           → scan-too-fresh
 *   - reminded within reminderDays/2 days → already-reminded
 *   - otherwise                           → due
 *
 * The already-reminded floor (reminderDays/2) keeps us from
 * re-notifying every hour after the threshold is crossed.
 */
export function shouldRemind(
  prefs: MonitorPreferences,
  lastScanAt: string | undefined,
  now: Date
): ReminderDecision {
  if (!prefs.reminderEnabled) return { show: false, reason: "disabled" };
  if (!lastScanAt) return { show: false, reason: "no-scan-yet" };

  const scanTime = Date.parse(lastScanAt);
  if (!Number.isFinite(scanTime)) return { show: false, reason: "no-scan-yet" };
  const staleDays = Math.max(0, Math.floor((now.getTime() - scanTime) / 86_400_000));
  if (staleDays < prefs.reminderDays) {
    return { show: false, reason: "scan-too-fresh", staleDays };
  }

  const cooldownDays = Math.max(1, Math.floor(prefs.reminderDays / 2));
  if (prefs.lastReminderAt) {
    const remindedAt = Date.parse(prefs.lastReminderAt);
    if (Number.isFinite(remindedAt)) {
      const sinceReminderDays = Math.floor((now.getTime() - remindedAt) / 86_400_000);
      if (sinceReminderDays < cooldownDays) {
        return { show: false, reason: "already-reminded", staleDays };
      }
    }
  }

  return { show: true, reason: "due", staleDays };
}

export const __testing = {
  coerce,
  clampReminderDays,
  PREFS_FILE,
  DEFAULT_REMINDER_DAYS,
  MIN_REMINDER_DAYS,
  MAX_REMINDER_DAYS
};
