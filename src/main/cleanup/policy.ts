import type { AppLeftoversCleanupRequest, CleanupExecuteRequest } from "@shared/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTrimmedString(value: string): boolean {
  return value.trim() === value;
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export function enforceProductCleanupPolicy(
  request: CleanupExecuteRequest
): CleanupExecuteRequest {
  if (!isNonEmptyString(request?.planId) || !isNonEmptyString(request?.confirmationToken)) {
    throw new Error("정리 계획을 확인하지 못했어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (!isTrimmedString(request.planId) || !isTrimmedString(request.confirmationToken)) {
    throw new Error("정리 계획 값에 공백이 있어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (hasControlCharacters(request.planId) || hasControlCharacters(request.confirmationToken)) {
    throw new Error("정리 계획 값에 제어 문자가 있어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (
    !Array.isArray(request.selectedItemIds) ||
    request.selectedItemIds.length === 0 ||
    !request.selectedItemIds.every(isNonEmptyString)
  ) {
    throw new Error("선택한 항목을 확인하지 못했어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (!request.selectedItemIds.every(isTrimmedString)) {
    throw new Error("선택한 항목 값에 공백이 있어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (request.selectedItemIds.some(hasControlCharacters)) {
    throw new Error("선택한 항목 값에 제어 문자가 있어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (hasDuplicates(request.selectedItemIds)) {
    throw new Error("선택한 항목에 중복이 있어요. 정리할 항목을 다시 선택해주세요.");
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

export function enforceAppLeftoversCleanupPolicy(
  request: AppLeftoversCleanupRequest
): AppLeftoversCleanupRequest {
  if (!isNonEmptyString(request?.planId) || !isNonEmptyString(request?.confirmationToken)) {
    throw new Error("앱 잔여 정리 계획을 확인하지 못했어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (!isTrimmedString(request.planId) || !isTrimmedString(request.confirmationToken)) {
    throw new Error("앱 잔여 정리 계획 값에 공백이 있어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (hasControlCharacters(request.planId) || hasControlCharacters(request.confirmationToken)) {
    throw new Error("앱 잔여 정리 계획 값에 제어 문자가 있어요. 다시 점검한 뒤 정리해주세요.");
  }
  if (
    !Array.isArray(request.selectedPathIds) ||
    request.selectedPathIds.length === 0 ||
    !request.selectedPathIds.every(isNonEmptyString)
  ) {
    throw new Error("선택한 앱 잔여 항목을 확인하지 못했어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (!request.selectedPathIds.every(isTrimmedString)) {
    throw new Error("선택한 앱 잔여 항목 값에 공백이 있어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (request.selectedPathIds.some(hasControlCharacters)) {
    throw new Error("선택한 앱 잔여 항목 값에 제어 문자가 있어요. 정리할 항목을 다시 선택해주세요.");
  }
  if (hasDuplicates(request.selectedPathIds)) {
    throw new Error("선택한 앱 잔여 항목에 중복이 있어요. 정리할 항목을 다시 선택해주세요.");
  }

  return request;
}
