import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __testing,
  forgetUninstallFollowup,
  listUninstallFollowups,
  mergeUninstallFollowupApps,
  rememberUninstallFollowup,
  UNINSTALL_FOLLOWUPS_FILE
} from "../src/main/apps/uninstallFollowups";
import { RECENT_UNINSTALL_TTL_MS } from "../src/main/lastScan";
import type { AppLeftoversSnapshot, InstalledApp } from "../src/shared/types";

function leftoverSnapshot(groups: AppLeftoversSnapshot["groups"]): AppLeftoversSnapshot {
  return {
    planId: "plan-1",
    confirmationToken: "token-1",
    generatedAt: "2026-05-20T10:00:00.000Z",
    groups
  };
}

function leftoverPath(exists: boolean): AppLeftoversSnapshot["groups"][number]["paths"][number] {
  return {
    id: exists ? "path-existing" : "path-missing",
    path: exists ? "C:\\Users\\Ryan\\AppData\\Roaming\\Slack" : "C:\\Users\\Ryan\\AppData\\Roaming\\Missing",
    kind: "folder",
    exists
  };
}

describe("persisted uninstall follow-ups", () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), "fb-uninstall-followups-"));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it("persists only the local metadata needed to continue leftover cleanup after restart", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");

    await rememberUninstallFollowup(
      userDataDir,
      {
        name: "Slack",
        publisher: "Slack Technologies",
        version: "4.40.0",
        uninstallString: '"C:\\Program Files\\Slack\\unins000.exe"',
        quietUninstallString: '"C:\\Program Files\\Slack\\unins000.exe" /S',
        installLocation: "C:\\Program Files\\Slack",
        registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack",
        estimatedSizeKb: 123456,
        installDate: "20260520"
      },
      () => now
    );

    expect(await listUninstallFollowups(userDataDir, () => now + 1000)).toEqual([
      {
        name: "Slack",
        publisher: "Slack Technologies",
        installLocation: "C:\\Program Files\\Slack",
        registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack"
      }
    ]);

    const raw = readFileSync(join(userDataDir, UNINSTALL_FOLLOWUPS_FILE), "utf8");
    expect(raw).toContain("Slack Technologies");
    expect(raw).not.toContain("unins000.exe");
    expect(raw).not.toContain("quietUninstallString");
    expect(raw).not.toContain("4.40.0");
    expect(raw).not.toContain("123456");
  });

  it("cleans display fields and drops unsafe paths before persisting follow-ups", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");

    await rememberUninstallFollowup(
      userDataDir,
      {
        name: " Slack\nBeta ",
        publisher: " Slack\tTechnologies ",
        installLocation: "C:\\Program Files\\Slack\nBeta",
        registryKeyPath: " HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack "
      },
      () => now
    );

    expect(await listUninstallFollowups(userDataDir, () => now + 1000)).toEqual([
      {
        name: "Slack Beta",
        publisher: "Slack Technologies",
        registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack"
      }
    ]);

    const raw = readFileSync(join(userDataDir, UNINSTALL_FOLLOWUPS_FILE), "utf8");
    expect(raw).not.toContain("\\n");
    expect(raw).not.toContain("\\t");
  });

  it("drops follow-ups outside the 24 hour handoff window", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");
    await rememberUninstallFollowup(
      userDataDir,
      { name: "Slack", publisher: "Slack Technologies" },
      () => now
    );

    expect(
      await listUninstallFollowups(userDataDir, () => now + RECENT_UNINSTALL_TTL_MS - 1)
    ).toHaveLength(1);
    expect(
      await listUninstallFollowups(userDataDir, () => now + RECENT_UNINSTALL_TTL_MS + 1)
    ).toEqual([]);
  });

  it("compacts expired follow-ups out of the local file on read", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");
    await rememberUninstallFollowup(
      userDataDir,
      { name: "Slack", publisher: "Slack Technologies" },
      () => now
    );

    expect(readFileSync(join(userDataDir, UNINSTALL_FOLLOWUPS_FILE), "utf8")).toContain("Slack");

    expect(
      await listUninstallFollowups(userDataDir, () => now + RECENT_UNINSTALL_TTL_MS + 1)
    ).toEqual([]);

    expect(readFileSync(join(userDataDir, UNINSTALL_FOLLOWUPS_FILE), "utf8")).not.toContain(
      "Slack"
    );
  });

  it("forgets a completed follow-up without touching unrelated apps", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");
    await rememberUninstallFollowup(
      userDataDir,
      { name: "Slack", publisher: "Slack Technologies" },
      () => now
    );
    await rememberUninstallFollowup(
      userDataDir,
      { name: "Notion", publisher: "Notion Labs" },
      () => now + 1000
    );

    await expect(
      forgetUninstallFollowup(
        userDataDir,
        { name: "Slack", publisher: "Slack Technologies" },
        () => now + 2000
      )
    ).resolves.toBe(true);

    expect(await listUninstallFollowups(userDataDir, () => now + 3000)).toEqual([
      { name: "Notion", publisher: "Notion Labs" }
    ]);
    const raw = readFileSync(join(userDataDir, UNINSTALL_FOLLOWUPS_FILE), "utf8");
    expect(raw).not.toContain("Slack");
    expect(raw).toContain("Notion");
  });

  it("forgets a publisher-missing follow-up when cleanup reports the same app with publisher", async () => {
    const now = Date.parse("2026-05-20T10:00:00.000Z");
    await rememberUninstallFollowup(
      userDataDir,
      { name: "Slack", publisher: null },
      () => now
    );

    await expect(
      forgetUninstallFollowup(
        userDataDir,
        { name: "Slack", publisher: "Slack Technologies" },
        () => now + 1000
      )
    ).resolves.toBe(true);

    expect(await listUninstallFollowups(userDataDir, () => now + 2000)).toEqual([]);
  });

  it("merges publisher-missing and publisher-known follow-ups as one app", () => {
    expect(
      mergeUninstallFollowupApps(
        [{ name: "Slack", publisher: "Slack Technologies", installLocation: "C:\\Slack" }],
        [{ name: "Slack", publisher: null, registryKeyPath: "HKCU\\Software\\Slack" }]
      )
    ).toEqual([
      {
        name: "Slack",
        publisher: "Slack Technologies",
        installLocation: "C:\\Slack",
        registryKeyPath: "HKCU\\Software\\Slack"
      }
    ]);
  });

  it("does not write the follow-up file through a symbolic link", async () => {
    const outsideFile = join(userDataDir, "outside-followups.json");
    const followupFile = join(userDataDir, UNINSTALL_FOLLOWUPS_FILE);
    symlinkSync(outsideFile, followupFile);

    await rememberUninstallFollowup(userDataDir, { name: "Slack" }, () =>
      Date.parse("2026-05-20T10:00:00.000Z")
    );

    expect(lstatSync(followupFile).isSymbolicLink()).toBe(false);
    expect(existsSync(outsideFile)).toBe(false);
    expect(readFileSync(followupFile, "utf8")).toContain("Slack");
  });

  it("marks removed follow-ups as resolved when no leftover evidence remains", () => {
    const followup: InstalledApp = { name: "Slack", publisher: "Slack Technologies" };
    const snapshot = leftoverSnapshot([
      {
        appName: "Slack",
        publisher: "Slack Technologies",
        sourceAppName: "Slack",
        source: "uninstall-launched",
        cleanupState: "removed-confirmed",
        paths: [leftoverPath(false)]
      }
    ]);

    expect(
      __testing.resolvedUninstallFollowupsWithoutLeftovers(snapshot, [followup], {
        installedAppsKnown: true,
        installedApps: []
      })
    ).toEqual([{ name: "Slack", publisher: "Slack Technologies" }]);
  });

  it("keeps follow-ups open when a leftover path still exists", () => {
    const followup: InstalledApp = { name: "Slack", publisher: "Slack Technologies" };
    const snapshot = leftoverSnapshot([
      {
        appName: "Slack",
        publisher: "Slack Technologies",
        sourceAppName: "Slack",
        source: "uninstall-launched",
        cleanupState: "removed-confirmed",
        paths: [leftoverPath(true)]
      }
    ]);

    expect(
      __testing.resolvedUninstallFollowupsWithoutLeftovers(snapshot, [followup], {
        installedAppsKnown: true,
        installedApps: []
      })
    ).toEqual([]);
  });

  it("keeps follow-ups open when install state is unknown or the app family is still installed", () => {
    const adobe: InstalledApp = { name: "Adobe Photoshop 2024", publisher: "Adobe Inc." };
    const emptySnapshot = leftoverSnapshot([]);

    expect(
      __testing.resolvedUninstallFollowupsWithoutLeftovers(emptySnapshot, [adobe], {
        installedAppsKnown: false,
        installedApps: []
      })
    ).toEqual([]);
    expect(
      __testing.resolvedUninstallFollowupsWithoutLeftovers(emptySnapshot, [adobe], {
        installedAppsKnown: true,
        installedApps: [{ name: "Adobe Illustrator 2024", publisher: "Adobe Inc." }]
      })
    ).toEqual([]);
  });
});
