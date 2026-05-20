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
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditCategory, AuditEntry, AuditSnapshot } from "@shared/types";
import { normalizePath } from "../cleanup/blocklist";
import { findLinkedPathPart } from "../cleanup/pathSafety";

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

function sanitizeAuditText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function isValidAuditTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

const AUDIT_DETAIL_ID_ARRAY_KEYS = new Set([
  "failedEntryIds",
  "failedIds",
  "purgedEntryIds",
  "purgedIds",
  "trashEntryIds",
  "registryBackupIds",
  "startupDisabledIds"
]);

function isSafeAuditDetailId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !/\s/.test(value) &&
    !/[\/\\\u0000-\u001f\u007f]/.test(value)
  );
}

function sanitizeAuditDetailIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (!isSafeAuditDetailId(item) || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function sanitizeAuditDetail(detail: unknown): Record<string, unknown> | undefined {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return undefined;
  const raw = detail as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    clean[key] = AUDIT_DETAIL_ID_ARRAY_KEYS.has(key) ? sanitizeAuditDetailIdArray(value) : value;
  }
  return clean;
}

function coerceEntry(value: unknown): AuditEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AuditEntry>;
  if (typeof raw.id !== "string") return null;
  if (!isValidAuditTimestamp(raw.at)) return null;
  if (!isAuditCategory(raw.category)) return null;
  if (typeof raw.action !== "string") return null;
  if (typeof raw.summary !== "string") return null;
  const action = sanitizeAuditText(raw.action, "unknown");
  const summary = sanitizeAuditText(raw.summary, "활동 기록을 남겼어요.");
  return {
    id: raw.id,
    at: raw.at,
    category: raw.category,
    action,
    summary,
    detail: sanitizeAuditDetail(raw.detail)
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
    return Number.isFinite(t) && t >= cutoff;
  });
  if (filtered.length === log.entries.length) return { log, mutated: false };
  return {
    log: { ...log, entries: filtered },
    mutated: true
  };
}

async function loadLog(userDataDir: string): Promise<PersistedAuditLog> {
  const linkedLog = await findLinkedPathPart(auditPath(userDataDir), userDataDir, true);
  if (linkedLog) {
    if (normalizePath(resolve(linkedLog)) === normalizePath(resolve(auditPath(userDataDir)))) {
      await rm(auditPath(userDataDir), { force: true }).catch(() => {});
    }
    return emptyLog();
  }

  try {
    const raw = await readFile(auditPath(userDataDir), "utf8");
    return coerceLog(JSON.parse(raw));
  } catch {
    return emptyLog();
  }
}

async function saveLog(userDataDir: string, log: PersistedAuditLog): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  const targetLogPath = auditPath(userDataDir);
  const linkedLog = await findLinkedPathPart(targetLogPath, userDataDir, true);
  if (linkedLog) {
    if (normalizePath(resolve(linkedLog)) !== normalizePath(resolve(targetLogPath))) {
      throw new Error(`FormatBuddy audit log path is behind a link: ${linkedLog}`);
    }
    await rm(targetLogPath, { force: true });
  }
  try {
    const logStat = await lstat(targetLogPath);
    if (!logStat.isFile()) {
      await rm(targetLogPath, { recursive: true, force: true });
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
  await writeFile(targetLogPath, JSON.stringify(log, null, 2), "utf8");
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
    action: sanitizeAuditText(emit.action, "unknown"),
    summary: sanitizeAuditText(emit.summary, "활동 기록을 남겼어요."),
    detail: sanitizeAuditDetail(emit.detail)
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
