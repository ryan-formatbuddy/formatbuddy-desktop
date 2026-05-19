import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CleanupItem } from "../src/shared/types";
import { getAuditSnapshot } from "../src/main/audit/log";
import { moveToFormatBuddyTrash } from "../src/main/cleanup/trash";
import { purgeExpiredTrashWithAudit } from "../src/main/cleanup/trashAudit";

interface Fixture {
  root: string;
  userData: string;
  home: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-trash-audit-"));
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

describe("purgeExpiredTrashWithAudit", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("records an audit entry when expired trash is purged automatically", async () => {
    const source = join(fx.home, "AppData", "Local", "Temp", "old.tmp");
    await mkdir(join(source, ".."), { recursive: true });
    await writeFile(source, "hello", "utf8");
    const entry = await moveToFormatBuddyTrash({
      userDataDir: fx.userData,
      item: makeItem(source),
      sizeBytes: 5,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    const result = await purgeExpiredTrashWithAudit({
      userDataDir: fx.userData,
      trigger: "startup",
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result.purgedCount).toBe(1);
    expect(existsSync(entry.storedPath)).toBe(false);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-06-18T00:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "trash-expired-purge-startup",
      summary: "30일이 지난 복구함 항목 1개를 자동으로 비웠어요."
    });
    expect(audit.entries[0].summary).not.toContain("영구");
    expect(audit.entries[0].detail).toMatchObject({
      purgedCount: 1,
      purgedBytes: 5,
      trigger: "startup"
    });
  });

  it("does not record an audit entry when nothing expired", async () => {
    const result = await purgeExpiredTrashWithAudit({
      userDataDir: fx.userData,
      trigger: "trash-list",
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    expect(result.purgedCount).toBe(0);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-05-19T00:00:01.000Z"));
    expect(audit.entries).toEqual([]);
  });
});
