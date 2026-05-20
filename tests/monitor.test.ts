import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultPrefs,
  loadPrefs,
  markReminderShown,
  markAutoScanStarted,
  savePrefs,
  shouldRemind,
  updatePrefs,
  __testing
} from "../src/main/monitor";

const DAY_MS = 86_400_000;

function prefs(overrides: Partial<ReturnType<typeof defaultPrefs>> = {}) {
  return { ...defaultPrefs(), ...overrides };
}

describe("defaultPrefs", () => {
  it("starts everything OFF except a 14-day reminder window", () => {
    const prefs = defaultPrefs();
    expect(prefs.trayEnabled).toBe(false);
    expect(prefs.launchAtLoginEnabled).toBe(false);
    expect(prefs.reminderEnabled).toBe(false);
    expect(prefs.reminderDays).toBe(14);
    expect(prefs.autoScanEnabled).toBe(false);
    expect(prefs.autoScanDays).toBe(30);
    expect(prefs.lastReminderAt).toBeUndefined();
    expect(prefs.lastAutoScanAt).toBeUndefined();
  });

  it("defaults updateChannel to 'stable'", () => {
    expect(defaultPrefs().updateChannel).toBe("stable");
  });

  it("defaults restorePointEnabled to true (safety net is opt-out, not opt-in)", () => {
    expect(defaultPrefs().restorePointEnabled).toBe(true);
  });

  it("defaults themeMode to system", () => {
    expect(defaultPrefs().themeMode).toBe("system");
  });

  it("defaults telemetryOptIn to false (strict opt-in)", () => {
    expect(defaultPrefs().telemetryOptIn).toBe(false);
  });
});

describe("coerce + clampReminderDays", () => {
  it("clamps reminderDays into the [1, 90] range", () => {
    // 0 is a finite number → falls through to Math.max(1, …) = 1.
    expect(__testing.clampReminderDays(0)).toBe(1);
    // NaN is non-finite → uses the documented default.
    expect(__testing.clampReminderDays(NaN)).toBe(14);
    expect(__testing.clampReminderDays(-3)).toBe(1);
    expect(__testing.clampReminderDays(120)).toBe(90);
    expect(__testing.clampReminderDays(30)).toBe(30);
  });

  it("clamps autoScanDays into the [1, 90] range", () => {
    expect(__testing.clampAutoScanDays(0)).toBe(1);
    expect(__testing.clampAutoScanDays(NaN)).toBe(30);
    expect(__testing.clampAutoScanDays(-3)).toBe(1);
    expect(__testing.clampAutoScanDays(120)).toBe(90);
    expect(__testing.clampAutoScanDays(45)).toBe(45);
  });

  it("returns defaults for garbage shapes", () => {
    expect(__testing.coerce(null)).toMatchObject(defaultPrefs());
    expect(__testing.coerce("string")).toMatchObject(defaultPrefs());
    expect(__testing.coerce({ prefs: { reminderDays: "wat" } })).toMatchObject({
      reminderDays: 14
    });
  });

  it("accepts the wrapped { prefs } shape and a flat one", () => {
    const wrapped = __testing.coerce({
      version: 1,
      prefs: {
        trayEnabled: true,
        launchAtLoginEnabled: true,
        reminderEnabled: true,
        reminderDays: 7,
        autoScanEnabled: true,
        autoScanDays: 30,
        lastAutoScanAt: "2026-05-19T00:00:00.000Z",
        themeMode: "dark"
      }
    });
    expect(wrapped.trayEnabled).toBe(true);
    expect(wrapped.launchAtLoginEnabled).toBe(true);
    expect(wrapped.reminderDays).toBe(7);
    expect(wrapped.autoScanEnabled).toBe(true);
    expect(wrapped.autoScanDays).toBe(30);
    expect(wrapped.lastAutoScanAt).toBe("2026-05-19T00:00:00.000Z");
    expect(wrapped.themeMode).toBe("dark");

    const flat = __testing.coerce({ trayEnabled: true, reminderDays: 9, themeMode: "light" });
    expect(flat.trayEnabled).toBe(true);
    expect(flat.reminderDays).toBe(9);
    expect(flat.themeMode).toBe("light");
  });

  it("coerces garbage themeMode back to system", () => {
    expect(__testing.coerce({ themeMode: "midnight" }).themeMode).toBe("system");
  });
});

describe("loadPrefs / savePrefs / updatePrefs", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-monitor-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults when no prefs file exists yet", async () => {
    const prefs = await loadPrefs(dir);
    expect(prefs).toMatchObject(defaultPrefs());
  });

  it("round-trips through save + load", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: true,
      launchAtLoginEnabled: true,
      reminderEnabled: true,
      reminderDays: 21,
      autoScanEnabled: true,
      autoScanDays: 45,
      updateChannel: "beta",
      restorePointEnabled: false,
      themeMode: "dark"
    }));
    const reloaded = await loadPrefs(dir);
    expect(reloaded.trayEnabled).toBe(true);
    expect(reloaded.launchAtLoginEnabled).toBe(true);
    expect(reloaded.reminderEnabled).toBe(true);
    expect(reloaded.reminderDays).toBe(21);
    expect(reloaded.autoScanEnabled).toBe(true);
    expect(reloaded.autoScanDays).toBe(45);
    expect(reloaded.updateChannel).toBe("beta");
    expect(reloaded.themeMode).toBe("dark");
    expect(reloaded.updatedAt).toBeTruthy();
  });

  it("updatePrefs patches only specified fields", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: true,
      launchAtLoginEnabled: true,
      reminderEnabled: false,
      reminderDays: 14,
      autoScanEnabled: false,
      autoScanDays: 30,
      updateChannel: "stable",
      restorePointEnabled: true,
      themeMode: "dark"
    }));
    const next = await updatePrefs(dir, {
      reminderEnabled: true,
      reminderDays: 30,
      autoScanEnabled: true,
      autoScanDays: 60
    });
    expect(next.trayEnabled).toBe(true);
    expect(next.launchAtLoginEnabled).toBe(true);
    expect(next.reminderEnabled).toBe(true);
    expect(next.reminderDays).toBe(30);
    expect(next.autoScanEnabled).toBe(true);
    expect(next.autoScanDays).toBe(60);
    expect(next.updateChannel).toBe("stable");
    expect(next.themeMode).toBe("dark");
  });

  it("updatePrefs flips updateChannel to beta and back", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: false,
      reminderEnabled: false,
      reminderDays: 14,
      updateChannel: "stable",
      restorePointEnabled: true
    }));
    let next = await updatePrefs(dir, { updateChannel: "beta" });
    expect(next.updateChannel).toBe("beta");
    next = await updatePrefs(dir, { updateChannel: "stable" });
    expect(next.updateChannel).toBe("stable");
  });

  it("updatePrefs flips restorePointEnabled off and back on", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: false,
      reminderEnabled: false,
      reminderDays: 14,
      updateChannel: "stable",
      restorePointEnabled: true
    }));
    let next = await updatePrefs(dir, { restorePointEnabled: false });
    expect(next.restorePointEnabled).toBe(false);
    next = await updatePrefs(dir, { restorePointEnabled: true });
    expect(next.restorePointEnabled).toBe(true);
  });

  it("updatePrefs flips themeMode between system, light, and dark", async () => {
    await savePrefs(dir, prefs());
    let next = await updatePrefs(dir, { themeMode: "dark" });
    expect(next.themeMode).toBe("dark");
    next = await updatePrefs(dir, { themeMode: "light" });
    expect(next.themeMode).toBe("light");
    next = await updatePrefs(dir, { themeMode: "system" });
    expect(next.themeMode).toBe("system");
  });

  it("updatePrefs flips telemetryOptIn on and back off", async () => {
    await savePrefs(dir, prefs());
    let next = await updatePrefs(dir, { telemetryOptIn: true });
    expect(next.telemetryOptIn).toBe(true);
    next = await updatePrefs(dir, { telemetryOptIn: false });
    expect(next.telemetryOptIn).toBe(false);
  });

  it("turns tray on when launch-at-login is enabled", async () => {
    await savePrefs(dir, prefs({ trayEnabled: false, launchAtLoginEnabled: false }));

    const next = await updatePrefs(dir, { launchAtLoginEnabled: true });

    expect(next.launchAtLoginEnabled).toBe(true);
    expect(next.trayEnabled).toBe(true);
  });

  it("turns launch-at-login off when tray is disabled", async () => {
    await savePrefs(dir, prefs({ trayEnabled: true, launchAtLoginEnabled: true }));

    const next = await updatePrefs(dir, { trayEnabled: false });

    expect(next.trayEnabled).toBe(false);
    expect(next.launchAtLoginEnabled).toBe(false);
  });

  it("coerces non-boolean telemetryOptIn to false (strict opt-in)", () => {
    // coerce() accepts `unknown`, so passing string/numeric values
    // here mimics a tampered-with prefs file on disk.
    expect(__testing.coerce({ telemetryOptIn: "true" }).telemetryOptIn).toBe(false);
    expect(__testing.coerce({ telemetryOptIn: 1 }).telemetryOptIn).toBe(false);
    expect(__testing.coerce({ telemetryOptIn: true }).telemetryOptIn).toBe(true);
  });

  it("coerces a garbage updateChannel back to 'stable'", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: false,
      reminderEnabled: false,
      reminderDays: 14,
      // @ts-expect-error - simulating a tampered/legacy file
      updateChannel: "experimental"
    }));
    const next = await loadPrefs(dir);
    expect(next.updateChannel).toBe("stable");
  });

  it("markReminderShown stamps lastReminderAt without flipping other fields", async () => {
    await savePrefs(dir, prefs({
      trayEnabled: true,
      launchAtLoginEnabled: true,
      reminderEnabled: true,
      reminderDays: 14,
      updateChannel: "stable",
      restorePointEnabled: true
    }));
    const fixedNow = new Date("2026-05-19T00:00:00.000Z");
    const next = await markReminderShown(dir, fixedNow);
    expect(next.lastReminderAt).toBe(fixedNow.toISOString());
    expect(next.trayEnabled).toBe(true);
    expect(next.launchAtLoginEnabled).toBe(true);
    expect(next.reminderEnabled).toBe(true);
    expect(next.updateChannel).toBe("stable");
  });

  it("markAutoScanStarted stamps lastAutoScanAt without flipping other fields", async () => {
    await savePrefs(dir, prefs({
      autoScanEnabled: true,
      autoScanDays: 30,
      reminderEnabled: true,
      updateChannel: "stable",
      restorePointEnabled: true
    }));
    const fixedNow = new Date("2026-05-20T00:00:00.000Z");
    const next = await markAutoScanStarted(dir, fixedNow);
    expect(next.lastAutoScanAt).toBe(fixedNow.toISOString());
    expect(next.autoScanEnabled).toBe(true);
    expect(next.autoScanDays).toBe(30);
    expect(next.reminderEnabled).toBe(true);
  });

  it("does not write monitor prefs through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const outsidePrefs = join(dir, "outside-monitor-prefs.json");
    const prefsFile = join(dir, "formatbuddy-monitor-prefs.json");
    writeFileSync(outsidePrefs, "outside stays put", "utf8");
    symlinkSync(outsidePrefs, prefsFile);

    const next = await updatePrefs(dir, { reminderEnabled: true, reminderDays: 30 });

    expect(next.reminderEnabled).toBe(true);
    expect(readFileSync(outsidePrefs, "utf8")).toBe("outside stays put");
    expect(lstatSync(prefsFile).isSymbolicLink()).toBe(false);
    const reloaded = await loadPrefs(dir);
    expect(reloaded.reminderEnabled).toBe(true);
    expect(reloaded.reminderDays).toBe(30);
  });
});

describe("shouldRemind decisions", () => {
  const now = new Date("2026-05-19T00:00:00.000Z");

  it("disabled prefs never fire", () => {
    const result = shouldRemind(defaultPrefs(), undefined, now);
    expect(result.show).toBe(false);
    expect(result.reason).toBe("disabled");
  });

  it("does not fire when no scan has happened yet", () => {
    const result = shouldRemind(
      { ...defaultPrefs(), reminderEnabled: true },
      undefined,
      now
    );
    expect(result.show).toBe(false);
    expect(result.reason).toBe("no-scan-yet");
  });

  it("does not fire when the last scan is younger than reminderDays", () => {
    const scanAt = new Date(now.getTime() - 3 * DAY_MS).toISOString();
    const result = shouldRemind(
      { ...defaultPrefs(), reminderEnabled: true, reminderDays: 14 },
      scanAt,
      now
    );
    expect(result.show).toBe(false);
    expect(result.reason).toBe("scan-too-fresh");
    expect(result.staleDays).toBe(3);
  });

  it("fires when the scan is older than reminderDays and no recent reminder", () => {
    const scanAt = new Date(now.getTime() - 20 * DAY_MS).toISOString();
    const result = shouldRemind(
      { ...defaultPrefs(), reminderEnabled: true, reminderDays: 14 },
      scanAt,
      now
    );
    expect(result.show).toBe(true);
    expect(result.reason).toBe("due");
    expect(result.staleDays).toBe(20);
  });

  it("suppresses when a reminder was shown within reminderDays/2 days", () => {
    const scanAt = new Date(now.getTime() - 20 * DAY_MS).toISOString();
    const remindedAt = new Date(now.getTime() - 2 * DAY_MS).toISOString();
    const result = shouldRemind(
      {
        ...defaultPrefs(),
        reminderEnabled: true,
        reminderDays: 14,
        lastReminderAt: remindedAt
      },
      scanAt,
      now
    );
    expect(result.show).toBe(false);
    expect(result.reason).toBe("already-reminded");
  });

  it("re-fires once the cooldown elapses", () => {
    const scanAt = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const remindedAt = new Date(now.getTime() - 10 * DAY_MS).toISOString();
    const result = shouldRemind(
      {
        ...defaultPrefs(),
        reminderEnabled: true,
        reminderDays: 14,
        lastReminderAt: remindedAt
      },
      scanAt,
      now
    );
    expect(result.show).toBe(true);
  });
});
