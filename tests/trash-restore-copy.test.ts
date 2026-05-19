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
  it("makes the purge action clearly expired-only", () => {
    const source = readFileSync(TRASH_RESTORE_PAGE, "utf8");

    expect(source).not.toContain("지금 비우기");
    expect(source).toContain("만료된 항목 정리");
  });
});
