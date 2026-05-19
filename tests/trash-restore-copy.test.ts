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
    expect(source).toContain("30일이 지난 항목은 앱이 알아서 정리해요");
    expect(source).not.toContain("레지스트리 백업");
    expect(source).toContain("앱 삭제 흔적 백업");
    expect(source).toContain("앱 흔적 되돌리기");
  });
});
