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
    expect(source).toContain('arrayCountDetail(detail, "trashEntryIds")');
    expect(source).toContain('arrayCountDetail(detail, "registryBackupIds")');
    expect(source).toContain("auditRestorableDetailCount(entry.detail) > 0");
  });

  it("renders audit details as friendly lines instead of raw JSON", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain("auditDetailLines");
    expect(source).toContain("비운 항목");
    expect(source).toContain("아직 남아 있는 항목");
    expect(source).toContain("확보한 공간");
    expect(source).not.toContain("JSON.stringify(entry.detail");
    expect(source).not.toContain("<pre");
  });

  it("reads count details from numeric audit fields before legacy arrays", () => {
    const source = readFileSync(AUDIT_LOG_PAGE, "utf8");

    expect(source).toContain(
      'const removedCount = numberDetail(detail, "removedCount") ?? arrayCountDetail(detail, "removedItems")'
    );
    expect(source).toContain(
      'const skippedCount = numberDetail(detail, "skippedCount") ?? arrayCountDetail(detail, "skippedItems")'
    );
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
