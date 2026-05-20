import type { AppUninstallRequest } from "@shared/types";

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isOptionalDisplayString(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  if (value.length === 0) return true;
  return value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

export function enforceAppUninstallRequestPolicy(
  request: AppUninstallRequest
): AppUninstallRequest {
  if (!isNonEmptyString(request?.appName)) {
    throw new Error("앱 제거 대상을 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.");
  }
  if (!isOptionalDisplayString(request.publisher)) {
    throw new Error("앱 제거 정보를 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.");
  }
  if (request.mode === "quiet") {
    throw new Error(
      "포맷버디는 Windows 제거 창만 열어요. 제거 여부는 직접 확인해주세요."
    );
  }
  if (request.mode !== undefined && request.mode !== "interactive") {
    throw new Error("앱 제거 방식을 확인하지 못했어요. 다시 선택해주세요.");
  }

  return request;
}
