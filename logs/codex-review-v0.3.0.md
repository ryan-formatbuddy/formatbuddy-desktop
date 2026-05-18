OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e3903-4045-7532-b0e6-00441a10e429
--------
user
# Code review request — FormatBuddy Desktop v0.3.0 new surface

The previous Codex review cycle (v0.1.0 → v0.1.5) closed all 18 findings on the original surface. Since then two feature releases shipped:

- v0.2.0: in-app auto-update (electron-updater + GitHub Releases feed)
- v0.3.0 (just published): PowerShell `-Mode` parameter, `winget export` bundled in quick scans, separate "백업 manifest" mode that hashes user folders

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (private)
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`
- Last commit: `666888d`

## Focus only on NEW code

Skip everything you've already cleared (general Electron baseline, integrity-staging core, design tokens). Look only at:

### v0.2.0 additions
- `src/main/updater.ts` — autoUpdater config, IPC wiring, dev/packaged gating
- `src/main/index.ts` — initAutoUpdater on whenReady + shutdownAutoUpdater on before-quit, `update:install` IPC handler
- `src/preload/index.ts` — 7 new bridge methods
- `src/renderer/src/components/UpdateBanner.tsx`
- `electron-builder.yml` — `publish` provider github

### v0.3.0 additions
- `resources/powershell/Invoke-FormatBuddyScan.ps1` — new `-Mode`, `Get-WingetExport`, `Get-BackupManifest`, mode-branched main body
- `src/main/scanner.ts` — new `runBackupManifest` export
- `src/main/index.ts` — new `manifest:export` IPC handler (Save Dialog + runBackupManifest)
- `src/preload/index.ts` — `exportBackupManifest`
- `src/renderer/src/pages/Report.tsx` — winget card + backup-manifest section
- `src/shared/types.ts` — WingetExport / ManifestExportResult
- `src/shared/copy.ts` — new strings

## Specifically check

1. **Auto-update**
   - Is `update:install` reachable from a hostile renderer? Any input validation needed?
   - `shutdownAutoUpdater` on before-quit + `removeAllListeners` — does that race with an in-flight download?
   - Is `bound = false` reset correct so re-init after activate works?
   - The `bound` guard prevents double-binding but does it also prevent re-binding to a NEW window after the old one closes?

2. **winget export**
   - `Get-WingetExport` uses a tempfile derived from `GetTempFileName()` + `.json` suffix. Any race on that path?
   - `winget` is invoked with `--accept-source-agreements --disable-interactivity` — anything else missing?
   - The parsed JSON goes straight into `ScanReport.wingetExport`. Is the depth-16 `ConvertFrom-Json` sufficient or wasteful?
   - What if winget output is malformed JSON — does it crash the scan or just become null?

3. **Backup manifest**
   - `runBackupManifest` passes the user-chosen `outputPath` directly as `-OutputPath` to PowerShell. Any path-injection or quoting risk? (electron `spawn` array form — should be safe, confirm)
   - PowerShell `Get-BackupManifest` walks `Get-ChildItem -Recurse -File -Force` and rehashes every file. Symlink/junction follow behavior? Infinite loops?
   - The `$rel` substring relies on case-insensitive prefix match; OK on Windows but is the comparison robust if the user folder path contains `..` or special chars?
   - Save Dialog `defaultPath` is `~/Desktop/formatbuddy-backup-manifest.json`. If the user picks a location outside their profile (e.g. system dir) and the app lacks rights, does PowerShell fail gracefully?
   - 100 MiB file-size cap is hardcoded. Is that defensible or should it be configurable?

4. **Anything else that smells**
   - new tests adequate? 13 vitest pass — is the new manifest path test-covered? (it isn't directly; `runBackupManifest` requires Windows. note this and suggest mock-coverage if reasonable)
   - copy.ts strings — any rule violation ("스캔", "리셋" etc.)?

## Output

Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). file:line + 1-line fix. If a section has no issues, say "no issues". If zero new issues total, say so explicitly so I can mark v0.3.0 as the stable preview and stop.
2026-05-18T02:56:15.499086Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T02:56:15.887232Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc "cat /Users/ryanbak/.agents/skills/user/cto-code-review/SKILL.md && printf '\\n---PWD---\\n' && pwd && printf '\\n---GIT---\\n' && git status --short && git log --oneline --decorate -n 10" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4422ms:
2026-05-18 11:56:32.442 xcodebuild[74241:41410459]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:32.711 xcodebuild[74241:41410456] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-OLvmZYT1' (errno=Operation not permitted)
2026-05-18 11:56:33.324 xcodebuild[74247:41410505]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:33.480 xcodebuild[74247:41410504] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v0.3.0.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-V3pvNfGz' (errno=Operation not permitted)
2026-05-18 11:56:34.679 xcodebuild[74251:41410753]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:34.831 xcodebuild[74251:41410752] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-7VPhuZf7' (errno=Operation not permitted)
2026-05-18 11:56:35.392 xcodebuild[74259:41410825]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:35.544 xcodebuild[74259:41410824] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
666888d (HEAD -> main, origin/main) feat: winget export bundled in scan + backup manifest export (v0.3.0)
b4b9b73 feat: in-app auto-update via electron-updater + GitHub Releases (v0.2.0)
1c98b3d fix: clean up staging dir on write failure (v0.1.5 — stable preview)
d1a051f fix: per-run mkdtemp + restrictive perms for PS staging (v0.1.4)
b9e0e0f fix: anchor PS integrity hash in app.asar + stage verified bytes (v0.1.3)
c23d45b feat: PowerShell script integrity verification (v0.1.2)
ce83561 fix: apply 13 of 15 findings from Codex code review (v0.1.1)
4074082 build: add multi-size .ico app icon + disable cross-build code signing
c03d19f chore: initial FormatBuddy Desktop scaffold

exec
/bin/zsh -lc "printf '%s\\n' '--- diff 1c98b3d..HEAD --stat ---'; git diff --stat 1c98b3d..HEAD; printf '%s\\n' '--- files ---'; git diff --name-only 1c98b3d..HEAD" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4028ms:
2026-05-18 11:56:41.488 xcodebuild[74269:41410941]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:41.633 xcodebuild[74269:41410940] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-S751P8p2' (errno=Operation not permitted)
2026-05-18 11:56:42.171 xcodebuild[74271:41410955]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:42.317 xcodebuild[74271:41410953] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 electron-builder.yml                            |   6 +
 package-lock.json                               |  83 +++++++-
 package.json                                    |   5 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 244 ++++++++++++++++++------
 src/main/index.ts                               |  44 ++++-
 src/main/scanner.ts                             | 103 ++++++++++
 src/main/updater.ts                             |  97 ++++++++++
 src/preload/index.ts                            |  47 ++++-
 src/renderer/src/App.tsx                        |   2 +
 src/renderer/src/components/UpdateBanner.tsx    |  88 +++++++++
 src/renderer/src/pages/Report.tsx               |  60 ++++++
 src/renderer/src/styles/globals.css             |  48 +++++
 src/shared/copy.ts                              |  22 ++-
 src/shared/ipc.ts                               |  10 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  48 +++++
 tests/ipc.test.ts                               |  16 +-
 17 files changed, 851 insertions(+), 74 deletions(-)
--- files ---
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-OAbWuMi3' (errno=Operation not permitted)
2026-05-18 11:56:43.525 xcodebuild[74286:41411061]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:43.671 xcodebuild[74286:41411060] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-KWvItVCt' (errno=Operation not permitted)
2026-05-18 11:56:44.202 xcodebuild[74288:41411074]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:56:44.347 xcodebuild[74288:41411072] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
electron-builder.yml
package-lock.json
package.json
resources/powershell/Invoke-FormatBuddyScan.ps1
src/main/index.ts
src/main/scanner.ts
src/main/updater.ts
src/preload/index.ts
src/renderer/src/App.tsx
src/renderer/src/components/UpdateBanner.tsx
src/renderer/src/pages/Report.tsx
src/renderer/src/styles/globals.css
src/shared/copy.ts
src/shared/ipc.ts
src/shared/ps-script-hash.ts
src/shared/types.ts
tests/ipc.test.ts

exec
/bin/zsh -lc 'for f in src/main/updater.ts src/main/index.ts src/main/scanner.ts src/preload/index.ts src/renderer/src/components/UpdateBanner.tsx src/renderer/src/pages/Report.tsx src/shared/types.ts src/shared/copy.ts src/shared/ipc.ts resources/powershell/Invoke-FormatBuddyScan.ps1 electron-builder.yml tests/ipc.test.ts package.json; do echo "--- $f ---"; nl -ba "$f" | sed -n '"'1,260p'; done" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- src/main/updater.ts ---
     1	import { app, type BrowserWindow } from "electron";
     2	import { autoUpdater } from "electron-updater";
     3	import { IpcChannels } from "@shared/ipc";
     4	import type {
     5	  UpdateDownloadProgress,
     6	  UpdateErrorPayload,
     7	  UpdateInfo
     8	} from "@shared/types";
     9	
    10	const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    11	
    12	let checkTimer: NodeJS.Timeout | null = null;
    13	let bound = false;
    14	
    15	export function initAutoUpdater(window: BrowserWindow): void {
    16	  // electron-updater requires a packaged app + a published feed.
    17	  // In dev (npm run dev) skip silently so the developer doesn't see
    18	  // spurious "no published versions" errors.
    19	  if (!app.isPackaged) return;
    20	  if (bound) return;
    21	  bound = true;
    22	
    23	  autoUpdater.autoDownload = true;
    24	  autoUpdater.autoInstallOnAppQuit = true;
    25	  autoUpdater.allowDowngrade = false;
    26	  autoUpdater.allowPrerelease = false;
    27	
    28	  const send = (channel: string, payload?: unknown) => {
    29	    if (!window.isDestroyed()) {
    30	      window.webContents.send(channel, payload);
    31	    }
    32	  };
    33	
    34	  autoUpdater.on("checking-for-update", () => {
    35	    send(IpcChannels.updateChecking);
    36	  });
    37	
    38	  autoUpdater.on("update-available", (info) => {
    39	    const payload: UpdateInfo = {
    40	      version: info.version,
    41	      releaseDate: info.releaseDate,
    42	      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null
    43	    };
    44	    send(IpcChannels.updateAvailable, payload);
    45	  });
    46	
    47	  autoUpdater.on("update-not-available", () => {
    48	    send(IpcChannels.updateNotAvailable);
    49	  });
    50	
    51	  autoUpdater.on("download-progress", (p) => {
    52	    const payload: UpdateDownloadProgress = {
    53	      bytesPerSecond: p.bytesPerSecond,
    54	      percent: p.percent,
    55	      transferred: p.transferred,
    56	      total: p.total
    57	    };
    58	    send(IpcChannels.updateDownloadProgress, payload);
    59	  });
    60	
    61	  autoUpdater.on("update-downloaded", (info) => {
    62	    const payload: UpdateInfo = {
    63	      version: info.version,
    64	      releaseDate: info.releaseDate,
    65	      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null
    66	    };
    67	    send(IpcChannels.updateDownloaded, payload);
    68	  });
    69	
    70	  autoUpdater.on("error", (e) => {
    71	    const payload: UpdateErrorPayload = { message: e.message };
    72	    send(IpcChannels.updateError, payload);
    73	  });
    74	
    75	  // First check fires shortly after window-ready; recurring checks afterwards.
    76	  void autoUpdater.checkForUpdates().catch(() => {
    77	    // network errors here are surfaced via the "error" event above
    78	  });
    79	
    80	  checkTimer = setInterval(() => {
    81	    void autoUpdater.checkForUpdates().catch(() => {});
    82	  }, CHECK_INTERVAL_MS);
    83	}
    84	
    85	export function installAndRestart(): void {
    86	  if (!app.isPackaged) return;
    87	  autoUpdater.quitAndInstall();
    88	}
    89	
    90	export function shutdownAutoUpdater(): void {
    91	  if (checkTimer) {
    92	    clearInterval(checkTimer);
    93	    checkTimer = null;
    94	  }
    95	  autoUpdater.removeAllListeners();
    96	  bound = false;
    97	}
--- src/main/index.ts ---
     1	import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type {
     7	  ExportOptions,
     8	  ExportResult,
     9	  ManifestExportResult,
    10	  ScanError,
    11	  ScanProgress,
    12	  ScanResult
    13	} from "@shared/types";
    14	import { runBackupManifest, runScan } from "./scanner";
    15	import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
    16	import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";
    17	
    18	let mainWindow: BrowserWindow | null = null;
    19	let activeAbort: AbortController | null = null;
    20	
    21	const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
    22	
    23	function createWindow() {
    24	  mainWindow = new BrowserWindow({
    25	    width: 1080,
    26	    height: 760,
    27	    minWidth: 880,
    28	    minHeight: 640,
    29	    show: false,
    30	    autoHideMenuBar: true,
    31	    backgroundColor: "#FFFFFF",
    32	    title: "FormatBuddy",
    33	    webPreferences: {
    34	      preload: join(__dirname, "..", "preload", "index.js"),
    35	      contextIsolation: true,
    36	      nodeIntegration: false,
    37	      sandbox: true
    38	    }
    39	  });
    40	
    41	  mainWindow.on("ready-to-show", () => {
    42	    mainWindow?.show();
    43	  });
    44	
    45	  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    46	    try {
    47	      const parsed = new URL(url);
    48	      if (parsed.protocol === "https:") {
    49	        void shell.openExternal(url);
    50	      }
    51	    } catch {
    52	      // ignore malformed URLs
    53	    }
    54	    return { action: "deny" };
    55	  });
    56	
    57	  const devUrl = process.env.ELECTRON_RENDERER_URL;
    58	  if (!app.isPackaged && devUrl && DEV_RENDERER_PATTERN.test(devUrl)) {
    59	    void mainWindow.loadURL(devUrl);
    60	  } else {
    61	    void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
    62	  }
    63	}
    64	
    65	function registerIpc() {
    66	  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
    67	
    68	  ipcMain.handle(IpcChannels.scanStart, async (event) => {
    69	    if (activeAbort) activeAbort.abort();
    70	    const controller = new AbortController();
    71	    activeAbort = controller;
    72	    const sender = event.sender;
    73	
    74	    const emit = (progress: ScanProgress) => {
    75	      if (sender.isDestroyed() || controller.signal.aborted) return;
    76	      sender.send(IpcChannels.scanProgress, progress);
    77	    };
    78	
    79	    try {
    80	      const result: ScanResult = await runScan({
    81	        scriptPath: getScanScriptPath(),
    82	        outputDir: getScanOutputDir(),
    83	        signal: controller.signal,
    84	        onProgress: emit,
    85	        enforceIntegrity: app.isPackaged
    86	      });
    87	      if (!sender.isDestroyed() && !controller.signal.aborted) {
    88	        sender.send(IpcChannels.scanComplete, result);
    89	      }
    90	      return result;
    91	    } catch (err) {
    92	      const e = err as Error;
    93	      const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
    94	      const payload: ScanError = {
    95	        message: e.message,
    96	        code: (e as NodeJS.ErrnoException).code ?? undefined,
    97	        detail: e.stack
    98	      };
    99	      if (!isAbort && !sender.isDestroyed()) {
   100	        sender.send(IpcChannels.scanError, payload);
   101	      }
   102	      throw payload;
   103	    } finally {
   104	      if (activeAbort === controller) activeAbort = null;
   105	    }
   106	  });
   107	
   108	  ipcMain.handle(IpcChannels.scanCancel, () => {
   109	    if (activeAbort) {
   110	      activeAbort.abort();
   111	      activeAbort = null;
   112	      return true;
   113	    }
   114	    return false;
   115	  });
   116	
   117	  ipcMain.handle(
   118	    IpcChannels.reportExport,
   119	    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
   120	      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
   121	      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   122	      const dialogResult = await dialog.showSaveDialog(win!, {
   123	        title: "리포트 JSON 저장",
   124	        defaultPath,
   125	        filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
   126	      });
   127	      if (dialogResult.canceled || !dialogResult.filePath) {
   128	        return { saved: false };
   129	      }
   130	      await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
   131	      return { saved: true, path: dialogResult.filePath };
   132	    }
   133	  );
   134	
   135	  ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
   136	    await shell.openExternal(getWebReportImportUrl());
   137	    return true;
   138	  });
   139	
   140	  ipcMain.handle(IpcChannels.updateInstall, () => {
   141	    installAndRestart();
   142	    return true;
   143	  });
   144	
   145	  ipcMain.handle(IpcChannels.manifestExport, async (): Promise<ManifestExportResult> => {
   146	    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   147	    const defaultPath = getDefaultExportPath("formatbuddy-backup-manifest.json");
   148	    const dialogResult = await dialog.showSaveDialog(win!, {
   149	      title: "백업 manifest 저장 위치",
   150	      defaultPath,
   151	      filters: [{ name: "FormatBuddy backup manifest", extensions: ["json"] }]
   152	    });
   153	    if (dialogResult.canceled || !dialogResult.filePath) {
   154	      return { saved: false };
   155	    }
   156	    try {
   157	      const result = await runBackupManifest({
   158	        scriptPath: getScanScriptPath(),
   159	        outputPath: dialogResult.filePath,
   160	        enforceIntegrity: app.isPackaged
   161	      });
   162	      return { saved: result.saved, path: result.path };
   163	    } catch (err) {
   164	      const e = err as Error;
   165	      return { saved: false, message: e.message };
   166	    }
   167	  });
   168	}
   169	
   170	app.whenReady().then(() => {
   171	  electronApp.setAppUserModelId("app.formatbuddy.desktop");
   172	
   173	  app.on("browser-window-created", (_event, window) => {
   174	    optimizer.watchWindowShortcuts(window);
   175	  });
   176	
   177	  registerIpc();
   178	  createWindow();
   179	  if (mainWindow) initAutoUpdater(mainWindow);
   180	
   181	  app.on("activate", () => {
   182	    if (BrowserWindow.getAllWindows().length === 0) createWindow();
   183	    if (mainWindow) initAutoUpdater(mainWindow);
   184	  });
   185	});
   186	
   187	app.on("before-quit", () => {
   188	  if (activeAbort) {
   189	    activeAbort.abort();
   190	    activeAbort = null;
   191	  }
   192	  shutdownAutoUpdater();
   193	});
   194	
   195	app.on("window-all-closed", () => {
   196	  if (process.platform !== "darwin") app.quit();
   197	});
--- src/main/scanner.ts ---
     1	import { spawn } from "node:child_process";
     2	import { existsSync, mkdirSync, promises as fs } from "node:fs";
     3	import { tmpdir } from "node:os";
     4	import { dirname, join } from "node:path";
     5	import { createHash, randomUUID } from "node:crypto";
     6	import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
     7	import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
     8	
     9	const STDERR_MAX_BYTES = 64 * 1024;
    10	
    11	/**
    12	 * Read the on-disk PowerShell script, hash it, compare against the bundled
    13	 * expected digest, and (on match) copy the verified bytes into a private
    14	 * temp file. The returned path is what the caller MUST spawn — that closes
    15	 * the TOCTOU window between hash check and PowerShell open.
    16	 *
    17	 * Returns the staged path on success. Returns null when the on-disk script
    18	 * cannot be read OR the hash does not match AND `enforce` is false (dev
    19	 * workflow): the caller may then fall back to the original path or refuse
    20	 * to run.
    21	 */
    22	async function verifyAndStageScript(
    23	  scriptPath: string,
    24	  opts: { enforce: boolean; expectedHash?: string }
    25	): Promise<string | null> {
    26	  const expected = opts.expectedHash ?? EXPECTED_PS_SCRIPT_HASH;
    27	
    28	  let buf: Buffer;
    29	  try {
    30	    buf = await fs.readFile(scriptPath);
    31	  } catch (e) {
    32	    if (opts.enforce) throw e;
    33	    return null;
    34	  }
    35	
    36	  const actual = createHash("sha256").update(buf).digest("hex");
    37	  if (actual !== expected) {
    38	    if (opts.enforce) {
    39	      throw new Error(
    40	        `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
    41	      );
    42	    }
    43	    console.warn(
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
    58	  //   - on chmod/writeFile failure we MUST remove stagedDir before
    59	  //     re-throwing, otherwise runScan's finally never learns the path
    60	  //     and the per-run tempdir leaks
    61	  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
    62	  try {
    63	    try {
    64	      await fs.chmod(stagedDir, 0o700);
    65	    } catch {
    66	      // non-POSIX (Windows) — directory inherits parent ACL; the per-run
    67	      // random prefix is the main barrier
    68	    }
    69	    const stagedPath = join(stagedDir, "script.ps1");
    70	    await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
    71	    return stagedPath;
    72	  } catch (e) {
    73	    await fs.rm(stagedDir, { recursive: true, force: true }).catch(() => {
    74	      // best-effort: at worst the OS reaps the dir
    75	    });
    76	    throw e;
    77	  }
    78	}
    79	
    80	function isScanReport(value: unknown): value is ScanReport {
    81	  if (!value || typeof value !== "object") return false;
    82	  const r = value as Record<string, unknown>;
    83	  return (
    84	    typeof r.schemaVersion === "string" &&
    85	    typeof r.generatedAt === "string" &&
    86	    Array.isArray(r.disks) &&
    87	    Array.isArray(r.userFolders) &&
    88	    Array.isArray(r.installedApps) &&
    89	    Array.isArray(r.drivers) &&
    90	    Array.isArray(r.printers) &&
    91	    typeof r.system === "object" &&
    92	    typeof r.privacy === "object" &&
    93	    typeof r.checklist === "object"
    94	  );
    95	}
    96	
    97	async function readAndDelete(path: string): Promise<string> {
    98	  const raw = await fs.readFile(path, "utf8");
    99	  await fs.unlink(path).catch(() => {
   100	    // best-effort cleanup; ignore failures so a Windows lock doesn't crash the flow
   101	  });
   102	  return raw;
   103	}
   104	
   105	export interface RunScanOptions {
   106	  scriptPath: string;
   107	  outputDir: string;
   108	  onProgress?: (progress: ScanProgress) => void;
   109	  powershellExe?: string;
   110	  signal?: AbortSignal;
   111	  /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
   112	  mock?: boolean;
   113	  /** Require script.sha256 to exist and match. Set true for packaged production. */
   114	  enforceIntegrity?: boolean;
   115	}
   116	
   117	export interface RunBackupManifestOptions {
   118	  scriptPath: string;
   119	  outputPath: string;
   120	  signal?: AbortSignal;
   121	  powershellExe?: string;
   122	  enforceIntegrity?: boolean;
   123	  manifestMaxFileSizeBytes?: number;
   124	}
   125	
   126	export interface RunBackupManifestResult {
   127	  saved: boolean;
   128	  path: string;
   129	}
   130	
   131	const PIPELINE_STEPS: readonly string[] = [
   132	  "PC 정보 확인",
   133	  "디스크 살펴보기",
   134	  "사용자 폴더 챙기기",
   135	  "설치 앱 / 드라이버 목록",
   136	  "인증서·Wi-Fi·클라우드",
   137	  "포맷 체크리스트 정리"
   138	];
   139	
   140	const TOTAL_STEPS = PIPELINE_STEPS.length;
   141	
   142	function buildSteps(activeIndex: number): ScanStepView[] {
   143	  return PIPELINE_STEPS.map((name, i) => {
   144	    if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
   145	    if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
   146	    return { name, state: "pending", detail: "대기" };
   147	  });
   148	}
   149	
   150	function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
   151	  const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
   152	  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
   153	  return {
   154	    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
   155	    doneSteps: safeIndex,
   156	    totalSteps: TOTAL_STEPS,
   157	    score,
   158	    elapsedMs: Date.now() - startedAt,
   159	    steps: buildSteps(safeIndex),
   160	    message
   161	  };
   162	}
   163	
   164	export async function runScan(options: RunScanOptions): Promise<ScanResult> {
   165	  const { onProgress, signal, mock, enforceIntegrity } = options;
   166	  const startedAt = Date.now();
   167	
   168	  let stagedPath: string | null = null;
   169	  if (!mock) {
   170	    stagedPath = await verifyAndStageScript(options.scriptPath, {
   171	      enforce: !!enforceIntegrity
   172	    });
   173	  }
   174	  const effectiveScriptPath = stagedPath ?? options.scriptPath;
   175	
   176	  const tmpDir = join(tmpdir(), "formatbuddy-scans");
   177	  ensureDir(tmpDir);
   178	  const outPath = join(tmpDir, `report-${randomUUID()}.json`);
   179	
   180	  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
   181	
   182	  try {
   183	    if (mock || process.platform !== "win32") {
   184	      return await runMockScan({ outPath, startedAt, onProgress, signal });
   185	    }
   186	    return await runPowershellScan({
   187	      ...options,
   188	      scriptPath: effectiveScriptPath,
   189	      outPath,
   190	      startedAt
   191	    });
   192	  } finally {
   193	    if (stagedPath) {
   194	      const stagedDir = dirname(stagedPath);
   195	      await fs.unlink(stagedPath).catch(() => {
   196	        // best-effort: the temp file is in a per-run mkdtemp directory and
   197	        // will be reaped by the OS even if unlink fails
   198	      });
   199	      await fs.rmdir(stagedDir).catch(() => {
   200	        // best-effort cleanup of the per-run directory
   201	      });
   202	    }
   203	  }
   204	}
   205	
   206	function ensureDir(dir: string) {
   207	  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
   208	}
   209	
   210	interface InternalRunArgs {
   211	  outPath: string;
   212	  startedAt: number;
   213	  onProgress?: (progress: ScanProgress) => void;
   214	  signal?: AbortSignal;
   215	}
   216	
   217	async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
   218	  const { outPath, startedAt, onProgress, signal } = args;
   219	
   220	  for (let i = 1; i <= TOTAL_STEPS; i++) {
   221	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
   222	    await delay(380);
   223	    onProgress?.(progressFor(i, startedAt));
   224	  }
   225	
   226	  const report: ScanReport = buildMockReport();
   227	  ensureDir(dirname(outPath));
   228	  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
   229	
   230	  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
   231	  return { report, jsonPath: outPath };
   232	}
   233	
   234	interface PowershellRunArgs extends RunScanOptions {
   235	  outPath: string;
   236	  startedAt: number;
   237	}
   238	
   239	function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
   240	  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   241	  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   242	
   243	  return new Promise<ScanResult>((resolveScan, rejectScan) => {
   244	    const child = spawn(
   245	      exe,
   246	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
   247	      { windowsHide: true }
   248	    );
   249	
   250	    let activeIndex = 0;
   251	    let stderrBuf = "";
   252	    const tick = setInterval(() => {
   253	      if (activeIndex < TOTAL_STEPS) {
   254	        activeIndex += 1;
   255	        onProgress?.(progressFor(activeIndex, startedAt));
   256	      }
   257	    }, 700);
   258	
   259	    const cleanup = () => {
   260	      clearInterval(tick);
--- src/preload/index.ts ---
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ExportOptions,
     5	  ExportResult,
     6	  ManifestExportResult,
     7	  ScanError,
     8	  ScanProgress,
     9	  ScanReport,
    10	  ScanResult,
    11	  UpdateDownloadProgress,
    12	  UpdateErrorPayload,
    13	  UpdateInfo
    14	} from "@shared/types";
    15	
    16	type ProgressListener = (progress: ScanProgress) => void;
    17	type CompleteListener = (result: ScanResult) => void;
    18	type ErrorListener = (error: ScanError) => void;
    19	type UpdateInfoListener = (info: UpdateInfo) => void;
    20	type UpdateProgressListener = (p: UpdateDownloadProgress) => void;
    21	type UpdateErrorListener = (e: UpdateErrorPayload) => void;
    22	type VoidListener = () => void;
    23	
    24	const fb = {
    25	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    26	
    27	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    28	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    29	
    30	  onScanProgress(cb: ProgressListener): () => void {
    31	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    32	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    33	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    34	  },
    35	  onScanComplete(cb: CompleteListener): () => void {
    36	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    37	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    38	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    39	  },
    40	  onScanError(cb: ErrorListener): () => void {
    41	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    42	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    43	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    44	  },
    45	
    46	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    47	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    48	
    49	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),
    50	
    51	  onUpdateChecking(cb: VoidListener): () => void {
    52	    const wrapped = () => cb();
    53	    ipcRenderer.on(IpcChannels.updateChecking, wrapped);
    54	    return () => ipcRenderer.removeListener(IpcChannels.updateChecking, wrapped);
    55	  },
    56	  onUpdateAvailable(cb: UpdateInfoListener): () => void {
    57	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    58	    ipcRenderer.on(IpcChannels.updateAvailable, wrapped);
    59	    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, wrapped);
    60	  },
    61	  onUpdateNotAvailable(cb: VoidListener): () => void {
    62	    const wrapped = () => cb();
    63	    ipcRenderer.on(IpcChannels.updateNotAvailable, wrapped);
    64	    return () => ipcRenderer.removeListener(IpcChannels.updateNotAvailable, wrapped);
    65	  },
    66	  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
    67	    const wrapped = (_e: unknown, p: UpdateDownloadProgress) => cb(p);
    68	    ipcRenderer.on(IpcChannels.updateDownloadProgress, wrapped);
    69	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloadProgress, wrapped);
    70	  },
    71	  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
    72	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    73	    ipcRenderer.on(IpcChannels.updateDownloaded, wrapped);
    74	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloaded, wrapped);
    75	  },
    76	  onUpdateError(cb: UpdateErrorListener): () => void {
    77	    const wrapped = (_e: unknown, err: UpdateErrorPayload) => cb(err);
    78	    ipcRenderer.on(IpcChannels.updateError, wrapped);
    79	    return () => ipcRenderer.removeListener(IpcChannels.updateError, wrapped);
    80	  },
    81	  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),
    82	
    83	  exportBackupManifest: (): Promise<ManifestExportResult> =>
    84	    ipcRenderer.invoke(IpcChannels.manifestExport)
    85	};
    86	
    87	contextBridge.exposeInMainWorld("fb", fb);
    88	
    89	export type FbBridge = typeof fb;
--- src/renderer/src/components/UpdateBanner.tsx ---
     1	import { useEffect, useState } from "react";
     2	import { copy } from "@shared/copy";
     3	import type { UpdateDownloadProgress, UpdateInfo } from "@shared/types";
     4	
     5	type UpdatePhase =
     6	  | { kind: "idle" }
     7	  | { kind: "available"; info: UpdateInfo }
     8	  | { kind: "downloading"; percent: number }
     9	  | { kind: "downloaded"; info: UpdateInfo }
    10	  | { kind: "error"; message: string };
    11	
    12	function formatPercent(p: number): string {
    13	  if (!isFinite(p) || p < 0) return "0%";
    14	  return `${Math.min(100, Math.round(p))}%`;
    15	}
    16	
    17	export function UpdateBanner() {
    18	  const [phase, setPhase] = useState<UpdatePhase>({ kind: "idle" });
    19	
    20	  useEffect(() => {
    21	    if (!window.fb) return;
    22	
    23	    const offAvailable = window.fb.onUpdateAvailable((info) => {
    24	      setPhase({ kind: "available", info });
    25	    });
    26	    const offProgress = window.fb.onUpdateDownloadProgress((p: UpdateDownloadProgress) => {
    27	      setPhase({ kind: "downloading", percent: p.percent });
    28	    });
    29	    const offDownloaded = window.fb.onUpdateDownloaded((info) => {
    30	      setPhase({ kind: "downloaded", info });
    31	    });
    32	    const offError = window.fb.onUpdateError((e) => {
    33	      setPhase({ kind: "error", message: e.message });
    34	    });
    35	
    36	    return () => {
    37	      offAvailable();
    38	      offProgress();
    39	      offDownloaded();
    40	      offError();
    41	    };
    42	  }, []);
    43	
    44	  if (phase.kind === "idle") return null;
    45	
    46	  if (phase.kind === "error") {
    47	    return (
    48	      <div className="fb-update-banner fb-update-banner-quiet" role="status">
    49	        <span>{copy.updateErrorLabel}</span>
    50	        <span className="fb-update-banner-detail">{phase.message.slice(0, 80)}</span>
    51	      </div>
    52	    );
    53	  }
    54	
    55	  if (phase.kind === "available") {
    56	    return (
    57	      <div className="fb-update-banner" role="status">
    58	        <span>{copy.updateAvailable}</span>
    59	        <span className="fb-update-banner-detail">v{phase.info.version}</span>
    60	      </div>
    61	    );
    62	  }
    63	
    64	  if (phase.kind === "downloading") {
    65	    return (
    66	      <div className="fb-update-banner" role="status">
    67	        <span>{copy.updateDownloading}</span>
    68	        <span className="fb-update-banner-detail">{formatPercent(phase.percent)}</span>
    69	      </div>
    70	    );
    71	  }
    72	
    73	  // downloaded
    74	  return (
    75	    <div className="fb-update-banner fb-update-banner-ready" role="status">
    76	      <span>{copy.updateDownloaded}</span>
    77	      <button
    78	        type="button"
    79	        className="fb-btn fb-btn-on-blue fb-btn-sm"
    80	        onClick={() => {
    81	          void window.fb?.installUpdate();
    82	        }}
    83	      >
    84	        {copy.updateInstallCta}
    85	      </button>
    86	    </div>
    87	  );
    88	}
--- src/renderer/src/pages/Report.tsx ---
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
    34	  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
    35	  const [manifestRunning, setManifestRunning] = useState(false);
    36	
    37	  const installedCount = report.installedApps.length;
    38	  const driverCount = report.drivers.length;
    39	  const wifiCount = report.wifiProfiles.length;
    40	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    41	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    42	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    43	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    44	
    45	  const wingetPackageCount = useMemo(() => {
    46	    if (!report.wingetExport?.Sources) return 0;
    47	    return report.wingetExport.Sources.reduce(
    48	      (sum, src) => sum + (src.Packages?.length ?? 0),
    49	      0
    50	    );
    51	  }, [report.wingetExport]);
    52	
    53	  const onExport = useCallback(async () => {
    54	    if (!window.fb) return;
    55	    setExportStatus(null);
    56	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    57	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    58	    else setExportStatus("저장을 취소했어요.");
    59	  }, [report]);
    60	
    61	  const onOpenWeb = useCallback(async () => {
    62	    if (!window.fb) return;
    63	    await window.fb.openWebReport();
    64	  }, []);
    65	
    66	  const onExportManifest = useCallback(async () => {
    67	    if (!window.fb) return;
    68	    setManifestStatus(null);
    69	    setManifestRunning(true);
    70	    try {
    71	      const res = await window.fb.exportBackupManifest();
    72	      if (res.saved && res.path) {
    73	        setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
    74	      } else if (res.message) {
    75	        setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
    76	      } else {
    77	        setManifestStatus(copy.manifestExportCancelled);
    78	      }
    79	    } catch (e) {
    80	      const err = e as Error;
    81	      setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
    82	    } finally {
    83	      setManifestRunning(false);
    84	    }
    85	  }, []);
    86	
    87	  return (
    88	    <main className="fb-report">
    89	      <header className="fb-report-header">
    90	        <Lockup markSize={36} kanjiSize={20} en={false} />
    91	        <div className="fb-report-actions">
    92	          <Button variant="ghost" size="sm" onClick={onBack}>
    93	            {copy.reportBackCta}
    94	          </Button>
    95	        </div>
    96	      </header>
    97	
    98	      <section className="fb-report-hero">
    99	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
   100	        <p className="fb-lede">{copy.reportLede}</p>
   101	      </section>
   102	
   103	      <section className="fb-report-grid">
   104	        <article className="fb-card">
   105	          <h3>이 PC</h3>
   106	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
   107	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
   108	          <Row label="CPU" value={report.system.cpu ?? "—"} />
   109	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
   110	        </article>
   111	
   112	        <article className="fb-card">
   113	          <h3>저장 공간</h3>
   114	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
   115	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
   116	          {report.disks.map((d) => (
   117	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
   118	          ))}
   119	        </article>
   120	
   121	        <article className="fb-card">
   122	          <h3>같이 챙길 것</h3>
   123	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
   124	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
   125	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
   126	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
   127	        </article>
   128	
   129	        <article className="fb-card">
   130	          <h3>설치된 앱 / 드라이버</h3>
   131	          <Row label="설치된 앱" value={`${installedCount}개`} />
   132	          <Row label="드라이버" value={`${driverCount}개`} />
   133	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   134	          <Row label="프린터" value={`${report.printers.length}개`} />
   135	        </article>
   136	
   137	        <article className="fb-card">
   138	          <h3>사용자 폴더</h3>
   139	          {report.userFolders.map((f) => (
   140	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   141	          ))}
   142	        </article>
   143	
   144	        <article className="fb-card">
   145	          <h3>{copy.wingetSectionTitle}</h3>
   146	          {report.winget.available ? (
   147	            <p className="fb-report-card-explain">
   148	              {copy.wingetSummary(wingetPackageCount)}
   149	            </p>
   150	          ) : (
   151	            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
   152	          )}
   153	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   154	          <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
   155	        </article>
   156	
   157	        <article className="fb-card fb-card-checklist">
   158	          <h3>포맷 전 체크리스트</h3>
   159	          <ul className="fb-report-checklist">
   160	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   161	            <li>Desktop·Documents·Downloads 백업</li>
   162	            <li>클라우드 동기화 완료 확인</li>
   163	            <li>리포트 JSON 저장 후 포맷</li>
   164	          </ul>
   165	        </article>
   166	      </section>
   167	
   168	      <section className="fb-report-manifest">
   169	        <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
   170	        <p className="fb-lede">{copy.manifestExplain}</p>
   171	        <div className="fb-report-cta">
   172	          <Button
   173	            variant="primary"
   174	            size="lg"
   175	            onClick={onExportManifest}
   176	            disabled={manifestRunning}
   177	          >
   178	            {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
   179	          </Button>
   180	          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
   181	        </div>
   182	      </section>
   183	
   184	      <section className="fb-report-cta">
   185	        <Button variant="primary" size="lg" onClick={onExport}>
   186	          {copy.reportExportCta}
   187	        </Button>
   188	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   189	          {copy.reportOpenWebCta}
   190	        </Button>
   191	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   192	      </section>
   193	
   194	      <section className="fb-report-meta">
   195	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   196	        <small>schema {report.schemaVersion}</small>
   197	      </section>
   198	    </main>
   199	  );
   200	}
--- src/shared/types.ts ---
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
    90	export interface WingetExportPackage {
    91	  PackageIdentifier?: string;
    92	  Version?: string;
    93	  Source?: string;
    94	  [k: string]: unknown;
    95	}
    96	
    97	export interface WingetExportSource {
    98	  SourceDetails?: { Name?: string; Argument?: string; Type?: string };
    99	  Packages?: WingetExportPackage[];
   100	  [k: string]: unknown;
   101	}
   102	
   103	export interface WingetExport {
   104	  $schema?: string;
   105	  CreationDate?: string;
   106	  Sources?: WingetExportSource[];
   107	  WinGetVersion?: string;
   108	  [k: string]: unknown;
   109	}
   110	
   111	export interface PrivacyInfo {
   112	  localOnly: boolean;
   113	  noPasswordCollection: boolean;
   114	  noPrivateKeyUpload: boolean;
   115	  noBrowserPasswordExtraction: boolean;
   116	}
   117	
   118	export interface ChecklistInfo {
   119	  reviewNpkiManually: boolean;
   120	  exportWifiProfilesManually: boolean;
   121	  backupDesktopDocumentsDownloads: boolean;
   122	  verifyCloudSync: boolean;
   123	  saveReportBeforeFormat: boolean;
   124	}
   125	
   126	export interface ScanReport {
   127	  schemaVersion: string;
   128	  generatedAt: string;
   129	  mode?: "quick" | "manifest";
   130	  privacy: PrivacyInfo;
   131	  system: SystemInfo;
   132	  disks: DiskInfo[];
   133	  userFolders: UserFolderInfo[];
   134	  gpu: string[];
   135	  installedApps: InstalledApp[];
   136	  drivers: DriverInfo[];
   137	  printers: PrinterInfo[];
   138	  wifiProfiles: string[];
   139	  npkiCandidates: NpkiCandidate[];
   140	  bitlocker: BitLockerVolume[];
   141	  cloudSync: CloudSyncCandidate[];
   142	  browsers: BrowserPresence[];
   143	  winget: WingetStatus;
   144	  wingetExport?: WingetExport | null;
   145	  diagnostics: Array<{ step: string; message: string }>;
   146	  checklist: ChecklistInfo;
   147	}
   148	
   149	export interface ScanResult {
   150	  report: ScanReport;
   151	  jsonPath: string;
   152	}
   153	
   154	export interface ScanError {
   155	  message: string;
   156	  code?: string;
   157	  detail?: string;
   158	}
   159	
   160	export interface ExportOptions {
   161	  defaultFileName?: string;
   162	}
   163	
   164	export interface ExportResult {
   165	  saved: boolean;
   166	  path?: string;
   167	}
   168	
   169	export interface ManifestExportResult {
   170	  saved: boolean;
   171	  path?: string;
   172	  fileCount?: number;
   173	  totalBytes?: number;
   174	  message?: string;
   175	}
   176	
   177	export interface UpdateInfo {
   178	  version: string;
   179	  releaseDate?: string;
   180	  releaseNotes?: string | null;
   181	}
   182	
   183	export interface UpdateDownloadProgress {
   184	  bytesPerSecond: number;
   185	  percent: number;
   186	  transferred: number;
   187	  total: number;
   188	}
   189	
   190	export interface UpdateErrorPayload {
   191	  message: string;
   192	}
--- src/shared/copy.ts ---
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
    42	    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요.",
    43	
    44	  updateAvailable: "새 버전 받는 중이에요",
    45	  updateDownloading: "버디가 새 버전을 챙겨오고 있어요",
    46	  updateDownloaded: "준비 끝났어요. 다시 켜면 새 버전으로 시작해요",
    47	  updateInstallCta: "지금 재시작",
    48	  updateErrorLabel: "업데이트를 받지 못했어요",
    49	
    50	  wingetSectionTitle: "winget으로 다시 설치할 앱",
    51	  wingetSummary: (count: number) => `${count}개 앱을 winget으로 다시 설치할 수 있게 정리했어요`,
    52	  wingetUnavailable: "winget이 없어요. 앱 재설치 목록은 이번 PC에선 비워둘게요",
    53	
    54	  manifestSectionTitle: "백업 파일 무결성 manifest",
    55	  manifestExplain:
    56	    "Desktop·Documents·Downloads 같은 사용자 폴더의 파일을 해시(SHA-256)로 정리해 저장해요. 포맷 후 복원할 때 같은 파일이 잘 돌아왔는지 확인할 수 있어요.",
    57	  manifestExportCta: "백업 manifest 만들기",
    58	  manifestExportInProgress: "버디가 파일을 천천히 살펴보는 중이에요 (수십 초~수 분)",
    59	  manifestExportSavedPrefix: "저장했어요: ",
    60	  manifestExportCancelled: "저장을 취소했어요.",
    61	  manifestExportErrorPrefix: "지금 만들지 못했어요: ",
    62	  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요."
    63	} as const;
--- src/shared/ipc.ts ---
     1	export const IpcChannels = {
     2	  scanStart: "scan:start",
     3	  scanCancel: "scan:cancel",
     4	  scanProgress: "scan:progress",
     5	  scanComplete: "scan:complete",
     6	  scanError: "scan:error",
     7	  reportExport: "report:export",
     8	  reportOpenWeb: "report:open-web",
     9	  appVersion: "app:version",
    10	  updateChecking: "update:checking",
    11	  updateAvailable: "update:available",
    12	  updateNotAvailable: "update:not-available",
    13	  updateDownloadProgress: "update:download-progress",
    14	  updateDownloaded: "update:downloaded",
    15	  updateError: "update:error",
    16	  updateInstall: "update:install",
    17	  manifestExport: "manifest:export"
    18	} as const;
    19	
    20	export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
--- resources/powershell/Invoke-FormatBuddyScan.ps1 ---
     1	# FormatBuddy local diagnostic prototype
     2	# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
     3	#
     4	# Modes:
     5	#   -Mode quick     (default) full system diagnostics + installed apps + winget export summary
     6	#   -Mode manifest  per-user-folder SHA-256 manifest for backup/restore verification
     7	
     8	param(
     9	  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json",
    10	  [ValidateSet("quick", "manifest")]
    11	  [string]$Mode = "quick",
    12	  [int64]$ManifestMaxFileSizeBytes = 104857600
    13	)
    14	
    15	$ErrorActionPreference = "SilentlyContinue"
    16	$diagnostics = New-Object System.Collections.Generic.List[object]
    17	
    18	function Add-Diagnostic {
    19	  param([string]$Step, [string]$Message)
    20	  $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
    21	}
    22	
    23	function Get-SafeCimInstance {
    24	  param([string]$ClassName)
    25	  try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
    26	}
    27	
    28	function Get-InstalledApps {
    29	  $paths = @(
    30	    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    31	    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    32	    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    33	  )
    34	
    35	  foreach ($path in $paths) {
    36	    Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    37	      [ordered]@{
    38	        name = $_.DisplayName
    39	        version = $_.DisplayVersion
    40	        publisher = $_.Publisher
    41	      }
    42	    }
    43	  }
    44	}
    45	
    46	function Test-NpkiLocation {
    47	  $candidates = @(
    48	    "$env:USERPROFILE\AppData\LocalLow\NPKI",
    49	    "$env:USERPROFILE\AppData\Roaming\NPKI",
    50	    "$env:SystemDrive\NPKI"
    51	  )
    52	
    53	  foreach ($path in $candidates) {
    54	    [ordered]@{
    55	      path = $path
    56	      exists = Test-Path $path
    57	    }
    58	  }
    59	}
    60	
    61	function Get-FolderSizeGb {
    62	  param([string]$Path)
    63	
    64	  if (!(Test-Path $Path)) { return $null }
    65	
    66	  try {
    67	    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
    68	      Measure-Object -Property Length -Sum
    69	
    70	    if ($null -eq $sum.Sum) { return 0 }
    71	    return [Math]::Round($sum.Sum / 1GB, 2)
    72	  } catch {
    73	    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    74	    return $null
    75	  }
    76	}
    77	
    78	function Get-UserFolders {
    79	  $folders = @(
    80	    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    81	    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    82	    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    83	    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    84	    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    85	    @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
    86	  )
    87	
    88	  foreach ($folder in $folders) {
    89	    $exists = Test-Path $folder.path
    90	    [ordered]@{
    91	      name = $folder.name
    92	      path = $folder.path
    93	      exists = $exists
    94	      sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
    95	    }
    96	  }
    97	}
    98	
    99	function Get-CloudSyncCandidates {
   100	  $candidates = @(
   101	    @{ provider = "OneDrive"; path = $env:OneDrive },
   102	    @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
   103	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
   104	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
   105	    @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
   106	  ) | Where-Object { $_.path }
   107	
   108	  foreach ($candidate in $candidates) {
   109	    [ordered]@{
   110	      provider = $candidate.provider
   111	      path = $candidate.path
   112	      exists = Test-Path $candidate.path
   113	    }
   114	  }
   115	}
   116	
   117	function Get-BrowserPresence {
   118	  $browsers = @(
   119	    @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
   120	    @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
   121	    @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
   122	    @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   123	  )
   124	
   125	  foreach ($browser in $browsers) {
   126	    [ordered]@{
   127	      name = $browser.name
   128	      installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
   129	    }
   130	  }
   131	}
   132	
   133	function Get-WingetStatus {
   134	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   135	  [ordered]@{
   136	    available = [bool]$winget
   137	    note = if ($winget) { "winget is available. App export captured in wingetExport." } else { "winget is not available on this PC." }
   138	  }
   139	}
   140	
   141	function Get-WingetExport {
   142	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   143	  if (-not $winget) { return $null }
   144	
   145	  $tempBase = [System.IO.Path]::GetTempFileName()
   146	  Remove-Item $tempBase -Force -ErrorAction SilentlyContinue
   147	  $tempJson = "$tempBase.json"
   148	
   149	  try {
   150	    $null = & winget export -o $tempJson --accept-source-agreements --disable-interactivity 2>&1
   151	    if (Test-Path $tempJson) {
   152	      $raw = Get-Content -Raw -Path $tempJson -ErrorAction Stop
   153	      return ($raw | ConvertFrom-Json -Depth 16)
   154	    }
   155	  } catch {
   156	    Add-Diagnostic -Step "WingetExport" -Message $_.Exception.Message
   157	  } finally {
   158	    if (Test-Path $tempJson) { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
   159	  }
   160	
   161	  return $null
   162	}
   163	
   164	function Get-BackupManifest {
   165	  param(
   166	    [string[]]$Folders,
   167	    [int64]$MaxFileSize
   168	  )
   169	
   170	  $folderResults = New-Object System.Collections.Generic.List[object]
   171	
   172	  foreach ($folder in $Folders) {
   173	    if ([string]::IsNullOrWhiteSpace($folder)) { continue }
   174	    if (-not (Test-Path $folder)) {
   175	      $folderResults.Add([ordered]@{
   176	        folder = $folder
   177	        exists = $false
   178	        fileCount = 0
   179	        skippedCount = 0
   180	        totalBytes = 0
   181	        entries = @()
   182	        skipped = @()
   183	      }) | Out-Null
   184	      continue
   185	    }
   186	
   187	    $entries = New-Object System.Collections.Generic.List[object]
   188	    $skipped = New-Object System.Collections.Generic.List[object]
   189	    $folderNorm = $folder.TrimEnd('\','/')
   190	
   191	    Get-ChildItem -LiteralPath $folder -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
   192	      $rel = $_.FullName
   193	      if ($rel.StartsWith($folderNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
   194	        $rel = $rel.Substring($folderNorm.Length).TrimStart('\','/')
   195	      }
   196	
   197	      if ($_.Length -gt $MaxFileSize) {
   198	        $skipped.Add([ordered]@{
   199	          path = $rel
   200	          sizeBytes = $_.Length
   201	          reason = "exceeds-max-size"
   202	        }) | Out-Null
   203	        return
   204	      }
   205	
   206	      try {
   207	        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName -ErrorAction Stop
   208	        $entries.Add([ordered]@{
   209	          path = $rel
   210	          sizeBytes = $_.Length
   211	          sha256 = $hash.Hash
   212	          modifiedAt = $_.LastWriteTimeUtc.ToString("o")
   213	        }) | Out-Null
   214	      } catch {
   215	        $skipped.Add([ordered]@{
   216	          path = $rel
   217	          sizeBytes = $_.Length
   218	          reason = "hash-failed: $($_.Exception.Message)"
   219	        }) | Out-Null
   220	      }
   221	    }
   222	
   223	    $totalBytes = ($entries | Measure-Object -Property sizeBytes -Sum).Sum
   224	    if ($null -eq $totalBytes) { $totalBytes = 0 }
   225	
   226	    $folderResults.Add([ordered]@{
   227	      folder = $folder
   228	      exists = $true
   229	      fileCount = $entries.Count
   230	      skippedCount = $skipped.Count
   231	      totalBytes = $totalBytes
   232	      entries = @($entries)
   233	      skipped = @($skipped)
   234	    }) | Out-Null
   235	  }
   236	
   237	  return @($folderResults)
   238	}
   239	
   240	if ($Mode -eq "manifest") {
   241	  $manifestFolders = @(
   242	    [Environment]::GetFolderPath("Desktop"),
   243	    [Environment]::GetFolderPath("MyDocuments"),
   244	    [Environment]::GetFolderPath("MyPictures"),
   245	    [Environment]::GetFolderPath("MyMusic"),
   246	    [Environment]::GetFolderPath("MyVideos"),
   247	    (Join-Path $env:USERPROFILE "Downloads")
   248	  ) | Where-Object { $_ }
   249	
   250	  $report = [ordered]@{
   251	    schemaVersion = "0.2.0-manifest"
   252	    generatedAt = (Get-Date).ToString("o")
   253	    mode = "manifest"
   254	    privacy = [ordered]@{
   255	      localOnly = $true
   256	      noPasswordCollection = $true
   257	      noPrivateKeyUpload = $true
   258	      noBrowserPasswordExtraction = $true
   259	    }
   260	    maxFileSizeBytes = $ManifestMaxFileSizeBytes
--- electron-builder.yml ---
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
    49	
    50	publish:
    51	  - provider: github
    52	    owner: ryan-formatbuddy
    53	    repo: formatbuddy-desktop
    54	    releaseType: release
--- tests/ipc.test.ts ---
     1	import { describe, it, expect } from "vitest";
     2	import { IpcChannels } from "../src/shared/ipc";
     3	
     4	describe("IpcChannels", () => {
     5	  it("contains all expected scan/report/app channels", () => {
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
    16	  it("contains all expected update channels", () => {
    17	    expect(IpcChannels.updateChecking).toBe("update:checking");
    18	    expect(IpcChannels.updateAvailable).toBe("update:available");
    19	    expect(IpcChannels.updateNotAvailable).toBe("update:not-available");
    20	    expect(IpcChannels.updateDownloadProgress).toBe("update:download-progress");
    21	    expect(IpcChannels.updateDownloaded).toBe("update:downloaded");
    22	    expect(IpcChannels.updateError).toBe("update:error");
    23	    expect(IpcChannels.updateInstall).toBe("update:install");
    24	  });
    25	
    26	  it("contains manifest channel", () => {
    27	    expect(IpcChannels.manifestExport).toBe("manifest:export");
    28	  });
    29	
    30	  it("channel values are unique", () => {
    31	    const values = Object.values(IpcChannels);
    32	    expect(new Set(values).size).toBe(values.length);
    33	  });
    34	});
--- package.json ---
     1	{
     2	  "name": "formatbuddy-desktop",
     3	  "version": "0.3.0",
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
    29	    "@electron-toolkit/utils": "3.0.0",
    30	    "electron-updater": "^6.3.9"
    31	  },
    32	  "devDependencies": {
    33	    "@tailwindcss/vite": "4.0.6",
    34	    "@testing-library/react": "16.1.0",
    35	    "@types/node": "22.10.5",
    36	    "@types/react": "19.0.7",
    37	    "@types/react-dom": "19.0.3",
    38	    "@typescript-eslint/eslint-plugin": "8.20.0",
    39	    "@typescript-eslint/parser": "8.20.0",
    40	    "@vitejs/plugin-react": "4.3.4",
    41	    "electron": "33.3.1",
    42	    "electron-builder": "25.1.8",
    43	    "electron-vite": "2.3.0",
    44	    "eslint": "9.18.0",
    45	    "eslint-plugin-react": "7.37.4",
    46	    "eslint-plugin-react-hooks": "5.1.0",
    47	    "jsdom": "26.0.0",
    48	    "react": "19.0.0",
    49	    "react-dom": "19.0.0",
    50	    "tailwindcss": "4.0.6",
    51	    "typescript": "5.7.3",
    52	    "vite": "5.4.11",
    53	    "vitest": "2.1.8"
    54	  }
    55	}

exec
/bin/zsh -lc "printf '%s\\n' '--- scanner 217-420 ---'; nl -ba src/main/scanner.ts | sed -n '217,460p'; printf '%s\\n' '--- preload ---'; nl -ba src/preload/index.ts | sed -n '1,260p'; printf '%s\\n' '--- UpdateBanner ---'; nl -ba src/renderer/src/components/UpdateBanner.tsx | sed -n '1,220p'; printf '%s\\n' '--- Report ---'; nl -ba src/renderer/src/pages/Report.tsx | sed -n '1,260p'; printf '%s\\n' '--- types ---'; nl -ba src/shared/types.ts | sed -n '1,260p'; printf '%s\\n' '--- ps 240-420 ---'; nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '240,430p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- scanner 217-420 ---
   217	async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
   218	  const { outPath, startedAt, onProgress, signal } = args;
   219	
   220	  for (let i = 1; i <= TOTAL_STEPS; i++) {
   221	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
   222	    await delay(380);
   223	    onProgress?.(progressFor(i, startedAt));
   224	  }
   225	
   226	  const report: ScanReport = buildMockReport();
   227	  ensureDir(dirname(outPath));
   228	  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
   229	
   230	  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
   231	  return { report, jsonPath: outPath };
   232	}
   233	
   234	interface PowershellRunArgs extends RunScanOptions {
   235	  outPath: string;
   236	  startedAt: number;
   237	}
   238	
   239	function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
   240	  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   241	  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   242	
   243	  return new Promise<ScanResult>((resolveScan, rejectScan) => {
   244	    const child = spawn(
   245	      exe,
   246	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
   247	      { windowsHide: true }
   248	    );
   249	
   250	    let activeIndex = 0;
   251	    let stderrBuf = "";
   252	    const tick = setInterval(() => {
   253	      if (activeIndex < TOTAL_STEPS) {
   254	        activeIndex += 1;
   255	        onProgress?.(progressFor(activeIndex, startedAt));
   256	      }
   257	    }, 700);
   258	
   259	    const cleanup = () => {
   260	      clearInterval(tick);
   261	      signal?.removeEventListener("abort", onAbort);
   262	    };
   263	
   264	    const onAbort = () => {
   265	      child.kill();
   266	      cleanup();
   267	      rejectScan(new DOMException("Scan cancelled", "AbortError"));
   268	    };
   269	
   270	    if (signal) {
   271	      if (signal.aborted) {
   272	        onAbort();
   273	        return;
   274	      }
   275	      signal.addEventListener("abort", onAbort, { once: true });
   276	    }
   277	
   278	    child.stderr.on("data", (chunk: Buffer) => {
   279	      stderrBuf += chunk.toString("utf8");
   280	      if (stderrBuf.length > STDERR_MAX_BYTES) {
   281	        stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
   282	      }
   283	    });
   284	
   285	    child.on("error", (err) => {
   286	      cleanup();
   287	      rejectScan(err);
   288	    });
   289	
   290	    child.on("close", async (code) => {
   291	      cleanup();
   292	      if (code !== 0) {
   293	        rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
   294	        return;
   295	      }
   296	      try {
   297	        const raw = await readAndDelete(outPath);
   298	        const parsed: unknown = JSON.parse(raw);
   299	        if (!isScanReport(parsed)) {
   300	          rejectScan(new Error("Diagnostic JSON did not match expected ScanReport schema."));
   301	          return;
   302	        }
   303	        const report = parsed;
   304	        onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
   305	        resolveScan({ report, jsonPath: outPath });
   306	      } catch (e) {
   307	        rejectScan(e as Error);
   308	      }
   309	    });
   310	  });
   311	}
   312	
   313	function delay(ms: number) {
   314	  return new Promise<void>((res) => setTimeout(res, ms));
   315	}
   316	
   317	function buildMockReport(): ScanReport {
   318	  return {
   319	    schemaVersion: "0.1.0",
   320	    generatedAt: new Date().toISOString(),
   321	    privacy: {
   322	      localOnly: true,
   323	      noPasswordCollection: true,
   324	      noPrivateKeyUpload: true,
   325	      noBrowserPasswordExtraction: true
   326	    },
   327	    system: {
   328	      manufacturer: "Mock",
   329	      model: "DevPreview",
   330	      serialNumberMasked: "***0000",
   331	      osCaption: "Windows 11 Pro (mock)",
   332	      osVersion: "10.0.22631",
   333	      cpu: "Mock CPU",
   334	      memoryGb: 16
   335	    },
   336	    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
   337	    userFolders: [
   338	      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
   339	      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
   340	      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
   341	    ],
   342	    gpu: ["Mock GPU"],
   343	    installedApps: [
   344	      { name: "Chrome", version: "131.0", publisher: "Google" },
   345	      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
   346	    ],
   347	    drivers: [],
   348	    printers: [],
   349	    wifiProfiles: ["home", "office"],
   350	    npkiCandidates: [
   351	      { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
   352	      { path: "C:\\NPKI", exists: false }
   353	    ],
   354	    bitlocker: [],
   355	    cloudSync: [
   356	      { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
   357	      { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
   358	    ],
   359	    browsers: [
   360	      { name: "Chrome", installed: true },
   361	      { name: "Edge", installed: true },
   362	      { name: "Firefox", installed: false },
   363	      { name: "Whale", installed: true }
   364	    ],
   365	    winget: { available: true, note: "winget is available. App export can be added in Phase 2." },
   366	    diagnostics: [],
   367	    checklist: {
   368	      reviewNpkiManually: true,
   369	      exportWifiProfilesManually: true,
   370	      backupDesktopDocumentsDownloads: true,
   371	      verifyCloudSync: true,
   372	      saveReportBeforeFormat: true
   373	    }
   374	  };
   375	}
   376	
   377	export async function runBackupManifest(
   378	  options: RunBackupManifestOptions
   379	): Promise<RunBackupManifestResult> {
   380	  if (process.platform !== "win32") {
   381	    throw new Error("Backup manifest export is only available on Windows.");
   382	  }
   383	
   384	  const stagedPath = await verifyAndStageScript(options.scriptPath, {
   385	    enforce: !!options.enforceIntegrity
   386	  });
   387	  if (!stagedPath) {
   388	    throw new Error("PowerShell integrity check failed; refusing to spawn.");
   389	  }
   390	
   391	  const stagedDir = dirname(stagedPath);
   392	  const exe =
   393	    options.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   394	  const maxFileSize = options.manifestMaxFileSizeBytes ?? 104_857_600;
   395	
   396	  try {
   397	    return await new Promise<RunBackupManifestResult>((resolveOk, rejectOk) => {
   398	      const child = spawn(
   399	        exe,
   400	        [
   401	          "-NoProfile",
   402	          "-NonInteractive",
   403	          "-ExecutionPolicy",
   404	          "Bypass",
   405	          "-File",
   406	          stagedPath,
   407	          "-OutputPath",
   408	          options.outputPath,
   409	          "-Mode",
   410	          "manifest",
   411	          "-ManifestMaxFileSizeBytes",
   412	          String(maxFileSize)
   413	        ],
   414	        { windowsHide: true }
   415	      );
   416	
   417	      let stderrBuf = "";
   418	
   419	      const cleanup = () => {
   420	        if (options.signal) options.signal.removeEventListener("abort", onAbort);
   421	      };
   422	
   423	      const onAbort = () => {
   424	        child.kill();
   425	        cleanup();
   426	        rejectOk(new DOMException("Manifest export cancelled", "AbortError"));
   427	      };
   428	
   429	      if (options.signal) {
   430	        if (options.signal.aborted) {
   431	          onAbort();
   432	          return;
   433	        }
   434	        options.signal.addEventListener("abort", onAbort, { once: true });
   435	      }
   436	
   437	      child.stderr.on("data", (chunk: Buffer) => {
   438	        stderrBuf += chunk.toString("utf8");
   439	        if (stderrBuf.length > STDERR_MAX_BYTES) {
   440	          stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
   441	        }
   442	      });
   443	
   444	      child.on("error", (err) => {
   445	        cleanup();
   446	        rejectOk(err);
   447	      });
   448	
   449	      child.on("close", (code) => {
   450	        cleanup();
   451	        if (code !== 0) {
   452	          rejectOk(
   453	            new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`)
   454	          );
   455	          return;
   456	        }
   457	        resolveOk({ saved: true, path: options.outputPath });
   458	      });
   459	    });
   460	  } finally {
--- preload ---
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ExportOptions,
     5	  ExportResult,
     6	  ManifestExportResult,
     7	  ScanError,
     8	  ScanProgress,
     9	  ScanReport,
    10	  ScanResult,
    11	  UpdateDownloadProgress,
    12	  UpdateErrorPayload,
    13	  UpdateInfo
    14	} from "@shared/types";
    15	
    16	type ProgressListener = (progress: ScanProgress) => void;
    17	type CompleteListener = (result: ScanResult) => void;
    18	type ErrorListener = (error: ScanError) => void;
    19	type UpdateInfoListener = (info: UpdateInfo) => void;
    20	type UpdateProgressListener = (p: UpdateDownloadProgress) => void;
    21	type UpdateErrorListener = (e: UpdateErrorPayload) => void;
    22	type VoidListener = () => void;
    23	
    24	const fb = {
    25	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    26	
    27	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    28	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    29	
    30	  onScanProgress(cb: ProgressListener): () => void {
    31	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    32	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    33	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    34	  },
    35	  onScanComplete(cb: CompleteListener): () => void {
    36	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    37	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    38	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    39	  },
    40	  onScanError(cb: ErrorListener): () => void {
    41	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    42	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    43	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    44	  },
    45	
    46	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    47	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    48	
    49	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),
    50	
    51	  onUpdateChecking(cb: VoidListener): () => void {
    52	    const wrapped = () => cb();
    53	    ipcRenderer.on(IpcChannels.updateChecking, wrapped);
    54	    return () => ipcRenderer.removeListener(IpcChannels.updateChecking, wrapped);
    55	  },
    56	  onUpdateAvailable(cb: UpdateInfoListener): () => void {
    57	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    58	    ipcRenderer.on(IpcChannels.updateAvailable, wrapped);
    59	    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, wrapped);
    60	  },
    61	  onUpdateNotAvailable(cb: VoidListener): () => void {
    62	    const wrapped = () => cb();
    63	    ipcRenderer.on(IpcChannels.updateNotAvailable, wrapped);
    64	    return () => ipcRenderer.removeListener(IpcChannels.updateNotAvailable, wrapped);
    65	  },
    66	  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
    67	    const wrapped = (_e: unknown, p: UpdateDownloadProgress) => cb(p);
    68	    ipcRenderer.on(IpcChannels.updateDownloadProgress, wrapped);
    69	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloadProgress, wrapped);
    70	  },
    71	  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
    72	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    73	    ipcRenderer.on(IpcChannels.updateDownloaded, wrapped);
    74	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloaded, wrapped);
    75	  },
    76	  onUpdateError(cb: UpdateErrorListener): () => void {
    77	    const wrapped = (_e: unknown, err: UpdateErrorPayload) => cb(err);
    78	    ipcRenderer.on(IpcChannels.updateError, wrapped);
    79	    return () => ipcRenderer.removeListener(IpcChannels.updateError, wrapped);
    80	  },
    81	  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),
    82	
    83	  exportBackupManifest: (): Promise<ManifestExportResult> =>
    84	    ipcRenderer.invoke(IpcChannels.manifestExport)
    85	};
    86	
    87	contextBridge.exposeInMainWorld("fb", fb);
    88	
    89	export type FbBridge = typeof fb;
--- UpdateBanner ---
     1	import { useEffect, useState } from "react";
     2	import { copy } from "@shared/copy";
     3	import type { UpdateDownloadProgress, UpdateInfo } from "@shared/types";
     4	
     5	type UpdatePhase =
     6	  | { kind: "idle" }
     7	  | { kind: "available"; info: UpdateInfo }
     8	  | { kind: "downloading"; percent: number }
     9	  | { kind: "downloaded"; info: UpdateInfo }
    10	  | { kind: "error"; message: string };
    11	
    12	function formatPercent(p: number): string {
    13	  if (!isFinite(p) || p < 0) return "0%";
    14	  return `${Math.min(100, Math.round(p))}%`;
    15	}
    16	
    17	export function UpdateBanner() {
    18	  const [phase, setPhase] = useState<UpdatePhase>({ kind: "idle" });
    19	
    20	  useEffect(() => {
    21	    if (!window.fb) return;
    22	
    23	    const offAvailable = window.fb.onUpdateAvailable((info) => {
    24	      setPhase({ kind: "available", info });
    25	    });
    26	    const offProgress = window.fb.onUpdateDownloadProgress((p: UpdateDownloadProgress) => {
    27	      setPhase({ kind: "downloading", percent: p.percent });
    28	    });
    29	    const offDownloaded = window.fb.onUpdateDownloaded((info) => {
    30	      setPhase({ kind: "downloaded", info });
    31	    });
    32	    const offError = window.fb.onUpdateError((e) => {
    33	      setPhase({ kind: "error", message: e.message });
    34	    });
    35	
    36	    return () => {
    37	      offAvailable();
    38	      offProgress();
    39	      offDownloaded();
    40	      offError();
    41	    };
    42	  }, []);
    43	
    44	  if (phase.kind === "idle") return null;
    45	
    46	  if (phase.kind === "error") {
    47	    return (
    48	      <div className="fb-update-banner fb-update-banner-quiet" role="status">
    49	        <span>{copy.updateErrorLabel}</span>
    50	        <span className="fb-update-banner-detail">{phase.message.slice(0, 80)}</span>
    51	      </div>
    52	    );
    53	  }
    54	
    55	  if (phase.kind === "available") {
    56	    return (
    57	      <div className="fb-update-banner" role="status">
    58	        <span>{copy.updateAvailable}</span>
    59	        <span className="fb-update-banner-detail">v{phase.info.version}</span>
    60	      </div>
    61	    );
    62	  }
    63	
    64	  if (phase.kind === "downloading") {
    65	    return (
    66	      <div className="fb-update-banner" role="status">
    67	        <span>{copy.updateDownloading}</span>
    68	        <span className="fb-update-banner-detail">{formatPercent(phase.percent)}</span>
    69	      </div>
    70	    );
    71	  }
    72	
    73	  // downloaded
    74	  return (
    75	    <div className="fb-update-banner fb-update-banner-ready" role="status">
    76	      <span>{copy.updateDownloaded}</span>
    77	      <button
    78	        type="button"
    79	        className="fb-btn fb-btn-on-blue fb-btn-sm"
    80	        onClick={() => {
    81	          void window.fb?.installUpdate();
    82	        }}
    83	      >
    84	        {copy.updateInstallCta}
    85	      </button>
    86	    </div>
    87	  );
    88	}
--- Report ---
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
    34	  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
    35	  const [manifestRunning, setManifestRunning] = useState(false);
    36	
    37	  const installedCount = report.installedApps.length;
    38	  const driverCount = report.drivers.length;
    39	  const wifiCount = report.wifiProfiles.length;
    40	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    41	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    42	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    43	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    44	
    45	  const wingetPackageCount = useMemo(() => {
    46	    if (!report.wingetExport?.Sources) return 0;
    47	    return report.wingetExport.Sources.reduce(
    48	      (sum, src) => sum + (src.Packages?.length ?? 0),
    49	      0
    50	    );
    51	  }, [report.wingetExport]);
    52	
    53	  const onExport = useCallback(async () => {
    54	    if (!window.fb) return;
    55	    setExportStatus(null);
    56	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    57	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    58	    else setExportStatus("저장을 취소했어요.");
    59	  }, [report]);
    60	
    61	  const onOpenWeb = useCallback(async () => {
    62	    if (!window.fb) return;
    63	    await window.fb.openWebReport();
    64	  }, []);
    65	
    66	  const onExportManifest = useCallback(async () => {
    67	    if (!window.fb) return;
    68	    setManifestStatus(null);
    69	    setManifestRunning(true);
    70	    try {
    71	      const res = await window.fb.exportBackupManifest();
    72	      if (res.saved && res.path) {
    73	        setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
    74	      } else if (res.message) {
    75	        setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
    76	      } else {
    77	        setManifestStatus(copy.manifestExportCancelled);
    78	      }
    79	    } catch (e) {
    80	      const err = e as Error;
    81	      setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
    82	    } finally {
    83	      setManifestRunning(false);
    84	    }
    85	  }, []);
    86	
    87	  return (
    88	    <main className="fb-report">
    89	      <header className="fb-report-header">
    90	        <Lockup markSize={36} kanjiSize={20} en={false} />
    91	        <div className="fb-report-actions">
    92	          <Button variant="ghost" size="sm" onClick={onBack}>
    93	            {copy.reportBackCta}
    94	          </Button>
    95	        </div>
    96	      </header>
    97	
    98	      <section className="fb-report-hero">
    99	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
   100	        <p className="fb-lede">{copy.reportLede}</p>
   101	      </section>
   102	
   103	      <section className="fb-report-grid">
   104	        <article className="fb-card">
   105	          <h3>이 PC</h3>
   106	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
   107	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
   108	          <Row label="CPU" value={report.system.cpu ?? "—"} />
   109	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
   110	        </article>
   111	
   112	        <article className="fb-card">
   113	          <h3>저장 공간</h3>
   114	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
   115	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
   116	          {report.disks.map((d) => (
   117	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
   118	          ))}
   119	        </article>
   120	
   121	        <article className="fb-card">
   122	          <h3>같이 챙길 것</h3>
   123	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
   124	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
   125	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
   126	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
   127	        </article>
   128	
   129	        <article className="fb-card">
   130	          <h3>설치된 앱 / 드라이버</h3>
   131	          <Row label="설치된 앱" value={`${installedCount}개`} />
   132	          <Row label="드라이버" value={`${driverCount}개`} />
   133	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   134	          <Row label="프린터" value={`${report.printers.length}개`} />
   135	        </article>
   136	
   137	        <article className="fb-card">
   138	          <h3>사용자 폴더</h3>
   139	          {report.userFolders.map((f) => (
   140	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   141	          ))}
   142	        </article>
   143	
   144	        <article className="fb-card">
   145	          <h3>{copy.wingetSectionTitle}</h3>
   146	          {report.winget.available ? (
   147	            <p className="fb-report-card-explain">
   148	              {copy.wingetSummary(wingetPackageCount)}
   149	            </p>
   150	          ) : (
   151	            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
   152	          )}
   153	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   154	          <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
   155	        </article>
   156	
   157	        <article className="fb-card fb-card-checklist">
   158	          <h3>포맷 전 체크리스트</h3>
   159	          <ul className="fb-report-checklist">
   160	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   161	            <li>Desktop·Documents·Downloads 백업</li>
   162	            <li>클라우드 동기화 완료 확인</li>
   163	            <li>리포트 JSON 저장 후 포맷</li>
   164	          </ul>
   165	        </article>
   166	      </section>
   167	
   168	      <section className="fb-report-manifest">
   169	        <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
   170	        <p className="fb-lede">{copy.manifestExplain}</p>
   171	        <div className="fb-report-cta">
   172	          <Button
   173	            variant="primary"
   174	            size="lg"
   175	            onClick={onExportManifest}
   176	            disabled={manifestRunning}
   177	          >
   178	            {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
   179	          </Button>
   180	          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
   181	        </div>
   182	      </section>
   183	
   184	      <section className="fb-report-cta">
   185	        <Button variant="primary" size="lg" onClick={onExport}>
   186	          {copy.reportExportCta}
   187	        </Button>
   188	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   189	          {copy.reportOpenWebCta}
   190	        </Button>
   191	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   192	      </section>
   193	
   194	      <section className="fb-report-meta">
   195	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   196	        <small>schema {report.schemaVersion}</small>
   197	      </section>
   198	    </main>
   199	  );
   200	}
--- types ---
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
    90	export interface WingetExportPackage {
    91	  PackageIdentifier?: string;
    92	  Version?: string;
    93	  Source?: string;
    94	  [k: string]: unknown;
    95	}
    96	
    97	export interface WingetExportSource {
    98	  SourceDetails?: { Name?: string; Argument?: string; Type?: string };
    99	  Packages?: WingetExportPackage[];
   100	  [k: string]: unknown;
   101	}
   102	
   103	export interface WingetExport {
   104	  $schema?: string;
   105	  CreationDate?: string;
   106	  Sources?: WingetExportSource[];
   107	  WinGetVersion?: string;
   108	  [k: string]: unknown;
   109	}
   110	
   111	export interface PrivacyInfo {
   112	  localOnly: boolean;
   113	  noPasswordCollection: boolean;
   114	  noPrivateKeyUpload: boolean;
   115	  noBrowserPasswordExtraction: boolean;
   116	}
   117	
   118	export interface ChecklistInfo {
   119	  reviewNpkiManually: boolean;
   120	  exportWifiProfilesManually: boolean;
   121	  backupDesktopDocumentsDownloads: boolean;
   122	  verifyCloudSync: boolean;
   123	  saveReportBeforeFormat: boolean;
   124	}
   125	
   126	export interface ScanReport {
   127	  schemaVersion: string;
   128	  generatedAt: string;
   129	  mode?: "quick" | "manifest";
   130	  privacy: PrivacyInfo;
   131	  system: SystemInfo;
   132	  disks: DiskInfo[];
   133	  userFolders: UserFolderInfo[];
   134	  gpu: string[];
   135	  installedApps: InstalledApp[];
   136	  drivers: DriverInfo[];
   137	  printers: PrinterInfo[];
   138	  wifiProfiles: string[];
   139	  npkiCandidates: NpkiCandidate[];
   140	  bitlocker: BitLockerVolume[];
   141	  cloudSync: CloudSyncCandidate[];
   142	  browsers: BrowserPresence[];
   143	  winget: WingetStatus;
   144	  wingetExport?: WingetExport | null;
   145	  diagnostics: Array<{ step: string; message: string }>;
   146	  checklist: ChecklistInfo;
   147	}
   148	
   149	export interface ScanResult {
   150	  report: ScanReport;
   151	  jsonPath: string;
   152	}
   153	
   154	export interface ScanError {
   155	  message: string;
   156	  code?: string;
   157	  detail?: string;
   158	}
   159	
   160	export interface ExportOptions {
   161	  defaultFileName?: string;
   162	}
   163	
   164	export interface ExportResult {
   165	  saved: boolean;
   166	  path?: string;
   167	}
   168	
   169	export interface ManifestExportResult {
   170	  saved: boolean;
   171	  path?: string;
   172	  fileCount?: number;
   173	  totalBytes?: number;
   174	  message?: string;
   175	}
   176	
   177	export interface UpdateInfo {
   178	  version: string;
   179	  releaseDate?: string;
   180	  releaseNotes?: string | null;
   181	}
   182	
   183	export interface UpdateDownloadProgress {
   184	  bytesPerSecond: number;
   185	  percent: number;
   186	  transferred: number;
   187	  total: number;
   188	}
   189	
   190	export interface UpdateErrorPayload {
   191	  message: string;
   192	}
--- ps 240-420 ---
   240	if ($Mode -eq "manifest") {
   241	  $manifestFolders = @(
   242	    [Environment]::GetFolderPath("Desktop"),
   243	    [Environment]::GetFolderPath("MyDocuments"),
   244	    [Environment]::GetFolderPath("MyPictures"),
   245	    [Environment]::GetFolderPath("MyMusic"),
   246	    [Environment]::GetFolderPath("MyVideos"),
   247	    (Join-Path $env:USERPROFILE "Downloads")
   248	  ) | Where-Object { $_ }
   249	
   250	  $report = [ordered]@{
   251	    schemaVersion = "0.2.0-manifest"
   252	    generatedAt = (Get-Date).ToString("o")
   253	    mode = "manifest"
   254	    privacy = [ordered]@{
   255	      localOnly = $true
   256	      noPasswordCollection = $true
   257	      noPrivateKeyUpload = $true
   258	      noBrowserPasswordExtraction = $true
   259	    }
   260	    maxFileSizeBytes = $ManifestMaxFileSizeBytes
   261	    folders = Get-BackupManifest -Folders $manifestFolders -MaxFileSize $ManifestMaxFileSizeBytes
   262	    diagnostics = @($diagnostics)
   263	  }
   264	} else {
   265	  $computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
   266	  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   267	  $bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
   268	  $cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
   269	  $gpu = Get-SafeCimInstance Win32_VideoController
   270	  $disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
   271	  $printers = Get-SafeCimInstance Win32_Printer
   272	  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   273	  $wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
   274	  $bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
   275	
   276	  $report = [ordered]@{
   277	    schemaVersion = "0.2.0-quick"
   278	    generatedAt = (Get-Date).ToString("o")
   279	    mode = "quick"
   280	    privacy = [ordered]@{
   281	      localOnly = $true
   282	      noPasswordCollection = $true
   283	      noPrivateKeyUpload = $true
   284	      noBrowserPasswordExtraction = $true
   285	    }
   286	    system = [ordered]@{
   287	      manufacturer = $computer.Manufacturer
   288	      model = $computer.Model
   289	      serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
   290	      osCaption = $os.Caption
   291	      osVersion = $os.Version
   292	      cpu = $cpu.Name
   293	      memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
   294	    }
   295	    disks = @($disk | ForEach-Object {
   296	      [ordered]@{
   297	        drive = $_.DeviceID
   298	        sizeGb = [Math]::Round($_.Size / 1GB, 2)
   299	        freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
   300	      }
   301	    })
   302	    userFolders = @(Get-UserFolders)
   303	    gpu = @($gpu | ForEach-Object { $_.Name })
   304	    installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
   305	    drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
   306	    printers = @($printers | Select-Object Name, DriverName, PortName, Default)
   307	    wifiProfiles = @($wifiProfiles)
   308	    npkiCandidates = @(Test-NpkiLocation)
   309	    bitlocker = @($bitlocker)
   310	    cloudSync = @(Get-CloudSyncCandidates)
   311	    browsers = @(Get-BrowserPresence)
   312	    winget = Get-WingetStatus
   313	    wingetExport = Get-WingetExport
   314	    diagnostics = @($diagnostics)
   315	    checklist = [ordered]@{
   316	      reviewNpkiManually = $true
   317	      exportWifiProfilesManually = $true
   318	      backupDesktopDocumentsDownloads = $true
   319	      verifyCloudSync = $true
   320	      saveReportBeforeFormat = $true
   321	    }
   322	  }
   323	}
   324	
   325	$parent = Split-Path -Parent $OutputPath
   326	if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
   327	$report | ConvertTo-Json -Depth 16 | Out-File -FilePath $OutputPath -Encoding utf8
   328	Write-Host "FormatBuddy report saved: $OutputPath (mode=$Mode)"

exec
/bin/zsh -lc "nl -ba src/main/scanner.ts | sed -n '460,540p'; printf '%s\\n' '--- ps full around winget+manifest ---'; nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '133,238p'; printf '%s\\n' '--- app/window d.ts maybe fb type ---'; grep -R \"exportBackupManifest\\|installUpdate\\|onUpdate\" -n src | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 215ms:
src/renderer/src/components/UpdateBanner.tsx:23:    const offAvailable = window.fb.onUpdateAvailable((info) => {
src/renderer/src/components/UpdateBanner.tsx:26:    const offProgress = window.fb.onUpdateDownloadProgress((p: UpdateDownloadProgress) => {
src/renderer/src/components/UpdateBanner.tsx:29:    const offDownloaded = window.fb.onUpdateDownloaded((info) => {
src/renderer/src/components/UpdateBanner.tsx:32:    const offError = window.fb.onUpdateError((e) => {
src/renderer/src/components/UpdateBanner.tsx:81:          void window.fb?.installUpdate();
src/renderer/src/pages/Report.tsx:71:      const res = await window.fb.exportBackupManifest();
src/preload/index.ts:51:  onUpdateChecking(cb: VoidListener): () => void {
src/preload/index.ts:56:  onUpdateAvailable(cb: UpdateInfoListener): () => void {
src/preload/index.ts:61:  onUpdateNotAvailable(cb: VoidListener): () => void {
src/preload/index.ts:66:  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
src/preload/index.ts:71:  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
src/preload/index.ts:76:  onUpdateError(cb: UpdateErrorListener): () => void {
src/preload/index.ts:81:  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),
src/preload/index.ts:83:  exportBackupManifest: (): Promise<ManifestExportResult> =>

exec
/bin/zsh -lc "find src -maxdepth 4 -type f | sort | xargs grep -n \"interface Window\\|fb:\" -n || true; grep -R \"declare global\" -n src | sed -n '1,200p'; ls -la" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
src/preload/index.d.ts:4:  interface Window {
src/preload/index.d.ts:5:    fb: FbBridge;
src/preload/index.d.ts:3:declare global {
total 872
drwxr-xr-x@  24 ryanbak  staff     768 May 18 11:54 .
drwxr-xr-x    8 ryanbak  staff     256 May 18 01:58 ..
drwxr-xr-x@  12 ryanbak  staff     384 May 18 11:55 .git
-rw-r--r--@   1 ryanbak  staff      91 May 18 09:17 .gitignore
-rw-r--r--@   1 ryanbak  staff      20 May 18 02:07 .npmrc
drwxr-xr-x@   3 ryanbak  staff      96 May 18 11:56 .omc
-rw-r--r--@   1 ryanbak  staff    1677 May 18 01:26 README.md
drwxr-xr-x@   7 ryanbak  staff     224 May 18 11:54 dist
-rw-r--r--@   1 ryanbak  staff    1266 May 18 11:45 electron-builder.yml
-rw-r--r--@   1 ryanbak  staff    1208 May 18 01:35 electron.vite.config.ts
-rw-r--r--@   1 ryanbak  staff    1095 May 18 01:26 eslint.config.mjs
drwxr-xr-x@  14 ryanbak  staff     448 May 18 11:56 logs
drwxr-xr-x@ 556 ryanbak  staff   17792 May 18 11:43 node_modules
drwxr-xr-x@   5 ryanbak  staff     160 May 18 11:54 out
-rw-r--r--@   1 ryanbak  staff  400611 May 18 11:43 package-lock.json
-rw-r--r--@   1 ryanbak  staff    1845 May 18 11:53 package.json
drwxr-xr-x@   5 ryanbak  staff     160 May 18 01:25 resources
drwxr-xr-x@   3 ryanbak  staff      96 May 18 09:15 scripts
drwxr-xr-x@   6 ryanbak  staff     192 May 18 01:25 src
drwxr-xr-x@   4 ryanbak  staff     128 May 18 11:53 tests
-rw-r--r--@   1 ryanbak  staff     119 May 18 01:25 tsconfig.json
-rw-r--r--@   1 ryanbak  staff     695 May 18 01:34 tsconfig.node.json
-rw-r--r--@   1 ryanbak  staff     725 May 18 01:25 tsconfig.web.json
-rw-r--r--@   1 ryanbak  staff     385 May 18 01:26 vitest.config.ts

exec
/bin/zsh -lc "nl -ba src/preload/index.d.ts | sed -n '1,160p'; printf '%s\\n' '--- diff preload dts? ---'; git diff 1c98b3d..HEAD -- src/preload/index.d.ts" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1999ms:
2026-05-18 11:57:10.863 xcodebuild[74499:41412533]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:57:11.007 xcodebuild[74499:41412532] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-TTDV6LTq' (errno=Operation not permitted)
2026-05-18 11:57:11.543 xcodebuild[74501:41412544]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:57:11.687 xcodebuild[74501:41412543] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.

exec
/bin/zsh -lc "git diff --unified=80 1c98b3d..HEAD -- src/main/updater.ts src/main/index.ts src/main/scanner.ts resources/powershell/Invoke-FormatBuddyScan.ps1 src/preload/index.ts src/renderer/src/components/UpdateBanner.tsx src/renderer/src/pages/Report.tsx src/shared/types.ts src/shared/copy.ts electron-builder.yml tests/ipc.test.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2106ms:
2026-05-18 11:57:20.376 xcodebuild[74753:41413010]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:57:20.528 xcodebuild[74753:41413003] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-UXLMXhFk' (errno=Operation not permitted)
2026-05-18 11:57:21.116 xcodebuild[74772:41413155]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:57:21.286 xcodebuild[74772:41413135] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/electron-builder.yml b/electron-builder.yml
index 36066dc..fbee0eb 100644
--- a/electron-builder.yml
+++ b/electron-builder.yml
@@ -1,48 +1,54 @@
 appId: app.formatbuddy.desktop
 productName: FormatBuddy
 copyright: Copyright (c) ${author}
 directories:
   output: dist
   buildResources: resources
 
 files:
   - out/**/*
   - package.json
   - "!**/.vscode/*"
   - "!**/{.eslintrc.cjs,.eslintrc,.prettierrc,.editorconfig,.gitignore,.npmrc}"
   - "!**/{tsconfig.*,vite.config.*,vitest.config.*,electron-builder.yml,electron.vite.config.*}"
 
 extraResources:
   - from: resources/powershell
     to: powershell
   - from: resources/fonts
     to: fonts
   - from: resources/icons
     to: icons
 
 win:
   target:
     - target: nsis
       arch:
         - x64
   artifactName: ${productName}-Setup-${version}-${arch}.${ext}
   icon: resources/icons/app-icon.ico
   # Phase 1: unsigned. macOS cross-build cannot run Windows signtool.
   # Ryan must accept SmartScreen warning on first launch on Windows.
   signtoolOptions: null
   signAndEditExecutable: false
   verifyUpdateCodeSignature: false
 
 nsis:
   oneClick: false
   perMachine: false
   allowToChangeInstallationDirectory: true
   createDesktopShortcut: true
   shortcutName: FormatBuddy
   installerLanguages:
     - ko_KR
     - en_US
 
 asar: true
 asarUnpack:
   - resources/**
+
+publish:
+  - provider: github
+    owner: ryan-formatbuddy
+    repo: formatbuddy-desktop
+    releaseType: release
diff --git a/resources/powershell/Invoke-FormatBuddyScan.ps1 b/resources/powershell/Invoke-FormatBuddyScan.ps1
index 6d3b984..1b7c235 100644
--- a/resources/powershell/Invoke-FormatBuddyScan.ps1
+++ b/resources/powershell/Invoke-FormatBuddyScan.ps1
@@ -1,194 +1,328 @@
 # FormatBuddy local diagnostic prototype
 # Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
+#
+# Modes:
+#   -Mode quick     (default) full system diagnostics + installed apps + winget export summary
+#   -Mode manifest  per-user-folder SHA-256 manifest for backup/restore verification
 
 param(
-  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json"
+  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json",
+  [ValidateSet("quick", "manifest")]
+  [string]$Mode = "quick",
+  [int64]$ManifestMaxFileSizeBytes = 104857600
 )
 
 $ErrorActionPreference = "SilentlyContinue"
 $diagnostics = New-Object System.Collections.Generic.List[object]
 
 function Add-Diagnostic {
   param([string]$Step, [string]$Message)
   $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
 }
 
 function Get-SafeCimInstance {
   param([string]$ClassName)
   try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
 }
 
 function Get-InstalledApps {
   $paths = @(
     "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
     "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
     "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
   )
 
   foreach ($path in $paths) {
     Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
       [ordered]@{
         name = $_.DisplayName
         version = $_.DisplayVersion
         publisher = $_.Publisher
       }
     }
   }
 }
 
 function Test-NpkiLocation {
   $candidates = @(
     "$env:USERPROFILE\AppData\LocalLow\NPKI",
     "$env:USERPROFILE\AppData\Roaming\NPKI",
     "$env:SystemDrive\NPKI"
   )
 
   foreach ($path in $candidates) {
     [ordered]@{
       path = $path
       exists = Test-Path $path
     }
   }
 }
 
 function Get-FolderSizeGb {
   param([string]$Path)
 
   if (!(Test-Path $Path)) { return $null }
 
   try {
     $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
       Measure-Object -Property Length -Sum
 
     if ($null -eq $sum.Sum) { return 0 }
     return [Math]::Round($sum.Sum / 1GB, 2)
   } catch {
     Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
     return $null
   }
 }
 
 function Get-UserFolders {
   $folders = @(
     @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
     @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
     @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
     @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
     @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
     @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
   )
 
   foreach ($folder in $folders) {
     $exists = Test-Path $folder.path
     [ordered]@{
       name = $folder.name
       path = $folder.path
       exists = $exists
       sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
     }
   }
 }
 
 function Get-CloudSyncCandidates {
   $candidates = @(
     @{ provider = "OneDrive"; path = $env:OneDrive },
     @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
     @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
     @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
     @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
   ) | Where-Object { $_.path }
 
   foreach ($candidate in $candidates) {
     [ordered]@{
       provider = $candidate.provider
       path = $candidate.path
       exists = Test-Path $candidate.path
     }
   }
 }
 
 function Get-BrowserPresence {
   $browsers = @(
     @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
     @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
     @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
     @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   )
 
   foreach ($browser in $browsers) {
     [ordered]@{
       name = $browser.name
       installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
     }
   }
 }
 
 function Get-WingetStatus {
   $winget = Get-Command winget -ErrorAction SilentlyContinue
   [ordered]@{
     available = [bool]$winget
-    note = if ($winget) { "winget is available. App export can be added in Phase 2." } else { "winget is not available on this PC." }
+    note = if ($winget) { "winget is available. App export captured in wingetExport." } else { "winget is not available on this PC." }
   }
 }
 
-$computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
-$os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
-$bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
-$cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
-$gpu = Get-SafeCimInstance Win32_VideoController
-$disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
-$printers = Get-SafeCimInstance Win32_Printer
-$drivers = Get-SafeCimInstance Win32_PnPSignedDriver
-$wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
-$bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
-
-$report = [ordered]@{
-  schemaVersion = "0.1.0"
-  generatedAt = (Get-Date).ToString("o")
-  privacy = [ordered]@{
-    localOnly = $true
-    noPasswordCollection = $true
-    noPrivateKeyUpload = $true
-    noBrowserPasswordExtraction = $true
+function Get-WingetExport {
+  $winget = Get-Command winget -ErrorAction SilentlyContinue
+  if (-not $winget) { return $null }
+
+  $tempBase = [System.IO.Path]::GetTempFileName()
+  Remove-Item $tempBase -Force -ErrorAction SilentlyContinue
+  $tempJson = "$tempBase.json"
+
+  try {
+    $null = & winget export -o $tempJson --accept-source-agreements --disable-interactivity 2>&1
+    if (Test-Path $tempJson) {
+      $raw = Get-Content -Raw -Path $tempJson -ErrorAction Stop
+      return ($raw | ConvertFrom-Json -Depth 16)
+    }
+  } catch {
+    Add-Diagnostic -Step "WingetExport" -Message $_.Exception.Message
+  } finally {
+    if (Test-Path $tempJson) { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
   }
-  system = [ordered]@{
-    manufacturer = $computer.Manufacturer
-    model = $computer.Model
-    serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
-    osCaption = $os.Caption
-    osVersion = $os.Version
-    cpu = $cpu.Name
-    memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
+
+  return $null
+}
+
+function Get-BackupManifest {
+  param(
+    [string[]]$Folders,
+    [int64]$MaxFileSize

2026-05-18T02:57:26.497492Z ERROR codex_core::tools::router: error=write_stdin failed: Unknown process id 55067
exec
/bin/zsh -lc "grep -R \"interface GithubOptions\\|private.*Github\" -n node_modules/electron-builder* node_modules/electron-updater node_modules/builder-util-runtime | sed -n '1,120p'; grep -R \"class GitHubProvider\\|GitHubProvider\" -n node_modules/electron-updater node_modules/builder-util-runtime | sed -n '1,120p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js.map:1:{"version":3,"file":"PrivateGitHubProvider.js","sourceRoot":"","sources":["../../src/providers/PrivateGitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, HttpError, newError, UpdateInfo } from \"builder-util-runtime\"\nimport { OutgoingHttpHeaders, RequestOptions } from \"http\"\nimport { load } from \"js-yaml\"\nimport * as path from \"path\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { URL } from \"url\"\nimport { getChannelFilename, newUrlFromBase } from \"../util\"\nimport { BaseGitHubProvider } from \"./GitHubProvider\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getFileList, ProviderRuntimeOptions } from \"./Provider\"\n\nexport interface PrivateGitHubUpdateInfo extends UpdateInfo {\n  assets: Array<Asset>\n}\n\nexport class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {\n  constructor(\n    options: GithubOptions,\n    private readonly updater: AppUpdater,\n    private readonly token: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"api.github.com\", runtimeOptions)\n  }\n\n  protected createRequestOptions(url: URL, headers?: OutgoingHttpHeaders | null): RequestOptions {\n    const result = super.createRequestOptions(url, headers)\n    ;(result as any).redirect = \"manual\"\n    return result\n  }\n\n  async getLatestVersion(): Promise<PrivateGitHubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n    const channelFile = getChannelFilename(this.getDefaultChannelName())\n\n    const releaseInfo = await this.getLatestVersionInfo(cancellationToken)\n    const asset = releaseInfo.assets.find(it => it.name === channelFile)\n    if (asset == null) {\n      // html_url must be always, but just to be sure\n      throw newError(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n    }\n\n    const url = new URL(asset.url)\n    let result: any\n    try {\n      result = load((await this.httpRequest(url, this.configureHeaders(\"application/octet-stream\"), cancellationToken))!)\n    } catch (e: any) {\n      if (e instanceof HttpError && e.statusCode === 404) {\n        throw newError(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n      }\n      throw e\n    }\n\n    ;(result as PrivateGitHubUpdateInfo).assets = releaseInfo.assets\n    return result\n  }\n\n  get fileExtraDownloadHeaders(): OutgoingHttpHeaders | null {\n    return this.configureHeaders(\"application/octet-stream\")\n  }\n\n  private configureHeaders(accept: string) {\n    return {\n      accept,\n      authorization: `token ${this.token}`,\n    }\n  }\n\n  private async getLatestVersionInfo(cancellationToken: CancellationToken): Promise<ReleaseInfo> {\n    const allowPrerelease = this.updater.allowPrerelease\n    let basePath = this.basePath\n    if (!allowPrerelease) {\n      basePath = `${basePath}/latest`\n    }\n\n    const url = newUrlFromBase(basePath, this.baseUrl)\n    try {\n      const version = JSON.parse((await this.httpRequest(url, this.configureHeaders(\"application/vnd.github.v3+json\"), cancellationToken))!)\n      if (allowPrerelease) {\n        return (version as Array<{ prerelease: boolean }>).find(it => it.prerelease) || version[0]\n      } else {\n        return version\n      }\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`)\n  }\n\n  resolveFiles(updateInfo: PrivateGitHubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    return getFileList(updateInfo).map(it => {\n      const name = path.posix.basename(it.url).replace(/ /g, \"-\")\n      const asset = updateInfo.assets.find(it => it != null && it.name === name)\n      if (asset == null) {\n        throw newError(`Cannot find asset \"${name}\" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, \"ERR_UPDATER_ASSET_NOT_FOUND\")\n      }\n\n      return {\n        url: new URL(asset.url),\n        info: it,\n      }\n    })\n  }\n}\n\ninterface ReleaseInfo {\n  name: string\n  html_url: string\n  assets: Array<Asset>\n}\n\nexport interface Asset {\n  name: string\n  url: string\n}\n"]}
node_modules/electron-updater/out/providers/GitHubProvider.js.map:1:{"version":3,"file":"GitHubProvider.js","sourceRoot":"","sources":["../../src/providers/GitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, githubUrl, HttpError, newError, parseXml, ReleaseNoteInfo, UpdateInfo, XElement } from \"builder-util-runtime\"\nimport * as semver from \"semver\"\nimport { URL } from \"url\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getChannelFilename, newBaseUrl, newUrlFromBase } from \"../util\"\nimport { parseUpdateInfo, Provider, ProviderRuntimeOptions, resolveFiles } from \"./Provider\"\n\nconst hrefRegExp = /\\/tag\\/([^/]+)$/\n\ninterface GithubUpdateInfo extends UpdateInfo {\n  tag: string\n}\nexport abstract class BaseGitHubProvider<T extends UpdateInfo> extends Provider<T> {\n  // so, we don't need to parse port (because node http doesn't support host as url does)\n  protected readonly baseUrl: URL\n  protected readonly baseApiUrl: URL\n\n  protected constructor(\n    protected readonly options: GithubOptions,\n    defaultHost: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super({\n      ...runtimeOptions,\n      /* because GitHib uses S3 */\n      isUseMultipleRangeRequest: false,\n    })\n\n    this.baseUrl = newBaseUrl(githubUrl(options, defaultHost))\n    const apiHost = defaultHost === \"github.com\" ? \"api.github.com\" : defaultHost\n    this.baseApiUrl = newBaseUrl(githubUrl(options, apiHost))\n  }\n\n  protected computeGithubBasePath(result: string): string {\n    // https://github.com/electron-userland/electron-builder/issues/1903#issuecomment-320881211\n    const host = this.options.host\n    return host && ![\"github.com\", \"api.github.com\"].includes(host) ? `/api/v3${result}` : result\n  }\n}\n\nexport class GitHubProvider extends BaseGitHubProvider<GithubUpdateInfo> {\n  constructor(\n    protected readonly options: GithubOptions,\n    private readonly updater: AppUpdater,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"github.com\", runtimeOptions)\n  }\n\n  private get channel(): string {\n    const result = this.updater.channel || this.options.channel\n    return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result)\n  }\n\n  async getLatestVersion(): Promise<GithubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n\n    const feedXml: string = (await this.httpRequest(\n      newUrlFromBase(`${this.basePath}.atom`, this.baseUrl),\n      {\n        accept: \"application/xml, application/atom+xml, text/xml, */*\",\n      },\n      cancellationToken\n    ))!\n\n    const feed = parseXml(feedXml)\n    // noinspection TypeScriptValidateJSTypes\n    let latestRelease = feed.element(\"entry\", false, `No published versions on GitHub`)\n    let tag: string | null = null\n    try {\n      if (this.updater.allowPrerelease) {\n        const currentChannel = this.updater?.channel || (semver.prerelease(this.updater.currentVersion)?.[0] as string) || null\n\n        if (currentChannel === null) {\n          // noinspection TypeScriptValidateJSTypes\n          tag = hrefRegExp.exec(latestRelease.element(\"link\").attribute(\"href\"))![1]\n        } else {\n          for (const element of feed.getElements(\"entry\")) {\n            // noinspection TypeScriptValidateJSTypes\n            const hrefElement = hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))!\n\n            // If this is null then something is wrong and skip this release\n            if (hrefElement === null) continue\n\n            // This Release's Tag\n            const hrefTag = hrefElement[1]\n            //Get Channel from this release's tag\n            const hrefChannel = (semver.prerelease(hrefTag)?.[0] as string) || null\n\n            const shouldFetchVersion = !currentChannel || [\"alpha\", \"beta\"].includes(currentChannel)\n            const isCustomChannel = hrefChannel !== null && ![\"alpha\", \"beta\"].includes(String(hrefChannel))\n            // Allow moving from alpha to beta but not down\n            const channelMismatch = currentChannel === \"beta\" && hrefChannel === \"alpha\"\n\n            if (shouldFetchVersion && !isCustomChannel && !channelMismatch) {\n              tag = hrefTag\n              break\n            }\n\n            const isNextPreRelease = hrefChannel && hrefChannel === currentChannel\n            if (isNextPreRelease) {\n              tag = hrefTag\n              break\n            }\n          }\n        }\n      } else {\n        tag = await this.getLatestTagName(cancellationToken)\n        for (const element of feed.getElements(\"entry\")) {\n          // noinspection TypeScriptValidateJSTypes\n          if (hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))![1] === tag) {\n            latestRelease = element\n            break\n          }\n        }\n      }\n    } catch (e: any) {\n      throw newError(`Cannot parse releases feed: ${e.stack || e.message},\\nXML:\\n${feedXml}`, \"ERR_UPDATER_INVALID_RELEASE_FEED\")\n    }\n\n    if (tag == null) {\n      throw newError(`No published versions on GitHub`, \"ERR_UPDATER_NO_PUBLISHED_VERSIONS\")\n    }\n\n    let rawData: string\n    let channelFile = \"\"\n    let channelFileUrl: any = \"\"\n    const fetchData = async (channelName: string) => {\n      channelFile = getChannelFilename(channelName)\n      channelFileUrl = newUrlFromBase(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl)\n      const requestOptions = this.createRequestOptions(channelFileUrl)\n      try {\n        return (await this.executor.request(requestOptions, cancellationToken))!\n      } catch (e: any) {\n        if (e instanceof HttpError && e.statusCode === 404) {\n          throw newError(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n        }\n        throw e\n      }\n    }\n\n    try {\n      let channel = this.channel\n      if (this.updater.allowPrerelease && semver.prerelease(tag)?.[0]) {\n        channel = this.getCustomChannelName(String(semver.prerelease(tag)?.[0]))\n      }\n      rawData = await fetchData(channel)\n    } catch (e: any) {\n      if (this.updater.allowPrerelease) {\n        // Allow fallback to `latest.yml`\n        rawData = await fetchData(this.getDefaultChannelName())\n      } else {\n        throw e\n      }\n    }\n\n    const result = parseUpdateInfo(rawData, channelFile, channelFileUrl)\n    if (result.releaseName == null) {\n      result.releaseName = latestRelease.elementValueOrEmpty(\"title\")\n    }\n\n    if (result.releaseNotes == null) {\n      result.releaseNotes = computeReleaseNotes(this.updater.currentVersion, this.updater.fullChangelog, feed, latestRelease)\n    }\n    return {\n      tag: tag,\n      ...result,\n    }\n  }\n\n  private async getLatestTagName(cancellationToken: CancellationToken): Promise<string | null> {\n    const options = this.options\n    // do not use API for GitHub to avoid limit, only for custom host or GitHub Enterprise\n    const url =\n      options.host == null || options.host === \"github.com\"\n        ? newUrlFromBase(`${this.basePath}/latest`, this.baseUrl)\n        : new URL(`${this.computeGithubBasePath(`/repos/${options.owner}/${options.repo}/releases`)}/latest`, this.baseApiUrl)\n    try {\n      const rawData = await this.httpRequest(url, { Accept: \"application/json\" }, cancellationToken)\n      if (rawData == null) {\n        return null\n      }\n\n      const releaseInfo: GithubReleaseInfo = JSON.parse(rawData)\n      return releaseInfo.tag_name\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return `/${this.options.owner}/${this.options.repo}/releases`\n  }\n\n  resolveFiles(updateInfo: GithubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    // still replace space to - due to backward compatibility\n    return resolveFiles(updateInfo, this.baseUrl, p => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, \"-\")))\n  }\n\n  private getBaseDownloadPath(tag: string, fileName: string): string {\n    return `${this.basePath}/download/${tag}/${fileName}`\n  }\n}\n\ninterface GithubReleaseInfo {\n  readonly tag_name: string\n}\n\nfunction getNoteValue(parent: XElement): string {\n  const result = parent.elementValueOrEmpty(\"content\")\n  // GitHub reports empty notes as <content>No content.</content>\n  return result === \"No content.\" ? \"\" : result\n}\n\nexport function computeReleaseNotes(currentVersion: semver.SemVer, isFullChangelog: boolean, feed: XElement, latestRelease: any): string | Array<ReleaseNoteInfo> | null {\n  if (!isFullChangelog) {\n    return getNoteValue(latestRelease)\n  }\n\n  const releaseNotes: Array<ReleaseNoteInfo> = []\n  for (const release of feed.getElements(\"entry\")) {\n    // noinspection TypeScriptValidateJSTypes\n    const versionRelease = /\\/tag\\/v?([^/]+)$/.exec(release.element(\"link\").attribute(\"href\"))![1]\n    if (semver.lt(currentVersion, versionRelease)) {\n      releaseNotes.push({\n        version: versionRelease,\n        note: getNoteValue(release),\n      })\n    }\n  }\n  return releaseNotes.sort((a, b) => semver.rcompare(a.version, b.version))\n}\n"]}
node_modules/builder-util-runtime/out/publishOptions.d.ts:57:export interface GithubOptions extends PublishConfiguration {
node_modules/builder-util-runtime/out/publishOptions.js.map:1:{"version":3,"file":"publishOptions.js","sourceRoot":"","sources":["../src/publishOptions.ts"],"names":[],"mappings":";;AA2IA,8BAEC;AAgPD,4DASC;AA5PD,eAAe;AACf,SAAgB,SAAS,CAAC,OAAsB,EAAE,WAAW,GAAG,YAAY;IAC1E,OAAO,GAAG,OAAO,CAAC,QAAQ,IAAI,OAAO,MAAM,OAAO,CAAC,IAAI,IAAI,WAAW,EAAE,CAAA;AAC1E,CAAC;AAgPD,SAAgB,wBAAwB,CAAC,aAAmC;IAC1E,MAAM,QAAQ,GAAG,aAAa,CAAC,QAAQ,CAAA;IACvC,IAAI,QAAQ,KAAK,IAAI,EAAE,CAAC;QACtB,OAAO,KAAK,CAAC,aAA0B,CAAC,CAAA;IAC1C,CAAC;IACD,IAAI,QAAQ,KAAK,QAAQ,EAAE,CAAC;QAC1B,OAAO,SAAS,CAAC,aAA8B,CAAC,CAAA;IAClD,CAAC;IACD,MAAM,IAAI,KAAK,CAAC,2BAA2B,QAAQ,EAAE,CAAC,CAAA;AACxD,CAAC;AAED,SAAS,KAAK,CAAC,OAAkB;IAC/B,IAAI,GAAW,CAAA;IACf,IAAI,OAAO,CAAC,UAAU,IAAI,IAAI,EAAE,CAAC;QAC/B,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,8BAA8B,CAAA;IAC/D,CAAC;SAAM,IAAI,OAAO,CAAC,QAAQ,IAAI,IAAI,EAAE,CAAC;QACpC,GAAG,GAAG,GAAG,OAAO,CAAC,QAAQ,IAAI,OAAO,CAAC,MAAM,EAAE,CAAA;IAC/C,CAAC;SAAM,IAAI,OAAO,CAAC,MAAM,CAAC,QAAQ,CAAC,GAAG,CAAC,EAAE,CAAC;QACxC,IAAI,OAAO,CAAC,MAAM,IAAI,IAAI,EAAE,CAAC;YAC3B,MAAM,IAAI,KAAK,CAAC,gBAAgB,OAAO,CAAC,MAAM,4CAA4C,CAAC,CAAA;QAC7F,CAAC;QAED,wGAAwG;QACxG,IAAI,OAAO,CAAC,MAAM,KAAK,WAAW,EAAE,CAAC;YACnC,GAAG,GAAG,4BAA4B,OAAO,CAAC,MAAM,EAAE,CAAA;QACpD,CAAC;aAAM,CAAC;YACN,GAAG,GAAG,cAAc,OAAO,CAAC,MAAM,kBAAkB,OAAO,CAAC,MAAM,EAAE,CAAA;QACtE,CAAC;IACH,CAAC;SAAM,IAAI,OAAO,CAAC,MAAM,KAAK,YAAY,EAAE,CAAC;QAC3C,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,OAAO,OAAO,CAAC,MAAM,mBAAmB,CAAA;IACzE,CAAC;SAAM,CAAC;QACN,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,mBAAmB,CAAA;IACpD,CAAC;IACD,OAAO,UAAU,CAAC,GAAG,EAAE,OAAO,CAAC,IAAI,CAAC,CAAA;AACtC,CAAC;AAED,SAAS,UAAU,CAAC,GAAW,EAAE,CAA4B;IAC3D,IAAI,CAAC,IAAI,IAAI,IAAI,CAAC,CAAC,MAAM,GAAG,CAAC,EAAE,CAAC;QAC9B,IAAI,CAAC,CAAC,CAAC,UAAU,CAAC,GAAG,CAAC,EAAE,CAAC;YACvB,GAAG,IAAI,GAAG,CAAA;QACZ,CAAC;QACD,GAAG,IAAI,CAAC,CAAA;IACV,CAAC;IACD,OAAO,GAAG,CAAA;AACZ,CAAC;AAED,SAAS,SAAS,CAAC,OAAsB;IACvC,IAAI,OAAO,CAAC,IAAI,IAAI,IAAI,EAAE,CAAC;QACzB,MAAM,IAAI,KAAK,CAAC,iBAAiB,CAAC,CAAA;IACpC,CAAC;IACD,IAAI,OAAO,CAAC,MAAM,IAAI,IAAI,EAAE,CAAC;QAC3B,MAAM,IAAI,KAAK,CAAC,mBAAmB,CAAC,CAAA;IACtC,CAAC;IACD,OAAO,UAAU,CAAC,WAAW,OAAO,CAAC,IAAI,IAAI,OAAO,CAAC,MAAM,yBAAyB,EAAE,OAAO,CAAC,IAAI,CAAC,CAAA;AACrG,CAAC","sourcesContent":["import { OutgoingHttpHeaders } from \"http\"\n\nexport type PublishProvider = \"github\" | \"s3\" | \"spaces\" | \"generic\" | \"custom\" | \"snapStore\" | \"keygen\" | \"bitbucket\"\n\n// typescript-json-schema generates only PublishConfiguration if it is specified in the list, so, it is not added here\nexport type AllPublishOptions =\n  | string\n  | GithubOptions\n  | S3Options\n  | SpacesOptions\n  | GenericServerOptions\n  | CustomPublishOptions\n  | KeygenOptions\n  | SnapStoreOptions\n  | BitbucketOptions\n\nexport interface PublishConfiguration {\n  /**\n   * The provider.\n   */\n  readonly provider: PublishProvider\n\n  /**\n   * @private\n   * win-only\n   */\n  publisherName?: Array<string> | null\n\n  /**\n   * @private\n   * win-only\n   */\n  readonly updaterCacheDirName?: string | null\n\n  /**\n   * Whether to publish auto update info files.\n   *\n   * Auto update relies only on the first provider in the list (you can specify several publishers).\n   * Thus, probably, there`s no need to upload the metadata files for the other configured providers. But by default will be uploaded.\n   *\n   * @default true\n   */\n  readonly publishAutoUpdate?: boolean\n\n  /**\n   * Any custom request headers\n   */\n  readonly requestHeaders?: OutgoingHttpHeaders\n\n  /**\n   * Request timeout in milliseconds. (Default is 2 minutes; O is ignored)\n   *\n   * @default 120000\n   */\n  readonly timeout?: number | null\n}\n\n// https://github.com/electron-userland/electron-builder/issues/3261\nexport interface CustomPublishOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `custom`.\n   */\n  readonly provider: \"custom\"\n\n  /**\n   * The Provider to provide UpdateInfo regarding available updates.  Required\n   * to use custom providers with electron-updater.\n   */\n  updateProvider?: new (options: CustomPublishOptions, updater: any, runtimeOptions: any) => any\n\n  [index: string]: any\n}\n\n/**\n * [GitHub](https://help.github.com/articles/about-releases/) options.\n *\n * GitHub [personal access token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) is required. You can generate by going to [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new). The access token should have the repo scope/permission.\n * Define `GH_TOKEN` environment variable.\n */\nexport interface GithubOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `github`.\n   */\n  readonly provider: \"github\"\n\n  /**\n   * The repository name. [Detected automatically](#github-repository-and-bintray-package).\n   */\n  readonly repo?: string | null\n\n  /**\n   * The owner.\n   */\n  readonly owner?: string | null\n\n  /**\n   * Whether to use `v`-prefixed tag name.\n   * @default true\n   */\n  readonly vPrefixedTagName?: boolean\n\n  /**\n   * The host (including the port if need).\n   * @default github.com\n   */\n  readonly host?: string | null\n\n  /**\n   * The protocol. GitHub Publisher supports only `https`.\n   * @default https\n   */\n  readonly protocol?: \"https\" | \"http\" | null\n\n  /**\n   * The access token to support auto-update from private github repositories. Never specify it in the configuration files. Only for [setFeedURL](./auto-update.md#appupdatersetfeedurloptions).\n   */\n  readonly token?: string | null\n\n  /**\n   * Whether to use private github auto-update provider if `GH_TOKEN` environment variable is defined. See [Private GitHub Update Repo](./auto-update.md#private-github-update-repo).\n   */\n  readonly private?: boolean | null\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n\n  /**\n   * The type of release. By default `draft` release will be created.\n   *\n   * Also you can set release type using environment variable. If `EP_DRAFT`is set to `true` — `draft`, if `EP_PRE_RELEASE`is set to `true` — `prerelease`.\n   * @default draft\n   */\n  releaseType?: \"draft\" | \"prerelease\" | \"release\" | null\n}\n\n/** @private */\nexport function githubUrl(options: GithubOptions, defaultHost = \"github.com\") {\n  return `${options.protocol || \"https\"}://${options.host || defaultHost}`\n}\n\n/**\n * Generic (any HTTP(S) server) options.\n * In all publish options [File Macros](./file-patterns.md#file-macros) are supported.\n */\nexport interface GenericServerOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `generic`.\n   */\n  readonly provider: \"generic\"\n\n  /**\n   * The base url. e.g. `https://bucket_name.s3.amazonaws.com`.\n   */\n  readonly url: string\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n\n  /**\n   * Whether to use multiple range requests for differential update. Defaults to `true` if `url` doesn't contain `s3.amazonaws.com`.\n   */\n  readonly useMultipleRangeRequest?: boolean\n}\n\n/**\n * Keygen options.\n * https://keygen.sh/\n * Define `KEYGEN_TOKEN` environment variable.\n */\nexport interface KeygenOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `keygen`.\n   */\n  readonly provider: \"keygen\"\n\n  /**\n   * Keygen account's UUID\n   */\n  readonly account: string\n\n  /**\n   * Keygen product's UUID\n   */\n  readonly product: string\n\n  /**\n   * The channel.\n   * @default stable\n   */\n  readonly channel?: \"stable\" | \"rc\" | \"beta\" | \"alpha\" | \"dev\" | null\n\n  /**\n   * The target Platform. Is set programmatically explicitly during publishing.\n   */\n  readonly platform?: string | null\n}\n\n/**\n * Bitbucket options.\n * https://bitbucket.org/\n * Define `BITBUCKET_TOKEN` environment variable.\n *\n * For converting an app password to a usable token, you can utilize this\n```typescript\nconvertAppPassword(owner: string, appPassword: string) {\n  const base64encodedData = Buffer.from(`${owner}:${appPassword.trim()}`).toString(\"base64\")\n  return `Basic ${base64encodedData}`\n}\n```\n */\nexport interface BitbucketOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `bitbucket`.\n   */\n  readonly provider: \"bitbucket\"\n\n  /**\n   * Repository owner\n   */\n  readonly owner: string\n\n  /**\n   * The [app password](https://bitbucket.org/account/settings/app-passwords) to support auto-update from private bitbucket repositories.\n   */\n  readonly token?: string | null\n\n  /**\n   * The user name to support auto-update from private bitbucket repositories.\n   */\n  readonly username?: string | null\n\n  /**\n   * Repository slug/name\n   */\n  readonly slug: string\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n}\n\n/**\n * [Snap Store](https://snapcraft.io/) options. To publish directly to Snapcraft, see <a href=\"https://snapcraft.io/docs/snapcraft-authentication\">Snapcraft authentication options</a> for local or CI/CD authentication options.\n */\nexport interface SnapStoreOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `snapStore`.\n   */\n  readonly provider: \"snapStore\"\n\n  /**\n   * snapcraft repo name\n   */\n  readonly repo?: string\n\n  /**\n   * The list of channels the snap would be released.\n   * @default [\"edge\"]\n   */\n  readonly channels?: string | Array<string> | null\n}\n\nexport interface BaseS3Options extends PublishConfiguration {\n  /**\n   * The update channel.\n   * @default latest\n   */\n  channel?: string | null\n\n  /**\n   * The directory path.\n   * @default /\n   */\n  readonly path?: string | null\n\n  /**\n   * The ACL. Set to `null` to not [add](https://github.com/electron-userland/electron-builder/issues/1822).\n   *\n   * @default public-read\n   */\n  readonly acl?: \"private\" | \"public-read\" | null\n}\n\n/**\n * [Amazon S3](https://aws.amazon.com/s3/) options.\n * AWS credentials are required, please see [getting your credentials](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-your-credentials.html).\n * Define `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` [environment variables](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html).\n * Or in the [~/.aws/credentials](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html).\n *\n * Example configuration:\n *\n```json\n{\n  \"build\":\n    \"publish\": {\n      \"provider\": \"s3\",\n      \"bucket\": \"bucket-name\"\n    }\n  }\n}\n```\n */\nexport interface S3Options extends BaseS3Options {\n  /**\n   * The provider. Must be `s3`.\n   */\n  readonly provider: \"s3\"\n\n  /**\n   * The bucket name.\n   */\n  readonly bucket: string\n\n  /**\n   * The region. Is determined and set automatically when publishing.\n   */\n  region?: string | null\n\n  /**\n   * The ACL. Set to `null` to not [add](https://github.com/electron-userland/electron-builder/issues/1822).\n   *\n   * Please see [required permissions for the S3 provider](https://github.com/electron-userland/electron-builder/issues/1618#issuecomment-314679128).\n   *\n   * @default public-read\n   */\n  readonly acl?: \"private\" | \"public-read\" | null\n\n  /**\n   * The type of storage to use for the object.\n   * @default STANDARD\n   */\n  readonly storageClass?: \"STANDARD\" | \"REDUCED_REDUNDANCY\" | \"STANDARD_IA\" | null\n\n  /**\n   * Server-side encryption algorithm to use for the object.\n   */\n  readonly encryption?: \"AES256\" | \"aws:kms\" | null\n\n  /**\n   * The endpoint URI to send requests to. The default endpoint is built from the configured region.\n   * The endpoint should be a string like `https://{service}.{region}.amazonaws.com`.\n   */\n  readonly endpoint?: string | null\n\n  /**\n   * If set to true, this will enable the s3 accelerated endpoint\n   * These endpoints have a particular format of:\n   *  ${bucketname}.s3-accelerate.amazonaws.com\n   */\n  readonly accelerate?: boolean\n}\n\n/**\n * [DigitalOcean Spaces](https://www.digitalocean.com/community/tutorials/an-introduction-to-digitalocean-spaces) options.\n * Access key is required, define `DO_KEY_ID` and `DO_SECRET_KEY` environment variables.\n */\nexport interface SpacesOptions extends BaseS3Options {\n  /**\n   * The provider. Must be `spaces`.\n   */\n  readonly provider: \"spaces\"\n\n  /**\n   * The space name.\n   */\n  readonly name: string\n\n  /**\n   * The region (e.g. `nyc3`).\n   */\n  readonly region: string\n}\n\nexport function getS3LikeProviderBaseUrl(configuration: PublishConfiguration) {\n  const provider = configuration.provider\n  if (provider === \"s3\") {\n    return s3Url(configuration as S3Options)\n  }\n  if (provider === \"spaces\") {\n    return spacesUrl(configuration as SpacesOptions)\n  }\n  throw new Error(`Not supported provider: ${provider}`)\n}\n\nfunction s3Url(options: S3Options) {\n  let url: string\n  if (options.accelerate == true) {\n    url = `https://${options.bucket}.s3-accelerate.amazonaws.com`\n  } else if (options.endpoint != null) {\n    url = `${options.endpoint}/${options.bucket}`\n  } else if (options.bucket.includes(\".\")) {\n    if (options.region == null) {\n      throw new Error(`Bucket name \"${options.bucket}\" includes a dot, but S3 region is missing`)\n    }\n\n    // special case, see http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro\n    if (options.region === \"us-east-1\") {\n      url = `https://s3.amazonaws.com/${options.bucket}`\n    } else {\n      url = `https://s3-${options.region}.amazonaws.com/${options.bucket}`\n    }\n  } else if (options.region === \"cn-north-1\") {\n    url = `https://${options.bucket}.s3.${options.region}.amazonaws.com.cn`\n  } else {\n    url = `https://${options.bucket}.s3.amazonaws.com`\n  }\n  return appendPath(url, options.path)\n}\n\nfunction appendPath(url: string, p: string | null | undefined): string {\n  if (p != null && p.length > 0) {\n    if (!p.startsWith(\"/\")) {\n      url += \"/\"\n    }\n    url += p\n  }\n  return url\n}\n\nfunction spacesUrl(options: SpacesOptions) {\n  if (options.name == null) {\n    throw new Error(`name is missing`)\n  }\n  if (options.region == null) {\n    throw new Error(`region is missing`)\n  }\n  return appendPath(`https://${options.name}.${options.region}.digitaloceanspaces.com`, options.path)\n}\n"]}
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js.map:1:{"version":3,"file":"PrivateGitHubProvider.js","sourceRoot":"","sources":["../../src/providers/PrivateGitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, HttpError, newError, UpdateInfo } from \"builder-util-runtime\"\nimport { OutgoingHttpHeaders, RequestOptions } from \"http\"\nimport { load } from \"js-yaml\"\nimport * as path from \"path\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { URL } from \"url\"\nimport { getChannelFilename, newUrlFromBase } from \"../util\"\nimport { BaseGitHubProvider } from \"./GitHubProvider\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getFileList, ProviderRuntimeOptions } from \"./Provider\"\n\nexport interface PrivateGitHubUpdateInfo extends UpdateInfo {\n  assets: Array<Asset>\n}\n\nexport class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {\n  constructor(\n    options: GithubOptions,\n    private readonly updater: AppUpdater,\n    private readonly token: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"api.github.com\", runtimeOptions)\n  }\n\n  protected createRequestOptions(url: URL, headers?: OutgoingHttpHeaders | null): RequestOptions {\n    const result = super.createRequestOptions(url, headers)\n    ;(result as any).redirect = \"manual\"\n    return result\n  }\n\n  async getLatestVersion(): Promise<PrivateGitHubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n    const channelFile = getChannelFilename(this.getDefaultChannelName())\n\n    const releaseInfo = await this.getLatestVersionInfo(cancellationToken)\n    const asset = releaseInfo.assets.find(it => it.name === channelFile)\n    if (asset == null) {\n      // html_url must be always, but just to be sure\n      throw newError(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n    }\n\n    const url = new URL(asset.url)\n    let result: any\n    try {\n      result = load((await this.httpRequest(url, this.configureHeaders(\"application/octet-stream\"), cancellationToken))!)\n    } catch (e: any) {\n      if (e instanceof HttpError && e.statusCode === 404) {\n        throw newError(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n      }\n      throw e\n    }\n\n    ;(result as PrivateGitHubUpdateInfo).assets = releaseInfo.assets\n    return result\n  }\n\n  get fileExtraDownloadHeaders(): OutgoingHttpHeaders | null {\n    return this.configureHeaders(\"application/octet-stream\")\n  }\n\n  private configureHeaders(accept: string) {\n    return {\n      accept,\n      authorization: `token ${this.token}`,\n    }\n  }\n\n  private async getLatestVersionInfo(cancellationToken: CancellationToken): Promise<ReleaseInfo> {\n    const allowPrerelease = this.updater.allowPrerelease\n    let basePath = this.basePath\n    if (!allowPrerelease) {\n      basePath = `${basePath}/latest`\n    }\n\n    const url = newUrlFromBase(basePath, this.baseUrl)\n    try {\n      const version = JSON.parse((await this.httpRequest(url, this.configureHeaders(\"application/vnd.github.v3+json\"), cancellationToken))!)\n      if (allowPrerelease) {\n        return (version as Array<{ prerelease: boolean }>).find(it => it.prerelease) || version[0]\n      } else {\n        return version\n      }\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`)\n  }\n\n  resolveFiles(updateInfo: PrivateGitHubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    return getFileList(updateInfo).map(it => {\n      const name = path.posix.basename(it.url).replace(/ /g, \"-\")\n      const asset = updateInfo.assets.find(it => it != null && it.name === name)\n      if (asset == null) {\n        throw newError(`Cannot find asset \"${name}\" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, \"ERR_UPDATER_ASSET_NOT_FOUND\")\n      }\n\n      return {\n        url: new URL(asset.url),\n        info: it,\n      }\n    })\n  }\n}\n\ninterface ReleaseInfo {\n  name: string\n  html_url: string\n  assets: Array<Asset>\n}\n\nexport interface Asset {\n  name: string\n  url: string\n}\n"]}
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:3:exports.PrivateGitHubProvider = void 0;
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:9:const GitHubProvider_1 = require("./GitHubProvider");
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:11:class PrivateGitHubProvider extends GitHubProvider_1.BaseGitHubProvider {
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:92:exports.PrivateGitHubProvider = PrivateGitHubProvider;
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:93://# sourceMappingURL=PrivateGitHubProvider.js.map
node_modules/electron-updater/out/providers/GitHubProvider.js:3:exports.GitHubProvider = exports.BaseGitHubProvider = void 0;
node_modules/electron-updater/out/providers/GitHubProvider.js:11:class BaseGitHubProvider extends Provider_1.Provider {
node_modules/electron-updater/out/providers/GitHubProvider.js:29:exports.BaseGitHubProvider = BaseGitHubProvider;
node_modules/electron-updater/out/providers/GitHubProvider.js:30:class GitHubProvider extends BaseGitHubProvider {
node_modules/electron-updater/out/providers/GitHubProvider.js:175:exports.GitHubProvider = GitHubProvider;
node_modules/electron-updater/out/providers/GitHubProvider.js:198://# sourceMappingURL=GitHubProvider.js.map
node_modules/electron-updater/out/providers/PrivateGitHubProvider.d.ts:5:import { BaseGitHubProvider } from "./GitHubProvider";
node_modules/electron-updater/out/providers/PrivateGitHubProvider.d.ts:11:export declare class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {
node_modules/electron-updater/out/providers/GitHubProvider.js.map:1:{"version":3,"file":"GitHubProvider.js","sourceRoot":"","sources":["../../src/providers/GitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, githubUrl, HttpError, newError, parseXml, ReleaseNoteInfo, UpdateInfo, XElement } from \"builder-util-runtime\"\nimport * as semver from \"semver\"\nimport { URL } from \"url\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getChannelFilename, newBaseUrl, newUrlFromBase } from \"../util\"\nimport { parseUpdateInfo, Provider, ProviderRuntimeOptions, resolveFiles } from \"./Provider\"\n\nconst hrefRegExp = /\\/tag\\/([^/]+)$/\n\ninterface GithubUpdateInfo extends UpdateInfo {\n  tag: string\n}\nexport abstract class BaseGitHubProvider<T extends UpdateInfo> extends Provider<T> {\n  // so, we don't need to parse port (because node http doesn't support host as url does)\n  protected readonly baseUrl: URL\n  protected readonly baseApiUrl: URL\n\n  protected constructor(\n    protected readonly options: GithubOptions,\n    defaultHost: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super({\n      ...runtimeOptions,\n      /* because GitHib uses S3 */\n      isUseMultipleRangeRequest: false,\n    })\n\n    this.baseUrl = newBaseUrl(githubUrl(options, defaultHost))\n    const apiHost = defaultHost === \"github.com\" ? \"api.github.com\" : defaultHost\n    this.baseApiUrl = newBaseUrl(githubUrl(options, apiHost))\n  }\n\n  protected computeGithubBasePath(result: string): string {\n    // https://github.com/electron-userland/electron-builder/issues/1903#issuecomment-320881211\n    const host = this.options.host\n    return host && ![\"github.com\", \"api.github.com\"].includes(host) ? `/api/v3${result}` : result\n  }\n}\n\nexport class GitHubProvider extends BaseGitHubProvider<GithubUpdateInfo> {\n  constructor(\n    protected readonly options: GithubOptions,\n    private readonly updater: AppUpdater,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"github.com\", runtimeOptions)\n  }\n\n  private get channel(): string {\n    const result = this.updater.channel || this.options.channel\n    return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result)\n  }\n\n  async getLatestVersion(): Promise<GithubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n\n    const feedXml: string = (await this.httpRequest(\n      newUrlFromBase(`${this.basePath}.atom`, this.baseUrl),\n      {\n        accept: \"application/xml, application/atom+xml, text/xml, */*\",\n      },\n      cancellationToken\n    ))!\n\n    const feed = parseXml(feedXml)\n    // noinspection TypeScriptValidateJSTypes\n    let latestRelease = feed.element(\"entry\", false, `No published versions on GitHub`)\n    let tag: string | null = null\n    try {\n      if (this.updater.allowPrerelease) {\n        const currentChannel = this.updater?.channel || (semver.prerelease(this.updater.currentVersion)?.[0] as string) || null\n\n        if (currentChannel === null) {\n          // noinspection TypeScriptValidateJSTypes\n          tag = hrefRegExp.exec(latestRelease.element(\"link\").attribute(\"href\"))![1]\n        } else {\n          for (const element of feed.getElements(\"entry\")) {\n            // noinspection TypeScriptValidateJSTypes\n            const hrefElement = hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))!\n\n            // If this is null then something is wrong and skip this release\n            if (hrefElement === null) continue\n\n            // This Release's Tag\n            const hrefTag = hrefElement[1]\n            //Get Channel from this release's tag\n            const hrefChannel = (semver.prerelease(hrefTag)?.[0] as string) || null\n\n            const shouldFetchVersion = !currentChannel || [\"alpha\", \"beta\"].includes(currentChannel)\n            const isCustomChannel = hrefChannel !== null && ![\"alpha\", \"beta\"].includes(String(hrefChannel))\n            // Allow moving from alpha to beta but not down\n            const channelMismatch = currentChannel === \"beta\" && hrefChannel === \"alpha\"\n\n            if (shouldFetchVersion && !isCustomChannel && !channelMismatch) {\n              tag = hrefTag\n              break\n            }\n\n            const isNextPreRelease = hrefChannel && hrefChannel === currentChannel\n            if (isNextPreRelease) {\n              tag = hrefTag\n              break\n            }\n          }\n        }\n      } else {\n        tag = await this.getLatestTagName(cancellationToken)\n        for (const element of feed.getElements(\"entry\")) {\n          // noinspection TypeScriptValidateJSTypes\n          if (hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))![1] === tag) {\n            latestRelease = element\n            break\n          }\n        }\n      }\n    } catch (e: any) {\n      throw newError(`Cannot parse releases feed: ${e.stack || e.message},\\nXML:\\n${feedXml}`, \"ERR_UPDATER_INVALID_RELEASE_FEED\")\n    }\n\n    if (tag == null) {\n      throw newError(`No published versions on GitHub`, \"ERR_UPDATER_NO_PUBLISHED_VERSIONS\")\n    }\n\n    let rawData: string\n    let channelFile = \"\"\n    let channelFileUrl: any = \"\"\n    const fetchData = async (channelName: string) => {\n      channelFile = getChannelFilename(channelName)\n      channelFileUrl = newUrlFromBase(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl)\n      const requestOptions = this.createRequestOptions(channelFileUrl)\n      try {\n        return (await this.executor.request(requestOptions, cancellationToken))!\n      } catch (e: any) {\n        if (e instanceof HttpError && e.statusCode === 404) {\n          throw newError(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n        }\n        throw e\n      }\n    }\n\n    try {\n      let channel = this.channel\n      if (this.updater.allowPrerelease && semver.prerelease(tag)?.[0]) {\n        channel = this.getCustomChannelName(String(semver.prerelease(tag)?.[0]))\n      }\n      rawData = await fetchData(channel)\n    } catch (e: any) {\n      if (this.updater.allowPrerelease) {\n        // Allow fallback to `latest.yml`\n        rawData = await fetchData(this.getDefaultChannelName())\n      } else {\n        throw e\n      }\n    }\n\n    const result = parseUpdateInfo(rawData, channelFile, channelFileUrl)\n    if (result.releaseName == null) {\n      result.releaseName = latestRelease.elementValueOrEmpty(\"title\")\n    }\n\n    if (result.releaseNotes == null) {\n      result.releaseNotes = computeReleaseNotes(this.updater.currentVersion, this.updater.fullChangelog, feed, latestRelease)\n    }\n    return {\n      tag: tag,\n      ...result,\n    }\n  }\n\n  private async getLatestTagName(cancellationToken: CancellationToken): Promise<string | null> {\n    const options = this.options\n    // do not use API for GitHub to avoid limit, only for custom host or GitHub Enterprise\n    const url =\n      options.host == null || options.host === \"github.com\"\n        ? newUrlFromBase(`${this.basePath}/latest`, this.baseUrl)\n        : new URL(`${this.computeGithubBasePath(`/repos/${options.owner}/${options.repo}/releases`)}/latest`, this.baseApiUrl)\n    try {\n      const rawData = await this.httpRequest(url, { Accept: \"application/json\" }, cancellationToken)\n      if (rawData == null) {\n        return null\n      }\n\n      const releaseInfo: GithubReleaseInfo = JSON.parse(rawData)\n      return releaseInfo.tag_name\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return `/${this.options.owner}/${this.options.repo}/releases`\n  }\n\n  resolveFiles(updateInfo: GithubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    // still replace space to - due to backward compatibility\n    return resolveFiles(updateInfo, this.baseUrl, p => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, \"-\")))\n  }\n\n  private getBaseDownloadPath(tag: string, fileName: string): string {\n    return `${this.basePath}/download/${tag}/${fileName}`\n  }\n}\n\ninterface GithubReleaseInfo {\n  readonly tag_name: string\n}\n\nfunction getNoteValue(parent: XElement): string {\n  const result = parent.elementValueOrEmpty(\"content\")\n  // GitHub reports empty notes as <content>No content.</content>\n  return result === \"No content.\" ? \"\" : result\n}\n\nexport function computeReleaseNotes(currentVersion: semver.SemVer, isFullChangelog: boolean, feed: XElement, latestRelease: any): string | Array<ReleaseNoteInfo> | null {\n  if (!isFullChangelog) {\n    return getNoteValue(latestRelease)\n  }\n\n  const releaseNotes: Array<ReleaseNoteInfo> = []\n  for (const release of feed.getElements(\"entry\")) {\n    // noinspection TypeScriptValidateJSTypes\n    const versionRelease = /\\/tag\\/v?([^/]+)$/.exec(release.element(\"link\").attribute(\"href\"))![1]\n    if (semver.lt(currentVersion, versionRelease)) {\n      releaseNotes.push({\n        version: versionRelease,\n        note: getNoteValue(release),\n      })\n    }\n  }\n  return releaseNotes.sort((a, b) => semver.rcompare(a.version, b.version))\n}\n"]}
node_modules/electron-updater/out/providers/GitHubProvider.d.ts:10:export declare abstract class BaseGitHubProvider<T extends UpdateInfo> extends Provider<T> {
node_modules/electron-updater/out/providers/GitHubProvider.d.ts:17:export declare class GitHubProvider extends BaseGitHubProvider<GithubUpdateInfo> {
node_modules/electron-updater/out/providerFactory.js:8:const GitHubProvider_1 = require("./providers/GitHubProvider");
node_modules/electron-updater/out/providerFactory.js:10:const PrivateGitHubProvider_1 = require("./providers/PrivateGitHubProvider");
node_modules/electron-updater/out/providerFactory.js:25:                return new GitHubProvider_1.GitHubProvider(githubOptions, updater, runtimeOptions);
node_modules/electron-updater/out/providerFactory.js:28:                return new PrivateGitHubProvider_1.PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions);
node_modules/electron-updater/out/providerFactory.js.map:1:{"version":3,"file":"providerFactory.js","sourceRoot":"","sources":["../src/providerFactory.ts"],"names":[],"mappings":";;AAoBA,wFAEC;AAED,oCA4DC;AApFD,+DAW6B;AAE7B,qEAAiE;AACjE,iEAA6D;AAC7D,+DAA2D;AAC3D,+DAA2D;AAC3D,6EAAyE;AAGzE,SAAgB,sCAAsC,CAAC,GAAW;IAChE,OAAO,CAAC,GAAG,CAAC,QAAQ,CAAC,kBAAkB,CAAC,CAAA;AAC1C,CAAC;AAED,SAAgB,YAAY,CAAC,IAA8C,EAAE,OAAmB,EAAE,cAAsC;IACtI,qCAAqC;IACrC,IAAI,OAAO,IAAI,KAAK,QAAQ,EAAE,CAAC;QAC7B,MAAM,IAAA,+BAAQ,EAAC,yCAAyC,EAAE,4CAA4C,CAAC,CAAA;IACzG,CAAC;IAED,MAAM,QAAQ,GAAG,IAAI,CAAC,QAAQ,CAAA;IAC9B,QAAQ,QAAQ,EAAE,CAAC;QACjB,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,aAAa,GAAG,IAAqB,CAAA;YAC3C,MAAM,KAAK,GAAG,CAAC,aAAa,CAAC,OAAO,CAAC,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,UAAU,CAAC,IAAI,OAAO,CAAC,GAAG,CAAC,cAAc,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,IAAI,aAAa,CAAC,KAAK,CAAA;YAC5H,IAAI,KAAK,IAAI,IAAI,EAAE,CAAC;gBAClB,OAAO,IAAI,+BAAc,CAAC,aAAa,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;YACnE,CAAC;iBAAM,CAAC;gBACN,OAAO,IAAI,6CAAqB,CAAC,aAAa,EAAE,OAAO,EAAE,KAAK,EAAE,cAAc,CAAC,CAAA;YACjF,CAAC;QACH,CAAC;QAED,KAAK,WAAW;YACd,OAAO,IAAI,qCAAiB,CAAC,IAAwB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAEjF,KAAK,QAAQ;YACX,OAAO,IAAI,+BAAc,CAAC,IAAqB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAE3E,KAAK,IAAI,CAAC;QACV,KAAK,QAAQ;YACX,OAAO,IAAI,iCAAe,CACxB;gBACE,QAAQ,EAAE,SAAS;gBACnB,GAAG,EAAE,IAAA,+CAAwB,EAAC,IAAI,CAAC;gBACnC,OAAO,EAAG,IAAsB,CAAC,OAAO,IAAI,IAAI;aACjD,EACD,OAAO,EACP;gBACE,GAAG,cAAc;gBACjB,oEAAoE;gBACpE,yBAAyB,EAAE,KAAK;aACjC,CACF,CAAA;QAEH,KAAK,SAAS,CAAC,CAAC,CAAC;YACf,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,OAAO,IAAI,iCAAe,CAAC,OAAO,EAAE,OAAO,EAAE;gBAC3C,GAAG,cAAc;gBACjB,yBAAyB,EAAE,OAAO,CAAC,uBAAuB,KAAK,KAAK,IAAI,sCAAsC,CAAC,OAAO,CAAC,GAAG,CAAC;aAC5H,CAAC,CAAA;QACJ,CAAC;QAED,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,MAAM,WAAW,GAAG,OAAO,CAAC,cAAc,CAAA;YAC1C,IAAI,CAAC,WAAW,EAAE,CAAC;gBACjB,MAAM,IAAA,+BAAQ,EAAC,+BAA+B,EAAE,4CAA4C,CAAC,CAAA;YAC/F,CAAC;YACD,OAAO,IAAI,WAAW,CAAC,OAAO,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAC1D,CAAC;QAED;YACE,MAAM,IAAA,+BAAQ,EAAC,yBAAyB,QAAQ,EAAE,EAAE,kCAAkC,CAAC,CAAA;IAC3F,CAAC;AACH,CAAC","sourcesContent":["import {\n  AllPublishOptions,\n  BaseS3Options,\n  BitbucketOptions,\n  CustomPublishOptions,\n  GenericServerOptions,\n  getS3LikeProviderBaseUrl,\n  GithubOptions,\n  KeygenOptions,\n  newError,\n  PublishConfiguration,\n} from \"builder-util-runtime\"\nimport { AppUpdater } from \"./AppUpdater\"\nimport { BitbucketProvider } from \"./providers/BitbucketProvider\"\nimport { GenericProvider } from \"./providers/GenericProvider\"\nimport { GitHubProvider } from \"./providers/GitHubProvider\"\nimport { KeygenProvider } from \"./providers/KeygenProvider\"\nimport { PrivateGitHubProvider } from \"./providers/PrivateGitHubProvider\"\nimport { Provider, ProviderRuntimeOptions } from \"./providers/Provider\"\n\nexport function isUrlProbablySupportMultiRangeRequests(url: string): boolean {\n  return !url.includes(\"s3.amazonaws.com\")\n}\n\nexport function createClient(data: PublishConfiguration | AllPublishOptions, updater: AppUpdater, runtimeOptions: ProviderRuntimeOptions): Provider<any> {\n  // noinspection SuspiciousTypeOfGuard\n  if (typeof data === \"string\") {\n    throw newError(\"Please pass PublishConfiguration object\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n  }\n\n  const provider = data.provider\n  switch (provider) {\n    case \"github\": {\n      const githubOptions = data as GithubOptions\n      const token = (githubOptions.private ? process.env[\"GH_TOKEN\"] || process.env[\"GITHUB_TOKEN\"] : null) || githubOptions.token\n      if (token == null) {\n        return new GitHubProvider(githubOptions, updater, runtimeOptions)\n      } else {\n        return new PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions)\n      }\n    }\n\n    case \"bitbucket\":\n      return new BitbucketProvider(data as BitbucketOptions, updater, runtimeOptions)\n\n    case \"keygen\":\n      return new KeygenProvider(data as KeygenOptions, updater, runtimeOptions)\n\n    case \"s3\":\n    case \"spaces\":\n      return new GenericProvider(\n        {\n          provider: \"generic\",\n          url: getS3LikeProviderBaseUrl(data),\n          channel: (data as BaseS3Options).channel || null,\n        },\n        updater,\n        {\n          ...runtimeOptions,\n          // https://github.com/minio/minio/issues/5285#issuecomment-350428955\n          isUseMultipleRangeRequest: false,\n        }\n      )\n\n    case \"generic\": {\n      const options = data as GenericServerOptions\n      return new GenericProvider(options, updater, {\n        ...runtimeOptions,\n        isUseMultipleRangeRequest: options.useMultipleRangeRequest !== false && isUrlProbablySupportMultiRangeRequests(options.url),\n      })\n    }\n\n    case \"custom\": {\n      const options = data as CustomPublishOptions\n      const constructor = options.updateProvider\n      if (!constructor) {\n        throw newError(\"Custom provider not specified\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n      }\n      return new constructor(options, updater, runtimeOptions)\n    }\n\n    default:\n      throw newError(`Unsupported provider: ${provider}`, \"ERR_UPDATER_UNSUPPORTED_PROVIDER\")\n  }\n}\n"]}
node_modules/builder-util-runtime/out/httpExecutor.js:172:                // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
node_modules/builder-util-runtime/out/httpExecutor.js.map:1:{"version":3,"file":"httpExecutor.js","sourceRoot":"","sources":["../src/httpExecutor.ts"],"names":[],"mappings":"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","sourcesContent":["import { BinaryToTextEncoding, createHash, Hash } from \"crypto\"\nimport _debug from \"debug\"\nimport { createWriteStream } from \"fs\"\nimport { IncomingMessage, OutgoingHttpHeader, OutgoingHttpHeaders, RequestOptions } from \"http\"\nimport { Socket } from \"net\"\nimport { Transform } from \"stream\"\nimport { URL } from \"url\"\nimport { CancellationToken } from \"./CancellationToken\"\nimport { newError } from \"./error\"\nimport { ProgressCallbackTransform, ProgressInfo } from \"./ProgressCallbackTransform\"\n\nconst debug = _debug(\"electron-builder\")\n\nexport interface RequestHeaders extends OutgoingHttpHeaders {\n  [key: string]: OutgoingHttpHeader | undefined\n}\n\nexport interface DownloadOptions {\n  readonly headers?: OutgoingHttpHeaders | null\n  readonly sha2?: string | null\n  readonly sha512?: string | null\n\n  readonly cancellationToken: CancellationToken\n\n  // noinspection JSUnusedLocalSymbols\n  onProgress?: (progress: ProgressInfo) => void\n}\n\nexport function createHttpError(response: IncomingMessage, description: any | null = null) {\n  return new HttpError(\n    response.statusCode || -1,\n    `${response.statusCode} ${response.statusMessage}` +\n      (description == null ? \"\" : \"\\n\" + JSON.stringify(description, null, \"  \")) +\n      \"\\nHeaders: \" +\n      safeStringifyJson(response.headers),\n    description\n  )\n}\n\nconst HTTP_STATUS_CODES = new Map<number, string>([\n  [429, \"Too many requests\"],\n  [400, \"Bad request\"],\n  [403, \"Forbidden\"],\n  [404, \"Not found\"],\n  [405, \"Method not allowed\"],\n  [406, \"Not acceptable\"],\n  [408, \"Request timeout\"],\n  [413, \"Request entity too large\"],\n  [500, \"Internal server error\"],\n  [502, \"Bad gateway\"],\n  [503, \"Service unavailable\"],\n  [504, \"Gateway timeout\"],\n  [505, \"HTTP version not supported\"],\n])\n\nexport class HttpError extends Error {\n  constructor(\n    readonly statusCode: number,\n    message = `HTTP error: ${HTTP_STATUS_CODES.get(statusCode) || statusCode}`,\n    readonly description: any | null = null\n  ) {\n    super(message)\n\n    this.name = \"HttpError\"\n    ;(this as NodeJS.ErrnoException).code = `HTTP_ERROR_${statusCode}`\n  }\n\n  isServerError() {\n    return this.statusCode >= 500 && this.statusCode <= 599\n  }\n}\n\nexport function parseJson(result: Promise<string | null>) {\n  return result.then(it => (it == null || it.length === 0 ? null : JSON.parse(it)))\n}\n\ninterface Request {\n  abort: () => void\n  end: (data?: Buffer) => void\n}\nexport abstract class HttpExecutor<T extends Request> {\n  protected readonly maxRedirects = 10\n\n  request(options: RequestOptions, cancellationToken: CancellationToken = new CancellationToken(), data?: { [name: string]: any } | null): Promise<string | null> {\n    configureRequestOptions(options)\n    const json = data == null ? undefined : JSON.stringify(data)\n    const encodedData = json ? Buffer.from(json) : undefined\n    if (encodedData != null) {\n      debug(json!)\n      const { headers, ...opts } = options\n      options = {\n        method: \"post\",\n        headers: {\n          \"Content-Type\": \"application/json\",\n          \"Content-Length\": encodedData.length,\n          ...headers,\n        },\n        ...opts,\n      }\n    }\n    return this.doApiRequest(options, cancellationToken, it => it.end(encodedData))\n  }\n\n  doApiRequest(\n    options: RequestOptions,\n    cancellationToken: CancellationToken,\n    requestProcessor: (request: T, reject: (error: Error) => void) => void,\n    redirectCount = 0\n  ): Promise<string> {\n    if (debug.enabled) {\n      debug(`Request: ${safeStringifyJson(options)}`)\n    }\n\n    return cancellationToken.createPromise<string>((resolve, reject, onCancel) => {\n      const request = this.createRequest(options, (response: any) => {\n        try {\n          this.handleResponse(response, options, cancellationToken, resolve, reject, redirectCount, requestProcessor)\n        } catch (e: any) {\n          reject(e)\n        }\n      })\n      this.addErrorAndTimeoutHandlers(request, reject, options.timeout)\n      this.addRedirectHandlers(request, options, reject, redirectCount, options => {\n        this.doApiRequest(options, cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject)\n      })\n      requestProcessor(request, reject)\n      onCancel(() => request.abort())\n    })\n  }\n\n  // noinspection JSUnusedLocalSymbols\n  // eslint-disable-next-line\n  protected addRedirectHandlers(request: any, options: RequestOptions, reject: (error: Error) => void, redirectCount: number, handler: (options: RequestOptions) => void) {\n    // not required for NodeJS\n  }\n\n  addErrorAndTimeoutHandlers(request: any, reject: (error: Error) => void, timeout = 60 * 1000) {\n    this.addTimeOutHandler(request, reject, timeout)\n    request.on(\"error\", reject)\n    request.on(\"aborted\", () => {\n      reject(new Error(\"Request has been aborted by the server\"))\n    })\n  }\n\n  private handleResponse(\n    response: IncomingMessage,\n    options: RequestOptions,\n    cancellationToken: CancellationToken,\n    resolve: (data?: any) => void,\n    reject: (error: Error) => void,\n    redirectCount: number,\n    requestProcessor: (request: T, reject: (error: Error) => void) => void\n  ) {\n    if (debug.enabled) {\n      debug(`Response: ${response.statusCode} ${response.statusMessage}, request options: ${safeStringifyJson(options)}`)\n    }\n\n    // we handle any other >= 400 error on request end (read detailed message in the response body)\n    if (response.statusCode === 404) {\n      // error is clear, we don't need to read detailed error description\n      reject(\n        createHttpError(\n          response,\n          `method: ${options.method || \"GET\"} url: ${options.protocol || \"https:\"}//${options.hostname}${options.port ? `:${options.port}` : \"\"}${options.path}\n\nPlease double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.\n`\n        )\n      )\n      return\n    } else if (response.statusCode === 204) {\n      // on DELETE request\n      resolve()\n      return\n    }\n\n    const code = response.statusCode ?? 0\n    const shouldRedirect = code >= 300 && code < 400\n    const redirectUrl = safeGetHeader(response, \"location\")\n    if (shouldRedirect && redirectUrl != null) {\n      if (redirectCount > this.maxRedirects) {\n        reject(this.createMaxRedirectError())\n        return\n      }\n\n      this.doApiRequest(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, options), cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject)\n      return\n    }\n\n    response.setEncoding(\"utf8\")\n\n    let data = \"\"\n    response.on(\"error\", reject)\n    response.on(\"data\", (chunk: string) => (data += chunk))\n    response.on(\"end\", () => {\n      try {\n        if (response.statusCode != null && response.statusCode >= 400) {\n          const contentType = safeGetHeader(response, \"content-type\")\n          const isJson = contentType != null && (Array.isArray(contentType) ? contentType.find(it => it.includes(\"json\")) != null : contentType.includes(\"json\"))\n          reject(\n            createHttpError(\n              response,\n              `method: ${options.method || \"GET\"} url: ${options.protocol || \"https:\"}//${options.hostname}${options.port ? `:${options.port}` : \"\"}${options.path}\n\n          Data:\n          ${isJson ? JSON.stringify(JSON.parse(data)) : data}\n          `\n            )\n          )\n        } else {\n          resolve(data.length === 0 ? null : data)\n        }\n      } catch (e: any) {\n        reject(e)\n      }\n    })\n  }\n\n  // noinspection JSUnusedLocalSymbols\n  abstract createRequest(options: RequestOptions, callback: (response: any) => void): T\n\n  async downloadToBuffer(url: URL, options: DownloadOptions): Promise<Buffer> {\n    return await options.cancellationToken.createPromise<Buffer>((resolve, reject, onCancel) => {\n      const responseChunks: Buffer[] = []\n      const requestOptions = {\n        headers: options.headers || undefined,\n        // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually\n        redirect: \"manual\",\n      }\n      configureRequestUrl(url, requestOptions)\n      configureRequestOptions(requestOptions)\n      this.doDownload(\n        requestOptions,\n        {\n          destination: null,\n          options,\n          onCancel,\n          callback: error => {\n            if (error == null) {\n              resolve(Buffer.concat(responseChunks))\n            } else {\n              reject(error)\n            }\n          },\n          responseHandler: (response, callback) => {\n            let receivedLength = 0\n            response.on(\"data\", (chunk: Buffer) => {\n              receivedLength += chunk.length\n              if (receivedLength > 524288000) {\n                callback(new Error(\"Maximum allowed size is 500 MB\"))\n                return\n              }\n              responseChunks.push(chunk)\n            })\n            response.on(\"end\", () => {\n              callback(null)\n            })\n          },\n        },\n        0\n      )\n    })\n  }\n\n  protected doDownload(requestOptions: RequestOptions, options: DownloadCallOptions, redirectCount: number) {\n    const request = this.createRequest(requestOptions, (response: IncomingMessage) => {\n      if (response.statusCode! >= 400) {\n        options.callback(\n          new Error(\n            `Cannot download \"${requestOptions.protocol || \"https:\"}//${requestOptions.hostname}${requestOptions.path}\", status ${response.statusCode}: ${response.statusMessage}`\n          )\n        )\n        return\n      }\n\n      // It is possible for the response stream to fail, e.g. when a network is lost while\n      // response stream is in progress. Stop waiting and reject so consumer can catch the error.\n      response.on(\"error\", options.callback)\n\n      // this code not relevant for Electron (redirect event instead handled)\n      const redirectUrl = safeGetHeader(response, \"location\")\n      if (redirectUrl != null) {\n        if (redirectCount < this.maxRedirects) {\n          this.doDownload(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, requestOptions), options, redirectCount++)\n        } else {\n          options.callback(this.createMaxRedirectError())\n        }\n        return\n      }\n\n      if (options.responseHandler == null) {\n        configurePipes(options, response)\n      } else {\n        options.responseHandler(response, options.callback)\n      }\n    })\n    this.addErrorAndTimeoutHandlers(request, options.callback, requestOptions.timeout)\n    this.addRedirectHandlers(request, requestOptions, options.callback, redirectCount, requestOptions => {\n      this.doDownload(requestOptions, options, redirectCount++)\n    })\n    request.end()\n  }\n\n  protected createMaxRedirectError() {\n    return new Error(`Too many redirects (> ${this.maxRedirects})`)\n  }\n\n  private addTimeOutHandler(request: any, callback: (error: Error) => void, timeout: number) {\n    request.on(\"socket\", (socket: Socket) => {\n      socket.setTimeout(timeout, () => {\n        request.abort()\n        callback(new Error(\"Request timed out\"))\n      })\n    })\n  }\n\n  static prepareRedirectUrlOptions(redirectUrl: string, options: RequestOptions): RequestOptions {\n    const newOptions = configureRequestOptionsFromUrl(redirectUrl, { ...options })\n    const headers = newOptions.headers\n    if (headers?.authorization) {\n      const parsedNewUrl = new URL(redirectUrl)\n      if (parsedNewUrl.hostname.endsWith(\".amazonaws.com\") || parsedNewUrl.searchParams.has(\"X-Amz-Credential\")) {\n        delete headers.authorization\n      }\n    }\n    return newOptions\n  }\n\n  static retryOnServerError(task: () => Promise<any>, maxRetries = 3) {\n    for (let attemptNumber = 0; ; attemptNumber++) {\n      try {\n        return task()\n      } catch (e: any) {\n        if (attemptNumber < maxRetries && ((e instanceof HttpError && e.isServerError()) || e.code === \"EPIPE\")) {\n          continue\n        }\n        throw e\n      }\n    }\n  }\n}\n\nexport interface DownloadCallOptions {\n  responseHandler: ((response: IncomingMessage, callback: (error: Error | null) => void) => void) | null\n  onCancel: (callback: () => void) => void\n  callback: (error: Error | null) => void\n\n  options: DownloadOptions\n\n  destination: string | null\n}\n\nexport function configureRequestOptionsFromUrl(url: string, options: RequestOptions) {\n  const result = configureRequestOptions(options)\n  configureRequestUrl(new URL(url), result)\n  return result\n}\n\nexport function configureRequestUrl(url: URL, options: RequestOptions): void {\n  options.protocol = url.protocol\n  options.hostname = url.hostname\n  if (url.port) {\n    options.port = url.port\n  } else if (options.port) {\n    delete options.port\n  }\n  options.path = url.pathname + url.search\n}\n\nexport class DigestTransform extends Transform {\n  private readonly digester: Hash\n\n  private _actual: string | null = null\n\n  // noinspection JSUnusedGlobalSymbols\n  get actual() {\n    return this._actual\n  }\n\n  isValidateOnEnd = true\n\n  constructor(\n    readonly expected: string,\n    private readonly algorithm: string = \"sha512\",\n    private readonly encoding: BinaryToTextEncoding = \"base64\"\n  ) {\n    super()\n\n    this.digester = createHash(algorithm)\n  }\n\n  // noinspection JSUnusedGlobalSymbols\n  _transform(chunk: Buffer, encoding: string, callback: any) {\n    this.digester.update(chunk)\n    callback(null, chunk)\n  }\n\n  // noinspection JSUnusedGlobalSymbols\n  _flush(callback: any): void {\n    this._actual = this.digester.digest(this.encoding)\n\n    if (this.isValidateOnEnd) {\n      try {\n        this.validate()\n      } catch (e: any) {\n        callback(e)\n        return\n      }\n    }\n\n    callback(null)\n  }\n\n  validate() {\n    if (this._actual == null) {\n      throw newError(\"Not finished yet\", \"ERR_STREAM_NOT_FINISHED\")\n    }\n\n    if (this._actual !== this.expected) {\n      throw newError(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, \"ERR_CHECKSUM_MISMATCH\")\n    }\n\n    return null\n  }\n}\n\nfunction checkSha2(sha2Header: string | null | undefined, sha2: string | null | undefined, callback: (error: Error | null) => void): boolean {\n  if (sha2Header != null && sha2 != null && sha2Header !== sha2) {\n    callback(new Error(`checksum mismatch: expected ${sha2} but got ${sha2Header} (X-Checksum-Sha2 header)`))\n    return false\n  }\n  return true\n}\n\nexport function safeGetHeader(response: any, headerKey: string) {\n  const value = response.headers[headerKey]\n  if (value == null) {\n    return null\n  } else if (Array.isArray(value)) {\n    // electron API\n    return value.length === 0 ? null : value[value.length - 1]\n  } else {\n    return value\n  }\n}\n\nfunction configurePipes(options: DownloadCallOptions, response: IncomingMessage) {\n  if (!checkSha2(safeGetHeader(response, \"X-Checksum-Sha2\"), options.options.sha2, options.callback)) {\n    return\n  }\n\n  const streams: Array<any> = []\n  if (options.options.onProgress != null) {\n    const contentLength = safeGetHeader(response, \"content-length\")\n    if (contentLength != null) {\n      streams.push(new ProgressCallbackTransform(parseInt(contentLength, 10), options.options.cancellationToken, options.options.onProgress))\n    }\n  }\n\n  const sha512 = options.options.sha512\n  if (sha512 != null) {\n    streams.push(new DigestTransform(sha512, \"sha512\", sha512.length === 128 && !sha512.includes(\"+\") && !sha512.includes(\"Z\") && !sha512.includes(\"=\") ? \"hex\" : \"base64\"))\n  } else if (options.options.sha2 != null) {\n    streams.push(new DigestTransform(options.options.sha2, \"sha256\", \"hex\"))\n  }\n\n  const fileOut = createWriteStream(options.destination!)\n  streams.push(fileOut)\n\n  let lastStream = response\n  for (const stream of streams) {\n    stream.on(\"error\", (error: Error) => {\n      fileOut.close()\n      if (!options.options.cancellationToken.cancelled) {\n        options.callback(error)\n      }\n    })\n    lastStream = lastStream.pipe(stream)\n  }\n\n  fileOut.on(\"finish\", () => {\n    ;(fileOut.close as any)(options.callback)\n  })\n}\n\nexport function configureRequestOptions(options: RequestOptions, token?: string | null, method?: \"GET\" | \"DELETE\" | \"PUT\" | \"POST\"): RequestOptions {\n  if (method != null) {\n    options.method = method\n  }\n\n  options.headers = { ...options.headers }\n  const headers = options.headers\n\n  if (token != null) {\n    ;(headers as any).authorization = token.startsWith(\"Basic\") || token.startsWith(\"Bearer\") ? token : `token ${token}`\n  }\n  if (headers[\"User-Agent\"] == null) {\n    headers[\"User-Agent\"] = \"electron-builder\"\n  }\n\n  if (method == null || method === \"GET\" || headers[\"Cache-Control\"] == null) {\n    headers[\"Cache-Control\"] = \"no-cache\"\n  }\n\n  // do not specify for node (in any case we use https module)\n  if (options.protocol == null && (process.versions as any).electron != null) {\n    options.protocol = \"https:\"\n  }\n  return options\n}\n\nexport function safeStringifyJson(data: any, skippedNames?: Set<string>) {\n  return JSON.stringify(\n    data,\n    (name, value) => {\n      if (\n        name.endsWith(\"Authorization\") ||\n        name.endsWith(\"authorization\") ||\n        name.endsWith(\"Password\") ||\n        name.endsWith(\"PASSWORD\") ||\n        name.endsWith(\"Token\") ||\n        name.includes(\"password\") ||\n        name.includes(\"token\") ||\n        (skippedNames != null && skippedNames.has(name))\n      ) {\n        return \"<stripped sensitive data>\"\n      }\n      return value\n    },\n    2\n  )\n}\n"]}

exec
/bin/zsh -lc "grep -R \"new PrivateGitHubProvider\\|PrivateGitHubProvider\" -n node_modules/electron-updater/out | sed -n '1,160p'; grep -R \"process.env.*GH_TOKEN\\|GH_TOKEN\\|github.*private\" -n node_modules/electron-updater/out node_modules/builder-util-runtime/out | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js.map:1:{"version":3,"file":"PrivateGitHubProvider.js","sourceRoot":"","sources":["../../src/providers/PrivateGitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, HttpError, newError, UpdateInfo } from \"builder-util-runtime\"\nimport { OutgoingHttpHeaders, RequestOptions } from \"http\"\nimport { load } from \"js-yaml\"\nimport * as path from \"path\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { URL } from \"url\"\nimport { getChannelFilename, newUrlFromBase } from \"../util\"\nimport { BaseGitHubProvider } from \"./GitHubProvider\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getFileList, ProviderRuntimeOptions } from \"./Provider\"\n\nexport interface PrivateGitHubUpdateInfo extends UpdateInfo {\n  assets: Array<Asset>\n}\n\nexport class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {\n  constructor(\n    options: GithubOptions,\n    private readonly updater: AppUpdater,\n    private readonly token: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"api.github.com\", runtimeOptions)\n  }\n\n  protected createRequestOptions(url: URL, headers?: OutgoingHttpHeaders | null): RequestOptions {\n    const result = super.createRequestOptions(url, headers)\n    ;(result as any).redirect = \"manual\"\n    return result\n  }\n\n  async getLatestVersion(): Promise<PrivateGitHubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n    const channelFile = getChannelFilename(this.getDefaultChannelName())\n\n    const releaseInfo = await this.getLatestVersionInfo(cancellationToken)\n    const asset = releaseInfo.assets.find(it => it.name === channelFile)\n    if (asset == null) {\n      // html_url must be always, but just to be sure\n      throw newError(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n    }\n\n    const url = new URL(asset.url)\n    let result: any\n    try {\n      result = load((await this.httpRequest(url, this.configureHeaders(\"application/octet-stream\"), cancellationToken))!)\n    } catch (e: any) {\n      if (e instanceof HttpError && e.statusCode === 404) {\n        throw newError(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n      }\n      throw e\n    }\n\n    ;(result as PrivateGitHubUpdateInfo).assets = releaseInfo.assets\n    return result\n  }\n\n  get fileExtraDownloadHeaders(): OutgoingHttpHeaders | null {\n    return this.configureHeaders(\"application/octet-stream\")\n  }\n\n  private configureHeaders(accept: string) {\n    return {\n      accept,\n      authorization: `token ${this.token}`,\n    }\n  }\n\n  private async getLatestVersionInfo(cancellationToken: CancellationToken): Promise<ReleaseInfo> {\n    const allowPrerelease = this.updater.allowPrerelease\n    let basePath = this.basePath\n    if (!allowPrerelease) {\n      basePath = `${basePath}/latest`\n    }\n\n    const url = newUrlFromBase(basePath, this.baseUrl)\n    try {\n      const version = JSON.parse((await this.httpRequest(url, this.configureHeaders(\"application/vnd.github.v3+json\"), cancellationToken))!)\n      if (allowPrerelease) {\n        return (version as Array<{ prerelease: boolean }>).find(it => it.prerelease) || version[0]\n      } else {\n        return version\n      }\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`)\n  }\n\n  resolveFiles(updateInfo: PrivateGitHubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    return getFileList(updateInfo).map(it => {\n      const name = path.posix.basename(it.url).replace(/ /g, \"-\")\n      const asset = updateInfo.assets.find(it => it != null && it.name === name)\n      if (asset == null) {\n        throw newError(`Cannot find asset \"${name}\" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, \"ERR_UPDATER_ASSET_NOT_FOUND\")\n      }\n\n      return {\n        url: new URL(asset.url),\n        info: it,\n      }\n    })\n  }\n}\n\ninterface ReleaseInfo {\n  name: string\n  html_url: string\n  assets: Array<Asset>\n}\n\nexport interface Asset {\n  name: string\n  url: string\n}\n"]}
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:3:exports.PrivateGitHubProvider = void 0;
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:11:class PrivateGitHubProvider extends GitHubProvider_1.BaseGitHubProvider {
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:92:exports.PrivateGitHubProvider = PrivateGitHubProvider;
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js:93://# sourceMappingURL=PrivateGitHubProvider.js.map
node_modules/electron-updater/out/providers/PrivateGitHubProvider.d.ts:11:export declare class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {
node_modules/electron-updater/out/providerFactory.js:10:const PrivateGitHubProvider_1 = require("./providers/PrivateGitHubProvider");
node_modules/electron-updater/out/providerFactory.js:28:                return new PrivateGitHubProvider_1.PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions);
node_modules/electron-updater/out/providerFactory.js.map:1:{"version":3,"file":"providerFactory.js","sourceRoot":"","sources":["../src/providerFactory.ts"],"names":[],"mappings":";;AAoBA,wFAEC;AAED,oCA4DC;AApFD,+DAW6B;AAE7B,qEAAiE;AACjE,iEAA6D;AAC7D,+DAA2D;AAC3D,+DAA2D;AAC3D,6EAAyE;AAGzE,SAAgB,sCAAsC,CAAC,GAAW;IAChE,OAAO,CAAC,GAAG,CAAC,QAAQ,CAAC,kBAAkB,CAAC,CAAA;AAC1C,CAAC;AAED,SAAgB,YAAY,CAAC,IAA8C,EAAE,OAAmB,EAAE,cAAsC;IACtI,qCAAqC;IACrC,IAAI,OAAO,IAAI,KAAK,QAAQ,EAAE,CAAC;QAC7B,MAAM,IAAA,+BAAQ,EAAC,yCAAyC,EAAE,4CAA4C,CAAC,CAAA;IACzG,CAAC;IAED,MAAM,QAAQ,GAAG,IAAI,CAAC,QAAQ,CAAA;IAC9B,QAAQ,QAAQ,EAAE,CAAC;QACjB,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,aAAa,GAAG,IAAqB,CAAA;YAC3C,MAAM,KAAK,GAAG,CAAC,aAAa,CAAC,OAAO,CAAC,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,UAAU,CAAC,IAAI,OAAO,CAAC,GAAG,CAAC,cAAc,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,IAAI,aAAa,CAAC,KAAK,CAAA;YAC5H,IAAI,KAAK,IAAI,IAAI,EAAE,CAAC;gBAClB,OAAO,IAAI,+BAAc,CAAC,aAAa,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;YACnE,CAAC;iBAAM,CAAC;gBACN,OAAO,IAAI,6CAAqB,CAAC,aAAa,EAAE,OAAO,EAAE,KAAK,EAAE,cAAc,CAAC,CAAA;YACjF,CAAC;QACH,CAAC;QAED,KAAK,WAAW;YACd,OAAO,IAAI,qCAAiB,CAAC,IAAwB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAEjF,KAAK,QAAQ;YACX,OAAO,IAAI,+BAAc,CAAC,IAAqB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAE3E,KAAK,IAAI,CAAC;QACV,KAAK,QAAQ;YACX,OAAO,IAAI,iCAAe,CACxB;gBACE,QAAQ,EAAE,SAAS;gBACnB,GAAG,EAAE,IAAA,+CAAwB,EAAC,IAAI,CAAC;gBACnC,OAAO,EAAG,IAAsB,CAAC,OAAO,IAAI,IAAI;aACjD,EACD,OAAO,EACP;gBACE,GAAG,cAAc;gBACjB,oEAAoE;gBACpE,yBAAyB,EAAE,KAAK;aACjC,CACF,CAAA;QAEH,KAAK,SAAS,CAAC,CAAC,CAAC;YACf,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,OAAO,IAAI,iCAAe,CAAC,OAAO,EAAE,OAAO,EAAE;gBAC3C,GAAG,cAAc;gBACjB,yBAAyB,EAAE,OAAO,CAAC,uBAAuB,KAAK,KAAK,IAAI,sCAAsC,CAAC,OAAO,CAAC,GAAG,CAAC;aAC5H,CAAC,CAAA;QACJ,CAAC;QAED,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,MAAM,WAAW,GAAG,OAAO,CAAC,cAAc,CAAA;YAC1C,IAAI,CAAC,WAAW,EAAE,CAAC;gBACjB,MAAM,IAAA,+BAAQ,EAAC,+BAA+B,EAAE,4CAA4C,CAAC,CAAA;YAC/F,CAAC;YACD,OAAO,IAAI,WAAW,CAAC,OAAO,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAC1D,CAAC;QAED;YACE,MAAM,IAAA,+BAAQ,EAAC,yBAAyB,QAAQ,EAAE,EAAE,kCAAkC,CAAC,CAAA;IAC3F,CAAC;AACH,CAAC","sourcesContent":["import {\n  AllPublishOptions,\n  BaseS3Options,\n  BitbucketOptions,\n  CustomPublishOptions,\n  GenericServerOptions,\n  getS3LikeProviderBaseUrl,\n  GithubOptions,\n  KeygenOptions,\n  newError,\n  PublishConfiguration,\n} from \"builder-util-runtime\"\nimport { AppUpdater } from \"./AppUpdater\"\nimport { BitbucketProvider } from \"./providers/BitbucketProvider\"\nimport { GenericProvider } from \"./providers/GenericProvider\"\nimport { GitHubProvider } from \"./providers/GitHubProvider\"\nimport { KeygenProvider } from \"./providers/KeygenProvider\"\nimport { PrivateGitHubProvider } from \"./providers/PrivateGitHubProvider\"\nimport { Provider, ProviderRuntimeOptions } from \"./providers/Provider\"\n\nexport function isUrlProbablySupportMultiRangeRequests(url: string): boolean {\n  return !url.includes(\"s3.amazonaws.com\")\n}\n\nexport function createClient(data: PublishConfiguration | AllPublishOptions, updater: AppUpdater, runtimeOptions: ProviderRuntimeOptions): Provider<any> {\n  // noinspection SuspiciousTypeOfGuard\n  if (typeof data === \"string\") {\n    throw newError(\"Please pass PublishConfiguration object\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n  }\n\n  const provider = data.provider\n  switch (provider) {\n    case \"github\": {\n      const githubOptions = data as GithubOptions\n      const token = (githubOptions.private ? process.env[\"GH_TOKEN\"] || process.env[\"GITHUB_TOKEN\"] : null) || githubOptions.token\n      if (token == null) {\n        return new GitHubProvider(githubOptions, updater, runtimeOptions)\n      } else {\n        return new PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions)\n      }\n    }\n\n    case \"bitbucket\":\n      return new BitbucketProvider(data as BitbucketOptions, updater, runtimeOptions)\n\n    case \"keygen\":\n      return new KeygenProvider(data as KeygenOptions, updater, runtimeOptions)\n\n    case \"s3\":\n    case \"spaces\":\n      return new GenericProvider(\n        {\n          provider: \"generic\",\n          url: getS3LikeProviderBaseUrl(data),\n          channel: (data as BaseS3Options).channel || null,\n        },\n        updater,\n        {\n          ...runtimeOptions,\n          // https://github.com/minio/minio/issues/5285#issuecomment-350428955\n          isUseMultipleRangeRequest: false,\n        }\n      )\n\n    case \"generic\": {\n      const options = data as GenericServerOptions\n      return new GenericProvider(options, updater, {\n        ...runtimeOptions,\n        isUseMultipleRangeRequest: options.useMultipleRangeRequest !== false && isUrlProbablySupportMultiRangeRequests(options.url),\n      })\n    }\n\n    case \"custom\": {\n      const options = data as CustomPublishOptions\n      const constructor = options.updateProvider\n      if (!constructor) {\n        throw newError(\"Custom provider not specified\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n      }\n      return new constructor(options, updater, runtimeOptions)\n    }\n\n    default:\n      throw newError(`Unsupported provider: ${provider}`, \"ERR_UPDATER_UNSUPPORTED_PROVIDER\")\n  }\n}\n"]}
node_modules/electron-updater/out/AppUpdater.js.map:1:{"version":3,"file":"AppUpdater.js","sourceRoot":"","sources":["../src/AppUpdater.ts"],"names":[],"mappings":";;;AAAA,+DAa6B;AAC7B,mCAAoC;AACpC,2BAA4B;AAC5B,mCAAqC;AACrC,uCAAsE;AAEtE,qCAA8B;AAC9B,uCAA+B;AAC/B,6BAA4B;AAC5B,mCAA8K;AAE9K,qEAAuF;AACvF,6DAAyD;AACzD,iEAA2F;AAC3F,iEAA6D;AAC7D,iCAAgK;AAChK,uDAAwF;AAKxF,+BAAiC;AACjC,iCAAsC;AAEtC,0GAAsG;AActG,MAAsB,UAAW,SAAS,qBAAyD;IA0EjG;;OAEG;IACH,IAAI,OAAO;QACT,OAAO,IAAI,CAAC,QAAQ,CAAA;IACtB,CAAC;IAED;;;;OAIG;IACH,IAAI,OAAO,CAAC,KAAoB;QAC9B,IAAI,IAAI,CAAC,QAAQ,IAAI,IAAI,EAAE,CAAC;YAC1B,qCAAqC;YACrC,IAAI,OAAO,KAAK,KAAK,QAAQ,EAAE,CAAC;gBAC9B,MAAM,IAAA,+BAAQ,EAAC,sCAAsC,KAAK,EAAE,EAAE,6BAA6B,CAAC,CAAA;YAC9F,CAAC;iBAAM,IAAI,KAAK,CAAC,MAAM,KAAK,CAAC,EAAE,CAAC;gBAC9B,MAAM,IAAA,+BAAQ,EAAC,qCAAqC,EAAE,6BAA6B,CAAC,CAAA;YACtF,CAAC;QACH,CAAC;QAED,IAAI,CAAC,QAAQ,GAAG,KAAK,CAAA;QACrB,IAAI,CAAC,cAAc,GAAG,IAAI,CAAA;IAC5B,CAAC;IAOD;;OAEG;IACH,aAAa,CAAC,KAAa;QACzB,IAAI,CAAC,cAAc,GAAG,MAAM,CAAC,MAAM,CAAC,EAAE,EAAE,IAAI,CAAC,cAAc,EAAE;YAC3D,aAAa,EAAE,KAAK;SACrB,CAAC,CAAA;IACJ,CAAC;IAID,yDAAyD;IACzD,IAAI,UAAU;QACZ,OAAO,IAAA,oCAAa,GAAE,CAAA;IACxB,CAAC;IAED;;;OAGG;IACH,IAAI,MAAM;QACR,OAAO,IAAI,CAAC,OAAO,CAAA;IACrB,CAAC;IAED,IAAI,MAAM,CAAC,KAAoB;QAC7B,IAAI,CAAC,OAAO,GAAG,KAAK,IAAI,IAAI,CAAC,CAAC,CAAC,IAAI,UAAU,EAAE,CAAC,CAAC,CAAC,KAAK,CAAA;IACzD,CAAC;IAUD,qCAAqC;IACrC;;;OAGG;IACH,IAAI,gBAAgB,CAAC,KAAoB;QACvC,IAAI,CAAC,aAAa,GAAG,IAAI,CAAA;QACzB,IAAI,CAAC,oBAAoB,GAAG,KAAK,CAAA;QACjC,IAAI,CAAC,YAAY,GAAG,IAAI,eAAI,CAAM,GAAG,EAAE,CAAC,IAAI,CAAC,gBAAgB,EAAE,CAAC,CAAA;IAClE,CAAC;IAoBD,YAAsB,OAA6C,EAAE,GAAgB;QACnF,KAAK,EAAE,CAAA;QA1KT;;WAEG;QACH,iBAAY,GAAG,IAAI,CAAA;QAEnB;;WAEG;QACH,yBAAoB,GAAG,IAAI,CAAA;QAE3B;;;WAGG;QACH,2BAAsB,GAAG,IAAI,CAAA;QAE7B;;;;WAIG;QACH,oBAAe,GAAG,KAAK,CAAA;QAEvB;;;WAGG;QACH,kBAAa,GAAG,KAAK,CAAA;QAErB;;;;;;WAMG;QACH,mBAAc,GAAG,KAAK,CAAA;QAEtB;;;;;;;WAOG;QACH,wBAAmB,GAAG,KAAK,CAAA;QAE3B;;;;WAIG;QACH,gCAA2B,GAAG,KAAK,CAAA;QAEnC;;;;;;WAMG;QACH,yBAAoB,GAAG,KAAK,CAAA;QAOpB,aAAQ,GAAkB,IAAI,CAAA;QAE5B,2BAAsB,GAAkC,IAAI,CAAA;QA4BtE;;WAEG;QACH,mBAAc,GAA+B,IAAI,CAAA;QAWvC,YAAO,GAAW,OAAO,CAAA;QAmBnC,qCAAqC;QACrC;;WAEG;QACM,YAAO,GAAG,IAAI,oBAAa,CAAC,IAAI,CAAC,CAAA;QAElC,yBAAoB,GAAkB,IAAI,CAAA;QAa1C,kBAAa,GAAkC,IAAI,CAAA;QAExC,yBAAoB,GAAG,IAAI,eAAI,CAAS,GAAG,EAAE,CAAC,IAAI,CAAC,wBAAwB,EAAE,CAAC,CAAA;QAEjG,8CAA8C;QAC9C,gBAAgB;QAChB,iBAAY,GAAG,IAAI,eAAI,CAAM,GAAG,EAAE,CAAC,IAAI,CAAC,gBAAgB,EAAE,CAAC,CAAA;QAEnD,2BAAsB,GAAsC,IAAI,CAAA;QAChE,oBAAe,GAAkC,IAAI,CAAA;QAInD,0BAAqB,GAAiC,IAAI,CAAA;QA0ZpE;;;WAGG;QACH,qBAAgB,GAAkC,IAAI,CAAA;QAtZpD,IAAI,CAAC,EAAE,CAAC,OAAO,EAAE,CAAC,KAAY,EAAE,EAAE;YAChC,IAAI,CAAC,OAAO,CAAC,KAAK,CAAC,UAAU,KAAK,CAAC,KAAK,IAAI,KAAK,CAAC,OAAO,EAAE,CAAC,CAAA;QAC9D,CAAC,CAAC,CAAA;QAEF,IAAI,GAAG,IAAI,IAAI,EAAE,CAAC;YAChB,IAAI,CAAC,GAAG,GAAG,IAAI,uCAAkB,EAAE,CAAA;YACnC,IAAI,CAAC,YAAY,GAAG,IAAI,2CAAoB,CAAC,CAAC,QAAQ,EAAE,QAAQ,EAAE,EAAE,CAAC,IAAI,CAAC,IAAI,CAAC,OAAO,EAAE,QAAQ,EAAE,QAAQ,CAAC,CAAC,CAAA;QAC9G,CAAC;aAAM,CAAC;YACN,IAAI,CAAC,GAAG,GAAG,GAAG,CAAA;YACd,IAAI,CAAC,YAAY,GAAG,IAAW,CAAA;QACjC,CAAC;QAED,MAAM,oBAAoB,GAAG,IAAI,CAAC,GAAG,CAAC,OAAO,CAAA;QAC7C,MAAM,cAAc,GAAG,IAAA,cAAY,EAAC,oBAAoB,CAAC,CAAA;QACzD,IAAI,cAAc,IAAI,IAAI,EAAE,CAAC;YAC3B,MAAM,IAAA,+BAAQ,EAAC,+CAA+C,oBAAoB,GAAG,EAAE,6BAA6B,CAAC,CAAA;QACvH,CAAC;QACD,IAAI,CAAC,cAAc,GAAG,cAAc,CAAA;QACpC,IAAI,CAAC,eAAe,GAAG,uBAAuB,CAAC,cAAc,CAAC,CAAA;QAE9D,IAAI,OAAO,IAAI,IAAI,EAAE,CAAC;YACpB,IAAI,CAAC,UAAU,CAAC,OAAO,CAAC,CAAA;YAExB,IAAI,OAAO,OAAO,KAAK,QAAQ,IAAI,OAAO,CAAC,cAAc,EAAE,CAAC;gBAC1D,IAAI,CAAC,cAAc,GAAG,OAAO,CAAC,cAAc,CAAA;YAC9C,CAAC;QACH,CAAC;IACH,CAAC;IAED,wDAAwD;IACxD,UAAU;QACR,OAAO,4BAA4B,CAAA;IACrC,CAAC;IAED;;;OAGG;IACH,UAAU,CAAC,OAA0D;QACnE,MAAM,cAAc,GAAG,IAAI,CAAC,4BAA4B,EAAE,CAAA;QAC1D,oEAAoE;QACpE,IAAI,QAAuB,CAAA;QAC3B,IAAI,OAAO,OAAO,KAAK,QAAQ,EAAE,CAAC;YAChC,QAAQ,GAAG,IAAI,iCAAe,CAAC,EAAE,QAAQ,EAAE,SAAS,EAAE,GAAG,EAAE,OAAO,EAAE,EAAE,IAAI,EAAE;gBAC1E,GAAG,cAAc;gBACjB,yBAAyB,EAAE,IAAA,wDAAsC,EAAC,OAAO,CAAC;aAC3E,CAAC,CAAA;QACJ,CAAC;aAAM,CAAC;YACN,QAAQ,GAAG,IAAA,8BAAY,EAAC,OAAO,EAAE,IAAI,EAAE,cAAc,CAAC,CAAA;QACxD,CAAC;QACD,IAAI,CAAC,aAAa,GAAG,OAAO,CAAC,OAAO,CAAC,QAAQ,CAAC,CAAA;IAChD,CAAC;IAED;;OAEG;IACH,eAAe;QACb,IAAI,CAAC,IAAI,CAAC,eAAe,EAAE,EAAE,CAAC;YAC5B,OAAO,OAAO,CAAC,OAAO,CAAC,IAAI,CAAC,CAAA;QAC9B,CAAC;QAED,IAAI,sBAAsB,GAAG,IAAI,CAAC,sBAAsB,CAAA;QACxD,IAAI,sBAAsB,IAAI,IAAI,EAAE,CAAC;YACnC,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,2CAA2C,CAAC,CAAA;YAC9D,OAAO,sBAAsB,CAAA;QAC/B,CAAC;QAED,MAAM,cAAc,GAAG,GAAG,EAAE,CAAC,CAAC,IAAI,CAAC,sBAAsB,GAAG,IAAI,CAAC,CAAA;QAEjE,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,qBAAqB,CAAC,CAAA;QACxC,sBAAsB,GAAG,IAAI,CAAC,iBAAiB,EAAE;aAC9C,IAAI,CAAC,EAAE,CAAC,EAAE;YACT,cAAc,EAAE,CAAA;YAChB,OAAO,EAAE,CAAA;QACX,CAAC,CAAC;aACD,KAAK,CAAC,CAAC,CAAM,EAAE,EAAE;YAChB,cAAc,EAAE,CAAA;YAChB,IAAI,CAAC,IAAI,CAAC,OAAO,EAAE,CAAC,EAAE,6BAA6B,CAAC,CAAC,CAAC,KAAK,IAAI,CAAC,CAAC,CAAC,QAAQ,EAAE,EAAE,CAAC,CAAA;YAC/E,MAAM,CAAC,CAAA;QACT,CAAC,CAAC,CAAA;QAEJ,IAAI,CAAC,sBAAsB,GAAG,sBAAsB,CAAA;QACpD,OAAO,sBAAsB,CAAA;IAC/B,CAAC;IAEM,eAAe;QACpB,MAAM,SAAS,GAAG,IAAI,CAAC,GAAG,CAAC,UAAU,IAAI,IAAI,CAAC,oBAAoB,CAAA;QAClE,IAAI,CAAC,SAAS,EAAE,CAAC;YACf,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,4FAA4F,CAAC,CAAA;YAC/G,OAAO,KAAK,CAAA;QACd,CAAC;QACD,OAAO,IAAI,CAAA;IACb,CAAC;IAED,qCAAqC;IACrC,wBAAwB,CAAC,oBAA2C;QAClE,OAAO,IAAI,CAAC,eAAe,EAAE,CAAC,IAAI,CAAC,EAAE,CAAC,EAAE;YACtC,IAAI,CAAC,CAAA,EAAE,aAAF,EAAE,uBAAF,EAAE,CAAE,eAAe,CAAA,EAAE,CAAC;gBACzB,IAAI,IAAI,CAAC,OAAO,CAAC,KAAK,IAAI,IAAI,EAAE,CAAC;oBAC/B,IAAI,CAAC,OAAO,CAAC,KAAK,CAAC,0DAA0D,CAAC,CAAA;gBAChF,CAAC;gBACD,OAAO,EAAE,CAAA;YACX,CAAC;YAED,KAAK,EAAE,CAAC,eAAe,CAAC,IAAI,CAAC,GAAG,EAAE;gBAChC,MAAM,mBAAmB,GAAG,UAAU,CAAC,0BAA0B,CAAC,EAAE,CAAC,UAAU,CAAC,OAAO,EAAE,IAAI,CAAC,GAAG,CAAC,IAAI,EAAE,oBAAoB,CAAC,CAAA;gBAC7H,IAAI,CAAC,OAAO,CAAC,UAAU,CAAC,CAAC,YAAY,CAAC,CAAC,mBAAmB,CAAC,CAAC,IAAI,EAAE,CAAA;YACpE,CAAC,CAAC,CAAA;YAEF,OAAO,EAAE,CAAA;QACX,CAAC,CAAC,CAAA;IACJ,CAAC;IAEO,MAAM,CAAC,0BAA0B,CAAC,OAAe,EAAE,OAAe,EAAE,oBAA2C;QACrH,IAAI,oBAAoB,IAAI,IAAI,EAAE,CAAC;YACjC,oBAAoB,GAAG;gBACrB,KAAK,EAAE,kCAAkC;gBACzC,IAAI,EAAE,6FAA6F;aACpG,CAAA;QACH,CAAC;QACD,oBAAoB,GAAG;YACrB,KAAK,EAAE,oBAAoB,CAAC,KAAK,CAAC,OAAO,CAAC,WAAW,EAAE,OAAO,CAAC,CAAC,OAAO,CAAC,WAAW,EAAE,OAAO,CAAC;YAC7F,IAAI,EAAE,oBAAoB,CAAC,IAAI,CAAC,OAAO,CAAC,WAAW,EAAE,OAAO,CAAC,CAAC,OAAO,CAAC,WAAW,EAAE,OAAO,CAAC;SAC5F,CAAA;QACD,OAAO,oBAAoB,CAAA;IAC7B,CAAC;IAEO,KAAK,CAAC,cAAc,CAAC,UAAsB;QACjD,MAAM,oBAAoB,GAAG,UAAU,CAAC,iBAAiB,CAAA;QACzD,IAAI,iBAAiB,GAAG,oBAAoB,CAAA;QAC5C,IAAI,iBAAiB,IAAI,IAAI,EAAE,CAAC;YAC9B,OAAO,IAAI,CAAA;QACb,CAAC;QAED,iBAAiB,GAAG,QAAQ,CAAC,iBAAwB,EAAE,EAAE,CAAC,CAAA;QAC1D,IAAI,KAAK,CAAC,iBAAiB,CAAC,EAAE,CAAC;YAC7B,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,8BAA8B,oBAAoB,EAAE,CAAC,CAAA;YACvE,OAAO,IAAI,CAAA;QACb,CAAC;QAED,0CAA0C;QAC1C,iBAAiB,GAAG,iBAAiB,GAAG,GAAG,CAAA;QAE3C,MAAM,aAAa,GAAG,MAAM,IAAI,CAAC,oBAAoB,CAAC,KAAK,CAAA;QAC3D,MAAM,GAAG,GAAG,2BAAI,CAAC,KAAK,CAAC,aAAa,CAAC,CAAC,YAAY,CAAC,EAAE,CAAC,CAAA;QACtD,MAAM,UAAU,GAAG,GAAG,GAAG,UAAU,CAAA;QACnC,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,uBAAuB,iBAAiB,iBAAiB,UAAU,cAAc,aAAa,EAAE,CAAC,CAAA;QACnH,OAAO,UAAU,GAAG,iBAAiB,CAAA;IACvC,CAAC;IAEO,mBAAmB,CAAC,OAA4B;QACtD,IAAI,IAAI,CAAC,cAAc,IAAI,IAAI,EAAE,CAAC;YAChC,MAAM,CAAC,MAAM,CAAC,OAAO,EAAE,IAAI,CAAC,cAAc,CAAC,CAAA;QAC7C,CAAC;QACD,OAAO,OAAO,CAAA;IAChB,CAAC;IAEO,KAAK,CAAC,iBAAiB,CAAC,UAAsB;QACpD,MAAM,aAAa,GAAG,IAAA,cAAY,EAAC,UAAU,CAAC,OAAO,CAAC,CAAA;QACtD,IAAI,aAAa,IAAI,IAAI,EAAE,CAAC;YAC1B,MAAM,IAAA,+BAAQ,EACZ,wHAAwH,UAAU,CAAC,OAAO,GAAG,EAC7I,6BAA6B,CAC9B,CAAA;QACH,CAAC;QAED,MAAM,cAAc,GAAG,IAAI,CAAC,cAAc,CAAA;QAC1C,IAAI,IAAA,WAAe,EAAC,aAAa,EAAE,cAAc,CAAC,EAAE,CAAC;YACnD,OAAO,KAAK,CAAA;QACd,CAAC;QAED,MAAM,oBAAoB,GAAG,UAAU,aAAV,UAAU,uBAAV,UAAU,CAAE,oBAAoB,CAAA;QAC7D,MAAM,gBAAgB,GAAG,IAAA,YAAO,GAAE,CAAA;QAClC,IAAI,oBAAoB,EAAE,CAAC;YACzB,IAAI,CAAC;gBACH,IAAI,IAAA,WAAiB,EAAC,gBAAgB,EAAE,oBAAoB,CAAC,EAAE,CAAC;oBAC9D,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,sBAAsB,gBAAgB,iDAAiD,oBAAoB,gBAAgB,gBAAgB,EAAE,CAAC,CAAA;oBAChK,OAAO,KAAK,CAAA;gBACd,CAAC;YACH,CAAC;YAAC,OAAO,CAAM,EAAE,CAAC;gBAChB,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,wCAAwC,gBAAgB,6BAA6B,oBAAoB,MAAM,CAAC,CAAC,CAAC,OAAO,IAAI,CAAC,CAAC,CAAC,QAAQ,EAAE,EAAE,CAAC,CAAA;YACjK,CAAC;QACH,CAAC;QAED,MAAM,cAAc,GAAG,MAAM,IAAI,CAAC,cAAc,CAAC,UAAU,CAAC,CAAA;QAC5D,IAAI,CAAC,cAAc,EAAE,CAAC;YACpB,OAAO,KAAK,CAAA;QACd,CAAC;QAED,yFAAyF;QACzF,yFAAyF;QACzF,MAAM,oBAAoB,GAAG,IAAA,WAAoB,EAAC,aAAa,EAAE,cAAc,CAAC,CAAA;QAChF,MAAM,oBAAoB,GAAG,IAAA,WAAiB,EAAC,aAAa,EAAE,cAAc,CAAC,CAAA;QAE7E,IAAI,oBAAoB,EAAE,CAAC;YACzB,OAAO,IAAI,CAAA;QACb,CAAC;QACD,OAAO,IAAI,CAAC,cAAc,IAAI,oBAAoB,CAAA;IACpD,CAAC;IAES,KAAK,CAAC,wBAAwB;QACtC,MAAM,IAAI,CAAC,GAAG,CAAC,SAAS,EAAE,CAAA;QAE1B,IAAI,IAAI,CAAC,aAAa,IAAI,IAAI,EAAE,CAAC;YAC/B,IAAI,CAAC,aAAa,GAAG,IAAI,CAAC,YAAY,CAAC,KAAK,CAAC,IAAI,CAAC,EAAE,CAAC,EAAE,CAAC,IAAA,8BAAY,EAAC,EAAE,EAAE,IAAI,EAAE,IAAI,CAAC,4BAA4B,EAAE,CAAC,CAAC,CAAA;QACtH,CAAC;QAED,MAAM,MAAM,GAAG,MAAM,IAAI,CAAC,aAAa,CAAA;QACvC,MAAM,aAAa,GAAG,MAAM,IAAI,CAAC,oBAAoB,CAAC,KAAK,CAAA;QAC3D,MAAM,CAAC,iBAAiB,CAAC,IAAI,CAAC,mBAAmB,CAAC,EAAE,mBAAmB,EAAE,aAAa,EAAE,CAAC,CAAC,CAAA;QAC1F,OAAO;YACL,IAAI,EAAE,MAAM,MAAM,CAAC,gBAAgB,EAAE;YACrC,QAAQ,EAAE,MAAM;SACjB,CAAA;IACH,CAAC;IAEO,4BAA4B;QAClC,OAAO;YACL,yBAAyB,EAAE,IAAI;YAC/B,QAAQ,EAAE,IAAI,CAAC,gBAAgB,IAAI,IAAI,CAAC,CAAC,CAAE,OAAO,CAAC,QAA6B,CAAC,CAAC,CAAC,IAAI,CAAC,gBAAgB,CAAC,QAAQ;YACjH,QAAQ,EAAE,IAAI,CAAC,YAAY;SAC5B,CAAA;IACH,CAAC;IAEO,KAAK,CAAC,iBAAiB;QAC7B,IAAI,CAAC,IAAI,CAAC,qBAAqB,CAAC,CAAA;QAEhC,MAAM,MAAM,GAAG,MAAM,IAAI,CAAC,wBAAwB,EAAE,CAAA;QACpD,MAAM,UAAU,GAAG,MAAM,CAAC,IAAI,CAAA;QAC9B,IAAI,CAAC,CAAC,MAAM,IAAI,CAAC,iBAAiB,CAAC,UAAU,CAAC,CAAC,EAAE,CAAC;YAChD,IAAI,CAAC,OAAO,CAAC,IAAI,CACf,sBAAsB,IAAI,CAAC,cAAc,CAAC,MAAM,EAAE,sCAAsC,UAAU,CAAC,OAAO,kBACxG,IAAI,CAAC,cAAc,CAAC,CAAC,CAAC,SAAS,CAAC,CAAC,CAAC,YACpC,IAAI,CACL,CAAA;YACD,IAAI,CAAC,IAAI,CAAC,sBAAsB,EAAE,UAAU,CAAC,CAAA;YAC7C,OAAO;gBACL,WAAW,EAAE,UAAU;gBACvB,UAAU;aACX,CAAA;QACH,CAAC;QAED,IAAI,CAAC,qBAAqB,GAAG,MAAM,CAAA;QACnC,IAAI,CAAC,iBAAiB,CAAC,UAAU,CAAC,CAAA;QAElC,MAAM,iBAAiB,GAAG,IAAI,wCAAiB,EAAE,CAAA;QACjD,8BAA8B;QAC9B,OAAO;YACL,WAAW,EAAE,UAAU;YACvB,UAAU;YACV,iBAAiB;YACjB,eAAe,EAAE,IAAI,CAAC,YAAY,CAAC,CAAC,CAAC,IAAI,CAAC,cAAc,CAAC,iBAAiB,CAAC,CAAC,CAAC,CAAC,IAAI;SACnF,CAAA;IACH,CAAC;IAES,iBAAiB,CAAC,UAAsB;QAChD,IAAI,CAAC,OAAO,CAAC,IAAI,CACf,iBAAiB,UAAU,CAAC,OAAO,UAAU,IAAA,8BAAO,EAAC,UAAU,CAAC,KAAK,CAAC;aACnE,GAAG,CAAC,EAAE,CAAC,EAAE,CAAC,EAAE,CAAC,GAAG,CAAC;aACjB,IAAI,CAAC,IAAI,CAAC,GAAG,CACjB,CAAA;QACD,IAAI,CAAC,IAAI,CAAC,kBAAkB,EAAE,UAAU,CAAC,CAAA;IAC3C,CAAC;IAED;;;OAGG;IACH,cAAc,CAAC,oBAAuC,IAAI,wCAAiB,EAAE;QAC3E,MAAM,qBAAqB,GAAG,IAAI,CAAC,qBAAqB,CAAA;QACxD,IAAI,qBAAqB,IAAI,IAAI,EAAE,CAAC;YAClC,MAAM,KAAK,GAAG,IAAI,KAAK,CAAC,2BAA2B,CAAC,CAAA;YACpD,IAAI,CAAC,aAAa,CAAC,KAAK,CAAC,CAAA;YACzB,OAAO,OAAO,CAAC,MAAM,CAAC,KAAK,CAAC,CAAA;QAC9B,CAAC;QAED,IAAI,IAAI,CAAC,eAAe,IAAI,IAAI,EAAE,CAAC;YACjC,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,0CAA0C,CAAC,CAAA;YAC7D,OAAO,IAAI,CAAC,eAAe,CAAA;QAC7B,CAAC;QAED,IAAI,CAAC,OAAO,CAAC,IAAI,CACf,2BAA2B,IAAA,8BAAO,EAAC,qBAAqB,CAAC,IAAI,CAAC,KAAK,CAAC;aACjE,GAAG,CAAC,EAAE,CAAC,EAAE,CAAC,EAAE,CAAC,GAAG,CAAC;aACjB,IAAI,CAAC,IAAI,CAAC,EAAE,CAChB,CAAA;QACD,MAAM,YAAY,GAAG,CAAC,CAAQ,EAAS,EAAE;YACvC,2FAA2F;YAC3F,IAAI,CAAC,CAAC,CAAC,YAAY,wCAAiB,CAAC,EAAE,CAAC;gBACtC,IAAI,CAAC;oBACH,IAAI,CAAC,aAAa,CAAC,CAAC,CAAC,CAAA;gBACvB,CAAC;gBAAC,OAAO,WAAgB,EAAE,CAAC;oBAC1B,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,gCAAgC,WAAW,CAAC,KAAK,IAAI,WAAW,EAAE,CAAC,CAAA;gBACvF,CAAC;YACH,CAAC;YAED,OAAO,CAAC,CAAA;QACV,CAAC,CAAA;QAED,IAAI,CAAC,eAAe,GAAG,IAAI,CAAC,gBAAgB,CAAC;YAC3C,qBAAqB;YACrB,cAAc,EAAE,IAAI,CAAC,qBAAqB,CAAC,qBAAqB,CAAC,QAAQ,CAAC;YAC1E,iBAAiB;YACjB,mBAAmB,EAAE,IAAI,CAAC,mBAAmB;YAC7C,2BAA2B,EAAE,IAAI,CAAC,2BAA2B;SAC9D,CAAC;aACC,KAAK,CAAC,CAAC,CAAM,EAAE,EAAE;YAChB,MAAM,YAAY,CAAC,CAAC,CAAC,CAAA;QACvB,CAAC,CAAC;aACD,OAAO,CAAC,GAAG,EAAE;YACZ,IAAI,CAAC,eAAe,GAAG,IAAI,CAAA;QAC7B,CAAC,CAAC,CAAA;QAEJ,OAAO,IAAI,CAAC,eAAe,CAAA;IAC7B,CAAC;IAES,aAAa,CAAC,CAAQ;QAC9B,IAAI,CAAC,IAAI,CAAC,OAAO,EAAE,CAAC,EAAE,CAAC,CAAC,CAAC,KAAK,IAAI,CAAC,CAAC,CAAC,QAAQ,EAAE,CAAC,CAAA;IAClD,CAAC;IAES,wBAAwB,CAAC,KAA4B;QAC7D,IAAI,CAAC,IAAI,CAAC,wBAAiB,EAAE,KAAK,CAAC,CAAA;IACrC,CAAC;IAiBO,KAAK,CAAC,gBAAgB;QAC5B,IAAI,IAAI,CAAC,oBAAoB,IAAI,IAAI,EAAE,CAAC;YACtC,IAAI,CAAC,oBAAoB,GAAG,IAAI,CAAC,GAAG,CAAC,mBAAmB,CAAA;QAC1D,CAAC;QACD,OAAO,IAAA,cAAI,EAAC,MAAM,IAAA,mBAAQ,EAAC,IAAI,CAAC,oBAAoB,EAAE,OAAO,CAAC,CAAC,CAAA;IACjE,CAAC;IAEO,qBAAqB,CAAC,QAAuB;QACnD,MAAM,wBAAwB,GAAG,QAAQ,CAAC,wBAAwB,CAAA;QAClE,IAAI,wBAAwB,IAAI,IAAI,EAAE,CAAC;YACrC,MAAM,cAAc,GAAG,IAAI,CAAC,cAAc,CAAA;YAC1C,OAAO,cAAc,IAAI,IAAI;gBAC3B,CAAC,CAAC,wBAAwB;gBAC1B,CAAC,CAAC;oBACE,GAAG,wBAAwB;oBAC3B,GAAG,cAAc;iBAClB,CAAA;QACP,CAAC;QACD,OAAO,IAAI,CAAC,mBAAmB,CAAC,EAAE,MAAM,EAAE,KAAK,EAAE,CAAC,CAAA;IACpD,CAAC;IAEO,KAAK,CAAC,wBAAwB;QACpC,MAAM,IAAI,GAAG,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,GAAG,CAAC,YAAY,EAAE,YAAY,CAAC,CAAA;QAC3D,IAAI,CAAC;YACH,MAAM,EAAE,GAAG,MAAM,IAAA,mBAAQ,EAAC,IAAI,EAAE,OAAO,CAAC,CAAA;YACxC,IAAI,2BAAI,CAAC,KAAK,CAAC,EAAE,CAAC,EAAE,CAAC;gBACnB,OAAO,EAAE,CAAA;YACX,CAAC;iBAAM,CAAC;gBACN,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,yDAAyD,EAAE,EAAE,CAAC,CAAA;YAClF,CAAC;QACH,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,IAAI,CAAC,CAAC,IAAI,KAAK,QAAQ,EAAE,CAAC;gBACxB,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,wDAAwD,CAAC,EAAE,CAAC,CAAA;YAChF,CAAC;QACH,CAAC;QAED,MAAM,EAAE,GAAG,2BAAI,CAAC,EAAE,CAAC,IAAA,oBAAW,EAAC,IAAI,CAAC,EAAE,2BAAI,CAAC,GAAG,CAAC,CAAA;QAC/C,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,kCAAkC,EAAE,EAAE,CAAC,CAAA;QACzD,IAAI,CAAC;YACH,MAAM,IAAA,qBAAU,EAAC,IAAI,EAAE,EAAE,CAAC,CAAA;QAC5B,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,uCAAuC,CAAC,EAAE,CAAC,CAAA;QAC/D,CAAC;QACD,OAAO,EAAE,CAAA;IACX,CAAC;IAED,gBAAgB;IAChB,IAAI,iBAAiB;QACnB,MAAM,OAAO,GAAG,IAAI,CAAC,cAAc,CAAA;QACnC,oEAAoE;QACpE,IAAI,OAAO,IAAI,IAAI,EAAE,CAAC;YACpB,OAAO,IAAI,CAAA;QACb,CAAC;QAED,KAAK,MAAM,UAAU,IAAI,MAAM,CAAC,IAAI,CAAC,OAAO,CAAC,EAAE,CAAC;YAC9C,MAAM,CAAC,GAAG,UAAU,CAAC,WAAW,EAAE,CAAA;YAClC,IAAI,CAAC,KAAK,eAAe,IAAI,CAAC,KAAK,eAAe,EAAE,CAAC;gBACnD,OAAO,KAAK,CAAA;YACd,CAAC;QACH,CAAC;QACD,OAAO,IAAI,CAAA;IACb,CAAC;IAQO,KAAK,CAAC,yBAAyB;QACrC,IAAI,MAAM,GAAG,IAAI,CAAC,sBAAsB,CAAA;QACxC,IAAI,MAAM,IAAI,IAAI,EAAE,CAAC;YACnB,MAAM,OAAO,GAAG,CAAC,MAAM,IAAI,CAAC,YAAY,CAAC,KAAK,CAAC,CAAC,mBAAmB,CAAA;YACnE,MAAM,MAAM,GAAG,IAAI,CAAC,OAAO,CAAA;YAC3B,IAAI,OAAO,IAAI,IAAI,EAAE,CAAC;gBACpB,MAAM,CAAC,KAAK,CAAC,+GAA+G,CAAC,CAAA;YAC/H,CAAC;YACD,MAAM,QAAQ,GAAG,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,GAAG,CAAC,aAAa,EAAE,OAAO,IAAI,IAAI,CAAC,GAAG,CAAC,IAAI,CAAC,CAAA;YAC5E,IAAI,MAAM,CAAC,KAAK,IAAI,IAAI,EAAE,CAAC;gBACzB,MAAM,CAAC,KAAK,CAAC,sBAAsB,QAAQ,EAAE,CAAC,CAAA;YAChD,CAAC;YAED,MAAM,GAAG,IAAI,+CAAsB,CAAC,QAAQ,CAAC,CAAA;YAC7C,IAAI,CAAC,sBAAsB,GAAG,MAAM,CAAA;QACtC,CAAC;QACD,OAAO,MAAM,CAAA;IACf,CAAC;IAES,KAAK,CAAC,eAAe,CAAC,WAAiC;QAC/D,MAAM,QAAQ,GAAG,WAAW,CAAC,QAAQ,CAAA;QACrC,MAAM,eAAe,GAAoB;YACvC,OAAO,EAAE,WAAW,CAAC,qBAAqB,CAAC,cAAc;YACzD,iBAAiB,EAAE,WAAW,CAAC,qBAAqB,CAAC,iBAAiB;YACtE,IAAI,EAAG,QAAQ,CAAC,IAAY,CAAC,IAAI;YACjC,MAAM,EAAE,QAAQ,CAAC,IAAI,CAAC,MAAM;SAC7B,CAAA;QAED,IAAI,IAAI,CAAC,aAAa,CAAC,wBAAiB,CAAC,GAAG,CAAC,EAAE,CAAC;YAC9C,eAAe,CAAC,UAAU,GAAG,EAAE,CAAC,EAAE,CAAC,IAAI,CAAC,IAAI,CAAC,wBAAiB,EAAE,EAAE,CAAC,CAAA;QACrE,CAAC;QAED,MAAM,UAAU,GAAG,WAAW,CAAC,qBAAqB,CAAC,qBAAqB,CAAC,IAAI,CAAA;QAC/E,MAAM,OAAO,GAAG,UAAU,CAAC,OAAO,CAAA;QAClC,MAAM,WAAW,GAAG,QAAQ,CAAC,WAAW,CAAA;QAExC,SAAS,sBAAsB;YAC7B,0CAA0C;YAC1C,MAAM,OAAO,GAAG,kBAAkB,CAAC,WAAW,CAAC,QAAQ,CAAC,GAAG,CAAC,QAAQ,CAAC,CAAA;YACrE,IAAI,OAAO,CAAC,QAAQ,CAAC,IAAI,WAAW,CAAC,aAAa,EAAE,CAAC,EAAE,CAAC;gBACtD,OAAO,IAAI,CAAC,QAAQ,CAAC,OAAO,CAAC,CAAA;YAC/B,CAAC;iBAAM,CAAC;gBACN,kCAAkC;gBAClC,OAAO,WAAW,CAAC,QAAQ,CAAC,IAAI,CAAC,GAAG,CAAA;YACtC,CAAC;QACH,CAAC;QAED,MAAM,sBAAsB,GAAG,MAAM,IAAI,CAAC,yBAAyB,EAAE,CAAA;QACrE,MAAM,QAAQ,GAAG,sBAAsB,CAAC,wBAAwB,CAAA;QAChE,MAAM,IAAA,gBAAK,EAAC,QAAQ,EAAE,EAAE,SAAS,EAAE,IAAI,EAAE,CAAC,CAAA;QAC1C,MAAM,cAAc,GAAG,sBAAsB,EAAE,CAAA;QAC/C,IAAI,UAAU,GAAG,IAAI,CAAC,IAAI,CAAC,QAAQ,EAAE,cAAc,CAAC,CAAA;QACpD,MAAM,WAAW,GAAG,WAAW,IAAI,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,IAAI,CAAC,QAAQ,EAAE,WAAW,OAAO,GAAG,IAAI,CAAC,OAAO,CAAC,WAAW,CAAC,IAAI,CAAC,IAAI,KAAK,EAAE,CAAC,CAAA;QAEpI,MAAM,IAAI,GAAG,KAAK,EAAE,WAAoB,EAAE,EAAE;YAC1C,MAAM,sBAAsB,CAAC,iBAAiB,CAAC,UAAU,EAAE,WAAW,EAAE,UAAU,EAAE,QAAQ,EAAE,cAAc,EAAE,WAAW,CAAC,CAAA;YAC1H,MAAM,WAAW,CAAC,IAAK,CAAC;gBACtB,GAAG,UAAU;gBACb,cAAc,EAAE,UAAU;aAC3B,CAAC,CAAA;YACF,OAAO,WAAW,IAAI,IAAI,CAAC,CAAC,CAAC,CAAC,UAAU,CAAC,CAAC,CAAC,CAAC,CAAC,UAAU,EAAE,WAAW,CAAC,CAAA;QACvE,CAAC,CAAA;QAED,MAAM,GAAG,GAAG,IAAI,CAAC,OAAO,CAAA;QACxB,MAAM,gBAAgB,GAAG,MAAM,sBAAsB,CAAC,sBAAsB,CAAC,UAAU,EAAE,UAAU,EAAE,QAAQ,EAAE,GAAG,CAAC,CAAA;QACnH,IAAI,gBAAgB,IAAI,IAAI,EAAE,CAAC;YAC7B,UAAU,GAAG,gBAAgB,CAAA;YAC7B,OAAO,MAAM,IAAI,CAAC,KAAK,CAAC,CAAA;QAC1B,CAAC;QAED,MAAM,eAAe,GAAG,KAAK,IAAI,EAAE;YACjC,MAAM,sBAAsB,CAAC,KAAK,EAAE,CAAC,KAAK,CAAC,GAAG,EAAE;gBAC9C,SAAS;YACX,CAAC,CAAC,CAAA;YACF,OAAO,MAAM,IAAA,iBAAM,EAAC,UAAU,CAAC,CAAC,KAAK,CAAC,GAAG,EAAE;gBACzC,SAAS;YACX,CAAC,CAAC,CAAA;QACJ,CAAC,CAAA;QAED,MAAM,cAAc,GAAG,MAAM,IAAA,6CAAoB,EAAC,QAAQ,cAAc,EAAE,EAAE,QAAQ,EAAE,GAAG,CAAC,CAAA;QAC1F,IAAI,CAAC;YACH,MAAM,WAAW,CAAC,IAAI,CAAC,cAAc,EAAE,eAAe,EAAE,WAAW,EAAE,eAAe,CAAC,CAAA;YACrF,MAAM,IAAA,4BAAK,EACT,GAAG,EAAE,CAAC,IAAA,iBAAM,EAAC,cAAc,EAAE,UAAU,CAAC,EACxC,EAAE,EACF,GAAG,EACH,CAAC,EACD,CAAC,EACD,KAAK,CAAC,EAAE,CAAC,KAAK,YAAY,KAAK,IAAI,SAAS,CAAC,IAAI,CAAC,KAAK,CAAC,OAAO,CAAC,CACjE,CAAA;QACH,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,MAAM,eAAe,EAAE,CAAA;YAEvB,IAAI,CAAC,YAAY,wCAAiB,EAAE,CAAC;gBACnC,GAAG,CAAC,IAAI,CAAC,WAAW,CAAC,CAAA;gBACrB,IAAI,CAAC,IAAI,CAAC,kBAAkB,EAAE,UAAU,CAAC,CAAA;YAC3C,CAAC;YACD,MAAM,CAAC,CAAA;QACT,CAAC;QAED,GAAG,CAAC,IAAI,CAAC,eAAe,OAAO,2BAA2B,UAAU,EAAE,CAAC,CAAA;QACvE,OAAO,MAAM,IAAI,CAAC,IAAI,CAAC,CAAA;IACzB,CAAC;IACS,KAAK,CAAC,6BAA6B,CAC3C,QAAgC,EAChC,qBAA4C,EAC5C,aAAqB,EACrB,QAAuB,EACvB,oBAA4B;QAE5B,IAAI,CAAC;YACH,IAAI,IAAI,CAAC,gBAAgB,IAAI,IAAI,IAAI,CAAC,IAAI,CAAC,gBAAgB,CAAC,yBAAyB,EAAE,CAAC;gBACtF,OAAO,IAAI,CAAA;YACb,CAAC;YACD,MAAM,gBAAgB,GAAG,IAAA,oBAAa,EAAC,QAAQ,CAAC,GAAG,EAAE,IAAI,CAAC,GAAG,CAAC,OAAO,EAAE,qBAAqB,CAAC,qBAAqB,CAAC,IAAI,CAAC,OAAO,CAAC,CAAA;YAChI,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,8BAA8B,gBAAgB,CAAC,CAAC,CAAC,WAAW,gBAAgB,CAAC,CAAC,CAAC,GAAG,CAAC,CAAA;YAErG,MAAM,gBAAgB,GAAG,KAAK,EAAE,GAAQ,EAAqB,EAAE;gBAC7D,MAAM,IAAI,GAAG,MAAM,IAAI,CAAC,YAAY,CAAC,gBAAgB,CAAC,GAAG,EAAE;oBACzD,OAAO,EAAE,qBAAqB,CAAC,cAAc;oBAC7C,iBAAiB,EAAE,qBAAqB,CAAC,iBAAiB;iBAC3D,CAAC,CAAA;gBAEF,IAAI,IAAI,IAAI,IAAI,IAAI,IAAI,CAAC,MAAM,KAAK,CAAC,EAAE,CAAC;oBACtC,MAAM,IAAI,KAAK,CAAC,aAAa,GAAG,CAAC,IAAI,YAAY,CAAC,CAAA;gBACpD,CAAC;gBAED,IAAI,CAAC;oBACH,OAAO,IAAI,CAAC,KAAK,CAAC,IAAA,iBAAU,EAAC,IAAI,CAAC,CAAC,QAAQ,EAAE,CAAC,CAAA;gBAChD,CAAC;gBAAC,OAAO,CAAM,EAAE,CAAC;oBAChB,MAAM,IAAI,KAAK,CAAC,0BAA0B,GAAG,CAAC,IAAI,aAAa,CAAC,EAAE,CAAC,CAAA;gBACrE,CAAC;YACH,CAAC,CAAA;YAED,MAAM,eAAe,GAAkC;gBACrD,MAAM,EAAE,QAAQ,CAAC,GAAG;gBACpB,OAAO,EAAE,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,sBAAuB,CAAC,QAAQ,EAAE,oBAAoB,CAAC;gBAC/E,MAAM,EAAE,IAAI,CAAC,OAAO;gBACpB,OAAO,EAAE,aAAa;gBACtB,yBAAyB,EAAE,QAAQ,CAAC,yBAAyB;gBAC7D,cAAc,EAAE,qBAAqB,CAAC,cAAc;gBACpD,iBAAiB,EAAE,qBAAqB,CAAC,iBAAiB;aAC3D,CAAA;YAED,IAAI,IAAI,CAAC,aAAa,CAAC,wBAAiB,CAAC,GAAG,CAAC,EAAE,CAAC;gBAC9C,eAAe,CAAC,UAAU,GAAG,EAAE,CAAC,EAAE,CAAC,IAAI,CAAC,IAAI,CAAC,wBAAiB,EAAE,EAAE,CAAC,CAAA;YACrE,CAAC;YAED,MAAM,gBAAgB,GAAG,MAAM,OAAO,CAAC,GAAG,CAAC,gBAAgB,CAAC,GAAG,CAAC,CAAC,CAAC,EAAE,CAAC,gBAAgB,CAAC,CAAC,CAAC,CAAC,CAAC,CAAA;YAC1F,MAAM,IAAI,6DAA6B,CAAC,QAAQ,CAAC,IAAI,EAAE,IAAI,CAAC,YAAY,EAAE,eAAe,CAAC,CAAC,QAAQ,CAAC,gBAAgB,CAAC,CAAC,CAAC,EAAE,gBAAgB,CAAC,CAAC,CAAC,CAAC,CAAA;YAC7I,OAAO,KAAK,CAAA;QACd,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,IAAI,CAAC,OAAO,CAAC,KAAK,CAAC,8DAA8D,CAAC,CAAC,KAAK,IAAI,CAAC,EAAE,CAAC,CAAA;YAChG,IAAI,IAAI,CAAC,gBAAgB,IAAI,IAAI,EAAE,CAAC;gBAClC,YAAY;gBACZ,MAAM,CAAC,CAAA;YACT,CAAC;YACD,OAAO,IAAI,CAAA;QACb,CAAC;IACH,CAAC;CACF;AAruBD,gCAquBC;AAUD,SAAS,uBAAuB,CAAC,OAAe;IAC9C,MAAM,0BAA0B,GAAG,IAAA,mBAA4B,EAAC,OAAO,CAAC,CAAA;IACxE,OAAO,0BAA0B,IAAI,IAAI,IAAI,0BAA0B,CAAC,MAAM,GAAG,CAAC,CAAA;AACpF,CAAC;AAED,eAAe;AACf,MAAa,UAAU;IACrB,6DAA6D;IAC7D,IAAI,CAAC,OAAa;QAChB,SAAS;IACX,CAAC;IAED,6DAA6D;IAC7D,IAAI,CAAC,OAAa;QAChB,SAAS;IACX,CAAC;IAED,6DAA6D;IAC7D,KAAK,CAAC,OAAa;QACjB,SAAS;IACX,CAAC;CACF;AAfD,gCAeC","sourcesContent":["import {\n  AllPublishOptions,\n  asArray,\n  CancellationToken,\n  newError,\n  PublishConfiguration,\n  UpdateInfo,\n  UUID,\n  DownloadOptions,\n  CancellationError,\n  ProgressInfo,\n  BlockMap,\n  retry,\n} from \"builder-util-runtime\"\nimport { randomBytes } from \"crypto\"\nimport { release } from \"os\"\nimport { EventEmitter } from \"events\"\nimport { mkdir, outputFile, readFile, rename, unlink } from \"fs-extra\"\nimport { OutgoingHttpHeaders } from \"http\"\nimport { load } from \"js-yaml\"\nimport { Lazy } from \"lazy-val\"\nimport * as path from \"path\"\nimport { eq as isVersionsEqual, gt as isVersionGreaterThan, lt as isVersionLessThan, parse as parseVersion, prerelease as getVersionPreleaseComponents, SemVer } from \"semver\"\nimport { AppAdapter } from \"./AppAdapter\"\nimport { createTempUpdateFile, DownloadedUpdateHelper } from \"./DownloadedUpdateHelper\"\nimport { ElectronAppAdapter } from \"./ElectronAppAdapter\"\nimport { ElectronHttpExecutor, getNetSession, LoginCallback } from \"./electronHttpExecutor\"\nimport { GenericProvider } from \"./providers/GenericProvider\"\nimport { DOWNLOAD_PROGRESS, Logger, Provider, ResolvedUpdateFileInfo, UPDATE_DOWNLOADED, UpdateCheckResult, UpdateDownloadedEvent, UpdaterSignal } from \"./main\"\nimport { createClient, isUrlProbablySupportMultiRangeRequests } from \"./providerFactory\"\nimport { ProviderPlatform } from \"./providers/Provider\"\nimport type { TypedEmitter } from \"tiny-typed-emitter\"\nimport Session = Electron.Session\nimport type { AuthInfo } from \"electron\"\nimport { gunzipSync } from \"zlib\"\nimport { blockmapFiles } from \"./util\"\nimport { DifferentialDownloaderOptions } from \"./differentialDownloader/DifferentialDownloader\"\nimport { GenericDifferentialDownloader } from \"./differentialDownloader/GenericDifferentialDownloader\"\n\nexport type AppUpdaterEvents = {\n  error: (error: Error, message?: string) => void\n  login: (info: AuthInfo, callback: LoginCallback) => void\n  \"checking-for-update\": () => void\n  \"update-not-available\": (info: UpdateInfo) => void\n  \"update-available\": (info: UpdateInfo) => void\n  \"update-downloaded\": (event: UpdateDownloadedEvent) => void\n  \"download-progress\": (info: ProgressInfo) => void\n  \"update-cancelled\": (info: UpdateInfo) => void\n  \"appimage-filename-updated\": (path: string) => void\n}\n\nexport abstract class AppUpdater extends (EventEmitter as new () => TypedEmitter<AppUpdaterEvents>) {\n  /**\n   * Whether to automatically download an update when it is found.\n   */\n  autoDownload = true\n\n  /**\n   * Whether to automatically install a downloaded update on app quit (if `quitAndInstall` was not called before).\n   */\n  autoInstallOnAppQuit = true\n\n  /**\n   * *windows-only* Whether to run the app after finish install when run the installer NOT in silent mode.\n   * @default true\n   */\n  autoRunAppAfterInstall = true\n\n  /**\n   * *GitHub provider only.* Whether to allow update to pre-release versions. Defaults to `true` if application version contains prerelease components (e.g. `0.12.1-alpha.1`, here `alpha` is a prerelease component), otherwise `false`.\n   *\n   * If `true`, downgrade will be allowed (`allowDowngrade` will be set to `true`).\n   */\n  allowPrerelease = false\n\n  /**\n   * *GitHub provider only.* Get all release notes (from current version to latest), not just the latest.\n   * @default false\n   */\n  fullChangelog = false\n\n  /**\n   * Whether to allow version downgrade (when a user from the beta channel wants to go back to the stable channel).\n   *\n   * Taken in account only if channel differs (pre-release version component in terms of semantic versioning).\n   *\n   * @default false\n   */\n  allowDowngrade = false\n\n  /**\n   * Web installer files might not have signature verification, this switch prevents to load them unless it is needed.\n   *\n   * Currently false to prevent breaking the current API, but it should be changed to default true at some point that\n   * breaking changes are allowed.\n   *\n   * @default false\n   */\n  disableWebInstaller = false\n\n  /**\n   * *NSIS only* Disable differential downloads and always perform full download of installer.\n   *\n   * @default false\n   */\n  disableDifferentialDownload = false\n\n  /**\n   * Allows developer to force the updater to work in \"dev\" mode, looking for \"dev-app-update.yml\" instead of \"app-update.yml\"\n   * Dev: `path.join(this.app.getAppPath(), \"dev-app-update.yml\")`\n   * Prod: `path.join(process.resourcesPath!, \"app-update.yml\")`\n   *\n   * @default false\n   */\n  forceDevUpdateConfig = false\n\n  /**\n   * The current application version.\n   */\n  readonly currentVersion: SemVer\n\n  private _channel: string | null = null\n\n  protected downloadedUpdateHelper: DownloadedUpdateHelper | null = null\n\n  /**\n   * Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.\n   */\n  get channel(): string | null {\n    return this._channel\n  }\n\n  /**\n   * Set the update channel. Overrides `channel` in the update configuration.\n   *\n   * `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.\n   */\n  set channel(value: string | null) {\n    if (this._channel != null) {\n      // noinspection SuspiciousTypeOfGuard\n      if (typeof value !== \"string\") {\n        throw newError(`Channel must be a string, but got: ${value}`, \"ERR_UPDATER_INVALID_CHANNEL\")\n      } else if (value.length === 0) {\n        throw newError(`Channel must be not an empty string`, \"ERR_UPDATER_INVALID_CHANNEL\")\n      }\n    }\n\n    this._channel = value\n    this.allowDowngrade = true\n  }\n\n  /**\n   *  The request headers.\n   */\n  requestHeaders: OutgoingHttpHeaders | null = null\n\n  /**\n   *  Shortcut for explicitly adding auth tokens to request headers\n   */\n  addAuthHeader(token: string) {\n    this.requestHeaders = Object.assign({}, this.requestHeaders, {\n      authorization: token,\n    })\n  }\n\n  protected _logger: Logger = console\n\n  // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols\n  get netSession(): Session {\n    return getNetSession()\n  }\n\n  /**\n   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.\n   * Set it to `null` if you would like to disable a logging feature.\n   */\n  get logger(): Logger | null {\n    return this._logger\n  }\n\n  set logger(value: Logger | null) {\n    this._logger = value == null ? new NoOpLogger() : value\n  }\n\n  // noinspection JSUnusedGlobalSymbols\n  /**\n   * For type safety you can use signals, e.g. `autoUpdater.signals.updateDownloaded(() => {})` instead of `autoUpdater.on('update-available', () => {})`\n   */\n  readonly signals = new UpdaterSignal(this)\n\n  private _appUpdateConfigPath: string | null = null\n\n  // noinspection JSUnusedGlobalSymbols\n  /**\n   * test only\n   * @private\n   */\n  set updateConfigPath(value: string | null) {\n    this.clientPromise = null\n    this._appUpdateConfigPath = value\n    this.configOnDisk = new Lazy<any>(() => this.loadUpdateConfig())\n  }\n\n  private clientPromise: Promise<Provider<any>> | null = null\n\n  protected readonly stagingUserIdPromise = new Lazy<string>(() => this.getOrCreateStagingUserId())\n\n  // public, allow to read old config for anyone\n  /** @internal */\n  configOnDisk = new Lazy<any>(() => this.loadUpdateConfig())\n\n  private checkForUpdatesPromise: Promise<UpdateCheckResult> | null = null\n  private downloadPromise: Promise<Array<string>> | null = null\n\n  protected readonly app: AppAdapter\n\n  protected updateInfoAndProvider: UpdateInfoAndProvider | null = null\n\n  /** @internal */\n  readonly httpExecutor: ElectronHttpExecutor\n\n  protected constructor(options: AllPublishOptions | null | undefined, app?: AppAdapter) {\n    super()\n\n    this.on(\"error\", (error: Error) => {\n      this._logger.error(`Error: ${error.stack || error.message}`)\n    })\n\n    if (app == null) {\n      this.app = new ElectronAppAdapter()\n      this.httpExecutor = new ElectronHttpExecutor((authInfo, callback) => this.emit(\"login\", authInfo, callback))\n    } else {\n      this.app = app\n      this.httpExecutor = null as any\n    }\n\n    const currentVersionString = this.app.version\n    const currentVersion = parseVersion(currentVersionString)\n    if (currentVersion == null) {\n      throw newError(`App version is not a valid semver version: \"${currentVersionString}\"`, \"ERR_UPDATER_INVALID_VERSION\")\n    }\n    this.currentVersion = currentVersion\n    this.allowPrerelease = hasPrereleaseComponents(currentVersion)\n\n    if (options != null) {\n      this.setFeedURL(options)\n\n      if (typeof options !== \"string\" && options.requestHeaders) {\n        this.requestHeaders = options.requestHeaders\n      }\n    }\n  }\n\n  //noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols\n  getFeedURL(): string | null | undefined {\n    return \"Deprecated. Do not use it.\"\n  }\n\n  /**\n   * Configure update provider. If value is `string`, [GenericServerOptions](./publish.md#genericserveroptions) will be set with value as `url`.\n   * @param options If you want to override configuration in the `app-update.yml`.\n   */\n  setFeedURL(options: PublishConfiguration | AllPublishOptions | string) {\n    const runtimeOptions = this.createProviderRuntimeOptions()\n    // https://github.com/electron-userland/electron-builder/issues/1105\n    let provider: Provider<any>\n    if (typeof options === \"string\") {\n      provider = new GenericProvider({ provider: \"generic\", url: options }, this, {\n        ...runtimeOptions,\n        isUseMultipleRangeRequest: isUrlProbablySupportMultiRangeRequests(options),\n      })\n    } else {\n      provider = createClient(options, this, runtimeOptions)\n    }\n    this.clientPromise = Promise.resolve(provider)\n  }\n\n  /**\n   * Asks the server whether there is an update.\n   */\n  checkForUpdates(): Promise<UpdateCheckResult | null> {\n    if (!this.isUpdaterActive()) {\n      return Promise.resolve(null)\n    }\n\n    let checkForUpdatesPromise = this.checkForUpdatesPromise\n    if (checkForUpdatesPromise != null) {\n      this._logger.info(\"Checking for update (already in progress)\")\n      return checkForUpdatesPromise\n    }\n\n    const nullizePromise = () => (this.checkForUpdatesPromise = null)\n\n    this._logger.info(\"Checking for update\")\n    checkForUpdatesPromise = this.doCheckForUpdates()\n      .then(it => {\n        nullizePromise()\n        return it\n      })\n      .catch((e: any) => {\n        nullizePromise()\n        this.emit(\"error\", e, `Cannot check for updates: ${(e.stack || e).toString()}`)\n        throw e\n      })\n\n    this.checkForUpdatesPromise = checkForUpdatesPromise\n    return checkForUpdatesPromise\n  }\n\n  public isUpdaterActive(): boolean {\n    const isEnabled = this.app.isPackaged || this.forceDevUpdateConfig\n    if (!isEnabled) {\n      this._logger.info(\"Skip checkForUpdates because application is not packed and dev update config is not forced\")\n      return false\n    }\n    return true\n  }\n\n  // noinspection JSUnusedGlobalSymbols\n  checkForUpdatesAndNotify(downloadNotification?: DownloadNotification): Promise<UpdateCheckResult | null> {\n    return this.checkForUpdates().then(it => {\n      if (!it?.downloadPromise) {\n        if (this._logger.debug != null) {\n          this._logger.debug(\"checkForUpdatesAndNotify called, downloadPromise is null\")\n        }\n        return it\n      }\n\n      void it.downloadPromise.then(() => {\n        const notificationContent = AppUpdater.formatDownloadNotification(it.updateInfo.version, this.app.name, downloadNotification)\n        new (require(\"electron\").Notification)(notificationContent).show()\n      })\n\n      return it\n    })\n  }\n\n  private static formatDownloadNotification(version: string, appName: string, downloadNotification?: DownloadNotification): DownloadNotification {\n    if (downloadNotification == null) {\n      downloadNotification = {\n        title: \"A new update is ready to install\",\n        body: `{appName} version {version} has been downloaded and will be automatically installed on exit`,\n      }\n    }\n    downloadNotification = {\n      title: downloadNotification.title.replace(\"{appName}\", appName).replace(\"{version}\", version),\n      body: downloadNotification.body.replace(\"{appName}\", appName).replace(\"{version}\", version),\n    }\n    return downloadNotification\n  }\n\n  private async isStagingMatch(updateInfo: UpdateInfo): Promise<boolean> {\n    const rawStagingPercentage = updateInfo.stagingPercentage\n    let stagingPercentage = rawStagingPercentage\n    if (stagingPercentage == null) {\n      return true\n    }\n\n    stagingPercentage = parseInt(stagingPercentage as any, 10)\n    if (isNaN(stagingPercentage)) {\n      this._logger.warn(`Staging percentage is NaN: ${rawStagingPercentage}`)\n      return true\n    }\n\n    // convert from user 0-100 to internal 0-1\n    stagingPercentage = stagingPercentage / 100\n\n    const stagingUserId = await this.stagingUserIdPromise.value\n    const val = UUID.parse(stagingUserId).readUInt32BE(12)\n    const percentage = val / 0xffffffff\n    this._logger.info(`Staging percentage: ${stagingPercentage}, percentage: ${percentage}, user id: ${stagingUserId}`)\n    return percentage < stagingPercentage\n  }\n\n  private computeFinalHeaders(headers: OutgoingHttpHeaders) {\n    if (this.requestHeaders != null) {\n      Object.assign(headers, this.requestHeaders)\n    }\n    return headers\n  }\n\n  private async isUpdateAvailable(updateInfo: UpdateInfo): Promise<boolean> {\n    const latestVersion = parseVersion(updateInfo.version)\n    if (latestVersion == null) {\n      throw newError(\n        `This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: \"${updateInfo.version}\"`,\n        \"ERR_UPDATER_INVALID_VERSION\"\n      )\n    }\n\n    const currentVersion = this.currentVersion\n    if (isVersionsEqual(latestVersion, currentVersion)) {\n      return false\n    }\n\n    const minimumSystemVersion = updateInfo?.minimumSystemVersion\n    const currentOSVersion = release()\n    if (minimumSystemVersion) {\n      try {\n        if (isVersionLessThan(currentOSVersion, minimumSystemVersion)) {\n          this._logger.info(`Current OS version ${currentOSVersion} is less than the minimum OS version required ${minimumSystemVersion} for version ${currentOSVersion}`)\n          return false\n        }\n      } catch (e: any) {\n        this._logger.warn(`Failed to compare current OS version(${currentOSVersion}) with minimum OS version(${minimumSystemVersion}): ${(e.message || e).toString()}`)\n      }\n    }\n\n    const isStagingMatch = await this.isStagingMatch(updateInfo)\n    if (!isStagingMatch) {\n      return false\n    }\n\n    // https://github.com/electron-userland/electron-builder/pull/3111#issuecomment-405033227\n    // https://github.com/electron-userland/electron-builder/pull/3111#issuecomment-405030797\n    const isLatestVersionNewer = isVersionGreaterThan(latestVersion, currentVersion)\n    const isLatestVersionOlder = isVersionLessThan(latestVersion, currentVersion)\n\n    if (isLatestVersionNewer) {\n      return true\n    }\n    return this.allowDowngrade && isLatestVersionOlder\n  }\n\n  protected async getUpdateInfoAndProvider(): Promise<UpdateInfoAndProvider> {\n    await this.app.whenReady()\n\n    if (this.clientPromise == null) {\n      this.clientPromise = this.configOnDisk.value.then(it => createClient(it, this, this.createProviderRuntimeOptions()))\n    }\n\n    const client = await this.clientPromise\n    const stagingUserId = await this.stagingUserIdPromise.value\n    client.setRequestHeaders(this.computeFinalHeaders({ \"x-user-staging-id\": stagingUserId }))\n    return {\n      info: await client.getLatestVersion(),\n      provider: client,\n    }\n  }\n\n  private createProviderRuntimeOptions() {\n    return {\n      isUseMultipleRangeRequest: true,\n      platform: this._testOnlyOptions == null ? (process.platform as ProviderPlatform) : this._testOnlyOptions.platform,\n      executor: this.httpExecutor,\n    }\n  }\n\n  private async doCheckForUpdates(): Promise<UpdateCheckResult> {\n    this.emit(\"checking-for-update\")\n\n    const result = await this.getUpdateInfoAndProvider()\n    const updateInfo = result.info\n    if (!(await this.isUpdateAvailable(updateInfo))) {\n      this._logger.info(\n        `Update for version ${this.currentVersion.format()} is not available (latest version: ${updateInfo.version}, downgrade is ${\n          this.allowDowngrade ? \"allowed\" : \"disallowed\"\n        }).`\n      )\n      this.emit(\"update-not-available\", updateInfo)\n      return {\n        versionInfo: updateInfo,\n        updateInfo,\n      }\n    }\n\n    this.updateInfoAndProvider = result\n    this.onUpdateAvailable(updateInfo)\n\n    const cancellationToken = new CancellationToken()\n    //noinspection ES6MissingAwait\n    return {\n      versionInfo: updateInfo,\n      updateInfo,\n      cancellationToken,\n      downloadPromise: this.autoDownload ? this.downloadUpdate(cancellationToken) : null,\n    }\n  }\n\n  protected onUpdateAvailable(updateInfo: UpdateInfo): void {\n    this._logger.info(\n      `Found version ${updateInfo.version} (url: ${asArray(updateInfo.files)\n        .map(it => it.url)\n        .join(\", \")})`\n    )\n    this.emit(\"update-available\", updateInfo)\n  }\n\n  /**\n   * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.\n   * @returns {Promise<Array<string>>} Paths to downloaded files.\n   */\n  downloadUpdate(cancellationToken: CancellationToken = new CancellationToken()): Promise<Array<string>> {\n    const updateInfoAndProvider = this.updateInfoAndProvider\n    if (updateInfoAndProvider == null) {\n      const error = new Error(\"Please check update first\")\n      this.dispatchError(error)\n      return Promise.reject(error)\n    }\n\n    if (this.downloadPromise != null) {\n      this._logger.info(\"Downloading update (already in progress)\")\n      return this.downloadPromise\n    }\n\n    this._logger.info(\n      `Downloading update from ${asArray(updateInfoAndProvider.info.files)\n        .map(it => it.url)\n        .join(\", \")}`\n    )\n    const errorHandler = (e: Error): Error => {\n      // https://github.com/electron-userland/electron-builder/issues/1150#issuecomment-436891159\n      if (!(e instanceof CancellationError)) {\n        try {\n          this.dispatchError(e)\n        } catch (nestedError: any) {\n          this._logger.warn(`Cannot dispatch error event: ${nestedError.stack || nestedError}`)\n        }\n      }\n\n      return e\n    }\n\n    this.downloadPromise = this.doDownloadUpdate({\n      updateInfoAndProvider,\n      requestHeaders: this.computeRequestHeaders(updateInfoAndProvider.provider),\n      cancellationToken,\n      disableWebInstaller: this.disableWebInstaller,\n      disableDifferentialDownload: this.disableDifferentialDownload,\n    })\n      .catch((e: any) => {\n        throw errorHandler(e)\n      })\n      .finally(() => {\n        this.downloadPromise = null\n      })\n\n    return this.downloadPromise\n  }\n\n  protected dispatchError(e: Error): void {\n    this.emit(\"error\", e, (e.stack || e).toString())\n  }\n\n  protected dispatchUpdateDownloaded(event: UpdateDownloadedEvent): void {\n    this.emit(UPDATE_DOWNLOADED, event)\n  }\n\n  protected abstract doDownloadUpdate(downloadUpdateOptions: DownloadUpdateOptions): Promise<Array<string>>\n\n  /**\n   * Restarts the app and installs the update after it has been downloaded.\n   * It should only be called after `update-downloaded` has been emitted.\n   *\n   * **Note:** `autoUpdater.quitAndInstall()` will close all application windows first and only emit `before-quit` event on `app` after that.\n   * This is different from the normal quit event sequence.\n   *\n   * @param isSilent *windows-only* Runs the installer in silent mode. Defaults to `false`.\n   * @param isForceRunAfter Run the app after finish even on silent install. Not applicable for macOS.\n   * Ignored if `isSilent` is set to `false`(In this case you can still set `autoRunAppAfterInstall` to `false` to prevent run the app after finish).\n   */\n  abstract quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void\n\n  private async loadUpdateConfig(): Promise<any> {\n    if (this._appUpdateConfigPath == null) {\n      this._appUpdateConfigPath = this.app.appUpdateConfigPath\n    }\n    return load(await readFile(this._appUpdateConfigPath, \"utf-8\"))\n  }\n\n  private computeRequestHeaders(provider: Provider<any>): OutgoingHttpHeaders {\n    const fileExtraDownloadHeaders = provider.fileExtraDownloadHeaders\n    if (fileExtraDownloadHeaders != null) {\n      const requestHeaders = this.requestHeaders\n      return requestHeaders == null\n        ? fileExtraDownloadHeaders\n        : {\n            ...fileExtraDownloadHeaders,\n            ...requestHeaders,\n          }\n    }\n    return this.computeFinalHeaders({ accept: \"*/*\" })\n  }\n\n  private async getOrCreateStagingUserId(): Promise<string> {\n    const file = path.join(this.app.userDataPath, \".updaterId\")\n    try {\n      const id = await readFile(file, \"utf-8\")\n      if (UUID.check(id)) {\n        return id\n      } else {\n        this._logger.warn(`Staging user id file exists, but content was invalid: ${id}`)\n      }\n    } catch (e: any) {\n      if (e.code !== \"ENOENT\") {\n        this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${e}`)\n      }\n    }\n\n    const id = UUID.v5(randomBytes(4096), UUID.OID)\n    this._logger.info(`Generated new staging user ID: ${id}`)\n    try {\n      await outputFile(file, id)\n    } catch (e: any) {\n      this._logger.warn(`Couldn't write out staging user ID: ${e}`)\n    }\n    return id\n  }\n\n  /** @internal */\n  get isAddNoCacheQuery(): boolean {\n    const headers = this.requestHeaders\n    // https://github.com/electron-userland/electron-builder/issues/3021\n    if (headers == null) {\n      return true\n    }\n\n    for (const headerName of Object.keys(headers)) {\n      const s = headerName.toLowerCase()\n      if (s === \"authorization\" || s === \"private-token\") {\n        return false\n      }\n    }\n    return true\n  }\n\n  /**\n   * @private\n   * @internal\n   */\n  _testOnlyOptions: TestOnlyUpdaterOptions | null = null\n\n  private async getOrCreateDownloadHelper(): Promise<DownloadedUpdateHelper> {\n    let result = this.downloadedUpdateHelper\n    if (result == null) {\n      const dirName = (await this.configOnDisk.value).updaterCacheDirName\n      const logger = this._logger\n      if (dirName == null) {\n        logger.error(\"updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?\")\n      }\n      const cacheDir = path.join(this.app.baseCachePath, dirName || this.app.name)\n      if (logger.debug != null) {\n        logger.debug(`updater cache dir: ${cacheDir}`)\n      }\n\n      result = new DownloadedUpdateHelper(cacheDir)\n      this.downloadedUpdateHelper = result\n    }\n    return result\n  }\n\n  protected async executeDownload(taskOptions: DownloadExecutorTask): Promise<Array<string>> {\n    const fileInfo = taskOptions.fileInfo\n    const downloadOptions: DownloadOptions = {\n      headers: taskOptions.downloadUpdateOptions.requestHeaders,\n      cancellationToken: taskOptions.downloadUpdateOptions.cancellationToken,\n      sha2: (fileInfo.info as any).sha2,\n      sha512: fileInfo.info.sha512,\n    }\n\n    if (this.listenerCount(DOWNLOAD_PROGRESS) > 0) {\n      downloadOptions.onProgress = it => this.emit(DOWNLOAD_PROGRESS, it)\n    }\n\n    const updateInfo = taskOptions.downloadUpdateOptions.updateInfoAndProvider.info\n    const version = updateInfo.version\n    const packageInfo = fileInfo.packageInfo\n\n    function getCacheUpdateFileName(): string {\n      // NodeJS URL doesn't decode automatically\n      const urlPath = decodeURIComponent(taskOptions.fileInfo.url.pathname)\n      if (urlPath.endsWith(`.${taskOptions.fileExtension}`)) {\n        return path.basename(urlPath)\n      } else {\n        // url like /latest, generate name\n        return taskOptions.fileInfo.info.url\n      }\n    }\n\n    const downloadedUpdateHelper = await this.getOrCreateDownloadHelper()\n    const cacheDir = downloadedUpdateHelper.cacheDirForPendingUpdate\n    await mkdir(cacheDir, { recursive: true })\n    const updateFileName = getCacheUpdateFileName()\n    let updateFile = path.join(cacheDir, updateFileName)\n    const packageFile = packageInfo == null ? null : path.join(cacheDir, `package-${version}${path.extname(packageInfo.path) || \".7z\"}`)\n\n    const done = async (isSaveCache: boolean) => {\n      await downloadedUpdateHelper.setDownloadedFile(updateFile, packageFile, updateInfo, fileInfo, updateFileName, isSaveCache)\n      await taskOptions.done!({\n        ...updateInfo,\n        downloadedFile: updateFile,\n      })\n      return packageFile == null ? [updateFile] : [updateFile, packageFile]\n    }\n\n    const log = this._logger\n    const cachedUpdateFile = await downloadedUpdateHelper.validateDownloadedPath(updateFile, updateInfo, fileInfo, log)\n    if (cachedUpdateFile != null) {\n      updateFile = cachedUpdateFile\n      return await done(false)\n    }\n\n    const removeFileIfAny = async () => {\n      await downloadedUpdateHelper.clear().catch(() => {\n        // ignore\n      })\n      return await unlink(updateFile).catch(() => {\n        // ignore\n      })\n    }\n\n    const tempUpdateFile = await createTempUpdateFile(`temp-${updateFileName}`, cacheDir, log)\n    try {\n      await taskOptions.task(tempUpdateFile, downloadOptions, packageFile, removeFileIfAny)\n      await retry(\n        () => rename(tempUpdateFile, updateFile),\n        60,\n        500,\n        0,\n        0,\n        error => error instanceof Error && /^EBUSY:/.test(error.message)\n      )\n    } catch (e: any) {\n      await removeFileIfAny()\n\n      if (e instanceof CancellationError) {\n        log.info(\"cancelled\")\n        this.emit(\"update-cancelled\", updateInfo)\n      }\n      throw e\n    }\n\n    log.info(`New version ${version} has been downloaded to ${updateFile}`)\n    return await done(true)\n  }\n  protected async differentialDownloadInstaller(\n    fileInfo: ResolvedUpdateFileInfo,\n    downloadUpdateOptions: DownloadUpdateOptions,\n    installerPath: string,\n    provider: Provider<any>,\n    oldInstallerFileName: string\n  ): Promise<boolean> {\n    try {\n      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload) {\n        return true\n      }\n      const blockmapFileUrls = blockmapFiles(fileInfo.url, this.app.version, downloadUpdateOptions.updateInfoAndProvider.info.version)\n      this._logger.info(`Download block maps (old: \"${blockmapFileUrls[0]}\", new: ${blockmapFileUrls[1]})`)\n\n      const downloadBlockMap = async (url: URL): Promise<BlockMap> => {\n        const data = await this.httpExecutor.downloadToBuffer(url, {\n          headers: downloadUpdateOptions.requestHeaders,\n          cancellationToken: downloadUpdateOptions.cancellationToken,\n        })\n\n        if (data == null || data.length === 0) {\n          throw new Error(`Blockmap \"${url.href}\" is empty`)\n        }\n\n        try {\n          return JSON.parse(gunzipSync(data).toString())\n        } catch (e: any) {\n          throw new Error(`Cannot parse blockmap \"${url.href}\", error: ${e}`)\n        }\n      }\n\n      const downloadOptions: DifferentialDownloaderOptions = {\n        newUrl: fileInfo.url,\n        oldFile: path.join(this.downloadedUpdateHelper!.cacheDir, oldInstallerFileName),\n        logger: this._logger,\n        newFile: installerPath,\n        isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,\n        requestHeaders: downloadUpdateOptions.requestHeaders,\n        cancellationToken: downloadUpdateOptions.cancellationToken,\n      }\n\n      if (this.listenerCount(DOWNLOAD_PROGRESS) > 0) {\n        downloadOptions.onProgress = it => this.emit(DOWNLOAD_PROGRESS, it)\n      }\n\n      const blockMapDataList = await Promise.all(blockmapFileUrls.map(u => downloadBlockMap(u)))\n      await new GenericDifferentialDownloader(fileInfo.info, this.httpExecutor, downloadOptions).download(blockMapDataList[0], blockMapDataList[1])\n      return false\n    } catch (e: any) {\n      this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`)\n      if (this._testOnlyOptions != null) {\n        // test mode\n        throw e\n      }\n      return true\n    }\n  }\n}\n\nexport interface DownloadUpdateOptions {\n  readonly updateInfoAndProvider: UpdateInfoAndProvider\n  readonly requestHeaders: OutgoingHttpHeaders\n  readonly cancellationToken: CancellationToken\n  readonly disableWebInstaller?: boolean\n  readonly disableDifferentialDownload?: boolean\n}\n\nfunction hasPrereleaseComponents(version: SemVer) {\n  const versionPrereleaseComponent = getVersionPreleaseComponents(version)\n  return versionPrereleaseComponent != null && versionPrereleaseComponent.length > 0\n}\n\n/** @private */\nexport class NoOpLogger implements Logger {\n  // eslint-disable-next-line @typescript-eslint/no-unused-vars\n  info(message?: any) {\n    // ignore\n  }\n\n  // eslint-disable-next-line @typescript-eslint/no-unused-vars\n  warn(message?: any) {\n    // ignore\n  }\n\n  // eslint-disable-next-line @typescript-eslint/no-unused-vars\n  error(message?: any) {\n    // ignore\n  }\n}\n\nexport interface UpdateInfoAndProvider {\n  info: UpdateInfo\n  provider: Provider<any>\n}\n\nexport interface DownloadExecutorTask {\n  readonly fileExtension: string\n  readonly fileInfo: ResolvedUpdateFileInfo\n  readonly downloadUpdateOptions: DownloadUpdateOptions\n  readonly task: (destinationFile: string, downloadOptions: DownloadOptions, packageFile: string | null, removeTempDirIfAny: () => Promise<any>) => Promise<any>\n\n  readonly done?: (event: UpdateDownloadedEvent) => Promise<any>\n}\n\nexport interface DownloadNotification {\n  body: string\n  title: string\n}\n\n/** @private */\nexport interface TestOnlyUpdaterOptions {\n  platform: ProviderPlatform\n\n  isUseDifferentialDownload?: boolean\n}\n"]}
node_modules/electron-updater/out/NsisUpdater.js.map:1:{"version":3,"file":"NsisUpdater.js","sourceRoot":"","sources":["../src/NsisUpdater.ts"],"names":[],"mappings":";;;AAAA,+DAAmJ;AACnJ,6BAA4B;AAG5B,+CAA2D;AAE3D,4IAAwI;AACxI,iCAAqE;AACrE,mDAAyD;AACzD,uCAAiC;AACjC,qGAA0E;AAC1E,6BAAyB;AAEzB,MAAa,WAAY,SAAQ,yBAAW;IAO1C,YAAY,OAAkC,EAAE,GAAgB;QAC9D,KAAK,CAAC,OAAO,EAAE,GAAG,CAAC,CAAA;QAGX,+BAA0B,GAA8B,CAAC,cAA6B,EAAE,uBAA+B,EAAE,EAAE,CACnI,IAAA,wDAAe,EAAC,cAAc,EAAE,uBAAuB,EAAE,IAAI,CAAC,OAAO,CAAC,CAAA;IAHxE,CAAC;IAKD;;;OAGG;IACH,IAAI,yBAAyB;QAC3B,OAAO,IAAI,CAAC,0BAA0B,CAAA;IACxC,CAAC;IAED,IAAI,yBAAyB,CAAC,KAAgC;QAC5D,IAAI,KAAK,EAAE,CAAC;YACV,IAAI,CAAC,0BAA0B,GAAG,KAAK,CAAA;QACzC,CAAC;IACH,CAAC;IAED,gBAAgB;IACN,gBAAgB,CAAC,qBAA4C;QACrE,MAAM,QAAQ,GAAG,qBAAqB,CAAC,qBAAqB,CAAC,QAAQ,CAAA;QACrE,MAAM,QAAQ,GAAG,IAAA,mBAAQ,EAAC,QAAQ,CAAC,YAAY,CAAC,qBAAqB,CAAC,qBAAqB,CAAC,IAAI,CAAC,EAAE,KAAK,CAAE,CAAA;QAC1G,OAAO,IAAI,CAAC,eAAe,CAAC;YAC1B,aAAa,EAAE,KAAK;YACpB,qBAAqB;YACrB,QAAQ;YACR,IAAI,EAAE,KAAK,EAAE,eAAe,EAAE,eAAe,EAAE,WAAW,EAAE,kBAAkB,EAAE,EAAE;gBAChF,MAAM,WAAW,GAAG,QAAQ,CAAC,WAAW,CAAA;gBACxC,MAAM,cAAc,GAAG,WAAW,IAAI,IAAI,IAAI,WAAW,IAAI,IAAI,CAAA;gBACjE,IAAI,cAAc,IAAI,qBAAqB,CAAC,mBAAmB,EAAE,CAAC;oBAChE,MAAM,IAAA,+BAAQ,EACZ,kCAAkC,qBAAqB,CAAC,qBAAqB,CAAC,IAAI,CAAC,OAAO,+BAA+B,EACzH,oCAAoC,CACrC,CAAA;gBACH,CAAC;gBACD,IAAI,CAAC,cAAc,IAAI,CAAC,qBAAqB,CAAC,mBAAmB,EAAE,CAAC;oBAClE,IAAI,CAAC,OAAO,CAAC,IAAI,CACf,4JAA4J,CAC7J,CAAA;gBACH,CAAC;gBACD,IACE,cAAc;oBACd,qBAAqB,CAAC,2BAA2B;oBACjD,CAAC,MAAM,IAAI,CAAC,6BAA6B,CAAC,QAAQ,EAAE,qBAAqB,EAAE,eAAe,EAAE,QAAQ,EAAE,sDAA+B,CAAC,CAAC,EACvI,CAAC;oBACD,MAAM,IAAI,CAAC,YAAY,CAAC,QAAQ,CAAC,QAAQ,CAAC,GAAG,EAAE,eAAe,EAAE,eAAe,CAAC,CAAA;gBAClF,CAAC;gBAED,MAAM,2BAA2B,GAAG,MAAM,IAAI,CAAC,eAAe,CAAC,eAAe,CAAC,CAAA;gBAC/E,IAAI,2BAA2B,IAAI,IAAI,EAAE,CAAC;oBACxC,MAAM,kBAAkB,EAAE,CAAA;oBAC1B,yCAAyC;oBACzC,MAAM,IAAA,+BAAQ,EACZ,eAAe,qBAAqB,CAAC,qBAAqB,CAAC,IAAI,CAAC,OAAO,4CAA4C,2BAA2B,EAAE,EAChJ,+BAA+B,CAChC,CAAA;gBACH,CAAC;gBAED,IAAI,cAAc,EAAE,CAAC;oBACnB,IAAI,MAAM,IAAI,CAAC,8BAA8B,CAAC,qBAAqB,EAAE,WAAW,EAAE,WAAW,EAAE,QAAQ,CAAC,EAAE,CAAC;wBACzG,IAAI,CAAC;4BACH,MAAM,IAAI,CAAC,YAAY,CAAC,QAAQ,CAAC,IAAI,SAAG,CAAC,WAAW,CAAC,IAAI,CAAC,EAAE,WAAW,EAAE;gCACvE,OAAO,EAAE,qBAAqB,CAAC,cAAc;gCAC7C,iBAAiB,EAAE,qBAAqB,CAAC,iBAAiB;gCAC1D,MAAM,EAAE,WAAW,CAAC,MAAM;6BAC3B,CAAC,CAAA;wBACJ,CAAC;wBAAC,OAAO,CAAM,EAAE,CAAC;4BAChB,IAAI,CAAC;gCACH,MAAM,IAAA,iBAAM,EAAC,WAAW,CAAC,CAAA;4BAC3B,CAAC;4BAAC,OAAO,QAAQ,EAAE,CAAC;gCAClB,SAAS;4BACX,CAAC;4BAED,MAAM,CAAC,CAAA;wBACT,CAAC;oBACH,CAAC;gBACH,CAAC;YACH,CAAC;SACF,CAAC,CAAA;IACJ,CAAC;IAED,8DAA8D;IAC9D,kJAAkJ;IAClJ,kEAAkE;IAC1D,KAAK,CAAC,eAAe,CAAC,cAAsB;QAClD,IAAI,aAA4C,CAAA;QAChD,IAAI,CAAC;YACH,aAAa,GAAG,CAAC,MAAM,IAAI,CAAC,YAAY,CAAC,KAAK,CAAC,CAAC,aAAa,CAAA;YAC7D,IAAI,aAAa,IAAI,IAAI,EAAE,CAAC;gBAC1B,OAAO,IAAI,CAAA;YACb,CAAC;QACH,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,IAAI,CAAC,CAAC,IAAI,KAAK,QAAQ,EAAE,CAAC;gBACxB,oBAAoB;gBACpB,OAAO,IAAI,CAAA;YACb,CAAC;YACD,MAAM,CAAC,CAAA;QACT,CAAC;QACD,OAAO,MAAM,IAAI,CAAC,0BAA0B,CAAC,KAAK,CAAC,OAAO,CAAC,aAAa,CAAC,CAAC,CAAC,CAAC,aAAa,CAAC,CAAC,CAAC,CAAC,aAAa,CAAC,EAAE,cAAc,CAAC,CAAA;IAC9H,CAAC;IAES,SAAS,CAAC,OAAuB;QACzC,MAAM,IAAI,GAAG,CAAC,WAAW,CAAC,CAAA;QAC1B,IAAI,OAAO,CAAC,QAAQ,EAAE,CAAC;YACrB,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,CAAA;QACjB,CAAC;QAED,IAAI,OAAO,CAAC,eAAe,EAAE,CAAC;YAC5B,IAAI,CAAC,IAAI,CAAC,aAAa,CAAC,CAAA;QAC1B,CAAC;QAED,IAAI,IAAI,CAAC,gBAAgB,EAAE,CAAC;YAC1B,+BAA+B;YAC/B,IAAI,CAAC,IAAI,CAAC,MAAM,IAAI,CAAC,gBAAgB,EAAE,CAAC,CAAA;QAC1C,CAAC;QAED,MAAM,WAAW,GAAG,IAAI,CAAC,sBAAsB,IAAI,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,sBAAsB,CAAC,WAAW,CAAA;QACxG,IAAI,WAAW,IAAI,IAAI,EAAE,CAAC;YACxB,2BAA2B;YAC3B,IAAI,CAAC,IAAI,CAAC,kBAAkB,WAAW,EAAE,CAAC,CAAA;QAC5C,CAAC;QAED,MAAM,kBAAkB,GAAG,GAAS,EAAE;YACpC,IAAI,CAAC,QAAQ,CAAC,IAAI,CAAC,IAAI,CAAC,OAAO,CAAC,aAAa,EAAE,aAAa,CAAC,EAAE,CAAC,OAAO,CAAC,aAAa,CAAC,CAAC,MAAM,CAAC,IAAI,CAAC,CAAC,CAAC,KAAK,CAAC,CAAC,CAAC,EAAE,CAAC,IAAI,CAAC,aAAa,CAAC,CAAC,CAAC,CAAC,CAAA;QACxI,CAAC,CAAA;QAED,IAAI,OAAO,CAAC,qBAAqB,EAAE,CAAC;YAClC,IAAI,CAAC,OAAO,CAAC,IAAI,CAAC,uEAAuE,CAAC,CAAA;YAC1F,kBAAkB,EAAE,CAAA;YACpB,OAAO,IAAI,CAAA;QACb,CAAC;QAED,IAAI,CAAC,QAAQ,CAAC,OAAO,CAAC,aAAa,EAAE,IAAI,CAAC,CAAC,KAAK,CAAC,CAAC,CAAQ,EAAE,EAAE;YAC5D,oEAAoE;YACpE,4GAA4G;YAC5G,MAAM,SAAS,GAAI,CAA2B,CAAC,IAAI,CAAA;YACnD,IAAI,CAAC,OAAO,CAAC,IAAI,CACf,qCAAqC,SAAS,qBAAqB,CAAC,CAAC,OAAO,0GAA0G,CACvL,CAAA;YACD,IAAI,SAAS,KAAK,SAAS,IAAI,SAAS,KAAK,QAAQ,EAAE,CAAC;gBACtD,kBAAkB,EAAE,CAAA;YACtB,CAAC;iBAAM,IAAI,SAAS,KAAK,QAAQ,EAAE,CAAC;gBAClC,OAAO,CAAC,UAAU,CAAC;qBAChB,KAAK,CAAC,QAAQ,CAAC,OAAO,CAAC,aAAa,CAAC;qBACrC,KAAK,CAAC,CAAC,GAAU,EAAE,EAAE,CAAC,IAAI,CAAC,aAAa,CAAC,GAAG,CAAC,CAAC,CAAA;YACnD,CAAC;iBAAM,CAAC;gBACN,IAAI,CAAC,aAAa,CAAC,CAAC,CAAC,CAAA;YACvB,CAAC;QACH,CAAC,CAAC,CAAA;QACF,OAAO,IAAI,CAAA;IACb,CAAC;IAEO,KAAK,CAAC,8BAA8B,CAC1C,qBAA4C,EAC5C,WAA4B,EAC5B,WAAmB,EACnB,QAAuB;QAEvB,IAAI,WAAW,CAAC,YAAY,IAAI,IAAI,EAAE,CAAC;YACrC,OAAO,IAAI,CAAA;QACb,CAAC;QAED,IAAI,CAAC;YACH,MAAM,eAAe,GAAkC;gBACrD,MAAM,EAAE,IAAI,SAAG,CAAC,WAAW,CAAC,IAAI,CAAC;gBACjC,OAAO,EAAE,IAAI,CAAC,IAAI,CAAC,IAAI,CAAC,sBAAuB,CAAC,QAAQ,EAAE,oDAA6B,CAAC;gBACxF,MAAM,EAAE,IAAI,CAAC,OAAO;gBACpB,OAAO,EAAE,WAAW;gBACpB,cAAc,EAAE,IAAI,CAAC,cAAc;gBACnC,yBAAyB,EAAE,QAAQ,CAAC,yBAAyB;gBAC7D,iBAAiB,EAAE,qBAAqB,CAAC,iBAAiB;aAC3D,CAAA;YAED,IAAI,IAAI,CAAC,aAAa,CAAC,wBAAiB,CAAC,GAAG,CAAC,EAAE,CAAC;gBAC9C,eAAe,CAAC,UAAU,GAAG,EAAE,CAAC,EAAE,CAAC,IAAI,CAAC,IAAI,CAAC,wBAAiB,EAAE,EAAE,CAAC,CAAA;YACrE,CAAC;YAED,MAAM,IAAI,+FAA8C,CAAC,WAAW,EAAE,IAAI,CAAC,YAAY,EAAE,eAAe,CAAC,CAAC,QAAQ,EAAE,CAAA;QACtH,CAAC;QAAC,OAAO,CAAM,EAAE,CAAC;YAChB,IAAI,CAAC,OAAO,CAAC,KAAK,CAAC,8DAA8D,CAAC,CAAC,KAAK,IAAI,CAAC,EAAE,CAAC,CAAA;YAChG,mEAAmE;YACnE,OAAO,OAAO,CAAC,QAAQ,KAAK,OAAO,CAAA;QACrC,CAAC;QACD,OAAO,KAAK,CAAA;IACd,CAAC;CACF;AAnMD,kCAmMC","sourcesContent":["import { AllPublishOptions, newError, PackageFileInfo, CURRENT_APP_INSTALLER_FILE_NAME, CURRENT_APP_PACKAGE_FILE_NAME } from \"builder-util-runtime\"\nimport * as path from \"path\"\nimport { AppAdapter } from \"./AppAdapter\"\nimport { DownloadUpdateOptions } from \"./AppUpdater\"\nimport { BaseUpdater, InstallOptions } from \"./BaseUpdater\"\nimport { DifferentialDownloaderOptions } from \"./differentialDownloader/DifferentialDownloader\"\nimport { FileWithEmbeddedBlockMapDifferentialDownloader } from \"./differentialDownloader/FileWithEmbeddedBlockMapDifferentialDownloader\"\nimport { DOWNLOAD_PROGRESS, verifyUpdateCodeSignature } from \"./main\"\nimport { findFile, Provider } from \"./providers/Provider\"\nimport { unlink } from \"fs-extra\"\nimport { verifySignature } from \"./windowsExecutableCodeSignatureVerifier\"\nimport { URL } from \"url\"\n\nexport class NsisUpdater extends BaseUpdater {\n  /**\n   * Specify custom install directory path\n   *\n   */\n  installDirectory?: string\n\n  constructor(options?: AllPublishOptions | null, app?: AppAdapter) {\n    super(options, app)\n  }\n\n  protected _verifyUpdateCodeSignature: verifyUpdateCodeSignature = (publisherNames: Array<string>, unescapedTempUpdateFile: string) =>\n    verifySignature(publisherNames, unescapedTempUpdateFile, this._logger)\n\n  /**\n   * The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.\n   * The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)\n   */\n  get verifyUpdateCodeSignature(): verifyUpdateCodeSignature {\n    return this._verifyUpdateCodeSignature\n  }\n\n  set verifyUpdateCodeSignature(value: verifyUpdateCodeSignature) {\n    if (value) {\n      this._verifyUpdateCodeSignature = value\n    }\n  }\n\n  /*** @private */\n  protected doDownloadUpdate(downloadUpdateOptions: DownloadUpdateOptions): Promise<Array<string>> {\n    const provider = downloadUpdateOptions.updateInfoAndProvider.provider\n    const fileInfo = findFile(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), \"exe\")!\n    return this.executeDownload({\n      fileExtension: \"exe\",\n      downloadUpdateOptions,\n      fileInfo,\n      task: async (destinationFile, downloadOptions, packageFile, removeTempDirIfAny) => {\n        const packageInfo = fileInfo.packageInfo\n        const isWebInstaller = packageInfo != null && packageFile != null\n        if (isWebInstaller && downloadUpdateOptions.disableWebInstaller) {\n          throw newError(\n            `Unable to download new version ${downloadUpdateOptions.updateInfoAndProvider.info.version}. Web Installers are disabled`,\n            \"ERR_UPDATER_WEB_INSTALLER_DISABLED\"\n          )\n        }\n        if (!isWebInstaller && !downloadUpdateOptions.disableWebInstaller) {\n          this._logger.warn(\n            \"disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version.\"\n          )\n        }\n        if (\n          isWebInstaller ||\n          downloadUpdateOptions.disableDifferentialDownload ||\n          (await this.differentialDownloadInstaller(fileInfo, downloadUpdateOptions, destinationFile, provider, CURRENT_APP_INSTALLER_FILE_NAME))\n        ) {\n          await this.httpExecutor.download(fileInfo.url, destinationFile, downloadOptions)\n        }\n\n        const signatureVerificationStatus = await this.verifySignature(destinationFile)\n        if (signatureVerificationStatus != null) {\n          await removeTempDirIfAny()\n          // noinspection ThrowInsideFinallyBlockJS\n          throw newError(\n            `New version ${downloadUpdateOptions.updateInfoAndProvider.info.version} is not signed by the application owner: ${signatureVerificationStatus}`,\n            \"ERR_UPDATER_INVALID_SIGNATURE\"\n          )\n        }\n\n        if (isWebInstaller) {\n          if (await this.differentialDownloadWebPackage(downloadUpdateOptions, packageInfo, packageFile, provider)) {\n            try {\n              await this.httpExecutor.download(new URL(packageInfo.path), packageFile, {\n                headers: downloadUpdateOptions.requestHeaders,\n                cancellationToken: downloadUpdateOptions.cancellationToken,\n                sha512: packageInfo.sha512,\n              })\n            } catch (e: any) {\n              try {\n                await unlink(packageFile)\n              } catch (_ignored) {\n                // ignore\n              }\n\n              throw e\n            }\n          }\n        }\n      },\n    })\n  }\n\n  // $certificateInfo = (Get-AuthenticodeSignature 'xxx\\yyy.exe'\n  // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains(\"CN=siemens.com\")})\n  // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }\n  private async verifySignature(tempUpdateFile: string): Promise<string | null> {\n    let publisherName: Array<string> | string | null\n    try {\n      publisherName = (await this.configOnDisk.value).publisherName\n      if (publisherName == null) {\n        return null\n      }\n    } catch (e: any) {\n      if (e.code === \"ENOENT\") {\n        // no app-update.yml\n        return null\n      }\n      throw e\n    }\n    return await this._verifyUpdateCodeSignature(Array.isArray(publisherName) ? publisherName : [publisherName], tempUpdateFile)\n  }\n\n  protected doInstall(options: InstallOptions): boolean {\n    const args = [\"--updated\"]\n    if (options.isSilent) {\n      args.push(\"/S\")\n    }\n\n    if (options.isForceRunAfter) {\n      args.push(\"--force-run\")\n    }\n\n    if (this.installDirectory) {\n      // maybe check if folder exists\n      args.push(`/D=${this.installDirectory}`)\n    }\n\n    const packagePath = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile\n    if (packagePath != null) {\n      // only = form is supported\n      args.push(`--package-file=${packagePath}`)\n    }\n\n    const callUsingElevation = (): void => {\n      this.spawnLog(path.join(process.resourcesPath, \"elevate.exe\"), [options.installerPath].concat(args)).catch(e => this.dispatchError(e))\n    }\n\n    if (options.isAdminRightsRequired) {\n      this._logger.info(\"isAdminRightsRequired is set to true, run installer using elevate.exe\")\n      callUsingElevation()\n      return true\n    }\n\n    this.spawnLog(options.installerPath, args).catch((e: Error) => {\n      // https://github.com/electron-userland/electron-builder/issues/1129\n      // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors\n      const errorCode = (e as NodeJS.ErrnoException).code\n      this._logger.info(\n        `Cannot run installer: error code: ${errorCode}, error message: \"${e.message}\", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`\n      )\n      if (errorCode === \"UNKNOWN\" || errorCode === \"EACCES\") {\n        callUsingElevation()\n      } else if (errorCode === \"ENOENT\") {\n        require(\"electron\")\n          .shell.openPath(options.installerPath)\n          .catch((err: Error) => this.dispatchError(err))\n      } else {\n        this.dispatchError(e)\n      }\n    })\n    return true\n  }\n\n  private async differentialDownloadWebPackage(\n    downloadUpdateOptions: DownloadUpdateOptions,\n    packageInfo: PackageFileInfo,\n    packagePath: string,\n    provider: Provider<any>\n  ): Promise<boolean> {\n    if (packageInfo.blockMapSize == null) {\n      return true\n    }\n\n    try {\n      const downloadOptions: DifferentialDownloaderOptions = {\n        newUrl: new URL(packageInfo.path),\n        oldFile: path.join(this.downloadedUpdateHelper!.cacheDir, CURRENT_APP_PACKAGE_FILE_NAME),\n        logger: this._logger,\n        newFile: packagePath,\n        requestHeaders: this.requestHeaders,\n        isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,\n        cancellationToken: downloadUpdateOptions.cancellationToken,\n      }\n\n      if (this.listenerCount(DOWNLOAD_PROGRESS) > 0) {\n        downloadOptions.onProgress = it => this.emit(DOWNLOAD_PROGRESS, it)\n      }\n\n      await new FileWithEmbeddedBlockMapDifferentialDownloader(packageInfo, this.httpExecutor, downloadOptions).download()\n    } catch (e: any) {\n      this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`)\n      // during test (developer machine mac or linux) we must throw error\n      return process.platform === \"win32\"\n    }\n    return false\n  }\n}\n"]}
node_modules/electron-updater/out/providers/PrivateGitHubProvider.js.map:1:{"version":3,"file":"PrivateGitHubProvider.js","sourceRoot":"","sources":["../../src/providers/PrivateGitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, HttpError, newError, UpdateInfo } from \"builder-util-runtime\"\nimport { OutgoingHttpHeaders, RequestOptions } from \"http\"\nimport { load } from \"js-yaml\"\nimport * as path from \"path\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { URL } from \"url\"\nimport { getChannelFilename, newUrlFromBase } from \"../util\"\nimport { BaseGitHubProvider } from \"./GitHubProvider\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getFileList, ProviderRuntimeOptions } from \"./Provider\"\n\nexport interface PrivateGitHubUpdateInfo extends UpdateInfo {\n  assets: Array<Asset>\n}\n\nexport class PrivateGitHubProvider extends BaseGitHubProvider<PrivateGitHubUpdateInfo> {\n  constructor(\n    options: GithubOptions,\n    private readonly updater: AppUpdater,\n    private readonly token: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"api.github.com\", runtimeOptions)\n  }\n\n  protected createRequestOptions(url: URL, headers?: OutgoingHttpHeaders | null): RequestOptions {\n    const result = super.createRequestOptions(url, headers)\n    ;(result as any).redirect = \"manual\"\n    return result\n  }\n\n  async getLatestVersion(): Promise<PrivateGitHubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n    const channelFile = getChannelFilename(this.getDefaultChannelName())\n\n    const releaseInfo = await this.getLatestVersionInfo(cancellationToken)\n    const asset = releaseInfo.assets.find(it => it.name === channelFile)\n    if (asset == null) {\n      // html_url must be always, but just to be sure\n      throw newError(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n    }\n\n    const url = new URL(asset.url)\n    let result: any\n    try {\n      result = load((await this.httpRequest(url, this.configureHeaders(\"application/octet-stream\"), cancellationToken))!)\n    } catch (e: any) {\n      if (e instanceof HttpError && e.statusCode === 404) {\n        throw newError(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n      }\n      throw e\n    }\n\n    ;(result as PrivateGitHubUpdateInfo).assets = releaseInfo.assets\n    return result\n  }\n\n  get fileExtraDownloadHeaders(): OutgoingHttpHeaders | null {\n    return this.configureHeaders(\"application/octet-stream\")\n  }\n\n  private configureHeaders(accept: string) {\n    return {\n      accept,\n      authorization: `token ${this.token}`,\n    }\n  }\n\n  private async getLatestVersionInfo(cancellationToken: CancellationToken): Promise<ReleaseInfo> {\n    const allowPrerelease = this.updater.allowPrerelease\n    let basePath = this.basePath\n    if (!allowPrerelease) {\n      basePath = `${basePath}/latest`\n    }\n\n    const url = newUrlFromBase(basePath, this.baseUrl)\n    try {\n      const version = JSON.parse((await this.httpRequest(url, this.configureHeaders(\"application/vnd.github.v3+json\"), cancellationToken))!)\n      if (allowPrerelease) {\n        return (version as Array<{ prerelease: boolean }>).find(it => it.prerelease) || version[0]\n      } else {\n        return version\n      }\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`)\n  }\n\n  resolveFiles(updateInfo: PrivateGitHubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    return getFileList(updateInfo).map(it => {\n      const name = path.posix.basename(it.url).replace(/ /g, \"-\")\n      const asset = updateInfo.assets.find(it => it != null && it.name === name)\n      if (asset == null) {\n        throw newError(`Cannot find asset \"${name}\" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, \"ERR_UPDATER_ASSET_NOT_FOUND\")\n      }\n\n      return {\n        url: new URL(asset.url),\n        info: it,\n      }\n    })\n  }\n}\n\ninterface ReleaseInfo {\n  name: string\n  html_url: string\n  assets: Array<Asset>\n}\n\nexport interface Asset {\n  name: string\n  url: string\n}\n"]}
node_modules/electron-updater/out/providers/GitHubProvider.js.map:1:{"version":3,"file":"GitHubProvider.js","sourceRoot":"","sources":["../../src/providers/GitHubProvider.ts"],"names":[],"mappings":"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","sourcesContent":["import { CancellationToken, GithubOptions, githubUrl, HttpError, newError, parseXml, ReleaseNoteInfo, UpdateInfo, XElement } from \"builder-util-runtime\"\nimport * as semver from \"semver\"\nimport { URL } from \"url\"\nimport { AppUpdater } from \"../AppUpdater\"\nimport { ResolvedUpdateFileInfo } from \"../main\"\nimport { getChannelFilename, newBaseUrl, newUrlFromBase } from \"../util\"\nimport { parseUpdateInfo, Provider, ProviderRuntimeOptions, resolveFiles } from \"./Provider\"\n\nconst hrefRegExp = /\\/tag\\/([^/]+)$/\n\ninterface GithubUpdateInfo extends UpdateInfo {\n  tag: string\n}\nexport abstract class BaseGitHubProvider<T extends UpdateInfo> extends Provider<T> {\n  // so, we don't need to parse port (because node http doesn't support host as url does)\n  protected readonly baseUrl: URL\n  protected readonly baseApiUrl: URL\n\n  protected constructor(\n    protected readonly options: GithubOptions,\n    defaultHost: string,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super({\n      ...runtimeOptions,\n      /* because GitHib uses S3 */\n      isUseMultipleRangeRequest: false,\n    })\n\n    this.baseUrl = newBaseUrl(githubUrl(options, defaultHost))\n    const apiHost = defaultHost === \"github.com\" ? \"api.github.com\" : defaultHost\n    this.baseApiUrl = newBaseUrl(githubUrl(options, apiHost))\n  }\n\n  protected computeGithubBasePath(result: string): string {\n    // https://github.com/electron-userland/electron-builder/issues/1903#issuecomment-320881211\n    const host = this.options.host\n    return host && ![\"github.com\", \"api.github.com\"].includes(host) ? `/api/v3${result}` : result\n  }\n}\n\nexport class GitHubProvider extends BaseGitHubProvider<GithubUpdateInfo> {\n  constructor(\n    protected readonly options: GithubOptions,\n    private readonly updater: AppUpdater,\n    runtimeOptions: ProviderRuntimeOptions\n  ) {\n    super(options, \"github.com\", runtimeOptions)\n  }\n\n  private get channel(): string {\n    const result = this.updater.channel || this.options.channel\n    return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result)\n  }\n\n  async getLatestVersion(): Promise<GithubUpdateInfo> {\n    const cancellationToken = new CancellationToken()\n\n    const feedXml: string = (await this.httpRequest(\n      newUrlFromBase(`${this.basePath}.atom`, this.baseUrl),\n      {\n        accept: \"application/xml, application/atom+xml, text/xml, */*\",\n      },\n      cancellationToken\n    ))!\n\n    const feed = parseXml(feedXml)\n    // noinspection TypeScriptValidateJSTypes\n    let latestRelease = feed.element(\"entry\", false, `No published versions on GitHub`)\n    let tag: string | null = null\n    try {\n      if (this.updater.allowPrerelease) {\n        const currentChannel = this.updater?.channel || (semver.prerelease(this.updater.currentVersion)?.[0] as string) || null\n\n        if (currentChannel === null) {\n          // noinspection TypeScriptValidateJSTypes\n          tag = hrefRegExp.exec(latestRelease.element(\"link\").attribute(\"href\"))![1]\n        } else {\n          for (const element of feed.getElements(\"entry\")) {\n            // noinspection TypeScriptValidateJSTypes\n            const hrefElement = hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))!\n\n            // If this is null then something is wrong and skip this release\n            if (hrefElement === null) continue\n\n            // This Release's Tag\n            const hrefTag = hrefElement[1]\n            //Get Channel from this release's tag\n            const hrefChannel = (semver.prerelease(hrefTag)?.[0] as string) || null\n\n            const shouldFetchVersion = !currentChannel || [\"alpha\", \"beta\"].includes(currentChannel)\n            const isCustomChannel = hrefChannel !== null && ![\"alpha\", \"beta\"].includes(String(hrefChannel))\n            // Allow moving from alpha to beta but not down\n            const channelMismatch = currentChannel === \"beta\" && hrefChannel === \"alpha\"\n\n            if (shouldFetchVersion && !isCustomChannel && !channelMismatch) {\n              tag = hrefTag\n              break\n            }\n\n            const isNextPreRelease = hrefChannel && hrefChannel === currentChannel\n            if (isNextPreRelease) {\n              tag = hrefTag\n              break\n            }\n          }\n        }\n      } else {\n        tag = await this.getLatestTagName(cancellationToken)\n        for (const element of feed.getElements(\"entry\")) {\n          // noinspection TypeScriptValidateJSTypes\n          if (hrefRegExp.exec(element.element(\"link\").attribute(\"href\"))![1] === tag) {\n            latestRelease = element\n            break\n          }\n        }\n      }\n    } catch (e: any) {\n      throw newError(`Cannot parse releases feed: ${e.stack || e.message},\\nXML:\\n${feedXml}`, \"ERR_UPDATER_INVALID_RELEASE_FEED\")\n    }\n\n    if (tag == null) {\n      throw newError(`No published versions on GitHub`, \"ERR_UPDATER_NO_PUBLISHED_VERSIONS\")\n    }\n\n    let rawData: string\n    let channelFile = \"\"\n    let channelFileUrl: any = \"\"\n    const fetchData = async (channelName: string) => {\n      channelFile = getChannelFilename(channelName)\n      channelFileUrl = newUrlFromBase(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl)\n      const requestOptions = this.createRequestOptions(channelFileUrl)\n      try {\n        return (await this.executor.request(requestOptions, cancellationToken))!\n      } catch (e: any) {\n        if (e instanceof HttpError && e.statusCode === 404) {\n          throw newError(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, \"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND\")\n        }\n        throw e\n      }\n    }\n\n    try {\n      let channel = this.channel\n      if (this.updater.allowPrerelease && semver.prerelease(tag)?.[0]) {\n        channel = this.getCustomChannelName(String(semver.prerelease(tag)?.[0]))\n      }\n      rawData = await fetchData(channel)\n    } catch (e: any) {\n      if (this.updater.allowPrerelease) {\n        // Allow fallback to `latest.yml`\n        rawData = await fetchData(this.getDefaultChannelName())\n      } else {\n        throw e\n      }\n    }\n\n    const result = parseUpdateInfo(rawData, channelFile, channelFileUrl)\n    if (result.releaseName == null) {\n      result.releaseName = latestRelease.elementValueOrEmpty(\"title\")\n    }\n\n    if (result.releaseNotes == null) {\n      result.releaseNotes = computeReleaseNotes(this.updater.currentVersion, this.updater.fullChangelog, feed, latestRelease)\n    }\n    return {\n      tag: tag,\n      ...result,\n    }\n  }\n\n  private async getLatestTagName(cancellationToken: CancellationToken): Promise<string | null> {\n    const options = this.options\n    // do not use API for GitHub to avoid limit, only for custom host or GitHub Enterprise\n    const url =\n      options.host == null || options.host === \"github.com\"\n        ? newUrlFromBase(`${this.basePath}/latest`, this.baseUrl)\n        : new URL(`${this.computeGithubBasePath(`/repos/${options.owner}/${options.repo}/releases`)}/latest`, this.baseApiUrl)\n    try {\n      const rawData = await this.httpRequest(url, { Accept: \"application/json\" }, cancellationToken)\n      if (rawData == null) {\n        return null\n      }\n\n      const releaseInfo: GithubReleaseInfo = JSON.parse(rawData)\n      return releaseInfo.tag_name\n    } catch (e: any) {\n      throw newError(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, \"ERR_UPDATER_LATEST_VERSION_NOT_FOUND\")\n    }\n  }\n\n  private get basePath(): string {\n    return `/${this.options.owner}/${this.options.repo}/releases`\n  }\n\n  resolveFiles(updateInfo: GithubUpdateInfo): Array<ResolvedUpdateFileInfo> {\n    // still replace space to - due to backward compatibility\n    return resolveFiles(updateInfo, this.baseUrl, p => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, \"-\")))\n  }\n\n  private getBaseDownloadPath(tag: string, fileName: string): string {\n    return `${this.basePath}/download/${tag}/${fileName}`\n  }\n}\n\ninterface GithubReleaseInfo {\n  readonly tag_name: string\n}\n\nfunction getNoteValue(parent: XElement): string {\n  const result = parent.elementValueOrEmpty(\"content\")\n  // GitHub reports empty notes as <content>No content.</content>\n  return result === \"No content.\" ? \"\" : result\n}\n\nexport function computeReleaseNotes(currentVersion: semver.SemVer, isFullChangelog: boolean, feed: XElement, latestRelease: any): string | Array<ReleaseNoteInfo> | null {\n  if (!isFullChangelog) {\n    return getNoteValue(latestRelease)\n  }\n\n  const releaseNotes: Array<ReleaseNoteInfo> = []\n  for (const release of feed.getElements(\"entry\")) {\n    // noinspection TypeScriptValidateJSTypes\n    const versionRelease = /\\/tag\\/v?([^/]+)$/.exec(release.element(\"link\").attribute(\"href\"))![1]\n    if (semver.lt(currentVersion, versionRelease)) {\n      releaseNotes.push({\n        version: versionRelease,\n        note: getNoteValue(release),\n      })\n    }\n  }\n  return releaseNotes.sort((a, b) => semver.rcompare(a.version, b.version))\n}\n"]}
node_modules/electron-updater/out/providerFactory.js:23:            const token = (githubOptions.private ? process.env["GH_TOKEN"] || process.env["GITHUB_TOKEN"] : null) || githubOptions.token;
node_modules/electron-updater/out/providerFactory.js.map:1:{"version":3,"file":"providerFactory.js","sourceRoot":"","sources":["../src/providerFactory.ts"],"names":[],"mappings":";;AAoBA,wFAEC;AAED,oCA4DC;AApFD,+DAW6B;AAE7B,qEAAiE;AACjE,iEAA6D;AAC7D,+DAA2D;AAC3D,+DAA2D;AAC3D,6EAAyE;AAGzE,SAAgB,sCAAsC,CAAC,GAAW;IAChE,OAAO,CAAC,GAAG,CAAC,QAAQ,CAAC,kBAAkB,CAAC,CAAA;AAC1C,CAAC;AAED,SAAgB,YAAY,CAAC,IAA8C,EAAE,OAAmB,EAAE,cAAsC;IACtI,qCAAqC;IACrC,IAAI,OAAO,IAAI,KAAK,QAAQ,EAAE,CAAC;QAC7B,MAAM,IAAA,+BAAQ,EAAC,yCAAyC,EAAE,4CAA4C,CAAC,CAAA;IACzG,CAAC;IAED,MAAM,QAAQ,GAAG,IAAI,CAAC,QAAQ,CAAA;IAC9B,QAAQ,QAAQ,EAAE,CAAC;QACjB,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,aAAa,GAAG,IAAqB,CAAA;YAC3C,MAAM,KAAK,GAAG,CAAC,aAAa,CAAC,OAAO,CAAC,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,UAAU,CAAC,IAAI,OAAO,CAAC,GAAG,CAAC,cAAc,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,IAAI,aAAa,CAAC,KAAK,CAAA;YAC5H,IAAI,KAAK,IAAI,IAAI,EAAE,CAAC;gBAClB,OAAO,IAAI,+BAAc,CAAC,aAAa,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;YACnE,CAAC;iBAAM,CAAC;gBACN,OAAO,IAAI,6CAAqB,CAAC,aAAa,EAAE,OAAO,EAAE,KAAK,EAAE,cAAc,CAAC,CAAA;YACjF,CAAC;QACH,CAAC;QAED,KAAK,WAAW;YACd,OAAO,IAAI,qCAAiB,CAAC,IAAwB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAEjF,KAAK,QAAQ;YACX,OAAO,IAAI,+BAAc,CAAC,IAAqB,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAE3E,KAAK,IAAI,CAAC;QACV,KAAK,QAAQ;YACX,OAAO,IAAI,iCAAe,CACxB;gBACE,QAAQ,EAAE,SAAS;gBACnB,GAAG,EAAE,IAAA,+CAAwB,EAAC,IAAI,CAAC;gBACnC,OAAO,EAAG,IAAsB,CAAC,OAAO,IAAI,IAAI;aACjD,EACD,OAAO,EACP;gBACE,GAAG,cAAc;gBACjB,oEAAoE;gBACpE,yBAAyB,EAAE,KAAK;aACjC,CACF,CAAA;QAEH,KAAK,SAAS,CAAC,CAAC,CAAC;YACf,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,OAAO,IAAI,iCAAe,CAAC,OAAO,EAAE,OAAO,EAAE;gBAC3C,GAAG,cAAc;gBACjB,yBAAyB,EAAE,OAAO,CAAC,uBAAuB,KAAK,KAAK,IAAI,sCAAsC,CAAC,OAAO,CAAC,GAAG,CAAC;aAC5H,CAAC,CAAA;QACJ,CAAC;QAED,KAAK,QAAQ,CAAC,CAAC,CAAC;YACd,MAAM,OAAO,GAAG,IAA4B,CAAA;YAC5C,MAAM,WAAW,GAAG,OAAO,CAAC,cAAc,CAAA;YAC1C,IAAI,CAAC,WAAW,EAAE,CAAC;gBACjB,MAAM,IAAA,+BAAQ,EAAC,+BAA+B,EAAE,4CAA4C,CAAC,CAAA;YAC/F,CAAC;YACD,OAAO,IAAI,WAAW,CAAC,OAAO,EAAE,OAAO,EAAE,cAAc,CAAC,CAAA;QAC1D,CAAC;QAED;YACE,MAAM,IAAA,+BAAQ,EAAC,yBAAyB,QAAQ,EAAE,EAAE,kCAAkC,CAAC,CAAA;IAC3F,CAAC;AACH,CAAC","sourcesContent":["import {\n  AllPublishOptions,\n  BaseS3Options,\n  BitbucketOptions,\n  CustomPublishOptions,\n  GenericServerOptions,\n  getS3LikeProviderBaseUrl,\n  GithubOptions,\n  KeygenOptions,\n  newError,\n  PublishConfiguration,\n} from \"builder-util-runtime\"\nimport { AppUpdater } from \"./AppUpdater\"\nimport { BitbucketProvider } from \"./providers/BitbucketProvider\"\nimport { GenericProvider } from \"./providers/GenericProvider\"\nimport { GitHubProvider } from \"./providers/GitHubProvider\"\nimport { KeygenProvider } from \"./providers/KeygenProvider\"\nimport { PrivateGitHubProvider } from \"./providers/PrivateGitHubProvider\"\nimport { Provider, ProviderRuntimeOptions } from \"./providers/Provider\"\n\nexport function isUrlProbablySupportMultiRangeRequests(url: string): boolean {\n  return !url.includes(\"s3.amazonaws.com\")\n}\n\nexport function createClient(data: PublishConfiguration | AllPublishOptions, updater: AppUpdater, runtimeOptions: ProviderRuntimeOptions): Provider<any> {\n  // noinspection SuspiciousTypeOfGuard\n  if (typeof data === \"string\") {\n    throw newError(\"Please pass PublishConfiguration object\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n  }\n\n  const provider = data.provider\n  switch (provider) {\n    case \"github\": {\n      const githubOptions = data as GithubOptions\n      const token = (githubOptions.private ? process.env[\"GH_TOKEN\"] || process.env[\"GITHUB_TOKEN\"] : null) || githubOptions.token\n      if (token == null) {\n        return new GitHubProvider(githubOptions, updater, runtimeOptions)\n      } else {\n        return new PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions)\n      }\n    }\n\n    case \"bitbucket\":\n      return new BitbucketProvider(data as BitbucketOptions, updater, runtimeOptions)\n\n    case \"keygen\":\n      return new KeygenProvider(data as KeygenOptions, updater, runtimeOptions)\n\n    case \"s3\":\n    case \"spaces\":\n      return new GenericProvider(\n        {\n          provider: \"generic\",\n          url: getS3LikeProviderBaseUrl(data),\n          channel: (data as BaseS3Options).channel || null,\n        },\n        updater,\n        {\n          ...runtimeOptions,\n          // https://github.com/minio/minio/issues/5285#issuecomment-350428955\n          isUseMultipleRangeRequest: false,\n        }\n      )\n\n    case \"generic\": {\n      const options = data as GenericServerOptions\n      return new GenericProvider(options, updater, {\n        ...runtimeOptions,\n        isUseMultipleRangeRequest: options.useMultipleRangeRequest !== false && isUrlProbablySupportMultiRangeRequests(options.url),\n      })\n    }\n\n    case \"custom\": {\n      const options = data as CustomPublishOptions\n      const constructor = options.updateProvider\n      if (!constructor) {\n        throw newError(\"Custom provider not specified\", \"ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION\")\n      }\n      return new constructor(options, updater, runtimeOptions)\n    }\n\n    default:\n      throw newError(`Unsupported provider: ${provider}`, \"ERR_UPDATER_UNSUPPORTED_PROVIDER\")\n  }\n}\n"]}
node_modules/electron-updater/out/MacUpdater.js.map:1:{"version":3,"file":"MacUpdater.js","sourceRoot":"","sources":["../src/MacUpdater.ts"],"names":[],"mappings":"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","sourcesContent":["import { AllPublishOptions, newError, safeStringifyJson } from \"builder-util-runtime\"\nimport { pathExistsSync, stat } from \"fs-extra\"\nimport { createReadStream, copyFileSync } from \"fs\"\nimport * as path from \"path\"\nimport { createServer, IncomingMessage, Server, ServerResponse } from \"http\"\nimport { AppAdapter } from \"./AppAdapter\"\nimport { AppUpdater, DownloadUpdateOptions } from \"./AppUpdater\"\nimport { ResolvedUpdateFileInfo, UpdateDownloadedEvent } from \"./main\"\nimport { findFile } from \"./providers/Provider\"\nimport AutoUpdater = Electron.AutoUpdater\nimport { execFileSync } from \"child_process\"\nimport { randomBytes } from \"crypto\"\n\nexport class MacUpdater extends AppUpdater {\n  private readonly nativeUpdater: AutoUpdater = require(\"electron\").autoUpdater\n\n  private squirrelDownloadedUpdate = false\n\n  private server?: Server\n\n  constructor(options?: AllPublishOptions, app?: AppAdapter) {\n    super(options, app)\n\n    this.nativeUpdater.on(\"error\", it => {\n      this._logger.warn(it)\n      this.emit(\"error\", it)\n    })\n    this.nativeUpdater.on(\"update-downloaded\", () => {\n      this.squirrelDownloadedUpdate = true\n      this.debug(\"nativeUpdater.update-downloaded\")\n    })\n  }\n\n  private debug(message: string): void {\n    if (this._logger.debug != null) {\n      this._logger.debug(message)\n    }\n  }\n\n  private closeServerIfExists() {\n    if (this.server) {\n      this.debug(\"Closing proxy server\")\n      this.server.close(err => {\n        if (err) {\n          this.debug(\"proxy server wasn't already open, probably attempted closing again as a safety check before quit\")\n        }\n      })\n    }\n  }\n\n  protected async doDownloadUpdate(downloadUpdateOptions: DownloadUpdateOptions): Promise<Array<string>> {\n    let files = downloadUpdateOptions.updateInfoAndProvider.provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info)\n\n    const log = this._logger\n\n    // detect if we are running inside Rosetta emulation\n    const sysctlRosettaInfoKey = \"sysctl.proc_translated\"\n    let isRosetta = false\n    try {\n      this.debug(\"Checking for macOS Rosetta environment\")\n      const result = execFileSync(\"sysctl\", [sysctlRosettaInfoKey], { encoding: \"utf8\" })\n      isRosetta = result.includes(`${sysctlRosettaInfoKey}: 1`)\n      log.info(`Checked for macOS Rosetta environment (isRosetta=${isRosetta})`)\n    } catch (e: any) {\n      log.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${e}`)\n    }\n\n    let isArm64Mac = false\n    try {\n      this.debug(\"Checking for arm64 in uname\")\n      const result = execFileSync(\"uname\", [\"-a\"], { encoding: \"utf8\" })\n      const isArm = result.includes(\"ARM\")\n      log.info(`Checked 'uname -a': arm64=${isArm}`)\n      isArm64Mac = isArm64Mac || isArm\n    } catch (e: any) {\n      log.warn(`uname shell command to check for arm64 failed: ${e}`)\n    }\n\n    isArm64Mac = isArm64Mac || process.arch === \"arm64\" || isRosetta\n\n    // allow arm64 macs to install universal or rosetta2(x64) - https://github.com/electron-userland/electron-builder/pull/5524\n    const isArm64 = (file: ResolvedUpdateFileInfo) => file.url.pathname.includes(\"arm64\") || file.info.url?.includes(\"arm64\")\n    if (isArm64Mac && files.some(isArm64)) {\n      files = files.filter(file => isArm64Mac === isArm64(file))\n    } else {\n      files = files.filter(file => !isArm64(file))\n    }\n\n    const zipFileInfo = findFile(files, \"zip\", [\"pkg\", \"dmg\"])\n\n    if (zipFileInfo == null) {\n      throw newError(`ZIP file not provided: ${safeStringifyJson(files)}`, \"ERR_UPDATER_ZIP_FILE_NOT_FOUND\")\n    }\n\n    const provider = downloadUpdateOptions.updateInfoAndProvider.provider\n    const CURRENT_MAC_APP_ZIP_FILE_NAME = \"update.zip\"\n\n    return this.executeDownload({\n      fileExtension: \"zip\",\n      fileInfo: zipFileInfo,\n      downloadUpdateOptions,\n      task: async (destinationFile, downloadOptions) => {\n        const cachedUpdateFilePath = path.join(this.downloadedUpdateHelper!.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME)\n        const canDifferentialDownload = () => {\n          if (!pathExistsSync(cachedUpdateFilePath)) {\n            log.info(\"Unable to locate previous update.zip for differential download (is this first install?), falling back to full download\")\n            return false\n          }\n          return !downloadUpdateOptions.disableDifferentialDownload\n        }\n        let differentialDownloadFailed = true\n        if (canDifferentialDownload()) {\n          differentialDownloadFailed = await this.differentialDownloadInstaller(zipFileInfo, downloadUpdateOptions, destinationFile, provider, CURRENT_MAC_APP_ZIP_FILE_NAME)\n        }\n\n        if (differentialDownloadFailed) {\n          await this.httpExecutor.download(zipFileInfo.url, destinationFile, downloadOptions)\n        }\n      },\n      done: event => {\n        if (!downloadUpdateOptions.disableDifferentialDownload) {\n          try {\n            const cachedUpdateFilePath = path.join(this.downloadedUpdateHelper!.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME)\n            copyFileSync(event.downloadedFile, cachedUpdateFilePath)\n          } catch (error: any) {\n            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${error.message}`)\n          }\n        }\n        return this.updateDownloaded(zipFileInfo, event)\n      },\n    })\n  }\n\n  private async updateDownloaded(zipFileInfo: ResolvedUpdateFileInfo, event: UpdateDownloadedEvent): Promise<Array<string>> {\n    const downloadedFile = event.downloadedFile\n    const updateFileSize = zipFileInfo.info.size ?? (await stat(downloadedFile)).size\n\n    const log = this._logger\n    const logContext = `fileToProxy=${zipFileInfo.url.href}`\n    this.closeServerIfExists()\n    this.debug(`Creating proxy server for native Squirrel.Mac (${logContext})`)\n    this.server = createServer()\n    this.debug(`Proxy server for native Squirrel.Mac is created (${logContext})`)\n    this.server.on(\"close\", () => {\n      log.info(`Proxy server for native Squirrel.Mac is closed (${logContext})`)\n    })\n\n    // must be called after server is listening, otherwise address is null\n    const getServerUrl = (s: Server): string => {\n      const address = s.address()\n      if (typeof address === \"string\") {\n        return address\n      }\n      return `http://127.0.0.1:${address?.port}`\n    }\n\n    return await new Promise<Array<string>>((resolve, reject) => {\n      const pass = randomBytes(64).toString(\"base64\").replace(/\\//g, \"_\").replace(/\\+/g, \"-\")\n      const authInfo = Buffer.from(`autoupdater:${pass}`, \"ascii\")\n\n      // insecure random is ok\n      const fileUrl = `/${randomBytes(64).toString(\"hex\")}.zip`\n      this.server!.on(\"request\", (request: IncomingMessage, response: ServerResponse) => {\n        const requestUrl = request.url!\n        log.info(`${requestUrl} requested`)\n        if (requestUrl === \"/\") {\n          // check for basic auth header\n          if (!request.headers.authorization || request.headers.authorization.indexOf(\"Basic \") === -1) {\n            response.statusCode = 401\n            response.statusMessage = \"Invalid Authentication Credentials\"\n            response.end()\n            log.warn(\"No authenthication info\")\n            return\n          }\n\n          // verify auth credentials\n          const base64Credentials = request.headers.authorization.split(\" \")[1]\n          const credentials = Buffer.from(base64Credentials, \"base64\").toString(\"ascii\")\n          const [username, password] = credentials.split(\":\")\n          if (username !== \"autoupdater\" || password !== pass) {\n            response.statusCode = 401\n            response.statusMessage = \"Invalid Authentication Credentials\"\n            response.end()\n            log.warn(\"Invalid authenthication credentials\")\n            return\n          }\n\n          const data = Buffer.from(`{ \"url\": \"${getServerUrl(this.server!)}${fileUrl}\" }`)\n          response.writeHead(200, { \"Content-Type\": \"application/json\", \"Content-Length\": data.length })\n          response.end(data)\n          return\n        }\n\n        if (!requestUrl.startsWith(fileUrl)) {\n          log.warn(`${requestUrl} requested, but not supported`)\n          response.writeHead(404)\n          response.end()\n          return\n        }\n\n        log.info(`${fileUrl} requested by Squirrel.Mac, pipe ${downloadedFile}`)\n\n        let errorOccurred = false\n        response.on(\"finish\", () => {\n          if (!errorOccurred) {\n            this.nativeUpdater.removeListener(\"error\", reject)\n            resolve([])\n          }\n        })\n\n        const readStream = createReadStream(downloadedFile)\n        readStream.on(\"error\", error => {\n          try {\n            response.end()\n          } catch (e: any) {\n            log.warn(`cannot end response: ${e}`)\n          }\n          errorOccurred = true\n          this.nativeUpdater.removeListener(\"error\", reject)\n          reject(new Error(`Cannot pipe \"${downloadedFile}\": ${error}`))\n        })\n\n        response.writeHead(200, {\n          \"Content-Type\": \"application/zip\",\n          \"Content-Length\": updateFileSize,\n        })\n        readStream.pipe(response)\n      })\n\n      this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${logContext})`)\n\n      this.server!.listen(0, \"127.0.0.1\", () => {\n        this.debug(`Proxy server for native Squirrel.Mac is listening (address=${getServerUrl(this.server!)}, ${logContext})`)\n        this.nativeUpdater.setFeedURL({\n          url: getServerUrl(this.server!),\n          headers: {\n            \"Cache-Control\": \"no-cache\",\n            Authorization: `Basic ${authInfo.toString(\"base64\")}`,\n          },\n        })\n\n        // The update has been downloaded and is ready to be served to Squirrel\n        this.dispatchUpdateDownloaded(event)\n\n        if (this.autoInstallOnAppQuit) {\n          this.nativeUpdater.once(\"error\", reject)\n          // This will trigger fetching and installing the file on Squirrel side\n          this.nativeUpdater.checkForUpdates()\n        } else {\n          resolve([])\n        }\n      })\n    })\n  }\n\n  quitAndInstall(): void {\n    if (this.squirrelDownloadedUpdate) {\n      // update already fetched by Squirrel, it's ready to install\n      this.nativeUpdater.quitAndInstall()\n      this.closeServerIfExists()\n    } else {\n      // Quit and install as soon as Squirrel get the update\n      this.nativeUpdater.on(\"update-downloaded\", () => {\n        this.nativeUpdater.quitAndInstall()\n        this.closeServerIfExists()\n      })\n\n      if (!this.autoInstallOnAppQuit) {\n        /**\n         * If this was not `true` previously then MacUpdater.doDownloadUpdate()\n         * would not actually initiate the downloading by electron's autoUpdater\n         */\n        this.nativeUpdater.checkForUpdates()\n      }\n    }\n  }\n}\n"]}
node_modules/builder-util-runtime/out/publishOptions.d.ts:55: * Define `GH_TOKEN` environment variable.
node_modules/builder-util-runtime/out/publishOptions.d.ts:90:     * Whether to use private github auto-update provider if `GH_TOKEN` environment variable is defined. See [Private GitHub Update Repo](./auto-update.md#private-github-update-repo).
node_modules/builder-util-runtime/out/publishOptions.js.map:1:{"version":3,"file":"publishOptions.js","sourceRoot":"","sources":["../src/publishOptions.ts"],"names":[],"mappings":";;AA2IA,8BAEC;AAgPD,4DASC;AA5PD,eAAe;AACf,SAAgB,SAAS,CAAC,OAAsB,EAAE,WAAW,GAAG,YAAY;IAC1E,OAAO,GAAG,OAAO,CAAC,QAAQ,IAAI,OAAO,MAAM,OAAO,CAAC,IAAI,IAAI,WAAW,EAAE,CAAA;AAC1E,CAAC;AAgPD,SAAgB,wBAAwB,CAAC,aAAmC;IAC1E,MAAM,QAAQ,GAAG,aAAa,CAAC,QAAQ,CAAA;IACvC,IAAI,QAAQ,KAAK,IAAI,EAAE,CAAC;QACtB,OAAO,KAAK,CAAC,aAA0B,CAAC,CAAA;IAC1C,CAAC;IACD,IAAI,QAAQ,KAAK,QAAQ,EAAE,CAAC;QAC1B,OAAO,SAAS,CAAC,aAA8B,CAAC,CAAA;IAClD,CAAC;IACD,MAAM,IAAI,KAAK,CAAC,2BAA2B,QAAQ,EAAE,CAAC,CAAA;AACxD,CAAC;AAED,SAAS,KAAK,CAAC,OAAkB;IAC/B,IAAI,GAAW,CAAA;IACf,IAAI,OAAO,CAAC,UAAU,IAAI,IAAI,EAAE,CAAC;QAC/B,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,8BAA8B,CAAA;IAC/D,CAAC;SAAM,IAAI,OAAO,CAAC,QAAQ,IAAI,IAAI,EAAE,CAAC;QACpC,GAAG,GAAG,GAAG,OAAO,CAAC,QAAQ,IAAI,OAAO,CAAC,MAAM,EAAE,CAAA;IAC/C,CAAC;SAAM,IAAI,OAAO,CAAC,MAAM,CAAC,QAAQ,CAAC,GAAG,CAAC,EAAE,CAAC;QACxC,IAAI,OAAO,CAAC,MAAM,IAAI,IAAI,EAAE,CAAC;YAC3B,MAAM,IAAI,KAAK,CAAC,gBAAgB,OAAO,CAAC,MAAM,4CAA4C,CAAC,CAAA;QAC7F,CAAC;QAED,wGAAwG;QACxG,IAAI,OAAO,CAAC,MAAM,KAAK,WAAW,EAAE,CAAC;YACnC,GAAG,GAAG,4BAA4B,OAAO,CAAC,MAAM,EAAE,CAAA;QACpD,CAAC;aAAM,CAAC;YACN,GAAG,GAAG,cAAc,OAAO,CAAC,MAAM,kBAAkB,OAAO,CAAC,MAAM,EAAE,CAAA;QACtE,CAAC;IACH,CAAC;SAAM,IAAI,OAAO,CAAC,MAAM,KAAK,YAAY,EAAE,CAAC;QAC3C,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,OAAO,OAAO,CAAC,MAAM,mBAAmB,CAAA;IACzE,CAAC;SAAM,CAAC;QACN,GAAG,GAAG,WAAW,OAAO,CAAC,MAAM,mBAAmB,CAAA;IACpD,CAAC;IACD,OAAO,UAAU,CAAC,GAAG,EAAE,OAAO,CAAC,IAAI,CAAC,CAAA;AACtC,CAAC;AAED,SAAS,UAAU,CAAC,GAAW,EAAE,CAA4B;IAC3D,IAAI,CAAC,IAAI,IAAI,IAAI,CAAC,CAAC,MAAM,GAAG,CAAC,EAAE,CAAC;QAC9B,IAAI,CAAC,CAAC,CAAC,UAAU,CAAC,GAAG,CAAC,EAAE,CAAC;YACvB,GAAG,IAAI,GAAG,CAAA;QACZ,CAAC;QACD,GAAG,IAAI,CAAC,CAAA;IACV,CAAC;IACD,OAAO,GAAG,CAAA;AACZ,CAAC;AAED,SAAS,SAAS,CAAC,OAAsB;IACvC,IAAI,OAAO,CAAC,IAAI,IAAI,IAAI,EAAE,CAAC;QACzB,MAAM,IAAI,KAAK,CAAC,iBAAiB,CAAC,CAAA;IACpC,CAAC;IACD,IAAI,OAAO,CAAC,MAAM,IAAI,IAAI,EAAE,CAAC;QAC3B,MAAM,IAAI,KAAK,CAAC,mBAAmB,CAAC,CAAA;IACtC,CAAC;IACD,OAAO,UAAU,CAAC,WAAW,OAAO,CAAC,IAAI,IAAI,OAAO,CAAC,MAAM,yBAAyB,EAAE,OAAO,CAAC,IAAI,CAAC,CAAA;AACrG,CAAC","sourcesContent":["import { OutgoingHttpHeaders } from \"http\"\n\nexport type PublishProvider = \"github\" | \"s3\" | \"spaces\" | \"generic\" | \"custom\" | \"snapStore\" | \"keygen\" | \"bitbucket\"\n\n// typescript-json-schema generates only PublishConfiguration if it is specified in the list, so, it is not added here\nexport type AllPublishOptions =\n  | string\n  | GithubOptions\n  | S3Options\n  | SpacesOptions\n  | GenericServerOptions\n  | CustomPublishOptions\n  | KeygenOptions\n  | SnapStoreOptions\n  | BitbucketOptions\n\nexport interface PublishConfiguration {\n  /**\n   * The provider.\n   */\n  readonly provider: PublishProvider\n\n  /**\n   * @private\n   * win-only\n   */\n  publisherName?: Array<string> | null\n\n  /**\n   * @private\n   * win-only\n   */\n  readonly updaterCacheDirName?: string | null\n\n  /**\n   * Whether to publish auto update info files.\n   *\n   * Auto update relies only on the first provider in the list (you can specify several publishers).\n   * Thus, probably, there`s no need to upload the metadata files for the other configured providers. But by default will be uploaded.\n   *\n   * @default true\n   */\n  readonly publishAutoUpdate?: boolean\n\n  /**\n   * Any custom request headers\n   */\n  readonly requestHeaders?: OutgoingHttpHeaders\n\n  /**\n   * Request timeout in milliseconds. (Default is 2 minutes; O is ignored)\n   *\n   * @default 120000\n   */\n  readonly timeout?: number | null\n}\n\n// https://github.com/electron-userland/electron-builder/issues/3261\nexport interface CustomPublishOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `custom`.\n   */\n  readonly provider: \"custom\"\n\n  /**\n   * The Provider to provide UpdateInfo regarding available updates.  Required\n   * to use custom providers with electron-updater.\n   */\n  updateProvider?: new (options: CustomPublishOptions, updater: any, runtimeOptions: any) => any\n\n  [index: string]: any\n}\n\n/**\n * [GitHub](https://help.github.com/articles/about-releases/) options.\n *\n * GitHub [personal access token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) is required. You can generate by going to [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new). The access token should have the repo scope/permission.\n * Define `GH_TOKEN` environment variable.\n */\nexport interface GithubOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `github`.\n   */\n  readonly provider: \"github\"\n\n  /**\n   * The repository name. [Detected automatically](#github-repository-and-bintray-package).\n   */\n  readonly repo?: string | null\n\n  /**\n   * The owner.\n   */\n  readonly owner?: string | null\n\n  /**\n   * Whether to use `v`-prefixed tag name.\n   * @default true\n   */\n  readonly vPrefixedTagName?: boolean\n\n  /**\n   * The host (including the port if need).\n   * @default github.com\n   */\n  readonly host?: string | null\n\n  /**\n   * The protocol. GitHub Publisher supports only `https`.\n   * @default https\n   */\n  readonly protocol?: \"https\" | \"http\" | null\n\n  /**\n   * The access token to support auto-update from private github repositories. Never specify it in the configuration files. Only for [setFeedURL](./auto-update.md#appupdatersetfeedurloptions).\n   */\n  readonly token?: string | null\n\n  /**\n   * Whether to use private github auto-update provider if `GH_TOKEN` environment variable is defined. See [Private GitHub Update Repo](./auto-update.md#private-github-update-repo).\n   */\n  readonly private?: boolean | null\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n\n  /**\n   * The type of release. By default `draft` release will be created.\n   *\n   * Also you can set release type using environment variable. If `EP_DRAFT`is set to `true` — `draft`, if `EP_PRE_RELEASE`is set to `true` — `prerelease`.\n   * @default draft\n   */\n  releaseType?: \"draft\" | \"prerelease\" | \"release\" | null\n}\n\n/** @private */\nexport function githubUrl(options: GithubOptions, defaultHost = \"github.com\") {\n  return `${options.protocol || \"https\"}://${options.host || defaultHost}`\n}\n\n/**\n * Generic (any HTTP(S) server) options.\n * In all publish options [File Macros](./file-patterns.md#file-macros) are supported.\n */\nexport interface GenericServerOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `generic`.\n   */\n  readonly provider: \"generic\"\n\n  /**\n   * The base url. e.g. `https://bucket_name.s3.amazonaws.com`.\n   */\n  readonly url: string\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n\n  /**\n   * Whether to use multiple range requests for differential update. Defaults to `true` if `url` doesn't contain `s3.amazonaws.com`.\n   */\n  readonly useMultipleRangeRequest?: boolean\n}\n\n/**\n * Keygen options.\n * https://keygen.sh/\n * Define `KEYGEN_TOKEN` environment variable.\n */\nexport interface KeygenOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `keygen`.\n   */\n  readonly provider: \"keygen\"\n\n  /**\n   * Keygen account's UUID\n   */\n  readonly account: string\n\n  /**\n   * Keygen product's UUID\n   */\n  readonly product: string\n\n  /**\n   * The channel.\n   * @default stable\n   */\n  readonly channel?: \"stable\" | \"rc\" | \"beta\" | \"alpha\" | \"dev\" | null\n\n  /**\n   * The target Platform. Is set programmatically explicitly during publishing.\n   */\n  readonly platform?: string | null\n}\n\n/**\n * Bitbucket options.\n * https://bitbucket.org/\n * Define `BITBUCKET_TOKEN` environment variable.\n *\n * For converting an app password to a usable token, you can utilize this\n```typescript\nconvertAppPassword(owner: string, appPassword: string) {\n  const base64encodedData = Buffer.from(`${owner}:${appPassword.trim()}`).toString(\"base64\")\n  return `Basic ${base64encodedData}`\n}\n```\n */\nexport interface BitbucketOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `bitbucket`.\n   */\n  readonly provider: \"bitbucket\"\n\n  /**\n   * Repository owner\n   */\n  readonly owner: string\n\n  /**\n   * The [app password](https://bitbucket.org/account/settings/app-passwords) to support auto-update from private bitbucket repositories.\n   */\n  readonly token?: string | null\n\n  /**\n   * The user name to support auto-update from private bitbucket repositories.\n   */\n  readonly username?: string | null\n\n  /**\n   * Repository slug/name\n   */\n  readonly slug: string\n\n  /**\n   * The channel.\n   * @default latest\n   */\n  readonly channel?: string | null\n}\n\n/**\n * [Snap Store](https://snapcraft.io/) options. To publish directly to Snapcraft, see <a href=\"https://snapcraft.io/docs/snapcraft-authentication\">Snapcraft authentication options</a> for local or CI/CD authentication options.\n */\nexport interface SnapStoreOptions extends PublishConfiguration {\n  /**\n   * The provider. Must be `snapStore`.\n   */\n  readonly provider: \"snapStore\"\n\n  /**\n   * snapcraft repo name\n   */\n  readonly repo?: string\n\n  /**\n   * The list of channels the snap would be released.\n   * @default [\"edge\"]\n   */\n  readonly channels?: string | Array<string> | null\n}\n\nexport interface BaseS3Options extends PublishConfiguration {\n  /**\n   * The update channel.\n   * @default latest\n   */\n  channel?: string | null\n\n  /**\n   * The directory path.\n   * @default /\n   */\n  readonly path?: string | null\n\n  /**\n   * The ACL. Set to `null` to not [add](https://github.com/electron-userland/electron-builder/issues/1822).\n   *\n   * @default public-read\n   */\n  readonly acl?: \"private\" | \"public-read\" | null\n}\n\n/**\n * [Amazon S3](https://aws.amazon.com/s3/) options.\n * AWS credentials are required, please see [getting your credentials](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-your-credentials.html).\n * Define `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` [environment variables](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html).\n * Or in the [~/.aws/credentials](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html).\n *\n * Example configuration:\n *\n```json\n{\n  \"build\":\n    \"publish\": {\n      \"provider\": \"s3\",\n      \"bucket\": \"bucket-name\"\n    }\n  }\n}\n```\n */\nexport interface S3Options extends BaseS3Options {\n  /**\n   * The provider. Must be `s3`.\n   */\n  readonly provider: \"s3\"\n\n  /**\n   * The bucket name.\n   */\n  readonly bucket: string\n\n  /**\n   * The region. Is determined and set automatically when publishing.\n   */\n  region?: string | null\n\n  /**\n   * The ACL. Set to `null` to not [add](https://github.com/electron-userland/electron-builder/issues/1822).\n   *\n   * Please see [required permissions for the S3 provider](https://github.com/electron-userland/electron-builder/issues/1618#issuecomment-314679128).\n   *\n   * @default public-read\n   */\n  readonly acl?: \"private\" | \"public-read\" | null\n\n  /**\n   * The type of storage to use for the object.\n   * @default STANDARD\n   */\n  readonly storageClass?: \"STANDARD\" | \"REDUCED_REDUNDANCY\" | \"STANDARD_IA\" | null\n\n  /**\n   * Server-side encryption algorithm to use for the object.\n   */\n  readonly encryption?: \"AES256\" | \"aws:kms\" | null\n\n  /**\n   * The endpoint URI to send requests to. The default endpoint is built from the configured region.\n   * The endpoint should be a string like `https://{service}.{region}.amazonaws.com`.\n   */\n  readonly endpoint?: string | null\n\n  /**\n   * If set to true, this will enable the s3 accelerated endpoint\n   * These endpoints have a particular format of:\n   *  ${bucketname}.s3-accelerate.amazonaws.com\n   */\n  readonly accelerate?: boolean\n}\n\n/**\n * [DigitalOcean Spaces](https://www.digitalocean.com/community/tutorials/an-introduction-to-digitalocean-spaces) options.\n * Access key is required, define `DO_KEY_ID` and `DO_SECRET_KEY` environment variables.\n */\nexport interface SpacesOptions extends BaseS3Options {\n  /**\n   * The provider. Must be `spaces`.\n   */\n  readonly provider: \"spaces\"\n\n  /**\n   * The space name.\n   */\n  readonly name: string\n\n  /**\n   * The region (e.g. `nyc3`).\n   */\n  readonly region: string\n}\n\nexport function getS3LikeProviderBaseUrl(configuration: PublishConfiguration) {\n  const provider = configuration.provider\n  if (provider === \"s3\") {\n    return s3Url(configuration as S3Options)\n  }\n  if (provider === \"spaces\") {\n    return spacesUrl(configuration as SpacesOptions)\n  }\n  throw new Error(`Not supported provider: ${provider}`)\n}\n\nfunction s3Url(options: S3Options) {\n  let url: string\n  if (options.accelerate == true) {\n    url = `https://${options.bucket}.s3-accelerate.amazonaws.com`\n  } else if (options.endpoint != null) {\n    url = `${options.endpoint}/${options.bucket}`\n  } else if (options.bucket.includes(\".\")) {\n    if (options.region == null) {\n      throw new Error(`Bucket name \"${options.bucket}\" includes a dot, but S3 region is missing`)\n    }\n\n    // special case, see http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html#access-bucket-intro\n    if (options.region === \"us-east-1\") {\n      url = `https://s3.amazonaws.com/${options.bucket}`\n    } else {\n      url = `https://s3-${options.region}.amazonaws.com/${options.bucket}`\n    }\n  } else if (options.region === \"cn-north-1\") {\n    url = `https://${options.bucket}.s3.${options.region}.amazonaws.com.cn`\n  } else {\n    url = `https://${options.bucket}.s3.amazonaws.com`\n  }\n  return appendPath(url, options.path)\n}\n\nfunction appendPath(url: string, p: string | null | undefined): string {\n  if (p != null && p.length > 0) {\n    if (!p.startsWith(\"/\")) {\n      url += \"/\"\n    }\n    url += p\n  }\n  return url\n}\n\nfunction spacesUrl(options: SpacesOptions) {\n  if (options.name == null) {\n    throw new Error(`name is missing`)\n  }\n  if (options.region == null) {\n    throw new Error(`region is missing`)\n  }\n  return appendPath(`https://${options.name}.${options.region}.digitaloceanspaces.com`, options.path)\n}\n"]}

exec
/bin/zsh -lc "nl -ba src/main/paths.ts | sed -n '1,220p'; printf '%s\\n' '--- ps hash ---'; cat src/shared/ps-script-hash.ts; printf '%s\\n' '--- App.tsx ---'; nl -ba src/renderer/src/App.tsx | sed -n '1,160p'; printf '%s\\n' '--- globals update/manifest classes ---'; grep -n \"fb-update\\|fb-report-manifest\\|fb-card\" -n src/renderer/src/styles/globals.css | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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
--- ps hash ---
// AUTO-GENERATED by scripts/embed-ps-hash.mjs — do not edit by hand.
// Run `npm run embed-ps-hash` (or any build/test/dev script) to refresh.
//
// SHA-256 of resources/powershell/Invoke-FormatBuddyScan.ps1, anchored in
// the bundled main code so an attacker cannot bypass the integrity check
// by editing an external manifest alongside the script.

export const EXPECTED_PS_SCRIPT_HASH = "79766731fcbaee5bac81a19f842a36b7add3f64b954606800ce3b8141015b78e";
--- App.tsx ---
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import { UpdateBanner } from "./components/UpdateBanner";
     6	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     7	
     8	type Phase =
     9	  | { kind: "home" }
    10	  | { kind: "scanning"; progress: ScanProgress }
    11	  | { kind: "report"; result: ScanResult }
    12	  | { kind: "error"; error: ScanError };
    13	
    14	const INITIAL_PROGRESS: ScanProgress = {
    15	  step: "준비",
    16	  doneSteps: 0,
    17	  totalSteps: 6,
    18	  score: 0,
    19	  elapsedMs: 0,
    20	  steps: [
    21	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    22	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    23	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    24	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    25	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    26	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    27	  ]
    28	};
    29	
    30	export function App() {
    31	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    32	  const [appVersion, setAppVersion] = useState<string>("");
    33	
    34	  useEffect(() => {
    35	    if (typeof window.fb?.appVersion === "function") {
    36	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    37	    }
    38	  }, []);
    39	
    40	  useEffect(() => {
    41	    if (!window.fb) return;
    42	    const offProgress = window.fb.onScanProgress((p) => {
    43	      setPhase((prev) =>
    44	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    45	      );
    46	    });
    47	    const offComplete = window.fb.onScanComplete((r) => {
    48	      setPhase({ kind: "report", result: r });
    49	    });
    50	    const offError = window.fb.onScanError((err) => {
    51	      setPhase({ kind: "error", error: err });
    52	    });
    53	    return () => {
    54	      offProgress();
    55	      offComplete();
    56	      offError();
    57	    };
    58	  }, []);
    59	
    60	  const startScan = useCallback(async () => {
    61	    if (!window.fb) {
    62	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    63	      return;
    64	    }
    65	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    66	    try {
    67	      await window.fb.startScan();
    68	    } catch {
    69	      // 에러는 onScanError 이벤트로 처리
    70	    }
    71	  }, []);
    72	
    73	  const cancelScan = useCallback(async () => {
    74	    if (!window.fb) return;
    75	    await window.fb.cancelScan();
    76	    setPhase({ kind: "home" });
    77	  }, []);
    78	
    79	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    80	
    81	  const content = useMemo(() => {
    82	    switch (phase.kind) {
    83	      case "home":
    84	        return <Home onStartScan={startScan} />;
    85	      case "scanning":
    86	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    87	      case "report":
    88	        return <Report result={phase.result} onBack={goHome} />;
    89	      case "error":
    90	        return (
    91	          <Scanning
    92	            progress={INITIAL_PROGRESS}
    93	            errorMessage={phase.error.message}
    94	            onCancel={goHome}
    95	            onRetry={startScan}
    96	          />
    97	        );
    98	    }
    99	  }, [phase, startScan, cancelScan, goHome]);
   100	
   101	  return (
   102	    <div className="fb-app">
   103	      {content}
   104	      <UpdateBanner />
   105	      <footer className="fb-app-footer">
   106	        <span>FormatBuddy Desktop</span>
   107	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   108	      </footer>
   109	    </div>
   110	  );
   111	}
--- globals update/manifest classes ---
76:.fb-update-banner {
88:.fb-update-banner-detail {
95:.fb-update-banner-quiet {
99:.fb-update-banner-ready {
103:.fb-update-banner-ready .fb-update-banner-detail { color: rgba(255,255,255,0.7); }
104:.fb-update-banner-ready .fb-btn-on-blue { margin-left: auto; }
488:.fb-card {
497:.fb-card h3 {
504:.fb-card-checklist { grid-column: span 2; }
555:.fb-report-manifest {
561:.fb-report-manifest .fb-h2 {

exec
/bin/zsh -lc 'git show --stat --oneline b4b9b73 && git show --stat --oneline 666888d' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4464ms:
2026-05-18 11:59:35.086 xcodebuild[75456:41419319]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:35.230 xcodebuild[75456:41419318] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-L1TR8hhU' (errno=Operation not permitted)
2026-05-18 11:59:35.775 xcodebuild[75464:41419481]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:35.924 xcodebuild[75464:41419358] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
b4b9b73 feat: in-app auto-update via electron-updater + GitHub Releases (v0.2.0)
 electron-builder.yml                         |  6 ++
 package-lock.json                            | 83 +++++++++++++++++++++---
 package.json                                 |  5 +-
 src/main/index.ts                            |  9 +++
 src/main/updater.ts                          | 97 ++++++++++++++++++++++++++++
 src/preload/index.ts                         | 43 +++++++++++-
 src/renderer/src/App.tsx                     |  2 +
 src/renderer/src/components/UpdateBanner.tsx | 88 +++++++++++++++++++++++++
 src/renderer/src/styles/globals.css          | 30 +++++++++
 src/shared/copy.ts                           |  8 ++-
 src/shared/ipc.ts                            |  9 ++-
 src/shared/types.ts                          | 17 +++++
 tests/ipc.test.ts                            | 12 +++-
 13 files changed, 393 insertions(+), 16 deletions(-)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-pzSi5ZvS' (errno=Operation not permitted)
2026-05-18 11:59:37.178 xcodebuild[75482:41419598]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:37.339 xcodebuild[75482:41419597] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-9qdMcBsu' (errno=Operation not permitted)
2026-05-18 11:59:37.918 xcodebuild[75484:41419608]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:38.132 xcodebuild[75484:41419607] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
666888d feat: winget export bundled in scan + backup manifest export (v0.3.0)
 package.json                                    |   2 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 244 ++++++++++++++++++------
 src/main/index.ts                               |  35 +++-
 src/main/scanner.ts                             | 103 ++++++++++
 src/preload/index.ts                            |   6 +-
 src/renderer/src/pages/Report.tsx               |  60 ++++++
 src/renderer/src/styles/globals.css             |  18 ++
 src/shared/copy.ts                              |  16 +-
 src/shared/ipc.ts                               |   3 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  31 +++
 tests/ipc.test.ts                               |   4 +
 12 files changed, 462 insertions(+), 62 deletions(-)

exec
/bin/zsh -lc "git diff --unified=60 b4b9b73..666888d -- src/main/index.ts src/main/scanner.ts resources/powershell/Invoke-FormatBuddyScan.ps1 src/renderer/src/pages/Report.tsx src/shared/types.ts src/shared/copy.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2068ms:
2026-05-18 11:59:45.039 xcodebuild[75578:41420312]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:45.200 xcodebuild[75578:41420311] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-tM1v1jpY' (errno=Operation not permitted)
2026-05-18 11:59:45.759 xcodebuild[75580:41420325]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 11:59:45.903 xcodebuild[75580:41420322] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/resources/powershell/Invoke-FormatBuddyScan.ps1 b/resources/powershell/Invoke-FormatBuddyScan.ps1
index 6d3b984..1b7c235 100644
--- a/resources/powershell/Invoke-FormatBuddyScan.ps1
+++ b/resources/powershell/Invoke-FormatBuddyScan.ps1
@@ -1,65 +1,72 @@
 # FormatBuddy local diagnostic prototype
 # Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
+#
+# Modes:
+#   -Mode quick     (default) full system diagnostics + installed apps + winget export summary
+#   -Mode manifest  per-user-folder SHA-256 manifest for backup/restore verification
 
 param(
-  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json"
+  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json",
+  [ValidateSet("quick", "manifest")]
+  [string]$Mode = "quick",
+  [int64]$ManifestMaxFileSizeBytes = 104857600
 )
 
 $ErrorActionPreference = "SilentlyContinue"
 $diagnostics = New-Object System.Collections.Generic.List[object]
 
 function Add-Diagnostic {
   param([string]$Step, [string]$Message)
   $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
 }
 
 function Get-SafeCimInstance {
   param([string]$ClassName)
   try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
 }
 
 function Get-InstalledApps {
   $paths = @(
     "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
     "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
     "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
   )
 
   foreach ($path in $paths) {
     Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
       [ordered]@{
         name = $_.DisplayName
         version = $_.DisplayVersion
         publisher = $_.Publisher
       }
     }
   }
 }
 
 function Test-NpkiLocation {
   $candidates = @(
     "$env:USERPROFILE\AppData\LocalLow\NPKI",
     "$env:USERPROFILE\AppData\Roaming\NPKI",
     "$env:SystemDrive\NPKI"
   )
 
   foreach ($path in $candidates) {
     [ordered]@{
       path = $path
       exists = Test-Path $path
     }
   }
 }
 
 function Get-FolderSizeGb {
   param([string]$Path)
 
   if (!(Test-Path $Path)) { return $null }
 
   try {
     $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
       Measure-Object -Property Length -Sum
 
     if ($null -eq $sum.Sum) { return 0 }
     return [Math]::Round($sum.Sum / 1GB, 2)
   } catch {
@@ -70,125 +77,252 @@ function Get-FolderSizeGb {
 
 function Get-UserFolders {
   $folders = @(
     @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
     @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
     @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
     @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
     @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
     @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
   )
 
   foreach ($folder in $folders) {
     $exists = Test-Path $folder.path
     [ordered]@{
       name = $folder.name
       path = $folder.path
       exists = $exists
       sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
     }
   }
 }
 
 function Get-CloudSyncCandidates {
   $candidates = @(
     @{ provider = "OneDrive"; path = $env:OneDrive },
     @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
     @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
     @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
     @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
   ) | Where-Object { $_.path }
 
   foreach ($candidate in $candidates) {
     [ordered]@{
       provider = $candidate.provider
       path = $candidate.path
       exists = Test-Path $candidate.path
     }
   }
 }
 
 function Get-BrowserPresence {
   $browsers = @(
     @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
     @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
     @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
     @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   )
 
   foreach ($browser in $browsers) {
     [ordered]@{
       name = $browser.name
       installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
     }
   }
 }
 
 function Get-WingetStatus {
   $winget = Get-Command winget -ErrorAction SilentlyContinue
   [ordered]@{
     available = [bool]$winget
-    note = if ($winget) { "winget is available. App export can be added in Phase 2." } else { "winget is not available on this PC." }
+    note = if ($winget) { "winget is available. App export captured in wingetExport." } else { "winget is not available on this PC." }
   }
 }
 
-$computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
-$os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
-$bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
-$cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
-$gpu = Get-SafeCimInstance Win32_VideoController
-$disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
-$printers = Get-SafeCimInstance Win32_Printer
-$drivers = Get-SafeCimInstance Win32_PnPSignedDriver
-$wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
-$bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
-
-$report = [ordered]@{
-  schemaVersion = "0.1.0"
-  generatedAt = (Get-Date).ToString("o")
-  privacy = [ordered]@{
-    localOnly = $true
-    noPasswordCollection = $true
-    noPrivateKeyUpload = $true
-    noBrowserPasswordExtraction = $true
+function Get-WingetExport {
+  $winget = Get-Command winget -ErrorAction SilentlyContinue
+  if (-not $winget) { return $null }
+
+  $tempBase = [System.IO.Path]::GetTempFileName()
+  Remove-Item $tempBase -Force -ErrorAction SilentlyContinue
+  $tempJson = "$tempBase.json"
+
+  try {
+    $null = & winget export -o $tempJson --accept-source-agreements --disable-interactivity 2>&1
+    if (Test-Path $tempJson) {
+      $raw = Get-Content -Raw -Path $tempJson -ErrorAction Stop
+      return ($raw | ConvertFrom-Json -Depth 16)
+    }
+  } catch {
+    Add-Diagnostic -Step "WingetExport" -Message $_.Exception.Message
+  } finally {
+    if (Test-Path $tempJson) { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
   }
-  system = [ordered]@{
-    manufacturer = $computer.Manufacturer
-    model = $computer.Model
-    serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
-    osCaption = $os.Caption
-    osVersion = $os.Version
-    cpu = $cpu.Name
-    memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
+
+  return $null
+}
+
+function Get-BackupManifest {
+  param(
+    [string[]]$Folders,
+    [int64]$MaxFileSize
+  )
+
+  $folderResults = New-Object System.Collections.Generic.List[object]
+
+  foreach ($folder in $Folders) {
+    if ([string]::IsNullOrWhiteSpace($folder)) { continue }
+    if (-not (Test-Path $folder)) {
+      $folderResults.Add([ordered]@{
+        folder = $folder
+        exists = $false
+        fileCount = 0
+        skippedCount = 0
+        totalBytes = 0
+        entries = @()
+        skipped = @()
+      }) | Out-Null
+      continue
+    }
+
+    $entries = New-Object System.Collections.Generic.List[object]
+    $skipped = New-Object System.Collections.Generic.List[object]
+    $folderNorm = $folder.TrimEnd('\','/')
+
+    Get-ChildItem -LiteralPath $folder -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
+      $rel = $_.FullName
+      if ($rel.StartsWith($folderNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
+        $rel = $rel.Substring($folderNorm.Length).TrimStart('\','/')
+      }
+
+      if ($_.Length -gt $MaxFileSize) {
+        $skipped.Add([ordered]@{
+          path = $rel
+          sizeBytes = $_.Length
+          reason = "exceeds-max-size"
+        }) | Out-Null
+        return
+      }
+
+      try {
+        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName -ErrorAction Stop
+        $entries.Add([ordered]@{
+          path = $rel
+          sizeBytes = $_.Length
+          sha256 = $hash.Hash
+          modifiedAt = $_.LastWriteTimeUtc.ToString("o")
+        }) | Out-Null
+      } catch {
+        $skipped.Add([ordered]@{
+          path = $rel
+          sizeBytes = $_.Length
+          reason = "hash-failed: $($_.Exception.Message)"
+        }) | Out-Null
+      }
+    }
+
+    $totalBytes = ($entries | Measure-Object -Property sizeBytes -Sum).Sum
+    if ($null -eq $totalBytes) { $totalBytes = 0 }
+
+    $folderResults.Add([ordered]@{
+      folder = $folder
+      exists = $true
+      fileCount = $entries.Count

exec
/bin/zsh -lc "grep -n \"autoInstallOnAppQuit\\|quitAndInstall\\|before-quit\" -n node_modules/electron-updater/out/AppUpdater.js node_modules/electron-updater/out/NsisUpdater.js node_modules/electron-updater/out/BaseUpdater.js | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
node_modules/electron-updater/out/AppUpdater.js:86:         * Whether to automatically install a downloaded update on app quit (if `quitAndInstall` was not called before).
node_modules/electron-updater/out/AppUpdater.js:88:        this.autoInstallOnAppQuit = true;
node_modules/electron-updater/out/BaseUpdater.js:9:        this.quitAndInstallCalled = false;
node_modules/electron-updater/out/BaseUpdater.js:12:    quitAndInstall(isSilent = false, isForceRunAfter = false) {
node_modules/electron-updater/out/BaseUpdater.js:13:        this._logger.info(`Install on explicit quitAndInstall`);
node_modules/electron-updater/out/BaseUpdater.js:18:                // this event is normally emitted when calling quitAndInstall, this emulates that
node_modules/electron-updater/out/BaseUpdater.js:19:                require("electron").autoUpdater.emit("before-quit-for-update");
node_modules/electron-updater/out/BaseUpdater.js:24:            this.quitAndInstallCalled = false;
node_modules/electron-updater/out/BaseUpdater.js:39:        if (this.quitAndInstallCalled) {
node_modules/electron-updater/out/BaseUpdater.js:40:            this._logger.warn("install call ignored: quitAndInstallCalled is set to true");
node_modules/electron-updater/out/BaseUpdater.js:58:        this.quitAndInstallCalled = true;
node_modules/electron-updater/out/BaseUpdater.js:74:        if (this.quitHandlerAdded || !this.autoInstallOnAppQuit) {
node_modules/electron-updater/out/BaseUpdater.js:79:            if (this.quitAndInstallCalled) {
node_modules/electron-updater/out/BaseUpdater.js:83:            if (!this.autoInstallOnAppQuit) {
node_modules/electron-updater/out/BaseUpdater.js:84:                this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");

exec
/bin/zsh -lc "nl -ba node_modules/electron-updater/out/BaseUpdater.js | sed -n '1,130p'; nl -ba node_modules/electron-updater/out/AppUpdater.js | sed -n '70,120p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	"use strict";
     2	Object.defineProperty(exports, "__esModule", { value: true });
     3	exports.BaseUpdater = void 0;
     4	const child_process_1 = require("child_process");
     5	const AppUpdater_1 = require("./AppUpdater");
     6	class BaseUpdater extends AppUpdater_1.AppUpdater {
     7	    constructor(options, app) {
     8	        super(options, app);
     9	        this.quitAndInstallCalled = false;
    10	        this.quitHandlerAdded = false;
    11	    }
    12	    quitAndInstall(isSilent = false, isForceRunAfter = false) {
    13	        this._logger.info(`Install on explicit quitAndInstall`);
    14	        // If NOT in silent mode use `autoRunAppAfterInstall` to determine whether to force run the app
    15	        const isInstalled = this.install(isSilent, isSilent ? isForceRunAfter : this.autoRunAppAfterInstall);
    16	        if (isInstalled) {
    17	            setImmediate(() => {
    18	                // this event is normally emitted when calling quitAndInstall, this emulates that
    19	                require("electron").autoUpdater.emit("before-quit-for-update");
    20	                this.app.quit();
    21	            });
    22	        }
    23	        else {
    24	            this.quitAndInstallCalled = false;
    25	        }
    26	    }
    27	    executeDownload(taskOptions) {
    28	        return super.executeDownload({
    29	            ...taskOptions,
    30	            done: event => {
    31	                this.dispatchUpdateDownloaded(event);
    32	                this.addQuitHandler();
    33	                return Promise.resolve();
    34	            },
    35	        });
    36	    }
    37	    // must be sync (because quit even handler is not async)
    38	    install(isSilent = false, isForceRunAfter = false) {
    39	        if (this.quitAndInstallCalled) {
    40	            this._logger.warn("install call ignored: quitAndInstallCalled is set to true");
    41	            return false;
    42	        }
    43	        const downloadedUpdateHelper = this.downloadedUpdateHelper;
    44	        // Get the installer path, ensuring spaces are escaped on Linux
    45	        // 1. Check if downloadedUpdateHelper is not null
    46	        // 2. Check if downloadedUpdateHelper.file is not null
    47	        // 3. If both checks pass:
    48	        //    a. If the platform is Linux, replace spaces with '\ ' for shell compatibility
    49	        //    b. If the platform is not Linux, use the original path
    50	        // 4. If any check fails, set installerPath to null
    51	        const installerPath = downloadedUpdateHelper && downloadedUpdateHelper.file ? (process.platform === "linux" ? downloadedUpdateHelper.file.replace(/ /g, "\\ ") : downloadedUpdateHelper.file) : null;
    52	        const downloadedFileInfo = downloadedUpdateHelper == null ? null : downloadedUpdateHelper.downloadedFileInfo;
    53	        if (installerPath == null || downloadedFileInfo == null) {
    54	            this.dispatchError(new Error("No valid update available, can't quit and install"));
    55	            return false;
    56	        }
    57	        // prevent calling several times
    58	        this.quitAndInstallCalled = true;
    59	        try {
    60	            this._logger.info(`Install: isSilent: ${isSilent}, isForceRunAfter: ${isForceRunAfter}`);
    61	            return this.doInstall({
    62	                installerPath,
    63	                isSilent,
    64	                isForceRunAfter,
    65	                isAdminRightsRequired: downloadedFileInfo.isAdminRightsRequired,
    66	            });
    67	        }
    68	        catch (e) {
    69	            this.dispatchError(e);
    70	            return false;
    71	        }
    72	    }
    73	    addQuitHandler() {
    74	        if (this.quitHandlerAdded || !this.autoInstallOnAppQuit) {
    75	            return;
    76	        }
    77	        this.quitHandlerAdded = true;
    78	        this.app.onQuit(exitCode => {
    79	            if (this.quitAndInstallCalled) {
    80	                this._logger.info("Update installer has already been triggered. Quitting application.");
    81	                return;
    82	            }
    83	            if (!this.autoInstallOnAppQuit) {
    84	                this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
    85	                return;
    86	            }
    87	            if (exitCode !== 0) {
    88	                this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${exitCode}`);
    89	                return;
    90	            }
    91	            this._logger.info("Auto install update on quit");
    92	            this.install(true, false);
    93	        });
    94	    }
    95	    wrapSudo() {
    96	        const { name } = this.app;
    97	        const installComment = `"${name} would like to update"`;
    98	        const sudo = this.spawnSyncLog("which gksudo || which kdesudo || which pkexec || which beesu");
    99	        const command = [sudo];
   100	        if (/kdesudo/i.test(sudo)) {
   101	            command.push("--comment", installComment);
   102	            command.push("-c");
   103	        }
   104	        else if (/gksudo/i.test(sudo)) {
   105	            command.push("--message", installComment);
   106	        }
   107	        else if (/pkexec/i.test(sudo)) {
   108	            command.push("--disable-internal-agent");
   109	        }
   110	        return command.join(" ");
   111	    }
   112	    spawnSyncLog(cmd, args = [], env = {}) {
   113	        this._logger.info(`Executing: ${cmd} with args: ${args}`);
   114	        const response = (0, child_process_1.spawnSync)(cmd, args, {
   115	            env: { ...process.env, ...env },
   116	            encoding: "utf-8",
   117	            shell: true,
   118	        });
   119	        return response.stdout.trim();
   120	    }
   121	    /**
   122	     * This handles both node 8 and node 10 way of emitting error when spawning a process
   123	     *   - node 8: Throws the error
   124	     *   - node 10: Emit the error(Need to listen with on)
   125	     */
   126	    // https://github.com/electron-userland/electron-builder/issues/1129
   127	    // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
   128	    async spawnLog(cmd, args = [], env = undefined, stdio = "ignore") {
   129	        this._logger.info(`Executing: ${cmd} with args: ${args}`);
   130	        return new Promise((resolve, reject) => {
    70	    /**
    71	     * test only
    72	     * @private
    73	     */
    74	    set updateConfigPath(value) {
    75	        this.clientPromise = null;
    76	        this._appUpdateConfigPath = value;
    77	        this.configOnDisk = new lazy_val_1.Lazy(() => this.loadUpdateConfig());
    78	    }
    79	    constructor(options, app) {
    80	        super();
    81	        /**
    82	         * Whether to automatically download an update when it is found.
    83	         */
    84	        this.autoDownload = true;
    85	        /**
    86	         * Whether to automatically install a downloaded update on app quit (if `quitAndInstall` was not called before).
    87	         */
    88	        this.autoInstallOnAppQuit = true;
    89	        /**
    90	         * *windows-only* Whether to run the app after finish install when run the installer NOT in silent mode.
    91	         * @default true
    92	         */
    93	        this.autoRunAppAfterInstall = true;
    94	        /**
    95	         * *GitHub provider only.* Whether to allow update to pre-release versions. Defaults to `true` if application version contains prerelease components (e.g. `0.12.1-alpha.1`, here `alpha` is a prerelease component), otherwise `false`.
    96	         *
    97	         * If `true`, downgrade will be allowed (`allowDowngrade` will be set to `true`).
    98	         */
    99	        this.allowPrerelease = false;
   100	        /**
   101	         * *GitHub provider only.* Get all release notes (from current version to latest), not just the latest.
   102	         * @default false
   103	         */
   104	        this.fullChangelog = false;
   105	        /**
   106	         * Whether to allow version downgrade (when a user from the beta channel wants to go back to the stable channel).
   107	         *
   108	         * Taken in account only if channel differs (pre-release version component in terms of semantic versioning).
   109	         *
   110	         * @default false
   111	         */
   112	        this.allowDowngrade = false;
   113	        /**
   114	         * Web installer files might not have signature verification, this switch prevents to load them unless it is needed.
   115	         *
   116	         * Currently false to prevent breaking the current API, but it should be changed to default true at some point that
   117	         * breaking changes are allowed.
   118	         *
   119	         * @default false
   120	         */

exec
/bin/zsh -lc 'command -v pwsh || command -v powershell || true' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
codex
The new surface has several actionable issues that affect the shipped features: private GitHub updates are not reachable by clients, updater events can get stuck on a destroyed window, and manifest export can falsely report success or recurse through junctions. These should be fixed before marking v0.3.0 as stable preview.

Full review comments:

- [P1] Use an update feed reachable by packaged clients — /Users/ryanbak/claude/formatbuddy/desktop/electron-builder.yml:50-54
  With the repo still private, this plain GitHub publish config makes electron-updater use unauthenticated GitHub release/feed URLs in packaged apps, so clients without a runtime `GH_TOKEN` will get 404/authorization failures and auto-update will never find v0.3.0. Publish updates from a public/generic feed or configure a private-update strategy that packaged clients can actually authenticate to.

- [P2] Rebind updater events when the window is recreated — /Users/ryanbak/claude/formatbuddy/desktop/src/main/updater.ts:19-21
  On macOS, closing all windows keeps the app running; after `activate` creates a new `BrowserWindow`, this guard returns early and all updater listeners still close over the destroyed old window, so the new window will never receive available/downloaded/error events. Track the current window separately or rebind the send target when the old window closes.

- [P2] Verify manifest output before reporting success — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:449-457
  If the user chooses a protected or invalid save location, the PowerShell script runs with `$ErrorActionPreference = "SilentlyContinue"`, so `Out-File` can fail without a non-zero exit code; this close handler then resolves `{ saved: true }` even though no manifest was written. Make the write error terminating in PowerShell or `stat`/read the selected output path before returning success.

- [P2] Exclude reparse-point folders from manifest recursion — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:191-191
  On Windows user folders can contain symlinks/junctions, and this recursive walk does not filter reparse points; a junction back into the same tree or into a large/system tree can make manifest export hang, duplicate files, or hash paths outside the intended backup set. Skip `ReparsePoint` directories/files or keep a visited-target set before hashing.
The new surface has several actionable issues that affect the shipped features: private GitHub updates are not reachable by clients, updater events can get stuck on a destroyed window, and manifest export can falsely report success or recurse through junctions. These should be fixed before marking v0.3.0 as stable preview.

Full review comments:

- [P1] Use an update feed reachable by packaged clients — /Users/ryanbak/claude/formatbuddy/desktop/electron-builder.yml:50-54
  With the repo still private, this plain GitHub publish config makes electron-updater use unauthenticated GitHub release/feed URLs in packaged apps, so clients without a runtime `GH_TOKEN` will get 404/authorization failures and auto-update will never find v0.3.0. Publish updates from a public/generic feed or configure a private-update strategy that packaged clients can actually authenticate to.

- [P2] Rebind updater events when the window is recreated — /Users/ryanbak/claude/formatbuddy/desktop/src/main/updater.ts:19-21
  On macOS, closing all windows keeps the app running; after `activate` creates a new `BrowserWindow`, this guard returns early and all updater listeners still close over the destroyed old window, so the new window will never receive available/downloaded/error events. Track the current window separately or rebind the send target when the old window closes.

- [P2] Verify manifest output before reporting success — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:449-457
  If the user chooses a protected or invalid save location, the PowerShell script runs with `$ErrorActionPreference = "SilentlyContinue"`, so `Out-File` can fail without a non-zero exit code; this close handler then resolves `{ saved: true }` even though no manifest was written. Make the write error terminating in PowerShell or `stat`/read the selected output path before returning success.

- [P2] Exclude reparse-point folders from manifest recursion — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:191-191
  On Windows user folders can contain symlinks/junctions, and this recursive walk does not filter reparse points; a junction back into the same tree or into a large/system tree can make manifest export hang, duplicate files, or hash paths outside the intended backup set. Skip `ReparsePoint` directories/files or keep a visited-target set before hashing.
