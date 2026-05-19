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
    expect(source).not.toContain("레지스트리 백업");
    expect(source).toContain("앱 삭제 흔적 백업");
    expect(source).toContain("앱 흔적 되돌리기");
  });

  it("uses app identity first for app deletion trace backups", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).toContain("registryBackupTitle");
    expect(source).toContain("entry.appName");
    expect(source).toContain("entry.appPublisher");
    expect(source).toContain("앱 이름을 확인하지 못한 삭제 흔적");
    expect(source).toContain("앱 삭제 흔적 위치");
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
});
