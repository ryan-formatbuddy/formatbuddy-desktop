/**
 * FormatBuddy Trash — app-managed 30-day restore bin.
 *
 * Windows Recycle Bin is convenient but opaque: retention policy,
 * original-path metadata, and restore UX are owned by Explorer. For
 * "깔끔 삭제" we need product-grade guarantees:
 *   - every moved item has an index entry with originalPath
 *   - restore is one click from inside FormatBuddy
 *   - expired entries are permanently removed after 30 days
 *   - all bytes stay local under Electron userData
 */
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import type {
  CleanupItem,
  CleanupTrashEntry,
  CleanupTrashPurgeResult,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot
} from "@shared/types";
import { evaluatePath, normalizePath } from "./blocklist";

export const FORMATBUDDY_TRASH_RETENTION_DAYS = 30;

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
}

export interface TrashRuntimeOptions {
  userDataDir: string;
  home?: string;
  now?: () => Date;
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

function emptyIndex(): PersistedTrashIndex {
  return { version: 1, retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS, entries: [] };
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function coerceEntry(value: unknown): CleanupTrashEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CleanupTrashEntry>;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.itemId !== "string") return null;
  if (typeof raw.originalPath !== "string") return null;
  if (typeof raw.storedPath !== "string") return null;
  if (typeof raw.label !== "string") return null;
  if (typeof raw.categoryId !== "string") return null;
  if (typeof raw.sizeBytes !== "number") return null;
  if (!validIso(raw.createdAt)) return null;
  if (!validIso(raw.expiresAt)) return null;
  return {
    id: raw.id,
    itemId: raw.itemId,
    originalPath: raw.originalPath,
    storedPath: raw.storedPath,
    label: raw.label,
    categoryId: raw.categoryId,
    sizeBytes: Math.max(0, Math.round(raw.sizeBytes)),
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt
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

async function loadIndex(userDataDir: string): Promise<PersistedTrashIndex> {
  try {
    const raw = await readFile(indexPath(userDataDir), "utf8");
    return coerceIndex(JSON.parse(raw));
  } catch {
    return emptyIndex();
  }
}

async function saveIndex(userDataDir: string, index: PersistedTrashIndex): Promise<void> {
  await mkdir(trashRoot(userDataDir), { recursive: true });
  await writeFile(indexPath(userDataDir), JSON.stringify(index, null, 2), "utf8");
}

async function recoverManifestEntries(userDataDir: string): Promise<CleanupTrashEntry[]> {
  let entries;
  try {
    entries = await readdir(itemsRoot(userDataDir), { withFileTypes: true });
  } catch {
    return [];
  }

  const recovered: CleanupTrashEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const orphanDir = entryDir(userDataDir, entry.name);
    try {
      const raw = await readFile(join(orphanDir, "manifest.json"), "utf8");
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
  if (entry.id !== entryFolderName) return false;
  const filesRoot = normalizePath(join(entryDir(userDataDir, entryFolderName), "files"));
  const stored = normalizePath(entry.storedPath);
  return stored === filesRoot || stored.startsWith(`${filesRoot}\\`);
}

async function loadReconciledIndex(userDataDir: string): Promise<PersistedTrashIndex> {
  const index = await loadIndex(userDataDir);
  const recovered = await recoverManifestEntries(userDataDir);

  const next = { ...index, entries: recovered };
  const changed = JSON.stringify(index.entries) !== JSON.stringify(next.entries);
  if (changed) await saveIndex(userDataDir, next);
  return next;
}

async function pruneMissingStoredEntries(
  userDataDir: string,
  index: PersistedTrashIndex
): Promise<PersistedTrashIndex> {
  const entries: CleanupTrashEntry[] = [];
  let changed = false;

  for (const entry of index.entries) {
    if (await exists(entry.storedPath)) {
      entries.push(entry);
      continue;
    }

    changed = true;
    await rm(entryDir(userDataDir, entry.id), { recursive: true, force: true }).catch(() => {});
  }

  if (!changed) return index;
  const next = { ...index, entries };
  await saveIndex(userDataDir, next);
  return next;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findLinkedPathPart(
  targetPath: string,
  boundary?: string,
  includeSelf = false
): Promise<string | undefined> {
  if (!boundary) return undefined;

  const normalizedBoundary = normalizePath(boundary);
  if (!normalizedBoundary) return undefined;
  let current = includeSelf ? targetPath : dirname(targetPath);

  while (current) {
    const normalizedCurrent = normalizePath(current);
    const insideBoundary =
      normalizedCurrent === normalizedBoundary ||
      normalizedCurrent.startsWith(`${normalizedBoundary}\\`);
    if (!insideBoundary) break;

    try {
      const parentStat = await lstat(current);
      if (parentStat.isSymbolicLink()) return current;
    } catch {
      // Missing parents are fine: restore will create them after the
      // existing parent chain has passed this link check.
    }

    if (normalizedCurrent === normalizedBoundary) break;
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }

  return undefined;
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

function expiryFor(now: Date): string {
  return new Date(
    now.getTime() + FORMATBUDDY_TRASH_RETENTION_DAYS * 86_400_000
  ).toISOString();
}

export async function moveToFormatBuddyTrash(
  options: MoveToTrashOptions
): Promise<CleanupTrashEntry> {
  const sourceDecision = evaluatePath(options.item.path, {
    allowRoots: [options.item.path],
    home: options.home
  });
  if (!sourceDecision.allowed) {
    throw new Error(
      `cleanup-trash refuses protected source path: ${sourceDecision.blockedBy ?? "blocked-path"}`
    );
  }

  const linkedSource = await findLinkedPathPart(options.item.path, options.home, true);
  if (linkedSource) {
    throw new Error(`cleanup-trash refuses linked source path (링크 경로): ${linkedSource}`);
  }

  const now = options.now?.() ?? new Date();
  const entryId = randomUUID();
  const targetDir = entryDir(options.userDataDir, entryId);
  const storedPath = storedPathFor(options.userDataDir, entryId, options.item.path);
  const entry: CleanupTrashEntry = {
    id: entryId,
    itemId: options.item.id,
    originalPath: options.item.path,
    storedPath,
    label: options.item.label,
    categoryId: options.item.categoryId,
    sizeBytes: Math.max(0, Math.round(options.sizeBytes)),
    createdAt: now.toISOString(),
    expiresAt: expiryFor(now)
  };

  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, "manifest.json"), JSON.stringify(entry, null, 2), "utf8");
  await movePath(options.item.path, storedPath);

  const index = await loadIndex(options.userDataDir);
  index.entries = [entry, ...index.entries.filter((e) => e.id !== entry.id)];
  await saveIndex(options.userDataDir, index);
  return entry;
}

export async function getTrashSnapshot(
  options: TrashRuntimeOptions
): Promise<CleanupTrashSnapshot> {
  await purgeExpiredTrash(options);
  const index = await pruneMissingStoredEntries(
    options.userDataDir,
    await loadReconciledIndex(options.userDataDir)
  );
  const entries = index.entries.slice().sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
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

  if (!(await exists(entry.storedPath))) {
    index.entries = index.entries.filter((e) => e.id !== entry.id);
    await saveIndex(options.userDataDir, index);
    return {
      entryId: entry.id,
      status: "missing-stored-item",
      message: "복구할 파일이 이미 사라졌어요.",
      originalPath: entry.originalPath,
      entry
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

  const linkedParent = await findLinkedPathPart(entry.originalPath, options.home);
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
    await mkdir(dirname(entry.originalPath), { recursive: true });
    await movePath(entry.storedPath, entry.originalPath);
    await rm(entryDir(options.userDataDir, entry.id), { recursive: true, force: true });
    index.entries = index.entries.filter((e) => e.id !== entry.id);
    await saveIndex(options.userDataDir, index);
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
      message: `되돌리기 중 문제가 생겼어요: ${(err as Error).message}`,
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
    const expired = Date.parse(entry.expiresAt) <= now.getTime();
    if (expired) purge.push(entry);
    else keep.push(entry);
  }

  let purgedBytes = 0;
  const purgedEntryIds: string[] = [];
  for (const entry of purge) {
    await rm(entryDir(options.userDataDir, entry.id), { recursive: true, force: true });
    purgedBytes += entry.sizeBytes;
    purgedEntryIds.push(entry.id);
  }

  if (purge.length > 0) {
    await saveIndex(options.userDataDir, { ...index, entries: keep });
  } else {
    // Ensure the folder exists once the feature has been touched.
    await mkdir(itemsRoot(options.userDataDir), { recursive: true }).catch(() => {});
  }

  return {
    purgedCount: purge.length,
    purgedBytes,
    purgedEntryIds,
    retentionDays: FORMATBUDDY_TRASH_RETENTION_DAYS
  };
}

export async function measureStoredPath(path: string): Promise<number> {
  const s = await stat(path);
  return s.size;
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
  expiryFor
};
