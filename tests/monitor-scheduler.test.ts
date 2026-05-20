import { describe, expect, it } from "vitest";
import { defaultPrefs } from "../src/main/monitor";
import {
  deleteScheduledAutoScanArgs,
  reconcileScheduledAutoScan,
  registerScheduledAutoScanArgs,
  scheduledAutoScanTaskRunValue,
  SCHEDULED_AUTO_SCAN_ARG,
  SCHEDULED_AUTO_SCAN_START_TIME,
  SCHEDULED_AUTO_SCAN_TASK_NAME,
  shouldStartScheduledScanFromArgs,
  type ScheduledAutoScanRunner
} from "../src/main/monitorScheduler";

function prefs(overrides: Partial<ReturnType<typeof defaultPrefs>> = {}) {
  return { ...defaultPrefs(), ...overrides };
}

function runner(exitCode = 0, output = "OK"): ScheduledAutoScanRunner & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(args) {
      calls.push(args);
      return { exitCode, stdout: output, stderr: "" };
    }
  };
}

describe("monitorScheduler", () => {
  it("builds a quoted Task Scheduler run value without shell interpolation", () => {
    const runValue = scheduledAutoScanTaskRunValue("C:\\Program Files\\FormatBuddy\\FormatBuddy.exe");
    expect(runValue).toBe(
      `"C:\\Program Files\\FormatBuddy\\FormatBuddy.exe" ${SCHEDULED_AUTO_SCAN_ARG}`
    );
  });

  it("rejects unsafe app paths before building schtasks args", () => {
    expect(() => scheduledAutoScanTaskRunValue("C:\\bad\"path\\app.exe")).toThrow(
      "Invalid FormatBuddy app path"
    );
  });

  it("returns a failed scheduler result instead of throwing for unsafe app paths", async () => {
    const fakeRunner = runner();
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: true, autoScanDays: 30 }),
      appPath: "C:\\bad\"path\\app.exe",
      platform: "win32",
      runner: fakeRunner
    });

    expect(result.status).toBe("failed");
    expect(result.detail).toContain("Invalid FormatBuddy app path");
    expect(fakeRunner.calls).toEqual([]);
  });

  it("registers a Windows scheduled scan when the user opts in", async () => {
    const fakeRunner = runner();
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: true, autoScanDays: 30 }),
      appPath: "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
      platform: "win32",
      runner: fakeRunner
    });

    expect(result.status).toBe("registered");
    expect(fakeRunner.calls).toEqual([
      registerScheduledAutoScanArgs(
        { autoScanDays: 30 },
        "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe"
      )
    ]);
    expect(fakeRunner.calls[0]).toContain(SCHEDULED_AUTO_SCAN_TASK_NAME);
    expect(fakeRunner.calls[0]).toContain(SCHEDULED_AUTO_SCAN_START_TIME);
  });

  it("can use an isolated task name for field validation without touching the user task", async () => {
    const fakeRunner = runner();
    const taskName = "FormatBuddy Field E2E 123";
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: true, autoScanDays: 7 }),
      appPath: "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
      platform: "win32",
      runner: fakeRunner,
      taskName
    });

    expect(result.status).toBe("registered");
    expect(fakeRunner.calls).toEqual([
      registerScheduledAutoScanArgs(
        { autoScanDays: 7 },
        "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
        taskName
      )
    ]);
    expect(fakeRunner.calls[0]).toContain(taskName);
    expect(fakeRunner.calls[0]).not.toContain(SCHEDULED_AUTO_SCAN_TASK_NAME);
  });

  it("deletes the scheduled scan when the user turns it off", async () => {
    const fakeRunner = runner();
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: false }),
      appPath: "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
      platform: "win32",
      runner: fakeRunner
    });

    expect(result.status).toBe("deleted");
    expect(fakeRunner.calls).toEqual([deleteScheduledAutoScanArgs()]);
  });

  it("deletes an isolated scheduled scan by task name", async () => {
    const fakeRunner = runner();
    const taskName = "FormatBuddy Field E2E 456";
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: false }),
      appPath: "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
      platform: "win32",
      runner: fakeRunner,
      taskName
    });

    expect(result.status).toBe("deleted");
    expect(fakeRunner.calls).toEqual([deleteScheduledAutoScanArgs(taskName)]);
  });

  it("treats a missing scheduled task as an already-clean disabled state", async () => {
    const fakeRunner = runner(1, "ERROR: The system cannot find the file specified.");
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: false }),
      appPath: "C:\\Program Files\\FormatBuddy\\FormatBuddy.exe",
      platform: "win32",
      runner: fakeRunner
    });

    expect(result.status).toBe("delete-missing");
  });

  it("skips Task Scheduler work on non-Windows platforms", async () => {
    const fakeRunner = runner();
    const result = await reconcileScheduledAutoScan({
      prefs: prefs({ autoScanEnabled: true }),
      appPath: "/Applications/FormatBuddy.app",
      platform: "darwin",
      runner: fakeRunner
    });

    expect(result).toMatchObject({ status: "skipped", detail: "non-windows" });
    expect(fakeRunner.calls).toEqual([]);
  });

  it("detects scheduled scan launch args", () => {
    expect(shouldStartScheduledScanFromArgs(["FormatBuddy.exe", SCHEDULED_AUTO_SCAN_ARG])).toBe(true);
    expect(shouldStartScheduledScanFromArgs(["FormatBuddy.exe"])).toBe(false);
  });
});
