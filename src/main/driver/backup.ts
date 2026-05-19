/**
 * Driver backup via `pnputil /export-driver * <targetDir>`.
 *
 * Format preparation in the safest possible form: we copy the user's
 * third-party drivers (network cards, printers, fingerprint readers,
 * vendor utilities) into a folder they can carry through a wipe and
 * re-install with `pnputil /add-driver`.
 *
 * No registry edits, no system changes. Read + copy only.
 */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import type {
  DriverBackupResult,
  DriverBackupStatus
} from "@shared/types";

const PS_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — large driver sets can be slow

export interface DriverBackupRunner {
  invoke: (
    args: string[],
    timeoutMs: number
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

function defaultInvoker(): DriverBackupRunner["invoke"] {
  return (args, timeoutMs) =>
    new Promise((resolve, reject) => {
      const child = spawn("pnputil.exe", args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("timeout"));
      }, timeoutMs);
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (stdout.length > 64_000) stdout = stdout.slice(-64_000);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        // ENOENT (pnputil missing) bubbles here on misconfigured PATH.
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? -1, stdout, stderr });
      });
    });
}

export function defaultDriverBackupRunner(): DriverBackupRunner {
  return { invoke: defaultInvoker() };
}

export interface ExportDriversOptions {
  targetDir: string;
  runner?: DriverBackupRunner;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

/**
 * Count "package_NNN" matches in pnputil stdout. The line format on
 * Windows 10/11 is:
 *
 *   Exporting driver package: oem15.inf
 *   ...
 *   Total driver packages: 27
 *
 * We grep "Total driver packages: N" first, then fall back to counting
 * "Exporting" lines if the summary line is localized.
 */
function parseDriverCount(stdout: string): number | undefined {
  const totalMatch = stdout.match(/Total driver packages:\s*(\d+)/i);
  if (totalMatch) return Number(totalMatch[1]);
  const exportingMatches = stdout.match(/Exporting driver package/gi);
  if (exportingMatches) return exportingMatches.length;
  return undefined;
}

function makeResult(status: DriverBackupStatus, partial: Partial<DriverBackupResult> = {}): DriverBackupResult {
  const summaryFallback: Record<DriverBackupStatus, string> = {
    ok: "드라이버 백업을 끝냈어요.",
    "windows-only": "드라이버 백업은 Windows에서만 동작해요.",
    "user-cancelled": "드라이버 백업을 취소했어요.",
    "pnputil-missing": "pnputil을 찾지 못했어요. Windows 10/11 어디서나 기본 포함되어 있어야 해요.",
    "exec-failed": "드라이버 백업이 끝나기 전에 멈췄어요."
  };
  return {
    status,
    summary: partial.summary ?? summaryFallback[status],
    ...partial
  };
}

export async function exportDrivers(
  opts: ExportDriversOptions
): Promise<DriverBackupResult> {
  const platform = opts.platform ?? process.platform;
  if (platform !== "win32") return makeResult("windows-only");

  try {
    await mkdir(opts.targetDir, { recursive: true });
  } catch (err) {
    return makeResult("exec-failed", {
      detail: (err as Error).message,
      targetDir: opts.targetDir,
      summary: `백업 폴더를 만들지 못했어요 (${opts.targetDir}).`
    });
  }

  const runner = opts.runner ?? defaultDriverBackupRunner();
  try {
    const { exitCode, stdout, stderr } = await runner.invoke(
      ["/export-driver", "*", opts.targetDir],
      opts.timeoutMs ?? PS_TIMEOUT_MS
    );
    if (exitCode !== 0) {
      return makeResult("exec-failed", {
        targetDir: opts.targetDir,
        detail: stderr.slice(0, 400) || `exit ${exitCode}`,
        summary: "드라이버 백업이 끝나기 전에 pnputil이 멈췄어요."
      });
    }
    const driverCount = parseDriverCount(stdout);
    return makeResult("ok", {
      targetDir: opts.targetDir,
      driverCount,
      summary:
        driverCount !== undefined
          ? `드라이버 ${driverCount}개를 ${opts.targetDir}에 백업했어요.`
          : `드라이버 백업이 끝났어요 (${opts.targetDir}).`
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "timeout") {
      return makeResult("exec-failed", {
        targetDir: opts.targetDir,
        detail: "timeout",
        summary: "드라이버 백업이 너무 오래 걸려서 멈췄어요."
      });
    }
    if (/ENOENT/i.test(msg)) {
      return makeResult("pnputil-missing", { targetDir: opts.targetDir, detail: msg });
    }
    return makeResult("exec-failed", { targetDir: opts.targetDir, detail: msg });
  }
}

export const __testing = { parseDriverCount, defaultInvoker, PS_TIMEOUT_MS };
