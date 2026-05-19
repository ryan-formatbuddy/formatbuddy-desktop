import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  lstatSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendAuditEntry, getAuditSnapshot, __testing } from "../src/main/audit/log";

const DAY_MS = 86_400_000;

describe("appendAuditEntry + getAuditSnapshot", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-audit-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty snapshot with the default retention window", async () => {
    const snap = await getAuditSnapshot(dir);
    expect(snap.entries).toEqual([]);
    expect(snap.retentionDays).toBe(__testing.DEFAULT_RETENTION_DAYS);
  });

  it("appends a single entry and reads it back with id + timestamp filled in", async () => {
    const fixedNow = new Date("2026-05-19T10:00:00.000Z");
    const entry = await appendAuditEntry(
      dir,
      {
        category: "cleanup",
        action: "trash",
        summary: "휴지통으로 3개 항목을 보냈어요.",
        detail: { removedCount: 3 }
      },
      fixedNow
    );
    expect(entry.id).toBeTruthy();
    expect(entry.at).toBe(fixedNow.toISOString());

    const snap = await getAuditSnapshot(dir);
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].summary).toBe("휴지통으로 3개 항목을 보냈어요.");
    expect(snap.entries[0].detail).toEqual({ removedCount: 3 });
  });

  it("keeps the newest entries first across multiple appends", async () => {
    const base = new Date("2026-05-19T10:00:00.000Z");
    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "1번째" },
      base
    );
    await appendAuditEntry(
      dir,
      { category: "uninstall", action: "launched", summary: "2번째" },
      new Date(base.getTime() + 1000)
    );
    await appendAuditEntry(
      dir,
      { category: "defender", action: "launched", summary: "3번째" },
      new Date(base.getTime() + 2000)
    );

    const snap = await getAuditSnapshot(dir);
    expect(snap.entries.map((e) => e.summary)).toEqual(["3번째", "2번째", "1번째"]);
  });

  it("prunes entries older than retentionDays on read", async () => {
    // Seed three entries: one fresh, one inside the window, one stale.
    const now = new Date("2026-05-19T10:00:00.000Z");
    const fresh = new Date(now.getTime() - 1 * DAY_MS);
    const middle = new Date(now.getTime() - 45 * DAY_MS);
    const stale = new Date(now.getTime() - 120 * DAY_MS); // > 90 days

    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "fresh" },
      fresh
    );
    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "middle" },
      middle
    );
    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "stale" },
      stale
    );

    const snap = await getAuditSnapshot(dir, now);
    const summaries = snap.entries.map((e) => e.summary);
    expect(summaries).toContain("fresh");
    expect(summaries).toContain("middle");
    expect(summaries).not.toContain("stale");
  });

  it("compacts the file on read when pruning happens", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "stale" },
      new Date(now.getTime() - 200 * DAY_MS)
    );

    // First read prunes + compacts.
    const first = await getAuditSnapshot(dir, now);
    expect(first.entries).toEqual([]);

    // Second read should hit the now-empty file directly.
    const raw = readFileSync(join(dir, "formatbuddy-audit-log.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.entries).toEqual([]);
  });

  it("does not write the audit log through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const outsideLog = join(dir, "outside-audit-log.json");
    const auditLog = join(dir, "formatbuddy-audit-log.json");
    writeFileSync(outsideLog, "outside stays put");
    symlinkSync(outsideLog, auditLog);

    await appendAuditEntry(
      dir,
      { category: "cleanup", action: "trash", summary: "safe write" },
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(readFileSync(outsideLog, "utf8")).toBe("outside stays put");
    expect(lstatSync(auditLog).isSymbolicLink()).toBe(false);
    const snap = await getAuditSnapshot(dir);
    expect(snap.entries.map((entry) => entry.summary)).toEqual(["safe write"]);
  });
});

describe("coerce + sanity guards", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-audit-coerce-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips entries with invalid category", () => {
    const result = __testing.coerceEntry({
      id: "x",
      at: "2026-05-19T10:00:00.000Z",
      category: "nope",
      action: "trash",
      summary: "x"
    });
    expect(result).toBeNull();
  });

  it("skips entries missing required string fields", () => {
    expect(
      __testing.coerceEntry({ id: "x", at: "2026-05-19T10:00:00.000Z", category: "cleanup" })
    ).toBeNull();
  });

  it("strips array detail (only plain objects allowed)", () => {
    const result = __testing.coerceEntry({
      id: "x",
      at: "2026-05-19T10:00:00.000Z",
      category: "cleanup",
      action: "trash",
      summary: "x",
      detail: ["nope"]
    });
    expect(result?.detail).toBeUndefined();
  });

  it("survives a hand-written corrupt log file", async () => {
    writeFileSync(
      join(dir, "formatbuddy-audit-log.json"),
      JSON.stringify({
        version: 1,
        retentionDays: 30,
        entries: [
          { id: "ok", at: "2026-05-19T10:00:00.000Z", category: "cleanup", action: "trash", summary: "good" },
          { id: "no-action", at: "2026-05-19T10:00:00.000Z", category: "cleanup", summary: "missing action" },
          "garbage string"
        ]
      })
    );
    const snap = await getAuditSnapshot(dir, new Date("2026-05-19T11:00:00.000Z"));
    expect(snap.entries.map((e) => e.id)).toEqual(["ok"]);
    expect(snap.retentionDays).toBe(30);
  });
});
