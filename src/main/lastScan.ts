/**
 * In-memory cache of the most recent ScanResult.
 *
 * This exists so app-manager IPC handlers (apps:list, apps:leftovers,
 * apps:uninstall) can answer without re-running PowerShell, AND so
 * apps:uninstall can re-look-up the InstalledApp by (name, publisher)
 * rather than trusting an UninstallString supplied by the renderer.
 *
 * Lifetime: the cache lives for the whole main process. It resets on
 * app restart. We don't persist it to disk because installedApps can
 * contain license tokens or work software names that some users
 * consider private; the on-disk scan JSON is the user's responsibility
 * to save via the export flow.
 */
import type { InstalledApp, ScanResult } from "@shared/types";

let cached: ScanResult | null = null;
let cachedAt = 0;

export function setLastScan(result: ScanResult, now: () => number = Date.now): void {
  cached = result;
  cachedAt = now();
}

export function getLastScan(): ScanResult | null {
  return cached;
}

/**
 * v2.0 (Round D-33 / D4) — return the cached scan only if it's
 * younger than ttlMs. We avoid surprising old data: if the cache is
 * missing or stale, return null so the caller falls back to a fresh
 * PowerShell run.
 *
 * Default TTL is one hour. Callers can pass a shorter window for
 * "user just changed something" flows, or a longer one for the
 * background reminder tick.
 */
export const DEFAULT_LAST_SCAN_TTL_MS = 60 * 60 * 1000;

export function getLastScanIfFresh(
  ttlMs: number = DEFAULT_LAST_SCAN_TTL_MS,
  now: () => number = Date.now
): ScanResult | null {
  if (!cached) return null;
  const age = now() - cachedAt;
  if (age < 0) return null; // clock skew defensive
  if (age > ttlMs) return null;
  return cached;
}

export function getLastScanAge(now: () => number = Date.now): number | null {
  if (!cached) return null;
  return now() - cachedAt;
}

export function clearLastScan(): void {
  cached = null;
  cachedAt = 0;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function findInstalledApp(
  name: string,
  publisher?: string | null
): InstalledApp | undefined {
  if (!cached) return undefined;
  const wantedName = norm(name);
  const wantedPublisher = publisher ? norm(publisher) : null;
  if (!wantedName) return undefined;

  // Prefer the strictest match first: exact name + exact publisher.
  // Fall back to name-only so registry entries with empty publisher
  // (very common on Hancom and some Korean ISVs) still match.
  return (
    cached.report.installedApps.find((app) => {
      if (norm(app.name) !== wantedName) return false;
      if (wantedPublisher && norm(app.publisher) !== wantedPublisher) return false;
      return true;
    }) ??
    cached.report.installedApps.find((app) => norm(app.name) === wantedName)
  );
}
