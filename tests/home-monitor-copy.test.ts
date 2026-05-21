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

describe("Home monitor copy", () => {
  it("does not hide monitor preference failures behind silent returns", () => {
    const source = readFileSync(HOME_PAGE, "utf8");

    expect(source).toContain("알림 설정을 연결하지 못했어요");
    expect(source).toContain("알림 설정 저장을 연결하지 못했어요");
    expect(source).toContain("PC 켤 때 포맷버디도 조용히 켜기");
    expect(source).toContain("정기 자동 점검 예약");
    expect(source).toContain("실시간 감시가 아니에요");
    expect(source).toContain("30일 복구함 정리");
    expect(source).toContain("prefsMessage");
    expect(source).not.toContain("if (!window.fb?.getMonitorPrefs) return;");
    expect(source).not.toContain("if (!window.fb?.updateMonitorPrefs) return;");
  });

  it("surfaces the shared 30-day restore-bin status on the first screen", () => {
    const source = readFileSync(HOME_PAGE, "utf8");

    expect(source).toContain("HomeRestoreBinCard");
    expect(source).toContain("restoreBinExpiryInsight");
    expect(source).toContain("getCleanupTrash");
    expect(source).toContain("getRegistryBackups");
    expect(source).toContain("listDisabledStartupAuto");
    expect(source).toContain("getScheduledTaskBackups");
    expect(source).toContain("복구함 상태");
    expect(source).toContain("복구함 상태를 확인하는 중이에요");
    expect(source).toContain("복구함이 비어 있어요");
    expect(source).toContain("정리한 항목이 생기면 30일 동안 챙겨둘게요");
    expect(source).toContain("보이는 항목만 먼저 확인했어요");
    expect(source).toContain("복구함 열기");
    expect(source).not.toContain("manifest");
    expect(source).not.toContain("PowerShell");
    expect(source).not.toContain("터미널");
    expect(source).not.toContain("명령어");
    expect(source).not.toContain("1-click");
    expect(source).not.toContain("60일");
  });
});
