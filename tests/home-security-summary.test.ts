import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HOME_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "Home.tsx"
);

describe("Home security summary", () => {
  it("surfaces Windows security care on the first screen with friendly fallback copy", () => {
    const source = readFileSync(HOME_PAGE, "utf8");

    expect(source).toContain("HomeSecuritySummaryCard");
    expect(source).toContain("buildSecurityCareSummary");
    expect(source).toContain("window.fb?.getDefenderStatus");
    expect(source).toContain("Windows 보안 점검 요약");
    expect(source).toContain("보안 점검 열기");
    expect(source).toContain("보안 점검을 연결하지 못했어요");
    expect(source).toContain("보안 상태를 불러오지 못했어요");
    expect(source).toContain("Mac 미리보기에서는 Windows 보안 상태를 읽지 않아요");
    expect(source).not.toMatch(/치료|감염 발견|바이러스 제거|악성코드 제거|스캔 완료/);
    expect(source).not.toContain("PowerShell");
    expect(source).not.toContain("터미널");
    expect(source).not.toContain("명령어");
  });
});
