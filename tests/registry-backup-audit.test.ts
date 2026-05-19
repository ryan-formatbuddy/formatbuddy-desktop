import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getAuditSnapshot } from "../src/main/audit/log";
import { backupAndDeleteRegistryKey, __testing } from "../src/main/apps/registryCleanup";
import { purgeExpiredRegistryBackupsWithAudit } from "../src/main/apps/registryBackupAudit";

interface Fixture {
  root: string;
  userData: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-registry-audit-"));
  return {
    root,
    userData: join(root, "userdata"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe("purgeExpiredRegistryBackupsWithAudit", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("records an audit entry when expired registry backups are purged automatically", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userData,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const result = await purgeExpiredRegistryBackupsWithAudit({
      userDataDir: fx.userData,
      trigger: "startup",
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result.purgedCount).toBe(1);
    expect(result.purgedBytes).toBe(Buffer.byteLength("Windows Registry Editor Version 5.00", "utf8"));
    expect(existsSync(backup.backupPath)).toBe(false);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-06-18T00:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "registry-backup-expired-purge-startup",
      summary: "30일이 지난 앱 삭제 흔적 백업 1개를 자동으로 비웠어요."
    });
    expect(audit.entries[0].summary).not.toContain("영구");
    expect(audit.entries[0].detail).toMatchObject({
      purgedCount: 1,
      purgedBytes: Buffer.byteLength("Windows Registry Editor Version 5.00", "utf8"),
      purgedIds: [backup.id],
      trigger: "startup"
    });
  });

  it("does not record an audit entry when no registry backup expired", async () => {
    const result = await purgeExpiredRegistryBackupsWithAudit({
      userDataDir: fx.userData,
      trigger: "registry-list",
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    expect(result.purgedCount).toBe(0);
    expect(result.purgedBytes).toBe(0);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-05-19T00:00:01.000Z"));
    expect(audit.entries).toEqual([]);
  });

  it("records an audit entry when an expired registry backup could not be emptied", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Busy Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userData,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const result = await purgeExpiredRegistryBackupsWithAudit({
      userDataDir: fx.userData,
      trigger: "scheduled",
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      removeEntryDir: async () => {
        throw new Error("busy");
      }
    });

    expect(result.purgedCount).toBe(0);
    expect(result.failedIds).toEqual([backup.id]);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-06-18T00:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "registry-backup-expired-purge-failed-scheduled",
      summary: "30일이 지난 앱 삭제 흔적 백업 1개를 아직 비우지 못했어요."
    });
    expect(audit.entries[0].summary).not.toContain("영구");
    expect(audit.entries[0].detail).toMatchObject({
      purgedCount: 0,
      failedIds: [backup.id],
      trigger: "scheduled"
    });
  });

  it("cleans non-restorable registry backup store items during startup purge without an audit entry", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userData);
    const outside = join(fx.root, "outside-registry-startup.reg");
    const looseFile = join(root, "loose.reg");
    const linkedFile = join(root, "linked-outside");
    await mkdir(root, { recursive: true });
    await writeFile(outside, "outside stays put", "utf8");
    await writeFile(looseFile, "loose", "utf8");
    await symlink(outside, linkedFile);

    const result = await purgeExpiredRegistryBackupsWithAudit({
      userDataDir: fx.userData,
      trigger: "startup",
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(result.purgedCount).toBe(0);
    expect(result.purgedBytes).toBe(0);
    expect(existsSync(looseFile)).toBe(false);
    expect(existsSync(linkedFile)).toBe(false);
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-05-20T00:00:01.000Z"));
    expect(audit.entries).toEqual([]);
  });
});
