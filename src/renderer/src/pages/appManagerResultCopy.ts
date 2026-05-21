import { summarizeLeftoverSnapshot } from "@shared/app-leftovers";
import {
  preservedRegistryBackupIds,
  preservedScheduledTaskBackupIds,
  recoverableRegistryBackupIds,
  recoverableScheduledTaskBackupIds,
  restorableStartupDisabledIds,
  restorableTrashEntryIds
} from "@shared/cleanup-result";
import type { AppLeftoversSnapshot, CleanupExecuteResult } from "@shared/types";

export type RestoreBinBreakdownRow = {
  label: string;
  count: number;
  detail: string;
};

export type LeftoverEffectSummary = ReturnType<typeof summarizeLeftoverSnapshot>;

export function appLeftoverResultLines(
  result: CleanupExecuteResult,
  now = Date.now()
): string[] {
  const fileOrFolderCount = restorableTrashEntryIds(result, now).length;
  const backupCount = recoverableRegistryBackupIds(result, now).length;
  const startupCount = restorableStartupDisabledIds(result, now).length;
  const scheduledTaskCount = recoverableScheduledTaskBackupIds(result, now).length;
  const untouchedCount =
    result.removedItems.filter((item) => !item.succeeded).length +
    result.skippedItems.filter((item) => item.reason !== "not-selected").length;
  const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length;
  const lines: string[] = [];

  if (fileOrFolderCount > 0) {
    lines.push(`잔여 파일/폴더 ${fileOrFolderCount}개는 복구함에 30일 동안 보관해요.`);
  }
  if (backupCount > 0) {
    lines.push(`앱 연결 흔적과 Windows 연결 흔적 백업 ${backupCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (startupCount > 0) {
    lines.push(`잠시 꺼둔 시작 항목 ${startupCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (scheduledTaskCount > 0) {
    lines.push(`예약 작업 ${scheduledTaskCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (untouchedCount > 0) {
    lines.push(`건드리지 않은 항목 ${untouchedCount}개는 그대로 뒀어요.`);
  }
  if (notSelectedCount > 0) {
    lines.push(`선택하지 않은 후보 ${notSelectedCount}개는 그대로 남겨뒀어요.`);
  }

  return lines;
}

export function appLeftoverEffectLines({
  beforeSummary,
  afterSnapshot
}: {
  beforeSummary?: LeftoverEffectSummary;
  afterSnapshot?: AppLeftoversSnapshot;
}): string[] {
  if (!beforeSummary) return [];
  if (!afterSnapshot) {
    return ["잔여 후보를 다시 확인하지 못했어요. 방금 정리 결과는 그대로 남겨둘게요."];
  }

  const afterSummary = summarizeLeftoverSnapshot(afterSnapshot);
  const reducedCount = Math.max(0, beforeSummary.total - afterSummary.total);
  const lines = [
    `정리 전 후보 ${beforeSummary.total}개 → 지금 후보 ${afterSummary.total}개`
  ];
  const remainingReasons = [
    compactCount("아직 설치된 앱 데이터", afterSummary.installedLocked),
    compactCount("보호된 항목", afterSummary.protected),
    compactCount("수동 확인 항목", afterSummary.manualCheck),
    compactCount("다시 점검 후 정리 가능", afterSummary.notChecked),
    compactCount("현재 없는 항목", afterSummary.missing)
  ].filter((value): value is string => Boolean(value));

  if (reducedCount > 0) {
    lines.push(`이번 정리로 후보 ${reducedCount}개가 줄었어요.`);
  } else {
    lines.push("이번 정리 후에도 후보 수는 그대로예요. 남은 항목은 아래 이유를 확인해주세요.");
  }

  if (remainingReasons.length > 0) {
    lines.push(`남은 후보: ${remainingReasons.join(" · ")}`);
  } else {
    lines.push("남은 후보가 없어요.");
  }

  return lines;
}

export function appLeftoverRestoreBinBreakdown(
  result: CleanupExecuteResult,
  now = Date.now()
): RestoreBinBreakdownRow[] {
  const fileOrFolderCount = restorableTrashEntryIds(result, now).length;
  const backupCount = recoverableRegistryBackupIds(result, now).length;
  const startupCount = restorableStartupDisabledIds(result, now).length;
  const scheduledTaskCount = recoverableScheduledTaskBackupIds(result, now).length;

  return [
    {
      label: "파일·폴더",
      count: fileOrFolderCount,
      detail: "복구함에서 원래 자리로 되돌릴 수 있어요."
    },
    {
      label: "앱·Windows 연결 흔적",
      count: backupCount,
      detail: "앱 연결과 Windows 연결 백업을 30일 동안 챙겨요."
    },
    {
      label: "시작 항목",
      count: startupCount,
      detail: "잠시 꺼둔 시작 항목을 다시 켤 수 있어요."
    },
    {
      label: "예약 작업",
      count: scheduledTaskCount,
      detail: "정리한 예약 작업 백업을 되돌릴 수 있어요."
    }
  ].filter((row) => row.count > 0);
}

export function appLeftoverRestorableCount(
  result: CleanupExecuteResult,
  now = Date.now()
): number {
  return (
    restorableTrashEntryIds(result, now).length +
    recoverableRegistryBackupIds(result, now).length +
    restorableStartupDisabledIds(result, now).length +
    recoverableScheduledTaskBackupIds(result, now).length
  );
}

export function friendlyAppLeftoverBlockedDetail(detail?: string): string {
  const text = detail?.trim();
  if (!text) return "보호가 필요한 항목이라 그대로 뒀어요.";
  const lower = text.toLowerCase();

  if (/30-day|30일|expiry|만료/.test(lower)) {
    return "30일 보관 기간을 확인하지 못해서 그대로 뒀어요.";
  }
  if (/복구함 정보/.test(lower)) {
    return "복구함 정보를 확인하지 못해서 그대로 뒀어요.";
  }
  if (/link|symbolic|링크/.test(lower)) {
    return "링크 경로라 안전 확인이 필요해요.";
  }
  if (/access|denied|eacces|eperm|permission|권한/.test(lower)) {
    return "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요.";
  }
  if (/backup|export|reg\.exe|registry|레지스트리/.test(lower)) {
    return "앱 삭제 흔적은 안전하게 확인되지 않아 그대로 뒀어요.";
  }
  const rawInternalDetailPattern = new RegExp(
    ["power\\s?shell", "eno" + "ent", "format" + "buddy", "c:\\\\", "\\/users\\/"].join("|"),
    "i"
  );
  if (rawInternalDetailPattern.test(text)) {
    return "보호가 필요한 항목이라 그대로 뒀어요.";
  }
  if (/startup|holding|hash|integrity|source path|still exists|시작 항목/.test(lower)) {
    return text.includes("시작 항목")
      ? text
      : "시작 항목은 안전하게 보관되지 않아 그대로 뒀어요.";
  }

  return text;
}

export function appLeftoverSkippedMessage(
  item: CleanupExecuteResult["skippedItems"][number]
): string {
  switch (item.reason) {
    case "blocked-path":
      return friendlyAppLeftoverBlockedDetail(item.detail);
    case "access-denied":
      return "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요.";
    case "not-found":
      return "이미 없어져서 건드릴 항목이 없었어요.";
    case "below-min-age":
      return "아직 최근 항목이라 이번에는 그대로 뒀어요.";
    case "execute-failed":
      if (item.registryBackupId && item.expiresAt) {
        return "정리 확인을 끝내지 못했지만 백업은 30일 복구함에 남겨뒀어요.";
      }
      return "정리 중 문제가 생겨서 그대로 뒀어요. 다시 점검 후 한 번 더 시도해주세요.";
    case "not-selected":
    default:
      return "선택하지 않아서 그대로 남겨뒀어요.";
  }
}

export function appLeftoverSkippedPreviewLines(
  result: CleanupExecuteResult
): { path: string; message: string }[] {
  const skipped = result.skippedItems.filter((item) => item.reason !== "not-selected");
  const preview = skipped.slice(0, 4).map((item) => ({
    path: item.path || "확인 필요한 항목",
    message: appLeftoverSkippedMessage(item)
  }));
  const remaining = skipped.length - preview.length;

  if (remaining > 0) {
    preview.push({
      path: "추가 확인",
      message: `${remaining}개는 활동 기록에서 이어서 볼 수 있어요.`
    });
  }

  return preview;
}

export function appLeftoverResultHeadline(
  result: CleanupExecuteResult,
  now = Date.now()
): string {
  const cleanedCount = result.removedItems.filter((item) => item.succeeded).length;
  const preservedBackupCount =
    preservedRegistryBackupIds(result, now).length +
    preservedScheduledTaskBackupIds(result, now).length;
  const restorableCount = appLeftoverRestorableCount(result, now);

  if (cleanedCount > 0 && restorableCount > 0) {
    return `${cleanedCount}개를 정리했고, ${restorableCount}개는 30일 안에 되돌릴 수 있어요.`;
  }
  if (cleanedCount > 0) return `${cleanedCount}개를 정리했어요.`;
  if (preservedBackupCount > 0) {
    return `정리 확인을 끝내지 못했지만 백업 ${preservedBackupCount}개는 30일 안에 되돌릴 수 있어요.`;
  }
  return "이번 정리에서 처리된 항목은 없어요.";
}

function compactCount(label: string, count: number): string | null {
  return count > 0 ? `${label} ${count}개` : null;
}
