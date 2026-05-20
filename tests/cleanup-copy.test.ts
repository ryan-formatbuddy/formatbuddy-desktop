import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLEANUP_PAGE = join(__dirname, "..", "src", "renderer", "src", "pages", "Cleanup.tsx");

describe("Cleanup copy", () => {
  it("links overflow restore-bin items to the existing full restore bin", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).not.toContain("다음 업데이트에서 전체 복구함");
    expect(source).toContain("전체 복구함 열기");
  });

  it("summarizes the full restore bin, not only file cleanup entries", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("RegistryBackupSnapshot");
    expect(source).toContain("StartupAutoDisabledSnapshot");
    expect(source).toContain("getRegistryBackups");
    expect(source).toContain("listDisabledStartupAuto");
    expect(source).toContain("registryBackupKindCounts");
    expect(source).toContain("전체 {totalCount}개");
    expect(source).toContain("앱 삭제 흔적과 시작 항목은 전체 복구함에서 같이 확인할 수 있어요");
    expect(source).toContain("지금은 정리 파일보다 앱 삭제 흔적이나 시작 항목 보관분이 남아 있어요");
    expect(source).not.toContain("if (!snapshot || snapshot.entries.length === 0) return null;");
  });

  it("keeps the cleanup screen focused on the 30-day restore bin flow", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).not.toContain("CleanupExecuteMode");
    expect(source).not.toContain("영구 삭제");
    expect(source).not.toContain("자동 삭제돼요");
    expect(source).toContain('mode: "trash"');
    expect(source).toContain("nextExpiryAt");
    expect(source).toContain("다음 항목은");
    expect(source).toContain("30일 동안 포맷버디 복구함에 보관해요");
    expect(source).toContain("30일 뒤 자동으로 비워요");
    expect(source).toContain("보관 기간 안에는");
    expect(source).not.toContain("{snapshot.retentionDays}일 뒤 자동으로 비워요");
    expect(source).not.toContain("${snapshot.retentionDays}일 동안 보관해요");
  });

  it("does not show raw IPC errors in cleanup screen messages", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(err as Error).message");
  });

  it("normalizes single trash restore messages through the shared friendly summary", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("summarizeTrashRestoreResults([result])");
    expect(source).not.toContain("setTrashMessage(result.message)");
  });

  it("does not offer restore actions for expired restore-bin items in the cleanup preview", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("isTrashEntryExpired");
    expect(source).toContain("restoreEntryExpiryLabel");
    expect(source).toContain("const isExpired = isTrashEntryExpired(entry.expiresAt)");
    expect(source).toContain("disabled={isExpired || needsCheck}");
    expect(source).toContain("보관 기간이 지나 되돌릴 수 없어요");
    expect(source).not.toContain("오늘 비워질 예정이에요");
  });

  it("does not offer restore actions for changed restore-bin files in the cleanup preview", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain('entry.integrityStatus === "changed"');
    expect(source).toContain('entry.integrityStatus !== "verified"');
    expect(source).toContain("const isChanged = isChangedTrashEntry(entry)");
    expect(source).toContain("const needsCheck = trashEntryNeedsCheck(entry)");
    expect(source).toContain("disabled={isExpired || needsCheck}");
    expect(source).toContain("복구함 안 파일 확인 필요");
    expect(source).toContain("복구 기록 확인 필요");
    expect(source).toContain("복구함 안의 파일이 바뀐 것 같아요");
    expect(source).toContain("복구 기록을 확인할 수 없어요");
  });

  it("keeps recent cleanup restore moving when one item fails", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("restoreFailureCount += 1");
    expect(source).toContain("recoverableRegistryBackupIds(result)");
    expect(source).toContain("restorableStartupDisabledIds(result)");
    expect(source).toContain("restoreRegistryBackup");
    expect(source).toContain("restoreStartupAuto");
    expect(source).toContain("summarizeRestoreAllResults(results, registryResults, restoreFailureCount, startupResults)");
    expect(source).not.toContain("setRecentRestoreMessage(friendlyErrorMessage(err));");
  });

  it("counts every recoverable cleanup artifact before offering immediate undo", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("function restorableCleanupResultCount(result: CleanupExecuteResult): number");
    expect(source).toContain("restorableTrashEntryIds(result).length +");
    expect(source).toContain("recoverableRegistryBackupIds(result).length +");
    expect(source).toContain("restorableStartupDisabledIds(result).length");
    expect(source).toContain("const restorableCount = restorableCleanupResultCount(result)");
    expect(source).toContain('result.mode === "trash" && restorableCount > 0');
    expect(source).toContain("30일 안에 되돌릴 수 있는 항목은 포맷버디 복구함에서 다시 확인할 수 있어요");
    expect(source).not.toContain('result.mode === "trash" && removedCount > 0');
    expect(source).not.toContain("정리한 항목은 포맷버디 복구함에 30일 동안 보관돼요");
  });

  it("shows friendly messages instead of silently returning when cleanup bridges are missing", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("복구함 목록을 연결하지 못했어요");
    expect(source).toContain("정리 실행을 연결하지 못했어요");
    expect(source).toContain("복구함 되돌리기를 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.getCleanupTrash) return;");
    expect(source).not.toContain("if (!window.fb?.executeCleanup) return;");
    expect(source).not.toContain("if (!window.fb?.restoreCleanupTrash) return;");
  });

  it("surfaces cleanup history persistence warnings without treating cleanup as failed", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("result.logPersistenceWarning");
    expect(source).toContain("정리 결과는 처리됐지만 활동 기록 저장은 못 했어요");
  });

  it("surfaces recent cleanup history with unselected candidates separated", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("getCleanupHistory");
    expect(source).toContain("최근 정리 기록");
    expect(source).toContain("이 PC에서 처리한 정리만 로컬로 남겨요");
    expect(source).toContain("entry.notSelectedCount");
    expect(source).toContain("30일 안에 되돌릴 수 있는 항목 ${entry.removedCount}개");
    expect(source).toContain("선택하지 않은 후보 ${entry.notSelectedCount}개");
    expect(source).toContain("30일 복구함");
    expect(source).not.toContain("복구함으로 보낸 항목 ${entry.removedCount}개");
  });

  it("renders cleanup result details as friendly lines instead of raw JSON", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("cleanupResultDetailLines");
    expect(source).toContain("cleanupRemovedItemLines");
    expect(source).toContain("cleanupSkippedItemLines");
    expect(source).toContain("선택하지 않은 후보");
    expect(source).not.toContain("JSON.stringify(");
    expect(source).not.toContain("<pre");
  });

  it("does not surface internal restore-bin detail strings in cleanup result details", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("friendlyCleanupDetail");
    expect(source).toContain("복구함 정보를 확인하지 못했어요");
    expect(source).toContain("30일 보관 기간을 확인하지 못했어요");
    expect(source).not.toContain('item.detail ? ` · ${item.detail}` : ""');
  });
});
