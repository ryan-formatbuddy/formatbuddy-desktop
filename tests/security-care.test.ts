import { describe, expect, it } from "vitest";
import { buildSecurityCareSummary } from "../src/shared/security-care";
import type { DefenderLiveStatus } from "../src/shared/types";

function liveStatus(overrides: Partial<DefenderLiveStatus> = {}): DefenderLiveStatus {
  return {
    capturedAt: "2026-05-21T00:00:00.000Z",
    available: true,
    antivirusEnabled: true,
    realTimeProtectionEnabled: true,
    tamperProtectionEnabled: true,
    cloudProtection: "advanced",
    puaProtection: "enabled",
    controlledFolderAccess: "enabled",
    networkProtection: "enabled",
    signatureAgeDays: 1,
    lastQuickScanDaysAgo: 2,
    lastFullScanDaysAgo: 12,
    ...overrides
  };
}

describe("buildSecurityCareSummary", () => {
  it("keeps loading and unavailable states friendly", () => {
    expect(buildSecurityCareSummary(undefined).title).toContain("불러오는 중");

    const summary = buildSecurityCareSummary({
      capturedAt: "2026-05-21T00:00:00.000Z",
      available: false,
      unavailableReason: "Windows 보안 상태를 가져오지 못했어요."
    });

    expect(summary.level).toBe("check");
    expect(summary.title).toContain("직접 확인");
    expect(summary.items[0].action).toBe("Windows 보안 열기");
  });

  it("prioritizes disabled core protection as attention", () => {
    const summary = buildSecurityCareSummary(
      liveStatus({
        antivirusEnabled: false,
        realTimeProtectionEnabled: false
      })
    );

    expect(summary.level).toBe("attention");
    expect(summary.title).toContain("먼저 확인");
    expect(summary.items.map((item) => item.id)).toEqual([
      "antivirus-off",
      "realtime-off"
    ]);
  });

  it("recommends stale update and scan checks without antivirus cure claims", () => {
    const summary = buildSecurityCareSummary(
      liveStatus({
        signatureAgeDays: 9,
        lastQuickScanDaysAgo: 45,
        lastFullScanDaysAgo: 120
      })
    );
    const flatCopy = JSON.stringify(summary);

    expect(summary.level).toBe("check");
    expect(summary.items.map((item) => item.id)).toContain("signature-stale");
    expect(summary.items.map((item) => item.id)).toContain("quick-scan-stale");
    expect(summary.items.map((item) => item.id)).toContain("full-scan-stale");
    expect(flatCopy).not.toMatch(/치료|감염 발견|바이러스 제거|악성코드 제거|스캔 완료/);
  });

  it("adds optional protection checks and caps visible items", () => {
    const summary = buildSecurityCareSummary(
      liveStatus({
        signatureAgeDays: 12,
        lastQuickScanDaysAgo: 60,
        puaProtection: "disabled",
        controlledFolderAccess: "disabled",
        networkProtection: "disabled",
        lastFullScanDaysAgo: 180
      })
    );

    expect(summary.items).toHaveLength(5);
    expect(summary.items.map((item) => item.id)).toEqual([
      "signature-stale",
      "quick-scan-stale",
      "pua-off",
      "folder-protection-off",
      "network-protection-off"
    ]);
  });

  it("returns a calm ok summary when Windows security looks current", () => {
    const summary = buildSecurityCareSummary(liveStatus());

    expect(summary.level).toBe("ok");
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].id).toBe("security-ok");
  });
});
