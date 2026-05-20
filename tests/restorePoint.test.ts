import { describe, expect, it, vi } from "vitest";
import { createRestorePoint } from "../src/main/cleanup/restorePoint";

describe("createRestorePoint", () => {
  it("returns non-windows reason on non-win32 platforms without invoking PowerShell", async () => {
    const invoke = vi.fn();
    const result = await createRestorePoint({
      description: "test",
      platform: "darwin",
      runner: { invoke }
    });
    expect(result).toEqual({ created: false, reason: "non-windows" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns created:true on PowerShell exit 0", async () => {
    const invoke = vi.fn(async () => ({ exitCode: 0, stderr: "" }));
    const result = await createRestorePoint({
      description: "cleanup-run",
      platform: "win32",
      runner: { invoke }
    });
    expect(result).toEqual({ created: true, description: "cleanup-run" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("escapes single-quotes in the description so PowerShell parses cleanly", async () => {
    const invoke = vi.fn(async () => ({ exitCode: 0, stderr: "" }));
    await createRestorePoint({
      description: "user's run",
      platform: "win32",
      runner: { invoke }
    });
    const calls = invoke.mock.calls as unknown as Array<[string, number]>;
    const psCommand = calls[0][0];
    expect(psCommand).toContain("FormatBuddy: user''s run");
  });

  it("removes control characters from the PowerShell description", async () => {
    const invoke = vi.fn(async () => ({ exitCode: 0, stderr: "" }));
    await createRestorePoint({
      description: "cleanup\nrun\rwith\tcontrols\0",
      platform: "win32",
      runner: { invoke }
    });
    const calls = invoke.mock.calls as unknown as Array<[string, number]>;
    const psCommand = calls[0][0];
    expect(psCommand).toContain("FormatBuddy: cleanup run with controls");
    expect(psCommand).not.toContain("\n");
    expect(psCommand).not.toContain("\r");
    expect(psCommand).not.toContain("\0");
  });

  it("returns ps-error with detail on non-zero exit", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 1,
      stderr: "Access is denied (System Protection off?)"
    }));
    const result = await createRestorePoint({
      description: "test",
      platform: "win32",
      runner: { invoke }
    });
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("ps-error");
      expect(result.detail).toBe("restore-point-permission-denied");
      expect(result.detail).not.toMatch(/Access is denied|System Protection/i);
    }
  });

  it("returns timeout reason when the runner times out", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("timeout");
    });
    const result = await createRestorePoint({
      description: "test",
      platform: "win32",
      runner: { invoke }
    });
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("timeout");
    }
  });

  it("returns spawn-failed for other thrown errors", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("ENOENT C:\\Users\\Ryan\\Temp\\restore.log");
    });
    const result = await createRestorePoint({
      description: "test",
      platform: "win32",
      runner: { invoke }
    });
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("spawn-failed");
      expect(result.detail).toBe("restore-point-launcher-unavailable");
      expect(result.detail).not.toMatch(/ENOENT|C:\\Users/i);
    }
  });

  it("respects the type parameter in the PowerShell command", async () => {
    const invoke = vi.fn(async () => ({ exitCode: 0, stderr: "" }));
    await createRestorePoint({
      description: "before-uninstall",
      type: "APPLICATION_UNINSTALL",
      platform: "win32",
      runner: { invoke }
    });
    const calls = invoke.mock.calls as unknown as Array<[string, number]>;
    const psCommand = calls[0][0];
    expect(psCommand).toContain("APPLICATION_UNINSTALL");
  });
});
