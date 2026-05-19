import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CleanupItem } from "../src/shared/types";

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual("node:crypto");
  return {
    ...actual,
    randomUUID: () => "fixed-entry-id"
  };
});

const { moveToFormatBuddyTrash, __testing } = await import("../src/main/cleanup/trash");

interface Fixture {
  root: string;
  userData: string;
  home: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-trash-entry-link-"));
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

describe("FormatBuddy Trash entry folder safety", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("refuses to move a cleanup item when the target trash entry folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const entryDir = __testing.entryDir(fx.userData, "fixed-entry-id");
    const outsideEntry = join(fx.root, "outside-entry");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(__testing.itemsRoot(fx.userData), { recursive: true });
    await mkdir(outsideEntry, { recursive: true });
    await symlink(outsideEntry, entryDir, "dir");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/restore bin|복구함|link/i);

    await expect(readFile(source, "utf8")).resolves.toBe("hello");
    await expect(readdir(outsideEntry)).resolves.toEqual([]);
    expect(existsSync(entryDir)).toBe(true);
  });

  it("refuses to move a cleanup item when the target manifest file is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const entryDir = __testing.entryDir(fx.userData, "fixed-entry-id");
    const outsideManifest = join(fx.root, "outside-manifest.json");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(entryDir, { recursive: true });
    await writeFile(outsideManifest, "outside-original", "utf8");
    await symlink(outsideManifest, join(entryDir, "manifest.json"), "file");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/manifest|restore bin|복구함|link/i);

    await expect(readFile(source, "utf8")).resolves.toBe("hello");
    await expect(readFile(outsideManifest, "utf8")).resolves.toBe("outside-original");
    expect(existsSync(entryDir)).toBe(false);
  });

  it("refuses to move a cleanup item when the target files folder is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    const entryDir = __testing.entryDir(fx.userData, "fixed-entry-id");
    const outsideFiles = join(fx.root, "outside-files");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    await mkdir(entryDir, { recursive: true });
    await mkdir(outsideFiles, { recursive: true });
    await symlink(outsideFiles, join(entryDir, "files"), "dir");

    await expect(
      moveToFormatBuddyTrash({
        userDataDir: fx.userData,
        item: makeItem(source),
        sizeBytes: 5,
        home: fx.home
      })
    ).rejects.toThrow(/files|stored|restore bin|복구함|link/i);

    await expect(readFile(source, "utf8")).resolves.toBe("hello");
    await expect(readdir(outsideFiles)).resolves.toEqual([]);
    expect(existsSync(entryDir)).toBe(false);
  });
});
