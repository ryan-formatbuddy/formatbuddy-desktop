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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CleanupCategoryBreakdown,
  CleanupExecuteMode,
  CleanupExecutedItem,
  CleanupHistorySnapshot,
  CleanupLogEntry,
  CleanupSkippedItem
} from "@shared/types";

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

function coerceLog(value: unknown): PersistedLog {
  if (!value || typeof value !== "object") return emptyLog();
  const raw = value as Partial<PersistedLog>;
  return {
    version: 1,
    entries: Array.isArray(raw.entries) ? raw.entries.slice(0, MAX_ENTRIES) : []
  };
}

async function loadLog(userDataDir: string): Promise<PersistedLog> {
  try {
    const raw = await readFile(logPath(userDataDir), "utf8");
    return coerceLog(JSON.parse(raw));
  } catch {
    return emptyLog();
  }
}

async function saveLog(userDataDir: string, log: PersistedLog): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
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

export const __testing = { coerceLog, MAX_ENTRIES };
