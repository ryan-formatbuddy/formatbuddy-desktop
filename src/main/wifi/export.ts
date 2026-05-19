/**
 * Wi-Fi profile export via `netsh wlan export profile folder=<dir>`.
 *
 * Two important safety beats:
 *   1. Cleartext passphrases (`key=clear`) are only embedded when the
 *      caller passes includePasswords === true. Default is OFF.
 *   2. Even with the cleartext flag, the produced XML still goes into
 *      a folder the user explicitly picked. We never write to AppData.
 *
 * Why netsh and not the WLAN API directly? netsh ships with every
 * Windows install, requires no extra permissions for read-only export,
 * and the .xml output can be re-imported with `netsh wlan add profile`.
 */
import { spawn } from "node:child_process";
import type {
  WifiExportRequest,
  WifiExportResult,
  WifiExportStatus
} from "@shared/types";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";

const NETSH_TIMEOUT_MS = 60_000;

export interface WifiExportRunner {
  invoke: (
    args: string[],
    timeoutMs: number
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

function defaultInvoker(): WifiExportRunner["invoke"] {
  return (args, timeoutMs) =>
    new Promise((resolve, reject) => {
      const child = spawn("netsh.exe", args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("timeout"));
      }, timeoutMs);
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (stdout.length > 32_000) stdout = stdout.slice(-32_000);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? -1, stdout, stderr });
      });
    });
}

export function defaultWifiExportRunner(): WifiExportRunner {
  return { invoke: defaultInvoker() };
}

export interface ExportWifiOptions extends WifiExportRequest {
  targetDir: string;
  runner?: WifiExportRunner;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

/**
 * netsh prints "Interface profile "<name>" is saved in folder "...""
 * once per profile. Counting those matches gives a stable count across
 * localized Windows builds; the trailing folder path is identical so
 * locale doesn't affect the match.
 */
function parseProfileCount(stdout: string): number | undefined {
  const matches = stdout.match(/is saved in folder/gi);
  if (matches) return matches.length;
  return undefined;
}

function makeResult(
  status: WifiExportStatus,
  includedPasswords: boolean,
  partial: Partial<WifiExportResult> = {}
): WifiExportResult {
  const summaryFallback: Record<WifiExportStatus, string> = {
    ok: "Wi-Fi 프로필을 저장했어요.",
    "windows-only": "Wi-Fi 프로필 백업은 Windows에서만 동작해요.",
    "user-cancelled": "Wi-Fi 프로필 백업을 취소했어요.",
    "netsh-missing": "netsh를 찾지 못했어요. Windows 어디서나 기본 포함되어 있어야 해요.",
    "exec-failed": "Wi-Fi 프로필 백업이 끝나기 전에 멈췄어요."
  };
  return {
    status,
    summary: partial.summary ?? summaryFallback[status],
    includedPasswords,
    ...partial
  };
}

export async function exportWifiProfiles(
  opts: ExportWifiOptions
): Promise<WifiExportResult> {
  const platform = opts.platform ?? process.platform;
  const includedPasswords = Boolean(opts.includePasswords);
  if (platform !== "win32") {
    return makeResult("windows-only", includedPasswords);
  }

  try {
    await ensureSafeOutputDirectoryPath(opts.targetDir, { label: "Wi-Fi export" });
  } catch (err) {
    return makeResult("exec-failed", includedPasswords, {
      detail: (err as Error).message,
      targetDir: opts.targetDir,
      summary: `백업 폴더를 만들지 못했어요 (${opts.targetDir}).`
    });
  }

  const args = [
    "wlan",
    "export",
    "profile",
    `folder=${opts.targetDir}`,
    ...(includedPasswords ? ["key=clear"] : [])
  ];
  const runner = opts.runner ?? defaultWifiExportRunner();

  try {
    const { exitCode, stdout, stderr } = await runner.invoke(
      args,
      opts.timeoutMs ?? NETSH_TIMEOUT_MS
    );
    if (exitCode !== 0) {
      return makeResult("exec-failed", includedPasswords, {
        targetDir: opts.targetDir,
        detail: stderr.slice(0, 400) || `exit ${exitCode}`,
        summary: "netsh wlan export profile이 끝나기 전에 멈췄어요."
      });
    }
    const profileCount = parseProfileCount(stdout);
    const passwordNote = includedPasswords ? " (비밀번호 포함)" : " (비밀번호 제외)";
    return makeResult("ok", includedPasswords, {
      targetDir: opts.targetDir,
      profileCount,
      summary:
        profileCount !== undefined
          ? `Wi-Fi 프로필 ${profileCount}개를 ${opts.targetDir}에 저장했어요${passwordNote}.`
          : `Wi-Fi 프로필 저장이 끝났어요 (${opts.targetDir})${passwordNote}.`
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "timeout") {
      return makeResult("exec-failed", includedPasswords, {
        targetDir: opts.targetDir,
        detail: "timeout",
        summary: "Wi-Fi 프로필 백업이 너무 오래 걸려서 멈췄어요."
      });
    }
    if (/ENOENT/i.test(msg)) {
      return makeResult("netsh-missing", includedPasswords, {
        targetDir: opts.targetDir,
        detail: msg
      });
    }
    return makeResult("exec-failed", includedPasswords, {
      targetDir: opts.targetDir,
      detail: msg
    });
  }
}

export const __testing = { parseProfileCount, defaultInvoker, NETSH_TIMEOUT_MS };
