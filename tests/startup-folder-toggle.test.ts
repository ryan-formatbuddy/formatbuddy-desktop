import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { StartupAutoEntry } from "../src/shared/types";
import {
  disableStartupFolderEntry,
  listDisabledStartupFolderEntries,
  purgeExpiredStartupFolderEntries,
  restoreStartupFolderEntry
} from "../src/main/startup/folderToggle";

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "fb-startup-toggle-"));
  const userDataDir = join(root, "user-data");
  const startupDir = join(root, "Startup");
  return { root, userDataDir, startupDir };
}

function startupEntry(path: string, origin: string, name = "KakaoTalk.lnk"): StartupAutoEntry {
  return {
    id: `startup-folder|${name.toLowerCase()}|${path.toLowerCase()}`,
    kind: "startup-folder",
    name,
    path,
    origin
  };
}

function disabledIdFor(entry: StartupAutoEntry, now: Date): string {
  return createHash("sha1")
    .update(`${entry.id}|${now.toISOString()}`)
    .digest("hex")
    .slice(0, 24);
}

describe("startup folder toggle", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("moves a startup-folder item into managed storage and restores it", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "KakaoTalk.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });

    expect(disabled.status).toBe("disabled");
    expect(existsSync(source)).toBe(false);
    expect(disabled.entry?.originalPath).toBe(source);
    expect(disabled.entry?.storedPath).toContain("formatbuddy-startup-disabled");
    expect(disabled.entry?.disabledAt).toBe("2026-05-20T10:00:00.000Z");
    expect(disabled.entry?.expiresAt).toBe("2026-06-19T10:00:00.000Z");
    expect(readFileSync(disabled.entry!.storedPath, "utf8")).toBe("shortcut");

    const snapshot = await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([disabled.entry!.id]);

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id
    });

    expect(restored.status).toBe("restored");
    expect(readFileSync(source, "utf8")).toBe("shortcut");
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    expect((await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir })).entries).toEqual([]);
  });

  it("keeps disabled startup items for 30 days and purges them after expiry", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Slack.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Slack.lnk"),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });

    const early = await purgeExpiredStartupFolderEntries({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-19T09:59:59.000Z")
    });
    const late = await purgeExpiredStartupFolderEntries({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-19T10:00:01.000Z")
    });

    expect(early.purgedCount).toBe(0);
    expect(late).toMatchObject({
      purgedCount: 1,
      purgedIds: [disabled.entry!.id],
      retentionDays: 30
    });
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    expect((await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir })).entries).toEqual([]);
  });

  it("does not restore a disabled startup item after the 30-day window", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Teams.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Teams.lnk"),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });
    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      now: () => new Date("2026-06-19T10:00:01.000Z")
    });

    expect(restored.status).toBe("expired");
    expect(restored.message).toContain("30일");
    expect(existsSync(source)).toBe(false);
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    expect(existsSync(join(fx.userDataDir, "formatbuddy-startup-disabled", "items", disabled.entry!.id))).toBe(false);
  });

  it("does not report restore success when the holding entry folder still exists", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "KakaoTalk.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir)
    });

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      removeEntryDir: async () => undefined
    });

    expect(restored.status).toBe("failed");
    expect(existsSync(source)).toBe(true);
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    expect(existsSync(join(fx.userDataDir, "formatbuddy-startup-disabled", "items", disabled.entry!.id))).toBe(true);
  });

  it("does not write startup holding metadata through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "KakaoTalk.lnk");
    const entry = startupEntry(source, fx.startupDir);
    const now = new Date("2026-05-20T10:00:00.000Z");
    const disabledId = disabledIdFor(entry, now);
    const entryDir = join(fx.userDataDir, "formatbuddy-startup-disabled", "items", disabledId);
    const outsideMeta = join(fx.root, "outside-meta.json");
    writeFileSync(source, "shortcut");
    await mkdir(entryDir, { recursive: true });
    writeFileSync(outsideMeta, "outside stays put");
    symlinkSync(outsideMeta, join(entryDir, "meta.json"));

    const result = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry,
      now: () => now
    });

    expect(result.status).toBe("failed");
    expect(readFileSync(outsideMeta, "utf8")).toBe("outside stays put");
    expect(existsSync(source)).toBe(true);
    expect(readFileSync(source, "utf8")).toBe("shortcut");
  });

  it("blocks entries whose source is outside the startup folder origin", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const outside = join(fx.root, "Downloads", "Sneaky.lnk");
    await mkdir(join(fx.root, "Downloads"), { recursive: true });
    writeFileSync(outside, "not startup");

    const result = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(outside, fx.startupDir, "Sneaky.lnk")
    });

    expect(result.status).toBe("blocked-path");
    expect(existsSync(outside)).toBe(true);
    expect((await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir })).entries).toEqual([]);
  });

  it("only supports startup-folder entries", async () => {
    const fx = makeFixture();
    roots.push(fx.root);

    const result = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: {
        id: "registry|test|c:\\app.exe",
        kind: "registry",
        name: "Registry App",
        path: "C:\\app.exe",
        origin: "HKCU Run"
      }
    });

    expect(result.status).toBe("unsupported-kind");
  });

  it("refuses to move a startup item when the source is a symbolic link", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const real = join(fx.root, "real.lnk");
    const link = join(fx.startupDir, "Linked.lnk");
    writeFileSync(real, "shortcut");
    symlinkSync(real, link);

    const result = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(link, fx.startupDir, "Linked.lnk")
    });

    expect(result.status).toBe("blocked-path");
    expect(existsSync(link)).toBe(true);
  });

  it("does not restore over an existing startup item", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Steam.lnk");
    writeFileSync(source, "old shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Steam.lnk")
    });
    writeFileSync(source, "new shortcut");

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id
    });

    expect(restored.status).toBe("target-exists");
    expect(readFileSync(source, "utf8")).toBe("new shortcut");
    expect(existsSync(disabled.entry!.storedPath)).toBe(true);
  });

  it("does not trust a tampered restore record outside the managed holding area", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Whale.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Whale.lnk")
    });
    const outside = join(fx.root, "outside.lnk");
    writeFileSync(outside, "outside");
    const entryDir = join(fx.userDataDir, "formatbuddy-startup-disabled", "items", disabled.entry!.id);
    writeFileSync(
      join(entryDir, "meta.json"),
      JSON.stringify({ ...disabled.entry, storedPath: outside }, null, 2),
      "utf8"
    );

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id
    });

    expect(restored.status).toBe("blocked-path");
    expect(existsSync(source)).toBe(false);
    expect(readFileSync(outside, "utf8")).toBe("outside");
  });

  it("does not list a tampered startup holding record outside the managed holding area", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Whale.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Whale.lnk")
    });
    const outside = join(fx.root, "outside.lnk");
    writeFileSync(outside, "outside");
    const entryDir = join(fx.userDataDir, "formatbuddy-startup-disabled", "items", disabled.entry!.id);
    writeFileSync(
      join(entryDir, "meta.json"),
      JSON.stringify({ ...disabled.entry, storedPath: outside }, null, 2),
      "utf8"
    );

    const snapshot = await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir });

    expect(snapshot.entries).toEqual([]);
    expect(readFileSync(outside, "utf8")).toBe("outside");
  });
});
