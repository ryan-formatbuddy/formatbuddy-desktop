/**
 * Windows Defender bridge.
 *
 * Three operations, all behind PowerShell:
 *   1. getDefenderStatus()   → Get-MpComputerStatus | ConvertTo-Json
 *   2. runQuickScan()        → Start-MpScan -ScanType QuickScan (detached;
 *                              Windows Security UI handles progress)
 *   3. getThreatHistory()    → Get-MpThreatDetection | ConvertTo-Json
 *
 * Tone contract — we NEVER claim FormatBuddy cleaned, treated, removed,
 * or neutralized a threat. Defender's own raw status string is what
 * the UI shows; our enum is for layout only. The UI-tone guard test
 * checks that no copy says "치료", "감염 발견", "악성코드 제거" etc.
 *
 * Dependency injection follows the same pattern as the cleanup
 * executor: callers pass a `runPowershell` + `spawnDetached` so unit
 * tests don't spawn real processes. The default factory wires them
 * to child_process for production.
 */
import { spawn } from "node:child_process";
import type {
  DefenderLiveStatus,
  DefenderQuickScanResult,
  DefenderThreatActionSuccess,
  DefenderThreatRecord,
  DefenderThreatSnapshot
} from "@shared/types";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_THREAT_RECORDS = 50;
const MAX_THREAT_RESOURCES = 10;

export interface PowerShellRunResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

export interface PowerShellRunner {
  run: (command: string, opts?: { timeoutMs?: number }) => Promise<PowerShellRunResult>;
  detached: (command: string) => Promise<{ pid?: number }>;
}

export interface DefenderDeps {
  shell: PowerShellRunner;
  platform?: NodeJS.Platform;
  now?: () => Date;
}

function defaultRun(command: string, opts: { timeoutMs?: number } = {}): Promise<PowerShellRunResult> {
  return new Promise((resolveRun) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ stdout, stderr, code, timedOut });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolveRun({ stdout, stderr, code: null, timedOut });
    });
  });
}

function defaultDetached(command: string): Promise<{ pid?: number }> {
  return new Promise((resolveSpawn, rejectSpawn) => {
    try {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
        { detached: true, stdio: "ignore", windowsHide: true }
      );
      child.on("error", rejectSpawn);
      child.unref();
      resolveSpawn({ pid: child.pid });
    } catch (e) {
      rejectSpawn(e);
    }
  });
}

export function defaultPowerShellRunner(): PowerShellRunner {
  return { run: defaultRun, detached: defaultDetached };
}

function isoNow(deps: DefenderDeps): string {
  return (deps.now?.() ?? new Date()).toISOString();
}

function parsePsDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    // "/Date(1716000000000)/" or ISO
    const wcf = value.match(/\/Date\((-?\d+)\)\//);
    if (wcf) return new Date(Number(wcf[1])).toISOString();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return null;
}

function daysBetween(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export async function getDefenderStatus(deps: DefenderDeps): Promise<DefenderLiveStatus> {
  const platform = deps.platform ?? process.platform;
  if (platform !== "win32") {
    return {
      capturedAt: isoNow(deps),
      available: false,
      unavailableReason: "Windows에서만 Defender 상태를 확인할 수 있어요."
    };
  }

  const command =
    "Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled," +
    "IsTamperProtected,AntivirusSignatureLastUpdated,QuickScanEndTime,FullScanEndTime | ConvertTo-Json -Compress";

  const result = await deps.shell.run(command, { timeoutMs: 10_000 });
  if (result.timedOut) {
    return {
      capturedAt: isoNow(deps),
      available: false,
      unavailableReason: "Windows 보안 상태 조회가 시간 초과됐어요."
    };
  }
  if (result.code !== 0 || !result.stdout.trim()) {
    return {
      capturedAt: isoNow(deps),
      available: false,
      unavailableReason:
        result.stderr.trim() || "Windows 보안 상태를 가져오지 못했어요. (PowerShell 모듈 확인 필요)"
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    return {
      capturedAt: isoNow(deps),
      available: false,
      unavailableReason: "Windows 보안 상태 응답을 해석하지 못했어요."
    };
  }

  const now = deps.now?.() ?? new Date();
  const signatureUpdated = parsePsDate(raw.AntivirusSignatureLastUpdated);
  const quickEnd = parsePsDate(raw.QuickScanEndTime);
  const fullEnd = parsePsDate(raw.FullScanEndTime);

  return {
    capturedAt: isoNow(deps),
    available: true,
    antivirusEnabled:
      typeof raw.AntivirusEnabled === "boolean" ? raw.AntivirusEnabled : null,
    realTimeProtectionEnabled:
      typeof raw.RealTimeProtectionEnabled === "boolean" ? raw.RealTimeProtectionEnabled : null,
    tamperProtectionEnabled:
      typeof raw.IsTamperProtected === "boolean" ? raw.IsTamperProtected : null,
    signatureAgeDays: daysBetween(signatureUpdated, now),
    lastQuickScanDaysAgo: daysBetween(quickEnd, now),
    lastFullScanDaysAgo: daysBetween(fullEnd, now)
  };
}

export async function runQuickScan(deps: DefenderDeps): Promise<DefenderQuickScanResult> {
  const platform = deps.platform ?? process.platform;
  const startedAt = isoNow(deps);
  if (platform !== "win32") {
    return {
      status: "blocked",
      startedAt,
      message: "빠른 검사는 Windows에서만 실행할 수 있어요.",
      detail: `platform=${platform}`
    };
  }
  try {
    const { pid } = await deps.shell.detached("Start-MpScan -ScanType QuickScan");
    return {
      status: "launched",
      startedAt,
      message:
        "Windows 보안 빠른 검사를 시작했어요. 진행 상황과 결과는 Windows 보안 화면에서 확인해주세요.",
      detail: pid ? `pid=${pid}` : undefined
    };
  } catch (err) {
    return {
      status: "spawn-failed",
      startedAt,
      message: "빠른 검사를 시작하지 못했어요. PowerShell 실행이 막혀 있을 수 있어요.",
      detail: (err as Error).message
    };
  }
}

function actionFromDefender(raw: unknown): { status: DefenderThreatActionSuccess; rawStatus?: string } {
  if (typeof raw === "string") {
    const lc = raw.toLowerCase();
    if (lc.includes("clean")) return { status: "cleaned", rawStatus: raw };
    if (lc.includes("quarantine")) return { status: "quarantined", rawStatus: raw };
    if (lc.includes("remove")) return { status: "removed", rawStatus: raw };
    if (lc.includes("allow")) return { status: "allowed", rawStatus: raw };
    if (lc.includes("block")) return { status: "blocked", rawStatus: raw };
    if (lc.includes("none") || lc.includes("noaction")) {
      return { status: "no-action", rawStatus: raw };
    }
    return { status: "unknown", rawStatus: raw };
  }
  if (typeof raw === "number") {
    // Defender numeric action codes — surface them but don't pretend
    // they mean more than what the user can see in Windows Security.
    switch (raw) {
      case 1:
        return { status: "cleaned", rawStatus: "Clean" };
      case 2:
        return { status: "quarantined", rawStatus: "Quarantine" };
      case 3:
        return { status: "removed", rawStatus: "Remove" };
      case 6:
        return { status: "allowed", rawStatus: "Allow" };
      case 9:
        return { status: "no-action", rawStatus: "NoAction" };
      case 10:
        return { status: "blocked", rawStatus: "Block" };
      default:
        return { status: "unknown", rawStatus: `code=${raw}` };
    }
  }
  return { status: "unknown" };
}

function severityFromDefender(raw: unknown): DefenderThreatRecord["severity"] {
  if (typeof raw === "number") {
    if (raw >= 5) return "severe";
    if (raw >= 4) return "high";
    if (raw >= 2) return "moderate";
    if (raw >= 1) return "low";
  }
  if (typeof raw === "string") {
    const lc = raw.toLowerCase();
    if (lc.includes("severe")) return "severe";
    if (lc.includes("high")) return "high";
    if (lc.includes("moderate") || lc.includes("medium")) return "moderate";
    if (lc.includes("low")) return "low";
  }
  return "unknown";
}

function resourceListFrom(raw: unknown): string[] | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const resources = list
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, MAX_THREAT_RESOURCES);
  return resources.length > 0 ? resources : undefined;
}

function recordsFrom(parsed: unknown): DefenderThreatRecord[] {
  const list = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).slice(
    0,
    MAX_THREAT_RECORDS
  );
  const out: DefenderThreatRecord[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const action = actionFromDefender(obj.MostRecentDetectionAction ?? obj.InitialDetectionAction);
    out.push({
      id: String(obj.ThreatID ?? obj.DetectionID ?? `${out.length}`),
      threatName: typeof obj.ThreatName === "string" ? obj.ThreatName : null,
      detectionTime:
        parsePsDate(obj.InitialDetectionTime) ??
        parsePsDate(obj.LastThreatStatusChangeTime),
      severity: severityFromDefender(obj.SeverityID ?? obj.Severity),
      actionStatus: action.status,
      resources: resourceListFrom(obj.Resources),
      rawStatus: action.rawStatus
    });
  }
  return out;
}

export async function getThreatHistory(deps: DefenderDeps): Promise<DefenderThreatSnapshot> {
  const platform = deps.platform ?? process.platform;
  if (platform !== "win32") {
    return {
      capturedAt: isoNow(deps),
      available: false,
      records: [],
      unavailableReason: "Windows에서만 위협 기록을 확인할 수 있어요."
    };
  }
  const command =
    "Get-MpThreatDetection | Sort-Object -Property InitialDetectionTime -Descending | " +
    `Select-Object -First ${MAX_THREAT_RECORDS} -Property ThreatID,ThreatName,InitialDetectionTime,` +
    "LastThreatStatusChangeTime,Resources,SeverityID,InitialDetectionAction,MostRecentDetectionAction" +
    " | ConvertTo-Json -Depth 4 -Compress";
  const result = await deps.shell.run(command, { timeoutMs: 10_000 });
  if (result.timedOut) {
    return {
      capturedAt: isoNow(deps),
      available: false,
      records: [],
      unavailableReason: "위협 기록 조회가 시간 초과됐어요."
    };
  }
  if (result.code !== 0) {
    return {
      capturedAt: isoNow(deps),
      available: false,
      records: [],
      unavailableReason:
        result.stderr.trim() || "위협 기록을 가져오지 못했어요. (PowerShell 모듈 확인 필요)"
    };
  }
  const text = result.stdout.trim();
  if (!text) {
    return {
      capturedAt: isoNow(deps),
      available: true,
      records: []
    };
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return {
      capturedAt: isoNow(deps),
      available: true,
      records: recordsFrom(parsed)
    };
  } catch {
    return {
      capturedAt: isoNow(deps),
      available: false,
      records: [],
      unavailableReason: "위협 기록 응답을 해석하지 못했어요."
    };
  }
}

export const __testing = {
  parsePsDate,
  daysBetween,
  MAX_THREAT_RECORDS,
  MAX_THREAT_RESOURCES,
  resourceListFrom,
  recordsFrom,
  actionFromDefender,
  severityFromDefender
};
