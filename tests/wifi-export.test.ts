import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportWifiProfiles, __testing } from "../src/main/wifi/export";

describe("exportWifiProfiles", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fb-wifi-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("short-circuits on non-Windows hosts", async () => {
    const invoke = vi.fn();
    const result = await exportWifiProfiles({
      targetDir: dir,
      platform: "darwin",
      runner: { invoke }
    });
    expect(result.status).toBe("windows-only");
    expect(result.includedPasswords).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("DOES NOT pass key=clear when includePasswords is false (the safe default)", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 0,
      stdout: 'Interface profile "home" is saved in folder ".".',
      stderr: ""
    }));
    await exportWifiProfiles({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    const calls = invoke.mock.calls as unknown as Array<[string[], number]>;
    const args = calls[0][0];
    expect(args).not.toContain("key=clear");
  });

  it("passes key=clear ONLY when includePasswords is true", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 0,
      stdout: 'Interface profile "home" is saved in folder ".".',
      stderr: ""
    }));
    const result = await exportWifiProfiles({
      targetDir: dir,
      includePasswords: true,
      platform: "win32",
      runner: { invoke }
    });
    const calls = invoke.mock.calls as unknown as Array<[string[], number]>;
    const args = calls[0][0];
    expect(args).toContain("key=clear");
    expect(result.includedPasswords).toBe(true);
    expect(result.summary).toMatch(/비밀번호 포함/);
  });

  it("counts profiles using the locale-stable 'is saved in folder' phrase", () => {
    const stdout = [
      'Interface profile "home" is saved in folder ".".',
      'Interface profile "office_5g" is saved in folder ".".',
      'Interface profile "guest_wifi" is saved in folder ".".'
    ].join("\n");
    expect(__testing.parseProfileCount(stdout)).toBe(3);
  });

  it("propagates non-zero exit as exec-failed", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "Element not found."
    }));
    const result = await exportWifiProfiles({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("exec-failed");
    expect(result.detail).toMatch(/Element not found/);
  });

  it("classifies ENOENT as netsh-missing", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("spawn netsh ENOENT");
    });
    const result = await exportWifiProfiles({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("netsh-missing");
  });

  it("classifies a runner-side timeout as exec-failed with timeout detail", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("timeout");
    });
    const result = await exportWifiProfiles({
      targetDir: dir,
      platform: "win32",
      runner: { invoke }
    });
    expect(result.status).toBe("exec-failed");
    expect(result.detail).toBe("timeout");
  });
});
