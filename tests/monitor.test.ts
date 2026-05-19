import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultPrefs,
  loadPrefs,
  markReminderShown,
  savePrefs,
  shouldRemind,
  updatePrefs,
  __testing
} from "../src/main/monitor";

const DAY_MS = 86_400_000;

describe("defaultPrefs", () => {
  it("starts everything OFF except a 14-day reminder window", () => {
    const prefs = defaultPrefs();
    expect(prefs.trayEnabled).toBe(false);
    expect(prefs.reminderEnabled).toBe(false);
    expect(prefs.reminderDays).toBe(14);
    expect(prefs.lastReminderAt).toBeUndefined();
  });

  it("defaults updateChannel to 'stable'", () => {
    expect(defaultPrefs().updateChannel).toBe("stable");
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
      prefs: { trayEnabled: true, reminderEnabled: true, reminderDays: 7 }
    });
    expect(wrapped.trayEnabled).toBe(true);
    expect(wrapped.reminderDays).toBe(7);

    const flat = __testing.coerce({ trayEnabled: true, reminderDays: 9 });
    expect(flat.trayEnabled).toBe(true);
    expect(flat.reminderDays).toBe(9);
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
    await savePrefs(dir, {
      trayEnabled: true,
      reminderEnabled: true,
      reminderDays: 21,
      updateChannel: "beta"
    });
    const reloaded = await loadPrefs(dir);
    expect(reloaded.trayEnabled).toBe(true);
    expect(reloaded.reminderEnabled).toBe(true);
    expect(reloaded.reminderDays).toBe(21);
    expect(reloaded.updateChannel).toBe("beta");
    expect(reloaded.updatedAt).toBeTruthy();
  });

  it("updatePrefs patches only specified fields", async () => {
    await savePrefs(dir, {
      trayEnabled: true,
      reminderEnabled: false,
      reminderDays: 14,
      updateChannel: "stable"
    });
    const next = await updatePrefs(dir, { reminderEnabled: true, reminderDays: 30 });
    expect(next.trayEnabled).toBe(true);
    expect(next.reminderEnabled).toBe(true);
    expect(next.reminderDays).toBe(30);
    expect(next.updateChannel).toBe("stable");
  });

  it("updatePrefs flips updateChannel to beta and back", async () => {
    await savePrefs(dir, {
      trayEnabled: false,
      reminderEnabled: false,
      reminderDays: 14,
      updateChannel: "stable"
    });
    let next = await updatePrefs(dir, { updateChannel: "beta" });
    expect(next.updateChannel).toBe("beta");
    next = await updatePrefs(dir, { updateChannel: "stable" });
    expect(next.updateChannel).toBe("stable");
  });

  it("coerces a garbage updateChannel back to 'stable'", async () => {
    await savePrefs(dir, {
      trayEnabled: false,
      reminderEnabled: false,
      reminderDays: 14,
      // @ts-expect-error - simulating a tampered/legacy file
      updateChannel: "experimental"
    });
    const next = await loadPrefs(dir);
    expect(next.updateChannel).toBe("stable");
  });

  it("markReminderShown stamps lastReminderAt without flipping other fields", async () => {
    await savePrefs(dir, {
      trayEnabled: true,
      reminderEnabled: true,
      reminderDays: 14,
      updateChannel: "stable"
    });
    const fixedNow = new Date("2026-05-19T00:00:00.000Z");
    const next = await markReminderShown(dir, fixedNow);
    expect(next.lastReminderAt).toBe(fixedNow.toISOString());
    expect(next.trayEnabled).toBe(true);
    expect(next.reminderEnabled).toBe(true);
    expect(next.updateChannel).toBe("stable");
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
