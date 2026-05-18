import { describe, it, expect } from "vitest";
import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildHtmlReport, buildHtmlReportFilename } from "../src/main/htmlReport";
import { generateRecommendation } from "../src/main/recommend";
import type { ScanReport } from "../src/shared/types";

const sampleReport: ScanReport = {
  schemaVersion: "0.4.0-quick-mock",
  generatedAt: "2026-05-18T07:00:00.000Z",
  mode: "quick",
  privacy: {
    localOnly: true,
    noPasswordCollection: true,
    noPrivateKeyUpload: true,
    noBrowserPasswordExtraction: true
  },
  system: {
    manufacturer: "Samsung",
    model: "NT950XBE-X716",
    osCaption: "Windows 11 Pro",
    osVersion: "10.0.22631",
    cpu: "Intel Core i7-1255U",
    memoryGb: 16
  },
  disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 38.4 }],
  diskHealth: [
    {
      friendlyName: "Samsung NVMe SSD 970",
      mediaType: "SSD",
      busType: "NVMe",
      sizeGb: 476.62,
      healthStatus: "Warning",
      operationalStatus: "OK"
    }
  ],
  memoryPressure: {
    totalMemoryMb: 16384,
    freeMemoryMb: 1800,
    freeMemoryPercent: 11,
    pageFileTotalMb: 8192,
    pageFileUsedMb: 6500,
    pageFileUsagePercent: 79.3
  },
  windowsUpdate: { installedHotfixCount: 32, daysSinceLatestHotfix: 95 },
  eventLog: { windowDays: 7, criticalCount: 4, errorCount: 18 },
  driverAge: { totalWithDate: 64, olderThan2Years: 38, olderThan2YearsPercent: 59.4 },
  startupPrograms: { count: 14, items: [] },
  defender: {
    antivirusEnabled: true,
    realTimeProtectionEnabled: true,
    antivirusSignatureAgeDays: 2,
    lastQuickScanDaysAgo: 4,
    lastFullScanDaysAgo: 41
  },
  storageWaste: {
    userTempGb: 4.2,
    localAppDataTempGb: 0,
    windowsTempGb: 2.6,
    windowsOldExists: true,
    windowsOldGb: 14.8
  },
  userFolders: [
    { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 1.4 },
    { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 6.8 },
    { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 42.1 },
    { name: "Pictures", path: "C:\\Users\\Ryan\\Pictures", exists: true, sizeGb: 18.6 },
    { name: "Videos", path: "C:\\Users\\Ryan\\Videos", exists: true, sizeGb: 11.2 },
    { name: "Music", path: "C:\\Users\\Ryan\\Music", exists: true, sizeGb: 0.6 }
  ],
  gpu: ["Intel Iris Xe Graphics"],
  installedApps: [
    { name: "Chrome", version: "131.0", publisher: "Google" },
    { name: "KakaoTalk", version: "3.x", publisher: "Kakao" },
    { name: "Microsoft Office 365", version: "16.x", publisher: "Microsoft" }
  ],
  drivers: [],
  printers: [],
  wifiProfiles: ["home", "office", "cafe-2g"],
  npkiCandidates: [
    { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
    { path: "C:\\NPKI", exists: false }
  ],
  bitlocker: [],
  cloudSync: [
    { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
    { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
  ],
  browsers: [
    { name: "Chrome", installed: true },
    { name: "Edge", installed: true },
    { name: "Firefox", installed: false },
    { name: "Whale", installed: true }
  ],
  winget: { available: true, note: "winget is available." },
  wingetExport: null,
  diagnostics: [],
  checklist: {
    reviewNpkiManually: true,
    exportWifiProfilesManually: true,
    backupDesktopDocumentsDownloads: true,
    verifyCloudSync: true,
    saveReportBeforeFormat: true
  }
};

describe("buildHtmlReport", () => {
  it("renders all five sections + meta", () => {
    const rec = generateRecommendation(sampleReport);
    const html = buildHtmlReport(sampleReport, rec);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('lang="ko"');
    expect(html).toContain("로컬에서만 처리됨");
    expect(html).toContain(rec.headline);
    expect(html).toContain("포맷 전에 먼저 시도해볼 것");
    expect(html).toContain("이런 점들이 신경 쓰여요");
    expect(html).toContain("포맷 후 같이 챙길 것");
    expect(html).toContain("PC 건강 점검");
    expect(html).toContain("깔끔 정리");
    expect(html).toContain("내 파일이 잘 옮겨졌는지 확인하는 목록");
    expect(html).toContain("이 PC");
    // v0.6.2 — 사용자 카피에서 영문 기술 단어 노출 금지
    expect(html).not.toContain("manifest");
    expect(html).not.toContain("schema");
    expect(html).not.toContain("JetBrains Mono");
    // CSP meta blocks remote loads
    expect(html).toMatch(/default-src 'none'/);
  });

  it("filename matches 포맷버디_리포트_YYYY-MM-DD_점.html", () => {
    const rec = generateRecommendation(sampleReport);
    const filename = buildHtmlReportFilename(sampleReport, rec);
    expect(filename).toMatch(/^포맷버디_리포트_\d{4}-\d{2}-\d{2}_\d+점\.html$/);
  });

  it("inlines the Wanted Sans @font-face when fontBase64 provided", () => {
    const rec = generateRecommendation(sampleReport);
    const html = buildHtmlReport(sampleReport, rec, { fontBase64: "AAAA" });
    expect(html).toContain("@font-face");
    expect(html).toContain("data:font/ttf;base64,AAAA");
  });

  it("omits @font-face when fontBase64 is null", () => {
    const rec = generateRecommendation(sampleReport);
    const html = buildHtmlReport(sampleReport, rec, { fontBase64: null });
    expect(html).not.toContain("@font-face");
  });

  it("writes a real sample HTML to dist-samples/ for visual inspection", async () => {
    const rec = generateRecommendation(sampleReport);
    const fontPath = resolve(__dirname, "..", "resources", "fonts", "WantedSansVariable.ttf");
    let fontBase64: string | null = null;
    if (existsSync(fontPath)) {
      const buf = await fs.readFile(fontPath);
      fontBase64 = buf.toString("base64");
    }
    const html = buildHtmlReport(sampleReport, rec, { fontBase64 });
    const outDir = resolve(__dirname, "..", "dist-samples");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, buildHtmlReportFilename(sampleReport, rec));
    await fs.writeFile(outPath, html, "utf8");
    expect(existsSync(outPath)).toBe(true);
    expect(html.length).toBeGreaterThan(5000);
  });
});
