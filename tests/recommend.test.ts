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
    expect(rec.careActions.map((a) => a.id)).toEqual([
      "safe-cleanup",
      "app-uninstall-review",
      "quick-security-scan",
      "realtime-protection-check",
      "startup-review",
      "windows-update-review"
    ]);
    expect(rec.appInventory.total).toBe(0);
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

describe("categoryScores (v2.0 / Round D-4 / B7)", () => {
  it("returns four axes, all 0..100", () => {
    const rec = generateRecommendation(baseReport());
    expect(rec.categoryScores).toEqual(
      expect.objectContaining({
        cleanup: expect.any(Number),
        security: expect.any(Number),
        performance: expect.any(Number),
        disk: expect.any(Number)
      })
    );
    for (const v of Object.values(rec.categoryScores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("healthy PC reports near-zero on every axis", () => {
    const rec = generateRecommendation(baseReport());
    expect(rec.categoryScores.cleanup).toBeLessThanOrEqual(25);
    expect(rec.categoryScores.security).toBeLessThanOrEqual(25);
    expect(rec.categoryScores.performance).toBeLessThanOrEqual(25);
    expect(rec.categoryScores.disk).toBeLessThanOrEqual(25);
  });

  it("disabled Defender drives security high but leaves disk alone", () => {
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
    expect(rec.categoryScores.security).toBeGreaterThanOrEqual(60);
    expect(rec.categoryScores.disk).toBeLessThanOrEqual(25);
  });

  it("low disk free pushes both performance and disk axes", () => {
    const rec = generateRecommendation(
      baseReport({
        disks: [{ drive: "C:", sizeGb: 256, freeGb: 5 }]
      })
    );
    expect(rec.categoryScores.performance).toBeGreaterThan(40);
    expect(rec.categoryScores.disk).toBeGreaterThan(40);
  });

  it("storage waste shows up on cleanup, not security", () => {
    const rec = generateRecommendation(
      baseReport({
        storageWaste: {
          userTempGb: 12,
          localAppDataTempGb: 0,
          windowsTempGb: 8,
          windowsOldExists: true,
          windowsOldGb: 10
        }
      })
    );
    expect(rec.categoryScores.cleanup).toBeGreaterThan(25);
    expect(rec.categoryScores.security).toBeLessThanOrEqual(25);
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
    expect(security?.detail).toMatch(/위협을 직접 처리/);
    expect(rec.careActions.find((a) => a.id === "quick-security-scan")?.status).toBe("warning");
    expect(rec.careActions.find((a) => a.id === "realtime-protection-check")?.status).toBe("warning");
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

describe("app inventory classification", () => {
  it("classifies every installed app into a user-facing inventory", () => {
    const rec = generateRecommendation(
      baseReport({
        installedApps: [
          { name: "Google Chrome", publisher: "Google", version: "126" },
          { name: "KakaoTalk", publisher: "Kakao" },
          { name: "Adobe Creative Cloud", publisher: "Adobe" },
          { name: "Hancom Office", publisher: "Hancom" },
          { name: "Steam", publisher: "Valve" },
          { name: "Visual Studio Code", publisher: "Microsoft" },
          { name: "Realtek Audio Driver", publisher: "Realtek" },
          { name: "Unknown Business Tool", publisher: "Acme" }
        ]
      })
    );

    expect(rec.appInventory.total).toBe(8);
    expect(rec.appInventory.classified).toBe(7);
    expect(rec.appInventory.needsCheck).toBeGreaterThanOrEqual(7);
    expect(rec.appInventory.groups.flatMap((g) => g.items).map((i) => i.name)).toEqual(
      expect.arrayContaining([
        "Google Chrome",
        "KakaoTalk",
        "Adobe Creative Cloud",
        "Hancom Office",
        "Steam",
        "Visual Studio Code",
        "Realtek Audio Driver",
        "Unknown Business Tool"
      ])
    );
    expect(rec.appInventory.groups.find((g) => g.category === "browser")?.count).toBe(1);
    expect(rec.appInventory.groups.find((g) => g.category === "messenger")?.count).toBe(1);
    expect(rec.appInventory.groups.find((g) => g.category === "unknown")?.items[0].attention).toBe("reinstall");
  });
});

describe("buddy checklist", () => {
  it("renders all 15 checklist items with safe default statuses", () => {
    const rec = generateRecommendation(baseReport());
    expect(rec.buddyChecklist).toHaveLength(15);
    expect(rec.buddyChecklist.map((i) => i.id)).toContain("certificate-backed-up");
    expect(rec.buddyChecklist.map((i) => i.id)).toContain("security-scan-ready");
    expect(rec.buddyChecklist.every((i) => i.label && i.helperText && i.guide.length >= 2)).toBe(true);

    expect(rec.buddyChecklist.find((i) => i.id === "certificate-backed-up")?.status).toBe("confirmed");
    expect(rec.buddyChecklist.find((i) => i.id === "security-scan-ready")?.status).toBe("confirmed");
    expect(rec.buddyChecklist.find((i) => i.id === "windows-backup-settings-ready")?.status).toBe("unknown");
  });

  it("marks user-owned or sensitive items as direct-check / warning instead of over-confirming", () => {
    const rec = generateRecommendation(
      baseReport({
        userFolders: [
          { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 2 },
          { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 8 },
          { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 82 }
        ],
        npkiCandidates: [
          { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
          { path: "C:\\NPKI", exists: true }
        ],
        cloudSync: [{ provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true }],
        installedApps: [
          { name: "KakaoTalk", publisher: "Kakao" },
          { name: "Adobe Creative Cloud", publisher: "Adobe" },
          { name: "Hancom Office", publisher: "Hancom" }
        ],
        appDataCandidates: [
          {
            app: "KakaoTalk",
            path: "C:\\Users\\Ryan\\AppData\\Roaming\\KakaoTalk",
            exists: true,
            sizeGb: 7
          }
        ],
        mailDataFiles: [
          { path: "C:\\Users\\Ryan\\Documents\\Outlook Files\\old.pst", extension: ".pst", sizeGb: 8 }
        ],
        browsers: [
          {
            name: "Chrome",
            installed: true,
            profileExists: true,
            bookmarksFileExists: true
          },
          {
            name: "Edge",
            installed: true,
            profileExists: true,
            bookmarksFileExists: false
          }
        ],
        defender: {
          antivirusEnabled: false,
          realTimeProtectionEnabled: false,
          antivirusSignatureAgeDays: 10,
          lastQuickScanDaysAgo: 90,
          lastFullScanDaysAgo: 365
        }
      })
    );

    expect(rec.buddyChecklist.find((i) => i.id === "certificate-backed-up")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "personal-folders-reviewed")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "browser-backup-ready")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "messenger-backup-ready")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "mail-outlook-backed-up")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "paid-app-license-ready")?.status).toBe("warning");
    expect(rec.buddyChecklist.find((i) => i.id === "security-scan-ready")?.status).toBe("warning");
  });

  it("adds safe management actions for cleanup, deletion review, scan, and realtime protection", () => {
    const rec = generateRecommendation(
      baseReport({
        installedApps: Array.from({ length: 90 }, (_, i) => ({ name: `App ${i}` })),
        storageWaste: {
          userTempGb: 12,
          localAppDataTempGb: 0,
          windowsTempGb: 5,
          windowsOldExists: true,
          windowsOldGb: 7
        },
        startupPrograms: { count: 18, items: [] },
        windowsUpdate: { installedHotfixCount: 10, daysSinceLatestHotfix: 95 },
        defender: {
          antivirusEnabled: true,
          realTimeProtectionEnabled: true,
          antivirusSignatureAgeDays: 1,
          lastQuickScanDaysAgo: 30,
          lastFullScanDaysAgo: 60
        }
      })
    );

    expect(rec.careActions.find((a) => a.id === "safe-cleanup")?.status).toBe("check");
    expect(rec.careActions.find((a) => a.id === "app-uninstall-review")?.status).toBe("check");
    expect(rec.careActions.find((a) => a.id === "quick-security-scan")?.command).toBe("start windowsdefender:");
    expect(rec.careActions.find((a) => a.id === "quick-security-scan")?.command).not.toMatch(/Start-MpScan|PowerShell/i);
    expect(rec.careActions.find((a) => a.id === "windows-update-review")?.status).toBe("warning");
    expect(rec.careActions.every((a) => /자동 삭제|승인 없는 삭제|직접 처리|상주 감시|Ryan이 직접|끄기|선택/.test(a.safetyNote))).toBe(true);
  });

  it("builds a cleanup center from temporary files, large files, duplicate candidates, and startup apps", () => {
    const rec = generateRecommendation(
      baseReport({
        storageWaste: {
          userTempGb: 3,
          localAppDataTempGb: 2,
          windowsTempGb: 1,
          windowsOldExists: true,
          windowsOldGb: 8
        },
        largeFiles: [
          {
            name: "old-installer.exe",
            path: "C:\\Users\\Ryan\\Downloads\\old-installer.exe",
            folderName: "Downloads",
            extension: ".exe",
            kind: "installer",
            sizeGb: 2.4
          }
        ],
        duplicateFileCandidates: [
          {
            name: "backup.zip",
            sizeGb: 1.1,
            count: 3,
            totalWastedGb: 2.2,
            paths: [
              "C:\\Users\\Ryan\\Downloads\\backup.zip",
              "C:\\Users\\Ryan\\Desktop\\backup.zip",
              "C:\\Users\\Ryan\\Documents\\backup.zip"
            ]
          }
        ],
        startupPrograms: {
          count: 10,
          items: [
            { name: "KakaoTalk", location: "HKCU Run", user: "Ryan" },
            { name: "OneDrive", location: "HKCU Run", user: "Ryan" },
            { name: "Adobe Creative Cloud", location: "Startup Folder", user: "Ryan" },
            { name: "Steam", location: "HKCU Run", user: "Ryan" },
            { name: "Teams", location: "HKCU Run", user: "Ryan" },
            { name: "Discord", location: "HKCU Run", user: "Ryan" },
            { name: "Launcher", location: "HKCU Run", user: "Ryan" },
            { name: "Helper", location: "HKCU Run", user: "Ryan" },
            { name: "Updater", location: "HKCU Run", user: "Ryan" }
          ]
        }
      })
    );

    expect(rec.cleanupCenter.candidates.map((c) => c.id)).toEqual([
      "temporary-files",
      "windows-old",
      "large-files",
      "duplicate-files",
      "startup-apps"
    ]);
    expect(rec.cleanupCenter.reclaimableGb).toBe(16.2);
    expect(rec.cleanupCenter.reviewCount).toBe(5);
    expect(rec.cleanupCenter.largeFiles[0]?.name).toBe("old-installer.exe");
    expect(rec.cleanupCenter.duplicateGroups[0]?.name).toBe("backup.zip");
    expect(rec.cleanupCenter.startupItems).toHaveLength(9);
    expect(rec.cleanupCenter.candidates.find((c) => c.id === "duplicate-files")?.safetyNote).toMatch(/후보/);
    expect(rec.cleanupCenter.candidates.every((c) => !/자동으로 지웠|삭제 완료/.test(`${c.evidence} ${c.action} ${c.safetyNote}`))).toBe(true);
  });
});
