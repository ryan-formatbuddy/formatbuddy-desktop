import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  InstalledApp,
  RegistryBackupEntry,
  RegistryBackupPurgeResult,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot
} from "@shared/types";
import { registryBackupKindLabel } from "@shared/cleanup-result";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";
import { findLinkedPathPart } from "../cleanup/pathSafety";
import { normalizePath } from "../cleanup/blocklist";

export const REGISTRY_BACKUP_RETENTION_DAYS = 30;

export interface RegistryCleanupRunner {
  exportKey: (keyPath: string, backupPath: string) => Promise<void>;
  deleteKey: (keyPath: string) => Promise<void>;
  keyExists?: (keyPath: string) => Promise<boolean>;
  exportValue?: (keyPath: string, valueName: string, backupPath: string) => Promise<void>;
  deleteValue?: (keyPath: string, valueName: string) => Promise<void>;
  valueExists?: (keyPath: string, valueName: string) => Promise<boolean>;
  importFile?: (backupPath: string) => Promise<void>;
}

type RegistryBackupRestoredApp = {
  name: string;
  publisher?: string | null;
  backupKind: "key" | "startup-value";
  registryKeyPath?: string;
  valueName?: string;
};

const SAFE_UNINSTALL_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+)$/i;
const SAFE_STARTUP_VALUE_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?)$/i;

function normalizeRegistryKeyPath(keyPath: string): string {
  return keyPath.trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
}

function canonicalRegistryKeyForComparison(keyPath: string): string {
  return normalizeRegistryKeyPath(keyPath)
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\")
    .toLowerCase();
}

export function isSafeUninstallRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_UNINSTALL_KEY_PATTERN.test(normalized);
}

function isSafeRegistryValueName(valueName: string): boolean {
  const trimmed = valueName.trim();
  if (!trimmed) return false;
  if (trimmed !== valueName) return false;
  if (trimmed.length > 256) return false;
  if (/[\0\r\n"'`|&<>\\]/.test(trimmed)) return false;
  if (/[*?]/.test(trimmed)) return false;
  return true;
}

export function isSafeStartupRegistryValuePath(keyPath: string, valueName: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_STARTUP_VALUE_KEY_PATTERN.test(normalized) && isSafeRegistryValueName(valueName);
}

export function isSafeRegistryBackupId(backupId: unknown): backupId is string {
  if (typeof backupId !== "string") return false;
  const trimmed = backupId.trim();
  return (
    trimmed.length > 0 &&
    trimmed === backupId &&
    backupId !== "." &&
    backupId !== ".." &&
    !backupId.includes("/") &&
    !backupId.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(backupId)
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

function isOutsideRegistryBackupRestorableWindow(
  entry: Pick<RegistryBackupEntry, "createdAt" | "expiresAt">,
  now: Date
): boolean {
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isFinite(createdAt) && createdAt > now.getTime()) return true;

  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 1024);
}

function registryBackupItemsRoot(userDataDir: string): string {
  return join(userDataDir, "formatbuddy-registry-backups", "items");
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

function isValidRegistryBackupContentHash(
  value: unknown
): value is NonNullable<RegistryBackupEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<RegistryBackupEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

async function removeRegistryBackupStoreItem(root: string, name: string): Promise<boolean> {
  if (!isSafeRegistryBackupId(name)) return false;
  const target = join(root, name);
  await fs.rm(target, { recursive: true, force: true }).catch(() => {});
  return !(await pathExists(target));
}

async function removeLinkedRegistryBackupRootIfManaged(
  userDataDir: string,
  linkedRoot: string
): Promise<void> {
  if (normalizePath(resolve(linkedRoot)) === normalizePath(resolve(userDataDir))) return;
  await fs.rm(linkedRoot, { force: true }).catch(() => {});
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

function runRegQuery(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("reg.exe", args, {
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
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `reg.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

function isRegistryMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unable to find|cannot find|not found|찾을 수|지정된.*찾|reg\.exe exited with code 1/i.test(
    message
  );
}

async function registryKeyExistsWithReg(keyPath: string): Promise<boolean> {
  try {
    await runRegQuery(["query", keyPath]);
    return true;
  } catch (err) {
    if (isRegistryMissingError(err)) return false;
    throw err;
  }
}

async function registryValueExistsWithReg(keyPath: string, valueName: string): Promise<boolean> {
  try {
    await runRegQuery(["query", keyPath, "/v", valueName]);
    return true;
  } catch (err) {
    if (isRegistryMissingError(err)) return false;
    throw err;
  }
}

function canonicalRegistryKeyForFile(keyPath: string): string {
  return normalizeRegistryKeyPath(keyPath)
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\");
}

function escapeRegistryString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function hexBytes(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(",");
}

function utf16Hex(value: string, extraNulls = 1): string {
  const buffer = Buffer.from(`${value}${"\0".repeat(extraNulls)}`, "utf16le");
  return hexBytes(Array.from(buffer));
}

function registryValueLine(valueName: string, type: string, data: string): string {
  const name = `"${escapeRegistryString(valueName)}"`;
  switch (type.toUpperCase()) {
    case "REG_DWORD": {
      const hex = data.match(/0x([0-9a-f]+)/i)?.[1];
      const decimal = data.match(/^\d+$/)?.[0];
      const n = hex ? Number.parseInt(hex, 16) : decimal ? Number.parseInt(decimal, 10) : Number.NaN;
      if (!Number.isFinite(n)) throw new Error("시작 항목 레지스트리 값을 백업할 수 없어요.");
      return `${name}=dword:${(n >>> 0).toString(16).padStart(8, "0")}`;
    }
    case "REG_QWORD": {
      const hex = data.match(/0x([0-9a-f]+)/i)?.[1] ?? "";
      if (!hex) throw new Error("시작 항목 레지스트리 값을 백업할 수 없어요.");
      const padded = hex.padStart(16, "0").slice(-16);
      const bytes = padded.match(/../g)?.reverse().join(",") ?? "";
      return `${name}=hex(b):${bytes}`;
    }
    case "REG_BINARY": {
      const compact = data.replace(/[^0-9a-f]/gi, "");
      if (compact.length % 2 !== 0) throw new Error("시작 항목 레지스트리 값을 백업할 수 없어요.");
      return `${name}=hex:${compact.match(/../g)?.join(",") ?? ""}`;
    }
    case "REG_EXPAND_SZ":
      return `${name}=hex(2):${utf16Hex(data)}`;
    case "REG_MULTI_SZ":
      return `${name}=hex(7):${utf16Hex(data.replace(/\\0/g, "\0"), 2)}`;
    case "REG_SZ":
    default:
      return `${name}="${escapeRegistryString(data)}"`;
  }
}

async function exportRegistryValueWithReg(
  keyPath: string,
  valueName: string,
  backupPath: string
): Promise<void> {
  const stdout = await runRegQuery(["query", keyPath, "/v", valueName]);
  const row = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(valueName.toLowerCase()));
  if (!row) throw new Error("시작 항목 레지스트리 값을 찾지 못했어요.");

  const parts = row.split(/\s{2,}/);
  if (parts.length < 3) throw new Error("시작 항목 레지스트리 값을 읽지 못했어요.");
  const [, type, ...dataParts] = parts;
  const data = dataParts.join("  ");
  const content = [
    "Windows Registry Editor Version 5.00",
    "",
    `[${canonicalRegistryKeyForFile(keyPath)}]`,
    registryValueLine(valueName, type, data),
    ""
  ].join("\r\n");
  await fs.mkdir(dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, content, "utf8");
}

async function assertRestorableRegistryBackupFile(
  entryDir: string,
  backupPath: string,
  expectedKeyPath?: string,
  expectedValueName?: string
): Promise<number> {
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) {
    throw new Error(`앱 삭제 흔적 백업 파일이 링크라 정리하지 않았어요: ${linkedBackup}`);
  }

  let stat;
  try {
    stat = await fs.lstat(backupPath);
  } catch {
    throw new Error("앱 삭제 흔적 백업 파일을 만들지 못해 정리하지 않았어요.");
  }

  if (stat.isSymbolicLink()) {
    throw new Error("앱 삭제 흔적 백업 파일이 링크라 정리하지 않았어요.");
  }
  if (!stat.isFile()) {
    throw new Error("앱 삭제 흔적 백업 파일이 파일이 아니라 정리하지 않았어요.");
  }
  if (stat.size <= 0) {
    throw new Error("앱 삭제 흔적 백업 파일이 비어 있어 정리하지 않았어요.");
  }

  const content = await fs.readFile(backupPath, "utf8");
  const head = content.slice(0, 256).trimStart();
  if (!/^Windows Registry Editor Version\s+\d+(?:\.\d+)?/i.test(head) && !/^REGEDIT4\b/i.test(head)) {
    throw new Error("앱 삭제 흔적 백업 파일이 레지스트리 백업 형식이 아니라 정리하지 않았어요.");
  }
  if (registryBackupContainsValueDeleteLine(content)) {
    throw new Error("앱 삭제 흔적 백업 파일에 값 삭제 항목이 있어 되돌리지 않았어요.");
  }
  if (expectedKeyPath && !registryBackupSectionsMatchExpectedKey(content, expectedKeyPath)) {
    throw new Error("앱 삭제 흔적 백업 파일의 레지스트리 위치가 달라 되돌리지 않았어요.");
  }
  if (expectedKeyPath && !registryBackupContainsRestorableValueLine(content, expectedKeyPath)) {
    throw new Error("앱 삭제 흔적 백업 파일에 되돌릴 값이 없어 정리하지 않았어요.");
  }
  if (expectedValueName && !registryBackupContainsOnlyValue(content, expectedKeyPath, expectedValueName)) {
    throw new Error("앱 삭제 흔적 백업 파일의 시작 항목 값이 달라 되돌리지 않았어요.");
  }

  return Math.max(0, stat.size);
}

function registryBackupSectionsMatchExpectedKey(content: string, expectedKeyPath: string): boolean {
  const expected = canonicalRegistryKeyForComparison(expectedKeyPath);
  let foundSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("[")) continue;
    const match = /^\[(-?)([^\]]+)\]$/.exec(line);
    if (!match) return false;
    if (match[1] === "-") return false;
    const sectionKey = canonicalRegistryKeyForComparison(match[2]);
    if (sectionKey !== expected && !sectionKey.startsWith(`${expected}\\`)) {
      return false;
    }
    foundSection = true;
  }
  return foundSection;
}

function registryBackupContainsValueDeleteLine(content: string): boolean {
  return content.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.trim();
    return /^@\s*=\s*-$/.test(line) || /^"((?:\\"|[^"])*)"\s*=\s*-$/.test(line);
  });
}

function registryBackupLineSection(line: string): string | null | undefined {
  if (!line.startsWith("[")) return undefined;
  const match = /^\[(-?)([^\]]+)\]$/.exec(line);
  if (!match || match[1] === "-") return null;
  return canonicalRegistryKeyForComparison(match[2]);
}

function registryBackupSectionMatches(currentSection: string | null, expectedKeyPath: string): boolean {
  const expected = canonicalRegistryKeyForComparison(expectedKeyPath);
  return Boolean(currentSection && (currentSection === expected || currentSection.startsWith(`${expected}\\`)));
}

function registryBackupContainsRestorableValueLine(content: string, expectedKeyPath: string): boolean {
  let currentSection: string | null = null;
  return content.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.trim();
    const section = registryBackupLineSection(line);
    if (section !== undefined) {
      currentSection = section;
      return false;
    }
    const isValueLine = /^@\s*=/.test(line) || /^"((?:\\"|[^"])*)"\s*=/.test(line);
    return isValueLine && registryBackupSectionMatches(currentSection, expectedKeyPath);
  });
}

function registryBackupContainsOnlyValue(
  content: string,
  expectedKeyPath: string | undefined,
  expectedValueName: string
): boolean {
  const escaped = expectedValueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let found = false;
  let currentSection: string | null = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^Windows Registry Editor Version/i.test(line) || /^REGEDIT4\b/i.test(line)) {
      continue;
    }
    const section = registryBackupLineSection(line);
    if (section !== undefined) {
      currentSection = section;
      continue;
    }
    const match = /^"((?:\\"|[^"])*)"=/.exec(line);
    if (!match) return false;
    if (expectedKeyPath && !registryBackupSectionMatches(currentSection, expectedKeyPath)) {
      return false;
    }
    if (!new RegExp(`^${escaped}$`, "i").test(match[1].replace(/\\"/g, '"'))) {
      return false;
    }
    found = true;
  }
  return found;
}

async function writeRegistryBackupMetaFile(
  entryDir: string,
  metaPath: string,
  payload: unknown
): Promise<void> {
  const linkedMetaBefore = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaBefore) {
    throw new Error(`앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaBefore}`);
  }

  await fs.writeFile(metaPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    flag: "wx"
  });

  const linkedMetaAfter = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaAfter) {
    throw new Error(`앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaAfter}`);
  }

  const stat = await fs.lstat(metaPath);
  if (stat.isSymbolicLink()) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요.");
  }
  if (!stat.isFile()) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 파일이 아니라 정리하지 않았어요.");
  }
  if (stat.size <= 0) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 비어 있어 정리하지 않았어요.");
  }
}

export function defaultRegistryCleanupRunner(): RegistryCleanupRunner {
  return {
    exportKey: (keyPath, backupPath) => runRegCommand(["export", keyPath, backupPath, "/y"]),
    deleteKey: (keyPath) => runRegCommand(["delete", keyPath, "/f"]),
    keyExists: (keyPath) => registryKeyExistsWithReg(keyPath),
    exportValue: (keyPath, valueName, backupPath) =>
      exportRegistryValueWithReg(keyPath, valueName, backupPath),
    deleteValue: (keyPath, valueName) => runRegCommand(["delete", keyPath, "/v", valueName, "/f"]),
    valueExists: (keyPath, valueName) => registryValueExistsWithReg(keyPath, valueName),
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
  if (!isSafeUninstallRegistryKeyPath(options.keyPath)) {
    throw new Error("지원하는 앱 제거 레지스트리 위치가 아니라 자동 정리하지 않아요.");
  }
  const keyPath = normalizeRegistryKeyPath(options.keyPath);

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
  let sizeBytes = 0;
  let contentHash: NonNullable<RegistryBackupEntry["contentHash"]> | null = null;

  try {
    await runner.exportKey(keyPath, backupPath);
    sizeBytes = await assertRestorableRegistryBackupFile(entryDir, backupPath, keyPath);
    contentHash = { algorithm: "sha256", value: await hashFile(backupPath) };
    await writeRegistryBackupMetaFile(
      entryDir,
      metaPath,
      {
        id,
        keyPath,
        backupPath,
        sizeBytes,
        contentHash,
        appName,
        appPublisher,
        createdAt,
        expiresAt
      }
    );
    await runner.deleteKey(keyPath);
    if (runner.keyExists && (await runner.keyExists(keyPath))) {
      throw new Error("Registry key still exists after deletion");
    }
    return await assertRegistryBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function backupAndDeleteRegistryValue(options: {
  userDataDir: string;
  keyPath: string;
  valueName: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<RegistryBackupEntry> {
  if (!isSafeStartupRegistryValuePath(options.keyPath, options.valueName)) {
    throw new Error("지원하는 시작 항목 레지스트리 위치가 아니라 자동 정리하지 않아요.");
  }
  const keyPath = normalizeRegistryKeyPath(options.keyPath);
  const valueName = options.valueName;

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = registryBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = join(registryBackupItemsRoot(options.userDataDir), id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Registry value backup" });

  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");
  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const exportValue = runner.exportValue ?? defaultRegistryCleanupRunner().exportValue;
  const deleteValue = runner.deleteValue ?? defaultRegistryCleanupRunner().deleteValue;
  const appName = cleanOptionalString(options.app?.name);
  const appPublisher = cleanOptionalString(options.app?.publisher);
  let sizeBytes = 0;
  let contentHash: NonNullable<RegistryBackupEntry["contentHash"]> | null = null;

  if (!exportValue || !deleteValue) {
    throw new Error("시작 항목 레지스트리 값을 백업할 준비가 되지 않았어요.");
  }

  try {
    await exportValue(keyPath, valueName, backupPath);
    sizeBytes = await assertRestorableRegistryBackupFile(
      entryDir,
      backupPath,
      keyPath,
      valueName
    );
    contentHash = { algorithm: "sha256", value: await hashFile(backupPath) };
    await writeRegistryBackupMetaFile(
      entryDir,
      metaPath,
      {
        id,
        keyPath,
        valueName,
        backupKind: "startup-value",
        backupPath,
        sizeBytes,
        contentHash,
        appName,
        appPublisher,
        createdAt,
        expiresAt
      }
    );
    await deleteValue(keyPath, valueName);
    if (runner.valueExists && (await runner.valueExists(keyPath, valueName))) {
      throw new Error("Registry value still exists after deletion");
    }
    return await assertRegistryBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
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

async function assertRegistryBackupEntryStillRestorable(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupEntry> {
  const result = await readRegistryBackupEntryForRestore(userDataDir, backupId);
  if (result.kind === "entry") return result.entry;
  throw new Error(result.result.message);
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
  const backupKind = raw.backupKind === "startup-value" ? "startup-value" : "key";
  const valueName = cleanOptionalString(raw.valueName);
  const rawKeyPath = typeof raw.keyPath === "string" ? raw.keyPath : "";
  const safeLocation =
    rawKeyPath.length > 0 &&
    (backupKind === "startup-value" && valueName
      ? isSafeStartupRegistryValuePath(rawKeyPath, valueName)
      : isSafeUninstallRegistryKeyPath(rawKeyPath));
  if (!safeLocation) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "지원하는 앱 삭제 흔적 레지스트리 위치가 아니라 되돌리지 않았어요."
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
    keyPath: normalizeRegistryKeyPath(rawKeyPath),
    backupPath,
    sizeBytes: 0,
    contentHash: isValidRegistryBackupContentHash(raw.contentHash) ? raw.contentHash : null,
    createdAt: raw.createdAt,
    expiresAt: canonicalRegistryBackupExpiry(raw.createdAt)
  };
  if (backupKind === "startup-value") {
    entry.backupKind = "startup-value";
    entry.valueName = valueName ?? null;
  }
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
    try {
      entry.sizeBytes = await assertRestorableRegistryBackupFile(
        entryDir,
        backupPath,
        entry.keyPath,
        entry.backupKind === "startup-value" ? entry.valueName ?? undefined : undefined
      );
    } catch (err) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: (err as Error).message,
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    if (entry.contentHash) {
      const actualHash = await hashFile(backupPath);
      if (actualHash !== entry.contentHash.value) {
        return {
          kind: "restore-result",
          result: {
            backupId,
            status: "blocked-path",
            message: "앱 삭제 흔적 백업 파일이 바뀐 것 같아요. 안전하게 되돌리지 않았어요.",
            keyPath: entry.keyPath,
            entry
          }
        };
      }
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

async function pruneNonRestorableRegistryBackupItems(userDataDir: string): Promise<void> {
  const root = registryBackupItemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) {
    await removeLinkedRegistryBackupRootIfManaged(userDataDir, linkedRoot);
    return;
  }

  let dirs;
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      await removeRegistryBackupStoreItem(root, dir.name);
      continue;
    }

    const result = await readRegistryBackupEntryForRestore(userDataDir, dir.name);
    if (result.kind === "restore-result") {
      await removeRegistryBackupStoreItem(root, dir.name);
    }
  }
}

async function measureRegistryBackupPurgeBytes(entryDir: string): Promise<number> {
  const backupPath = join(entryDir, "backup.reg");
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) return 0;

  try {
    const stat = await fs.lstat(backupPath);
    if (stat.isSymbolicLink() || !stat.isFile()) return 0;
    return Math.max(0, stat.size);
  } catch {
    return 0;
  }
}

export async function listRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<RegistryBackupSnapshot> {
  await purgeExpiredRegistryBackups(options);
  await pruneNonRestorableRegistryBackupItems(options.userDataDir);

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
  pruneNonRestorable?: boolean;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
}): Promise<RegistryBackupPurgeResult> {
  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    await removeLinkedRegistryBackupRootIfManaged(options.userDataDir, linkedRoot);
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
    };
  }

  if (options.pruneNonRestorable) {
    await pruneNonRestorableRegistryBackupItems(options.userDataDir);
  }

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
    };
  }

  const now = options.now?.() ?? new Date();
  const purgedIds: string[] = [];
  const failedIds: string[] = [];
  let purgedBytes = 0;
  const removeEntryDir =
    options.removeEntryDir ??
    ((dir: string) => fs.rm(dir, { recursive: true, force: true }));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryDir = join(root, entry.name);
    try {
      const metaPath = join(entryDir, "meta.json");
      const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
      if (linkedMeta) {
        if (await removeRegistryBackupStoreItem(root, entry.name)) {
          purgedIds.push(entry.name);
        }
        continue;
      }
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as {
        createdAt?: unknown;
        expiresAt?: unknown;
      };
      if (typeof meta.expiresAt !== "string") continue;
      const effectiveExpiresAt =
        typeof meta.createdAt === "string" && isValidIso(meta.createdAt)
          ? canonicalRegistryBackupExpiry(meta.createdAt)
          : meta.expiresAt;
      if (
        !isOutsideRegistryBackupRestorableWindow(
          {
            createdAt:
              typeof meta.createdAt === "string" && isValidIso(meta.createdAt)
                ? meta.createdAt
                : now.toISOString(),
            expiresAt: effectiveExpiresAt
          },
          now
        )
      ) {
        continue;
      }
      const entryBytes = await measureRegistryBackupPurgeBytes(entryDir);
      await removeEntryDir(entryDir, entry.name);
      if (await pathExists(entryDir)) {
        throw new Error("Expired registry backup still exists after purge");
      }
      purgedBytes += entryBytes;
      purgedIds.push(entry.name);
    } catch {
      failedIds.push(entry.name);
      continue;
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedBytes,
    purgedIds,
    ...(failedIds.length > 0 ? { failedIds } : {}),
    retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
  };
}

export async function restoreRegistryBackup(options: {
  userDataDir: string;
  backupId: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  beforeImport?: () => Promise<void>;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
  onAppRegistryBackupRestored?: (app: RegistryBackupRestoredApp) => void | Promise<void>;
}): Promise<RegistryBackupRestoreResult> {
  if (!isSafeRegistryBackupId(options.backupId)) {
    return {
      backupId: typeof options.backupId === "string" ? options.backupId : "",
      status: "blocked-path",
      message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
    };
  }

  await purgeExpiredRegistryBackups({
    userDataDir: options.userDataDir,
    now: options.now,
    removeEntryDir: options.removeEntryDir
  });

  const readResult = await readRegistryBackupEntryForRestore(options.userDataDir, options.backupId);
  if (readResult.kind === "restore-result") return readResult.result;
  const { entry } = readResult;
  const now = options.now?.() ?? new Date();
  if (isOutsideRegistryBackupRestorableWindow(entry, now)) {
    return {
      backupId: entry.id,
      status: "expired",
      message: "30일 보관 기간이 지나서 되돌릴 수 없어요. 자동 비움이 아직 끝나지 않았다면 다음 확인 때 다시 비울게요.",
      keyPath: entry.keyPath,
      entry
    };
  }

  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const importFile = runner.importFile;
  if (!importFile) {
    const label = registryBackupKindLabel(entry);
    return {
      backupId: options.backupId,
      status: "restore-failed",
      message: `${label}을 되돌릴 준비가 되지 않았어요.`,
      keyPath: entry.keyPath,
      entry
    };
  }

  try {
    await options.beforeImport?.().catch(() => {});
    await importFile(entry.backupPath);
    await assertRegistryBackupRestored(entry, runner);
    const restoredEntryDir = join(registryBackupItemsRoot(options.userDataDir), entry.id);
    const removeEntryDir =
      options.removeEntryDir ??
      ((dir: string) => fs.rm(dir, { recursive: true, force: true }));
    await removeEntryDir(restoredEntryDir, entry.id);
    if (await pathExists(restoredEntryDir)) {
      throw new Error("Registry backup restore entry still exists after restore");
    }
    const appName = cleanOptionalString(entry.appName);
    if (appName) {
      const backupKind = entry.backupKind === "startup-value" ? "startup-value" : "key";
      const restoredApp: RegistryBackupRestoredApp =
        backupKind === "startup-value"
          ? {
              name: appName,
              publisher: entry.appPublisher ?? null,
              backupKind,
              ...(entry.valueName ? { valueName: entry.valueName } : {})
            }
          : {
              name: appName,
              publisher: entry.appPublisher ?? null,
              backupKind,
              registryKeyPath: entry.keyPath
            };
      await Promise.resolve(
        options.onAppRegistryBackupRestored?.(restoredApp)
      ).catch(() => {});
    }
    const label = registryBackupKindLabel(entry);
    return {
      backupId: entry.id,
      status: "restored",
      message: `${label}을 되돌렸어요.`,
      keyPath: entry.keyPath,
      entry
    };
  } catch (err) {
    const label = registryBackupKindLabel(entry);
    return {
      backupId: entry.id,
      status: "restore-failed",
      message: `${label} 되돌리기 중 문제가 생겼어요: ${(err as Error).message}`,
      keyPath: entry.keyPath,
      entry
    };
  }
}

async function assertRegistryBackupRestored(
  entry: RegistryBackupEntry,
  runner: RegistryCleanupRunner
): Promise<void> {
  const label = registryBackupKindLabel(entry);
  if (entry.backupKind === "startup-value") {
    if (!entry.valueName || !runner.valueExists) return;
    if (!(await runner.valueExists(entry.keyPath, entry.valueName))) {
      throw new Error(`${label}이 아직 되살아나지 않았어요.`);
    }
    return;
  }

  if (!runner.keyExists) return;
  if (!(await runner.keyExists(entry.keyPath))) {
    throw new Error(`${label}이 아직 되살아나지 않았어요.`);
  }
}

export const __testing = {
  normalizeRegistryKeyPath,
  registryBackupExpiry,
  registryBackupItemsRoot
};
