import type { CleanupExecuteRequest } from "@shared/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function enforceProductCleanupPolicy(
  request: CleanupExecuteRequest
): CleanupExecuteRequest {
  if (!isNonEmptyString(request?.planId) || !isNonEmptyString(request?.confirmationToken)) {
    throw new Error("정리 계획을 확인하지 못했어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (
    !Array.isArray(request.selectedItemIds) ||
    request.selectedItemIds.length === 0 ||
    !request.selectedItemIds.every(isNonEmptyString)
  ) {
    throw new Error("선택한 항목을 확인하지 못했어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (request.mode === "permanent") {
    throw new Error(
      "포맷버디는 바로 영구 삭제하지 않아요. 선택한 항목은 30일 복구함으로만 보낼 수 있어요."
    );
  }
  if (request.mode !== "trash") {
    throw new Error("포맷버디 정리는 30일 복구함으로 보내는 방식만 지원해요.");
  }

  return request;
}
