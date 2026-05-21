import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AUDIT_LOG_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "AuditLog.tsx"
);

describe("AuditLog copy", () => {
  it("shows automatic-empty failures as user-friendly check-needed items", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("auditActionLabel");
    expect(source).toContain("isAuditWarning");
    expect(source).toContain("30일 자동 비움 확인");
    expect(source).toContain("확인 필요");
    expect(source).toContain("아직 비우지 못한 항목은 복구함에 남겨뒀어요");
    expect(source).not.toContain("{entry.action}</strong>");
  });

  it("marks entries with failed detail ids as check-needed even if the summary changes", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("function auditFailureDetailCount(detail: AuditEntry[\"detail\"]): number");
    expect(source).toContain('arrayCountDetail(detail, "failedEntryIds")');
    expect(source).toContain('arrayCountDetail(detail, "failedIds")');
    expect(source).toContain("auditFailureDetailCount(entry.detail) > 0");
  });

  it("marks non-restored restore audit entries as check-needed", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("function auditRestoreNeedsAttention(entry: AuditEntry): boolean");
    expect(source).toContain("isActualRestoreAuditEntry(entry)");
    expect(source).toContain('stringDetail(entry.detail, "status") !== "restored"');
    expect(source).toContain("auditRestoreNeedsAttention(entry)");
  });

  it("does not treat restore point audit entries as restore failures", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("function isActualRestoreAuditEntry(entry: AuditEntry): boolean");
    expect(source).toContain('entry.action.startsWith("trash-restore-")');
    expect(source).toContain('entry.action.startsWith("registry-backup-restore-")');
    expect(source).toContain('entry.action.startsWith("startup-restore-")');
    expect(source).toContain('if (entry.action.startsWith("restore-point-")) return "복원 지점"');
    expect(source).not.toContain('entry.action.includes("restore") && stringDetail(entry.detail, "status") !== "restored"');
  });

  it("labels restore audit entries by restore target", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain('if (entry.action.startsWith("restore-point-")) return "복원 지점"');
    expect(source).toContain('if (entry.action.startsWith("trash-restore-")) return "복구함 되돌리기"');
    expect(source).toContain(
      'if (entry.action.startsWith("registry-backup-restore-")) return "앱 흔적 되돌리기"'
    );
    expect(source).toContain(
      'if (entry.action.startsWith("scheduled-task-backup-restore-")) return "예약 작업 되돌리기"'
    );
    expect(source).toContain('if (entry.action.includes("restore")) return "되돌리기"');
  });

  it("keeps restore-bin warning text separate from general failure text", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("function auditWarningMessage(entry: AuditEntry): string");
    expect(source).toContain('entry.action.includes("expired-purge")');
    expect(source).toContain("아직 비우지 못한 항목은 복구함에 남겨뒀어요");
    expect(source).toContain("작업을 끝내지 못했어요. 상세 내용을 확인해 주세요.");
    expect(source).toContain("{auditWarningMessage(entry)}");
  });

  it("labels app leftover cleanup records clearly", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain('if (entry.action === "app-leftovers-trash") return "앱 잔여 정리"');
  });

  it("labels resolved app leftover follow-up records clearly", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain('if (entry.action === "uninstall-followup-resolved") return "잔여 없음 확인"');
  });

  it("shows restore-bin guidance for app leftover cleanup records too", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain(
      'function isRestoreBinAuditEntry(entry: AuditEntry): boolean'
    );
    expect(source).toContain('entry.action === "app-leftovers-trash"');
    expect(source).toContain("isRestoreBinAuditEntry(entry) &&");
    expect(source).toContain("되돌리기는 안전 정리 센터의 포맷버디 복구함에서 할 수 있어요.");
  });

  it("shows restore-bin guidance only when restorable ids are recorded", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("function auditRestorableDetailCount(detail: AuditEntry[\"detail\"]): number");
    expect(source).toContain("function auditRegistryBackupDetailCount(detail: Record<string, unknown>): number");
    expect(source).toContain('arrayCountDetail(detail, "recoverableRegistryBackupIds")');
    expect(source).toContain('arrayCountDetail(detail, "trashEntryIds")');
    expect(source).toContain('stringArrayDetail(detail, "registryBackupIds")');
    expect(source).toContain('stringArrayDetail(detail, "preservedRegistryBackupIds")');
    expect(source).toContain('arrayCountDetail(detail, "startupDisabledIds")');
    expect(source).toContain('arrayCountDetail(detail, "scheduledTaskBackupIds")');
    expect(source).toContain("new Set([");
    expect(source).toContain("auditRestorableDetailCount(entry.detail) > 0");
  });

  it("renders audit details as friendly lines instead of raw JSON", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("auditDetailLines");
    expect(source).toContain("비운 항목");
    expect(source).toContain("auditPurgedItemLabels");
    expect(source).toContain("auditPurgedItemsLine");
    expect(source).toContain("자동 비운 항목");
    expect(source).toContain("30일 안에 되돌릴 수 있는 항목");
    expect(source).toContain("파일/폴더 복구함");
    expect(source).toContain("앱 삭제 흔적 백업");
    expect(source).toContain("확인 못 끝낸 앱 흔적 백업");
    expect(source).toContain("잠시 꺼둔 시작 항목");
    expect(source).toContain("아직 남아 있는 항목");
    expect(source).toContain("선택하지 않은 후보");
    expect(source).toContain("확보한 공간");
    expect(source).not.toContain("JSON.stringify(entry.detail");
    expect(source).not.toContain("<pre");
  });

  it("shows bucket-level automatic-empty failures as friendly detail lines", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain('const failedBucketCount = numberDetail(detail, "failedBucketCount")');
    expect(source).toContain("확인 못 한 복구함 영역 ${failedBucketCount}곳");
  });

  it("shows a friendly restorable count across files, app traces, and disabled startup items", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("const restorableCount = auditRestorableDetailCount(detail)");
    expect(source).toContain('const fileTrashCount = numberDetail(detail, "fileTrashCount")');
    expect(source).toContain('const registryBackupCount = numberDetail(detail, "registryBackupCount")');
    expect(source).toContain(
      'const preservedRegistryBackupCount = numberDetail(detail, "preservedRegistryBackupCount")'
    );
    expect(source).toContain('const startupDisabledCount = numberDetail(detail, "startupDisabledCount")');
    expect(source).toContain('const scheduledTaskBackupCount = numberDetail(detail, "scheduledTaskBackupCount")');
    expect(source).toContain("restorableCount > 0");
    expect(source).toContain("30일 안에 되돌릴 수 있는 항목 ${restorableCount}개");
  });

  it("shows scheduled task restore details without falling back to a generic label", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain('const scheduledTaskName = stringDetail(detail, "taskName")');
    expect(source).toContain("예약 작업 ${scheduledTaskName}");
    expect(source).toContain("예약 작업 백업 ${scheduledTaskBackupCount}개");
  });

  it("reads count details from numeric audit fields before legacy arrays", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain(
      'const removedCount = numberDetail(detail, "removedCount") ?? arrayCountDetail(detail, "removedItems")'
    );
    expect(source).toContain(
      'const skippedCount = numberDetail(detail, "skippedCount") ?? arrayCountDetail(detail, "skippedItems")'
    );
    expect(source).toContain('const notSelectedCount = numberDetail(detail, "notSelectedCount")');
  });

  it("does not show zero-count audit detail lines as if they mattered", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("purgedCount !== null && purgedCount > 0");
    expect(source).toContain("purgedBytes !== null && purgedBytes > 0");
    expect(source).toContain("totalFreedBytes !== null && totalFreedBytes > 0");
    expect(source).not.toContain("purgedCount !== null) lines.push");
    expect(source).not.toContain("purgedBytes !== null) lines.push");
    expect(source).not.toContain("totalFreedBytes !== null) lines.push");
  });
});
