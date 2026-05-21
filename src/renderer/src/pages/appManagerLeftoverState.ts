export type AppLeftoverPanelMode =
  | "loading-empty"
  | "error-empty"
  | "result-only"
  | "candidate-list"
  | "hidden";

export type AppLeftoverPanelDecision = {
  mode: AppLeftoverPanelMode;
  showCandidates: boolean;
  showResult: boolean;
  heading?: string;
  intro?: string;
  statusMessage?: string;
};

type AppLeftoverPanelStateInput = {
  loading: boolean;
  hasSnapshot: boolean;
  hasResult: boolean;
  error?: string;
};

export function appLeftoverPanelDecision({
  loading,
  hasSnapshot,
  hasResult,
  error
}: AppLeftoverPanelStateInput): AppLeftoverPanelDecision {
  if (loading && !hasSnapshot && !hasResult) {
    return {
      mode: "loading-empty",
      showCandidates: false,
      showResult: false,
      statusMessage: "잔여 항목 후보를 살펴보는 중이에요…"
    };
  }

  if (error && !hasSnapshot && !hasResult) {
    return {
      mode: "error-empty",
      showCandidates: false,
      showResult: false,
      statusMessage: `잔여 항목 확인 중 문제가 생겼어요: ${error}`
    };
  }

  if (!hasSnapshot && hasResult) {
    return {
      mode: "result-only",
      showCandidates: false,
      showResult: true,
      heading: "방금 정리한 내용",
      intro: "잔여 후보 목록이 비어도 정리 결과는 남겨둘게요.",
      statusMessage: loading
        ? "잔여 항목을 다시 확인하는 중이에요. 방금 정리 결과는 그대로 남겨둘게요."
        : error
          ? `잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요. ${error}`
          : undefined
    };
  }

  if (!hasSnapshot) {
    return {
      mode: "hidden",
      showCandidates: false,
      showResult: false
    };
  }

  return {
    mode: "candidate-list",
    showCandidates: true,
    showResult: hasResult,
    statusMessage: loading
      ? hasResult
        ? "잔여 항목을 다시 확인하는 중이에요. 방금 정리 결과는 그대로 남겨둘게요."
        : "잔여 항목을 다시 확인하는 중이에요. 기존 후보는 그대로 남겨둘게요."
      : error
        ? hasResult
          ? `잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요. ${error}`
          : `잔여 항목을 다시 불러오진 못했지만, 기존 후보는 남겨둘게요. ${error}`
        : undefined
  };
}
