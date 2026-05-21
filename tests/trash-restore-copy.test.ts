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
    expect(source).toContain("PATH 경로");
    expect(source).toContain("환경 설정 흔적");
    expect(source).toContain("프로토콜 연결");
    expect(source).toContain("브라우저 연결 도우미");
    expect(source).toContain("시작 항목 백업");
    expect(source).toContain("잠시 꺼둔 시작 항목");
    expect(source).toContain("예약 작업 백업");
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
    expect(source).toContain("entry.environmentPathSegment");
    expect(source).toContain('entry.backupKind === "startup-value"');
    expect(source).toContain('entry.backupKind === "environment-path-value"');
    expect(source).toContain('entry.backupKind === "environment-variable-value"');
    expect(source).toContain('entry.backupKind === "protocol-handler-key"');
    expect(source).toContain('entry.backupKind === "native-messaging-host-key"');
    expect(source).toContain("앱 이름을 확인하지 못한 삭제 흔적");
    expect(source).toContain("앱 삭제 흔적 위치");
    expect(source).toContain("앱 삭제 후 PATH에 남은 경로");
    expect(source).toContain("앱 삭제 후 남은 환경 설정");
    expect(source).toContain("프로토콜 연결을 확인하지 못했어요");
    expect(source).toContain("브라우저 연결 도우미를 확인하지 못했어요");
    expect(source).toContain("시작 항목 이름을 확인하지 못했어요");
  });

  it("uses one expiry-sorted restore list for files and app deletion traces", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("sortTrashEntriesByExpiry");
    expect(source).toContain("sortedRestoreItems");
    expect(source).toContain("dedupeRestoreListItems");
    expect(source).toContain("sortTrashEntriesByExpiry(dedupeRestoreListItems(items))");
    expect(source).toContain('kind: "file"');
    expect(source).toContain('kind: "registry"');
    expect(source).toContain('kind: "startup"');
    expect(source).toContain('kind: "scheduled-task"');
    expect(source).not.toContain("entries.map((entry, idx)");
    expect(source).not.toContain("registryEntries.map((entry, idx)");
  });

  it("keeps restore-all moving when one restore item fails", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("summarizeRestoreAllResults");
    expect(source).toContain("restoreAllFailureCount");
    expect(source).toContain("restoreAllFailureCount += 1");
    expect(source).toContain("startupResults");
    expect(source).toContain("restoreStartupAuto({ disabledId: item.entry.id })");
    expect(source).toContain("scheduledTaskResults");
    expect(source).toContain("restoreScheduledTaskBackup({ backupId: item.entry.id })");
  });

  it("includes app deletion trace backup bytes in the restore bin total", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("registryBytes");
    expect(source).toContain("startupDisabledBytes");
    expect(source).toContain("snapshot.totalBytes + registryBytes + startupDisabledBytes + scheduledTaskBytes");
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
    expect(source).toContain("summarizeScheduledTaskBackupRestoreResults([result])");
    expect(source).not.toContain("setToast(result.message)");
  });

  it("shows expired restore-bin items as non-restorable instead of offering restore buttons", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("isTrashEntryExpired");
    expect(source).toContain("restoreEntryExpiryLabel");
    expect(source).toContain("restorableRestoreItems");
    expect(source).toContain("보관 기간이 지나 되돌릴 수 없어요");
    expect(source).toContain("disabled={Boolean(busy) || isExpired || needsCheck}");
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
    expect(source).toContain('entry.integrityStatus !== "verified"');
    expect(source).toContain("!registryBackupNeedsCheck(item.entry)");
    expect(source).toContain("registryBackupChangedNotice");
    expect(source).toContain("registryBackupChangedButtonLabel");
    expect(source).toContain("registryBackupLegacyNotice");
    expect(source).toContain("registryBackupLegacyButtonLabel");
    expect(source).toContain("앱 삭제 흔적 백업 파일이 바뀐 것 같아요");
    expect(source).toContain("앱 삭제 흔적 확인 필요");
    expect(source).toContain("시작 항목 백업 파일이 바뀐 것 같아요");
    expect(source).toContain("시작 항목 확인 필요");
    expect(source).toContain("앱 삭제 흔적 백업 기록을 확인할 수 없어요");
    expect(source).toContain("앱 삭제 흔적 기록 확인 필요");
    expect(source).toContain("시작 항목 백업 기록을 확인할 수 없어요");
    expect(source).toContain("시작 항목 기록 확인 필요");
  });

  it("shows disabled startup items in the central 30-day restore bin", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("StartupAutoDisabledEntry");
    expect(source).toContain("StartupAutoDisabledSnapshot");
    expect(source).toContain("listDisabledStartupAuto");
    expect(source).toContain("restoreStartupAuto");
    expect(source).toContain("summarizeStartupFolderRestoreResults");
    expect(source).toContain("startupDisabledNeedsCheck");
    expect(source).toContain("startupDisabledChangedNotice");
    expect(source).toContain("startupDisabledLegacyNotice");
    expect(source).toContain("시작 항목 파일 확인 필요");
    expect(source).toContain("시작 항목 기록 확인 필요");
    expect(source).toContain("시작 항목 되돌리기");
  });

  it("does not promise that every restore-bin item can be restored when expired items may remain", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("복구 가능한 항목만");
    expect(source).toContain("가능한 항목만 원래 자리로");
    expect(source).toContain("바로 되돌릴 수 있는 항목 {restoreStatusSummary.restorableCount}개");
    expect(source).toContain("확인 필요한 항목 {restoreStatusSummary.checkNeededCount}개");
    expect(source).toContain("보관 기간 지난 항목 {restoreStatusSummary.expiredCount}개");
    expect(source).toContain("restoreListItemNeedsCheck");
    expect(source).not.toContain("모두 되돌릴 수 있어요");
    expect(source).not.toContain("보관 기간이 지난 항목만 남아 있어요");
    expect(source).toContain("지금 바로 되돌릴 수 있는 항목이 없어요");
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

  it("keeps showing the restore bin when one restore source fails to load", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("restoreBinPartialLoadMessage");
    expect(source).toContain("불러온 복구 항목은 그대로 보여드릴게요");
    expect(source).toContain("emptyTrashSnapshot");
    expect(source).toContain("emptyRegistrySnapshot");
    expect(source).toContain("emptyStartupSnapshot");
    expect(source).toContain("hasPartialLoadIssue");
    expect(source).toContain("불러온 복구 항목은 아직 없어요");
    expect(source).toContain("totalEntryCount === 0 && !hasPartialLoadIssue");
    expect(source).not.toContain("await Promise.all([");
    expect(source).not.toContain("snapshot && registrySnapshot && startupSnapshot && totalEntryCount === 0 && (");
  });
});
