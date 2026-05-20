import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("security audit copy", () => {
  it("uses Windows security wording in user-facing quick-scan audit summaries", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("Windows 보안 빠른 검사를 시작했어요");
    expect(source).toContain("Windows 보안 빠른 검사를 시작하지 못했어요");
    expect(source).toContain("defenderQuickScanAuditSummary");
    expect(source).toContain("Windows 보안 빠른 검사는 Windows에서만 실행할 수 있어요");
    expect(source).toContain("이 PC에서는 Windows 보안 빠른 검사를 자동으로 시작하지 못했어요");
    expect(source).not.toContain("Windows Defender 빠른 검사를 시작했어요");
    expect(source).not.toContain("Defender 빠른 검사 결과");
    expect(source).not.toContain("Windows 보안 빠른 검사 결과: ${result.status}");
  });
});
