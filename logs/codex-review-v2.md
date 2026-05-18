OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e386a-8af1-7ad2-a2b4-ba938b9f33f8
--------
user
# Regression code review request — FormatBuddy Desktop v0.1.2

You previously reviewed v0.1.0 and produced 15 findings. The maintainer applied 13 of them in v0.1.1 and the last MEDIUM (PowerShell integrity verification) in v0.1.2 — this commit.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (private)
- Release v0.1.2: https://github.com/ryan-formatbuddy/formatbuddy-desktop/releases/tag/v0.1.2
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`
- Last commit: `c23d45b` (after the previous review's commit `ce83561`)

## Your previous v0.1.0 findings → status

HIGH
- ELECTRON_RENDERER_URL packaged-build attack → **fixed in main/index.ts** (env var ignored when packaged; restricted to localhost in dev)
- scan-controller race (back-to-back scans) → **fixed in main/index.ts** (local controller capture)

MEDIUM
- Cancel surfaces as scan error → fixed (AbortError suppressed)
- Hidden diagnostic persistence in userData/scans → fixed (tmpdir + unlink after parse)
- shell.openExternal accepts any URL → fixed (https-only)
- sandbox: false → fixed (true)
- **PowerShell unpacked + Bypass + no integrity → fixed in v0.1.2 (new)**
- Quit doesn't abort active scan → fixed (before-quit)
- JSON.parse as ScanReport unchecked → fixed (schema guard)
- npmmirror electron_mirror → fixed (removed)

LOW
- stderr buffer unbounded → fixed (64 KiB rolling cap)
- CSP omits object-src/base-uri/etc → fixed (added)
- Error banner pink/red violates handoff → fixed (white + brand-blue)
- Live-dot colored glow violates handoff → fixed (removed)

NIT
- ScoreRing missing Pretendard fallback → fixed

## What I want from you in THIS review

1. **Regression check on the fixes above.** For each fix, look at the new code and tell me if the fix is actually correct/complete or if it introduced a new bug. Cite file:line. If a fix is fine, write "ok" with no commentary.

2. **New review of the new code that didn't exist in v0.1.0:**
   - `scripts/embed-ps-hash.mjs` — build hook
   - `src/main/scanner.ts` new `verifyScriptIntegrity()` + integration in `runScan()`
   - `src/main/index.ts` `enforceIntegrity: app.isPackaged`
   - `tests/scanner.test.ts` 4 new integrity tests
   - `package.json` new `prebuild` / `predist:win` / `dev` / `test` hook chain
   - `.gitignore` additions
   - `electron-builder.yml` (unchanged behavior, just confirm the manifest gets packaged correctly via extraResources)

3. **Anything else that smells now that didn't before**, e.g. integrity bypass paths, TOCTOU between hash check and spawn, manifest file source-of-trust assumptions, dev/packaged mode misclassification.

## Output format
Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). For each finding: one line `file:line — issue`, one line suggested fix. No praise. Sections with no issues → "no issues".

If there are zero new issues, say so explicitly so I can ship v0.1.2 as the stable preview.
2026-05-18T00:09:27.548821Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T00:09:27.851375Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc "cat /Users/ryanbak/.agents/skills/user/cto-code-review/SKILL.md && printf '\\n---STATUS---\\n' && git status --short && printf '\\n---LOG---\\n' && git log --oneline -5 && printf '\\n---DIFFSTAT---\\n' && git diff --stat ce83561..c23d45b" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 6069ms:
2026-05-18 09:09:45.019 xcodebuild[60756:41229487]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:45.220 xcodebuild[60756:41229486] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-9aRSfRUS' (errno=Operation not permitted)
2026-05-18 09:09:45.778 xcodebuild[60758:41229500]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:45.935 xcodebuild[60758:41229498] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v2.md

---LOG---
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-cATTMJx3' (errno=Operation not permitted)
2026-05-18 09:09:47.100 xcodebuild[60763:41229525]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:47.241 xcodebuild[60763:41229524] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-fy6LSC51' (errno=Operation not permitted)
2026-05-18 09:09:47.768 xcodebuild[60765:41229534]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:47.910 xcodebuild[60765:41229533] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
c23d45b feat: PowerShell script integrity verification (v0.1.2)
ce83561 fix: apply 13 of 15 findings from Codex code review (v0.1.1)
4074082 build: add multi-size .ico app icon + disable cross-build code signing
c03d19f chore: initial FormatBuddy Desktop scaffold

---DIFFSTAT---
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-ui0JELuc' (errno=Operation not permitted)
2026-05-18 09:09:49.059 xcodebuild[60769:41229607]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:49.200 xcodebuild[60769:41229606] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-VMvN50Wp' (errno=Operation not permitted)
2026-05-18 09:09:49.728 xcodebuild[60771:41229625]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:49.871 xcodebuild[60771:41229624] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 .gitignore                          |  2 ++
 .omc/state/idle-notif-cooldown.json |  3 --
 package.json                        |  9 ++++--
 scripts/embed-ps-hash.mjs           | 24 +++++++++++++++
 src/main/index.ts                   |  3 +-
 src/main/scanner.ts                 | 44 ++++++++++++++++++++++++--
 tests/scanner.test.ts               | 61 ++++++++++++++++++++++++++++++++++++-
 7 files changed, 135 insertions(+), 11 deletions(-)

exec
/bin/zsh -lc 'git diff --no-ext-diff --unified=120 ce83561..c23d45b -- package.json scripts/embed-ps-hash.mjs src/main/scanner.ts src/main/index.ts tests/scanner.test.ts .gitignore electron-builder.yml' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1953ms:
2026-05-18 09:09:55.524 xcodebuild[60776:41229684]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:55.664 xcodebuild[60776:41229683] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-fBIa7fMN' (errno=Operation not permitted)
2026-05-18 09:09:56.183 xcodebuild[60778:41229696]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:09:56.325 xcodebuild[60778:41229694] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/.gitignore b/.gitignore
index b2c0464..4377f31 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,10 +1,12 @@
 node_modules
 out
 dist
 .DS_Store
 *.log
 logs/*.log
 .env
 .env.local
 .vite-temp
 coverage
+.omc/
+resources/powershell/script.sha256
diff --git a/package.json b/package.json
index df351f6..8d6bfb4 100644
--- a/package.json
+++ b/package.json
@@ -1,51 +1,54 @@
 {
   "name": "formatbuddy-desktop",
-  "version": "0.1.1",
+  "version": "0.1.2",
   "private": true,
   "description": "FormatBuddy Desktop — Windows-only PC format companion built on Electron.",
   "author": {
     "name": "FormatBuddy",
     "email": "support@formatbuddy.app"
   },
   "license": "UNLICENSED",
   "main": "out/main/index.js",
   "scripts": {
-    "dev": "electron-vite dev",
+    "embed-ps-hash": "node scripts/embed-ps-hash.mjs",
+    "dev": "npm run embed-ps-hash && electron-vite dev",
+    "prebuild": "npm run embed-ps-hash",
     "build": "electron-vite build",
     "preview": "electron-vite preview",
     "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
     "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
     "typecheck": "npm run typecheck:node && npm run typecheck:web",
     "lint": "eslint .",
-    "test": "vitest run",
+    "test": "npm run embed-ps-hash && vitest run",
     "test:watch": "vitest",
+    "predist:win": "npm run embed-ps-hash",
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
diff --git a/scripts/embed-ps-hash.mjs b/scripts/embed-ps-hash.mjs
new file mode 100644
index 0000000..ef81754
--- /dev/null
+++ b/scripts/embed-ps-hash.mjs
@@ -0,0 +1,24 @@
+#!/usr/bin/env node
+/**
+ * Compute SHA-256 of the PowerShell scan script and write it to
+ * resources/powershell/script.sha256 so the packaged main process can
+ * compare it at runtime before spawning.
+ *
+ * Runs as a `prebuild` and `predist:win` hook. Re-running is safe.
+ */
+import { createHash } from "node:crypto";
+import { readFileSync, writeFileSync } from "node:fs";
+import { dirname, join, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const projectRoot = resolve(__dirname, "..");
+const scriptPath = join(projectRoot, "resources", "powershell", "Invoke-FormatBuddyScan.ps1");
+const hashPath = join(projectRoot, "resources", "powershell", "script.sha256");
+
+const contents = readFileSync(scriptPath);
+const hash = createHash("sha256").update(contents).digest("hex");
+
+writeFileSync(hashPath, `${hash}\n`, "utf8");
+
+console.info(`[embed-ps-hash] ${scriptPath} → sha256 ${hash}`);
diff --git a/src/main/index.ts b/src/main/index.ts
index b5dfbb3..f0059b9 100644
--- a/src/main/index.ts
+++ b/src/main/index.ts
@@ -1,156 +1,157 @@
 import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
 import { electronApp, optimizer } from "@electron-toolkit/utils";
 import { join } from "node:path";
 import { promises as fs } from "node:fs";
 import { IpcChannels } from "@shared/ipc";
 import type { ExportOptions, ExportResult, ScanError, ScanProgress, ScanResult } from "@shared/types";
 import { runScan } from "./scanner";
 import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
 
 let mainWindow: BrowserWindow | null = null;
 let activeAbort: AbortController | null = null;
 
 const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
 
 function createWindow() {
   mainWindow = new BrowserWindow({
     width: 1080,
     height: 760,
     minWidth: 880,
     minHeight: 640,
     show: false,
     autoHideMenuBar: true,
     backgroundColor: "#FFFFFF",
     title: "FormatBuddy",
     webPreferences: {
       preload: join(__dirname, "..", "preload", "index.js"),
       contextIsolation: true,
       nodeIntegration: false,
       sandbox: true
     }
   });
 
   mainWindow.on("ready-to-show", () => {
     mainWindow?.show();
   });
 
   mainWindow.webContents.setWindowOpenHandler(({ url }) => {
     try {
       const parsed = new URL(url);
       if (parsed.protocol === "https:") {
         void shell.openExternal(url);
       }
     } catch {
       // ignore malformed URLs
     }
     return { action: "deny" };
   });
 
   const devUrl = process.env.ELECTRON_RENDERER_URL;
   if (!app.isPackaged && devUrl && DEV_RENDERER_PATTERN.test(devUrl)) {
     void mainWindow.loadURL(devUrl);
   } else {
     void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
   }
 }
 
 function registerIpc() {
   ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
 
   ipcMain.handle(IpcChannels.scanStart, async (event) => {
     if (activeAbort) activeAbort.abort();
     const controller = new AbortController();
     activeAbort = controller;
     const sender = event.sender;
 
     const emit = (progress: ScanProgress) => {
       if (sender.isDestroyed() || controller.signal.aborted) return;
       sender.send(IpcChannels.scanProgress, progress);
     };
 
     try {
       const result: ScanResult = await runScan({
         scriptPath: getScanScriptPath(),
         outputDir: getScanOutputDir(),
         signal: controller.signal,
-        onProgress: emit
+        onProgress: emit,
+        enforceIntegrity: app.isPackaged
       });
       if (!sender.isDestroyed() && !controller.signal.aborted) {
         sender.send(IpcChannels.scanComplete, result);
       }
       return result;
     } catch (err) {
       const e = err as Error;
       const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
       const payload: ScanError = {
         message: e.message,
         code: (e as NodeJS.ErrnoException).code ?? undefined,
         detail: e.stack
       };
       if (!isAbort && !sender.isDestroyed()) {
         sender.send(IpcChannels.scanError, payload);
       }
       throw payload;
     } finally {
       if (activeAbort === controller) activeAbort = null;
     }
   });
 
   ipcMain.handle(IpcChannels.scanCancel, () => {
     if (activeAbort) {
       activeAbort.abort();
       activeAbort = null;
       return true;
     }
     return false;
   });
 
   ipcMain.handle(
     IpcChannels.reportExport,
     async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
       const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
       const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
       const dialogResult = await dialog.showSaveDialog(win!, {
         title: "리포트 JSON 저장",
         defaultPath,
         filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
       });
       if (dialogResult.canceled || !dialogResult.filePath) {
         return { saved: false };
       }
       await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
       return { saved: true, path: dialogResult.filePath };
     }
   );
 
   ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
     await shell.openExternal(getWebReportImportUrl());
     return true;
   });
 }
 
 app.whenReady().then(() => {
   electronApp.setAppUserModelId("app.formatbuddy.desktop");
 
   app.on("browser-window-created", (_event, window) => {
     optimizer.watchWindowShortcuts(window);
   });
 
   registerIpc();
   createWindow();
 
   app.on("activate", () => {
     if (BrowserWindow.getAllWindows().length === 0) createWindow();
   });
 });
 
 app.on("before-quit", () => {
   if (activeAbort) {
     activeAbort.abort();
     activeAbort = null;
   }
 });
 
 app.on("window-all-closed", () => {
   if (process.platform !== "darwin") app.quit();
 });
diff --git a/src/main/scanner.ts b/src/main/scanner.ts
index ff9872a..4d4f21f 100644
--- a/src/main/scanner.ts
+++ b/src/main/scanner.ts
@@ -1,266 +1,304 @@
 import { spawn } from "node:child_process";
 import { existsSync, mkdirSync, promises as fs } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
-import { randomUUID } from "node:crypto";
+import { createHash, randomUUID } from "node:crypto";
 import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
 
 const STDERR_MAX_BYTES = 64 * 1024;
+const INTEGRITY_MANIFEST = "script.sha256";
+
+async function verifyScriptIntegrity(
+  scriptPath: string,
+  opts: { enforce: boolean }
+): Promise<void> {
+  const manifestPath = join(dirname(scriptPath), INTEGRITY_MANIFEST);
+  let expected: string;
+  try {
+    expected = (await fs.readFile(manifestPath, "utf8")).trim();
+  } catch {
+    if (opts.enforce) {
+      throw new Error(`PowerShell integrity manifest missing: ${manifestPath}`);
+    }
+    return; // dev / mock — silent skip when manifest hasn't been generated
+  }
+  let actual: string;
+  try {
+    const buf = await fs.readFile(scriptPath);
+    actual = createHash("sha256").update(buf).digest("hex");
+  } catch (e) {
+    if (opts.enforce) throw e;
+    return;
+  }
+  if (actual !== expected) {
+    throw new Error(
+      `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
+    );
+  }
+}
 
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
+  /** Require script.sha256 to exist and match. Set true for packaged production. */
+  enforceIntegrity?: boolean;
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
-  const { onProgress, signal, mock } = options;
+  const { onProgress, signal, mock, enforceIntegrity } = options;
   const startedAt = Date.now();
 
+  // Integrity check runs even for mock when a manifest is present (catches
+  // accidental script tampering in dev). It only throws when enforced.
+  if (!mock || enforceIntegrity) {
+    await verifyScriptIntegrity(options.scriptPath, { enforce: !!enforceIntegrity });
+  }
+
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
 
-export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor };
+export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyScriptIntegrity };
diff --git a/tests/scanner.test.ts b/tests/scanner.test.ts
index afa856d..134b1ae 100644
--- a/tests/scanner.test.ts
+++ b/tests/scanner.test.ts
@@ -1,64 +1,123 @@
 import { describe, it, expect } from "vitest";
-import { mkdtempSync, readFileSync, rmSync } from "node:fs";
+import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
+import { createHash } from "node:crypto";
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
+
+describe("verifyScriptIntegrity", () => {
+  it("silently passes when manifest is missing and enforce=false", async () => {
+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-skip-"));
+    const scriptPath = join(dir, "fake.ps1");
+    writeFileSync(scriptPath, "echo hi", "utf8");
+    try {
+      await expect(
+        __testing.verifyScriptIntegrity(scriptPath, { enforce: false })
+      ).resolves.toBeUndefined();
+    } finally {
+      rmSync(dir, { recursive: true, force: true });
+    }
+  });
+
+  it("throws when manifest is missing and enforce=true", async () => {
+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-strict-"));
+    const scriptPath = join(dir, "fake.ps1");
+    writeFileSync(scriptPath, "echo hi", "utf8");
+    try {
+      await expect(
+        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
+      ).rejects.toThrowError(/integrity manifest missing/i);
+    } finally {
+      rmSync(dir, { recursive: true, force: true });
+    }
+  });
+
+  it("passes when manifest matches script hash", async () => {
+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
+    const scriptPath = join(dir, "fake.ps1");
+    const body = "Get-ChildItem";
+    writeFileSync(scriptPath, body, "utf8");
+    const hash = createHash("sha256").update(body).digest("hex");
+    writeFileSync(join(dir, "script.sha256"), `${hash}\n`, "utf8");
+    try {
+      await expect(
+        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
+      ).resolves.toBeUndefined();
+    } finally {
+      rmSync(dir, { recursive: true, force: true });
+    }
+  });
+
+  it("throws when manifest does not match script hash", async () => {
+    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
+    const scriptPath = join(dir, "fake.ps1");
+    writeFileSync(scriptPath, "Get-Process", "utf8");
+    writeFileSync(join(dir, "script.sha256"), "0".repeat(64) + "\n", "utf8");
+    try {
+      await expect(
+        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
+      ).rejects.toThrowError(/integrity check failed/i);
+    } finally {
+      rmSync(dir, { recursive: true, force: true });
+    }
+  });
+});

exec
/bin/zsh -lc "printf '%s\\n' '---electron-builder.yml---'; nl -ba electron-builder.yml; printf '%s\\n' '---paths---'; nl -ba src/main/paths.ts; printf '%s\\n' '---scanner current---'; nl -ba src/main/scanner.ts | sed -n '1,360p'; printf '%s\\n' '---index current---'; nl -ba src/main/index.ts | sed -n '1,220p'; printf '%s\\n' '---package---'; nl -ba package.json | sed -n '1,100p'; printf '%s\\n' '---resources---'; find resources -maxdepth 3 -type f -print -exec sh -c 'echo --- "'$1; wc -c "$1"; head -5 "$1"'"' _ {} \\;" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
---electron-builder.yml---
     1	appId: app.formatbuddy.desktop
     2	productName: FormatBuddy
     3	copyright: Copyright (c) ${author}
     4	directories:
     5	  output: dist
     6	  buildResources: resources
     7	
     8	files:
     9	  - out/**/*
    10	  - package.json
    11	  - "!**/.vscode/*"
    12	  - "!**/{.eslintrc.cjs,.eslintrc,.prettierrc,.editorconfig,.gitignore,.npmrc}"
    13	  - "!**/{tsconfig.*,vite.config.*,vitest.config.*,electron-builder.yml,electron.vite.config.*}"
    14	
    15	extraResources:
    16	  - from: resources/powershell
    17	    to: powershell
    18	  - from: resources/fonts
    19	    to: fonts
    20	  - from: resources/icons
    21	    to: icons
    22	
    23	win:
    24	  target:
    25	    - target: nsis
    26	      arch:
    27	        - x64
    28	  artifactName: ${productName}-Setup-${version}-${arch}.${ext}
    29	  icon: resources/icons/app-icon.ico
    30	  # Phase 1: unsigned. macOS cross-build cannot run Windows signtool.
    31	  # Ryan must accept SmartScreen warning on first launch on Windows.
    32	  signtoolOptions: null
    33	  signAndEditExecutable: false
    34	  verifyUpdateCodeSignature: false
    35	
    36	nsis:
    37	  oneClick: false
    38	  perMachine: false
    39	  allowToChangeInstallationDirectory: true
    40	  createDesktopShortcut: true
    41	  shortcutName: FormatBuddy
    42	  installerLanguages:
    43	    - ko_KR
    44	    - en_US
    45	
    46	asar: true
    47	asarUnpack:
    48	  - resources/**
---paths---
     1	import { app } from "electron";
     2	import { existsSync } from "node:fs";
     3	import { join, resolve } from "node:path";
     4	
     5	/**
     6	 * Resolve the PowerShell scan script path.
     7	 * Packaged: process.resourcesPath/powershell/Invoke-FormatBuddyScan.ps1
     8	 * Dev: <projectRoot>/resources/powershell/Invoke-FormatBuddyScan.ps1
     9	 */
    10	export function getScanScriptPath(): string {
    11	  const fileName = "Invoke-FormatBuddyScan.ps1";
    12	
    13	  if (app.isPackaged) {
    14	    return join(process.resourcesPath, "powershell", fileName);
    15	  }
    16	
    17	  const devPath = resolve(__dirname, "..", "..", "resources", "powershell", fileName);
    18	  if (existsSync(devPath)) return devPath;
    19	
    20	  return resolve(process.cwd(), "resources", "powershell", fileName);
    21	}
    22	
    23	export function getScanOutputDir(): string {
    24	  return join(app.getPath("userData"), "scans");
    25	}
    26	
    27	export function getDefaultExportPath(fileName = "formatbuddy-report.json"): string {
    28	  return join(app.getPath("desktop"), fileName);
    29	}
    30	
    31	export function getWebReportImportUrl(): string {
    32	  return "https://formatbuddy.vercel.app/report/import";
    33	}
---scanner current---
     1	import { spawn } from "node:child_process";
     2	import { existsSync, mkdirSync, promises as fs } from "node:fs";
     3	import { tmpdir } from "node:os";
     4	import { dirname, join } from "node:path";
     5	import { createHash, randomUUID } from "node:crypto";
     6	import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
     7	
     8	const STDERR_MAX_BYTES = 64 * 1024;
     9	const INTEGRITY_MANIFEST = "script.sha256";
    10	
    11	async function verifyScriptIntegrity(
    12	  scriptPath: string,
    13	  opts: { enforce: boolean }
    14	): Promise<void> {
    15	  const manifestPath = join(dirname(scriptPath), INTEGRITY_MANIFEST);
    16	  let expected: string;
    17	  try {
    18	    expected = (await fs.readFile(manifestPath, "utf8")).trim();
    19	  } catch {
    20	    if (opts.enforce) {
    21	      throw new Error(`PowerShell integrity manifest missing: ${manifestPath}`);
    22	    }
    23	    return; // dev / mock — silent skip when manifest hasn't been generated
    24	  }
    25	  let actual: string;
    26	  try {
    27	    const buf = await fs.readFile(scriptPath);
    28	    actual = createHash("sha256").update(buf).digest("hex");
    29	  } catch (e) {
    30	    if (opts.enforce) throw e;
    31	    return;
    32	  }
    33	  if (actual !== expected) {
    34	    throw new Error(
    35	      `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
    36	    );
    37	  }
    38	}
    39	
    40	function isScanReport(value: unknown): value is ScanReport {
    41	  if (!value || typeof value !== "object") return false;
    42	  const r = value as Record<string, unknown>;
    43	  return (
    44	    typeof r.schemaVersion === "string" &&
    45	    typeof r.generatedAt === "string" &&
    46	    Array.isArray(r.disks) &&
    47	    Array.isArray(r.userFolders) &&
    48	    Array.isArray(r.installedApps) &&
    49	    Array.isArray(r.drivers) &&
    50	    Array.isArray(r.printers) &&
    51	    typeof r.system === "object" &&
    52	    typeof r.privacy === "object" &&
    53	    typeof r.checklist === "object"
    54	  );
    55	}
    56	
    57	async function readAndDelete(path: string): Promise<string> {
    58	  const raw = await fs.readFile(path, "utf8");
    59	  await fs.unlink(path).catch(() => {
    60	    // best-effort cleanup; ignore failures so a Windows lock doesn't crash the flow
    61	  });
    62	  return raw;
    63	}
    64	
    65	export interface RunScanOptions {
    66	  scriptPath: string;
    67	  outputDir: string;
    68	  onProgress?: (progress: ScanProgress) => void;
    69	  powershellExe?: string;
    70	  signal?: AbortSignal;
    71	  /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
    72	  mock?: boolean;
    73	  /** Require script.sha256 to exist and match. Set true for packaged production. */
    74	  enforceIntegrity?: boolean;
    75	}
    76	
    77	const PIPELINE_STEPS: readonly string[] = [
    78	  "PC 정보 확인",
    79	  "디스크 살펴보기",
    80	  "사용자 폴더 챙기기",
    81	  "설치 앱 / 드라이버 목록",
    82	  "인증서·Wi-Fi·클라우드",
    83	  "포맷 체크리스트 정리"
    84	];
    85	
    86	const TOTAL_STEPS = PIPELINE_STEPS.length;
    87	
    88	function buildSteps(activeIndex: number): ScanStepView[] {
    89	  return PIPELINE_STEPS.map((name, i) => {
    90	    if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
    91	    if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
    92	    return { name, state: "pending", detail: "대기" };
    93	  });
    94	}
    95	
    96	function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
    97	  const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
    98	  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
    99	  return {
   100	    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
   101	    doneSteps: safeIndex,
   102	    totalSteps: TOTAL_STEPS,
   103	    score,
   104	    elapsedMs: Date.now() - startedAt,
   105	    steps: buildSteps(safeIndex),
   106	    message
   107	  };
   108	}
   109	
   110	export async function runScan(options: RunScanOptions): Promise<ScanResult> {
   111	  const { onProgress, signal, mock, enforceIntegrity } = options;
   112	  const startedAt = Date.now();
   113	
   114	  // Integrity check runs even for mock when a manifest is present (catches
   115	  // accidental script tampering in dev). It only throws when enforced.
   116	  if (!mock || enforceIntegrity) {
   117	    await verifyScriptIntegrity(options.scriptPath, { enforce: !!enforceIntegrity });
   118	  }
   119	
   120	  const tmpDir = join(tmpdir(), "formatbuddy-scans");
   121	  ensureDir(tmpDir);
   122	  const outPath = join(tmpDir, `report-${randomUUID()}.json`);
   123	
   124	  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
   125	
   126	  if (mock || process.platform !== "win32") {
   127	    return runMockScan({ outPath, startedAt, onProgress, signal });
   128	  }
   129	
   130	  return runPowershellScan({ ...options, outPath, startedAt });
   131	}
   132	
   133	function ensureDir(dir: string) {
   134	  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
   135	}
   136	
   137	interface InternalRunArgs {
   138	  outPath: string;
   139	  startedAt: number;
   140	  onProgress?: (progress: ScanProgress) => void;
   141	  signal?: AbortSignal;
   142	}
   143	
   144	async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
   145	  const { outPath, startedAt, onProgress, signal } = args;
   146	
   147	  for (let i = 1; i <= TOTAL_STEPS; i++) {
   148	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
   149	    await delay(380);
   150	    onProgress?.(progressFor(i, startedAt));
   151	  }
   152	
   153	  const report: ScanReport = buildMockReport();
   154	  ensureDir(dirname(outPath));
   155	  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
   156	
   157	  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
   158	  return { report, jsonPath: outPath };
   159	}
   160	
   161	interface PowershellRunArgs extends RunScanOptions {
   162	  outPath: string;
   163	  startedAt: number;
   164	}
   165	
   166	function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
   167	  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   168	  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   169	
   170	  return new Promise<ScanResult>((resolveScan, rejectScan) => {
   171	    const child = spawn(
   172	      exe,
   173	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
   174	      { windowsHide: true }
   175	    );
   176	
   177	    let activeIndex = 0;
   178	    let stderrBuf = "";
   179	    const tick = setInterval(() => {
   180	      if (activeIndex < TOTAL_STEPS) {
   181	        activeIndex += 1;
   182	        onProgress?.(progressFor(activeIndex, startedAt));
   183	      }
   184	    }, 700);
   185	
   186	    const cleanup = () => {
   187	      clearInterval(tick);
   188	      signal?.removeEventListener("abort", onAbort);
   189	    };
   190	
   191	    const onAbort = () => {
   192	      child.kill();
   193	      cleanup();
   194	      rejectScan(new DOMException("Scan cancelled", "AbortError"));
   195	    };
   196	
   197	    if (signal) {
   198	      if (signal.aborted) {
   199	        onAbort();
   200	        return;
   201	      }
   202	      signal.addEventListener("abort", onAbort, { once: true });
   203	    }
   204	
   205	    child.stderr.on("data", (chunk: Buffer) => {
   206	      stderrBuf += chunk.toString("utf8");
   207	      if (stderrBuf.length > STDERR_MAX_BYTES) {
   208	        stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
   209	      }
   210	    });
   211	
   212	    child.on("error", (err) => {
   213	      cleanup();
   214	      rejectScan(err);
   215	    });
   216	
   217	    child.on("close", async (code) => {
   218	      cleanup();
   219	      if (code !== 0) {
   220	        rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
   221	        return;
   222	      }
   223	      try {
   224	        const raw = await readAndDelete(outPath);
   225	        const parsed: unknown = JSON.parse(raw);
   226	        if (!isScanReport(parsed)) {
   227	          rejectScan(new Error("Diagnostic JSON did not match expected ScanReport schema."));
   228	          return;
   229	        }
   230	        const report = parsed;
   231	        onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
   232	        resolveScan({ report, jsonPath: outPath });
   233	      } catch (e) {
   234	        rejectScan(e as Error);
   235	      }
   236	    });
   237	  });
   238	}
   239	
   240	function delay(ms: number) {
   241	  return new Promise<void>((res) => setTimeout(res, ms));
   242	}
   243	
   244	function buildMockReport(): ScanReport {
   245	  return {
   246	    schemaVersion: "0.1.0",
   247	    generatedAt: new Date().toISOString(),
   248	    privacy: {
   249	      localOnly: true,
   250	      noPasswordCollection: true,
   251	      noPrivateKeyUpload: true,
   252	      noBrowserPasswordExtraction: true
   253	    },
   254	    system: {
   255	      manufacturer: "Mock",
   256	      model: "DevPreview",
   257	      serialNumberMasked: "***0000",
   258	      osCaption: "Windows 11 Pro (mock)",
   259	      osVersion: "10.0.22631",
   260	      cpu: "Mock CPU",
   261	      memoryGb: 16
   262	    },
   263	    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
   264	    userFolders: [
   265	      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
   266	      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
   267	      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
   268	    ],
   269	    gpu: ["Mock GPU"],
   270	    installedApps: [
   271	      { name: "Chrome", version: "131.0", publisher: "Google" },
   272	      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
   273	    ],
   274	    drivers: [],
   275	    printers: [],
   276	    wifiProfiles: ["home", "office"],
   277	    npkiCandidates: [
   278	      { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
   279	      { path: "C:\\NPKI", exists: false }
   280	    ],
   281	    bitlocker: [],
   282	    cloudSync: [
   283	      { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
   284	      { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
   285	    ],
   286	    browsers: [
   287	      { name: "Chrome", installed: true },
   288	      { name: "Edge", installed: true },
   289	      { name: "Firefox", installed: false },
   290	      { name: "Whale", installed: true }
   291	    ],
   292	    winget: { available: true, note: "winget is available. App export can be added in Phase 2." },
   293	    diagnostics: [],
   294	    checklist: {
   295	      reviewNpkiManually: true,
   296	      exportWifiProfilesManually: true,
   297	      backupDesktopDocumentsDownloads: true,
   298	      verifyCloudSync: true,
   299	      saveReportBeforeFormat: true
   300	    }
   301	  };
   302	}
   303	
   304	export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyScriptIntegrity };
---index current---
     1	import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type { ExportOptions, ExportResult, ScanError, ScanProgress, ScanResult } from "@shared/types";
     7	import { runScan } from "./scanner";
     8	import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
     9	
    10	let mainWindow: BrowserWindow | null = null;
    11	let activeAbort: AbortController | null = null;
    12	
    13	const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
    14	
    15	function createWindow() {
    16	  mainWindow = new BrowserWindow({
    17	    width: 1080,
    18	    height: 760,
    19	    minWidth: 880,
    20	    minHeight: 640,
    21	    show: false,
    22	    autoHideMenuBar: true,
    23	    backgroundColor: "#FFFFFF",
    24	    title: "FormatBuddy",
    25	    webPreferences: {
    26	      preload: join(__dirname, "..", "preload", "index.js"),
    27	      contextIsolation: true,
    28	      nodeIntegration: false,
    29	      sandbox: true
    30	    }
    31	  });
    32	
    33	  mainWindow.on("ready-to-show", () => {
    34	    mainWindow?.show();
    35	  });
    36	
    37	  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    38	    try {
    39	      const parsed = new URL(url);
    40	      if (parsed.protocol === "https:") {
    41	        void shell.openExternal(url);
    42	      }
    43	    } catch {
    44	      // ignore malformed URLs
    45	    }
    46	    return { action: "deny" };
    47	  });
    48	
    49	  const devUrl = process.env.ELECTRON_RENDERER_URL;
    50	  if (!app.isPackaged && devUrl && DEV_RENDERER_PATTERN.test(devUrl)) {
    51	    void mainWindow.loadURL(devUrl);
    52	  } else {
    53	    void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
    54	  }
    55	}
    56	
    57	function registerIpc() {
    58	  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
    59	
    60	  ipcMain.handle(IpcChannels.scanStart, async (event) => {
    61	    if (activeAbort) activeAbort.abort();
    62	    const controller = new AbortController();
    63	    activeAbort = controller;
    64	    const sender = event.sender;
    65	
    66	    const emit = (progress: ScanProgress) => {
    67	      if (sender.isDestroyed() || controller.signal.aborted) return;
    68	      sender.send(IpcChannels.scanProgress, progress);
    69	    };
    70	
    71	    try {
    72	      const result: ScanResult = await runScan({
    73	        scriptPath: getScanScriptPath(),
    74	        outputDir: getScanOutputDir(),
    75	        signal: controller.signal,
    76	        onProgress: emit,
    77	        enforceIntegrity: app.isPackaged
    78	      });
    79	      if (!sender.isDestroyed() && !controller.signal.aborted) {
    80	        sender.send(IpcChannels.scanComplete, result);
    81	      }
    82	      return result;
    83	    } catch (err) {
    84	      const e = err as Error;
    85	      const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
    86	      const payload: ScanError = {
    87	        message: e.message,
    88	        code: (e as NodeJS.ErrnoException).code ?? undefined,
    89	        detail: e.stack
    90	      };
    91	      if (!isAbort && !sender.isDestroyed()) {
    92	        sender.send(IpcChannels.scanError, payload);
    93	      }
    94	      throw payload;
    95	    } finally {
    96	      if (activeAbort === controller) activeAbort = null;
    97	    }
    98	  });
    99	
   100	  ipcMain.handle(IpcChannels.scanCancel, () => {
   101	    if (activeAbort) {
   102	      activeAbort.abort();
   103	      activeAbort = null;
   104	      return true;
   105	    }
   106	    return false;
   107	  });
   108	
   109	  ipcMain.handle(
   110	    IpcChannels.reportExport,
   111	    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
   112	      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
   113	      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   114	      const dialogResult = await dialog.showSaveDialog(win!, {
   115	        title: "리포트 JSON 저장",
   116	        defaultPath,
   117	        filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
   118	      });
   119	      if (dialogResult.canceled || !dialogResult.filePath) {
   120	        return { saved: false };
   121	      }
   122	      await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
   123	      return { saved: true, path: dialogResult.filePath };
   124	    }
   125	  );
   126	
   127	  ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
   128	    await shell.openExternal(getWebReportImportUrl());
   129	    return true;
   130	  });
   131	}
   132	
   133	app.whenReady().then(() => {
   134	  electronApp.setAppUserModelId("app.formatbuddy.desktop");
   135	
   136	  app.on("browser-window-created", (_event, window) => {
   137	    optimizer.watchWindowShortcuts(window);
   138	  });
   139	
   140	  registerIpc();
   141	  createWindow();
   142	
   143	  app.on("activate", () => {
   144	    if (BrowserWindow.getAllWindows().length === 0) createWindow();
   145	  });
   146	});
   147	
   148	app.on("before-quit", () => {
   149	  if (activeAbort) {
   150	    activeAbort.abort();
   151	    activeAbort = null;
   152	  }
   153	});
   154	
   155	app.on("window-all-closed", () => {
   156	  if (process.platform !== "darwin") app.quit();
   157	});
---package---
     1	{
     2	  "name": "formatbuddy-desktop",
     3	  "version": "0.1.2",
     4	  "private": true,
     5	  "description": "FormatBuddy Desktop — Windows-only PC format companion built on Electron.",
     6	  "author": {
     7	    "name": "FormatBuddy",
     8	    "email": "support@formatbuddy.app"
     9	  },
    10	  "license": "UNLICENSED",
    11	  "main": "out/main/index.js",
    12	  "scripts": {
    13	    "embed-ps-hash": "node scripts/embed-ps-hash.mjs",
    14	    "dev": "npm run embed-ps-hash && electron-vite dev",
    15	    "prebuild": "npm run embed-ps-hash",
    16	    "build": "electron-vite build",
    17	    "preview": "electron-vite preview",
    18	    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    19	    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    20	    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    21	    "lint": "eslint .",
    22	    "test": "npm run embed-ps-hash && vitest run",
    23	    "test:watch": "vitest",
    24	    "predist:win": "npm run embed-ps-hash",
    25	    "dist:win": "electron-vite build && electron-builder --win --publish never"
    26	  },
    27	  "dependencies": {
    28	    "@electron-toolkit/preload": "3.0.1",
    29	    "@electron-toolkit/utils": "3.0.0"
    30	  },
    31	  "devDependencies": {
    32	    "@tailwindcss/vite": "4.0.6",
    33	    "@testing-library/react": "16.1.0",
    34	    "@types/node": "22.10.5",
    35	    "@types/react": "19.0.7",
    36	    "@types/react-dom": "19.0.3",
    37	    "@typescript-eslint/eslint-plugin": "8.20.0",
    38	    "@typescript-eslint/parser": "8.20.0",
    39	    "@vitejs/plugin-react": "4.3.4",
    40	    "electron": "33.3.1",
    41	    "electron-builder": "25.1.8",
    42	    "electron-vite": "2.3.0",
    43	    "eslint": "9.18.0",
    44	    "eslint-plugin-react": "7.37.4",
    45	    "eslint-plugin-react-hooks": "5.1.0",
    46	    "jsdom": "26.0.0",
    47	    "react": "19.0.0",
    48	    "react-dom": "19.0.0",
    49	    "tailwindcss": "4.0.6",
    50	    "typescript": "5.7.3",
    51	    "vite": "5.4.11",
    52	    "vitest": "2.1.8"
    53	  }
    54	}
---resources---
resources/powershell/Invoke-FormatBuddyScan.ps1
--- resources/powershell/Invoke-FormatBuddyScan.ps1
    7402 resources/powershell/Invoke-FormatBuddyScan.ps1
# FormatBuddy local diagnostic prototype
# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.

param(
  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json"
resources/powershell/script.sha256
--- resources/powershell/script.sha256
      65 resources/powershell/script.sha256
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
resources/icons/app-icon.ico
--- resources/icons/app-icon.ico
  285478 resources/icons/app-icon.ico
    00     �%  F          �  �%       h  �6         (  �:  (   0   `                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          �_ �Y ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��X ��Y ��Y                                                                                      �] 1�b ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��` ��W                                                                         �O �d }�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��b 0                                                                r
  �` ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��m���H���N��t��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��c A                                                            �Y S�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f���m����������������������i��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��d ��Y                                                     d) �c ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ���:�������[��h��f���>�������m��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��[ �                                                    �W @�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��i��f ��f ��f ��f ��h��f��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��h ��0                                                 �b x�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��I D                                                �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ���S���9��f ��f ��f ��f ��y"���f��h��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��I ]                                                �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��}'����������g��f ��f ��f ��չ�������Z��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��H P                                                �h W�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��u����������f��f ��f ��f ��Ǣ�������D��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��D "                                                �7 �g ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��{%��r��f ��f ��f ��f ��k	���1��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��a �)                                                     �_ ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��S F                                                        �Q �c ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��[ �                                                                �G �_ ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��g ��U ��!                                                                     �< �g ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��c ��M 5                                                                                    �^ �] _�_ ��` ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��a ��[ 7�R                                                                                                         �? �d ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��U                                                                                                                     �_ 8�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��a f                                                                                                                            �b b�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��d �                                                                                                                                    �\ Y�g ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��g ��_ ��R                                                                                                                                         �E "�[ ��f ��f ��f ��f ��f ��f ��f ��f ��_ ³H 9                                                                                                                                                        �d �` d�a ��` ��` ��a ��` q�b (                                                                                                                                                                                                                                                                                                                                                                            �b �a                                                                                                                                                                                          �Z ��f �/                                                                                                                                                                                     �X ��i �/                                                                                                                                                                                     �X ��i �/                                                                                                                                                                                 L  �[ ��g �[' 	                                                                                                                                                                                �` r�f ��f ��a �                                                                                                                                                                                �d ��f ��f ��e �                                                                                                                                                                                �g G�f ��f ��g s                                                                                                                                                                                    �U �[                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             ������  ������  ������  ������  ������  ������  ������  ������  ������  ������  ��  �  ��  �  �   �  �    �  �      �      �    ?  �    ?  �    ?  �    ?  �    ?  �    ?  �      �    �  �    �  ��  �  ��  �  ��  ?�  ��  �  ��  ��  ��� ��  �����  �����  ������  �����  ���?��  ���?��  ���?��  ���?��  ���?��  ���?��  ���?��  �����  ������  ������  ������  ������  ������  (       @                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              �Y �\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�\ )�Y                                                         �X �c k�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��` d                                                �f �e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��d ��f                                     �W �d ��f ��f ��f ��f ��f ��f ��f ��f���b�����������u��g��f ��f ��f ��f ��f ��f ��f ��c �                                    �_ N�f ��f ��f ��f ��f ��f ��f ��f ��u������n��j���z���1��f ��f ��f ��f ��f ��f ��f ��f ��_ &                                �d ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��b v                                �d ��f ��f ��f ��f ��f ��f ��f ��f ���a���H��f ��f ���4���u��f ��f ��f ��f ��f ��f ��f ��f ��c �                                �d ��f ��f ��f ��f ��f ��f ��f ��f ��־������f ��f ���v������d ��f ��f ��f ��f ��f ��f ��f ��c r                                �b G�f ��f ��f ��f ��f ��f ��f ��f ��o��k
��f ��f ��h��r��f ��f ��f ��f ��f ��f ��f ��f ��a                                  �[  �d ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��_ {                                        �Q �b ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��_ s�&                                             �8 �a G�c ��b ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��b ��a a�X                                                                 �G �d ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��V 	                                                                            �a %�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��c :                                                                                    �a '�e ��f ��f ��f ��f ��f ��f ��e ��b 9                                                                                            �S �a R�c ��b ��b ��c ��a _�Y                                                                                                                                                                                                                                             �\ U�\ o                                                                                                                        �^ w�` �                                                                                                                        �^ {�_ �                                                                                                                    �P �d ��f ��T )                                                                                                                �P 
�d ��e ��W                                                                                                                     �[ �^                                                                                                                                                                                                                                                                                                                                                                                                                                                             �������������������������  ��  �  �  �  �  �  �  �  �  �  �  ���������������������������?���?����������������(                                                                                                                                                                                                                                                 �b �d ��d ��d ��d ��d ��d ��d ��d ��`                     �d 5�f ��f ��f ��f ���J���O��f��f ��f ��f ��c #                �e ��f ��f ��f ��j��|&��y!��m��f ��f ��f ��e �                �e ��f ��f ��f ���H���7��+���U��f ��f ��f ��e �                �d ~�f ��f ��f ��h��g��g��i��f ��f ��f ��c e                �Q �c }�d ��f ��f ��f ��f ��f ��f ��d ��b _�&                          �G  �e ��f ��f ��f ��f ��e ��V                                     �a 
�e ��d ��d ��d ��b                                                 �\ �\                                                         �^ <�_ L                                                        �b |�b �                                                        �[ �^                                                                                             ��  ��  ��  �  �  �  �  �  �  �  �  �  �  �  �  ��  (                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                �c �f Z�f {�f ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��e ��f ��f {�d Y�c                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 �d J�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��d J                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                �^ �e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��^                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     �b "�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��b "                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            �[ �e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��[                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         �e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f �                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                �c $�e ��e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    �d 3�e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f �                                                                                                                                                                                                                                                                                                                                                                                                                                                                            �f �f ��e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��                                                                                                                                                                                                                                                                                                                                                                                                                                                                  �U �f x�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��d O                                                                                                                                                                                                                                                                                                                                                                                                                                                        �d )�e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��f -                                                                                                                                                                                                                                                                                                                                                                                                                                            �e j�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��f ��f                                                                                                                                                                                                                                                                                                                                                                                                                             �] �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f <                                                                                                                                                                                                                                                                                                                                                                                                                    �f �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��e ��@                                                                                                                                                                                                                                                                                                                                                                                                         �c ,�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f                                                                                                                                                                                                                                                                                                                                                                                                 �c 1�e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��c                                                                                                                                                                                                                                                                                                                                                                                         �a *�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��c 1                                                                                                                                                                                                                                                                                                                                                                                �f #�f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e +                                                                                                                                                                                                                                                                                                                                                                        �` �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��q���;���R���_���_���R���;��q��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��` %                                                                                                                                                                                                                                                                                                                                                                �  �e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��l���Z��Ǣ������������������������������������������Ǣ���Z��l��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f                                                                                                                                                                                                                                                                                                                                                             �f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��+��Ğ������������������������������������������������������������������Ğ��+��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e ��f                                                                                                                                                                                                                                                                                                                                                     �e D�e ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��|&��ϯ����������������������������������������������������������������������������������ϯ��|&��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��f ��e �                                                                                                                                                                                                                                                                                                                                                �f 
resources/icons/cloud-buddy-primary.svg
--- resources/icons/cloud-buddy-primary.svg
     843 resources/icons/cloud-buddy-primary.svg
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="포맷버디 (Format Buddy)">
  
  <rect x="116" y="44" width="8" height="22" rx="4" fill="#0066FF"></rect>
  <circle cx="120" cy="38" r="9" fill="#0066FF"></circle>
resources/icons/cloud-buddy-on-blue.svg
--- resources/icons/cloud-buddy-on-blue.svg
     843 resources/icons/cloud-buddy-on-blue.svg
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="포맷버디 (Format Buddy)">
  
  <rect x="116" y="44" width="8" height="22" rx="4" fill="#FFFFFF"></rect>
  <circle cx="120" cy="38" r="9" fill="#FFFFFF"></circle>
resources/fonts/WantedSansVariable.ttf
--- resources/fonts/WantedSansVariable.ttf
 4669352 resources/fonts/WantedSansVariable.ttf
        GDEF,R$ )�  �GPOS0�� )��  �jGSUBcZ�` *W  LOS/2[f{	  �   `STAT�� *�   �cmapAv�S  ��  #�fvar��w� *��   jglyftD� �� %�egvar
韑 *�0 �xheadE�t     6hhea*cR�  D   $hmtx~�<F  �  ��loca�]d�  ��  ��maxp5��  h    name�+%� '�  �post��i '�� �^     ��
�f_<�      �
@�    ���@��$��            ��  $��@�@$�               1w   1w �  �             ��   2�   �2�  � x@         �  CQ�       WNTD @  �����  ��  �    �     � �   � .� .� .� .� .� .� .� .� .� .� .� .� .� .� .� �� �� ^� ^� ^� ^� ^� ^z �z �z �� "z �z �� "� "| �| �| �| �| �| �| �| �| �| �| �| �| ^| �\ �b ^b ^b ^b ^b ^b ^b ^| �| �| �| �� �D �� ����������� v� v������������x ^x ^x ^� �� �� �� �L �L �L �L �L �L �L��L �x "� �� �� �� �� �� �� �� �� �� �� �� �� �� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^	| ^� �� �� ^� �� �� �� �� �� �� ^� ^� ^� ^� ^� ^� ^ V V V V V V Vl �l �l �l �l �l �l �l �l �l �l �l �l �� .� .D .D .D .D .D .D ., ., ., ., ., ., ., ., ., . l l l l l lD �x ^x ^x ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� �� ^� ^ l� ^� V� V� V� V� V� V� V� V� V� V� V� V� V� �� V� V� V� V� �^ T� �� �p Vp Vp Vp Vp Vp V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V N� V� V� V� V� V� V� V� VT �T��T �T��T �T �� j� �� ����������� j� j���������������� j������������� ����� �� �� &� �� �������� 8� j������ � �� �� �� �� �T �T �T �T �T �T �T �T �T �� V� V� V� V� V� V� V� V� V� Vp V� R� R� V T� �� �� V � � R 8 j�� R� V� V� V� V� V� V� V� �� F� � F� F� F� � F� FT �T �T �T �T �T �T �T �T �T �T �T �T �D &D &T &T &T &T &T &T &� &D &D &D &D &D &D &D &D &D &D & f f f f f fh j� h� �� ����� N�  � N�  � N� � N� 8P fP fP fP fP fP fP fP fP fP fP fP fP fP fP fP fP �h �h �h �h �h �h �h �h �h �h �h �h �h �� �� �� F� 6� ^���� R � ����� � ���   N� V� V� V� V� V� V� V� V� f� f� f� f� f� f� f� f� f� f� f� f� f� f� f� f� �� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� Vp VT �� V� V f� �� �� V� V� V� V� V� VT �T��T �T��T �T �� ����� �� �� �� �������� 6� h������ P f � ����� � ���  � f� 0� N� 0� 0� 0� ,� 0� N <� <� N" N( N� N� 0� N� 0� NT 0� ,� N� � � � � N� 0� N� 0� 0� 0� ,� 0� N <� <� N" N( N� N� 0� N� 0� NT 0� ,� N� � � � � N < <� ,� ,� 0� 0� N� N� N� N` N` N� ,� ,� 0� 0� 0� 0� 0� 0| N N0 N� N0 N� N� N� N0 N$ N N� N� N� N� N� N� N� N� N0 N$ N$ N$ N� N� N� N� N| N0 N0 N0 N0 N� N� N$ N$ N$ N� N� N� N0 N0 N$ N� N� N� 0� 0� ,� 0� 0� � � N < <� ,� ,� 0� 0� N� N� N� N` N` N� ,� ,� 0� 0� 0� 0� 0� 0� 0� 0 <� <� 0� N� N� � � N <� <" N� N� NT 0� � � � 0� 0� 0� 0�H� �� ��T� ��X��B��
�
resources/fonts/PretendardVariable.ttf
--- resources/fonts/PretendardVariable.ttf
 6739336 resources/fonts/PretendardVariable.ttf
        GDEF?J�� -Hx  �GPOS:��` -et ��GSUB�j� 0<<  ��OS/2b�x� *��   `STAT�c� 0��   �cmapS_� *�  gvfvar��w�  (   ~glyf�\�%  � (��gvar\ �� 0Ѽ 6�head1pj  )�   6hheaIB *��   $hmtxU#�v )�L  �Dlocayf (�|  �maxp:0t (�\    name���    post��� *�� K�   ��              	        $       =       P       _       k       y       �       �       �       �       �       �        �     ! 	      "  �     # 	 �     $  �     %      & (     '  k     ( ?     ) S     * b     + ~   #      # 	    #  $   #  =   #  P   #  _   #  k   #  y   #  �   #  �   #  �   #  �   #  �   #  �   #   �   #! 	    #"  �   ## 	 �   #$  �   #%    #& (   #'  k   #( ?   #) S   #* b   #+ ~  	   <�  	  &�  	  �  	  :  	  &�  	  >;  	  4y  	 D�  	  �  	 	*  	  05  	  05  	  e  	  4�  	  &�  	  �  	  $�  	  �  	 �  	 .�  	   	 :3  	 
m  	 0w  	 �  	 2�  		 �  	
 6�  	 	+  	 .	3  	 	a  	 8	s  	 
	�  	 0	�  	 	�  	 6	�  	 6	�  	 
'  	 

exec
/bin/zsh -lc "printf '%s\\n' '---resources/powershell---'; ls -la resources/powershell; printf '%s\\n' '---sha---'; if [ -f resources/powershell/script.sha256 ]; then cat resources/powershell/script.sha256; else echo MISSING; fi; printf '%s\\n' '---ps first lines---'; nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '1,240p'; printf '%s\\n' '---vite config---'; nl -ba electron.vite.config.ts; printf '%s\\n' '---tsconfig node---'; nl -ba tsconfig.node.json; printf '%s\\n' '---tsconfig web---'; nl -ba tsconfig.web.json; printf '%s\\n' '---test config---'; nl -ba vitest.config.ts 2>/dev/null || true" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
---resources/powershell---
total 24
drwxr-xr-x@ 4 ryanbak  staff   128 May 18 09:07 .
drwxr-xr-x@ 5 ryanbak  staff   160 May 18 01:25 ..
-rw-r--r--@ 1 ryanbak  staff  7402 May 18 01:25 Invoke-FormatBuddyScan.ps1
-rw-r--r--@ 1 ryanbak  staff    65 May 18 09:07 script.sha256
---sha---
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
---ps first lines---
     1	# FormatBuddy local diagnostic prototype
     2	# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
     3	
     4	param(
     5	  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json"
     6	)
     7	
     8	$ErrorActionPreference = "SilentlyContinue"
     9	$diagnostics = New-Object System.Collections.Generic.List[object]
    10	
    11	function Add-Diagnostic {
    12	  param([string]$Step, [string]$Message)
    13	  $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
    14	}
    15	
    16	function Get-SafeCimInstance {
    17	  param([string]$ClassName)
    18	  try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
    19	}
    20	
    21	function Get-InstalledApps {
    22	  $paths = @(
    23	    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    24	    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    25	    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    26	  )
    27	
    28	  foreach ($path in $paths) {
    29	    Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    30	      [ordered]@{
    31	        name = $_.DisplayName
    32	        version = $_.DisplayVersion
    33	        publisher = $_.Publisher
    34	      }
    35	    }
    36	  }
    37	}
    38	
    39	function Test-NpkiLocation {
    40	  $candidates = @(
    41	    "$env:USERPROFILE\AppData\LocalLow\NPKI",
    42	    "$env:USERPROFILE\AppData\Roaming\NPKI",
    43	    "$env:SystemDrive\NPKI"
    44	  )
    45	
    46	  foreach ($path in $candidates) {
    47	    [ordered]@{
    48	      path = $path
    49	      exists = Test-Path $path
    50	    }
    51	  }
    52	}
    53	
    54	function Get-FolderSizeGb {
    55	  param([string]$Path)
    56	
    57	  if (!(Test-Path $Path)) { return $null }
    58	
    59	  try {
    60	    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
    61	      Measure-Object -Property Length -Sum
    62	
    63	    if ($null -eq $sum.Sum) { return 0 }
    64	    return [Math]::Round($sum.Sum / 1GB, 2)
    65	  } catch {
    66	    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    67	    return $null
    68	  }
    69	}
    70	
    71	function Get-UserFolders {
    72	  $folders = @(
    73	    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    74	    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    75	    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    76	    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    77	    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    78	    @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
    79	  )
    80	
    81	  foreach ($folder in $folders) {
    82	    $exists = Test-Path $folder.path
    83	    [ordered]@{
    84	      name = $folder.name
    85	      path = $folder.path
    86	      exists = $exists
    87	      sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
    88	    }
    89	  }
    90	}
    91	
    92	function Get-CloudSyncCandidates {
    93	  $candidates = @(
    94	    @{ provider = "OneDrive"; path = $env:OneDrive },
    95	    @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
    96	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
    97	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
    98	    @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
    99	  ) | Where-Object { $_.path }
   100	
   101	  foreach ($candidate in $candidates) {
   102	    [ordered]@{
   103	      provider = $candidate.provider
   104	      path = $candidate.path
   105	      exists = Test-Path $candidate.path
   106	    }
   107	  }
   108	}
   109	
   110	function Get-BrowserPresence {
   111	  $browsers = @(
   112	    @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
   113	    @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
   114	    @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
   115	    @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   116	  )
   117	
   118	  foreach ($browser in $browsers) {
   119	    [ordered]@{
   120	      name = $browser.name
   121	      installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
   122	    }
   123	  }
   124	}
   125	
   126	function Get-WingetStatus {
   127	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   128	  [ordered]@{
   129	    available = [bool]$winget
   130	    note = if ($winget) { "winget is available. App export can be added in Phase 2." } else { "winget is not available on this PC." }
   131	  }
   132	}
   133	
   134	$computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
   135	$os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   136	$bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
   137	$cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
   138	$gpu = Get-SafeCimInstance Win32_VideoController
   139	$disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
   140	$printers = Get-SafeCimInstance Win32_Printer
   141	$drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   142	$wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
   143	$bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
   144	
   145	$report = [ordered]@{
   146	  schemaVersion = "0.1.0"
   147	  generatedAt = (Get-Date).ToString("o")
   148	  privacy = [ordered]@{
   149	    localOnly = $true
   150	    noPasswordCollection = $true
   151	    noPrivateKeyUpload = $true
   152	    noBrowserPasswordExtraction = $true
   153	  }
   154	  system = [ordered]@{
   155	    manufacturer = $computer.Manufacturer
   156	    model = $computer.Model
   157	    serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
   158	    osCaption = $os.Caption
   159	    osVersion = $os.Version
   160	    cpu = $cpu.Name
   161	    memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
   162	  }
   163	  disks = @($disk | ForEach-Object {
   164	    [ordered]@{
   165	      drive = $_.DeviceID
   166	      sizeGb = [Math]::Round($_.Size / 1GB, 2)
   167	      freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
   168	    }
   169	  })
   170	  userFolders = @(Get-UserFolders)
   171	  gpu = @($gpu | ForEach-Object { $_.Name })
   172	  installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
   173	  drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
   174	  printers = @($printers | Select-Object Name, DriverName, PortName, Default)
   175	  wifiProfiles = @($wifiProfiles)
   176	  npkiCandidates = @(Test-NpkiLocation)
   177	  bitlocker = @($bitlocker)
   178	  cloudSync = @(Get-CloudSyncCandidates)
   179	  browsers = @(Get-BrowserPresence)
   180	  winget = Get-WingetStatus
   181	  diagnostics = @($diagnostics)
   182	  checklist = [ordered]@{
   183	    reviewNpkiManually = $true
   184	    exportWifiProfilesManually = $true
   185	    backupDesktopDocumentsDownloads = $true
   186	    verifyCloudSync = $true
   187	    saveReportBeforeFormat = $true
   188	  }
   189	}
   190	
   191	$parent = Split-Path -Parent $OutputPath
   192	if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
   193	$report | ConvertTo-Json -Depth 8 | Out-File -FilePath $OutputPath -Encoding utf8
   194	Write-Host "FormatBuddy report saved: $OutputPath"
---vite config---
     1	import { resolve } from "node:path";
     2	import { defineConfig, externalizeDepsPlugin } from "electron-vite";
     3	import react from "@vitejs/plugin-react";
     4	
     5	export default defineConfig({
     6	  main: {
     7	    plugins: [externalizeDepsPlugin()],
     8	    build: {
     9	      outDir: "out/main",
    10	      rollupOptions: {
    11	        input: { index: resolve(__dirname, "src/main/index.ts") }
    12	      }
    13	    },
    14	    resolve: {
    15	      alias: { "@shared": resolve(__dirname, "src/shared") }
    16	    }
    17	  },
    18	  preload: {
    19	    plugins: [externalizeDepsPlugin()],
    20	    build: {
    21	      outDir: "out/preload",
    22	      rollupOptions: {
    23	        input: { index: resolve(__dirname, "src/preload/index.ts") }
    24	      }
    25	    },
    26	    resolve: {
    27	      alias: { "@shared": resolve(__dirname, "src/shared") }
    28	    }
    29	  },
    30	  renderer: {
    31	    root: resolve(__dirname, "src/renderer"),
    32	    plugins: [react()],
    33	    build: {
    34	      outDir: resolve(__dirname, "out/renderer"),
    35	      rollupOptions: {
    36	        input: { index: resolve(__dirname, "src/renderer/index.html") }
    37	      }
    38	    },
    39	    resolve: {
    40	      alias: {
    41	        "@renderer": resolve(__dirname, "src/renderer/src"),
    42	        "@shared": resolve(__dirname, "src/shared")
    43	      }
    44	    },
    45	    server: {
    46	      port: 5273
    47	    }
    48	  }
    49	});
---tsconfig node---
     1	{
     2	  "compilerOptions": {
     3	    "target": "ES2022",
     4	    "module": "ESNext",
     5	    "moduleResolution": "Bundler",
     6	    "lib": ["ES2022"],
     7	    "types": ["node", "electron-vite/node"],
     8	    "strict": true,
     9	    "noUnusedLocals": true,
    10	    "noUnusedParameters": true,
    11	    "esModuleInterop": true,
    12	    "resolveJsonModule": true,
    13	    "skipLibCheck": true,
    14	    "isolatedModules": true,
    15	    "composite": true,
    16	    "outDir": "out/types-node",
    17	    "baseUrl": ".",
    18	    "paths": {
    19	      "@shared/*": ["src/shared/*"],
    20	      "@main/*": ["src/main/*"]
    21	    }
    22	  },
    23	  "include": [
    24	    "electron.vite.config.ts",
    25	    "src/main/**/*.ts",
    26	    "src/preload/**/*.ts",
    27	    "src/shared/**/*.ts",
    28	    "tests/**/*.test.ts"
    29	  ]
    30	}
---tsconfig web---
     1	{
     2	  "compilerOptions": {
     3	    "target": "ES2022",
     4	    "module": "ESNext",
     5	    "moduleResolution": "Bundler",
     6	    "lib": ["ES2022", "DOM", "DOM.Iterable"],
     7	    "types": ["vite/client"],
     8	    "jsx": "react-jsx",
     9	    "strict": true,
    10	    "noUnusedLocals": true,
    11	    "noUnusedParameters": true,
    12	    "esModuleInterop": true,
    13	    "resolveJsonModule": true,
    14	    "skipLibCheck": true,
    15	    "isolatedModules": true,
    16	    "composite": true,
    17	    "outDir": "out/types-web",
    18	    "baseUrl": ".",
    19	    "paths": {
    20	      "@renderer/*": ["src/renderer/src/*"],
    21	      "@shared/*": ["src/shared/*"]
    22	    }
    23	  },
    24	  "include": [
    25	    "src/renderer/src/**/*.ts",
    26	    "src/renderer/src/**/*.tsx",
    27	    "src/shared/**/*.ts",
    28	    "src/preload/index.d.ts"
    29	  ]
    30	}
---test config---
     1	import { defineConfig } from "vitest/config";
     2	import { resolve } from "node:path";
     3	
     4	export default defineConfig({
     5	  test: {
     6	    environment: "node",
     7	    include: ["tests/**/*.test.ts"],
     8	    globals: false,
     9	    coverage: { reporter: ["text"] }
    10	  },
    11	  resolve: {
    12	    alias: {
    13	      "@shared": resolve(__dirname, "src/shared"),
    14	      "@main": resolve(__dirname, "src/main")
    15	    }
    16	  }
    17	});

exec
/bin/zsh -lc "find . -maxdepth 4 -type f \\( -path './node_modules/*' -o -path './dist/*' -o -path './out/*' -o -path './coverage/*' -o -path './resources/fonts/*' -o -path './resources/icons/*.ico' \\) -prune -o -type f -print | sort" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 124ms:
./.git/COMMIT_EDITMSG
./.git/HEAD
./.git/config
./.git/description
./.git/hooks/applypatch-msg.sample
./.git/hooks/commit-msg.sample
./.git/hooks/fsmonitor-watchman.sample
./.git/hooks/post-update.sample
./.git/hooks/pre-applypatch.sample
./.git/hooks/pre-commit.sample
./.git/hooks/pre-merge-commit.sample
./.git/hooks/pre-push.sample
./.git/hooks/pre-rebase.sample
./.git/hooks/pre-receive.sample
./.git/hooks/prepare-commit-msg.sample
./.git/hooks/push-to-checkout.sample
./.git/hooks/sendemail-validate.sample
./.git/hooks/update.sample
./.git/index
./.git/info/exclude
./.git/logs/HEAD
./.git/objects/00/f0459ec829db5f258966d170c1a98207aaa4d3
./.git/objects/02/5b4d883729a26f75210d781eaaa6780c129bc1
./.git/objects/08/ff04e0ab75d8fb8fb09c60a1933b9f6d68b5c4
./.git/objects/0e/92179efec29637e3c6f52be41393c1db299fbc
./.git/objects/12/497d03f178d8b2c154f929fd9542305664b6b7
./.git/objects/13/4b1aea2011327a7a3ac875d2567d991529473a
./.git/objects/13/977cc3dc7abdc42d2ef27adb315d3fa7daaecf
./.git/objects/13/ad61cab8f048a72fdfbe1f31f96b81479ffa76
./.git/objects/14/e63511e215014a21da344cc5c96b600255ffc6
./.git/objects/15/5ebaa6759855152876985c5984541283abb0a1
./.git/objects/19/f5efcca51d9535457de714dd70250885eab774
./.git/objects/1e/23ce35c918d2682bb885fcd17332d954cc06a7
./.git/objects/20/ae6122456540122b0d527b267bab49f1550138
./.git/objects/25/b856556a624510ef4ca4a1b40e431bca352209
./.git/objects/28/e21a5cee81af004f074f4fc7524df45cd3b33f
./.git/objects/29/c95a7b820e646821b0e6d2ad993ec13f5a5d09
./.git/objects/2b/463ac311f3dcd8f786e1e135e01f55d735973b
./.git/objects/2e/f8ba9bb268afdf3eb2ed9e4b0ec172591db780
./.git/objects/32/b0811eae2cbfeb5f6ddaf34015ecaa726b006a
./.git/objects/33/ddf09c114964c8e14f807c23679c26206508cd
./.git/objects/35/9881eaac6bcf154de7213aa667d82bea2600f8
./.git/objects/36/066dc76a4ebeda0e81216d80ae83c949ab43b6
./.git/objects/36/bf14ad64e68f9850f2358eaa55d3cf80617ff5
./.git/objects/3b/f5843241a4b28ed2ab3736a1071da4a419fa0d
./.git/objects/3d/96a935bd4688d911c5ee70f819943f6d30b233
./.git/objects/3f/5e186d1b5e9370eae5085bba6ae3fb759a6aa6
./.git/objects/40/740820bd8277561eab0dfe15a918f8b240eae4
./.git/objects/43/77f31066e68494ebdc2a4cbcd7ce150a7e7a31
./.git/objects/46/3aec2e76f0d95b9b61593f4a589c296023b1b0
./.git/objects/48/4f8aceaa6dcb78528f5c16a70b2e9cbd726470
./.git/objects/49/996926426da69177adc1abb32679428a66e0f3
./.git/objects/4a/536e777e88255e4c8ea7c4b9a2afa36ad0b045
./.git/objects/4c/ba341dac96f0869c8651b7ce84c0e78a2a8dfe
./.git/objects/4d/4f21fa6719d99acd2ddeb272d6148c5b53743e
./.git/objects/4d/fc3b58161c33640f240f2839fdb256ab6d353e
./.git/objects/53/217428538940fec64575b4c71f46893ebdcb8c
./.git/objects/55/6a8d90161c790dc1e369168ed5f1770b82ffe6
./.git/objects/63/a8bd6026efda1cc931ba54999e7748ab524238
./.git/objects/6d/3b9842683d4baf28909e4d8da173629e73c868
./.git/objects/71/c461af5b40a5b1434164dc5dfca8476b351feb
./.git/objects/72/86915b7deebc10fc5e646c26cb3d72df970442
./.git/objects/75/8b90465c4055916b7d3e780e7ddd741a40736f
./.git/objects/78/9e62b5a1462dd3dff988728c34e47f62ad1c90
./.git/objects/7a/2aa57f191221e8b31969e0dd56a6f7d8d5ca72
./.git/objects/7c/2b1aa916c4867a008b6cff4c3e36b0bed09878
./.git/objects/87/85eccfb524d7259c85e10584e2825a7983e544
./.git/objects/8c/9bdd709496cf1c4ceed965676a73ec2985bed1
./.git/objects/8d/46c2c2745f9db88c7f3ae318b26889762f5f41
./.git/objects/8d/6bfb4a3e0d956508e8b8e76932b567a9785129
./.git/objects/93/938d6cefbbc23750617849bd8a65d02cf914b1
./.git/objects/96/883c26882a2b005b1ce6543bba6b1b463c6613
./.git/objects/9b/607e3640aa94da173fa0a63e93dd6f5936a601
./.git/objects/9e/1c1fe9491c873f57eeeb20490b1a532628b45c
./.git/objects/a4/0e1785b8e1557cb7a107ba8fab4d032822dab9
./.git/objects/ac/6c780177f8ae53a2793c9ebc098af8e29c1ee3
./.git/objects/af/a856d0b3080945a07cbb8d3c0aa51de0ba8bf9
./.git/objects/b0/a6e2e043c6a0d339c2b99afbecd85ee22fb098
./.git/objects/b2/97647a7c7b37c19d15884f7234bd7b0c82607a
./.git/objects/b2/c0464f7ac8c236981a106b032657468c01770c
./.git/objects/b4/323e5ad13443b0ceaf5de2fe106b23b5fc1c41
./.git/objects/b5/dfbb361050ed66918a0ab2998538ca0791a0af
./.git/objects/bd/fb9dce6b3a000dcfc572168c992f4d6ca789b3
./.git/objects/c0/3d19fbe3466d243203869512bb3e40c435763e
./.git/objects/c0/b07042e7053f36c89ac7ece089b2a61157f480
./.git/objects/c0/c80ba447bda3d94149681c1416fe0241632133
./.git/objects/c2/3d45bf93851714e361dd47127afc721adc73a4
./.git/objects/c3/8d81c18087f786ae36b1898117c5399ac1fd12
./.git/objects/c4/013d07e7e95a3ed7b62038aff1566665826abc
./.git/objects/c9/2ad2764fadfa7649533d33a712d2ef305e4bd4
./.git/objects/cb/95e90736deb8c21540ea209f41845b3baa4531
./.git/objects/ce/8356171c02878a51ba7693c793261f6ac91c1f
./.git/objects/ce/e2e510c52b2f8e856e7bbbb483fc6aefc30a6f
./.git/objects/d0/bbaefeb718ce9571a3dd2dc94e7396332f133d
./.git/objects/d6/7edfde25de8bb6013c77e3477c35a43a25e86f
./.git/objects/d9/491bdaa3031afbceb609263fe7587c53f6b905
./.git/objects/dd/a178e237b76fdf8e2758182d6b120b6d6be57a
./.git/objects/df/0fcfbe5b6a7df105d2202909b67aa6f5e9156f
./.git/objects/df/351f612d02fb784faaa3c057c5f3da9046d5b0
./.git/objects/e2/01d8bc09adaf9ef2c86780e164919273960a19
./.git/objects/e4/97498f09d3f93b4d9a20b895e1ced7f265a6cc
./.git/objects/e5/3797505d484becbab993f0c33981057e86b325
./.git/objects/e6/daf6faccdac2217766f995ec9607a445197c83
./.git/objects/e7/10cdf0d998ab56ae0c6ca7c6f42030754995ad
./.git/objects/ee/6c2e302a1b8b4bd447073b76a3a6baa899b2cc
./.git/objects/ef/81754f943bba0f17a41f5d39d9cba806739e55
./.git/objects/f0/059b9af5ccb6707d7a0a2f6ba25c1d89149e4a
./.git/objects/f0/c789f61eddce8f8b67bcb7558eaee59a00a585
./.git/objects/f6/7868ac3417f493609d19aa00ea0afef084c347
./.git/objects/f7/828e4771dd4ae00c78a304f3b233516cc7325a
./.git/objects/f8/1eb7565c9b0b6f87d5993509eaea588f440de0
./.git/objects/f8/dc8d42ca578cef9a0ee04306beb77b87d87150
./.git/objects/fa/363dc165edcfebe686d0ef29e917baa0f1cfe5
./.git/objects/ff/9872af04388d5228884ab0d03e9827eb305084
./.git/refs/heads/main
./.gitignore
./.npmrc
./.omc/state/idle-notif-cooldown.json
./README.md
./electron-builder.yml
./electron.vite.config.ts
./eslint.config.mjs
./logs/build.log
./logs/codex-review-v2.md
./logs/codex-review.md
./logs/dist-win.log
./logs/lint.log
./logs/npm-install.log
./logs/test.log
./logs/typecheck.log
./package-lock.json
./package.json
./resources/icons/cloud-buddy-on-blue.svg
./resources/icons/cloud-buddy-primary.svg
./resources/powershell/Invoke-FormatBuddyScan.ps1
./resources/powershell/script.sha256
./scripts/embed-ps-hash.mjs
./src/main/index.ts
./src/main/paths.ts
./src/main/scanner.ts
./src/preload/index.d.ts
./src/preload/index.ts
./src/renderer/index.html
./src/renderer/src/App.tsx
./src/renderer/src/main.tsx
./src/shared/copy.ts
./src/shared/ipc.ts
./src/shared/types.ts
./tests/ipc.test.ts
./tests/scanner.test.ts
./tsconfig.json
./tsconfig.node.json
./tsconfig.web.json
./vitest.config.ts

exec
/bin/zsh -lc "printf '%s\\n' '---preload---'; nl -ba src/preload/index.ts; printf '%s\\n' '---preload d---'; nl -ba src/preload/index.d.ts; printf '%s\\n' '---shared types---'; nl -ba src/shared/types.ts | sed -n '1,260p'; printf '%s\\n' '---ipc---'; nl -ba src/shared/ipc.ts; printf '%s\\n' '---index.html---'; nl -ba src/renderer/index.html; printf '%s\\n' '---App---'; nl -ba src/renderer/src/App.tsx | sed -n '1,360p'; printf '%s\\n' '---copy---'; nl -ba src/shared/copy.ts | sed -n '1,260p'; printf '%s\\n' '---tests ipc---'; nl -ba tests/ipc.test.ts" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
---preload---
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ExportOptions,
     5	  ExportResult,
     6	  ScanError,
     7	  ScanProgress,
     8	  ScanReport,
     9	  ScanResult
    10	} from "@shared/types";
    11	
    12	type ProgressListener = (progress: ScanProgress) => void;
    13	type CompleteListener = (result: ScanResult) => void;
    14	type ErrorListener = (error: ScanError) => void;
    15	
    16	const fb = {
    17	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    18	
    19	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    20	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    21	
    22	  onScanProgress(cb: ProgressListener): () => void {
    23	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    24	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    25	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    26	  },
    27	  onScanComplete(cb: CompleteListener): () => void {
    28	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    29	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    30	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    31	  },
    32	  onScanError(cb: ErrorListener): () => void {
    33	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    34	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    35	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    36	  },
    37	
    38	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    39	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    40	
    41	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb)
    42	};
    43	
    44	contextBridge.exposeInMainWorld("fb", fb);
    45	
    46	export type FbBridge = typeof fb;
---preload d---
     1	import type { FbBridge } from "./index";
     2	
     3	declare global {
     4	  interface Window {
     5	    fb: FbBridge;
     6	  }
     7	}
     8	
     9	export {};
---shared types---
     1	export type ScanStepState = "done" | "active" | "pending";
     2	
     3	export interface ScanStepView {
     4	  name: string;
     5	  state: ScanStepState;
     6	  detail: string;
     7	}
     8	
     9	export interface ScanProgress {
    10	  step: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  score: number;
    14	  elapsedMs: number;
    15	  steps: ScanStepView[];
    16	  message?: string;
    17	}
    18	
    19	export interface SystemInfo {
    20	  manufacturer?: string | null;
    21	  model?: string | null;
    22	  serialNumberMasked?: string | null;
    23	  osCaption?: string | null;
    24	  osVersion?: string | null;
    25	  cpu?: string | null;
    26	  memoryGb?: number | null;
    27	}
    28	
    29	export interface DiskInfo {
    30	  drive: string;
    31	  sizeGb: number;
    32	  freeGb: number;
    33	}
    34	
    35	export interface UserFolderInfo {
    36	  name: string;
    37	  path: string;
    38	  exists: boolean;
    39	  sizeGb: number | null;
    40	}
    41	
    42	export interface InstalledApp {
    43	  name: string;
    44	  version?: string | null;
    45	  publisher?: string | null;
    46	}
    47	
    48	export interface DriverInfo {
    49	  DeviceName?: string;
    50	  DriverVersion?: string;
    51	  Manufacturer?: string;
    52	  DriverDate?: string;
    53	}
    54	
    55	export interface PrinterInfo {
    56	  Name?: string;
    57	  DriverName?: string;
    58	  PortName?: string;
    59	  Default?: boolean;
    60	}
    61	
    62	export interface NpkiCandidate {
    63	  path: string;
    64	  exists: boolean;
    65	}
    66	
    67	export interface BitLockerVolume {
    68	  MountPoint?: string;
    69	  VolumeStatus?: string;
    70	  ProtectionStatus?: string;
    71	  EncryptionPercentage?: number;
    72	}
    73	
    74	export interface CloudSyncCandidate {
    75	  provider: string;
    76	  path: string;
    77	  exists: boolean;
    78	}
    79	
    80	export interface BrowserPresence {
    81	  name: string;
    82	  installed: boolean;
    83	}
    84	
    85	export interface WingetStatus {
    86	  available: boolean;
    87	  note: string;
    88	}
    89	
    90	export interface PrivacyInfo {
    91	  localOnly: boolean;
    92	  noPasswordCollection: boolean;
    93	  noPrivateKeyUpload: boolean;
    94	  noBrowserPasswordExtraction: boolean;
    95	}
    96	
    97	export interface ChecklistInfo {
    98	  reviewNpkiManually: boolean;
    99	  exportWifiProfilesManually: boolean;
   100	  backupDesktopDocumentsDownloads: boolean;
   101	  verifyCloudSync: boolean;
   102	  saveReportBeforeFormat: boolean;
   103	}
   104	
   105	export interface ScanReport {
   106	  schemaVersion: string;
   107	  generatedAt: string;
   108	  privacy: PrivacyInfo;
   109	  system: SystemInfo;
   110	  disks: DiskInfo[];
   111	  userFolders: UserFolderInfo[];
   112	  gpu: string[];
   113	  installedApps: InstalledApp[];
   114	  drivers: DriverInfo[];
   115	  printers: PrinterInfo[];
   116	  wifiProfiles: string[];
   117	  npkiCandidates: NpkiCandidate[];
   118	  bitlocker: BitLockerVolume[];
   119	  cloudSync: CloudSyncCandidate[];
   120	  browsers: BrowserPresence[];
   121	  winget: WingetStatus;
   122	  diagnostics: Array<{ step: string; message: string }>;
   123	  checklist: ChecklistInfo;
   124	}
   125	
   126	export interface ScanResult {
   127	  report: ScanReport;
   128	  jsonPath: string;
   129	}
   130	
   131	export interface ScanError {
   132	  message: string;
   133	  code?: string;
   134	  detail?: string;
   135	}
   136	
   137	export interface ExportOptions {
   138	  defaultFileName?: string;
   139	}
   140	
   141	export interface ExportResult {
   142	  saved: boolean;
   143	  path?: string;
   144	}
---ipc---
     1	export const IpcChannels = {
     2	  scanStart: "scan:start",
     3	  scanCancel: "scan:cancel",
     4	  scanProgress: "scan:progress",
     5	  scanComplete: "scan:complete",
     6	  scanError: "scan:error",
     7	  reportExport: "report:export",
     8	  reportOpenWeb: "report:open-web",
     9	  appVersion: "app:version"
    10	} as const;
    11	
    12	export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
---index.html---
     1	<!doctype html>
     2	<html lang="ko">
     3	  <head>
     4	    <meta charset="UTF-8" />
     5	    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     6	    <meta http-equiv="Content-Security-Policy"
     7	      content="default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'self'" />
     8	    <title>FormatBuddy</title>
     9	  </head>
    10	  <body>
    11	    <div id="root"></div>
    12	    <script type="module" src="/src/main.tsx"></script>
    13	  </body>
    14	</html>
---App---
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     6	
     7	type Phase =
     8	  | { kind: "home" }
     9	  | { kind: "scanning"; progress: ScanProgress }
    10	  | { kind: "report"; result: ScanResult }
    11	  | { kind: "error"; error: ScanError };
    12	
    13	const INITIAL_PROGRESS: ScanProgress = {
    14	  step: "준비",
    15	  doneSteps: 0,
    16	  totalSteps: 6,
    17	  score: 0,
    18	  elapsedMs: 0,
    19	  steps: [
    20	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    21	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    22	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    23	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    24	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    25	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    26	  ]
    27	};
    28	
    29	export function App() {
    30	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    31	  const [appVersion, setAppVersion] = useState<string>("");
    32	
    33	  useEffect(() => {
    34	    if (typeof window.fb?.appVersion === "function") {
    35	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    36	    }
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    if (!window.fb) return;
    41	    const offProgress = window.fb.onScanProgress((p) => {
    42	      setPhase((prev) =>
    43	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    44	      );
    45	    });
    46	    const offComplete = window.fb.onScanComplete((r) => {
    47	      setPhase({ kind: "report", result: r });
    48	    });
    49	    const offError = window.fb.onScanError((err) => {
    50	      setPhase({ kind: "error", error: err });
    51	    });
    52	    return () => {
    53	      offProgress();
    54	      offComplete();
    55	      offError();
    56	    };
    57	  }, []);
    58	
    59	  const startScan = useCallback(async () => {
    60	    if (!window.fb) {
    61	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    62	      return;
    63	    }
    64	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    65	    try {
    66	      await window.fb.startScan();
    67	    } catch {
    68	      // 에러는 onScanError 이벤트로 처리
    69	    }
    70	  }, []);
    71	
    72	  const cancelScan = useCallback(async () => {
    73	    if (!window.fb) return;
    74	    await window.fb.cancelScan();
    75	    setPhase({ kind: "home" });
    76	  }, []);
    77	
    78	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    79	
    80	  const content = useMemo(() => {
    81	    switch (phase.kind) {
    82	      case "home":
    83	        return <Home onStartScan={startScan} />;
    84	      case "scanning":
    85	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    86	      case "report":
    87	        return <Report result={phase.result} onBack={goHome} />;
    88	      case "error":
    89	        return (
    90	          <Scanning
    91	            progress={INITIAL_PROGRESS}
    92	            errorMessage={phase.error.message}
    93	            onCancel={goHome}
    94	            onRetry={startScan}
    95	          />
    96	        );
    97	    }
    98	  }, [phase, startScan, cancelScan, goHome]);
    99	
   100	  return (
   101	    <div className="fb-app">
   102	      {content}
   103	      <footer className="fb-app-footer">
   104	        <span>FormatBuddy Desktop</span>
   105	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   106	      </footer>
   107	    </div>
   108	  );
   109	}
---copy---
     1	/**
     2	 * 카피 톤 가이드는 web/CLAUDE.md 기준.
     3	 * 권장: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
     4	 * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
     5	 */
     6	export const copy = {
     7	  appName: "포맷버디",
     8	  appNameEn: "FORMAT BUDDY",
     9	
    10	  homeEyebrow: "PC 포맷 동행 데스크탑",
    11	  homeTitle1: "포맷하기 전에,",
    12	  homeTitle2: "버디가 같이",
    13	  homeTitle3: "살펴볼게요.",
    14	  homeLede:
    15	    "공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와드려요.",
    16	  homeStartCta: "PC 점검 시작",
    17	  homeOpenReportCta: "리포트 열기",
    18	
    19	  scanTitle: "버디가 살펴보는 중",
    20	  scanWaiting: "잠깐, 진단 준비할게요",
    21	  scanLiveLabel: "진단 중",
    22	  scanCancelCta: "그만하기",
    23	
    24	  reportTitle: "살펴봤어요",
    25	  reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
    26	  reportExportCta: "JSON으로 저장",
    27	  reportOpenWebCta: "웹 리포트 뷰어 열기",
    28	  reportBackCta: "처음으로",
    29	
    30	  privacyHeadline: "Ryan의 PC 안에서만 동작해요",
    31	  privacyBullets: [
    32	    "서버로 어떤 파일도 보내지 않아요",
    33	    "인증서 개인키·비밀번호는 수집하지 않아요",
    34	    "JSON 리포트는 Ryan이 직접 저장하고 공유해요"
    35	  ],
    36	
    37	  errorHeadline: "지금 진단을 마치지 못했어요",
    38	  errorRetryCta: "다시 시도",
    39	
    40	  windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
    41	  windowsOnlyBody:
    42	    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요."
    43	} as const;
---tests ipc---
     1	import { describe, it, expect } from "vitest";
     2	import { IpcChannels } from "../src/shared/ipc";
     3	
     4	describe("IpcChannels", () => {
     5	  it("contains all expected channels", () => {
     6	    expect(IpcChannels.scanStart).toBe("scan:start");
     7	    expect(IpcChannels.scanCancel).toBe("scan:cancel");
     8	    expect(IpcChannels.scanProgress).toBe("scan:progress");
     9	    expect(IpcChannels.scanComplete).toBe("scan:complete");
    10	    expect(IpcChannels.scanError).toBe("scan:error");
    11	    expect(IpcChannels.reportExport).toBe("report:export");
    12	    expect(IpcChannels.reportOpenWeb).toBe("report:open-web");
    13	    expect(IpcChannels.appVersion).toBe("app:version");
    14	  });
    15	
    16	  it("channel values are unique", () => {
    17	    const values = Object.values(IpcChannels);
    18	    expect(new Set(values).size).toBe(values.length);
    19	  });
    20	});

exec
/bin/zsh -lc "find src/renderer/src -type f -maxdepth 5 -print -exec sh -c 'echo --- "'$1; nl -ba "$1" | sed -n "1,300p"'"' _ {} \\;" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
src/renderer/src/App.tsx
--- src/renderer/src/App.tsx
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     6	
     7	type Phase =
     8	  | { kind: "home" }
     9	  | { kind: "scanning"; progress: ScanProgress }
    10	  | { kind: "report"; result: ScanResult }
    11	  | { kind: "error"; error: ScanError };
    12	
    13	const INITIAL_PROGRESS: ScanProgress = {
    14	  step: "준비",
    15	  doneSteps: 0,
    16	  totalSteps: 6,
    17	  score: 0,
    18	  elapsedMs: 0,
    19	  steps: [
    20	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    21	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    22	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    23	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    24	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    25	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    26	  ]
    27	};
    28	
    29	export function App() {
    30	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    31	  const [appVersion, setAppVersion] = useState<string>("");
    32	
    33	  useEffect(() => {
    34	    if (typeof window.fb?.appVersion === "function") {
    35	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    36	    }
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    if (!window.fb) return;
    41	    const offProgress = window.fb.onScanProgress((p) => {
    42	      setPhase((prev) =>
    43	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    44	      );
    45	    });
    46	    const offComplete = window.fb.onScanComplete((r) => {
    47	      setPhase({ kind: "report", result: r });
    48	    });
    49	    const offError = window.fb.onScanError((err) => {
    50	      setPhase({ kind: "error", error: err });
    51	    });
    52	    return () => {
    53	      offProgress();
    54	      offComplete();
    55	      offError();
    56	    };
    57	  }, []);
    58	
    59	  const startScan = useCallback(async () => {
    60	    if (!window.fb) {
    61	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    62	      return;
    63	    }
    64	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    65	    try {
    66	      await window.fb.startScan();
    67	    } catch {
    68	      // 에러는 onScanError 이벤트로 처리
    69	    }
    70	  }, []);
    71	
    72	  const cancelScan = useCallback(async () => {
    73	    if (!window.fb) return;
    74	    await window.fb.cancelScan();
    75	    setPhase({ kind: "home" });
    76	  }, []);
    77	
    78	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    79	
    80	  const content = useMemo(() => {
    81	    switch (phase.kind) {
    82	      case "home":
    83	        return <Home onStartScan={startScan} />;
    84	      case "scanning":
    85	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    86	      case "report":
    87	        return <Report result={phase.result} onBack={goHome} />;
    88	      case "error":
    89	        return (
    90	          <Scanning
    91	            progress={INITIAL_PROGRESS}
    92	            errorMessage={phase.error.message}
    93	            onCancel={goHome}
    94	            onRetry={startScan}
    95	          />
    96	        );
    97	    }
    98	  }, [phase, startScan, cancelScan, goHome]);
    99	
   100	  return (
   101	    <div className="fb-app">
   102	      {content}
   103	      <footer className="fb-app-footer">
   104	        <span>FormatBuddy Desktop</span>
   105	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   106	      </footer>
   107	    </div>
   108	  );
   109	}
src/renderer/src/main.tsx
--- src/renderer/src/main.tsx
     1	import { StrictMode } from "react";
     2	import { createRoot } from "react-dom/client";
     3	import { App } from "./App";
     4	import "./styles/globals.css";
     5	
     6	const rootEl = document.getElementById("root");
     7	if (!rootEl) throw new Error("Root element not found");
     8	
     9	createRoot(rootEl).render(
    10	  <StrictMode>
    11	    <App />
    12	  </StrictMode>
    13	);
src/renderer/src/styles/fonts/WantedSansVariable.ttf
--- src/renderer/src/styles/fonts/WantedSansVariable.ttf
     1	        GDEF,R$ )�  �GPOS0�� )��  �jGSUBcZ�` *W  LOS/2[f{	  �   `STAT�� *�   �cmapAv�S  ��  #�fvar��w� *��   jglyftD� �� %�egvar
     2	韑 *�0 �xheadE�t     6hhea*cR�  D   $hmtx~�<F  �  ��loca�]d�  ��  ��maxp5��  h    name�+%� '�  �post��i '�� �^     ��
     3	�f_<�      �
     4	@�    ���@��$��            ��  $��@�@$�               1w   1w �  �             ��   2�   �2�  � x@         �  CQ�       WNTD @  �����  ��  �    �     � �   � .� .� .� .� .� .� .� .� .� .� .� .� .� .� .� �� �� ^� ^� ^� ^� ^� ^z �z �z �� "z �z �� "� "| �| �| �| �| �| �| �| �| �| �| �| �| ^| �\ �b ^b ^b ^b ^b ^b ^b ^| �| �| �| �� �D �� ����������� v� v������������x ^x ^x ^� �� �� �� �L �L �L �L �L �L �L��L �x "� �� �� �� �� �� �� �� �� �� �� �� �� �� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^	| ^� �� �� ^� �� �� �� �� �� �� ^� ^� ^� ^� ^� ^� ^ V V V V V V Vl �l �l �l �l �l �l �l �l �l �l �l �l �� .� .D .D .D .D .D .D ., ., ., ., ., ., ., ., ., . l l l l l lD �x ^x ^x ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� �� ^� ^ l� ^� V� V� V� V� V� V� V� V� V� V� V� V� V� �� V� V� V� V� �^ T� �� �p Vp Vp Vp Vp Vp V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V N� V� V� V� V� V� V� V� VT �T��T �T��T �T �� j� �� ����������� j� j���������������� j������������� ����� �� �� &� �� �������� 8� j������ � �� �� �� �� �T �T �T �T �T �T �T �T �T �� V� V� V� V� V� V� V� V� V� Vp V� R� R� V T� �� �� V � � R 8 j�� R� V� V� V� V� V� V� V� �� F� � F� F� F� � F� FT �T �T �T �T �T �T �T �T �T �T �T �T �D &D &T &T &T &T &T &T &� &D &D &D &D &D &D &D &D &D &D & f f f f f fh j� h� �� ����� N�  � N�  � N� � N� 8P fP fP fP fP fP fP fP fP fP fP fP fP fP fP fP fP �h �h �h �h �h �h �h �h �h �h �h �h �h �� �� �� F� 6� ^���� R � ����� � ���   N� V� V� V� V� V� V� V� V� f� f� f� f� f� f� f� f� f� f� f� f� f� f� f� f� �� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� Vp VT �� V� V f� �� �� V� V� V� V� V� VT �T��T �T��T �T �� ����� �� �� �� �������� 6� h������ P f � ����� � ���  � f� 0� N� 0� 0� 0� ,� 0� N <� <� N" N( N� N� 0� N� 0� NT 0� ,� N� � � � � N� 0� N� 0� 0� 0� ,� 0� N <� <� N" N( N� N� 0� N� 0� NT 0� ,� N� � � � � N < <� ,� ,� 0� 0� N� N� N� N` N` N� ,� ,� 0� 0� 0� 0� 0� 0| N N0 N� N0 N� N� N� N0 N$ N N� N� N� N� N� N� N� N� N0 N$ N$ N$ N� N� N� N� N| N0 N0 N0 N0 N� N� N$ N$ N$ N� N� N� N0 N0 N$ N� N� N� 0� 0� ,� 0� 0� � � N < <� ,� ,� 0� 0� N� N� N� N` N` N� ,� ,� 0� 0� 0� 0� 0� 0� 0� 0 <� <� 0� N� N� � � N <� <" N� N� NT 0� � � � 0� 0� 0� 0�H� �� ��T� ��X��B��
     5	�
     6	���
     7	��P�R�$�$�� ��F�,� ���6�T�$�,���P���R�2���6��� L� Z� b� �� Z� X� |� p� �� L� L� |�2�  � T� F� F� F� J� F� H� H� L� L� L� L� L� L� L� L� H� L� L� L� J� J� L� L� F� P� L� L� J� R� T� X� R� X� X� X� X� X� X� X� X� X� X� Z� X� X� \� V� V� T� X� X� X� X� X� X� T� F� F� F� J� F� H� H� L� L� L� L� L� L� L� L� H� L� L� L� J� J� L� L� F� P� L� L� J� R� T� X� R� X� X� X� X� X� X� X� X� X� X� Z� X� X� \� V� V� T� X� X� X� X� X� X� H� ^� V� V� d� \� b� \� d� b� b� b� b� b� b� b� \� `� `� h� \� ^� f� f� \� b� b� ^� J� ^� `� `� T� ^� Z� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� Z� Z� X� Z� V� ^� V� ^� ^� ^� X� J� d� d� d� d� ^� f� b� f� f� f� f� f� f� f� f� ^� ^� ^� f� ^� `� ^� b� ^� ^� `� f� H� ^� ^� `� R� `� \� `� \� ^� ^� ^� ^� ^� ^� ^� `� X� X� V� `� ^� `� X� `� Z� `� Z� H� J� J� H� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� 6� <� <� <� <� <� >� <� >� >� >� >� >� >� >� >� <� <� <� <� <� <� <� <� <� >� <� >� 2� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� N� L� L� L� J� L� J� L� J� J� J� J� J� J� J� J� L� L� L� L� L� L� L� J� L� J� L� J� H� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� H� J� J� J� J� J� J� J� J� H� H� H� H� H� H� H� H� H� F� F� F� F� F� F� F� H� H� H� H� H� H� H� H� H� H� H� H� 8� 8� 8� 8� <� 8� >� 8� >� >� >� >� >� >� >� >� 8� 8� 8� 8� 8� <� 8� 8� 8� >� 8� >� 2� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� <� >� >� >� F� >� >� >� J� J� J� J� J� J� J� J� >� <� <� J� >� J� >� >� >� J� >� >� H� H� H� H� H� H� H� H� H� F� F� F� F� F� F� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� F� F� F� H� F� F� F� F� F� F� F� H� H� H� H� H� H� H� H� H� F� H� H� N� >� >� >� >� >� >� >� >� >� >� >� <� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� `� ^� ^� `� f� ^� ^� \� f� d� f� f� f� f� f� f� ^� d� d� h� ^� \� b� d� ^� d� h� f� B� R� R� >� P� >� @� >� R� J� T� J� J� J� J� J� T� V� F� V� X� T� T� P� T� R� T� V� L� L� N� N� P� N� P� R� R� N� N� N� N� N� N� N� R� T� L� V� V� V� R� T� L� N� L� X� B� R� >� >� V� >� @� >� R� H� H� H� H� H� H� H� >� H� H� V� >� T� T� P� >� H� >� V� D� J� J� J� P� J� L� J� J� J� J� J� J� J� J� J� J� L� L� V� J� V� R� T� J� J� J� X� B� P� P� F� \� F� D� F� Z� D� D� D� D� D� D� D� P� V� J� T� P� N� P� T� F� D� F� B� L� X� L� L� P� L� L� L� J� J� J� J� J� J� J� J� V� J� J� R� L� V� V� X� L� J� L� Z� 8� D� D� D� \� D� D� D� Z� N� L� L� N� P� N� F� D� ^� ^� T� P� N� P� @� D� V� D� B� L� L� L� L� N� L� L� L� L� L� L� L� L� L� L� L� V� V� L� R� L� V� V� X� L� L� L� Z� H� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� 6� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� <� N� N� N� N� N� N� F� N� F� F� F� F� F� F� F� F� N� N� N� N� N� N� N� N� N� F� N� N� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� F� H� H� 8� H� 8� H� H� H� 8� 8� 8� H� .� :� :� :� :� :� :� :� >� :� :� :� :� :� :� :� :� :� :� >� >� >� >� >� :� :� :� >� "� 4� :� :� 4� :� :� :� 4� J� J� J� J� J� J� J� 4� 4� J� H� 4� :� 4� 4� :� J� :� 4� 8� J� J� J� F� D� D� N� F� <� <� <� <� <� <� D� F� F� @� D� D� B� F� F� J� <� <� F� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� H� H� H� 8� 8� 8� H� H� H� 8� 8� H� 8� H� 8� H� 8� H� 8� 8� 8� 8� H� H� H� 8� H� 8� H� H� H� 8� H� 8� H� >� L� L� L� J� L� L� L� B� B� B� B� B� B� B� B� L� B� B� F� L� F� F� F� L� @� J� F� J� ^� N� N� f� N� P� J� \� Z� Z� Z� Z� X� X� Z� ^� b� X� ^� N� ^� b� d� N� Z� N� h� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� H� 8� 8� H� 8� 8� 8� F� 8� F� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� H� 8� 8� H� F� 2� B� B� B� <� B� B� B� @� B� B� B� B� B� B� B� B� B� B� <� B� <� B� B� B� B� B� B� 4� J� J� J� J� J� J� J� D� D� D� D� D� D� D� D� J� D� D� 2� 6� 2� 6� 6� J� D� J� 6� N� D� D� D� L� D� D� D� L� @� @� >� @� @� @� >� L� H� >� L� D� L� L� L� D� @� D� L� H� H� 8� 8� H� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� 8� H� :� H� 8� H� H� H� 8� 8� 8� F� H� H� 8� 8� H� 8� 8� H� F� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� F� 8� 8� 8� F� :� :� :� :� B� :� :� :� 8� 8� 8� 8� 8� 8� 8� 8� :� 8� 8� >� >� >� >� >� :� 8� :� >� 2� F� F� F� <� F� F� F� N� N� N� N� N� N� N� N� F� N� N� 8� 8� 8� 8� 8� F� N� F� 8� @� J� J� J� H� J� J� J� L� T� T� T� T� T� T� D� J� N� R� J� N� F� N� >� J� T� J� >� H� H� 8� 8� 8� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� H� 8� 8� 8� H� H� H� 8� 8� F� 8� 8� 8� F� F� F� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� H� 8� 8� H� F� N� P� P� P� L� P� P� P� N� F� F� F� F� F� F� F� P� F� F� L� P� L� L� L� L� F� P� L� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� H� 8� 8� H� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� H� H� 8� H� 8� H� H� J� 8� H� 8� J� 2� B� B� B� >� B� B� B� @� B� B� B� B� B� B� B� B� B� B� <� B� <� <� <� B� B� B� <� 4� J� J� J� L� J� J� J� D� D� D� D� D� D� D� D� J� D� D� >� >� >� >� >� J� D� J� >� R� D� D� D� P� D� D� D� R� F� F� F� F� F� F� F� T� N� F� P� T� P� T� N� D� F� D� N� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� H� H� J� 8� 8� 8� J� F� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� F� 8� 8� 8� F� @� 8� 8� 8� @� 8� 8� 8� 6� 6� 6� 6� 6� 6� 6� 6� 8� 6� 6� >� >� >� >� >� 8� 6� 8� >� 0� F� F� F� <� F� F� F� N� N� N� N� N� N� N� N� F� P� N� >� F� >� 8� 8� F� N� F� 8� @� N� N� N� J� T� F� T� N� T� T� T� T� T� T� F� T� N� F� N� F� N� N� N� N� T� N� N� F� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� H� 8� H� H� H� 8� 8� 8� H� H� H� 8� 8� H� 8� 8� H� H� 8� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� J� 8� 8� 8� J� N� P� P� P� @� P� P� P� D� D� D� D� D� D� D� D� P� D� D� L� P� L� L� L� P� D� P� L� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� ~� �� r� r� �� r� t� r� �� r� r� r� r� r� r� r� �� �� p� �� �� �� r� r� r� r� r� �� ~� ~� n� n� ~� n� n� n� ~� r� r� r� r� r� r� r� ~� ~� r� ~� ~� ~� n� r� n� r� n� r� r� r� r� r� p� r� t� r� r� r� r� r� r� r� r� r� r� p� p� �� r� r� r� r� r� r� r� r� j� n� n� n� f� n� n� n� r� r� r� r� r� r� r� r� n� r� r� n� n� n� n� r� n� r� n� r� ~� x� ^� ^� x� ^� ^� ^� x� ^� x� x� ^� ^� ^� ^� x� x� ^� x� x� x� ^� ^� ^� ^� ^� x� ~� ~� r� r� ~� r� r� r� ~� r� r� r� r� r� r� r� ~� ~� r� ~� ~� ~� r� r� r� r� r� r� �� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� x� ^� ^� ^� ^� ^� ^� ^� j� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� r� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 2� B� B� @� @� B� B� B� 4� B� B� B� B� B� B� B� @� B� B� 4� B� 4� 4� 4� B� B� B� 4� 6� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� D� D� D� D� D� F� F� F� D� L� @� @� @� H� @� @� @� D� D� D� D� D� D� D� D� @� D� D� @� @� @� @� @� @� D� @� @� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� F� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� F� H� F� 8� 8� 8� F� >� :� :� :� :� :� :� :� 8� 8� 8� 8� 8� 8� 8� 8� :� 8� 8� 8� :� 8� :� :� :� 8� :� :� ,� :� :� :� 6� :� :� :� J� J� J� J� J� J� J� J� :� J� J� B� :� :� :� :� :� J� :� :� :� 8� 8� 4� J� .� .� 8� P� 6� 6� 6� 6� 6� 6� 6� P� P� 6� .� .� P� 8� B� 8� 6� 8� B� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� H� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� 8� H� 8� 8� 8� 8� 8� L� J� J� J� H� J� J� J� J� B� B� B� B� B� B� B� P� P� B� P� J� J� @� B� J� B� J� B� �� |� |� |� �� |� |� |� �� |� |� |� |� |� |� |� �� �� |� �� |� �� |� |� |� |� |� |� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� |� |� �� |� |� |� �� |� |� |� |� |� |� |� �� �� |� �� �� �� |� |� |� |� |� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� |� |� �� |� |� |� �� |� |� |� |� |� |� |� �� �� |� �� �� �� ~� |� |� |� |� |� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� F� 8� 8� F� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� F� F� 8� F� 8� F� F� 8� 8� 8� 8� 8� 6� B� B� B� >� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� >� B� B� B� B� B� B� 4� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� 8� J� J� J� J� J� J� J� R� B� B� B� N� B� B� B� R� J� J� J� J� J� J� J� P� P� J� P� B� P� B� J� B� J� B� J� H� :� :� :� F� :� 8� :� F� 8� :� :� :� 8� :� 8� :� F� 8� F� :� F� F� 8� :� :� :� 8� F� F� 8� 8� H� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� F� F� 8� F� 8� F� 8� 8� 8� 8� 8� 8� B� :� :� :� B� :� :� :� 8� 8� 8� 8� 8� 8� 8� 8� :� 8� 8� :� D� :� :� 8� :� 8� :� 8� (� D� D� F� N� F� F� F� N� N� N� N� N� N� N� N� D� N� N� F� F� D� D� N� D� N� D� N� @� >� D� D� @� B� F� D� H� B� B� B� B� B� B� D� >� B� D� >� D� >� B� D� <� B� <� D� F� F� :� 8� H� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� F� F� 8� F� 8� F� 8� 8� 8� 8� 8� 8� H� F� 8� 8� F� 8� 8� 8� F� 8� 8� 8� 8� 8� 8� 8� F� F� 8� F� 8� F� F� 8� 8� F� F� 8� 0� P� P� P� P� P� P� P� F� F� F� F� F� F� F� F� P� F� F� P� P� P� B� J� P� F� P� J� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� H� 8� H� H� 8� 8� 8� H� 8� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� 8� 2� @� @� @� F� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� D� D� <� <� @� @� @� <� (� L� L� L� T� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� >� >� >� L� L� L� >� R� <� <� <� P� <� <� <� R� H� H� H� H� H� H� H� <� R� H� T� <� T� <� <� <� H� <� <� H� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� F� H� H� 8� F� 8� 8� H� H� H� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� H� 8� H� @� 8� 8� 8� >� 8� 8� 8� B� 8� 8� 8� 8� 8� 8� 8� 8� >� 8� >� 8� 8� >� 8� 8� 8� 8� 8� 0� F� F� F� <� <� F� F� N� N� N� N� N� N� N� N� D� N� N� >� F� N� F� N� F� N� F� N� D� D� D� D� J� D� D� D� N� T� T� T� T� T� T� D� D� T� T� D� D� D� D� D� D� T� D� <� F� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� 0� P� P� P� @� P� P� P� F� F� F� F� F� F� F� F� P� F� F� P� P� P� <� <� P� F� P� <� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� H� H� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� 8� 2� B� B� B� F� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� D� B� <� <� B� B� B� <� 4� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� >� >� >� >� J� J� J� >� R� T� F� F� P� F� D� F� R� J� J� J� J� J� J� J� T� T� H� F� F� F� <� <� F� J� F� <� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� F� H� 8� 8� F� 8� 8� H� H� H� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� H� H� 8� @� 8� 8� 8� @� 8� 8� 8� B� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� D� 8� >� 8� 8� 8� 8� 8� 0� F� F� F� <� F� F� F� D� D� D� D� D� D� D� D� F� D� D� >� F� N� F� N� F� D� F� N� D� H� J� L� J� J� D� L� N� T� T� T� T� T� T� D� J� D� D� D� D� N� J� D� H� T� J� <� F� 8� 8� 8� F� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� :� H� 8� 8� H� 8� H� 8� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� 0� P� P� P� P� P� P� P� J� J� F� D� J� J� J� J� P� H� J� P� P� P� <� <� P� J� P� <� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� j� z� ^� ^� z� ^� b� ^� z� b� z� b� b� b� b� b� z� z� ^� z� z� z� ^� b� ^� b� ^� z� j� l� ^� ^� l� ^� ^� ^� l� ^� ^� ^� ^� ^� ^� ^� l� l� ^� l� l� l� ^� ^� ^� ^� ^� ^� j� z� ^� ^� ^� ^� b� ^� b� b� b� b� b� b� b� b� z� ^� ^� ^� ^� ^� ^� b� ^� b� ^� b� T� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� r� v� f� f� v� f� f� v� v� P� P� P� P� P� P� P� v� P� P� v� v� v� f� P� f� P� f� P� j� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� l� ^� ^� ^� ^� ^� ^� r� v� f� f� h� f� f� f� P� P� P� P� P� P� P� P� v� v� P� v� v� v� f� P� f� P� f� P� T� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� ^� l� ^� ^� ^� ^� ^� ^� H� H� 8� 8� F� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� >� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� 4� F� F� F� :� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� F� @� @� @� F� F� F� @� J� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� @� @� :� :� :� @� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� F� H� 8� 8� F� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� H� 8� H� 8� 8� 8� 8� 8� 8� >� :� :� :� <� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� 8� D� D� D� 8� F� D� D� B� B� B� B� B� B� B� B� D� B� B� D� D� D� D� B� D� B� D� B� .� @� @� @� @� @� B� @� @� @� @� @� @� @� @� B� @� B� B� B� @� @� 2� B� @� @� @� B� F� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� F� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� ,� >� >� >� L� J� J� J� B� B� B� B� B� B� B� B� >� B� B� >� >� >� @� @� >� B� >� @� �� �� h� h� �� h� h� h� �� h� h� h� h� h� h� h� �� �� h� �� h� �� h� h� h� h� h� h� 0� D� D� D� B� 4� 6� B� >� <� >� 2� 6� 4� 4� 4� B� B� 4� D� >� @� 4� 2� 4� @� 4� 2� 4� J� F� F� L� F� F� F� J� F� F� F� F� F� F� F� J� J� F� J� J� J� F� F� F� F� F� F� .� D� 4� 4� B� 4� 6� 4� >� <� >� 4� 4� 4� 4� 4� B� B� 4� D� 4� @� 4� 2� 4� 4� 4� 2� 4� F� F� F� L� F� F� F� J� D� D� F� F� F� F� F� J� J� F� F� F� J� F� F� F� F� F� F� H� L� J� H� J� 2� 2� J� H� 8� H� H� 8� 8� 8� 8� H� J� 8� L� H� F� 2� 8� 2� 8� H� .� 4� L� F� F� N� F� F� F� J� J� J� J� J� J� J� J� J� J� L� J� J� J� F� J� F� J� F� J� H� L� 4� 4� L� 4� 4� 4� J� 2� 2� 2� 2� 2� 2� 2� H� J� 2� P� L� L� 4� 2� 4� 2� 4� 0� 2� F� F� F� N� F� F� F� J� L� L� L� L� L� L� L� F� L� L� F� J� L� F� L� F� L� F� L� H� H� H� 8� H� 8� 8� 8� H� 8� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� H� 8� 8� 2� F� B� B� F� B� B� B� F� B� B� B� B� B� B� B� B� B� B� B� B� D� <� <� B� B� B� <� 4� L� L� L� >� L� L� L� 8� L� L� L� L� L� L� L� >� L� L� >� >� >� >� >� L� L� L� >� R� F� F� F� P� F� F� F� R� J� J� J� J� J� J� J� R� R� J� R� F� F� <� <� F� J� F� <� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� 8� H� H� 8� 8� F� 8� 8� H� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� H� 8� H� H� 8� @� 8� 8� 8� B� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� >� :� >� 8� 8� 8� 8� 8� 2� >� H� H� >� H� H� H� >� N� N� N� N� N� N� N� >� N� N� >� H� >� F� N� H� N� H� N� D� J� L� L� J� :� :� J� J� T� T� T� V� T� V� D� J� J� R� N� L� J� L� D� J� T� J� D� F� H� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� H� 8� H� 8� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� 8� H� H� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� 8� 0� P� P� P� B� P� P� P� J� J� J� J� J� J� J� J� P� J� J� P� P� P� <� <� P� J� P� <� >� Z� D� D� \� D� D� V� V� >� >� >� >� >� >� R� V� T� @� X� D� Z� D� N� D� >� T� N� .� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� 8� :� $� (� � � (� � � � (� � � � � � � � (� (� � � (� (� � � � � � � .�  �  �  � <�  �  �  � "� "� "� "� "� "� "� "�  � $� $�  �  � :�  � :�  � "�  � :� $� (� � � (� � � � (� � � � � � � � (� (� � � (� (� � � � � � � .� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� "� :� :� 8� "� $� (� � � (� � � � (� � � � � � � � (� (� � � (� (� � � � � � � .� .� .� .� .� .� .� .� 4� 4� 4� 4� 4� 4� 4� � .� 0� 0� .� .� .� .� 0� .� 0� .� 4� � � � � (� � � � (� � � � � � � � � � � � � � � � � � � � H� H� H� H� H� F� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� *� @� @� @� @� @� @� @� @� ,� ,� ,� ,� ,� ,� ,� @� 2� ,� @� @� @� 4� 4� @� ,� @� 4� "� 4� 4� 4� 4� 4� 4� 4� *� *� *� *� *� *� *� *� 4� *� (� 4� 6� 4� 4� *� 4� *� 4� *� D� F� F� F� B� F� F� F� B� J� J� J� J� J� J� J� B� B� L� J� 4� F� F� J� F� J� F� J� H� :� :� H� H� H� H� F� F� F� F� F� F� F� F� F� F� F� F� H� H� F� H� F� H� F� H� F� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� <� >� >� >� B� >� >� >� 8� 8� 8� 8� 8� 8� 8� 8� >� 8� 8� :� >� >� >� 8� >� 8� >� 8� ,� >� 6� 6� :� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� <� >� >� >� B� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� B� >� >� >� B� b� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� F� H� D� @� J� F� B� F� F� F� B� J� J� J� L� J� J� J� B� J� L� F� F� F� F� J� F� J� F� J� 2� :� 6� 6� :� 6� 6� 6� :� 2� 2� 2� 2� 2� 2� 2� :� :� 2� :� 6� :� 6� 2� 6� 2� 6� 2� d� j� j� j� j� j� j� j� j� j� j� j� j� j� j� j� j� l� j� j� j� j� j� j� j� l� j� j� ^� Z� ^� ^� Z� ^� ^� ^� Z� X� X� X� X� X� X� X� Z� Z� X� Z� Z� Z� ^� X� ^� X� ^� X� d� j� j� h� j� j� j� j� j� d� d� j� d� d� d� d� j� l� d� j� j� j� j� d� j� l� j� j� ^� ^� ^� ^� Z� ^� ^� ^� Z� Z� Z� Z� Z� Z� Z� Z� ^� Z� Z� ^� ^� ^� ^� Z� ^� Z� ^� Z� h� d� T� T� d� d� \� d� d� d� d� Z� Z� Z� Z� Z� d� d� d� d� f� d� d� Z� d� R� d� Z� ^� Z� X� X� Z� X� X� X� Z� X� X� X� X� X� X� X� Z� Z� X� Z� Z� Z� X� X� X� X� X� X� h� d� d� T� d� T� T� T� d� T� d� d� T� T� T� T� d� d� d� d� f� d� d� Z� T� R� d� d� ^� X� X� X� Z� X� X� X� Z� V� V� V� V� V� V� V� Z� Z� V� Z� Z� X� X� V� X� V� X� V� H� H� 8� 8� H� 8� 8� 8� H� H� H� 8� H� 8� 8� H� H� H� 8� H� 8� H� F� J� 8� 8� 8� 8� 2� F� B� B� F� B� B� B� F� B� B� B� B� B� B� B� F� F� B� F� F� F� <� <� B� B� B� <� 2� >� J� J� >� J� L� J� J� J� J� J� J� J� J� J� >� J� J� >� J� >� >� >� J� J� J� 8� R� P� F� F� P� F� F� F� P� >� >� >� >� >� >� >� P� R� >� T� F� T� <� <� F� >� F� <� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� F� J� 8� 8� 8� 8� F� H� 8� 8� F� 8� 8� 8� H� H� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� H� 8� 8� 8� 8� 8� @� >� 8� 8� >� 8� 8� 8� B� 8� 8� 8� 8� 8� 8� 8� >� >� 8� 8� >� >� >� 8� 8� 8� 8� 8� 0� >� N� N� >� N� N� N� >� N� N� N� N� N� N� N� >� >� N� N� N� >� F� N� N� N� F� N� D� J� J� L� J� J� D� J� N� T� T� T� V� V� V� D� N� N� R� N� L� P� D� D� L� T� J� <� F� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� H� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� H� 8� H� H� 8� H� 8� H� H� J� H� H� H� F� R� P� P� P� P� P� P� P� P� F� F� F� F� F� F� F� P� F� F� T� P� P� <� <� P� F� P� <� �� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� p� ,� B� .� .� D� .� >� @� 8� :� <� :� :� :� :� :� @� >� 6� B� @� B� @� :� .� :� .� :� 6� N� N� N� N� N� N� N� P� N� N� N� N� N� N� N� P� P� N� P� P� P� N� N� N� N� N� N� ,� B� .� .� D� .� >� @� 8� :� :� :� :� :� :� :� @� 6� 6� .� .� B� @� :� .� :� .� :� 6� N� N� N� N� N� N� N� P� N� N� N� N� N� N� N� N� N� N� N� N� P� N� N� N� N� N� N� :� N� 6� 6� N� 6� 8� 6� P� 6� P� 6� 6� 6� 6� 6� N� N� 4� P� 6� P� N� 6� 6� 6� 6� 6� 4� P� L� L� P� L� L� L� R� L� L� L� L� L� L� L� P� P� L� R� L� R� L� L� L� L� L� L� <� 6� 6� 6� P� 6� 8� 6� P� P� P� P� P� P� P� P� 6� P� P� 6� P� P� B� P� 6� 6� 6� P� 4� N� L� L� P� L� P� L� N� N� N� N� N� N� N� N� L� L� L� N� L� L� L� N� L� N� L� N� H� H� 8� 8� H� 8� 8� 8� H� :� H� :� :� :� :� 8� H� H� 8� H� 8� H� H� J� 8� 8� 8� F� 2� F� B� B� B� B� B� B� F� B� B� B� B� B� B� B� B� F� B� F� B� F� <� <� B� B� B� <� 2� L� L� L� N� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� >� >� >� >� L� L� L� >� R� F� F� F� P� F� F� F� R� J� J� J� J� J� J� J� R� R� J� R� F� T� <� <� F� J� F� <� H� H� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� H� H� 8� 8� F� 8� 8� 8� H� H� H� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� 8� @� 8� 8� 8� @� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� >� 8� >� 8� 8� 8� 8� 8� 0� H� H� H� <� H� H� H� N� N� N� N� N� N� N� N� H� N� N� >� H� N� F� N� H� N� H� N� D� J� J� J� J� J� F� J� J� T� T� T� T� T� V� D� J� J� R� J� F� F� J� D� J� V� J� <� H� 8� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� 8� 8� 8� 8� 8� 8� 8� H� H� 8� 8� H� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� 8� H� H� 8� H� 8� H� 8� 8� 8� 8� 8� :� 0� P� P� P� @� P� P� P� J� J� J� J� J� J� J� J� P� J� J� P� P� P� <� <� P� J� P� <� H� b� @� @� b� >� B� b� b� J� b� J� J� J� J� J� b� `� F� d� >� d� b� J� @� ^� b� J� 0� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� &� &� (� (� &� (� (� (� (� &� &� &� &� &� &� &� &� &� &� &� &� &� (� &� (� &� (� &� 0� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� &� &� (� (� &� (� (� (� &� &� &� &� &� &� &� &� (� (� &� &� (� (� (� &� (� &� (� &� :� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� &� (� (� (� (� (� (� (� (� (� (� (� (� (� (� (� (� (� (� (� *� (� (� (� (� (� (� (� :� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� &� (� (� (� (� (� (� (� (� (� *� *� *� *� *� *� (� (� (� (� (� (� (� *� (� (� (� *� H� H� H� H� H� H� H� H� H� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� *� @� @� @� F� D� D� @� @� @� @� @� @� @� @� @� @� D� D� @� @� D� @� @� @� @� @� @� "� 8� 8� 8� .� 8� 8� 8� 4� 4� 4� 4� 4� 4� 4� 4� 8� 4� 4� 8� 4� 8� 8� 4� 8� 4� 6� 4� F� F� F� F� J� F� F� F� H� J� J� J� J� J� J� J� F� F� J� J� F� F� F� J� F� J� F� J� H� H� H� H� :� H� H� H� F� F� H� H� H� H� H� H� H� F� H� H� H� H� H� H� H� H� H� H� F� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� <� 8� 8� 8� 4� 8� 8� 8� 4� 4� 4� 4� 4� 4� 4� 4� 8� <� :� 6� >� >� 8� 4� 8� 4� 8� 4� � (� (� (� ,� (� (� (� 6� 6� 6� 6� 6� 6� 6� 6� (� ,� ,� ,� (� (� (� 6� (� 6� (� 6� <� "� "� "� J� "� "� "� .� .� .� .� .� .� .� .� "� .� .� "� "� "� "� B� "� .� "� B� H� H� H� H� H� 8� 8� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� 8� 8� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� D� F� F� F� J� F� F� F� J� J� J� J� J� J� J� J� F� F� J� J� F� F� F� J� F� J� F� J� >� >� <� <� >� <� <� <� @� >� >� >� >� >� >� >� >� >� >� <� <� >� >� >� <� >� <� @� 8� L� L� L� L� J� D� J� D� D� D� D� D� D� D� D� J� H� H� L� J� L� J� B� J� D� J� D� 8� V� V� T� Z� V� V� V� R� R� R� R� R� R� R� R� V� T� P� X� V� V� T� R� T� R� V� P� 8� L� L� L� L� J� D� J� D� D� D� D� D� D� D� D� J� H� H� L� J� L� J� B� J� D� J� D� 8� V� V� V� Z� V� V� V� R� R� R� R� R� R� R� R� V� T� P� V� V� V� T� R� T� R� V� P� L� N� N� J� N� P� J� J� D� D� D� D� D� D� D� D� J� H� H� N� J� N� N� D� N� D� N� B� :� V� V� V� Z� V� V� V� R� R� R� R� R� R� R� R� V� V� V� X� V� V� V� R� V� R� V� R� L� N� N� N� N� P� P� |� L� L� L� L� L� L� L� L� N� H� H� P� L� P� N� B� N� L� H� L� 8� R� R� R� R� R� R� V� N� N� N� N� N� N� N� N� V� V� R� V� V� V� V� N� V� N� V� N� H� H� H� H� H� H� H� H� J� J� J� J� J� J� J� J� H� H� J� H� H� H� H� J� H� J� H� J� 4� F� F� F� F� F� F� F� F� B� B� B� B� B� B� B� F� B� B� F� F� F� F� B� F� B� F� B� 4� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� L� J� L� L� L� J� R� L� L� L� P� L� L� L� R� R� R� R� R� R� R� R� R� R� R� R� L� T� L� R� L� R� L� R� H� H� H� H� H� H� H� H� J� J� J� J� J� J� J� J� H� H� J� H� H� H� H� J� H� J� H� J� H� H� J� J� F� J� J� J� J� J� J� J� J� J� J� J� H� H� J� H� J� H� H� J� J� J� J� J� @� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� <� >� >� >� >� >� >� >� ,� @� @� @� 8� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� N� @� @� @� N� D� >� >� >� J� >� >� >� J� >� >� >� >� >� >� >� J� J� >� J� >� J� >� >� >� >� >� >� H� J� J� J� H� J� J� J� J� J� J� J� J� J� J� J� H� J� J� J� J� H� H� J� J� J� J� J� H� H� H� H� F� H� H� H� J� J� J� J� J� J� J� J� H� H� J� H� H� H� H� J� H� J� H� J� N� L� L� L� R� L� L� L� R� R� R� R� R� R� R� R� L� L� R� P� L� T� L� R� L� R� L� R� j� l� j� j� n� j� j� j� j� j� j� j� j� j� j� j� j� j� j� l� j� l� j� j� j� j� j� h� Z� ^� P� P� ^� P� P� P� ^� P� P� P� P� P� P� P� ^� ^� P� ^� P� ^� P� P� P� P� P� P� R� X� X� X� X� X� X� X� X� X� X� X� X� X� X� X� X� X� V� X� X� X� X� X� X� X� X� X� Z� ^� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� ^� P� P� P� P� P� P� N� V� V� V� V� V� V� V� X� X� X� X� X� X� X� X� V� V� X� V� V� X� V� X� V� X� V� X� J� p� X� X� p� X� X� p� t� R� R� R� R� R� R� R� p� p� R� p� p� p� X� R� X� R� X� R� P� X� \� \� X� V� \� \� X� V� V� V� V� V� V� V� X� X� \� X� \� X� \� V� \� V� \� V� J� \� \� \� p� \� \� \� t� ^� ^� ^� ^� ^� ^� ^� p� p� ^� p� p� p� \� ^� \� ^� \� ^� P� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� V� X� \� V� V� V� V� V� H� J� 8� 8� J� 8� 8� 8� J� :� :� :� :� :� :� :� J� J� 8� J� 8� J� 8� 8� 8� :� 8� 8� 6� <� B� B� <� B� B� B� >� B� B� B� B� B� B� B� <� B� B� B� B� <� <� <� B� B� B� <� 2� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� B� J� B� 6� B� >� B� L� B� >� N� D� D� D� D� D� D� D� J� D� D� D� D� D� D� D� D� D� D� B� D� D� D� <� D� D� D� <� H� :� :� :� :� :� :� 8� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� :� H� H� :� :� H� :� :� 8� J� 8� 8� :� 8� 8� 8� 8� H� D� :� H� :� H� :� 8� :� :� 8� :� 8� 8� 8� 8� >� 8� 8� 8� B� :� :� :� :� :� :� :� 8� :� :� 8� 8� B� 8� 8� 8� :� 8� 8� 2� >� >� >� N� >� >� >� N� N� N� N� N� N� N� N� >� N� N� >� >� 8� >� N� >� N� >� N� <� <� F� F� F� H� <� F� J� V� T� V� T� T� V� V� >� J� D� N� F� N� F� D� 8� V� F� <� H� 8� 8� 8� H� 8� 8� 8� J� 8� :� 8� :� 8� :� 8� H� 8� :� 8� 8� 8� 8� 8� 8� :� 8� 8� H� H� 8� 8� H� 8� 8� 8� J� 8� 8� 8� 8� 8� F� 8� H� D� 8� 8� 8� H� 8� 8� 8� 8� 8� 8� <� P� P� P� P� P� P� P� R� R� P� P� R� R� R� R� P� P� P� P� P� P� D� <� P� R� P� <� l� p� D� D� p� D� `� D� r� B� B� B� B� B� B� B� p� p� ^� p� D� p� D� B� D� B� `� B� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� H� F� 8� 8� F� 8� 8� 8� J� 8� 8� 8� 8� 8� 8� 8� F� H� 8� F� 8� F� F� 8� 8� 8� F� 8� 4� @� @� @� F� @� @� @� B� B� B� B� B� B� B� B� @� B� B� @� @� @� B� B� @� B� @� B� 2� J� J� J� L� J� L� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� R� F� F� F� P� F� D� F� H� H� H� H� H� H� H� H� F� H� H� R� F� P� B� J� F� H� F� J� H� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� 8� F� 8� 8� 8� 8� 8� F� H� 8� 8� F� 8� 8� 8� J� 8� 8� 8� 8� 8� 8� 8� F� H� 8� F� 8� F� F� 8� 8� :� 8� 8� B� :� :� :� B� :� :� :� 8� 8� 8� 8� 8� 8� 8� 8� :� 8� 8� :� >� 8� :� 8� :� 8� :� 8� (� H� H� H� <� H� H� H� P� P� P� P� P� P� P� P� H� P� P� F� H� D� D� N� H� P� H� N� @� >� B� B� @� B� >� B� H� @� @� B� @� B� @� @� >� >� >� D� D� >� B� D� <� B� >� D� F� 8� 8� 8� F� 8� 8� 8� J� 8� 8� 8� 8� 8� 8� 8� F� 8� 8� 8� 8� F� F� 8� 8� 8� 8� 8� H� F� 8� 8� F� 8� 8� F� J� 8� J� 8� 8� 8� 8� ^� F� H� 8� F� 8� 8� F� 8� 8� 8� 8� 8� R� N� N� N� P� N� P� N� B� F� F� F� F� F� F� F� >� >� F� N� N� N� B� J� N� F� P� J� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� �� 2� N� N� B� N� B� B� D� N� D� N� D� D� D� D� D� N� N� B� N� N� N� B� D� B� N� D� D� 4� B� D� D� B� D� D� D� B� B� D� D� D� D� D� D� B� B� D� B� B� B� D� D� D� D� D� D� 2� N� H� H� F� N� N� F� D� D� D� D� D� D� D� D� H� D� D� H� H� B� F� D� H� D� F� D� 6� D� D� D� D� D� D� D� D� B� D� D� D� D� D� D� B� B� B� D� D� D� D� D� D� B� D� D� :� N� <� <� N� <� <� <� N� J� J� J� J� J� J� J� N� N� B� N� N� N� <� J� >� J� <� J� 4� B� @� @� B� @� @� @� B� 6� 6� 6� 6� 6� 6� 6� B� B� D� B� B� B� @� 6� @� 6� @� 6� :� <� <� <� N� <� <� <� N� H� H� H� H� H� H� H� N� N� F� L� N� N� <� H� 4� H� <� H� 4� D� D� D� B� D� D� D� B� D� D� D� D� D� D� D� D� B� B� B� D� D� D� D� D� D� D� D� H� H� :� :� H� :� :� :� H� :� :� :� :� :� :� :� H� H� :� H� :� H� :� :� :� :� :� :� 4� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� D� <� <� D� D� D� <� 4� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� >� >� J� J� J� >� R� D� D� D� P� D� D� D� J� J� J� J� J� J� J� J� D� J� J� D� D� D� <� <� D� J� D� <� H� <� <� <� H� <� <� <� H� :� :� :� :� :� :� :� <� H� :� H� <� <� <� :� <� :� <� :� F� H� :� :� F� >� >� H� H� <� H� <� <� <� <� <� H� H� <� H� >� H� <� <� >� <� <� <� B� >� >� >� D� >� >� >� <� <� <� <� <� <� <� <� >� <� <� >� >� >� >� 8� >� <� >� 8� 8� H� H� H� <� H� H� H� P� P� P� P� P� P� P� P� H� P� P� >� H� N� N� P� H� P� H� N� D� N� N� N� @� N� N� N� H� V� V� V� V� V� V� V� >� T� V� >� N� N� N� D� N� V� N� <� F� >� <� <� F� <� <� <� H� F� :� <� :� <� <� <� H� 8� :� H� <� H� <� <� <� :� <� <� H� <� <� <� H� <� <� <� H� <� <� <� <� <� <� <� H� H� <� H� <� <� <� <� <� <� <� <� .� D� D� D� P� D� D� D� H� J� J� J� J� J� J� J� D� J� J� D� D� D� <� <� D� J� D� <� F� f� R� R� f� R� R� R� f� T� T� T� T� T� R� R� f� f� R� f� R� f� R� R� R� T� R� R� >� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� D� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� N� D� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� F� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� D� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� F� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� J� D� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� 2� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� @� B� @� @� @� @� 6� >� B� B� >� B� B� B� B� B� B� B� B� B� B� B� B� B� B� >� B� >� B� J� B� B� B� J� R� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� B� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� *� 0� 6� 6� 0� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 6� 0� 6� 6� 6� 6� 6� 6� F� >� >� >� >� >� >� >� N� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� >� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� F� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� H� R� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� P� p� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� b� t� N� N" N( N� N� NT 0� ,� 0� N� 0� 0� 0� ,� 0� N( N� 0� N� ,� N� � N  hp x� �� h  `� h� h� x� h� h  hV ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V �V �V �V �V �V �V �V �V �V �V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^p x� �� h  `� f� f� x� \� �V �V �V �V �V �V �V �V �V �V �  h @  �  |  `  |  |  �  |  |V �V �V �V �V �V �V �V �V �V �V ^V ^� �V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V �V �V �V �V �V �V �V �V �V � @  �  |  `  �  �  �  v  �  hV ^V ^V �V ^V ^V �  �� .� 8r :� ,� 0� .� .\ 8� .� .� .� 8r :� ,� 0� .� .\ 8� .� . �VP 4� 4( ,d 4 , .� 8� 8� 8P 4� 4d 4r :r :P 4� .� .( . .� 0� 0� 4( ,p .p .p .p .\ 8\ 8� 8r .r .P 4� �� �@ �p �T �� .� .P 4� 4P 4� �� �@ �p �T �@ �( .p �@ �@ �p �@ �� .� 8r :� ,� 0� .� .\ 8� .� .� .� 8r :� ,� 0� .� .\ 8� .� .� 8� 8r :r :� .� .� 0� 0p .p .p .p .\ 8\ 8r .r .� �� �� .� .� �� �      �     V        �  &      �    �  6  �  6� �X �X �$ ^$ ^  �p �  V� Vp x  V�  � �X  X  p   V� �� �� �  �$ ^  �p �p xX  X  p 4 ^4 ^  �$ ^  �p �p xX  X  p   �4 ^4 ^p x       �     �  �        p x   �     �  �     p x   �     �  �     � �� .� $� $� �� $� $� $� �� .� �� $� $� $� �� $p �p $� �� .� $� $� �� $� �� .� $� $� �� $� > > > >� >� >h hh h� h� h� �� �h hh h� h� hh hh h� h� h��� � � � � �� �� �V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V � ^� ^� �� FV ^ ^  ,  `� > >� �� �  H  H� `| `V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V �V ^V � ^� �� �V ^V �V ^V �V ^V � ^� �� �V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V ^V �V �V �V ^V �V �V ^V ^V ^V �V ^V ^p V  �d X� ^� Xp R .  x  x  �  x  x  x  �  �  �  p  p  x  �� �� ^ ^P ^  x  x  �  x  x  �  �  �  p  p  x  x  x  �  x  x  �  �  �  p  p  x � � 
     8	 � � �  �  � V ^V ^p �V �V �V �p �p �V ^V �  ��  ��  ��  ��  �   |  ��  ��  ��  �8  ��  ��  �@  ��  �J  ��  ��  ��  ��  �\  �^  �B  �L  ��  ��  ��  ��  ��  ��  ��  �L  ��  � �  � �   �  �  � 8  �  � B L �  �� 0$� ��� (
     9	.  �
    10	 b � �
    11	 ` � f
    12	 � � �
    13	 V  f
    14	    � �
    15	 X 
    16	 �
    17	 b � �
    18	 ` � h
    19	 � � &
    20	 �  
    21	 � P *
    22	  �  � *
    23	  �  � F
    24	 � p *
    25	  �  � *
    26	  �  � �
    27	 X 
    28	 �
    29	 X 
    30	  �
    31	  �  �  �
    32	  �  �  
    33	  �  �  
    34	  �  �p Vd X� ^         $     �     $  
    35	  � �  $   $ / 9 ~%+7>HMe~��������)37ERTYahoy���������(15CIMPRX[e���!%+K_cq�������������       # & 3 ; D N Q ` q y  � � � � � �!!	!"!^!�""H"`$h$�$�$�$�%�%�%�%�&&a&e&�'''~'�'�,|.;0 001d2ף�����     0 : �'.9ALPh��������'27EPTXahoy��������� 
    36	#,5CGMORV[b��� $*4\bl�������������          % / 9 B N Q ` p t  � � � � � �!!	!"![!�""H"`$`$�$�$�$�%�%�%�%�&&a&e&�'''v'�'�,|.:0 00112� � ����  .}                    ������.�  �    ��      ���S  ��  ��������  ���    .o.]          -�-�-�-�-�-�-�[  WVURP  �                                              ��                  loJ  �4�  idB�  ��h
    37	m��	�	�W*%
    38		�	�	�		CM/�-  ��  ��ь�yV�  0� $  @������� *        N  Z`  `fj    h  j        d    df    dnrz~                r          l      lntvxz|����������������    �����                                                                        �  �        �     /�0/�0�0�0_0/�/�/�0�/�/�/�/�/�/�0�0�0�/�0^     ! / 0 7 ; G J N W [ d s u v | � � � � � � �/�/�/�0�/�1  � � � � � � �',5DFGNV^kmst~/�0h/�0� /�0�0�0�0�0i0a10b�00�/�0c1(0e0�/�/�1!0�0`/�1)/��0/A/@/B/�     	    * " % ' C = ? @   c k e g q i0� o � � � � � tU � � � � � � � � � � � �	 �4<68B:0�@e_bcuEw  �  �  �  �  �  �  �  �  � + � ( � , � # � 3 � 1 � 5 � 4 � 9 F D E A < I L O R" P  V& \- _0 ]. m> l= rC wH yJ xI }O �R Q ~P �X �W �j �g �` �i �f �h �o �v � � �� ��  � >
    39	 f7 �a 2 � K pA �S �Z � $ � �{ � � � � �lr}����1%11&1*1'1"���1 1111	10�0�111.�.�.�����  �  �  �  � 6 � : 8 M S# T$ U% Q! X( Y) Z* `1 a2 b3 ^/ zK {L �T �\ �] �Y �q �n �p �x �� ��[ 
    40	 �  �  � ) � . � & � B j; h9 �d �z �y �|/�/�/�/�/�/�0000000j0k/�/�/�/�/�0�0�0f0g00/�/�/�/?/������0�0�0�0�0�0�0�0�0�0�/�/�/�/�/�/�/�/�0 0/�/�^cd`b     @      D              !   !  /�   "   "  0   #   #  /�   $   $  0�   %   %  0�   &   &  0_   '   '  0   (   )  /�   *   *  /�   +   +  0�   ,   ,  /�   -   -  /�   .   .  /�   /   /  /�   0   9  .�   :   ;  /�   <   <  0�   =   =  0�   >   >  0�   ?   ?  /�   @   @  0^   A   A      B   B      C   C      D   D      E   E   !   F   G   /   H   H   7   I   I   ;   J   J   G   K   K   J   L   L   N   M   M   W   N   N   [   O   O   d   P   P   s   Q   R   u   S   S   |   T   T   �   U   U   �   V   V   �   W   W   �   X   Y   �   Z   Z   �   [   [  /�   \   \  /�   ]   ]  /�   ^   ^  0�   _   _  /�   `   `  1    a   a   �   b   b   �   c   c   �   d   d   �   e   e   �   f   g   �   h   h     i   i     j   j     k   k     l   l     m   m  '   n   n  ,   o   o  5   p   p  D   q   r  F   s   s  N   t   t  V   u   u  ^   v   v  k   w   w  m   x   y  s   z   z  ~   {   {  /�   |   |  0h   }   }  /�   ~   ~  0�   �   �      �   �  /�   �   �  0�   �   �  0�   �   �  0�   �   �  0�   �   �  0i   �   �  0a   �   �  1   �   �  0b   �   �  �   �   �  0   �   �  0�   �   �  /�   �   �  0c   �   �  1(   �   �  0e   �   �  0�   �   �  /�   �   �  1!   �   �  0�   �   �  0`   �   �  /�   �   �  1)   �   �  /�   �   �  �   �   �  0   �   �  /A   �   �  /@   �   �  /B   �   �  /�   �   �      �   �      �   �      �   �      �   �   	   �   �      �   �      �   �      �   �   *   �   �   "   �   �   %   �   �   '   �   �   C   �   �   =   �   �   ?   �   �       �   �   c   �   �   k   �   �   e   �   �   g   �   �   q   �   �   i   �   �  0�   �   �   o   �   �   �   �   �   �   �   �   �   �   �   �   �   �   t   �   �  U   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �   �     �   �  	   �   �     �   �   �   �   �  4   �   �  <   �   �  6   �   �  8   �   �  B   �   �  :   �   �  0�   �   �  @   �   �  e   �   �  _   �   �  b   �   �  u   �   �  E   �   �  w                �              �              �              �         	  	   �  
    41	  
    42	          �              �              �              �       +       �       (       �       ,       �       #       �       3       �       1       �         5  !  !   �  "  "   4  #  #   �  $  $   9  %  %    '  '    (  (   F  )  )    *  *   D  +  +    .  .   E  /  /    0  0   A  1  1    2  2   <  3  3    4  4   I  5  5    6  6   L  7  7    9  9   O  :  :    ;  ;   R  <  <  "  =  =   P  >  >     A  A   V  B  B  &  C  C   \  D  D  -  E  E   _  F  F  0  G  G   ]  H  H  .  L  L   m  M  M  >  P  P   l  Q  Q  =  R  R   r  S  S  C  T  T   w  U  U  H  V  V   y  W  W  J  X  X   x  Y  Y  I  Z  Z   }  [  [  O  \  \   �  ]  ]  R  ^  ^     _  _  Q  `  `   ~  a  a  P  b  b   �  c  c  X  d  d   �  e  e  W  h  h   �  i  i  j  j  j   �  k  k  g  l  l   �  m  m  `  n  n   �  o  o  i  p  p   �  q  q  f  r  r   �  s  s  h  t  t   �  u  u  o  v  v   �  w  w  v  x  x   �  y  y   �  z  z    {  {   �  |  |  �  }  }   �  ~  ~  �  �  �   n  �  �     �  �   -  �  �  0"  �  �     �  �   �  �  �   >  �  �  
    43	  �  �   f  �  �  7  �  �   �  �  �  a  �  �   �  �  �   2  �  �   �  �  �   K  �  �    �  �   p  �  �  A       �       �      S       �      Z  '  '   �  (  (   $  )  )   �  2  2   �  3  3  {  7  7    E  E   �  P  P   �  Q  R   �  T  T  ?  X  X   �  Y  Y   �  a  a     h  h    o  o  +  y  y  M  �  �  l  �  �  r  �  �  }  �  �    �  �  �  �  �  �  �  �  �  �  �  �  �  �  �  �  �  1,  �  �  1#  �  �  1%  �  �  1  �  �  1&  �  �  1*  �  �  1'  �  �  1"  �  �  �  �  �  �  �  �  �       1       1      1      1      0�      0�  
    44	  
    45	  1      1      1      1
    46	      1      1      1  #  (  1  ,  1  1  5  5  1  C  C  .�  G  G  .�  H  I  .�  M  M  .�  O  P  .�  R  R  .�  V  X  .�  [  [  .�  b  b  �  c  e  �  �  �  .�  �  �  .�  �  �  .�              �              �              �              �         6  !  !   �  $  $   :  %  %    *  *   8  +  +    4  4   M  5  5    6  6   S  7  7  #  8  8   T  9  9  $  :  :   U  ;  ;  %  <  <   Q  =  =  !  >  >   X  ?  ?  (  @  @   Y  A  A  )  B  B   Z  C  C  *  D  D   `  E  E  1  F  F   a  G  G  2  H  H   b  I  I  3  J  J   ^  K  K  /  \  \   z  ]  ]  K  ^  ^   {  _  _  L  b  b   �  c  c  T  l  l   �  m  m  \  n  n   �  o  o  ]  p  p   �  q  q  Y  �  �   �  �  �  q  �  �   �  �  �  n  �  �   �  �  �  p  �  �   �  �  �  x  �  �   �  �  �  �  �  �   �  �  �  �  �  �    �  �  [  �  �   
    47	  �  �   �  �  �     �  �   �  �  �     �  �   �  �  �   )  �  �   �  �  �   .  �  �   �  �  �   &  �  �   �  �  �   B  �  �    �  �   j  �  �  ;  �  �   h  �  �  9  �  �   �  �  �  d  �  �   �  �  �  z  �  �   �  �  �  y  �  �   �  �  �  |         /�        /�        /�        /�        /�        /�        /�        0        0        0        0       !  0j   "   "  /�   #   #  /�   %   %  /�   &   &  /�   /   /  /�   0   1  0�   2   3  0f   9   :  0   ;   ;  /�   B   C  /�   D   D  /?   N   N  /�   Q   Q  /�   `   `  /�   p   p  /�   q   q  �   t   y  /�        �   �   �  /w   �   �  �   �   �  �   �   �  �   �   �  .�   �   �  0�   �   �  0�   �   �  0�  !  !  0l  !	  !	  0m  !"  !"  0d  ![  !^  /C  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  !�  !�  0�  "  "  0�  "H  "H  0�  "`  "`  0�  $`  $h  .�  $�  $�  0�  $�  $�  0b  $�  $�  .�  $�  $�  .�  %�  %�  0�  %�  %�  0�  %�  %�  0�  %�  %�  0�  &  &  0#  &a  &a  0%  &e  &e  0&  &�  &�  0'  '  '  0(  '  '  0)  'v  '~  .�  '�  '�  .�  '�  '�  .�  ,|  ,|  �  .:  .:  /�  .;  .;  /�  0   0   /�  0  0	  /�  0
    48	  0  /�  0  0  /�  0  0  0   0  0  /�  0  0  /�  11  1d  �  2  2  .�  �   ף  �  �   �   ^  �  �  c  �  �  `  �  �  b  ��  ��  /� � �  1- �0 �I  0D �P �i  0* �p �  0n        1.      11      10      1/        1T      1W  �  �  1c  �  �  1f ( (  1K ) )  19 * *  1< + +  1B . .  1E / /  1H 0 0  13 1 1  16 > >  1? � �  1Z � �  1Q � �  1o � �  1r � �  1] � �  1` � �  1i � �  1l y y  1N         �   �   �      9  Q  i  �  �  �  �  �  b  z  �  �  �  �    &  >  V  n  �  �  �      4  L  \  �      2  J  b  �  �  �  �  �  �    (  @  t  �      6  N  f  ~  �  �  �  �  	  	,  	D  	\  	t  	�  	�  	�  	�  	�  
    49	  
    50	  
    51	^  
    52	v  
    53	�  
    54	�  
    55	�  
    56	�    :  R  j  �  �  �  �  �  !  �  �  �  �    4  L  d  |  �  �  �  �  O  g    �  �  �  �  �    /  E  �  �  �  �    W  �  6  N  f  ~  �  �  B  Z  r  �  �  �  �  �    )  A  Y  q  �  �  �      3  K  c  {  �  �  (  @  X  �  �       8  P  h  �  �       8  P  h  �  �  �  �    '  ?  W  o  �  �  �    �  �  �  �      2  J  b  z  �  �  �  �  �  
    57	  "  :  R  �  �    .  F  ^  ~  �  �  �  �  �      4  L  d  |  �  �      $   �   �   �   �   �   �  !  !-  !E  !�  !�  "  "�  #  #6  #N  #f  #~  #�  #�  #�  #�  #�  $  $.  $D  $\  $p  $�  $�  %r  %�  %�  %�  %�  %�  &  &  &g  &  &�  &�  &�  &�  &�  '  '(  '@  'X  'p  '�  '�  '�  '�  '�  (  ((  (@  (X  (�  (�  (�  (�  )  )+  )C  )W  )p  )�  )�  )�  )�  )�  *  *   *J  *�  *�  +
    58	  +"  +6  +�  +�  +�  +�  +�  ,  ,  ,3  ,K  ,�  ,�  ,�  ,�  -  --  -E  -]  -u  -�  -�  .  .1  .I  /  /�  01  0G  0�  0�  0�  0�  0�  1  1!  1�  1�  1�  1�  2  2  25  2�  3$  3<  3T  3l  3�  3�  3�  3�  3�  3�  4  4(  4@  4X  4p  4�  4�  4�  4�  4�  5   53  5I  5�  5�  5�  5�  6  6#  6q  6�  6�  6�  6�  7  7  75  7M  7e  7y  7�  7�  7�  8  8   88  8P  8h  8�  8�  8�  8�  8�  9  9   98  9P  9h  9�  :  :&  :>  :^  :v  :�  :�  :�  :�  :�  ;  ;&  ;>  <   <  <0  <D  <�  <�  <�  <�  <�  =  =  =4  =L  =d  =�  =�  >  >U  >m  >�  >�  >�  >�  >�  ?  ?3  ?K  ?c  ?{  ?�  ?�  ?�  @  @B  @�  @�  A  A%  A=  AU  Am  A}  B  B  B6  BV  Bn  B�  B�  B�  B�  B�  C  C  C6  C�  D  D#  D7  D�  D�  D�  D�  E  E&  E>  EV  En  E�  E�  E�  E�  E�  E�  F  F   F8  FP  Fh  F�  F�  G   G8  GN  Gf  G~  H  H0  HH  H�  H�  H�  H�  H�  I  IS  Ik  I�  I�  I�  I�  I�  I�  J  J,  JL  Jd  J�  J�  J�  J�  K  K   K8  KP  Kp  K�  K�  K�  L`  L�  M<  M�  N+  Nl  O  O_  O�  O�  P(  PA  P�  Q  Q  Q�  R  R�  S<  S|  S�  S�  T^  T�  T�  U  U,  U>  UP  Ub  Ut  U�  U�  U�  U�  U�  U�  U�  V  V  V(  V:  VL  V^  Vp  V�  V�  V�  V�  V�  V�  V�  W'  W9  W`  Wr  W�  X	  XK  X]  X�  X�  X�  X�  Y  Y0  Y�  Y�  ZX  Zj  Z�  Z�  [g  [  \5  \U  \�  \�  ]  ].  ]N  ]f  ]~  ]�  ]�  ]�  ]�  ^l  ^�  ^�  ^�  _  _�  _�  _�  `  `a  `y  a  a{  b  b�  c	  c)  cI  c�  d  da  dy  d�  eA  e�  fP  fp  f�  gR  gd  gv  g�  g�  g�  g�  g�  g�  g�  h  h  h*  h<  hN  h`  hr  h�  h�  h�  h�  h�  h�  h�  i  i  i&  i8  iJ  i\  in  i�  i�  i�  i�  i�  i�  i�  i�  j  j"  j4  jF  jX  jj  j|  j�  j�  j�  j�  j�  j�  j�  k  kF  k�  k�  la  m  m5  m�  m�  n/  n�  o
    59	  o�  p  p�  qQ  q}  q�  r  r�  r�  s|  s�  tE  t�  ug  u�  u�  v  v�  v�  v�  w)  wm  w�  w�  w�  xB  xj  x�  y   yf  y�  y�  z  zz  z�  z�  {  {K  {d  {d  {�  |3  |�  }m  }�  ~�  �  �5  ��  �p  �&  ��  ��  ��  �S  �P  ��  �P  �  ��  ��  �V  �	  ��  �K  ��  �k  �9  ��  �   ��  �k  ��  ��  ��  �a  ��  ��  �p  �=  �"  ��  ��  ��  �h  ��  ��  �|  �j  �/  ��  ��  �J  ��  ��  �e  ��  �P  ��  ��  �,  �  �  ��  �8  ��  ��  ��  �p  �D  �  �(  ��  �D  �  ��  ��  ��  �C  �  ��  �;  ��  ��  �1  ��  �Y  �$  ��  ��  ��  �P  ��  ��  ��  �c  �U  �3  �  �:  ��  �n  �M  �  �	  ��  Ȫ  Ʌ  �  ��  �t  �c  ��  �/  Ͱ  �b  ��  ϳ  Ш  �'  ѯ  �\  �  ��  Ԫ  �n  �=  �E  ��  �C  �  ٭  ڏ  �E  ��  ܷ  �7  ��  �T  �   ߊ  �  ��  �X  ��  ��  ��  �R  ��  �  �f  �3  �  ��  ��  ��  �j  ��  ��  �  �s  �7  ��  ��  �T  ��  �  �o  ��  �W  ��  ��  �-  �  �  ��  �:  ��  ��  ��  �s  �H  �'  �=  ��  Y + � � � Z ' � M � � B � 	p 
    60	= 
    61	� � � r  � � � � b M q 
    62	 � � O L  � � h  � �  r � �  
    63	  � !� "I "� #k $ $� %� &a '( ( (� )
    64	 )� *e += +� ,� -O -� .H .� /� 0! 0� 1^ 25 2� 3� 4� 5� 6= 7 7� 8� 9� :� ;� <� =� >8 ?" ?� @� A� B� C� D/ D� E� F� G* G� Hw IV I� K L= L� M� N| Ob PM QX RK SH T� U4 U� V� W� X� Y� Z� [r \ \� ]� ^� _ _� `7 a  a� b c� d, d� e� fW g, h h� i� k
    65	 k� l8 m m� n� o� p^ q4 q� rj s t tn t� un v& v� w� x� y y� zO { {� |� }~ ~T b � �l �8 �� �� �� �? � �� � �� �� �� �R �� �} �� �� �� �< �� �h � �� �� �h �2 �' �� � �� �{ �U � �� �o �� �l �� �� �J �� �� �^ �� �� � �� �r �D �  � � �� �� �! �� �m �X �# �) � �� �� �j � �� �� �[ �� �� �� �9 �D �� �1 �� �� �� �� �� �� �� �� �� �; �2 �	 � �� �� �� Ɔ �D �	 �
    66	 � � ʠ �k �� �� � ΢ �A � �� ѥ җ �u �[ Ն � ֲ ׏ �K �C � �� ۰ �H �� ݖ މ �� �e �� � �. � � � �+ �� � � �b �. � � � � �� � �p �. �� � �4 �� �` �@ � �� �Y �� �^ �% � �} �� �� �- �� �� �M � �� �e �� �� � �� ��  2  � K � D � _ � a  � � �  � 	` 
    67	  
    68	� � � o �  � o  
    69	 � � P � k 	 � = �  � ! � � B � \  � � : �  � !h !� "� #- $ $� %P & &s &� 'u (3 (� )] * *� +� ,� -� .g / /� 0� 1� 2� 3� 4� 5� 6� 75 8% 8� : :� ;� <� =^ > >� ?� @w A! A� B� Cy D� E� Fy G: H! I J K L M* Na O O� P� Q� R� S� T� U� VX W W� X� Y� Z7 Z� [� \� ]� ^� _� `A a$ b c d e f gK g� h� i� j� k� l� m� n� o< o� p� q� r� s@ t u u� v� x x� y� z� {� |� }� ~� � �2 �� �� �� �� �� �� �� �� �� �| �W �n �� �� �? � �� �� �� �� �< � �� �� �� �� �� �� �� �@ �0 � � �� �� �� �g � �� �� �y �# �� �� �} �� �� �o �/ � � �� � � � �L � �� �� �� �� �� �� �� �D � �� �� �� �. �� �� �� �� �� �| �; � � � � � � �I �� ̸ ͵ Θ ϳ Ф ё Ҍ �E �	 �� �� ֒ �K � � �� �� �. �� �� ޹ ߸ � �� �� � �J � �� �� �� �� �� �� �� �� � �x �� � � �e �B �� �� � �� �p �E �% � � �� �� � �� �r  c 4 @ #  � � I 	  � 	� 
    70	[ b . ^ � k E D M \ � � �  � � � � �      � !� "� #� $� %q &N '\ (3 )k *� +� ,l -w .� /� 0� 1� 3* 4� 5Y 69 7] 8^ 9� :� ;� <� =� >� ?� @� Am B# B� C� D� E� F� G� H� Iv Jt Kx L� M� N� O� P� Q� R� S� T� U� V� W� Xy YJ Z( [L [� \� ]H ^0 ^� _� a# a� b� cw dd eV fe gb hf i� jI k k� l� m� n� o� p� qj r+ r� t t� u0 u� v� wZ x` ys z z� {� |� }q ~t e �_ �� �E �� �� �� �� �� �} �g � �� �� �| �2 �� �� �� �� �� �8 � �� �� �� � �F �d �� �� �� �� �� �� �� � � �- � �� �� �� �� �� �p �� �Y �� �� �� �� �� �� �� �2 �X �� �  �� �� �� �� �& �B �R �m �Q �= �5 �_ � �� Ǐ ȋ �M �p ˽ ̄ �W �L �M �U �v ҅ Ӡ �� ի �y ׊ �x ٢ ڡ ۟ ܨ �s �I �& �J �� � �C �+ �� �� � �� � �f �S �G �U �Q �V � �9 �� �� �� �� �� �� �� �s �3 �� � �� � �� �� �$ � �1 �� �r  :  � � � � � t  � � 	� 
    71	� c ? � � 4  � a $  � � 	 � � s e a w y � � y 8  9 ! "= #/ $  % %� &� 'w (� ) )� *2 +  +� ,� -� .5 .� /� 0q 1K 2@ 3! 4 5% 5� 6] 7> 8 9 9� :� ;� <  <� =w >i >� ?) ?� @P @� A� Bx B� Ct D D� E� FZ G G� H� IP I� J� K- L L� Me N  N� O O� Ph P� Q? Q� R} R� S� T� US U� V� WP X X� Y� Z� [� \ \� ]m ^ _ _� `y a@ a� bV b� c� d. d� e- e� f_ gC h3 h� iH i� j� ky lV m" m� n� o} p p� q� rh s$ s� t� u, u� vX w& w� x x� yu z z� {� |� }  }� ~� { �e �? �$ �5 �� �Z �2 �� �� �� �t �F �� �z �" � �_ �� �@ �� �Y �/ � �� � �� �] � �� �� �n �d �� �Q � �� �� �7 �� �� � �� �% �� �L �� �N � �� �g �W �� �l � �� �� �} �I �  �# �� �. �� �� �� �K � �� �Q �� � �[ �� �1 �� �o �� �� �� �> �� �� �= � �� �� �� �� � �� �b � �� �� �m �4 · �K �� �� �6 ŷ �M � Ǜ ȋ Ɉ � ʳ �q �: � �� �� ϳ �� �P �� Ҽ �v �k �6 �� �� �d � ة ٘ �� �3 ڡ �< ۜ �b �6 ݞ � ޥ �E �� � �_ � �� �c �� �| �	 �� �r � � � � � �� �9 �� �f �5 �� �� � �[ �� � � �Y �H �$ � �# �� �T �/ �� �� �� �w �K �� �� �E �/ ��  I  � � i j x  � � s W 	T 
    72	< 3 T � � � Q O ) � � � - � � = � K 	 � p b � | 0 � � � f  ? !D !� "N # #� $� %u &/ &� '� ( (� )� )� *I *� +j +� ,� -� . .� /5 /� 0� 1g 22 2� 3� 4[ 4� 5� 6+ 7 7� 8W 9 9 : :� ;T ;� ;� <] <� =X > >� ?X ?� @[ @� A� Bb C C� D� E E� F5 F� G� H, H� Ij I� JE J� Ky K� Lk L� M� NP O; PN P� Qy R9 S S� T� U� V� W� X< X� Y� Z` [W \% \� ]� ^T ^� _� `� a a� b; c c� d� e� fY g g� h� i� j� kx ll m� nC n� o� p� q� rn sB t" t� uu v, w w w� xt y$ y� z� {� | |� }G ~ ~� � �q �G �M �� �X �$ �� �� �y �2 �� �z �
    73	 �� �x �� �0 �� �Q �� �� �t �� �e � �� �i �8 �� �� �� � �� �T �� �� �t � �� �C �� �R � �T �� �� �� �� �� �n �� �( �� �D �� �� �- �� �� � �c � �� �> �� �_ �� �P �� �% �� �& �� � �� �# �� �� �U �� �{ �- �� �� � �J �B �� �5 �� �� �n � �� �� �� �~ � �� �% �| �� �� �� �� � �� �Y ��  �9 �� Ĩ �c �J Ʊ � �� �a �- �� �o � ˂ �� �u �0 ͎ � · �< Ϸ З у � ґ �E �  �� ՛ �e �8 �8 ط �= � گ ۓ �M � �� �F �� �i �7 � �  � �p �� �� �� �g �� � � �L �2 � �� �� �} � �� � � �I � �� �f �  � � �� �w � �� �V �B �; �� �_ � �� �� �� �f �F  R  � o C � � � t C � j  � 	a 	� 
    74	� X � � � � ) � � � � u b {  � � S P $ � � i  � �  �    � !7 " "� # $ $� %o &0 '
    75	 '� (� )� *# *� +o ,c -E -� .� /t /� 0� 1 1� 2P 2� 3_ 4 4� 5� 6� 7 7� 8e 9* 9� :� ;� <� =� >' >� ?� @A A0 A� B� C� D D� EN F0 F� G G� Hk H� I� J� Ke K� L� M| NI O. P P� Q� R{ S S� T� U� VL W W� Xj Y Y� Z� [	 [� \4 \� ]� ^� _� `/ `� a� bq cM dB e' f g/ g� he iG j	 k k� l� m� n  n� oy pg p� q q� r  r� sN t( t� u	 u� vH v� w� xq y0 z z� z� {� |= } }� ~Q ~� m � �i �4 �� �F �� �� �R �P �^ �� �� �q �H �* �) � � �+ �� �o �Y � � �� �� �� �9 �� �� �� � �� �[ �6 �� �� �� �� �F � �� �� �� �� �� �� �� �F �4 �� �  �� �� �� �: �� �� �� � �� �# �� �g �T �N �� �s �5 � �� �� �� �� �� �' �� �� �@ �. �� �� �� � �� �P �2 Ê �� �t �! Ŗ �m �l �� �h � �� � �T � �� �� �V �� Ϙ �: � �� �w �3 ӯ �8 �� բ �� �M �� �` �� ؐ �i �� �I �� ۇ �5 �� ݱ �p �f �� �@ �� � �Y �� � �F � �0 � �q �� �r � �� �n �g � �! �� � �^ �8 �- � �� �. �� �f �H � � �� �� �� � �� �x �i �� �� �+ � ��  � � v & � � � � � � 	� 
    76	� ; ) � � � � � ; � � �  �  � ] E V � t ) � � � l H U �  n !C !� "� #� $i %5 %� &W &� '� (8 (� )" )� *B + ,  ,y ,� -� .U / /� 0� 1x 2q 2� 3i 4+ 4� 5� 6` 7 7� 8G 8� 9` :/ :l :� ;  ;� < <� =� =� >S >� ?x @ @� Ax B) C Cb C� Dk D� E� FJ F� Gy G� HF H� Iw I� JA J� Kq K� L� M� N0 N� Of P P� Q� R� SW TV T� UV V V� W� XY Y Y� ZM Z� [n \B \� \� ]f ^	 ^t _B ` `� a
    77	 a� bT c c� d� eL f; f� g g� hq iF i� j� kH k� l8 l� m� n n� oc pB p� q� s s� tw uQ v7 w& x- y$ z# {N {� |� }� ~} � �x �[ �J �� �� �v �t � �� �{ �j �  �9 �V � �� �� �� �� �� �� �� � �� �� �� � �� �� �� �� �A � �� �� �� �5 �� �� �� �� �� �� �W �? �3 �0 �E �J �W �� �I � �	 �� � � �� �� �� �z �K �S �� �� �� �� �L �r �� �r �G �B �H �V �} Ŕ Ƴ �� �� ɕ ʦ ˛ �� �� �� �� О �x �R �r �  Ԟ �S �3 �� �� � ٱ �k �I �3 �# �- �' �) �W � � � � � � �h �Y � �� � � �- �� � � �D �] � �@ � �� �� �� �� �� �� �7 �� �� �� �� �� ��  � � Y   � � � C  � � 	� 
    78	� � x e ] ] v  � � � K O 6 Z Q E D  � � � X    � !� "� #� $� %� &� '� (� )� *� +� ,� .D / /� 0� 1� 3 4 5 6! 6� 7� 8� 9� :: :� ;s <G <� =� >� ?� @: A A� B� C� D� E� F� GO G� H� I� J� K� L[ M; M� N� OE PD P� Q� R� S� TW U� V� W� Xn Yo Z| [� \� ]� _	 `[ a+ b c d eA fD gF hT i% j j� l l� m� nd on p@ qu r� s� to uu v� w� x� y� {  |v }J ~% C �A �y �� �� �� �� �f �R �y � �� �� �� �A �` �� �S �% � � �# �H �X �s �� �w �B �P �9 �^ �Y �P �S � �� �� �� �j � �� �� �K �[ �� �< �� �� �� �� �� �� �� �� �� �< �2 �
    79	 � � �� �� �� �K � �! �� �1 �� �� �C �B �O �� �� �g �A �# �  � �� �5 �� �z �b �* �. � �� η �Y �	 п Ѱ �_ �# �� � �� �� �V �( �  �� � � �C �\ �~ �� � � � � �� �� �� �� � � � �� �Y �$ � � �� � �t �M �/ �7 �H �b �� �� �� �V �+ 	 
    80	 	* 	) 	e 	x 	� 	� 	p 	W 		E 	
    81	w 	 	� 	� 	y 	3 	T 	� 	Y 	! 	 	 	  	 	! 	/ 	i 	& 	� 	� 	� 	� 	� 	� 	 � 	!� 	"t 	#I 	$^ 	$� 	%� 	&< 	' 	'� 	(� 	)� 	*� 	+U 	,1 	- 	.	 	/ 	0 	1 	2: 	2� 	3� 	4� 	5c 	6u 	7Z 	8> 	9. 	9� 	:� 	;_ 	<M 	<� 	=> 	=� 	>� 	?( 	@ 	A 	A� 	BG 	C	 	C� 	D� 	E� 	Fw 	G\ 	Hn 	H� 	I� 	Jp 	K( 	L  	L� 	M� 	N� 	O" 	O� 	Pm 	QH 	Q� 	Ry 	S1 	T 	T� 	U� 	V� 	W� 	X_ 	YC 	Z1 	[& 	\7 	]5 	^< 	_o 	` 	`� 	a� 	b� 	c� 	d� 	e� 	f� 	g= 	h  	h� 	i� 	jY 	j� 	k� 	ld 	l� 	m� 	o	 	o� 	pW 	q& 	r 	r� 	s� 	t� 	u� 	v� 	w~ 	x% 	y 	y� 	z� 	{� 	|� 	}o 	~ 	~� 	u 	�e 	�� 	�K 	�� 	�� 	� 	� 	�� 	�� 	� 	�� 	�� 	�v 	�_ 	�8 	� 	�% 	�� 	�: 	� 	�� 	�� 	�l 	�+ 	�� 	�� 	�! 	�� 	�� 	� 	�� 	�6 	� 	�� 	�� 	�� 	�" 	�� 	�� 	�U 	�* 	� 	�� 	�� 	�� 	�� 	�& 	� 	�� 	�� 	�� 	�V 	�. 	�� 	�i 	� 	� 	�{ 	� 	�� 	�h 	�� 	�� 	� 	�� 	�D 	� 	�� 	�� 	�� 	�� 	�� 	�� 	�= 	�� 	�� 	�w 	�r 	�A 	� 	�� 	�� 	�' 	�� 	�� 	�< 	�� 	�} 	�V 	�� 	�� 	� 	Ű 	�_ 	�2 	� 	�� 	�� 	�� 	�� 	�  	͢ 	�L 	�7 	� 	� 	�� 	�� 	ӭ 	�S 	� 	�� 	־ 	�& 	נ 	�1 	�� 	�t 	�[ 	�Q 	�� 	�o 	�( 	�� 	޶ 	ߛ 	�o 	�L 	�U 	�� 	�f 	�6 	�� 	�� 	� 	�V 	�" 	� 	�E 	�� 	�� 	�? 	�� 	�d 	�, 	�� 	� 	� 	�L 	�� 	� 	� 	�V 	�G 	�& 	� 	�2 	�� 	�a 	�> 	�� 	�� 	�� 	�� 	�k 	� 	�� 	�U 
    82	 @ 
    83	 � 
    84	> 
    85	� 
    86	� 
    87	4 
    88	& 
    89	A 
    90	� 
    91	x 
    92	@ 
    93	 
    94	� 
    95		� 
    96	
    97	� 
    98	� 
    99	� 
   100	\ 
   101	� 
   102	� 
   103	� 
   104	� 
   105	b 
   106	. 
   107	 
   108	� 
   109	D 
   110	� 
   111	� 
   112	e 
   113	� 
   114	� 
   115	x 
   116	 
   117	 
   118	) 
   119	� 
   120	{ 
   121	N 
   122	+ 
   123	 
   124	  
   125	 � 
   126	!� 
   127	# 
   128	#� 
   129	$^ 
   130	%G 
   131	& 
   132	' 
   133	'� 
   134	(� 
   135	)� 
   136	*V 
   137	+	 
   138	+� 
   139	,� 
   140	- 
   141	-u 
   142	-� 
   143	.� 
   144	/ 
   145	/� 
   146	0� 
   147	1M 
   148	1� 
   149	2n 
   150	3 
   151	3� 
   152	4� 
   153	5\ 
   154	6# 
   155	7. 
   156	7� 
   157	8 
   158	8� 
   159	9v 
   160	:O 
   161	:� 
   162	;� 
   163	<^ 
   164	<� 
   165	=Y 
   166	=� 
   167	>� 
   168	?- 
   169	?� 
   170	@} 
   171	A^ 
   172	A� 
   173	C 
   174	D 
   175	D� 
   176	Et 
   177	FH 
   178	G( 
   179	H 
   180	I 
   181	J 
   182	K  
   183	L( 
   184	L� 
   185	M~ 
   186	Nm 
   187	O? 
   188	PO 
   189	Q. 
   190	R
   191	 
   192	R� 
   193	S� 
   194	TZ 
   195	U 
   196	V 
   197	V� 
   198	WM 
   199	X 
   200	X� 
   201	Y� 
   202	Z� 
   203	[� 
   204	\k 
   205	]& 
   206	^ 
   207	^� 
   208	_� 
   209	`� 
   210	a� 
   211	b� 
   212	d: 
   213	d� 
   214	e� 
   215	f� 
   216	gr 
   217	h� 
   218	ig 
   219	jL 
   220	k> 
   221	k� 
   222	l� 
   223	mu 
   224	n� 
   225	n� 
   226	o� 
   227	p) 
   228	p� 
   229	q� 
   230	r� 
   231	s� 
   232	t= 
   233	t� 
   234	u� 
   235	vs 
   236	wM 
   237	xC 
   238	y$ 
   239	z 
   240	{B 
   241	{� 
   242	|m 
   243	}O 
   244	~ 
   245	 
   246	� 
   247	�� 
   248	�~ 
   249	� 
   250	�� 
   251	�u 
   252	�i 
   253	�� 
   254	�? 
   255	�� 
   256	�~ 
   257	�� 
   258	�� 
   259	�� 
   260	�k 
   261	�� 
   262	�� 
   263	�c 
   264	�& 
   265	� 
   266	�� 
   267	�� 
   268	�� 
   269	�< 
   270	�� 
   271	�� 
   272	�: 
   273	�! 
   274	�� 
   275	�� 
   276	�Z 
   277	�� 
   278	�n 
   279	� 
   280	�� 
   281	�& 
   282	�� 
   283	�
   284	 
   285	�� 
   286	�% 
   287	�� 
   288	�� 
   289	�m 
   290	�� 
   291	�� 
   292	�> 
   293	�� 
   294	�� 
   295	�� 
   296	�J 
   297	�U 
   298	�� 
   299	�F 
   300	� 
src/renderer/src/styles/fonts/PretendardVariable.ttf
--- src/renderer/src/styles/fonts/PretendardVariable.ttf
     1	        GDEF?J�� -Hx  �GPOS:��` -et ��GSUB�j� 0<<  ��OS/2b�x� *��   `STAT�c� 0��   �cmapS_� *�  gvfvar��w�  (   ~glyf�\�%  � (��gvar\ �� 0Ѽ 6�head1pj  )�   6hheaIB *��   $hmtxU#�v )�L  �Dlocayf (�|  �maxp:0t (�\    name���    post��� *�� K�   ��              	        $       =       P       _       k       y       �       �       �       �       �       �        �     ! 	      "  �     # 	 �     $  �     %      & (     '  k     ( ?     ) S     * b     + ~   #      # 	    #  $   #  =   #  P   #  _   #  k   #  y   #  �   #  �   #  �   #  �   #  �   #  �   #   �   #! 	    #"  �   ## 	 �   #$  �   #%    #& (   #'  k   #( ?   #) S   #* b   #+ ~  	   <�  	  &�  	  �  	  :  	  &�  	  >;  	  4y  	 D�  	  �  	 	*  	  05  	  05  	  e  	  4�  	  &�  	  �  	  $�  	  �  	 �  	 .�  	   	 :3  	 
     2	m  	 0w  	 �  	 2�  		 �  	
     3	 6�  	 	+  	 .	3  	 	a  	 8	s  	 
     4		�  	 0	�  	 	�  	 6	�  	 6	�  	 
     5	'  	 
     6	'  	 2
     7	9  	 2
     8	9  	 &
     9	k  	 &
    10	k  	 
    11	�  	 
    12	�  	 
    13	�  	 
    14	�  	 
    15	�  	 
    16	�  	 
    17	�  	 
    18	�  	  
    19	�  	  
    20	�  	   	   	 ;  	 ;  	 W  	 W  	 s  	 s  	 �  	 �  	  �  	  �  	! 
    21	'  	! 
    22	'  	" �  	" �  	# �  	# �  	$ ,�  	$ ,�  	% 2  	% 2  	& .A  	& .A  	' 
    23	�  	' 
    24	�  	( (o  	( (o  	) �  	) �  	* 8�  	* 8�  	+ &�  	+ &�     (    ;   6	�   
    25	'   2
    26	9   &
    27	k   
    28	�   
    29	�   
    30	�   
    31	�    
    32	�      ;   W   s   �    �  ! 
    33	'  " �  # �  $ ,�  % 2  & .A  ' 
    34	�  ( (o  ) �  * 8�  + &�Straight-sided six and nineOpen fourVertically centered colonKorean localizationHigh legibilityOne storey aFlat-top threeMedium symbolsOutlined symbolsCircle symbolsSquare symbolsFilled symbolsSmall symbolsLarge symbolsAlternate oneOpen sixOpen nineLower-case L with tailAlternate German double sUpper-case i with serifCaptital G with spurSingle-storey aVertically centered ellipsisHigh legibility one C o p y r i g h t   �   2 0 2 3   K i l   H y u n g - j i n P r e t e n d a r d   V a r i a b l e R e g u l a r 1 . 3 0 9 ; C T U S ; P r e t e n d a r d V a r i a b l e V e r s i o n   1 . 3 0 9 ; G l y p h s   3 . 2   ( 3 2 2 5 ) P r e t e n d a r d V a r i a b l e - R e g u l a r P r e t e n d a r d   i s   a   t r a d e m a r k   o f   K i l   H y u n g - j i n ;   I n t e r   U I   a n d   I n t e r   i s   a   t r a d e m a r k   o f   r s m s ;   S o u r c e   i s   a   t r a d e m a r k   o f   A d o b e   i n   t h e   U n i t e d   S t a t e s   a n d / o r   o t h e r   c o u n t r i e s . K i l   H y u n g - j i n B a s e   g l y p h s   f r o m   I n t e r   b y   R a s m u s   A n d e r s s o n ;   H a n g e u l   g l y p h s   f r o m   N o t o   S a n s   C J K ( S o u r c e   H a n   S a n s )   b y   J a n g   S o o - y o u n g   a n d   K a n g   J o o - y e o n ,   S a n d o l l   C o m m u n i c a t i o n s ;   K a n a   g l y p h s   f r o m   M   P L U S   1 p   b y   C o j i   M o r i s h i t a ,   U N D E R F O R E S T   D E S I G N ;   C o m b i n e d   a n d   r e d e s i g n e d   t o   P r e t e n d a r d   b y   K i l   H y u n g - j i n . h t t p s : / / o r i o n c a c t u s . c o m / T h i s   F o n t   S o f t w a r e   i s   l i c e n s e d   u n d e r   t h e   S I L   O p e n   F o n t   L i c e n s e ,   V e r s i o n   1 . 1 .   T h i s   l i c e n s e   i s   a v a i l a b l e   w i t h   a   F A Q   a t :   h t t p : / / s c r i p t s . s i l . o r g / O F L h t t p : / / s c r i p t s . s i l . o r g / O F L P r e t e n d a r d V a r i a b l e W e i g h t T h i n P r e t e n d a r d V a r i a b l e - T h i n E x t r a L i g h t P r e t e n d a r d V a r i a b l e - E x t r a L i g h t L i g h t P r e t e n d a r d V a r i a b l e - L i g h t M e d i u m P r e t e n d a r d V a r i a b l e - M e d i u m S e m i B o l d P r e t e n d a r d V a r i a b l e - S e m i B o l d B o l d P r e t e n d a r d V a r i a b l e - B o l d E x t r a B o l d P r e t e n d a r d V a r i a b l e - E x t r a B o l d B l a c k P r e t e n d a r d V a r i a b l e - B l a c k I t a l i c S t r a i g h t - s i d e d   s i x   a n d   n i n e O p e n   f o u r V e r t i c a l l y   c e n t e r e d   c o l o n K o r e a n   l o c a l i z a t i o n H i g h   l e g i b i l i t y O n e   s t o r e y   a F l a t - t o p   t h r e e M e d i u m   s y m b o l s O u t l i n e d   s y m b o l s C i r c l e   s y m b o l s S q u a r e   s y m b o l s F i l l e d   s y m b o l s S m a l l   s y m b o l s L a r g e   s y m b o l s A l t e r n a t e   o n e O p e n   s i x O p e n   n i n e L o w e r - c a s e   L   w i t h   t a i l A l t e r n a t e   G e r m a n   d o u b l e   s U p p e r - c a s e   i   w i t h   s e r i f C a p t i t a l   G   w i t h   s p u r S i n g l e - s t o r e y   a V e r t i c a l l y   c e n t e r e d   e l l i p s i s H i g h   l e g i b i l i t y   o n e C o p y r i g h t   �   2 0 2 3  �8��Į8���         	 
    35	wght -  �  �        d     �    ,     �     �  	  X  
    36	  �         �      ��<hl        S!!!!!!!!!!!!���0��0��0��0��0��0l��>�j�h�l�h�  $  �    s3##!5$���R�R(���X��B6���� $  �"    7� �j�� $  "    7� �j�� $  �"    8� �j�� $��"    '7� �j 7,�  �� $  �"    8� �j�� $  R"    8� �~�� $  ,"    8� ���� $  \"    7� �j�� $  \"    7� �j�� $  �"    8�l�� $��\"    '7� �j 7,�  ��   �"    8�  ~�� $  �"    8� �Z�� $  �"    8� �F�� $  �"    7tj�� $  @"    9KV�� $  |"    8��  �� $���"    7,�  �� $  |"    8��  �� $  �"    7� Hj�� $  �"    7���� $  h"    7 ��� $  "    7� �j�� $�Z�"    7�l  �� $  �"    7�l  �� $  |"    8�z��� $�n�"    4��  �� $  F"    9L �    $  &�    A!!!!!!##!!�<�H��t���h���6��R��������6��� $  &�"     7�0j�� $  &"     7�Hj  �  ��   )  S!2#!$6654&&#!!6654&&#!!����b>jDF�Xfڦ��z�@J�Z��X8�J:|\��B�d�nX|JX�np�d�<dBJ~H��>pJBf:�&�� �  �@" #   7�~j�� �����" #   7,�    P  ��    + 6  @#546633#7!2#!$6654&&#!!6654&&#!!,4�F�Z��Z���b>jDF�Xfڦ��z�@J�Z��X8�J:|\��B\R8bR�L��d�nX|JX�np�d�<dBJ~H��>pJBf:�&�� �����" #   7:�    �  ��    S!!!2#!$6654&&#!!�l�Hj��ppښ��~�HH�`��j���Bd��~�l�N~HFrD��  h��0� !  @&&#"326673#"$54$32#hv�`��zzԄ`�x������ޤ�"�����B�H��������H�`��r�R��P�r֔�� h��0�" )   7� j�� h��0\" )   7�.j�� h�J0�" )   7������ h�J0�" )   '7���� 7� j�� h��0\" )   7�.j�� h��0@" )   7�j  h���  6  A546632"&#&&#".#"326673#"$54$32#�L�R$,
    37	0F*�v�`��zzԄ`�x������ޤ�"������^�F�B8�b�H��������H�`��r�R��P�r֔  �  �    a5!26654&&#!5!2#!#3R��tr���x�.������򴴠������������������ �  	��" 1   :|  ����  �" 1   8��J ,�� �  \" 1   7� �j�� �� �" 1   9AN  �� ��t�" 1   76�  ����  � 3  �� �  @" 1   7�jj�� ����" 1   7,�    P  T�  " &  R6633#"#55!26654&&#!5!2#!#3PF�Z��N4��R��tr���x�.�������ֆL�\R8b�|������������������� ����" 1   7:�    d  h�    `&&54663!!5!!!"3!��rrښP�dj��P��^~:<|^Pl�~��f���v�BpHJxJ�� �  	<�" 1   F|  �� �  	<�" 1   I|  ����  � 3    �  �   S!!!!!!�n�F��t����������� �  �" @   7� �j�� �  " @   7� �j�� �  \" @   7� �j�� ��V" @   #7�H   7� �j�� �  \" @   7� �j�� �  ��" @   8� �l�� ��t�" @   76�  �� ���\" @   '7� �j 7,�  ����  �" @   8���~�� �  ^�" @   8� �Z�� �  �" @   8� HF�� �  �" @   74j�� �  @" @   9K�� �  @" @   7�tj�� ����" @   7,�  �� �  �" @   7� j�� �  �" @   7���� �  h" @   7���� �  " @   7� �j�� �  $" @   8��  �� �  $" @   8��  �� ��Z*�" @   7�~    d��h�  7  @&&546632#4&&#"33#7#"326653#"&&54663��z�����|�B�X\�D<�b����d�FP�Vf�FΌ萎�x��Z�tz�`^�vBf8<lHBnD|T|8pVXr6BrF��ZV����X�� f  L��� �� �  8" @   7� pj�� ����" @   79�  �� r  �� @���   v��� &  D$55!!3266554&&#"'>32#� ���X�n��^dʔP�T0*��H�$�����$�~���`��t��x$$�*����t��ʲ  P�T�� "  D326654&&##55!5!#"$&'3l�fx�bxڌn���
    38	���������� �
    39	� �Tt�|��p�������������|���� P�T�\" ]   7� �j  b�T�� "  D#"$546755!!#"326673ښ� ������������n��zb�vh�l�N�~���
    40	�����pΊ|�tT�`  �  � 	  S!!!!#�h�Lr��������z�� �  @" `   7��j ���h
    41	�    a#"&'5232655!!!!#TL�l
    42	
    43	JRh�Lr���r^�D�BNp�����z  h��>� %  @&&#"32665!5!#"$54$32#^t�f��zzֈ|�h6�P*������ܢ� �����B�J��������jĀ
    44	�������P��P�v֌�� h��>�" c   7�j  h����  )  A!5! &&#"32665!5!#"$54$32#��t���t�f��zzֈ|�h6�P*������ܢ� �����.���J��������jĀ
    45	�������P��P�v֌�� h��>" c   7�0j�� h��>\" c   7�(j�� h��>\" c   7�(j�� h� >�" c   9A�  �� h��>@" c   7�j  h���  6  A7>32&#".#"32665!5!#"$54$32#|D~Z$.0H(�t�f��zzֈ|�h6�P*������ܢ� ������^�D�@6�^�J��������jĀ
    46	�������P��P�v֌�� h��>" c   7�2j  p�X^�  +  @$654&&#"#466325$56$654&&'7�.�B~ZX�J̀␎�|��l���t<��r���4�B6b$�ȄVx>8hDx�``������:��l�t��ܬ:�0��TvLr  �  �   S3!3#!#���������|��X��z  P  ��    A!5!3!3#!#���R�&�������.�|��X��z�� ����" n   77"  �� ��T�" n   7���� �  ^" n   7� l�� �  D" n   9K � �� �  B" n   7��l�� ����" n   7,4    �  T�   a#3T����� ���t�" v    ��  �� �   �" v   7��2j����  $" v   7��Hj����  0\" v   7��@j����  .\" v   7��@j���4  ��" v   7�j����  :@" v   9K�� ����  D:" v   8��  �� �  t@" v   7� j�� ���|�" v   7,\  ����  T�" v   7���j�� �  ��" v   7N�����  h" v   7f�����  F" v   7��Jj�� �Zf�" v   7�� �� �  ��8  ����  4�" v   8��J ,�� N  
    47	8# v �   7���j��������" v   79r    B����   A#"&&533265�f�~x�j�>jDrx�����fX�n<\2��
    48	�� B��X\" �   7�jj  �  ��   S333##������^������4��r�����.�� �  ��" �   7� �j�� �  �\" �   7� �j�� �� ��" �   9A|  �� �����" �   7,�    �   �   S3366&&##��:8��<H @B$�f`��
    49	����6t>2*� &�H�����.�� �����" �   7:�    �  ��   S3!!����������� �����" �    �D  �� �  ��" �   7��0j����  ��" �   8��J ,�� �  ��" �   9N�  �� ��t��" �   76�  �� �� ��" �   9AH  �� �  ��" �   7������ �����" �   7,�  �������" �   #7,�   7��Hj�� ��h��" �   MD  �� �����" �   7:�      ��  	  A5%3!!\��B�F����
    50	������  �  2�   A33#####x��ت�>��>���X��XF��F����� �  2�" �   7��j�� �  2@" �   7��j�� ���2�" �   7,�    �  �   a###333������h�����j�� ���	>�" �    ��  �� �  �" �   7�j�� �  \" �   7�&j�� ��t�" �   76&  �� �� �" �   9A�  �� �  @" �   7� j�� ����" �   7,B   ���h*�    a#"&'5232655!###333^N�P".
    51	
    52	JP�������r\�F�BNph�����j�� ��h�" �   M�  �� ����" �   7:B  �� �  8" �   7� �j  ��h�    a#"&'523326553###333N�R$,LV�������r\�F�DNph�����j  h��h�    @#"$54$32&&#"3265h��޺��ޤ�"��"��z҆��zzԄ��z�����R��P����������������  h�h�  ) 0  d#"$55732673&&#"#54$32#5%3���j����^��V�,��*�Z��^̔�f��(T����`4�2�x|��z42����06t�rr�0�4`@��xR�p�� h��h�" �   7� j�� h��h��  �� h��h" �   7�6j�� h��h\" �   7�.j�� h��h\" �   7�.j�� h��h�" �   8�fl�� h��h\" �   '7�.j 7,J  �� h��h�" �   8� T~�� h��h�" �   8�*Z�� h��h�" �   8� �F�� h��h�" �   7�j�� h��h@" �   9K � �� h��h�" �   7,J  �� h��h�" �   7� �j�� h��h�" �   7<�  h��� 	  )  @#526653#"$54$32&&#"3265�T�|H^,�t��޺��ޤ�"��"��z҆��zzԄ��z��^�>vR������R��P������������������ h����" �   7� j�� h���" �   7,J  �� h����" �   7� �j�� h����" �   7<��� h���8" �   7�j�� h��hL" �   7��v�� h��hh" �   7T��� h��h" �   7�8j�� h��h$" �   8�h  �� h��h$" �   8�h  �� h�Th�" �   7������ h�Th" �   7�8j�� \��$� )���   h��h�   #  w #"$54$32&&#"3265��n�D��޺��ޤ�"��"��z҆��zzԄ��z�H�,0����R��P������������������ h��h�" �   7� j�� h��hF" �   9L8  �� h��h:" �   8�\  �� h��h" �   8�:�  h  ��  !  `$54$33#"33#!!!!!!*�ޠ�"��Ȉ�vv҈�Ȃn�F��t����H��H���� ��� ��������  �  z�   S!2#!5!26654&&#!#���llܤ��Xp�BB�p�д�xΆ��z�N�XZ�L���� �  z�" �   7� �j�� �  z@" �   7��j  P  ��  $  S546633#"!2#!5!26654&&#!#PF�Z��N4���llܤ��Xp�BB�p�д"bR�L�\R8�xΆ��z�N�XZ�L��  �  @�    A# #!5!26654&&#!5!J�b�prږ��td�HH�d��t��X���n�vt�n�<rPRv>�  h�xh�   '  A#''$#"$54$32&&#"3265p�.�Ğ*����޺��ޤ�"��"��z҆��zzԄ��z��<���8B.����R��P����������������  h�h� # 3  D3277#"&&5##"$54$32353 654&#"32(F.0P�L
    53	6䔲�ꜚ���6��4�\`Ɛ��npĀ�>�F�\Xx��V��P��t���������������  �  ��    S!2#!5!26654&&#!#!#3���jjޤ�t�r�BB�r�д�����pʄ��p�BzXZ�D����� �  ��" �   7� �j�� �  �\" �   7� �j�� �� ��" �   9A~  �� �  ��" �   7Hj�� �  �@" �   7��j�� �����" �   7,�  �� ����" �   #7,�   7� �j�� �  �h" �   7���� �����" �   7:�    b��z� 0  @&&#"#"&&'3326654&&''&&546632#�T�X^�P�t���|��^�Xd�ZJzZ����⌊܀��f4<lFdj(*��v�nd�xNj6@xLBZ804��x�fd�n�� b��z�" �   7� �j�� b��z�" �   8����� b��z\" �   7� �j�� b��z" �   8����� b�Vz�" �   7�n  �� b��z\" �   7� �j�� b�z�" �   9An���� b��z@" �   7��j�� b�~z�" �   7,����� b�~z@" �   '7,��� 7��j  ����� +  R6632#"&'7326654&##5&&#"#�dȒf��J����jzސB�D:6f>Z�B�n� <vPfz2�j�r8`D�Zh�|��d�B|R�^��*.^�d�>�  P  ��   S!!#!PD�:��8������ P  ��" �   8� � *�� P  �\" �   7� �j�� P�t��" �   76�  �� P�V��" �   7��  �� P  �@" �   7��j�� P����" �   7,�    P  ��    A!"#54663!!##5!���D>�H�ZL �8��ZF8VV�H������ P����" �   7:�    2��V�  )  A!5!&&'3326654&&#&#!!36632#l��:v�|�R�L\�TV�`^�(�f��62�J��|����Dd�n@f<T�Z^�V>F��X&.|ތ��|  P  ��    A!5! #!3!26654&&#!5!Z��
    54	�ppؚ��j^�HH�`�f����d��~�l���N~HFrD�  b��z� 0  R6632326673#"&&546776654&&#"#z�܌�₾��ZzL\�bZ�^��暢�|�t�N�^V�V
    55	���df�x��408ZBLvB6jNx�dn�v��*(jdFl<4fF  P�h��    D33#"&&553!!#!�ZN6bR�T���D�:��8�:�D�Ztr���  ����   A#"$&5332665�� ��� ��^�tv�\��B�ꆆ���Ph�^^�h��� ����"    7�j�� ���"    7�"j�� ���\"    7�j�� ���\"    7�j�� ��`�"    76���� ����"    7�j�� ���@"    9K � �� ���:"    8�^  �� ����"    7-����� ����"    8�&��� ����"    8�&��� ���|"    8�  �� ����"    7,6���� ����"    7� �j�� ����"    7(�  ���L� 	   @#526653#"$&5332665LT��bl,����� ��� ��^�tv�\p�b�@|bV�B�ꆆ���Ph�^^�h��� ���L�"   7�j�� ���L�"   7,6���� ���L�"   7� �j�� ���L�"   7(��� ���L8"   7� �j�� ���L"    7��v�� ���h"    7@��� ���"    7�$j�� ���""    8�&��� ��\�"    7��   h��j� '  R75!5!326654&&'5!!#"$5h����^�\xֆ��x\�`�Ґ���ܸ��ܤt,^
    56	��(�䂔�������(ʠ
    57	Z��������@��� ����"    7��  �� ���8"    7� �j�� ���:"    8�H  �� ����"    79L��  $  �   e33#3����������X�  �R�� )  S#"&&546767332654&'&'��44&@vTRx@,6,*����&0$&. ,
    58	����t8r0nh*Ll88lL0ttb`���$&$TN",. "Vb@8  b��n� !  D&&53326654&&#"5632#���L�`b�J$D40<>X�P��nؚ��$j�FF�j�@J �P�l�f��n�� $���"    7,�  �� $  8"    7� �j     2�   S33333### �.2�4.��t����º��l��l��Xz����    2�"%   7��j��    2\"%   7��j��    2@"%   9Kl ��    2@"%   7��j��  ��2�"%   7, ��    2�"%   7�^j  &  ��   A33###3lr��:���������.�RV�,�,J������ &  �@",   9K4�� &  �@",   7��j  $  �� 	  S33#�����������`�����RV  \��&   !  S3#$!5!26654&&#!#!3#\��~�rN�f8�P<`�B>�f�������db��`�r�DtHPt@������(
    59	�� $  ��"/   7� �j�� $  �\"/   7� �j�� $  �@"/   9KJ�� $  �@"/   7��j�� $����"/   7,�  �� $  ��"/   7� >j  &  N�    A3#	>&#|""�x�D.|�F.$@:�~���"��PNT"�&*����TT�� $  ��"/   7���� $  �8"/   7� �j  h  Z� 	  w!5!!!p
    60	�����������z��� h  Z�":   7� �j�� h  Z�":   8� � ,�� h  Z\":   7� �j�� h  Z\":   7� �j�� h  Z@":   7��j�� h��Z�":   7,�  �� h��Z�":   7:�    ���Z�   ,  A3#'6#"&&53326657#"&&53326657�ĺ
    61	jR��l�T�4P2d~6Z��T��l�T�2N2d~8Z��XЄ�VȤ��l�2Z�f��XȢ��l�2Z�f  ����   D&&55!#3!332653#��x����������vԌnؚ��z��|��$����p����l  ^�hn�    A#3$554&&#"6632 5.�ІL�R�zl�F@�j� ���R���h@�t�Z�6��\L�f~22����2��V��"��� �  �" �   7� �j�� P� ��" �   9Ap  �� �  ^" n   7� l  d�lh�    A4&&#"56632#3�L�nf�HH�l�������ltl�B84�2>l֚����  @����   ?  @##"&&546633332654&##>54&'5##"$5466733�����������������TZ\p�d���(���f�n\ZV�d(Zb��ddƐ��b����������"b\Zf�T�v̰��v�T�fZ\b"  h�(f�   S!!2#54&#!5!h����Z�F�<F�.
    62	�����zH�VV6F\���� $  @"    7��j�� ��V�" @   7�H  �� h��h|" �   8�0  �� h��h�" �   8�:��� h��h@" �   7�j�� h��h|" �   8�:  �� $  �"/   7� �j  $�H`     E#33##!5ʢ�������R�R(������X��B6��  h�H0`  %  A3# &&#"326673#"$54$32#���~�.v�`��zzԄ`�x������ޤ�"�����`����H��������H�`��r�R��P�r֔  P�H�`    A3#!!#!t��~��D�:��8`��`���  F  ��  !  @66554&&#"#>32##53#3Zz02zfDh:�n�|��ll؜,,r���b�b�`�d8fDr�f�𐒐�D�  .  �   ) -  A!2#!$6654&&#!!6654&&#!!!!���b>jDF�Xfڦ��z�@J�Z��X8�J:|\��B�*r���d�nX|JX�np�d�<dBJ~H��>pJBf:�&��� ������    A!5!#"$&5332665��.Ҳ�� ��� ��^�tv�\�v`�B�ꆆ���Ph�^^�h�  \  *�  	  A'3#!#3�4�����
    63	�6���X��  ��H`    E#3!!!!!!̢���n�F��t������������ B��^�" �   8�t �    ��     S5!!2#!5!26654&&#!#!#3f��jjޤ�t�r�BB�r�д����4��tpʄ��p�BzXZ�D��� ��   �    A!5!33# ��*����������
    64	v(�`�����RV�� �  z�" �    ��    H���� "  @#"&&554$7326654&&'7��ddȒ��hj���JvBPp:FtJ8���~��p���6�P�*�.���~x�ZB~Xh�\�  Z��<�  	  )  A377#3&&546632#>54&&#"3Z���z*|��*�ZZ�Zb�TZ�\*D&&D**D((D*���R4
    65	B��DZ�ZZ�Z`�TZ�Z�$H02H$$H22F$  h�Xl�   @&&'.##5!5!3277#�v^JNt�XL
    66	�����Z�nF:JR,4DZ0�X4NBJ\>�����nNZD6>(�
    67	��P  2� ,  ���  �� #F  ��b��*� ) �  ���  � 1  ��  �� @|  ��(  �� `�  ��R��(� c �  ���  �� n �  ��h  � v�  �� P����"7�    �Z  �����2� ��  ���  � �F  ��@  �� ��  �� �  �� �Z ���   � � �  ��@��@� � �  ���  �� �V  ��@�x@� � �  ���  � �R  ������� �T  ���  �� �P  �������  �  ��P  2� ,  �� 8  J�% ��t  �,N  ��\  (�/8  ���  ��:`  ��f  �7�    ��~~*  ' / 3  D&&54663!2#!$6654&&#!"3!3##!5�ZZ��L��ZX�����n,,nl��jn..njL��,�*�����>�Z��N��XX������Z�,njLln,,nl��jn,P����dL��  ��~~*  ' 9 C M  D&&54663!2#!$6654&&#!"3!!2#!$654&&##36654&##3�ZZ��L��ZX�����n,,nl��jn..njL�*J��PD.T4@�^���L$D.��>$F@���Z��N��XX������Z�,njLln,,nl��jn,RxbJ\4\>Dh<�>4&:"�f6"2<�  ��~~*  ' I  D&&54663!2#!$6654&&#!"3!&&#"32667#"&&546632#�ZZ��L��ZX�����n,,nl��jn..njL�6T4Dh::hD4R6
    68	�
    69	`�dp�df�p`�d��Z��N��XX������Z�,njLln,,nl��jn,bH$D�\\�D$D0P�PjĆ��hH�^  ��~~*  ' = A  D&&54663!2#!$6654&&#!"3!5326654&&##532+3�ZZ��L��ZX�����n,,nl��jn..njL�f�Xt::rV��~�bb������Z��N��XX������Z�,njLln,,nl��jn,�@�``~>�f����fR  ��~~*  ' 3  D&&54663!2#!$6654&&#!"3!!!!!!!�ZZ��L��ZX�����n,,nl��jn..njL�H.�tn����΂Z��N��XX������Z�,njLln,,nl��jn,R�ކ��  ��~~*  ' 1  D&&54663!2#!$6654&&#!"3!!!!!#�ZZ��L��ZX�����n,,nl��jn..njL�V$�~^����Z��N��XX������Z�,njLln,,nl��jn,R�ކ��  ��~~*  ' M  D&&54663!2#!$6654&&#!"3!&&#"32665#5!#"&&546632#�ZZ��L��ZX�����n,,nl��jn..njL�6L2Dh<:jF@\2"�\\�jv�bf�n^�d��Z��N��XX������Z�,njLln,,nl��jn,n@ D�\\�D0X<|fl�VjƂ��jH�T  ��~~*  ' 3  D&&54663!2#!$6654&&#!"3!3!3#!#�ZZ��L��ZX�����n,,nl��jn..njL����������Z��N��XX������Z�,njLln,,nl��jn,R��d��f��  ��~~*  ' +  D&&54663!2#!$6654&&#!"3!#3�ZZ��L��ZX�����n,,nl��jn..njL�����Z��N��XX������Z�,njLln,,nl��jn,P  ��~~*  ' :  D&&54663!2#!$6654&&#!"3!#"&&533265�ZZ��L��ZX�����n,,nl��jn..njL�D~TLxF�4 6:�Z��N��XX������Z�,njLln,,nl��jn,R��Rx@6lN 2FBR  ��~~*  ' 4  D&&54663!2#!$6654&&#!"3!333##�ZZ��L��ZX�����n,,nl��jn..njL��D���H��^��Z��N��XX������Z�,njLln,,nl��jn,R������,hp�  ��~~*  ' -  D&&54663!2#!$6654&&#!"3!3!!�ZZ��L��ZX�����n,,nl��jn..njL�`�t��Z��N��XX������Z�,njLln,,nl��jn,R�6�  ��~~*  ' 7  D&&54663!2#!$6654&&#!"3!33#####�ZZ��L��ZX�����n,,nl��jn..njL�^�
    70	�ƚ�n���Z��N��XX������Z�,njLln,,nl��jn,R��Z��@��>��P  ��~~*  ' 3  D&&54663!2#!$6654&&#!"3!###333�ZZ��L��ZX�����n,,nl��jn..njLH��x�����Z��N��XX������Z�,njLln,,nl��jn,6��P��6  ��~~*  ' 7 G  D&&54663!2#!$6654&&#!"3!#"&&546632.#"32665�ZZ��L��ZX�����n,,nl��jn..njLd�rp�ff�pr�d�:fFDf::fDFf:�Z��N��XX������Z�,njLln,,nl��jn,$�hjĆ��hhƈ^�BB�^\�DD�\  ��~~*  ' ?  D&&54663!2#!$6654&&#!"3!!2##5326654&&###�ZZ��L��ZX�����n,,nl��jn..njL�2D`�FF�`Ծ6H""J6���Z��N��XX������Z�,njLln,,nl��jn,RH~TR�J�&D..B&�4  ��~~*  ' 7 ; K  D&&54663!2#!$6654&&#!"3!$&&546632#3#&6654&&#"3�ZZ��L��ZX�����n,,nl��jn..njL��ff�pr�ff�r4���h::hFDf::fD�Z��N��XX������Z�,njLln,,nl��jn,�jĆ��hhƈ��h*���D�\^�BD�^\�D  ��~~*  ' = A  D&&54663!2#!$6654&&#!"3!!2##532654&###3#�ZZ��L��ZX�����n,,nl��jn..njL�8B`�FF�j��RPPR���Դ�Z��N��XX������Z�,njLln,,nl��jn,RB|RTx@�DDDH�4���  ��~~*  ' U  D&&54663!2#!$6654&&#!"3! &&#"#"&&'3326654&''&546632#�ZZ��L��ZX�����n,,nl��jn..njL��(B,.D$N@Nr�L�fb�R�`J0J*JL`�R�X\�N��Z��N��XX������Z�,njLln,,nl��jn,�22.6vhJr>>xT@B4".2<�Lr@@pJ  ��~~*  ' /  D&&54663!2#!$6654&&#!"3!!!#!�ZZ��L��ZX�����n,,nl��jn..njL��������Z��N��XX������Z�,njLln,,nl��jn,R��6�  ��~~*  ' =  D&&54663!2#!$6654&&#!"3!#"&&5332665�ZZ��L��ZX�����n,,nl��jn..njLLV�hh�V�.T68V.�Z��N��XX������Z�,njLln,,nl��jn,R��Z�NN�Z*��4P..P4  ��~~*  ' /  D&&54663!2#!$6654&&#!"3!33#3�ZZ��L��ZX�����n,,nl��jn..njL�V
    71	ز����Բ�Z��N��XX������Z�,njLln,,nl��jn,����P  ��~~*  ' 7  D&&54663!2#!$6654&&#!"3!33333###�ZZ��L��ZX�����n,,nl��jn..njL�"�����������Z��N��XX������Z�,njLln,,nl��jn,R��f��f��J��  ��~~*  ' 5  D&&54663!2#!$6654&&#!"3!33###3�ZZ��L��ZX�����n,,nl��jn..njL�V����
    72	��������Z��N��XX������Z�,njLln,,nl��jn, 2�X�X0����  ��~~*  ' 1  D&&54663!2#!$6654&&#!"3!33#�ZZ��L��ZX�����n,,nl��jn..njL���̶�ʠ�̂Z��N��XX������Z�,njLln,,nl��jn,R��t����8  ��~~*  ' 1  D&&54663!2#!$6654&&#!"3!!5!!!�ZZ��L��ZX�����n,,nl��jn..njL���N|�N����Z��N��XX������Z�,njLln,,nl��jn,dh�b���  |��>0 (  d#"&&5546632#.#"3276675!5! t�z�怂䐐�h
    73	�FvPX�XV�^(<@`���rN8xֈ���vZ�jBZ,P�V�X�R*���~  |��f  <  A546632&&#&#"#"&&5546632#.#"3276675!5!�6jP8
    74	.@$v�z�怀䐐�j
    75	�FvPX�XV�^(<@`����t`�D�D6t��N8xֈ���vZ�jBZ,P�V�X�R*���~  d  L     A!5!#3!5!L���Ȓ��~�����  P      a!5!#3��,��Ȝ�  �  �>   a###333�� �����>��  ���X0     7  a!5!#3!5!!5! &&55466323"&'&&#"32763"#X��h�������V��h���vvڐDZ0l06\0(V*Z~@@�Z:l^d2l.VF�������Ќ����
    76	�f�fh�f
    77	�
    78	  �  .    A##!5!26654&&###!�2��̶�`\�x��B>V(,^F������ R�^\�T�0L*,L0��  �  .    A33326654&&#!5!2#&4�������F^,(V>��Bx�\`�~ ������2N**L.�R�^^�T    
    79	  	   A3#'#3#3,��Zt |$v�Z�����6PJ����  V���L 1  @326654&&#"#>32#5##"&&5467677�rz�:hB^�H6nRb~�r�v^���R�Xh�b��r�ZV8L(JzFRFb2PBX�J8���4�*N6P�f��
    80	��� V���"�   7�p �� V����"�   7� �  �� V���^"�   8� �  �� V����"�   #7� �   7,�  �� V���^"�   8� �  �� V����"�   8�z�� V����"�   8�~�� V����"�   7�~ �� V����"�   7�~ �� V���n"�   8� �   V���� 1 : J  @326654&&#"#>32#5##"&&5467677#53#&&546632#�rz�:hB^�H6nRb~�r�v^���R�Xh�b��r쒤�袴8  8 "8  8"�ZV8L(JzFRFb2PBX�J8���4�*N6P�f��
    81	���&����6 44 6�������r"�   8���� V��B�"�   8�z��� V����"�   8�,��� V���"�   7  �� V����"�   7�� �� V���"�   8�z���� V���L"�   7,�  �� V���"�   8��  �� V���"�   7�� �� V���d"�   7� �� V����"�   7� t�� V����"�   7� �  �� V�Z�L"�   7�&  �� V���P"�   7�� ��� V����"�   7�  �� V���"�   8� p�� V�n�L"�   4�4  �� V���L    j��dL  ! 4  @#"'5>32.#"3266554&#""#'6632d`����`�~��`�6t\Xr@�~\v6�J&$<$BX. |� �
    82	�V��z��.��\`�lL��n�t.��P:�@�p����� V����"�   7�T �� ����X�H>�   V���L $ [  D&&'6632!5!4&&#"3267#&&54667663663"326654&&#"#>32##��z8ʎ|Ԅ���H�X`�NT�dd��z�l�d�bv�r*H��"<Rp>:hB^�H6nRb~�r�vN��>v�^P�^ ~�l��H�\�R^�Zbx�XVR,R|FP�fv�4�$H88N(JzFRFb2PBX�J"h`�b<f<�� V���"�   7��  �� V����"�   7��    ���d�  &  S33>32#"&&'##326654&&#"��(4~`��vvЈ^~>"��H�`d�HF�fb�H���<@>����� �@H4���hl�vt�hd�z  ^��$L  ;  R632#52654&'.#"'#"3"&&5467>32��NV�lX@P>xT$ Zx8>@.:z:.FRfDH "Px@P@rn�\P�<|�Ph��(p�TBd8�(2��f\.*&~.<��z�0(�8dBT�tв|ND~������d�"�   8��H�� ���d�"�   7��  �� ���d�"�   7,�    ���d� ) 9  D&&'##4663222"&#&#"3>32#>54&&#"38~>"�L�P.
    83	0F((4~`��vvЈJ�HF�fb�HH�`@H4��\�D�@6��<@>����� ��l�vt�hd�zz�h�� ���d�"�   7:�    ���d�   *  A!5!!33>32#"&&'##326654&&#"��`��Ь(4~`��vvЈ^~>"��H�`d�HF�fb�H
    84	���<@>����� �@H4���hl�vt�hd�z�� h��h�" �   3Y�^  V���L !  D&&54632#.#"326673#��x|ޒt�t�DjF`�RP�b@jH�p�v���� �T�f4V4d�z|�f,V:b�Z�� V���"�   7�x �� V����"�   7� �  �� V�V�L"�   7�>  �� V�V�"�   #7�>   7�x �� V����"�   7� �   �����L  6  D&546632#.#"3$67>32#526654&&#"'��z|��t�v�BlF`�PP�`��f���^~>j�r@j<"2b�zx� ����T�f4V4d�z|�f�br��<nH`�N�*J,",���h�� V����"�   7�`    V����  5  A546632&&#&#" &&54632#.#"326673#FL�P".
    85	
    86	0F(���x|ޒt�t�DjF`�RP�b@jH�p�v��\�F�B6������� �T�f4V4d�z|�f,V:b�Z  J�R�L #  @6673#"&&546632#.#"3bhB�t�n��jl֘|�j�<hDfz22zf��4Z4\�b��ސ��d�l>f<h�d�"b�h  V���  &  D&54663233#5##>54&&#"3��vv҈`~< ��"<~`z�HF�dd�HH�d� ����>H4�X�4H@�h�zz�dh�tv�l�� V��R�"�   9N�  �� V� �"�   9AH  �� V�t�"�   76�  �� V����"�   8���� V���"�   7�X ��� V���"�   7,�    4���L # 6  S5!&&'&&'.5546632#&&#"326655��"T t�Xp֒��phƆ0\x0>:|^\|<fJ6b�@���"Nd��h������tȀ,Pt8t
    87	�bb�rj�0\�^  V����  * :  D&5466323## 66322&#"##56654&&#"3��vv҈`~< TT"<~`HN�R.
    88	(BH�6<ΌHF�dd�HH�d� ����>H4�4H@�B�<H�d�\`��h�zz�dh�tv�l�� V���"�   7:�    V�h��  ( 8  @&&533277## &54663233#5##>54&&#"3:�L�VH2��vv҈`~< ��"<~`z�HF�dd�HH�d�hF�\B��NB��� ����>H4�X�4H@�h�zz�dh�tv�l  V���   *  A!55##"&54663233&&#"32665��`�"<~`��vv҈`~< ��F�dd�HH�db�H����X�4H@� ����>H4�X��dh�tv�lh�z  V�R� 7 G  a5##"&&54663233!#"&&'3326654&&##5! 326654&&#"rB�^��vv҈`~< ���n��dtԌvĄ�
    89	P�NZ�JL�f�n���H�db�FF�df�H�0N>������>F4��z��r�x��hD�x6\6L�LJ�P���`��lh�zz�dh�t�� V����"�   F    V����  " 2  e5!5!!!&54663233#5##>54&&#"3rd����h���,�vv҈`~< ��"<~`z�HF�dd�HH�d������� ����>H4�X�4H@�h�zz�dh�tv�l�� V����"�   I    V�B��   * A Q  e326654&&#"'7>32##3!5!5!!&54663233#5##>54&&#"3�tPp:,,RRL"��V���^DrBV��p^��`���������vv҈`~< ��"<~`z�HF�dd�HH�d�.H&$<hn2�Zx�v:jBH�h����洊 ����>H4�X�4H@�h�zz�dh�tv�l  V��   ,  A' &&5466323.'7 #>54&&#"3T.H.�
    90	�vt�xp�,$�ڞH�,�tؐd�HB�hb�FB�fFjj���얖�jLf��PxV���t����^�fb�pd�hd�f  V��L %  D&&54632!5!4&&#"326673#��||ޒ|Ԅ���H�X`�PT�d>dF�x�n�����l��H�\�R^�Zbx�X"6$R|F�� V��"�   7�p �� V���"�   7� �  �� V���"�   7�~ �� V�V�"�   #7�:   7� �  �� V���"�   7�~ �� V���n"�   8� � �� V�tL"�   76~    V��� % . >  D&&54632!5!4&&#"326673##53#&&546632#��||ޒ|Ԅ���H�X`�PT�d>dF�x�n���袬8  8 "8  8"�����l��H�\�R^�Zbx�X"6$R|F��&����6 44 6������r"�   8���� V��B�"�   8�z��� V���"�   8�,��� V��"�   7  �� V���"�   7�� �� V���"�   7�X  �� V��L"�   7,�  �� V��"�   7�� �� V��d"�   7� �� V���"�   7� t�� V���"�   7� �  �� V��@"�   8��  �� V��"�   8�� �� V�\L"�   7�F �� V���L    V���L  4  @#"&&'3326654&&##53'32654&&#"#>32##ڶFr�~��v��vPzB<rJ����tv<nJj��p�z|�h>���6RxF\�PT�f\X*L24R0PBPD2L*XJb�JL�dDrN  J���L  4  D&53326654&&##532#532654&&#"#46632#��p���Nt@<pJ~���Dp�~p~rv:jF���rޞ|�h>������*L24R0PRxF\�PpPD2L*ʺ��L�dDrN  V��TL  / I  A%33667#"&&'#"&&'3326654&&##53'32654&&#"#>32##` 6*@$L`4���Fr�~��v��vPzB<rJ����tv<nJj��p�z|�h>���b2&&DX2zBjJ�RxF\�PT�f\X*L24R0PBPD2L*XJb�JL�dDrN  V���L  4  D&&546633#"32653#&&546632#4&#"33#��rF����Hp>BvL���pܞ��@j�|��p���Dj<vr��P�\FxRP0R42L*�ʶ���NrDd�L���*L2DPp  H���L %  D&'73266554&&#"!!546632#d�Fx6�P\�F<vVDh<J��f��vxܔhf^FHZ�n(|�`B�`�V������(��  4�R0�     @6632&&#"#'7326653#NV�n6H46P*��F$<:P(�T�p��R�,V>�t����,V>��tr�R  P�h�� % 5  D#"&&546632'.#"326653'46632&#"�6�nX�LJ~P:jb4�p�8VR& 2,(: ��N�n4H
    91	*66X0��TBvJRt>:,�x�8H(0,0 l��tvt�R�
    92	,V>��  ^�h��   /  A327#"&&5$6632#"&&56654&&#"3�B@  B\|@�,Z�Z\�ZZ�ZZ�ZxD&&D**D((D*�� `R
    93	�
    94	N�n���XX�\Z�\\�Z�$F22F""F22F$  4�R0L  #  a4&&#"'66323267#"&&5P*P:4">p�T*P64"@n�T�<V,�P�r���<X,�R�r��� V���"�   7�T �� V��L"�   79�  �� V��T�l>� �� V��T    2��T0 & :  @#"&&55%3266554&&#"'>3%3327#"&&'d�x��z��^���2lTNxBF�\X�2x(l�d� 6*$D:N`4�0��*�����>��hH~PZ�z*`�\JD`:Z8��2,@T.x BjL�� ���x>l  �� ���x�"l   7� �    ��hj> 2  A#"&&546632%&&#"326654&&##55!5�z|�h���n�lJ�^z�\`��H�\0J&HxDx�JN�Z�h��>��.n�lv��H�^Nt@dL�r�<J. ,@ `�JN|H��
    95	�  |��Z> "  D#"&&5466755!!#"326673R�ڄ��t�|�|^��hv~�LR�ZT�T�t�\n�zv�tЄ�
    96	�P�P�RVx>4fF  J�P�>  1  A#5!5326673#"&&5467>54&&##732���hp�Ґn`BlF�fĈz�h��X\&(XFL@x�b\��Xd(>x�|D���L$TDZ�dP�\��(&8,&4�F�TZxJ6>&  $  ��    A!5!$6632&#"#p��L�bL�^D0*ZT����~D�NT�T��� $  �@"   7� �j�� $�h��"   ��    8��z� / 3  @&&'.546632#4&&#"#"$'732665#3�(dZ~�Zd�t|�b�0^@BZ,.bT��Xf�|����J�*pDb0�2��F>.LtTT�TX�\*R2*F&(6&RzV\�Pj|�~d&@(���  �  ��        A!5!#3#3!5!#3#3������������������x��6��6�x��2��2  V�RL $ 4  @&&'332655##"&&546632353#6654&&#"3��v
    97	��t��@�`��xv҈`~8(�zԊ\�HH�dd�HH�d�RJ�dRT���0J>������>@<�����VX\�xv�bh�pr�`�� V�R"   7� �    4�RP> $  @&&5467332654&'&&'3#�zB,��(&.&&, 2��0>vT�R8jL X.X�P JF"*, "Pd���.V"Lj8�� V�RL"   8��f�� V�R�"   7� �  �� V�R�"   7� �  �� V�R�"   7� �  �� V�R|"   8�p j�� V�RL  �� V�R�"   7�r    V�R��  : J  A54663222&"#&#" &&'332655##"&&546632353#6654&&#"3rJ~P,0F(���v
    98	��t��@�`��xv҈`~8(�zԊ\�HH�dd�HH�d�\�D�@6��FJ�dRT���0J>������>@<�����VX\�xv�bh�pr�`  J  ��  ! %  e!5!&66554&&#"#>32##53#3��p�|42|h<h@�v�n��jjԜrr^�Ў��j�`,d�h4X6\�b��,���  d��� # '  @&&'.53#"&&5332665!5!�&82BV<�,B6>L4f�z��h�Fj<Bb2$��D><**FtT��6L0 ":`H\�Pb�ZDV&&@(r��� J  ��"(   8� l�  J����  !  A532#"&&'33266554&&#3#3�,��jjԜz�l�:hBf|42|hn��Ġ��Z���f�l<h>j�`Zd�h�  J  ��  !  A#"&&5546632#.#"3'3#R.��jl֘|�j�<hDfz22zfj�����0��d�n@f<h�b0`�j���� V�R�"   7� �    r�X�L  )  @6654&&#"#466325$ 5>54&&'7l�x,T@@`4�h�~v�\����tl������l8(j�z�\<P*,T8h�RP�d��*�������2�,x�x@fHd  �  ��   a#336632#4&&#"6��(�|r�Z�<pNR~J���X`Z���N�Tz>D�\����  ��"+   8��04�� �����"+   77�  �� ��V��"+   7�� ����  �\"+   7��&j����  �@"+   7���j�� h  �@"+   7�  j�� �����"+   7,�    ��h��  ' ?  a#"'&'53265554663222"&#&#"#336632#4&&#"�J�R0
    99	JR�NL�P,JZ��*�xp�Z�:nNP|Fr\�F�BNr>Z\�D�BNZ��>�X`Z���N�Tx@D�\  �  ��  -  S54663222"&#&#"#336632#4&&#"�L�P,JZ��*�xp�Z�:nNP|F>Z\�D�BNZ��>�X`Z���N�Tx@D�\�� �����"+   7:�  �� ����>+�>�   F�h\L 4  R762323266533277#"&&5##"&&54&&#"5T$R�J<pNR�H�VH
   100	0P�L(�zr�\(F0 HD�\�pTx@F�\��PNB�F�\Z`Z���6@�  F�h�L &  R76232326653###"&&54&&#"5T$R�J<pNR�H��(�zr�\(F0 HD�\�pTx@F�\��*DZ`Z���6@�  �����  ,  S336632#54&&#"#&&55332653#��(�|r�Z�<pNR~J�Ĥ`�zR^�X������X`Z����Tz>D�\�tbʖrr���j�����T��� h  Z�";   7�    �  6>   S3#���>���� �  ";   7��  ����  �":   8��0������  
   101	�";   7��.  ����  �";   7��&  ����  �";   7��&  ���  �";   7�  ����   �";   7���  ����  "�";   8�  $�� h��b�":   7,B  ����  6";   7���  �� �  �d";   74 ����  �";   7L t����  ,�";   7��0   ���ZV�   *  S3#&'4667326767#&&546632#���2p4rXRLV"( L08  8 "8  8">���ZbX6hb(<6d:""|�6 44 6 ��  j�  !  S3# 66323265#"&&'&&#"'�����:b<.,$6 *6�8d> 2$2"(4�>��r>>,
   102	Hn<>.��������":   79X  �� h�h�":   M�  �����hX�"N   7��  ���h6>   A#"#52326656F�h2@ >�tf�P�(L6������h�"N   7��$  �����h�"N   7��$   ���h��  ! 1  R&&54663!!"326653#3#&&546632#��FN�P�� 40&4�B�Xr��88  8 "8  8"�hDvHPx@�0.,@ `��R�X����6 44 6�����h>"N   8��.���� 4�R0�"   8�  ��  �  �  
   103	   A33#3#7#("�������x�^�����Xx�r�� �  �"T   7��j����  \"T   7��&j�� �� �"T   9A"  �� ����"T   7,�    �  4>  	   a#3#'337#b�ȼ� �~��v�
   104	�>���������  �  ��     A#333#546632"&#&#"�������V���XL�P<0F(����h����0���\�D�@6��� ����"T   7:�  �� ���>T">�   �  6�   a#36����� �  �"]   7��j  \��Z�   &  A5%#323#"&&'&&#"5663��������4�`<� &@RD"��n6&"
   105	@������0���&F6��$�TT2(�����  �"]   8��0 ,    *�     R&&546632#4&#"3!!#3��NF�VZ�B�<806 ����F@vNHvDH�T��|2B00������ �  n�"]   9N  �����t�"]   76&  �� 8� 8�"]   9A�  ���h�� % )  e326654&&#"'7>32#"&&5#38&<""26$*H8*�n�.nr6N|FF�Xf�@������8 4 ". 2*�p�0B @tNLvBZ�PR���� �  ��"]   7�(���� p��b�"]   7,B  ������*"]   #7,B   7��.j�� ��h2�"]   M�  ������.�"]   7:B   ��  ��     a#3 66323265#"&&'&&#"'|���H:b<&8*$8 *6�:d> 2$".$(6���r>>,
   106	Hn<>.  ��h
   107	�    D3277#"&&5537#36TJ0P�L����B�F�\rrr� ��  ��    A5%#3�� �����~��v�  ��Pt�  $  A# 326654&&##55!5!#"&'7J�"~J\�NN�\�h��X�z��h~��p�F~��Z��x0L�^^�H��
   108	���.p�~��vD<|  �  "L *  S3366323>32#4&#"#4&&#"#��$�jFpR^�Ld�T�|`Jl8�6`>@pD�>�X`*R<:R,R�~�*�rl>lF�>�<^2DzN�Z�� �  ""o   7��  �� �  "�"o   7�t  �� ���"L"o   7,�    ��h"L  =  a#"'&&'5326553366323>32#4&#"#4&&#"# J�R0
   109	JT��$�jFpR^�Ld�T�|`Jl8�6`>@pD�r\�F�BNr>�X`*R<:R,R�~�*�rl>lF�>�<^2DzN�Z�� ���">o�>�   ��h">  .  a3##5##"&&'##"&&53326653326653z����"�jFpR^~Nb�T�|`Jl8�6b<BpB��h��X`,R:8R.R�|��,pn>lF��<\4FzL�  �  �L   a#336632#4&&#"6��*�xp�Z�:nNP|F>�X`Z���N�Tx@D�\�� �  �"v   7�r �� �  ��"v   7� �  �� ��t�L"v   76�  �� �� �L"v   9A8    ��
   110	�L % =  e326654&&#"'7>32#"&&55#336632#4&&#"�$<""26$(J<$�n�.lp8N|FF�Xf�B����*�xp�Z�:nNP|FhT 6"4 ". 2(�p�0@ @vNLtBX�N,h>�X`Z���N�Tx@D�\�� �  ��"v   7�Z  �� ����L"v   7,�  �� ��h��"v   Mt  �� ��h�L   ���hL  '  a#"&'7326553#336632#4&&#"ZJ�R$,JR���*�xp�Z�:nNP|Fr\�F�BNr>�X`Z���N�Tx@D�\�� ����L"v   7:�    ��h�L  )  D3273#"&&553%#336632#4&&#"�TJ0P�L��L��*�xp�Z�:nNP|F�B�F�\rrr>�X`Z���N�Tx@D�\�� �  ��"v   7�V   ��h�L  '  a#"&'532655!#336632#4&&#"�J�R". JR����*�xp�Z�:nNP|Fr\�F�BNr>�X`Z���N�Tx@D�\  V��2L    D&&546632#>54&&#"3��||⒒�zz��j�FF�jj�HH�j�������������p�pp�pp�pp�p�� V��2"�   7�~ �� V��2LD  �� V��2�"�   7� �  �� V��2�"�   7� �  �� V��2�"�   7� �  �� V���n"�   8� � �� V��2�"�   #7� �   7,�  ������2r"�   8���� V��P�"�   8� ����� V��2�"�   8�:��� V��2"�   7&  �� V��2�"�   7� �� V��2L"�   7,�  �� V��2"�   7�� �� V��2d"�   7�   V����   (  @#526653 &&546632#>54&&#"3���DH���||⒒�zz��j�FF�jj�HH�j�v8bN�\�������������p�pp�pp�pp�p�� V���"�   7�~ �� V����"�   7,�  �� V���"�   7�� �� V���d"�   7� �� V����"�   7�b �� V��2�"�   7� �   4�h�L $ +  d673#"&&5546632#&&#"3#5738D �>�p��lj֚J�f&�H.dv2B|T������^�tHT���(���$F0�@�j�p(r�X���|���� V��2�"�   7� t�� V��2�"�   7� �  �� V��2@"�   8��  �� V��2"�   8��   \���L  7  @3266553#"&&54$36#"&&553326654&&#5d�`(ZJ:Z6�R�r��P�<��<�N��p�R�6Z8L\(`��tʊZ�dB�p����p��~�������~�pؚ��p�Bd�Z��t��� V�Z2L"�   7�(  �� V�Z2�"�   7� �    J���L "  @3266554&&#"#>32#"&&'3@jBbx46zbnx�j�~��jlҒx�r�Z6j�`6h�j�vz�h���6��d�^  V��2r   #  w6&&546632#>54&&#"3��l�
   111	��||⒒�zz��j�FF�jj�HH�jdJ��&�������������p�pp�pp�pp�p�� V��2"�   7�~ �� V��2�"�   7�b �� V��2�"�   8��  �� V��2�"�   8�� �� V��FL"�   �0    ��hLL  &  S33>32#"&&'##326654&&#"�� <~`��tt҆^�@��H�bd�FF�fd�H>�4H>����� �@J2��>�hl�vt�hd�z�� ��hL"�   7� �  �� ��hL�"�   7��    ���P�  # '  R6632#"&&553266554&&#"3#�vܒ��vvܖ��v�B�\^�@@�^\�B�����������������ff�nn�ff�n���  ��hNB  % 5  R6632&&#"#333>32#"&&'##326654&&#"�B~X:(
   112	2F&�� <~`��tt҆^�@��H�bd�FF�fd�H�t<
   113	�2&�4H>����� �@J2��>�hl�vt�hd�z  ��hJ�   )  A#6632#"&&'#3 &&#"3266'6..��<~^��ttΈ^�BTT\F�fb�HH�bd�H���������@� F>������>N0�� �hd�zz�hl�v  V�hL  &  e##"&546632353#6654&&#"3l"<~`��vv҈`~< ��ΌHF�dd�HH�d�4H@� ����>H4��*h�zz�dh�tv�l  V�h�B  % 5  @6632&&#"###"&546632353&&#"32665rD~X:(0F&�"<~`��vv҈`~< ��F�dd�HH�db�H�t<
   114	�2&�*>4H@� ����>H4��*2�dh�tv�lh�z  V�h�L  $ + ;  @&&5533277## &5466323##53$6654&&#"3<�L�TJ
   115	2��vv҈`~< TT"<~`H:4����HF�dd�HH�d�hF�\HHNB��� ����>H4�4H@,^����h�zz�dh�tv�l  �  �P   S336632&&#"#���`2(
   116	@L|H�>�Td�BtH�T�� �  �"�   7�� �� X  ��"�   7�� �� 6� �P"�   9A� ����  �"�   7n  �� �  ��"�   7� �  �� n���P"�   7,@  �� B����"�   #7,@   7��   �  L   s46632&&#&#"�R�R:0L0*\�B�@4��  $�h�L   A4&#"56632`N8R�R�h�N@�B�\�>�� d  ��"�   7� t�������P"�   7:@  �� ��B>��>�   T��Z�    A3#'$3326677#"&'5�����"Nn>4D�l2��*�
   117	>lJ��|
   118	�  �X>  !  @&&553327##5##"'5326653d�J�PN(Dr��`2(>N|F��XD�\��LN���Rf�BtH�  V���L -  @&#"#"&&'3326654&''&&546632#�n\Bh<\^���d��z�j�tfLr>V\���f�vn�d
   119	�lN*L.6L("�r^�TF�bNN(L2:N&"�l\�RJ�X�� V���"�   7�D �� V���"�   8�` �� V����"�   7�R �� V����"�   8�\ �� V�V�L"�   7�  �� V����"�   7�R �� V� �L"�   9A  �� V����"�   7�,  �� V���L"�   7,j  �� V����"�   #7,j   7�,    �  D� 0  R6632##5326654&&##5326654&&#"#�j�|z�n|j\�Pj�~��Lr>D�T~ZDj8<rLHrB���^Z�rx�&\�dr�f�<nFJt@�FtBDn>:jF��6  �  �@    R6632&#"#&&546632#�L�^D0*ZT��8  8 "8  8"*~D�NT�T��6 44 6  $  Z�    S%6632&#"#$���L�^D0*ZT�����L~D�NT�T�  V���L  >  S327#"&&5 &#"#"&&'3326654&''&&546632#�4R2(2R�J|n\Bh<\^���d��z�j�tfLr>V\���f�vn�d
   120	���4>�D�\(dN*L.6L("�r^�TF�bNN(L2:N&"�l\�RJ�X  �  h�   s46632&&#"�R�h$F"(8N(�r�R
   121	
   122	�.X>�x  .��tB    A!5!327#"&&5d��6�&>*244DL�V����BF�@�Z6  .��tB     S!!!5!327#"&&5.6��6��6�&>*244DL�V҂^���BF�@�Z6�� .���2"�   9NF F  .���B  G  A!5!32667>32#"&&54632#.#"326654&&#""&&5d��6�"6 (\^,L��TXx<j�p��xzޒt�v�BlF^�RP�`@pB2*8fb86~�LR�L����6B(H0Nh:>nH\�R���� �T�f4V4d�z|�f(L4&(P@>b8D�d�� .�V�B"�   7� �  �� .�t�B"�   76�  �� .� tB"�   9A �    .��`B # '  A326654&&#"'>32#"&&5!5!�">$ 680&d�vl���XX~@H�Zf�@���6B�� 6 2$0>�|p��JBrHLzDX�P$�l�������t�"�   7��� ��� .��t�"�   7� J ��� .��tB"�   7,�    �hD�   ( 9  A!5!%326763#"&&546632&&#"#"'732665��N���0*Lp>^t2�V�n6H46P*T�p6F4:P(����6@
   123	�
   124	J�d����r�R�,V>�zB��r�R�,V>v  2����   *  S546632&&#&&#"!5!'326763#"&5�R�R6
   125	
   126	.@$���B�<2$ D.n�8�\�B�D6���<��NB���4�� .���B"�   7:�    J��� $ (  S!!6636#"&&57326654&&#"!5!�D��$t6t�XV��b�z�6b@Lb.0bFJ`
   127	��(�D��$V�tj�`H�d2N*4\>@\46.��  P��r�  & *  A33>32#"&&'##326654&&#"!5!��(4~`��vvЈ^~>"��H�`d�HF�fb�H��
   128	���<@>����� �@H4���hl�vt�hd�z��� V���LC��  � @   .�h~B   &  e#"&'5232655!5!327#"&&5~J�R".JT���6�&>*244DL�V���\�F�DN�*���BF�@�Z6  .�RxB    A!5!3267263"&&5d��6�(<* "@,J�V���V@H�@�Z�  2  T  6 :  A33#"&5 &'&'.546632#4&#"#!5!265!5!�0 R�n��.B$L~�\`�x|�b�jf\f0\P��Tf�|�z�nf����
   129	� 6@�����2BN|Z\�V\�hXr^J0:$TvR^�H�8B���� D���L��>�   ����>   A3#5##"&&53326658��*�vh�Z�<lDB�T>�¸Xn\����ZLt@B�^�� ����"�   7�p  �����>    A!5!3#5##"&&5332665��2�����*�vh�Z�<lDB�T2���¸Xn\����ZLt@B�^�� �����"�   7� �  �� �����"�   7�~ �� �����"�   7�~ �� ��t�>"�   76�  �� r���"�   7  �� �����"�   7�� �� �����"�   8�v $�� ����>"�   7-�  �� ���� "�   8�� �� �����"�   8�� �� ����"�   8�z���� ����>"�   7,�  �� ����"�   7�� �� ����d"�   7�   ����n 	 !  @#5266533#5##"&&5332665�:�~VL��B��*�vh�Z�<lDB�T��Ht*RV0�¸Xn\����ZLt@B�^�� ����"�   7�p �� ����n"�   7,�  �� ����"�   7�� �� ����d"�   7� �� �����"�   7�T �� �����"�   7� � �� �����"�   7� t�� �����"�   7� �  �� �����"�   8�� �� �  �"v   7�� ����  �\"+   7��&j  V�h�� % < L  e326654&&'&'7>32#"&&5 &54663233#5##>54&&#"3$<$"2, <2��l�.jp6P|FF�Xh�@�2�vv҈`~< ��"<~`z�HF�dd�HH�d���,D"2 0 ��r�.> @tNLtBZ�NR��� ����>H4�X�4H@�h�zz�dh�tv�l  B����   ?  @##"&&546633332654&##6654&'5##"&&5466733���������������X`l�f��(��f�l^Z��(X`��ddƐ��b����������p�fr&�b�z��NP��z�b�&rf�p�� V����"�   7�X  �� V�VL"�   7�:  �� V��2"�   8������ V��2�"�   8�� �� V��2�"�   7�f  �� V��2"�   8��  �� 4�h�":   7�n   T����   $ 4 D  @#"'532.#"3266553#' 6632#"&&5532675&&#"�h��Һ��f�8x^v�"�v^v6�Bƶ�Df����Ҹ��h�6x\v�"�v^x8r���< �����d��؆�d�p��X������� <�������d��؀�d�r  T�l�L   % 5 E  A73# 6632#"&&5532675&&#"#"'532.#"326655���Df����Ҹ��h�6x\v�"�v^x8zh��Һ��f�8x^v�"�v^v6v����^����� <�������d��؀�d�r����< �����d��؆�d�p  V�h��  %  S#3 &&54632#.#"326673#������x|ޒt�t�DjF`�RP�b@jH�p�v�h@�B���� �T�f4V4d�z|�f,V:b�Z  V�h�L  B  d3267#"&&'7 &#"#"&&'3326654&''&&546632#(hR<""D DBL$<dT.̈�n\Bh<\^���d��z�j�tfLr>V\���f�vn�d
   130	��F"��:(r,6bLfPjN*L.6L("�r^�TF�bNN(L2:N&"�l\�RJ�X  j�hr>  "  d3267#"&&'.##53#5!5!�^8$,4&@D(j@:X@,2LpL$<,�^��H���LjR28$t(:4L>HV<�������  x  �L    R6632##532654&#"##xh�zz�`P��2,j``hdn��.�b^��r�`|~tx��z��J�  V�h�  )  S#3 &&54632!5!4&&#"326673#������||ޒ|Ԅ���H�X`�PT�d>dF�x�n�h@�B�����l��H�\�R^�Zbx�X"6$R|F�����h�"8   7�� ����  �P"�   8��0�J  4�h>    A!5! '5326677333#��D���, $,:: �n�((��40�t���b�HJRF��^�&~~�� �  �>  �� �  �>    �  &�  	    a!5!#53!5!#3&���f�dT�(��r�����������    J�  
   131	      % +  A3#73#3!3#73#'33#73#3!3#73#'3rZ
   132	�N X����V P�V~Z
   133	�N X����V P�V���J��:�Ƃ�������H��8�Ȅ���    ��    s46632&#"!5!�T�nF8 <8P*���D�r�R�,V>�z.��� �����   8  ��     A!5!#3#3��N�����d��p�����X�  H���� #  @#"&&554 7326654&&'7��ddȒ��hz �F��hHvBPr:FvH6���~��p���6�\b�H����>x�ZB~Xh�\�  P�X�>   )  A'36654&&#"3&&546632'73#�X����B&&B*,B((B,^�\\�X\�X|0��XZ�Rr�����$F22H$$F42F$�Z�ZZ�ZZ�Z4���Lp<  J���L "  @3266554&&#"#>32#"&&'3@jBbx46zbnx�j�~��jlҒx�r�Z6j�`6h�j�vz�h���6��d�^�� ��Z�>"�   7�H    b��hL 9  d654&&'&&54663"#"&&546676654&#523�*��2PZ�¾�\P4��*����p,TH,DV,4fP�(<*J82Jd<l�tt�l<fJ08J*<(�Pf4,VD,HT,p��� �����"�   7�  �� �����"�   7�T �� �����"�   8��  �� ����>"�   79�    4  >   a#333v��p�((�>��^�� 4��>"(   7,�    v���L 	    D&5336654&#"'6632#5P��pbfn*,2(:p4XX������p�~��~�rB8�R~\���ܤ�� 4  �"(   7�: �� 4  >(<>�   4  >   S33333###4��
   134	��������>��<��8��<���� 4  "-   7�T  �� 4  �"-   7�b  �� 4  �"-   7� �  �� 4  �"-   7�<  �� 4��>"-   7,~  �� 4  "-   7� �  �� 4  �"-   7��  �� 4  >-8>�   ��l*L    A#3325>554&&#"jȸx�Ą�`��������<|\PtD^�l��6��0����J�*�Ж0j�bH|NN  F  �>   A3##3���^���� �V�����������\ �� F  ��"7   7�� �� F  ��"7   7�,    4�h>   R'5326677333#�, $,:: �n�((��40�t�h�HJRF��^�&~~�� 4�h":   7�V �� 4�h�":   7�d �� 4�h�":   7�� �� 4�h�":   7�>  �� 4�h>":   7,����� 4�h":   7��   4�h0<    R&'7667733>32&&#"#�F*BZH �n�( P|R6`&.$6*<0�d.�t�h�JPRF��Z�X" x0`T��~~�� 4�hd":   7r �� 4�h�":   7� �  �� 4�h�":   7�: �� 4  �:<>�   j  �>   w5!5!!!jd��.��f���������� j  �"F   7�D �� j  �>"F   8� \�b�� j  ��"F   7�R �� j  ��"F   7�R   j�B�>   *  e326654&&#"'7>32##3!5!5!!�vPp:,.RTN ��T���\DtDV��r`��^��H����.H&$<np.�Zx�v:jBH�h������� j  ��"F   7�,  �� j���>"F   7,h    b��>   D&#!5!5!!2#58<N��^��F��d\�D�^^�����J�Tb6�� j���>"F   7:h    j�X�>    a327#"&&55%5!5!!!�VL(2R�L�Td��.��f���N<�D�Z������������ZL��  �������d  ������L��  �����~��d  ������L��  ���  ��h  ����R�Lp  ��  x�+�  ��J  <�:�  ����h:�M�  ��:  ��T�  ��l  �]�  �� �  �Lol ��  rLv�  ������L�|  ����h�L�p  ����h�L�p  ���  
   135	P�\    ��h�P    s3#336632&&#"#�����`,F:0N|F��h֦Td�
   136	
   137	BtH�T  ��h�P  %  @&&5533277#336632&&#"#X�L�TJ0���`,F:0N|F��hF�\rrNB�֦Td�
   138	
   139	BtH�T����hL��  ������B�d  ����n>��  ���  �>(�  �� �  �>- �  ���  �>7�  ����h�>:�  ��  t>F�    \�X~ %  @#"&&55!!3266554&&#"'663�`h�Zn�PZ�Z$L6:R(4\><T,p*�n~`�lz�bd�n`�2L,8pRFf642fBR�� ,����2\  �2�� ,����2`  �2�� F� ���  �2������ ���  �2�� ,����2e  �2�� N����  �2�� N����2h  �2�� ���2i  �2�� ����  �2�� �����3^    J  ��  !  @66554&&#"#>32##53#3X|42|h<h@�v�n��jjԜrr^��j�`,d�h4X6\�b��,���  �  F�   a#3F���  v  �    a#3#3������Z�����  4�"y   '8��F
   140	 8��J�*�� �  p�"2�   8�� .  Z  ��       a7#3#37#3��N����Ј��ʈ�(�P��Dʈ���� ���v��v��� ��  Pz�    A33326654&##532#t������4F DF��Z�DH�\4P���F
   141	��20<�DvHDvH  P@^�  "  R32673#"&'&&#5 #"&&53327~6JJ,8hB�4<D�$"p^l�b��$8bJ`��" 
   142	�  xz��  &  A#46632&&#"6632#4&&#",�D:08
   143	(D@xPPn<� 8*4H".z|Jd8
   144	�&���`>�h��BR$<fB  2l��    R32653#"&'53#'^6LJ.:fB$ⴊ*p^l�b�Z���  N���   S#336632#4&&#"昔pPJp>�&F..L*����>F@xR�.�2J((N4  F� ��    S3#&&546632#P��6((((��,6(&&& ��� ��    S##5326656&&546632#�:nL ".4&&**���H`0x,b&&&(  N� ��   S#3昘��  N���   S#336632#4&&#"昒tJJr>�&F..H*��|>F@xR�.�2J((N4  N���   S336632&&#"#N�h@,(4R0��z<F�(N8�X  .��� ,  @&#"#"&'3326654&''&&546632#�L>$>&6:|bbN�V���L@*@&28zbbF�RR|L�
   145	8, .bJBh8th46,"0
   146	fNB`42^B  ��   S33333###�������ʤ�
   147	��������,��  ���   A3##3b���ޞ����Ԟ�������nf  ���   R##76677333#�*>0��������x^��
   148	&$:���<��Tb�� ,���2\  �� ,���2e  �� $  �     �  ��    S!!!2#!$6654&&#!!�l�Hj��ppښ��~�HH�`��j���Bd��~�l�N~HFrD���� �  �� #  �� �  ��  �� �  �"�   7� �j  �  �   S!3!#����H��D����� ����"�   9P  ����  �"�   8��J ,�� ���j�"�   8�*    $��r�    w3667!3#!#!$\6R:
   149	 `���
   150	����PD�0��b���\���h�>���j�� �  � @  �� �  �" @   7� j�� �  @" @   7� j  &  (�    a#33!3#!#�����R�vx��R���z���x���L�����H������ ���v�2�    �  �   A33###R�������j�Xh����� �  "�   7�.j�� �  �"�   7� �j�� ����"�   '7�.j 9O^��  �  ��   A##333#؄������\���h���r�>��� �  ��" �   7� �j  $  ��   w72667!#!##$*Zd.x���
   151	F��6�r����X����Ң�� �  2� �  �� �  � n  �� h��h� �  �� �  ���  �� �  z� �  �� h��0� )  �� P  �� �    $����   w32667733##�Z2H0�
   152	��j��
   153	"L�j\�(<(6R��|�DRjD�� $���"�   7� �j  h����  # '  @##"&546333326654&&###3���������������XX�x�x�VV�x�ж���������������f�~|�ff�~~�f�f��� &  ��,    �  ��    A3267#"&&5!#bH�dp�bj����r&���fz4"�" XĜ��X�  ���t�    A##5!3!3!`�d2�,������V�����X  �  ��   A!3!3!T������������X�  ���>�    A##5!!3!3!*��N���������V�
   154	�����X�  �����    S3!3!#3��Դ��x������X���  �  ��   @#!3!26654&&#!5!Z�ppښ��j`�HH�`�f�Jd��~�l���N~HFrD��� �  ��"�    v�    P  ��    S!! #!3!26654&&#!5!P��PH�ppښ��j`�HH�`�f����@d��~�l���N~HFrD�    ��  '  w32667!!## #!3!26654&&#!5!(Tb6���F��6��ppښ��j`�HH�`�f��`���������ԔJd��~�l���N~HFrD�  �  V�    S3!!# #!3!26654&&#!5!��T���n�ppښ��j`�HH�`�f������TJd��~�l���N~HFrD��� b��z� �    h���� # '  D&554$32#.#"326673#!!��������^�Vt�fb�n\�b����dZ���,���<�rڔ^�L�𘈎�L�\��t0�  h����  '  A!5! 3266554&&#"#>32#"&&'3��V�N�rx�T^�xh�P�~➰�������r��N�H�䌞��~J�h��z���Ȥ��֤z֊�� �  T� v  ����  :@" v   7���j�� B���� �    P  *�     A!5!4&&#"56632!3���N�H�dn�dj�~��r�ڴ��X�hz2  �" X���X�� ���\�" v   f3�|Z,�@   ��    j  |�    a!"3!!"&&54663!#���p�DB�p��t��llޤ�����dD�ZXzB�pƂ��p�X��v�  P����      A6632#'26654&&#"5#3!5!�N�D��|vܚb�JN�fX�NV�����D.jȊ��j�B|TZ�D$"������  ���2� $  S332653326653#"&'#"&&5��<`:h|�t^@h>�l�vb�24�ft�d���Nn8~v$��v~8nN$�܄�\FDDF\������  ��"�   8��X�  �����  % )  A!5! &&#"32667#"$54$32#3�$�$v�b��zzԄ`�v������ޤ�"�����������F��������H�`��r�R��P�p֒��    ��  	    s#3'73#!5!#3����
   155	`~��,�N������
   156	��X����  d  z�        A!5!#3#3'73#!5!#3����������
   157	`~��*�L����������X��
   158	��X����  N  ��     R63!2#4&&#!"#!#!N������<vb�$^x>�l�����j��N�����fhv22vh��f2�����  �  (�   # &  S3!!# 63!2#4&&#!"#!#!��$�ܴ�������<vb�$^x>�l�����j����v���N�����fhv22vh��f2�����  j�L�@  5 >  @##5326654&#!5!##"&&5463326654&##5373#53P�xxڐ��b�:����&��xvҊ0FD\@Pp���*Tx>���������b����\�pn�^x>jFlx��bV�~��d:2BR�0�v|~@vP��t����
   159	�� �  V��  �� h��h��    $  4�   @6633#"#33FdJ2$,�X����N�|B�8<�|��B��� $  4�"�   7�j�� h�h	��" �   #�  �� &��Z�"�   9P`  �� ��Vv�"�   7��  �� �����"�   9P�    �  ��    A#3!3#!#f��شTN�����������z���x��.�*t��    ��    A!5!##333#����������\�
   160	����h���r�>��� �����" n   9P�    �  >�    A!'!!3!3#!#>�����b��������|��X��z  j����    a#!#!32#'26654&##���,�>м�lҖd�>�������~z����b�p��  ����� 7  D$5546632#"$55463"326654&&#"3����f�vx�d���Ȳ��r̄J|Hp�z��~<f><h>�"��D����������ȴ�4�Į��r�|Ȏ愆�j�Z^�f������� h�J0�" )   7������ P����" �   9P|  �� $  ��/  �� $  ��"/   8� ����� &����",   9P�    P����  	   A!5!##5!3!3!��^���d2�,����
   161	��V�����X�� �����"�   9P�    �  ��     A#33267#"&&5!#����jH�dp�bj����r&�.���fz4"�" XĜ��X��� �  ���t��   l����  .  @3"&&53 $554632!5!54&&#"3267#~lx�`�<�����V�T�ll�Vh��L�L.<�r�~�\�t�Δ���"�����r� ��lrԒ��l($�*2�� l�`��"�   9P>���� �  T� v  �� &  ("�   7��j  �����    A32#'26654&&##333##�Ҷ�p֒\�Fb�~�������t�.�� ���\�r��b��x���p�� $��x�"�   9O��  ��h�    a#"'"'522326553!3#!#L�T4JR�P������rZ�H�DPn��|��X��z�� �����" n   9OF���� �����"�   9P�  �� �����" �   9Or���� $  "    7� �j�� $  @   �� $  &�    �� �  " @   7� �j  V���� &  @#"&55!!3266554&&#"'>32(���趪����L�x��Z\ΤZ�F0j�\�����T��ʮ�$�~�z�n��T���*�* �� V���@"�   7� dj�� &  (@"�   7�hj�� ���v@"�   7� Fj�� ���x�8% �� �  "�   7�0j�� �  @"�   9K � �� h��h@ �  �� h��h��  �� h��h@"�   9K � �� h���@"�   7� Pj�� $���"�   7� �j�� $���@"�   7� j�� $���L"�   7�v�� �  �@"�   7� �j�� �  �"�   7�,�����X�"�   '8��J , 8�: �� &�X��",   8�0  �� &  ��",   8� �   N��|�    D&54632#4&&#"3#3���������N�^l�TV�b|����"��vڌ^�LhĄ��~�n�������  ���    �  z�    A7!2#!5!26654&&#!#:��ւ����llܤ��Xp�BB�p�д�T�RxΆ��z�N�XZ�L���� V���L�    V��$� & 6  @"#36632#"&55467632667 6654&&#"3�p|pp�R6�v��txڒ��zpަ*LLJFT���JJ�d`�LN�`B(d��dbx즨����r�H�j�b�xv�VV�vv�d  �  �>   &  S!2#!$6654&&#!!6654&#!!��v�^pbBrHV�n� 8R,*R:��\`2pd��>F�V^p
   162	DxRT�L�&B.8R*���&D0FL��  �  *>   A!#!*�����`>�� �  *"	   7�   �  .J  	  A#3!#!.��������V�`>�� ���*>"	   9P �������  *>"	   8��0�b  ����>    S32'>54&&##!#!���`�n*Hp>R�^�\���xvԈl���XxBZ�N��`>  ���>    w3>7667!3#!#!Z(6$$�����"��64�*d�r0��`�*8�������F�� V��L�  �� V��"�   7�� �� V����    F  >   A33333#####��N�hX�Vh��R����T�R���(�2��2�������.��.  F��zL 3  d326654&&##532654&&#"#>32#"&&'3 8d@Fl>4bB��`b.X>>d<�f�pr�^dT>\4h�xr�j��D"&N:6P,�VD0H(&D,X�LN�VXt
   163	FrD`�PL�X  �   > 	  A3##3<Ĭ��Ƭ>��B��>���� �   �"   7� �  �� �����"   #7� �   9O@���� �   "   7��   �  >   S333###���p��L������>�*�������8�� �  "   7�B   *  �>   w32667!#!##*&DF$ت�t@�v:�J�������~��x  �  2>  
   164	   A3#3#3!3#T��,��6�r�X��P��>��>���>��  �  �>     A!5!#3#3b��V�Ԭ����Ξ��>��>�� V��2L�    �  �>   S!#!#�Z����>����`�� ��hLL�  �� V���L�    J  �>   S!!#!Jx�����>��`��� 4�h>:  �� 4�h�":   7�l   V����    $ /  A3#&&546633#7#"332#>54&&##3F����||�44j�HH�jx4��zz��l�FF�j���\���������0p�pp�n�b�������n�pp�p���� F  �>7    �  �B    a#3#"&&533267Ҫ���f|�d�>jFb�`>�:$Z��^��Pl4$"��� ���~>/l>�  9P�    �  �>   A!3!3!6������>�`��`���>  ���\>    A##5!!3!3!H��R����������8���`��`���>  ����>    e#!3!3������H�\�H>�`�  �  �>   @#!3!26654&&#!5!Ҳ\\�|�6�@f88f@��:�V�fb�^>�`0T68X0��� �  6>",   ;     $  �>    A!5! #!3!26654&&#!5!P��,J�\\�|�6�@f88f@��:���zV�fb�^>�`0T68X0�  J  �>  '  w32667!!## #!3!26654&&#!5!J(DF$.�x
   165	@�v:h�\\�|�6�@f88f@��:�J�����~��x�V�fb�^>�`0T68X0�  �  �>    S3!!# #!3!26654&#!5!��X�����Z\�|�6�@f8xf��8>�Z���J�db�^>�`0T6TR��� V���L�    ���L  %  A!5!6&&#"32667#"&546632D���DjF`�PN�bBhH�r�v��zzޒr�v����V2d�x|�f.T:`�X� ����T�f  V���L # '  @#46632#"&&53>554&&#!5!�rJ�t�h��nnԐt�l�Fp>Z�FD�\l�&��:^6^�f���(���h�l<j@p�\(^�p�(��� h  Z�:  ����   �B  �����hX�M  ����  ��,    :���L    '  A!5!#3 &&546632#>54&&#"3���@�R��h�||ޒ��zz��l�FH�lj�FF�jƞ��>���������������n�pp�nn�pp�n  B  �>    A!"3!!"&&54663!#3#��@^2.V:\��p�X\�t���`��̺�(L42L(�N�bd�N���� ���h��  * .  a#"'&&'532655!#336632#4&&#"!!�J�R0
   166	JT�(�|r�Z�<pNR~J�rr��r\�F�BNr���X`Z���N�Tz>D�\��  ����> &  S3326653326653#"&'#"&&5��4T.:^8�2T64Z8�`�lZ�,.�^h�Z>�B\00\B��B^.0\B��v�RFBBFR�v    Z    A!5!#!3!26654&&#!5!��J�N�\\�|�6�@f::f@��8(���V�fb�^Z�D0T68X0�  b��xL  % )  A!5!6&&#"32667#"&546632#3:��V�DlF`�PN�`BjH�r�v��z|ޒr�v��@�����V2d�x|�f.T:`�X� ����T�f�
   167	>  
   168	    	    s#333#!5!#3����V*T�����N�����B����L�  x  �>        A3#3#!!%3#3#!!�X�������\��.l���Z����L���B��>����x�r>�����  l  >    # '  s5463!2#54&&#!"!5!#3#'#3#3l��:���4fV��Th4��b�V��nv ~"v�j�p�Ȝ���䜜jx00xj����VJD���2  ~  �>    ! & + /  A!5!#35463!2#54&&#!"!5!#3#'#3#3��$��d��(��:���2hT��Th4��d�T��lv|"v�j�n������>����䜜jx00xj����VJD���2 ���L�  5 >  @##5326654&&#!5!##".'466332654&##5373#53��lnȆ��Lp:4dL��$��h��0DH�PPt@L�l*lv����@����b���>H�TT�Ht&H2.>����^�X66jH�$fx>Tp:VRRXtި
   169	��
   170	
   171	�� ��0b>+    V��2L   #  A!5! &&546632#>54&&#"3��
   172	����||⒒�zz��j�FF�jj�HH�j֒���������������p�pp�pp�pp�p  4  dL   S3>320&#&#"#�(�NZ2>2""�Ȳ�p>��xVl2�
   173	* ��>�� 4  d"E   7*  �� V�hjL"�   #b  �� F��H>"   9PN  �� F�VzL"   7� �  �� ���,>"   9P2    �  ^>    S3!3#!##��&6���f��������>�*�������8.��,  J  R>    A!5!#333###H��t��p��L���������*�������8�� ����>"   9P�    �  l>      A!7!!5!#3#3l�B�����V�Ԭ�����������>��>  ����>    A!2'>54&&#!!#!#���N��6Vt8^�`����Z����xpԎP���TtD\�Jf����`  Z��zL 7  D$5546632#"&554663"3266554&&#"3��̤L�^`�L�욎�zX�d.P0T�Vd�Z$B*(@&~���~z�jr�|������P��x�R�TPr�pj�n�P|D@rJ�v�j��� V�V�L"�   7�>  �� J���>""   9P���� 4�h�>  �� 4�h�>"   8� X���� F��>"7   9P    J��*>  	   A!5!##53!3!3��L��:����������8��>�`��� ���|B"'   9P���  �  �B     e#3#3#"&&533267z��X����f|�d�>jFb�`�*��>�:$Z��^��Pl4$"��� �  ��+    $��:L  -  R3"&53 &&54632!5!4&&#"326673#�bf����||ޒ|Ԅ���H�X`�PT�d>dF�x�n�j����������l��H�\�R^�Zbx�X"6$R|F�� $�V:L"Z   7�^  �� �  T� v  �� F  �"   7�z    ��>    A!2'>54&&#!333##��^�l,Hr@X�f��x�l����¬fpȀh�z�Vt@R�Hv�*����8�� *���>"   9O2��  ��X�>      D#"&'73266553!5!#3#3⨘ 4<(D(����V�Ԭ�������,R6VV$���>��>�� ����>"   9O$���� ����B"'   9P*���� ����>"   9Or���� V����"�   7� �  �� V�����  �� V���L�  �� V���"�   7� �  �� V��T  �� V���"   7� �� F  �"   7� �  �� F��z�"   7�� �� ���x>�  ���� �   �"   7� �  �� �   �"   7� �� V��2��  �� V��2LD  �� V��2�"D   7� �� V����"3   7�� �� 4�h�":   7�n �� 4�h�=  �� 4�h�":   7� � �� �  ��"'   7�� �� �  6�"-   7� �  �����X*>"	   '8��0�b 8��r    F�X�> %  A33#"&'73266'.'#����  ����
   174	 F�`"0.(J$�� � �H�����*PT.V�V�6hF44&�^�� F  �>"7   8� \�b  V���L    D&&5546632#4&&#"3#3��nnҎx�j�<jBXt66vZn�����(���h�xJt@l�l(^�j����    Z    A!5!#!3!26654&&#!5!��J�N�\\�|�6�@f::f@��8��.V�fb�^Z�D0T68X0�  ��hLL   *  e733>32#"&&'##326654&&#"8r��p��� <~`��tt҆^�@��H�bd�FF�fd�Hlrj��4H>����� �@J2��>�hl�vt�hd�z�� *���>"   9P����� $  �   �� �  �� #    �  �   A!#!�H�l���  $  �    A3!%#6���������X����� �  � @  �� h  Z�:  �� �  � n    h��h�   #  A!5! #"$54$32&&#"3265��^R��޺��ޤ�"��"��z҆��zzԄ��z��������R��P������������������ �  T� v  �� �  �� �    $  �   s3##$���R�R��X��B�� �  2� �  �� �  � �    @  ��     w!!!!!!@��jV��R��|��0���� h��h� �    �  ��   a#!#!��,�>����� �  z� �    r  X�     a!5!!5!#553X�l�,�x�����~��4~*�:��0�F�,4��B�� P  �� �  �� $  ��/    V  f�  # '  d$&546$332##$6654&&##"33#3���������������bb�t�v�dd�x���������\�pn�ZZ�pn�Z����� &  ��,    �  V�    A##"$&53332665#3V����"�����h�v"x�h�������������′ZZ���X�  h  j� '  w!5&54$32!!5>54&&#"!h,���$��$���.��`�\xԄ��x\�^���^,��>��������^��*�ₖ�����*��� $  "    6�N �� 2  �# @ �   6� �� x   # n �   6��  ��  �    a#3%3#������tv�Z�� �����   #  @#"$54$32&&#"32653#���޺��ޤ�"��"��z҆��zzԄ��z�,�tv�����R��P����������������.����   #/.   6�  ��  r ' +  w!5&54$32!!5>54&&#"!3#p,���$��$���.��`�\xԄ��x\�^��|�tv�^,��>��������^��*�ₖ�����*�������  :@ }  �� $  �@3    �  0�    A!5!#30���8�������  \  ��      A#3#3#3!5!����d��ִ����Bl���v����� �  ��    h�lh�   #  A#3 #"$54$32&&#"3265B��&��ܺ��ޤ�"��$��zԄ��zz҄��z�l������R��P����������������  ����� *  D654&&'%.554$32#&&#"5�8$�Ę�f��������x�V��HPd2J�d�((
   175	f2�␦�*�pؘ��rڞ���2rFZ<JpD�  �  �      A#3#3!5!!5!�������V��n\�6��r����ޞ�  $����   -  S'&&#"76632 &&547327#�>4"4��2NT&d�H8�H��J8�\TR"
   176	$$����HB6HD�J�d2F������R�Nd^�&��h(HT�  �Xn�   #  R$32#526554&#"#%''&���D����ܦ�tx�x�t�BP�N�>�P
   177	���d��f���rڸ�8�h�N�`��Ҍ�H���R�  B����  	   a#3'3'%7��
   178	��(����tl�
   179	|t��J���(��|�����  J  �� '  A.##"'76632>32&&##"#.��
   180	 
   181	&04ND��8P<"8"&
   182	 �β0��
   183	
   184	"RJ�
   185	�DP*
   186	��h������  x�#� �   6��H���� J  �@"�   7� Hj  h��h�   #  A!5!#"$54$32&&#"3265�� ����޺��ޤ�"��"��z҆��zzԄ��z��������R��P������������������ �  @� �  �� h��0� )  �� �  2� �    @���� !  @3266554&&#"#>32#"&&'3(��z�VN������䐲 ��������*�tޚ���v����p���ʠ��Ԥr֔�� h��0�" )   3Y�j�� \��$�" �   3Y�j�� $  �"    9S��� $  �"    8�, ���  �"    8���  ���`  �"    8���  ���j  �"    8���  ���H  �"    8���  ����  �"    8��"����  �"    8��"�� $  �"    8�� �� $  "    8�
   187	 �� $  "    7� �j�� $  "    7� �j�� $� �"    ��  �� $� �"    #��   9S��� $� �"    #��   8�, ���� �"    #��   8���  ���`� �"    #��   8���  ���j� �"�   ��  ���H� �"    #��   8���  ����� �"�   ��  ����� �"    #��   8��"�� "  �# @ �   9S���� 6  �# @ �   8�� �� 8  ��# @�   8�� �� 8  P�# @8   8�� �� 6  F�# @.   8�� �� 6  h�# @P   8�� ��   l�# @T   8�� �� �  8# @    8�� �� j  @�# n8   9S���� ~  2�# n*   8� �� ~  ��# n�   8�  �� �  |�# nt   8�� �� |  p�# nh   8�� �� |  ��# n�   8�� �� ~  ��# n�   8�6"�� ~  �# n    8�6"�� f  ��# n�   8� �� �  d# n\   8� �� �� �" n   �  �� "� ��# n �   #��   9S���� ~� 2�# n*   #�.   8� �� ~� ��# n�   #��   8�  �� �� |�# nt   #�v   8�� �� |� p�# nh   #�l   8�� �� |� ��# n�   #��   8�� �� ~� ��# n�   #��   8�6"�� ~� �# n    #�   8�6"�� j  j�# v   9S���� ~  \�# v   8� �� ~  ��# v�   8�  �� �  ��# vR   8�� �� |  ��# vF   8�� �� |  ��# vh   8�� �� ~  (�# v�   8�6"�� ~  2�# v�   8�6"�� f  ��# vl   8� �� �  �# v:   8� ����  $" v   7��Hj����  F" v   7��Jj ������   )  @#"$54$32&&#"3265 '66553Ԥ�޺��ޤ�"��"��z҆��zzԄ��z��\VL(&������R��P����������������0�0<,hDJP�� 6���# � �   8�� ������Z�# ��   8��h  ��������# ��   8��0  ��������# �F   8��X  ��������# �\   8��d  ������*�# � �   8��n  �� J���" �8  8�� �� N  t�# � �   8�� �� &  �#/&   8�� �� (  D�#/T   8�� �� "  ��#/�   8�� �� $  $�#/4   8��"�� $  D�#/T   8�� �� &  6#/F   8��b  �� $  �"/   7� �j�� $  �"/   7� �j ��  �� ' 1  w!5&54$32!!5>54&&#"!'66553�,���$��$���.��`�\xԄ��x\�^��\VL(&��^,��>��������^��*�ₖ�����*��0<,hDJP��   ��#� �   8�� ����  <�#��   8��J  ����  ��#��   8��0  ����  ��#�x   8��<  ����  �#��   8��F  ����  r�#�   8��"����  |�#�   8��"����  �#� �   8��R  ��   �"�h  8��T  �� h� j�"�   �   ��� �� ' 9 C  w!5&54$32!!5>54&&#"! &553326323# '66553�,���$��$���.��`�\xԄ��x\�^���Z�
   188	$�&\VL(&��^,��>��������^��*�ₖ�����*�� X\��("d�0<,hDJP�� � ��#� �   #��   8�� ����� <�"   ��  ����� ��#��   #��   8��0  ����� ��#�x   #��   8��<  ����� �#��   #��   8��F  ����� r�#�   #�"   8��"����� |�#�   #�,   8��"�� B���� �    V���L &  D&5466323#&&#"326673##��pvԄ��6B�����T�LF�R`�Nv�~::Ď� ����������"��f�vt�j��Z"����  ��h �  9  @#"&'326654&&##53##5326654&&#"#4663�\r�~X�8D�TX�H@vL��F�f^��TPNt>BvFFxF�p�zFx�lz�t@LFtFL~LH|L�vl�b^�r�Bn<@f::lD�6�r�f  4�h�>   S3#�������>��6���R�(  4���� & 8  R6632&&#"#"&&5546675&&53266554&&'"�Z�rJxD4�BR\$^R��r֐��rV�V\jP<|Z\z<D~PZ|<(~D� <4:>J����ꈆ�p��&�\���``�dP�p`�f  V���L  4  A#"32673#"&&54663&&546632#&&#"33#��Hp>BzPv��vĀ~�rF����@j�||�p��jHn<vr��6P0R42L*X\d�TP�\FxR.NrDd�LJ�bJX*L2DPp  P���� " &  A'6654&''&&546673!5���8NH.TH�Pt>`Rh,0NDX��@t`����~�NHdp�ZHj(DT.D�FZ.\ 6(��t®pޠ�  ��h�L   a#336632#4&&#"6��*�xp�Z�:nNN|H>�X`Z����>Tx@D�\  H����   '  A!5!#"&554632&&#"326655h�N�hlʌ��ppʊ��l�D~RR~HJ�PT|Br������� ذ�����ذ^�hh̎��pnҎ�  ����>   A32763#"&50$8", B.l~>��.6
   189	���0�� �  4>Y    4��<�  !  D&&'''.'6632363###�\F��4,BZH,B&v�,r
   190	 $*��H��,XB�~nLH�z~� �������� ��h6>6!    4  >   S33673#4�8v~2��Ȯ>�x�(�������  p����  =  @&#"33#"&&546632#"'6654&&''.54663$h4VzBH�`����~v֊H�.6�v�T:rTn^p4`Pr<(>8<��\���.X>@Z0vT�fd�T��lvD�fJvP6L6H�FV@L(
   191	 p�t��d�� V��2L�    8���>     A!5!#3!3267421#"&5h��0���F$6 ,LDl|����>��.6���0  ~�l L $  R6632#"&&'73266554&#"#~rȀ��llȆj�d*n8~bZ|<��^|:���x������X�x�L�n`�b��n�b�<�  V���L )  @#4&&#"'6654&&'.554663��f�8dDX�HR�rpx.dLj8&>>��jtԌLd�~Pr<d�t(R�h<D0R�>X@F$ $$�ʄ(���  d��h  * .  R663#"&&553266554&&#"!5!dr؎("(V~BrԐ��t�<|\\x::z^Zz<<��,��
   192	
   193	"��j�䊌���ff�hd�``�d|�  ���>    A!5!!3267#"&5���x�� , 0.,V6rr����88� ��,  ����>   A32665&'3#"&&56<`<X�NF4�0BdҞx�b>�db~:n�rr$�\�Њ����`Ɣ�  V�hBL )  @6632#"$5466732665.#"#n8lN�܀�������~8lPhTX`ʘ��dL�\"$��d0��������
   194	�rƠ6�Lt�zv�ll�j(��  F�h�J  !  A333#"&&'#&&##5323#@N,$04**TfL*��ζv"*6**TdL,�4��T������2*�PP���,� TV�~@��  ��0b>    A32665&'3#"$5!#6t�z��dB4�0@|��������>���Zx�j~|`�■����
   195	����  Z���>  5  @326653#"&5473#"&&53326654&&'3pH6fD>\0�R�rx�\JL��L\�zp�R�2\<Fd6HD�̶�^|�`J�hF����p� ��
   196	xx����� �pؚD��f�J`�|^��r�� ����"   8� �������"   7���  ���J��dl"   6��� �� ����"(   8�X  �� �����"(   7�� �� ����l"(   6��� V��2"�   8�~  �� Z���",   8�R  �� V���"   8�|  �� V���"   8�N  �� ��h�"   8�r    J  �L    a4&#""#5632!5!LFB"R�R���*PH�
   197	B�\����  h  ��      a#3!5!#3#3h��N��N���P������B��B�  |��T>     w3#&533267#�R�������h� :(^�^� >������6@�  J���L "  @3266554&&#"#>32#"&&'3@jBbx46zbnx�j�~��jlҒx�r�Z6j�`6h�j�vz�h���6��d�^  J���L  1  @632#"&&5&&5546632#.#"326673#�<46<4$$2�jl֘|�j�<hDfz22zf>j@�t�pH<<.22�Ґ��(���f�rDn>j�j(h�l6b<b�f  J���L # 1  @3266554&&#"#>32#"&&'36&546632#<hBfz20zh>h@�t�p��hj֚z�l��>4"$2:6 Z<l�h(l�j:rRv�h���(���b�^T>.20 .>  J�l&L   #  A#3&&546632#>54&&#"3�����||����||��l�FF�lj�HH�j�l�V�������������n�pp�nn�pp�n  H���L ,  D654&&''.5546632#.#"5�B0 �h�^j֚|�j�:fFfz2>fH@T,F�j�.*(<f��B��h�zLr@h�bD^|HP8Z@Nt@�  ~�l�>      A#3!5!!5!3B����0V�z����l��T�t���H��  N  ��     A!5!#53#3B��n������&�|��<��X:  T�X2� 	    @  %7''������4�N�JL�P��N�P:��Z�b����d����������  V�|,L  & 7  s3 #"&'532654&'&&'.'74&&#"56632����� ($"N�`B RX"(,��(J8"@`�L>��b��:0b,R`zFj�P�
   198	T\Fp\.n44b~J��f�@N"�P�l��  ���@� - =  @#"&554632#"&'7326654&#"663326654&&#�lp֒��lr�Z�RB�pN�Z<Hz.4DBJl�D>�jl|L6v\^z<:xZ�hʎ��x�4�F�\�>xTDxN&� .0B���LV�B�Zd�RR�b`�@  r��^� 3  @#"$&5546632#"&&53326654&#"32670j4���V�bd�Pj����n�<pLHd6DD@F^�|.h,
   199	H���j�PT�r�X��jnʆ@��V�D@~\�d\RZj�b
   200	�  V�h�   '  D&&546673#3# 6654&&'#3�𠌢���XX�p|n�XZ�n|������������$t�lj�r
   201	
   202	r�jj�t  H���>   9  A!5!326653#"&5473#"&&53326654&&'3��V���H6dF>Z2�R�rx�\LL��L\�zr�R�2\<Fd6HD���p��^|�`L�f����p� ��
   203	xx����� �pؚ��f�L`�|^��p  b�� L   %  A3#&&#"56632 &&57327#�����n(J6$B^�N��P�(L4(B>��8N"�
   204	P�l�����P�j ��,@N"�
   205	  ��2@L  + =  @&&'&&55# &&'&&'&&5546632#>554&&#"3T8\V��v�T�z�x^��β�(p֒��phƆ6|<:|^\|:<z\�d8 �B�XZ��z *~zZ�\$$��������~�X�Xr�bb�rX�V�� V���L�  �����hX�M    .  2>    e!"&&554663!!"3!5!2�֜�hj֚*�֖||�n������(�솞Ȣ(��2��� ��hJ��    p�l>  
   206	   A3#3#3!3#��2��8�T�t����>��>���j��������l L"$   8��"���� V���&"   6�l x�� V���&"   6�H ~�� V���&"   6� � x�� V���&"   6�p~�� V���&"   6� � ~�� V���&"   6� � ~�� V����"   6�  x�� V����"   6� � x�� V���"   6� � j�� V���"   6�H  �� V���D"   6� �  �� V����"   7� �  �� V����"   7� �  �� V� �L"   �h  �� V� �"   #�h   6� � j�� V� �"   #�h   6�H  �� V� �&"   #�h   6�l x�� V� �&"   #�h   6�H ~�� V� �&"   #�h   6� � x�� V� �&"   #�h   6�p~�� V� �&"   #�h   6� � ~�� V� �&"   #�h   6� � ~�� V� ��"   #�h   6�  x�� V� ��"   #�h   6� � x�� V� �D"   #�h   6� �  �� V���&"   6�> x�� V���&"   6� ~�� V���&"   6�fx�� V���&"   6�B~�� V���&"   6� � ~�� V���&"   6� � ~�� V���"   6� � j�� V���"   6�  �� ��h�&"   6�b x�� ��h�&"   6�> ~�� ��h�&"   6� � x�� ��h�&"   6�f~�� ��h�&"   6� � ~�� ��h�&"   6� � ~�� ��h��"   6� � x�� ��h��"   6� � x�� ��h�"   6� � j�� ��h�"   6�>  �� ��h�D"   6� �  �� �� �L"   �   �� �  ) /  a#336632#4&&#"&553326323#53#6��*�xp�Z�:nNN|HFZ�
   207	$�nZ>�X`Z����>Tx@D�\��X\��("d���  �� �  ) /  a#336632#4&&#"&553326323#3#6��*�xp�Z�:nNN|HFZ�
   208	$�l��^>�X`Z����>Tx@D�\��X\��("d�:��  �� �$  ) 3  a#336632#4&&#"&553326323# '665536��*�xp�Z�:nNN|HFZ�
   209	$�\VL(&�>�X`Z����>Tx@D�\��X\��("d`�0<,hDJP  �� �$  ) 4  a#336632#4&&#"&553326323#3&&56��*�xp�Z�:nNN|HFZ�
   210	$~�$LV\>�X`Z����>Tx@D�\��X\��("dJ.L@<0�V  �� �$  ) / :  a#336632#4&&#"&553326323##53$'>5536��*�xp�Z�:nNN|HFZ�
   211	$4\��p��\VN"�>�X`Z����>Tx@D�\��X\��("d�4�Ƙ�0: @N,JP  �� �$  ) / :  a#336632#4&&#"&553326323##533&&56��*�xp�Z�:nNN|HFZ�
   212	$�Z��j�ְ"NT\>�X`Z����>Tx@D�\��X\��("d�4��:J.L@<0�V  �� �$  ) / 9  a#336632#4&&#"&553326323#3#&'665536��*�xp�Z�:nNN|HFZ�
   213	$0p��\\VL((�>�X`Z����>Tx@D�\��X\��("d�:�̤�0<.hBJN  �� �$  ) / :  a#336632#4&&#"&553326323#3#&&5536��*�xp�Z�:nNN|HFZ�
   214	$l��Z�^�$N>�X`Z����>Tx@D�\��X\��("d�:���VNJ,LB<  �� ��  ) E O  a#336632#4&&#"&553326323# #"&'&&#"'466323265'665536��*�xp�Z�:nNN|HFZ�
   215	$"*J0$4"* ,V*J.,& . .X�@8V �>�X`Z����>Tx@D�\��X\��("dzR02$.T22$��|(0(R2FD  �� ��  ) 3 O  a#336632#4&&#"&553326323#3&&5$#"&'&&#"'4663232656��*�xp�Z�:nNN|HFZ�
   216	$��X8>P*J0$4"* ,V*J.,& . .X>�X`Z����>Tx@D�\��X\��("d�F2R(0&|<�R02$.T22$  �� �D  ) G  a#336632#4&&#"&553326323#66323265#"&&'&&#"'6��*�xp�Z�:nNN|HFZ�
   217	$^:b<.,$6 *6�8d> 2$2"(4�>�X`Z����>Tx@D�\��X\��("ddr>>,
   218	Hn<>.�� |���&"   6� x�� X���&"   6��~������&"   6��( x�������&"   6�� ~������F&"   6��r ~������(&"   6��H ~��������"   6��x��������"   6��z x�������"   6��j�� ����"   6�� ���|��8D"   6��(  �������"   7��&  ������$�"   7��(  ������2�"   6��* x������D�"   6��< x������2�"   6��* x�� V��2&"�   6�n x�� V��2&"�   6�J ~�� V��2&"�   6� � x�� V��2&"�   6�r~�� V��2&"�   6� � ~�� V��2&"�   6� � ~�� V��2"�   6� � j�� V��2"�   6�J  �� ~�l &"$   6�b x�� ~�l &"$   6�> ~�� ����&"(   6�H x�� ����&"(   6�$ ~�� ����&"(   6�px�� ����&"(   6�L~�� ����&"(   6� � ~�� ����&"(   6� � ~�� �����"(   6� � x�� �����"(   6� � x�� ����"(   6� � j�� ����"(   6�$  �� ����D"(   6�p �� �����"(   7�n �� �����"(   7�p �� �����"(   6�rx�� �����"(   6� � x�� �����"(   6�rx�� Z���&",   6�B x�� Z���&",   6� ~�� Z���&",   6�j x�� Z���&",   6�F ~�� Z���&",   6�� ~�� Z���&",   6�� ~�� Z����",   6�� x�� Z����",   6�� x�� Z���",   6�� j�� Z���",   6�  �� Z���D",   6�j  �� Z� �>",   �L  �� Z� �",   #�L   6�� j�� Z� �",   #�L   6�  �� Z� �&",   #�L   6�B x�� Z� �&",   #�L   6� ~�� Z� �&",   #�L   6�j x�� Z� �&",   #�L   6�F ~�� Z� �&",   #�L   6�� ~�� Z� �&",   #�L   6�� ~�� Z� ��",   #�L   6�� x�� Z� ��",   #�L   6�� x�� Z� �D",   #�L   6�j    �� t��   R&553326323#�Z�
   219	$� X\��("d�� �� t���   H��   A#!5!���BZ�  �.�    A#!5!#!5!d��0hʚ�:`��d�  � �h�     A#!5! '>53.53"��j2�P�zVl�HzH�lXz�Nz��@��6t,��hN��hȠ,t6��N�� T��    A!5!#3���p�,���0@   �&�     )  A#3 '>553&&553%!5! 67'#53���
   220	H�v^l�BxD�lZx�Jz
   221	�Z���`l҈VVVP�J���:t0��p��p֪0x:������� ~   ���    ! 1 5  A#367##53!5!#"&&54663326654&&#7#3���B�`j̐VVx�D����NN�TT�NN�T0L**L00L**L0P��L8�� � ���P�ZZ�PP�ZZ�P~.V66T00T66V.� X��  	  A!#!!5!��X�D��X(�.T�\~  ��      A!#!!#!!5!$67##53T�f�4��j�2��:�,�r|�\\(�.T��.T�d��� B ��� 	   A!#!!5!!5!��6���4d��|����"��8� �� 	    A!#!!5!#!5! $7##53^�N���LP���HR�2
   222	�����ll��~��T*����~ � 	     A!#!!5! 67##53!!!!P�Z���VD�����``���\�0F����~���|~|����  � 	     A!#!!5!!3!3!67##53P�Z���VD�8����8��������bb��~���J�N���d��~�  �l� 	   +  A!#!!5! 67##53 '>53.53N�Z���TF���|���``�J�xVh�FxF�jVv�Jv��~��� �~`�4r,��fP��fƠ,r4��P�� � 	    !  A!#!!5!!#!!5!!5! 67##53P�\���TD��L�R��^"����|���``��~���n�R���d � � $� 	     #  A!#!!5!!5!!5!#3#3 67##53<�n���j0��z�
   223	�h��b��0���J�x��^^��~����T~6 �  �6 �~  �� 	   - 1 ;  A!#!!5!!5!#"&&54663326654&&#7#3 67##53$���t����P����NN�TT�PP�T0L**J20J**J0P�����v|�^^��v~���N�XX�LL�XX�N~,P66R..R64R,����~ P��    A!!!!���`�>"������ R ��    A!3!3!�������rL�B���`�� $��      A!3!3!!3!3!����������hF�T���b���F�T���b�� $ �~�    #  @'>53.53%!3!3!N�zVl�HxF�lT|�Nz�~�������6t,��hN��hƢ,t6��N��F�T���b��  ���    @'>53&$53����N�������L��잆���.~&�����&~.����  �^�   # /  @'>553&&553'>553.553lL�xZl�D|"F�jJz�NxfN�|Hj�Fx(B�nZx�L|2� �<t4��`��fԼ:z@�|�����<z8��d��bЬ2v<����� F ���    @#"$&546$3326654&&# ��� ��� �� �p�jl�pr�jj�r�~����~~����~�Z�dd�^^�dd�Z * ���     @'>553&$553%!5!�����N�솄��L����~���R
   224	���2~*���ڎ�*~2����|�  � �d�   # / 3 7  @'>553&&553'>553&&553%!5!!5!hL�|`r�D�F�xT��L��L��Tz�D�@�pbz�H��<��r���p<���@~4��v�Ș�(�:���Ⱥ���:�(����v�4~>����t���  ��      @'>553&$553%!5!#3�����L�怈0��L��������V�$������,x$�ڂLL�ژ$x,�
   225	�LL6�BB 8 ���  	  e#!5!'%���PN���J����0| V��  	   A!#!!5!!5!��D�V��h ��",�n�T�� $ ���      A!5!!5!#3#3��|��H��잞��(��N�4��� , ��$   # '  A!5! #"&&54663326654&&##3��Z��,�rr�~~�pp�~N�FF�NP~HH~PP������R�^^�TT�^^�R�0V68X22X86V0^ ��^2.    E#3!5!�����4̢���� R�d�4     E#3!5!#3���Z�X�����������.r ��d�2     A!5!!5!#3��8��8��h��������� R�^�2      E#3!5!#3!5!���n�x�����\�x�������\t�Ђ 2�`v2    E#3!5!v��p�,Ԡ���� ��^�2     E#3!5!#3����P�l�L������(x 4�b|2     E#3!5!!5!|��r�*��*֞������� ��\�.      A!5!!5!#3#3<�r��r��������Ђ�������pv  Lv��    A!5!#3���N�$��v�.  Z�\�.      A#3#3!5! $7!'֚�Ĝ���N��$�������~�P�����>r& �  d�^:2       A#3 $7#'#3!5!#3~��������֚�V��H��v��x��������6x  ��`2     A#3#3 $7!'*��؞���"�������t�^��� x&�  ZH��     A!5!#3#3���L����n��H�8H��D  Z r��    A!5!#3���L�(��p���0  ~�^B2      E#3#3 $%!'!5!�R����@������L�.�������t&��>~  p�``2       E#3#3!5!#3$$7#'`������T�v��ؘ������ ����\z�b~�� @n ~  ��\:.     E#3#3 $%!'F�������P������������v"�  L t��     A!5!#3#3���N����L��r���*��*  L��6   A!5!���N��  |�J    E#3 $7!'����.�
   226	���������� v&� 0�`�2   E#3Ξ������R�T3Yr^  T�^�P      E#3!5!  '6 553!5!��� ��H������X�N��J�������4�|�||L����  F�^�P       A#3!5!$ '6$553!5!#!5!�����8������@�L��N��6���<���t����Fz@��F�����  F�^�P      "  A#3!5!#!5!#!5!  '6$553!5!�����8�v��d6~��t(������@�L��N��R������ ��` �����Fz@��F��  F�X�P     " . 4  A#3!5!$ '6$553!5! '>553.553#!5!�����8������@�L��N���T�vVh�L|L�fTv�R|���^>V����l����Fz@��F���2ܬ0z(��X��X��&z0��x����~  J���P        A#3!5!$ '6$553!5!!5!#3�����>������D�L��V����T���:�^������R~H�&�F�����4� 	 F�f�P     ) - 1 < @  A#3!5! '>553.553 67##53#3!5! '6$553!5!�����L�X�~Ll�N|P�lN|�Xx���N.`�~TTD��f�"��������>�N��P�����Ђ�rڦ.x&��X��Z��$x,��z����$*|2$�D,`~����@|:��J�� 
   227	 F�b�P      ) 9 = H L  A#3!5! 67##53#3!5!#"&&54663326654&&#7#53 '6$553!5!�����P���ht�tTTD����~����VV�bb�RR�b6V22V68V00V8P���������>�N��R�������P"~&�&8�x�>pLLp>>pLLp>p">*(@""@(*>"��n���>|8��L��  F�v�P         A#3!5!$ '6$553!5!!#!!5!�����8������@�L��P��>�2�l"�r�^��Ƃf����H~@��D�����:H�x�  J�n�P       $  A#3!5!$'6$553!5!!#!5!5!!5!�����8������>�J��P��4�0���.nB�T�����^���@�6� �R������������  J�h�N     # . 2  A#3!5! 667##53%!#!5!5!#!5! '6$553!5!�����R�<¤TX� hh��V���RFr��x$������>�H��H�������6xx�����x�$`|����@�8��R��  J�n�N 	      $ / 3  e!#!5!5!!!!! 67+53#3!5!$'6$553!5!�f���b6���2�Z�����phƢ8\\t����8������<�J��L���n�x�(����� z|�����`���>�6� �R��  J�v�P      ' 2 6  A#3!5!!53!3!'!#!5!5! 67##53 '6$6553!5!�����8�J��Ɛ����j���b4���rr��ZZ������<�J��L����������"��� � ��h�z��xz.���>�6���P��  J�f�P     & * 6 B  A#3!5!!#!5!5! 67##53 '6$553!5! '>553.553�����8�f�V���RH���pr��\\������<�J��L���R�vVh�J|J�hXt�R~�������h�z��vz.���@�4� �P���D�2x,��`��`��,x2��~�� 	 J�v�P       * . 4 8  A#3!5!$'6$6553!5!!#!5!5! 67##53!5!!#!!5!�����8������<�J��L��b�Z���XB���rv��\\���Z�V�D�6�����b���>�6���P�����`�x��xzzz�����ft 
   228	 J�v�P       " & 0 :  A!5!!5!#3#37#3!5!$'6$6553!5!!#!5!5! 67##53���~�j��^��.��8����8������<�J��L��r�j���f2���nr��ZZ�|�,~>T��T����b���>�6���P�����b�x��
   229	xz 
   230	 J�b�P      / ? C N R  A#3!5!!#!5!5! 67##53!5!#"&&54663326654&&#7#53 '6$6553!5!�����8�J�p���j,���nr��\\����،NN�ZX�NN�X2N**N24N**N4P���������<�J��L���v������l�v��|z�v�:nHJn::nJHn:n <&(<""<((: ��|���>�6���P��  F�v�P        A#3!5!$ '6$553!5!!!!!�����8������@�L��P��6��f�6.��^��ʂb����H~@��D��������  L�v�P      "  A#3!5!$'6$553!5!!53!35!�����8������<�H��N���f0����0�����Ԅ`���B�8��L���x��:�����  L�f�P      " . :  A#3!5!$'6$553!5!!53!35! '>553.553�����8������<�H��L���@����@���N�tVf�HzH�bTr�Nz�����R���B�8��N���r��H�����B�4x,��X��T��,x4��x��  J�h�R     * .  A!5!$ '6$553!5!'6$6553&$553#3���8������D�N��P��P��жB�����B��д�̜�ڄ�����N~F�$�D���~���$~�؀NN|֒~$��NN6�  J�b�R     " . : F  A#3!5!$ '6$553!5! '>553.553'>553.553�����8������<�J��N����b�|Pl�XxJ�hD|�NrtR�zFh�Jv$V�pP~�`zl����n����F~@��F���R�0t(��V��\��,t0��z��l��4t0��P��^��&t.��z��  J�b�P     & 6  A#3!5!$ '6$553!5!#"$&546$3326654&&�����8������B�L��N���������������hh��jj$,���n����L�B��H���DR�jj�RR�jj�R|4dBBb66bBBd4  L�b�R     " . 2  A#3!5!$'6$553!5!'6$6553&$&553!5!�����8������<�J��N��:��ڮ>��� ��<��ڰ���l�V����z���F�>��L���$� |~�d88b��z��88
   231	~  L�^�P     " . 2 6  A!5!$'6$553!5!#3 '6$6553&$&553!5!#3���8������>�H��N��0�����ְ:�
   232	���
   233	�<��ֲ��T�����,�P���B�6��R���������|z�^`�x|����@  F�^�P         A#3!5!$ '6$553!5!#!5!'%�����8������@�L��N��6����\:\��ʂd����Fz@��F����,~�*�(r  N�v�P        $  A#3!5!$'6$553!5!!#!!5!'!5!�����8������B�H��V��<�0�n*�h�>�����ނH���<�4� �T��������.z�x  J�|�N       " &  A#3!5!$'6$553!5!!5!!5!#3#3�����>����� >�L��L��\�\��6��ژ���p���~^���B�8��P������d�<$��$  L�b�P      * : >  A#3!5!$'6$553!5!!5!#"&&54663326654&&#7#3�����8������:�H��R���� ��*�xxޜ��vxޜn�RR�nn�TT�nN������D���@�6��N����z�<rPPr::rPPr<t >,,>>,,> �  J�^6P       E#3!5!$ '6 553!5!#36��`��^�p����\�z�b��V��������Z���nz@t����Nj  R�^.N         A#3!5!#3#!5!  '6$553!5!.��`��X�ؖ�������&����N���d��V6�������2�����`vR� �6��  T�^.N      " &  E#!5!#!5!5#3!5!#3  '6$553!5!���TH���`:��`��X�ؖ�������L���d��V�~�r~j�����������ZtN��6��  Z�Z�N    ! % ) 4 8  E#!5!'>553.5537#3!5!#3  '6$553!5!|��DX�V�zNj�L~N�jRz�T|���`��V�ؖ�������R���f��T�~�ޮ0|(��Z��X��(|.��v�����Ȁ���������`vP��4��  T��fN       "  A#3!5!#3  '6$553!5!!5!#3.��`��X�ؖ�������N���`��Tv�6��Ҝ� .�^��,�������brV�$�0����J� 
   234	 Z�\�N    % ) - 1 5 @ D  d'>553.553#367'#53!5!'#3!5!#3  '6$553!5!^�~Jj�Xz X�hH|�b~����(�N,b�xTT���,��`��V�ؖ�������R���d��T�Ȝ(| x�LhhJ�x"|(��hhh�|�4(.|4(�f�\��Ȁ���������`tR��4��  V�^�N      $ ( , < L P  A#3!5!#3 '6$553!5!67##53#3!5!.54663326654&&#7#53.��`��X�ؖ�������N���\��T��ft�vTTH�����\���VV�dd�XX�d<Z44Z<:Z22Z:N�������X�����TvH��4���*$�$�(4�x�:jHHj::jHHj:p8&&88&&8��  Z�vNN  	      $  E!5!!#!'#3!5!#3  '6$553!5!N�J�������`��V�ؖ�������R���d��T��l�rh����������`tR��4��  Z�vvN      $ (  A#3!5!#3 '6$553!5!!#!5!5!!5!.��`��X�ؖ�������J���\��T:������H� ������b�����RvD��6����������~  Z�^.N  	      * 4  E#!5!5#3!5!#3 '6$553!5!!#!5!5! $7##53.��Z@��`��X�ؖ�������J�
   235	��\��T��B���<\�� ����nn�t�`����n�����RtF��4�����l�|��~~ 	 Z�v.N 	     # ' 2 6  e!#!5!5!!!!! 67##53#3!5!#3 '6$553!5!z�V���RF���@�J*�����rt��``���`��X�ؖ�������J�
   236	��\��T��f�z�"�����
   237	z~�����n�����RtF��4�� 	 Z�v.N      " & 0 :  A#3!5!#3 '6$553!5!!53!3!%!#!5!5! 67##53.��`��X�ؖ�������J�
   238	��\��T�$����$�����V���RF���rt��``�����
   239	h�����RtF��4���������
   240	����f�z��
   241	z~ 	 Z�h�N     # . 2 < F  @'>553.5537#3!5!#3 '6$553!5!!#!5!5! 67##53TP�tTf�Lx J�hTt�T|���`��X�ؖ�������J���\��T��T���PH���hl��^^@�4x.��`��^��0x4��|�������n�����RvF��4�����j�z��
   242	z~ 
   243	 Z�vTN       $ ( 2 <  E!5!'!5!7!#!'#3!5!#3 '6$553!5!!#!5!5! 67##53T��j2���F�T��`��X�ؖ�������J�
   244	��\��T��V���RF���rt��``�~�x����b����n�����RtF��4�����j�z��
   245	z~  Z�vVN        & * 4 >  A!5!!5!#3#37#3!5!#3 '6$553!5!!#!5!5! 67##53L�|�
   246	�j��b��.��H��`��X�ؖ�������J�
   247	��\��T��Z���VB���pp��^^�~�"~HT��T�����n�����RtF��4�����j�z��
   248	z~  Z�^�N   # ' + / 3 > B L V  A!5!.54663326654&&#7#537#3!5!#3 '6$6553!5!!#!5!5! 67##53��
   249	����TR�\\�RR�\4R..R44R..R4L��Ж�`��X�ؖ�������J�
   250	��\��Tn�b���\<���tx��``�x�:lHHl::lHHl:n :&&:  :&&: ��&�����P�����Nv@���8�����f�z��
   251	z~  Z�z.N       "  A#3!5!#3  '6$553!5!!!!!.��`��V�ؖ�������R���d��T>�j��b��R��Ȁ���������`tR��4����~�~  V�z.N      " &  A#3!5!#3  '6$553!5!!53!35!.��`��X�ؖ�������R���^��T�\��n�\�����Ђ���������\vN��0������B����� 	 Z�h�N    # ' + / : >  A!53!35! '>553.5537#3!5!#3 '6$553!5!�D����D���R�tTf�Nx J�fPv�Rz���`��X�ؖ�������R���^��T^��:�����F�2x,��\��`��(x2��|�����҂��������RtD��4��  V�f�N 
   252	     & 2  @ '6$553!5!#3!5!#3'6$6553&$&553V����V���^��V6��`��V�ؖ����ȶ>�����<��Ⱦ������dvV�(�.����������� �� z��rPPr̎z ���PP 	 T�T�N      & 2 > J  A#3!5!#3  '6$553!5!'>553.553'>553.553.��`��V�ؖ�������R���d��RZ`�|Pn�ZxH�hD|�RtrT�xFf�Lt$X�nN~�`zP�������������^vR��6���Vް0t(��Vxx\��,x2��xxxl��4x0��Nxx\��&t.��zxx  T�fBN      * :  A#3!5!#3  '6$553!5! #"$&546$3326654&&#.��`��V�ؖ�������P���b��T��������nn̈��nn̈B������������`vR�"�4���:N�ff�NN�ff�N|2\@>^22^>@\2  Z�f�N      & 2 6  A#3!5!#3  '6$553!5! '6$6553&$&553!!5!.��`��V�ؖ�������R���d��T*��Ҷ:���"��8��ζ��J�V��ʀ���������`tR��4���$��xt�f&&d�vx���&&~ 	 V�f�N       * 6 :  A#53#3!5!#3  '6$553!5! '6$6553&$&553!5!6�����`��X�ؖ�������R���^��T&��̸6���"��8��ʺ��J���"��҂�|������^tR��4���Ԇxl�`((^�nx�Ԅ((�  Z�^.N  	      $  E#!5!'%#3!5!#3  '6$553!5!.�����0�d��`��V�ؖ�������R���d��T���"�(p������������`tR��4��  V�r^N  	     $ (  A!#!!5!'!5!#3!5!#3 '6$553!5!8�
   253	��&�D�<����`��X�ؖ�������L���\��T�����$|�x������ |�����VtH��2�� 	 Z�zTN       " & *  A#3!5!#3  '6$553!5!!5!!5!#3#3.��`��V�ؖ�������R���d��TL�<����ƞ� ��V���~���������`tR��4������z�H&��& 	 Z�bZN       * : >  A#3!5!#3 '6$553!5!!5!#"$54$3326654&&#7#53.��`��X�ؖ�������J���\��Tf���t
   254	�������r�RR�pr�RR�tP��������*B�����PtF��6����|�|vv|~tv|p 8**::**8 ��  T�^�P       A!5!!5!#3  '6 553!5!���L��L�����4�����X�N��J����h�� ��<�4�|�||L����  F�^�P         A!5!!5!#3  '6$553!5!#!5!���8��8����������@�L��N��6���������z������Fz@��F�����  F�^�P      " &  A!5!!5!#3#!5!#!5!  '6$553!5!���4��4��������d6~��t(������@�L��N��Ȃ���~�� ��` �����Fz@��F��  F�X�P     * 0 4 8  A#3  '6$553!5! '>553.553#!5!!5!!5!���������@�L��N���T�vVh�L|L�fTv�R|���^>���8��8V�������Fz@��F���2ܬ0z(��X��X��&z0��x����~؀��  J���P       "  A!5!!5!#3  '6$553!5!!5!#3���>��>����� �����D�L��V����T���|��ʂ��������R~H�&�F�����4� 
   255	 F�f�P 
   256	     & 2 < @ D  @'6$553!5!!5!!5!#3'>553.553 67##53#3!5!������>�N��P��8��4��4�����X�~Ll�N|P�lN|�Xx���N.`�~TTD��f�"����@|:��J�����������ڦ.x&��X��Z��$x,��z����$*|2$�D,`~  F�b�P     % 5 9 D H L P  A#3 67##53#3!5!#"&&54663326654&&#7#53 '6$553!5!!5!!5!�����ht�tTTD����~����VV�bb�RR�b6V22V68V00V8P���������>�N��R��8��4��4����"~&�&8�x�>pLLp>>pLLp>p">*(@""@(*>"��n���>|8��L�����:�  F�v�P        $  A#3  '6$553!5!!#!!5!!5!!5!���������@�L��P��>�2�l"�r����8��8^�������H~@��D�����:H�x�؂� �  J�n�P      $ (  A!5!!5!#3 '6$553!5!!#!5!5!!5!���8��8����������>�J��P��4�0���.nB�T��~�$~��������@�6� �R������������  J�h�N     * . 2 6  A#3 667##53%!#!5!5!#!5! '6$553!5!!5!!5!����J¤TX� hh��V���RFr��x$������>�H��H��8��8��8����xx�����x�$`|����@�8��R����~�"� 	 J�n�N 	      + / 3 7  e!#!5!5!!!!! 67+53#3 '6$553!5!!5!!5!�f���b6���2�Z�����phƢ8\\t��������<�J��L��<��8��8��n�x�(����� z|�������>�6� �R����~�"� 	 J�v�P     # . 2 6 :  A#3!53!3!'!#!5!5! 67##53 '6$6553!5!!5!!5!����V��Ɛ����j���b4���rr��ZZ������<�J��L��<��8��8�����"��� � ��h�z��xz.���>�6���P����~�"� 	 J�f�P    " & 2 > B F  A#3!#!5!5! 67##53 '6$553!5! '>553.553!5!!5!����r�V���RH���pr��\\������<�J��L���R�vVh�J|J�hXt�R~���8��8���`�h�z��vz.���@�4� �P���D�2x,��`��`��,x2��~��&~�"� 
   257	 J�v�P     & * 0 4 8 <  A#3 '6$6553!5!!#!5!5! 67##53!5!!#!!5!!5!!5!���������<�J��L��b�Z���XB���rv��\\���Z�V�D�6���8��8�������>�6���P�����`�x��xzzz�����ft�~�"~  J�v�P       " , 6 : >  A!5!!5!#3#37#3 '6$6553!5!!#!5!5! 67##53!5!!5!���~�j��^��.��8��������<�J��L��r�j���f2���nr��ZZ���8��8�|�,~>T��T�������>�6���P�����b�x��
   258	xz�~�"�  J�b�P     + ; ? J N R V  A#3!#!5!5! 67##53!5!#"&&54663326654&&#7#53 '6$6553!5!!5!!5!����V�p���j,���nr��\\����،NN�ZX�NN�X2N**N24N**N4P���������<�J��L��<��8��8�v�d�l�v��|z�v�:nHJn::nJHn:n <&(<""<((: ��|���>�6���P����~�&~  F�v�P       "  A#3  '6$553!5!!!!!!5!!5!���������@�L��P��6��f�6.�����8��8^�������H~@��D��������D���  L�v�P      " &  A#3 '6$553!5!!53!35!!5!!5!���������<�H��N���f0����0�����8��8�������B�8��L���x��:�������� 	 L�f�P      * 6 : >  A#3 '6$553!5!!53!35! '>553.553!5!!5!���������<�H��L���@����@���N�tVf�HzH�bTr�Nzt��8��8�������B�8��N���r��H�����B�4x,��X��T��,x4��x��,���  J�f�P      & 2  A!5!!5!#3  '6$553!5!'6$6553&$553���6��6����� �����D�N��P��P��жB�����D��д����Ԃ�>�������P~F�$�D���|���$|��~PP|Ԓ~&��PP 	 J�b�R     * 6 B F J  A#3  '6$553!5! '>553.553'>553.553!5!!5!���������<�J��N����b�|Pl�XxJ�hD|�NrtR�zFh�Jv$V�pP~�`z���8��8l�������F~@��F���R�0t(��V��\��,t0��z��l��4t0��P��^��&t.��z��*���  J�b�P      * :  A!5!!5!#3  '6$553!5!#"$&546$3326654&&���4��4����������B�L��N���������������hh��jj������t,������L�B��H���DR�jj�RR�jj�R|4dBBb66bBBd4  L�b�R     * . 2 6  A#3 '6$553!5!'6$6553&$&553!5!!5!!5!���������<�J��N��:��ڮ>��� ��<��ڰ���l����8��8V������F�>��L���$� |~�d88b��z��88
   259	~Ђ�� 	 L�^�P 
   260	    * . 2 6 :  @'6$553!5!#3 '6$6553&$&553!5!#3!5!!5!������>�H��N��0�����ְ:�
   261	���
   262	�<��ֲ��T��������8��8 ���B�6��R���������|z�^`�x|����@&���  F�^�P        $  A#3  '6$553!5!#!5!'%!5!!5!���������@�L��N��6����\:���8��8\�������Fz@��F����,~�*�(rf���  N�v�P        $ (  A#3 '6$553!5!!#!!5!'!5!!5!!5!����"�����B�H��V��<�0�n*�h�>����8��8�������<�4� �T��������.z�x���� 	 J�|�N       " & *  A#3 '6$553!5!!5!!5!#3#3!5!!5!���� ���� >�L��L��\�\��6��ژ������8��8p������B�8��P������d�<$��$��
   263	� 	 L�b�P       . > B  A!5!!5!#3 '6$553!5!!5!#"&&54663326654&&#7#3���8��8����������:�H��R���� ��*�xxޜ��vxޜn�RR�nn�TT�nN��؂����������@�6��N����z�<rPPr::rPPr<t >,,>>,,> �  J�^6P        A!5!!5!#3  '6 553!5!#3���\��\h�������\�z�b��V����������(�Z���nz@t����Nj  R�^.N        $  A#3#3#!5!  '6$553!5!!5!!5!.���x��������&����N���d��V���X��X6����2�����`vR� �6�������  T�^.N      " & *  E#!5!#!5!5#3#3  '6$553!5!!5!!5!���TH���`:���x��������L���d��V���X��X�~�r~j���������ZtN��6������ � 	 Z�Z�N    ! % 0 4 8 <  E#!5!'>553.5537#3#3  '6$553!5!!5!!5!|��DX�V�zNj�L~N�jRz�T|����x��������R���f��T���X��X�~�ޮ0|(��Z��X��(|.��v������������`vP��4�������  T��fN       " &  A!5!!5!#3#3  '6$553!5!!5!#3���X��X`���x��������N���`��Tv�6��Ҝ�v���~��.��������brV�$�0����J�  Z�\�N    % ) - 1 < @ D H  d'>553.553#367'#53!5!'#3#3  '6$553!5!!5!!5!^�~Jj�Xz X�hH|�b~����(�N,b�xTT���,���x��������R���d��T���X��X�Ȝ(| x�LhhJ�x"|(��hhh�|�4(.|4(�f�\���������`tR��4������  V�^�N       ( , 0 @ P T  A!5!!5!#3#3 '6$553!5!67##53#3!5!.54663326654&&#7#53���X��X`���x��������N���\��T��ft�vTTH�����\���VV�dd�XX�d<Z44Z<:Z22Z:N�����0������X�����TvH��4���*$�$�(4�x�:jHHj::jHHj:p8&&88&&8��  Z�vNN  	      $ (  E!5!!#!'#3#3  '6$553!5!!5!!5!N�J��������x��������R���d��T���X��X��l�rh��������`tR��4������ �  Z�jvN       ( ,  A!5!!5!#3#3 '6$553!5!!#!5!5!!5!���X��X`���x��������J�
   264	��\��T:������H� ��|�6~����|b�����RtF��4��������~�� 	 Z�^.N  	    & 0 4 8  E#!5!5#3#3 '6$553!5!!#!5!5! $7##53!5!!5!.��Z@���x��������J�
   265	��\��T��B���<\�� ����nn*��X��X�t�`��pn�����RtF��4�����l�|��~~�z�2| 
   266	 Z�v.N      # ' + 6 :  A!5!!5!!#!5!5!!!!! 67##53#3#3 '6$553!5!���X��X���V���RF���@�J*�����rt��``����x��������J�
   267	��\��T�|�8|���f�z�"�����
   268	z~���pn�����RtF��4�� 
   269	 Z�v.N       & * 4 >  A!5!!5!#3#3 '6$553!5!!53!3!%!#!5!5! 67##53���X��X`���x��������J�
   270	��\��T�$����$�����V���RF���rt��``�z�4|����vh�����RtF��4���������
   271	����f�z��
   272	z~ 
   273	 Z�h�N     # ' 2 6 @ J  A!5!!5!'>553.5537#3#3 '6$553!5!!#!5!5! 67##53���X��XzP�tTf�Lx J�hTt�T|����x��������J���\��T��T���PH���hl��^^�z�6~�2�4x.��`��^��0x4��|�����pn�����RvF��4�����j�z��
   274	z~  Z�vTN        ( , 6 @  A!5!!5!!5!'!5!7!#!'#3#3 '6$553!5!!#!5!5! 67##53���X��X���j2���F�T���x��������J�
   275	��\��T��V���RF���rt��``�z�*��v~�x����b��pn�����RtF��4�����j�z��
   276	z~  Z�vVN         * . 8 B  A!5!!5!!5!!5!#3#37#3#3 '6$553!5!!#!5!5! 67##53���X��X~�|�
   277	�j��b��.��H���x��������J�
   278	��\��T��Z���VB���pp��^^�|�4|��~�"~HT��T���pn�����RtF��4�����j�z��
   279	z~  Z�^�N   # ' + / : > H R V Z  A!5!.54663326654&&#7#537#3#3 '6$6553!5!!#!5!5! 67##53!5!!5!��
   280	����TR�\\�RR�\4R..R44R..R4L��Ж��x��������J�
   281	��\��Tn�b���\<���tx��``@��X��X�x�:lHHl::lHHl:n :&&:  :&&: ��&���P�����Nv@���8�����f�z��
   282	z~�|�8~  Z�z.N       " &  A!5!!5!#3#3  '6$553!5!!!!!���X��X`���x��������R���d��T>�j��b��Ȃ�������������`tR��4��������  V�z.N       & *  A!5!!5!#3#3  '6$553!5!!53!35!���X��X`���x��������R���^��T�\��n�\��҂������H�������\vN��0������B����� 
   283	 Z�h�N    # ' + 6 : > B  A!53!35! '>553.5537#3#3 '6$553!5!!5!!5!�D����D���R�tTf�Nx J�fPv�Rz����x��������R���^��T���X��X^��:�����F�2x,��\��`��(x2��|�����J������RtD��4�������  V�f�N 
   284	    " . 2 6  @ '6$553!5!#3#3'6$6553&$&553!5!!5!V����V���^��V6���x�����ȶ>�����<��Ⱦ����X��X�����dvV�(�.������� �� z��rPPr̎z ���PP���� 
   285	 T�T�N     " . : F J N  A#3#3  '6$553!5!'>553.553'>553.553!5!!5!.���x��������R���d��RZ`�|Pn�ZxH�hD|�RtrT�xFf�Lt$X�nN~�`z���X��XP���������^vR��6���Vް0t(��Vxx\��,x2��xxxl��4x0��Nxx\��&t.��zxx2���  T�fBN     & 6 : >  A#3#3  '6$553!5! #"$&546$3326654&&#!5!!5!.���x��������P���b��T��������nn̈��nn̈���X��XB���������`vR�"�4���:N�ff�NN�ff�N|2\@>^22^>@\2L��� 	 Z�f�N     " . 2 6 :  A#3#3  '6$553!5! '6$6553&$&553!!5!!5!!5!.���x��������R���d��T*��Ҷ:���"��8��ζ��J�t��X��XV���������`tR��4���$��xt�f&&d�vx���&&~΂�� 
   286	 V�f�N      & 2 6 : >  A#53#3#3  '6$553!5! '6$6553&$&553!5!!5!!5!6������x��������R���^��T&��̸6���"��8��ʺ��J�t��X��X��"��b|������^tR��4���Ԇxl�`((^�nx�Ԅ((���~  Z�^.N  	      $ (  E#!5!'%#3#3  '6$553!5!!5!!5!.�����0�d���x��������R���d��T���X��X���"�(p����������`tR��4������� 	 V�r^N  	      $ ( ,  A!#!!5!'!5!#3#3 '6$553!5!!5!!5!8�
   287	��&�D�<�����x��������L���\��T���X��X�����$|�x���b|�����VtH��2���~�"� 
   288	 Z�zTN       " & * .  A#3#3  '6$553!5!!5!!5!#3#3!5!!5!.���x��������R���d��TL�<����ƞ� �����X��XV���������`tR��4������z�H&��&��
   289	� 
   290	 Z�bZN      & 6 : > B  A#3#3 '6$553!5!!5!#"$54$3326654&&#7#53!5!!5!.���x��������J���\��Tf���t
   291	�������r�RR�pr�RR�tP�����X��X����B�����PtF��6����|�|vv|~tv|p 8**::**8 ��,~�:~  J�^P      E#3!5!  '$ 553!5!��V��������V J��H�������8���~|L����  ^�`
   292	N 
   293	      @ '6$553!5!#!5!5#3!5!������B�J��<��f������|�Z� ����J|@��D�����N���  V�^
   294	N      "  A!5!$ '6$553!5!#!5!%#3#!5!��L��H�����>�N��8��*��VJ�����f8�z����F|@��D�����R��  V�V�N     " . 4  A!5!$ '6$553!5!#3'>553.553#!5!��L��H�����>�N��8��d���R�xTh�L| H�fTv�P|���XD�z����F|@��D���d���2z(��`vv`��&x0��vv��~  d��8N        A#3!5!$ '6$553!5!!5!#3
   295	��~�V��^���� D�J��B����f����,"�X������T~J�0�@�����@� 	 \�f`N   " & * 5 9 = A  @'>553.553 667##53#3!5!  '6$553!5!#3!5!�X�|Lj�PzN�hLz�X|����62b��tZZ@������������B�H��<��h����X�ت,v&��XffX��&v,��vff��, z60�8
   296	`������J|@��D�������� 
   297	 b�^jP       $ ( 8 H L  A#3!5!$'6$553!5! 67##53#3!5!.54663326654&&#7#53
   298	����\��L�����:�@��$���0�hr�tXXD�����Z���VV�bd�TT�d<Z22Z<:X44X:N�����Ђz���D~<��D���$�$�(6�z�:jHHj::jHHj:p8&&88&&8��  \�v.N 
   299	        @ '6$553!5!#3!5!!#!!5!������>�H��<��h����X�����"�\� ����J|@��@���~������>D�|�  d�nFP       $  A#3!5!$'6$553!5!!#!5!5!!5!
   300	����\��N�����8�B��&��\� ����<�H����Ђ|���B�8��H������������  b�h
src/renderer/src/styles/globals.css
--- src/renderer/src/styles/globals.css
     1	@font-face {
     2	  font-family: "Wanted Sans";
     3	  font-weight: 100 950;
     4	  font-style: normal;
     5	  src: url("./fonts/WantedSansVariable.ttf") format("truetype-variations"),
     6	       url("./fonts/WantedSansVariable.ttf") format("truetype");
     7	  font-display: swap;
     8	}
     9	
    10	@font-face {
    11	  font-family: "Pretendard";
    12	  font-weight: 100 900;
    13	  font-style: normal;
    14	  src: url("./fonts/PretendardVariable.ttf") format("truetype-variations"),
    15	       url("./fonts/PretendardVariable.ttf") format("truetype");
    16	  font-display: swap;
    17	}
    18	
    19	:root {
    20	  --color-fb-blue: #0066ff;
    21	  --color-fb-blue-strong: #005eeb;
    22	  --color-fb-blue-heavy: #0040b5;
    23	  --color-fb-blue-tint: #eaf2fe;
    24	  --color-fb-ink-1: #0e1116;
    25	  --color-fb-ink-2: rgba(46, 47, 51, 0.88);
    26	  --color-fb-ink-3: rgba(55, 56, 60, 0.61);
    27	  --color-fb-ink-4: rgba(55, 56, 60, 0.28);
    28	  --color-fb-bg: #ffffff;
    29	  --color-fb-line: #e1e2e4;
    30	  --color-fb-line-t: rgba(112, 115, 124, 0.22);
    31	  --color-fb-positive: #00bf40;
    32	  --color-fb-warn: #ff9200;
    33	}
    34	
    35	* { box-sizing: border-box; }
    36	
    37	html, body, #root {
    38	  margin: 0;
    39	  padding: 0;
    40	  height: 100%;
    41	  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
    42	  font-feature-settings: "ss01" on, "ss03" on;
    43	  -webkit-font-smoothing: antialiased;
    44	  text-rendering: optimizeLegibility;
    45	  color: var(--color-fb-ink-1);
    46	  background: #ffffff;
    47	  -webkit-user-select: none;
    48	  user-select: none;
    49	}
    50	
    51	button { font-family: inherit; }
    52	
    53	/* ============================================================
    54	   App shell
    55	   ============================================================ */
    56	.fb-app {
    57	  display: flex;
    58	  flex-direction: column;
    59	  min-height: 100vh;
    60	  background: #ffffff;
    61	}
    62	.fb-app-footer {
    63	  display: flex;
    64	  justify-content: space-between;
    65	  align-items: center;
    66	  padding: 12px 24px;
    67	  border-top: 1px solid var(--color-fb-line);
    68	  background: #ffffff;
    69	  font-size: 11px;
    70	  color: var(--color-fb-ink-3);
    71	  font-weight: 500;
    72	  letter-spacing: 0.02em;
    73	}
    74	.fb-app-version { font-feature-settings: "tnum" on; }
    75	
    76	/* ============================================================
    77	   Typography helpers
    78	   ============================================================ */
    79	.fb-h1 {
    80	  font-size: 44px;
    81	  line-height: 1.1;
    82	  font-weight: 800;
    83	  letter-spacing: -0.045em;
    84	  margin: 0 0 20px;
    85	  color: var(--color-fb-ink-1);
    86	}
    87	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
    88	.fb-h1-sm {
    89	  font-size: 32px;
    90	  line-height: 1.15;
    91	  font-weight: 800;
    92	  letter-spacing: -0.04em;
    93	  margin: 0 0 12px;
    94	  color: var(--color-fb-ink-1);
    95	}
    96	.fb-h2 {
    97	  font-size: 22px;
    98	  font-weight: 800;
    99	  letter-spacing: -0.025em;
   100	  color: var(--color-fb-ink-1);
   101	  margin: 0 0 16px;
   102	}
   103	.fb-lede {
   104	  font-size: 15px;
   105	  line-height: 24px;
   106	  color: var(--color-fb-ink-2);
   107	  font-weight: 500;
   108	  letter-spacing: -0.012em;
   109	  margin: 0 0 24px;
   110	  max-width: 520px;
   111	}
   112	
   113	/* ============================================================
   114	   Button
   115	   ============================================================ */
   116	.fb-btn {
   117	  display: inline-flex;
   118	  align-items: center;
   119	  justify-content: center;
   120	  gap: 8px;
   121	  font-weight: 700;
   122	  letter-spacing: -0.015em;
   123	  border: 1px solid transparent;
   124	  border-radius: 12px;
   125	  cursor: pointer;
   126	  white-space: nowrap;
   127	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   128	  user-select: none;
   129	}
   130	.fb-btn:focus-visible {
   131	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   132	  outline-offset: 2px;
   133	}
   134	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   135	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   136	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   137	.fb-btn-full { width: 100%; }
   138	
   139	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   140	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   141	.fb-btn-primary:active { transform: scale(0.98); }
   142	
   143	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   144	.fb-btn-secondary:hover { background: #f7f7f8; }
   145	
   146	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   147	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   148	
   149	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   150	.fb-btn-on-blue:hover { background: #f7f7f8; }
   151	
   152	/* ============================================================
   153	   Cloud-Buddy motion (from design styles.css)
   154	   ============================================================ */
   155	.cb-eye { transform-box: fill-box; transform-origin: center; }
   156	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   157	@keyframes cb-wink {
   158	  0%, 92%, 100% { transform: scaleY(1); }
   159	  94%, 96% { transform: scaleY(0.08); }
   160	}
   161	
   162	.cb-pulse-wrap {
   163	  transform-box: fill-box;
   164	  transform-origin: center;
   165	  opacity: 0;
   166	  animation: cb-pulse 2.4s ease-out infinite;
   167	  pointer-events: none;
   168	}
   169	.cb-pulse-2 { animation-delay: -1.2s; }
   170	@keyframes cb-pulse {
   171	  0% { transform: scale(0.55); opacity: 0.55; }
   172	  80% { opacity: 0.05; }
   173	  100% { transform: scale(1.75); opacity: 0; }
   174	}
   175	
   176	.cb-animated .cb-antenna-dot {
   177	  transform-box: fill-box;
   178	  transform-origin: center;
   179	  animation: cb-charge 1.4s ease-in-out infinite;
   180	}
   181	@keyframes cb-charge {
   182	  0%, 100% { transform: scale(1); }
   183	  50% { transform: scale(1.18); }
   184	}
   185	
   186	.cb-spark {
   187	  transform-box: fill-box;
   188	  transform-origin: center;
   189	  opacity: 0;
   190	  animation: cb-spark 1.4s ease-out infinite;
   191	  pointer-events: none;
   192	}
   193	.cb-spark-2 { animation-delay: -0.7s; }
   194	@keyframes cb-spark {
   195	  0% { transform: scale(0.6); opacity: 0.55; }
   196	  100% { transform: scale(2.2); opacity: 0; }
   197	}
   198	
   199	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   200	@keyframes fb-spin { to { transform: rotate(360deg); } }
   201	
   202	@media (prefers-reduced-motion: reduce) {
   203	  .cb-animated .cb-eye-l,
   204	  .cb-animated .cb-antenna-dot,
   205	  .cb-pulse-wrap,
   206	  .cb-spark,
   207	  .fb-spin { animation: none !important; }
   208	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   209	}
   210	
   211	/* ============================================================
   212	   Home
   213	   ============================================================ */
   214	.fb-home {
   215	  flex: 1;
   216	  display: flex;
   217	  flex-direction: column;
   218	  padding: 24px 40px 40px;
   219	  gap: 32px;
   220	  max-width: 1080px;
   221	  margin: 0 auto;
   222	  width: 100%;
   223	}
   224	.fb-home-header {
   225	  display: flex;
   226	  justify-content: space-between;
   227	  align-items: center;
   228	}
   229	.fb-home-pill {
   230	  display: inline-flex;
   231	  align-items: center;
   232	  gap: 8px;
   233	  height: 32px;
   234	  padding: 0 14px 0 12px;
   235	  background: var(--color-fb-blue-tint);
   236	  color: var(--color-fb-blue-heavy);
   237	  border-radius: 9999px;
   238	  font-size: 12px;
   239	  font-weight: 700;
   240	  letter-spacing: -0.01em;
   241	}
   242	.fb-home-pill-dot {
   243	  width: 6px; height: 6px;
   244	  border-radius: 9999px;
   245	  background: var(--color-fb-blue);
   246	}
   247	
   248	.fb-home-hero {
   249	  display: grid;
   250	  grid-template-columns: 1.4fr 1fr;
   251	  gap: 48px;
   252	  align-items: center;
   253	  padding: 32px 0 8px;
   254	}
   255	.fb-home-hero-copy { display: flex; flex-direction: column; }
   256	.fb-home-hero-mark {
   257	  display: flex;
   258	  justify-content: center;
   259	  align-items: center;
   260	}
   261	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   262	
   263	.fb-home-privacy {
   264	  background: var(--color-fb-blue-tint);
   265	  border-radius: 20px;
   266	  padding: 28px 32px;
   267	}
   268	.fb-home-bullets {
   269	  margin: 0;
   270	  padding-left: 18px;
   271	  color: var(--color-fb-ink-2);
   272	  font-size: 14px;
   273	  line-height: 22px;
   274	  font-weight: 500;
   275	}
   276	.fb-home-bullets li { margin: 0 0 6px; }
   277	
   278	/* ============================================================
   279	   Scanning
   280	   ============================================================ */
   281	.fb-scanning {
   282	  flex: 1;
   283	  display: flex;
   284	  flex-direction: column;
   285	  justify-content: center;
   286	  align-items: center;
   287	  padding: 40px;
   288	}
   289	.fb-scanning-wrap {
   290	  width: 100%;
   291	  max-width: 520px;
   292	  display: flex;
   293	  flex-direction: column;
   294	  gap: 20px;
   295	}
   296	.fb-scanning-actions {
   297	  display: flex;
   298	  gap: 8px;
   299	  justify-content: flex-end;
   300	}
src/renderer/src/components/Lockup.tsx
--- src/renderer/src/components/Lockup.tsx
     1	// Lockup — CloudBuddy 마크 + 한글 워드마크 (옵션: 영문 서브)
     2	import { CloudBuddy } from "./CloudBuddy";
     3	
     4	const FB_BLUE = "#0066FF";
     5	const FB_WHITE = "#FFFFFF";
     6	const INK_1 = "#0E1116";
     7	
     8	export interface LockupProps {
     9	  markSize?: number;
    10	  kanjiSize?: number;
    11	  variant?: "primary" | "on-blue";
    12	  en?: boolean;
    13	  color?: string;
    14	  animated?: boolean;
    15	  className?: string;
    16	}
    17	
    18	export function Lockup({
    19	  markSize = 44,
    20	  kanjiSize = 22,
    21	  variant = "primary",
    22	  en = true,
    23	  color,
    24	  animated = false,
    25	  className
    26	}: LockupProps) {
    27	  const wmColor = color || (variant === "on-blue" ? FB_WHITE : INK_1);
    28	  const enColor = variant === "on-blue" ? "rgba(255,255,255,0.72)" : FB_BLUE;
    29	
    30	  return (
    31	    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    32	      <CloudBuddy size={markSize} variant={variant} animated={animated} />
    33	      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    34	        <span
    35	          style={{
    36	            fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    37	            fontWeight: 800,
    38	            fontSize: kanjiSize,
    39	            letterSpacing: "-0.045em",
    40	            color: wmColor,
    41	            lineHeight: 1
    42	          }}
    43	        >
    44	          포맷버디
    45	        </span>
    46	        {en && (
    47	          <span
    48	            style={{
    49	              fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    50	              fontWeight: 700,
    51	              fontSize: Math.round(kanjiSize * 0.42),
    52	              letterSpacing: "0.22em",
    53	              textTransform: "uppercase",
    54	              color: enColor,
    55	              lineHeight: 1
    56	            }}
    57	          >
    58	            Format Buddy
    59	          </span>
    60	        )}
    61	      </span>
    62	    </span>
    63	  );
    64	}
src/renderer/src/components/CloudBuddy.tsx
--- src/renderer/src/components/CloudBuddy.tsx
     1	// CloudBuddy — 포맷버디 브랜드 마크. 240×240 viewBox.
     2	// 모션은 CSS-only (globals.css의 .cb-* 키프레임).
     3	
     4	import type { Ref } from "react";
     5	
     6	type Variant = "primary" | "on-blue";
     7	type Expression = "smile" | "calm" | "wink";
     8	
     9	const FB_BLUE = "#0066FF";
    10	const FB_WHITE = "#FFFFFF";
    11	
    12	function getPalette(variant: Variant) {
    13	  if (variant === "on-blue") return { body: FB_WHITE, face: FB_BLUE };
    14	  return { body: FB_BLUE, face: FB_WHITE };
    15	}
    16	
    17	export interface CloudBuddyProps {
    18	  size?: number;
    19	  variant?: Variant;
    20	  expression?: Expression;
    21	  animated?: boolean;
    22	  blink?: boolean;
    23	  pulse?: boolean;
    24	  ariaLabel?: string;
    25	  className?: string;
    26	  ref?: Ref<SVGSVGElement>;
    27	}
    28	
    29	export function CloudBuddy({
    30	  size = 200,
    31	  variant = "primary",
    32	  expression = "smile",
    33	  animated = false,
    34	  blink = false,
    35	  pulse = false,
    36	  ariaLabel = "포맷버디",
    37	  className,
    38	  ref
    39	}: CloudBuddyProps) {
    40	  const c = getPalette(variant);
    41	  const wantBlink = blink || animated;
    42	  const wantPulse = pulse || animated;
    43	  const classes = [wantBlink || wantPulse ? "cb-animated" : "", className]
    44	    .filter(Boolean)
    45	    .join(" ");
    46	
    47	  return (
    48	    <svg
    49	      ref={ref}
    50	      width={size}
    51	      height={size}
    52	      viewBox="0 0 240 240"
    53	      fill="none"
    54	      role="img"
    55	      aria-label={ariaLabel}
    56	      className={classes || undefined}
    57	      style={{ overflow: "visible" }}
    58	    >
    59	      {wantPulse && (
    60	        <g>
    61	          <g className="cb-pulse-wrap cb-pulse-1">
    62	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    63	          </g>
    64	          <g className="cb-pulse-wrap cb-pulse-2">
    65	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    66	          </g>
    67	        </g>
    68	      )}
    69	
    70	      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />
    71	
    72	      {wantPulse && (
    73	        <g>
    74	          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    75	          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    76	        </g>
    77	      )}
    78	
    79	      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />
    80	
    81	      <g fill={c.body}>
    82	        <ellipse cx="74" cy="146" rx="42" ry="40" />
    83	        <ellipse cx="120" cy="124" rx="50" ry="48" />
    84	        <ellipse cx="166" cy="146" rx="40" ry="38" />
    85	        <rect x="56" y="146" width="128" height="42" rx="10" />
    86	      </g>
    87	
    88	      {expression !== "wink" && (
    89	        <g className="cb-eye cb-eye-l">
    90	          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    91	        </g>
    92	      )}
    93	      <g className="cb-eye cb-eye-r">
    94	        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    95	      </g>
    96	
    97	      {expression === "smile" && (
    98	        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
    99	      )}
   100	      {expression === "calm" && <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />}
   101	      {expression === "wink" && (
   102	        <>
   103	          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" fill="none" />
   104	          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
   105	        </>
   106	      )}
   107	    </svg>
   108	  );
   109	}
src/renderer/src/components/ScanCard.tsx
--- src/renderer/src/components/ScanCard.tsx
     1	// ScanCard — 진단 진행 카드.
     2	// web 버전을 Electron 환경 + 일반 CSS 변수 기반으로 단순화.
     3	
     4	import type { ScanStepView } from "@shared/types";
     5	import { CloudBuddy } from "./CloudBuddy";
     6	import { ScoreRing } from "./ScoreRing";
     7	
     8	export interface ScanCardProps {
     9	  score: number;
    10	  elapsedLabel: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  steps: ScanStepView[];
    14	  title?: string;
    15	  liveLabel?: string;
    16	}
    17	
    18	function CheckIcon({ size = 13 }: { size?: number }) {
    19	  return (
    20	    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    21	      <path d="M3 7.5 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    22	    </svg>
    23	  );
    24	}
    25	
    26	function SpinIcon({ size = 12 }: { size?: number }) {
    27	  return (
    28	    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="fb-spin">
    29	      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    30	      <path d="M10.5 6 A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    31	    </svg>
    32	  );
    33	}
    34	
    35	export function ScanCard({
    36	  score,
    37	  elapsedLabel,
    38	  doneSteps,
    39	  totalSteps,
    40	  steps,
    41	  title = "버디가 살펴보는 중",
    42	  liveLabel = "진단 중"
    43	}: ScanCardProps) {
    44	  return (
    45	    <div className="scan-card">
    46	      <div className="scan-card-head">
    47	        <div className="scan-card-who">
    48	          <CloudBuddy size={36} variant="primary" expression="smile" animated />
    49	          <div className="scan-card-who-meta">
    50	            <div className="scan-card-title">{title}</div>
    51	            <div className="scan-card-elapsed">{elapsedLabel}</div>
    52	          </div>
    53	        </div>
    54	        <div className="scan-card-live">
    55	          <span className="scan-card-live-dot" />
    56	          {liveLabel}
    57	        </div>
    58	      </div>
    59	
    60	      <div className="scan-score">
    61	        <div>
    62	          <div className="scan-score-label">버디 진행 점수</div>
    63	          <div className="scan-score-value">
    64	            {score}
    65	            <span className="scan-score-unit">점</span>
    66	          </div>
    67	          <div className="scan-score-sub">
    68	            전체 {totalSteps}단계 중 {doneSteps}단계 살펴봤어요
    69	          </div>
    70	        </div>
    71	        <ScoreRing value={score} />
    72	      </div>
    73	
    74	      <div className="scan-steps">
    75	        {steps.map((s, i) => (
    76	          <div key={`${s.name}-${i}`} className={`scan-step ${s.state}`}>
    77	            <div className="scan-step-idx">{s.state === "done" ? <CheckIcon /> : i + 1}</div>
    78	            <div className="scan-step-name">{s.name}</div>
    79	            <div className="scan-step-state">
    80	              {s.state === "active" && <SpinIcon />}
    81	              {s.detail}
    82	            </div>
    83	          </div>
    84	        ))}
    85	      </div>
    86	    </div>
    87	  );
    88	}
src/renderer/src/components/ScoreRing.tsx
--- src/renderer/src/components/ScoreRing.tsx
     1	export interface ScoreRingProps {
     2	  value: number;
     3	  size?: number;
     4	  strokeWidth?: number;
     5	  showLabel?: boolean;
     6	  className?: string;
     7	}
     8	
     9	export function ScoreRing({
    10	  value,
    11	  size = 76,
    12	  strokeWidth = 6,
    13	  showLabel = true,
    14	  className
    15	}: ScoreRingProps) {
    16	  const r = (size - strokeWidth * 2) / 2;
    17	  const c = 2 * Math.PI * r;
    18	  const safe = Math.max(0, Math.min(100, value));
    19	  const offset = c - (safe / 100) * c;
    20	
    21	  return (
    22	    <svg
    23	      viewBox={`0 0 ${size} ${size}`}
    24	      width={size}
    25	      height={size}
    26	      className={className}
    27	      role="img"
    28	      aria-label={`진행률 ${safe}%`}
    29	    >
    30	      <circle
    31	        cx={size / 2}
    32	        cy={size / 2}
    33	        r={r}
    34	        stroke="rgba(0,102,255,0.18)"
    35	        strokeWidth={strokeWidth}
    36	        fill="none"
    37	      />
    38	      <circle
    39	        cx={size / 2}
    40	        cy={size / 2}
    41	        r={r}
    42	        stroke="var(--color-fb-blue)"
    43	        strokeWidth={strokeWidth}
    44	        fill="none"
    45	        strokeDasharray={c}
    46	        strokeDashoffset={offset}
    47	        strokeLinecap="round"
    48	        transform={`rotate(-90 ${size / 2} ${size / 2})`}
    49	      />
    50	      {showLabel && (
    51	        <text
    52	          x={size / 2}
    53	          y={size / 2 + Math.round(size * 0.08)}
    54	          textAnchor="middle"
    55	          fontSize={Math.round(size * 0.21)}
    56	          fontWeight={800}
    57	          fontFamily="'Wanted Sans','Pretendard',sans-serif"
    58	          fill="var(--color-fb-blue)"
    59	          style={{ fontFeatureSettings: '"tnum" on' }}
    60	        >
    61	          {safe}%
    62	        </text>
    63	      )}
    64	    </svg>
    65	  );
    66	}
src/renderer/src/components/Button.tsx
--- src/renderer/src/components/Button.tsx
     1	import type { ButtonHTMLAttributes, ReactNode } from "react";
     2	
     3	type Variant = "primary" | "secondary" | "ghost" | "on-blue";
     4	type Size = "lg" | "md" | "sm";
     5	
     6	export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     7	  variant?: Variant;
     8	  size?: Size;
     9	  iconRight?: ReactNode;
    10	  iconLeft?: ReactNode;
    11	  full?: boolean;
    12	}
    13	
    14	export function Button({
    15	  variant = "primary",
    16	  size = "md",
    17	  iconRight,
    18	  iconLeft,
    19	  className,
    20	  children,
    21	  full,
    22	  ...rest
    23	}: ButtonProps) {
    24	  const cls = ["fb-btn", `fb-btn-${variant}`, `fb-btn-${size}`, full ? "fb-btn-full" : "", className]
    25	    .filter(Boolean)
    26	    .join(" ");
    27	  return (
    28	    <button {...rest} className={cls}>
    29	      {iconLeft}
    30	      <span>{children}</span>
    31	      {iconRight}
    32	    </button>
    33	  );
    34	}
    35	
    36	export function ArrowRight({ size = 16 }: { size?: number }) {
    37	  return (
    38	    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    39	      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    40	    </svg>
    41	  );
    42	}
src/renderer/src/pages/Home.tsx
--- src/renderer/src/pages/Home.tsx
     1	import { Button, ArrowRight } from "../components/Button";
     2	import { Lockup } from "../components/Lockup";
     3	import { CloudBuddy } from "../components/CloudBuddy";
     4	import { copy } from "@shared/copy";
     5	
     6	interface HomeProps {
     7	  onStartScan: () => void;
     8	}
     9	
    10	export function Home({ onStartScan }: HomeProps) {
    11	  return (
    12	    <main className="fb-home">
    13	      <header className="fb-home-header">
    14	        <Lockup markSize={36} kanjiSize={20} en={false} />
    15	        <span className="fb-home-pill">
    16	          <span className="fb-home-pill-dot" />
    17	          {copy.homeEyebrow}
    18	        </span>
    19	      </header>
    20	
    21	      <section className="fb-home-hero">
    22	        <div className="fb-home-hero-copy">
    23	          <h1 className="fb-h1">
    24	            {copy.homeTitle1}
    25	            <br />
    26	            {copy.homeTitle2} <em>{copy.homeTitle3}</em>
    27	          </h1>
    28	          <p className="fb-lede">{copy.homeLede}</p>
    29	          <div className="fb-home-cta">
    30	            <Button size="lg" variant="primary" onClick={onStartScan} iconRight={<ArrowRight />}>
    31	              {copy.homeStartCta}
    32	            </Button>
    33	          </div>
    34	        </div>
    35	        <div className="fb-home-hero-mark">
    36	          <CloudBuddy size={220} variant="primary" expression="smile" animated />
    37	        </div>
    38	      </section>
    39	
    40	      <section className="fb-home-privacy">
    41	        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
    42	        <ul className="fb-home-bullets">
    43	          {copy.privacyBullets.map((b) => (
    44	            <li key={b}>{b}</li>
    45	          ))}
    46	        </ul>
    47	      </section>
    48	    </main>
    49	  );
    50	}
src/renderer/src/pages/Scanning.tsx
--- src/renderer/src/pages/Scanning.tsx
     1	import { ScanCard } from "../components/ScanCard";
     2	import { Button } from "../components/Button";
     3	import { copy } from "@shared/copy";
     4	import type { ScanProgress } from "@shared/types";
     5	
     6	interface ScanningProps {
     7	  progress: ScanProgress;
     8	  errorMessage?: string;
     9	  onCancel: () => void;
    10	  onRetry?: () => void;
    11	}
    12	
    13	function formatElapsed(ms: number) {
    14	  if (!ms || ms < 0) return "잠시만요";
    15	  const totalSec = Math.floor(ms / 1000);
    16	  const min = Math.floor(totalSec / 60);
    17	  const sec = totalSec % 60;
    18	  if (min === 0) return `${sec}초 경과`;
    19	  return `${min}분 ${sec}초 경과`;
    20	}
    21	
    22	export function Scanning({ progress, errorMessage, onCancel, onRetry }: ScanningProps) {
    23	  return (
    24	    <main className="fb-scanning">
    25	      <div className="fb-scanning-wrap">
    26	        <ScanCard
    27	          score={progress.score}
    28	          elapsedLabel={formatElapsed(progress.elapsedMs)}
    29	          doneSteps={progress.doneSteps}
    30	          totalSteps={progress.totalSteps}
    31	          steps={progress.steps}
    32	          title={errorMessage ? copy.errorHeadline : copy.scanTitle}
    33	          liveLabel={errorMessage ? "잠시 멈췄어요" : copy.scanLiveLabel}
    34	        />
    35	
    36	        {errorMessage && (
    37	          <div className="fb-scanning-error" role="alert">
    38	            <strong>{copy.errorHeadline}</strong>
    39	            <p>{errorMessage}</p>
    40	          </div>
    41	        )}
    42	
    43	        <div className="fb-scanning-actions">
    44	          {onRetry && (
    45	            <Button variant="primary" size="md" onClick={onRetry}>
    46	              {copy.errorRetryCta}
    47	            </Button>
    48	          )}
    49	          <Button variant="secondary" size="md" onClick={onCancel}>
    50	            {copy.scanCancelCta}
    51	          </Button>
    52	        </div>
    53	      </div>
    54	    </main>
    55	  );
    56	}
src/renderer/src/pages/Report.tsx
--- src/renderer/src/pages/Report.tsx
     1	import { useCallback, useMemo, useState } from "react";
     2	import { Button } from "../components/Button";
     3	import { Lockup } from "../components/Lockup";
     4	import { copy } from "@shared/copy";
     5	import type { ScanResult } from "@shared/types";
     6	
     7	interface ReportProps {
     8	  result: ScanResult;
     9	  onBack: () => void;
    10	}
    11	
    12	interface RowProps {
    13	  label: string;
    14	  value: React.ReactNode;
    15	}
    16	
    17	function Row({ label, value }: RowProps) {
    18	  return (
    19	    <div className="fb-report-row">
    20	      <div className="fb-report-row-label">{label}</div>
    21	      <div className="fb-report-row-value">{value}</div>
    22	    </div>
    23	  );
    24	}
    25	
    26	function formatGb(value?: number | null) {
    27	  if (value == null) return "—";
    28	  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
    29	}
    30	
    31	export function Report({ result, onBack }: ReportProps) {
    32	  const { report } = result;
    33	  const [exportStatus, setExportStatus] = useState<string | null>(null);
    34	
    35	  const installedCount = report.installedApps.length;
    36	  const driverCount = report.drivers.length;
    37	  const wifiCount = report.wifiProfiles.length;
    38	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    39	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    40	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    41	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    42	
    43	  const onExport = useCallback(async () => {
    44	    if (!window.fb) return;
    45	    setExportStatus(null);
    46	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    47	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    48	    else setExportStatus("저장을 취소했어요.");
    49	  }, [report]);
    50	
    51	  const onOpenWeb = useCallback(async () => {
    52	    if (!window.fb) return;
    53	    await window.fb.openWebReport();
    54	  }, []);
    55	
    56	  return (
    57	    <main className="fb-report">
    58	      <header className="fb-report-header">
    59	        <Lockup markSize={36} kanjiSize={20} en={false} />
    60	        <div className="fb-report-actions">
    61	          <Button variant="ghost" size="sm" onClick={onBack}>
    62	            {copy.reportBackCta}
    63	          </Button>
    64	        </div>
    65	      </header>
    66	
    67	      <section className="fb-report-hero">
    68	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
    69	        <p className="fb-lede">{copy.reportLede}</p>
    70	      </section>
    71	
    72	      <section className="fb-report-grid">
    73	        <article className="fb-card">
    74	          <h3>이 PC</h3>
    75	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
    76	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
    77	          <Row label="CPU" value={report.system.cpu ?? "—"} />
    78	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
    79	        </article>
    80	
    81	        <article className="fb-card">
    82	          <h3>저장 공간</h3>
    83	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
    84	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
    85	          {report.disks.map((d) => (
    86	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
    87	          ))}
    88	        </article>
    89	
    90	        <article className="fb-card">
    91	          <h3>같이 챙길 것</h3>
    92	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
    93	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
    94	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
    95	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
    96	        </article>
    97	
    98	        <article className="fb-card">
    99	          <h3>설치된 앱 / 드라이버</h3>
   100	          <Row label="설치된 앱" value={`${installedCount}개`} />
   101	          <Row label="드라이버" value={`${driverCount}개`} />
   102	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   103	          <Row label="프린터" value={`${report.printers.length}개`} />
   104	        </article>
   105	
   106	        <article className="fb-card">
   107	          <h3>사용자 폴더</h3>
   108	          {report.userFolders.map((f) => (
   109	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   110	          ))}
   111	        </article>
   112	
   113	        <article className="fb-card fb-card-checklist">
   114	          <h3>포맷 전 체크리스트</h3>
   115	          <ul className="fb-report-checklist">
   116	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   117	            <li>Desktop·Documents·Downloads 백업</li>
   118	            <li>클라우드 동기화 완료 확인</li>
   119	            <li>리포트 JSON 저장 후 포맷</li>
   120	          </ul>
   121	        </article>
   122	      </section>
   123	
   124	      <section className="fb-report-cta">
   125	        <Button variant="primary" size="lg" onClick={onExport}>
   126	          {copy.reportExportCta}
   127	        </Button>
   128	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   129	          {copy.reportOpenWebCta}
   130	        </Button>
   131	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   132	      </section>
   133	
   134	      <section className="fb-report-meta">
   135	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   136	        <small>schema {report.schemaVersion}</small>
   137	      </section>
   138	    </main>
   139	  );
   140	}

exec
/bin/zsh -lc "for f in src/renderer/src/pages/*.tsx src/renderer/src/components/*.tsx src/renderer/src/styles/globals.css; do echo '---' "'$f; nl -ba "$f" | sed -n '"'1,260p'; done" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- src/renderer/src/pages/Home.tsx
     1	import { Button, ArrowRight } from "../components/Button";
     2	import { Lockup } from "../components/Lockup";
     3	import { CloudBuddy } from "../components/CloudBuddy";
     4	import { copy } from "@shared/copy";
     5	
     6	interface HomeProps {
     7	  onStartScan: () => void;
     8	}
     9	
    10	export function Home({ onStartScan }: HomeProps) {
    11	  return (
    12	    <main className="fb-home">
    13	      <header className="fb-home-header">
    14	        <Lockup markSize={36} kanjiSize={20} en={false} />
    15	        <span className="fb-home-pill">
    16	          <span className="fb-home-pill-dot" />
    17	          {copy.homeEyebrow}
    18	        </span>
    19	      </header>
    20	
    21	      <section className="fb-home-hero">
    22	        <div className="fb-home-hero-copy">
    23	          <h1 className="fb-h1">
    24	            {copy.homeTitle1}
    25	            <br />
    26	            {copy.homeTitle2} <em>{copy.homeTitle3}</em>
    27	          </h1>
    28	          <p className="fb-lede">{copy.homeLede}</p>
    29	          <div className="fb-home-cta">
    30	            <Button size="lg" variant="primary" onClick={onStartScan} iconRight={<ArrowRight />}>
    31	              {copy.homeStartCta}
    32	            </Button>
    33	          </div>
    34	        </div>
    35	        <div className="fb-home-hero-mark">
    36	          <CloudBuddy size={220} variant="primary" expression="smile" animated />
    37	        </div>
    38	      </section>
    39	
    40	      <section className="fb-home-privacy">
    41	        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
    42	        <ul className="fb-home-bullets">
    43	          {copy.privacyBullets.map((b) => (
    44	            <li key={b}>{b}</li>
    45	          ))}
    46	        </ul>
    47	      </section>
    48	    </main>
    49	  );
    50	}
--- src/renderer/src/pages/Report.tsx
     1	import { useCallback, useMemo, useState } from "react";
     2	import { Button } from "../components/Button";
     3	import { Lockup } from "../components/Lockup";
     4	import { copy } from "@shared/copy";
     5	import type { ScanResult } from "@shared/types";
     6	
     7	interface ReportProps {
     8	  result: ScanResult;
     9	  onBack: () => void;
    10	}
    11	
    12	interface RowProps {
    13	  label: string;
    14	  value: React.ReactNode;
    15	}
    16	
    17	function Row({ label, value }: RowProps) {
    18	  return (
    19	    <div className="fb-report-row">
    20	      <div className="fb-report-row-label">{label}</div>
    21	      <div className="fb-report-row-value">{value}</div>
    22	    </div>
    23	  );
    24	}
    25	
    26	function formatGb(value?: number | null) {
    27	  if (value == null) return "—";
    28	  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
    29	}
    30	
    31	export function Report({ result, onBack }: ReportProps) {
    32	  const { report } = result;
    33	  const [exportStatus, setExportStatus] = useState<string | null>(null);
    34	
    35	  const installedCount = report.installedApps.length;
    36	  const driverCount = report.drivers.length;
    37	  const wifiCount = report.wifiProfiles.length;
    38	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    39	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    40	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    41	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    42	
    43	  const onExport = useCallback(async () => {
    44	    if (!window.fb) return;
    45	    setExportStatus(null);
    46	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    47	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    48	    else setExportStatus("저장을 취소했어요.");
    49	  }, [report]);
    50	
    51	  const onOpenWeb = useCallback(async () => {
    52	    if (!window.fb) return;
    53	    await window.fb.openWebReport();
    54	  }, []);
    55	
    56	  return (
    57	    <main className="fb-report">
    58	      <header className="fb-report-header">
    59	        <Lockup markSize={36} kanjiSize={20} en={false} />
    60	        <div className="fb-report-actions">
    61	          <Button variant="ghost" size="sm" onClick={onBack}>
    62	            {copy.reportBackCta}
    63	          </Button>
    64	        </div>
    65	      </header>
    66	
    67	      <section className="fb-report-hero">
    68	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
    69	        <p className="fb-lede">{copy.reportLede}</p>
    70	      </section>
    71	
    72	      <section className="fb-report-grid">
    73	        <article className="fb-card">
    74	          <h3>이 PC</h3>
    75	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
    76	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
    77	          <Row label="CPU" value={report.system.cpu ?? "—"} />
    78	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
    79	        </article>
    80	
    81	        <article className="fb-card">
    82	          <h3>저장 공간</h3>
    83	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
    84	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
    85	          {report.disks.map((d) => (
    86	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
    87	          ))}
    88	        </article>
    89	
    90	        <article className="fb-card">
    91	          <h3>같이 챙길 것</h3>
    92	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
    93	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
    94	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
    95	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
    96	        </article>
    97	
    98	        <article className="fb-card">
    99	          <h3>설치된 앱 / 드라이버</h3>
   100	          <Row label="설치된 앱" value={`${installedCount}개`} />
   101	          <Row label="드라이버" value={`${driverCount}개`} />
   102	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   103	          <Row label="프린터" value={`${report.printers.length}개`} />
   104	        </article>
   105	
   106	        <article className="fb-card">
   107	          <h3>사용자 폴더</h3>
   108	          {report.userFolders.map((f) => (
   109	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   110	          ))}
   111	        </article>
   112	
   113	        <article className="fb-card fb-card-checklist">
   114	          <h3>포맷 전 체크리스트</h3>
   115	          <ul className="fb-report-checklist">
   116	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   117	            <li>Desktop·Documents·Downloads 백업</li>
   118	            <li>클라우드 동기화 완료 확인</li>
   119	            <li>리포트 JSON 저장 후 포맷</li>
   120	          </ul>
   121	        </article>
   122	      </section>
   123	
   124	      <section className="fb-report-cta">
   125	        <Button variant="primary" size="lg" onClick={onExport}>
   126	          {copy.reportExportCta}
   127	        </Button>
   128	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   129	          {copy.reportOpenWebCta}
   130	        </Button>
   131	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   132	      </section>
   133	
   134	      <section className="fb-report-meta">
   135	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   136	        <small>schema {report.schemaVersion}</small>
   137	      </section>
   138	    </main>
   139	  );
   140	}
--- src/renderer/src/pages/Scanning.tsx
     1	import { ScanCard } from "../components/ScanCard";
     2	import { Button } from "../components/Button";
     3	import { copy } from "@shared/copy";
     4	import type { ScanProgress } from "@shared/types";
     5	
     6	interface ScanningProps {
     7	  progress: ScanProgress;
     8	  errorMessage?: string;
     9	  onCancel: () => void;
    10	  onRetry?: () => void;
    11	}
    12	
    13	function formatElapsed(ms: number) {
    14	  if (!ms || ms < 0) return "잠시만요";
    15	  const totalSec = Math.floor(ms / 1000);
    16	  const min = Math.floor(totalSec / 60);
    17	  const sec = totalSec % 60;
    18	  if (min === 0) return `${sec}초 경과`;
    19	  return `${min}분 ${sec}초 경과`;
    20	}
    21	
    22	export function Scanning({ progress, errorMessage, onCancel, onRetry }: ScanningProps) {
    23	  return (
    24	    <main className="fb-scanning">
    25	      <div className="fb-scanning-wrap">
    26	        <ScanCard
    27	          score={progress.score}
    28	          elapsedLabel={formatElapsed(progress.elapsedMs)}
    29	          doneSteps={progress.doneSteps}
    30	          totalSteps={progress.totalSteps}
    31	          steps={progress.steps}
    32	          title={errorMessage ? copy.errorHeadline : copy.scanTitle}
    33	          liveLabel={errorMessage ? "잠시 멈췄어요" : copy.scanLiveLabel}
    34	        />
    35	
    36	        {errorMessage && (
    37	          <div className="fb-scanning-error" role="alert">
    38	            <strong>{copy.errorHeadline}</strong>
    39	            <p>{errorMessage}</p>
    40	          </div>
    41	        )}
    42	
    43	        <div className="fb-scanning-actions">
    44	          {onRetry && (
    45	            <Button variant="primary" size="md" onClick={onRetry}>
    46	              {copy.errorRetryCta}
    47	            </Button>
    48	          )}
    49	          <Button variant="secondary" size="md" onClick={onCancel}>
    50	            {copy.scanCancelCta}
    51	          </Button>
    52	        </div>
    53	      </div>
    54	    </main>
    55	  );
    56	}
--- src/renderer/src/components/Button.tsx
     1	import type { ButtonHTMLAttributes, ReactNode } from "react";
     2	
     3	type Variant = "primary" | "secondary" | "ghost" | "on-blue";
     4	type Size = "lg" | "md" | "sm";
     5	
     6	export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     7	  variant?: Variant;
     8	  size?: Size;
     9	  iconRight?: ReactNode;
    10	  iconLeft?: ReactNode;
    11	  full?: boolean;
    12	}
    13	
    14	export function Button({
    15	  variant = "primary",
    16	  size = "md",
    17	  iconRight,
    18	  iconLeft,
    19	  className,
    20	  children,
    21	  full,
    22	  ...rest
    23	}: ButtonProps) {
    24	  const cls = ["fb-btn", `fb-btn-${variant}`, `fb-btn-${size}`, full ? "fb-btn-full" : "", className]
    25	    .filter(Boolean)
    26	    .join(" ");
    27	  return (
    28	    <button {...rest} className={cls}>
    29	      {iconLeft}
    30	      <span>{children}</span>
    31	      {iconRight}
    32	    </button>
    33	  );
    34	}
    35	
    36	export function ArrowRight({ size = 16 }: { size?: number }) {
    37	  return (
    38	    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    39	      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    40	    </svg>
    41	  );
    42	}
--- src/renderer/src/components/CloudBuddy.tsx
     1	// CloudBuddy — 포맷버디 브랜드 마크. 240×240 viewBox.
     2	// 모션은 CSS-only (globals.css의 .cb-* 키프레임).
     3	
     4	import type { Ref } from "react";
     5	
     6	type Variant = "primary" | "on-blue";
     7	type Expression = "smile" | "calm" | "wink";
     8	
     9	const FB_BLUE = "#0066FF";
    10	const FB_WHITE = "#FFFFFF";
    11	
    12	function getPalette(variant: Variant) {
    13	  if (variant === "on-blue") return { body: FB_WHITE, face: FB_BLUE };
    14	  return { body: FB_BLUE, face: FB_WHITE };
    15	}
    16	
    17	export interface CloudBuddyProps {
    18	  size?: number;
    19	  variant?: Variant;
    20	  expression?: Expression;
    21	  animated?: boolean;
    22	  blink?: boolean;
    23	  pulse?: boolean;
    24	  ariaLabel?: string;
    25	  className?: string;
    26	  ref?: Ref<SVGSVGElement>;
    27	}
    28	
    29	export function CloudBuddy({
    30	  size = 200,
    31	  variant = "primary",
    32	  expression = "smile",
    33	  animated = false,
    34	  blink = false,
    35	  pulse = false,
    36	  ariaLabel = "포맷버디",
    37	  className,
    38	  ref
    39	}: CloudBuddyProps) {
    40	  const c = getPalette(variant);
    41	  const wantBlink = blink || animated;
    42	  const wantPulse = pulse || animated;
    43	  const classes = [wantBlink || wantPulse ? "cb-animated" : "", className]
    44	    .filter(Boolean)
    45	    .join(" ");
    46	
    47	  return (
    48	    <svg
    49	      ref={ref}
    50	      width={size}
    51	      height={size}
    52	      viewBox="0 0 240 240"
    53	      fill="none"
    54	      role="img"
    55	      aria-label={ariaLabel}
    56	      className={classes || undefined}
    57	      style={{ overflow: "visible" }}
    58	    >
    59	      {wantPulse && (
    60	        <g>
    61	          <g className="cb-pulse-wrap cb-pulse-1">
    62	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    63	          </g>
    64	          <g className="cb-pulse-wrap cb-pulse-2">
    65	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    66	          </g>
    67	        </g>
    68	      )}
    69	
    70	      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />
    71	
    72	      {wantPulse && (
    73	        <g>
    74	          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    75	          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    76	        </g>
    77	      )}
    78	
    79	      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />
    80	
    81	      <g fill={c.body}>
    82	        <ellipse cx="74" cy="146" rx="42" ry="40" />
    83	        <ellipse cx="120" cy="124" rx="50" ry="48" />
    84	        <ellipse cx="166" cy="146" rx="40" ry="38" />
    85	        <rect x="56" y="146" width="128" height="42" rx="10" />
    86	      </g>
    87	
    88	      {expression !== "wink" && (
    89	        <g className="cb-eye cb-eye-l">
    90	          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    91	        </g>
    92	      )}
    93	      <g className="cb-eye cb-eye-r">
    94	        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    95	      </g>
    96	
    97	      {expression === "smile" && (
    98	        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
    99	      )}
   100	      {expression === "calm" && <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />}
   101	      {expression === "wink" && (
   102	        <>
   103	          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" fill="none" />
   104	          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
   105	        </>
   106	      )}
   107	    </svg>
   108	  );
   109	}
--- src/renderer/src/components/Lockup.tsx
     1	// Lockup — CloudBuddy 마크 + 한글 워드마크 (옵션: 영문 서브)
     2	import { CloudBuddy } from "./CloudBuddy";
     3	
     4	const FB_BLUE = "#0066FF";
     5	const FB_WHITE = "#FFFFFF";
     6	const INK_1 = "#0E1116";
     7	
     8	export interface LockupProps {
     9	  markSize?: number;
    10	  kanjiSize?: number;
    11	  variant?: "primary" | "on-blue";
    12	  en?: boolean;
    13	  color?: string;
    14	  animated?: boolean;
    15	  className?: string;
    16	}
    17	
    18	export function Lockup({
    19	  markSize = 44,
    20	  kanjiSize = 22,
    21	  variant = "primary",
    22	  en = true,
    23	  color,
    24	  animated = false,
    25	  className
    26	}: LockupProps) {
    27	  const wmColor = color || (variant === "on-blue" ? FB_WHITE : INK_1);
    28	  const enColor = variant === "on-blue" ? "rgba(255,255,255,0.72)" : FB_BLUE;
    29	
    30	  return (
    31	    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    32	      <CloudBuddy size={markSize} variant={variant} animated={animated} />
    33	      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    34	        <span
    35	          style={{
    36	            fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    37	            fontWeight: 800,
    38	            fontSize: kanjiSize,
    39	            letterSpacing: "-0.045em",
    40	            color: wmColor,
    41	            lineHeight: 1
    42	          }}
    43	        >
    44	          포맷버디
    45	        </span>
    46	        {en && (
    47	          <span
    48	            style={{
    49	              fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    50	              fontWeight: 700,
    51	              fontSize: Math.round(kanjiSize * 0.42),
    52	              letterSpacing: "0.22em",
    53	              textTransform: "uppercase",
    54	              color: enColor,
    55	              lineHeight: 1
    56	            }}
    57	          >
    58	            Format Buddy
    59	          </span>
    60	        )}
    61	      </span>
    62	    </span>
    63	  );
    64	}
--- src/renderer/src/components/ScanCard.tsx
     1	// ScanCard — 진단 진행 카드.
     2	// web 버전을 Electron 환경 + 일반 CSS 변수 기반으로 단순화.
     3	
     4	import type { ScanStepView } from "@shared/types";
     5	import { CloudBuddy } from "./CloudBuddy";
     6	import { ScoreRing } from "./ScoreRing";
     7	
     8	export interface ScanCardProps {
     9	  score: number;
    10	  elapsedLabel: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  steps: ScanStepView[];
    14	  title?: string;
    15	  liveLabel?: string;
    16	}
    17	
    18	function CheckIcon({ size = 13 }: { size?: number }) {
    19	  return (
    20	    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    21	      <path d="M3 7.5 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    22	    </svg>
    23	  );
    24	}
    25	
    26	function SpinIcon({ size = 12 }: { size?: number }) {
    27	  return (
    28	    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="fb-spin">
    29	      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    30	      <path d="M10.5 6 A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    31	    </svg>
    32	  );
    33	}
    34	
    35	export function ScanCard({
    36	  score,
    37	  elapsedLabel,
    38	  doneSteps,
    39	  totalSteps,
    40	  steps,
    41	  title = "버디가 살펴보는 중",
    42	  liveLabel = "진단 중"
    43	}: ScanCardProps) {
    44	  return (
    45	    <div className="scan-card">
    46	      <div className="scan-card-head">
    47	        <div className="scan-card-who">
    48	          <CloudBuddy size={36} variant="primary" expression="smile" animated />
    49	          <div className="scan-card-who-meta">
    50	            <div className="scan-card-title">{title}</div>
    51	            <div className="scan-card-elapsed">{elapsedLabel}</div>
    52	          </div>
    53	        </div>
    54	        <div className="scan-card-live">
    55	          <span className="scan-card-live-dot" />
    56	          {liveLabel}
    57	        </div>
    58	      </div>
    59	
    60	      <div className="scan-score">
    61	        <div>
    62	          <div className="scan-score-label">버디 진행 점수</div>
    63	          <div className="scan-score-value">
    64	            {score}
    65	            <span className="scan-score-unit">점</span>
    66	          </div>
    67	          <div className="scan-score-sub">
    68	            전체 {totalSteps}단계 중 {doneSteps}단계 살펴봤어요
    69	          </div>
    70	        </div>
    71	        <ScoreRing value={score} />
    72	      </div>
    73	
    74	      <div className="scan-steps">
    75	        {steps.map((s, i) => (
    76	          <div key={`${s.name}-${i}`} className={`scan-step ${s.state}`}>
    77	            <div className="scan-step-idx">{s.state === "done" ? <CheckIcon /> : i + 1}</div>
    78	            <div className="scan-step-name">{s.name}</div>
    79	            <div className="scan-step-state">
    80	              {s.state === "active" && <SpinIcon />}
    81	              {s.detail}
    82	            </div>
    83	          </div>
    84	        ))}
    85	      </div>
    86	    </div>
    87	  );
    88	}
--- src/renderer/src/components/ScoreRing.tsx
     1	export interface ScoreRingProps {
     2	  value: number;
     3	  size?: number;
     4	  strokeWidth?: number;
     5	  showLabel?: boolean;
     6	  className?: string;
     7	}
     8	
     9	export function ScoreRing({
    10	  value,
    11	  size = 76,
    12	  strokeWidth = 6,
    13	  showLabel = true,
    14	  className
    15	}: ScoreRingProps) {
    16	  const r = (size - strokeWidth * 2) / 2;
    17	  const c = 2 * Math.PI * r;
    18	  const safe = Math.max(0, Math.min(100, value));
    19	  const offset = c - (safe / 100) * c;
    20	
    21	  return (
    22	    <svg
    23	      viewBox={`0 0 ${size} ${size}`}
    24	      width={size}
    25	      height={size}
    26	      className={className}
    27	      role="img"
    28	      aria-label={`진행률 ${safe}%`}
    29	    >
    30	      <circle
    31	        cx={size / 2}
    32	        cy={size / 2}
    33	        r={r}
    34	        stroke="rgba(0,102,255,0.18)"
    35	        strokeWidth={strokeWidth}
    36	        fill="none"
    37	      />
    38	      <circle
    39	        cx={size / 2}
    40	        cy={size / 2}
    41	        r={r}
    42	        stroke="var(--color-fb-blue)"
    43	        strokeWidth={strokeWidth}
    44	        fill="none"
    45	        strokeDasharray={c}
    46	        strokeDashoffset={offset}
    47	        strokeLinecap="round"
    48	        transform={`rotate(-90 ${size / 2} ${size / 2})`}
    49	      />
    50	      {showLabel && (
    51	        <text
    52	          x={size / 2}
    53	          y={size / 2 + Math.round(size * 0.08)}
    54	          textAnchor="middle"
    55	          fontSize={Math.round(size * 0.21)}
    56	          fontWeight={800}
    57	          fontFamily="'Wanted Sans','Pretendard',sans-serif"
    58	          fill="var(--color-fb-blue)"
    59	          style={{ fontFeatureSettings: '"tnum" on' }}
    60	        >
    61	          {safe}%
    62	        </text>
    63	      )}
    64	    </svg>
    65	  );
    66	}
--- src/renderer/src/styles/globals.css
     1	@font-face {
     2	  font-family: "Wanted Sans";
     3	  font-weight: 100 950;
     4	  font-style: normal;
     5	  src: url("./fonts/WantedSansVariable.ttf") format("truetype-variations"),
     6	       url("./fonts/WantedSansVariable.ttf") format("truetype");
     7	  font-display: swap;
     8	}
     9	
    10	@font-face {
    11	  font-family: "Pretendard";
    12	  font-weight: 100 900;
    13	  font-style: normal;
    14	  src: url("./fonts/PretendardVariable.ttf") format("truetype-variations"),
    15	       url("./fonts/PretendardVariable.ttf") format("truetype");
    16	  font-display: swap;
    17	}
    18	
    19	:root {
    20	  --color-fb-blue: #0066ff;
    21	  --color-fb-blue-strong: #005eeb;
    22	  --color-fb-blue-heavy: #0040b5;
    23	  --color-fb-blue-tint: #eaf2fe;
    24	  --color-fb-ink-1: #0e1116;
    25	  --color-fb-ink-2: rgba(46, 47, 51, 0.88);
    26	  --color-fb-ink-3: rgba(55, 56, 60, 0.61);
    27	  --color-fb-ink-4: rgba(55, 56, 60, 0.28);
    28	  --color-fb-bg: #ffffff;
    29	  --color-fb-line: #e1e2e4;
    30	  --color-fb-line-t: rgba(112, 115, 124, 0.22);
    31	  --color-fb-positive: #00bf40;
    32	  --color-fb-warn: #ff9200;
    33	}
    34	
    35	* { box-sizing: border-box; }
    36	
    37	html, body, #root {
    38	  margin: 0;
    39	  padding: 0;
    40	  height: 100%;
    41	  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
    42	  font-feature-settings: "ss01" on, "ss03" on;
    43	  -webkit-font-smoothing: antialiased;
    44	  text-rendering: optimizeLegibility;
    45	  color: var(--color-fb-ink-1);
    46	  background: #ffffff;
    47	  -webkit-user-select: none;
    48	  user-select: none;
    49	}
    50	
    51	button { font-family: inherit; }
    52	
    53	/* ============================================================
    54	   App shell
    55	   ============================================================ */
    56	.fb-app {
    57	  display: flex;
    58	  flex-direction: column;
    59	  min-height: 100vh;
    60	  background: #ffffff;
    61	}
    62	.fb-app-footer {
    63	  display: flex;
    64	  justify-content: space-between;
    65	  align-items: center;
    66	  padding: 12px 24px;
    67	  border-top: 1px solid var(--color-fb-line);
    68	  background: #ffffff;
    69	  font-size: 11px;
    70	  color: var(--color-fb-ink-3);
    71	  font-weight: 500;
    72	  letter-spacing: 0.02em;
    73	}
    74	.fb-app-version { font-feature-settings: "tnum" on; }
    75	
    76	/* ============================================================
    77	   Typography helpers
    78	   ============================================================ */
    79	.fb-h1 {
    80	  font-size: 44px;
    81	  line-height: 1.1;
    82	  font-weight: 800;
    83	  letter-spacing: -0.045em;
    84	  margin: 0 0 20px;
    85	  color: var(--color-fb-ink-1);
    86	}
    87	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
    88	.fb-h1-sm {
    89	  font-size: 32px;
    90	  line-height: 1.15;
    91	  font-weight: 800;
    92	  letter-spacing: -0.04em;
    93	  margin: 0 0 12px;
    94	  color: var(--color-fb-ink-1);
    95	}
    96	.fb-h2 {
    97	  font-size: 22px;
    98	  font-weight: 800;
    99	  letter-spacing: -0.025em;
   100	  color: var(--color-fb-ink-1);
   101	  margin: 0 0 16px;
   102	}
   103	.fb-lede {
   104	  font-size: 15px;
   105	  line-height: 24px;
   106	  color: var(--color-fb-ink-2);
   107	  font-weight: 500;
   108	  letter-spacing: -0.012em;
   109	  margin: 0 0 24px;
   110	  max-width: 520px;
   111	}
   112	
   113	/* ============================================================
   114	   Button
   115	   ============================================================ */
   116	.fb-btn {
   117	  display: inline-flex;
   118	  align-items: center;
   119	  justify-content: center;
   120	  gap: 8px;
   121	  font-weight: 700;
   122	  letter-spacing: -0.015em;
   123	  border: 1px solid transparent;
   124	  border-radius: 12px;
   125	  cursor: pointer;
   126	  white-space: nowrap;
   127	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   128	  user-select: none;
   129	}
   130	.fb-btn:focus-visible {
   131	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   132	  outline-offset: 2px;
   133	}
   134	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   135	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   136	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   137	.fb-btn-full { width: 100%; }
   138	
   139	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   140	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   141	.fb-btn-primary:active { transform: scale(0.98); }
   142	
   143	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   144	.fb-btn-secondary:hover { background: #f7f7f8; }
   145	
   146	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   147	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   148	
   149	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   150	.fb-btn-on-blue:hover { background: #f7f7f8; }
   151	
   152	/* ============================================================
   153	   Cloud-Buddy motion (from design styles.css)
   154	   ============================================================ */
   155	.cb-eye { transform-box: fill-box; transform-origin: center; }
   156	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   157	@keyframes cb-wink {
   158	  0%, 92%, 100% { transform: scaleY(1); }
   159	  94%, 96% { transform: scaleY(0.08); }
   160	}
   161	
   162	.cb-pulse-wrap {
   163	  transform-box: fill-box;
   164	  transform-origin: center;
   165	  opacity: 0;
   166	  animation: cb-pulse 2.4s ease-out infinite;
   167	  pointer-events: none;
   168	}
   169	.cb-pulse-2 { animation-delay: -1.2s; }
   170	@keyframes cb-pulse {
   171	  0% { transform: scale(0.55); opacity: 0.55; }
   172	  80% { opacity: 0.05; }
   173	  100% { transform: scale(1.75); opacity: 0; }
   174	}
   175	
   176	.cb-animated .cb-antenna-dot {
   177	  transform-box: fill-box;
   178	  transform-origin: center;
   179	  animation: cb-charge 1.4s ease-in-out infinite;
   180	}
   181	@keyframes cb-charge {
   182	  0%, 100% { transform: scale(1); }
   183	  50% { transform: scale(1.18); }
   184	}
   185	
   186	.cb-spark {
   187	  transform-box: fill-box;
   188	  transform-origin: center;
   189	  opacity: 0;
   190	  animation: cb-spark 1.4s ease-out infinite;
   191	  pointer-events: none;
   192	}
   193	.cb-spark-2 { animation-delay: -0.7s; }
   194	@keyframes cb-spark {
   195	  0% { transform: scale(0.6); opacity: 0.55; }
   196	  100% { transform: scale(2.2); opacity: 0; }
   197	}
   198	
   199	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   200	@keyframes fb-spin { to { transform: rotate(360deg); } }
   201	
   202	@media (prefers-reduced-motion: reduce) {
   203	  .cb-animated .cb-eye-l,
   204	  .cb-animated .cb-antenna-dot,
   205	  .cb-pulse-wrap,
   206	  .cb-spark,
   207	  .fb-spin { animation: none !important; }
   208	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   209	}
   210	
   211	/* ============================================================
   212	   Home
   213	   ============================================================ */
   214	.fb-home {
   215	  flex: 1;
   216	  display: flex;
   217	  flex-direction: column;
   218	  padding: 24px 40px 40px;
   219	  gap: 32px;
   220	  max-width: 1080px;
   221	  margin: 0 auto;
   222	  width: 100%;
   223	}
   224	.fb-home-header {
   225	  display: flex;
   226	  justify-content: space-between;
   227	  align-items: center;
   228	}
   229	.fb-home-pill {
   230	  display: inline-flex;
   231	  align-items: center;
   232	  gap: 8px;
   233	  height: 32px;
   234	  padding: 0 14px 0 12px;
   235	  background: var(--color-fb-blue-tint);
   236	  color: var(--color-fb-blue-heavy);
   237	  border-radius: 9999px;
   238	  font-size: 12px;
   239	  font-weight: 700;
   240	  letter-spacing: -0.01em;
   241	}
   242	.fb-home-pill-dot {
   243	  width: 6px; height: 6px;
   244	  border-radius: 9999px;
   245	  background: var(--color-fb-blue);
   246	}
   247	
   248	.fb-home-hero {
   249	  display: grid;
   250	  grid-template-columns: 1.4fr 1fr;
   251	  gap: 48px;
   252	  align-items: center;
   253	  padding: 32px 0 8px;
   254	}
   255	.fb-home-hero-copy { display: flex; flex-direction: column; }
   256	.fb-home-hero-mark {
   257	  display: flex;
   258	  justify-content: center;
   259	  align-items: center;
   260	}

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '260,620p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   260	}
   261	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   262	
   263	.fb-home-privacy {
   264	  background: var(--color-fb-blue-tint);
   265	  border-radius: 20px;
   266	  padding: 28px 32px;
   267	}
   268	.fb-home-bullets {
   269	  margin: 0;
   270	  padding-left: 18px;
   271	  color: var(--color-fb-ink-2);
   272	  font-size: 14px;
   273	  line-height: 22px;
   274	  font-weight: 500;
   275	}
   276	.fb-home-bullets li { margin: 0 0 6px; }
   277	
   278	/* ============================================================
   279	   Scanning
   280	   ============================================================ */
   281	.fb-scanning {
   282	  flex: 1;
   283	  display: flex;
   284	  flex-direction: column;
   285	  justify-content: center;
   286	  align-items: center;
   287	  padding: 40px;
   288	}
   289	.fb-scanning-wrap {
   290	  width: 100%;
   291	  max-width: 520px;
   292	  display: flex;
   293	  flex-direction: column;
   294	  gap: 20px;
   295	}
   296	.fb-scanning-actions {
   297	  display: flex;
   298	  gap: 8px;
   299	  justify-content: flex-end;
   300	}
   301	.fb-scanning-error {
   302	  background: #ffffff;
   303	  border: 1px solid var(--color-fb-line);
   304	  color: var(--color-fb-ink-1);
   305	  border-radius: 12px;
   306	  padding: 14px 16px;
   307	  font-size: 13px;
   308	}
   309	.fb-scanning-error strong {
   310	  display: block;
   311	  margin-bottom: 4px;
   312	  color: var(--color-fb-blue-heavy);
   313	}
   314	.fb-scanning-error p {
   315	  margin: 0;
   316	  word-break: break-word;
   317	  color: var(--color-fb-ink-2);
   318	}
   319	
   320	/* ============================================================
   321	   ScanCard
   322	   ============================================================ */
   323	.scan-card {
   324	  background: #ffffff;
   325	  border-radius: 24px;
   326	  border: 1px solid var(--color-fb-line-t);
   327	  box-shadow: 0 1px 6px rgb(23 23 25 / 0.06), 0 12px 32px rgb(23 23 25 / 0.10);
   328	  padding: 28px;
   329	  display: flex;
   330	  flex-direction: column;
   331	  gap: 22px;
   332	}
   333	.scan-card-head {
   334	  display: flex;
   335	  align-items: center;
   336	  justify-content: space-between;
   337	}
   338	.scan-card-who { display: flex; align-items: center; gap: 10px; }
   339	.scan-card-who-meta { display: flex; flex-direction: column; gap: 2px; }
   340	.scan-card-title { font-size: 14px; font-weight: 700; color: var(--color-fb-ink-1); }
   341	.scan-card-elapsed { font-size: 12px; font-weight: 500; color: var(--color-fb-ink-3); }
   342	.scan-card-live {
   343	  display: flex;
   344	  align-items: center;
   345	  gap: 6px;
   346	  font-size: 12px;
   347	  font-weight: 600;
   348	  color: var(--color-fb-positive);
   349	}
   350	.scan-card-live-dot {
   351	  width: 7px; height: 7px;
   352	  border-radius: 9999px;
   353	  background: var(--color-fb-positive);
   354	}
   355	
   356	.scan-score {
   357	  background: var(--color-fb-blue-tint);
   358	  border-radius: 20px;
   359	  padding: 22px 24px;
   360	  display: grid;
   361	  grid-template-columns: 1fr auto;
   362	  gap: 16px;
   363	  align-items: center;
   364	}
   365	.scan-score-label {
   366	  font-size: 12px;
   367	  font-weight: 700;
   368	  letter-spacing: 0.04em;
   369	  color: var(--color-fb-blue-heavy);
   370	  margin-bottom: 4px;
   371	}
   372	.scan-score-value {
   373	  font-size: 56px;
   374	  font-weight: 800;
   375	  letter-spacing: -0.045em;
   376	  color: var(--color-fb-ink-1);
   377	  line-height: 1;
   378	  font-feature-settings: "tnum" on;
   379	}
   380	.scan-score-unit {
   381	  font-size: 24px;
   382	  font-weight: 700;
   383	  margin-left: 2px;
   384	  letter-spacing: -0.02em;
   385	  color: var(--color-fb-ink-2);
   386	}
   387	.scan-score-sub {
   388	  font-size: 12px;
   389	  color: var(--color-fb-ink-3);
   390	  font-weight: 500;
   391	  margin-top: 8px;
   392	}
   393	
   394	.scan-steps { display: flex; flex-direction: column; gap: 6px; }
   395	.scan-step {
   396	  display: grid;
   397	  grid-template-columns: 32px 1fr auto;
   398	  align-items: center;
   399	  gap: 12px;
   400	  padding: 12px 14px;
   401	  border-radius: 12px;
   402	  background: #ffffff;
   403	  border: 1px solid var(--color-fb-line-t);
   404	}
   405	.scan-step.active {
   406	  background: var(--color-fb-blue-tint);
   407	  border-color: rgba(0,102,255,0.22);
   408	}
   409	.scan-step-idx {
   410	  width: 24px; height: 24px;
   411	  border-radius: 9999px;
   412	  background: var(--color-fb-blue-tint);
   413	  color: var(--color-fb-blue);
   414	  font-size: 12px;
   415	  font-weight: 800;
   416	  display: flex; align-items: center; justify-content: center;
   417	  font-feature-settings: "tnum" on;
   418	}
   419	.scan-step.done .scan-step-idx { background: var(--color-fb-blue); color: #ffffff; }
   420	.scan-step.pending .scan-step-idx { background: #f4f4f5; color: var(--color-fb-ink-3); }
   421	.scan-step-name { font-size: 14px; font-weight: 600; color: var(--color-fb-ink-1); }
   422	.scan-step-state {
   423	  font-size: 12px;
   424	  font-weight: 600;
   425	  letter-spacing: -0.01em;
   426	  color: var(--color-fb-ink-3);
   427	  display: flex; align-items: center; gap: 4px;
   428	}
   429	.scan-step.done .scan-step-state { color: var(--color-fb-positive); }
   430	.scan-step.active .scan-step-state { color: var(--color-fb-blue); }
   431	
   432	/* ============================================================
   433	   Report
   434	   ============================================================ */
   435	.fb-report {
   436	  flex: 1;
   437	  display: flex;
   438	  flex-direction: column;
   439	  padding: 24px 40px 40px;
   440	  gap: 24px;
   441	  max-width: 1080px;
   442	  margin: 0 auto;
   443	  width: 100%;
   444	}
   445	.fb-report-header {
   446	  display: flex;
   447	  justify-content: space-between;
   448	  align-items: center;
   449	}
   450	.fb-report-actions { display: flex; gap: 8px; }
   451	.fb-report-hero { padding: 8px 0 0; }
   452	
   453	.fb-report-grid {
   454	  display: grid;
   455	  grid-template-columns: repeat(2, 1fr);
   456	  gap: 16px;
   457	}
   458	.fb-card {
   459	  background: #ffffff;
   460	  border: 1px solid var(--color-fb-line);
   461	  border-radius: 20px;
   462	  padding: 22px 24px;
   463	  display: flex;
   464	  flex-direction: column;
   465	  gap: 6px;
   466	}
   467	.fb-card h3 {
   468	  margin: 0 0 8px;
   469	  font-size: 15px;
   470	  font-weight: 800;
   471	  letter-spacing: -0.02em;
   472	  color: var(--color-fb-ink-1);
   473	}
   474	.fb-card-checklist { grid-column: span 2; }
   475	
   476	.fb-report-row {
   477	  display: grid;
   478	  grid-template-columns: 110px 1fr;
   479	  gap: 12px;
   480	  padding: 6px 0;
   481	  border-bottom: 1px dashed var(--color-fb-line-t);
   482	  font-size: 13px;
   483	}
   484	.fb-report-row:last-child { border-bottom: none; }
   485	.fb-report-row-label { color: var(--color-fb-ink-3); font-weight: 600; }
   486	.fb-report-row-value { color: var(--color-fb-ink-1); font-weight: 500; }
   487	
   488	.fb-report-checklist {
   489	  margin: 0;
   490	  padding-left: 18px;
   491	  color: var(--color-fb-ink-2);
   492	  font-size: 14px;
   493	  line-height: 22px;
   494	  font-weight: 500;
   495	}
   496	
   497	.fb-report-cta {
   498	  display: flex;
   499	  gap: 10px;
   500	  align-items: center;
   501	  flex-wrap: wrap;
   502	}
   503	.fb-report-cta-status {
   504	  flex-basis: 100%;
   505	  font-size: 12px;
   506	  color: var(--color-fb-ink-3);
   507	  margin: 4px 0 0;
   508	}
   509	
   510	.fb-report-meta {
   511	  display: flex;
   512	  justify-content: space-between;
   513	  color: var(--color-fb-ink-3);
   514	  font-size: 11px;
   515	}

exec
/bin/zsh -lc "node -e \"const fs=require('fs'),crypto=require('crypto'); const p='resources/powershell/Invoke-FormatBuddyScan.ps1'; console.log(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')); console.log(fs.readFileSync('resources/powershell/script.sha256','utf8').trim())\"" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19

exec
/bin/zsh -lc 'git ls-files resources/powershell/script.sha256 .omc/state/idle-notif-cooldown.json; git ls-files resources/powershell/Invoke-FormatBuddyScan.ps1 electron-builder.yml package.json scripts/embed-ps-hash.mjs src/main/scanner.ts src/main/index.ts tests/scanner.test.ts .gitignore' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4104ms:
2026-05-18 09:11:33.004 xcodebuild[61101:41232063]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:11:33.153 xcodebuild[61101:41232062] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-W04ppdlw' (errno=Operation not permitted)
2026-05-18 09:11:33.709 xcodebuild[61103:41232075]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:11:33.862 xcodebuild[61103:41232074] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-bYLSUdCo' (errno=Operation not permitted)
2026-05-18 09:11:35.047 xcodebuild[61107:41232105]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:11:35.191 xcodebuild[61107:41232104] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-lsW1Xz3Q' (errno=Operation not permitted)
2026-05-18 09:11:35.728 xcodebuild[61109:41232115]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:11:35.877 xcodebuild[61109:41232114] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
.gitignore
electron-builder.yml
package.json
resources/powershell/Invoke-FormatBuddyScan.ps1
scripts/embed-ps-hash.mjs
src/main/index.ts
src/main/scanner.ts
tests/scanner.test.ts

exec
/bin/zsh -lc "for f in logs/test.log logs/typecheck.log logs/build.log logs/dist-win.log logs/lint.log; do echo '---' "'$f; tail -80 "$f" 2>/dev/null || true; done' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- logs/test.log

> formatbuddy-desktop@0.1.2 test
> npm run embed-ps-hash && vitest run


> formatbuddy-desktop@0.1.2 embed-ps-hash
> node scripts/embed-ps-hash.mjs

[embed-ps-hash] /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1 → sha256 855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m

 RUN  v2.1.8 /Users/ryanbak/claude/formatbuddy/desktop

 ✓ tests/ipc.test.ts (2 tests) 1ms
 ✓ tests/scanner.test.ts (8 tests) 2682ms
   ✓ scanner mock pipeline > runScan(mock) emits progress, completes, writes JSON 2292ms
   ✓ scanner mock pipeline > runScan(mock) cancels on abort 383ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  09:07:38
   Duration  2.97s (transform 44ms, setup 0ms, collect 52ms, tests 2.68s, environment 0ms, prepare 97ms)

--- logs/typecheck.log

> formatbuddy-desktop@0.1.2 typecheck
> npm run typecheck:node && npm run typecheck:web


> formatbuddy-desktop@0.1.2 typecheck:node
> tsc --noEmit -p tsconfig.node.json --composite false


> formatbuddy-desktop@0.1.2 typecheck:web
> tsc --noEmit -p tsconfig.web.json --composite false

--- logs/build.log
npm warn Unknown project config "electron_mirror". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> formatbuddy-desktop@0.1.0 build
> electron-vite build

vite v5.4.11 building SSR bundle for production...
transforming...
✓ 4 modules transformed.
rendering chunks...
out/main/index.js  10.71 kB
✓ built in 47ms
vite v5.4.11 building SSR bundle for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  1.48 kB
✓ built in 8ms
vite v5.4.11 building for production...
transforming...
✓ 42 modules transformed.
rendering chunks...
../../out/renderer/index.html                                  0.58 kB
../../out/renderer/assets/WantedSansVariable-BTZASzci.ttf  4,669.35 kB
../../out/renderer/assets/PretendardVariable-Bh9nN6Cq.ttf  6,739.34 kB
../../out/renderer/assets/index-KATdQEKe.css                  13.04 kB
../../out/renderer/assets/index-mWO0pZZv.js                  531.70 kB
✓ built in 375ms
--- logs/dist-win.log

> formatbuddy-desktop@0.1.2 predist:win
> npm run embed-ps-hash


> formatbuddy-desktop@0.1.2 embed-ps-hash
> node scripts/embed-ps-hash.mjs

[embed-ps-hash] /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1 → sha256 855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19

> formatbuddy-desktop@0.1.2 dist:win
> electron-vite build && electron-builder --win --publish never

vite v5.4.11 building SSR bundle for production...
transforming...
✓ 4 modules transformed.
rendering chunks...
out/main/index.js  13.35 kB
✓ built in 47ms
vite v5.4.11 building SSR bundle for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  1.48 kB
✓ built in 7ms
vite v5.4.11 building for production...
transforming...
✓ 42 modules transformed.
rendering chunks...
../../out/renderer/index.html                                  0.68 kB
../../out/renderer/assets/WantedSansVariable-BTZASzci.ttf  4,669.35 kB
../../out/renderer/assets/PretendardVariable-Bh9nN6Cq.ttf  6,739.34 kB
../../out/renderer/assets/index-D7Xlu9Uy.css                  13.10 kB
../../out/renderer/assets/index-Dl9YGeyX.js                  531.71 kB
✓ built in 367ms
  • electron-builder  version=25.1.8 os=25.2.0
  • loaded configuration  file=/Users/ryanbak/claude/formatbuddy/desktop/electron-builder.yml
  • executing @electron/rebuild  electronVersion=33.3.1 arch=x64 buildFromSource=false appDir=./
  • installing native dependencies  arch=x64
  • completed installing native dependencies
  • packaging       platform=win32 arch=x64 electron=33.3.1 appOutDir=dist/win-unpacked
  • updating asar integrity executable resource  executablePath=dist/win-unpacked/FormatBuddy.exe
  • building        target=nsis file=dist/FormatBuddy-Setup-0.1.2-x64.exe archs=x64 oneClick=false perMachine=false
  • signing with signtool.exe  path=dist/__uninstaller-nsis-formatbuddy-desktop.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • signing with signtool.exe  path=dist/FormatBuddy-Setup-0.1.2-x64.exe
  • no signing info identified, signing is skipped  signHook=false cscInfo=null
  • building block map  blockMapFile=dist/FormatBuddy-Setup-0.1.2-x64.exe.blockmap
EXIT=0
--- logs/lint.log

> formatbuddy-desktop@0.1.2 lint
> eslint .


exec
/bin/zsh -lc "printf '%s\\n' '---dist powershell---'; find dist -path '*powershell*' -maxdepth 5 -type f -print -exec sh -c 'echo --- "'$1; wc -c "$1"; if [ "$(basename "$1")" = script.sha256 ]; then cat "$1"; else shasum -a 256 "$1" | awk "{print '"\\"'$1}"; fi'"' _ {} \\; 2>/dev/null || true; printf '%s\\n' '---dist tree shallow---'; find dist/win-unpacked -maxdepth 3 -type f | sed -n '1,80p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
---dist powershell---
dist/win-unpacked/resources/powershell/Invoke-FormatBuddyScan.ps1
--- dist/win-unpacked/resources/powershell/Invoke-FormatBuddyScan.ps1
    7402 dist/win-unpacked/resources/powershell/Invoke-FormatBuddyScan.ps1
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
dist/win-unpacked/resources/powershell/script.sha256
--- dist/win-unpacked/resources/powershell/script.sha256
      65 dist/win-unpacked/resources/powershell/script.sha256
855321de4dd59effb9ec404c609b6b4506fa7ff660b8f99b1bf72e7fcda38a19
---dist tree shallow---
dist/win-unpacked/chrome_200_percent.pak
dist/win-unpacked/v8_context_snapshot.bin
dist/win-unpacked/vk_swiftshader_icd.json
dist/win-unpacked/locales/ar.pak
dist/win-unpacked/locales/en-US.pak
dist/win-unpacked/locales/lt.pak
dist/win-unpacked/locales/tr.pak
dist/win-unpacked/locales/te.pak
dist/win-unpacked/locales/af.pak
dist/win-unpacked/locales/lv.pak
dist/win-unpacked/locales/mr.pak
dist/win-unpacked/locales/zh-TW.pak
dist/win-unpacked/locales/ms.pak
dist/win-unpacked/locales/nl.pak
dist/win-unpacked/locales/bn.pak
dist/win-unpacked/locales/vi.pak
dist/win-unpacked/locales/ur.pak
dist/win-unpacked/locales/ta.pak
dist/win-unpacked/locales/zh-CN.pak
dist/win-unpacked/locales/ja.pak
dist/win-unpacked/locales/hi.pak
dist/win-unpacked/locales/en-GB.pak
dist/win-unpacked/locales/pl.pak
dist/win-unpacked/locales/sw.pak
dist/win-unpacked/locales/fa.pak
dist/win-unpacked/locales/el.pak
dist/win-unpacked/locales/sv.pak
dist/win-unpacked/locales/sr.pak
dist/win-unpacked/locales/es-419.pak
dist/win-unpacked/locales/fr.pak
dist/win-unpacked/locales/ru.pak
dist/win-unpacked/locales/gu.pak
dist/win-unpacked/locales/id.pak
dist/win-unpacked/locales/fil.pak
dist/win-unpacked/locales/sk.pak
dist/win-unpacked/locales/ro.pak
dist/win-unpacked/locales/es.pak
dist/win-unpacked/locales/ko.pak
dist/win-unpacked/locales/hu.pak
dist/win-unpacked/locales/kn.pak
dist/win-unpacked/locales/fi.pak
dist/win-unpacked/locales/da.pak
dist/win-unpacked/locales/sl.pak
dist/win-unpacked/locales/de.pak
dist/win-unpacked/locales/it.pak
dist/win-unpacked/locales/hr.pak
dist/win-unpacked/locales/he.pak
dist/win-unpacked/locales/pt-PT.pak
dist/win-unpacked/locales/et.pak
dist/win-unpacked/locales/cs.pak
dist/win-unpacked/locales/nb.pak
dist/win-unpacked/locales/am.pak
dist/win-unpacked/locales/ml.pak
dist/win-unpacked/locales/uk.pak
dist/win-unpacked/locales/bg.pak
dist/win-unpacked/locales/th.pak
dist/win-unpacked/locales/ca.pak
dist/win-unpacked/locales/pt-BR.pak
dist/win-unpacked/chrome_100_percent.pak
dist/win-unpacked/icudtl.dat
dist/win-unpacked/resources/app.asar
dist/win-unpacked/resources/powershell/Invoke-FormatBuddyScan.ps1
dist/win-unpacked/resources/powershell/script.sha256
dist/win-unpacked/resources/app-update.yml
dist/win-unpacked/resources/icons/app-icon.ico
dist/win-unpacked/resources/icons/cloud-buddy-primary.svg
dist/win-unpacked/resources/icons/cloud-buddy-on-blue.svg
dist/win-unpacked/resources/fonts/WantedSansVariable.ttf
dist/win-unpacked/resources/fonts/PretendardVariable.ttf
dist/win-unpacked/resources/elevate.exe
dist/win-unpacked/d3dcompiler_47.dll
dist/win-unpacked/vk_swiftshader.dll
dist/win-unpacked/ffmpeg.dll
dist/win-unpacked/snapshot_blob.bin
dist/win-unpacked/libEGL.dll
dist/win-unpacked/FormatBuddy.exe
dist/win-unpacked/LICENSES.chromium.html
dist/win-unpacked/resources.pak
dist/win-unpacked/LICENSE.electron.txt
dist/win-unpacked/vulkan-1.dll

exec
/bin/zsh -lc pwd in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
/Users/ryanbak/claude/formatbuddy/desktop

exec
/bin/zsh -lc "nl -ba README.md | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	# FormatBuddy Desktop
     2	
     3	Windows-only PC 포맷 동행 데스크탑 앱. Electron + React + TypeScript.
     4	
     5	기존 `local-agent/Invoke-FormatBuddyScan.ps1` PowerShell 진단을 GUI로 감싸고, `design_handoff_format_buddy/`의 디자인을 그대로 적용했습니다.
     6	
     7	## Quick start
     8	
     9	```bash
    10	npm install
    11	npm run dev          # Electron 개발 창 (mock scan으로 동작 검증)
    12	npm run typecheck
    13	npm run lint
    14	npm run test
    15	npm run build
    16	npm run dist:win     # → dist/FormatBuddy-Setup-X.Y.Z-x64.exe
    17	```
    18	
    19	## 검증 한계
    20	
    21	| 항목 | macOS에서 가능 | Windows 실기 필요 |
    22	|------|---------------|-------------------|
    23	| 코드 컴파일 / lint / test | O | — |
    24	| Electron UI 렌더링 (mock scan) | O | — |
    25	| `.exe` 패키지 생성 (cross-build) | O | — |
    26	| 실제 PowerShell 진단 실행 | X | O |
    27	| UAC 권한 흐름 | X | O |
    28	| Windows 폰트 렌더링 정확도 | X | O |
    29	
    30	## Privacy
    31	
    32	- 100% 로컬 동작. 서버 업로드 없음.
    33	- 인증서 개인키, 비밀번호, 브라우저 저장 비밀번호 수집하지 않음.
    34	- 사용자가 export한 JSON만 웹 리포트 뷰어(`/report/import`)로 직접 이동.
    35	
    36	## Structure
    37	
    38	- `src/main/` — Electron 메인 프로세스, PowerShell 호출
    39	- `src/preload/` — contextBridge로 안전한 IPC 노출
    40	- `src/renderer/` — React UI (Home / Scanning / Report 3페이지)
    41	- `src/shared/` — 메인/렌더러 공유 타입 + IPC 채널 상수
    42	- `resources/powershell/` — `Invoke-FormatBuddyScan.ps1` (extraResources로 번들)
    43	- `resources/fonts/` — Wanted Sans Variable, Pretendard Variable
    44	- `resources/icons/` — 로고 SVG + 앱 아이콘
    45	- `tests/` — Vitest unit tests (scanner mock, IPC bridge)

exec
/bin/zsh -lc 'cat .npmrc 2>/dev/null || true; git diff ce83561..c23d45b -- .npmrc' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1990ms:
2026-05-18 09:12:50.322 xcodebuild[61594:41235503]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:12:50.465 xcodebuild[61594:41235502] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-YfWnfxiF' (errno=Operation not permitted)
2026-05-18 09:12:51.001 xcodebuild[61596:41235520]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 09:12:51.143 xcodebuild[61596:41235519] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.

exec
/bin/zsh -lc "rg -n \"outputDir|enforceIntegrity|verifyScriptIntegrity|script.sha256|ExecutionPolicy|openExternal|ELECTRON_RENDERER_URL|sandbox|AbortError|readAndDelete|tmpdir|isScanReport\" -S . --glob '"'!node_modules'"' --glob '"'!dist'"' --glob '"'!out'"'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 314ms:
./src/main/scanner.ts:3:import { tmpdir } from "node:os";
./src/main/scanner.ts:9:const INTEGRITY_MANIFEST = "script.sha256";
./src/main/scanner.ts:11:async function verifyScriptIntegrity(
./src/main/scanner.ts:40:function isScanReport(value: unknown): value is ScanReport {
./src/main/scanner.ts:57:async function readAndDelete(path: string): Promise<string> {
./src/main/scanner.ts:67:  outputDir: string;
./src/main/scanner.ts:73:  /** Require script.sha256 to exist and match. Set true for packaged production. */
./src/main/scanner.ts:74:  enforceIntegrity?: boolean;
./src/main/scanner.ts:111:  const { onProgress, signal, mock, enforceIntegrity } = options;
./src/main/scanner.ts:116:  if (!mock || enforceIntegrity) {
./src/main/scanner.ts:117:    await verifyScriptIntegrity(options.scriptPath, { enforce: !!enforceIntegrity });
./src/main/scanner.ts:120:  const tmpDir = join(tmpdir(), "formatbuddy-scans");
./src/main/scanner.ts:148:    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
./src/main/scanner.ts:173:      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
./src/main/scanner.ts:194:      rejectScan(new DOMException("Scan cancelled", "AbortError"));
./src/main/scanner.ts:224:        const raw = await readAndDelete(outPath);
./src/main/scanner.ts:226:        if (!isScanReport(parsed)) {
./src/main/scanner.ts:304:export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyScriptIntegrity };
./logs/codex-review.md:7:sandbox: read-only
./logs/codex-review.md:34:- `src/main/index.ts`: BrowserWindow webPreferences (contextIsolation, nodeIntegration, sandbox), window-open handler, ipcMain handlers
./logs/codex-review.md:42:- `-ExecutionPolicy Bypass` risks
./logs/codex-review.md:661:    27	      sandbox: false
./logs/codex-review.md:670:    36	    shell.openExternal(url);
./logs/codex-review.md:674:    40	  if (process.env.ELECTRON_RENDERER_URL) {
./logs/codex-review.md:675:    41	    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
./logs/codex-review.md:697:    63	        outputDir: getScanOutputDir(),
./logs/codex-review.md:749:   115	    await shell.openExternal(getWebReportImportUrl());
./logs/codex-review.md:781:     9	  outputDir: string;
./logs/codex-review.md:826:    54	  ensureDir(options.outputDir);
./logs/codex-review.md:827:    55	  const outPath = join(options.outputDir, `report-${randomUUID()}.json`);
./logs/codex-review.md:853:    81	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
./logs/codex-review.md:877:   105	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
./logs/codex-review.md:898:   126	      rejectScan(new DOMException("Scan cancelled", "AbortError"));
./logs/codex-review.md:4122:     3	import { tmpdir } from "node:os";
./logs/codex-review.md:4147:    28	    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
./logs/codex-review.md:4152:    33	        outputDir: dir,
./logs/codex-review.md:4168:    49	    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
./logs/codex-review.md:4173:    54	        outputDir: dir,
./logs/codex-review.md:4524:/bin/zsh -lc "grep -RIn \"\\bany\\b\\|as \\|unknown\\|shell.openExternal\\|openExternal\\|window.open\\|<webview\\|nodeIntegration\\|contextIsolation\\|sandbox\\|ExecutionPolicy\\|Bypass\\|JSON.parse\\|dangerouslySetInnerHTML\\|eval\\|innerHTML\\|스캔 완료\\|심각한 상태\\|초기화\\|리셋\\|자동 처리\\|필수입니다\\|스캔\\|완료\\|초기화\\|리셋\" src electron-builder.yml package.json resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
./logs/codex-review.md:4533:src/main/index.ts:27:      sandbox: false
./logs/codex-review.md:4534:src/main/index.ts:36:    shell.openExternal(url);
./logs/codex-review.md:4538:src/main/index.ts:115:    await shell.openExternal(getWebReportImportUrl());
./logs/codex-review.md:4540:src/main/scanner.ts:105:      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
./logs/codex-review.md:5022:  Severity: HIGH. If a packaged app is launched with `ELECTRON_RENDERER_URL` set, this branch loads arbitrary remote content while still exposing the preload bridge, so that page can call `startScan()` and read the local diagnostic report. Suggested fix: only honor this env var when `!app.isPackaged` and restrict it to the localhost dev origin.
./logs/codex-review.md:5028:  Severity: MEDIUM. After the user clicks cancel, `cancelScan` returns Home but the still-running `scan:start` promise can emit an `AbortError`, and this listener unconditionally switches the UI to the error state. Suggested fix: suppress expected `AbortError` in main or track the current/cancelled scan id in the renderer before accepting `scan:error`.
./logs/codex-review.md:5034:  Severity: MEDIUM. Any renderer-created `window.open()` URL is handed to the OS, so a compromised renderer or future user-controlled link could open `file:`, custom protocols, or unexpected hosts. Suggested fix: parse the URL and allow only expected `https:` origins before calling `shell.openExternal`.
./logs/codex-review.md:5036:- [P2] MEDIUM: Enable the renderer sandbox — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:23-28
./logs/codex-review.md:5037:  Severity: MEDIUM. `sandbox: false` removes Chromium's renderer OS sandbox, so any renderer compromise has a larger post-exploitation surface even with `nodeIntegration` off. Suggested fix: set `sandbox: true` and keep the preload limited to `contextBridge`/`ipcRenderer`.
./logs/codex-review.md:5040:  Severity: MEDIUM. The PowerShell script is copied as an unpacked resource and later run with `-ExecutionPolicy Bypass`, so a tampered per-user install resource can execute arbitrary script on the next scan. Suggested fix: verify a bundled hash/signature before spawning, or copy a verified embedded script to a temp path and avoid `Bypass` where possible.
./logs/codex-review.md:5070:  Severity: HIGH. If a packaged app is launched with `ELECTRON_RENDERER_URL` set, this branch loads arbitrary remote content while still exposing the preload bridge, so that page can call `startScan()` and read the local diagnostic report. Suggested fix: only honor this env var when `!app.isPackaged` and restrict it to the localhost dev origin.
./logs/codex-review.md:5076:  Severity: MEDIUM. After the user clicks cancel, `cancelScan` returns Home but the still-running `scan:start` promise can emit an `AbortError`, and this listener unconditionally switches the UI to the error state. Suggested fix: suppress expected `AbortError` in main or track the current/cancelled scan id in the renderer before accepting `scan:error`.
./logs/codex-review.md:5082:  Severity: MEDIUM. Any renderer-created `window.open()` URL is handed to the OS, so a compromised renderer or future user-controlled link could open `file:`, custom protocols, or unexpected hosts. Suggested fix: parse the URL and allow only expected `https:` origins before calling `shell.openExternal`.
./logs/codex-review.md:5084:- [P2] MEDIUM: Enable the renderer sandbox — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:23-28
./logs/codex-review.md:5085:  Severity: MEDIUM. `sandbox: false` removes Chromium's renderer OS sandbox, so any renderer compromise has a larger post-exploitation surface even with `nodeIntegration` off. Suggested fix: set `sandbox: true` and keep the preload limited to `contextBridge`/`ipcRenderer`.
./logs/codex-review.md:5088:  Severity: MEDIUM. The PowerShell script is copied as an unpacked resource and later run with `-ExecutionPolicy Bypass`, so a tampered per-user install resource can execute arbitrary script on the next scan. Suggested fix: verify a bundled hash/signature before spawning, or copy a verified embedded script to a temp path and avoid `Bypass` where possible.
./src/main/index.ts:29:      sandbox: true
./src/main/index.ts:41:        void shell.openExternal(url);
./src/main/index.ts:49:  const devUrl = process.env.ELECTRON_RENDERER_URL;
./src/main/index.ts:74:        outputDir: getScanOutputDir(),
./src/main/index.ts:77:        enforceIntegrity: app.isPackaged
./src/main/index.ts:85:      const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
./src/main/index.ts:128:    await shell.openExternal(getWebReportImportUrl());
./tests/scanner.test.ts:3:import { tmpdir } from "node:os";
./tests/scanner.test.ts:29:    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
./tests/scanner.test.ts:34:        outputDir: dir,
./tests/scanner.test.ts:50:    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
./tests/scanner.test.ts:55:        outputDir: dir,
./tests/scanner.test.ts:67:describe("verifyScriptIntegrity", () => {
./tests/scanner.test.ts:69:    const dir = mkdtempSync(join(tmpdir(), "fb-integ-skip-"));
./tests/scanner.test.ts:74:        __testing.verifyScriptIntegrity(scriptPath, { enforce: false })
./tests/scanner.test.ts:82:    const dir = mkdtempSync(join(tmpdir(), "fb-integ-strict-"));
./tests/scanner.test.ts:87:        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
./tests/scanner.test.ts:95:    const dir = mkdtempSync(join(tmpdir(), "fb-integ-ok-"));
./tests/scanner.test.ts:100:    writeFileSync(join(dir, "script.sha256"), `${hash}\n`, "utf8");
./tests/scanner.test.ts:103:        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
./tests/scanner.test.ts:111:    const dir = mkdtempSync(join(tmpdir(), "fb-integ-bad-"));
./tests/scanner.test.ts:114:    writeFileSync(join(dir, "script.sha256"), "0".repeat(64) + "\n", "utf8");
./tests/scanner.test.ts:117:        __testing.verifyScriptIntegrity(scriptPath, { enforce: true })
./scripts/embed-ps-hash.mjs:4: * resources/powershell/script.sha256 so the packaged main process can
./scripts/embed-ps-hash.mjs:17:const hashPath = join(projectRoot, "resources", "powershell", "script.sha256");

codex
The v0.1.2 manifest is packaged through extraResources and the other reviewed fixes did not show new regressions, but the new PowerShell integrity protection still has bypass paths. The expected hash is not anchored in a trusted bundle, so the original unpacked-script risk is not fully fixed.

Full review comments:

- [P2] Keep the script hash in a trusted bundle — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:15-18
  In packaged builds, `Invoke-FormatBuddyScan.ps1` and `script.sha256` are both copied under the same external `process.resourcesPath/powershell` directory, so reading the expected digest from `dirname(scriptPath)` lets anyone who can tamper with the unpacked resources update both files and still pass the check before `-ExecutionPolicy Bypass` runs. Store the expected digest inside the bundled main code/app.asar or signed metadata, or Authenticode-sign the script, and compare the external script against that trusted value.

- [P3] Execute the verified script bytes — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:117-117
  The check hashes `options.scriptPath` here, but `runPowershellScan` later reopens the same mutable path by passing it to PowerShell, so in a writable packaged install a local watcher can replace the file after this await and before PowerShell opens it. Execute the already-verified content, for example via a locked/private temp copy or by passing verified script content to PowerShell, instead of reopening the resource path.
The v0.1.2 manifest is packaged through extraResources and the other reviewed fixes did not show new regressions, but the new PowerShell integrity protection still has bypass paths. The expected hash is not anchored in a trusted bundle, so the original unpacked-script risk is not fully fixed.

Full review comments:

- [P2] Keep the script hash in a trusted bundle — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:15-18
  In packaged builds, `Invoke-FormatBuddyScan.ps1` and `script.sha256` are both copied under the same external `process.resourcesPath/powershell` directory, so reading the expected digest from `dirname(scriptPath)` lets anyone who can tamper with the unpacked resources update both files and still pass the check before `-ExecutionPolicy Bypass` runs. Store the expected digest inside the bundled main code/app.asar or signed metadata, or Authenticode-sign the script, and compare the external script against that trusted value.

- [P3] Execute the verified script bytes — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:117-117
  The check hashes `options.scriptPath` here, but `runPowershellScan` later reopens the same mutable path by passing it to PowerShell, so in a writable packaged install a local watcher can replace the file after this await and before PowerShell opens it. Execute the already-verified content, for example via a locked/private temp copy or by passing verified script content to PowerShell, instead of reopening the resource path.
