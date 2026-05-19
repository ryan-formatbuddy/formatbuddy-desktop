/**
 * App uninstaller — launches Windows' own uninstall flow.
 *
 * Why cmd.exe and not direct spawn?
 *   Windows UninstallString values are routinely shell-quoted command
 *   lines, e.g.
 *     "C:\Program Files (x86)\Foo\unins000.exe"
 *     MsiExec.exe /X{12345678-…}
 *     "C:\Windows\System32\rundll32.exe" appwiz.cpl,...
 *   Splitting these reliably without cmd.exe means re-implementing the
 *   Windows command parser. cmd /c does it for us, and we never
 *   accept the string from the renderer — only the (name, publisher)
 *   pair, which we look up in the in-memory scan cache.
 *
 * Safety checks before we spawn:
 *   - the app must be in the cached scan (renderer cannot inject one)
 *   - it must not be flagged systemComponent=true
 *   - the resolved string must not be empty / whitespace
 *   - it must not include cmd control, expansion, or escape syntax
 *   - we never run quietUninstallString unless the caller opted in
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
  /** Spawn a cmd.exe instance with the given UninstallString. */
  spawnCmd?: (command: string) => Promise<{ pid?: number }>;
  /** Optional override so tests can pretend platform === 'win32'. */
  platform?: NodeJS.Platform;
}

const BLOCKED_UNINSTALL_COMMAND_HOSTS = new Set([
  "cmd",
  "powershell",
  "pwsh",
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

export function isUnsafeUninstallCommand(command: string): boolean {
  return unsafeUninstallCommandKind(command) !== null;
}

export function unsafeUninstallCommandKind(command: string): UnsafeUninstallCommandKind | null {
  let inQuote = false;

  if (BLOCKED_UNINSTALL_COMMAND_HOSTS.has(commandHost(command))) return "shell-host";
  if (targetsBlockedScriptFile(command)) return "script-file";
  if (startsWithUnquotedSpacedExecutablePath(command)) return "unquoted-spaced-path";

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
      return "PowerShell이나 명령 프롬프트를 거쳐 실행되는 제거 명령이라 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "script-file":
      return "스크립트 파일을 실행하는 제거 명령이라 FormatBuddy에서는 자동 실행하지 않아요. Windows 설정에서 직접 제거해주세요.";
    case "unquoted-spaced-path":
      return "경로에 공백이 있는데 따옴표가 없어 Windows가 다르게 해석할 수 있어요. Windows 설정에서 직접 제거해주세요.";
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
  if (!app) return false;
  if (app.systemComponent === true) return false;
  const mode = request.mode ?? "interactive";
  const chosen =
    mode === "quiet"
      ? app.quietUninstallString || ""
      : app.uninstallString || "";
  return chosen.trim().length > 0 && !isUnsafeUninstallCommand(chosen);
}

async function defaultSpawn(command: string): Promise<{ pid?: number }> {
  return await new Promise((resolveSpawn, rejectSpawn) => {
    try {
      const child = spawn("cmd.exe", ["/c", command], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });
      child.on("error", rejectSpawn);
      // detached + unref so quitting FormatBuddy doesn't kill the
      // Windows uninstall GUI mid-flow.
      child.unref();
      resolveSpawn({ pid: child.pid });
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
  const chosen =
    mode === "quiet"
      ? app.quietUninstallString || ""
      : app.uninstallString || "";

  if (!chosen.trim()) {
    return {
      status: "no-uninstall-string",
      appName: request.appName,
      message:
        mode === "quiet"
          ? "자동 제거 명령이 없어요. Windows 설정에서 직접 제거해주세요."
          : "Windows 제거 명령이 없어요. Windows 설정에서 직접 제거해주세요."
    };
  }

  if (isUnsafeUninstallCommand(chosen)) {
    return {
      status: "blocked",
      appName: request.appName,
      message: blockedUninstallMessage(chosen),
      detail: "unsafe-uninstall-command"
    };
  }

  try {
    const result = await (deps.spawnCmd ?? defaultSpawn)(chosen);
    return {
      status: "launched",
      appName: request.appName,
      message:
        mode === "quiet"
          ? "자동 제거를 시작했어요. 진행 상태는 Windows 알림에서 확인해주세요."
          : "Windows 제거 마법사를 띄웠어요. 진행 여부는 마법사에서 직접 결정해주세요.",
      detail: result.pid ? `pid=${result.pid}` : undefined
    };
  } catch (err) {
    return {
      status: "spawn-failed",
      appName: request.appName,
      message: "Windows 제거를 시작하지 못했어요.",
      detail: (err as Error).message
    };
  }
}

export const __testing = {
  blockedUninstallMessage,
  defaultSpawn,
  hasUnsafeShellControl: isUnsafeUninstallCommand,
  isUnsafeUninstallCommand,
  unsafeUninstallCommandKind
};
