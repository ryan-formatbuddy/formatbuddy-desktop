/**
 * FormatBuddy Trash — app-managed 30-day restore bin.
 *
 * Windows Recycle Bin is convenient but opaque: retention policy,
 * original-path metadata, and restore UX are owned by Explorer. For
 * "깔끔 삭제" we need product-grade guarantees:
 *   - every moved item has an index entry or recoverable manifest with originalPath
 *   - restore is one click from inside FormatBuddy
 *   - expired entries are permanently removed after 30 days
 *   - all bytes stay local under Electron userData
 */
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, parse, relative, resolve } from "node:path";
import type {
  CleanupItem,
  CleanupTrashEntry,
  CleanupTrashPurgeResult,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import { evaluatePath, normalizePath } from "./blocklist";
import { findLinkedDescendant, findLinkedPathPart } from "./pathSafety";

export const FORMATBUDDY_TRASH_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS;
const DAY_MS = 86_400_000;
const TRASH_EXPIRY_CLOCK_SKEW_MS = DAY_MS;

const TRASH_DIR = "formatbuddy-trash";
const ITEMS_DIR = "items";
const INDEX_FILE = "trash-index.json";

interface PersistedTrashIndex {
  version: 1;
  retentionDays: number;
  entries: CleanupTrashEntry[];
}

export interface MoveToTrashOptions {
  userDataDir: string;
  item: CleanupItem;
  sizeBytes: number;
  home?: string;
  now?: () => Date;
  trustedSource?: {
    kind: "app-shortcut" | "app-shortcut-folder" | "app-install-folder";
    allowRoots: string[];
  };
}

export interface TrashRuntimeOptions {
  userDataDir: string;
  home?: string;
  now?: () => Date;
  removeEntryDir?: (dir: string, entry: CleanupTrashEntry) => Promise<void>;
  onAppLeftoverRestored?: (
    app: { name: string; publisher?: string | null }
  ) => void | Promise<void>;
}

function trashRoot(userDataDir: string): string {
  return join(userDataDir, TRASH_DIR);
}

function itemsRoot(userDataDir: string): string {
  return join(trashRoot(userDataDir), ITEMS_DIR);
}

function indexPath(userDataDir: string): string {
  return join(trashRoot(userDataDir), INDEX_FILE);
}

function entryDir(userDataDir: string, entryId: string): string {
  return join(itemsRoot(userDataDir), entryId);
}

function storedPathFor(userDataDir: string, entryId: string, originalPath: string): string {
  const base = basename(originalPath) || "item";
  return join(entryDir(userDataDir, entryId), "files", base);
}

function overlapsManagedUserData(userDataDir: string, candidatePath: string): boolean {
  const managed = normalizePath(resolve(userDataDir));
  const candidate = normalizePath(resolve(candidatePath));
  if (!managed || !candidate) return false;
  return (
    candidate === managed ||
    candidate.startsWith(`${managed}\\`) ||
    managed.startsWith(`${candidate}\\`)
  );
}

function isAtOrInside(rawPath: string, rawRoot: string): boolean {
  const path = normalizePath(rawPath);
  const root = normalizePath(rawRoot);
  if (!path || !root) return false;
  return path === root || path.startsWith(`${root}\\`);
}

function trustedSourceAllows(rawPath: string, trusted?: MoveToTrashOptions["trustedSource"]): boolean {
  if (
    !trusted ||
    (trusted.kind !== "app-shortcut" &&
      trusted.kind !== "app-shortcut-folder" &&
      trusted.kind !== "app-install-folder")
  ) return false;
  const normalized = normalizePath(rawPath);
  if (
    normalized.endsWith("\\microsoft\\windows\\start menu\\programs\\startup") ||
    normalized.includes("\\microsoft\\windows\\start menu\\programs\\startup\\")
  ) {
    return false;
  }
  return trusted.allowRoots.some((root) => {
    if (!isAtOrInside(rawPath, root)) return false;
    if (trusted.kind === "app-shortcut") return normalized.endsWith(".lnk");
    if (trusted.kind === "app-shortcut-folder") return normalized !== normalizePath(root) && !normalized.endsWith(".lnk");
    return normalized === normalizePath(root);
  });
}

function trustedSourceBoundary(rawPath: string, trusted?: MoveToTrashOptions["trustedSource"]): string | undefined {
  if (!trustedSourceAllows(rawPath, trusted)) return undefined;
  return trusted?.allowRoots.find((root) => isAtOrInside(rawPath, root));
}

function commonAncestorPath(leftPath: string, rightPath: string): string | undefined {
  const left = resolve(leftPath);
  const right = resolve(rightPath);
  const leftRoot = parse(left).root;
  const rightRoot = parse(right).root;
  if (normalizePath(leftRoot) !== normalizePath(rightRoot)) return undefined;

  const leftParts = left.slice(leftRoot.length).split(/[\\/]+/).filter(Boolean);
  const rightParts = right.slice(rightRoot.length).split(/[\\/]+/).filter(Boolean);
  const commonParts: string[] = [];
  const max = Math.min(leftParts.length, rightParts.length);
  for (let i = 0; i < max; i += 1) {
    if (leftParts[i].toLowerCase() !== rightParts[i].toLowerCase()) break;
    commonParts.push(leftParts[i]);
  }
  return commonParts.length > 0 ? join(leftRoot, ...commonParts) : leftRoot || undefined;
}

function restoreLinkBoundary(options: TrashRuntimeOptions, originalPath: string): string {
  return options.home ?? commonAncestorPath(options.userDataDir, originalPath) ?? dirname(originalPath);
}

export function isSafeTrashEntryId(entryId: unknown): entryId is string {
  return (
    isUsableMetadataString(entryId) &&
    entryId.trim() === entryId &&
    entryId !== "." &&
    entryId !== ".." &&
    !/\s/.test(entryId) &&
    !entryId.includes("/") &&
    !entryId.includes("\\") &&
    !entryId.includes("\0")
  );
}

function emptyIndex(): PersistedTrashIndex {
  return { version: 1, retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS, entries: [] };
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isUsableMetadataString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isStrictMetadataString(value: unknown): value is string {
  return isUsableMetadataString(value) && value.trim() === value;
}

function isUsableSizeBytes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidContentHash(value: unknown): value is NonNullable<CleanupTrashEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<CleanupTrashEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

function canonicalExpiry(createdAt: string): string {
  return expiryFor(new Date(createdAt));
}

function isWithinTrashRetentionWindow(expiresAt: string, now: Date): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  const earliestAllowed =
    now.getTime() +
    FORMATBUDDY_TRASH_RETENTION_DAYS * DAY_MS -
    TRASH_EXPIRY_CLOCK_SKEW_MS;
  const latestAllowed =
    now.getTime() +
    FORMATBUDDY_TRASH_RETENTION_DAYS * DAY_MS +
    TRASH_EXPIRY_CLOCK_SKEW_MS;
  return expiresAtMs >= earliestAllowed && expiresAtMs <= latestAllowed;
}

function isOutsideRestorableWindow(entry: CleanupTrashEntry, now: Date): boolean {
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isFinite(createdAt) && createdAt > now.getTime()) return true;

  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function coerceEntry(value: unknown): CleanupTrashEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CleanupTrashEntry>;
  if (!isSafeTrashEntryId(raw.id)) return null;
  if (!isStrictMetadataString(raw.itemId)) return null;
  if (!isStrictMetadataString(raw.originalPath)) return null;
  if (!isStrictMetadataString(raw.storedPath)) return null;
  if (!isUsableMetadataString(raw.label)) return null;
  if (!isStrictMetadataString(raw.categoryId)) return null;
  if (typeof raw.sizeBytes !== "number" || !Number.isFinite(raw.sizeBytes)) return null;
  if (!validIso(raw.createdAt)) return null;
  if (!validIso(raw.expiresAt)) return null;
  return {
    id: raw.id,
    itemId: raw.itemId,
    originalPath: raw.originalPath,
    storedPath: raw.storedPath,
    label: raw.label,
    categoryId: raw.categoryId,
    appName: isUsableMetadataString(raw.appName) ? raw.appName : null,
    appPublisher: isUsableMetadataString(raw.appPublisher) ? raw.appPublisher : null,
    sizeBytes: Math.max(0, Math.round(raw.sizeBytes)),
    contentHash: isValidContentHash(raw.contentHash) ? raw.contentHash : null,
    createdAt: raw.createdAt,
    expiresAt: canonicalExpiry(raw.createdAt)
  } as CleanupTrashEntry;
}

function coerceIndex(value: unknown): PersistedTrashIndex {
  if (!value || typeof value !== "object") return emptyIndex();
  const raw = value as Partial<PersistedTrashIndex>;
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(coerceEntry).filter((e): e is CleanupTrashEntry => e !== null)
    : [];
  return {
    version: 1,
    retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS,
    entries
  };
}

function assertUsableCleanupItemMetadata(item: CleanupItem): void {
  const strictRequired: Array<[string, unknown]> = [
    ["item id", item.id],
    ["source path", item.path],
    ["category", item.categoryId]
  ];

  const invalidStrict = strictRequired.find(([, value]) => !isStrictMetadataString(value));
  if (invalidStrict) {
    throw new Error(`cleanup-trash refuses unusable source metadata: ${invalidStrict[0]}`);
  }

  const invalid = [["label", item.label] as const].find(([, value]) => !isUsableMetadataString(value));
  if (invalid) {
    throw new Error(`cleanup-trash refuses unusable source metadata: ${invalid[0]}`);
  }

  if (!isUsableSizeBytes(item.sizeBytes)) {
    throw new Error("cleanup-trash refuses unusable source metadata: size");
  }
}

async function loadIndex(userDataDir: string): Promise<PersistedTrashIndex> {
  const linkedIndex = await findLinkedPathPart(indexPath(userDataDir), userDataDir, true);
  if (linkedIndex) {
    if (normalizePath(resolve(linkedIndex)) === normalizePath(resolve(indexPath(userDataDir)))) {
      await rm(indexPath(userDataDir), { force: true }).catch(() => {});
    }
    return emptyIndex();
  }

  try {
    const raw = await readFile(indexPath(userDataDir), "utf8");
    return coerceIndex(JSON.parse(raw));
  } catch {
    return emptyIndex();
  }
}

async function saveIndex(userDataDir: string, index: PersistedTrashIndex): Promise<void> {
  const linkedRoot = await findLinkedPathPart(trashRoot(userDataDir), userDataDir, true);
  if (linkedRoot) {
    throw new Error(`FormatBuddy restore bin folder is a link: ${linkedRoot}`);
  }
  await mkdir(trashRoot(userDataDir), { recursive: true });
  const targetIndexPath = indexPath(userDataDir);
  const linkedIndex = await findLinkedPathPart(targetIndexPath, userDataDir, true);
  if (linkedIndex) {
    if (normalizePath(resolve(linkedIndex)) !== normalizePath(resolve(targetIndexPath))) {
      throw new Error(`FormatBuddy restore bin index path is behind a link: ${linkedIndex}`);
    }
    await rm(targetIndexPath, { force: true });
  }
  try {
    const indexStat = await lstat(targetIndexPath);
    if (!indexStat.isFile()) {
      await rm(targetIndexPath, { recursive: true, force: true });
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
  await writeFile(targetIndexPath, JSON.stringify(index, null, 2), "utf8");
}

async function saveIndexOrKeepManifestFallback(
  userDataDir: string,
  index: PersistedTrashIndex
): Promise<"saved" | "manifest-fallback"> {
  try {
    await saveIndex(userDataDir, index);
    return "saved";
  } catch (err) {
    const linkedRoot = await findLinkedPathPart(trashRoot(userDataDir), userDataDir, true).catch(
      () => undefined
    );
    if (linkedRoot) throw err;
    return "manifest-fallback";
  }
}

async function isUsableItemsRoot(userDataDir: string): Promise<boolean> {
  const root = itemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) {
    await rm(linkedRoot, { force: true }).catch(() => {});
    return false;
  }

  try {
    const stat = await lstat(root);
    if (stat.isSymbolicLink()) {
      await rm(root, { force: true }).catch(() => {});
      return false;
    }
    if (!stat.isDirectory()) {
      await rm(root, { recursive: true, force: true }).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function ensureUsableItemsRootForWrite(userDataDir: string): Promise<void> {
  const root = itemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) {
    throw new Error(`FormatBuddy restore bin folder is a link: ${linkedRoot}`);
  }

  try {
    const stat = await lstat(root);
    if (stat.isDirectory()) return;
    throw new Error(`FormatBuddy restore bin folder is not a folder: ${root}`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  await mkdir(root, { recursive: true });
}

async function ensureSafeEntryDirForWrite(userDataDir: string, entryId: string): Promise<void> {
  const dir = entryDir(userDataDir, entryId);
  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`FormatBuddy restore bin entry folder is a link: ${linkedDir}`);
  }
}

async function ensureSafeEntryManifestForWrite(userDataDir: string, entryId: string): Promise<void> {
  const dir = entryDir(userDataDir, entryId);
  const manifestPath = join(dir, "manifest.json");
  const linkedManifest = await findLinkedPathPart(manifestPath, dir, true);
  if (linkedManifest) {
    throw new Error(`FormatBuddy restore bin manifest file is a link: ${linkedManifest}`);
  }
}

async function ensureSafeStoredPathForWrite(
  userDataDir: string,
  entryId: string,
  storedPath: string
): Promise<void> {
  const dir = entryDir(userDataDir, entryId);
  const linkedStoredPath = await findLinkedPathPart(storedPath, dir, true);
  if (linkedStoredPath) {
    throw new Error(`FormatBuddy restore bin stored files path is a link: ${linkedStoredPath}`);
  }
}

async function recoverManifestEntries(userDataDir: string): Promise<CleanupTrashEntry[]> {
  if (!(await isUsableItemsRoot(userDataDir))) return [];

  let entries;
  try {
    entries = await readdir(itemsRoot(userDataDir), { withFileTypes: true });
  } catch {
    return [];
  }

  const recovered: CleanupTrashEntry[] = [];
  for (const entry of entries) {
    const orphanDir = entryDir(userDataDir, entry.name);
    if (!entry.isDirectory()) {
      await rm(orphanDir, { recursive: true, force: true }).catch(() => {});
      continue;
    }
    try {
      const manifestPath = join(orphanDir, "manifest.json");
      const linkedManifest = await findLinkedPathPart(manifestPath, orphanDir, true);
      if (linkedManifest) {
        await rm(orphanDir, { recursive: true, force: true }).catch(() => {});
        continue;
      }
      const raw = await readFile(manifestPath, "utf8");
      const coerced = coerceEntry(JSON.parse(raw));
      if (!coerced || !isManifestEntrySelfContained(userDataDir, entry.name, coerced)) {
        await rm(orphanDir, { recursive: true, force: true }).catch(() => {});
        continue;
      }
      if (!(await exists(coerced.storedPath))) {
        await rm(orphanDir, { recursive: true, force: true }).catch(() => {});
        continue;
      }
      recovered.push(coerced);
    } catch {
      // A broken manifest should not hide the rest of the restore bin.
      await rm(orphanDir, { recursive: true, force: true }).catch(() => {});
    }
  }
  return recovered;
}

function isManifestEntrySelfContained(
  userDataDir: string,
  entryFolderName: string,
  entry: CleanupTrashEntry
): boolean {
  if (!isSafeTrashEntryId(entry.id) || !isSafeTrashEntryId(entryFolderName)) return false;
  if (entry.id !== entryFolderName) return false;
  const filesRoot = normalizePath(resolve(entryDir(userDataDir, entryFolderName), "files"));
  const stored = normalizePath(resolve(entry.storedPath));
  return stored.startsWith(`${filesRoot}\\`);
}

export function isManagedTrashStoredPath(userDataDir: string, candidatePath: string): boolean {
  const root = normalizePath(resolve(itemsRoot(userDataDir)));
  const candidate = normalizePath(resolve(candidatePath));
  return candidate.startsWith(`${root}\\`);
}

export function isManagedTrashEntryStoredPath(
  userDataDir: string,
  entryId: string,
  candidatePath: string
): boolean {
  if (!isSafeTrashEntryId(entryId)) return false;
  const items = normalizePath(resolve(itemsRoot(userDataDir)));
  const entry = normalizePath(resolve(entryDir(userDataDir, entryId)));
  if (!(entry === items || entry.startsWith(`${items}\\`))) return false;

  const files = normalizePath(resolve(entryDir(userDataDir, entryId), "files"));
  const candidate = normalizePath(resolve(candidatePath));
  return candidate.startsWith(`${files}\\`);
}

export async function findLinkedManagedTrashStoredPath(
  userDataDir: string,
  entryId: string,
  candidatePath: string
): Promise<string | undefined> {
  if (!isManagedTrashEntryStoredPath(userDataDir, entryId, candidatePath)) {
    return candidatePath;
  }
  const linkedPathPart = await findLinkedPathPart(candidatePath, userDataDir, true);
  if (linkedPathPart) return linkedPathPart;
  return findLinkedDescendant(candidatePath);
}

async function assertSafeEntryDirForPurge(
  userDataDir: string,
  entry: CleanupTrashEntry
): Promise<string> {
  if (!isSafeTrashEntryId(entry.id)) {
    throw new Error("FormatBuddy restore bin purge entry id is not safe");
  }

  const root = normalizePath(resolve(itemsRoot(userDataDir)));
  const dir = entryDir(userDataDir, entry.id);
  const normalizedDir = normalizePath(resolve(dir));
  if (!normalizedDir.startsWith(`${root}\\`)) {
    throw new Error("FormatBuddy restore bin purge entry folder is outside the restore bin");
  }

  if (!isManagedTrashEntryStoredPath(userDataDir, entry.id, entry.storedPath)) {
    throw new Error("FormatBuddy restore bin purge stored path is outside the restore entry folder");
  }

  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`FormatBuddy restore bin purge entry folder is a link: ${linkedDir}`);
  }

  const dirStat = await lstat(dir);
  if (!dirStat.isDirectory()) {
    throw new Error("FormatBuddy restore bin purge entry folder is not a folder");
  }

  return dir;
}

export async function assertManagedTrashEntryManifest(options: {
  userDataDir: string;
  entryId: string;
  itemId: string;
  categoryId: string;
  sizeBytes: number;
  originalPath: string;
  storedPath: string;
  expiresAt: string;
  now?: () => Date;
}): Promise<void> {
  if (!isSafeTrashEntryId(options.entryId)) {
    throw new Error("FormatBuddy restore manifest entry id is not safe");
  }

  const dir = entryDir(options.userDataDir, options.entryId);
  const manifestPath = join(dir, "manifest.json");
  const linkedManifest = await findLinkedPathPart(manifestPath, dir, true);
  if (linkedManifest) {
    throw new Error(`FormatBuddy restore manifest is a link: ${linkedManifest}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("FormatBuddy restore manifest was not created");
  }

  const entry = coerceEntry(parsed);
  if (!entry) {
    throw new Error("FormatBuddy restore manifest is not readable");
  }
  if (entry.id !== options.entryId) {
    throw new Error("FormatBuddy restore manifest id does not match the restore entry");
  }
  if (entry.itemId !== options.itemId) {
    throw new Error("FormatBuddy restore manifest item does not match the cleanup item");
  }
  if (entry.categoryId !== options.categoryId) {
    throw new Error("FormatBuddy restore manifest category does not match the cleanup item");
  }
  if (entry.sizeBytes !== Math.max(0, Math.round(options.sizeBytes))) {
    throw new Error("FormatBuddy restore manifest size does not match the cleanup item");
  }
  if (
    normalizePath(resolve(entry.originalPath)) !==
    normalizePath(resolve(options.originalPath))
  ) {
    throw new Error("FormatBuddy restore manifest original path does not match the cleaned item");
  }
  if (
    normalizePath(resolve(entry.storedPath)) !==
    normalizePath(resolve(options.storedPath))
  ) {
    throw new Error("FormatBuddy restore manifest stored path does not match the restore entry");
  }
  if (entry.expiresAt !== options.expiresAt) {
    throw new Error("FormatBuddy restore manifest expiry does not match the restore entry");
  }
  if (!isWithinTrashRetentionWindow(options.expiresAt, options.now?.() ?? new Date())) {
    throw new Error("FormatBuddy restore manifest expiry is outside the 30-day window");
  }
  if (!isManagedTrashEntryStoredPath(options.userDataDir, options.entryId, entry.storedPath)) {
    throw new Error("FormatBuddy restore manifest stored path is outside the restore entry folder");
  }
  if (!(await exists(entry.storedPath))) {
    throw new Error("FormatBuddy restore manifest stored item was not created");
  }
  const linkedStoredPath = await findLinkedManagedTrashStoredPath(
    options.userDataDir,
    options.entryId,
    entry.storedPath
  );
  if (linkedStoredPath) {
    throw new Error(`FormatBuddy restore manifest stored item is a link: ${linkedStoredPath}`);
  }
  const actualStoredSizeBytes = await measureStoredPath(entry.storedPath);
  if (actualStoredSizeBytes !== entry.sizeBytes) {
    throw new Error("FormatBuddy restore manifest stored size does not match the restore entry");
  }
  if (!entry.contentHash) {
    throw new Error("FormatBuddy restore manifest stored hash was not created");
  }
  const actualContentHash = await hashPath(entry.storedPath);
  if (actualContentHash !== entry.contentHash.value) {
    throw new Error("FormatBuddy restore manifest stored hash does not match the restore entry");
  }
}

async function loadReconciledIndex(userDataDir: string): Promise<PersistedTrashIndex> {
  const recovered = await recoverManifestEntries(userDataDir);
  const index = await loadIndex(userDataDir);

  const next = { ...index, entries: recovered };
  const changed = JSON.stringify(index.entries) !== JSON.stringify(next.entries);
  if (changed) await saveIndexOrKeepManifestFallback(userDataDir, next);
  return next;
}

async function pruneMissingStoredEntries(
  userDataDir: string,
  index: PersistedTrashIndex
): Promise<PersistedTrashIndex> {
  const entries: CleanupTrashEntry[] = [];
  let changed = false;

  for (const entry of index.entries) {
    const storedExists = await exists(entry.storedPath);
    const linkedStoredPath = storedExists
      ? await findLinkedManagedTrashStoredPath(userDataDir, entry.id, entry.storedPath)
      : undefined;
    if (storedExists && !linkedStoredPath) {
      entries.push(entry);
      continue;
    }

    changed = true;
    await rm(entryDir(userDataDir, entry.id), { recursive: true, force: true }).catch(() => {});
  }

  if (!changed) return index;
  const next = { ...index, entries };
  await saveIndexOrKeepManifestFallback(userDataDir, next);
  return next;
}

async function refreshStoredEntrySizes(
  userDataDir: string,
  index: PersistedTrashIndex
): Promise<PersistedTrashIndex> {
  const entries = await Promise.all(
    index.entries.map(async (entry) => {
      const sizeBytes = await measureStoredPath(entry.storedPath).catch(() => entry.sizeBytes);
      return { ...entry, sizeBytes };
    })
  );

  const changed = entries.some((entry, indexPosition) => {
    return entry.sizeBytes !== index.entries[indexPosition]?.sizeBytes;
  });
  if (!changed) return index;

  const next = { ...index, entries };
  await saveIndexOrKeepManifestFallback(userDataDir, next);
  return next;
}

async function trashEntryIntegrityStatus(
  entry: CleanupTrashEntry
): Promise<NonNullable<CleanupTrashEntry["integrityStatus"]>> {
  if (!entry.contentHash) return "legacy";
  const actualContentHash = await hashPath(entry.storedPath).catch(() => null);
  return actualContentHash === entry.contentHash.value ? "verified" : "changed";
}

function changedTrashEntry(entry: CleanupTrashEntry): CleanupTrashEntry {
  return { ...entry, integrityStatus: "changed" };
}

function legacyTrashEntry(entry: CleanupTrashEntry): CleanupTrashEntry {
  return { ...entry, integrityStatus: "legacy" };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function movePath(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  try {
    await rename(source, destination);
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
  }
  await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
  await rm(source, { recursive: true, force: true });
}

async function hashPath(path: string, root = path): Promise<string> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`Cannot hash linked restore item: ${path}`);
  }

  const relativePath = relative(root, path).replace(/\\/g, "/");
  const hash = createHash("sha256");
  if (stat.isFile()) {
    hash.update("file\0");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path));
    return hash.digest("hex");
  }

  if (!stat.isDirectory()) {
    hash.update("other\0");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(String(stat.size));
    return hash.digest("hex");
  }

  hash.update("dir\0");
  hash.update(relativePath);
  hash.update("\0");
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(entry.name);
    hash.update("\0");
    hash.update(await hashPath(join(path, entry.name), root));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function notifyAppLeftoverRestored(
  options: TrashRuntimeOptions,
  entry: CleanupTrashEntry
): Promise<void> {
  if (entry.categoryId !== "app-leftovers") return;
  const name = (entry.appName ?? entry.label).trim();
  if (!name) return;
  await Promise.resolve(
    options.onAppLeftoverRestored?.({
      name,
      publisher: entry.appPublisher ?? null
    })
  ).catch(() => {});
}

function friendlyRestoreFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const code = err && typeof err === "object" && "code" in err ? String((err as NodeJS.ErrnoException).code ?? "") : "";
  const haystack = `${code} ${message}`.toLowerCase();

  if (/eacces|eperm|access.*denied|permission.*denied/.test(haystack)) {
    return "권한이 부족해서 원래 위치로 되돌리지 못했어요. 관리자 권한으로 다시 실행한 뒤 시도해주세요.";
  }
  if (/eexist|enotdir|not a directory/.test(haystack)) {
    return "원래 위치의 폴더를 다시 만들지 못해서 되돌리지 못했어요. 같은 이름의 파일이나 폴더를 확인한 뒤 다시 시도해주세요.";
  }
  if (/ebusy|locked|resource busy/.test(haystack)) {
    return "다른 프로그램이 파일을 사용 중이라 되돌리지 못했어요. 잠시 후 다시 시도해주세요.";
  }
  return "원래 위치로 되돌리지 못했어요. 잠시 후 다시 시도해주세요.";
}

function expiryFor(now: Date): string {
  return new Date(
    now.getTime() + FORMATBUDDY_TRASH_RETENTION_DAYS * 86_400_000
  ).toISOString();
}

export async function moveToFormatBuddyTrash(
  options: MoveToTrashOptions
): Promise<CleanupTrashEntry> {
  assertUsableCleanupItemMetadata(options.item);
  if (!isUsableSizeBytes(options.sizeBytes)) {
    throw new Error("cleanup-trash refuses unusable source metadata: size");
  }

  if (overlapsManagedUserData(options.userDataDir, options.item.path)) {
    throw new Error("cleanup-trash refuses FormatBuddy managed data path (포맷버디 앱 데이터)");
  }

  const sourceDecision = evaluatePath(options.item.path, {
    allowRoots: [options.item.path],
    home: options.home
  });
  if (!sourceDecision.allowed && !trustedSourceAllows(options.item.path, options.trustedSource)) {
    throw new Error(
      `cleanup-trash refuses protected source path: ${sourceDecision.blockedBy ?? "blocked-path"}`
    );
  }
  if (options.trustedSource?.kind === "app-install-folder") {
    const sourceStat = await lstat(options.item.path).catch(() => null);
    if (!sourceStat?.isDirectory()) {
      throw new Error("cleanup-trash refuses app install folder source that is not a folder");
    }
  }

  const linkedSource = await findLinkedPathPart(
    options.item.path,
    trustedSourceBoundary(options.item.path, options.trustedSource) ?? options.home ?? options.item.path,
    true
  );
  if (linkedSource) {
    throw new Error(`cleanup-trash refuses linked source path (링크 경로): ${linkedSource}`);
  }

  const linkedDescendant = await findLinkedDescendant(options.item.path);
  if (linkedDescendant) {
    throw new Error(
      `cleanup-trash refuses unsafe source contents (링크 또는 너무 깊은 폴더): ${linkedDescendant}`
    );
  }

  const now = options.now?.() ?? new Date();
  const entryId = randomUUID();
  await ensureUsableItemsRootForWrite(options.userDataDir);
  const targetDir = entryDir(options.userDataDir, entryId);
  const storedPath = storedPathFor(options.userDataDir, entryId, options.item.path);
  const contentHash = {
    algorithm: "sha256" as const,
    value: await hashPath(options.item.path)
  };
  const entry: CleanupTrashEntry = {
    id: entryId,
    itemId: options.item.id,
    originalPath: options.item.path,
    storedPath,
    label: options.item.label,
    categoryId: options.item.categoryId,
    appName: isUsableMetadataString(options.item.appName) ? options.item.appName : null,
    appPublisher: isUsableMetadataString(options.item.appPublisher) ? options.item.appPublisher : null,
    sizeBytes: Math.max(0, Math.round(options.sizeBytes)),
    contentHash,
    createdAt: now.toISOString(),
    expiresAt: expiryFor(now)
  };

  await ensureSafeEntryDirForWrite(options.userDataDir, entryId);
  await mkdir(targetDir, { recursive: true });
  try {
    await ensureSafeEntryDirForWrite(options.userDataDir, entryId);
    await ensureSafeEntryManifestForWrite(options.userDataDir, entryId);
    await writeFile(join(targetDir, "manifest.json"), JSON.stringify(entry, null, 2), "utf8");
    await ensureSafeEntryManifestForWrite(options.userDataDir, entryId);
    await ensureSafeEntryDirForWrite(options.userDataDir, entryId);
    await ensureSafeStoredPathForWrite(options.userDataDir, entryId, storedPath);
    await movePath(options.item.path, storedPath);
  } catch (err) {
    await rm(targetDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  const index = await loadIndex(options.userDataDir);
  index.entries = [entry, ...index.entries.filter((e) => e.id !== entry.id)];
  const indexSaveStatus = await saveIndexOrKeepManifestFallback(options.userDataDir, index);
  if (indexSaveStatus === "manifest-fallback") {
    await assertManagedTrashEntryManifest({
      userDataDir: options.userDataDir,
      entryId: entry.id,
      itemId: entry.itemId,
      categoryId: entry.categoryId,
      sizeBytes: entry.sizeBytes,
      originalPath: entry.originalPath,
      storedPath: entry.storedPath,
      expiresAt: entry.expiresAt,
      now: options.now
    });
  }
  return entry;
}

export async function getTrashSnapshot(
  options: TrashRuntimeOptions
): Promise<CleanupTrashSnapshot> {
  await purgeExpiredTrash(options);
  const pruned = await pruneMissingStoredEntries(
    options.userDataDir,
    await loadReconciledIndex(options.userDataDir)
  );
  const index = await refreshStoredEntrySizes(options.userDataDir, pruned);
  const entriesWithIntegrity = await Promise.all(
    index.entries.map(async (entry) => ({
      ...entry,
      integrityStatus: await trashEntryIntegrityStatus(entry)
    }))
  );
  const entries = entriesWithIntegrity
    .slice()
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  return {
    entries,
    totalBytes,
    retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS,
    nextExpiryAt: entries[0]?.expiresAt
  };
}

export async function restoreTrashEntry(
  options: TrashRuntimeOptions & { entryId: string }
): Promise<CleanupTrashRestoreResult> {
  if (!isSafeTrashEntryId(options.entryId)) {
    return {
      entryId: typeof options.entryId === "string" ? options.entryId : "",
      status: "blocked-path",
      message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
    };
  }

  const linkedItemsRoot = await findLinkedPathPart(
    itemsRoot(options.userDataDir),
    options.userDataDir,
    true
  );
  if (linkedItemsRoot) {
    return {
      entryId: options.entryId,
      status: "blocked-path",
      message: `복구함 폴더가 링크라 자동으로 되돌리지 않았어요: ${linkedItemsRoot}`
    };
  }

  await purgeExpiredTrash(options);
  const index = await loadReconciledIndex(options.userDataDir);
  const entry = index.entries.find((e) => e.id === options.entryId);
  if (!entry) {
    return {
      entryId: options.entryId,
      status: "not-found",
      message: "복구함에서 해당 항목을 찾지 못했어요."
    };
  }

  const now = options.now?.() ?? new Date();
  if (isOutsideRestorableWindow(entry, now)) {
    return {
      entryId: entry.id,
      status: "expired",
      message: "30일 보관 기간이 지나서 되돌릴 수 없어요. 자동 비움이 아직 끝나지 않았다면 다음 확인 때 다시 비울게요.",
      originalPath: entry.originalPath,
      entry
    };
  }

  if (!(await exists(entry.storedPath))) {
    index.entries = index.entries.filter((e) => e.id !== entry.id);
    await saveIndexOrKeepManifestFallback(options.userDataDir, index);
    return {
      entryId: entry.id,
      status: "missing-stored-item",
      message: "복구할 파일이 이미 사라졌어요.",
      originalPath: entry.originalPath,
      entry
    };
  }

  if (overlapsManagedUserData(options.userDataDir, entry.originalPath)) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: "원래 위치가 FormatBuddy 앱 데이터 영역이라 자동으로 되돌리지 않았어요.",
      originalPath: entry.originalPath,
      entry
    };
  }

  const linkedStoredPath = await findLinkedManagedTrashStoredPath(
    options.userDataDir,
    entry.id,
    entry.storedPath
  );
  if (linkedStoredPath) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: `복구함 안의 저장물이 링크라 자동으로 되돌리지 않았어요: ${linkedStoredPath}`,
      originalPath: entry.originalPath,
      entry
    };
  }

  const actualStoredSizeBytes = await measureStoredPath(entry.storedPath).catch(() => null);
  if (actualStoredSizeBytes !== entry.sizeBytes) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: "복구함 안의 파일 크기가 바뀐 것 같아요. 안전을 위해 자동으로 되돌리지 않았어요.",
      originalPath: entry.originalPath,
      entry: changedTrashEntry(entry)
    };
  }
  if (!entry.contentHash) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: "복구 기록을 확인할 수 없어요. 오래된 복구 항목이라 자동으로 되돌리지 않았어요.",
      originalPath: entry.originalPath,
      entry: legacyTrashEntry(entry)
    };
  }
  const actualContentHash = await hashPath(entry.storedPath).catch(() => null);
  if (actualContentHash !== entry.contentHash.value) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: "복구함 안의 파일 내용이 바뀐 것 같아요. 안전을 위해 자동으로 되돌리지 않았어요.",
      originalPath: entry.originalPath,
      entry: changedTrashEntry(entry)
    };
  }

  const restoreDecision = evaluatePath(entry.originalPath, {
    allowRoots: [entry.originalPath],
    home: options.home
  });
  if (!restoreDecision.allowed) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: `원래 위치가 보호 경로라 자동으로 되돌리지 않았어요: ${restoreDecision.blockedBy ?? "보호 경로"}`,
      originalPath: entry.originalPath,
      entry
    };
  }

  const linkedParent = await findLinkedPathPart(
    entry.originalPath,
    restoreLinkBoundary(options, entry.originalPath)
  );
  if (linkedParent) {
    return {
      entryId: entry.id,
      status: "blocked-path",
      message: `원래 위치의 상위 폴더가 링크라 자동으로 되돌리지 않았어요: ${linkedParent}`,
      originalPath: entry.originalPath,
      entry
    };
  }

  if (await exists(entry.originalPath)) {
    return {
      entryId: entry.id,
      status: "target-exists",
      message: "원래 위치에 같은 이름의 항목이 있어요. 먼저 이름을 바꾸거나 옮긴 뒤 다시 시도해주세요.",
      originalPath: entry.originalPath,
      entry
    };
  }

  try {
    const restoreEntryDir = entryDir(options.userDataDir, entry.id);
    const removeEntryDir =
      options.removeEntryDir ??
      ((dir: string) => rm(dir, { recursive: true, force: true }));
    await mkdir(dirname(entry.originalPath), { recursive: true });
    await movePath(entry.storedPath, entry.originalPath);
    if (!(await exists(entry.originalPath))) {
      throw new Error("Restored path was not created");
    }
    if (await exists(entry.storedPath)) {
      throw new Error("Stored trash path still exists after restore");
    }
    await removeEntryDir(restoreEntryDir, entry);
    if (await exists(restoreEntryDir)) {
      throw new Error("Restore entry still exists after restore");
    }
    index.entries = index.entries.filter((e) => e.id !== entry.id);
    await saveIndexOrKeepManifestFallback(options.userDataDir, index);
    await notifyAppLeftoverRestored(options, entry);
    return {
      entryId: entry.id,
      status: "restored",
      message: "원래 위치로 되돌렸어요.",
      originalPath: entry.originalPath,
      entry
    };
  } catch (err) {
    return {
      entryId: entry.id,
      status: "restore-failed",
      message: friendlyRestoreFailureMessage(err),
      originalPath: entry.originalPath,
      entry
    };
  }
}

export async function purgeExpiredTrash(
  options: TrashRuntimeOptions
): Promise<CleanupTrashPurgeResult> {
  const now = options.now?.() ?? new Date();
  const index = await loadReconciledIndex(options.userDataDir);
  const keep: CleanupTrashEntry[] = [];
  const purge: CleanupTrashEntry[] = [];

  for (const entry of index.entries) {
    if (isOutsideRestorableWindow(entry, now)) purge.push(entry);
    else keep.push(entry);
  }

  let purgedBytes = 0;
  const purgedEntryIds: string[] = [];
  const failedEntryIds: string[] = [];
  const removeEntryDir =
    options.removeEntryDir ??
    ((dir: string) => rm(dir, { recursive: true, force: true }));
  for (const entry of purge) {
    try {
      const dir = await assertSafeEntryDirForPurge(options.userDataDir, entry);
      const linkedStoredPath = await findLinkedManagedTrashStoredPath(
        options.userDataDir,
        entry.id,
        entry.storedPath
      );
      const entryBytes = linkedStoredPath
        ? 0
        : await measureStoredPath(entry.storedPath).catch(() => entry.sizeBytes);
      await removeEntryDir(dir, entry);
      if (await exists(dir)) {
        throw new Error("Expired trash entry still exists after purge");
      }
      purgedBytes += entryBytes;
      purgedEntryIds.push(entry.id);
    } catch {
      failedEntryIds.push(entry.id);
      keep.push(entry);
    }
  }

  if (purge.length > 0) {
    await saveIndexOrKeepManifestFallback(options.userDataDir, { ...index, entries: keep });
  } else {
    // Ensure the folder exists once the feature has been touched.
    await mkdir(itemsRoot(options.userDataDir), { recursive: true }).catch(() => {});
  }

  return {
    purgedCount: purgedEntryIds.length,
    purgedBytes,
    purgedEntryIds,
    failedEntryIds,
    retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS
  };
}

export async function measureStoredPath(path: string): Promise<number> {
  const s = await lstat(path);
  if (!s.isDirectory()) return s.size;

  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    total += await measureStoredPath(join(path, entry.name)).catch(() => 0);
  }
  return total;
}

export const __testing = {
  coerceIndex,
  coerceEntry,
  pruneMissingStoredEntries,
  trashRoot,
  itemsRoot,
  indexPath,
  entryDir,
  storedPathFor,
  expiryFor,
  assertSafeEntryDirForPurge
};
