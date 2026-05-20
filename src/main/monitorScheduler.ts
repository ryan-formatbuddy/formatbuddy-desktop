import { spawn } from "node:child_process";
import type { MonitorPreferences } from "@shared/types";

export const SCHEDULED_AUTO_SCAN_ARG = "--formatbuddy-scheduled-scan";
export const SCHEDULED_AUTO_SCAN_TASK_NAME = "FormatBuddy Periodic Check";
export const SCHEDULED_AUTO_SCAN_START_TIME = "10:00";
const DEFAULT_TIMEOUT_MS = 15_000;

export type ScheduledAutoScanStatus =
  | "registered"
  | "deleted"
  | "delete-missing"
  | "skipped"
  | "failed";

export interface ScheduledAutoScanResult {
  status: ScheduledAutoScanStatus;
  detail?: string;
  command?: string[];
}

export interface ScheduledAutoScanRunner {
  run(args: string[], timeoutMs: number): Promise<{
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
  }>;
}

function sanitizeDetail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 500);
}

function assertSafeAppPath(appPath: string): string {
  const trimmed = appPath.trim();
  if (!trimmed || trimmed.includes("\"") || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("Invalid FormatBuddy app path for scheduled scan.");
  }
  return trimmed;
}

export function scheduledAutoScanTaskRunValue(appPath: string): string {
  return `"${assertSafeAppPath(appPath)}" ${SCHEDULED_AUTO_SCAN_ARG}`;
}

export function registerScheduledAutoScanArgs(
  prefs: Pick<MonitorPreferences, "autoScanDays">,
  appPath: string
): string[] {
  return [
    "/Create",
    "/TN",
    SCHEDULED_AUTO_SCAN_TASK_NAME,
    "/SC",
    "DAILY",
    "/MO",
    String(prefs.autoScanDays),
    "/ST",
    SCHEDULED_AUTO_SCAN_START_TIME,
    "/TR",
    scheduledAutoScanTaskRunValue(appPath),
    "/F"
  ];
}

export function deleteScheduledAutoScanArgs(): string[] {
  return ["/Delete", "/TN", SCHEDULED_AUTO_SCAN_TASK_NAME, "/F"];
}

export function defaultScheduledAutoScanRunner(): ScheduledAutoScanRunner {
  return {
    run(args, timeoutMs) {
      return new Promise((resolve) => {
        const child = spawn("schtasks.exe", args, {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill();
        }, timeoutMs);
        child.stdout?.on("data", (chunk) => {
          stdout += String(chunk);
        });
        child.stderr?.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          resolve({ exitCode: null, stderr: err.message });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code, stdout, stderr });
        });
      });
    }
  };
}

function looksLikeMissingTask(text: string): boolean {
  return /cannot find|does not exist|지정된 파일을 찾을 수 없습니다|찾을 수 없습니다|없습니다/i.test(text);
}

export function shouldStartScheduledScanFromArgs(argv: string[] = process.argv): boolean {
  return argv.includes(SCHEDULED_AUTO_SCAN_ARG);
}

export async function reconcileScheduledAutoScan(options: {
  prefs: MonitorPreferences;
  appPath: string;
  platform?: NodeJS.Platform;
  runner?: ScheduledAutoScanRunner;
  timeoutMs?: number;
}): Promise<ScheduledAutoScanResult> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") return { status: "skipped", detail: "non-windows" };

  const runner = options.runner ?? defaultScheduledAutoScanRunner();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let args: string[] | undefined;

  try {
    args = options.prefs.autoScanEnabled
      ? registerScheduledAutoScanArgs(options.prefs, options.appPath)
      : deleteScheduledAutoScanArgs();
    const result = await runner.run(args, timeoutMs);
    const detail = sanitizeDetail([result.stdout, result.stderr].filter(Boolean).join(" "));
    if (result.exitCode === 0) {
      return {
        status: options.prefs.autoScanEnabled ? "registered" : "deleted",
        detail,
        command: args
      };
    }
    if (!options.prefs.autoScanEnabled && looksLikeMissingTask(detail ?? "")) {
      return { status: "delete-missing", detail, command: args };
    }
    return {
      status: "failed",
      detail: detail ?? `exitCode=${String(result.exitCode)}`,
      command: args
    };
  } catch (err) {
    return {
      status: "failed",
      detail: sanitizeDetail(err instanceof Error ? err.message : String(err)),
      command: args
    };
  }
}
