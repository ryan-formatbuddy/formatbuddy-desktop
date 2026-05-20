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
