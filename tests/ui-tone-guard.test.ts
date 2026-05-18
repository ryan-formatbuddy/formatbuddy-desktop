import { describe, expect, it } from "vitest";
import { copy } from "../src/shared/copy";
import { generateRecommendation } from "../src/main/recommend";
import type { ScanReport } from "../src/shared/types";

function flattenStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      flattenStrings(v, acc);
    }
  }
  return acc;
}

/**
 * Phrases FormatBuddy must never say. These claim outcomes (cure, fix,
 * remove malware) we never actually performed, or use anti-virus language
 * that overstates what Windows Defender did. Some are also style violations
 * from web/CLAUDE.md ("스캔 완료").
 *
 * Each rule has an optional `unless` regex — when present, a match is
 * forgiven if it is immediately followed/preceded by a negation phrase.
 * That way "자동 삭제하지 않아요" stays allowed while "자동 삭제 완료"
 * still trips.
 */
interface BannedRule {
  id: string;
  pattern: RegExp;
  unless?: RegExp;
}

const BANNED_PHRASES: BannedRule[] = [
  { id: "claim:치료 완료", pattern: /치료\s*(완료|됨|했어요)/ },
  { id: "claim:감염 발견", pattern: /감염\s*(발견|확인)/ },
  { id: "claim:바이러스 제거", pattern: /바이러스\s*제거/ },
  { id: "claim:악성코드 제거", pattern: /악성코드\s*제거/ },
  { id: "claim:악성코드 치료", pattern: /악성코드를?\s*치료/ },
  { id: "style:스캔 완료", pattern: /스캔\s*완료/ },
  { id: "style:심각한 상태", pattern: /심각한\s*상태/ },
  { id: "style:리셋/초기화 약속", pattern: /PC를?\s*(리셋|초기화)/ },
  { id: "promise:자동 삭제", pattern: /자동\s*삭제/, unless: /(않|하지\s*않|안\s*해|하지는\s*않)/ },
  { id: "promise:자동 처리", pattern: /자동\s*처리/, unless: /(않|하지\s*않|안\s*해)/ },
  { id: "promise:100점/만점", pattern: /(100점|만점)\s*(달성|완료|확보)/ },
  { id: "promise:필수입니다", pattern: /필수입니다/ }
];

function checkPhrases(haystack: string[], rule: BannedRule): { hit: string; context: string }[] {
  const hits: { hit: string; context: string }[] = [];
  for (const text of haystack) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    if (rule.unless) {
      // search the whole text for the forgiveness pattern
      if (rule.unless.test(text)) continue;
    }
    hits.push({ hit: match[0], context: text });
  }
  return hits;
}

describe("UI tone guard — copy.ts must not overpromise", () => {
  const haystack = flattenStrings(copy);

  it.each(BANNED_PHRASES)(
    "$id is never spoken in copy.ts",
    (rule) => {
      const hits = checkPhrases(haystack, rule);
      if (hits.length > 0) {
        const formatted = hits
          .map((h) => `  - "${h.hit}" in: ${h.context}`)
          .join("\n");
        throw new Error(`Banned phrase ${rule.id} found:\n${formatted}`);
      }
    }
  );

  it("copy.ts has enough strings to make the guard meaningful", () => {
    // Sanity check: if someone refactors copy into a thin wrapper, the
    // banned-phrase tests would all trivially pass against an empty
    // haystack. Pin a floor so that doesn't happen silently.
    expect(haystack.length).toBeGreaterThan(50);
  });
});

function neutralReport(): ScanReport {
  return {
    schemaVersion: "tone-guard-test",
    generatedAt: new Date().toISOString(),
    mode: "quick",
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: { manufacturer: "Mock", model: "Tone", memoryGb: 16 },
    disks: [{ drive: "C:", sizeGb: 500, freeGb: 250 }],
    diskHealth: [{ healthStatus: "Healthy", operationalStatus: "OK" }],
    memoryPressure: { freeMemoryPercent: 50, pageFileUsagePercent: 10 },
    windowsUpdate: { installedHotfixCount: 20, daysSinceLatestHotfix: 5 },
    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 1 },
    driverAge: { totalWithDate: 30, olderThan2Years: 3, olderThan2YearsPercent: 10 },
    startupPrograms: { count: 5, items: [] },
    defender: {
      antivirusEnabled: true,
      realTimeProtectionEnabled: true,
      antivirusSignatureAgeDays: 1,
      lastQuickScanDaysAgo: 2,
      lastFullScanDaysAgo: 10
    },
    storageWaste: {
      userTempGb: 0.1,
      localAppDataTempGb: 0.1,
      windowsTempGb: 0.1,
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

describe("UI tone guard — recommendation output", () => {
  it("care actions never claim FormatBuddy itself treats threats", () => {
    const rec = generateRecommendation(neutralReport());
    const careHaystack = flattenStrings(rec.careActions);
    for (const rule of BANNED_PHRASES) {
      const hits = checkPhrases(careHaystack, rule);
      expect(
        hits,
        `${rule.id} found in careActions: ${JSON.stringify(hits)}`
      ).toEqual([]);
    }
  });
});
