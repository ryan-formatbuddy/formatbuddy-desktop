import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { CleanupItem, StartupAutoEntry } from "../src/shared/types";
import {
  moveToFormatBuddyTrash,
  purgeExpiredTrash,
  restoreTrashEntry
} from "../src/main/cleanup/trash";
import {
  disableStartupFolderEntry,
  restoreStartupFolderEntry
} from "../src/main/startup/folderToggle";
import { restoreRegistryBackup } from "../src/main/apps/registryCleanup";

const execFileAsync = promisify(execFile);
const RUN_FIELD_E2E =
  process.platform === "win32" && process.env.FORMATBUDDY_WINDOWS_FIELD_E2E === "1";
const fieldDescribe = RUN_FIELD_E2E ? describe : describe.skip;
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const FIELD_VALUE_NAME = `FormatBuddyFieldE2E_${process.pid}`;

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

async function registryValueExists(): Promise<boolean> {
  try {
    await runReg(["query", RUN_KEY, "/v", FIELD_VALUE_NAME]);
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
});
