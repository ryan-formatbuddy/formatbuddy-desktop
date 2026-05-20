import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STARTUP_AUTO_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "StartupAuto.tsx"
);

describe("StartupAuto copy", () => {
  it("shows a friendly note when the disabled startup list bridge is missing", () => {
    const source = readFileSync(STARTUP_AUTO_PAGE, "utf8");

    expect(source).toContain("잠시 꺼둔 시작 항목 목록을 연결하지 못했어요");
    expect(source).toContain("30일 동안 보관");
    expect(source).toContain("restoreEntryExpiryLabel");
    expect(source).toContain("disabledNotes");
    expect(source).toContain("disabledEntryIntegrityLabel");
    expect(source).toContain("보관 파일 확인 필요");
    expect(source).toContain("오래된 보관 기록");
    expect(source).toContain("바로 되돌릴 수 있어요");
    expect(source).toContain("canRestoreDisabledEntry(entry)");
    expect(source).toContain("확인 필요");
    expect(source).not.toContain("Promise.resolve<StartupAutoDisabledSnapshot>({");
  });

  it("uses an in-app confirmation before disabling startup folder items", () => {
    const source = readFileSync(STARTUP_AUTO_PAGE, "utf8");

    expect(source).toContain("StartupDisableConfirmDialog");
    expect(source).toContain("PC 켤 때 같이 뜨지 않게 할까요?");
    expect(source).toContain("30일 보관하고 잠시 끄기");
    expect(source).toContain("setDisableConfirm(entry)");
    expect(source).toContain("runConfirmedDisable");
    expect(source).not.toContain("window.confirm(");
  });

  it("explains registry startup items without registry jargon in the main hint", () => {
    const source = readFileSync(STARTUP_AUTO_PAGE, "utf8");

    expect(source).toContain("앱이 PC 켤 때 같이 뜨도록 등록한 항목이에요.");
    expect(source).toContain("entry.kind === \"registry\"");
    expect(source).toContain("entry.registryKeyPath && entry.registryValueName");
    expect(source).toContain("시작 설정은 포맷버디 복구함에 30일 동안 백업해요.");
    expect(source).not.toContain("HKCU Run");
  });

  it("keeps service and scheduled-task items read-only with a GUI settings path", () => {
    const source = readFileSync(STARTUP_AUTO_PAGE, "utf8");

    expect(source).toContain("readonlyEntryHint");
    expect(source).toContain("서비스와 예약 작업은 Windows와 가까워서 자동으로 끄지 않아요");
    expect(source).toContain("예약 작업은 업데이트·동기화 같은 조건 실행이 섞여 있어서");
    expect(source).toContain("서비스는 보안·프린터·드라이버와 가까워서");
    expect(source).toContain("Windows 시작 앱 설정 열기");
    expect(source).toContain("ms-settings:startupapps");
    expect(source).toContain("보기만");
    expect(source).not.toContain("powershell");
    expect(source).not.toContain("PowerShell");
  });
});
