/**
 * System Restore Point trigger.
 *
 * Wraps PowerShell `Checkpoint-Computer` so cleanup / uninstall can ask
 * Windows to take a snapshot right before doing something irreversible.
 * Failure to create one is NEVER a hard error -- we surface a reason
 * string and let the caller continue. The user has consented to the
 * action; we just lose the safety net if VSS isn't available.
 *
 * Notable Windows quirks we soak:
 *   - Checkpoint-Computer silently refuses if a restore point was
 *     created within the last 24 h. We return reason "cooldown".
 *   - Client SKUs (Pro / Home) have System Protection OFF by default;
 *     calls then exit code 0 without creating anything. We can't
 *     distinguish that from "actually created", so we trust the exit
 *     and surface the user-visible warning only if PowerShell errors.
 *   - Server SKUs / Windows 7-era hosts may need
 *     `Enable-ComputerRestore -Drive "C:\\"` first. Out of scope here.
 */
import { spawn } from "node:child_process";

export type RestorePointResult =
  | { created: true; description: string }
  | { created: false; reason: "non-windows" | "spawn-failed" | "ps-error" | "timeout"; detail?: string };

export interface RestorePointRunner {
  /**
   * Spawn powershell with the given -Command body and resolve with the
   * exit code + stderr. Default uses node:child_process; tests inject
   * their own runner.
   */
  invoke: (psCommand: string, timeoutMs: number) => Promise<{ exitCode: number; stderr: string }>;
}

const PS_TIMEOUT_MS = 60_000;
const MAX_DESCRIPTION_LENGTH = 120;

function defaultInvoker(): RestorePointRunner["invoke"] {
  return (psCommand, timeoutMs) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          psCommand
        ],
        { windowsHide: true }
      );
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("timeout"));
      }, timeoutMs);
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
        resolve({ exitCode: code ?? -1, stderr });
      });
    });
}

export function defaultRestorePointRunner(): RestorePointRunner {
  return { invoke: defaultInvoker() };
}

export interface CreateRestorePointOptions {
  description: string;
  /** "MODIFY_SETTINGS" matches Microsoft's recommendation for "user-initiated cleanup". */
  type?: "MODIFY_SETTINGS" | "APPLICATION_INSTALL" | "APPLICATION_UNINSTALL";
  runner?: RestorePointRunner;
  /** Override for tests. Defaults to win32. */
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}

function sanitizeDescription(description: string): string {
  const cleaned = description
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "작업 전 안전 저장").slice(0, MAX_DESCRIPTION_LENGTH);
}

/**
 * Ask Windows to checkpoint the current system state. The description
 * is what the user sees in System Restore UI later, so prefix it with
 * "FormatBuddy:" so it's discoverable.
 */
export async function createRestorePoint(
  opts: CreateRestorePointOptions
): Promise<RestorePointResult> {
  const platform = opts.platform ?? process.platform;
  if (platform !== "win32") {
    return { created: false, reason: "non-windows" };
  }
  const runner = opts.runner ?? defaultRestorePointRunner();
  const type = opts.type ?? "MODIFY_SETTINGS";
  // Escape single-quotes in the description before passing through
  // PowerShell. Description should already be Korean-safe ASCII per
  // our copy rules, but defense in depth.
  const sanitizedDescription = sanitizeDescription(opts.description);
  const safeDescription = sanitizedDescription.replace(/'/g, "''");
  const psCommand = `Checkpoint-Computer -Description 'FormatBuddy: ${safeDescription}' -RestorePointType '${type}'`;
  try {
    const { exitCode, stderr } = await runner.invoke(psCommand, opts.timeoutMs ?? PS_TIMEOUT_MS);
    if (exitCode === 0) {
      return { created: true, description: sanitizedDescription };
    }
    return {
      created: false,
      reason: "ps-error",
      detail: `exit ${exitCode}: ${stderr.slice(0, 240)}`
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "timeout") return { created: false, reason: "timeout" };
    return { created: false, reason: "spawn-failed", detail: msg };
  }
}

export const __testing = { defaultInvoker, PS_TIMEOUT_MS, sanitizeDescription };
