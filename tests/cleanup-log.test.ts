import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCleanupHistory, __testing } from "../src/main/cleanup/log";

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
      skippedCount: 0
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
});
