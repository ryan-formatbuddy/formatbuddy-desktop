import { describe, expect, it, vi } from "vitest";
import {
  getDefenderStatus,
  getThreatHistory,
  runQuickScan,
  __testing,
  type PowerShellRunner
} from "../src/main/security/defender";

function makeRunner(overrides: Partial<PowerShellRunner> = {}): PowerShellRunner {
  return {
    run: vi
      .fn()
      .mockResolvedValue({ stdout: "", stderr: "", code: 0, timedOut: false }),
    detached: vi.fn().mockResolvedValue({ pid: 1 }),
    ...overrides
  };
}

const fixedNow = () => new Date("2026-05-19T00:00:00.000Z");

describe("parsePsDate", () => {
  it("parses WCF /Date()/ timestamps", () => {
    const iso = __testing.parsePsDate("/Date(1716000000000)/");
    expect(iso).toBe(new Date(1716000000000).toISOString());
  });

  it("parses ISO timestamps", () => {
    expect(__testing.parsePsDate("2026-05-18T01:00:00.000Z")).toBe(
      new Date("2026-05-18T01:00:00.000Z").toISOString()
    );
  });

  it("returns null for missing or unparseable values", () => {
    expect(__testing.parsePsDate(null)).toBeNull();
    expect(__testing.parsePsDate("not a date")).toBeNull();
  });
});

describe("actionFromDefender", () => {
  it("maps known numeric codes to enum values", () => {
    expect(__testing.actionFromDefender(1).status).toBe("cleaned");
    expect(__testing.actionFromDefender(2).status).toBe("quarantined");
    expect(__testing.actionFromDefender(3).status).toBe("removed");
    expect(__testing.actionFromDefender(6).status).toBe("allowed");
    expect(__testing.actionFromDefender(9).status).toBe("no-action");
    expect(__testing.actionFromDefender(10).status).toBe("blocked");
  });

  it("maps strings case-insensitively", () => {
    expect(__testing.actionFromDefender("Quarantine").status).toBe("quarantined");
    expect(__testing.actionFromDefender("AllowedByUser").status).toBe("allowed");
  });

  it("preserves the raw string for unknown values", () => {
    const result = __testing.actionFromDefender(99);
    expect(result.status).toBe("unknown");
    expect(result.rawStatus).toMatch(/code=99/);
  });
});

describe("severityFromDefender", () => {
  it("maps Defender severity ids", () => {
    expect(__testing.severityFromDefender(5)).toBe("severe");
    expect(__testing.severityFromDefender(4)).toBe("high");
    expect(__testing.severityFromDefender(2)).toBe("moderate");
    expect(__testing.severityFromDefender(1)).toBe("low");
    expect(__testing.severityFromDefender(0)).toBe("unknown");
  });

  it("falls back to text matching", () => {
    expect(__testing.severityFromDefender("High")).toBe("high");
    expect(__testing.severityFromDefender("medium")).toBe("moderate");
  });
});

describe("getDefenderStatus", () => {
  it("returns unavailable on non-Windows", async () => {
    const shell = makeRunner();
    const result = await getDefenderStatus({ shell, platform: "darwin", now: fixedNow });
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/Windows/);
    expect(shell.run).not.toHaveBeenCalled();
  });

  it("parses Get-MpComputerStatus JSON into a live status object", async () => {
    const stdout = JSON.stringify({
      AntivirusEnabled: true,
      RealTimeProtectionEnabled: true,
      IsTamperProtected: true,
      AntivirusSignatureLastUpdated: "2026-05-18T00:00:00.000Z",
      QuickScanEndTime: "2026-05-17T00:00:00.000Z",
      FullScanEndTime: "2026-05-12T00:00:00.000Z"
    });
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({ stdout, stderr: "", code: 0, timedOut: false })
    });
    const result = await getDefenderStatus({ shell, platform: "win32", now: fixedNow });
    expect(result.available).toBe(true);
    expect(result.antivirusEnabled).toBe(true);
    expect(result.realTimeProtectionEnabled).toBe(true);
    expect(result.tamperProtectionEnabled).toBe(true);
    expect(result.signatureAgeDays).toBe(1);
    expect(result.lastQuickScanDaysAgo).toBe(2);
    expect(result.lastFullScanDaysAgo).toBe(7);
  });

  it("surfaces the PowerShell error when the cmdlet fails", async () => {
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "Get-MpComputerStatus is not recognized",
        code: 1,
        timedOut: false
      })
    });
    const result = await getDefenderStatus({ shell, platform: "win32", now: fixedNow });
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/recognized/);
  });

  it("treats timeouts as unavailable", async () => {
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: null, timedOut: true })
    });
    const result = await getDefenderStatus({ shell, platform: "win32", now: fixedNow });
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/시간 초과/);
  });
});

describe("runQuickScan", () => {
  it("launches Defender via detached PowerShell on Windows", async () => {
    const detached = vi.fn().mockResolvedValue({ pid: 4242 });
    const shell = makeRunner({ detached });
    const result = await runQuickScan({ shell, platform: "win32", now: fixedNow });
    expect(detached).toHaveBeenCalledWith("Start-MpScan -ScanType QuickScan");
    expect(result.status).toBe("launched");
    expect(result.detail).toMatch(/4242/);
  });

  it("blocks on non-Windows", async () => {
    const shell = makeRunner();
    const result = await runQuickScan({ shell, platform: "linux", now: fixedNow });
    expect(result.status).toBe("blocked");
    expect(shell.detached).not.toHaveBeenCalled();
  });

  it("reports spawn-failed when PowerShell rejects", async () => {
    const shell = makeRunner({
      detached: vi.fn().mockRejectedValue(new Error("EACCES"))
    });
    const result = await runQuickScan({ shell, platform: "win32", now: fixedNow });
    expect(result.status).toBe("spawn-failed");
    expect(result.detail).toMatch(/EACCES/);
  });
});

describe("getThreatHistory", () => {
  it("returns empty records when Get-MpThreatDetection prints nothing", async () => {
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0, timedOut: false })
    });
    const result = await getThreatHistory({ shell, platform: "win32", now: fixedNow });
    expect(result.available).toBe(true);
    expect(result.records).toEqual([]);
  });

  it("parses a single object as a one-element list", async () => {
    const stdout = JSON.stringify({
      ThreatID: 12345,
      ThreatName: "Trojan:Win32/Fake",
      InitialDetectionTime: "2026-05-15T10:00:00.000Z",
      Resources: ["file:c:\\users\\ryan\\downloads\\bad.exe"],
      SeverityID: 4,
      MostRecentDetectionAction: 2
    });
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({ stdout, stderr: "", code: 0, timedOut: false })
    });
    const result = await getThreatHistory({ shell, platform: "win32", now: fixedNow });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].threatName).toBe("Trojan:Win32/Fake");
    expect(result.records[0].severity).toBe("high");
    expect(result.records[0].actionStatus).toBe("quarantined");
    expect(result.records[0].resources).toEqual([
      "file:c:\\users\\ryan\\downloads\\bad.exe"
    ]);
  });

  it("parses an array of detections", async () => {
    const stdout = JSON.stringify([
      { ThreatID: 1, ThreatName: "A", SeverityID: 1, MostRecentDetectionAction: 1 },
      { ThreatID: 2, ThreatName: "B", SeverityID: 5, MostRecentDetectionAction: 10 }
    ]);
    const shell = makeRunner({
      run: vi.fn().mockResolvedValue({ stdout, stderr: "", code: 0, timedOut: false })
    });
    const result = await getThreatHistory({ shell, platform: "win32", now: fixedNow });
    expect(result.records).toHaveLength(2);
    expect(result.records[0].actionStatus).toBe("cleaned");
    expect(result.records[1].actionStatus).toBe("blocked");
    expect(result.records[1].severity).toBe("severe");
  });

  it("returns unavailable on non-Windows", async () => {
    const shell = makeRunner();
    const result = await getThreatHistory({ shell, platform: "darwin", now: fixedNow });
    expect(result.available).toBe(false);
    expect(result.records).toEqual([]);
    expect(shell.run).not.toHaveBeenCalled();
  });
});
