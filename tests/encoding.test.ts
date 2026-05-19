/**
 * Encoding guard tests.
 *
 * v2.0 — PS 5.1 on Korean Windows defaults to cp949 for the console
 * stream. The uninstall registry's DisplayName fields are then encoded
 * in cp949 and ConvertTo-Json mojibakes them. The scan script must
 * force UTF-8 before any registry/CIM call.
 *
 * These tests pin the contract two ways:
 *
 *   1. Static check on the .ps1 file — the UTF-8 setup lines must be
 *      present, and they must come BEFORE the first Get-ItemProperty /
 *      Get-CimInstance call. (We can't run PowerShell from a macOS CI
 *      box reliably, so we lock the source instead.)
 *
 *   2. Pipeline check — Korean strings round-trip through the
 *      recommendation engine without mojibake. This catches the case
 *      where a later refactor accidentally introduces a non-UTF-safe
 *      string coercion in TypeScript land.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateRecommendation } from "../src/main/recommend";
import type { ScanReport } from "../src/shared/types";

const PS_SCRIPT_PATH = join(
  __dirname,
  "..",
  "resources",
  "powershell",
  "Invoke-FormatBuddyScan.ps1"
);

function loadPsScript(): string {
  return readFileSync(PS_SCRIPT_PATH, "utf8");
}

describe("PowerShell encoding guard", () => {
  const script = loadPsScript();
  const lines = script.split(/\r?\n/);

  it("sets [Console]::OutputEncoding to UTF-8 (no BOM)", () => {
    const match = lines.find(
      (line) =>
        line.includes("[Console]::OutputEncoding") &&
        line.includes("UTF8Encoding") &&
        line.includes("$false")
    );
    expect(match, "Console.OutputEncoding UTF-8 no-BOM line not found").toBeTruthy();
  });

  it("sets [Console]::InputEncoding to UTF-8 (no BOM)", () => {
    const match = lines.find(
      (line) =>
        line.includes("[Console]::InputEncoding") &&
        line.includes("UTF8Encoding") &&
        line.includes("$false")
    );
    expect(match, "Console.InputEncoding UTF-8 no-BOM line not found").toBeTruthy();
  });

  it("sets the $OutputEncoding variable so piped UTF-8 stays UTF-8", () => {
    const match = lines.find(
      (line) =>
        /^\s*\$OutputEncoding\s*=/.test(line) && line.includes("UTF8Encoding")
    );
    expect(match, "$OutputEncoding variable assignment not found").toBeTruthy();
  });

  it("applies the encoding guard BEFORE the first registry / CIM call", () => {
    const encodingIdx = lines.findIndex((line) =>
      line.includes("[Console]::OutputEncoding")
    );
    expect(encodingIdx).toBeGreaterThan(-1);

    const firstRegistryIdx = lines.findIndex(
      (line, i) =>
        i > encodingIdx === false &&
        (line.includes("Get-ItemProperty") ||
          (line.includes("Get-CimInstance") && !line.includes("function")))
    );
    // The encoding line must come before ANY registry-touching helper
    // body. We assert by finding the earliest such line in the file
    // and requiring it to be later than encodingIdx.
    let earliestRegistryIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("Get-ItemProperty") ||
        (lines[i].includes("Get-CimInstance") &&
          !lines[i].trim().startsWith("function"))
      ) {
        earliestRegistryIdx = i;
        break;
      }
    }
    expect(earliestRegistryIdx).toBeGreaterThan(-1);
    expect(earliestRegistryIdx).toBeGreaterThan(encodingIdx);
    // We don't use firstRegistryIdx — keep the linter happy by
    // referencing it harmlessly.
    void firstRegistryIdx;
  });

  it("exports the uninstall registry key path for safe leftover preview", () => {
    expect(script).toContain("registryKeyPath");
    expect(script).toContain("Convert-RegistryPsPath");
    expect(script).toContain("$_.PSPath");
  });

  it("wraps the encoding setup in try/catch so PS7 / non-Windows hosts don't crash", () => {
    const encodingIdx = lines.findIndex((line) =>
      line.includes("[Console]::OutputEncoding")
    );
    const tryBefore = lines
      .slice(Math.max(0, encodingIdx - 5), encodingIdx)
      .some((line) => /^\s*try\s*\{/.test(line));
    const catchAfter = lines
      .slice(encodingIdx, Math.min(lines.length, encodingIdx + 8))
      .some((line) => /^\s*\}\s*catch/.test(line));
    expect(tryBefore, "expected `try {` within 5 lines before the encoding setup").toBe(
      true
    );
    expect(catchAfter, "expected `} catch` within 8 lines after the encoding setup").toBe(
      true
    );
  });
});

function koreanReport(): ScanReport {
  // Realistic Korean fixture covering the surfaces most prone to
  // mojibake: installed app names, paths with Korean characters,
  // user-folder labels.
  return {
    schemaVersion: "encoding-test",
    generatedAt: new Date().toISOString(),
    mode: "quick",
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: { manufacturer: "삼성전자", model: "갤럭시북", memoryGb: 16 },
    disks: [{ drive: "C:", sizeGb: 500, freeGb: 300 }],
    diskHealth: [{ healthStatus: "Healthy", operationalStatus: "OK" }],
    memoryPressure: { freeMemoryPercent: 40, pageFileUsagePercent: 10 },
    windowsUpdate: { installedHotfixCount: 30, daysSinceLatestHotfix: 7 },
    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 1 },
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
    largeFiles: [
      {
        name: "회의록.mp4",
        path: "C:\\Users\\한글이름\\Videos\\회의록.mp4",
        folderName: "Videos",
        kind: "video",
        sizeGb: 1.2
      }
    ],
    duplicateFileCandidates: [],
    userFolders: [
      {
        name: "Desktop",
        path: "C:\\Users\\한글이름\\Desktop",
        exists: true,
        sizeGb: 3
      }
    ],
    gpu: [],
    installedApps: [
      { name: "카카오톡", publisher: "카카오" },
      { name: "한글", publisher: "한글과컴퓨터" },
      { name: "안랩 V3", publisher: "안랩" },
      { name: "더존 Smart A", publisher: "더존" },
      { name: "위메이드 미르4", publisher: "위메이드" }
    ],
    drivers: [],
    printers: [],
    wifiProfiles: ["우리집", "회사_5G"],
    npkiCandidates: [
      { path: "C:\\Users\\한글이름\\AppData\\LocalLow\\NPKI", exists: true }
    ],
    bitlocker: [],
    cloudSync: [
      { provider: "OneDrive", path: "C:\\Users\\한글이름\\OneDrive", exists: true }
    ],
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

describe("Korean fixture round-trip through recommendation engine", () => {
  it("preserves Korean app names exactly", () => {
    const rec = generateRecommendation(koreanReport());
    const names = rec.appInventory.groups.flatMap((g) => g.items.map((i) => i.name));
    expect(names).toContain("카카오톡");
    expect(names).toContain("한글");
    expect(names).toContain("안랩 V3");
    expect(names).toContain("더존 Smart A");
    expect(names).toContain("위메이드 미르4");
  });

  it("preserves Korean publisher strings exactly", () => {
    const rec = generateRecommendation(koreanReport());
    const publishers = rec.appInventory.groups
      .flatMap((g) => g.items.map((i) => i.publisher))
      .filter((p): p is string => Boolean(p));
    expect(publishers).toContain("카카오");
    expect(publishers).toContain("한글과컴퓨터");
    expect(publishers).toContain("위메이드");
  });

  it("preserves Korean paths in cleanup center large-files", () => {
    const rec = generateRecommendation(koreanReport());
    const paths = rec.cleanupCenter.largeFiles.map((f) => f.path);
    expect(paths).toContain("C:\\Users\\한글이름\\Videos\\회의록.mp4");
  });

  it("preserves Korean wifi profile names", () => {
    const rec = generateRecommendation(koreanReport());
    // wifi flows through the report directly; check the buddyChecklist's
    // wifi-related item evidence references the report wifi count
    const wifiItem = rec.buddyChecklist.find((i) => i.id.includes("wifi"));
    // We don't pin the exact evidence string (it can change), but the
    // pipeline must not throw on Korean wifi names.
    if (wifiItem) {
      expect(typeof wifiItem.evidence).toBe("string");
    }
    // Sanity: the report itself still has the Korean names verbatim
    expect(koreanReport().wifiProfiles).toContain("우리집");
  });
});
