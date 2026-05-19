import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { InstalledApp } from "@shared/types";
import { normalizePath } from "../cleanup/blocklist";
import { findLinkedPathPart } from "../cleanup/pathSafety";
import { RECENT_UNINSTALL_TTL_MS } from "../lastScan";

export const UNINSTALL_FOLLOWUPS_FILE = "formatbuddy-uninstall-followups.json";

const MAX_FOLLOWUPS = 100;
const MAX_FIELD_LENGTH = 1024;

interface PersistedUninstallFollowup {
  name: string;
  publisher?: string | null;
  installLocation?: string;
  registryKeyPath?: string;
  rememberedAt: string;
}

interface PersistedUninstallFollowups {
  version: 1;
  entries: PersistedUninstallFollowup[];
}

interface LoadedUninstallFollowups {
  store: PersistedUninstallFollowups;
  changed: boolean;
}

function followupsPath(userDataDir: string): string {
  return join(userDataDir, UNINSTALL_FOLLOWUPS_FILE);
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function followupKey(app: Pick<InstalledApp, "name" | "publisher">): string {
  return `${norm(app.name)}|${norm(app.publisher)}`;
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

function sanitizeFollowupApp(app: InstalledApp): InstalledApp | null {
  const name = cleanOptionalString(app.name);
  if (!name) return null;
  const publisher = cleanOptionalString(app.publisher) ?? null;
  return {
    name,
    publisher,
    installLocation: cleanOptionalString(app.installLocation),
    registryKeyPath: cleanOptionalString(app.registryKeyPath)
  };
}

function coerceFollowup(value: unknown): PersistedUninstallFollowup | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PersistedUninstallFollowup>;
  const name = cleanOptionalString(raw.name);
  if (!name) return null;
  if (typeof raw.rememberedAt !== "string" || !Number.isFinite(Date.parse(raw.rememberedAt))) {
    return null;
  }
  return {
    name,
    publisher: cleanOptionalString(raw.publisher) ?? null,
    installLocation: cleanOptionalString(raw.installLocation),
    registryKeyPath: cleanOptionalString(raw.registryKeyPath),
    rememberedAt: raw.rememberedAt
  };
}

function coerceStore(value: unknown): PersistedUninstallFollowups {
  if (!value || typeof value !== "object") return { version: 1, entries: [] };
  const raw = value as Partial<PersistedUninstallFollowups>;
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(coerceFollowup).filter((entry): entry is PersistedUninstallFollowup => Boolean(entry))
    : [];
  return { version: 1, entries };
}

function pruneAndDedupe(
  entries: PersistedUninstallFollowup[],
  nowMs: number
): PersistedUninstallFollowup[] {
  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const remembered = Date.parse(entry.rememberedAt);
      return Number.isFinite(remembered) && nowMs - remembered <= RECENT_UNINSTALL_TTL_MS;
    })
    .sort((a, b) => Date.parse(b.rememberedAt) - Date.parse(a.rememberedAt))
    .filter((entry) => {
      const key = followupKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_FOLLOWUPS);
}

async function loadStore(
  userDataDir: string,
  now: () => number = Date.now
): Promise<PersistedUninstallFollowups> {
  return (await loadStoreWithMeta(userDataDir, now)).store;
}

async function loadStoreWithMeta(
  userDataDir: string,
  now: () => number = Date.now
): Promise<LoadedUninstallFollowups> {
  const file = followupsPath(userDataDir);
  const linkedFile = await findLinkedPathPart(file, userDataDir, true);
  if (linkedFile) {
    if (normalizePath(resolve(linkedFile)) === normalizePath(resolve(file))) {
      await rm(file, { force: true }).catch(() => {});
    }
    return { store: { version: 1, entries: [] }, changed: true };
  }

  try {
    const raw = await readFile(file, "utf8");
    const store = coerceStore(JSON.parse(raw));
    const entries = pruneAndDedupe(store.entries, now());
    return {
      store: { version: 1, entries },
      changed: entries.length !== store.entries.length
    };
  } catch {
    return { store: { version: 1, entries: [] }, changed: false };
  }
}

async function saveStore(
  userDataDir: string,
  store: PersistedUninstallFollowups
): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  const file = followupsPath(userDataDir);
  const linkedFile = await findLinkedPathPart(file, userDataDir, true);
  if (linkedFile) {
    if (normalizePath(resolve(linkedFile)) !== normalizePath(resolve(file))) {
      throw new Error(`FormatBuddy uninstall follow-up path is behind a link: ${linkedFile}`);
    }
    await rm(file, { force: true });
  }
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function rememberUninstallFollowup(
  userDataDir: string,
  app: InstalledApp,
  now: () => number = Date.now
): Promise<void> {
  const minimal = sanitizeFollowupApp(app);
  if (!minimal) return;

  const t = now();
  const current = await loadStore(userDataDir, () => t);
  const key = followupKey(minimal);
  const entry: PersistedUninstallFollowup = {
    name: minimal.name,
    publisher: minimal.publisher ?? null,
    installLocation: minimal.installLocation?.trim() || undefined,
    registryKeyPath: minimal.registryKeyPath?.trim() || undefined,
    rememberedAt: new Date(t).toISOString()
  };
  const entries = pruneAndDedupe(
    [entry, ...current.entries.filter((item) => followupKey(item) !== key)],
    t
  );
  await saveStore(userDataDir, { version: 1, entries });
}

export async function listUninstallFollowups(
  userDataDir: string,
  now: () => number = Date.now
): Promise<InstalledApp[]> {
  const loaded = await loadStoreWithMeta(userDataDir, now);
  if (loaded.changed) {
    await saveStore(userDataDir, loaded.store);
  }
  const store = loaded.store;
  return store.entries.map((entry) => ({
    name: entry.name,
    publisher: entry.publisher ?? null,
    installLocation: entry.installLocation,
    registryKeyPath: entry.registryKeyPath
  }));
}

export function mergeUninstallFollowupApps(...groups: InstalledApp[][]): InstalledApp[] {
  const seen = new Set<string>();
  const merged: InstalledApp[] = [];
  for (const group of groups) {
    for (const app of group) {
      const minimal = sanitizeFollowupApp(app);
      if (!minimal) continue;
      const key = followupKey(minimal);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(minimal);
    }
  }
  return merged;
}

export const __testing = {
  followupsPath,
  sanitizeFollowupApp,
  coerceStore,
  pruneAndDedupe
};
