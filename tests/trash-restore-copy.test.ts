import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TRASH_RESTORE_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "TrashRestore.tsx"
);

describe("TrashRestore copy", () => {
  it("does not expose a manual empty-bin action", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).not.toContain("지금 비우기");
    expect(source).not.toContain("만료된 항목 정리");
    expect(source).not.toContain("자동 삭제돼요");
    expect(source).not.toContain("자동 삭제될");
    expect(source).toContain("30일이 지난 항목은 앱이 알아서 정리해요");
    expect(source).toContain("자동으로 비워요");
    expect(source).toContain("앱 삭제 흔적 백업");
    expect(source).toContain("시작 항목 백업");
    expect(source).toContain("registryBackupRestoreButtonLabel");
    expect(source).not.toContain("시작 레지스트리 백업");
  });

  it("keeps the restore-bin retention promise fixed at 30 days in user copy", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("보관 기간 30일");
    expect(source).not.toContain("보관 기간 ${snapshot.retentionDays}일");
  });

  it("uses app identity and value names for backup titles", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("registryBackupTitle");
    expect(source).toContain("entry.appName");
    expect(source).toContain("entry.appPublisher");
    expect(source).toContain("entry.valueName");
    expect(source).toContain('entry.backupKind === "startup-value"');
    expect(source).toContain("앱 이름을 확인하지 못한 삭제 흔적");
    expect(source).toContain("앱 삭제 흔적 위치");
    expect(source).toContain("시작 항목 이름을 확인하지 못했어요");
  });

  it("uses one expiry-sorted restore list for files and app deletion traces", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("sortTrashEntriesByExpiry");
    expect(source).toContain("sortedRestoreItems");
    expect(source).toContain('kind: "file"');
    expect(source).toContain('kind: "registry"');
    expect(source).not.toContain("entries.map((entry, idx)");
    expect(source).not.toContain("registryEntries.map((entry, idx)");
  });

  it("keeps restore-all moving when one restore item fails", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("summarizeRestoreAllResults");
    expect(source).toContain("restoreAllFailureCount");
    expect(source).toContain("restoreAllFailureCount += 1");
  });

  it("includes app deletion trace backup bytes in the restore bin total", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("registryBytes");
    expect(source).toContain("snapshot.totalBytes + registryBytes");
    expect(source).toContain("{formatBytes(entry.sizeBytes)} · 보낸 시각");
  });

  it("does not show raw IPC error messages in restore toasts", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(e as Error).message");
  });

  it("normalizes single restore result toasts through the shared friendly summaries", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("summarizeTrashRestoreResults([result])");
    expect(source).toContain("summarizeRegistryBackupRestoreResults([result])");
    expect(source).not.toContain("setToast(result.message)");
  });

  it("shows expired restore-bin items as non-restorable instead of offering restore buttons", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("isTrashEntryExpired");
    expect(source).toContain("restoreEntryExpiryLabel");
    expect(source).toContain("restorableRestoreItems");
    expect(source).toContain("보관 기간이 지나 되돌릴 수 없어요");
    expect(source).toContain("disabled={Boolean(busy) || isExpired || isChanged}");
    expect(source).toContain("disabled={Boolean(busy) || totalRestorableCount === 0}");
    expect(source).not.toContain('{days === 0 ? "오늘 만료"');
  });

  it("shows changed restore-bin files as check-needed instead of restorable", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain('entry.integrityStatus === "changed"');
    expect(source).toContain('entry.integrityStatus !== "verified"');
    expect(source).toContain("복구함 안의 파일이 바뀐 것 같아요");
    expect(source).toContain("복구 기록을 확인할 수 없어요");
    expect(source).toContain("복구함 안 파일 확인 필요");
    expect(source).toContain("복구 기록 확인 필요");
    expect(source).toContain("!trashEntryNeedsCheck(item.entry)");
  });

  it("shows changed app deletion trace backups as check-needed instead of restorable", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("isChangedRegistryBackupEntry");
    expect(source).toContain("!isChangedRegistryBackupEntry(item.entry)");
    expect(source).toContain("registryBackupChangedNotice");
    expect(source).toContain("registryBackupChangedButtonLabel");
    expect(source).toContain("앱 삭제 흔적 백업 파일이 바뀐 것 같아요");
    expect(source).toContain("앱 삭제 흔적 확인 필요");
    expect(source).toContain("시작 항목 백업 파일이 바뀐 것 같아요");
    expect(source).toContain("시작 항목 확인 필요");
  });

  it("does not promise that every restore-bin item can be restored when expired items may remain", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("복구 가능한 항목만");
    expect(source).toContain("가능한 항목만 원래 자리로");
    expect(source).not.toContain("모두 되돌릴 수 있어요");
  });

  it("shows friendly toasts instead of silently returning when restore bridges are missing", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("파일 되돌리기를 연결하지 못했어요");
    expect(source).toContain("앱 삭제 흔적 되돌리기를 연결하지 못했어요");
    expect(source).toContain("모두 되돌리기를 연결하지 못했어요");
    expect(source).not.toContain("if (!window.fb?.restoreCleanupTrash) return;");
    expect(source).not.toContain("if (!window.fb?.restoreRegistryBackup) return;");
    expect(source).not.toContain("totalEntryCount === 0\n    ) {\n      return;");
  });
});
