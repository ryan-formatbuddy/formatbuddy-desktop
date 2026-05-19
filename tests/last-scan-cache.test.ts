import { afterEach, describe, expect, it } from "vitest";
import {
  clearRecentlyUninstallLaunchedApps,
  clearLastScan,
  DEFAULT_LAST_SCAN_TTL_MS,
  getLastScan,
  getLastScanAge,
  getLastScanIfFresh,
  getRecentlyUninstallLaunchedApps,
  RECENT_UNINSTALL_TTL_MS,
  rememberRecentlyUninstallLaunchedApp,
  setLastScan
} from "../src/main/lastScan";
import type { ScanResult } from "../src/shared/types";

function dummyResult(): ScanResult {
  return {
    report: {
      schemaVersion: "cache-test",
      generatedAt: new Date().toISOString(),
      mode: "quick",
      privacy: {
        localOnly: true,
        noPasswordCollection: true,
        noPrivateKeyUpload: true,
        noBrowserPasswordExtraction: true
      },
      system: {},
      disks: [],
      userFolders: [],
      gpu: [],
      installedApps: [],
      drivers: [],
      printers: [],
      wifiProfiles: [],
      npkiCandidates: [],
      bitlocker: [],
      cloudSync: [],
      browsers: [],
      winget: { available: false, note: "" },
      diagnostics: [],
      checklist: {
        reviewNpkiManually: true,
        exportWifiProfilesManually: true,
        backupDesktopDocumentsDownloads: true,
        verifyCloudSync: true,
        saveReportBeforeFormat: true
      }
    },
    recommendation: {
      formatScore: 12,
      severity: "safe",
      headline: "괜찮아요",
      summary: "",
      tryFirst: [],
      formatReasons: [],
      afterFormat: [],
      healthPillars: [],
      cleanupCenter: {
        reclaimableGb: 0,
        reviewCount: 0,
        candidates: [],
        largeFiles: [],
        duplicateGroups: [],
        startupItems: []
      },
      appInventory: { total: 0, classified: 0, needsCheck: 0, groups: [] },
      buddyChecklist: [],
      careActions: [],
      categoryScores: { cleanup: 0, security: 0, performance: 0, disk: 0 }
    },
    jsonPath: "/tmp/test.json"
  };
}

describe("lastScan TTL", () => {
  afterEach(() => {
    clearLastScan();
    clearRecentlyUninstallLaunchedApps();
  });

  it("returns null when no scan has been cached", () => {
    expect(getLastScanIfFresh()).toBeNull();
    expect(getLastScan()).toBeNull();
    expect(getLastScanAge()).toBeNull();
  });

  it("returns the cached scan inside the TTL window", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    // simulate now = t0 + 30 min
    expect(getLastScanIfFresh(DEFAULT_LAST_SCAN_TTL_MS, () => t0 + 30 * 60 * 1000)).not.toBeNull();
  });

  it("returns null past the TTL window", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    // simulate now = t0 + 2 hours -- outside the 1h default
    expect(getLastScanIfFresh(DEFAULT_LAST_SCAN_TTL_MS, () => t0 + 2 * 60 * 60 * 1000)).toBeNull();
  });

  it("honors a custom TTL shorter than the default", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    // 10 minute custom TTL: cache at 5min is fresh, at 15min stale
    expect(getLastScanIfFresh(10 * 60 * 1000, () => t0 + 5 * 60 * 1000)).not.toBeNull();
    expect(getLastScanIfFresh(10 * 60 * 1000, () => t0 + 15 * 60 * 1000)).toBeNull();
  });

  it("returns null when the wall clock skewed backwards", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    // user fixed their PC clock and "now" is now BEFORE we cached
    expect(getLastScanIfFresh(DEFAULT_LAST_SCAN_TTL_MS, () => t0 - 60_000)).toBeNull();
  });

  it("getLastScanAge reports the cached scan's age in ms", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    expect(getLastScanAge(() => t0 + 45 * 60 * 1000)).toBe(45 * 60 * 1000);
  });

  it("clearLastScan drops the cache so subsequent reads return null", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    expect(getLastScan()).not.toBeNull();
    clearLastScan();
    expect(getLastScan()).toBeNull();
    expect(getLastScanIfFresh(DEFAULT_LAST_SCAN_TTL_MS, () => t0)).toBeNull();
  });
});

describe("recently opened uninstall wizard memory", () => {
  afterEach(() => {
    clearLastScan();
    clearRecentlyUninstallLaunchedApps();
  });

  it("keeps only minimal app identity for post-uninstall-wizard leftover scans", () => {
    const t0 = 1_000_000;
    rememberRecentlyUninstallLaunchedApp(
      {
        name: "Slack",
        publisher: "Slack Technologies",
        uninstallString: '"C:\\Program Files\\Slack\\unins000.exe"',
        quietUninstallString: "secret-ish command",
        installLocation: "C:\\Program Files\\Slack"
      },
      () => t0
    );

    expect(getRecentlyUninstallLaunchedApps(() => t0 + 1_000)).toEqual([
      { name: "Slack", publisher: "Slack Technologies" }
    ]);
  });

  it("survives scan-cache clearing so uninstall follow-up can still find leftovers", () => {
    const t0 = 1_000_000;
    setLastScan(dummyResult(), () => t0);
    rememberRecentlyUninstallLaunchedApp({ name: "Slack", publisher: "Slack Technologies" }, () => t0);

    clearLastScan();

    expect(getLastScan()).toBeNull();
    expect(getRecentlyUninstallLaunchedApps(() => t0 + 1_000)).toEqual([
      { name: "Slack", publisher: "Slack Technologies" }
    ]);
  });

  it("drops remembered apps after the 24 hour follow-up window", () => {
    const t0 = 1_000_000;
    rememberRecentlyUninstallLaunchedApp({ name: "Slack", publisher: "Slack Technologies" }, () => t0);

    expect(getRecentlyUninstallLaunchedApps(() => t0 + RECENT_UNINSTALL_TTL_MS - 1)).toHaveLength(1);
    expect(getRecentlyUninstallLaunchedApps(() => t0 + RECENT_UNINSTALL_TTL_MS + 1)).toEqual([]);
  });
});
