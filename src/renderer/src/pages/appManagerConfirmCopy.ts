import type { RestoreBinBreakdownRow } from "./appManagerResultCopy";

export type LeftoverCleanupConfirm = {
  planId: string;
  confirmationToken: string;
  selectedPathIds: string[];
  selectedBytes: number;
  folderCount: number;
  shortcutCount: number;
  restoreBinCount: number;
  appTraceBackupCount: number;
  windowsTraceBackupCount: number;
  backupCount: number;
  startupHoldCount: number;
  serviceCount: number;
  scheduledTaskCount: number;
};

export function appLeftoverConfirmRestorePlan(
  confirm: LeftoverCleanupConfirm
): RestoreBinBreakdownRow[] {
  return [
    {
      label: "파일·폴더",
      count: confirm.restoreBinCount,
      detail: "폴더·바로가기·시작 항목을 복구함에 30일 동안 보관해요."
    },
    {
      label: "앱 연결 흔적",
      count: confirm.appTraceBackupCount,
      detail: "기본 앱·파일 형식·프로토콜·브라우저 도우미·우클릭 메뉴를 백업해요."
    },
    {
      label: "Windows 연결 흔적",
      count: confirm.windowsTraceBackupCount,
      detail: "서비스·예약 작업·방화벽·PATH·환경 설정을 백업해요."
    },
    {
      label: "시작 항목",
      count: confirm.startupHoldCount,
      detail: "시작 폴더 항목은 바로 지우지 않고 잠시 꺼둬요."
    }
  ].filter((row) => row.count > 0);
}
