import type { FormatSeverity, ScanHistoryComparison, ScanHistoryEntry } from "./types";

export type RescanInsightTone = "better" | "steady" | "needs-care";

export interface RescanInsight {
  tone: RescanInsightTone;
  title: string;
  detail: string;
  scoreLabel: string;
  cleanupLabel: string;
}

const SEVERITY_RANK: Record<FormatSeverity, number> = {
  safe: 0,
  watch: 1,
  organize: 2,
  format: 3
};

function signedNumber(value: number, suffix: string): string {
  if (value === 0) return `변화 없음${suffix}`;
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${suffix}`;
}

function scoreDelta(comparison: ScanHistoryComparison): number {
  return comparison.scoreDelta ?? comparison.current.score - (comparison.previous?.score ?? comparison.current.score);
}

function cleanupDelta(comparison: ScanHistoryComparison): number {
  return comparison.reclaimableDeltaGb ??
    Math.round((comparison.current.reclaimableGb - (comparison.previous?.reclaimableGb ?? comparison.current.reclaimableGb)) * 10) / 10;
}

function becameManageable(current: ScanHistoryEntry, previous: ScanHistoryEntry): boolean {
  return SEVERITY_RANK[previous.severity] >= SEVERITY_RANK.organize &&
    SEVERITY_RANK[current.severity] <= SEVERITY_RANK.watch;
}

export function buildRescanInsight(comparison?: ScanHistoryComparison): RescanInsight | undefined {
  if (!comparison?.current || !comparison.previous) return undefined;

  const score = scoreDelta(comparison);
  const cleanup = cleanupDelta(comparison);
  const scoreAbs = Math.abs(score).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const cleanupAbs = Math.abs(cleanup).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const severityImproved = SEVERITY_RANK[comparison.current.severity] < SEVERITY_RANK[comparison.previous.severity];

  if (score < 0 && becameManageable(comparison.current, comparison.previous)) {
    return {
      tone: "better",
      title: "정리만으로 충분해졌어요",
      detail: `지난 점검보다 ${scoreAbs}점 가벼워졌어요. 지금 단계라면 포맷보다 남은 항목만 차분히 확인해도 괜찮아요.`,
      scoreLabel: signedNumber(score, "점"),
      cleanupLabel: signedNumber(cleanup, "GB")
    };
  }

  if (score <= -10 || severityImproved) {
    return {
      tone: "better",
      title: "확실히 가벼워졌어요",
      detail: `지난 점검보다 ${scoreAbs}점 좋아졌어요. 정리 뒤 다시 본 결과라면 효과가 꽤 있는 편이에요.`,
      scoreLabel: signedNumber(score, "점"),
      cleanupLabel: signedNumber(cleanup, "GB")
    };
  }

  if (cleanup < 0) {
    return {
      tone: "better",
      title: "정리 후보가 줄었어요",
      detail: `다시 보니 정리 후보가 약 ${cleanupAbs}GB 줄었어요. 점수 변화가 작아도 실제로 챙긴 흔적은 남았어요.`,
      scoreLabel: signedNumber(score, "점"),
      cleanupLabel: signedNumber(cleanup, "GB")
    };
  }

  if (score <= 0) {
    return {
      tone: "steady",
      title: "상태를 잘 유지하고 있어요",
      detail: "지난 점검과 큰 차이는 없어요. 지금은 남은 직접 확인 항목만 천천히 보면 됩니다.",
      scoreLabel: signedNumber(score, "점"),
      cleanupLabel: signedNumber(cleanup, "GB")
    };
  }

  return {
    tone: "needs-care",
    title: "조금 더 챙겨볼게요",
    detail: `지난 점검보다 ${scoreAbs}점 높아졌어요. 새로 생긴 정리 후보나 직접 확인 항목을 먼저 볼게요.`,
    scoreLabel: signedNumber(score, "점"),
    cleanupLabel: signedNumber(cleanup, "GB")
  };
}
