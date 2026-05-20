import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { CleanupItem, StartupAutoEntry } from "../src/shared/types";
import { defaultPrefs } from "../src/main/monitor";
import {
  moveToFormatBuddyTrash,
  purgeExpiredTrash,
  restoreTrashEntry
} from "../src/main/cleanup/trash";
import {
  reconcileScheduledAutoScan,
  SCHEDULED_AUTO_SCAN_ARG
} from "../src/main/monitorScheduler";
import {
  disableStartupFolderEntry,
  purgeExpiredStartupFolderEntries,
  restoreStartupFolderEntry
} from "../src/main/startup/folderToggle";
import {
  backupAndDeleteRegistryKey,
  purgeExpiredRegistryBackups,
  restoreRegistryBackup
} from "../src/main/apps/registryCleanup";
import { runRetentionPurgeTick } from "../src/main/retentionPurge";

const execFileAsync = promisify(execFile);
const RUN_FIELD_E2E =
  process.platform === "win32" && process.env.FORMATBUDDY_WINDOWS_FIELD_E2E === "1";
const fieldDescribe = RUN_FIELD_E2E ? describe : describe.skip;
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const FIELD_VALUE_NAME = `FormatBuddyFieldE2E_${process.pid}`;
const UNINSTALL_KEY =
  `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${FIELD_VALUE_NAME}`;
const FIELD_TASK_NAME = `FormatBuddy Field E2E ${process.pid}`;

function cleanupItem(path: string): CleanupItem {
  return {
    id: "field-trash-item",
    path,
    label: "FormatBuddy field trash item",
    sizeBytes: 11,
    categoryId: "temp-user",
    riskLevel: "safe",
    reason: "Windows field E2E"
  };
}

function startupFolderEntry(path: string, origin: string): StartupAutoEntry {
  return {
    id: `startup-folder|formatbuddy-field-e2e|${path.toLowerCase()}`,
    kind: "startup-folder",
    name: "FormatBuddy Field E2E.txt",
    path,
    origin
  };
}

function registryStartupEntry(): StartupAutoEntry {
  return {
    id: `registry|${FIELD_VALUE_NAME.toLowerCase()}|cmd.exe`,
    kind: "registry",
    name: FIELD_VALUE_NAME,
    path: "cmd.exe /c exit 0",
    registryKeyPath: RUN_KEY,
    registryValueName: FIELD_VALUE_NAME,
    publisher: "FormatBuddy Field E2E",
    origin: "앱이 스스로 등록한 항목"
  };
}

async function runReg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("reg.exe", args, {
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 128 * 1024
  });
  return { stdout: String(stdout), stderr: String(stderr) };
}

async function runSchtasks(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("schtasks.exe", args, {
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 256 * 1024
  });
  return { stdout: String(stdout), stderr: String(stderr) };
}

async function registryValueExists(): Promise<boolean> {
  try {
    await runReg(["query", RUN_KEY, "/v", FIELD_VALUE_NAME]);
    return true;
  } catch {
    return false;
  }
}

async function registryKeyExists(keyPath: string): Promise<boolean> {
  try {
    await runReg(["query", keyPath]);
    return true;
  } catch {
    return false;
  }
}

async function scheduledTaskExists(taskName: string): Promise<boolean> {
  try {
    await runSchtasks(["/Query", "/TN", taskName]);
    return true;
  } catch {
    return false;
  }
}

fieldDescribe("Windows field E2E: restore bin and startup controls", () => {
  let root = "";
  let userDataDir = "";
  let home = "";

  afterEach(async () => {
    await runReg(["delete", RUN_KEY, "/v", FIELD_VALUE_NAME, "/f"]).catch(() => {});
    await runReg(["delete", UNINSTALL_KEY, "/f"]).catch(() => {});
    await runSchtasks(["/Delete", "/TN", FIELD_TASK_NAME, "/F"]).catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("runs the real Windows smoke path for 30-day restore bin and startup changes", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-"));
    userDataDir = join(root, "userdata");
    home = join(root, "home");
    const cleanupSource = join(home, "AppData", "Local", "Temp", "field-trash.txt");
    const startupRoot = join(root, "Startup");
    const startupSource = join(startupRoot, "FormatBuddy Field E2E.txt");
    const firstAt = new Date("2026-05-20T10:00:00.000Z");
    const restoredAt = new Date("2026-05-20T10:05:00.000Z");
    const secondAt = new Date("2026-05-20T10:10:00.000Z");
    const purgeAt = new Date("2026-06-20T10:10:00.000Z");

    await mkdir(dirname(cleanupSource), { recursive: true });
    await writeFile(cleanupSource, "field-trash", "utf8");
    const trashed = await moveToFormatBuddyTrash({
      userDataDir,
      home,
      item: cleanupItem(cleanupSource),
      sizeBytes: 11,
      now: () => firstAt
    });
    expect(existsSync(cleanupSource)).toBe(false);
    expect(existsSync(trashed.storedPath)).toBe(true);

    const restoredTrash = await restoreTrashEntry({
      userDataDir,
      home,
      entryId: trashed.id,
      now: () => restoredAt
    });
    expect(restoredTrash.status).toBe("restored");
    await expect(readFile(cleanupSource, "utf8")).resolves.toBe("field-trash");

    const trashedAgain = await moveToFormatBuddyTrash({
      userDataDir,
      home,
      item: cleanupItem(cleanupSource),
      sizeBytes: 11,
      now: () => secondAt
    });
    const purgedTrash = await purgeExpiredTrash({
      userDataDir,
      home,
      now: () => purgeAt
    });
    expect(purgedTrash.purgedEntryIds).toEqual([trashedAgain.id]);
    expect(purgedTrash.purgedCount).toBe(1);
    expect(existsSync(cleanupSource)).toBe(false);

    await mkdir(startupRoot, { recursive: true });
    await writeFile(startupSource, "not executable; field test marker", "utf8");
    const disabledStartup = await disableStartupFolderEntry({
      userDataDir,
      entry: startupFolderEntry(startupSource, startupRoot),
      now: () => firstAt
    });
    expect(disabledStartup.status).toBe("disabled");
    expect(existsSync(startupSource)).toBe(false);
    const restoredStartup = await restoreStartupFolderEntry({
      userDataDir,
      disabledId: disabledStartup.entry!.id,
      now: () => restoredAt
    });
    expect(restoredStartup.status).toBe("restored");
    await expect(readFile(startupSource, "utf8")).resolves.toContain("field test marker");
    await rm(startupSource, { force: true });

    await runReg(["add", RUN_KEY, "/v", FIELD_VALUE_NAME, "/t", "REG_SZ", "/d", "cmd.exe /c exit 0", "/f"]);
    expect(await registryValueExists()).toBe(true);
    const disabledRegistry = await disableStartupFolderEntry({
      userDataDir,
      entry: registryStartupEntry(),
      now: () => firstAt
    });
    expect(disabledRegistry.status).toBe("disabled");
    expect(disabledRegistry.registryBackupId).toBeTruthy();
    expect(await registryValueExists()).toBe(false);

    const restoredRegistry = await restoreRegistryBackup({
      userDataDir,
      backupId: disabledRegistry.registryBackupId!,
      now: () => restoredAt
    });
    expect(restoredRegistry.status).toBe("restored");
    expect(restoredRegistry.entry?.backupKind).toBe("startup-value");
    expect(await registryValueExists()).toBe(true);
  }, 90_000);

  it("registers and removes an isolated Windows scheduled scan task", async () => {
    const registered = await reconcileScheduledAutoScan({
      prefs: { ...defaultPrefs(), autoScanEnabled: true, autoScanDays: 30 },
      appPath: process.execPath,
      platform: "win32",
      taskName: FIELD_TASK_NAME
    });

    expect(registered.status).toBe("registered");
    expect(registered.command).toContain(FIELD_TASK_NAME);
    expect(registered.command?.some((arg) => arg.includes(SCHEDULED_AUTO_SCAN_ARG))).toBe(true);
    expect(await scheduledTaskExists(FIELD_TASK_NAME)).toBe(true);

    const deleted = await reconcileScheduledAutoScan({
      prefs: { ...defaultPrefs(), autoScanEnabled: false },
      appPath: process.execPath,
      platform: "win32",
      taskName: FIELD_TASK_NAME
    });

    expect(deleted.status).toBe("deleted");
    expect(await scheduledTaskExists(FIELD_TASK_NAME)).toBe(false);
  }, 45_000);

  it("backs up, removes, and restores an isolated uninstall registry key", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-registry-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:00:00.000Z");
    const restoredAt = new Date("2026-05-20T11:05:00.000Z");

    await runReg([
      "add",
      UNINSTALL_KEY,
      "/v",
      "DisplayName",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      UNINSTALL_KEY,
      "/v",
      "Publisher",
      "/t",
      "REG_SZ",
      "/d",
      "FormatBuddy Field E2E",
      "/f"
    ]);
    expect(await registryKeyExists(UNINSTALL_KEY)).toBe(true);

    const backup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: UNINSTALL_KEY,
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.backupKind ?? "key").toBe("key");
    expect(backup.expiresAt).toBe("2026-06-19T11:00:00.000Z");
    expect(backup.contentHash?.algorithm).toBe("sha256");
    expect(await registryKeyExists(UNINSTALL_KEY)).toBe(false);

    const restored = await restoreRegistryBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.keyPath).toBe(UNINSTALL_KEY);
    expect(await registryKeyExists(UNINSTALL_KEY)).toBe(true);
    const restoredKey = await runReg(["query", UNINSTALL_KEY, "/v", "DisplayName"]);
    expect(restoredKey.stdout).toContain(FIELD_VALUE_NAME);
  }, 45_000);

  it("empties all 30-day restore bins through the unified retention tick", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-retention-"));
    userDataDir = join(root, "userdata");
    home = join(root, "home");
    const firstAt = new Date("2026-05-20T12:00:00.000Z");
    const purgeAt = new Date("2026-06-20T12:00:00.000Z");
    const cleanupSource = join(home, "AppData", "Local", "Temp", "field-retention-trash.txt");
    const startupRoot = join(root, "StartupRetention");
    const startupSource = join(startupRoot, "FormatBuddy Field Retention.txt");

    await mkdir(dirname(cleanupSource), { recursive: true });
    await writeFile(cleanupSource, "field-retention-trash", "utf8");
    const trashed = await moveToFormatBuddyTrash({
      userDataDir,
      home,
      item: cleanupItem(cleanupSource),
      sizeBytes: 21,
      now: () => firstAt
    });

    await runReg([
      "add",
      UNINSTALL_KEY,
      "/v",
      "DisplayName",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    const registryBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: UNINSTALL_KEY,
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    await mkdir(startupRoot, { recursive: true });
    await writeFile(startupSource, "startup retention marker", "utf8");
    const disabledStartup = await disableStartupFolderEntry({
      userDataDir,
      entry: startupFolderEntry(startupSource, startupRoot),
      now: () => firstAt
    });

    const purge = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash: () =>
        purgeExpiredTrash({
          userDataDir,
          home,
          now: () => purgeAt
        }),
      purgeRegistryBackups: () =>
        purgeExpiredRegistryBackups({
          userDataDir,
          now: () => purgeAt
        }),
      purgeStartupDisabled: () =>
        purgeExpiredStartupFolderEntries({
          userDataDir,
          now: () => purgeAt
        })
    });

    expect(purge.failed).toEqual([]);
    expect(purge.trash?.purgedEntryIds).toEqual([trashed.id]);
    expect(purge.registryBackups?.purgedIds).toEqual([registryBackup.id]);
    expect(purge.startupDisabled?.purgedIds).toEqual([disabledStartup.entry!.id]);
    expect(existsSync(trashed.storedPath)).toBe(false);
    expect(existsSync(registryBackup.backupPath)).toBe(false);
    expect(existsSync(disabledStartup.entry!.storedPath)).toBe(false);
  }, 90_000);
});
