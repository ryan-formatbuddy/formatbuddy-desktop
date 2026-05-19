import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
import { generateRecommendation } from "./recommend";
import { findLinkedPathPart } from "./cleanup/pathSafety";

const STDERR_MAX_BYTES = 64 * 1024;

/**
 * Read the on-disk PowerShell script, hash it, compare against the bundled
 * expected digest, and (on match) copy the verified bytes into a private
 * temp file. The returned path is what the caller MUST spawn — that closes
 * the TOCTOU window between hash check and PowerShell open.
 *
 * Returns the staged path on success. Returns null when the on-disk script
 * cannot be read OR the hash does not match AND `enforce` is false (dev
 * workflow): the caller may then fall back to the original path or refuse
 * to run.
 */
async function verifyAndStageScript(
  scriptPath: string,
  opts: { enforce: boolean; expectedHash?: string }
): Promise<string | null> {
  const expected = opts.expectedHash ?? EXPECTED_PS_SCRIPT_HASH;

  let buf: Buffer;
  try {
    buf = await fs.readFile(scriptPath);
  } catch (e) {
    if (opts.enforce) throw e;
    return null;
  }

  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual !== expected) {
    if (opts.enforce) {
      throw new Error(
        `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
      );
    }
    console.warn(
      `[scanner] PowerShell hash mismatch in dev mode — using original path. expected=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…`
    );
    return null;
  }

  // Hash matches: stage verified bytes to a FRESH per-run private directory
  // so an attacker cannot pre-seed the staging path (predictable shared dir
  // would allow ACL/symlink games even with a random filename).
  //   - mkdtemp creates a brand-new directory with a random suffix
  //   - chmod 0700 restricts to the current user (POSIX; ignored on Windows
  //     where NTFS ACLs inherit from the parent — fail-open is acceptable
  //     because the prefix is per-run unpredictable)
  //   - writeFile with flag "wx" refuses to overwrite if the path somehow
  //     already exists (e.g. symlink) and mode 0600 on POSIX
  //   - on chmod/writeFile failure we MUST remove stagedDir before
  //     re-throwing, otherwise runScan's finally never learns the path
  //     and the per-run tempdir leaks
  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
  try {
    try {
      await fs.chmod(stagedDir, 0o700);
    } catch {
      // non-POSIX (Windows) — directory inherits parent ACL; the per-run
      // random prefix is the main barrier
    }
    const stagedPath = join(stagedDir, "script.ps1");
    await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
    return stagedPath;
  } catch (e) {
    await fs.rm(stagedDir, { recursive: true, force: true }).catch(() => {
      // best-effort: at worst the OS reaps the dir
    });
    throw e;
  }
}

function isScanReport(value: unknown): value is ScanReport {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  // v0.4.0+ adds optional health-signal fields; we keep the guard tolerant
  // (presence-only on optional fields) so older mock fixtures stay valid.
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

async function ensureScanOutputDir(outputDir: string): Promise<string> {
  const parent = dirname(outputDir);
  const linkedBefore = await findLinkedPathPart(outputDir, parent, true);
  if (linkedBefore) {
    throw new Error(`Scan output folder is behind a link: ${linkedBefore}`);
  }

  await fs.mkdir(outputDir, { recursive: true });

  const linkedAfter = await findLinkedPathPart(outputDir, parent, true);
  if (linkedAfter) {
    throw new Error(`Scan output folder is behind a link: ${linkedAfter}`);
  }

  const stat = await fs.lstat(outputDir);
  if (!stat.isDirectory()) {
    throw new Error(`Scan output path is not a folder: ${outputDir}`);
  }

  return outputDir;
}

async function findNearestExistingPath(targetPath: string): Promise<string> {
  let current = targetPath;

  while (current) {
    try {
      await fs.lstat(current);
      return current;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }

    const next = dirname(current);
    if (next === current) return current;
    current = next;
  }

  return targetPath;
}

async function ensureManifestOutputPath(outputPath: string): Promise<string> {
  const parent = dirname(outputPath);
  const existingBoundary = await findNearestExistingPath(parent);
  const linkedBefore = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedBefore) {
    throw new Error(`Backup checklist output path is behind a link: ${linkedBefore}`);
  }

  await fs.mkdir(parent, { recursive: true });

  const linkedAfter = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedAfter) {
    throw new Error(`Backup checklist output path is behind a link: ${linkedAfter}`);
  }

  try {
    const stat = await fs.lstat(outputPath);
    if (stat.isDirectory()) {
      throw new Error(`Backup checklist output path is a folder: ${outputPath}`);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  return outputPath;
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

export interface RunBackupManifestOptions {
  scriptPath: string;
  outputPath: string;
  signal?: AbortSignal;
  powershellExe?: string;
  enforceIntegrity?: boolean;
  manifestMaxFileSizeBytes?: number;
}

export interface RunBackupManifestResult {
  saved: boolean;
  path: string;
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

function shouldUseMockPipeline(mock?: boolean, platform: NodeJS.Platform = process.platform): boolean {
  return !!mock || platform !== "win32";
}

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

function progressForFinalizing(startedAt: number): ScanProgress {
  return {
    ...progressFor(TOTAL_STEPS - 1, startedAt, "결과를 정리하고 있어요. 오래된 PC에서는 이 단계가 조금 걸릴 수 있어요."),
    score: 92
  };
}

export async function runScan(options: RunScanOptions): Promise<ScanResult> {
  const { onProgress, signal, mock, enforceIntegrity } = options;
  const startedAt = Date.now();
  const useMock = shouldUseMockPipeline(mock, process.platform);

  let stagedPath: string | null = null;
  if (!useMock) {
    stagedPath = await verifyAndStageScript(options.scriptPath, {
      enforce: !!enforceIntegrity
    });
  }
  const effectiveScriptPath = stagedPath ?? options.scriptPath;

  const outDir = await ensureScanOutputDir(options.outputDir);
  const outPath = join(outDir, `report-${randomUUID()}.json`);

  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));

  try {
    if (useMock) {
      return await runMockScan({
        outPath,
        startedAt,
        onProgress,
        signal,
        demoPlatform: process.platform !== "win32" ? process.platform : undefined
      });
    }
    return await runPowershellScan({
      ...options,
      scriptPath: effectiveScriptPath,
      outPath,
      startedAt
    });
  } finally {
    if (stagedPath) {
      const stagedDir = dirname(stagedPath);
      await fs.unlink(stagedPath).catch(() => {
        // best-effort: the temp file is in a per-run mkdtemp directory and
        // will be reaped by the OS even if unlink fails
      });
      await fs.rmdir(stagedDir).catch(() => {
        // best-effort cleanup of the per-run directory
      });
    }
  }
}

interface InternalRunArgs {
  outPath: string;
  startedAt: number;
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
  demoPlatform?: NodeJS.Platform;
}

async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
  const { outPath, startedAt, onProgress, signal, demoPlatform } = args;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    await delay(380);
    onProgress?.(progressFor(i, startedAt));
  }

  const report: ScanReport = buildMockReport({ demoPlatform });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), { encoding: "utf8", flag: "wx" });

  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
  return { report, recommendation: generateRecommendation(report), jsonPath: outPath };
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
      if (activeIndex < TOTAL_STEPS - 1) {
        activeIndex += 1;
        onProgress?.(progressFor(activeIndex, startedAt));
      } else {
        onProgress?.(progressForFinalizing(startedAt));
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
        resolveScan({ report, recommendation: generateRecommendation(report), jsonPath: outPath });
      } catch (e) {
        rejectScan(e as Error);
      }
    });
  });
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function buildMockReport(options: { demoPlatform?: NodeJS.Platform } = {}): ScanReport {
  const isMacDemo = options.demoPlatform === "darwin";

  return {
    schemaVersion: isMacDemo ? "0.4.0-quick-demo" : "0.4.0-quick-mock",
    generatedAt: new Date().toISOString(),
    mode: "quick",
    privacy: {
      localOnly: true,
      noPasswordCollection: true,
      noPrivateKeyUpload: true,
      noBrowserPasswordExtraction: true
    },
    system: {
      manufacturer: isMacDemo ? "FormatBuddy" : "Mock",
      model: isMacDemo ? "Windows PC 리포트 예시" : "DevPreview",
      serialNumberMasked: "***0000",
      osCaption: "Windows 11 Pro (시연용)",
      osVersion: "10.0.22631",
      cpu: "Mock CPU",
      memoryGb: 16
    },
    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
    diskHealth: [
      {
        friendlyName: "Mock NVMe",
        mediaType: "SSD",
        busType: "NVMe",
        sizeGb: 476.62,
        healthStatus: "Healthy",
        operationalStatus: "OK"
      }
    ],
    memoryPressure: {
      totalMemoryMb: 16384,
      freeMemoryMb: 6200,
      freeMemoryPercent: 37.8,
      pageFileTotalMb: 8192,
      pageFileUsedMb: 1024,
      pageFileUsagePercent: 12.5
    },
    windowsUpdate: {
      installedHotfixCount: 24,
      latestHotfixInstalledOn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      daysSinceLatestHotfix: 14
    },
    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 3 },
    driverAge: { totalWithDate: 42, olderThan2Years: 8, olderThan2YearsPercent: 19.0 },
    startupPrograms: {
      count: 6,
      items: [
        { name: "KakaoTalk", location: "HKCU Run", user: "Ryan" },
        { name: "OneDrive", location: "HKCU Run", user: "Ryan" },
        { name: "Adobe Creative Cloud", location: "Startup Folder", user: "Ryan" }
      ]
    },
    defender: {
      antivirusEnabled: true,
      realTimeProtectionEnabled: true,
      antivirusSignatureAgeDays: 1,
      lastQuickScanDaysAgo: 2,
      lastFullScanDaysAgo: 12
    },
    appDataCandidates: [
      {
        app: "KakaoTalk",
        path: "C:\\Users\\Ryan\\AppData\\Roaming\\KakaoTalk",
        exists: true,
        sizeGb: 0.8,
        lastModifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    mailDataFiles: [],
    storageWaste: {
      userTempGb: 0.8,
      localAppDataTempGb: 1.2,
      windowsTempGb: 0.3,
      windowsOldExists: false,
      windowsOldGb: 0
    },
    largeFiles: [
      {
        name: "old-installer.exe",
        path: "C:\\Users\\Ryan\\Downloads\\old-installer.exe",
        folderName: "Downloads",
        extension: ".exe",
        kind: "installer",
        sizeGb: 2.4,
        modifiedAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name: "meeting-recording.mp4",
        path: "C:\\Users\\Ryan\\Videos\\meeting-recording.mp4",
        folderName: "Videos",
        extension: ".mp4",
        kind: "video",
        sizeGb: 5.7,
        modifiedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    duplicateFileCandidates: [
      {
        name: "backup.zip",
        sizeGb: 1.1,
        count: 3,
        totalWastedGb: 2.2,
        paths: [
          "C:\\Users\\Ryan\\Downloads\\backup.zip",
          "C:\\Users\\Ryan\\Desktop\\backup.zip",
          "C:\\Users\\Ryan\\Documents\\backup.zip"
        ]
      }
    ],
    userFolders: [
      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
    ],
    gpu: ["Mock GPU"],
    installedApps: [
      { name: "Chrome", version: "131.0", publisher: "Google" },
      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" },
      { name: "Microsoft Office 365", version: "16.x", publisher: "Microsoft" },
      { name: "Adobe Creative Cloud", version: "6.x", publisher: "Adobe" },
      { name: "Visual Studio Code", version: "1.x", publisher: "Microsoft" },
      { name: "Steam", version: "2.x", publisher: "Valve" },
      { name: "Realtek Audio Driver", version: "6.x", publisher: "Realtek" }
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
      {
        name: "Chrome",
        installed: true,
        profilePath: "C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default",
        profileExists: true,
        bookmarksFileExists: true
      },
      {
        name: "Edge",
        installed: true,
        profilePath: "C:\\Users\\Ryan\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default",
        profileExists: true,
        bookmarksFileExists: false
      },
      { name: "Firefox", installed: false, profilePath: null, profileExists: false, bookmarksFileExists: false },
      {
        name: "Whale",
        installed: true,
        profilePath: "C:\\Users\\Ryan\\AppData\\Local\\Naver\\Naver Whale\\User Data\\Default",
        profileExists: false,
        bookmarksFileExists: false
      }
    ],
    winget: { available: true, note: "winget is available." },
    wingetExport: null,
    diagnostics: isMacDemo
      ? [{ step: "Mac 미리보기", message: "Mac에서는 실제 Windows 점검 대신 예시 리포트를 보여줬어요." }]
      : [],
    checklist: {
      reviewNpkiManually: true,
      exportWifiProfilesManually: true,
      backupDesktopDocumentsDownloads: true,
      verifyCloudSync: true,
      saveReportBeforeFormat: true
    }
  };
}

export async function runBackupManifest(
  options: RunBackupManifestOptions
): Promise<RunBackupManifestResult> {
  if (process.platform !== "win32") {
    throw new Error("Backup checklist export is only available on Windows.");
  }

  const outputPath = await ensureManifestOutputPath(options.outputPath);
  const stagedPath = await verifyAndStageScript(options.scriptPath, {
    enforce: !!options.enforceIntegrity
  });
  if (!stagedPath) {
    throw new Error("PowerShell integrity check failed; refusing to spawn.");
  }

  const stagedDir = dirname(stagedPath);
  const exe =
    options.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
  const maxFileSize = options.manifestMaxFileSizeBytes ?? 104_857_600;

  try {
    return await new Promise<RunBackupManifestResult>((resolveOk, rejectOk) => {
      const child = spawn(
        exe,
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          stagedPath,
          "-OutputPath",
          outputPath,
          "-Mode",
          "manifest",
          "-ManifestMaxFileSizeBytes",
          String(maxFileSize)
        ],
        { windowsHide: true }
      );

      let stderrBuf = "";

      const cleanup = () => {
        if (options.signal) options.signal.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        child.kill();
        cleanup();
        rejectOk(new DOMException("Backup checklist export cancelled", "AbortError"));
      };

      if (options.signal) {
        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf8");
        if (stderrBuf.length > STDERR_MAX_BYTES) {
          stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
        }
      });

      child.on("error", (err) => {
        cleanup();
        rejectOk(err);
      });

      child.on("close", async (code) => {
        cleanup();
        if (code !== 0) {
          rejectOk(
            new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`)
          );
          return;
        }
        // PowerShell uses $ErrorActionPreference = "SilentlyContinue", so a
        // failed Out-File can still leave exit code 0. Verify the file exists
        // and is non-empty before reporting success.
        try {
          const stat = await fs.stat(outputPath);
          if (!stat.isFile() || stat.size === 0) {
            rejectOk(new Error("Backup checklist file was not written or is empty."));
            return;
          }
          resolveOk({ saved: true, path: outputPath });
        } catch (e) {
          rejectOk(new Error(`Backup checklist file missing: ${(e as Error).message}`));
        }
      });
    });
  } finally {
    await fs.unlink(stagedPath).catch(() => {});
    await fs.rmdir(stagedDir).catch(() => {});
  }
}

export const __testing = {
  PIPELINE_STEPS,
  TOTAL_STEPS,
  buildSteps,
  progressFor,
  progressForFinalizing,
  verifyAndStageScript,
  ensureScanOutputDir,
  ensureManifestOutputPath,
  shouldUseMockPipeline
};
