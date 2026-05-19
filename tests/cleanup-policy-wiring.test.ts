import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("cleanup policy wiring", () => {
  it("enforces the product cleanup policy before executing cleanup", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("enforceProductCleanupPolicy");
    expect(source).toContain("const safeRequest = enforceProductCleanupPolicy(request)");
    expect(source).toContain("executeCleanup(safeRequest");
  });

  it("records product cleanup as a 30-day restore-bin action only", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).not.toContain("permanent-delete");
    expect(source).not.toContain("영구 삭제했어요");
    expect(source).toContain('action: "trash"');
    expect(source).toContain("포맷버디 복구함으로");
    expect(source).toContain("30일 뒤 자동으로 비워요");
  });
});
