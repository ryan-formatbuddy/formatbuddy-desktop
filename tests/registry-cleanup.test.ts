import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  backupAndDeleteRegistryKey,
  isSafeUninstallRegistryKeyPath,
  purgeExpiredRegistryBackups
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
      purgedIds: [result.id]
    });
    await expect(readFile(result.backupPath, "utf8")).rejects.toThrow();
  });
});
