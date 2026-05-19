import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";
import { findLinkedPathPart } from "../cleanup/pathSafety";

export const REGISTRY_BACKUP_RETENTION_DAYS = 30;

export interface RegistryCleanupRunner {
  exportKey: (keyPath: string, backupPath: string) => Promise<void>;
  deleteKey: (keyPath: string) => Promise<void>;
}

export interface RegistryCleanupResult {
  id: string;
  keyPath: string;
  backupPath: string;
  createdAt: string;
  expiresAt: string;
}

export interface RegistryBackupPurgeResult {
  purgedCount: number;
  purgedIds: string[];
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

function registryBackupExpiry(now: Date): string {
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + REGISTRY_BACKUP_RETENTION_DAYS);
  return expiresAt.toISOString();
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
    deleteKey: (keyPath) => runRegCommand(["delete", keyPath, "/f"])
  };
}

export async function backupAndDeleteRegistryKey(options: {
  userDataDir: string;
  keyPath: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
}): Promise<RegistryCleanupResult> {
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

  await runner.exportKey(keyPath, backupPath);
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        id,
        keyPath,
        backupPath,
        createdAt,
        expiresAt
      },
      null,
      2
    ),
    "utf8"
  );
  await runner.deleteKey(keyPath);

  return {
    id,
    keyPath,
    backupPath,
    createdAt,
    expiresAt
  };
}

export async function purgeExpiredRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<RegistryBackupPurgeResult> {
  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) return { purgedCount: 0, purgedIds: [] };

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { purgedCount: 0, purgedIds: [] };
  }

  const now = options.now?.() ?? new Date();
  const purgedIds: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryDir = join(root, entry.name);
    try {
      const meta = JSON.parse(await fs.readFile(join(entryDir, "meta.json"), "utf8")) as {
        expiresAt?: unknown;
      };
      if (typeof meta.expiresAt !== "string") continue;
      const expiresAt = Date.parse(meta.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) continue;
      await fs.rm(entryDir, { recursive: true, force: true });
      purgedIds.push(entry.name);
    } catch {
      continue;
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedIds
  };
}

export const __testing = { normalizeRegistryKeyPath, registryBackupExpiry };
