import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultDeps,
  executeCleanup,
  __testing as executorTesting,
  type ExecutorDeps
} from "../src/main/cleanup/executor";
import {
  consumePlan,
  planCleanup,
  __resetPlanCacheForTests
} from "../src/main/cleanup/planner";
import { getCleanupHistory } from "../src/main/cleanup/log";
import type { CleanupPlan } from "../src/shared/types";

const TEN_DAYS_MS = 10 * 86_400_000;
const THIRTY_DAYS_MS = 30 * 86_400_000;

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

function contentHashForText(text: string): { algorithm: "sha256"; value: string } {
  const hash = createHash("sha256");
  hash.update("file\0");
  hash.update("");
  hash.update("\0");
  hash.update(text, "utf8");
  return { algorithm: "sha256", value: hash.digest("hex") };
}

function makeSpyDeps(overrides: Partial<ExecutorDeps> = {}): {
  deps: ExecutorDeps;
  trashed: string[];
  permanently: string[];
  recycleBinEmptyCount: { value: number };
} {
  const trashed: string[] = [];
  const permanently: string[] = [];
  const recycleBinEmptyCount = { value: 0 };
  const deps: ExecutorDeps = {
    trashItem: async (item, sizeBytes, context) => {
      const createdAt = (context.now?.() ?? new Date()).toISOString();
      const trashExpiresAt = new Date(Date.parse(createdAt) + THIRTY_DAYS_MS).toISOString();
      trashed.push(item.path);
      const entryId = `trash-${item.id}`;
      const storedPath = join(context.userDataDir, "formatbuddy-trash", "items", entryId, "files", "stored");
      await fs.mkdir(join(storedPath, ".."), { recursive: true });
      const storedText = "x".repeat(Math.max(0, Math.round(sizeBytes)));
      await fs.writeFile(storedPath, storedText, "utf8");
      await fs.writeFile(
        join(context.userDataDir, "formatbuddy-trash", "items", entryId, "manifest.json"),
        JSON.stringify(
          {
            id: entryId,
            itemId: item.id,
            originalPath: item.path,
            storedPath,
            label: item.label,
            categoryId: item.categoryId,
            sizeBytes,
            contentHash: contentHashForText(storedText),
            createdAt,
            expiresAt: trashExpiresAt
          },
          null,
          2
        ),
        "utf8"
      );
      await fs.rm(item.path, { recursive: true, force: true });
      return { id: entryId, expiresAt: trashExpiresAt, storedPath };
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
  return { deps, trashed, permanently, recycleBinEmptyCount };
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

    const { deps, trashed } = makeSpyDeps();
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
    expect(result.removedItems[0].expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
      { userDataDir: fx.userData, deps, home: fx.home, allowPermanentForMaintenance: true }
    );

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([targetFile]);
  });

  it("refuses permanent mode by default before consuming the plan", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [item.id],
          mode: "permanent"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/30일 복구함|permanent mode/i);

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
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
      {
        userDataDir: fx.userData,
        deps: defaultDeps(fx.userData),
        home: fx.home,
        allowPermanentForMaintenance: true
      }
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
      { userDataDir: fx.userData, deps, home: fx.home, allowPermanentForMaintenance: true }
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

  it("blocks unusable cleanup item metadata inside an individual cleanup attempt", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];
    item.label = "old.tmp\nmore";

    const statCalls = { value: 0 };
    const trashCalls = { value: 0 };
    const { deps } = makeSpyDeps({
      statSize: async () => {
        statCalls.value += 1;
        return 4096;
      },
      trashItem: async () => {
        trashCalls.value += 1;
        throw new Error("trash should not be called");
      }
    });

    const result = await executorTesting.attemptItem(item, "trash", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });

    expect(result.removed).toBeUndefined();
    expect(result.skipped).toMatchObject({
      itemId: item.id,
      path: targetFile,
      reason: "blocked-path"
    });
    expect(result.skipped?.detail).toMatch(/정리 항목 정보|metadata/i);
    expect(statCalls.value).toBe(0);
    expect(trashCalls.value).toBe(0);
    await expect(fs.readFile(targetFile, "utf8")).resolves.toBe("x".repeat(4096));
  });

  it("blocks whitespace-padded cleanup path metadata before stat or trash", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    await writeAged(targetFile, 4096, TEN_DAYS_MS);
    const item = {
      id: "temp-old1",
      path: `${targetFile} `,
      label: "old1.tmp",
      sizeBytes: 4096,
      categoryId: "temp-user" as const,
      riskLevel: "safe" as const,
      reason: "테스트 항목"
    };
    const calls = { stat: 0, trash: 0 };
    const { deps } = makeSpyDeps({
      statSize: async () => {
        calls.stat += 1;
        return 4096;
      },
      trashItem: async () => {
        calls.trash += 1;
        throw new Error("trash should not be called");
      }
    });

    const result = await executorTesting.attemptItem(item, "trash", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });

    expect(result.removed).toBeUndefined();
    expect(result.skipped).toMatchObject({
      itemId: item.id,
      path: item.path,
      reason: "blocked-path"
    });
    expect(result.skipped?.detail).toMatch(/정리 항목 정보|metadata/i);
    expect(calls).toEqual({ stat: 0, trash: 0 });
    await expect(fs.readFile(targetFile, "utf8")).resolves.toBe("x".repeat(4096));
  });

  it("blocks FormatBuddy user data inside an individual cleanup attempt", async () => {
    const targetFile = join(fx.userData, "formatbuddy-state.json");
    await fs.mkdir(join(targetFile, ".."), { recursive: true });
    await fs.writeFile(targetFile, "state stays put", "utf8");
    const item = {
      id: "state-file",
      path: targetFile,
      label: "formatbuddy-state.json",
      sizeBytes: 15,
      categoryId: "temp-user" as const,
      riskLevel: "safe" as const,
      reason: "테스트 항목"
    };
    const calls = { stat: 0, trash: 0, permanent: 0 };
    const { deps } = makeSpyDeps({
      statSize: async () => {
        calls.stat += 1;
        return 15;
      },
      trashItem: async () => {
        calls.trash += 1;
        throw new Error("trash should not be called");
      },
      permanentRemove: async () => {
        calls.permanent += 1;
        throw new Error("permanent remove should not be called");
      }
    });

    const result = await executorTesting.attemptItem(item, "trash", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });

    expect(result.removed).toBeUndefined();
    expect(result.skipped).toMatchObject({
      itemId: item.id,
      path: targetFile,
      reason: "blocked-path"
    });
    expect(result.skipped?.detail).toMatch(/FormatBuddy|포맷버디|앱 데이터|managed data/i);
    expect(calls).toEqual({ stat: 0, trash: 0, permanent: 0 });
    await expect(fs.readFile(targetFile, "utf8")).resolves.toBe("state stays put");
  });

  it("blocks cleanup attempts that would contain FormatBuddy user data", async () => {
    const targetFile = join(fx.userData, "formatbuddy-state.json");
    await fs.mkdir(join(targetFile, ".."), { recursive: true });
    await fs.writeFile(targetFile, "state stays put", "utf8");
    const item = {
      id: "root-folder",
      path: fx.root,
      label: "root-folder",
      sizeBytes: 15,
      categoryId: "temp-user" as const,
      riskLevel: "safe" as const,
      reason: "테스트 항목"
    };
    const calls = { stat: 0, trash: 0, permanent: 0 };
    const { deps } = makeSpyDeps({
      statSize: async () => {
        calls.stat += 1;
        return 15;
      },
      trashItem: async () => {
        calls.trash += 1;
        throw new Error("trash should not be called");
      },
      permanentRemove: async () => {
        calls.permanent += 1;
        throw new Error("permanent remove should not be called");
      }
    });

    const result = await executorTesting.attemptItem(item, "permanent", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });

    expect(result.removed).toBeUndefined();
    expect(result.skipped).toMatchObject({
      itemId: item.id,
      path: fx.root,
      reason: "blocked-path"
    });
    expect(result.skipped?.detail).toMatch(/FormatBuddy|포맷버디|앱 데이터|managed data/i);
    expect(calls).toEqual({ stat: 0, trash: 0, permanent: 0 });
    await expect(fs.readFile(targetFile, "utf8")).resolves.toBe("state stays put");
  });

  it("refuses corrupted selected cleanup item metadata before consuming the plan", async () => {
    const targetFile = join(fx.tempDir, "old1.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const tempUser = plan.categories.find((c) => c.id === "temp-user")!;
    const item = tempUser.items[0];
    item.label = "old.tmp\nmore";

    const statCalls = { value: 0 };
    const trashCalls = { value: 0 };
    const { deps, trashed, permanently } = makeSpyDeps({
      statSize: async () => {
        statCalls.value += 1;
        return 4096;
      },
      trashItem: async () => {
        trashCalls.value += 1;
        throw new Error("trash should not be called");
      }
    });

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [item.id],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/정리 항목 정보|metadata/i);

    expect(statCalls.value).toBe(0);
    expect(trashCalls.value).toBe(0);
    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    await expect(fs.readFile(targetFile, "utf8")).resolves.toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
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

  it("reports an existing but unmeasurable selected folder as blocked instead of missing", async () => {
    const folder = join(fx.home, "Documents", "deep-cache");
    let leaf = folder;
    for (let i = 0; i < 34; i += 1) {
      leaf = join(leaf, `level-${i}`);
    }
    await fs.mkdir(leaf, { recursive: true });
    await fs.writeFile(join(leaf, "deep.tmp"), "12345", "utf8");

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData,
        largeFiles: [
          {
            name: "deep-cache",
            path: folder,
            folderName: "Documents",
            kind: "other",
            sizeGb: 1
          }
        ]
      }
    });
    const item = plan.categories.find((c) => c.id === "large-files")!.items[0];

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps: defaultDeps(fx.userData), home: fx.home }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: item.id,
      path: folder,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/확인|안전|깊/);
    await expect(fs.readFile(join(leaf, "deep.tmp"), "utf8")).resolves.toBe("12345");
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

  it("refuses duplicate selected item ids before consuming the plan", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [item.id, item.id],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/duplicate|selectedItemIds/);

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
  });

  it("refuses whitespace-padded cleanup ids before consuming the plan", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: plan.planId,
          confirmationToken: plan.confirmationToken,
          selectedItemIds: [` ${item.id}`],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/whitespace|selectedItemIds/);

    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(await fs.readFile(targetFile, "utf8")).toBe("x".repeat(4096));
    expect(consumePlan(plan.planId, plan.confirmationToken)).toBeDefined();
  });

  it.each([
    [
      "plan id",
      (plan: CleanupPlan, itemId: string) => ({
        planId: `${plan.planId.slice(0, 8)}\n${plan.planId.slice(8)}`,
        itemId
      })
    ],
    [
      "confirmation token",
      (plan: CleanupPlan, itemId: string) => ({
        confirmationToken: `${plan.confirmationToken.slice(0, 8)}\r${plan.confirmationToken.slice(8)}`,
        itemId
      })
    ],
    [
      "selected item id",
      (_plan: CleanupPlan, itemId: string) => ({
        itemId: `${itemId.slice(0, 4)}\u0000${itemId.slice(4)}`
      })
    ]
  ] as Array<[
    string,
    (plan: CleanupPlan, itemId: string) => Partial<{
      planId: string;
      confirmationToken: string;
      itemId: string;
    }>
  ]>)("refuses cleanup request fields with control characters before consuming the plan: %s", async (_label, mutate) => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const patch = mutate(plan, item.id);
    const { deps, trashed, permanently } = makeSpyDeps();

    await expect(
      executeCleanup(
        {
          planId: patch.planId ?? plan.planId,
          confirmationToken: patch.confirmationToken ?? plan.confirmationToken,
          selectedItemIds: [patch.itemId ?? item.id],
          mode: "trash"
        },
        { userDataDir: fx.userData, deps, home: fx.home }
      )
    ).rejects.toThrow(/제어 문자|control characters/i);

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

  it("returns the cleanup result when history recording fails after a successful move", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps, trashed } = makeSpyDeps();

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        recordCleanupExecution: async () => {
          throw new Error("history disk full");
        }
      }
    );

    expect(trashed).toEqual([targetFile]);
    expect(result.removedItems).toHaveLength(1);
    expect(result.totalFreedBytes).toBeGreaterThan(0);
    expect(result.logPersistenceWarning).toMatch(/기록|history disk full/i);
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
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "trash-without-expiry", "files", "old.tmp");
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

  it("does not count trash mode as successful when the restore expiry exceeds 30 days", async () => {
    const targetFile = join(fx.tempDir, "old-too-long.tmp");
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "trash-too-long", "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        const entryId = "trash-too-long";
        const expiresAt = "2026-07-19T00:00:00.000Z";
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored", "utf8");
        await fs.writeFile(
          join(fx.userData, "formatbuddy-trash", "items", entryId, "manifest.json"),
          JSON.stringify(
            {
              id: entryId,
              itemId: cleanupItem.id,
              originalPath: cleanupItem.path,
              storedPath,
              label: cleanupItem.label,
              categoryId: cleanupItem.categoryId,
              sizeBytes: cleanupItem.sizeBytes,
              createdAt: "2026-06-19T00:00:00.000Z",
              expiresAt
            },
            null,
            2
          ),
          "utf8"
        );
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: entryId, expiresAt, storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/30-day|30일/);
  });

  it("does not count trash mode as successful when the restore expiry is shorter than 30 days", async () => {
    const targetFile = join(fx.tempDir, "old-too-short.tmp");
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "trash-too-short", "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        const entryId = "trash-too-short";
        const expiresAt = "2026-05-20T00:00:00.000Z";
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored", "utf8");
        await fs.writeFile(
          join(fx.userData, "formatbuddy-trash", "items", entryId, "manifest.json"),
          JSON.stringify(
            {
              id: entryId,
              itemId: cleanupItem.id,
              originalPath: cleanupItem.path,
              storedPath,
              label: cleanupItem.label,
              categoryId: cleanupItem.categoryId,
              sizeBytes: cleanupItem.sizeBytes,
              createdAt: "2026-04-20T00:00:00.000Z",
              expiresAt
            },
            null,
            2
          ),
          "utf8"
        );
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: entryId, expiresAt, storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/30-day|30일/);
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

  it("does not count trash mode as successful without a matching restore manifest", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-without-manifest";
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", entryId, "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored without manifest", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: entryId, expiresAt: "2026-06-18T00:00:00.000Z", storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    expect(await fs.readFile(storedPath, "utf8")).toBe("stored without manifest");
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/manifest|복구함 정보/);
  });

  it("does not count trash mode as successful when the restore manifest points to another cleanup item", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-wrong-item";
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", entryId, "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored with wrong item id", "utf8");
        await fs.writeFile(
          join(fx.userData, "formatbuddy-trash", "items", entryId, "manifest.json"),
          JSON.stringify(
            {
              id: entryId,
              itemId: "another-cleanup-item",
              originalPath: cleanupItem.path,
              storedPath,
              label: cleanupItem.label,
              categoryId: cleanupItem.categoryId,
              sizeBytes: cleanupItem.sizeBytes,
              createdAt: "2026-05-19T00:00:00.000Z",
              expiresAt: "2026-06-18T00:00:00.000Z"
            },
            null,
            2
          ),
          "utf8"
        );
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: entryId, expiresAt: "2026-06-18T00:00:00.000Z", storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/manifest.*item|cleanup item/i);
  });

  it("does not count trash mode as successful when the restore manifest records a different size", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-wrong-size";
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", entryId, "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored with wrong size", "utf8");
        await fs.writeFile(
          join(fx.userData, "formatbuddy-trash", "items", entryId, "manifest.json"),
          JSON.stringify(
            {
              id: entryId,
              itemId: cleanupItem.id,
              originalPath: cleanupItem.path,
              storedPath,
              label: cleanupItem.label,
              categoryId: cleanupItem.categoryId,
              sizeBytes: cleanupItem.sizeBytes + 1,
              createdAt: "2026-05-19T00:00:00.000Z",
              expiresAt: "2026-06-18T00:00:00.000Z"
            },
            null,
            2
          ),
          "utf8"
        );
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return { id: entryId, expiresAt: "2026-06-18T00:00:00.000Z", storedPath };
      }
    });

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: [item.id],
        mode: "trash"
      },
      {
        userDataDir: fx.userData,
        deps,
        home: fx.home,
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/manifest.*size|size/i);
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

  it("does not count trash mode as successful when the stored path belongs to a different restore entry", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const storedPath = join(
      fx.userData,
      "formatbuddy-trash",
      "items",
      "different-entry",
      "files",
      "old.tmp"
    );
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored in another entry", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: "expected-entry",
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect(await fs.readFile(storedPath, "utf8")).toBe("stored in another entry");
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/restore entry folder/i);
  });

  it("does not count trash mode as successful when the stored path is the restore files folder", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-files-root";
    const storedPath = join(
      fx.userData,
      "formatbuddy-trash",
      "items",
      entryId,
      "files"
    );
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(storedPath, { recursive: true });
        await fs.writeFile(join(storedPath, "old.tmp"), "stored under files root", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: entryId,
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect(await fs.readFile(join(storedPath, "old.tmp"), "utf8")).toBe("stored under files root");
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/restore entry folder/i);
  });

  it("does not count trash mode as successful when the restore entry id contains path segments", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const unsafeId = "expected-entry/../different-entry";
    const storedPath = join(
      fx.userData,
      "formatbuddy-trash",
      "items",
      "different-entry",
      "files",
      "old.tmp"
    );
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored via unsafe id", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: unsafeId,
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect(await fs.readFile(storedPath, "utf8")).toBe("stored via unsafe id");
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/restore entry id/i);
  });

  it("does not count trash mode as successful when the stored trash path is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-linked-stored-path";
    const storedPath = join(
      fx.userData,
      "formatbuddy-trash",
      "items",
      entryId,
      "files",
      "old.tmp"
    );
    const outsideStoredPath = join(fx.root, "outside-stored.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(outsideStoredPath, "outside", "utf8");
        await fs.symlink(outsideStoredPath, storedPath);
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: entryId,
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect((await fs.lstat(storedPath)).isSymbolicLink()).toBe(true);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/stored trash path.*link/i);
  });

  it("does not count trash mode as successful when the managed restore bin parent is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-linked-parent";
    const itemsLink = join(fx.userData, "formatbuddy-trash", "items");
    const outsideItems = join(fx.root, "outside-items");
    const storedPath = join(itemsLink, entryId, "files", "old.tmp");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(outsideItems, { recursive: true });
        await fs.mkdir(join(itemsLink, ".."), { recursive: true });
        await fs.symlink(outsideItems, itemsLink, "dir");
        await fs.mkdir(join(storedPath, ".."), { recursive: true });
        await fs.writeFile(storedPath, "stored through linked parent", "utf8");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: entryId,
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect((await fs.lstat(itemsLink)).isSymbolicLink()).toBe(true);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/stored trash path.*link/i);
  });

  it("does not count trash mode as successful when the stored trash folder contains a symbolic link", async () => {
    if (process.platform === "win32") return;
    const targetFile = join(fx.tempDir, "old.tmp");
    const entryId = "trash-folder-with-link";
    const storedPath = join(
      fx.userData,
      "formatbuddy-trash",
      "items",
      entryId,
      "files",
      "old-folder"
    );
    const outsideStoredFolder = join(fx.root, "outside-stored-folder");
    const plan = await planWithOneTempFile(fx, targetFile);
    const item = plan.categories.find((c) => c.id === "temp-user")!.items[0];
    const { deps } = makeSpyDeps({
      trashItem: async (cleanupItem) => {
        await fs.mkdir(storedPath, { recursive: true });
        await fs.writeFile(join(storedPath, "visible.tmp"), "visible", "utf8");
        await fs.mkdir(outsideStoredFolder, { recursive: true });
        await fs.symlink(outsideStoredFolder, join(storedPath, "linked-folder"), "dir");
        await fs.rm(cleanupItem.path, { recursive: true, force: true });
        return {
          id: entryId,
          expiresAt: "2026-06-18T00:00:00.000Z",
          storedPath
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
    expect((await fs.lstat(join(storedPath, "linked-folder"))).isSymbolicLink()).toBe(true);
    const failure = result.skippedItems.find((s) => s.reason === "execute-failed");
    expect(failure?.detail).toMatch(/stored trash path.*link/i);
  });

  it("does not count trash mode as successful when the original path still exists", async () => {
    const targetFile = join(fx.tempDir, "old.tmp");
    const storedPath = join(fx.userData, "formatbuddy-trash", "items", "trash-but-source-left", "files", "old.tmp");
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
      { userDataDir: fx.userData, deps, home: fx.home, allowPermanentForMaintenance: true }
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

  it("does not empty Windows recycle bin because it cannot enter the 30-day restore bin", async () => {
    // The recycle-bin category is a virtual namespace. It remains visible
    // in the plan as blocked guidance, not as an executable cleanup item.
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
    const item = bin.blockedItems[0];

    const { deps, recycleBinEmptyCount, trashed, permanently } = makeSpyDeps();
    const outcome = await executorTesting.attemptItem(item, "trash", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });
    expect(recycleBinEmptyCount.value).toBe(0);
    expect(trashed).toEqual([]);
    expect(permanently).toEqual([]);
    expect(outcome.removed).toBeUndefined();
    expect(outcome.skipped).toMatchObject({
      itemId: item.id,
      path: "shell:recycle-bin",
      reason: "blocked-path",
      detail: expect.stringMatching(/30일 복구함/)
    });
  });

  it("does not call emptyRecycleBin even if the injected dependency would fail", async () => {
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
    const item = bin.blockedItems[0];
    let called = false;

    const { deps } = makeSpyDeps({
      emptyRecycleBin: async () => {
        called = true;
        throw new Error("UAC denied");
      }
    });
    const outcome = await executorTesting.attemptItem(item, "trash", deps, fx.home, {
      userDataDir: fx.userData,
      home: fx.home
    });
    expect(called).toBe(false);
    expect(outcome.removed).toBeUndefined();
    expect(outcome.skipped).toMatchObject({
      itemId: item.id,
      reason: "blocked-path",
      detail: expect.stringMatching(/30일 복구함/)
    });
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
