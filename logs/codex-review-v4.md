OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e3878-bf79-70f0-9917-e9bdb385845e
--------
user
# Final-final regression — FormatBuddy Desktop v0.1.4

You previously reviewed v0.1.3 and flagged ONE remaining finding:
- P2 — predictable staging directory `os.tmpdir()/formatbuddy-script/` enabled symlink/ACL pre-seeding even with random filenames.

v0.1.4 fix:
- `scripts/embed-ps-hash.mjs` unchanged (still emits TS module bundled into app.asar)
- `src/main/scanner.ts verifyAndStageScript()`:
  - now uses `fs.mkdtemp(join(tmpdir(), "fb-script-"))` per scan — fresh unguessable directory
  - chmod 0o700 on POSIX (silently no-op on Windows)
  - writeFile flag `"wx"` (exclusive create, refuses pre-existing path) + mode 0o600
- `runScan` finally cleans the file AND the directory (best-effort `rmdir`)
- Test updated to assert staged path is under the `fb-script-` prefix

Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop
Last commit: `d1a051f`
Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`

## What I need

Severity-rated. **ONLY look at the new changes in v0.1.4** (mkdtemp + permissions + cleanup). The rest of the codebase was already cleared in your previous 3 reviews.

Specifically:
- Is the new mkdtemp/perms/wx-flag combination actually attacker-resistant on Linux, macOS, AND Windows?
- Any race between mkdtemp and chmod?
- Any race between chmod and writeFile?
- `rmdir` cleanup on failure paths — does it leak directories?
- Test correctness — does the new test assertion actually exercise the staging dir prefix?

**If you find zero new issues, say so explicitly so I can mark v0.1.4 as the stable preview and stop iterating.** I have done 4 review cycles now and want to stop unless there's an actual blocker.
2026-05-18T00:24:58.491901Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T00:24:58.777596Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse HEAD && git show --stat --oneline --decorate --no-renames HEAD' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 5910ms:
2026-05-18 09:25:10.488 xcodebuild[63513:41253504]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:10.635 xcodebuild[63513:41253502] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-6T4gd0kA' (errno=Operation not permitted)
2026-05-18 09:25:11.168 xcodebuild[63515:41253520]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:11.312 xcodebuild[63515:41253519] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v4.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-FBysHhrz' (errno=Operation not permitted)
2026-05-18 09:25:12.490 xcodebuild[63520:41253562]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:12.635 xcodebuild[63520:41253560] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-eKLmDAmX' (errno=Operation not permitted)
2026-05-18 09:25:13.169 xcodebuild[63522:41253574]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:13.313 xcodebuild[63522:41253573] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
d1a051faef6d489b94b3e5f0243846c06a0e96ef
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-aV6GYRyh' (errno=Operation not permitted)
2026-05-18 09:25:14.464 xcodebuild[63526:41253595]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:14.604 xcodebuild[63526:41253594] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-K0rC593l' (errno=Operation not permitted)
2026-05-18 09:25:15.125 xcodebuild[63528:41253605]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:15.266 xcodebuild[63528:41253604] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
d1a051f (HEAD -> main, origin/main) fix: per-run mkdtemp + restrictive perms for PS staging (v0.1.4)
 logs/codex-review-v3.md | 1558 +++++++++++++++++++++++++++++++++++++++++++++++
 package.json            |    2 +-
 src/main/scanner.ts     |   31 +-
 tests/scanner.test.ts   |    6 +-
 4 files changed, 1588 insertions(+), 9 deletions(-)

exec
/bin/zsh -lc 'git show --no-ext-diff --unified=80 -- src/main/scanner.ts tests/scanner.test.ts package.json' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1962ms:
2026-05-18 09:25:20.615 xcodebuild[63535:41253695]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:20.758 xcodebuild[63535:41253694] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-bUuQPtRS' (errno=Operation not permitted)
2026-05-18 09:25:21.282 xcodebuild[63537:41253706]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:21.427 xcodebuild[63537:41253705] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
commit d1a051faef6d489b94b3e5f0243846c06a0e96ef
Author: Ryan FormatBuddy <ryan@formatbuddy.app>
Date:   Mon May 18 09:24:29 2026 +0900

    fix: per-run mkdtemp + restrictive perms for PS staging (v0.1.4)
    
    Codex v0.1.3 regression review found one remaining bypass: the staging
    directory at os.tmpdir()/formatbuddy-script/ was predictable, so an
    attacker with access to that shared parent could pre-seed ACLs or
    symlinks and still race the spawn even with random filenames.
    
    What changed
    - src/main/scanner.ts verifyAndStageScript():
      - now creates a brand-new per-run directory via fs.mkdtemp('fb-script-')
      - chmod 0700 on POSIX (silently no-op on Windows)
      - writeFile uses flag "wx" (exclusive create, refuses to overwrite)
        and mode 0o600 on POSIX
      - the directory is the main attack barrier — the random suffix is
        unguessable per scan
    - runScan finally now removes both the staged file AND the per-run
      directory (best-effort)
    - test for match-and-stage updated to assert the parent dir matches the
      per-run prefix
    
    Verified on macOS
    - npm run typecheck → pass
    - npm run lint → pass
    - npm run test → 11/11 pass
    - npm run build → pass
    - npm run dist:win → dist/FormatBuddy-Setup-0.1.4-x64.exe produced
    
    Phase 2 still open
    - Windows .exe code-signing certificate (purchase + WIN_CSC_LINK wiring)

diff --git a/package.json b/package.json
index 25cb88e..f8c8ece 100644
--- a/package.json
+++ b/package.json
@@ -1,54 +1,54 @@
 {
   "name": "formatbuddy-desktop",
-  "version": "0.1.3",
+  "version": "0.1.4",
   "private": true,
   "description": "FormatBuddy Desktop — Windows-only PC format companion built on Electron.",
   "author": {
     "name": "FormatBuddy",
     "email": "support@formatbuddy.app"
   },
   "license": "UNLICENSED",
   "main": "out/main/index.js",
   "scripts": {
     "embed-ps-hash": "node scripts/embed-ps-hash.mjs",
     "dev": "npm run embed-ps-hash && electron-vite dev",
     "prebuild": "npm run embed-ps-hash",
     "build": "electron-vite build",
     "preview": "electron-vite preview",
     "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
     "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
     "typecheck": "npm run typecheck:node && npm run typecheck:web",
     "lint": "eslint .",
     "test": "npm run embed-ps-hash && vitest run",
     "test:watch": "vitest",
     "predist:win": "npm run embed-ps-hash",
     "dist:win": "electron-vite build && electron-builder --win --publish never"
   },
   "dependencies": {
     "@electron-toolkit/preload": "3.0.1",
     "@electron-toolkit/utils": "3.0.0"
   },
   "devDependencies": {
     "@tailwindcss/vite": "4.0.6",
     "@testing-library/react": "16.1.0",
     "@types/node": "22.10.5",
     "@types/react": "19.0.7",
     "@types/react-dom": "19.0.3",
     "@typescript-eslint/eslint-plugin": "8.20.0",
     "@typescript-eslint/parser": "8.20.0",
     "@vitejs/plugin-react": "4.3.4",
     "electron": "33.3.1",
     "electron-builder": "25.1.8",
     "electron-vite": "2.3.0",
     "eslint": "9.18.0",
     "eslint-plugin-react": "7.37.4",
     "eslint-plugin-react-hooks": "5.1.0",
     "jsdom": "26.0.0",
     "react": "19.0.0",
     "react-dom": "19.0.0",
     "tailwindcss": "4.0.6",
     "typescript": "5.7.3",
     "vite": "5.4.11",
     "vitest": "2.1.8"
   }
 }
diff --git a/src/main/scanner.ts b/src/main/scanner.ts
index 36a445a..35c4a6a 100644
--- a/src/main/scanner.ts
+++ b/src/main/scanner.ts
@@ -1,239 +1,256 @@
 import { spawn } from "node:child_process";
 import { existsSync, mkdirSync, promises as fs } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { createHash, randomUUID } from "node:crypto";
 import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
 import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
 
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
 
-  // hash matches: stage verified bytes to a private temp file so the path
-  // we spawn is the same bytes we just verified.
-  const stagedDir = join(tmpdir(), "formatbuddy-script");
-  ensureDir(stagedDir);
-  const stagedPath = join(stagedDir, `script-${randomUUID()}.ps1`);
-  await fs.writeFile(stagedPath, buf);
+  // Hash matches: stage verified bytes to a FRESH per-run private directory
+  // so an attacker cannot pre-seed the staging path (predictable shared dir
+  // would allow ACL/symlink games even with a random filename).
+  //   - mkdtemp creates a brand-new directory with a random suffix
+  //   - chmod 0700 restricts to the current user (POSIX; ignored on Windows
+  //     where NTFS ACLs inherit from the parent — fail-open is acceptable
+  //     because the prefix is per-run unpredictable)
+  //   - writeFile with flag "wx" refuses to overwrite if the path somehow
+  //     already exists (e.g. symlink) and mode 0600 on POSIX
+  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
+  try {
+    await fs.chmod(stagedDir, 0o700);
+  } catch {
+    // non-POSIX (Windows) — directory inherits parent ACL; the per-run
+    // random prefix is the main barrier
+  }
+  const stagedPath = join(stagedDir, "script.ps1");
+  await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
   return stagedPath;
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
 
   let stagedPath: string | null = null;
   if (!mock) {
     stagedPath = await verifyAndStageScript(options.scriptPath, {
       enforce: !!enforceIntegrity
     });
   }
   const effectiveScriptPath = stagedPath ?? options.scriptPath;
 
   const tmpDir = join(tmpdir(), "formatbuddy-scans");
   ensureDir(tmpDir);
   const outPath = join(tmpDir, `report-${randomUUID()}.json`);
 
   onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
 
   try {
     if (mock || process.platform !== "win32") {
       return await runMockScan({ outPath, startedAt, onProgress, signal });
     }
     return await runPowershellScan({
       ...options,
       scriptPath: effectiveScriptPath,
       outPath,
       startedAt
     });
   } finally {
     if (stagedPath) {
+      const stagedDir = dirname(stagedPath);
       await fs.unlink(stagedPath).catch(() => {
-        // best-effort: the temp file is in os.tmpdir() and will be reaped
+        // best-effort: the temp file is in a per-run mkdtemp directory and
+        // will be reaped by the OS even if unlink fails
+      });
+      await fs.rmdir(stagedDir).catch(() => {
+        // best-effort cleanup of the per-run directory
       });
     }
   }
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
diff --git a/tests/scanner.test.ts b/tests/scanner.test.ts
index 2e208a2..453534d 100644
--- a/tests/scanner.test.ts
+++ b/tests/scanner.test.ts
@@ -36,102 +36,106 @@ describe("scanner mock pipeline", () => {
         onProgress: (p) => events.push(p)
       });
       expect(events.length).toBeGreaterThanOrEqual(__testing.TOTAL_STEPS);
       expect(res.report.schemaVersion).toBe("0.1.0");
       expect(res.report.privacy.localOnly).toBe(true);
       const fileText = readFileSync(res.jsonPath, "utf8");
       const parsed = JSON.parse(fileText) as ScanReport;
       expect(parsed.system.osCaption).toContain("Windows");
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 
   it("runScan(mock) cancels on abort", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
     const controller = new AbortController();
     try {
       const p = runScan({
         scriptPath: "ignored.ps1",
         outputDir: dir,
         mock: true,
         signal: controller.signal
       });
       setTimeout(() => controller.abort(), 50);
       await expect(p).rejects.toThrowError(/cancel/i);
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 });
 
 describe("verifyAndStageScript", () => {
   it("returns null when script is missing and enforce=false", async () => {
     const result = await __testing.verifyAndStageScript("/tmp/does-not-exist.ps1", {
       enforce: false,
       expectedHash: "0".repeat(64)
     });
     expect(result).toBeNull();
   });
 
   it("throws when script is missing and enforce=true", async () => {
     await expect(
       __testing.verifyAndStageScript("/tmp/also-does-not-exist.ps1", {
         enforce: true,
         expectedHash: "0".repeat(64)
       })
     ).rejects.toThrow();
   });
 
   it("returns null on hash mismatch when enforce=false (dev)", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-integ-devmiss-"));
     const scriptPath = join(dir, "fake.ps1");
     writeFileSync(scriptPath, "Get-Process", "utf8");
     try {
       const result = await __testing.verifyAndStageScript(scriptPath, {
         enforce: false,
         expectedHash: "0".repeat(64)
       });
       expect(result).toBeNull();
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 
   it("throws on hash mismatch when enforce=true", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
     const scriptPath = join(dir, "fake.ps1");
     writeFileSync(scriptPath, "Get-Process", "utf8");
     try {
       await expect(
         __testing.verifyAndStageScript(scriptPath, {
           enforce: true,
           expectedHash: "0".repeat(64)
         })
       ).rejects.toThrowError(/integrity check failed/i);
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 
-  it("on match returns a private temp path with verified bytes", async () => {
+  it("on match returns a private per-run temp path with verified bytes", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
     const scriptPath = join(dir, "fake.ps1");
     const body = "Get-ChildItem -Path C:\\";
     writeFileSync(scriptPath, body, "utf8");
     const expected = createHash("sha256").update(body).digest("hex");
     try {
       const stagedPath = await __testing.verifyAndStageScript(scriptPath, {
         enforce: true,
         expectedHash: expected
       });
       expect(stagedPath).toBeTypeOf("string");
       expect(stagedPath).not.toBe(scriptPath);
       const stagedBody = readFileSync(stagedPath as string, "utf8");
       expect(stagedBody).toBe(body);
+      // staged path is inside a per-run mkdtemp dir (prefix fb-script-)
+      const parent = stagedPath as string;
+      expect(parent).toMatch(/fb-script-/);
       // cleanup
       rmSync(stagedPath as string, { force: true });
+      rmSync(parent.replace(/[/\\]script\.ps1$/, ""), { recursive: true, force: true });
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 });

exec
/bin/zsh -lc "sed -n '1,320p' src/main/scanner.ts && printf '\\n--- tests ---\\n' && sed -n '1,180p' tests/scanner.test.ts" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";

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
  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
  try {
    await fs.chmod(stagedDir, 0o700);
  } catch {
    // non-POSIX (Windows) — directory inherits parent ACL; the per-run
    // random prefix is the main barrier
  }
  const stagedPath = join(stagedDir, "script.ps1");
  await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
  return stagedPath;
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

  let stagedPath: string | null = null;
  if (!mock) {
    stagedPath = await verifyAndStageScript(options.scriptPath, {
      enforce: !!enforceIntegrity
    });
  }
  const effectiveScriptPath = stagedPath ?? options.scriptPath;

  const tmpDir = join(tmpdir(), "formatbuddy-scans");
  ensureDir(tmpDir);
  const outPath = join(tmpDir, `report-${randomUUID()}.json`);

  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));

  try {
    if (mock || process.platform !== "win32") {
      return await runMockScan({ outPath, startedAt, onProgress, signal });
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

--- tests ---
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { runScan, __testing } from "../src/main/scanner";
import type { ScanProgress, ScanReport } from "../src/shared/types";

describe("scanner mock pipeline", () => {
  it("buildSteps marks states correctly", () => {
    const steps = __testing.buildSteps(2);
    expect(steps.length).toBe(__testing.TOTAL_STEPS);
    expect(steps[0].state).toBe("done");
    expect(steps[1].state).toBe("done");
    expect(steps[2].state).toBe("active");
    expect(steps[3].state).toBe("pending");
  });

  it("progressFor computes score and elapsed", () => {
    const started = Date.now() - 1234;
    const p = __testing.progressFor(3, started);
    expect(p.totalSteps).toBe(__testing.TOTAL_STEPS);
    expect(p.doneSteps).toBe(3);
    expect(p.score).toBeGreaterThanOrEqual(50);
    expect(p.elapsedMs).toBeGreaterThanOrEqual(1000);
  });

  it("runScan(mock) emits progress, completes, writes JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
    const events: ScanProgress[] = [];
    try {
      const res = await runScan({
        scriptPath: "ignored.ps1",
        outputDir: dir,
        mock: true,
        onProgress: (p) => events.push(p)
      });
      expect(events.length).toBeGreaterThanOrEqual(__testing.TOTAL_STEPS);
      expect(res.report.schemaVersion).toBe("0.1.0");
      expect(res.report.privacy.localOnly).toBe(true);
      const fileText = readFileSync(res.jsonPath, "utf8");
      const parsed = JSON.parse(fileText) as ScanReport;
      expect(parsed.system.osCaption).toContain("Windows");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runScan(mock) cancels on abort", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
    const controller = new AbortController();
    try {
      const p = runScan({
        scriptPath: "ignored.ps1",
        outputDir: dir,
        mock: true,
        signal: controller.signal
      });
      setTimeout(() => controller.abort(), 50);
      await expect(p).rejects.toThrowError(/cancel/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("verifyAndStageScript", () => {
  it("returns null when script is missing and enforce=false", async () => {
    const result = await __testing.verifyAndStageScript("/tmp/does-not-exist.ps1", {
      enforce: false,
      expectedHash: "0".repeat(64)
    });
    expect(result).toBeNull();
  });

  it("throws when script is missing and enforce=true", async () => {
    await expect(
      __testing.verifyAndStageScript("/tmp/also-does-not-exist.ps1", {
        enforce: true,
        expectedHash: "0".repeat(64)
      })
    ).rejects.toThrow();
  });

  it("returns null on hash mismatch when enforce=false (dev)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-devmiss-"));
    const scriptPath = join(dir, "fake.ps1");
    writeFileSync(scriptPath, "Get-Process", "utf8");
    try {
      const result = await __testing.verifyAndStageScript(scriptPath, {
        enforce: false,
        expectedHash: "0".repeat(64)
      });
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on hash mismatch when enforce=true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
    const scriptPath = join(dir, "fake.ps1");
    writeFileSync(scriptPath, "Get-Process", "utf8");
    try {
      await expect(
        __testing.verifyAndStageScript(scriptPath, {
          enforce: true,
          expectedHash: "0".repeat(64)
        })
      ).rejects.toThrowError(/integrity check failed/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("on match returns a private per-run temp path with verified bytes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
    const scriptPath = join(dir, "fake.ps1");
    const body = "Get-ChildItem -Path C:\\";
    writeFileSync(scriptPath, body, "utf8");
    const expected = createHash("sha256").update(body).digest("hex");
    try {
      const stagedPath = await __testing.verifyAndStageScript(scriptPath, {
        enforce: true,
        expectedHash: expected
      });
      expect(stagedPath).toBeTypeOf("string");
      expect(stagedPath).not.toBe(scriptPath);
      const stagedBody = readFileSync(stagedPath as string, "utf8");
      expect(stagedBody).toBe(body);
      // staged path is inside a per-run mkdtemp dir (prefix fb-script-)
      const parent = stagedPath as string;
      expect(parent).toMatch(/fb-script-/);
      // cleanup
      rmSync(stagedPath as string, { force: true });
      rmSync(parent.replace(/[/\\]script\.ps1$/, ""), { recursive: true, force: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

exec
/bin/zsh -lc "sed -n '320,520p' src/main/scanner.ts" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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

export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyAndStageScript };

exec
/bin/zsh -lc "grep -n \"P2\\|predictable\\|staging\\|mkdtemp\\|formatbuddy-script\" -n logs/codex-review-v3.md | head -80" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
24:1. P2 — expected hash lived in `script.sha256` next to the script (untrusted bundle)
27:   → fixed: `verifyAndStageScript()` now reads + verifies + copies the bytes to a private `os.tmpdir()/formatbuddy-script/script-<uuid>.ps1`, and PowerShell spawns from the staged path. Cleanup in `finally`.
40:2. Any remaining TOCTOU window (staging dir permissions, race between staging write and spawn open, symlink tricks)
235:+  const stagedDir = join(tmpdir(), "formatbuddy-script");
538: import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
565:     const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
586:     const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
605:-    const dir = mkdtempSync(join(tmpdir(), "fb-integ-skip-"));
625:-    const dir = mkdtempSync(join(tmpdir(), "fb-integ-strict-"));
636:+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-devmiss-"));
655:-    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
657:+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
679:-    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
681:+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
783:    51	  const stagedDir = join(tmpdir(), "formatbuddy-script");
916:     2	import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
943:    29	    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
964:    50	    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
1000:    86	    const dir = mkdtempSync(join(tmpdir(), "fb-integ-devmiss-"));
1015:   101	    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
1031:   117	    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
1547:The expected hash is now anchored in TypeScript/app code, but the staged script is still written to a predictable non-verified temp directory. That leaves a remaining TOCTOU-style bypass of the new integrity protection.
1551:- [P2] Create the staged script in a private temp directory — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:51-54
1552:  When `os.tmpdir()` is shared or `formatbuddy-script` already exists with attacker-writable ACLs or as a symlink, `ensureDir` accepts that predictable location and `writeFile` emits the verified script there with default permissions. Because PowerShell later reopens this path, an attacker who can watch/modify that directory can replace `script-<uuid>.ps1` after staging and before spawn, bypassing the bundled hash. Use a fresh per-run `fs.mkdtemp` directory with restrictive permissions, write the file with exclusive creation/restrictive mode, reject symlinked parents, and remove the directory after use.
1553:The expected hash is now anchored in TypeScript/app code, but the staged script is still written to a predictable non-verified temp directory. That leaves a remaining TOCTOU-style bypass of the new integrity protection.
1557:- [P2] Create the staged script in a private temp directory — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:51-54
1558:  When `os.tmpdir()` is shared or `formatbuddy-script` already exists with attacker-writable ACLs or as a symlink, `ensureDir` accepts that predictable location and `writeFile` emits the verified script there with default permissions. Because PowerShell later reopens this path, an attacker who can watch/modify that directory can replace `script-<uuid>.ps1` after staging and before spawn, bypassing the bundled hash. Use a fresh per-run `fs.mkdtemp` directory with restrictive permissions, write the file with exclusive creation/restrictive mode, reject symlinked parents, and remove the directory after use.

exec
/bin/zsh -lc "nl -ba src/main/scanner.ts | sed -n '44,72p;128,158p' && printf '\\n--- tests lines ---\\n' && nl -ba tests/scanner.test.ts | sed -n '114,136p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
    44	      `[scanner] PowerShell hash mismatch in dev mode — using original path. expected=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…`
    45	    );
    46	    return null;
    47	  }
    48	
    49	  // Hash matches: stage verified bytes to a FRESH per-run private directory
    50	  // so an attacker cannot pre-seed the staging path (predictable shared dir
    51	  // would allow ACL/symlink games even with a random filename).
    52	  //   - mkdtemp creates a brand-new directory with a random suffix
    53	  //   - chmod 0700 restricts to the current user (POSIX; ignored on Windows
    54	  //     where NTFS ACLs inherit from the parent — fail-open is acceptable
    55	  //     because the prefix is per-run unpredictable)
    56	  //   - writeFile with flag "wx" refuses to overwrite if the path somehow
    57	  //     already exists (e.g. symlink) and mode 0600 on POSIX
    58	  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
    59	  try {
    60	    await fs.chmod(stagedDir, 0o700);
    61	  } catch {
    62	    // non-POSIX (Windows) — directory inherits parent ACL; the per-run
    63	    // random prefix is the main barrier
    64	  }
    65	  const stagedPath = join(stagedDir, "script.ps1");
    66	  await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
    67	  return stagedPath;
    68	}
    69	
    70	function isScanReport(value: unknown): value is ScanReport {
    71	  if (!value || typeof value !== "object") return false;
    72	  const r = value as Record<string, unknown>;
   128	  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
   129	  return {
   130	    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
   131	    doneSteps: safeIndex,
   132	    totalSteps: TOTAL_STEPS,
   133	    score,
   134	    elapsedMs: Date.now() - startedAt,
   135	    steps: buildSteps(safeIndex),
   136	    message
   137	  };
   138	}
   139	
   140	export async function runScan(options: RunScanOptions): Promise<ScanResult> {
   141	  const { onProgress, signal, mock, enforceIntegrity } = options;
   142	  const startedAt = Date.now();
   143	
   144	  let stagedPath: string | null = null;
   145	  if (!mock) {
   146	    stagedPath = await verifyAndStageScript(options.scriptPath, {
   147	      enforce: !!enforceIntegrity
   148	    });
   149	  }
   150	  const effectiveScriptPath = stagedPath ?? options.scriptPath;
   151	
   152	  const tmpDir = join(tmpdir(), "formatbuddy-scans");
   153	  ensureDir(tmpDir);
   154	  const outPath = join(tmpDir, `report-${randomUUID()}.json`);
   155	
   156	  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
   157	
   158	  try {

--- tests lines ---
   114	  });
   115	
   116	  it("on match returns a private per-run temp path with verified bytes", async () => {
   117	    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
   118	    const scriptPath = join(dir, "fake.ps1");
   119	    const body = "Get-ChildItem -Path C:\\";
   120	    writeFileSync(scriptPath, body, "utf8");
   121	    const expected = createHash("sha256").update(body).digest("hex");
   122	    try {
   123	      const stagedPath = await __testing.verifyAndStageScript(scriptPath, {
   124	        enforce: true,
   125	        expectedHash: expected
   126	      });
   127	      expect(stagedPath).toBeTypeOf("string");
   128	      expect(stagedPath).not.toBe(scriptPath);
   129	      const stagedBody = readFileSync(stagedPath as string, "utf8");
   130	      expect(stagedBody).toBe(body);
   131	      // staged path is inside a per-run mkdtemp dir (prefix fb-script-)
   132	      const parent = stagedPath as string;
   133	      expect(parent).toMatch(/fb-script-/);
   134	      // cleanup
   135	      rmSync(stagedPath as string, { force: true });
   136	      rmSync(parent.replace(/[/\\]script\.ps1$/, ""), { recursive: true, force: true });

exec
/bin/zsh -lc "nl -ba src/main/scanner.ts | sed -n '158,182p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   158	  try {
   159	    if (mock || process.platform !== "win32") {
   160	      return await runMockScan({ outPath, startedAt, onProgress, signal });
   161	    }
   162	    return await runPowershellScan({
   163	      ...options,
   164	      scriptPath: effectiveScriptPath,
   165	      outPath,
   166	      startedAt
   167	    });
   168	  } finally {
   169	    if (stagedPath) {
   170	      const stagedDir = dirname(stagedPath);
   171	      await fs.unlink(stagedPath).catch(() => {
   172	        // best-effort: the temp file is in a per-run mkdtemp directory and
   173	        // will be reaped by the OS even if unlink fails
   174	      });
   175	      await fs.rmdir(stagedDir).catch(() => {
   176	        // best-effort cleanup of the per-run directory
   177	      });
   178	    }
   179	  }
   180	}
   181	
   182	function ensureDir(dir: string) {

exec
/bin/zsh -lc "sed -n '1,220p' logs/codex-review-v4.md" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e3878-bf79-70f0-9917-e9bdb385845e
--------
user
# Final-final regression — FormatBuddy Desktop v0.1.4

You previously reviewed v0.1.3 and flagged ONE remaining finding:
- P2 — predictable staging directory `os.tmpdir()/formatbuddy-script/` enabled symlink/ACL pre-seeding even with random filenames.

v0.1.4 fix:
- `scripts/embed-ps-hash.mjs` unchanged (still emits TS module bundled into app.asar)
- `src/main/scanner.ts verifyAndStageScript()`:
  - now uses `fs.mkdtemp(join(tmpdir(), "fb-script-"))` per scan — fresh unguessable directory
  - chmod 0o700 on POSIX (silently no-op on Windows)
  - writeFile flag `"wx"` (exclusive create, refuses pre-existing path) + mode 0o600
- `runScan` finally cleans the file AND the directory (best-effort `rmdir`)
- Test updated to assert staged path is under the `fb-script-` prefix

Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop
Last commit: `d1a051f`
Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`

## What I need

Severity-rated. **ONLY look at the new changes in v0.1.4** (mkdtemp + permissions + cleanup). The rest of the codebase was already cleared in your previous 3 reviews.

Specifically:
- Is the new mkdtemp/perms/wx-flag combination actually attacker-resistant on Linux, macOS, AND Windows?
- Any race between mkdtemp and chmod?
- Any race between chmod and writeFile?
- `rmdir` cleanup on failure paths — does it leak directories?
- Test correctness — does the new test assertion actually exercise the staging dir prefix?

**If you find zero new issues, say so explicitly so I can mark v0.1.4 as the stable preview and stop iterating.** I have done 4 review cycles now and want to stop unless there's an actual blocker.
2026-05-18T00:24:58.491901Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T00:24:58.777596Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse HEAD && git show --stat --oneline --decorate --no-renames HEAD' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 5910ms:
2026-05-18 09:25:10.488 xcodebuild[63513:41253504]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:10.635 xcodebuild[63513:41253502] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-6T4gd0kA' (errno=Operation not permitted)
2026-05-18 09:25:11.168 xcodebuild[63515:41253520]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:11.312 xcodebuild[63515:41253519] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v4.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-FBysHhrz' (errno=Operation not permitted)
2026-05-18 09:25:12.490 xcodebuild[63520:41253562]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:12.635 xcodebuild[63520:41253560] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-eKLmDAmX' (errno=Operation not permitted)
2026-05-18 09:25:13.169 xcodebuild[63522:41253574]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:13.313 xcodebuild[63522:41253573] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
d1a051faef6d489b94b3e5f0243846c06a0e96ef
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-aV6GYRyh' (errno=Operation not permitted)
2026-05-18 09:25:14.464 xcodebuild[63526:41253595]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:14.604 xcodebuild[63526:41253594] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-K0rC593l' (errno=Operation not permitted)
2026-05-18 09:25:15.125 xcodebuild[63528:41253605]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:15.266 xcodebuild[63528:41253604] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
d1a051f (HEAD -> main, origin/main) fix: per-run mkdtemp + restrictive perms for PS staging (v0.1.4)
 logs/codex-review-v3.md | 1558 +++++++++++++++++++++++++++++++++++++++++++++++
 package.json            |    2 +-
 src/main/scanner.ts     |   31 +-
 tests/scanner.test.ts   |    6 +-
 4 files changed, 1588 insertions(+), 9 deletions(-)

exec
/bin/zsh -lc 'git show --no-ext-diff --unified=80 -- src/main/scanner.ts tests/scanner.test.ts package.json' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1962ms:
2026-05-18 09:25:20.615 xcodebuild[63535:41253695]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:20.758 xcodebuild[63535:41253694] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-bUuQPtRS' (errno=Operation not permitted)
2026-05-18 09:25:21.282 xcodebuild[63537:41253706]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:25:21.427 xcodebuild[63537:41253705] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
commit d1a051faef6d489b94b3e5f0243846c06a0e96ef
Author: Ryan FormatBuddy <ryan@formatbuddy.app>
Date:   Mon May 18 09:24:29 2026 +0900

    fix: per-run mkdtemp + restrictive perms for PS staging (v0.1.4)
    
    Codex v0.1.3 regression review found one remaining bypass: the staging
    directory at os.tmpdir()/formatbuddy-script/ was predictable, so an
    attacker with access to that shared parent could pre-seed ACLs or
    symlinks and still race the spawn even with random filenames.
    
    What changed
    - src/main/scanner.ts verifyAndStageScript():
      - now creates a brand-new per-run directory via fs.mkdtemp('fb-script-')
      - chmod 0700 on POSIX (silently no-op on Windows)
      - writeFile uses flag "wx" (exclusive create, refuses to overwrite)
        and mode 0o600 on POSIX
      - the directory is the main attack barrier — the random suffix is
        unguessable per scan
    - runScan finally now removes both the staged file AND the per-run
      directory (best-effort)
    - test for match-and-stage updated to assert the parent dir matches the
      per-run prefix
    
    Verified on macOS
    - npm run typecheck → pass
    - npm run lint → pass
    - npm run test → 11/11 pass
    - npm run build → pass
    - npm run dist:win → dist/FormatBuddy-Setup-0.1.4-x64.exe produced
    
    Phase 2 still open
    - Windows .exe code-signing certificate (purchase + WIN_CSC_LINK wiring)

diff --git a/package.json b/package.json
index 25cb88e..f8c8ece 100644
--- a/package.json
+++ b/package.json
@@ -1,54 +1,54 @@
 {
   "name": "formatbuddy-desktop",
-  "version": "0.1.3",
+  "version": "0.1.4",
   "private": true,
   "description": "FormatBuddy Desktop — Windows-only PC format companion built on Electron.",
   "author": {
     "name": "FormatBuddy",
     "email": "support@formatbuddy.app"
   },
   "license": "UNLICENSED",
   "main": "out/main/index.js",
   "scripts": {
     "embed-ps-hash": "node scripts/embed-ps-hash.mjs",
     "dev": "npm run embed-ps-hash && electron-vite dev",
     "prebuild": "npm run embed-ps-hash",
     "build": "electron-vite build",
     "preview": "electron-vite preview",
     "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
     "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
     "typecheck": "npm run typecheck:node && npm run typecheck:web",
     "lint": "eslint .",
     "test": "npm run embed-ps-hash && vitest run",
     "test:watch": "vitest",
     "predist:win": "npm run embed-ps-hash",
     "dist:win": "electron-vite build && electron-builder --win --publish never"
   },
   "dependencies": {
     "@electron-toolkit/preload": "3.0.1",
     "@electron-toolkit/utils": "3.0.0"
   },
   "devDependencies": {
     "@tailwindcss/vite": "4.0.6",
     "@testing-library/react": "16.1.0",
     "@types/node": "22.10.5",
     "@types/react": "19.0.7",
     "@types/react-dom": "19.0.3",
     "@typescript-eslint/eslint-plugin": "8.20.0",
     "@typescript-eslint/parser": "8.20.0",
     "@vitejs/plugin-react": "4.3.4",
     "electron": "33.3.1",
     "electron-builder": "25.1.8",
     "electron-vite": "2.3.0",
     "eslint": "9.18.0",
     "eslint-plugin-react": "7.37.4",
     "eslint-plugin-react-hooks": "5.1.0",
     "jsdom": "26.0.0",
     "react": "19.0.0",
     "react-dom": "19.0.0",
     "tailwindcss": "4.0.6",
     "typescript": "5.7.3",
     "vite": "5.4.11",
     "vitest": "2.1.8"
   }
 }
diff --git a/src/main/scanner.ts b/src/main/scanner.ts
index 36a445a..35c4a6a 100644
--- a/src/main/scanner.ts
+++ b/src/main/scanner.ts
@@ -1,239 +1,256 @@
 import { spawn } from "node:child_process";
 import { existsSync, mkdirSync, promises as fs } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { createHash, randomUUID } from "node:crypto";
 import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
 import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
 
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

codex
The mkdtemp + POSIX 0700 + wx combination closes the previous predictable-directory pre-seeding issue, and I did not find mkdtemp→chmod or chmod→write races under normal platform temp ACLs. The only new issue I found is the low-severity cleanup gap above on staging-write failure.

Review comment:

- [P3] Clean up staging dir when the script write fails — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:66-66
  If `fs.writeFile` throws after `mkdtemp` succeeds, such as ENOSPC or an antivirus/permission failure, `verifyAndStageScript` exits before returning `stagedPath`, so `runScan`'s `finally` never knows which `fb-script-*` directory to remove. That leaves a per-run temp directory, and possibly a partial `script.ps1`, on each failed staging attempt; wrap the write in local cleanup before rethrowing.
The mkdtemp + POSIX 0700 + wx combination closes the previous predictable-directory pre-seeding issue, and I did not find mkdtemp→chmod or chmod→write races under normal platform temp ACLs. The only new issue I found is the low-severity cleanup gap above on staging-write failure.

Review comment:

- [P3] Clean up staging dir when the script write fails — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:66-66
  If `fs.writeFile` throws after `mkdtemp` succeeds, such as ENOSPC or an antivirus/permission failure, `verifyAndStageScript` exits before returning `stagedPath`, so `runScan`'s `finally` never knows which `fb-script-*` directory to remove. That leaves a per-run temp directory, and possibly a partial `script.ps1`, on each failed staging attempt; wrap the write in local cleanup before rethrowing.
