import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLogEntry,
  getCleanupHistory,
  recordCleanupExecution,
  __testing
} from "../src/main/cleanup/log";

describe("cleanup execution log coercion", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-cleanup-log-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("filters malformed entries and invalid category breakdowns from disk", async () => {
    writeFileSync(
      join(dir, "formatbuddy-cleanup-log.json"),
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              id: "ok",
              executedAt: "2026-05-19T00:00:00.000Z",
              mode: "trash",
              totalFreedBytes: 999_999,
              removedCount: 1,
              skippedCount: 0,
              categories: [
                { categoryId: "temp-user", bytesFreed: 12.4, itemCount: 1.2 },
                { categoryId: "nope", bytesFreed: 500, itemCount: 1 }
              ]
            },
            {
              id: "legacy-permanent",
              executedAt: "2026-05-19T00:00:00.000Z",
              mode: "permanent",
              totalFreedBytes: 999,
              removedCount: 1,
              skippedCount: 0,
              categories: [{ categoryId: "temp-user", bytesFreed: 999, itemCount: 1 }]
            },
            {
              id: "bad-mode",
              executedAt: "2026-05-19T00:00:00.000Z",
              mode: "wipe",
              totalFreedBytes: 1,
              removedCount: 1,
              skippedCount: 0,
              categories: []
            },
            "garbage"
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const history = await getCleanupHistory(dir);

    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({
      id: "ok",
      mode: "trash",
      totalFreedBytes: 12,
      removedCount: 1,
      skippedCount: 0,
      notSelectedCount: 0
    });
    expect(history.entries[0].categories).toEqual([
      { categoryId: "temp-user", bytesFreed: 12, itemCount: 1 }
    ]);
  });

  it("coerces a corrupt in-memory cleanup log into a safe empty log", () => {
    expect(__testing.coerceLog({ version: 1, entries: [{ id: "missing-fields" }] })).toEqual({
      version: 1,
      entries: []
    });
  });

  it("keeps persisted not-selected counts while preserving legacy entries", () => {
    expect(
      __testing.coerceLog({
        version: 1,
        entries: [
          {
            id: "current",
            executedAt: "2026-05-19T00:00:00.000Z",
            mode: "trash",
            totalFreedBytes: 12,
            removedCount: 1,
            skippedCount: 2,
            notSelectedCount: 3,
            categories: [{ categoryId: "temp-user", bytesFreed: 12, itemCount: 1 }]
          },
          {
            id: "legacy",
            executedAt: "2026-05-19T00:00:01.000Z",
            mode: "trash",
            totalFreedBytes: 4,
            removedCount: 1,
            skippedCount: 0,
            categories: [{ categoryId: "browser-cache", bytesFreed: 4, itemCount: 1 }]
          }
        ]
      }).entries.map((entry) => ({
        id: entry.id,
        skippedCount: entry.skippedCount,
        notSelectedCount: entry.notSelectedCount
      }))
    ).toEqual([
      { id: "current", skippedCount: 2, notSelectedCount: 3 },
      { id: "legacy", skippedCount: 0, notSelectedCount: 0 }
    ]);
  });

  it("does not count registry backups or startup holding items as freed disk space", () => {
    const entry = buildLogEntry({
      mode: "trash",
      executedAt: "2026-05-19T00:00:00.000Z",
      removedItems: [
        {
          itemId: "registry-1",
          path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme",
          sizeBytes: 4096,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          registryBackupId: "registry-backup-1"
        },
        {
          itemId: "startup-1",
          path: join(dir, "Startup", "Acme.lnk"),
          sizeBytes: 2048,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          startupDisabledId: "startup-disabled-1"
        },
        {
          itemId: "folder-1",
          path: join(dir, "AppData", "Local", "Acme"),
          sizeBytes: 12,
          categoryId: "app-leftovers",
          mode: "trash",
          succeeded: true,
          trashEntryId: "trash-1"
        }
      ],
      skippedItems: []
    });

    expect(entry.totalFreedBytes).toBe(12);
    expect(entry.categories).toEqual([
      { categoryId: "app-leftovers", bytesFreed: 12, itemCount: 3 }
    ]);
  });

  it("separates user-unselected cleanup candidates from actual skipped items", () => {
    const entry = buildLogEntry({
      mode: "trash",
      executedAt: "2026-05-19T00:00:00.000Z",
      removedItems: [
        {
          itemId: "removed-1",
          path: join(dir, "old.tmp"),
          sizeBytes: 12,
          categoryId: "temp-user",
          mode: "trash",
          succeeded: true,
          trashEntryId: "trash-1"
        }
      ],
      skippedItems: [
        {
          itemId: "not-selected-1",
          path: join(dir, "keep.tmp"),
          reason: "not-selected"
        },
        {
          itemId: "blocked-1",
          path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
          reason: "blocked-path"
        }
      ]
    });

    expect(entry.removedCount).toBe(1);
    expect(entry.skippedCount).toBe(1);
    expect(entry.notSelectedCount).toBe(1);
  });

  it("refuses to persist non-restore-bin cleanup history entries", async () => {
    const entry = buildLogEntry({
      mode: "permanent",
      executedAt: "2026-05-19T00:00:00.000Z",
      removedItems: [
        {
          itemId: "item-1",
          path: join(dir, "old.tmp"),
          sizeBytes: 12,
          categoryId: "temp-user",
          mode: "permanent",
          succeeded: true
        }
      ],
      skippedItems: []
    });

    await expect(recordCleanupExecution(dir, entry)).rejects.toThrow(/30-day restore-bin/);
    await expect(getCleanupHistory(dir)).resolves.toEqual({ entries: [] });
  });

  it("does not write the cleanup execution log through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const outsideLog = join(dir, "outside-cleanup-log.json");
    const cleanupLog = join(dir, "formatbuddy-cleanup-log.json");
    writeFileSync(outsideLog, "outside stays put");
    symlinkSync(outsideLog, cleanupLog);

    const entry = buildLogEntry({
      mode: "trash",
      executedAt: "2026-05-19T00:00:00.000Z",
      removedItems: [
        {
          itemId: "item-1",
          path: join(dir, "old.tmp"),
          sizeBytes: 12,
          categoryId: "temp-user",
          mode: "trash",
          succeeded: true
        }
      ],
      skippedItems: []
    });

    await recordCleanupExecution(dir, entry);

    expect(readFileSync(outsideLog, "utf8")).toBe("outside stays put");
    expect(lstatSync(cleanupLog).isSymbolicLink()).toBe(false);
    const history = await getCleanupHistory(dir);
    expect(history.entries.map((item) => item.id)).toEqual([entry.id]);
  });

  it("replaces a non-file cleanup execution log path before recording history", async () => {
    const cleanupLog = join(dir, "formatbuddy-cleanup-log.json");
    mkdirSync(cleanupLog, { recursive: true });
    writeFileSync(join(cleanupLog, "stale-child.txt"), "stale", "utf8");

    const entry = buildLogEntry({
      mode: "trash",
      executedAt: "2026-05-19T00:00:00.000Z",
      removedItems: [
        {
          itemId: "item-1",
          path: join(dir, "old.tmp"),
          sizeBytes: 12,
          categoryId: "temp-user",
          mode: "trash",
          succeeded: true
        }
      ],
      skippedItems: []
    });

    await recordCleanupExecution(dir, entry);

    expect(lstatSync(cleanupLog).isFile()).toBe(true);
    const history = await getCleanupHistory(dir);
    expect(history.entries.map((item) => item.id)).toEqual([entry.id]);
  });
});
