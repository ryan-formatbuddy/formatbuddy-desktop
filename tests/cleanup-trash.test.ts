import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CleanupItem } from "../src/shared/types";
import { summarizeTrashRestoreResults } from "../src/shared/cleanup-result";
import {
  FORMATBUDDY_TRASH_RETENTION_DAYS,
  assertManagedTrashEntryManifest,
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
    expect(snapshot.entries[0].integrityStatus).toBe("verified");
  });

  it("recovers a moved item when the trash index was blocked by a link", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");

    const outsideIndex = join(fx.root, "outside-index.json");
    await mkdir(join(__testing.indexPath(fx.userData), ".."), { recursive: true });
    await writeFile(outsideIndex, "outside-original", "utf8");
    await symlink(outsideIndex, __testing.indexPath(fx.userData));

    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
    await expect(readFile(outsideIndex, "utf8")).resolves.toBe("outside-original");

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.entries.map((e) => e.id)).toContain(entry.id);
  });

  it("caps a recovered manifest expiry to the 30-day window", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, expiresAt: "2027-05-19T00:00:00.000Z" }, null, 2),
      "utf8"
    );

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");

    const purge = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });
    expect(purge.purgedCount).toBe(1);
    expect(existsSync(entry.storedPath)).toBe(false);
  });

  it("does not purge earlier than 30 days even if a manifest expiry was shortened", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, expiresAt: "2026-05-20T00:00:00.000Z" }, null, 2),
      "utf8"
    );

    const earlyPurge = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-21T00:00:00.000Z")
    });
    expect(earlyPurge.purgedCount).toBe(0);

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-21T00:00:01.000Z")
    });
    expect(snapshot.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("does not restore a trash entry when metadata moves the 30-day window into the future", async () => {
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

    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify(
        {
          ...entry,
          createdAt: "2027-05-19T00:00:00.000Z",
          expiresAt: "2027-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result.status).toBe("not-found");
    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(false);
  });

  it("refreshes restore-bin snapshot sizes from the stored item on disk", async () => {
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

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    const actualBytes = Buffer.byteLength("hello and more bytes");
    expect(snapshot.entries[0].sizeBytes).toBe(actualBytes);
    expect(snapshot.entries[0].integrityStatus).toBe("changed");
    expect(snapshot.totalBytes).toBe(actualBytes);
  });

  it("marks restore-bin snapshot entries changed when same-size content was modified", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    const before = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(before.entries[0].integrityStatus).toBe("verified");

    await writeFile(before.entries[0].storedPath, "jello", "utf8");

    const after = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(after.entries[0].sizeBytes).toBe(5);
    expect(after.entries[0].integrityStatus).toBe("changed");
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

  it("refuses to move FormatBuddy's own user data into the restore bin", async () => {
    const source = join(fx.userData, "formatbuddy-state.json");
    await mkdir(dirname(source), { recursive: true });
    await writeFile(source, "state stays put", "utf8");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 14,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/FormatBuddy|포맷버디|managed data|앱 데이터/i);

    expect(await readFile(source, "utf8")).toBe("state stays put");
    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("refuses to move a folder that contains FormatBuddy's own user data", async () => {
    const source = fx.root;
    const statePath = join(fx.userData, "formatbuddy-state.json");
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, "state stays put", "utf8");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: {
          ...makeItem(source),
          label: "formatbuddy-root",
          sizeBytes: 14
        },
        sizeBytes: 14,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/FormatBuddy|포맷버디|managed data|앱 데이터/i);

    expect(await readFile(statePath, "utf8")).toBe("state stays put");
    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it.each([
    ["item id", () => ({ id: "" })],
    ["item id whitespace", () => ({ id: "  " })],
    ["item id padded", () => ({ id: " item-1" })],
    ["source path padded", (source: string) => ({ path: `${source} ` })],
    ["source path control", (source: string) => ({ path: `${source}\n` })],
    ["label", () => ({ label: "" })],
    ["label control", () => ({ label: "old.tmp\rmore" })],
    ["item size negative", () => ({ sizeBytes: -1 })],
    ["item size non-finite", () => ({ sizeBytes: Number.NaN })],
    ["category", () => ({ categoryId: "" })],
    ["category padded", () => ({ categoryId: " temp-user" })]
  ] as Array<[string, (source: string) => Partial<Record<keyof CleanupItem, unknown>>]>)(
    "refuses to create a restore-bin entry from unusable cleanup metadata: %s",
    async (_label, makePatch) => {
      const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
      await mkdir(join(source, ".."), { recursive: true });
      await writeFile(source, "hello", "utf8");
      const patch = makePatch(source);

      await expect(
        moveToFormatBuddyTrash({
          userDataDir: fx.userData,
          item: { ...makeItem(source), ...patch } as CleanupItem,
          sizeBytes: 5,
          home: fx.home,
          now: () => new Date("2026-05-19T00:00:00.000Z")
        })
      ).rejects.toThrow("cleanup-trash refuses unusable source metadata");

      expect(existsSync(source)).toBe(true);
      expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    "refuses to create a restore-bin entry from unusable measured size: %s",
    async (sizeBytes) => {
      const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
      await mkdir(join(source, ".."), { recursive: true });
      await writeFile(source, "hello", "utf8");

      await expect(
        moveToFormatBuddyTrash({
          userDataDir: fx.userData,
          item: makeItem(source),
          sizeBytes,
          home: fx.home,
          now: () => new Date("2026-05-19T00:00:00.000Z")
        })
      ).rejects.toThrow("cleanup-trash refuses unusable source metadata");

      expect(existsSync(source)).toBe(true);
      expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
    }
  );

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

  it("refuses to move a source folder that is too deep to inspect safely", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "deep-cache");
    let leaf = source;
    for (let i = 0; i < 40; i += 1) {
      leaf = join(leaf, `level-${i}`);
    }
    await mkdir(leaf, { recursive: true });
    await writeFile(join(leaf, "old.tmp"), "hello", "utf8");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: {
          ...makeItem(source),
          label: "deep-cache",
          sizeBytes: 5
        },
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/너무 깊|too deep|inspect/i);

    expect(existsSync(source)).toBe(true);
    expect(existsSync(join(leaf, "old.tmp"))).toBe(true);
    expect(existsSync(__testing.trashRoot(fx.userData))).toBe(false);
  });

  it("refuses to move a cleanup item when the managed trash items folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const itemsLink = __testing.itemsRoot(fx.userData);
    const outsideItems = join(fx.root, "outside-items");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(join(itemsLink, ".."), { recursive: true });
    await mkdir(outsideItems, { recursive: true });
    await symlink(outsideItems, itemsLink, "dir");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/복구함|restore bin|link/i);

    await expect(readFile(source, "utf8")).resolves.toBe("hello");
    await expect(readdir(outsideItems)).resolves.toEqual([]);
  });

  it("does not write the restore-bin index through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const outsideIndex = join(fx.root, "outside-index.json");
    const indexLink = __testing.indexPath(fx.userData);
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(__testing.trashRoot(fx.userData), { recursive: true });
    await writeFile(outsideIndex, "outside index stays put", "utf8");
    await symlink(outsideIndex, indexLink);

    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });

    expect(await readFile(outsideIndex, "utf8")).toBe("outside index stays put");
    expect((await lstat(indexLink)).isSymbolicLink()).toBe(false);
    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });
    expect(snapshot.entries.map((item) => item.id)).toEqual([entry.id]);
  });

  it("replaces a non-file restore-bin index path before recording a moved item", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const indexAsFolder = __testing.indexPath(fx.userData);
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(indexAsFolder, { recursive: true });
    await writeFile(join(indexAsFolder, "stale-child.txt"), "stale", "utf8");

    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
    const indexStat = await lstat(indexAsFolder);
    expect(indexStat.isFile()).toBe(true);
    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.entries.map((item) => item.id)).toEqual([entry.id]);
  });

  it("does not accept a restore manifest when the stored item is missing", async () => {
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
    await rm(entry.storedPath, { recursive: true, force: true });

    await expect(
      assertManagedTrashEntryManifest({
        userDataDir: fx.userData,
        entryId: entry.id,
        itemId: entry.itemId,
        categoryId: entry.categoryId,
        sizeBytes: entry.sizeBytes,
        originalPath: entry.originalPath,
        storedPath: entry.storedPath,
        expiresAt: entry.expiresAt,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/stored|저장|복구함/i);
  });

  it("does not accept a restore manifest when the stored item is a symbolic link", async () => {
    if (process.platform === "win32") return;
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
    const outside = join(fx.root, "outside-stored.tmp");
    await writeFile(outside, "outside stays put", "utf8");
    await rm(entry.storedPath, { recursive: true, force: true });
    await symlink(outside, entry.storedPath);

    await expect(
      assertManagedTrashEntryManifest({
        userDataDir: fx.userData,
        entryId: entry.id,
        itemId: entry.itemId,
        categoryId: entry.categoryId,
        sizeBytes: entry.sizeBytes,
        originalPath: entry.originalPath,
        storedPath: entry.storedPath,
        expiresAt: entry.expiresAt,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/link|링크/i);

    expect(await readFile(outside, "utf8")).toBe("outside stays put");
  });

  it("does not accept a restore manifest when the stored item size changed", async () => {
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
    await writeFile(entry.storedPath, "hello and more bytes", "utf8");

    await expect(
      assertManagedTrashEntryManifest({
        userDataDir: fx.userData,
        entryId: entry.id,
        itemId: entry.itemId,
        categoryId: entry.categoryId,
        sizeBytes: entry.sizeBytes,
        originalPath: entry.originalPath,
        storedPath: entry.storedPath,
        expiresAt: entry.expiresAt,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/stored.*size|size.*stored|복구함.*크기|크기.*복구함/i);
  });

  it("does not accept a restore manifest when the stored item content changed at the same size", async () => {
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
    expect(entry.contentHash?.algorithm).toBe("sha256");
    await writeFile(entry.storedPath, "jello", "utf8");

    await expect(
      assertManagedTrashEntryManifest({
        userDataDir: fx.userData,
        entryId: entry.id,
        itemId: entry.itemId,
        categoryId: entry.categoryId,
        sizeBytes: entry.sizeBytes,
        originalPath: entry.originalPath,
        storedPath: entry.storedPath,
        expiresAt: entry.expiresAt,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/stored.*hash|hash.*stored|내용|해시/i);
  });

  it("does not accept a newly created restore manifest without a content hash", async () => {
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

    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, contentHash: undefined }, null, 2),
      "utf8"
    );

    await expect(
      assertManagedTrashEntryManifest({
        userDataDir: fx.userData,
        entryId: entry.id,
        itemId: entry.itemId,
        categoryId: entry.categoryId,
        sizeBytes: entry.sizeBytes,
        originalPath: entry.originalPath,
        storedPath: entry.storedPath,
        expiresAt: entry.expiresAt,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      })
    ).rejects.toThrow(/hash|해시|내용/);
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

  it("does not report restore success when the restore-bin entry folder still exists", async () => {
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
      entryId: entry.id,
      removeEntryDir: async () => undefined
    });

    expect(result.status).toBe("restore-failed");
    expect(result.message).toContain("되돌리지 못했어요");
    expect(existsSync(source)).toBe(true);
    expect(existsSync(__testing.entryDir(fx.userData, entry.id))).toBe(true);
  });

  it("keeps restore failure messages friendly when the original folder cannot be recreated", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(dirname(source), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });

    await rm(dirname(source), { recursive: true, force: true });
    await writeFile(dirname(source), "not a folder", "utf8");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("restore-failed");
    expect(result.message).toContain("되돌리지 못했어요");
    expect(result.message).not.toMatch(/EEXIST|ENOTDIR|not a directory|operation not permitted|permission denied/i);
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("notifies the caller when an app-leftover entry is restored", async () => {
    const source = join(fx.home, "AppData", "Roaming", "Slack");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "cache.bin"), "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: {
        ...makeItem(source),
        label: "Slack",
        categoryId: "app-leftovers",
        riskLevel: "review",
        reason: "앱 제거 후 남은 AppData 후보",
        appName: "Slack",
        appPublisher: "Slack Technologies"
      },
      sizeBytes: 5,
      home: fx.home
    });
    const onAppLeftoverRestored = vi.fn();

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home,
      onAppLeftoverRestored
    });

    expect(result.status).toBe("restored");
    expect(onAppLeftoverRestored).toHaveBeenCalledTimes(1);
    expect(onAppLeftoverRestored).toHaveBeenCalledWith({
      name: "Slack",
      publisher: "Slack Technologies"
    });
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

  it("refuses restore through a symbolic-link ancestor even when home is omitted", async () => {
    if (process.platform === "win32") return;
    const appDataDir = join(fx.home, "AppData");
    const tempDir = join(appDataDir, "Local", "Temp");
    const source = join(tempDir, "old.tmp");
    await mkdir(tempDir, { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });

    const outside = join(fx.root, "outside-restore-ancestor");
    await rm(appDataDir, { recursive: true, force: true });
    await mkdir(join(outside, "Local", "Temp"), { recursive: true });
    await symlink(outside, appDataDir, "dir");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id
    });

    expect(result.status).toBe("blocked-path");
    expect(result.message).toMatch(/링크/);
    expect(existsSync(join(outside, "Local", "Temp", "old.tmp"))).toBe(false);
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

  it("refuses restore when the stored trash item size changed", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });
    await writeFile(entry.storedPath, "hello and more bytes", "utf8");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(result.message).toMatch(/크기|size|복구함/);
    expect(result.entry?.integrityStatus).toBe("changed");
    expect(summarizeTrashRestoreResults([result])).toBe(
      "1개는 복구함 안의 파일이 바뀐 것 같아 되돌리지 않았어요."
    );
    await expect(lstat(source)).rejects.toThrow();
    await expect(readFile(entry.storedPath, "utf8")).resolves.toBe("hello and more bytes");
  });

  it("refuses restore when the stored trash item content changed at the same size", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      home: fx.home
    });
    await writeFile(entry.storedPath, "jello", "utf8");

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: entry.id,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(result.message).toMatch(/내용|hash|해시|복구함/);
    expect(result.entry?.integrityStatus).toBe("changed");
    expect(summarizeTrashRestoreResults([result])).toBe(
      "1개는 복구함 안의 파일이 바뀐 것 같아 되돌리지 않았어요."
    );
    await expect(lstat(source)).rejects.toThrow();
    await expect(readFile(entry.storedPath, "utf8")).resolves.toBe("jello");
  });

  it("refuses restore when the managed trash parent folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const entryId = "linked-parent-entry";
    const itemsLink = __testing.itemsRoot(fx.userData);
    const outsideItems = join(fx.root, "outside-items");
    const originalPath = join(fx.home, "AppData", "Local", "Temp", "restored.tmp");
    const entryDir = __testing.entryDir(fx.userData, entryId);
    const storedPath = join(entryDir, "files", "old.tmp");
    await mkdir(outsideItems, { recursive: true });
    await mkdir(join(itemsLink, ".."), { recursive: true });
    await symlink(outsideItems, itemsLink, "dir");
    await mkdir(join(storedPath, ".."), { recursive: true });
    await writeFile(storedPath, "outside should stay in trash target", "utf8");
    await writeFile(
      join(entryDir, "manifest.json"),
      JSON.stringify(
        {
          id: entryId,
          itemId: "item-1",
          originalPath,
          storedPath,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 34,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId,
      home: fx.home
    });

    expect(result.status).toBe("blocked-path");
    expect(result.message).toMatch(/링크/);
    expect(await readFile(storedPath, "utf8")).toBe("outside should stay in trash target");
    expect(existsSync(originalPath)).toBe(false);
  });

  it("removes a trash entry from the snapshot when its stored item becomes a symbolic link", async () => {
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

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
    expect(existsSync(entry.storedPath)).toBe(false);
    expect(await readFile(outside, "utf8")).toBe("outside");
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

  it("does not count an expired entry as purged when its trash folder still exists", async () => {
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
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      removeEntryDir: async () => undefined
    });

    expect(purged.purgedCount).toBe(0);
    expect(purged.purgedBytes).toBe(0);
    expect(purged.purgedEntryIds).toEqual([]);
    expect(purged.failedEntryIds).toEqual([entry.id]);
    expect(existsSync(__testing.entryDir(fx.userData, entry.id))).toBe(true);
    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });
    expect(snapshot.entries.map((trashEntry) => trashEntry.id)).toEqual([entry.id]);
  });

  it("keeps other expired entries purgeable when one expired entry cannot be removed", async () => {
    const blockedSource = join(fx.home, "AppData", "Local", "Temp", "blocked.tmp");
    const okSource = join(fx.home, "AppData", "Local", "Temp", "ok.tmp");
    await mkdir(join(blockedSource, ".."), { recursive: true });
    await writeFile(blockedSource, "blocked", "utf8");
    await writeFile(okSource, "ok", "utf8");
    const blockedEntry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: { ...makeItem(blockedSource), id: "blocked", label: "blocked.tmp" },
      sizeBytes: 7,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    const okEntry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: { ...makeItem(okSource), id: "ok", label: "ok.tmp" },
      sizeBytes: 2,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    const purged = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      removeEntryDir: async (dir, entry) => {
        if (entry.id === blockedEntry.id) throw new Error("file is busy");
        await rm(dir, { recursive: true, force: true });
      }
    });

    expect(purged.purgedCount).toBe(1);
    expect(purged.purgedBytes).toBe(2);
    expect(purged.purgedEntryIds).toEqual([okEntry.id]);
    expect(purged.failedEntryIds).toEqual([blockedEntry.id]);
    expect(existsSync(blockedEntry.storedPath)).toBe(true);
    expect(existsSync(okEntry.storedPath)).toBe(false);
    const snapshot = await getTrashSnapshot({ userDataDir: fx.userData });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([blockedEntry.id]);
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

  it("purges an expired trash entry without counting bytes when the stored item is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const outside = join(fx.root, "outside-expired.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(outside, "outside should not count", "utf8");
    await rm(entry.storedPath, { force: true });
    await symlink(outside, entry.storedPath);

    const purged = await purgeExpiredTrash({
      userDataDir: fx.userData,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(purged.purgedCount).toBe(1);
    expect(purged.purgedBytes).toBe(0);
    expect(await readFile(outside, "utf8")).toBe("outside should not count");
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

  it("does not restore an expired entry even when automatic purge cannot remove it yet", async () => {
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
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      removeEntryDir: async () => {
        throw new Error("file is busy");
      }
    });

    expect(result.status).toBe("expired");
    expect(result.message).toMatch(/30일|기간/);
    expect(existsSync(source)).toBe(false);
    expect(existsSync(entry.storedPath)).toBe(true);
  });

  it("blocks unsafe restore entry ids before looking up the restore bin", async () => {
    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: "../outside"
    });

    expect(result).toMatchObject({
      entryId: "../outside",
      status: "blocked-path"
    });
    expect(result.message).toMatch(/복구함|안전/);
  });

  it("blocks non-string restore entry ids without throwing", async () => {
    const result = await restoreTrashEntry({
      userDataDir: fx.userData,
      entryId: undefined as unknown as string
    });

    expect(result.status).toBe("blocked-path");
    expect(result.message).toMatch(/복구함|안전/);
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

  it("refuses restore when the manifest originalPath points into FormatBuddy user data", async () => {
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
    const blockedOriginalPath = join(fx.userData, "formatbuddy-state.json");
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
    expect(result.message).toMatch(/FormatBuddy|포맷버디|managed data|앱 데이터/i);
    expect(result.originalPath).toBe(blockedOriginalPath);
    expect(existsSync(entry.storedPath)).toBe(true);
    expect(existsSync(blockedOriginalPath)).toBe(false);
  });

  it("refuses restore when the manifest originalPath is relative", async () => {
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
    const relativeOriginalPath = `relative-restore-${entry.id}.tmp`;
    await writeFile(
      join(__testing.entryDir(fx.userData, entry.id), "manifest.json"),
      JSON.stringify({ ...entry, originalPath: relativeOriginalPath }, null, 2),
      "utf8"
    );

    try {
      const result = await restoreTrashEntry({
        userDataDir: fx.userData,
        entryId: entry.id,
        home: fx.home
      });

      expect(result.status).toBe("blocked-path");
      expect(result.originalPath).toBe(relativeOriginalPath);
      expect(existsSync(entry.storedPath)).toBe(true);
      expect(existsSync(relativeOriginalPath)).toBe(false);
    } finally {
      await rm(relativeOriginalPath, { force: true }).catch(() => {});
    }
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

  it("ignores recovered manifests that escape through parent directory segments", async () => {
    const orphanDir = __testing.entryDir(fx.userData, "traversal");
    const folder = join(orphanDir, "files");
    await mkdir(folder, { recursive: true });
    const outside = join(__testing.trashRoot(fx.userData), "escaped.txt");
    const traversalPath = `${folder}/../../../escaped.txt`;
    await writeFile(outside, "outside stays put", "utf8");
    await writeFile(
      join(orphanDir, "manifest.json"),
      JSON.stringify(
        {
          id: "traversal",
          itemId: "item-evil",
          originalPath: join(fx.home, "restored.txt"),
          storedPath: traversalPath,
          label: "escaped.txt",
          categoryId: "temp-user",
          sizeBytes: 17,
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
    expect(snapshot.totalBytes).toBe(0);
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
    expect(existsSync(orphanDir)).toBe(false);
  });

  it("ignores recovered manifests that point at the restore files folder itself", async () => {
    const entryId = "files-root";
    const orphanDir = __testing.entryDir(fx.userData, entryId);
    const filesRoot = join(orphanDir, "files");
    await mkdir(filesRoot, { recursive: true });
    await writeFile(join(filesRoot, "old.tmp"), "stored bytes", "utf8");
    await writeFile(
      join(orphanDir, "manifest.json"),
      JSON.stringify(
        {
          id: entryId,
          itemId: "item-files-root",
          originalPath: join(fx.home, "restored.txt"),
          storedPath: filesRoot,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 12,
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
    expect(snapshot.totalBytes).toBe(0);
    expect(existsSync(orphanDir)).toBe(false);
  });

  it("ignores recovered manifests when the entry manifest file is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const entryId = "manifest-link";
    const orphanDir = __testing.entryDir(fx.userData, entryId);
    const storedPath = join(orphanDir, "files", "old.tmp");
    const outsideManifest = join(fx.root, "outside-manifest.json");
    await mkdir(join(storedPath, ".."), { recursive: true });
    await writeFile(storedPath, "stored bytes", "utf8");
    await writeFile(
      outsideManifest,
      JSON.stringify(
        {
          id: entryId,
          itemId: "item-linked-manifest",
          originalPath: join(fx.home, "restored.txt"),
          storedPath,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 12,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    await symlink(outsideManifest, join(orphanDir, "manifest.json"));

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(await readFile(outsideManifest, "utf8")).toContain("item-linked-manifest");
    expect(existsSync(orphanDir)).toBe(false);
  });

  it("ignores recovered manifests when the managed trash items folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const entryId = "linked-items-entry";
    const itemsLink = __testing.itemsRoot(fx.userData);
    const outsideItems = join(fx.root, "outside-items");
    const outsideEntryDir = join(outsideItems, entryId);
    const outsideStoredPath = join(outsideEntryDir, "files", "old.tmp");
    const storedPathThroughLink = join(itemsLink, entryId, "files", "old.tmp");
    await mkdir(join(itemsLink, ".."), { recursive: true });
    await mkdir(join(outsideStoredPath, ".."), { recursive: true });
    await writeFile(outsideStoredPath, "outside stays out", "utf8");
    await writeFile(
      join(outsideEntryDir, "manifest.json"),
      JSON.stringify(
        {
          id: entryId,
          itemId: "item-linked",
          originalPath: join(fx.home, "restored.txt"),
          storedPath: storedPathThroughLink,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 17,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    await symlink(outsideItems, itemsLink, "dir");

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
    expect(await readFile(outsideStoredPath, "utf8")).toBe("outside stays out");
  });

  it("ignores recovered manifests when the managed trash root folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const entryId = "linked-trash-root-entry";
    const trashLink = __testing.trashRoot(fx.userData);
    const outsideTrash = join(fx.root, "outside-trash-root");
    const outsideEntryDir = join(outsideTrash, "items", entryId);
    const outsideStoredPath = join(outsideEntryDir, "files", "old.tmp");
    const storedPathThroughLink = join(trashLink, "items", entryId, "files", "old.tmp");
    await mkdir(join(trashLink, ".."), { recursive: true });
    await mkdir(join(outsideStoredPath, ".."), { recursive: true });
    await writeFile(outsideStoredPath, "outside root stays out", "utf8");
    await writeFile(
      join(outsideEntryDir, "manifest.json"),
      JSON.stringify(
        {
          id: entryId,
          itemId: "item-linked-root",
          originalPath: join(fx.home, "restored.txt"),
          storedPath: storedPathThroughLink,
          label: "old.tmp",
          categoryId: "temp-user",
          sizeBytes: 22,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    await symlink(outsideTrash, trashLink, "dir");

    const snapshot = await getTrashSnapshot({
      userDataDir: fx.userData,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.totalBytes).toBe(0);
    expect(await readFile(outsideStoredPath, "utf8")).toBe("outside root stays out");
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

  it.each(["../outside", "", "  ", "bad\nid", "bad\\id"])(
    "rejects unsafe trash entry ids while coercing stored metadata: %s",
    (id) => {
      const entry = {
        id,
        itemId: "item-1",
        originalPath: join(fx.home, "restored.tmp"),
        storedPath: join(__testing.itemsRoot(fx.userData), "safe", "files", "old.tmp"),
        label: "old.tmp",
        categoryId: "temp-user",
        sizeBytes: 5,
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z"
      };

      expect(__testing.coerceEntry(entry)).toBeNull();
      expect(__testing.coerceIndex({ version: 1, retentionDays: 30, entries: [entry] }).entries).toEqual(
        []
      );
    }
  );

  it.each([
    ["itemId", ""],
    ["itemId", "  "],
    ["originalPath", ""],
    ["originalPath", "   "],
    ["originalPath", `C:\\Users\\Ryan\\bad\u0000path.tmp`],
    ["storedPath", ""],
    ["storedPath", `C:\\Users\\Ryan\\bad\npath.tmp`],
    ["label", ""],
    ["label", "old.tmp\rmore"],
    ["categoryId", ""],
    ["categoryId", "   "]
  ] as Array<[("itemId" | "originalPath" | "storedPath" | "label" | "categoryId"), string]>)(
    "rejects unusable trash metadata strings while coercing stored metadata: %s",
    (field, value) => {
      const entry = {
        id: "safe-entry",
        itemId: "item-1",
        originalPath: join(fx.home, "restored.tmp"),
        storedPath: join(__testing.itemsRoot(fx.userData), "safe-entry", "files", "old.tmp"),
        label: "old.tmp",
        categoryId: "temp-user",
        sizeBytes: 5,
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z",
        [field]: value
      };

      expect(__testing.coerceEntry(entry)).toBeNull();
      expect(__testing.coerceIndex({ version: 1, retentionDays: 30, entries: [entry] }).entries).toEqual(
        []
      );
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite trash sizes while coercing stored metadata",
    (sizeBytes) => {
      const entry = {
        id: "safe-entry",
        itemId: "item-1",
        originalPath: join(fx.home, "restored.tmp"),
        storedPath: join(__testing.itemsRoot(fx.userData), "safe-entry", "files", "old.tmp"),
        label: "old.tmp",
        categoryId: "temp-user",
        sizeBytes,
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z"
      };

      expect(__testing.coerceEntry(entry)).toBeNull();
      expect(__testing.coerceIndex({ version: 1, retentionDays: 30, entries: [entry] }).entries).toEqual([]);
    }
  );

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
