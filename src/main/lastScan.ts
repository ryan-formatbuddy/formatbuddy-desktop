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

export function setLastScan(result: ScanResult): void {
  cached = result;
}

export function getLastScan(): ScanResult | null {
  return cached;
}

export function clearLastScan(): void {
  cached = null;
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
