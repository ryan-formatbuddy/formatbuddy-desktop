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
    trashItem: async (item) => {
      trashed.push(item.path);
      await fs.rm(item.path, { recursive: true, force: true });
      return { id: `trash-${item.id}`, expiresAt: trashExpiresAt };
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

  it("reports not-found when the selected id is not in the plan", async () => {
    const plan = await planWithOneTempFile(fx, join(fx.tempDir, "old.tmp"));
    const { deps } = makeSpyDeps();
    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: ["ghost-id-that-does-not-exist"],
        mode: "trash"
      },
      { userDataDir: fx.userData, deps, home: fx.home }
    );
    const notFound = result.skippedItems.find(
      (s) => s.reason === "not-found" && s.itemId === "ghost-id-that-does-not-exist"
    );
    expect(notFound).toBeDefined();
    expect(result.removedItems).toHaveLength(0);
  });
});
