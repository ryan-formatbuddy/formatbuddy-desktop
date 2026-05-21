import { describe, expect, it } from "vitest";
import { appLeftoverPanelDecision } from "../src/renderer/src/pages/appManagerLeftoverState";

describe("app manager leftover panel state", () => {
  it("shows an empty loading state before any leftover snapshot or result exists", () => {
    expect(
      appLeftoverPanelDecision({ loading: true, hasSnapshot: false, hasResult: false })
    ).toEqual({
      mode: "loading-empty",
      showCandidates: false,
      showResult: false,
      statusMessage: "잔여 항목 후보를 살펴보는 중이에요…"
    });
  });

  it("shows an empty error state before any leftover snapshot or result exists", () => {
    expect(
      appLeftoverPanelDecision({
        loading: false,
        hasSnapshot: false,
        hasResult: false,
        error: "다시 시도해주세요"
      })
    ).toEqual({
      mode: "error-empty",
      showCandidates: false,
      showResult: false,
      statusMessage: "잔여 항목 확인 중 문제가 생겼어요: 다시 시도해주세요"
    });
  });

  it("keeps the cleanup result visible when the refreshed candidate list is empty", () => {
    expect(
      appLeftoverPanelDecision({ loading: false, hasSnapshot: false, hasResult: true })
    ).toEqual({
      mode: "result-only",
      showCandidates: false,
      showResult: true,
      heading: "방금 정리한 내용",
      intro: "잔여 후보 목록이 비어도 정리 결과는 남겨둘게요.",
      statusMessage: undefined
    });
  });

  it("keeps result actions reachable while a result-only refresh is loading", () => {
    expect(
      appLeftoverPanelDecision({ loading: true, hasSnapshot: false, hasResult: true })
    ).toMatchObject({
      mode: "result-only",
      showResult: true,
      statusMessage: "잔여 항목을 다시 확인하는 중이에요. 방금 정리 결과는 그대로 남겨둘게요."
    });
  });

  it("keeps result actions reachable when a result-only refresh fails", () => {
    expect(
      appLeftoverPanelDecision({
        loading: false,
        hasSnapshot: false,
        hasResult: true,
        error: "권한 확인 필요"
      })
    ).toMatchObject({
      mode: "result-only",
      showResult: true,
      statusMessage: "잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요. 권한 확인 필요"
    });
  });

  it("keeps existing candidates visible while refreshing before cleanup", () => {
    expect(
      appLeftoverPanelDecision({ loading: true, hasSnapshot: true, hasResult: false })
    ).toEqual({
      mode: "candidate-list",
      showCandidates: true,
      showResult: false,
      statusMessage: "잔여 항목을 다시 확인하는 중이에요. 기존 후보는 그대로 남겨둘게요."
    });
  });

  it("keeps existing candidates visible when refresh fails before cleanup", () => {
    expect(
      appLeftoverPanelDecision({
        loading: false,
        hasSnapshot: true,
        hasResult: false,
        error: "네트워크 없음"
      })
    ).toEqual({
      mode: "candidate-list",
      showCandidates: true,
      showResult: false,
      statusMessage: "잔여 항목을 다시 불러오진 못했지만, 기존 후보는 남겨둘게요. 네트워크 없음"
    });
  });

  it("keeps both candidates and cleanup result visible during post-cleanup refreshes", () => {
    expect(
      appLeftoverPanelDecision({ loading: true, hasSnapshot: true, hasResult: true })
    ).toEqual({
      mode: "candidate-list",
      showCandidates: true,
      showResult: true,
      statusMessage: "잔여 항목을 다시 확인하는 중이에요. 방금 정리 결과는 그대로 남겨둘게요."
    });
  });

  it("keeps both candidates and cleanup result visible when post-cleanup refresh fails", () => {
    expect(
      appLeftoverPanelDecision({
        loading: false,
        hasSnapshot: true,
        hasResult: true,
        error: "다시 확인 필요"
      })
    ).toEqual({
      mode: "candidate-list",
      showCandidates: true,
      showResult: true,
      statusMessage: "잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요. 다시 확인 필요"
    });
  });

  it("stays hidden when there is no work to show", () => {
    expect(
      appLeftoverPanelDecision({ loading: false, hasSnapshot: false, hasResult: false })
    ).toEqual({
      mode: "hidden",
      showCandidates: false,
      showResult: false
    });
  });
});
