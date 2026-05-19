import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  backupAndDeleteRegistryKey,
  isSafeUninstallRegistryKeyPath,
  listRegistryBackups,
  purgeExpiredRegistryBackups,
  restoreRegistryBackup
} from "../src/main/apps/registryCleanup";

interface Fixture {
  root: string;
  userDataDir: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-registry-cleanup-"));
  return {
    root,
    userDataDir: join(root, "userdata"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe("registry leftover cleanup", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("only allows uninstall registry subkeys", () => {
    expect(
      isSafeUninstallRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes"
      )
    ).toBe(true);
    expect(
      isSafeUninstallRegistryKeyPath(
        "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes"
      )
    ).toBe(true);
    expect(
      isSafeUninstallRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
      )
    ).toBe(false);
    expect(isSafeUninstallRegistryKeyPath("HKCU\\Software\\Acme")).toBe(false);
    expect(
      isSafeUninstallRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme\nNotes"
      )
    ).toBe(false);
  });

  it("exports a backup before deleting the selected registry key", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        calls.push("export");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => {
        calls.push("delete");
      })
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual(["export", "delete"]);
    expect(runner.exportKey).toHaveBeenCalledWith(keyPath, result.backupPath);
    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    expect(result.expiresAt).toBe("2026-06-18T00:00:00.000Z");

    const metaPath = join(
      fx.userDataDir,
      "formatbuddy-registry-backups",
      "items",
      result.id,
      "meta.json"
    );
    const meta = JSON.parse(await readFile(metaPath, "utf8"));
    expect(meta).toMatchObject({
      id: result.id,
      keyPath,
      backupPath: result.backupPath,
      createdAt: "2026-05-19T00:00:00.000Z",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
  });

  it("does not delete when the registry backup export fails", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => {
        throw new Error("export failed");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow("export failed");

    expect(runner.deleteKey).not.toHaveBeenCalled();
  });

  it("purges registry backups after the 30-day window", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const purge = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:00.000Z")
    });

    expect(purge).toEqual({
      purgedCount: 1,
      purgedIds: [result.id],
      retentionDays: 30
    });
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });

  it("lists registry backups for the restore bin surface", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.retentionDays).toBe(30);
    expect(snapshot.entries).toEqual([
      {
        id: result.id,
        keyPath,
        backupPath: result.backupPath,
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z"
      }
    ]);
    expect(snapshot.nextExpiryAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("restores a registry backup and removes it from the 30-day bin", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => {
        calls.push("import");
      })
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(calls).toEqual(["import"]);
    expect(runner.importFile).toHaveBeenCalledWith(result.backupPath);
    expect(restored).toMatchObject({
      backupId: result.id,
      status: "restored",
      keyPath,
      message: "레지스트리 백업을 되돌렸어요."
    });
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toEqual([]);
  });

  it("runs the safety hook before importing a registry backup", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => {
        calls.push("import");
      })
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });

    await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner,
      beforeImport: async () => {
        calls.push("safety-hook");
      }
    });

    expect(calls).toEqual(["safety-hook", "import"]);
  });

  it("keeps importing when the best-effort safety hook fails", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner,
      beforeImport: async () => {
        throw new Error("restore point unavailable");
      }
    });

    expect(restored.status).toBe("restored");
    expect(runner.importFile).toHaveBeenCalledWith(result.backupPath);
  });

  it("reports missing-backup when the metadata exists but the reg file is gone", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await rm(result.backupPath);

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored).toMatchObject({
      backupId: result.id,
      status: "missing-backup",
      keyPath
    });
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("refuses unsafe backup ids when restoring registry backups", async () => {
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };

    const result = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: "../outside",
      runner
    });

    expect(result.status).toBe("blocked-path");
    expect(runner.importFile).not.toHaveBeenCalled();
  });
});
