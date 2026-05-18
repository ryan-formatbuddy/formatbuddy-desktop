import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHistoryEntry,
  getAppStateSnapshot,
  recordScanResult,
  updateIgnoreList
} from "../src/main/localState";
import { generateRecommendation } from "../src/main/recommend";
import type { ScanReport } from "../src/shared/types";

function reportWith(scoreShape: "safe" | "busy", generatedAt: string): ScanReport {
  return {
    schemaVersion: "0.4.0-state-test",
    generatedAt,
    mode: "quick",
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: { manufacturer: "Mock", model: "Test", memoryGb: 16 },
    disks:
      scoreShape === "busy"
        ? [{ drive: "C:", sizeGb: 500, freeGb: 20 }]
        : [{ drive: "C:", sizeGb: 500, freeGb: 300 }],
    diskHealth: [{ healthStatus: "Healthy", operationalStatus: "OK" }],
    memoryPressure: { freeMemoryPercent: 40, pageFileUsagePercent: 10 },
    windowsUpdate: { installedHotfixCount: 30, daysSinceLatestHotfix: scoreShape === "busy" ? 90 : 7 },
    eventLog: { windowDays: 7, criticalCount: 0, errorCount: scoreShape === "busy" ? 24 : 2 },
    driverAge: { totalWithDate: 20, olderThan2Years: 4, olderThan2YearsPercent: 20 },
    startupPrograms: {
      count: scoreShape === "busy" ? 12 : 2,
      items: scoreShape === "busy" ? [{ name: "Launcher" }] : []
    },
    defender: {
      antivirusEnabled: true,
      realTimeProtectionEnabled: true,
      antivirusSignatureAgeDays: 1,
      lastQuickScanDaysAgo: 2
    },
    storageWaste: {
      userTempGb: scoreShape === "busy" ? 6 : 0.2,
      localAppDataTempGb: scoreShape === "busy" ? 4 : 0.1,
      windowsTempGb: 0.2,
      windowsOldExists: false,
      windowsOldGb: 0
    },
    largeFiles: [],
    duplicateFileCandidates: [],
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
    winget: { available: true, note: "" },
    diagnostics: [],
    checklist: {
      reviewNpkiManually: true,
      exportWifiProfilesManually: true,
      backupDesktopDocumentsDownloads: true,
      verifyCloudSync: true,
      saveReportBeforeFormat: true
    }
  };
}

describe("localState", () => {
  it("records scan history and compares the latest scan with the previous one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-state-test-"));
    try {
      const first = reportWith("safe", "2026-05-18T01:00:00.000Z");
      const firstRec = generateRecommendation(first);
      await recordScanResult(dir, first, firstRec);

      const second = reportWith("busy", "2026-05-18T02:00:00.000Z");
      const secondRec = generateRecommendation(second);
      const snapshot = await recordScanResult(dir, second, secondRec);

      expect(snapshot.history).toHaveLength(2);
      expect(snapshot.comparison?.previous?.id).toBe(buildHistoryEntry(first, firstRec).id);
      expect(snapshot.comparison?.scoreDelta).toBe(secondRec.formatScore - firstRec.formatScore);
      expect(snapshot.monitor.lastScore).toBe(secondRec.formatScore);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists cleanup ignore choices locally", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-ignore-test-"));
    try {
      let ignore = await updateIgnoreList(dir, {
        kind: "cleanup",
        id: "temporary-files",
        ignored: true
      });
      expect(ignore.cleanupItemIds).toContain("temporary-files");

      ignore = await updateIgnoreList(dir, {
        kind: "cleanup",
        id: "temporary-files",
        ignored: false
      });
      expect(ignore.cleanupItemIds).not.toContain("temporary-files");

      const snapshot = await getAppStateSnapshot(dir);
      expect(snapshot.ignoreList.cleanupItemIds).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
