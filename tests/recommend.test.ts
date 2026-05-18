import { describe, it, expect } from "vitest";
import { generateRecommendation, __testing } from "../src/main/recommend";
import type { ScanReport } from "../src/shared/types";

function baseReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    schemaVersion: "0.4.0-quick-test",
    generatedAt: new Date().toISOString(),
    mode: "quick",
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: {
      manufacturer: "Mock",
      model: "Test",
      osCaption: "Windows 11 Pro",
      osVersion: "10.0.22631",
      cpu: "Mock CPU",
      memoryGb: 16
    },
    disks: [{ drive: "C:", sizeGb: 500, freeGb: 250 }],
    diskHealth: [
      { healthStatus: "Healthy", operationalStatus: "OK", sizeGb: 500, mediaType: "SSD" }
    ],
    memoryPressure: {
      totalMemoryMb: 16384,
      freeMemoryMb: 8000,
      freeMemoryPercent: 48.8,
      pageFileTotalMb: 8192,
      pageFileUsedMb: 1024,
      pageFileUsagePercent: 12.5
    },
    windowsUpdate: { installedHotfixCount: 30, daysSinceLatestHotfix: 7 },
    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 2 },
    driverAge: { totalWithDate: 40, olderThan2Years: 5, olderThan2YearsPercent: 12.5 },
    startupPrograms: { count: 5, items: [] },
    defender: {
      antivirusEnabled: true,
      realTimeProtectionEnabled: true,
      antivirusSignatureAgeDays: 1,
      lastQuickScanDaysAgo: 2,
      lastFullScanDaysAgo: 10
    },
    storageWaste: {
      userTempGb: 0.5,
      localAppDataTempGb: 1.0,
      windowsTempGb: 0.2,
      windowsOldExists: false,
      windowsOldGb: 0
    },
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
    },
    ...overrides
  };
}

describe("generateRecommendation — severity buckets", () => {
  it("healthy PC scores in safe band and exposes no format reasons", () => {
    const rec = generateRecommendation(baseReport());
    expect(rec.severity).toBe("safe");
    expect(rec.formatScore).toBeLessThanOrEqual(25);
    expect(rec.formatReasons.length).toBe(0);
    expect(rec.tryFirst.length).toBeGreaterThan(0); // always offers cleanmgr/sfc/dism
    expect(rec.afterFormat.length).toBeGreaterThan(0);
    expect(rec.healthPillars.map((p) => p.id)).toEqual([
      "cleanup",
      "security",
      "performance",
      "backup"
    ]);
  });

  it("low disk free + memory pressure pushes into watch / organize", () => {
    const rec = generateRecommendation(
      baseReport({
        disks: [{ drive: "C:", sizeGb: 500, freeGb: 25 }],
        memoryPressure: {
          totalMemoryMb: 8192,
          freeMemoryMb: 800,
          freeMemoryPercent: 9.8,
          pageFileTotalMb: 4096,
          pageFileUsedMb: 3700,
          pageFileUsagePercent: 90.3
        }
      })
    );
    expect(rec.formatScore).toBeGreaterThan(15);
    expect(rec.formatReasons.some((r) => r.signal === "disk-free")).toBe(true);
    expect(rec.formatReasons.some((r) => r.signal === "memory-pressure")).toBe(true);
    const performance = rec.healthPillars.find((p) => p.id === "performance");
    expect(performance?.status).not.toBe("good");
  });

  it("unhealthy disk + event criticals + old updates pushes to organize or higher", () => {
    const rec = generateRecommendation(
      baseReport({
        diskHealth: [
          { healthStatus: "Unhealthy", operationalStatus: "Lost Communication", sizeGb: 500, mediaType: "HDD" }
        ],
        eventLog: { windowDays: 7, criticalCount: 12, errorCount: 40 },
        windowsUpdate: { installedHotfixCount: 12, daysSinceLatestHotfix: 200 },
        driverAge: { totalWithDate: 50, olderThan2Years: 45, olderThan2YearsPercent: 90 },
        defender: {
          antivirusEnabled: false,
          realTimeProtectionEnabled: false,
          antivirusSignatureAgeDays: 40,
          lastQuickScanDaysAgo: 60,
          lastFullScanDaysAgo: 365
        },
        storageWaste: {
          userTempGb: 6,
          localAppDataTempGb: 10,
          windowsTempGb: 8,
          windowsOldExists: true,
          windowsOldGb: 12
        },
        disks: [{ drive: "C:", sizeGb: 256, freeGb: 6 }],
        memoryPressure: {
          totalMemoryMb: 4096,
          freeMemoryMb: 100,
          freeMemoryPercent: 2.4,
          pageFileTotalMb: 2048,
          pageFileUsedMb: 1900,
          pageFileUsagePercent: 92.7
        }
      })
    );
    expect(["organize", "format"]).toContain(rec.severity);
    expect(rec.formatReasons.length).toBeGreaterThanOrEqual(5);
    // disk-health must be the top reason
    expect(rec.formatReasons[0].signal).toBe("disk-health");
    expect(rec.formatReasons[0].help).toMatch(/디스크/);
    expect(rec.formatReasons[0].nextStep).toMatch(/복사/);
  });

  it("score clamps to 0..100", () => {
    const rec = generateRecommendation(
      baseReport({
        diskHealth: [{ healthStatus: "Failed", operationalStatus: "Lost Communication" }],
        disks: [{ drive: "C:", sizeGb: 100, freeGb: 0.5 }],
        eventLog: { windowDays: 7, criticalCount: 100, errorCount: 500 },
        windowsUpdate: { installedHotfixCount: 1, daysSinceLatestHotfix: 9999 },
        driverAge: { totalWithDate: 100, olderThan2Years: 100, olderThan2YearsPercent: 100 },
        defender: {
          antivirusEnabled: false,
          realTimeProtectionEnabled: false,
          antivirusSignatureAgeDays: 9999,
          lastQuickScanDaysAgo: 9999,
          lastFullScanDaysAgo: 9999
        },
        storageWaste: {
          userTempGb: 999,
          localAppDataTempGb: 999,
          windowsTempGb: 999,
          windowsOldExists: true,
          windowsOldGb: 999
        },
        memoryPressure: {
          totalMemoryMb: 2048,
          freeMemoryMb: 1,
          freeMemoryPercent: 0.05,
          pageFileTotalMb: 1024,
          pageFileUsedMb: 1024,
          pageFileUsagePercent: 100
        }
      })
    );
    expect(rec.formatScore).toBeGreaterThanOrEqual(0);
    expect(rec.formatScore).toBeLessThanOrEqual(100);
  });
});

describe("severity thresholds (v0.5.0 — adopted from design_handoff_format_buddy_app)", () => {
  it("getSeverity maps quartile boundaries correctly", () => {
    expect(__testing.getSeverity(0)).toBe("safe");
    expect(__testing.getSeverity(25)).toBe("safe");
    expect(__testing.getSeverity(26)).toBe("watch");
    expect(__testing.getSeverity(50)).toBe("watch");
    expect(__testing.getSeverity(51)).toBe("organize");
    expect(__testing.getSeverity(75)).toBe("organize");
    expect(__testing.getSeverity(76)).toBe("format");
    expect(__testing.getSeverity(100)).toBe("format");
  });

  it("weights sum to 1.0", () => {
    const total = Object.values(__testing.WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

describe("disk-health override + Defender visibility", () => {
  it("failed disk alone forces at least organize even with low score", () => {
    const rec = generateRecommendation(
      baseReport({
        diskHealth: [{ healthStatus: "Failed", operationalStatus: "Lost Communication" }]
      })
    );
    // dHealth 100 * 0.30 = 30 raw → would map to watch without override
    expect(["organize", "format"]).toContain(rec.severity);
    expect(rec.formatReasons[0].signal).toBe("disk-health");
  });

  it("disabled Defender surfaces as both a reason AND a try-first action", () => {
    const rec = generateRecommendation(
      baseReport({
        defender: {
          antivirusEnabled: false,
          realTimeProtectionEnabled: false,
          antivirusSignatureAgeDays: 40,
          lastQuickScanDaysAgo: 90,
          lastFullScanDaysAgo: 365
        }
      })
    );
    expect(rec.formatReasons.some((r) => r.signal === "defender")).toBe(true);
    const defenderAction = rec.tryFirst.find((a) => a.title.includes("Windows 보안"));
    expect(defenderAction).toBeDefined();
    const security = rec.healthPillars.find((p) => p.id === "security");
    expect(security?.status).toBe("action");
    expect(security?.detail).toMatch(/백신처럼 직접 치료/);
  });

  it("warning disk forces severity into at least watch", () => {
    const rec = generateRecommendation(
      baseReport({
        diskHealth: [{ healthStatus: "Warning", operationalStatus: "OK", sizeGb: 500, mediaType: "SSD" }]
      })
    );
    expect(["watch", "organize", "format"]).toContain(rec.severity);
  });
});
