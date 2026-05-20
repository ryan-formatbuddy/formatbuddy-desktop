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

function sameFollowupApp(
  a: Pick<InstalledApp, "name" | "publisher">,
  b: Pick<InstalledApp, "name" | "publisher">
): boolean {
  if (norm(a.name) !== norm(b.name)) return false;
  const aPublisher = norm(a.publisher);
  const bPublisher = norm(b.publisher);
  return !aPublisher || !bPublisher || aPublisher === bPublisher;
}

function mergeFollowupApp(base: InstalledApp, incoming: InstalledApp): InstalledApp {
  return {
    name: base.name || incoming.name,
    publisher: base.publisher ?? incoming.publisher ?? null,
    installLocation: base.installLocation ?? incoming.installLocation,
    registryKeyPath: base.registryKeyPath ?? incoming.registryKeyPath
  };
}

function cleanDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

function cleanMetadataString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

function sanitizeFollowupApp(app: InstalledApp): InstalledApp | null {
  const name = cleanDisplayString(app.name);
  if (!name) return null;
  const publisher = cleanDisplayString(app.publisher) ?? null;
  return {
    name,
    publisher,
    installLocation: cleanMetadataString(app.installLocation),
    registryKeyPath: cleanMetadataString(app.registryKeyPath)
  };
}

function coerceFollowup(value: unknown): PersistedUninstallFollowup | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PersistedUninstallFollowup>;
  const name = cleanDisplayString(raw.name);
  if (!name) return null;
  if (typeof raw.rememberedAt !== "string" || !Number.isFinite(Date.parse(raw.rememberedAt))) {
    return null;
  }
  return {
    name,
    publisher: cleanDisplayString(raw.publisher) ?? null,
    installLocation: cleanMetadataString(raw.installLocation),
    registryKeyPath: cleanMetadataString(raw.registryKeyPath),
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
  const deduped: PersistedUninstallFollowup[] = [];
  for (const entry of entries
    .filter((entry) => {
      const remembered = Date.parse(entry.rememberedAt);
      return Number.isFinite(remembered) && nowMs - remembered <= RECENT_UNINSTALL_TTL_MS;
    })
    .sort((a, b) => Date.parse(b.rememberedAt) - Date.parse(a.rememberedAt))) {
    const existingIndex = deduped.findIndex((item) => sameFollowupApp(item, entry));
    if (existingIndex === -1) {
      deduped.push(entry);
      continue;
    }
    deduped[existingIndex] = {
      ...deduped[existingIndex],
      publisher: deduped[existingIndex].publisher ?? entry.publisher ?? null,
      installLocation: deduped[existingIndex].installLocation ?? entry.installLocation,
      registryKeyPath: deduped[existingIndex].registryKeyPath ?? entry.registryKeyPath
    };
  }
  return deduped.slice(0, MAX_FOLLOWUPS);
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
  const entry: PersistedUninstallFollowup = {
    name: minimal.name,
    publisher: minimal.publisher ?? null,
    installLocation: minimal.installLocation?.trim() || undefined,
    registryKeyPath: minimal.registryKeyPath?.trim() || undefined,
    rememberedAt: new Date(t).toISOString()
  };
  const entries = pruneAndDedupe(
    [entry, ...current.entries.filter((item) => !sameFollowupApp(item, minimal))],
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

export async function forgetUninstallFollowup(
  userDataDir: string,
  app: InstalledApp,
  now: () => number = Date.now
): Promise<boolean> {
  const minimal = sanitizeFollowupApp(app);
  if (!minimal) return false;

  const loaded = await loadStoreWithMeta(userDataDir, now);
  const entries = loaded.store.entries.filter((entry) => !sameFollowupApp(entry, minimal));
  const removed = entries.length !== loaded.store.entries.length;
  if (removed || loaded.changed) {
    await saveStore(userDataDir, { version: 1, entries });
  }
  return removed;
}

export function mergeUninstallFollowupApps(...groups: InstalledApp[][]): InstalledApp[] {
  const merged: InstalledApp[] = [];
  for (const group of groups) {
    for (const app of group) {
      const minimal = sanitizeFollowupApp(app);
      if (!minimal) continue;
      const existingIndex = merged.findIndex((item) => sameFollowupApp(item, minimal));
      if (existingIndex === -1) {
        merged.push(minimal);
        continue;
      }
      merged[existingIndex] = mergeFollowupApp(merged[existingIndex], minimal);
    }
  }
  return merged;
}

export const __testing = {
  followupsPath,
  sanitizeFollowupApp,
  coerceStore,
  pruneAndDedupe,
  sameFollowupApp
};
