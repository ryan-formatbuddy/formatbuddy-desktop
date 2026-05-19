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
});
