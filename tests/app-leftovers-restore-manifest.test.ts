import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type * as TrashModule from "../src/main/cleanup/trash";

interface Fixture {
  root: string;
  home: string;
  roaming: string;
  localAppData: string;
  programData: string;
  userDataDir: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-leftover-manifest-"));
  return {
    root,
    home: join(root, "home"),
    roaming: join(root, "home", "AppData", "Roaming"),
    localAppData: join(root, "home", "AppData", "Local"),
    programData: join(root, "ProgramData"),
    userDataDir: join(root, "userdata"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe("cleanupAppLeftovers restore manifest validation", () => {
  afterEach(() => {
    vi.doUnmock("../src/main/cleanup/trash");
    vi.resetModules();
  });

  it("does not count app leftover cleanup as successful without a matching restore manifest", async () => {
    const fx = makeFixture();
    try {
      vi.doMock("../src/main/cleanup/trash", async () => {
        const actual =
          await vi.importActual<typeof TrashModule>("../src/main/cleanup/trash");
        return {
          ...actual,
          moveToFormatBuddyTrash: vi.fn(async (options) => {
            const entryId = "leftover-without-manifest";
            const storedPath = join(
              options.userDataDir,
              "formatbuddy-trash",
              "items",
              entryId,
              "files",
              "Slack"
            );
            await fs.mkdir(dirname(storedPath), { recursive: true });
            await fs.rename(options.item.path, storedPath);
            return {
              id: entryId,
              storedPath,
              expiresAt: "2026-06-18T00:00:00.000Z"
            };
          })
        };
      });

      const {
        cleanupAppLeftovers,
        planAppLeftovers,
        __resetLeftoversPlanCacheForTests
      } = await import("../src/main/apps/leftovers");
      __resetLeftoversPlanCacheForTests();

      const slack = join(fx.roaming, "Slack");
      await fs.mkdir(slack, { recursive: true });
      await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
      const snapshot = await planAppLeftovers([], {
        home: fx.home,
        env: {
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          programData: fx.programData
        },
        extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
      });
      const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

      const result = await cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: fx.userDataDir,
          now: () => new Date("2026-05-19T00:00:00.000Z")
        }
      );

      expect(result.removedItems).toHaveLength(0);
      expect(result.totalFreedBytes).toBe(0);
      const failure = result.skippedItems.find((item) => item.reason === "execute-failed");
      expect(failure?.detail).toMatch(/manifest|복구함/);
    } finally {
      fx.cleanup();
    }
  });

  it("does not count app leftover cleanup as successful when the restore expiry exceeds 30 days", async () => {
    const fx = makeFixture();
    try {
      vi.doMock("../src/main/cleanup/trash", async () => {
        const actual =
          await vi.importActual<typeof TrashModule>("../src/main/cleanup/trash");
        return {
          ...actual,
          moveToFormatBuddyTrash: vi.fn(async (options) => {
            const entryId = "leftover-too-long";
            const storedPath = join(
              options.userDataDir,
              "formatbuddy-trash",
              "items",
              entryId,
              "files",
              "Slack"
            );
            const expiresAt = "2026-07-19T00:00:00.000Z";
            await fs.mkdir(dirname(storedPath), { recursive: true });
            await fs.rename(options.item.path, storedPath);
            await fs.writeFile(
              join(options.userDataDir, "formatbuddy-trash", "items", entryId, "manifest.json"),
              JSON.stringify(
                {
                  id: entryId,
                  itemId: options.item.id,
                  originalPath: options.item.path,
                  storedPath,
                  label: options.item.label,
                  categoryId: options.item.categoryId,
                  sizeBytes: options.item.sizeBytes,
                  createdAt: "2026-06-19T00:00:00.000Z",
                  expiresAt
                },
                null,
                2
              ),
              "utf8"
            );
            return { id: entryId, storedPath, expiresAt };
          })
        };
      });

      const {
        cleanupAppLeftovers,
        planAppLeftovers,
        __resetLeftoversPlanCacheForTests
      } = await import("../src/main/apps/leftovers");
      __resetLeftoversPlanCacheForTests();

      const slack = join(fx.roaming, "Slack");
      await fs.mkdir(slack, { recursive: true });
      await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
      const snapshot = await planAppLeftovers([], {
        home: fx.home,
        env: {
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          programData: fx.programData
        },
        extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
      });
      const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

      const result = await cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: fx.userDataDir,
          now: () => new Date("2026-05-19T00:00:00.000Z")
        }
      );

      expect(result.removedItems).toHaveLength(0);
      expect(result.totalFreedBytes).toBe(0);
      const failure = result.skippedItems.find((item) => item.reason === "execute-failed");
      expect(failure?.detail).toMatch(/30-day|30일|expiry|만료/);
    } finally {
      fx.cleanup();
    }
  });

  it("does not count app leftover cleanup as successful when the original path still exists", async () => {
    const fx = makeFixture();
    try {
      vi.doMock("../src/main/cleanup/trash", async () => {
        const actual =
          await vi.importActual<typeof TrashModule>("../src/main/cleanup/trash");
        return {
          ...actual,
          moveToFormatBuddyTrash: vi.fn(async (options) => {
            const entryId = "leftover-source-left";
            const storedPath = join(
              options.userDataDir,
              "formatbuddy-trash",
              "items",
              entryId,
              "files",
              "Slack"
            );
            const expiresAt = "2026-06-18T00:00:00.000Z";
            await fs.mkdir(dirname(storedPath), { recursive: true });
            await fs.writeFile(storedPath, "abc", "utf8");
            await fs.writeFile(
              join(options.userDataDir, "formatbuddy-trash", "items", entryId, "manifest.json"),
              JSON.stringify(
                {
                  id: entryId,
                  itemId: options.item.id,
                  originalPath: options.item.path,
                  storedPath,
                  label: options.item.label,
                  categoryId: options.item.categoryId,
                  sizeBytes: options.item.sizeBytes,
                  createdAt: "2026-05-19T00:00:00.000Z",
                  expiresAt
                },
                null,
                2
              ),
              "utf8"
            );
            return { id: entryId, storedPath, expiresAt };
          })
        };
      });

      const {
        cleanupAppLeftovers,
        planAppLeftovers,
        __resetLeftoversPlanCacheForTests
      } = await import("../src/main/apps/leftovers");
      __resetLeftoversPlanCacheForTests();

      const slack = join(fx.roaming, "Slack");
      await fs.mkdir(slack, { recursive: true });
      await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
      const snapshot = await planAppLeftovers([], {
        home: fx.home,
        env: {
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          programData: fx.programData
        },
        extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
      });
      const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

      const result = await cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: fx.userDataDir,
          now: () => new Date("2026-05-19T00:00:00.000Z")
        }
      );

      expect(result.removedItems).toHaveLength(0);
      expect(result.totalFreedBytes).toBe(0);
      await expect(fs.stat(slack)).resolves.toBeTruthy();
      const failure = result.skippedItems.find((item) => item.reason === "execute-failed");
      expect(failure?.detail).toMatch(/still exists|아직 남아/i);
    } finally {
      fx.cleanup();
    }
  });
});
