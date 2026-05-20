import { spawn } from "node:child_process";
import type { InstalledApp } from "@shared/types";

export interface InstalledAppsProbeRunner {
  run: (command: string, opts?: { timeoutMs?: number }) => Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    timedOut: boolean;
  }>;
}

const DEFAULT_TIMEOUT_MS = 12_000;

const INSTALLED_APPS_COMMAND = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Convert-RegistryPsPath($Path) {
  if (-not $Path) { return $null }
  $text = [string]$Path
  $text = $text -replace '^Microsoft\.PowerShell\.Core\\Registry::', ''
  $text = $text -replace '^HKEY_LOCAL_MACHINE', 'HKLM:'
  $text = $text -replace '^HKEY_CURRENT_USER', 'HKCU:'
  $text = $text -replace '^HKLM:', 'HKLM'
  $text = $text -replace '^HKCU:', 'HKCU'
  return ($text -replace '/', '\')
}
$paths = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$items = foreach ($path in $paths) {
  Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    [PSCustomObject]@{
      name = [string]$_.DisplayName
      publisher = if ($_.Publisher) { [string]$_.Publisher } else { $null }
      registryKeyPath = Convert-RegistryPsPath $_.PSPath
    }
  }
}
@($items) | ConvertTo-Json -Compress -Depth 3
`;

function defaultRun(command: string, opts: { timeoutMs?: number } = {}) {
  return new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    timedOut: boolean;
  }>((resolve) => {
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
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 4096) stderr = stderr.slice(-4096);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: null, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

export function defaultInstalledAppsProbeRunner(): InstalledAppsProbeRunner {
  return { run: defaultRun };
}

function cleanProbeString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 1024) : null;
}

function coerceInstalledApp(value: unknown): InstalledApp | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = cleanProbeString(raw.name);
  if (!name) return null;
  return {
    name,
    publisher: cleanProbeString(raw.publisher),
    registryKeyPath: cleanProbeString(raw.registryKeyPath)
  };
}

export function parseInstalledAppsProbe(stdout: string): InstalledApp[] {
  const text = stdout.trim();
  if (!text) return [];
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map(coerceInstalledApp).filter((app): app is InstalledApp => Boolean(app));
}

export async function probeInstalledAppsForLeftoverGuard(options: {
  runner?: InstalledAppsProbeRunner;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
} = {}): Promise<InstalledApp[]> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    throw new Error("installed-apps-probe-windows-only");
  }
  const runner = options.runner ?? defaultInstalledAppsProbeRunner();
  const result = await runner.run(INSTALLED_APPS_COMMAND, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });
  if (result.timedOut) throw new Error("installed-apps-probe-timeout");
  if (result.code !== 0) throw new Error("installed-apps-probe-failed");
  return parseInstalledAppsProbe(result.stdout);
}

export const __testing = {
  INSTALLED_APPS_COMMAND,
  cleanProbeString,
  coerceInstalledApp,
  parseInstalledAppsProbe
};
