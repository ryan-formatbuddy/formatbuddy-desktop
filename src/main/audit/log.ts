/**
 * Unified audit log.
 *
 * Append-only timeline of every meaningful action FormatBuddy performed
 * on the user's PC. The renderer surfaces this in AuditLog.tsx so a
 * suspicious user can answer "what did this app do?" in one screen
 * instead of going hunting through cleanup-log + uninstall logs +
 * Defender history.
 *
 * Disk format (userData/formatbuddy-audit-log.json):
 *   { version: 1, entries: AuditEntry[] }
 *
 * Read-time prune:
 *   On every read we drop entries older than retentionDays (default 90).
 *   We don't fight to compact the file unless we just wrote it, so a
 *   stale-but-already-pruned read returns the right view without
 *   touching disk twice.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditCategory, AuditEntry, AuditSnapshot } from "@shared/types";

const LOG_FILE = "formatbuddy-audit-log.json";
const DEFAULT_RETENTION_DAYS = 90;
const MAX_ENTRIES = 2000;

interface PersistedAuditLog {
  version: 1;
  retentionDays: number;
  entries: AuditEntry[];
}

function auditPath(userDataDir: string): string {
  return join(userDataDir, LOG_FILE);
}

function emptyLog(): PersistedAuditLog {
  return { version: 1, retentionDays: DEFAULT_RETENTION_DAYS, entries: [] };
}

function isAuditCategory(value: unknown): value is AuditCategory {
  return (
    value === "cleanup" ||
    value === "uninstall" ||
    value === "defender" ||
    value === "monitor" ||
    value === "system"
  );
}

function coerceEntry(value: unknown): AuditEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AuditEntry>;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.at !== "string") return null;
  if (!isAuditCategory(raw.category)) return null;
  if (typeof raw.action !== "string") return null;
  if (typeof raw.summary !== "string") return null;
  return {
    id: raw.id,
    at: raw.at,
    category: raw.category,
    action: raw.action,
    summary: raw.summary,
    detail:
      raw.detail && typeof raw.detail === "object" && !Array.isArray(raw.detail)
        ? (raw.detail as Record<string, unknown>)
        : undefined
  };
}

function coerceLog(value: unknown): PersistedAuditLog {
  if (!value || typeof value !== "object") return emptyLog();
  const raw = value as Partial<PersistedAuditLog>;
  const retentionDays =
    typeof raw.retentionDays === "number" && raw.retentionDays > 0
      ? Math.min(365, Math.round(raw.retentionDays))
      : DEFAULT_RETENTION_DAYS;
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map(coerceEntry)
        .filter((e): e is AuditEntry => e !== null)
        .slice(0, MAX_ENTRIES)
    : [];
  return { version: 1, retentionDays, entries };
}

function prune(
  log: PersistedAuditLog,
  now: Date
): { log: PersistedAuditLog; mutated: boolean } {
  const cutoff = now.getTime() - log.retentionDays * 86_400_000;
  const filtered = log.entries.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) ? t >= cutoff : true;
  });
  if (filtered.length === log.entries.length) return { log, mutated: false };
  return {
    log: { ...log, entries: filtered },
    mutated: true
  };
}

async function loadLog(userDataDir: string): Promise<PersistedAuditLog> {
  try {
    const raw = await readFile(auditPath(userDataDir), "utf8");
    return coerceLog(JSON.parse(raw));
  } catch {
    return emptyLog();
  }
}

async function saveLog(userDataDir: string, log: PersistedAuditLog): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(auditPath(userDataDir), JSON.stringify(log, null, 2), "utf8");
}

export interface AuditEmit {
  category: AuditCategory;
  action: string;
  summary: string;
  detail?: Record<string, unknown>;
}

/**
 * Append a single entry to the audit log and persist. Caller does not
 * supply id / timestamp — we mint them so two emitters racing on the
 * same tick don't collide.
 */
export async function appendAuditEntry(
  userDataDir: string,
  emit: AuditEmit,
  now: Date = new Date()
): Promise<AuditEntry> {
  const loaded = await loadLog(userDataDir);
  const entry: AuditEntry = {
    id: randomUUID(),
    at: now.toISOString(),
    category: emit.category,
    action: emit.action,
    summary: emit.summary,
    detail: emit.detail
  };
  const next: PersistedAuditLog = {
    ...loaded,
    entries: [entry, ...loaded.entries].slice(0, MAX_ENTRIES)
  };
  const pruned = prune(next, now).log;
  await saveLog(userDataDir, pruned);
  return entry;
}

/** Read the audit log (with retention prune applied). */
export async function getAuditSnapshot(
  userDataDir: string,
  now: Date = new Date()
): Promise<AuditSnapshot> {
  const loaded = await loadLog(userDataDir);
  const { log, mutated } = prune(loaded, now);
  if (mutated) {
    // Compact the file opportunistically — saves the next read from
    // walking pruned entries. Best-effort; swallowed on error.
    await saveLog(userDataDir, log).catch(() => {});
  }
  return { entries: log.entries, retentionDays: log.retentionDays };
}

export const __testing = {
  coerceLog,
  coerceEntry,
  prune,
  emptyLog,
  DEFAULT_RETENTION_DAYS,
  MAX_ENTRIES
};
