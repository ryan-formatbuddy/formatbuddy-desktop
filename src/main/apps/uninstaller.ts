/**
 * App uninstaller — launches Windows' own uninstall flow.
 *
 * Why a small parser and direct spawn?
 *   Windows UninstallString values are routinely shell-quoted command
 *   lines, e.g.
 *     "C:\Program Files (x86)\Foo\unins000.exe"
 *     MsiExec.exe /X{12345678-…}
 *   We only support a deliberately narrow subset: a local executable
 *   path (or trusted System32 msiexec) plus plain arguments. Anything
 *   that needs shell interpretation, scripts, remote paths, or silent
 *   switches is blocked and routed back to Windows Settings.
 *
 * Safety checks before we spawn:
 *   - the app must be in the cached scan (renderer cannot inject one)
 *   - it must not be flagged systemComponent=true
 *   - the resolved string must not be empty / whitespace
 *   - it must not include cmd control, expansion, or escape syntax
 *   - it must not go through shell built-ins or DLL/script runner hosts
 *   - it must not include silent/quiet uninstall switches
 *   - no cmd.exe / shell is used; accepted commands are split into
 *     executable + args and spawned directly
 *   - bare/absolute msiexec entries are launched via System32 msiexec
 *     instead of PATH search or an arbitrary same-named executable
 *   - we never run quietUninstallString; FormatBuddy only opens the
 *     interactive Windows uninstall window so the user can confirm
 *
 * After spawning, the process detaches — we don't wait for Windows'
 * GUI uninstaller to finish, and we don't capture its stdio (it
 * doesn't write to either). The caller just learns "launched".
 */
import { spawn } from "node:child_process";
import type {
  AppUninstallRequest,
  AppUninstallResult,
  InstalledApp
} from "@shared/types";

export interface UninstallerDeps {
  /** Look up an app by display name (and optional publisher) in the cached scan. */
  findApp: (request: AppUninstallRequest) => InstalledApp | undefined;
  /** Test hook for the already-validated UninstallString. Product default avoids cmd.exe. */
  spawnCmd?: (command: string) => Promise<{ pid?: number }>;
  /** Optional override so tests can pretend platform === 'win32'. */
  platform?: NodeJS.Platform;
}

const BLOCKED_UNINSTALL_COMMAND_HOSTS = new Set([
  "call",
  "cmd",
  "control",
  "explorer",
  "for",
  "if",
  "powershell",
  "pwsh",
  "reg",
  "regsvr32",
  "rundll32",
  "schtasks",
  "set",
  "start",
  "wmic",
  "wscript",
  "cscript",
  "mshta"
]);

const BLOCKED_UNINSTALL_TARGET_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf"
]);

export type UnsafeUninstallCommandKind =
  | "shell-host"
  | "script-file"
  | "unquoted-spaced-path"
  | "remote-or-url"
  | "relative-executable"
  | "msi-not-uninstall"
  | "silent-mode"
  | "cmd-syntax"
  | "unclosed-quote";

function firstCommandPart(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("\"")) {
    const closing = trimmed.indexOf("\"", 1);
    return closing === -1 ? trimmed.slice(1) : trimmed.slice(1, closing);
  }
  return trimmed.split(/\s+/, 1)[0] ?? "";
}

function commandHost(command: string): string {
  const first = firstCommandPart(command);
  const base = first.split(/[\\/]/).pop() ?? first;
  return base.toLowerCase().replace(/\.exe$/i, "");
}

function targetsBlockedScriptFile(command: string): boolean {
  const first = firstCommandPart(command).toLowerCase();
  return Array.from(BLOCKED_UNINSTALL_TARGET_EXTENSIONS).some((extension) =>
    first.endsWith(extension)
  );
}

function startsWithUnquotedSpacedExecutablePath(command: string): boolean {
  const trimmed = command.trim();
  if (!/^[a-z]:\\/i.test(trimmed)) return false;
  if (/^"[^"]+"/.test(trimmed)) return false;
  const exeIndex = trimmed.toLowerCase().indexOf(".exe");
  if (exeIndex === -1) return false;
  const executablePath = trimmed.slice(0, exeIndex + 4);
  return /\s/.test(executablePath);
}

function referencesRemoteOrUrl(command: string): boolean {
  const first = firstCommandPart(command);
  if (first.startsWith("\\\\")) return true;
  return commandTokens(command).some((token) =>
    /^['"]?\\\\/.test(token) ||
    /=\s*['"]?\\\\/.test(token) ||
    /^['"]?[a-z][a-z0-9+.-]*:\/\//i.test(token) ||
    /=\s*['"]?[a-z][a-z0-9+.-]*:\/\//i.test(token)
  );
}

function startsWithRelativeExecutable(command: string): boolean {
  const first = firstCommandPart(command);
  if (!first) return false;
  if (/^[a-z]:[\\/]/i.test(first)) return false;
  if (first.startsWith("\\\\")) return false;
  return commandHost(command) !== "msiexec";
}

function isMsiExecCommand(command: string): boolean {
  return commandHost(command) === "msiexec";
}

function commandTokens(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (const char of command.trim()) {
    if (char === "\"") {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function trustedWindowsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const raw = typeof env.SystemRoot === "string" ? env.SystemRoot.trim() : "";
  const normalized = raw.replace(/\//g, "\\").replace(/\\+$/g, "");
  return /^[a-z]:\\windows$/i.test(normalized) ? normalized : "C:\\Windows";
}

function trustedMsiExecPath(env: NodeJS.ProcessEnv = process.env): string {
  return `${trustedWindowsRoot(env)}\\System32\\msiexec.exe`;
}

function hasSilentUninstallSwitch(command: string): boolean {
  const exactSilentSwitches = new Set([
    "/q",
    "/qn",
    "/qb",
    "/quiet",
    "/passive",
    "/s",
    "/silent",
    "/verysilent",
    "/suppressmsgboxes",
    "-q",
    "-quiet",
    "-silent",
    "--quiet",
    "--silent",
    "--unattended"
  ]);

  const assignmentSilentSwitches = new Set([
    "/quiet",
    "/passive",
    "/s",
    "/silent",
    "/verysilent",
    "/suppressmsgboxes",
    "-q",
    "-quiet",
    "-silent",
    "--quiet",
    "--silent",
    "--unattended"
  ]);

  return commandTokens(command)
    .slice(1)
    .some((token) => {
      const normalized = token.toLowerCase();
      const baseSwitch = normalized.split(/[=:]/, 1)[0] ?? normalized;
      return (
        exactSilentSwitches.has(normalized) ||
        assignmentSilentSwitches.has(baseSwitch) ||
        /^\/q[nbrf]?[+!]*$/i.test(normalized)
      );
    });
}

function hasMsiUninstallIntent(command: string): boolean {
  if (!isMsiExecCommand(command)) return true;

  return commandTokens(command)
    .slice(1)
    .some((token) => {
      const normalized = token.toLowerCase();
      return normalized === "/x" || normalized.startsWith("/x{") || normalized === "/uninstall";
    });
}

function isStrictDisplayString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isOptionalStrictDisplayString(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  if (value.length === 0) return true;
  return value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeUninstallMode(value: unknown): value is AppUninstallRequest["mode"] {
  return value === undefined || value === "interactive" || value === "quiet";
}

function invalidRequestResult(message: string): AppUninstallResult {
  return {
    status: "blocked",
    appName: "선택한 앱",
    message,
    detail: "invalid-uninstall-request"
  };
}

function validateUninstallRequest(request: AppUninstallRequest):
  | { ok: true }
  | { ok: false; result: AppUninstallResult } {
  if (!isStrictDisplayString(request?.appName)) {
    return {
      ok: false,
      result: invalidRequestResult("앱 제거 대상을 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.")
    };
  }
  if (!isOptionalStrictDisplayString(request.publisher)) {
    return {
      ok: false,
      result: invalidRequestResult("앱 제거 정보를 확인하지 못했어요. 다시 점검한 뒤 앱을 선택해주세요.")
    };
  }
  if (!isSafeUninstallMode(request.mode)) {
    return {
      ok: false,
      result: invalidRequestResult("앱 제거 방식을 확인하지 못했어요. 다시 선택해주세요.")
    };
  }
  return { ok: true };
}

function readUninstallCommand(
  app: InstalledApp
): { status: "ok"; command: string } | { status: "missing" | "invalid" } {
  const value = (app as { uninstallString?: unknown }).uninstallString;
  if (value === undefined || value === null) return { status: "missing" };
  if (typeof value !== "string") return { status: "invalid" };
  if (!value.trim()) return { status: "missing" };
  return { status: "ok", command: value };
}

export function isUnsafeUninstallCommand(command: string): boolean {
  return unsafeUninstallCommandKind(command) !== null;
}

export function unsafeUninstallCommandKind(command: string): UnsafeUninstallCommandKind | null {
  let inQuote = false;

  if (BLOCKED_UNINSTALL_COMMAND_HOSTS.has(commandHost(command))) return "shell-host";
  if (targetsBlockedScriptFile(command)) return "script-file";
  if (startsWithUnquotedSpacedExecutablePath(command)) return "unquoted-spaced-path";
  if (referencesRemoteOrUrl(command)) return "remote-or-url";
  if (startsWithRelativeExecutable(command)) return "relative-executable";
  if (!hasMsiUninstallIntent(command)) return "msi-not-uninstall";
  if (hasSilentUninstallSwitch(command)) return "silent-mode";

  for (const char of command) {
    if (char === "\n" || char === "\r" || char === "\0") return "cmd-syntax";
    if (char === "%" || char === "!" || char === "^") return "cmd-syntax";
    if (char === "\"") {
      inQuote = !inQuote;
      continue;
    }
    if (
      !inQuote &&
      (char === "&" || char === "|" || char === "<" || char === ">" || char === "(" || char === ")")
    ) {
      return "cmd-syntax";
    }
  }

  return inQuote ? "unclosed-quote" : null;
}

export function blockedUninstallMessage(command: string): string {
  const kind = unsafeUninstallCommandKind(command);

  switch (kind) {
    case "shell-host":
      return "별도 실행 도구를 거쳐 실행되는 제거 명령이라 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "script-file":
      return "스크립트 파일을 실행하는 제거 명령이라 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "unquoted-spaced-path":
      return "경로에 공백이 있는데 따옴표가 없어 Windows가 다르게 해석할 수 있어요. Windows 설정에서 직접 제거해주세요.";
    case "remote-or-url":
      return "로컬 PC 안의 제거 명령인지 확인하기 어려워 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "relative-executable":
      return "제거 프로그램의 전체 경로를 확인하기 어려워 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "msi-not-uninstall":
      return "MSI 제거 명령인지 확인하기 어려워 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "silent-mode":
      return "조용히 제거되는 옵션이 들어 있어 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 확인하며 제거해주세요.";
    case "unclosed-quote":
      return "제거 명령의 따옴표가 닫혀 있지 않아 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "cmd-syntax":
    default:
      return "Windows가 다르게 해석할 수 있는 제거 명령이라 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
  }
}

export function canLaunchUninstall(
  request: AppUninstallRequest,
  app: InstalledApp | undefined,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (platform !== "win32") return false;
  if (!validateUninstallRequest(request).ok) return false;
  if (request.mode === "quiet") return false;
  if (!app) return false;
  if (app.systemComponent === true) return false;
  const chosen = readUninstallCommand(app);
  return chosen.status === "ok" && !isUnsafeUninstallCommand(chosen.command);
}

function spawnSpecForUninstall(
  command: string,
  env: NodeJS.ProcessEnv = process.env
): { executable: string; args: string[] } | null {
  const tokens = commandTokens(command);
  const executable = isMsiExecCommand(command) ? trustedMsiExecPath(env) : tokens[0];
  if (!executable) return null;
  return { executable, args: tokens.slice(1) };
}

async function defaultSpawn(command: string): Promise<{ pid?: number }> {
  return await new Promise((resolveSpawn, rejectSpawn) => {
    try {
      const spec = spawnSpecForUninstall(command);
      if (!spec) {
        rejectSpawn(new Error("Invalid uninstall command"));
        return;
      }
      const child = spawn(spec.executable, spec.args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
        shell: false
      });
      child.once("error", rejectSpawn);
      child.once("spawn", () => {
        // detached + unref so quitting FormatBuddy doesn't kill the
        // Windows uninstall GUI mid-flow.
        child.unref();
        resolveSpawn({ pid: child.pid });
      });
    } catch (e) {
      rejectSpawn(e);
    }
  });
}

export async function runUninstall(
  request: AppUninstallRequest,
  deps: UninstallerDeps
): Promise<AppUninstallResult> {
  const platform = deps.platform ?? process.platform;
  const requestValidation = validateUninstallRequest(request);
  if (!requestValidation.ok) return requestValidation.result;

  if (platform !== "win32") {
    return {
      status: "blocked",
      appName: request.appName,
      message: "앱 제거는 Windows에서만 실행할 수 있어요.",
      detail: `platform=${platform}`
    };
  }

  const app = deps.findApp(request);
  if (!app) {
    return {
      status: "app-not-found",
      appName: request.appName,
      message: "최근 진단 결과에서 이 앱을 찾지 못했어요. 다시 점검 후 시도해주세요."
    };
  }

  if (app.systemComponent === true) {
    return {
      status: "blocked",
      appName: request.appName,
      message: "Windows 구성요소로 표시된 앱은 자동 제거를 띄우지 않아요.",
      detail: "systemComponent=true"
    };
  }

  const mode = request.mode ?? "interactive";
  if (mode === "quiet") {
    return {
      status: "blocked",
      appName: request.appName,
      message: "포맷버디는 Windows 제거 창만 열어요. 제거 여부는 직접 확인해주세요.",
      detail: "quiet-uninstall-blocked"
    };
  }
  const chosen = readUninstallCommand(app);

  if (chosen.status !== "ok") {
    if (chosen.status === "invalid") {
      return {
        status: "blocked",
        appName: request.appName,
        message: "Windows 제거 명령을 확인하지 못했어요. 다시 점검한 뒤 시도해주세요.",
        detail: "invalid-uninstall-command"
      };
    }
    return {
      status: "no-uninstall-string",
      appName: request.appName,
      message: "Windows 제거 명령이 없어요. Windows 설정에서 직접 제거해주세요."
    };
  }

  const unsafeKind = unsafeUninstallCommandKind(chosen.command);
  if (unsafeKind) {
    return {
      status: "blocked",
      appName: request.appName,
      message: blockedUninstallMessage(chosen.command),
      detail: `unsafe-uninstall-command:${unsafeKind}`
    };
  }

  try {
    const result = await (deps.spawnCmd ?? defaultSpawn)(chosen.command);
    return {
      status: "launched",
      appName: request.appName,
      message: "Windows 제거 창을 열었어요. 진행 여부는 그 안에서 직접 결정해주세요.",
      detail: result.pid ? `pid=${result.pid}` : undefined
    };
  } catch {
    return {
      status: "spawn-failed",
      appName: request.appName,
      message: "Windows 제거를 시작하지 못했어요.",
      detail: "spawn-failed"
    };
  }
}

export const __testing = {
  blockedUninstallMessage,
  defaultSpawn,
  hasUnsafeShellControl: isUnsafeUninstallCommand,
  isUnsafeUninstallCommand,
  spawnSpecForUninstall,
  trustedMsiExecPath,
  trustedWindowsRoot,
  unsafeUninstallCommandKind
};
