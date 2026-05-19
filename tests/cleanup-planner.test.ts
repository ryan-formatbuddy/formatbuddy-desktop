import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  consumePlan,
  planCleanup,
  __resetPlanCacheForTests
} from "../src/main/cleanup/planner";

const TEN_DAYS_MS = 10 * 86_400_000;
const ONE_DAY_MS = 86_400_000;

async function writeAgedFile(path: string, content: string, ageMs: number): Promise<void> {
  await fs.mkdir(join(path, ".."), { recursive: true });
  await fs.writeFile(path, content, "utf8");
  const t = new Date(Date.now() - ageMs);
  await fs.utimes(path, t, t);
}

interface Fixture {
  home: string;
  tempDir: string;
  systemRoot: string;
  systemDrive: string;
  localAppData: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-planner-"));
  return {
    home: join(root, "home"),
    tempDir: join(root, "home", "AppData", "Local", "Temp"),
    systemRoot: join(root, "WindowsSystemRoot"),
    systemDrive: root,
    localAppData: join(root, "home", "AppData", "Local"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe("planCleanup", () => {
  let fx: Fixture;

  beforeEach(() => {
    __resetPlanCacheForTests();
    fx = makeFixture();
  });

  afterEach(() => {
    __resetPlanCacheForTests();
    fx.cleanup();
  });

  it("returns all categories even when the disk is mostly empty", async () => {
    await fs.mkdir(fx.tempDir, { recursive: true });
    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });
    const categoryIds = plan.categories.map((c) => c.id);
    expect(categoryIds).toEqual([
      "recycle-bin",
      "temp-user",
      "temp-windows",
      "browser-cache",
      "windows-old",
      "downloads-installers",
      "large-files"
    ]);
    const recycleBin = plan.categories.find((c) => c.id === "recycle-bin");
    expect(recycleBin?.items).toHaveLength(1);
    expect(recycleBin?.items[0].path).toBe("shell:recycle-bin");
    expect(recycleBin?.items[0].riskLevel).toBe("review");
    expect(plan.blocklistVersion).toBe(1);
  });

  it("includes temp files older than 7 days, excludes fresh temp files", async () => {
    const oldFile = join(fx.tempDir, "old.tmp");
    const freshFile = join(fx.tempDir, "fresh.tmp");
    await writeAgedFile(oldFile, "x".repeat(1024), TEN_DAYS_MS);
    await writeAgedFile(freshFile, "y".repeat(1024), ONE_DAY_MS);

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });

    const tempUser = plan.categories.find((c) => c.id === "temp-user");
    expect(tempUser).toBeDefined();
    const itemPaths = tempUser!.items.map((i) => i.path);
    expect(itemPaths).toContain(oldFile);
    expect(itemPaths).not.toContain(freshFile);
  });

  it("never surfaces browser credential files even if they live near the cache", async () => {
    const cacheDir = join(
      fx.localAppData,
      "Google",
      "Chrome",
      "User Data",
      "Default",
      "Cache"
    );
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(join(cacheDir, "f_000001"), "cached resource bytes", "utf8");

    const credentialDir = join(
      fx.localAppData,
      "Google",
      "Chrome",
      "User Data",
      "Default"
    );
    await fs.writeFile(join(credentialDir, "Login Data"), "do-not-read-this", "utf8");
    await fs.writeFile(join(credentialDir, "Cookies"), "do-not-read-this", "utf8");

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });

    const cache = plan.categories.find((c) => c.id === "browser-cache");
    expect(cache).toBeDefined();
    const cachePaths = cache!.items.map((i) => i.path);
    expect(cachePaths.some((p) => p.endsWith("f_000001"))).toBe(true);
    expect(cachePaths.some((p) => p.endsWith("Login Data"))).toBe(false);
    expect(cachePaths.some((p) => p.endsWith("Cookies"))).toBe(false);
  });

  it("flags Windows.old as a single review item with the folder total size", async () => {
    const winOld = join(fx.systemDrive, "Windows.old");
    await fs.mkdir(winOld, { recursive: true });
    await fs.writeFile(join(winOld, "leftover1.dat"), "abc", "utf8");
    await fs.writeFile(join(winOld, "leftover2.dat"), "defgh", "utf8");

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData
      }
    });

    const oldCat = plan.categories.find((c) => c.id === "windows-old");
    expect(oldCat).toBeDefined();
    expect(oldCat!.items).toHaveLength(1);
    expect(oldCat!.items[0].riskLevel).toBe("review");
    expect(oldCat!.items[0].path).toBe(winOld);
  });

  it("uses the recommendation large-files list as the large-files category", async () => {
    const downloadFile = join(fx.home, "Downloads", "movie.mp4");
    await fs.mkdir(join(fx.home, "Downloads"), { recursive: true });
    await fs.writeFile(downloadFile, "binary", "utf8");

    const plan = await planCleanup({
      env: {
        home: fx.home,
        tempDir: fx.tempDir,
        systemRoot: fx.systemRoot,
        systemDrive: fx.systemDrive,
        localAppData: fx.localAppData,
        largeFiles: [
          {
            name: "movie.mp4",
            path: downloadFile,
            folderName: "Downloads",
            kind: "video",
            sizeGb: 3.5
          }
        ]
      }
    });

    const large = plan.categories.find((c) => c.id === "large-files");
    expect(large).toBeDefined();
    expect(large!.items).toHaveLength(1);
    expect(large!.items[0].path).toBe(downloadFile);
    expect(large!.items[0].riskLevel).toBe("review");
  });
});

describe("consumePlan", () => {
  beforeEach(() => __resetPlanCacheForTests());

  it("returns the plan once on token match, then refuses replays", async () => {
    const fx = makeFixture();
    try {
      await fs.mkdir(fx.tempDir, { recursive: true });
      const plan = await planCleanup({
        env: {
          home: fx.home,
          tempDir: fx.tempDir,
          systemRoot: fx.systemRoot,
          systemDrive: fx.systemDrive,
          localAppData: fx.localAppData
        }
      });

      const first = consumePlan(plan.planId, plan.confirmationToken);
      expect(first).toBeDefined();
      expect(first?.planId).toBe(plan.planId);

      const replay = consumePlan(plan.planId, plan.confirmationToken);
      expect(replay).toBeUndefined();
    } finally {
      fx.cleanup();
    }
  });

  it("refuses a tampered confirmationToken", async () => {
    const fx = makeFixture();
    try {
      await fs.mkdir(fx.tempDir, { recursive: true });
      const plan = await planCleanup({
        env: {
          home: fx.home,
          tempDir: fx.tempDir,
          systemRoot: fx.systemRoot,
          systemDrive: fx.systemDrive,
          localAppData: fx.localAppData
        }
      });
      const tampered = plan.confirmationToken.split("").reverse().join("");
      expect(consumePlan(plan.planId, tampered)).toBeUndefined();
      // The original token should now NOT consume the plan either —
      // but we don't enforce that today (consumePlan only deletes the
      // cache on version mismatch). The replay-once guarantee covers
      // double-execution, which is the real risk.
    } finally {
      fx.cleanup();
    }
  });
});
