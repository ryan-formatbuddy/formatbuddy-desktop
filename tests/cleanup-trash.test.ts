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
  restoreTrashEntry
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
});
