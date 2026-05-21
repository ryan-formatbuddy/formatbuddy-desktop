import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPORT_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "Report.tsx"
);

describe("Report rescan insight copy", () => {
  it("keeps the cleanup-after-rescan effect visible from the report screen", () => {
    const source = readFileSync(REPORT_PAGE, "utf8");

    expect(source).toContain("buildRescanInsight");
    expect(source).toContain("RescanInsightPanel");
    expect(source).toContain("다시 점검 결과");
    expect(source).toContain("지난 점검과의 변화");
    expect(source).not.toMatch(/치료|감염 발견|바이러스 제거|악성코드 제거|스캔 완료|영구 삭제|자동 삭제돼요|자동 삭제될/);
  });
});
