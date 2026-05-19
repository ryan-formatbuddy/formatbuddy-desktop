import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type {
  InstalledApp,
  RegistryBackupEntry,
  RegistryBackupPurgeResult,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot
} from "@shared/types";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";
import { findLinkedPathPart } from "../cleanup/pathSafety";

export const REGISTRY_BACKUP_RETENTION_DAYS = 30;

export interface RegistryCleanupRunner {
  exportKey: (keyPath: string, backupPath: string) => Promise<void>;
  deleteKey: (keyPath: string) => Promise<void>;
  importFile?: (backupPath: string) => Promise<void>;
}

const SAFE_UNINSTALL_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+)$/i;

function normalizeRegistryKeyPath(keyPath: string): string {
  return keyPath.trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
}

export function isSafeUninstallRegistryKeyPath(keyPath: string): boolean {
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_UNINSTALL_KEY_PATTERN.test(normalized);
}

export function isSafeRegistryBackupId(backupId: string): boolean {
  return (
    backupId.length > 0 &&
    backupId !== "." &&
    backupId !== ".." &&
    !backupId.includes("/") &&
    !backupId.includes("\\") &&
    !backupId.includes("\0")
  );
}

function registryBackupExpiry(now: Date): string {
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + REGISTRY_BACKUP_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function canonicalRegistryBackupExpiry(createdAt: string): string {
  return registryBackupExpiry(new Date(createdAt));
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 1024);
}

function registryBackupItemsRoot(userDataDir: string): string {
  return join(userDataDir, "formatbuddy-registry-backups", "items");
}

function runRegCommand(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("reg.exe", args, {
      windowsHide: true,
      shell: false
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `reg.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

export function defaultRegistryCleanupRunner(): RegistryCleanupRunner {
  return {
    exportKey: (keyPath, backupPath) => runRegCommand(["export", keyPath, backupPath, "/y"]),
    deleteKey: (keyPath) => runRegCommand(["delete", keyPath, "/f"]),
    importFile: (backupPath) => runRegCommand(["import", backupPath])
  };
}

export async function backupAndDeleteRegistryKey(options: {
  userDataDir: string;
  keyPath: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<RegistryBackupEntry> {
  const keyPath = normalizeRegistryKeyPath(options.keyPath);
  if (!isSafeUninstallRegistryKeyPath(keyPath)) {
    throw new Error("지원하는 앱 제거 레지스트리 위치가 아니라 자동 정리하지 않아요.");
  }

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = registryBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = join(registryBackupItemsRoot(options.userDataDir), id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Registry backup" });

  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");
  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const appName = cleanOptionalString(options.app?.name);
  const appPublisher = cleanOptionalString(options.app?.publisher);

  try {
    await runner.exportKey(keyPath, backupPath);
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          id,
          keyPath,
          backupPath,
          appName,
          appPublisher,
          createdAt,
          expiresAt
        },
        null,
        2
      ),
      "utf8"
    );
    await runner.deleteKey(keyPath);
  } catch (err) {
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  return {
    id,
    keyPath,
    backupPath,
    appName,
    appPublisher,
    createdAt,
    expiresAt
  };
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

async function readRegistryBackupEntry(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupEntry | null> {
  const result = await readRegistryBackupEntryForRestore(userDataDir, backupId);
  return result.kind === "entry" ? result.entry : null;
}

type RegistryBackupReadResult =
  | { kind: "entry"; entry: RegistryBackupEntry }
  | { kind: "restore-result"; result: RegistryBackupRestoreResult };

async function readRegistryBackupEntryForRestore(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupReadResult> {
  if (!isSafeRegistryBackupId(backupId)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
      }
    };
  }

  const root = registryBackupItemsRoot(userDataDir);
  const entryDir = join(root, backupId);
  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");

  const linkedEntry = await findLinkedPathPart(entryDir, userDataDir, true);
  if (linkedEntry) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 폴더가 링크라 되돌리지 않았어요."
      }
    };
  }
  const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMeta) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 정보 파일이 링크라 되돌리지 않았어요."
      }
    };
  }
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 파일이 링크라 되돌리지 않았어요."
      }
    };
  }

  let raw: Partial<RegistryBackupEntry>;
  try {
    raw = JSON.parse(await fs.readFile(metaPath, "utf8")) as Partial<RegistryBackupEntry>;
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업을 찾지 못했어요."
      }
    };
  }

  if (raw.id !== backupId) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업 정보를 확인하지 못했어요."
      }
    };
  }
  if (typeof raw.keyPath !== "string" || !isSafeUninstallRegistryKeyPath(raw.keyPath)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "지원하는 앱 제거 레지스트리 위치가 아니라 되돌리지 않았어요."
      }
    };
  }
  if (!isValidIso(raw.createdAt) || !isValidIso(raw.expiresAt)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업 정보를 확인하지 못했어요."
      }
    };
  }

  const entry: RegistryBackupEntry = {
    id: backupId,
    keyPath: normalizeRegistryKeyPath(raw.keyPath),
    backupPath,
    createdAt: raw.createdAt,
    expiresAt: canonicalRegistryBackupExpiry(raw.createdAt)
  };
  const appName = cleanOptionalString(raw.appName);
  const appPublisher = cleanOptionalString(raw.appPublisher);
  if (appName) entry.appName = appName;
  if (appPublisher) entry.appPublisher = appPublisher;

  try {
    const backupStat = await fs.lstat(backupPath);
    if (backupStat.isSymbolicLink()) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: "앱 삭제 흔적 백업 파일이 링크라 되돌리지 않았어요.",
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    if (!backupStat.isFile()) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "missing-backup",
          message: "앱 삭제 흔적 백업 파일이 보이지 않아요.",
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    return { kind: "entry", entry };
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "missing-backup",
        message: "앱 삭제 흔적 백업 파일이 보이지 않아요.",
        keyPath: entry.keyPath,
        entry
      }
    };
  }
}

export async function listRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<RegistryBackupSnapshot> {
  await purgeExpiredRegistryBackups(options);

  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    return { entries: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  let dirs;
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { entries: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  const entries: RegistryBackupEntry[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const entry = await readRegistryBackupEntry(options.userDataDir, dir.name);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

  return {
    entries,
    retentionDays: REGISTRY_BACKUP_RETENTION_DAYS,
    nextExpiryAt: entries[0]?.expiresAt
  };
}

export async function purgeExpiredRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<RegistryBackupPurgeResult> {
  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    return { purgedCount: 0, purgedIds: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { purgedCount: 0, purgedIds: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  const now = options.now?.() ?? new Date();
  const purgedIds: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryDir = join(root, entry.name);
    try {
      const metaPath = join(entryDir, "meta.json");
      const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
      if (linkedMeta) continue;
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as {
        createdAt?: unknown;
        expiresAt?: unknown;
      };
      if (typeof meta.expiresAt !== "string") continue;
      const effectiveExpiresAt =
        typeof meta.createdAt === "string" && isValidIso(meta.createdAt)
          ? canonicalRegistryBackupExpiry(meta.createdAt)
          : meta.expiresAt;
      const expiresAt = Date.parse(effectiveExpiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) continue;
      await fs.rm(entryDir, { recursive: true, force: true });
      purgedIds.push(entry.name);
    } catch {
      continue;
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedIds,
    retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
  };
}

export async function restoreRegistryBackup(options: {
  userDataDir: string;
  backupId: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  beforeImport?: () => Promise<void>;
  onAppRegistryBackupRestored?: (
    app: { name: string; publisher?: string | null; registryKeyPath: string }
  ) => void | Promise<void>;
}): Promise<RegistryBackupRestoreResult> {
  if (!isSafeRegistryBackupId(options.backupId)) {
    return {
      backupId: options.backupId,
      status: "blocked-path",
      message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
    };
  }

  await purgeExpiredRegistryBackups({
    userDataDir: options.userDataDir,
    now: options.now
  });

  const readResult = await readRegistryBackupEntryForRestore(options.userDataDir, options.backupId);
  if (readResult.kind === "restore-result") return readResult.result;
  const { entry } = readResult;

  const importFile = options.runner?.importFile ?? defaultRegistryCleanupRunner().importFile;
  if (!importFile) {
    return {
      backupId: options.backupId,
      status: "restore-failed",
      message: "앱 삭제 흔적 백업을 되돌릴 준비가 되지 않았어요.",
      keyPath: entry.keyPath,
      entry
    };
  }

  try {
    await options.beforeImport?.().catch(() => {});
    await importFile(entry.backupPath);
    await fs.rm(join(registryBackupItemsRoot(options.userDataDir), entry.id), {
      recursive: true,
      force: true
    });
    const appName = cleanOptionalString(entry.appName);
    if (appName) {
      await Promise.resolve(
        options.onAppRegistryBackupRestored?.({
          name: appName,
          publisher: entry.appPublisher ?? null,
          registryKeyPath: entry.keyPath
        })
      ).catch(() => {});
    }
    return {
      backupId: entry.id,
      status: "restored",
      message: "앱 삭제 흔적 백업을 되돌렸어요.",
      keyPath: entry.keyPath,
      entry
    };
  } catch (err) {
    return {
      backupId: entry.id,
      status: "restore-failed",
      message: `앱 삭제 흔적 백업 되돌리기 중 문제가 생겼어요: ${(err as Error).message}`,
      keyPath: entry.keyPath,
      entry
    };
  }
}

export const __testing = {
  normalizeRegistryKeyPath,
  registryBackupExpiry,
  registryBackupItemsRoot
};
