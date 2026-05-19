import type { CleanupExecuteRequest } from "@shared/types";

export function enforceProductCleanupPolicy(
  request: CleanupExecuteRequest
): CleanupExecuteRequest {
  if (request.mode === "permanent") {
    throw new Error(
      "포맷버디는 바로 영구 삭제하지 않아요. 선택한 항목은 30일 복구함으로만 보낼 수 있어요."
    );
  }

  return request;
}
