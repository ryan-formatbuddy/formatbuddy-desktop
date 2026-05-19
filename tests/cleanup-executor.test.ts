import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultDeps, executeCleanup, type ExecutorDeps } from "../src/main/cleanup/executor";
import {
  consumePlan,
  planCleanup,
  __resetPlanCacheForTests
} from "../src/main/cleanup/planner";
import { getCleanupHistory } from "../src/main/cleanup/log";
import type { CleanupPlan } from "../src/shared/types";

const TEN_DAYS_MS = 10 * 86_400_000;

interface Fixture {
  root: string;
  userData: string;
  home: string;
  tempDir: string;
  systemRoot: string;
  systemDrive: string;
  localAppData: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-exec-"));
  return {
    root,
    userData: join(root, "userdata"),
    home: join(root, "home"),
    tempDir: join(root, "home", "AppData", "Local", "Temp"),
    systemRoot: join(root, "WindowsSystemRoot"),
    systemDrive: root,
    localAppData: join(root, "home", "AppData", "Local"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

async function writeAged(path: string, size: number, ageMs: number): Promise<void> {
  await fs.mkdir(join(path, ".."), { recursive: true });
  await fs.writeFile(path, "x".repeat(size), "utf8");
  const t = new Date(Date.now() - ageMs);
  await fs.utimes(path, t, t);
}

async function planWithOneTempFile(fx: Fixture, filePath: string): Promise<CleanupPlan> {
  await writeAged(filePath, 4096, TEN_DAYS_MS);
  return planCleanup({
    env: {
      home: fx.home,
      tempDir: fx.tempDir,
      systemRoot: fx.systemRoot,
      systemDrive: fx.systemDrive,
      localAppData: fx.localAppData
    }
  });
}

function makeSpyDeps(overrides: Partial<ExecutorDeps> = {}): {
  deps: ExecutorDeps;
  trashed: string[];
  permanently: string[];
  recycleBinEmptyCount: { value: number };
  trashExpiresAt: string;
} {
  const trashed: string[] = [];
  const permanently: string[] = [];
  const recycleBinEmptyCount = { value: 0 };
  const trashExpiresAt = "2026-06-18T00:00:00.000Z";
  const deps: ExecutorDeps = {
    trashItem: async (item, _sizeBytes, context) => {
      trashed.push(item.path);
      const storedPath = join(context.userDataDir, "formatbuddy-trash", "items", `spy-${item.id}`, "files", "stored");
      await fs.mkdir(join(storedPath, ".."), { recursive: true });
      await fs.writeFile(storedPath, "stored", "utf8");
      await fs.rm(item.path, { recursive: true, force: true });
      return { id: `trash-${item.id}`, expiresAt: trashExpiresAt, storedPath };
    },
    permanentRemove: async (p) => {
      permanently.push(p);
      await fs.rm(p, { recursive: true, force: true });
    },
    statSize: async (p) => {
      try {
        const stat = await fs.stat(p);
        return stat.size;
      } catch {
        return null;
      }
    },
    emptyRecycleBin: async () => {
      recycleBinEmptyCount.value += 1;
    },
    ...overrides
  };
  return { deps, trashed, permanently, recycleBinEmptyCount, trashExpiresAt };
}

describe("executeCleanup", () => {
  let fx: Fixture;

  beforeEach(() => {
    __resetPlanCacheForTests();
    fx = makeFixture();
  });

  afterEach(() => {
    __resetPlanCacheForTests();
    fx.cleanup();
  });

  it("trashes selected items and skips the rest as not-selected", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const otherFile = join(fx.tempDir, "old2.tmp");
    await writeAged(targetFile, 1024, TEN_DAYS_MS);
    await writeAged(otherFile, 1024, TEN_DAYS_MS);

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const chosen = tempUser.items.find((i) => i.path === targetFile)!;
    const other = tempUser.items.find((i) => i.path === otherFile)!;

    const { deps, trashed, trashExpiresAt } = makeSpyDeps();
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [chosen.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(trashed).toEqual([targetFile]);
    expect(result.removedItems.map((i) => i.path)).toEqual([targetFile]);
    expect(result.removedItems[0].trashEntryId).toBe(`trash-${chosen.id}`);
    expect(result.removedItems[0].expiresAt).toBe(trashExpiresAt);
    expect(result.skippedItems.find((s) => s.itemId === other.id)?.reason).toBe("not-selected");
    expect(result.totalFreedBytes).toBeGreaterThan(0);
  });

  it("permanent mode routes through permanentRemove instead of the recycle bin", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];

    const { deps, trashed, permanently } = makeSpyDeps();
    await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "permanent"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([targetFile]);
  });

  it("permanent mode refuses a selected path that now goes through a symbolic-link parent", async () => {
    if (process.platform === "win32") return;
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];

    const outside = join(fx.root, "outside-permanent");
    await fs.rm(fx.tempDir, { recursive: true, force: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.symlink(outside, fx.tempDir, "dir");
    await fs.writeFile(join(outside, "old1.tmp"), "outside", "utf8");

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "permanent"
      },
      { userDataDir: fx.userData, deps: defaultDeps(fx.userData), home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: item.id,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/링크/);
    await expect(fs.readFile(join(outside, "old1.tmp"), "utf8")).resolves.toBe("outside");
  });

  it("permanent mode rechecks the path after measurement before deleting", async () => {
    if (process.platform === "win32") return;
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];
    const outside = join(fx.root, "outside-after-measure");

    const { deps } = makeSpyDeps({
      statSize: async () => {
        await fs.rm(fx.tempDir, { recursive: true, force: true });
        await fs.mkdir(outside, { recursive: true });
        await fs.symlink(outside, fx.tempDir, "dir");
        await fs.writeFile(join(outside, "old1.tmp"), "outside", "utf8");
        return 7;
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "permanent"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: item.id,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/링크/);
    await expect(fs.readFile(join(outside, "old1.tmp"), "utf8")).resolves.toBe("outside");
  });

  it("uses the latest zero-byte measurement instead of stale plan size", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];
    await fs.writeFile(targetFile, "", "utf8");

    const { deps } = makeSpyDeps();
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems[0].sizeBytes).toBe(0);
    expect(result.totalFreedBytes).toBe(0);
  });

  it("measures selected folders by their file contents, not directory metadata", async () => {
    const folder = join(fx.tempDir, "old-cache");
    await fs.mkdir(join(folder, "nested"), { recursive: true });
    await fs.writeFile(join(folder, "a.tmp"), "12345", "utf8");
    await fs.writeFile(join(folder, "nested", "b.tmp"), "1234567", "utf8");

    const size = await defaultDeps(fx.userData).statSize(folder);

    expect(size).toBe(12);
  });

  it("returns null when folder contents cannot be measured", async () => {
    if (process.platform === "win32") return;
    const folder = join(fx.tempDir, "locked-cache");
    await fs.mkdir(folder, { recursive: true });
    await fs.chmod(folder, 0o000);

    try {
      const size = await defaultDeps(fx.userData).statSize(folder);
      expect(size).toBeNull();
    } finally {
      await fs.chmod(folder, 0o700).catch(() => {});
    }
  });

  it("returns null when any child folder cannot be measured", async () => {
    if (process.platform === "win32") return;
    const folder = join(fx.tempDir, "mixed-cache");
    const locked = join(folder, "locked");
    await fs.mkdir(locked, { recursive: true });
    await fs.writeFile(join(folder, "visible.tmp"), "12345", "utf8");
    await fs.writeFile(join(locked, "hidden.tmp"), "1234567", "utf8");
    await fs.chmod(locked, 0o000);

    try {
      const size = await defaultDeps(fx.userData).statSize(folder);
      expect(size).toBeNull();
    } finally {
      await fs.chmod(locked, 0o700).catch(() => {});
    }
  });

  it("returns null when folder depth exceeds the measurement limit", async () => {
    let current = join(fx.tempDir, "deep-cache");
    for (let i = 0; i < 34; i += 1) {
      current = join(current, `level-${i}`);
    }
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(join(current, "deep.tmp"), "12345", "utf8");

    const size = await defaultDeps(fx.userData).statSize(join(fx.tempDir, "deep-cache"));

    expect(size).toBeNull();
  });

  it("returns null for a selected symbolic link instead of counting it as zero-byte cleanup", async () => {
    if (process.platform === "win32") return;
    const target = join(fx.tempDir, "target.tmp");
    const link = join(fx.tempDir, "target-link.tmp");
    await fs.mkdir(fx.tempDir, { recursive: true });
    await fs.writeFile(target, "12345", "utf8");
    await fs.symlink(target, link);

    const size = await defaultDeps(fx.userData).statSize(link);

    expect(size).toBeNull();
  });

  it("returns null when a selected folder contains a symbolic link", async () => {
    if (process.platform === "win32") return;
    const folder = join(fx.tempDir, "mixed-cache");
    const outside = join(fx.root, "outside-cache");
    await fs.mkdir(folder, { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(join(folder, "visible.tmp"), "12345", "utf8");
    await fs.symlink(outside, join(folder, "linked-cache"), "dir");

    const size = await defaultDeps(fx.userData).statSize(folder);

    expect(size).toBeNull();
  });

  it("refuses to run when the confirmationToken is wrong", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: "nope-not-the-real-token",
          selectedItemIds: [item.id],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/could not match a current plan/);
  });

  it("refuses to run when selectedItemIds is empty", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const { deps } = makeSpyDeps();
    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/at least one selected item/);
    // The plan should NOT be consumed when the request was invalid —
    // the caller should still be able to retry with the right shape.
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
  });

  it("refuses non-string selected item ids before consuming the plan", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [item.id, 42],
          mode: "trash"
        } as never,
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/selectedItemIds/);

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
  });

  it("records a log entry that survives a subsequent getCleanupHistory call", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps();
    await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );
    const history = await getCleanupHistory(fx.userData);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].mode).toBe("trash");
    expect(history.entries[0].removedCount).toBe(1);
    expect(history.entries[0].categories[0].categoryId).toBe("temp-user");
  });

  it("reports execute-failed when the dep throws, without crashing the run", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async () => {
        throw new Error("simulated lock");
      }
    });
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );
    expect(result.removedItems).toHaveLength(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure).toBeDefined();
    expect(failure?.detail).toMatch(/simulated lock/);
  });

  it("does not count trash mode as successful without a restore entry id", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async () => undefined
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/restore entry/i);
  });

  it("does not count trash mode as successful without a valid restore expiry", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "bad-expiry", "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: "trash-without-expiry", expiresAt: "not-a-date", storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/restore expiry/i);
  });

  it("does not count trash mode as successful without a real stored trash path", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: "trash-without-stored-path",
          expiresAt: "2026-06-18T00:00:00.000Z"
        } as never;
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/stored trash path/i);
  });

  it("does not count trash mode as successful when the stored path is outside the managed restore bin", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const outsideStoredPath = join(fx.root, "outside-trash", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(outsideStoredPath, ".."), { recursive: true });
        await fs.writeFile(outsideStoredPath, "stored outside", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: "trash-outside-managed-bin",
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath: outsideStoredPath
        };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    expect(await fs.readFile(outsideStoredPath, "utf8")).toBe("stored outside");
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/managed restore bin/i);
  });

  it("does not count trash mode as successful when the original path still exists", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "source-left", "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async () => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored", "utf8");
        return { id: "trash-but-source-left", expiresAt: "2026-06-18T00:00:00.000Z", storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    const failure = result.skippedItems.find((s) => s.itemId === item.id);
    expect(failure).toMatchObject({
      reason: "execute-failed"
    });
    expect(failure?.detail).toMatch(/still exists/i);
  });

  it("does not count permanent mode as successful when the original path still exists", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      permanentRemove: async () => {}
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "permanent"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    const failure = result.skippedItems.find((s) => s.itemId === item.id);
    expect(failure).toMatchObject({
      reason: "execute-failed"
    });
    expect(failure?.detail).toMatch(/still exists/i);
  });

  it("routes the recycle-bin sentinel to emptyRecycleBin and counts as removed", async () => {
    // The recycle-bin category lives at the top of every plan with one
    // virtual item -- planning it doesn't require any disk fixture.
    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });
    const bin = plan.categories.find((c) => c.id === "recycle-bin")!;
    const item = bin.items[0];

    const { deps, recycleBinEmptyCount, trashed, permanently } = makeSpyDeps();
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        // Mode is irrelevant for recycle-bin (it's always permanent) but
        // the request still has to specify something valid.
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );
    expect(recycleBinEmptyCount.value).toBe(1);
    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0].path).toBe("shell:recycle-bin");
    expect(result.removedItems[0].mode).toBe("permanent");
  });

  it("reports execute-failed if emptyRecycleBin throws (UAC denied, etc)", async () => {
    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });
    const bin = plan.categories.find((c) => c.id === "recycle-bin")!;
    const item = bin.items[0];

    const { deps } = makeSpyDeps({
      emptyRecycleBin: async () => {
        throw new Error("UAC denied");
      }
    });
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );
    expect(result.removedItems).toHaveLength(0);
    const fail = result.skippedItems.find(
      (s) => s.itemId === item.id && s.reason === "execute-failed"
    );
    expect(fail?.detail).toMatch(/UAC denied/);
  });

  it("refuses unknown selected item ids before touching any selected file", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [item.id, "ghost-id-that-does-not-exist"],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/not present in the plan/);

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
  });
});
