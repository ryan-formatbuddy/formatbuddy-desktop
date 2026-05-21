import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StartupAutoEntry } from "../src/shared/types";
import { getAuditSnapshot } from "../src/main/audit/log";
import {
  disableStartupFolderEntry,
  __testing
} from "../src/main/startup/folderToggle";
import { purgeExpiredStartupFolderEntriesWithAudit } from "../src/main/startup/folderToggleAudit";

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "fb-startup-toggle-audit-"));
  const userDataDir = join(root, "user-data");
  const startupDir = join(root, "Startup");
  return { root, userDataDir, startupDir };
}

function startupEntry(path: string, origin: string, name = "KakaoTalk.lnk"): StartupAutoEntry {
  return {
    id: `startup-folder|${name.toLowerCase()}|${path.toLowerCase()}`,
    kind: "startup-folder",
    name,
    path,
    origin
  };
}

describe("purgeExpiredStartupFolderEntriesWithAudit", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("records an audit entry when expired disabled startup items are purged", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "KakaoTalk.lnk");
    writeFileSync(source, "shortcut");
    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });

    const result = await purgeExpiredStartupFolderEntriesWithAudit({
      userDataDir: fx.userDataDir,
      trigger: "startup",
      now: () => new Date("2026-06-19T10:00:01.000Z")
    });

    expect(result.purgedCount).toBe(1);
    expect(result.purgedBytes).toBe(Buffer.byteLength("shortcut"));
    expect(result.purgedIds).toEqual([disabled.entry!.id]);
    expect(existsSync(disabled.entry!.storedPath)).toBe(false);
    const audit = await getAuditSnapshot(fx.userDataDir, new Date("2026-06-19T10:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "startup-disabled-expired-purge-startup",
      summary: "30일이 지난 잠시 꺼둔 시작 항목 1개를 자동으로 비웠어요."
    });
    expect(audit.entries[0].summary).not.toContain("영구");
    expect(audit.entries[0].detail).toMatchObject({
      purgedCount: 1,
      purgedBytes: Buffer.byteLength("shortcut"),
      purgedIds: [disabled.entry!.id],
      purgedItems: [
        {
          id: disabled.entry!.id,
          label: "KakaoTalk.lnk",
          sizeBytes: Buffer.byteLength("shortcut")
        }
      ],
      trigger: "startup"
    });
  });

  it("records an audit entry when an expired disabled startup item could not be purged", async () => {
    const fx = makeFixture();
    roots.push(fx.root);
    await mkdir(fx.startupDir, { recursive: true });
    const source = join(fx.startupDir, "Teams.lnk");
    writeFileSync(source, "shortcut");
    const disabled = await disableStartupFolderEntry({
      userDataDir: fx.userDataDir,
      entry: startupEntry(source, fx.startupDir, "Teams.lnk"),
      now: () => new Date("2026-05-20T10:00:00.000Z")
    });
    const removeEntryDir = vi.fn(async () => {
      throw new Error("busy");
    });

    const result = await purgeExpiredStartupFolderEntriesWithAudit({
      userDataDir: fx.userDataDir,
      trigger: "scheduled",
      now: () => new Date("2026-06-19T10:00:01.000Z"),
      removeEntryDir
    });

    expect(result.purgedCount).toBe(0);
    expect(result.purgedBytes).toBe(0);
    expect(result.failedIds).toEqual([disabled.entry!.id]);
    expect(existsSync(__testing.entryDir(fx.userDataDir, disabled.entry!.id))).toBe(true);
    const audit = await getAuditSnapshot(fx.userDataDir, new Date("2026-06-19T10:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "startup-disabled-expired-purge-failed-scheduled",
      summary: "30일이 지난 잠시 꺼둔 시작 항목 1개를 아직 비우지 못했어요."
    });
  });
});
