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
});
