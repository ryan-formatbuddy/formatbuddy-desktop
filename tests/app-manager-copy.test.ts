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
  it("does not claim an app was removed just because the Windows wizard opened", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).not.toContain("방금 제거한 앱");
    expect(source).not.toContain("방금 제거한 앱 기준");
    expect(source).not.toContain("방금 제거를 연 앱 기준");
    expect(source).toContain("방금 제거를 연 앱");
    expect(source).toContain("제거 완료 확인됨");
    expect(source).toContain("다시 점검 후 정리 가능");
  });

  it("includes registry backup undo in the recent cleanup flow", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("restoreRegistryBackup");
    expect(source).toContain("restorableRegistryBackupIds");
    expect(source).toContain("summarizeRestoreAllResults(results, registryResults, restoreFailureCount)");
    expect(source).toContain("방금 정리 되돌리기");
    expect(source).not.toContain("레지스트리는");
    expect(source).not.toContain("? \"레지스트리\"");
    expect(source).not.toContain("앱 삭제 흔적은 백업 후 처리해요");
    expect(source).toContain("앱 삭제 흔적도 30일 안에 되돌릴 수 있게 챙겨요");
    expect(source).toContain("앱 삭제 흔적도 30일 동안");
    expect(source).toContain("폴더와 시작 항목, 앱 삭제 흔적은 30일 안에 되돌릴 수 있게");
    expect(source).toContain("시작 항목");
    expect(source).not.toContain("시작 레지스트리");
    expect(source).toContain("시작 흔적");
  });

  it("keeps recent app-leftover restore moving when one item fails", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("restoreFailureCount += 1");
    expect(source).toContain("summarizeRestoreAllResults(results, registryResults, restoreFailureCount)");
    expect(source).not.toContain("setRecentRestoreMessage(friendlyErrorMessage(err));");
  });

  it("counts only successful app-leftover cleanup items as cleaned", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("const cleanedCount = result");
    expect(source).toContain(".filter((item) => item.succeeded).length");
    expect(source).toContain("{cleanedCount}개를 정리했어요");
    expect(source).toContain("result.mode === \"trash\" && cleanedCount > 0");
    expect(source).not.toContain("{result.removedItems.length}개를 정리했어요");
  });

  it("includes failed app-leftover removed items in the failed or skipped count", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("const failedRemovedCount = result");
    expect(source).toContain(".filter((item) => !item.succeeded).length");
    expect(source).toContain("const skippedCount = result");
    expect(source).toContain("failedRemovedCount + skippedCount");
    expect(source).not.toContain("{result.skippedItems.filter((s) => s.reason !== \"not-selected\").length}개");
  });

  it("keeps cleanup result actions visible even when no leftover groups remain", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("state.snapshot.groups.length === 0 ? (");
    expect(source).toContain("정리 후 남은 잔여 항목 후보가 없어요.");
    expect(source).not.toContain("if (state.snapshot.groups.length === 0) {\n    return (");
  });

  it("keeps cleanup result actions visible when leftover refresh fails after cleanup", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("if (state.error && !state.snapshot && !result)");
    expect(source).toContain("잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요");
    expect(source).not.toContain("if (state.error && !result)");
    expect(source).not.toContain("setLeftovers({ loading: false, error: friendlyErrorMessage(err) });");
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

  it("shows the startup item name beside the startup location", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("leftoverDisplayPath");
    expect(source).toContain("path.registryValueName");
    expect(source).toContain('path.kind === "startup-registry"');
    expect(source).toContain("${path.path}\\\\${valueName}");
    expect(source).toContain("leftoverDisplayPath(path)} 선택");
  });

  it("does not show raw IPC errors in app cleanup messages", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(err as Error).message");
  });
});
