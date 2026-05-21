import { describe, expect, it } from "vitest";
import {
  appLeftoverConfirmRestorePlan,
  type LeftoverCleanupConfirm
} from "../src/renderer/src/pages/appManagerConfirmCopy";

function confirm(overrides: Partial<LeftoverCleanupConfirm> = {}): LeftoverCleanupConfirm {
  return {
    planId: "plan-1",
    confirmationToken: "token-1",
    selectedPathIds: ["path-1"],
    selectedBytes: 0,
    folderCount: 0,
    shortcutCount: 0,
    restoreBinCount: 0,
    appTraceBackupCount: 0,
    windowsTraceBackupCount: 0,
    backupCount: 0,
    startupHoldCount: 0,
    serviceCount: 0,
    scheduledTaskCount: 0,
    ...overrides
  };
}

describe("app manager cleanup confirmation copy", () => {
  it("explains each 30-day holding bucket before cleanup runs", () => {
    const rows = appLeftoverConfirmRestorePlan(
      confirm({
        restoreBinCount: 2,
        appTraceBackupCount: 3,
        windowsTraceBackupCount: 4,
        backupCount: 7,
        startupHoldCount: 1
      })
    );

    expect(rows).toEqual([
      {
        label: "파일·폴더",
        count: 2,
        detail: "폴더·바로가기·시작 항목을 복구함에 30일 동안 보관해요."
      },
      {
        label: "앱 연결 흔적",
        count: 3,
        detail: "기본 앱·파일 형식·프로토콜·브라우저 도우미·우클릭 메뉴를 백업해요."
      },
      {
        label: "Windows 연결 흔적",
        count: 4,
        detail: "서비스·예약 작업·방화벽·PATH·환경 설정을 백업해요."
      },
      {
        label: "시작 항목",
        count: 1,
        detail: "시작 폴더 항목은 바로 지우지 않고 잠시 꺼둬요."
      }
    ]);
  });

  it("does not show fake holding rows when no selected item can be restored", () => {
    expect(appLeftoverConfirmRestorePlan(confirm())).toEqual([]);
  });

  it("does not create a separate total backup row", () => {
    const rows = appLeftoverConfirmRestorePlan(
      confirm({
        backupCount: 9,
        appTraceBackupCount: 5,
        windowsTraceBackupCount: 4
      })
    );

    expect(rows.map((row) => row.label)).toEqual(["앱 연결 흔적", "Windows 연결 흔적"]);
  });
});
