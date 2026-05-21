import { describe, expect, it } from "vitest";
import { buildRescanInsight } from "../src/shared/rescan-insight";
import type { ScanHistoryComparison, ScanHistoryEntry } from "../src/shared/types";

function entry(overrides: Partial<ScanHistoryEntry>): ScanHistoryEntry {
  return {
    id: "scan",
    generatedAt: "2026-05-21T00:00:00.000Z",
    score: 50,
    severity: "watch",
    headline: "mock",
    reclaimableGb: 5,
    reviewCount: 2,
    directCheckCount: 1,
    warningCount: 0,
    installedAppCount: 10,
    largeFileCount: 1,
    duplicateGroupCount: 0,
    startupCount: 2,
    ...overrides
  };
}

function comparison(current: ScanHistoryEntry, previous: ScanHistoryEntry): ScanHistoryComparison {
  return {
    current,
    previous,
    scoreDelta: current.score - previous.score,
    reclaimableDeltaGb: Math.round((current.reclaimableGb - previous.reclaimableGb) * 10) / 10,
    directCheckDelta: current.directCheckCount - previous.directCheckCount,
    warningDelta: current.warningCount - previous.warningCount
  };
}

describe("buildRescanInsight", () => {
  it("celebrates when a later scan drops from organize/format into a manageable tier", () => {
    const insight = buildRescanInsight(
      comparison(
        entry({ id: "current", score: 38, severity: "watch", reclaimableGb: 2.1 }),
        entry({ id: "previous", score: 68, severity: "organize", reclaimableGb: 12.6 })
      )
    );

    expect(insight?.tone).toBe("better");
    expect(insight?.title).toBe("정리만으로 충분해졌어요");
    expect(insight?.detail).toContain("지난 점검보다 30점");
    expect(insight?.scoreLabel).toBe("-30점");
    expect(insight?.cleanupLabel).toBe("-10.5GB");
  });

  it("shows a calmer win when cleanup candidates shrink even if the score barely moves", () => {
    const insight = buildRescanInsight(
      comparison(
        entry({ id: "current", score: 42, severity: "watch", reclaimableGb: 1.5 }),
        entry({ id: "previous", score: 43, severity: "watch", reclaimableGb: 6.2 })
      )
    );

    expect(insight?.tone).toBe("better");
    expect(insight?.title).toBe("정리 후보가 줄었어요");
    expect(insight?.detail).toContain("4.7GB 줄었어요");
  });

  it("keeps worsening scans honest without scary or antivirus-like claims", () => {
    const insight = buildRescanInsight(
      comparison(
        entry({ id: "current", score: 55, severity: "organize", reclaimableGb: 9.2 }),
        entry({ id: "previous", score: 32, severity: "watch", reclaimableGb: 4.1 })
      )
    );
    const flat = JSON.stringify(insight);

    expect(insight?.tone).toBe("needs-care");
    expect(insight?.title).toBe("조금 더 챙겨볼게요");
    expect(flat).not.toMatch(/치료|감염 발견|바이러스 제거|악성코드 제거|스캔 완료|영구 삭제|자동 삭제/);
  });

  it("does not invent an insight for the first recorded scan", () => {
    expect(buildRescanInsight({ current: entry({ id: "current" }) })).toBeUndefined();
  });
});
