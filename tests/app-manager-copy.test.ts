import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_MANAGER_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "AppManager.tsx"
);
const APP_MANAGER_ACTIONS = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "appManagerActions.ts"
);
const APP_MANAGER_RESULT_COPY = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "appManagerResultCopy.ts"
);

function readAppManagerSources(): string {
  return [APP_MANAGER_PAGE, APP_MANAGER_ACTIONS, APP_MANAGER_RESULT_COPY]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("AppManager uninstall copy", () => {
  it("does not claim an app was removed just because the Windows uninstall window opened", () => {
    const source = readAppManagerSources();

    expect(source).not.toContain("방금 제거한 앱");
    expect(source).not.toContain("방금 제거한 앱 기준");
    expect(source).not.toContain("방금 제거를 연 앱 기준");
    expect(source).toContain("방금 제거를 연 앱");
    expect(source).toContain("Windows 기본 제거 창을 열어드려요");
    expect(source).toContain("Windows 제거 창을 끝냈다면");
    expect(source).toContain("같은 제품군 앱이 남아 있어요");
    expect(source).toContain("followupInstallStateLabel");
    expect(source).toContain("제거 완료 확인됨");
    expect(source).toContain("다시 점검 후 정리 가능");
    expect(source).not.toContain("마법사");
  });

  it("keeps the app cleanup follow-up visible after restart even when the installed app list is empty", () => {
    const source = readAppManagerSources();

    expect(source).toContain("snapshot.total === 0 && snapshot.recentlyUninstallLaunched.length === 0");
    expect(source).toContain('setLoad({ kind: "ready", snapshot })');
    expect(source).toContain("load.snapshot.recentlyUninstallLaunched.length > 0");
  });

  it("includes registry backup undo in the recent cleanup flow", () => {
    const source = readAppManagerSources();

    expect(source).toContain("restoreRegistryBackup");
    expect(source).toContain("recoverableRegistryBackupIds");
    expect(source).toContain("restoreStartupAuto");
    expect(source).toContain("restorableStartupDisabledIds");
    expect(source).toContain("restoreScheduledTaskBackup");
    expect(source).toContain("recoverableScheduledTaskBackupIds");
    expect(source).toContain("scheduledTaskResults");
    expect(source).toContain("방금 정리 되돌리기");
    expect(source).not.toContain("레지스트리는");
    expect(source).not.toContain("? \"레지스트리\"");
    expect(source).not.toContain("앱 삭제 흔적은 백업 후 처리해요");
    expect(source).toContain("앱 삭제 흔적도 30일 안에 되돌릴 수 있게 챙겨요");
    expect(source).toContain("기본 앱 목록");
    expect(source).toContain("PATH 경로");
    expect(source).toContain("환경 설정 흔적");
    expect(source).toContain("방화벽 규칙");
    expect(source).toContain("앱 실행 경로");
    expect(source).toContain("앱 연결 흔적");
    expect(source).toContain("파일 형식 연결");
    expect(source).toContain("프로토콜 연결");
    expect(source).toContain("브라우저 연결 도우미");
    expect(source).toContain("우클릭 메뉴");
    expect(source).toContain("우클릭 확장");
    expect(source).toContain("복구함 보관");
    expect(source).toContain("앱 연결 흔적");
    expect(source).toContain("Windows 연결 흔적");
    expect(source).toContain("먼저 챙겨두고 정리해요");
    expect(source).toContain("앱 제거 뒤 남는 후보를");
    expect(source).toContain("직접 고른 항목만 정리");
    expect(source).toContain("고정 바로가기");
    expect(source).toContain("시작 항목");
    expect(source).not.toContain("시작 레지스트리");
    expect(source).toContain("시작 흔적");
    expect(source).toContain("바로가기");
  });

  it("counts startup holding items when deciding whether recent cleanup can be undone", () => {
    const source = readAppManagerSources();

    expect(source).toContain("export function appLeftoverRestorableCount(");
    expect(source).toContain("restorableTrashEntryIds(result, now).length +");
    expect(source).toContain("recoverableRegistryBackupIds(result, now).length +");
    expect(source).toContain("restorableStartupDisabledIds(result, now).length +");
    expect(source).toContain("recoverableScheduledTaskBackupIds(result, now).length");
    expect(source).toContain("appLeftoverRestorableCount(result)");
    expect(source).toContain("appLeftoverResultActions({ result, restorableCount, restoreRecentBusy })");
    expect(source).toContain('id: "restoreRecent"');
  });

  it("keeps recent app-leftover restore moving when one item fails", () => {
    const source = readAppManagerSources();

    expect(source).toContain("restoreFailureCount += 1");
    expect(source).toContain("scheduledTaskResults");
    expect(source).not.toContain("setRecentRestoreMessage(friendlyErrorMessage(err));");
  });

  it("shows a friendly message when recent restore cannot reach the app bridge", () => {
    const source = readAppManagerSources();

    expect(source).toContain("const missingRestoreBridge =");
    expect(source).toContain("방금 정리 되돌리기를 연결하지 못했어요");
    expect(source).not.toContain("if (entryIds.length > 0 && !window.fb?.restoreCleanupTrash) return;");
    expect(source).not.toContain("if (registryBackupIds.length > 0 && !window.fb?.restoreRegistryBackup) return;");
    expect(source).not.toContain("if (startupDisabledIds.length > 0 && !window.fb?.restoreStartupAuto) return;");
    expect(source).not.toContain("if (scheduledTaskBackupIds.length > 0 && !window.fb?.restoreScheduledTaskBackup) return;");
  });

  it("shows friendly messages instead of silently returning when app manager bridges are missing", () => {
    const source = readAppManagerSources();

    expect(source).toContain("잔여 항목 확인을 연결하지 못했어요");
    expect(source).toContain("잔여 항목 정리를 연결하지 못했어요");
    expect(source).toContain("앱 제거 실행을 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.listAppLeftovers) return;");
    expect(source).not.toContain("if (!window.fb?.cleanupAppLeftovers) return;");
    expect(source).not.toContain("if (!window.fb?.uninstallApp) return;");
  });

  it("does not show raw uninstall detail strings in the app list", () => {
    const source = readAppManagerSources();

    expect(source).toContain("uninstallStatusDetailLabel");
    expect(source).toContain("제거 창을 안전하게 열었어요");
    expect(source).toContain("제거 명령을 안전하게 확인하지 못했어요");
    expect(source).toContain("Windows 구성요소라 자동으로 실행하지 않아요");
    expect(source).toContain("Windows 제거 창을 열지 못했어요");
    expect(source).not.toContain('{lastStatus.detail ? ` (${lastStatus.detail})` : ""}');
    expect(source).not.toContain("enoent");
  });

  it("counts only successful app-leftover cleanup items as cleaned", () => {
    const source = readAppManagerSources();

    expect(source).toContain("appLeftoverResultHeadline");
    expect(source).toContain("const cleanedCount = result");
    expect(source).toContain("const preservedBackupCount =");
    expect(source).toContain("preservedRegistryBackupIds(result, now).length +");
    expect(source).toContain("preservedScheduledTaskBackupIds(result, now).length");
    expect(source).toContain("if (preservedBackupCount > 0)");
    expect(source).toContain(".filter((item) => item.succeeded).length");
    expect(source).toContain("정리 확인을 끝내지 못했지만 백업");
    expect(source).toContain("30일 안에 되돌릴 수 있어요");
    expect(source).toContain("이번 정리에서 처리된 항목은 없어요.");
    expect(source).not.toContain("{result.removedItems.length}개를 정리했어요");
    expect(source).not.toContain("실패/건너뜀");
  });

  it("shows the restore bin action when only a preserved backup can be restored", () => {
    const source = readAppManagerSources();

    expect(source).toContain("result.mode === \"trash\" && restorableCount > 0");
    expect(source).not.toContain("result.mode === \"trash\" && cleanedCount > 0");
  });

  it("explains app-leftover cleanup results by restorable folders and backups", () => {
    const source = readAppManagerSources();

    expect(source).toContain("export function appLeftoverResultLines");
    expect(source).toContain("export function appLeftoverRestoreBinBreakdown");
    expect(source).toContain("restoreBreakdown.map");
    expect(source).toContain("const fileOrFolderCount = restorableTrashEntryIds(result, now).length");
    expect(source).toContain("const backupCount = recoverableRegistryBackupIds(result, now).length");
    expect(source).toContain("const startupCount = restorableStartupDisabledIds(result, now).length");
    expect(source).toContain("const scheduledTaskCount = recoverableScheduledTaskBackupIds(result, now).length");
    expect(source).toContain("30일 보관 요약");
    expect(source).toContain("파일·폴더");
    expect(source).toContain("잔여 파일/폴더");
    expect(source).toContain("앱·Windows 연결 흔적");
    expect(source).toContain("앱 연결 흔적과 Windows 연결 흔적 백업");
    expect(source).toContain("잠시 꺼둔 시작 항목");
    expect(source).toContain("예약 작업");
    expect(source).toContain("복구함 보관 {confirm.restoreBinCount}개");
    expect(source).toContain("앱 연결 흔적 {confirm.appTraceBackupCount}개");
    expect(source).toContain("Windows 연결 흔적 {confirm.windowsTraceBackupCount}개");
    expect(source).toContain("전체 백업 {confirm.backupCount}개");
    expect(source).toContain("30일 안에 되돌릴 수 있어요");
    expect(source).toContain("선택하지 않은 후보");
    expect(source).toContain("그대로 남겨뒀어요");
  });

  it("shows a pre-cleanup 30-day holding plan before app leftovers are cleaned", () => {
    const source = readAppManagerSources();

    expect(source).toContain("appLeftoverConfirmRestorePlan");
    expect(source).toContain("const restorePlan = appLeftoverConfirmRestorePlan(confirm)");
    expect(source).toContain("30일 보관 계획");
    expect(source).toContain("restorePlan.map");
    expect(source).toContain("파일·폴더");
    expect(source).toContain("앱 연결 흔적");
    expect(source).toContain("Windows 연결 흔적");
    expect(source).toContain("시작 항목");
    expect(source).toContain("보관할 항목이 없으면 정리 전 한 번 더 알려드려요");
  });

  it("groups app leftover candidates into friendly families", () => {
    const source = readAppManagerSources();

    expect(source).toContain("leftoverFamilySummary");
    expect(source).toContain("isRestoreBinLeftover");
    expect(source).toContain("isAppTraceLeftover");
    expect(source).toContain("isWindowsTraceLeftover");
    expect(source).toContain("복구함 보관, 앱 연결 흔적, Windows 연결 흔적");
    expect(source).toContain("기본 앱·파일 형식·프로토콜·브라우저 도우미·우클릭 메뉴");
    expect(source).toContain("서비스·예약 작업·방화벽·PATH·환경 설정");
  });

  it("includes failed app-leftover removed items in the failed or skipped count", () => {
    const source = readAppManagerSources();

    expect(source).toContain("const failedRemovedCount = result");
    expect(source).toContain(".filter((item) => !item.succeeded).length");
    expect(source).toContain("const skippedCount = result");
    expect(source).toContain("const needsCheckCount = failedRemovedCount + skippedCount");
    expect(source).toContain("확인 필요한 항목 {needsCheckCount}개는 건드리지 않았어요");
    expect(source).not.toContain("{result.skippedItems.filter((s) => s.reason !== \"not-selected\").length}개");
  });

  it("explains why skipped app-leftover items were left untouched", () => {
    const source = readAppManagerSources();

    expect(source).toContain("appLeftoverSkippedPreviewLines");
    expect(source).toContain("friendlyAppLeftoverBlockedDetail");
    expect(source).toContain("그대로 둔 이유");
    expect(source).toContain("보호가 필요한 항목이라 그대로 뒀어요");
    expect(source).toContain("앱 삭제 흔적은 안전하게 확인되지 않아 그대로 뒀어요");
    expect(source).toContain("시작 항목은 안전하게 보관되지 않아 그대로 뒀어요");
    expect(source).toContain("rawInternalDetailPattern");
    expect(source).toContain("item.registryBackupId");
    expect(source).toContain("백업은 30일 복구함에 남겨뒀어요");
    expect(source).toContain("정리 중 문제가 생겨서 그대로 뒀어요");
    expect(source).toContain("활동 기록에서 이어서 볼 수 있어요");
    expect(source).not.toContain("item.detail ||");
    expect(source).not.toContain("return item.detail?.trim()");
  });

  it("keeps cleanup result actions visible even when no leftover groups remain", () => {
    const source = readAppManagerSources();

    expect(source).toContain("state.snapshot.groups.length === 0 ? (");
    expect(source).toContain("정리 후 남은 잔여 항목 후보가 없어요.");
    expect(source).not.toContain("if (state.snapshot.groups.length === 0) {\n    return (");
  });

  it("keeps the post-cleanup effect check wired to quick rescan when available", () => {
    const source = readAppManagerSources();

    expect(source).toContain("onQuickRescan?: () => void");
    expect(source).toContain("case \"rescan\":");
    expect(source).toContain("(onQuickRescan ?? onRescan)();");
    expect(source).toContain("다시 점검해서 효과 보기");
  });

  it("compares app-leftover candidates before and after cleanup", () => {
    const source = readAppManagerSources();

    expect(source).toContain("type LeftoverEffectSummary");
    expect(source).toContain("export function appLeftoverEffectLines");
    expect(source).toContain("cleanupBeforeSummary");
    expect(source).toContain("setCleanupBeforeSummary(summarizeLeftoverSnapshot(snapshot))");
    expect(source).toContain("beforeSummary={cleanupBeforeSummary}");
    expect(source).toContain("afterSnapshot={state.snapshot}");
    expect(source).toContain("정리 전후 비교");
    expect(source).toContain("정리 전 후보");
    expect(source).toContain("지금 후보");
    expect(source).toContain("이번 정리로 후보");
    expect(source).toContain("아직 설치된 앱 데이터");
    expect(source).toContain("보호된 항목");
    expect(source).toContain("수동 확인 항목");
    expect(source).toContain("다시 점검 후 정리 가능");
    expect(source).toContain("현재 없는 항목");
    expect(source).toContain("잔여 후보를 다시 확인하지 못했어요");
  });

  it("keeps cleanup result actions visible when leftover refresh fails after cleanup", () => {
    const source = readAppManagerSources();

    expect(source).toContain("if (state.error && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요");
    expect(source).not.toContain("if (state.error && !result)");
    expect(source).not.toContain("setLeftovers({ loading: false, error: friendlyErrorMessage(err) });");
  });

  it("keeps cleanup result actions visible even if the leftover snapshot disappears", () => {
    const source = readAppManagerSources();

    expect(source).toContain("if (!state.snapshot && result)");
    expect(source).toContain("방금 정리한 내용");
    expect(source).toContain("잔여 후보 목록이 비어도 정리 결과는 남겨둘게요.");
    expect(source).toContain("const restorableCount = appLeftoverRestorableCount(result)");
    expect(source).toContain("다시 점검해서 효과 보기");
    expect(source).toContain("복구함 보기");
    expect(source).toContain("방금 정리 되돌리기");
    expect(source).toContain("활동 기록 보기");
    expect(source).toMatch(/if \(!state\.snapshot && result\)[\s\S]*if \(!state\.snapshot\) return null/);
  });

  it("surfaces app-leftover history persistence warnings without hiding the result", () => {
    const source = readAppManagerSources();

    expect(source).toContain("result.logPersistenceWarning");
    expect(source).toContain("CLEANUP_HISTORY_SAVE_WARNING");
  });

  it("surfaces app-leftover follow-up persistence warnings without hiding the result", () => {
    const source = readAppManagerSources();

    expect(source).toContain("result.followupPersistenceWarning");
    expect(source).toContain("CLEANUP_FOLLOWUP_SAVE_WARNING");
  });

  it("keeps existing leftover candidates visible when refresh fails before cleanup", () => {
    const source = readAppManagerSources();

    expect(source).toContain("if (state.error && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 불러오진 못했지만, 기존 후보는 남겨둘게요");
    expect(source).not.toContain("if (state.error && !result)");
  });

  it("keeps existing leftover candidates visible while refresh is loading before cleanup", () => {
    const source = readAppManagerSources();

    expect(source).toContain("if (state.loading && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 확인하는 중이에요. 기존 후보는 그대로 남겨둘게요.");
    expect(source).not.toContain("if (state.loading && !result)");
  });

  it("lets users select every safe app leftover candidate in one action", () => {
    const source = readAppManagerSources();

    expect(source).toContain("정리 가능 항목 전체 선택");
    expect(source).toContain("선택 해제");
    expect(source).toContain("onSelectAllSelectable");
    expect(source).toContain("setSelectedLeftovers(selectableLeftoverPathIds(snapshot))");
  });

  it("uses an in-app confirmation dialog before app-leftover cleanup", () => {
    const source = readAppManagerSources();

    expect(source).toContain("AppLeftoverConfirmDialog");
    expect(source).toContain("buildLeftoverCleanupConfirm");
    expect(source).toContain("aria-modal=\"true\"");
    expect(source).toContain("선택한 앱 잔여 항목을 정리할까요?");
    expect(source).toContain("30일 복구함으로 정리");
    expect(source).not.toContain("선택한 앱 잔여 항목 ${selectedPathIds.length}개를 정리할게요");
  });

  it("uses an in-app confirmation dialog before launching the Windows uninstaller", () => {
    const source = readAppManagerSources();

    expect(source).toContain("UninstallConfirmDialog");
    expect(source).toContain("Windows 제거 창을 열까요?");
    expect(source).toContain("실제 삭제 여부는 Windows 제거 창에서 직접 한 번 더 선택해요");
    expect(source).toContain("setUninstallConfirm(item)");
    expect(source).toContain("runConfirmedUninstall");
    expect(source).not.toContain("window.confirm(");
    expect(source).not.toContain("마법사");
  });

  it("shows the startup item name beside the startup location", () => {
    const source = readAppManagerSources();

    expect(source).toContain("leftoverDisplayPath");
    expect(source).toContain("path.registryValueName");
    expect(source).toContain('path.kind === "startup-registry"');
    expect(source).toContain('path.kind === "service-registry"');
    expect(source).toContain("서비스: ${serviceName}");
    expect(source).toContain("${path.path}\\\\${valueName}");
    expect(source).toContain("leftoverDisplayPath(path)} 선택");
  });

  it("separates manual startup traces from protected leftover paths", () => {
    const source = readAppManagerSources();

    expect(source).toContain("leftoverPathNeedsManualCheck");
    expect(source).toContain('path.startupEntryKind === "service"');
    expect(source).toContain('path.startupEntryKind === "scheduled-task"');
    expect(source).toContain("서비스");
    expect(source).toContain("예약 작업");
    expect(source).toContain("수동 확인 흔적");
    expect(source).toContain("수동 확인");
    expect(source).toContain("서비스·예약 작업 같은");
    expect(source).toContain("시작 항목에서 확인");
    expect(source).toContain("manualLeftoverReviewHint");
    expect(source).toContain("서비스 이름을 안전하게 확인하지 못해서 바로 지우지 않아요");
    expect(source).toContain("예약 작업은 업데이트·동기화 조건이 섞여 있어 앱에서 바로 지우지 않아요");
    expect(source).toContain("안전하게 확인되지 않은 흔적은 앱에서 바로 지우지 않아요");
  });

  it("does not show raw IPC errors in app cleanup messages", () => {
    const source = readAppManagerSources();

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(err as Error).message");
  });

  it("filters raw internal app-leftover details before trusting startup wording", () => {
    const source = readAppManagerSources();
    const rawFilterIndex = source.indexOf("if (rawInternalDetailPattern.test(text))");
    const startupCopyIndex = source.indexOf(
      "if (/startup|holding|hash|integrity|source path|still exists|시작 항목/.test(lower))"
    );

    expect(rawFilterIndex).toBeGreaterThan(-1);
    expect(startupCopyIndex).toBeGreaterThan(-1);
    expect(rawFilterIndex).toBeLessThan(startupCopyIndex);
  });
});
