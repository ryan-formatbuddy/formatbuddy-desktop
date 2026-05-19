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
    expect(source).not.toContain("{snapshot.retentionDays}일 뒤 자동으로 비워요");
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

  it("keeps recent cleanup restore moving when one item fails", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("restoreFailureCount += 1");
    expect(source).toContain("summarizeRestoreAllResults(results, [], restoreFailureCount)");
    expect(source).not.toContain("setRecentRestoreMessage(friendlyErrorMessage(err));");
  });

  it("shows friendly messages instead of silently returning when cleanup bridges are missing", () => {
    const source = readFileSync(CLEANUP_PAGE, "utf8");

    expect(source).toContain("정리 실행을 연결하지 못했어요");
    expect(source).toContain("복구함 되돌리기를 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.executeCleanup) return;");
    expect(source).not.toContain("if (!window.fb?.restoreCleanupTrash) return;");
  });
});
