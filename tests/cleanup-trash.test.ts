import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CleanupItem } from "../src/shared/types";
import {
  FORMATBUDDY_TRASH_RETENTION_DAYS,
  getTrashSnapshot,
  moveToFormatBuddyTrash,
  purgeExpiredTrash,
  restoreTrashEntry,
  __testing
} from "../src/main/cleanup/trash";

interface Fixture {
  root: string;
  userData: string;
  home: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-trash-"));
  return {
    root,
    userData: join(root, "userdata"),
    home: join(root, "home"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

function makeItem(path: string): CleanupItem {
  return {
    id: "item-1",
    path,
    label: "old.tmp",
    sizeBytes: 5,
    categoryId: "temp-user",
    riskLevel: "safe",
    reason: "테스트 임시 파일"
  };
}

describe("FormatBuddy Trash", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("moves a selected cleanup item into the 30-day restore bin", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");

    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
    expect(entry.expiresAt).toBe("2026-06-18T00:00:00.000Z");

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.retentionDays).toBe(FORMATBUDDY_TRASH_RETENTION_DAYS);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.totalBytes).toBe(5);
  });

  it("refuses to move protected system paths into the restore bin", async () => {
    const blockedPath = "C:\\Windows\\System32\\drivers\\etc\\hosts";

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(blockedPath),
        sizeBytes: 5,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow("cleanup-trash refuses protected source path");

    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("refuses to move user-scoped sensitive folders into the restore bin", async () => {
    const npkiPath = join(fx.home, "AppData", "Roaming", "NPKI", "user-cert.dat");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(npkiPath),
        sizeBytes: 5,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow("cleanup-trash refuses protected source path");

    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("refuses to move a source path through a symbolic-link parent", async () => {
    if (process.platform === "win32") return;
    const tempDir = join(fx.home, "AppData", "Local", "Temp");
    const source = join(tempDir, "old.tmp");
    const outside = join(fx.root, "outside-source");
    await mkdir(join(tempDir, ".."), { recursive: true });
    await mkdir(outside, { recursive: true });
    await symlink(outside, tempDir, "dir");
    await writeFile(join(outside, "old.tmp"), "hello", "utf8");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/링크/);

    expect(existsSync(join(outside, "old.tmp"))).toBe(true);
    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("refuses to move a source folder that contains a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old-cache");
    const outside = join(fx.root, "outside-cache");
    await mkdir(source, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(source, "visible.tmp"), "hello", "utf8");
    await symlink(outside, join(source, "linked-cache"), "dir");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: {
          ...makeItem(source),
          label: "old-cache",
          sizeBytes: 5
        },
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/링크/);

    expect(existsSync(source)).toBe(true);
    expect(existsSync(join(source, "linked-cache"))).toBe(true);
    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("removes a prewritten trash entry folder when the source disappears before move", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "gone.tmp");
    await mkdir(join(source, ".."), { recursive: true });

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow();

    const itemDirs = await readdir(__testing.itemsRoot(fx.userData)).catch(() => []);
    expect(itemDirs).toEqual([]);

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
  });

  it("restores an entry to the original path and removes it from the index", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5
    });

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });

    expect(result.status).toBe("restored");
    expect(await readFile(source, "utf8")).toBe("hello");
    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("refuses restore when a same-name item already exists at the original path", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5
    });
    await writeFile(source, "new file", "utf8");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });

    expect(result.status).toBe("target-exists");
    expect(await readFile(source, "utf8")).toBe("new file");
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("refuses restore when the original parent folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const tempDir = join(fx.home, "AppData", "Local", "Temp");
    const source = join(tempDir, "old.tmp");
    await mkdir(tempDir, { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });

    const outside = join(fx.root, "outside-restore");
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(outside, { recursive: true });
    await symlink(outside, tempDir, "dir");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(existsSync(join(outside, "old.tmp"))).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("refuses restore when the stored trash item was replaced with a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });

    const outside = join(fx.root, "outside-stored.tmp");
    await writeFile(outside, "outside", "utf8");
    await rm(entry.storedPath, { force: true });
    await symlink(outside, entry.storedPath);

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    await expect(lstat(source)).rejects.toThrow();
    await expect(readFile(outside, "utf8")).resolves.toBe("outside");
    const storedStat = await lstat(entry.storedPath);
    expect(storedStat.isSymbolicLink()).toBe(true);
  });

  it("refuses restore when a stored trash folder contains a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old-cache");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "visible.tmp"), "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: {
        ...makeItem(source),
        label: "old-cache",
        sizeBytes: 5
      },
      sizeBytes: 5,
      home: fx.home
    });

    const outside = join(fx.root, "outside-restore-cache");
    await mkdir(outside, { recursive: true });
    await symlink(outside, join(entry.storedPath, "linked-cache"), "dir");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
    expect(existsSync(join(entry.storedPath, "linked-cache"))).toBe(true);
    expect(existsSync(join(outside, "old-cache"))).toBe(false);
  });

  it("permanently purges entries after 30 days", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    const purged = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(purged.purgedCount).toBe(1);
    expect(purged.purgedBytes).toBe(5);
    expect(purged.purgedEntryIds).toEqual([entry.id]);
    expect(existsSync(entry.storedPath)).toBe(false);
    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("reports the actual stored bytes purged after 30 days", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(entry.storedPath, "hello and more bytes", "utf8");

    const purged = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(purged.purgedBytes).toBe(Buffer.byteLength("hello and more bytes"));
    expect(existsSync(entry.storedPath)).toBe(false);
  });

  it("reports nested folder bytes when an expired trash folder is purged", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old-cache");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "visible.tmp"), "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: {
        ...makeItem(source),
        label: "old-cache",
        sizeBytes: 5
      },
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await mkdir(join(entry.storedPath, "nested"), { recursive: true });
    await writeFile(join(entry.storedPath, "nested", "extra.tmp"), "more", "utf8");

    const purged = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(purged.purgedBytes).toBe(Buffer.byteLength("hello") + Buffer.byteLength("more"));
    expect(existsSync(entry.storedPath)).toBe(false);
  });

  it("does not restore an expired entry when restore is called directly", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result.status).toBe("not-found");
    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(false);
  });

  it("prunes broken entries when the stored item is already missing", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5
    });

    rmSync(entry.storedPath, { recursive: true, force: true });

    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });

    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
  });

  it("recovers a trash entry from its manifest when the index is lost", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(__testing.indexPath(fx.userData), JSON.stringify({ version: 1, entries: [] }), "utf8");

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].id).toBe(entry.id);

    const restored = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });
    expect(restored.status).toBe("restored");
    expect(await readFile(source, "utf8")).toBe("hello");
  });

  it("restores to the manifest original path when the index originalPath was changed", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    const hijackPath = join(fx.root, "hijack.tmp");
    await writeFile(
      __testing.indexPath(fx.userData),
      JSON.stringify(
        {
          version: 1,
          retentionDays: 30,
          entries: [{ ...entry, originalPath: hijackPath }]
        },
        null,
        2
      ),
      "utf8"
    );

    const restored = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });

    expect(restored.status).toBe("restored");
    expect(await readFile(source, "utf8")).toBe("hello");
    expect(existsSync(hijackPath)).toBe(false);
  });

  it("refuses restore when the manifest originalPath is a protected system path", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    const blockedOriginalPath = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, originalPath: blockedOriginalPath }, null, 2),
      "utf8"
    );

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });

    expect(result.status).toBe("blocked-path");
    expect(result.originalPath).toBe(blockedOriginalPath);
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("refuses restore when the manifest originalPath is a user-scoped sensitive path", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    const blockedOriginalPath = join(fx.home, "AppData", "Roaming", "NPKI", "user-cert.dat");
    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, originalPath: blockedOriginalPath }, null, 2),
      "utf8"
    );

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(result.originalPath).toBe(blockedOriginalPath);
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("ignores recovered manifests that point outside their trash entry folder", async () => {
    const orphanDir = __testing.entryDir(fx.userData, "orphan");
    const folder = join(orphanDir, "files");
    await mkdir(folder, { recursive: true });
    const outside = join(fx.root, "outside.txt");
    await writeFile(outside, "do not move", "utf8");
    await writeFile(
      join(__testing.entryDir(fx.userData, "orphan"), "manifest.json"),
      JSON.stringify(
        {
          id: "orphan",
          itemId: "item-evil",
          originalPath: join(fx.home, "restored.txt"),
          storedPath: outside,
          label: "outside.txt",
          categoryId: "temp-user",
          sizeBytes: 11,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(await readFile(outside, "utf8")).toBe("do not move");
    expect(existsSync(orphanDir)).toBe(false);
  });

  it("cleans a failed prewritten trash manifest when no stored file exists", async () => {
    const orphanDir = __testing.entryDir(fx.userData, "failed-move");
    const storedPath = join(orphanDir, "files", "old.tmp");
    await mkdir(orphanDir, { recursive: true });
    await writeFile(
      join(orphanDir, "manifest.json"),
      JSON.stringify(
        {
          id: "failed-move",
          itemId: "item-1",
          originalPath: join(fx.home, "old.tmp"),
          storedPath,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 5,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(existsSync(orphanDir)).toBe(false);
  });

  it("prunes unexpected files and links inside the managed trash items folder", async () => {
    if (process.platform === "win32") return;
    const itemsRoot = __testing.itemsRoot(fx.userData);
    const outside = join(fx.root, "outside-unmanaged.txt");
    const unmanagedFile = join(itemsRoot, "loose.tmp");
    const unmanagedLink = join(itemsRoot, "linked-outside");
    await mkdir(itemsRoot, { recursive: true });
    await writeFile(outside, "outside stays put", "utf8");
    await writeFile(unmanagedFile, "loose", "utf8");
    await symlink(outside, unmanagedLink);

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(existsSync(unmanagedFile)).toBe(false);
    expect(existsSync(unmanagedLink)).toBe(false);
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
  });

  it("ignores index entries that point outside the managed trash folder", async () => {
    const outside = join(fx.root, "outside-index.txt");
    await writeFile(outside, "outside stays put", "utf8");
    await mkdir(__testing.trashRoot(fx.userData), { recursive: true });
    await writeFile(
      __testing.indexPath(fx.userData),
      JSON.stringify(
        {
          version: 1,
          retentionDays: 30,
          entries: [
            {
              id: "index-evil",
              itemId: "item-evil",
              originalPath: join(fx.home, "restored.txt"),
              storedPath: outside,
              label: "outside-index.txt",
              categoryId: "temp-user",
              sizeBytes: 17,
              createdAt: "2026-05-19T00:00:00.000Z",
              expiresAt: "2026-06-18T00:00:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
  });

  it("ignores index entries without a matching entry manifest", async () => {
    const entryDir = __testing.entryDir(fx.userData, "index-only");
    const storedPath = join(entryDir, "files", "old.tmp");
    await mkdir(join(storedPath, ".."), { recursive: true });
    await writeFile(storedPath, "hello", "utf8");
    await mkdir(__testing.trashRoot(fx.userData), { recursive: true });
    await writeFile(
      __testing.indexPath(fx.userData),
      JSON.stringify(
        {
          version: 1,
          retentionDays: 30,
          entries: [
            {
              id: "index-only",
              itemId: "item-1",
              originalPath: join(fx.home, "restored.tmp"),
              storedPath,
              label: "old.tmp",
              categoryId: "temp-user",
              sizeBytes: 5,
              createdAt: "2026-05-19T00:00:00.000Z",
              expiresAt: "2026-06-18T00:00:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    const restored = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: "index-only"
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(restored.status).toBe("not-found");
    expect(existsSync(entryDir)).toBe(false);
  });
});
