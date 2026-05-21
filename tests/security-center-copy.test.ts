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

  it("keeps Defender raw status and quick scan details out of the user-facing copy", () => {
    const source = readFileSync(SECURITY_CENTER_PAGE, "utf8");

    expect(source).toContain("quickScanDetailLabel");
    expect(source).toContain("threatActionLabel");
    expect(source).toContain("permission-denied");
    expect(source).toContain("windows-security-launcher-unavailable");
    expect(source).toContain("windows-policy-blocked");
    expect(source).toContain("Windows 보안 검사를 시작하지 못했어요");
    expect(source).toContain("Windows 보안에서 다시 확인해주세요");
    expect(source).toContain("Windows 보안 점검 요약");
    expect(source).toContain("먼저 확인");
    expect(source).toContain("확인해봐요");
    expect(source).toContain("괜찮아요");
    expect(source).toContain("Windows 기록: 조치됨");
    expect(source).toContain("클라우드 보호");
    expect(source).toContain("원치 않는 앱 차단");
    expect(source).toContain("랜섬웨어 폴더 보호");
    expect(source).toContain("보호 설정은 Windows가 관리해요");
    expect(source).not.toContain('{lastResult.detail ? ` (${lastResult.detail})` : ""}');
    expect(source).not.toContain('return `Windows 처리: ${record.rawStatus ?? "알 수 없음"}`;');
    expect(source).not.toContain("Windows 처리: 제거됨");
    expect(source).not.toContain("Windows 처리: 정리됨");
  });

  it("turns security summary actions into real buttons", () => {
    const source = readFileSync(SECURITY_CENTER_PAGE, "utf8");

    expect(source).toContain("function securityCareActionKind(item: SecurityCareSummary[\"items\"][number])");
    expect(source).toContain('item.id.startsWith("quick-scan")');
    expect(source).toContain("onRunScan");
    expect(source).toContain("onOpenSecurity");
    expect(source).toContain("actionKind === \"quick-scan\" ? onRunScan : onOpenSecurity");
    expect(source).toContain("{item.action}");
    expect(source).toContain("item.id === \"security-ok\"");
    expect(source).not.toContain("<span\n                  style={{\n                    alignSelf: \"start\"");
  });

  it("keeps post quick-scan refresh feedback visible", () => {
    const source = readFileSync(SECURITY_CENTER_PAGE, "utf8");

    expect(source).toContain("const [scanRefreshMessage, setScanRefreshMessage]");
    expect(source).toContain("async (): Promise<boolean>");
    expect(source).toContain("빠른 검사 요청 후 상태와 기록을 다시 읽었어요.");
    expect(source).toContain("빠른 검사 요청은 남겼고, 일부 상태만 다시 읽었어요.");
    expect(source).toContain("빠른 검사 요청은 남겼지만 상태 새로고침은 이어서 확인해주세요.");
    expect(source).toContain("refreshMessage={scanRefreshMessage}");
  });
});
