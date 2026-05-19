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
});
