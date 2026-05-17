import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScan, __testing } from "../src/main/scanner";
import type { ScanProgress, ScanReport } from "../src/shared/types";

describe("scanner mock pipeline", () => {
  it("buildSteps marks states correctly", () => {
    const steps = __testing.buildSteps(2);
    expect(steps.length).toBe(__testing.TOTAL_STEPS);
    expect(steps[0].state).toBe("done");
    expect(steps[1].state).toBe("done");
    expect(steps[2].state).toBe("active");
    expect(steps[3].state).toBe("pending");
  });

  it("progressFor computes score and elapsed", () => {
    const started = Date.now() - 1234;
    const p = __testing.progressFor(3, started);
    expect(p.totalSteps).toBe(__testing.TOTAL_STEPS);
    expect(p.doneSteps).toBe(3);
    expect(p.score).toBeGreaterThanOrEqual(50);
    expect(p.elapsedMs).toBeGreaterThanOrEqual(1000);
  });

  it("runScan(mock) emits progress, completes, writes JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
    const events: ScanProgress[] = [];
    try {
      const res = await runScan({
        scriptPath: "ignored.ps1",
        outputDir: dir,
        mock: true,
        onProgress: (p) => events.push(p)
      });
      expect(events.length).toBeGreaterThanOrEqual(__testing.TOTAL_STEPS);
      expect(res.report.schemaVersion).toBe("0.1.0");
      expect(res.report.privacy.localOnly).toBe(true);
      const fileText = readFileSync(res.jsonPath, "utf8");
      const parsed = JSON.parse(fileText) as ScanReport;
      expect(parsed.system.osCaption).toContain("Windows");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runScan(mock) cancels on abort", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
    const controller = new AbortController();
    try {
      const p = runScan({
        scriptPath: "ignored.ps1",
        outputDir: dir,
        mock: true,
        signal: controller.signal
      });
      setTimeout(() => controller.abort(), 50);
      await expect(p).rejects.toThrowError(/cancel/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
