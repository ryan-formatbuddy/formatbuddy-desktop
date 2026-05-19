import type { AppUninstallRequest } from "@shared/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

export function enforceAppUninstallRequestPolicy(
  request: AppUninstallRequest
): AppUninstallRequest {
  if (!isNonEmptyString(request?.appName)) {
    throw new Error("앱 제거 대상을 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.");
  }
  if (!isOptionalString(request.publisher)) {
    throw new Error("앱 제거 정보를 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.");
  }
  if (request.mode === "quiet") {
    throw new Error(
      "포맷버디는 Windows 제거 마법사만 띄워요. 제거 여부는 Ryan이 직접 확인해주세요."
    );
  }
  if (request.mode !== undefined && request.mode !== "interactive") {
    throw new Error("앱 제거 방식을 확인하지 못했어요. 다시 선택해주세요.");
  }

  return request;
}
