import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED_TYPES = join(__dirname, "..", "src", "shared", "types.ts");

describe("cleanup type contract", () => {
  it("keeps product cleanup requests limited to the 30-day restore bin", () => {
    const source = readFileSync(SHARED_TYPES, "utf8");

    expect(source).toContain('export type CleanupProductExecuteMode = "trash"');
    expect(source).toContain('export type CleanupExecuteMode = CleanupProductExecuteMode | "permanent"');
    expect(source).toContain("mode: CleanupProductExecuteMode");
    expect(source).toContain("Product cleanup always routes through FormatBuddy's 30-day restore bin.");
  });
});
