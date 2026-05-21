/**
 * Deep startup-program enumeration (Round D-27 / B3, read-only pass).
 *
 * Why a separate module instead of folding into Invoke-FormatBuddyScan.ps1:
 *   1. It runs on demand from the new "PC 켤 때 같이 뜨는 것" page,
 *      not on every quick scan -- ScheduledTask + Service can be slow.
 *   2. It uses the same PowerShellRunner DI pattern as
 *      main/security/defender.ts, so we can unit-test the parser
 *      without spawning powershell.exe.
 *   3. Toggle support stays narrower than inventory. Startup-folder
 *      files and safe Run/RunOnce registry values can be held in the
 *      30-day restore bin; scheduled tasks and services stay read-only
 *      on the startup page. App deletion follow-up has separate guards
 *      for safe leftover traces.
 *
 * Safety:
 *   - We never auto-disable. This pass is inventory-only; explicit
 *     toggle requests go through separate guarded IPC handlers.
 *   - Windows critical services (ones with DelayedAutoStart that
 *     match a hard allowlist on Microsoft Defender, Windows Update,
 *     Themes, etc.) are NOT filtered out -- the user must see them so
 *     they understand what they should never disable when toggle ships.
 *   - All command paths are quoted JSON properties; the renderer
 *     treats them as display strings, never as anything to spawn.
 */
import { spawn } from "node:child_process";
import type {
  StartupAutoEntry,
  StartupAutoKind,
  StartupAutoSnapshot,
  StartupAutoStatus
} from "@shared/types";

const PS_TIMEOUT_MS = 15_000;
const STARTUP_LOOKUP_FAILED_NOTE =
  "시작 항목 조회를 끝내지 못했어요. 잠시 후 다시 조회해주세요.";

export interface PowerShellRunner {
  invoke: (
    args: string[],
    timeoutMs: number
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

function defaultInvoker(): PowerShellRunner["invoke"] {
  return (args, timeoutMs) =>
    new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("timeout"));
      }, timeoutMs);
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (stdout.length > 256_000) stdout = stdout.slice(-256_000);
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

export function defaultStartupRunner(): PowerShellRunner {
  return { invoke: defaultInvoker() };
}

/**
 * The composed PowerShell snippet. We emit a single JSON document with
 * four top-level arrays so we can ship one process instead of four,
 * and so the parser only has to deal with one ConvertTo-Json shape.
 *
 * Notes:
 *   - Get-ScheduledTask | Where-Object filters to triggers that fire
 *     at boot/logon. Tasks with no triggers, or triggers that only
 *     fire at idle, get skipped here -- they don't run on startup.
 *   - Get-Service filters StartType to Automatic + AutomaticDelayed.
 *     Manual services don't auto-start.
 *   - Win32_StartupCommand covers HKLM/HKCU Run + RunOnce.
 *   - Startup folder is enumerated for both per-user and all-users.
 *
 * UTF-8 console encoding is forced first (same trick as the main scan
 * script) so Korean app names survive cp949 systems.
 */
const PS_SCRIPT = `
try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch { }
$ErrorActionPreference = 'SilentlyContinue'

$registry = @()
try {
  $registry = Get-CimInstance -ClassName Win32_StartupCommand | ForEach-Object {
    [ordered]@{
      name = $_.Name
      path = $_.Command
      origin = $_.Location
      registryKeyPath = $_.Location
      registryValueName = $_.Name
      user = $_.User
    }
  }
} catch { }

$tasks = @()
try {
  $tasks = Get-ScheduledTask | Where-Object {
    $triggers = $_.Triggers
    ($triggers | Where-Object {
      $_.CimClass.CimClassName -in @('MSFT_TaskBootTrigger','MSFT_TaskLogonTrigger')
    }).Count -gt 0
  } | ForEach-Object {
    [ordered]@{
      name = $_.TaskName
      path = $_.TaskPath
      enabled = ($_.State -ne 'Disabled')
      author = $_.Author
    }
  }
} catch { }

$services = @()
try {
  $services = Get-CimInstance -ClassName Win32_Service | Where-Object {
    $_.StartMode -eq 'Auto'
  } | ForEach-Object {
    [ordered]@{
      name = $_.Name
      displayName = $_.DisplayName
      path = $_.PathName
      enabled = ($_.StartMode -ne 'Disabled')
      status = "$($_.State)"
    }
  }
} catch { }

$folderItems = @()
$folders = @(
  [Environment]::GetFolderPath('Startup'),
  [Environment]::GetFolderPath('CommonStartup')
)
foreach ($folder in $folders) {
  if (-not $folder) { continue }
  try {
    if (Test-Path $folder) {
      Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue | ForEach-Object {
        $folderItems += [ordered]@{
          name = $_.Name
          path = $_.FullName
          origin = $folder
        }
      }
    }
  } catch { }
}

$out = [ordered]@{
  registry = @($registry)
  tasks = @($tasks)
  services = @($services)
  folderItems = @($folderItems)
}
$out | ConvertTo-Json -Depth 6
`;

interface RegistryRow {
  name?: string;
  path?: string;
  origin?: string;
  registryKeyPath?: string;
  registryValueName?: string;
  user?: string;
}
interface TaskRow {
  name?: string;
  path?: string;
  enabled?: boolean;
  author?: string;
}
interface ServiceRow {
  name?: string;
  displayName?: string;
  path?: string;
  enabled?: boolean;
  status?: string;
}
interface FolderRow {
  name?: string;
  path?: string;
  origin?: string;
}
interface ParsedPayload {
  registry?: RegistryRow[];
  tasks?: TaskRow[];
  services?: ServiceRow[];
  folderItems?: FolderRow[];
}

function safeId(kind: StartupAutoKind, name: string, path?: string): string {
  return `${kind}|${name.toLowerCase()}|${(path ?? "").toLowerCase()}`;
}

function entriesFromRegistry(rows: RegistryRow[] | undefined): StartupAutoEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r?.name === "string" && r.name.length > 0)
    .map((r) => ({
      id: safeId("registry", r.name as string, r.path),
      kind: "registry" as const,
      name: r.name as string,
      path: typeof r.path === "string" ? r.path : undefined,
      registryKeyPath: typeof r.registryKeyPath === "string" ? r.registryKeyPath : undefined,
      registryValueName: typeof r.registryValueName === "string" ? r.registryValueName : undefined,
      origin: r.origin || (r.user ? `${r.user}` : "HKCU/HKLM Run")
    }));
}

function entriesFromTasks(rows: TaskRow[] | undefined): StartupAutoEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r?.name === "string" && r.name.length > 0)
    .map((r) => ({
      id: safeId("scheduled-task", r.name as string, r.path),
      kind: "scheduled-task" as const,
      name: r.name as string,
      path: typeof r.path === "string" ? r.path : undefined,
      publisher: typeof r.author === "string" ? r.author : undefined,
      origin: "작업 스케줄러",
      enabled: typeof r.enabled === "boolean" ? r.enabled : undefined
    }));
}

function entriesFromServices(rows: ServiceRow[] | undefined): StartupAutoEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r?.name === "string" && r.name.length > 0)
    .map((r) => ({
      id: safeId("service", r.name as string),
      kind: "service" as const,
      name: typeof r.displayName === "string" && r.displayName.length > 0 ? r.displayName : (r.name as string),
      path: typeof r.path === "string" ? r.path : undefined,
      serviceName: r.name as string,
      origin: r.status ? `Windows 서비스 · ${r.status}` : "Windows 서비스",
      enabled: typeof r.enabled === "boolean" ? r.enabled : undefined
    }));
}

function entriesFromFolderItems(rows: FolderRow[] | undefined): StartupAutoEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r?.name === "string" && r.name.length > 0)
    .map((r) => ({
      id: safeId("startup-folder", r.name as string, r.path),
      kind: "startup-folder" as const,
      name: r.name as string,
      path: typeof r.path === "string" ? r.path : undefined,
      origin: r.origin || "시작 프로그램 폴더"
    }));
}

export function parseStartupPayload(raw: string): StartupAutoEntry[] {
  let parsed: ParsedPayload;
  try {
    parsed = JSON.parse(raw) as ParsedPayload;
  } catch {
    return [];
  }
  return [
    ...entriesFromRegistry(parsed.registry),
    ...entriesFromTasks(parsed.tasks),
    ...entriesFromServices(parsed.services),
    ...entriesFromFolderItems(parsed.folderItems)
  ];
}

function emptySnapshot(status: StartupAutoStatus, note?: string, now: Date = new Date()): StartupAutoSnapshot {
  return {
    status,
    capturedAt: now.toISOString(),
    entries: [],
    notes: note ? [note] : []
  };
}

export interface ListStartupOptions {
  runner?: PowerShellRunner;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
  now?: () => Date;
}

export async function listStartupAuto(
  opts: ListStartupOptions = {}
): Promise<StartupAutoSnapshot> {
  const platform = opts.platform ?? process.platform;
  const now = opts.now?.() ?? new Date();
  if (platform !== "win32") {
    return emptySnapshot(
      "windows-only",
      "시작 앱 깊은 조회는 Windows에서만 동작해요.",
      now
    );
  }
  const runner = opts.runner ?? defaultStartupRunner();
  try {
    const { exitCode, stdout } = await runner.invoke(
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        PS_SCRIPT
      ],
      opts.timeoutMs ?? PS_TIMEOUT_MS
    );
    if (exitCode !== 0) {
      return emptySnapshot(
        "powershell-failed",
        STARTUP_LOOKUP_FAILED_NOTE,
        now
      );
    }
    const entries = parseStartupPayload(stdout);
    return {
      status: "ok",
      capturedAt: now.toISOString(),
      entries,
      notes: entries.length === 0 ? ["시작 시 자동으로 켜지는 항목을 찾지 못했어요."] : []
    };
  } catch (err) {
    const msg = (err as Error).message;
    return emptySnapshot(
      "powershell-failed",
      msg === "timeout" ? "조회 시간이 너무 길어 멈췄어요." : STARTUP_LOOKUP_FAILED_NOTE,
      now
    );
  }
}

export const __testing = {
  PS_SCRIPT,
  PS_TIMEOUT_MS,
  entriesFromRegistry,
  entriesFromTasks,
  entriesFromServices,
  entriesFromFolderItems,
  safeId
};
