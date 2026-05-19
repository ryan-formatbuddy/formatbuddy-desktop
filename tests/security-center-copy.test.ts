import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SECURITY_CENTER_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "SecurityCenter.tsx"
);

describe("SecurityCenter copy", () => {
  it("shows friendly messages instead of silently returning when security bridges are missing", () => {
    const source = readFileSync(SECURITY_CENTER_PAGE, "utf8");

    expect(source).toContain("위협 기록 조회를 연결하지 못했어요");
    expect(source).toContain("빠른 검사 시작을 연결하지 못했어요");
    expect(source).toContain("Windows 보안 화면 열기를 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.getDefenderThreats) return;");
    expect(source).not.toContain("if (!window.fb?.runDefenderQuickScan) return;");
    expect(source).not.toContain('onClick={() => void window.fb?.runActionCommand("start windowsdefender:")}');
  });
});
