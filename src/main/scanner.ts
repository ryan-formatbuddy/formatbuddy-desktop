import { spawn } from "node:child_process";
import { existsSync, mkdirSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";

const STDERR_MAX_BYTES = 64 * 1024;
const INTEGRITY_MANIFEST = "script.sha256";

async function verifyScriptIntegrity(
  scriptPath: string,
  opts: { enforce: boolean }
): Promise<void> {
  const manifestPath = join(dirname(scriptPath), INTEGRITY_MANIFEST);
  let expected: string;
  try {
    expected = (await fs.readFile(manifestPath, "utf8")).trim();
  } catch {
    if (opts.enforce) {
      throw new Error(`PowerShell integrity manifest missing: ${manifestPath}`);
    }
    return; // dev / mock — silent skip when manifest hasn't been generated
  }
  let actual: string;
  try {
    const buf = await fs.readFile(scriptPath);
    actual = createHash("sha256").update(buf).digest("hex");
  } catch (e) {
    if (opts.enforce) throw e;
    return;
  }
  if (actual !== expected) {
    throw new Error(
      `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
    );
  }
}

function isScanReport(value: unknown): value is ScanReport {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.schemaVersion === "string" &&
    typeof r.generatedAt === "string" &&
    Array.isArray(r.disks) &&
    Array.isArray(r.userFolders) &&
    Array.isArray(r.installedApps) &&
    Array.isArray(r.drivers) &&
    Array.isArray(r.printers) &&
    typeof r.system === "object" &&
    typeof r.privacy === "object" &&
    typeof r.checklist === "object"
  );
}

async function readAndDelete(path: string): Promise<string> {
  const raw = await fs.readFile(path, "utf8");
  await fs.unlink(path).catch(() => {
    // best-effort cleanup; ignore failures so a Windows lock doesn't crash the flow
  });
  return raw;
}

export interface RunScanOptions {
  scriptPath: string;
  outputDir: string;
  onProgress?: (progress: ScanProgress) => void;
  powershellExe?: string;
  signal?: AbortSignal;
  /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
  mock?: boolean;
  /** Require script.sha256 to exist and match. Set true for packaged production. */
  enforceIntegrity?: boolean;
}

const PIPELINE_STEPS: readonly string[] = [
  "PC 정보 확인",
  "디스크 살펴보기",
  "사용자 폴더 챙기기",
  "설치 앱 / 드라이버 목록",
  "인증서·Wi-Fi·클라우드",
  "포맷 체크리스트 정리"
];

const TOTAL_STEPS = PIPELINE_STEPS.length;

function buildSteps(activeIndex: number): ScanStepView[] {
  return PIPELINE_STEPS.map((name, i) => {
    if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
    if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
    return { name, state: "pending", detail: "대기" };
  });
}

function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
  const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
  return {
    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
    doneSteps: safeIndex,
    totalSteps: TOTAL_STEPS,
    score,
    elapsedMs: Date.now() - startedAt,
    steps: buildSteps(safeIndex),
    message
  };
}

export async function runScan(options: RunScanOptions): Promise<ScanResult> {
  const { onProgress, signal, mock, enforceIntegrity } = options;
  const startedAt = Date.now();

  // Integrity check runs even for mock when a manifest is present (catches
  // accidental script tampering in dev). It only throws when enforced.
  if (!mock || enforceIntegrity) {
    await verifyScriptIntegrity(options.scriptPath, { enforce: !!enforceIntegrity });
  }

  const tmpDir = join(tmpdir(), "formatbuddy-scans");
  ensureDir(tmpDir);
  const outPath = join(tmpDir, `report-${randomUUID()}.json`);

  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));

  if (mock || process.platform !== "win32") {
    return runMockScan({ outPath, startedAt, onProgress, signal });
  }

  return runPowershellScan({ ...options, outPath, startedAt });
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

interface InternalRunArgs {
  outPath: string;
  startedAt: number;
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
  const { outPath, startedAt, onProgress, signal } = args;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    await delay(380);
    onProgress?.(progressFor(i, startedAt));
  }

  const report: ScanReport = buildMockReport();
  ensureDir(dirname(outPath));
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
  return { report, jsonPath: outPath };
}

interface PowershellRunArgs extends RunScanOptions {
  outPath: string;
  startedAt: number;
}

function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");

  return new Promise<ScanResult>((resolveScan, rejectScan) => {
    const child = spawn(
      exe,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
      { windowsHide: true }
    );

    let activeIndex = 0;
    let stderrBuf = "";
    const tick = setInterval(() => {
      if (activeIndex < TOTAL_STEPS) {
        activeIndex += 1;
        onProgress?.(progressFor(activeIndex, startedAt));
      }
    }, 700);

    const cleanup = () => {
      clearInterval(tick);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      child.kill();
      cleanup();
      rejectScan(new DOMException("Scan cancelled", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
      if (stderrBuf.length > STDERR_MAX_BYTES) {
        stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
      }
    });

    child.on("error", (err) => {
      cleanup();
      rejectScan(err);
    });

    child.on("close", async (code) => {
      cleanup();
      if (code !== 0) {
        rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
        return;
      }
      try {
        const raw = await readAndDelete(outPath);
        const parsed: unknown = JSON.parse(raw);
        if (!isScanReport(parsed)) {
          rejectScan(new Error("Diagnostic JSON did not match expected ScanReport schema."));
          return;
        }
        const report = parsed;
        onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
        resolveScan({ report, jsonPath: outPath });
      } catch (e) {
        rejectScan(e as Error);
      }
    });
  });
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function buildMockReport(): ScanReport {
  return {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: {
      manufacturer: "Mock",
      model: "DevPreview",
      serialNumberMasked: "***0000",
      osCaption: "Windows 11 Pro (mock)",
      osVersion: "10.0.22631",
      cpu: "Mock CPU",
      memoryGb: 16
    },
    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
    userFolders: [
      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
    ],
    gpu: ["Mock GPU"],
    installedApps: [
      { name: "Chrome", version: "131.0", publisher: "Google" },
      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
    ],
    drivers: [],
    printers: [],
    wifiProfiles: ["home", "office"],
    npkiCandidates: [
      { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
      { path: "C:\\NPKI", exists: false }
    ],
    bitlocker: [],
    cloudSync: [
      { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
      { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
    ],
    browsers: [
      { name: "Chrome", installed: true },
      { name: "Edge", installed: true },
      { name: "Firefox", installed: false },
      { name: "Whale", installed: true }
    ],
    winget: { available: true, note: "winget is available. App export can be added in Phase 2." },
    diagnostics: [],
    checklist: {
      reviewNpkiManually: true,
      exportWifiProfilesManually: true,
      backupDesktopDocumentsDownloads: true,
      verifyCloudSync: true,
      saveReportBeforeFormat: true
    }
  };
}

export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyScriptIntegrity };
