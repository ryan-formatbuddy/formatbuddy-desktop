import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
});
