import type { AuditCategory, AuditEntry } from "@shared/types";

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  cleanup: "정리",
  uninstall: "앱 제거",
  defender: "보안 검사",
  monitor: "설정",
  system: "시스템"
};

export const CATEGORY_COLOR: Record<AuditCategory, string> = {
  cleanup: "#0ea5e9",
  uninstall: "#9333ea",
  defender: "#dc2626",
  monitor: "#16a34a",
  system: "#475569"
};

export interface RestoreBinAutoEmptySummary {
  entryCount: number;
  purgedCount: number;
  failedCount: number;
  purgedBytes: number;
  latestAt?: string;
}

export function formatLocal(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at;
  return new Date(t).toLocaleString("ko-KR");
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

export function isAuditWarning(entry: AuditEntry): boolean {
  return (
    entry.action.includes("-failed-") ||
    entry.summary.includes("못했어요") ||
    auditRestoreNeedsAttention(entry) ||
    auditFailureDetailCount(entry.detail) > 0
  );
}

export function isRestoreBinAuditEntry(entry: AuditEntry): boolean {
  return (
    entry.category === "cleanup" &&
    (entry.action === "trash" || entry.action === "app-leftovers-trash") &&
    auditRestorableDetailCount(entry.detail) > 0
  );
}

export function isRestoreBinAutoEmptyEntry(entry: AuditEntry): boolean {
  return entry.category === "cleanup" && entry.action.includes("expired-purge");
}

export function auditActionLabel(entry: AuditEntry): string {
  if (entry.action.includes("expired-purge-failed")) return "30일 자동 비움 확인";
  if (entry.action.includes("expired-purge")) return "30일 자동 비움";
  if (entry.action.startsWith("restore-point-")) return "복원 지점";
  if (entry.action === "app-leftovers-trash") return "앱 잔여 정리";
  if (entry.action === "uninstall-followup-resolved") return "잔여 없음 확인";
  if (entry.action === "trash") return "복구함으로 이동";
  if (entry.action.startsWith("trash-restore-")) return "복구함 되돌리기";
  if (entry.action.startsWith("registry-backup-restore-")) return "앱 흔적 되돌리기";
  if (entry.action.startsWith("startup-restore-")) return "시작 항목 되돌리기";
  if (entry.action.startsWith("scheduled-task-backup-restore-")) return "예약 작업 되돌리기";
  if (entry.action.includes("restore")) return "되돌리기";
  if (entry.action.includes("defender")) return "Windows 보안 확인";
  return "활동 기록";
}

function numberDetail(detail: Record<string, unknown>, key: string): number | null {
  const value = detail[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringDetail(detail: AuditEntry["detail"], key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" ? value : null;
}

function arrayCountDetail(detail: Record<string, unknown>, key: string): number {
  const value = detail[key];
  return Array.isArray(value) ? value.length : 0;
}

function stringArrayDetail(detail: Record<string, unknown>, key: string): string[] {
  const value = detail[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function auditPurgedItemLabels(detail: Record<string, unknown>): string[] {
  const value = detail.purgedItems;
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const label = (raw as { label?: unknown }).label;
    if (typeof label !== "string") continue;
    const clean = label
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    labels.push(clean.slice(0, 120));
  }
  return labels;
}

function auditPurgedItemsLine(labels: string[]): string | null {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, 3).join(", ");
  const hidden = labels.length - 3;
  return hidden > 0 ? `자동 비운 항목 ${visible} 외 ${hidden}개` : `자동 비운 항목 ${visible}`;
}

function isActualRestoreAuditEntry(entry: AuditEntry): boolean {
  return (
    entry.action.startsWith("trash-restore-") ||
    entry.action.startsWith("registry-backup-restore-") ||
    entry.action.startsWith("startup-restore-") ||
    entry.action.startsWith("scheduled-task-backup-restore-")
  );
}

function auditRestoreNeedsAttention(entry: AuditEntry): boolean {
  return isActualRestoreAuditEntry(entry) && stringDetail(entry.detail, "status") !== "restored";
}

function auditFailureDetailCount(detail: AuditEntry["detail"]): number {
  if (!detail) return 0;
  return arrayCountDetail(detail, "failedEntryIds") + arrayCountDetail(detail, "failedIds");
}

export function auditRestoreBinAutoEmptySummary(entries: AuditEntry[]): RestoreBinAutoEmptySummary {
  const autoEmptyEntries = entries.filter(isRestoreBinAutoEmptyEntry);
  let purgedCount = 0;
  let failedCount = 0;
  let purgedBytes = 0;

  for (const entry of autoEmptyEntries) {
    const detail = entry.detail;
    if (!detail) continue;
    purgedCount += numberDetail(detail, "purgedCount") ?? 0;
    failedCount += auditFailureDetailCount(detail);
    failedCount += numberDetail(detail, "failedBucketCount") ?? 0;
    purgedBytes += numberDetail(detail, "purgedBytes") ?? 0;
  }

  return {
    entryCount: autoEmptyEntries.length,
    purgedCount,
    failedCount,
    purgedBytes,
    latestAt: autoEmptyEntries[0]?.at
  };
}

function auditRegistryBackupDetailCount(detail: Record<string, unknown>): number {
  const recoverableCount = arrayCountDetail(detail, "recoverableRegistryBackupIds");
  if (recoverableCount > 0) return recoverableCount;
  return new Set([
    ...stringArrayDetail(detail, "registryBackupIds"),
    ...stringArrayDetail(detail, "preservedRegistryBackupIds")
  ]).size;
}

function auditScheduledTaskBackupDetailCount(detail: Record<string, unknown>): number {
  const recoverableCount = arrayCountDetail(detail, "recoverableScheduledTaskBackupIds");
  if (recoverableCount > 0) return recoverableCount;
  return new Set([
    ...stringArrayDetail(detail, "scheduledTaskBackupIds"),
    ...stringArrayDetail(detail, "preservedScheduledTaskBackupIds")
  ]).size;
}

function auditRestorableDetailCount(detail: AuditEntry["detail"]): number {
  if (!detail) return 0;
  return (
    arrayCountDetail(detail, "trashEntryIds") +
    auditRegistryBackupDetailCount(detail) +
    arrayCountDetail(detail, "startupDisabledIds") +
    auditScheduledTaskBackupDetailCount(detail)
  );
}

export function auditWarningMessage(entry: AuditEntry): string {
  if (entry.action.includes("expired-purge") || auditFailureDetailCount(entry.detail) > 0) {
    return "아직 비우지 못한 항목은 복구함에 남겨뒀어요. 다음 자동 비움 때 한 번 더 확인해요.";
  }
  return "작업을 끝내지 못했어요. 상세 내용을 확인해 주세요.";
}

export function auditDetailLines(detail: AuditEntry["detail"]): string[] {
  if (!detail) return [];
  const lines: string[] = [];
  const purgedCount = numberDetail(detail, "purgedCount");
  const removedCount = numberDetail(detail, "removedCount") ?? arrayCountDetail(detail, "removedItems");
  const failedCount = auditFailureDetailCount(detail);
  const failedBucketCount = numberDetail(detail, "failedBucketCount");
  const skippedCount = numberDetail(detail, "skippedCount") ?? arrayCountDetail(detail, "skippedItems");
  const notSelectedCount = numberDetail(detail, "notSelectedCount");
  const restorableCount = auditRestorableDetailCount(detail);
  const fileTrashCount = numberDetail(detail, "fileTrashCount");
  const registryBackupCount = numberDetail(detail, "registryBackupCount");
  const preservedRegistryBackupCount = numberDetail(detail, "preservedRegistryBackupCount");
  const startupDisabledCount = numberDetail(detail, "startupDisabledCount");
  const scheduledTaskBackupCount = numberDetail(detail, "scheduledTaskBackupCount");
  const preservedScheduledTaskBackupCount = numberDetail(detail, "preservedScheduledTaskBackupCount");
  const scheduledTaskName = stringDetail(detail, "taskName");
  const purgedBytes = numberDetail(detail, "purgedBytes");
  const totalFreedBytes = numberDetail(detail, "totalFreedBytes");
  const purgedItemsLine = auditPurgedItemsLine(auditPurgedItemLabels(detail));

  if (purgedCount !== null && purgedCount > 0) lines.push(`비운 항목 ${purgedCount}개`);
  if (purgedItemsLine) lines.push(purgedItemsLine);
  if (removedCount > 0) lines.push(`정리한 항목 ${removedCount}개`);
  if (restorableCount > 0) lines.push(`30일 안에 되돌릴 수 있는 항목 ${restorableCount}개`);
  if (fileTrashCount !== null && fileTrashCount > 0) {
    lines.push(`파일/폴더 복구함 ${fileTrashCount}개`);
  }
  if (registryBackupCount !== null && registryBackupCount > 0) {
    lines.push(`앱 삭제 흔적 백업 ${registryBackupCount}개`);
  }
  if (preservedRegistryBackupCount !== null && preservedRegistryBackupCount > 0) {
    lines.push(`확인 못 끝낸 앱 흔적 백업 ${preservedRegistryBackupCount}개`);
  }
  if (startupDisabledCount !== null && startupDisabledCount > 0) {
    lines.push(`잠시 꺼둔 시작 항목 ${startupDisabledCount}개`);
  }
  if (scheduledTaskBackupCount !== null && scheduledTaskBackupCount > 0) {
    lines.push(`예약 작업 백업 ${scheduledTaskBackupCount}개`);
  }
  if (preservedScheduledTaskBackupCount !== null && preservedScheduledTaskBackupCount > 0) {
    lines.push(`확인 못 끝낸 예약 작업 백업 ${preservedScheduledTaskBackupCount}개`);
  }
  if (scheduledTaskName) {
    lines.push(`예약 작업 ${scheduledTaskName}`);
  }
  if (failedCount > 0) lines.push(`아직 남아 있는 항목 ${failedCount}개`);
  if (failedBucketCount !== null && failedBucketCount > 0) {
    lines.push(`확인 못 한 복구함 영역 ${failedBucketCount}곳`);
  }
  if (skippedCount > 0) lines.push(`건드리지 않은 항목 ${skippedCount}개`);
  if (notSelectedCount !== null && notSelectedCount > 0) {
    lines.push(`선택하지 않은 후보 ${notSelectedCount}개`);
  }
  if (purgedBytes !== null && purgedBytes > 0) {
    lines.push(`확보한 공간 ${formatBytes(purgedBytes)}`);
  }
  if (totalFreedBytes !== null && totalFreedBytes > 0) {
    lines.push(`확보한 공간 ${formatBytes(totalFreedBytes)}`);
  }

  return lines;
}
