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
    expect(source).toContain('mode: "trash"');
    expect(source).toContain("30일 동안 포맷버디 복구함에 보관해요");
  });
});
