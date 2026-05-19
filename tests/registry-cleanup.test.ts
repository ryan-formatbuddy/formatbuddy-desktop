import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  backupAndDeleteRegistryKey,
  isSafeUninstallRegistryKeyPath,
  listRegistryBackups,
  purgeExpiredRegistryBackups,
  restoreRegistryBackup,
  __testing
} from "../src/main/apps/registryCleanup";

const REGISTRY_BACKUP_CONTENT = "Windows Registry Editor Version 5.00";

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
        await writeFile(backupPath, REGISTRY_BACKUP_CONTENT, "utf8");
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
    expect(result.sizeBytes).toBe(Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8"));
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
      sizeBytes: Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8"),
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
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export reports success without a backup file", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/백업 파일|backup file/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export does not look like a reg file", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "not a registry backup", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export writes through a symbolic link", async () => {
    if (process.platform === "win32") return;
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const outside = join(fx.root, "outside-backup.reg");
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(outside, "outside stays put", "utf8");
        await symlink(outside, backupPath);
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/링크|link/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup metadata path is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const outsideMeta = join(fx.root, "outside-meta.json");
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
        await writeFile(outsideMeta, "outside stays put", "utf8");
        await symlink(outsideMeta, join(dirname(backupPath), "meta.json"));
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/정보 파일|metadata|meta|링크|link/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    expect(await readFile(outsideMeta, "utf8")).toBe("outside stays put");
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("removes the temporary backup when registry deletion fails after export", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    let exportedBackupPath = "";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
      }),
      deleteKey: vi.fn(async () => {
        throw new Error("delete failed");
      })
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow("delete failed");

    expect(runner.exportKey).toHaveBeenCalled();
    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    await expect(readFile(exportedBackupPath, "utf8")).rejects.toThrow();
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toEqual([]);
  });

  it("purges registry backups after the 30-day window", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, REGISTRY_BACKUP_CONTENT, "utf8");
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
        sizeBytes: Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8"),
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z"
      }
    ]);
    expect(snapshot.nextExpiryAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("prunes unexpected files and links inside the registry backup bin", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const outside = join(fx.root, "outside-registry-backup.reg");
    const looseFile = join(root, "loose.reg");
    const linkedFile = join(root, "linked-outside");
    await mkdir(root, { recursive: true });
    await writeFile(outside, "outside stays put", "utf8");
    await writeFile(looseFile, "loose", "utf8");
    await symlink(outside, linkedFile);

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(looseFile)).toBe(false);
    expect(existsSync(linkedFile)).toBe(false);
    expect(await readFile(outside, "utf8")).toBe("outside stays put");
  });

  it("removes a linked registry backup items folder without touching the target", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const outsideItems = join(fx.root, "outside-registry-items");
    const outsideFile = join(outsideItems, "backup.reg");
    await mkdir(join(root, ".."), { recursive: true });
    await mkdir(outsideItems, { recursive: true });
    await writeFile(outsideFile, "outside stays put", "utf8");
    await symlink(outsideItems, root, "dir");

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(root)).toBe(false);
    expect(await readFile(outsideFile, "utf8")).toBe("outside stays put");
  });

  it("removes a linked registry backup items folder during automatic purge", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const outsideItems = join(fx.root, "outside-registry-purge-items");
    const outsideFile = join(outsideItems, "backup.reg");
    await mkdir(join(root, ".."), { recursive: true });
    await mkdir(outsideItems, { recursive: true });
    await writeFile(outsideFile, "outside stays put", "utf8");
    await symlink(outsideItems, root, "dir");

    const result = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result).toEqual({
      purgedCount: 0,
      purgedIds: [],
      retentionDays: 30
    });
    expect(existsSync(root)).toBe(false);
    expect(await readFile(outsideFile, "utf8")).toBe("outside stays put");
  });

  it("purges a registry backup entry with linked metadata without touching the target", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const entryId = "expired-linked-meta";
    const entryDir = join(root, entryId);
    const backupPath = join(entryDir, "backup.reg");
    const outsideMeta = join(fx.root, "outside-expired-meta.json");
    await mkdir(entryDir, { recursive: true });
    await writeFile(backupPath, "Windows Registry Editor Version 5.00", "utf8");
    await writeFile(
      outsideMeta,
      JSON.stringify(
        {
          id: entryId,
          keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes",
          backupPath,
          createdAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );
    await symlink(outsideMeta, join(entryDir, "meta.json"));

    const result = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result).toEqual({
      purgedCount: 1,
      purgedIds: [entryId],
      retentionDays: 30
    });
    expect(existsSync(entryDir)).toBe(false);
    expect(await readFile(outsideMeta, "utf8")).toContain(entryId);
  });

  it("prunes registry backup folders that cannot be restored", async () => {
    const brokenDir = join(__testing.registryBackupItemsRoot(fx.userDataDir), "broken-meta");
    await mkdir(brokenDir, { recursive: true });
    await writeFile(join(brokenDir, "meta.json"), "{not-json", "utf8");

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(brokenDir)).toBe(false);
  });

  it("prunes registry backup folders when the backup file is missing", async () => {
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
    const backupDir = join(__testing.registryBackupItemsRoot(fx.userDataDir), result.id);
    await rm(result.backupPath);

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toEqual([]);
    expect(existsSync(backupDir)).toBe(false);
  });

  it("caps edited registry backup expiry to the 30-day window", async () => {
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
    const metaPath = join(
      __testing.registryBackupItemsRoot(fx.userDataDir),
      result.id,
      "meta.json"
    );
    await writeFile(
      metaPath,
      JSON.stringify({ ...result, expiresAt: "2027-05-19T00:00:00.000Z" }, null, 2),
      "utf8"
    );

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(snapshot.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");

    const purge = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });
    expect(purge).toMatchObject({ purgedCount: 1, purgedIds: [result.id] });
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });

  it("does not purge registry backups earlier than 30 days when expiry was shortened", async () => {
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
    const metaPath = join(
      __testing.registryBackupItemsRoot(fx.userDataDir),
      result.id,
      "meta.json"
    );
    await writeFile(
      metaPath,
      JSON.stringify({ ...result, expiresAt: "2026-05-20T00:00:00.000Z" }, null, 2),
      "utf8"
    );

    const earlyPurge = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-21T00:00:00.000Z")
    });
    expect(earlyPurge.purgedCount).toBe(0);

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-21T00:00:01.000Z")
    });
    expect(snapshot.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
    await expect(readFile(result.backupPath, "utf8")).resolves.toContain("Windows Registry");
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
      runner,
      app: { name: "Acme Notes", publisher: "Acme Corp." }
    });

    const onAppRegistryBackupRestored = vi.fn();
    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner,
      onAppRegistryBackupRestored
    });

    expect(calls).toEqual(["import"]);
    expect(runner.importFile).toHaveBeenCalledWith(result.backupPath);
    expect(restored).toMatchObject({
      backupId: result.id,
      status: "restored",
      keyPath,
      message: "앱 삭제 흔적 백업을 되돌렸어요."
    });
    expect(restored.entry).toMatchObject({
      appName: "Acme Notes",
      appPublisher: "Acme Corp."
    });
    expect(onAppRegistryBackupRestored).toHaveBeenCalledWith({
      name: "Acme Notes",
      publisher: "Acme Corp.",
      registryKeyPath: keyPath
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

  it("refuses non-string backup ids when restoring registry backups without throwing", async () => {
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };

    const result = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: null as unknown as string,
      runner
    });

    expect(result.status).toBe("blocked-path");
    expect(runner.importFile).not.toHaveBeenCalled();
  });
});
