/**
 * Safe startup-folder toggle.
 *
 * We only support files that Windows loads from the Startup folders.
 * Registry Run keys, services, and scheduled tasks stay read-only until
 * they have separate rules, because disabling the wrong one can break
 * login, networking, or security software.
 */
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  StartupAutoDisabledEntry,
  StartupAutoDisabledSnapshot,
  StartupAutoEntry,
  StartupDisabledPurgeResult,
  StartupFolderToggleResult
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import { normalizePath } from "../cleanup/blocklist";
import { findLinkedDescendant, findLinkedPathPart } from "../cleanup/pathSafety";

export const STARTUP_DISABLED_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS;
const STARTUP_DISABLED_DIR = "formatbuddy-startup-disabled";
const ITEMS_DIR = "items";
const META_FILE = "meta.json";

export interface StartupFolderToggleRuntime {
  userDataDir: string;
  now?: () => Date;
}

export interface DisableStartupFolderEntryOptions extends StartupFolderToggleRuntime {
  entry: StartupAutoEntry;
}

export interface RestoreStartupFolderEntryOptions extends StartupFolderToggleRuntime {
  disabledId: string;
  removeEntryDir?: (dir: string, entry: StartupAutoDisabledEntry) => Promise<void>;
}

function disabledRoot(userDataDir: string): string {
  return join(userDataDir, STARTUP_DISABLED_DIR);
}

function itemsRoot(userDataDir: string): string {
  return join(disabledRoot(userDataDir), ITEMS_DIR);
}

function entryDir(userDataDir: string, disabledId: string): string {
  return join(itemsRoot(userDataDir), disabledId);
}

function filesRoot(userDataDir: string, disabledId: string): string {
  return join(entryDir(userDataDir, disabledId), "files");
}

function metaPath(userDataDir: string, disabledId: string): string {
  return join(entryDir(userDataDir, disabledId), META_FILE);
}

function storedPathFor(userDataDir: string, disabledId: string, originalPath: string): string {
  return join(filesRoot(userDataDir, disabledId), basename(originalPath) || "startup-item");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStrictMetadataString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function cleanDisplayMetadataString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 1024);
}

function friendlyStartupToggleDetail(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/access|denied|eacces|eperm|permission/i.test(message)) {
    return "startup-toggle-permission-denied";
  }
  if (/enoent|no such file|not found|missing/i.test(message)) {
    return "startup-toggle-file-missing";
  }
  if (/symlink|symbolic|link|outside|unsafe|safe path|blocked|traversal/i.test(message)) {
    return "startup-toggle-blocked-path";
  }
  if (/metadata|still exists|was not created|after restore|after disable/i.test(message)) {
    return "startup-toggle-verification-failed";
  }
  return fallback;
}

export function isSafeStartupDisabledId(disabledId: unknown): disabledId is string {
  return (
    typeof disabledId === "string" &&
    disabledId.length > 0 &&
    disabledId.trim() === disabledId &&
    disabledId !== "." &&
    disabledId !== ".." &&
    !/\s/.test(disabledId) &&
    !disabledId.includes("/") &&
    !disabledId.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(disabledId)
  );
}

function makeDisabledId(entry: StartupAutoEntry, now: Date): string {
  return createHash("sha1")
    .update(`${entry.id}|${now.toISOString()}`)
    .digest("hex")
    .slice(0, 24);
}

function isUnderRoot(childPath: string, rootPath: string): boolean {
  const child = normalizePath(resolve(childPath));
  const root = normalizePath(resolve(rootPath));
  const childPrefix = root.endsWith("\\") ? root : `${root}\\`;
  return child === root || child.startsWith(childPrefix);
}

function isStrictlyUnderRoot(childPath: string, rootPath: string): boolean {
  const child = normalizePath(resolve(childPath));
  const root = normalizePath(resolve(rootPath));
  const childPrefix = root.endsWith("\\") ? root : `${root}\\`;
  return child.startsWith(childPrefix);
}

export function isManagedStartupStoredPath(
  userDataDir: string,
  disabledId: string,
  candidatePath: string
): boolean {
  if (!isSafeStartupDisabledId(disabledId)) return false;
  const candidate = normalizePath(resolve(candidatePath));
  const root = normalizePath(resolve(filesRoot(userDataDir, disabledId)));
  return candidate.startsWith(`${root}\\`);
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function disabledExpiry(disabledAt: Date): string {
  const expiresAt = new Date(disabledAt.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + STARTUP_DISABLED_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function canonicalDisabledExpiry(disabledAt: string): string {
  return disabledExpiry(new Date(disabledAt));
}

function isOutsideDisabledRetentionWindow(
  entry: Pick<StartupAutoDisabledEntry, "disabledAt" | "expiresAt">,
  now: Date
): boolean {
  const disabledAt = Date.parse(entry.disabledAt);
  if (Number.isFinite(disabledAt) && disabledAt > now.getTime()) return true;

  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function coerceDisabledEntry(value: unknown): StartupAutoDisabledEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<StartupAutoDisabledEntry>;
  if (!isNonEmptyString(raw.id) || !isSafeStartupDisabledId(raw.id)) return null;
  if (!isStrictMetadataString(raw.entryId)) return null;
  const name = cleanDisplayMetadataString(raw.name);
  if (!name) return null;
  if (!isStrictMetadataString(raw.originalPath)) return null;
  if (!isStrictMetadataString(raw.storedPath)) return null;
  if (!isStrictMetadataString(raw.origin)) return null;
  if (!validIso(raw.disabledAt)) return null;
  return {
    id: raw.id,
    entryId: raw.entryId,
    name,
    originalPath: raw.originalPath,
    storedPath: raw.storedPath,
    origin: raw.origin,
    disabledAt: raw.disabledAt,
    expiresAt: canonicalDisabledExpiry(raw.disabledAt),
    contentHash: isValidContentHash(raw.contentHash) ? raw.contentHash : null,
    integrityStatus: isValidContentHash(raw.contentHash) ? "verified" : "legacy"
  };
}

function isValidContentHash(
  value: unknown
): value is NonNullable<StartupAutoDisabledEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<StartupAutoDisabledEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hashHeldStartupFile(targetPath: string): Promise<string> {
  const stat = await lstat(targetPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Startup holding file is not a regular file");
  }
  return createHash("sha256").update(await readFile(targetPath)).digest("hex");
}

async function startupHoldingIntegrityStatus(
  entry: StartupAutoDisabledEntry
): Promise<NonNullable<StartupAutoDisabledEntry["integrityStatus"]>> {
  if (!entry.contentHash) return "legacy";
  const actualHash = await hashHeldStartupFile(entry.storedPath).catch(() => null);
  return actualHash === entry.contentHash.value ? "verified" : "changed";
}

async function ensureManagedItemsRoot(userDataDir: string): Promise<void> {
  const linkedRoot = await findLinkedPathPart(itemsRoot(userDataDir), userDataDir, true);
  if (linkedRoot) {
    throw new Error(`FormatBuddy startup holding area is a link: ${linkedRoot}`);
  }
  await mkdir(itemsRoot(userDataDir), { recursive: true });
}

async function ensureSafeEntryWritePath(userDataDir: string, disabledId: string): Promise<void> {
  const dir = entryDir(userDataDir, disabledId);
  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`FormatBuddy startup holding entry is a link: ${linkedDir}`);
  }
}

async function ensureSafeMetaWritePath(userDataDir: string, disabledId: string): Promise<void> {
  const dir = entryDir(userDataDir, disabledId);
  const linkedMeta = await findLinkedPathPart(metaPath(userDataDir, disabledId), dir, true);
  if (linkedMeta) {
    throw new Error(`FormatBuddy startup holding metadata is a link: ${linkedMeta}`);
  }
}

async function safeMove(source: string, target: string): Promise<void> {
  try {
    await rename(source, target);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
    await cp(source, target, { recursive: true, force: false, errorOnExist: true });
    await rm(source, { recursive: true, force: false });
  }
}

async function readDisabledEntry(userDataDir: string, disabledId: string): Promise<StartupAutoDisabledEntry | null> {
  if (!isSafeStartupDisabledId(disabledId)) return null;
  const linkedMeta = await findLinkedPathPart(metaPath(userDataDir, disabledId), entryDir(userDataDir, disabledId), true);
  if (linkedMeta) return null;
  try {
    const raw = await readFile(metaPath(userDataDir, disabledId), "utf8");
    return coerceDisabledEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function isListableDisabledEntry(
  userDataDir: string,
  disabledId: string,
  entry: StartupAutoDisabledEntry
): Promise<boolean> {
  const dir = entryDir(userDataDir, disabledId);
  if (entry.id !== disabledId) return false;
  if (!isManagedStartupStoredPath(userDataDir, disabledId, entry.storedPath)) return false;
  if (!isUnderRoot(entry.originalPath, entry.origin)) return false;
  if (await findLinkedPathPart(entry.storedPath, dir, true)) return false;
  return pathExists(entry.storedPath);
}

async function withStartupHoldingIntegrity(
  entry: StartupAutoDisabledEntry
): Promise<StartupAutoDisabledEntry> {
  return {
    ...entry,
    integrityStatus: await startupHoldingIntegrityStatus(entry)
  };
}

async function assertSafeStartupDisabledEntryForPurge(
  userDataDir: string,
  disabledId: string,
  entry: StartupAutoDisabledEntry
): Promise<string> {
  if (!isSafeStartupDisabledId(disabledId) || entry.id !== disabledId) {
    throw new Error("FormatBuddy startup holding purge id is not safe");
  }

  const root = normalizePath(resolve(itemsRoot(userDataDir)));
  const dir = entryDir(userDataDir, disabledId);
  const normalizedDir = normalizePath(resolve(dir));
  if (!normalizedDir.startsWith(`${root}\\`)) {
    throw new Error("FormatBuddy startup holding purge folder is outside the holding area");
  }
  if (!isManagedStartupStoredPath(userDataDir, disabledId, entry.storedPath)) {
    throw new Error("FormatBuddy startup holding stored path is outside the holding entry");
  }
  if (!isUnderRoot(entry.originalPath, entry.origin)) {
    throw new Error("FormatBuddy startup holding original path is outside the startup folder");
  }

  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`FormatBuddy startup holding purge entry is a link: ${linkedDir}`);
  }
  const stat = await lstat(dir);
  if (!stat.isDirectory()) {
    throw new Error("FormatBuddy startup holding purge entry is not a folder");
  }

  return dir;
}

async function removeManagedStartupDisabledItem(
  userDataDir: string,
  disabledId: string
): Promise<boolean> {
  if (!isSafeStartupDisabledId(disabledId)) return false;

  const root = itemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) return false;

  const dir = entryDir(userDataDir, disabledId);
  const normalizedRoot = normalizePath(resolve(root));
  const normalizedDir = normalizePath(resolve(dir));
  if (!normalizedDir.startsWith(`${normalizedRoot}\\`)) return false;

  await rm(dir, { recursive: true, force: true }).catch(() => {});
  return !(await pathExists(dir));
}

async function removeLinkedStartupDisabledRootIfManaged(
  userDataDir: string,
  linkedRoot: string
): Promise<void> {
  if (normalizePath(resolve(linkedRoot)) === normalizePath(resolve(userDataDir))) return;
  await rm(linkedRoot, { force: true }).catch(() => {});
}

async function pruneNonRestorableStartupDisabledItems(userDataDir: string): Promise<void> {
  const root = itemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) {
    await removeLinkedStartupDisabledRootIfManaged(userDataDir, linkedRoot);
    return;
  }

  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of dirs) {
    if (!isSafeStartupDisabledId(dirent.name)) continue;
    if (!dirent.isDirectory()) {
      await removeManagedStartupDisabledItem(userDataDir, dirent.name);
      continue;
    }

    const entry = await readDisabledEntry(userDataDir, dirent.name);
    if (!entry || entry.id !== dirent.name) continue;
    if (!isManagedStartupStoredPath(userDataDir, dirent.name, entry.storedPath)) continue;

    const linkedStored = await findLinkedPathPart(
      entry.storedPath,
      entryDir(userDataDir, dirent.name),
      true
    );
    if (linkedStored || !(await pathExists(entry.storedPath))) {
      await removeManagedStartupDisabledItem(userDataDir, dirent.name);
    }
  }
}

export async function listDisabledStartupFolderEntries(
  options: StartupFolderToggleRuntime
): Promise<StartupAutoDisabledSnapshot> {
  const now = options.now?.() ?? new Date();
  await purgeExpiredStartupFolderEntries({
    ...options,
    now: () => now
  }).catch(() => {});
  const root = itemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    await removeLinkedStartupDisabledRootIfManaged(options.userDataDir, linkedRoot);
    return {
      capturedAt: now.toISOString(),
      entries: [],
      notes: ["시작 항목 보관함 경로가 안전하지 않아 목록을 비웠어요."]
    };
  }

  await pruneNonRestorableStartupDisabledItems(options.userDataDir).catch(() => {});

  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return { capturedAt: now.toISOString(), entries: [], notes: [] };
  }

  const entries: StartupAutoDisabledEntry[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const entry = await readDisabledEntry(options.userDataDir, dir.name);
    if (
      entry &&
      !isOutsideDisabledRetentionWindow(entry, now) &&
      (await isListableDisabledEntry(options.userDataDir, dir.name, entry))
    ) {
      entries.push(await withStartupHoldingIntegrity(entry));
    }
  }
  entries.sort((a, b) => Date.parse(b.disabledAt) - Date.parse(a.disabledAt));
  return { capturedAt: now.toISOString(), entries, notes: [] };
}

export async function disableStartupFolderEntry(
  options: DisableStartupFolderEntryOptions
): Promise<StartupFolderToggleResult> {
  const { entry, userDataDir } = options;
  if (entry.kind !== "startup-folder") {
    return {
      status: "unsupported-kind",
      message: "이 항목은 아직 앱에서 끌 수 없어요. 시작 프로그램 폴더 항목부터 안전하게 지원해요."
    };
  }
  if (
    !isStrictMetadataString(entry.id) ||
    !isStrictMetadataString(entry.path) ||
    !isStrictMetadataString(entry.origin)
  ) {
    return {
      status: "blocked-path",
      message: "시작 항목 정보가 안전하지 않아 건드리지 않았어요."
    };
  }
  const name = cleanDisplayMetadataString(entry.name);
  if (!name) {
    return {
      status: "blocked-path",
      message: "시작 항목 정보가 안전하지 않아 건드리지 않았어요."
    };
  }

  const source = resolve(entry.path);
  const origin = resolve(entry.origin);
  if (!isUnderRoot(source, origin)) {
    return {
      status: "blocked-path",
      message: "시작 프로그램 폴더 밖의 파일이라 건드리지 않았어요."
    };
  }

  const linkedSource = await findLinkedPathPart(source, origin, true);
  if (linkedSource) {
    return {
      status: "blocked-path",
      message: "연결된 경로가 섞여 있어서 건드리지 않았어요.",
      detail: "startup-toggle-blocked-path"
    };
  }

  let sourceStat;
  try {
    sourceStat = await lstat(source);
  } catch {
    return {
      status: "not-found",
      message: "이미 사라진 시작 항목이라 끌 수 없어요."
    };
  }
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    return {
      status: "blocked-path",
      message: "일반 시작 파일이 아니라 건드리지 않았어요."
    };
  }

  const disabledAt = (options.now?.() ?? new Date()).toISOString();
  const disabledAtDate = new Date(disabledAt);
  const disabledId = makeDisabledId(entry, disabledAtDate);
  const storedPath = storedPathFor(userDataDir, disabledId, source);
  let disabledEntry: StartupAutoDisabledEntry = {
    id: disabledId,
    entryId: entry.id,
    name,
    originalPath: source,
    storedPath,
    origin,
    disabledAt,
    expiresAt: disabledExpiry(disabledAtDate)
  };

  let movedToHoldingArea = false;
  try {
    await ensureManagedItemsRoot(userDataDir);
    await ensureSafeEntryWritePath(userDataDir, disabledId);
    await mkdir(dirname(storedPath), { recursive: true });
    const linkedStored = await findLinkedPathPart(storedPath, entryDir(userDataDir, disabledId), true);
    if (linkedStored) {
      return {
        status: "blocked-path",
        message: "보관 위치가 안전하지 않아 건드리지 않았어요.",
        detail: "startup-toggle-blocked-path"
      };
    }
    if (await pathExists(storedPath)) {
      return {
        status: "target-exists",
        message: "보관 위치에 같은 항목이 이미 있어요. 먼저 보관함을 확인해주세요."
      };
    }
    await safeMove(source, storedPath);
    movedToHoldingArea = true;
    disabledEntry = {
      ...disabledEntry,
      contentHash: {
        algorithm: "sha256",
        value: await hashHeldStartupFile(storedPath)
      },
      integrityStatus: "verified"
    };
    await ensureSafeMetaWritePath(userDataDir, disabledId);
    await writeFile(metaPath(userDataDir, disabledId), JSON.stringify(disabledEntry, null, 2), "utf8");
    await ensureSafeMetaWritePath(userDataDir, disabledId);
    const readableEntry = await readDisabledEntry(userDataDir, disabledId);
    if (!readableEntry || readableEntry.id !== disabledId) {
      throw new Error("Startup holding metadata was not created");
    }
    if (await pathExists(source)) {
      throw new Error("Startup source still exists after disable");
    }
    if (!(await pathExists(storedPath))) {
      throw new Error("Startup holding file was not created");
    }
    return {
      status: "disabled",
      message: "이제 PC 켤 때 자동으로 같이 뜨지 않게 보관했어요. 30일 안에는 다시 되돌릴 수 있어요.",
      entry: disabledEntry
    };
  } catch (err) {
    if (movedToHoldingArea && (await pathExists(storedPath)) && !(await pathExists(source))) {
      await mkdir(dirname(source), { recursive: true }).catch(() => {});
      await safeMove(storedPath, source).catch(() => {});
      await rm(entryDir(userDataDir, disabledId), { recursive: true, force: true }).catch(() => {});
    }
    return {
      status: "failed",
      message: "시작 항목을 끄는 중 문제가 생겼어요. 파일은 그대로 두려고 멈췄어요.",
      detail: friendlyStartupToggleDetail(err, "startup-toggle-disable-failed")
    };
  }
}

export async function restoreStartupFolderEntry(
  options: RestoreStartupFolderEntryOptions
): Promise<StartupFolderToggleResult> {
  const { userDataDir, disabledId } = options;
  if (!isSafeStartupDisabledId(disabledId)) {
    return {
      status: "not-found",
      message: "되돌릴 항목을 찾지 못했어요."
    };
  }

  const entry = await readDisabledEntry(userDataDir, disabledId);
  if (!entry) {
    return {
      status: "not-found",
      message: "되돌릴 항목을 찾지 못했어요."
    };
  }

  const dir = entryDir(userDataDir, disabledId);
  if (isOutsideDisabledRetentionWindow(entry, options.now?.() ?? new Date())) {
    let safeDir: string;
    try {
      safeDir = await assertSafeStartupDisabledEntryForPurge(userDataDir, disabledId, entry);
    } catch {
      return {
        status: "blocked-path",
        message: "보관 기록의 경로가 안전하지 않아 자동으로 비우지 않았어요.",
        detail: "startup-toggle-blocked-path",
        entry
      };
    }
    const removeEntryDir =
      options.removeEntryDir ??
      ((targetDir: string) => rm(targetDir, { recursive: true, force: true }));
    try {
      await removeEntryDir(safeDir, entry);
      if (await pathExists(safeDir)) throw new Error("Expired startup holding entry still exists");
    } catch (err) {
      return {
        status: "failed",
        message: "30일 보관 기간이 지났지만 보관함을 비우는 중 문제가 생겼어요.",
        detail: friendlyStartupToggleDetail(err, "startup-toggle-purge-failed"),
        entry
      };
    }
    return {
      status: "expired",
      message: "30일 보관 기간이 지나서 되돌릴 수 없어요. 보관함에서도 비웠어요.",
      entry
    };
  }

  if (
    !isManagedStartupStoredPath(userDataDir, disabledId, entry.storedPath) ||
    !isStrictlyUnderRoot(entry.originalPath, entry.origin)
  ) {
    return {
      status: "blocked-path",
      message: "보관 기록의 경로가 안전하지 않아 되돌리지 않았어요.",
      detail: "startup-toggle-blocked-path",
      entry
    };
  }
  const linkedStored = await findLinkedPathPart(entry.storedPath, dir, true);
  if (linkedStored) {
    return {
      status: "blocked-path",
      message: "보관된 위치가 안전하지 않아 되돌리지 않았어요.",
      detail: "startup-toggle-blocked-path",
      entry
    };
  }
  if (!(await pathExists(entry.storedPath))) {
    return {
      status: "missing-stored-item",
      message: "보관된 파일을 찾지 못했어요.",
      entry
    };
  }
  const integrityStatus = await startupHoldingIntegrityStatus(entry);
  if (integrityStatus !== "verified") {
    return {
      status: "blocked-path",
      message:
        integrityStatus === "legacy"
          ? "보관 기록을 확인할 수 없어 자동으로 되돌리지 않았어요."
          : "보관된 시작 항목 파일이 바뀐 것 같아요. 안전하게 되돌리지 않았어요.",
      entry: {
        ...entry,
        integrityStatus
      }
    };
  }
  if (await pathExists(entry.originalPath)) {
    return {
      status: "target-exists",
      message: "원래 위치에 같은 이름이 이미 있어요. 덮어쓰지 않았어요.",
      entry
    };
  }

  const linkedParent = await findLinkedPathPart(dirname(entry.originalPath), entry.origin, true);
  if (linkedParent) {
    return {
      status: "blocked-path",
      message: "원래 위치에 연결된 경로가 있어 되돌리지 않았어요.",
      detail: "startup-toggle-blocked-path",
      entry
    };
  }

  try {
    await mkdir(dirname(entry.originalPath), { recursive: true });
    await safeMove(entry.storedPath, entry.originalPath);
    if (!(await pathExists(entry.originalPath))) {
      throw new Error("Restored startup item was not created");
    }
    if (await pathExists(entry.storedPath)) {
      throw new Error("Stored startup item still exists after restore");
    }
    const removeEntryDir =
      options.removeEntryDir ??
      ((targetDir: string) => rm(targetDir, { recursive: true, force: true }));
    await removeEntryDir(dir, entry);
    if (await pathExists(dir)) {
      throw new Error("Startup holding entry still exists after restore");
    }
    return {
      status: "restored",
      message: "다시 PC 켤 때 같이 뜨도록 되돌렸어요.",
      entry
    };
  } catch (err) {
    return {
      status: "failed",
      message: "되돌리는 중 문제가 생겼어요.",
      detail: friendlyStartupToggleDetail(err, "startup-toggle-restore-failed"),
      entry
    };
  }
}

export async function purgeExpiredStartupFolderEntries(
  options: StartupFolderToggleRuntime & {
    removeEntryDir?: (dir: string, entry: StartupAutoDisabledEntry) => Promise<void>;
  }
): Promise<StartupDisabledPurgeResult> {
  const now = options.now?.() ?? new Date();
  const root = itemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    await removeLinkedStartupDisabledRootIfManaged(options.userDataDir, linkedRoot);
    return {
      purgedCount: 0,
      purgedIds: [],
      failedIds: [],
      retentionDays: STARTUP_DISABLED_RETENTION_DAYS
    };
  }

  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return {
      purgedCount: 0,
      purgedIds: [],
      retentionDays: STARTUP_DISABLED_RETENTION_DAYS
    };
  }

  const purgedIds: string[] = [];
  const failedIds: string[] = [];
  const removeEntryDir =
    options.removeEntryDir ??
    ((targetDir: string) => rm(targetDir, { recursive: true, force: true }));

  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const entry = await readDisabledEntry(options.userDataDir, dirent.name);
    if (!entry || !isOutsideDisabledRetentionWindow(entry, now)) continue;
    try {
      const dir = await assertSafeStartupDisabledEntryForPurge(
        options.userDataDir,
        dirent.name,
        entry
      );
      const linkedEntryDescendant = await findLinkedDescendant(dir);
      if (linkedEntryDescendant) {
        throw new Error(`Expired startup holding entry contains a nested link: ${linkedEntryDescendant}`);
      }
      await removeEntryDir(dir, entry);
      if (await pathExists(dir)) throw new Error("Expired startup holding entry still exists");
      purgedIds.push(entry.id);
    } catch {
      if (isSafeStartupDisabledId(dirent.name)) failedIds.push(dirent.name);
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedIds,
    ...(failedIds.length > 0 ? { failedIds } : {}),
    retentionDays: STARTUP_DISABLED_RETENTION_DAYS
  };
}

export const __testing = {
  STARTUP_DISABLED_DIR,
  STARTUP_DISABLED_RETENTION_DAYS,
  ITEMS_DIR,
  META_FILE,
  entryDir,
  filesRoot,
  itemsRoot,
  isUnderRoot,
  isSafeStartupDisabledId,
  isManagedStartupStoredPath,
  coerceDisabledEntry,
  startupHoldingIntegrityStatus,
  assertSafeStartupDisabledEntryForPurge,
  pruneNonRestorableStartupDisabledItems
};
