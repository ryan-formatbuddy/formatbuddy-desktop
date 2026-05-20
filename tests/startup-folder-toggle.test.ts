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
  restoreStartupFolderEntry,
  __testing
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
    expect(disabled.entry?.contentHash?.algorithm).toBe("sha256");
    expect(disabled.entry?.contentHash?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(disabled.entry?.integrityStatus).toBe("verified");
    expect(readFileSync(disabled.entry!.storedPath, "utf8")).toBe("shortcut");

    const snapshot = await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([disabled.entry!.id]);
    expect(snapshot.entries[0].integrityStatus).toBe("verified");

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

  it("does not purge an expired startup holding record with a stored path outside the holding entry", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Slack.lnk");
    const outside = join(fx.root, "outside-startup.lnk");
    writeFileSync(source, "shortcut");
    writeFileSync(outside, "outside stays put");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Slack.lnk"),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });
    writeFileSync(
      join(__testing.entryDir(fx.userDataDir, disabled.entry!.id), "meta.json"),
      JSON.stringify({ ...disabled.entry, storedPath: outside }, null, 2),
      "utf8"
    );

    const result = await purgeExpiredStartupFolderEntries({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-19T10:00:01.000Z")
    });

    expect(result).toMatchObject({
      purgedCount: 0,
      purgedIds: [],
      failedIds: [disabled.entry!.id],
      retentionDays: 30
    });
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside stays put");
  });

  it("blocks startup purge preflight when the expired holding entry folder is behind a link", async () => {
    if (process.platform === "win32") return;
    const fx = makeFixture();
    roots.push(fx.root);
    const disabledId = "expired-linked-startup";
    const entryDir = __testing.entryDir(fx.userDataDir, disabledId);
    const outsideEntryDir = join(fx.root, "outside-startup-entry");
    const entry = {
      id: disabledId,
      entryId: "startup-folder|linked",
      name: "Linked.lnk",
      originalPath: join(fx.startupDir, "Linked.lnk"),
      storedPath: join(__testing.filesRoot(fx.userDataDir, disabledId), "Linked.lnk"),
      origin: fx.startupDir,
      disabledAt: "2026-05-20T10:00:00.000Z",
      expiresAt: "2026-06-19T10:00:00.000Z"
    };

    await mkdir(__testing.itemsRoot(fx.userDataDir), { recursive: true });
    await mkdir(outsideEntryDir, { recursive: true });
    symlinkSync(outsideEntryDir, entryDir, "dir");

    await expect(
      __testing.assertSafeStartupDisabledEntryForPurge(fx.userDataDir, disabledId, entry)
    ).rejects.toThrow(/link|holding/i);
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

  it("does not restore a startup holding record when metadata moves the 30-day window into the future", async () => {
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
    writeFileSync(
      join(__testing.entryDir(fx.userDataDir, disabled.entry!.id), "meta.json"),
      JSON.stringify(
        {
          ...disabled.entry,
          disabledAt: "2027-05-20T10:00:00.000Z",
          expiresAt: "2027-06-19T10:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      now: () => new Date("2026-05-21T10:00:00.000Z")
    });

    expect(restored.status).toBe("expired");
    expect(existsSync(source)).toBe(false);
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(false);
  });

  it("does not restore a disabled startup item when the held file was changed", async () => {
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
    writeFileSync(disabled.entry!.storedPath, "changed shortcut");

    const snapshot = await listDisabledStartupFolderEntries({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-21T10:00:00.000Z")
    });
    expect(snapshot.entries[0].integrityStatus).toBe("changed");

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      now: () => new Date("2026-05-21T10:00:00.000Z")
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/바뀐|안전/);
    expect(restored.entry?.integrityStatus).toBe("changed");
    expect(existsSync(source)).toBe(false);
    expect(readFileSync(disabled.entry!.storedPath, "utf8")).toBe("changed shortcut");
  });

  it("does not restore a legacy disabled startup item without a holding hash", async () => {
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
    const { contentHash: _contentHash, integrityStatus: _integrityStatus, ...legacyEntry } = disabled.entry!;
    writeFileSync(
      join(__testing.entryDir(fx.userDataDir, disabled.entry!.id), "meta.json"),
      JSON.stringify(legacyEntry, null, 2),
      "utf8"
    );

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      now: () => new Date("2026-05-21T10:00:00.000Z")
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/기록|확인/);
    expect(restored.entry?.integrityStatus).toBe("legacy");
    expect(existsSync(source)).toBe(false);
    expect(readFileSync(disabled.entry!.storedPath, "utf8")).toBe("shortcut");
  });

  it("does not auto-empty an expired startup holding record when restore metadata points outside", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Teams.lnk");
    const outside = join(fx.root, "outside-restore-startup.lnk");
    writeFileSync(source, "shortcut");
    writeFileSync(outside, "outside stays put");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Teams.lnk"),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });
    writeFileSync(
      join(__testing.entryDir(fx.userDataDir, disabled.entry!.id), "meta.json"),
      JSON.stringify({ ...disabled.entry, storedPath: outside }, null, 2),
      "utf8"
    );

    const restored = await restoreStartupFolderEntry({
      userDataDir: fx.userDataDir,
      disabledId: disabled.entry!.id,
      now: () => new Date("2026-06-19T10:00:01.000Z")
    });

    expect(restored.status).toBe("blocked-path");
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside stays put");
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

  it("does not move a startup item when entry metadata contains control characters", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "KakaoTalk.lnk");
    writeFileSync(source, "shortcut");

    const result = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: {
        ...startupEntry(source, fx.startupDir),
        name: "KakaoTalk\n.lnk"
      }
    });

    expect(result.status).toBe("blocked-path");
    expect(existsSync(source)).toBe(true);
    expect(readFileSync(source, "utf8")).toBe("shortcut");
    expect((await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir })).entries).toEqual([]);
  });

  it("does not coerce disabled startup metadata with padded or control-character fields", () => {
    const fx = makeFixture();
    roots.push(fx.root);
    const valid = {
      id: "safe-startup-id",
      entryId: "startup-folder|app",
      name: "App.lnk",
      originalPath: join(fx.startupDir, "App.lnk"),
      storedPath: join(fx.userDataDir, "formatbuddy-startup-disabled", "items", "safe-startup-id", "files", "App.lnk"),
      origin: fx.startupDir,
      disabledAt: "2026-05-20T10:00:00.000Z",
      expiresAt: "2026-06-19T10:00:00.000Z"
    };

    for (const patch of [
      { entryId: " startup-folder|app" },
      { name: "App.lnk " },
      { originalPath: `${join(fx.startupDir, "App.lnk")}\n` },
      { storedPath: ` ${valid.storedPath}` },
      { origin: `${fx.startupDir}\u0000` }
    ]) {
      expect(__testing.coerceDisabledEntry({ ...valid, ...patch })).toBeNull();
    }
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

  it("refuses unsafe disabled startup ids without reading holding metadata", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    const unsafeIds = [
      "../outside",
      "startup/id",
      "startup\\id",
      "  ",
      " startup-1",
      "startup-1 ",
      "startup 1",
      "startup\nid",
      undefined as unknown as string
    ];

    for (const disabledId of unsafeIds) {
      const restored = await restoreStartupFolderEntry({
        userDataDir: fx.userDataDir,
        disabledId
      });

      expect(restored.status).toBe("not-found");
    }
  });

  it("does not coerce disabled startup metadata with unsafe ids", () => {
    const fx = makeFixture();
    roots.push(fx.root);
    for (const id of ["../outside", "", "  ", "bad id", "bad\nid", "bad\\id"]) {
      expect(
        __testing.coerceDisabledEntry({
          id,
          entryId: "startup-folder|app",
          name: "App.lnk",
          originalPath: join(fx.startupDir, "App.lnk"),
          storedPath: join(fx.userDataDir, "formatbuddy-startup-disabled", "items", "safe", "files", "App.lnk"),
          origin: fx.startupDir,
          disabledAt: "2026-05-20T10:00:00.000Z",
          expiresAt: "2026-06-19T10:00:00.000Z"
        })
      ).toBeNull();
    }
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

  it("prunes a disabled startup record when the held file is already missing", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Teams.lnk");
    writeFileSync(source, "shortcut");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Teams.lnk")
    });
    await rm(disabled.entry!.storedPath, { force: true });

    const snapshot = await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(false);
  });

  it("prunes a disabled startup record when the held file was replaced with a link", async () => {
    if (process.platform === "win32") return;
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Teams.lnk");
    const outside = join(fx.root, "outside-startup-target.lnk");
    writeFileSync(source, "shortcut");
    writeFileSync(outside, "outside stays put");

    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Teams.lnk")
    });
    await rm(disabled.entry!.storedPath, { force: true });
    symlinkSync(outside, disabled.entry!.storedPath);

    const snapshot = await listDisabledStartupFolderEntries({ userDataDir: fx.userDataDir });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(false);
    expect(readFileSync(outside, "utf8")).toBe("outside stays put");
  });
});
