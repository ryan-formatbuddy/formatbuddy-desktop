import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
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

  it("finalizing progress waits below 100 until the report is ready", () => {
    const started = Date.now() - 9000;
    const p = __testing.progressForFinalizing(started);
    expect(p.score).toBe(92);
    expect(p.doneSteps).toBe(__testing.TOTAL_STEPS - 1);
    expect(p.steps[p.steps.length - 1].state).toBe("active");
    expect(p.message).toMatch(/결과/);
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
      expect(res.report.schemaVersion).toMatch(/^0\./);
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

  it("uses mock mode outside Windows", () => {
    expect(__testing.shouldUseMockPipeline(false, "darwin")).toBe(true);
    expect(__testing.shouldUseMockPipeline(false, "linux")).toBe(true);
    expect(__testing.shouldUseMockPipeline(false, "win32")).toBe(false);
    expect(__testing.shouldUseMockPipeline(true, "win32")).toBe(true);
  });
});

describe("verifyAndStageScript", () => {
  it("returns null when script is missing and enforce=false", async () => {
    const result = await __testing.verifyAndStageScript("/tmp/does-not-exist.ps1", {
      enforce: false,
      expectedHash: "0".repeat(64)
    });
    expect(result).toBeNull();
  });

  it("throws when script is missing and enforce=true", async () => {
    await expect(
      __testing.verifyAndStageScript("/tmp/also-does-not-exist.ps1", {
        enforce: true,
        expectedHash: "0".repeat(64)
      })
    ).rejects.toThrow();
  });

  it("returns null on hash mismatch when enforce=false (dev)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-devmiss-"));
    const scriptPath = join(dir, "fake.ps1");
    writeFileSync(scriptPath, "Get-Process", "utf8");
    try {
      const result = await __testing.verifyAndStageScript(scriptPath, {
        enforce: false,
        expectedHash: "0".repeat(64)
      });
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on hash mismatch when enforce=true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
    const scriptPath = join(dir, "fake.ps1");
    writeFileSync(scriptPath, "Get-Process", "utf8");
    try {
      await expect(
        __testing.verifyAndStageScript(scriptPath, {
          enforce: true,
          expectedHash: "0".repeat(64)
        })
      ).rejects.toThrowError(/integrity check failed/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("on match returns a private per-run temp path with verified bytes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
    const scriptPath = join(dir, "fake.ps1");
    const body = "Get-ChildItem -Path C:\\";
    writeFileSync(scriptPath, body, "utf8");
    const expected = createHash("sha256").update(body).digest("hex");
    try {
      const stagedPath = await __testing.verifyAndStageScript(scriptPath, {
        enforce: true,
        expectedHash: expected
      });
      expect(stagedPath).toBeTypeOf("string");
      expect(stagedPath).not.toBe(scriptPath);
      const stagedBody = readFileSync(stagedPath as string, "utf8");
      expect(stagedBody).toBe(body);
      // staged path is inside a per-run mkdtemp dir (prefix fb-script-)
      const parent = stagedPath as string;
      expect(parent).toMatch(/fb-script-/);
      // cleanup
      rmSync(stagedPath as string, { force: true });
      rmSync(parent.replace(/[/\\]script\.ps1$/, ""), { recursive: true, force: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bundled PowerShell compatibility", () => {
  const scriptPath = join(process.cwd(), "resources", "powershell", "Invoke-FormatBuddyScan.ps1");

  it("avoids Windows PowerShell 5.1 parse traps", () => {
    const script = readFileSync(scriptPath, "utf8");
    expect(script).not.toMatch(/=\s*try\s*\{/);
    expect(script).not.toMatch(/Out-File\s+-FilePath\s+\$OutputPath\s+-Encoding\s+utf8/i);
    expect(script).not.toMatch(/Write-Host\s+"/);
  });

  it("keeps the scanner script ASCII-only for Windows PowerShell -File", () => {
    const script = readFileSync(scriptPath, "utf8");
    expect(/^[\x00-\x7F]*$/.test(script)).toBe(true);
  });
});
