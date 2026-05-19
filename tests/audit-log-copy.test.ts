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
});
