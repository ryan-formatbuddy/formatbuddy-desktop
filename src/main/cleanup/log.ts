/**
 * Append-only cleanup execution log.
 *
 * Lives next to formatbuddy-state.json in app.getPath("userData"). Separate
 * file so corruption in scan-history (the main state) can't take the
 * cleanup audit trail with it, and vice versa.
 *
 * Cap is intentionally low (MAX_ENTRIES) — the log is for "did we already
 * clean this category recently?" UX hints, not forensics.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CleanupCategoryBreakdown,
  CleanupCategoryId,
  CleanupExecuteMode,
  CleanupExecutedItem,
  CleanupHistorySnapshot,
  CleanupLogEntry,
  CleanupSkippedItem
} from "@shared/types";
import { normalizePath } from "./blocklist";
import { findLinkedPathPart } from "./pathSafety";

const LOG_FILE = "formatbuddy-cleanup-log.json";
const MAX_ENTRIES = 100;

interface PersistedLog {
  version: 1;
  entries: CleanupLogEntry[];
}

function logPath(userDataDir: string): string {
  return join(userDataDir, LOG_FILE);
}

function emptyLog(): PersistedLog {
  return { version: 1, entries: [] };
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCleanupMode(value: unknown): value is CleanupExecuteMode {
  return value === "trash" || value === "permanent";
}

function isCleanupCategoryId(value: unknown): value is CleanupCategoryId {
  return (
    value === "recycle-bin" ||
    value === "temp-user" ||
    value === "temp-windows" ||
    value === "browser-cache" ||
    value === "windows-old" ||
    value === "downloads-installers" ||
    value === "large-files" ||
    value === "app-leftovers"
  );
}

function coerceNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function coerceCategoryBreakdown(value: unknown): CleanupCategoryBreakdown | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CleanupCategoryBreakdown>;
  if (!isCleanupCategoryId(raw.categoryId)) return null;
  const bytesFreed = coerceNonNegativeInteger(raw.bytesFreed);
  const itemCount = coerceNonNegativeInteger(raw.itemCount);
  if (bytesFreed === null || itemCount === null) return null;
  return {
    categoryId: raw.categoryId,
    bytesFreed,
    itemCount
  };
}

function coerceEntry(value: unknown): CleanupLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CleanupLogEntry>;
  if (typeof raw.id !== "string") return null;
  if (!validIso(raw.executedAt)) return null;
  if (!isCleanupMode(raw.mode)) return null;
  const removedCount = coerceNonNegativeInteger(raw.removedCount);
  const skippedCount = coerceNonNegativeInteger(raw.skippedCount);
  if (removedCount === null || skippedCount === null) return null;
  if (!Array.isArray(raw.categories)) return null;

  const categories = raw.categories
    .map(coerceCategoryBreakdown)
    .filter((entry): entry is CleanupCategoryBreakdown => entry !== null);
  const totalFreedBytes = categories.reduce((sum, category) => sum + category.bytesFreed, 0);

  return {
    id: raw.id,
    executedAt: raw.executedAt,
    mode: raw.mode,
    totalFreedBytes,
    removedCount,
    skippedCount,
    categories
  };
}

function coerceLog(value: unknown): PersistedLog {
  if (!value || typeof value !== "object") return emptyLog();
  const raw = value as Partial<PersistedLog>;
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map(coerceEntry)
        .filter((entry): entry is CleanupLogEntry => entry !== null)
        .slice(0, MAX_ENTRIES)
    : [];
  return {
    version: 1,
    entries
  };
}

async function loadLog(userDataDir: string): Promise<PersistedLog> {
  const linkedLog = await findLinkedPathPart(logPath(userDataDir), userDataDir, true);
  if (linkedLog) {
    if (normalizePath(resolve(linkedLog)) === normalizePath(resolve(logPath(userDataDir)))) {
      await rm(logPath(userDataDir), { force: true }).catch(() => {});
    }
    return emptyLog();
  }

  try {
    const raw = await readFile(logPath(userDataDir), "utf8");
    return coerceLog(JSON.parse(raw));
  } catch {
    return emptyLog();
  }
}

async function saveLog(userDataDir: string, log: PersistedLog): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  const linkedLog = await findLinkedPathPart(logPath(userDataDir), userDataDir, true);
  if (linkedLog) {
    if (normalizePath(resolve(linkedLog)) !== normalizePath(resolve(logPath(userDataDir)))) {
      throw new Error(`FormatBuddy cleanup log path is behind a link: ${linkedLog}`);
    }
    await rm(logPath(userDataDir), { force: true });
  }
  await writeFile(logPath(userDataDir), JSON.stringify(log, null, 2), "utf8");
}

export function buildLogEntry(args: {
  mode: CleanupExecuteMode;
  executedAt?: string;
  removedItems: CleanupExecutedItem[];
  skippedItems: CleanupSkippedItem[];
}): CleanupLogEntry {
  const breakdownMap = new Map<string, CleanupCategoryBreakdown>();
  for (const item of args.removedItems) {
    if (!item.succeeded) continue;
    const existing = breakdownMap.get(item.categoryId);
    if (existing) {
      existing.bytesFreed += item.sizeBytes;
      existing.itemCount += 1;
    } else {
      breakdownMap.set(item.categoryId, {
        categoryId: item.categoryId,
        bytesFreed: item.sizeBytes,
        itemCount: 1
      });
    }
  }

  const totalFreedBytes = Array.from(breakdownMap.values()).reduce(
    (sum, b) => sum + b.bytesFreed,
    0
  );

  return {
    id: randomUUID(),
    executedAt: args.executedAt ?? new Date().toISOString(),
    mode: args.mode,
    totalFreedBytes,
    removedCount: args.removedItems.filter((i) => i.succeeded).length,
    skippedCount: args.skippedItems.length,
    categories: Array.from(breakdownMap.values())
  };
}

export async function recordCleanupExecution(
  userDataDir: string,
  entry: CleanupLogEntry
): Promise<CleanupHistorySnapshot> {
  const log = await loadLog(userDataDir);
  log.entries = [entry, ...log.entries].slice(0, MAX_ENTRIES);
  await saveLog(userDataDir, log);
  return { entries: log.entries };
}

export async function getCleanupHistory(
  userDataDir: string
): Promise<CleanupHistorySnapshot> {
  const log = await loadLog(userDataDir);
  return { entries: log.entries };
}

export const __testing = { coerceLog, coerceEntry, coerceCategoryBreakdown, MAX_ENTRIES };
