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

describe("Report action copy", () => {
  it("shows friendly guidance instead of silently returning when report action bridges are missing", () => {
    const source = readFileSync(REPORT_PAGE, "utf8");

    expect(source).toContain("공유용 리포트 저장을 연결하지 못했어요");
    expect(source).toContain("Windows 화면 열기를 연결하지 못했어요");
    expect(source).toContain("드라이버 백업을 연결하지 못했어요");
    expect(source).toContain("Wi-Fi 목록 저장을 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.exportHtmlReport) return;");
    expect(source).not.toContain("if (!action.command || !window.fb?.runActionCommand) return;");
    expect(source).not.toContain("if (!window.fb?.backupDrivers) return;");
    expect(source).not.toContain("if (!window.fb?.exportWifiProfiles) return;");
  });
});
