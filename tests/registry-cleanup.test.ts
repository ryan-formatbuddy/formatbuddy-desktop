import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  backupAndDeleteRegistryValue,
  backupAndDeleteRegistryKey,
  isRegistryBackupPreservedError,
  isSafeAppPathRegistryKeyPath,
  isSafeContextMenuRegistryKeyPath,
  isSafeOpenWithRegistryKeyPath,
  isSafeServiceRegistryKeyPath,
  isSafeStartupRegistryValuePath,
  isSafeUninstallRegistryKeyPath,
  listRegistryBackups,
  normalizeSafeServiceName,
  purgeExpiredRegistryBackups,
  restoreRegistryBackup,
  __testing
} from "../src/main/apps/registryCleanup";
import { summarizeRegistryBackupRestoreResults } from "../src/shared/cleanup-result";

const REGISTRY_BACKUP_HEADER = "Windows Registry Editor Version 5.00";
const ACME_UNINSTALL_KEY_PATH = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";

function registryBackupContentFor(keyPath: string): string {
  const canonicalKeyPath = keyPath
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\");
  return [
    REGISTRY_BACKUP_HEADER,
    "",
    `[${canonicalKeyPath}]`,
    '"DisplayName"="Acme Notes"',
    ""
  ].join("\r\n");
}

const REGISTRY_BACKUP_CONTENT = registryBackupContentFor(ACME_UNINSTALL_KEY_PATH);

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
        " HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes"
      )
    ).toBe(false);
    expect(
      isSafeUninstallRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes "
      )
    ).toBe(false);
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

  it("only allows app paths registry exe subkeys", () => {
    expect(
      isSafeAppPathRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes.exe"
      )
    ).toBe(true);
    expect(
      isSafeAppPathRegistryKeyPath(
        "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes.exe"
      )
    ).toBe(true);
    expect(
      isSafeAppPathRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes"
      )
    ).toBe(false);
    expect(
      isSafeAppPathRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes.exe\\Shell"
      )
    ).toBe(false);
    expect(
      isSafeAppPathRegistryKeyPath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes.exe "
      )
    ).toBe(false);
  });

  it("only allows app connection registry exe subkeys", () => {
    expect(
      isSafeOpenWithRegistryKeyPath(
        "HKCU\\Software\\Classes\\Applications\\AcmeNotes.exe"
      )
    ).toBe(true);
    expect(
      isSafeOpenWithRegistryKeyPath(
        "HKLM\\Software\\Classes\\Applications\\AcmeNotes.exe"
      )
    ).toBe(true);
    expect(
      isSafeOpenWithRegistryKeyPath(
        "HKCU\\Software\\Classes\\Applications\\AcmeNotes"
      )
    ).toBe(false);
    expect(
      isSafeOpenWithRegistryKeyPath(
        "HKCU\\Software\\Classes\\Applications\\AcmeNotes.exe\\shell"
      )
    ).toBe(false);
    expect(
      isSafeOpenWithRegistryKeyPath(
        "HKCR\\Applications\\AcmeNotes.exe"
      )
    ).toBe(false);
  });

  it("only allows safe Windows service registry subkeys", () => {
    expect(normalizeSafeServiceName("AcmeNotesSvc")).toBe("AcmeNotesSvc");
    expect(normalizeSafeServiceName(" AcmeNotesSvc")).toBeUndefined();
    expect(normalizeSafeServiceName("Acme Notes Svc")).toBeUndefined();
    expect(normalizeSafeServiceName("WinDefend")).toBeUndefined();
    expect(isSafeServiceRegistryKeyPath("HKLM\\SYSTEM\\CurrentControlSet\\Services\\AcmeNotesSvc")).toBe(true);
    expect(isSafeServiceRegistryKeyPath("HKCU\\SYSTEM\\CurrentControlSet\\Services\\AcmeNotesSvc")).toBe(false);
    expect(isSafeServiceRegistryKeyPath("HKLM\\SYSTEM\\CurrentControlSet\\Services\\AcmeNotesSvc\\Parameters")).toBe(false);
    expect(isSafeServiceRegistryKeyPath("HKLM\\SYSTEM\\CurrentControlSet\\Services\\Acme Notes")).toBe(false);
  });

  it("only allows Run and RunOnce startup registry values", () => {
    expect(
      isSafeStartupRegistryValuePath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "Acme Notes"
      )
    ).toBe(true);
    expect(
      isSafeStartupRegistryValuePath(
        "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
        "Acme Notes"
      )
    ).toBe(true);
    expect(
      isSafeStartupRegistryValuePath(
        " HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "Acme Notes"
      )
    ).toBe(false);
    expect(
      isSafeStartupRegistryValuePath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Acme Notes",
        "Acme Notes"
      )
    ).toBe(false);
    expect(
      isSafeStartupRegistryValuePath(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "Acme\nNotes"
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
    expect(result.contentHash?.algorithm).toBe("sha256");
    expect(result.contentHash?.value).toMatch(/^[a-f0-9]{64}$/);

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
      contentHash: result.contentHash,
      createdAt: "2026-05-19T00:00:00.000Z",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
  });

  it("exports a backup before deleting an app paths registry key", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcmeNotes.exe";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        calls.push("export");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        calls.push("delete");
      })
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      backupKind: "app-path-key",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual(["export", "delete"]);
    expect(result).toMatchObject({
      keyPath,
      backupKind: "app-path-key",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    const listed = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(listed.entries[0]).toMatchObject({
      keyPath,
      backupKind: "app-path-key"
    });
  });

  it("exports a backup before deleting an app connection registry key", async () => {
    const keyPath = "HKCU\\Software\\Classes\\Applications\\AcmeNotes.exe";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        calls.push("export");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        calls.push("delete");
      })
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      backupKind: "open-with-key",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual(["export", "delete"]);
    expect(result).toMatchObject({
      keyPath,
      backupKind: "open-with-key",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    const listed = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(listed.entries[0]).toMatchObject({
      keyPath,
      backupKind: "open-with-key"
    });
  });

  it("accepts only narrow right-click menu registry keys", () => {
    expect(
      isSafeContextMenuRegistryKeyPath("HKCU\\Software\\Classes\\*\\shell\\Acme Notes")
    ).toBe(true);
    expect(
      isSafeContextMenuRegistryKeyPath(
        "HKLM\\Software\\Classes\\Directory\\Background\\shell\\Acme Notes"
      )
    ).toBe(true);
    expect(
      isSafeContextMenuRegistryKeyPath("HKCU\\Software\\Classes\\.txt\\shell\\Acme Notes")
    ).toBe(false);
    expect(
      isSafeContextMenuRegistryKeyPath("HKCU\\Software\\Classes\\*\\shell\\Acme Notes\\command")
    ).toBe(false);
    expect(
      isSafeContextMenuRegistryKeyPath("HKCU\\Software\\Classes\\*\\shell\\Acme & Notes")
    ).toBe(false);
  });

  it("exports a backup before deleting a right-click menu registry key", async () => {
    const keyPath = "HKCU\\Software\\Classes\\*\\shell\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        calls.push("export");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        calls.push("delete");
      })
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      backupKind: "context-menu-key",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual(["export", "delete"]);
    expect(result).toMatchObject({
      keyPath,
      backupKind: "context-menu-key",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    const listed = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(listed.entries[0]).toMatchObject({
      keyPath,
      backupKind: "context-menu-key"
    });
  });

  it("exports a service backup before deleting a Windows service", async () => {
    const keyPath = "HKLM\\SYSTEM\\CurrentControlSet\\Services\\AcmeNotesSvc";
    let serviceExists = true;
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        calls.push("export");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        throw new Error("deleteKey should not run for services");
      }),
      deleteService: vi.fn(async (serviceName: string) => {
        calls.push(`delete-service:${serviceName}`);
        serviceExists = false;
      }),
      serviceExists: vi.fn(async () => serviceExists)
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      backupKind: "service-key",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual(["export", "delete-service:AcmeNotesSvc"]);
    expect(runner.deleteKey).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      keyPath,
      backupKind: "service-key",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    const listed = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(listed.entries[0]).toMatchObject({
      keyPath,
      backupKind: "service-key"
    });
  });

  it("accepts UTF-16LE registry export files from reg.exe before deleting a selected key", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const utf16Content = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(registryBackupContentFor(keyPath), "utf16le")
    ]);
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, utf16Content);
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    expect(result.sizeBytes).toBe(utf16Content.byteLength);
    expect(result.contentHash?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
  });

  it("cleans registry backup app labels with control characters before writing metadata", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner,
      app: { name: "Acme\nNotes", publisher: "Acme\0Corp." }
    });

    expect(result.appName).toBe("Acme Notes");
    expect(result.appPublisher).toBe("Acme Corp.");

    const metaPath = join(
      fx.userDataDir,
      "formatbuddy-registry-backups",
      "items",
      result.id,
      "meta.json"
    );
    const meta = JSON.parse(await readFile(metaPath, "utf8"));
    expect(meta.appName).toBe("Acme Notes");
    expect(meta.appPublisher).toBe("Acme Corp.");

    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries[0].appName).toBe("Acme Notes");
    expect(snapshot.entries[0].appPublisher).toBe("Acme Corp.");
  });

  it("exports a value-only backup before deleting a startup registry value", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        calls.push("export-value");
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => {
        calls.push("delete-value");
      })
    };

    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner,
      app: { name: "Acme Notes", publisher: "Acme Corp." }
    });

    expect(calls).toEqual(["export-value", "delete-value"]);
    expect(runner.exportValue).toHaveBeenCalledWith(keyPath, valueName, result.backupPath);
    expect(runner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    expect(result).toMatchObject({
      keyPath,
      valueName,
      backupKind: "startup-value",
      appName: "Acme Notes",
      appPublisher: "Acme Corp.",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    expect(result.contentHash?.algorithm).toBe("sha256");
    expect(result.contentHash?.value).toMatch(/^[a-f0-9]{64}$/);

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
      valueName,
      backupKind: "startup-value",
      contentHash: result.contentHash,
      createdAt: "2026-05-19T00:00:00.000Z",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
  });

  it("does not keep a registry backup entry when the key still exists after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn(async () => true)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/still exists|아직 남아/);

    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("keeps a restorable registry backup when the post-delete key check fails", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn(async () => {
        throw new Error("post-delete registry check unavailable");
      })
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      })
    ).rejects.toThrow(/post-delete registry check unavailable/);

    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries).toHaveLength(1);
    expect(backups.entries[0]).toMatchObject({
      keyPath,
      expiresAt: "2026-06-18T00:00:00.000Z",
      integrityStatus: "verified"
    });
    await expect(readFile(backups.entries[0].backupPath, "utf8")).resolves.toContain(
      "Windows Registry"
    );
  });

  it("preserves a registry key backup when delete reports an error after the key disappeared", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        throw new Error("reg delete reported a late failure");
      }),
      keyExists: vi.fn(async () => false)
    };

    let thrown: unknown;
    try {
      await backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isRegistryBackupPreservedError(thrown)).toBe(true);
    const backup = isRegistryBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries.map((entry) => entry.id)).toEqual([backup?.id]);
    expect(backups.entries[0]).toMatchObject({ keyPath, integrityStatus: "verified" });
  });

  it("preserves a registry key backup when delete reports an error and the key check is unavailable", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        throw new Error("reg delete reported a late failure");
      }),
      keyExists: vi.fn(async () => {
        throw new Error("registry key check unavailable");
      })
    };

    let thrown: unknown;
    try {
      await backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isRegistryBackupPreservedError(thrown)).toBe(true);
    const backup = isRegistryBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries.map((entry) => entry.id)).toEqual([backup?.id]);
    expect(backups.entries[0]).toMatchObject({ keyPath, integrityStatus: "verified" });
  });

  it("does not report a registry key cleanup as restorable when the backup file disappears after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    let exportedBackupPath = "";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        await rm(exportedBackupPath, { force: true });
      })
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/백업|backup|보이지|찾지/i);

    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("recreates registry key backup metadata when it disappears after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    let exportedBackupPath = "";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        await rm(join(dirname(exportedBackupPath), "meta.json"), { force: true });
      })
    };

    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });

    expect(runner.deleteKey).toHaveBeenCalledWith(keyPath);
    await expect(readFile(join(dirname(exportedBackupPath), "meta.json"), "utf8")).resolves.toContain(
      '"keyPath"'
    );
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
    expect(snapshot.entries[0]).toMatchObject({ keyPath, integrityStatus: "verified" });
  });

  it("recreates startup value backup metadata when it disappears after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    let exportedBackupPath = "";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => {
        await rm(join(dirname(exportedBackupPath), "meta.json"), { force: true });
      })
    };

    const backup = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner
    });

    expect(runner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
    expect(snapshot.entries[0]).toMatchObject({
      keyPath,
      backupKind: "startup-value",
      valueName,
      integrityStatus: "verified"
    });
  });

  it("preserves a startup value backup when delete reports an error after the value disappeared", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => {
        throw new Error("reg value delete reported a late failure");
      }),
      valueExists: vi.fn(async () => false)
    };

    let thrown: unknown;
    try {
      await backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath,
        valueName,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isRegistryBackupPreservedError(thrown)).toBe(true);
    const backup = isRegistryBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries.map((entry) => entry.id)).toEqual([backup?.id]);
    expect(backups.entries[0]).toMatchObject({
      keyPath,
      valueName,
      backupKind: "startup-value",
      integrityStatus: "verified"
    });
  });

  it("preserves a startup value backup when delete reports an error and the value check is unavailable", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => {
        throw new Error("reg value delete reported a late failure");
      }),
      valueExists: vi.fn(async () => {
        throw new Error("startup value check unavailable");
      })
    };

    let thrown: unknown;
    try {
      await backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath,
        valueName,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isRegistryBackupPreservedError(thrown)).toBe(true);
    const backup = isRegistryBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries.map((entry) => entry.id)).toEqual([backup?.id]);
    expect(backups.entries[0]).toMatchObject({
      keyPath,
      valueName,
      backupKind: "startup-value",
      integrityStatus: "verified"
    });
  });

  it("does not keep a registry backup entry when the startup value still exists after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      valueExists: vi.fn(async () => true)
    };

    await expect(
      backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath,
        valueName,
        runner
      })
    ).rejects.toThrow(/still exists|아직 남아/);

    expect(runner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not report a startup value cleanup as restorable when the backup file disappears after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    let exportedBackupPath = "";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => {
        await rm(exportedBackupPath, { force: true });
      })
    };

    await expect(
      backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath,
        valueName,
        runner
      })
    ).rejects.toThrow(/백업|backup|보이지|찾지/i);

    expect(runner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("keeps a restorable startup value backup when the post-delete value check fails", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      valueExists: vi.fn(async () => {
        throw new Error("post-delete startup value check unavailable");
      })
    };

    await expect(
      backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath,
        valueName,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      })
    ).rejects.toThrow(/post-delete startup value check unavailable/);

    expect(runner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    const backups = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(backups.entries).toHaveLength(1);
    expect(backups.entries[0]).toMatchObject({
      keyPath,
      valueName,
      backupKind: "startup-value",
      expiresAt: "2026-06-18T00:00:00.000Z",
      integrityStatus: "verified"
    });
  });

  it("does not delete a startup registry value when the value backup fails", async () => {
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async () => {
        throw new Error("value export failed");
      }),
      deleteValue: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        valueName: "Acme Notes",
        runner
      })
    ).rejects.toThrow("value export failed");

    expect(runner.deleteValue).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the uninstall registry key has whitespace padding", async () => {
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath: " HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes",
        runner
      })
    ).rejects.toThrow(/지원하는 앱 제거 레지스트리 위치|registry/i);

    expect(runner.exportKey).not.toHaveBeenCalled();
    expect(runner.deleteKey).not.toHaveBeenCalled();
  });

  it("does not delete when the startup registry value name has whitespace padding", async () => {
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryValue({
        userDataDir: fx.userDataDir,
        keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        valueName: " Acme Notes",
        runner
      })
    ).rejects.toThrow(/지원하는 시작 항목 레지스트리 위치|registry/i);

    expect(runner.exportValue).not.toHaveBeenCalled();
    expect(runner.deleteValue).not.toHaveBeenCalled();
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

  it("does not delete when the registry backup export has no registry section to restore", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, "Windows Registry Editor Version 5.00\r\n\r\n", "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|위치/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export has no restorable value", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
            ""
          ].join("\r\n"),
          "utf8"
        );
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|값|value/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup value is outside the expected section", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "\"DisplayName\"=\"Acme Notes\"",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
            ""
          ].join("\r\n"),
          "utf8"
        );
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|값|value/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export contains a delete section", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[-HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
            ""
          ].join("\r\n"),
          "utf8"
        );
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|위치/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export contains a value delete line", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
            "\"DisplayName\"=-",
            ""
          ].join("\r\n"),
          "utf8"
        );
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|값|value/i);

    expect(runner.deleteKey).not.toHaveBeenCalled();
    await expect(readdir(__testing.registryBackupItemsRoot(fx.userDataDir))).resolves.toEqual([]);
  });

  it("does not delete when the registry backup export contains a default value delete line with spaces", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
            "@ = -",
            ""
          ].join("\r\n"),
          "utf8"
        );
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      backupAndDeleteRegistryKey({
        userDataDir: fx.userDataDir,
        keyPath,
        runner
      })
    ).rejects.toThrow(/레지스트리 백업|registry backup|값|value/i);

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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
      purgedBytes: Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8"),
      purgedIds: [result.id],
      purgedItems: [
        {
          id: result.id,
          label: "Acme Notes",
          backupKind: "key",
          sizeBytes: Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8")
        }
      ],
      retentionDays: 30
    });
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });

  it("keeps other expired registry backups purgeable when one backup folder cannot be removed", async () => {
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const blocked = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Blocked Notes",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });
    const ok = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Ok Notes",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const purge = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:00.000Z"),
      removeEntryDir: async (dir, entryId) => {
        if (entryId === blocked.id) throw new Error("backup is busy");
        await rm(dir, { recursive: true, force: true });
      }
    });

    expect(purge.purgedCount).toBe(1);
    expect(purge.purgedIds).toEqual([ok.id]);
    expect(purge.failedIds).toEqual([blocked.id]);
    expect(existsSync(blocked.backupPath)).toBe(true);
    await expect(readFile(ok.backupPath, "utf8")).rejects.toThrow();
  });

  it("counts an expired registry backup as purged when folder removal reports a late failure after deletion", async () => {
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Late Notes",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });
    const backupDir = join(__testing.registryBackupItemsRoot(fx.userDataDir), result.id);

    const purge = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:00.000Z"),
      removeEntryDir: async (dir) => {
        await rm(dir, { recursive: true, force: true });
        throw new Error("registry backup remove reported a late failure");
      }
    });

    expect(purge.purgedCount).toBe(1);
    expect(purge.purgedIds).toEqual([result.id]);
    expect(purge.failedIds).toBeUndefined();
    expect(existsSync(backupDir)).toBe(false);
  });

  it("lists registry backups for the restore bin surface", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        contentHash: result.contentHash,
        integrityStatus: "verified",
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
      purgedBytes: 0,
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
      purgedBytes: 0,
      purgedIds: [entryId],
      retentionDays: 30
    });
    expect(existsSync(entryDir)).toBe(false);
    expect(await readFile(outsideMeta, "utf8")).toContain(entryId);
  });

  it("does not count an expired registry backup as purged when its folder still exists", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const result = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      removeEntryDir: async () => undefined
    });

    expect(result).toEqual({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      failedIds: [backup.id],
      retentionDays: 30
    });
    expect(existsSync(join(__testing.registryBackupItemsRoot(fx.userDataDir), backup.id))).toBe(true);
  });

  it("keeps an expired registry backup when its folder contains a symbolic link", async () => {
    if (process.platform === "win32") return;
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Linked Notes",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });
    const entryDir = join(__testing.registryBackupItemsRoot(fx.userDataDir), backup.id);
    const outside = join(fx.root, "outside-registry-linked");
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "outside.reg"), "outside should stay", "utf8");
    await symlink(outside, join(entryDir, "linked-outside"), "dir");

    const result = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result).toEqual({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      failedIds: [backup.id],
      retentionDays: 30
    });
    expect(existsSync(entryDir)).toBe(true);
    expect(await readFile(join(outside, "outside.reg"), "utf8")).toBe("outside should stay");
  });

  it("blocks registry backup purge preflight when an expired backup folder is behind a link", async () => {
    if (process.platform === "win32") return;
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const backupId = "expired-linked-backup";
    const outsideEntryDir = join(fx.root, "outside-registry-backup-entry");

    await mkdir(root, { recursive: true });
    await mkdir(outsideEntryDir, { recursive: true });
    await symlink(outsideEntryDir, join(root, backupId), "dir");

    await expect(
      __testing.assertSafeRegistryBackupEntryDirForPurge(fx.userDataDir, backupId)
    ).rejects.toThrow(/link|backup/i);
  });

  it("does not expose unsafe registry backup folder names in purge results", async () => {
    const root = __testing.registryBackupItemsRoot(fx.userDataDir);
    const unsafeBackupId = "expired backup";
    const entryDir = join(root, unsafeBackupId);
    await mkdir(entryDir, { recursive: true });
    await writeFile(
      join(entryDir, "meta.json"),
      JSON.stringify({
        id: unsafeBackupId,
        keyPath: ACME_UNINSTALL_KEY_PATH,
        backupPath: join(entryDir, "backup.reg"),
        createdAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z"
      }),
      "utf8"
    );

    const result = await purgeExpiredRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-18T00:00:01.000Z")
    });

    expect(result).toEqual({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: 30
    });
    expect(existsSync(entryDir)).toBe(true);
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
    expect(purge).toMatchObject({
      purgedCount: 1,
      purgedBytes: Buffer.byteLength(REGISTRY_BACKUP_CONTENT, "utf8"),
      purgedIds: [result.id]
    });
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });

  it("does not purge registry backups earlier than 30 days when expiry was shortened", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
    expect(earlyPurge.purgedBytes).toBe(0);

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-21T00:00:01.000Z")
    });
    expect(snapshot.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
    await expect(readFile(result.backupPath, "utf8")).resolves.toContain("Windows Registry");
  });

  it("does not restore a registry backup when metadata moves the 30-day window into the future", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
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
      JSON.stringify(
        {
          ...result,
          createdAt: "2027-05-19T00:00:00.000Z",
          expiresAt: "2027-06-18T00:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      runner
    });

    expect(restored.status).toBe("not-found");
    expect(runner.importFile).not.toHaveBeenCalled();
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });

  it("does not restore an expired registry backup even when automatic purge cannot remove it yet", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
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
      now: () => new Date("2026-06-18T00:00:01.000Z"),
      runner,
      removeEntryDir: async () => {
        throw new Error("backup folder is busy");
      }
    });

    expect(restored.status).toBe("expired");
    expect(restored.message).toMatch(/30일|기간/);
    expect(runner.importFile).not.toHaveBeenCalled();
    await expect(readFile(result.backupPath, "utf8")).resolves.toContain("Windows Registry");
  });

  it("restores a registry backup and removes it from the 30-day bin", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
      backupKind: "key",
      registryKeyPath: keyPath
    });
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toEqual([]);
  });

  it("does not report a registry key backup as restored when the key is still missing after import", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn(async () => false),
      importFile: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      runner
    });

    expect(runner.importFile).toHaveBeenCalledWith(backup.backupPath);
    expect(restored.status).toBe("restore-failed");
    expect(restored.message).toMatch(/아직|still|되돌리지 못/);
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
  });

  it("keeps registry import restore failures friendly", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => {
        throw new Error(
          "reg.exe import failed at C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\backup.reg"
        );
      })
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      runner
    });

    expect(restored.status).toBe("restore-failed");
    expect(restored.message).toMatch(/되돌리지 못했어요|백업 파일/);
    expect(restored.message).not.toMatch(
      /reg\.exe|import failed|C:\\Users|AppData|FormatBuddy|backup\.reg/i
    );
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
  });

  it("does not report a registry backup as restored when its restore-bin folder still exists", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true),
      importFile: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      runner,
      removeEntryDir: async () => undefined
    });

    expect(runner.importFile).toHaveBeenCalledWith(backup.backupPath);
    expect(restored.status).toBe("restore-failed");
    expect(restored.message).toMatch(/아직|still|되돌리지 못|문제/);
    expect(existsSync(join(__testing.registryBackupItemsRoot(fx.userDataDir), backup.id))).toBe(true);
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
  });

  it("reports registry restore success when backup item removal reports a late failure after deletion", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true),
      importFile: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    const backupDir = join(__testing.registryBackupItemsRoot(fx.userDataDir), backup.id);

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      runner,
      removeEntryDir: async (dir) => {
        await rm(dir, { recursive: true, force: true });
        throw new Error("registry restore entry remove reported a late failure");
      }
    });

    expect(runner.importFile).toHaveBeenCalledWith(backup.backupPath);
    expect(restored.status).toBe("restored");
    expect(existsSync(backupDir)).toBe(false);
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("uses startup item wording when restoring a startup value backup", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
            "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\""
          ].join("\n"),
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
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

    expect(restored).toMatchObject({
      backupId: result.id,
      status: "restored",
      keyPath,
      message: "시작 항목 백업을 되돌렸어요."
    });
    expect(restored.entry).toMatchObject({
      backupKind: "startup-value",
      valueName,
      appName: "Acme Notes",
      appPublisher: "Acme Corp."
    });
    expect(onAppRegistryBackupRestored).toHaveBeenCalledWith({
      name: "Acme Notes",
      publisher: "Acme Corp.",
      backupKind: "startup-value",
      valueName
    });
    expect(onAppRegistryBackupRestored.mock.calls[0][0]).not.toHaveProperty(
      "registryKeyPath",
      keyPath
    );
  });

  it("does not report a startup value backup as restored when the value is still missing after import", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
            "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\""
          ].join("\n"),
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      valueExists: vi.fn(async () => false),
      importFile: vi.fn(async () => undefined)
    };
    const backup = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner
    });

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      runner
    });

    expect(runner.importFile).toHaveBeenCalledWith(backup.backupPath);
    expect(restored.status).toBe("restore-failed");
    expect(restored.message).toMatch(/아직|still|되돌리지 못/);
    const snapshot = await listRegistryBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
  });

  it("runs the safety hook before importing a registry backup", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const calls: string[] = [];
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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

  it("rechecks a registry backup after the safety hook before importing", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        await writeFile(
          result.backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
            "\"Acme\"=\"C:\\\\Temp\\\\acme.exe\""
          ].join("\n"),
          "utf8"
        );
      }
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|위치/);
    expect(restored.message).not.toMatch(/HKCU|HKEY_CURRENT_USER|C:\\Temp/i);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("keeps importing when the best-effort safety hook fails", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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

  it("does not import a registry backup when the reg file was edited to another key", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
        "\"Acme\"=\"C:\\\\Temp\\\\acme.exe\""
      ].join("\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|위치/);
    expect(restored.message).not.toMatch(/HKCU|HKEY_CURRENT_USER|C:\\Temp/i);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the same safe key backup content was changed", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      registryBackupContentFor(keyPath).replace('"Acme Notes"', '"Acme Notes Edited"'),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/백업 파일이 바뀐 것 같아요|changed/i);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("keeps a changed registry backup visible as check-needed until the 30-day window ends", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(
      result.backupPath,
      registryBackupContentFor(keyPath).replace('"Acme Notes"', '"Acme Notes Edited"'),
      "utf8"
    );

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: result.id,
      keyPath,
      integrityStatus: "changed"
    });
  });

  it("keeps a changed startup value backup visible and blocks import", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(
      result.backupPath,
      `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Changed.exe"\n`,
      "utf8"
    );

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: result.id,
      keyPath,
      valueName,
      backupKind: "startup-value",
      integrityStatus: "changed"
    });
    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/백업 파일이 바뀐 것 같아요|changed/i);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("keeps a legacy registry backup visible and blocks import", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(
      join(__testing.registryBackupItemsRoot(fx.userDataDir), result.id, "meta.json"),
      JSON.stringify({ ...result, contentHash: undefined }, null, 2),
      "utf8"
    );

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: result.id,
      keyPath,
      integrityStatus: "legacy"
    });
    expect(restored.status).toBe("blocked-path");
    expect(restored.entry?.integrityStatus).toBe("legacy");
    expect(restored.message).toMatch(/백업 기록|오래된|다시 점검/);
    expect(summarizeRegistryBackupRestoreResults([restored])).toBe(
      "앱 삭제 흔적 백업 1개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요."
    );
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("keeps a legacy startup value backup visible and blocks import", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          `${REGISTRY_BACKUP_HEADER}\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner,
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });
    await writeFile(
      join(__testing.registryBackupItemsRoot(fx.userDataDir), result.id, "meta.json"),
      JSON.stringify({ ...result, contentHash: undefined }, null, 2),
      "utf8"
    );

    const snapshot = await listRegistryBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: result.id,
      keyPath,
      valueName,
      backupKind: "startup-value",
      integrityStatus: "legacy"
    });
    expect(restored.status).toBe("blocked-path");
    expect(restored.entry?.integrityStatus).toBe("legacy");
    expect(summarizeRegistryBackupRestoreResults([restored])).toBe(
      "시작 항목 백업 1개는 백업 기록이 오래되어 자동으로 되돌리지 않았어요."
    );
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the reg file contains a delete section", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[-HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
        ""
      ].join("\r\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|위치/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the reg file contains a value delete line", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
        "\"DisplayName\"=-",
        ""
      ].join("\r\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|값|value/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the reg file contains a default value delete line with spaces", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
        "@ = -",
        ""
      ].join("\r\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|값|value/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the reg file has no restorable value", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
        ""
      ].join("\r\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|값|value/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a registry backup when the value is outside the expected section", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const runner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryKey({
      userDataDir: fx.userDataDir,
      keyPath,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "\"DisplayName\"=\"Acme Notes\"",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes]",
        ""
      ].join("\r\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/레지스트리 백업|registry backup|값|value/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a startup value backup when the value is outside the expected section", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
            "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\""
          ].join("\n"),
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\"",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
        ""
      ].join("\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/시작 항목|값|레지스트리/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("does not import a startup value backup when another value was added to the reg file", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(
          backupPath,
          [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
            "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\""
          ].join("\n"),
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };
    const result = await backupAndDeleteRegistryValue({
      userDataDir: fx.userDataDir,
      keyPath,
      valueName,
      runner
    });
    await writeFile(
      result.backupPath,
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]",
        "\"Acme Notes\"=\"C:\\\\Acme\\\\Acme.exe\"",
        "\"Other Startup\"=\"C:\\\\Other\\\\Other.exe\""
      ].join("\n"),
      "utf8"
    );

    const restored = await restoreRegistryBackup({
      userDataDir: fx.userDataDir,
      backupId: result.id,
      runner
    });

    expect(restored.status).toBe("blocked-path");
    expect(restored.message).toMatch(/시작 항목|값|레지스트리/);
    expect(runner.importFile).not.toHaveBeenCalled();
  });

  it("refuses unsafe backup ids when restoring registry backups", async () => {
    const runner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      importFile: vi.fn(async () => undefined)
    };

    for (const backupId of [
      "../outside",
      "registry/id",
      "registry\\id",
      "  ",
      " registry-1",
      "registry-1 ",
      "registry 1",
      "registry\nid"
    ]) {
      const result = await restoreRegistryBackup({
        userDataDir: fx.userDataDir,
        backupId,
        runner
      });

      expect(result.status).toBe("blocked-path");
    }
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
