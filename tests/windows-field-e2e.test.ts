import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { CleanupItem, StartupAutoEntry } from "../src/shared/types";
import { defaultPrefs } from "../src/main/monitor";
import { defaultDeps, executeCleanup } from "../src/main/cleanup/executor";
import { planCleanup, __resetPlanCacheForTests } from "../src/main/cleanup/planner";
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
  backupAndRemoveEnvironmentPathSegment,
  backupAndDeleteRegistryValue,
  backupAndDeleteRegistryKey,
  purgeExpiredRegistryBackups,
  restoreRegistryBackup
} from "../src/main/apps/registryCleanup";
import {
  backupAndDeleteScheduledTask,
  purgeExpiredScheduledTaskBackups,
  restoreScheduledTaskBackup
} from "../src/main/startup/scheduledTaskBackup";
import { planAppLeftovers } from "../src/main/apps/leftovers";
import { runRetentionPurgeTick } from "../src/main/retentionPurge";
import fieldRequirements from "../scripts/windows-field-requirements.json";

const execFileAsync = promisify(execFile);
const RUN_FIELD_E2E =
  process.platform === "win32" && process.env.FORMATBUDDY_WINDOWS_FIELD_E2E === "1";
const fieldDescribe = RUN_FIELD_E2E ? describe : describe.skip;
const FIELD_PROOF_PREFIX = "[formatbuddy-field-proof] ";
const FIELD_REQUIREMENTS = {
  cleanupExecutor: fieldRequirements[0],
  cleanupRestorePurge: fieldRequirements[1],
  startupFolderRestore: fieldRequirements[2],
  hkcuRunRestore: fieldRequirements[3],
  scheduledScanTask: fieldRequirements[4],
  scheduledTaskCleanupTrace: fieldRequirements[5],
  uninstallRegistryKey: fieldRequirements[6],
  registeredApplicationsValue: fieldRequirements[7],
  appPathsKey: fieldRequirements[8],
  openWithKey: fieldRequirements[9],
  protocolHandlerKey: fieldRequirements[10],
  nativeMessagingHostKey: fieldRequirements[11],
  fileAssociationKey: fieldRequirements[12],
  fileAssociationOpenCommandKey: fieldRequirements[13],
  comAppIdLeftover: fieldRequirements[14],
  contextMenuKey: fieldRequirements[15],
  shellExtensionKey: fieldRequirements[16],
  userPathSegment: fieldRequirements[17],
  appEnvironmentSetting: fieldRequirements[18],
  appFirewallRule: fieldRequirements[19],
  serviceLeftover: fieldRequirements[20],
  unifiedRetentionTick: fieldRequirements[21]
} as const;
const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const FIELD_VALUE_NAME = `FormatBuddyFieldE2E_${process.pid}`;
const UNINSTALL_KEY =
  `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${FIELD_VALUE_NAME}`;
const REGISTERED_APPLICATIONS_KEY = "HKCU\\Software\\RegisteredApplications";
const APP_CAPABILITIES_KEY = `HKCU\\Software\\${FIELD_VALUE_NAME}\\Capabilities`;
const APP_PATH_KEY =
  `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${FIELD_VALUE_NAME}.exe`;
const OPEN_WITH_KEY = `HKCU\\Software\\Classes\\Applications\\${FIELD_VALUE_NAME}.exe`;
const FIELD_PROTOCOL_SCHEME = `formatbuddy-field-e2e-${process.pid}`;
const PROTOCOL_HANDLER_KEY = `HKCU\\Software\\Classes\\${FIELD_PROTOCOL_SCHEME}`;
const NATIVE_MESSAGING_HOST_KEY =
  `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.formatbuddy.field_e2e_${process.pid}`;
const FILE_ASSOCIATION_KEY = `HKCU\\Software\\Classes\\${FIELD_VALUE_NAME}.Document`;
const FILE_ASSOCIATION_OPEN_COMMAND_KEY =
  `HKCU\\Software\\Classes\\${FIELD_VALUE_NAME}.OpenCommand`;
const FIELD_GUID_SUFFIX = process.pid.toString(16).toUpperCase().padStart(12, "0").slice(-12);
const FIELD_COM_CLSID = `{A6E0BCA2-2CC0-4B8C-A29D-${FIELD_GUID_SUFFIX}}`;
const FIELD_COM_APP_ID = `{A6E0BCA2-2CC0-4B8C-A29E-${FIELD_GUID_SUFFIX}}`;
const COM_LOCAL_SERVER_KEY = `HKCU\\Software\\Classes\\CLSID\\${FIELD_COM_CLSID}`;
const COM_APP_ID_KEY = `HKCU\\Software\\Classes\\AppID\\${FIELD_COM_APP_ID}`;
const CONTEXT_MENU_KEY = `HKCU\\Software\\Classes\\*\\shell\\${FIELD_VALUE_NAME}`;
const SHELL_EXTENSION_KEY =
  `HKCU\\Software\\Classes\\*\\shellex\\ContextMenuHandlers\\${FIELD_VALUE_NAME}`;
const ENVIRONMENT_KEY = "HKCU\\Environment";
const FIELD_ENV_VALUE_NAME = `${FIELD_VALUE_NAME}_HOME`;
const FIREWALL_RULES_KEY =
  "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\FirewallRules";
const FIELD_FIREWALL_VALUE_NAME = `{${FIELD_VALUE_NAME}-FirewallRule}`;
const FIELD_SERVICE_NAME = `FormatBuddyFieldE2E_${process.pid}`;
const FIELD_SERVICE_KEY = `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${FIELD_SERVICE_NAME}`;
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

function proveFieldRequirement(description: string): void {
  if (!fieldRequirements.includes(description)) {
    throw new Error(`Unknown FormatBuddy field E2E requirement: ${description}`);
  }
  console.info(`${FIELD_PROOF_PREFIX}${description}`);
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

async function runSc(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("sc.exe", args, {
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 128 * 1024
  });
  return { stdout: String(stdout), stderr: String(stderr) };
}

async function registryValueExists(
  keyPath = RUN_KEY,
  valueName = FIELD_VALUE_NAME
): Promise<boolean> {
  try {
    await runReg(["query", keyPath, "/v", valueName]);
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

async function registryValueRecord(
  keyPath: string,
  valueName: string
): Promise<{ type: string; data: string } | null> {
  try {
    const { stdout } = await runReg(["query", keyPath, "/v", valueName]);
    const row = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().startsWith(valueName.toLowerCase()));
    if (!row) return null;
    const [, type, ...dataParts] = row.split(/\s{2,}/);
    if (!type || dataParts.length === 0) return null;
    return { type, data: dataParts.join("  ") };
  } catch {
    return null;
  }
}

async function registryDefaultValueRecord(
  keyPath: string
): Promise<{ type: string; data: string } | undefined> {
  try {
    const { stdout } = await runReg(["query", keyPath, "/ve"]);
    for (const line of stdout.split(/\r?\n/)) {
      const row = line.trim();
      if (!row || /^HKEY_/i.test(row)) continue;
      const parts = row.split(/\s{2,}/);
      const typeIndex = parts.findIndex((part) => /^REG_/i.test(part));
      if (typeIndex < 0) continue;
      const type = parts[typeIndex];
      const data = parts.slice(typeIndex + 1).join("  ");
      if (data) return { type, data };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function setRegistryValue(
  keyPath: string,
  valueName: string,
  type: string,
  data: string
): Promise<void> {
  await runReg(["add", keyPath, "/v", valueName, "/t", type, "/d", data, "/f"]);
}

async function deleteRegistryValue(keyPath: string, valueName: string): Promise<void> {
  await runReg(["delete", keyPath, "/v", valueName, "/f"]);
}

async function serviceExists(serviceName: string): Promise<boolean> {
  try {
    await runSc(["query", serviceName]);
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

async function createFieldScheduledTask(): Promise<void> {
  await runSchtasks([
    "/Create",
    "/TN",
    FIELD_TASK_NAME,
    "/SC",
    "ONCE",
    "/ST",
    "23:59",
    "/TR",
    "cmd.exe /c exit 0",
    "/F"
  ]);
}

fieldDescribe("Windows field E2E: restore bin and startup controls", () => {
  let root = "";
  let userDataDir = "";
  let home = "";
  let originalUserPath: { exists: boolean; type?: string; data?: string } | null = null;

  afterEach(async () => {
    __resetPlanCacheForTests();
    await runReg(["delete", RUN_KEY, "/v", FIELD_VALUE_NAME, "/f"]).catch(() => {});
    await runReg(["delete", REGISTERED_APPLICATIONS_KEY, "/v", FIELD_VALUE_NAME, "/f"]).catch(() => {});
    await runReg(["delete", APP_CAPABILITIES_KEY, "/f"]).catch(() => {});
    await runReg(["delete", UNINSTALL_KEY, "/f"]).catch(() => {});
    await runReg(["delete", APP_PATH_KEY, "/f"]).catch(() => {});
    await runReg(["delete", OPEN_WITH_KEY, "/f"]).catch(() => {});
    await runReg(["delete", PROTOCOL_HANDLER_KEY, "/f"]).catch(() => {});
    await runReg(["delete", NATIVE_MESSAGING_HOST_KEY, "/f"]).catch(() => {});
    await runReg(["delete", FILE_ASSOCIATION_KEY, "/f"]).catch(() => {});
    await runReg(["delete", FILE_ASSOCIATION_OPEN_COMMAND_KEY, "/f"]).catch(() => {});
    await runReg(["delete", COM_LOCAL_SERVER_KEY, "/f"]).catch(() => {});
    await runReg(["delete", COM_APP_ID_KEY, "/f"]).catch(() => {});
    await runReg(["delete", CONTEXT_MENU_KEY, "/f"]).catch(() => {});
    await runReg(["delete", SHELL_EXTENSION_KEY, "/f"]).catch(() => {});
    await deleteRegistryValue(FIREWALL_RULES_KEY, FIELD_FIREWALL_VALUE_NAME).catch(() => {});
    await deleteRegistryValue(ENVIRONMENT_KEY, FIELD_ENV_VALUE_NAME).catch(() => {});
    if (originalUserPath) {
      if (originalUserPath.exists && originalUserPath.type && originalUserPath.data !== undefined) {
        await setRegistryValue(ENVIRONMENT_KEY, "Path", originalUserPath.type, originalUserPath.data).catch(
          () => {}
        );
      } else {
        await deleteRegistryValue(ENVIRONMENT_KEY, "Path").catch(() => {});
      }
      originalUserPath = null;
    }
    await runSc(["delete", FIELD_SERVICE_NAME]).catch(() => {});
    await runReg(["delete", FIELD_SERVICE_KEY, "/f"]).catch(() => {});
    await runSchtasks(["/Delete", "/TN", FIELD_TASK_NAME, "/F"]).catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("routes the real cleanup executor path into the 30-day restore bin", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-executor-"));
    userDataDir = join(root, "userdata");
    home = join(root, "home");
    const localAppData = join(home, "AppData", "Local");
    const tempDir = join(localAppData, "Temp");
    const cleanupSource = join(tempDir, "field-executor-cleanup.tmp");
    const firstAt = new Date("2026-05-20T09:00:00.000Z");
    const restoredAt = new Date("2026-05-20T09:05:00.000Z");
    const oldMtime = new Date("2026-05-01T09:00:00.000Z");

    await mkdir(dirname(cleanupSource), { recursive: true });
    await writeFile(cleanupSource, "field-executor-cleanup", "utf8");
    await utimes(cleanupSource, oldMtime, oldMtime);

    const plan = await planCleanup({
      env: {
        home,
        tempDir,
        localAppData,
        systemRoot: join(root, "Windows"),
        systemDrive: root,
        now: () => firstAt
      }
    });
    const selected = plan.categories
      .flatMap((category) => category.items)
      .find((item) => item.path === cleanupSource);

    expect(selected?.categoryId).toBe("temp-user");

    const result = await executeCleanup(
      {
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        mode: "trash",
        selectedItemIds: [selected!.id]
      },
      {
        userDataDir,
        deps: defaultDeps(userDataDir),
        home,
        now: () => firstAt
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0].trashEntryId).toBeTruthy();
    expect(result.removedItems[0].expiresAt).toBe("2026-06-19T09:00:00.000Z");
    expect(result.skippedItems.filter((item) => item.reason !== "not-selected")).toEqual([]);
    expect(existsSync(cleanupSource)).toBe(false);

    const restoredTrash = await restoreTrashEntry({
      userDataDir,
      home,
      entryId: result.removedItems[0].trashEntryId!,
      now: () => restoredAt
    });

    expect(restoredTrash.status).toBe("restored");
    await expect(readFile(cleanupSource, "utf8")).resolves.toBe("field-executor-cleanup");
    proveFieldRequirement(FIELD_REQUIREMENTS.cleanupExecutor);
  }, 45_000);

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
    proveFieldRequirement(FIELD_REQUIREMENTS.cleanupRestorePurge);

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
    proveFieldRequirement(FIELD_REQUIREMENTS.startupFolderRestore);
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
    proveFieldRequirement(FIELD_REQUIREMENTS.hkcuRunRestore);
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
    proveFieldRequirement(FIELD_REQUIREMENTS.scheduledScanTask);
  }, 45_000);

  it("backs up, removes, and restores an isolated scheduled task cleanup trace", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-task-backup-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T10:30:00.000Z");
    const restoredAt = new Date("2026-05-20T10:35:00.000Z");

    await createFieldScheduledTask();
    expect(await scheduledTaskExists(FIELD_TASK_NAME)).toBe(true);

    const backup = await backupAndDeleteScheduledTask({
      userDataDir,
      taskName: FIELD_TASK_NAME,
      taskPath: "\\",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.expiresAt).toBe("2026-06-19T10:30:00.000Z");
    expect(backup.contentHash?.algorithm).toBe("sha256");
    expect(await scheduledTaskExists(FIELD_TASK_NAME)).toBe(false);

    const restored = await restoreScheduledTaskBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.taskName).toBe(FIELD_TASK_NAME);
    expect(await scheduledTaskExists(FIELD_TASK_NAME)).toBe(true);
    proveFieldRequirement(FIELD_REQUIREMENTS.scheduledTaskCleanupTrace);
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
    proveFieldRequirement(FIELD_REQUIREMENTS.uninstallRegistryKey);
  }, 45_000);

  it("backs up, removes, and restores isolated default-app, app path, app connection, file association, protocol handler, browser helper, context menu, and right-click extension registry traces", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-app-registry-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:20:00.000Z");
    const restoredAt = new Date("2026-05-20T11:25:00.000Z");

    await runReg([
      "add",
      REGISTERED_APPLICATIONS_KEY,
      "/v",
      FIELD_VALUE_NAME,
      "/t",
      "REG_SZ",
      "/d",
      `Software\\${FIELD_VALUE_NAME}\\Capabilities`,
      "/f"
    ]);
    await runReg([
      "add",
      APP_CAPABILITIES_KEY,
      "/v",
      "ApplicationName",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      APP_PATH_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      "C:\\Windows\\System32\\notepad.exe",
      "/f"
    ]);
    await runReg([
      "add",
      OPEN_WITH_KEY,
      "/v",
      "FriendlyAppName",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      PROTOCOL_HANDLER_KEY,
      "/v",
      "URL Protocol",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_PROTOCOL_SCHEME,
      "/f"
    ]);
    await runReg([
      "add",
      NATIVE_MESSAGING_HOST_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      "C:\\Windows\\System32\\notepad.exe",
      "/f"
    ]);
    await runReg([
      "add",
      FILE_ASSOCIATION_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      `${FILE_ASSOCIATION_OPEN_COMMAND_KEY}\\shell\\open\\command`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      `"C:\\Program Files\\${FIELD_VALUE_NAME}\\${FIELD_VALUE_NAME}.exe" "%1"`,
      "/f"
    ]);
    await runReg([
      "add",
      `${COM_LOCAL_SERVER_KEY}\\LocalServer32`,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      `"C:\\Program Files\\${FIELD_VALUE_NAME}\\${FIELD_VALUE_NAME}.exe" /automation`,
      "/f"
    ]);
    await runReg([
      "add",
      COM_LOCAL_SERVER_KEY,
      "/v",
      "AppID",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_COM_APP_ID,
      "/f"
    ]);
    await runReg([
      "add",
      COM_APP_ID_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      CONTEXT_MENU_KEY,
      "/v",
      "MUIVerb",
      "/t",
      "REG_SZ",
      "/d",
      FIELD_VALUE_NAME,
      "/f"
    ]);
    await runReg([
      "add",
      SHELL_EXTENSION_KEY,
      "/ve",
      "/t",
      "REG_SZ",
      "/d",
      "{00000000-0000-0000-0000-000000000000}",
      "/f"
    ]);
    expect(await registryValueExists(REGISTERED_APPLICATIONS_KEY, FIELD_VALUE_NAME)).toBe(true);
    expect(await registryKeyExists(APP_CAPABILITIES_KEY)).toBe(true);
    expect(await registryKeyExists(APP_PATH_KEY)).toBe(true);
    expect(await registryKeyExists(OPEN_WITH_KEY)).toBe(true);
    expect(await registryValueExists(PROTOCOL_HANDLER_KEY, "URL Protocol")).toBe(true);
    expect(await registryKeyExists(NATIVE_MESSAGING_HOST_KEY)).toBe(true);
    expect(await registryKeyExists(FILE_ASSOCIATION_KEY)).toBe(true);
    expect(await registryKeyExists(FILE_ASSOCIATION_OPEN_COMMAND_KEY)).toBe(true);
    expect(await registryKeyExists(COM_LOCAL_SERVER_KEY)).toBe(true);
    expect(await registryKeyExists(COM_APP_ID_KEY)).toBe(true);
    expect(await registryKeyExists(CONTEXT_MENU_KEY)).toBe(true);
    expect(await registryKeyExists(SHELL_EXTENSION_KEY)).toBe(true);
    const openCommandLeftovers = await planAppLeftovers([], {
      extraApps: [
        {
          name: FIELD_VALUE_NAME,
          publisher: "FormatBuddy Field E2E",
          installLocation: `C:\\Program Files\\${FIELD_VALUE_NAME}`
        }
      ],
      registryRunner: {
        listSubKeys: async (keyPath: string) =>
          keyPath === "HKCU\\Software\\Classes" &&
          (await registryKeyExists(FILE_ASSOCIATION_OPEN_COMMAND_KEY))
            ? [FILE_ASSOCIATION_OPEN_COMMAND_KEY.split("\\").pop()!]
            : keyPath === "HKCU\\Software\\Classes\\CLSID" &&
                (await registryKeyExists(COM_LOCAL_SERVER_KEY))
              ? [FIELD_COM_CLSID]
            : [],
        queryDefaultValue: registryDefaultValueRecord,
        queryValue: async (keyPath: string, valueName: string) =>
          (await registryValueRecord(keyPath, valueName)) ?? undefined,
        keyExists: registryKeyExists
      }
    });
    const openCommandLeftover = openCommandLeftovers.groups
      .flatMap((group) => group.paths)
      .find((path) => path.kind === "file-association-registry" && path.path === FILE_ASSOCIATION_OPEN_COMMAND_KEY);
    expect(openCommandLeftover).toMatchObject({
      kind: "file-association-registry",
      path: FILE_ASSOCIATION_OPEN_COMMAND_KEY,
      exists: true
    });
    const comAppIdLeftover = openCommandLeftovers.groups
      .flatMap((group) => group.paths)
      .find((path) => path.kind === "com-app-id-registry" && path.path === COM_APP_ID_KEY);
    expect(comAppIdLeftover).toMatchObject({
      kind: "com-app-id-registry",
      path: COM_APP_ID_KEY,
      exists: true
    });

    const registeredAppBackup = await backupAndDeleteRegistryValue({
      userDataDir,
      keyPath: REGISTERED_APPLICATIONS_KEY,
      valueName: FIELD_VALUE_NAME,
      backupKind: "registered-app-value",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const appCapabilitiesBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: APP_CAPABILITIES_KEY,
      backupKind: "app-capabilities-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const appPathBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: APP_PATH_KEY,
      backupKind: "app-path-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const openWithBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: OPEN_WITH_KEY,
      backupKind: "open-with-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const protocolHandlerBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: PROTOCOL_HANDLER_KEY,
      backupKind: "protocol-handler-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const nativeMessagingHostBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: NATIVE_MESSAGING_HOST_KEY,
      backupKind: "native-messaging-host-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const fileAssociationBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: FILE_ASSOCIATION_KEY,
      backupKind: "file-association-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const fileAssociationOpenCommandBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: FILE_ASSOCIATION_OPEN_COMMAND_KEY,
      backupKind: "file-association-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const comAppIdBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: COM_APP_ID_KEY,
      backupKind: "com-app-id-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const contextMenuBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: CONTEXT_MENU_KEY,
      backupKind: "context-menu-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });
    const shellExtensionBackup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: SHELL_EXTENSION_KEY,
      backupKind: "shell-extension-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(registeredAppBackup.backupKind).toBe("registered-app-value");
    expect(appCapabilitiesBackup.backupKind).toBe("app-capabilities-key");
    expect(appPathBackup.backupKind).toBe("app-path-key");
    expect(openWithBackup.backupKind).toBe("open-with-key");
    expect(protocolHandlerBackup.backupKind).toBe("protocol-handler-key");
    expect(nativeMessagingHostBackup.backupKind).toBe("native-messaging-host-key");
    expect(fileAssociationBackup.backupKind).toBe("file-association-key");
    expect(fileAssociationOpenCommandBackup.backupKind).toBe("file-association-key");
    expect(comAppIdBackup.backupKind).toBe("com-app-id-key");
    expect(contextMenuBackup.backupKind).toBe("context-menu-key");
    expect(shellExtensionBackup.backupKind).toBe("shell-extension-key");
    expect(await registryValueExists(REGISTERED_APPLICATIONS_KEY, FIELD_VALUE_NAME)).toBe(false);
    expect(await registryKeyExists(APP_CAPABILITIES_KEY)).toBe(false);
    expect(await registryKeyExists(APP_PATH_KEY)).toBe(false);
    expect(await registryKeyExists(OPEN_WITH_KEY)).toBe(false);
    expect(await registryKeyExists(PROTOCOL_HANDLER_KEY)).toBe(false);
    expect(await registryKeyExists(NATIVE_MESSAGING_HOST_KEY)).toBe(false);
    expect(await registryKeyExists(FILE_ASSOCIATION_KEY)).toBe(false);
    expect(await registryKeyExists(FILE_ASSOCIATION_OPEN_COMMAND_KEY)).toBe(false);
    expect(await registryKeyExists(COM_APP_ID_KEY)).toBe(false);
    expect(await registryKeyExists(CONTEXT_MENU_KEY)).toBe(false);
    expect(await registryKeyExists(SHELL_EXTENSION_KEY)).toBe(false);

    const restoredRegisteredApp = await restoreRegistryBackup({
      userDataDir,
      backupId: registeredAppBackup.id,
      now: () => restoredAt
    });
    const restoredAppCapabilities = await restoreRegistryBackup({
      userDataDir,
      backupId: appCapabilitiesBackup.id,
      now: () => restoredAt
    });
    const restoredAppPath = await restoreRegistryBackup({
      userDataDir,
      backupId: appPathBackup.id,
      now: () => restoredAt
    });
    const restoredOpenWith = await restoreRegistryBackup({
      userDataDir,
      backupId: openWithBackup.id,
      now: () => restoredAt
    });
    const restoredProtocolHandler = await restoreRegistryBackup({
      userDataDir,
      backupId: protocolHandlerBackup.id,
      now: () => restoredAt
    });
    const restoredNativeMessagingHost = await restoreRegistryBackup({
      userDataDir,
      backupId: nativeMessagingHostBackup.id,
      now: () => restoredAt
    });
    const restoredFileAssociation = await restoreRegistryBackup({
      userDataDir,
      backupId: fileAssociationBackup.id,
      now: () => restoredAt
    });
    const restoredFileAssociationOpenCommand = await restoreRegistryBackup({
      userDataDir,
      backupId: fileAssociationOpenCommandBackup.id,
      now: () => restoredAt
    });
    const restoredComAppId = await restoreRegistryBackup({
      userDataDir,
      backupId: comAppIdBackup.id,
      now: () => restoredAt
    });
    const restoredContextMenu = await restoreRegistryBackup({
      userDataDir,
      backupId: contextMenuBackup.id,
      now: () => restoredAt
    });
    const restoredShellExtension = await restoreRegistryBackup({
      userDataDir,
      backupId: shellExtensionBackup.id,
      now: () => restoredAt
    });

    expect(restoredRegisteredApp.status).toBe("restored");
    expect(restoredAppCapabilities.status).toBe("restored");
    expect(restoredAppPath.status).toBe("restored");
    expect(restoredOpenWith.status).toBe("restored");
    expect(restoredProtocolHandler.status).toBe("restored");
    expect(restoredNativeMessagingHost.status).toBe("restored");
    expect(restoredFileAssociation.status).toBe("restored");
    expect(restoredFileAssociationOpenCommand.status).toBe("restored");
    expect(restoredComAppId.status).toBe("restored");
    expect(restoredContextMenu.status).toBe("restored");
    expect(restoredShellExtension.status).toBe("restored");
    expect(restoredRegisteredApp.entry?.backupKind).toBe("registered-app-value");
    expect(restoredAppCapabilities.entry?.backupKind).toBe("app-capabilities-key");
    expect(restoredAppPath.entry?.backupKind).toBe("app-path-key");
    expect(restoredOpenWith.entry?.backupKind).toBe("open-with-key");
    expect(restoredProtocolHandler.entry?.backupKind).toBe("protocol-handler-key");
    expect(restoredNativeMessagingHost.entry?.backupKind).toBe("native-messaging-host-key");
    expect(restoredFileAssociation.entry?.backupKind).toBe("file-association-key");
    expect(restoredFileAssociationOpenCommand.entry?.backupKind).toBe("file-association-key");
    expect(restoredComAppId.entry?.backupKind).toBe("com-app-id-key");
    expect(restoredContextMenu.entry?.backupKind).toBe("context-menu-key");
    expect(restoredShellExtension.entry?.backupKind).toBe("shell-extension-key");
    expect(await registryValueExists(REGISTERED_APPLICATIONS_KEY, FIELD_VALUE_NAME)).toBe(true);
    expect(await registryKeyExists(APP_CAPABILITIES_KEY)).toBe(true);
    expect(await registryKeyExists(APP_PATH_KEY)).toBe(true);
    expect(await registryKeyExists(OPEN_WITH_KEY)).toBe(true);
    expect(await registryValueExists(PROTOCOL_HANDLER_KEY, "URL Protocol")).toBe(true);
    expect(await registryKeyExists(NATIVE_MESSAGING_HOST_KEY)).toBe(true);
    expect(await registryKeyExists(FILE_ASSOCIATION_KEY)).toBe(true);
    expect(await registryKeyExists(FILE_ASSOCIATION_OPEN_COMMAND_KEY)).toBe(true);
    expect(await registryKeyExists(COM_APP_ID_KEY)).toBe(true);
    expect(await registryKeyExists(CONTEXT_MENU_KEY)).toBe(true);
    expect(await registryKeyExists(SHELL_EXTENSION_KEY)).toBe(true);
    proveFieldRequirement(FIELD_REQUIREMENTS.registeredApplicationsValue);
    proveFieldRequirement(FIELD_REQUIREMENTS.appPathsKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.openWithKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.protocolHandlerKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.nativeMessagingHostKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.fileAssociationKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.fileAssociationOpenCommandKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.comAppIdLeftover);
    proveFieldRequirement(FIELD_REQUIREMENTS.contextMenuKey);
    proveFieldRequirement(FIELD_REQUIREMENTS.shellExtensionKey);
  }, 45_000);

  it("backs up, removes, and restores one isolated user PATH app segment", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-path-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:30:00.000Z");
    const restoredAt = new Date("2026-05-20T11:35:00.000Z");
    const segment = join(root, "Acme Notes", "bin");
    const existingPath = await registryValueRecord(ENVIRONMENT_KEY, "Path");
    originalUserPath = existingPath
      ? { exists: true, type: existingPath.type, data: existingPath.data }
      : { exists: false };
    const pathType = existingPath?.type === "REG_SZ" ? "REG_SZ" : "REG_EXPAND_SZ";
    const fallbackPath = "C:\\Windows\\System32";
    const pathValue = `${segment};${existingPath?.data || fallbackPath}`;

    await setRegistryValue(ENVIRONMENT_KEY, "Path", pathType, pathValue);
    expect((await registryValueRecord(ENVIRONMENT_KEY, "Path"))?.data).toContain(segment);

    const backup = await backupAndRemoveEnvironmentPathSegment({
      userDataDir,
      keyPath: ENVIRONMENT_KEY,
      valueName: "Path",
      segment,
      now: () => firstAt,
      app: { name: "Acme Notes", publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.backupKind).toBe("environment-path-value");
    expect(backup.environmentPathSegment).toBe(segment);
    expect((await registryValueRecord(ENVIRONMENT_KEY, "Path"))?.data).not.toContain(segment);

    const restored = await restoreRegistryBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.backupKind).toBe("environment-path-value");
    expect((await registryValueRecord(ENVIRONMENT_KEY, "Path"))?.data).toContain(segment);
    proveFieldRequirement(FIELD_REQUIREMENTS.userPathSegment);
  }, 45_000);

  it("backs up, removes, and restores one isolated app environment setting", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-env-value-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:36:00.000Z");
    const restoredAt = new Date("2026-05-20T11:39:00.000Z");
    const valueData = join(root, "Acme Notes");

    await setRegistryValue(ENVIRONMENT_KEY, FIELD_ENV_VALUE_NAME, "REG_SZ", valueData);
    expect(await registryValueExists(ENVIRONMENT_KEY, FIELD_ENV_VALUE_NAME)).toBe(true);

    const backup = await backupAndDeleteRegistryValue({
      userDataDir,
      keyPath: ENVIRONMENT_KEY,
      valueName: FIELD_ENV_VALUE_NAME,
      backupKind: "environment-variable-value",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.backupKind).toBe("environment-variable-value");
    expect(await registryValueExists(ENVIRONMENT_KEY, FIELD_ENV_VALUE_NAME)).toBe(false);

    const restored = await restoreRegistryBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.backupKind).toBe("environment-variable-value");
    expect(await registryValueExists(ENVIRONMENT_KEY, FIELD_ENV_VALUE_NAME)).toBe(true);
    proveFieldRequirement(FIELD_REQUIREMENTS.appEnvironmentSetting);
  }, 45_000);

  it("backs up, removes, and restores one isolated app firewall rule", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-firewall-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:38:00.000Z");
    const restoredAt = new Date("2026-05-20T11:42:00.000Z");
    const ruleData =
      `v2.30|Action=Allow|Active=TRUE|Dir=In|App=C:\\Program Files\\${FIELD_VALUE_NAME}\\${FIELD_VALUE_NAME}.exe|Name=${FIELD_VALUE_NAME}|`;

    await setRegistryValue(FIREWALL_RULES_KEY, FIELD_FIREWALL_VALUE_NAME, "REG_SZ", ruleData);
    expect(await registryValueExists(FIREWALL_RULES_KEY, FIELD_FIREWALL_VALUE_NAME)).toBe(true);

    const backup = await backupAndDeleteRegistryValue({
      userDataDir,
      keyPath: FIREWALL_RULES_KEY,
      valueName: FIELD_FIREWALL_VALUE_NAME,
      backupKind: "firewall-rule-value",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.backupKind).toBe("firewall-rule-value");
    expect(await registryValueExists(FIREWALL_RULES_KEY, FIELD_FIREWALL_VALUE_NAME)).toBe(false);

    const restored = await restoreRegistryBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.backupKind).toBe("firewall-rule-value");
    expect(await registryValueExists(FIREWALL_RULES_KEY, FIELD_FIREWALL_VALUE_NAME)).toBe(true);
    proveFieldRequirement(FIELD_REQUIREMENTS.appFirewallRule);
  }, 45_000);

  it("backs up, removes, and restores an isolated Windows service trace", async () => {
    root = mkdtempSync(join(tmpdir(), "fb-windows-field-service-"));
    userDataDir = join(root, "userdata");
    const firstAt = new Date("2026-05-20T11:40:00.000Z");
    const restoredAt = new Date("2026-05-20T11:45:00.000Z");

    await runSc([
      "create",
      FIELD_SERVICE_NAME,
      "binPath=",
      "C:\\Windows\\System32\\cmd.exe /c exit 0",
      "start=",
      "demand",
      "DisplayName=",
      FIELD_VALUE_NAME
    ]);
    await runReg([
      "add",
      FIELD_SERVICE_KEY,
      "/v",
      "ImagePath",
      "/t",
      "REG_EXPAND_SZ",
      "/d",
      `"C:\\Program Files\\${FIELD_VALUE_NAME}\\${FIELD_VALUE_NAME}.exe" --service`,
      "/f"
    ]);
    await runReg([
      "add",
      FIELD_SERVICE_KEY,
      "/v",
      "Description",
      "/t",
      "REG_SZ",
      "/d",
      "FormatBuddy Windows field E2E service",
      "/f"
    ]);
    expect(await serviceExists(FIELD_SERVICE_NAME)).toBe(true);
    expect(await registryKeyExists(FIELD_SERVICE_KEY)).toBe(true);

    const leftoverSnapshot = await planAppLeftovers([], {
      extraApps: [
        {
          name: FIELD_VALUE_NAME,
          publisher: "FormatBuddy Field E2E",
          installLocation: `C:\\Program Files\\${FIELD_VALUE_NAME}`
        }
      ]
    });
    const serviceLeftover = leftoverSnapshot.groups
      .flatMap((group) => group.paths)
      .find((path) => path.kind === "service-registry" && path.serviceName === FIELD_SERVICE_NAME);
    expect(serviceLeftover).toMatchObject({
      kind: "service-registry",
      path: FIELD_SERVICE_KEY,
      serviceName: FIELD_SERVICE_NAME,
      exists: true
    });

    const backup = await backupAndDeleteRegistryKey({
      userDataDir,
      keyPath: FIELD_SERVICE_KEY,
      backupKind: "service-key",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
    });

    expect(backup.backupKind).toBe("service-key");
    expect(backup.expiresAt).toBe("2026-06-19T11:40:00.000Z");
    expect(backup.contentHash?.algorithm).toBe("sha256");
    expect(await serviceExists(FIELD_SERVICE_NAME)).toBe(false);
    expect(await registryKeyExists(FIELD_SERVICE_KEY)).toBe(false);

    const restored = await restoreRegistryBackup({
      userDataDir,
      backupId: backup.id,
      now: () => restoredAt
    });

    expect(restored.status).toBe("restored");
    expect(restored.entry?.backupKind).toBe("service-key");
    expect(await registryKeyExists(FIELD_SERVICE_KEY)).toBe(true);
    proveFieldRequirement(FIELD_REQUIREMENTS.serviceLeftover);
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

    await createFieldScheduledTask();
    const taskBackup = await backupAndDeleteScheduledTask({
      userDataDir,
      taskName: FIELD_TASK_NAME,
      taskPath: "\\",
      now: () => firstAt,
      app: { name: FIELD_VALUE_NAME, publisher: "FormatBuddy Field E2E" }
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
        }),
      purgeScheduledTaskBackups: () =>
        purgeExpiredScheduledTaskBackups({
          userDataDir,
          now: () => purgeAt
        })
    });

    expect(purge.failed).toEqual([]);
    expect(purge.trash?.purgedEntryIds).toEqual([trashed.id]);
    expect(purge.registryBackups?.purgedIds).toEqual([registryBackup.id]);
    expect(purge.startupDisabled?.purgedIds).toEqual([disabledStartup.entry!.id]);
    expect(purge.scheduledTaskBackups?.purgedIds).toEqual([taskBackup.id]);
    expect(existsSync(trashed.storedPath)).toBe(false);
    expect(existsSync(registryBackup.backupPath)).toBe(false);
    expect(existsSync(disabledStartup.entry!.storedPath)).toBe(false);
    expect(existsSync(taskBackup.backupPath)).toBe(false);
    proveFieldRequirement(FIELD_REQUIREMENTS.unifiedRetentionTick);
  }, 90_000);
});
