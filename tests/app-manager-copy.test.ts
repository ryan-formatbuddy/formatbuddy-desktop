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

describe("AppManager uninstall copy", () => {
  it("does not claim an app was removed just because the Windows uninstall window opened", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

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
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("snapshot.total === 0 && snapshot.recentlyUninstallLaunched.length === 0");
    expect(source).toContain('setLoad({ kind: "ready", snapshot })');
    expect(source).toContain("load.snapshot.recentlyUninstallLaunched.length > 0");
  });

  it("includes registry backup undo in the recent cleanup flow", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("restoreRegistryBackup");
    expect(source).toContain("recoverableRegistryBackupIds");
    expect(source).toContain("restoreStartupAuto");
    expect(source).toContain("restorableStartupDisabledIds");
    expect(source).toContain("summarizeRestoreAllResults(results, registryResults, restoreFailureCount, startupResults)");
    expect(source).toContain("방금 정리 되돌리기");
    expect(source).not.toContain("레지스트리는");
    expect(source).not.toContain("? \"레지스트리\"");
    expect(source).not.toContain("앱 삭제 흔적은 백업 후 처리해요");
    expect(source).toContain("앱 삭제 흔적도 30일 안에 되돌릴 수 있게 챙겨요");
    expect(source).toContain("30일 동안 되돌릴 수 있게 백업해요");
    expect(source).toContain("폴더·바로가기와 시작 항목, 앱 삭제 흔적은 30일 안에 되돌릴 수 있게");
    expect(source).toContain("숨은 앱 데이터 폴더");
    expect(source).toContain("바탕화면·시작 메뉴 바로가기");
    expect(source).toContain("바로가기 {confirm.shortcutCount}개도 30일 동안 되돌릴 수 있어요");
    expect(source).toContain("시작 항목");
    expect(source).not.toContain("시작 레지스트리");
    expect(source).toContain("시작 흔적");
    expect(source).toContain("바로가기");
  });

  it("counts startup holding items when deciding whether recent cleanup can be undone", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("const restorableCount = result");
    expect(source).toContain("restorableTrashEntryIds(result).length +");
    expect(source).toContain("recoverableRegistryBackupIds(result).length +");
    expect(source).toContain("restorableStartupDisabledIds(result).length");
    expect(source).toContain("{restorableCount > 0 && (");
  });

  it("keeps recent app-leftover restore moving when one item fails", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("restoreFailureCount += 1");
    expect(source).toContain("summarizeRestoreAllResults(results, registryResults, restoreFailureCount, startupResults)");
    expect(source).not.toContain("setRecentRestoreMessage(friendlyErrorMessage(err));");
  });

  it("shows a friendly message when recent restore cannot reach the app bridge", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("const missingRestoreBridge =");
    expect(source).toContain("방금 정리 되돌리기를 연결하지 못했어요");
    expect(source).not.toContain("if (entryIds.length > 0 && !window.fb?.restoreCleanupTrash) return;");
    expect(source).not.toContain("if (registryBackupIds.length > 0 && !window.fb?.restoreRegistryBackup) return;");
    expect(source).not.toContain("if (startupDisabledIds.length > 0 && !window.fb?.restoreStartupAuto) return;");
  });

  it("shows friendly messages instead of silently returning when app manager bridges are missing", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("잔여 항목 확인을 연결하지 못했어요");
    expect(source).toContain("잔여 항목 정리를 연결하지 못했어요");
    expect(source).toContain("앱 제거 실행을 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.listAppLeftovers) return;");
    expect(source).not.toContain("if (!window.fb?.cleanupAppLeftovers) return;");
    expect(source).not.toContain("if (!window.fb?.uninstallApp) return;");
  });

  it("does not show raw uninstall detail strings in the app list", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("uninstallStatusDetailLabel");
    expect(source).toContain("제거 창을 안전하게 열었어요");
    expect(source).toContain("제거 명령을 안전하게 확인하지 못했어요");
    expect(source).toContain("Windows 구성요소라 자동으로 실행하지 않아요");
    expect(source).toContain("Windows 제거 창을 열지 못했어요");
    expect(source).not.toContain('{lastStatus.detail ? ` (${lastStatus.detail})` : ""}');
    expect(source).not.toContain("enoent");
  });

  it("counts only successful app-leftover cleanup items as cleaned", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("appLeftoverResultHeadline");
    expect(source).toContain("const cleanedCount = result");
    expect(source).toContain("const preservedBackupCount = preservedRegistryBackupIds(result).length");
    expect(source).toContain("if (preservedBackupCount > 0)");
    expect(source).toContain(".filter((item) => item.succeeded).length");
    expect(source).toContain("정리 확인을 끝내지 못했지만 백업");
    expect(source).toContain("30일 안에 되돌릴 수 있어요");
    expect(source).toContain("이번 정리에서 처리된 항목은 없어요.");
    expect(source).not.toContain("{result.removedItems.length}개를 정리했어요");
    expect(source).not.toContain("실패/건너뜀");
  });

  it("shows the restore bin action when only a preserved backup can be restored", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("result.mode === \"trash\" && restorableCount > 0");
    expect(source).not.toContain("result.mode === \"trash\" && cleanedCount > 0");
  });

  it("explains app-leftover cleanup results by restorable folders and backups", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("appLeftoverResultLines");
    expect(source).toContain("const fileOrFolderCount = restorableTrashEntryIds(result).length");
    expect(source).toContain("const backupCount = recoverableRegistryBackupIds(result).length");
    expect(source).toContain("const startupCount = restorableStartupDisabledIds(result).length");
    expect(source).toContain("잔여 파일/폴더");
    expect(source).toContain("앱 삭제 흔적/시작 항목 백업");
    expect(source).toContain("잠시 꺼둔 시작 항목");
    expect(source).toContain("폴더와 바로가기, 시작 항목은 복구함에 30일 동안 보관해요");
    expect(source).toContain("30일 안에 되돌릴 수 있어요");
    expect(source).toContain("선택하지 않은 후보");
    expect(source).toContain("그대로 남겨뒀어요");
  });

  it("includes failed app-leftover removed items in the failed or skipped count", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("const failedRemovedCount = result");
    expect(source).toContain(".filter((item) => !item.succeeded).length");
    expect(source).toContain("const skippedCount = result");
    expect(source).toContain("const needsCheckCount = failedRemovedCount + skippedCount");
    expect(source).toContain("확인 필요한 항목 {needsCheckCount}개는 건드리지 않았어요");
    expect(source).not.toContain("{result.skippedItems.filter((s) => s.reason !== \"not-selected\").length}개");
  });

  it("explains why skipped app-leftover items were left untouched", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

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
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("state.snapshot.groups.length === 0 ? (");
    expect(source).toContain("정리 후 남은 잔여 항목 후보가 없어요.");
    expect(source).not.toContain("if (state.snapshot.groups.length === 0) {\n    return (");
  });

  it("keeps the post-cleanup effect check wired to quick rescan when available", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("onQuickRescan?: () => void");
    expect(source).toContain("onClick={onQuickRescan ?? onRescan}");
    expect(source).toContain("다시 점검해서 효과 보기");
  });

  it("keeps cleanup result actions visible when leftover refresh fails after cleanup", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("if (state.error && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요");
    expect(source).not.toContain("if (state.error && !result)");
    expect(source).not.toContain("setLeftovers({ loading: false, error: friendlyErrorMessage(err) });");
  });

  it("surfaces app-leftover history persistence warnings without hiding the result", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("result.logPersistenceWarning");
    expect(source).toContain("CLEANUP_HISTORY_SAVE_WARNING");
  });

  it("surfaces app-leftover follow-up persistence warnings without hiding the result", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("result.followupPersistenceWarning");
    expect(source).toContain("CLEANUP_FOLLOWUP_SAVE_WARNING");
  });

  it("keeps existing leftover candidates visible when refresh fails before cleanup", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("if (state.error && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 불러오진 못했지만, 기존 후보는 남겨둘게요");
    expect(source).not.toContain("if (state.error && !result)");
  });

  it("keeps existing leftover candidates visible while refresh is loading before cleanup", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("if (state.loading && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 확인하는 중이에요. 기존 후보는 그대로 남겨둘게요.");
    expect(source).not.toContain("if (state.loading && !result)");
  });

  it("lets users select every safe app leftover candidate in one action", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("정리 가능 항목 전체 선택");
    expect(source).toContain("선택 해제");
    expect(source).toContain("onSelectAllSelectable");
    expect(source).toContain("setSelectedLeftovers(selectableLeftoverPathIds(snapshot))");
  });

  it("uses an in-app confirmation dialog before app-leftover cleanup", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("AppLeftoverConfirmDialog");
    expect(source).toContain("buildLeftoverCleanupConfirm");
    expect(source).toContain("aria-modal=\"true\"");
    expect(source).toContain("선택한 앱 잔여 항목을 정리할까요?");
    expect(source).toContain("30일 복구함으로 정리");
    expect(source).not.toContain("선택한 앱 잔여 항목 ${selectedPathIds.length}개를 정리할게요");
  });

  it("uses an in-app confirmation dialog before launching the Windows uninstaller", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("UninstallConfirmDialog");
    expect(source).toContain("Windows 제거 창을 열까요?");
    expect(source).toContain("실제 삭제 여부는 Windows 제거 창에서 직접 한 번 더 선택해요");
    expect(source).toContain("setUninstallConfirm(item)");
    expect(source).toContain("runConfirmedUninstall");
    expect(source).not.toContain("window.confirm(");
    expect(source).not.toContain("마법사");
  });

  it("shows the startup item name beside the startup location", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("leftoverDisplayPath");
    expect(source).toContain("path.registryValueName");
    expect(source).toContain('path.kind === "startup-registry"');
    expect(source).toContain("${path.path}\\\\${valueName}");
    expect(source).toContain("leftoverDisplayPath(path)} 선택");
  });

  it("separates manual startup traces from protected leftover paths", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

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
    expect(source).toContain("서비스는 보안·프린터·드라이버와 가까워서 앱에서 바로 지우지 않아요");
    expect(source).toContain("예약 작업은 업데이트·동기화 조건이 섞여 있어 앱에서 바로 지우지 않아요");
    expect(source).toContain("안전하게 확인되지 않은 흔적은 앱에서 바로 지우지 않아요");
  });

  it("does not show raw IPC errors in app cleanup messages", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(err as Error).message");
  });

  it("filters raw internal app-leftover details before trusting startup wording", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");
    const rawFilterIndex = source.indexOf("if (rawInternalDetailPattern.test(text))");
    const startupCopyIndex = source.indexOf(
      "if (/startup|holding|hash|integrity|source path|still exists|시작 항목/.test(lower))"
    );

    expect(rawFilterIndex).toBeGreaterThan(-1);
    expect(startupCopyIndex).toBeGreaterThan(-1);
    expect(rawFilterIndex).toBeLessThan(startupCopyIndex);
  });
});
