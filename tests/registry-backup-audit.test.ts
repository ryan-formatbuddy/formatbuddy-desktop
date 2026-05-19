import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getAuditSnapshot } from "../src/main/audit/log";
import { backupAndDeleteRegistryKey } from "../src/main/apps/registryCleanup";
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
    expect(existsSync(backup.backupPath)).toBe(false);
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-06-18T00:00:02.000Z"));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      category: "cleanup",
      action: "registry-backup-expired-purge-startup",
      summary: "30일이 지난 앱 삭제 흔적 백업 1개를 영구 정리했어요."
    });
    expect(audit.entries[0].detail).toMatchObject({
      purgedCount: 1,
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
    const audit = await getAuditSnapshot(fx.userData, new Date("2026-05-19T00:00:01.000Z"));
    expect(audit.entries).toEqual([]);
  });
});
