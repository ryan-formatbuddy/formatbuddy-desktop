import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Windows field E2E runner", () => {
  it("writes a machine-readable evidence report for real Windows validation", async () => {
    const source = await readFile(
      new URL("../scripts/run-windows-field-e2e.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('kind: "formatbuddy-windows-field-e2e"');
    expect(source).toContain('join(projectRoot, "dist", "field-e2e")');
    expect(source).toContain("FORMATBUDDY_FIELD_E2E_REPORT_DIR");
    expect(source).toContain("cleanup executor consumes a confirmation-token plan");
    expect(source).toContain("unified 30-day retention tick");
    expect(source).toContain("requirementResults");
    expect(source).toContain("capturedLog");
    expect(source).toContain("stdoutTail");
    expect(source).toContain("stderrTail");
    expect(source).toContain("maxCapturedLogChars");
    expect(source).toContain("evidence report failed");
    expect(source).toContain('status: code === 0 ? "passed" : "failed"');
    expect(source).toContain('status: "spawn-error"');
    expect(source).toContain('status: "stopped"');
  });
});
