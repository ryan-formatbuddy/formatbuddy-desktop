import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportDrivers, __testing } from "../src/main/driver/backup";

describe("exportDrivers", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-driver-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("short-circuits on non-Windows hosts without invoking pnputil", async () => {
    const invoke = vi.fn();
    const result = await exportDrivers({
      targetDir: dir,
      platform: "darwin",
      runner: { invoke }
    });
    expect(result.status).toBe("windows-only");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns ok with parsed driverCount on PowerShell success", async () => {
    const stdout = [
      "Exporting driver package: oem10.inf",
      "Exporting driver package: oem11.inf",
      "Exporting driver package: oem12.inf",
      "Total driver packages: 3"
    ].join("\n");
    const invoke = vi.fn(async () => ({ exitCode: 0, stdout, stderr: "" }));
    const result = await exportDrivers({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("ok");
    expect(result.driverCount).toBe(3);
    expect(result.targetDir).toBe(dir);
  });

  it("falls back to counting Exporting lines when summary line is missing/localized", () => {
    const stdout = [
      "Exporting driver package: oem1.inf",
      "Exporting driver package: oem2.inf"
    ].join("\n");
    expect(__testing.parseDriverCount(stdout)).toBe(2);
  });

  it("propagates non-zero exit as exec-failed with detail", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 87,
      stdout: "",
      stderr: "ERROR: Access denied"
    }));
    const result = await exportDrivers({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("exec-failed");
    expect(result.detail).toMatch(/Access denied/);
  });

  it("classifies ENOENT as pnputil-missing", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("spawn pnputil ENOENT");
    });
    const result = await exportDrivers({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("pnputil-missing");
  });

  it("classifies a runner-side timeout as exec-failed with timeout detail", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("timeout");
    });
    const result = await exportDrivers({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("exec-failed");
    expect(result.detail).toBe("timeout");
  });
});
