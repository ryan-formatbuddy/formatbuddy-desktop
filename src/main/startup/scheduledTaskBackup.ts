import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import type {
  InstalledApp,
  ScheduledTaskBackupEntry,
  ScheduledTaskBackupPurgeResult,
  ScheduledTaskBackupRestoreResult,
  ScheduledTaskBackupSnapshot
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import { normalizePath } from "../cleanup/blocklist";
import { findLinkedPathPart } from "../cleanup/pathSafety";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";

export const SCHEDULED_TASK_BACKUP_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS;

export interface ScheduledTaskBackupRunner {
  exportTask: (taskName: string, taskPath: string, backupPath: string) => Promise<void>;
  deleteTask: (taskName: string, taskPath: string) => Promise<void>;
  restoreTask: (taskName: string, taskPath: string, backupPath: string) => Promise<void>;
  taskExists?: (taskName: string, taskPath: string) => Promise<boolean>;
}

export class ScheduledTaskBackupPreservedError extends Error {
  readonly backup: Pick<ScheduledTaskBackupEntry, "id" | "expiresAt">;

  constructor(
    message: string,
    backup: Pick<ScheduledTaskBackupEntry, "id" | "expiresAt">,
    cause?: unknown
  ) {
    super(message);
    this.name = "ScheduledTaskBackupPreservedError";
    this.backup = backup;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, ScheduledTaskBackupPreservedError.prototype);
  }
}

export function isScheduledTaskBackupPreservedError(
  err: unknown
): err is ScheduledTaskBackupPreservedError {
  return (
    err instanceof ScheduledTaskBackupPreservedError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "ScheduledTaskBackupPreservedError" &&
      typeof (err as { backup?: { id?: unknown } }).backup?.id === "string")
  );
}

function backupsRoot(userDataDir: string): string {
  return join(userDataDir, "formatbuddy-scheduled-task-backups", "items");
}

function backupEntryDir(userDataDir: string, backupId: string): string {
  return join(backupsRoot(userDataDir), backupId);
}

function backupXmlPath(userDataDir: string, backupId: string): string {
  return join(backupEntryDir(userDataDir, backupId), "task.xml");
}

function backupMetaPath(userDataDir: string, backupId: string): string {
  return join(backupEntryDir(userDataDir, backupId), "meta.json");
}

function taskBackupExpiry(now: Date): string {
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + SCHEDULED_TASK_BACKUP_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function canonicalTaskBackupExpiry(createdAt: string): string {
  return taskBackupExpiry(new Date(createdAt));
}

export function isSafeScheduledTaskBackupId(backupId: unknown): backupId is string {
  return (
    typeof backupId === "string" &&
    backupId.length > 0 &&
    backupId.trim() === backupId &&
    backupId !== "." &&
    backupId !== ".." &&
    !/\s/.test(backupId) &&
    !backupId.includes("/") &&
    !backupId.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(backupId)
  );
}

export function normalizeSafeScheduledTaskName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const taskName = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!taskName || taskName.length > 240) return null;
  if (/[\\/"'`|&<>*?]/.test(taskName)) return null;
  return taskName;
}

export function normalizeSafeScheduledTaskPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let taskPath = value.trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
  if (!taskPath) return "\\";
  if (/[\u0000-\u001f\u007f"'`|&<>*?]/.test(taskPath)) return null;
  if (taskPath.includes("..")) return null;
  if (!taskPath.startsWith("\\")) taskPath = `\\${taskPath}`;
  if (!taskPath.endsWith("\\")) taskPath = `${taskPath}\\`;
  if (taskPath.length > 512) return null;
  return taskPath;
}

function cleanDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed ? trimmed.slice(0, 1024) : undefined;
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidContentHash(
  value: unknown
): value is NonNullable<ScheduledTaskBackupEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<ScheduledTaskBackupEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

function isOutsideBackupRetentionWindow(
  entry: Pick<ScheduledTaskBackupEntry, "createdAt" | "expiresAt">,
  now: Date
): boolean {
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isFinite(createdAt) && createdAt > now.getTime()) return true;

  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(path: string): Promise<string> {
  const content = await fs.readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function assertRestorableTaskBackupFile(
  entryDir: string,
  backupPath: string
): Promise<number> {
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) {
    throw new Error(`예약 작업 백업 파일이 링크라 정리하지 않았어요: ${linkedBackup}`);
  }

  let stat;
  try {
    stat = await fs.lstat(backupPath);
  } catch {
    throw new Error("예약 작업 백업 파일을 만들지 못해 정리하지 않았어요.");
  }
  if (stat.isSymbolicLink()) {
    throw new Error("예약 작업 백업 파일이 링크라 정리하지 않았어요.");
  }
  if (!stat.isFile()) {
    throw new Error("예약 작업 백업 파일이 파일이 아니라 정리하지 않았어요.");
  }
  if (stat.size <= 0) {
    throw new Error("예약 작업 백업 파일이 비어 있어 정리하지 않았어요.");
  }

  const content = await fs.readFile(backupPath, "utf8");
  if (!/<Task\b/i.test(content.slice(0, 4096))) {
    throw new Error("예약 작업 백업 파일 형식을 확인하지 못해 정리하지 않았어요.");
  }
  return Math.max(0, stat.size);
}

async function writeTaskBackupMetaFile(
  entryDir: string,
  metaPath: string,
  payload: unknown
): Promise<void> {
  const linkedMetaBefore = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaBefore) {
    throw new Error(`예약 작업 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaBefore}`);
  }

  await fs.writeFile(metaPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    flag: "wx"
  });

  const linkedMetaAfter = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaAfter) {
    throw new Error(`예약 작업 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaAfter}`);
  }

  const stat = await fs.lstat(metaPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error("예약 작업 백업 정보 파일이 안전하지 않아 정리하지 않았어요.");
  }
}

function runPowerShellTaskCommand(script: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
      ...args
    ], {
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `powershell.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

function isTaskMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cannot find|not found|no MSFT_ScheduledTask|찾을 수|없습니다/i.test(message);
}

export function defaultScheduledTaskBackupRunner(): ScheduledTaskBackupRunner {
  const exportScript = [
    "$ErrorActionPreference = 'Stop'",
    "$xml = Export-ScheduledTask -TaskName $args[0] -TaskPath $args[1]",
    "Set-Content -LiteralPath $args[2] -Value $xml -Encoding UTF8"
  ].join("; ");
  const deleteScript = [
    "$ErrorActionPreference = 'Stop'",
    "Unregister-ScheduledTask -TaskName $args[0] -TaskPath $args[1] -Confirm:$false"
  ].join("; ");
  const restoreScript = [
    "$ErrorActionPreference = 'Stop'",
    "$xml = Get-Content -LiteralPath $args[2] -Raw",
    "Register-ScheduledTask -TaskName $args[0] -TaskPath $args[1] -Xml $xml -Force | Out-Null"
  ].join("; ");
  const existsScript = [
    "$ErrorActionPreference = 'Stop'",
    "$task = Get-ScheduledTask -TaskName $args[0] -TaskPath $args[1]",
    "if ($null -ne $task) { Write-Output 'true' }"
  ].join("; ");

  return {
    exportTask: (taskName, taskPath, backupPath) =>
      runPowerShellTaskCommand(exportScript, [taskName, taskPath, backupPath]).then(() => {}),
    deleteTask: (taskName, taskPath) =>
      runPowerShellTaskCommand(deleteScript, [taskName, taskPath]).then(() => {}),
    restoreTask: (taskName, taskPath, backupPath) =>
      runPowerShellTaskCommand(restoreScript, [taskName, taskPath, backupPath]).then(() => {}),
    taskExists: async (taskName, taskPath) => {
      try {
        await runPowerShellTaskCommand(existsScript, [taskName, taskPath]);
        return true;
      } catch (err) {
        if (isTaskMissingError(err)) return false;
        throw err;
      }
    }
  };
}

export async function backupAndDeleteScheduledTask(options: {
  userDataDir: string;
  taskName: string;
  taskPath: string;
  now?: () => Date;
  runner?: ScheduledTaskBackupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<ScheduledTaskBackupEntry> {
  const taskName = normalizeSafeScheduledTaskName(options.taskName);
  const taskPath = normalizeSafeScheduledTaskPath(options.taskPath);
  if (!taskName || !taskPath) {
    throw new Error("예약 작업 정보가 안전하지 않아 자동 정리하지 않아요.");
  }

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = taskBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = backupEntryDir(options.userDataDir, id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Scheduled task backup" });

  const backupPath = backupXmlPath(options.userDataDir, id);
  const metaPath = backupMetaPath(options.userDataDir, id);
  const runner = options.runner ?? defaultScheduledTaskBackupRunner();
  const appName = cleanDisplayString(options.app?.name);
  const appPublisher = cleanDisplayString(options.app?.publisher);
  let deleteInvoked = false;
  let deleteConfirmedIncomplete = false;

  try {
    await runner.exportTask(taskName, taskPath, backupPath);
    const sizeBytes = await assertRestorableTaskBackupFile(entryDir, backupPath);
    const contentHash = { algorithm: "sha256" as const, value: await hashFile(backupPath) };
    const payload: Omit<ScheduledTaskBackupEntry, "integrityStatus"> = {
      id,
      taskName,
      taskPath,
      backupPath,
      sizeBytes,
      contentHash,
      appName,
      appPublisher,
      createdAt,
      expiresAt
    };
    await writeTaskBackupMetaFile(entryDir, metaPath, payload);
    await runner.deleteTask(taskName, taskPath);
    deleteInvoked = true;
    if (runner.taskExists && (await runner.taskExists(taskName, taskPath))) {
      deleteConfirmedIncomplete = true;
      throw new Error("Scheduled task still exists after deletion");
    }
    return await assertScheduledTaskBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    if (deleteInvoked && !deleteConfirmedIncomplete) {
      const preserved = await restorableScheduledTaskBackupEntry(options.userDataDir, id);
      if (preserved) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ScheduledTaskBackupPreservedError(
          message,
          { id: preserved.id, expiresAt: preserved.expiresAt },
          err
        );
      }
    }
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

type ScheduledTaskBackupReadResult =
  | { kind: "entry"; entry: ScheduledTaskBackupEntry }
  | { kind: "restore-result"; result: ScheduledTaskBackupRestoreResult };

async function readScheduledTaskBackupEntryForRestore(
  userDataDir: string,
  backupId: string,
  options: { allowChangedContent?: boolean } = {}
): Promise<ScheduledTaskBackupReadResult> {
  if (!isSafeScheduledTaskBackupId(backupId)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "예약 작업 백업 이름이 안전하지 않아 되돌리지 않았어요."
      }
    };
  }

  const entryDir = backupEntryDir(userDataDir, backupId);
  const backupPath = backupXmlPath(userDataDir, backupId);
  const metaPath = backupMetaPath(userDataDir, backupId);

  for (const [path, message] of [
    [entryDir, "예약 작업 백업 폴더가 링크라 되돌리지 않았어요."],
    [metaPath, "예약 작업 백업 정보 파일이 링크라 되돌리지 않았어요."],
    [backupPath, "예약 작업 백업 파일이 링크라 되돌리지 않았어요."]
  ] as const) {
    if (await findLinkedPathPart(path, path === entryDir ? userDataDir : entryDir, true)) {
      return {
        kind: "restore-result",
        result: { backupId, status: "blocked-path", message }
      };
    }
  }

  let raw: Partial<ScheduledTaskBackupEntry>;
  try {
    raw = JSON.parse(await fs.readFile(metaPath, "utf8")) as Partial<ScheduledTaskBackupEntry>;
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "예약 작업 백업을 찾지 못했어요."
      }
    };
  }

  const taskName = normalizeSafeScheduledTaskName(raw.taskName);
  const taskPath = normalizeSafeScheduledTaskPath(raw.taskPath);
  if (raw.id !== backupId || !taskName || !taskPath || !isValidIso(raw.createdAt) || !isValidIso(raw.expiresAt)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "예약 작업 백업 정보를 확인하지 못했어요."
      }
    };
  }

  let stat;
  try {
    stat = await fs.lstat(backupPath);
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "missing-backup",
        message: "예약 작업 백업 파일을 찾지 못했어요.",
        taskName,
        taskPath
      }
    };
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "예약 작업 백업 파일을 안전하게 확인하지 못했어요.",
        taskName,
        taskPath
      }
    };
  }

  const contentHash = isValidContentHash(raw.contentHash) ? raw.contentHash : null;
  const actualHash = contentHash ? await hashFile(backupPath).catch(() => null) : null;
  const integrityStatus: NonNullable<ScheduledTaskBackupEntry["integrityStatus"]> =
    contentHash && actualHash === contentHash.value ? "verified" : contentHash ? "changed" : "legacy";
  const entry: ScheduledTaskBackupEntry = {
    id: backupId,
    taskName,
    taskPath,
    backupPath,
    sizeBytes: Math.max(0, stat.size),
    contentHash,
    integrityStatus,
    appName: cleanDisplayString(raw.appName),
    appPublisher: cleanDisplayString(raw.appPublisher),
    createdAt: raw.createdAt,
    expiresAt: canonicalTaskBackupExpiry(raw.createdAt)
  };

  if (integrityStatus !== "verified" && !options.allowChangedContent) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message:
          integrityStatus === "changed"
            ? "예약 작업 백업 파일이 바뀐 것 같아 되돌리지 않았어요."
            : "예약 작업 백업 기록이 오래되어 자동으로 되돌리지 않았어요.",
        taskName,
        taskPath,
        entry
      }
    };
  }

  return { kind: "entry", entry };
}

async function readScheduledTaskBackupEntry(
  userDataDir: string,
  backupId: string
): Promise<ScheduledTaskBackupEntry | null> {
  const result = await readScheduledTaskBackupEntryForRestore(userDataDir, backupId, {
    allowChangedContent: true
  });
  return result.kind === "entry" ? result.entry : null;
}

async function assertScheduledTaskBackupEntryStillRestorable(
  userDataDir: string,
  backupId: string
): Promise<ScheduledTaskBackupEntry> {
  const result = await readScheduledTaskBackupEntryForRestore(userDataDir, backupId);
  if (result.kind === "entry") return result.entry;
  throw new Error(result.result.message);
}

async function restorableScheduledTaskBackupEntry(
  userDataDir: string,
  backupId: string
): Promise<ScheduledTaskBackupEntry | null> {
  try {
    return await assertScheduledTaskBackupEntryStillRestorable(userDataDir, backupId);
  } catch {
    return null;
  }
}

export async function listScheduledTaskBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<ScheduledTaskBackupSnapshot> {
  const now = options.now?.() ?? new Date();
  await purgeExpiredScheduledTaskBackups({
    userDataDir: options.userDataDir,
    now: () => now,
    pruneNonRestorable: true
  }).catch(() => {});

  let dirs;
  try {
    dirs = await fs.readdir(backupsRoot(options.userDataDir), { withFileTypes: true });
  } catch {
    return { entries: [], retentionDays: SCHEDULED_TASK_BACKUP_RETENTION_DAYS };
  }

  const entries: ScheduledTaskBackupEntry[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory() || !isSafeScheduledTaskBackupId(dir.name)) continue;
    const entry = await readScheduledTaskBackupEntry(options.userDataDir, dir.name);
    if (entry && !isOutsideBackupRetentionWindow(entry, now)) {
      entries.push(entry);
    }
  }

  entries.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  return {
    entries,
    retentionDays: SCHEDULED_TASK_BACKUP_RETENTION_DAYS,
    nextExpiryAt: entries[0]?.expiresAt
  };
}

async function assertSafeTaskBackupEntryDirForPurge(
  userDataDir: string,
  backupId: string
): Promise<string> {
  if (!isSafeScheduledTaskBackupId(backupId)) {
    throw new Error("예약 작업 백업 항목 이름이 안전하지 않아요.");
  }
  const root = normalizePath(resolve(backupsRoot(userDataDir)));
  const dir = backupEntryDir(userDataDir, backupId);
  const normalizedDir = normalizePath(resolve(dir));
  if (!normalizedDir.startsWith(`${root}\\`)) {
    throw new Error("예약 작업 백업 폴더가 보관함 밖에 있어요.");
  }
  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`예약 작업 백업 폴더가 링크라 비우지 않았어요: ${linkedDir}`);
  }
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory()) {
    throw new Error("예약 작업 백업 항목이 폴더가 아니에요.");
  }
  return dir;
}

async function removeManagedTaskBackupItem(userDataDir: string, backupId: string): Promise<boolean> {
  if (!isSafeScheduledTaskBackupId(backupId)) return false;
  const root = normalizePath(resolve(backupsRoot(userDataDir)));
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) return false;
  const dir = backupEntryDir(userDataDir, backupId);
  const normalizedDir = normalizePath(resolve(dir));
  if (!normalizedDir.startsWith(`${root}\\`)) return false;
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return !(await pathExists(dir));
}

async function removeLinkedScheduledTaskBackupRootIfManaged(
  userDataDir: string,
  linkedRoot: string
): Promise<void> {
  if (normalizePath(resolve(linkedRoot)) === normalizePath(resolve(userDataDir))) return;
  await fs.rm(linkedRoot, { force: true }).catch(() => {});
}

function taskBackupPurgeLabel(entry: ScheduledTaskBackupEntry): string {
  if (entry.appName) return `${entry.appName} 예약 작업`;
  return entry.taskName || "예약 작업";
}

export async function purgeExpiredScheduledTaskBackups(options: {
  userDataDir: string;
  now?: () => Date;
  pruneNonRestorable?: boolean;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
}): Promise<ScheduledTaskBackupPurgeResult> {
  const now = options.now?.() ?? new Date();
  const root = backupsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    await removeLinkedScheduledTaskBackupRootIfManaged(options.userDataDir, linkedRoot);
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: SCHEDULED_TASK_BACKUP_RETENTION_DAYS
    };
  }

  let dirs;
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: SCHEDULED_TASK_BACKUP_RETENTION_DAYS
    };
  }

  const purgedIds: string[] = [];
  const failedIds: string[] = [];
  const purgedItems: ScheduledTaskBackupPurgeResult["purgedItems"] = [];
  let purgedBytes = 0;

  for (const dir of dirs) {
    if (!isSafeScheduledTaskBackupId(dir.name)) continue;
    if (!dir.isDirectory()) {
      if (options.pruneNonRestorable && (await removeManagedTaskBackupItem(options.userDataDir, dir.name))) {
        purgedIds.push(dir.name);
      }
      continue;
    }
    const entry = await readScheduledTaskBackupEntry(options.userDataDir, dir.name);
    if (!entry) {
      if (options.pruneNonRestorable && (await removeManagedTaskBackupItem(options.userDataDir, dir.name))) {
        purgedIds.push(dir.name);
      }
      continue;
    }
    if (!isOutsideBackupRetentionWindow(entry, now)) continue;

    try {
      const dirPath = await assertSafeTaskBackupEntryDirForPurge(options.userDataDir, dir.name);
      if (options.removeEntryDir) {
        await options.removeEntryDir(dirPath, dir.name);
      } else {
        await fs.rm(dirPath, { recursive: true, force: true });
      }
      if (await pathExists(dirPath)) {
        failedIds.push(dir.name);
        continue;
      }
      purgedIds.push(dir.name);
      purgedBytes += Math.max(0, entry.sizeBytes);
      purgedItems.push({
        id: dir.name,
        label: taskBackupPurgeLabel(entry),
        sizeBytes: Math.max(0, entry.sizeBytes)
      });
    } catch {
      failedIds.push(dir.name);
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedBytes,
    purgedIds,
    purgedItems,
    failedIds: failedIds.length > 0 ? failedIds : undefined,
    retentionDays: SCHEDULED_TASK_BACKUP_RETENTION_DAYS
  };
}

export async function restoreScheduledTaskBackup(options: {
  userDataDir: string;
  backupId: string;
  now?: () => Date;
  runner?: ScheduledTaskBackupRunner;
  beforeRestore?: (entry: ScheduledTaskBackupEntry) => Promise<void>;
  removeEntryDir?: (dir: string, entry: ScheduledTaskBackupEntry) => Promise<void>;
}): Promise<ScheduledTaskBackupRestoreResult> {
  const now = options.now?.() ?? new Date();
  const readResult = await readScheduledTaskBackupEntryForRestore(options.userDataDir, options.backupId);
  if (readResult.kind === "restore-result") return readResult.result;
  const entry = readResult.entry;
  if (isOutsideBackupRetentionWindow(entry, now)) {
    return {
      backupId: options.backupId,
      status: "expired",
      message: "30일 보관 기간이 지나 예약 작업을 되돌릴 수 없어요.",
      taskName: entry.taskName,
      taskPath: entry.taskPath,
      entry
    };
  }

  const runner = options.runner ?? defaultScheduledTaskBackupRunner();
  try {
    await options.beforeRestore?.(entry);
    await runner.restoreTask(entry.taskName, entry.taskPath, entry.backupPath);
    if (runner.taskExists && !(await runner.taskExists(entry.taskName, entry.taskPath))) {
      return {
        backupId: options.backupId,
        status: "restore-failed",
        message: "예약 작업을 아직 되돌리지 못했어요. Windows 작업 스케줄러에서 한 번 더 확인해주세요.",
        taskName: entry.taskName,
        taskPath: entry.taskPath,
        entry
      };
    }
    const dir = await assertSafeTaskBackupEntryDirForPurge(options.userDataDir, entry.id);
    if (options.removeEntryDir) {
      await options.removeEntryDir(dir, entry);
    } else {
      await fs.rm(dir, { recursive: true, force: true });
    }
    if (await pathExists(dir)) {
      return {
        backupId: options.backupId,
        status: "restore-failed",
        message: "예약 작업은 되돌렸지만 복구함 기록을 아직 지우지 못했어요. 다음 확인 때 다시 정리할게요.",
        taskName: entry.taskName,
        taskPath: entry.taskPath,
        entry
      };
    }
    return {
      backupId: options.backupId,
      status: "restored",
      message: "예약 작업을 다시 되돌렸어요.",
      taskName: entry.taskName,
      taskPath: entry.taskPath,
      entry
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      backupId: options.backupId,
      status: /not found|cannot find|찾을 수/i.test(message) ? "not-found" : "restore-failed",
      message: "예약 작업을 되돌리는 중 문제가 생겼어요. Windows 작업 스케줄러에서 직접 확인해주세요.",
      taskName: entry.taskName,
      taskPath: entry.taskPath,
      entry
    };
  }
}

export const __testing = {
  assertRestorableTaskBackupFile,
  assertSafeTaskBackupEntryDirForPurge,
  backupsRoot,
  normalizeSafeScheduledTaskName,
  normalizeSafeScheduledTaskPath
};
