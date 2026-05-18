OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e39cf-f287-7890-8bf6-f1f563d4c3a8
--------
user
# Code review — FormatBuddy Desktop v0.5.x design overhaul

The v0.5.x train (v0.5.0 → v0.5.3) implements the v0.4.2 design handoff
(`design_handoff_format_buddy_app/`). Skip everything you've already
cleared in v0.1–v0.4 reviews — focus only on the new surface.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (PUBLIC)
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`
- Last commit: `0513911` (v0.5.3)
- Handoff source: `/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/`

## v0.5.x changes

### v0.5.0 — Severity system rewrite
- shared/types.ts: FormatSeverity union now safe/watch/organize/format
  (was healthy/watch/format-recommended/format-required)
- shared/copy.ts: recommendSeverity is now a structured table
  `{ chip, head, sub }` per severity — single source for headline/summary
- main/recommend.ts: getSeverity uses quartile boundaries ≤25/≤50/≤75/else.
  applyDiskHealthOverride renamed targets (organize / watch).
  getHeadline/getSummary now lookup copy table, no more score-interp.
- renderer/Report.tsx severityClass maps to .fb-score-safe/-watch/-organize/-format
- renderer/styles/globals.css: 4 new tone variables
  --color-fb-tone-safe (#2DC9A8 mint) → -watch (#1EA0D6 teal) → -organize
  (brand blue) → -format (deep blue). Score number + badge dot consume
  --score-tone CSS variable.
- tests/recommend.test.ts: 22/22 pass (thresholds + names migrated)

### v0.5.1 — WinChrome + TopBar (frameless window)
- main/index.ts: `frame: false`, IPC handlers window:minimize / -maximize-toggle / -close + window:state push on (un)maximize
- shared/ipc.ts: 4 new channels
- preload: minimizeWindow / toggleMaximizeWindow / closeWindow / onWindowState
- renderer/components/WinChrome.tsx — 32px bar, CloudBuddy 14px + title left, 3 caption buttons right. Restore glyph swaps when isMaximized.
- renderer/components/TopBar.tsx — breadcrumb + meta + version, shown on every screen except Home (and Onboarding from v0.5.2).
- renderer/App.tsx layout reflowed: WinChrome (always) → TopBar (conditional) → fb-app-body (scrollable) → UpdateBanner → footer
- globals.css uses -webkit-app-region: drag on .fb-win-chrome and no-drag on caption buttons; .fb-app uses height: 100vh + overflow: hidden so chrome stays put.

### v0.5.2 — Onboarding + ErrorScreen
- renderer/pages/Onboarding.tsx — 3-step intro, 2-col (copy left, CloudBuddy on solid blue right). Step expression maps smile/calm/wink, step 1 is animated. Buttons: 다음/시작하기/건너뛰기.
- renderer/pages/ErrorScreen.tsx — replaces inline red banner. CloudBuddy 108 calm + soft headline + 다시 시도/처음으로 + collapsible 기술 정보 detail block.
- App.tsx: Phase union extended with "onboarding". Initial phase read from localStorage["formatbuddy:onboardingSeenAt"]; markOnboardingSeen() runs on completion or skip.
- shared/copy.ts: onboardingSteps array + error* strings.

### v0.5.3 — ScoreHero CloudBuddy + .heavy + [실행] IPC
- src/main/index.ts new helper `runActionCommand(rawCommand)`:
  - URL schemes ms-settings: / windowsdefender: / ms-store: / ms-availablenetworks: / https: → shell.openExternal
  - `start <deep-link>` form → extract URL and openExternal
  - everything else → clipboard.writeText(command) + return mode "copied-to-clipboard"
  - rejected with mode "rejected" on errors/empty
  - **explicit decision: no shell spawn from renderer-supplied commands.**
- shared/ipc.ts new channel action:run; shared/types.ts new ActionRunResult union
- preload: runActionCommand(command)
- renderer/Report.tsx:
  - ScoreHero now embeds CloudBuddy 88px (variant primary, expression mapped from score, animated only on safe)
  - Each tryFirst / afterFormat action's command renders a 28px outlined pill `[실행]` button next to the chip
  - formatReasons whose weightedScore ≥ 5 render with .fb-advice-weight-heavy (solid brand-blue + white)
- globals.css: .fb-score-card-buddy split, .fb-advice-cmd-row, .fb-run-btn, .fb-run-status, .fb-advice-weight-heavy

## Specifically check

1. **Severity tone color contrast / accessibility**
   - mint #2DC9A8 used at 96px on white — large text, contrast ratio?
   - teal #1EA0D6 at the same size?
   - badge text uses --score-tone on white — small text contrast on watch/safe?

2. **Action runner whitelist**
   - SAFE_URL_SCHEMES regex covers ms-settings|windowsdefender|ms-store|ms-availablenetworks|https. Anything dangerous slip through? javascript:, file:, data:, mailto:?
   - DEEP_LINK_FROM_SHELL regex `^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i` — escape, quoting, multi-arg variants?
   - clipboard fallback for non-URL — anything we should refuse outright?

3. **Frameless window + drag region**
   - `-webkit-app-region: drag` on .fb-win-chrome + no-drag on captions — buttons clickable on all OSes?
   - macOS dev mode: are drag and close still reliable?
   - When body content overflows, does the scrollbar interfere with the chrome drag region?

4. **Onboarding gating**
   - localStorage read in initial useState — SSR concern? React strict-mode double-init? Stale flag from a previous user on shared PC?
   - "건너뛰기" still marks seen — desired?
   - any way for a malformed value to bypass the check?

5. **ScoreHero CloudBuddy**
   - expressionForScore boundaries: ≥76 calm, ≥26 smile, else wink. Match handoff (handoff said ≥76 calm / 26-75 smile / ≤25 wink — equivalent).
   - animated only on safe — feels right? off on watch/organize/format intentionally?

6. **Heavy weight threshold**
   - weightedScore ≥ 5 → heavy. With current weights (max single weighted = 30 for diskHealth), is 5 too low? Anything ever marked "heavy" that shouldn't be?

7. **Anything else that smells**
   - copy.ts tone violations ("스캔", "리셋", "필수" etc) — any slipped in?
   - new components missing aria / keyboard nav?
   - new IPC channels overlapping with existing ones?

## Output format

Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). file:line + 1-line
fix. **If zero new issues, say so explicitly so I can mark v0.5.3 as the
stable design preview and stop the cycle.**
2026-05-18T06:39:50.444615Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T06:39:50.691736Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse --show-toplevel && git log --oneline -5' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 6500ms:
2026-05-18 15:40:07.336 xcodebuild[4727:41802005]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:07.604 xcodebuild[4727:41802002] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-gNv8Idjc' (errno=Operation not permitted)
2026-05-18 15:40:08.229 xcodebuild[4729:41802020]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:08.392 xcodebuild[4729:41802019] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v0.5.x.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-BlBFgZam' (errno=Operation not permitted)
2026-05-18 15:40:09.621 xcodebuild[4740:41802136]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:09.769 xcodebuild[4740:41802135] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-aFj0Zc4Q' (errno=Operation not permitted)
2026-05-18 15:40:10.313 xcodebuild[4742:41802147]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:10.457 xcodebuild[4742:41802145] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
/Users/ryanbak/claude/formatbuddy/desktop
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-NPgqtp0G' (errno=Operation not permitted)
2026-05-18 15:40:11.673 xcodebuild[4746:41802170]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:11.820 xcodebuild[4746:41802169] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-n8FeG3c5' (errno=Operation not permitted)
2026-05-18 15:40:12.364 xcodebuild[4748:41802188]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:12.518 xcodebuild[4748:41802187] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
0513911 feat(ui): ScoreHero CloudBuddy + .heavy reasons + [실행] IPC (v0.5.3)
d4ae8ac feat(ui): Onboarding 3-step + ErrorScreen 정식 화면 (v0.5.2)
fe7668f feat(ui): WinChrome + TopBar (v0.5.1)
ee71585 feat(design): severity system v0.5.0 — care-intensity frame (mint→deep-blue)
372f073 fix: 5 Codex v0.4.0 findings — recommendation accuracy + PowerShell correctness (v0.4.1)

exec
/bin/zsh -lc 'git diff --stat 372f073..0513911 && git diff --name-only 372f073..0513911' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4098ms:
2026-05-18 15:40:20.836 xcodebuild[4794:41802597]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:20.987 xcodebuild[4794:41802596] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-YQDasooJ' (errno=Operation not permitted)
2026-05-18 15:40:21.539 xcodebuild[4796:41802608]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:21.690 xcodebuild[4796:41802607] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 package.json                              |   2 +-
 src/main/index.ts                         |  76 +++++-
 src/main/recommend.ts                     |  48 ++--
 src/preload/index.ts                      |  20 +-
 src/renderer/src/App.tsx                  |  61 ++++-
 src/renderer/src/components/TopBar.tsx    |  46 ++++
 src/renderer/src/components/WinChrome.tsx |  79 ++++++
 src/renderer/src/pages/ErrorScreen.tsx    |  51 ++++
 src/renderer/src/pages/Onboarding.tsx     |  53 ++++
 src/renderer/src/pages/Report.tsx         | 108 ++++++--
 src/renderer/src/styles/globals.css       | 404 ++++++++++++++++++++++++++++--
 src/shared/copy.ts                        |  68 ++++-
 src/shared/ipc.ts                         |   7 +-
 src/shared/types.ts                       |  22 +-
 tests/recommend.test.ts                   |  42 ++--
 15 files changed, 973 insertions(+), 114 deletions(-)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-1EHI5jo7' (errno=Operation not permitted)
2026-05-18 15:40:22.905 xcodebuild[4800:41802660]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:23.053 xcodebuild[4800:41802659] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-UTY6ERfj' (errno=Operation not permitted)
2026-05-18 15:40:23.598 xcodebuild[4802:41802668]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:23.745 xcodebuild[4802:41802667] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
package.json
src/main/index.ts
src/main/recommend.ts
src/preload/index.ts
src/renderer/src/App.tsx
src/renderer/src/components/TopBar.tsx
src/renderer/src/components/WinChrome.tsx
src/renderer/src/pages/ErrorScreen.tsx
src/renderer/src/pages/Onboarding.tsx
src/renderer/src/pages/Report.tsx
src/renderer/src/styles/globals.css
src/shared/copy.ts
src/shared/ipc.ts
src/shared/types.ts
tests/recommend.test.ts

exec
/bin/zsh -lc "nl -ba src/main/index.ts | sed -n '1,260p'
printf '\\n--- shared/ipc.ts ---\\n'
nl -ba src/shared/ipc.ts | sed -n '1,220p'
printf '\\n--- preload ---\\n'
nl -ba src/preload/index.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type {
     7	  ActionRunResult,
     8	  ExportOptions,
     9	  ExportResult,
    10	  ManifestExportResult,
    11	  ScanError,
    12	  ScanProgress,
    13	  ScanResult
    14	} from "@shared/types";
    15	
    16	/**
    17	 * Whitelist of safe URL schemes that we let `shell.openExternal` hand to
    18	 * the OS. ms-settings: deep links open the Settings app at the right pane
    19	 * (e.g. Windows Update, Storage Sense, Defender) — no shell injection
    20	 * surface. Anything else falls back to "copy to clipboard" so the user
    21	 * can review and paste manually.
    22	 */
    23	const SAFE_URL_SCHEMES = /^(ms-settings|windowsdefender|ms-store|ms-availablenetworks|https):/i;
    24	const DEEP_LINK_FROM_SHELL = /^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i;
    25	
    26	async function runActionCommand(rawCommand: string): Promise<ActionRunResult> {
    27	  const trimmed = (rawCommand ?? "").trim();
    28	  if (!trimmed) return { mode: "rejected", detail: "empty command" };
    29	
    30	  // 1) bare URL scheme → openExternal
    31	  if (SAFE_URL_SCHEMES.test(trimmed)) {
    32	    try {
    33	      await shell.openExternal(trimmed);
    34	      return { mode: "opened-url", detail: trimmed };
    35	    } catch (e) {
    36	      return { mode: "rejected", detail: (e as Error).message };
    37	    }
    38	  }
    39	
    40	  // 2) `start ms-settings:…` form → extract URL and openExternal
    41	  const deepLink = trimmed.match(DEEP_LINK_FROM_SHELL);
    42	  if (deepLink) {
    43	    try {
    44	      await shell.openExternal(deepLink[1]);
    45	      return { mode: "opened-url", detail: deepLink[1] };
    46	    } catch (e) {
    47	      return { mode: "rejected", detail: (e as Error).message };
    48	    }
    49	  }
    50	
    51	  // 3) anything else (cleanmgr, sfc, DISM, taskmgr, winget …) → clipboard.
    52	  // We refuse to spawn shell commands directly; the user reviews and pastes.
    53	  clipboard.writeText(trimmed);
    54	  return { mode: "copied-to-clipboard", detail: trimmed };
    55	}
    56	import { runBackupManifest, runScan } from "./scanner";
    57	import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
    58	import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";
    59	
    60	let mainWindow: BrowserWindow | null = null;
    61	let activeAbort: AbortController | null = null;
    62	
    63	const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
    64	
    65	function createWindow() {
    66	  mainWindow = new BrowserWindow({
    67	    width: 1080,
    68	    height: 760,
    69	    minWidth: 880,
    70	    minHeight: 640,
    71	    show: false,
    72	    autoHideMenuBar: true,
    73	    frame: false, // v0.5.1 — custom WinChrome handles min/max/close
    74	    backgroundColor: "#FFFFFF",
    75	    title: "FormatBuddy",
    76	    webPreferences: {
    77	      preload: join(__dirname, "..", "preload", "index.js"),
    78	      contextIsolation: true,
    79	      nodeIntegration: false,
    80	      sandbox: true
    81	    }
    82	  });
    83	
    84	  mainWindow.on("ready-to-show", () => {
    85	    mainWindow?.show();
    86	  });
    87	
    88	  const emitWindowState = () => {
    89	    if (!mainWindow || mainWindow.isDestroyed()) return;
    90	    mainWindow.webContents.send(IpcChannels.windowState, {
    91	      isMaximized: mainWindow.isMaximized()
    92	    });
    93	  };
    94	  mainWindow.on("maximize", emitWindowState);
    95	  mainWindow.on("unmaximize", emitWindowState);
    96	
    97	  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    98	    try {
    99	      const parsed = new URL(url);
   100	      if (parsed.protocol === "https:") {
   101	        void shell.openExternal(url);
   102	      }
   103	    } catch {
   104	      // ignore malformed URLs
   105	    }
   106	    return { action: "deny" };
   107	  });
   108	
   109	  const devUrl = process.env.ELECTRON_RENDERER_URL;
   110	  if (!app.isPackaged && devUrl && DEV_RENDERER_PATTERN.test(devUrl)) {
   111	    void mainWindow.loadURL(devUrl);
   112	  } else {
   113	    void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
   114	  }
   115	}
   116	
   117	function registerIpc() {
   118	  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
   119	
   120	  ipcMain.handle(IpcChannels.scanStart, async (event) => {
   121	    if (activeAbort) activeAbort.abort();
   122	    const controller = new AbortController();
   123	    activeAbort = controller;
   124	    const sender = event.sender;
   125	
   126	    const emit = (progress: ScanProgress) => {
   127	      if (sender.isDestroyed() || controller.signal.aborted) return;
   128	      sender.send(IpcChannels.scanProgress, progress);
   129	    };
   130	
   131	    try {
   132	      const result: ScanResult = await runScan({
   133	        scriptPath: getScanScriptPath(),
   134	        outputDir: getScanOutputDir(),
   135	        signal: controller.signal,
   136	        onProgress: emit,
   137	        enforceIntegrity: app.isPackaged
   138	      });
   139	      if (!sender.isDestroyed() && !controller.signal.aborted) {
   140	        sender.send(IpcChannels.scanComplete, result);
   141	      }
   142	      return result;
   143	    } catch (err) {
   144	      const e = err as Error;
   145	      const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
   146	      const payload: ScanError = {
   147	        message: e.message,
   148	        code: (e as NodeJS.ErrnoException).code ?? undefined,
   149	        detail: e.stack
   150	      };
   151	      if (!isAbort && !sender.isDestroyed()) {
   152	        sender.send(IpcChannels.scanError, payload);
   153	      }
   154	      throw payload;
   155	    } finally {
   156	      if (activeAbort === controller) activeAbort = null;
   157	    }
   158	  });
   159	
   160	  ipcMain.handle(IpcChannels.scanCancel, () => {
   161	    if (activeAbort) {
   162	      activeAbort.abort();
   163	      activeAbort = null;
   164	      return true;
   165	    }
   166	    return false;
   167	  });
   168	
   169	  ipcMain.handle(
   170	    IpcChannels.reportExport,
   171	    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
   172	      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
   173	      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   174	      const dialogResult = await dialog.showSaveDialog(win!, {
   175	        title: "리포트 JSON 저장",
   176	        defaultPath,
   177	        filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
   178	      });
   179	      if (dialogResult.canceled || !dialogResult.filePath) {
   180	        return { saved: false };
   181	      }
   182	      await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
   183	      return { saved: true, path: dialogResult.filePath };
   184	    }
   185	  );
   186	
   187	  ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
   188	    await shell.openExternal(getWebReportImportUrl());
   189	    return true;
   190	  });
   191	
   192	  ipcMain.handle(IpcChannels.updateInstall, () => {
   193	    installAndRestart();
   194	    return true;
   195	  });
   196	
   197	  ipcMain.handle(IpcChannels.windowMinimize, () => {
   198	    BrowserWindow.getFocusedWindow()?.minimize();
   199	    return true;
   200	  });
   201	
   202	  ipcMain.handle(IpcChannels.windowMaximizeToggle, () => {
   203	    const win = BrowserWindow.getFocusedWindow();
   204	    if (!win) return false;
   205	    if (win.isMaximized()) win.unmaximize();
   206	    else win.maximize();
   207	    return win.isMaximized();
   208	  });
   209	
   210	  ipcMain.handle(IpcChannels.windowClose, () => {
   211	    BrowserWindow.getFocusedWindow()?.close();
   212	    return true;
   213	  });
   214	
   215	  ipcMain.handle(IpcChannels.manifestExport, async (): Promise<ManifestExportResult> => {
   216	    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   217	    const defaultPath = getDefaultExportPath("formatbuddy-backup-manifest.json");
   218	    const dialogResult = await dialog.showSaveDialog(win!, {
   219	      title: "백업 manifest 저장 위치",
   220	      defaultPath,
   221	      filters: [{ name: "FormatBuddy backup manifest", extensions: ["json"] }]
   222	    });
   223	    if (dialogResult.canceled || !dialogResult.filePath) {
   224	      return { saved: false };
   225	    }
   226	    try {
   227	      const result = await runBackupManifest({
   228	        scriptPath: getScanScriptPath(),
   229	        outputPath: dialogResult.filePath,
   230	        enforceIntegrity: app.isPackaged
   231	      });
   232	      return { saved: result.saved, path: result.path };
   233	    } catch (err) {
   234	      const e = err as Error;
   235	      return { saved: false, message: e.message };
   236	    }
   237	  });
   238	
   239	  ipcMain.handle(IpcChannels.actionRun, async (_e, payload: { command: string }) => {
   240	    return runActionCommand(payload?.command ?? "");
   241	  });
   242	}
   243	
   244	app.whenReady().then(() => {
   245	  electronApp.setAppUserModelId("app.formatbuddy.desktop");
   246	
   247	  app.on("browser-window-created", (_event, window) => {
   248	    optimizer.watchWindowShortcuts(window);
   249	  });
   250	
   251	  registerIpc();
   252	  createWindow();
   253	  if (mainWindow) initAutoUpdater(mainWindow);
   254	
   255	  app.on("activate", () => {
   256	    if (BrowserWindow.getAllWindows().length === 0) createWindow();
   257	    if (mainWindow) initAutoUpdater(mainWindow);
   258	  });
   259	});
   260	

--- shared/ipc.ts ---
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
    17	  manifestExport: "manifest:export",
    18	  windowMinimize: "window:minimize",
    19	  windowMaximizeToggle: "window:maximize-toggle",
    20	  windowClose: "window:close",
    21	  windowState: "window:state",
    22	  actionRun: "action:run"
    23	} as const;
    24	
    25	export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

--- preload ---
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ActionRunResult,
     5	  ExportOptions,
     6	  ExportResult,
     7	  ManifestExportResult,
     8	  ScanError,
     9	  ScanProgress,
    10	  ScanReport,
    11	  ScanResult,
    12	  UpdateDownloadProgress,
    13	  UpdateErrorPayload,
    14	  UpdateInfo,
    15	  WindowState
    16	} from "@shared/types";
    17	
    18	type ProgressListener = (progress: ScanProgress) => void;
    19	type CompleteListener = (result: ScanResult) => void;
    20	type ErrorListener = (error: ScanError) => void;
    21	type UpdateInfoListener = (info: UpdateInfo) => void;
    22	type UpdateProgressListener = (p: UpdateDownloadProgress) => void;
    23	type UpdateErrorListener = (e: UpdateErrorPayload) => void;
    24	type VoidListener = () => void;
    25	
    26	const fb = {
    27	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    28	
    29	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    30	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    31	
    32	  onScanProgress(cb: ProgressListener): () => void {
    33	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    34	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    35	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    36	  },
    37	  onScanComplete(cb: CompleteListener): () => void {
    38	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    39	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    40	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    41	  },
    42	  onScanError(cb: ErrorListener): () => void {
    43	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    44	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    45	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    46	  },
    47	
    48	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    49	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    50	
    51	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),
    52	
    53	  onUpdateChecking(cb: VoidListener): () => void {
    54	    const wrapped = () => cb();
    55	    ipcRenderer.on(IpcChannels.updateChecking, wrapped);
    56	    return () => ipcRenderer.removeListener(IpcChannels.updateChecking, wrapped);
    57	  },
    58	  onUpdateAvailable(cb: UpdateInfoListener): () => void {
    59	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    60	    ipcRenderer.on(IpcChannels.updateAvailable, wrapped);
    61	    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, wrapped);
    62	  },
    63	  onUpdateNotAvailable(cb: VoidListener): () => void {
    64	    const wrapped = () => cb();
    65	    ipcRenderer.on(IpcChannels.updateNotAvailable, wrapped);
    66	    return () => ipcRenderer.removeListener(IpcChannels.updateNotAvailable, wrapped);
    67	  },
    68	  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
    69	    const wrapped = (_e: unknown, p: UpdateDownloadProgress) => cb(p);
    70	    ipcRenderer.on(IpcChannels.updateDownloadProgress, wrapped);
    71	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloadProgress, wrapped);
    72	  },
    73	  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
    74	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    75	    ipcRenderer.on(IpcChannels.updateDownloaded, wrapped);
    76	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloaded, wrapped);
    77	  },
    78	  onUpdateError(cb: UpdateErrorListener): () => void {
    79	    const wrapped = (_e: unknown, err: UpdateErrorPayload) => cb(err);
    80	    ipcRenderer.on(IpcChannels.updateError, wrapped);
    81	    return () => ipcRenderer.removeListener(IpcChannels.updateError, wrapped);
    82	  },
    83	  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),
    84	
    85	  exportBackupManifest: (): Promise<ManifestExportResult> =>
    86	    ipcRenderer.invoke(IpcChannels.manifestExport),
    87	
    88	  // v0.5.1 — custom WinChrome controls
    89	  minimizeWindow: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowMinimize),
    90	  toggleMaximizeWindow: (): Promise<boolean> =>
    91	    ipcRenderer.invoke(IpcChannels.windowMaximizeToggle),
    92	  closeWindow: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowClose),
    93	  onWindowState(cb: (state: WindowState) => void): () => void {
    94	    const wrapped = (_e: unknown, state: WindowState) => cb(state);
    95	    ipcRenderer.on(IpcChannels.windowState, wrapped);
    96	    return () => ipcRenderer.removeListener(IpcChannels.windowState, wrapped);
    97	  },
    98	
    99	  runActionCommand: (command: string): Promise<ActionRunResult> =>
   100	    ipcRenderer.invoke(IpcChannels.actionRun, { command })
   101	};
   102	
   103	contextBridge.exposeInMainWorld("fb", fb);
   104	
   105	export type FbBridge = typeof fb;

exec
/bin/zsh -lc "nl -ba src/main/index.ts | sed -n '260,520p'
printf '\\n--- App ---\\n'
nl -ba src/renderer/src/App.tsx | sed -n '1,260p'
printf '\\n--- Report ---\\n'
nl -ba src/renderer/src/pages/Report.tsx | sed -n '1,360p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   260	
   261	app.on("before-quit", () => {
   262	  if (activeAbort) {
   263	    activeAbort.abort();
   264	    activeAbort = null;
   265	  }
   266	  shutdownAutoUpdater();
   267	});
   268	
   269	app.on("window-all-closed", () => {
   270	  if (process.platform !== "darwin") app.quit();
   271	});

--- App ---
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import { Onboarding } from "./pages/Onboarding";
     6	import { ErrorScreen } from "./pages/ErrorScreen";
     7	import { UpdateBanner } from "./components/UpdateBanner";
     8	import { WinChrome } from "./components/WinChrome";
     9	import { TopBar } from "./components/TopBar";
    10	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
    11	
    12	const ONBOARDING_SEEN_KEY = "formatbuddy:onboardingSeenAt";
    13	
    14	type Phase =
    15	  | { kind: "onboarding" }
    16	  | { kind: "home" }
    17	  | { kind: "scanning"; progress: ScanProgress }
    18	  | { kind: "report"; result: ScanResult }
    19	  | { kind: "error"; error: ScanError };
    20	
    21	function readOnboardingSeen(): boolean {
    22	  try {
    23	    return Boolean(localStorage.getItem(ONBOARDING_SEEN_KEY));
    24	  } catch {
    25	    return false;
    26	  }
    27	}
    28	
    29	function markOnboardingSeen() {
    30	  try {
    31	    localStorage.setItem(ONBOARDING_SEEN_KEY, new Date().toISOString());
    32	  } catch {
    33	    // private mode / quota — ignore, user just sees onboarding next time
    34	  }
    35	}
    36	
    37	const INITIAL_PROGRESS: ScanProgress = {
    38	  step: "준비",
    39	  doneSteps: 0,
    40	  totalSteps: 6,
    41	  score: 0,
    42	  elapsedMs: 0,
    43	  steps: [
    44	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    45	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    46	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    47	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    48	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    49	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    50	  ]
    51	};
    52	
    53	export function App() {
    54	  const [phase, setPhase] = useState<Phase>(() =>
    55	    readOnboardingSeen() ? { kind: "home" } : { kind: "onboarding" }
    56	  );
    57	  const [appVersion, setAppVersion] = useState<string>("");
    58	
    59	  const finishOnboarding = useCallback(() => {
    60	    markOnboardingSeen();
    61	    setPhase({ kind: "home" });
    62	  }, []);
    63	
    64	  useEffect(() => {
    65	    if (typeof window.fb?.appVersion === "function") {
    66	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    67	    }
    68	  }, []);
    69	
    70	  useEffect(() => {
    71	    if (!window.fb) return;
    72	    const offProgress = window.fb.onScanProgress((p) => {
    73	      setPhase((prev) =>
    74	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    75	      );
    76	    });
    77	    const offComplete = window.fb.onScanComplete((r) => {
    78	      setPhase({ kind: "report", result: r });
    79	    });
    80	    const offError = window.fb.onScanError((err) => {
    81	      setPhase({ kind: "error", error: err });
    82	    });
    83	    return () => {
    84	      offProgress();
    85	      offComplete();
    86	      offError();
    87	    };
    88	  }, []);
    89	
    90	  const startScan = useCallback(async () => {
    91	    if (!window.fb) {
    92	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    93	      return;
    94	    }
    95	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    96	    try {
    97	      await window.fb.startScan();
    98	    } catch {
    99	      // 에러는 onScanError 이벤트로 처리
   100	    }
   101	  }, []);
   102	
   103	  const cancelScan = useCallback(async () => {
   104	    if (!window.fb) return;
   105	    await window.fb.cancelScan();
   106	    setPhase({ kind: "home" });
   107	  }, []);
   108	
   109	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
   110	
   111	  const topBar = useMemo(() => {
   112	    if (phase.kind === "home" || phase.kind === "onboarding") return null;
   113	    const versionLabel = appVersion ? `v${appVersion}` : undefined;
   114	    if (phase.kind === "scanning")
   115	      return <TopBar here="진단 중" meta="로컬에서만 처리됨" version={versionLabel} onBack={goHome} />;
   116	    if (phase.kind === "report")
   117	      return <TopBar here="리포트" meta="로컬에서만 처리됨" version={versionLabel} onBack={goHome} />;
   118	    if (phase.kind === "error")
   119	      return <TopBar here="잠시 멈췄어요" version={versionLabel} onBack={goHome} />;
   120	    return null;
   121	  }, [phase, appVersion, goHome]);
   122	
   123	  const content = useMemo(() => {
   124	    switch (phase.kind) {
   125	      case "onboarding":
   126	        return <Onboarding onComplete={finishOnboarding} />;
   127	      case "home":
   128	        return <Home onStartScan={startScan} />;
   129	      case "scanning":
   130	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
   131	      case "report":
   132	        return <Report result={phase.result} onBack={goHome} />;
   133	      case "error":
   134	        return <ErrorScreen error={phase.error} onRetry={startScan} onBack={goHome} />;
   135	    }
   136	  }, [phase, startScan, cancelScan, goHome, finishOnboarding]);
   137	
   138	  return (
   139	    <div className="fb-app">
   140	      <WinChrome />
   141	      {topBar}
   142	      <div className="fb-app-body">{content}</div>
   143	      <UpdateBanner />
   144	      <footer className="fb-app-footer">
   145	        <span>FormatBuddy Desktop</span>
   146	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   147	      </footer>
   148	    </div>
   149	  );
   150	}

--- Report ---
     1	import { useCallback, useMemo, useState } from "react";
     2	import { Button } from "../components/Button";
     3	import { Lockup } from "../components/Lockup";
     4	import { CloudBuddy } from "../components/CloudBuddy";
     5	import { copy } from "@shared/copy";
     6	import type { ActionItem, ScanResult } from "@shared/types";
     7	
     8	function expressionForScore(score: number): "calm" | "smile" | "wink" {
     9	  if (score >= 76) return "calm";
    10	  if (score >= 26) return "smile";
    11	  return "wink";
    12	}
    13	
    14	const HEAVY_REASON_THRESHOLD = 5;
    15	
    16	function severityClass(s: ScanResult["recommendation"]["severity"]): string {
    17	  switch (s) {
    18	    case "safe":
    19	      return "fb-score-safe";
    20	    case "watch":
    21	      return "fb-score-watch";
    22	    case "organize":
    23	      return "fb-score-organize";
    24	    case "format":
    25	      return "fb-score-format";
    26	  }
    27	}
    28	
    29	// expressionForScore helper will land in v0.5.3 when the ScoreHero card
    30	// gains its own CloudBuddy. For now severity drives the tone color only.
    31	
    32	interface ReportProps {
    33	  result: ScanResult;
    34	  onBack: () => void;
    35	}
    36	
    37	interface RowProps {
    38	  label: string;
    39	  value: React.ReactNode;
    40	}
    41	
    42	function Row({ label, value }: RowProps) {
    43	  return (
    44	    <div className="fb-report-row">
    45	      <div className="fb-report-row-label">{label}</div>
    46	      <div className="fb-report-row-value">{value}</div>
    47	    </div>
    48	  );
    49	}
    50	
    51	function formatGb(value?: number | null) {
    52	  if (value == null) return "—";
    53	  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
    54	}
    55	
    56	export function Report({ result, onBack }: ReportProps) {
    57	  const { report, recommendation } = result;
    58	  const [exportStatus, setExportStatus] = useState<string | null>(null);
    59	  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
    60	  const [manifestRunning, setManifestRunning] = useState(false);
    61	
    62	  const installedCount = report.installedApps.length;
    63	  const driverCount = report.drivers.length;
    64	  const wifiCount = report.wifiProfiles.length;
    65	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    66	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    67	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    68	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    69	
    70	  const wingetPackageCount = useMemo(() => {
    71	    if (!report.wingetExport?.Sources) return 0;
    72	    return report.wingetExport.Sources.reduce(
    73	      (sum, src) => sum + (src.Packages?.length ?? 0),
    74	      0
    75	    );
    76	  }, [report.wingetExport]);
    77	
    78	  const onExport = useCallback(async () => {
    79	    if (!window.fb) return;
    80	    setExportStatus(null);
    81	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    82	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    83	    else setExportStatus("저장을 취소했어요.");
    84	  }, [report]);
    85	
    86	  const onOpenWeb = useCallback(async () => {
    87	    if (!window.fb) return;
    88	    await window.fb.openWebReport();
    89	  }, []);
    90	
    91	  const [runStatus, setRunStatus] = useState<string | null>(null);
    92	  const runAction = useCallback(async (action: ActionItem) => {
    93	    if (!action.command || !window.fb?.runActionCommand) return;
    94	    setRunStatus(null);
    95	    const res = await window.fb.runActionCommand(action.command);
    96	    if (res.mode === "opened-url") setRunStatus(copy.recommendRunOpenedToast);
    97	    else if (res.mode === "copied-to-clipboard") setRunStatus(copy.recommendRunCopiedToast);
    98	    else setRunStatus(copy.recommendRunRejectedToast);
    99	  }, []);
   100	
   101	  const onExportManifest = useCallback(async () => {
   102	    if (!window.fb) return;
   103	    setManifestStatus(null);
   104	    setManifestRunning(true);
   105	    try {
   106	      const res = await window.fb.exportBackupManifest();
   107	      if (res.saved && res.path) {
   108	        setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
   109	      } else if (res.message) {
   110	        setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
   111	      } else {
   112	        setManifestStatus(copy.manifestExportCancelled);
   113	      }
   114	    } catch (e) {
   115	      const err = e as Error;
   116	      setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
   117	    } finally {
   118	      setManifestRunning(false);
   119	    }
   120	  }, []);
   121	
   122	  return (
   123	    <main className="fb-report">
   124	      <header className="fb-report-header">
   125	        <Lockup markSize={36} kanjiSize={20} en={false} />
   126	        <div className="fb-report-actions">
   127	          <Button variant="ghost" size="sm" onClick={onBack}>
   128	            {copy.reportBackCta}
   129	          </Button>
   130	        </div>
   131	      </header>
   132	
   133	      <section className="fb-report-hero">
   134	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
   135	        <p className="fb-lede">{copy.reportLede}</p>
   136	      </section>
   137	
   138	      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
   139	        <div className="fb-score-card-head">
   140	          <div className="fb-score-card-text">
   141	            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
   142	            <div className="fb-score-card-value">
   143	              <span className="fb-score-card-num">{recommendation.formatScore}</span>
   144	              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
   145	            </div>
   146	            <div className="fb-score-card-headline">{recommendation.headline}</div>
   147	            <div className="fb-score-card-badge">
   148	              <span className="fb-score-card-badge-dot" />
   149	              {copy.recommendSeverity[recommendation.severity].chip}
   150	            </div>
   151	          </div>
   152	          <div className="fb-score-card-buddy">
   153	            <CloudBuddy
   154	              size={88}
   155	              variant="primary"
   156	              expression={expressionForScore(recommendation.formatScore)}
   157	              animated={recommendation.severity === "safe"}
   158	            />
   159	          </div>
   160	        </div>
   161	        <p className="fb-score-card-summary">{recommendation.summary}</p>
   162	      </section>
   163	
   164	      <section className="fb-report-advice">
   165	        <article className="fb-card">
   166	          <h3>{copy.recommendTryFirstTitle}</h3>
   167	          <ul className="fb-advice-list">
   168	            {recommendation.tryFirst.map((a, i) => (
   169	              <li key={`tf-${i}`}>
   170	                <strong>{a.title}</strong>
   171	                <span>{a.description}</span>
   172	                {a.command && (
   173	                  <div className="fb-advice-cmd-row">
   174	                    <code className="fb-advice-cmd">{a.command}</code>
   175	                    <button
   176	                      type="button"
   177	                      className="fb-run-btn"
   178	                      onClick={() => void runAction(a)}
   179	                    >
   180	                      {copy.recommendRunButton}
   181	                    </button>
   182	                  </div>
   183	                )}
   184	              </li>
   185	            ))}
   186	          </ul>
   187	        </article>
   188	
   189	        <article className="fb-card">
   190	          <h3>{copy.recommendFormatReasonsTitle}</h3>
   191	          {recommendation.formatReasons.length === 0 ? (
   192	            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
   193	          ) : (
   194	            <ul className="fb-advice-list">
   195	              {recommendation.formatReasons.map((r, i) => {
   196	                const heavy = r.weightedScore >= HEAVY_REASON_THRESHOLD;
   197	                return (
   198	                  <li key={`fr-${i}`}>
   199	                    <strong>
   200	                      {r.label}{" "}
   201	                      <span className={`fb-advice-weight${heavy ? " fb-advice-weight-heavy" : ""}`}>
   202	                        +{r.weightedScore.toFixed(1)}
   203	                      </span>
   204	                    </strong>
   205	                    <span>{r.description}</span>
   206	                  </li>
   207	                );
   208	              })}
   209	            </ul>
   210	          )}
   211	        </article>
   212	
   213	        <article className="fb-card">
   214	          <h3>{copy.recommendAfterFormatTitle}</h3>
   215	          <ul className="fb-advice-list">
   216	            {recommendation.afterFormat.map((a, i) => (
   217	              <li key={`af-${i}`}>
   218	                <strong>{a.title}</strong>
   219	                <span>{a.description}</span>
   220	                {a.command && (
   221	                  <div className="fb-advice-cmd-row">
   222	                    <code className="fb-advice-cmd">{a.command}</code>
   223	                    <button
   224	                      type="button"
   225	                      className="fb-run-btn"
   226	                      onClick={() => void runAction(a)}
   227	                    >
   228	                      {copy.recommendRunButton}
   229	                    </button>
   230	                  </div>
   231	                )}
   232	              </li>
   233	            ))}
   234	          </ul>
   235	        </article>
   236	      </section>
   237	
   238	      {runStatus && (
   239	        <div className="fb-run-status" role="status" aria-live="polite">
   240	          {runStatus}
   241	        </div>
   242	      )}
   243	
   244	      <section className="fb-report-grid">
   245	        <article className="fb-card">
   246	          <h3>이 PC</h3>
   247	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
   248	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
   249	          <Row label="CPU" value={report.system.cpu ?? "—"} />
   250	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
   251	        </article>
   252	
   253	        <article className="fb-card">
   254	          <h3>저장 공간</h3>
   255	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
   256	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
   257	          {report.disks.map((d) => (
   258	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
   259	          ))}
   260	        </article>
   261	
   262	        <article className="fb-card">
   263	          <h3>같이 챙길 것</h3>
   264	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
   265	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
   266	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
   267	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
   268	        </article>
   269	
   270	        <article className="fb-card">
   271	          <h3>설치된 앱 / 드라이버</h3>
   272	          <Row label="설치된 앱" value={`${installedCount}개`} />
   273	          <Row label="드라이버" value={`${driverCount}개`} />
   274	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   275	          <Row label="프린터" value={`${report.printers.length}개`} />
   276	        </article>
   277	
   278	        <article className="fb-card">
   279	          <h3>사용자 폴더</h3>
   280	          {report.userFolders.map((f) => (
   281	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   282	          ))}
   283	        </article>
   284	
   285	        <article className="fb-card">
   286	          <h3>{copy.wingetSectionTitle}</h3>
   287	          {report.winget.available ? (
   288	            <p className="fb-report-card-explain">
   289	              {copy.wingetSummary(wingetPackageCount)}
   290	            </p>
   291	          ) : (
   292	            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
   293	          )}
   294	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   295	          <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
   296	        </article>
   297	
   298	        <article className="fb-card fb-card-checklist">
   299	          <h3>포맷 전 체크리스트</h3>
   300	          <ul className="fb-report-checklist">
   301	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   302	            <li>Desktop·Documents·Downloads 백업</li>
   303	            <li>클라우드 동기화 완료 확인</li>
   304	            <li>리포트 JSON 저장 후 포맷</li>
   305	          </ul>
   306	        </article>
   307	      </section>
   308	
   309	      <section className="fb-report-manifest">
   310	        <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
   311	        <p className="fb-lede">{copy.manifestExplain}</p>
   312	        <div className="fb-report-cta">
   313	          <Button
   314	            variant="primary"
   315	            size="lg"
   316	            onClick={onExportManifest}
   317	            disabled={manifestRunning}
   318	          >
   319	            {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
   320	          </Button>
   321	          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
   322	        </div>
   323	      </section>
   324	
   325	      <section className="fb-report-cta">
   326	        <Button variant="primary" size="lg" onClick={onExport}>
   327	          {copy.reportExportCta}
   328	        </Button>
   329	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   330	          {copy.reportOpenWebCta}
   331	        </Button>
   332	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   333	      </section>
   334	
   335	      <section className="fb-report-meta">
   336	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   337	        <small>schema {report.schemaVersion}</small>
   338	      </section>
   339	    </main>
   340	  );
   341	}

exec
/bin/zsh -lc "printf '%s\\n' '--- WinChrome ---'; nl -ba src/renderer/src/components/WinChrome.tsx | sed -n '1,240p'; printf '%s\\n' '--- TopBar ---'; nl -ba src/renderer/src/components/TopBar.tsx | sed -n '1,220p'; printf '%s\\n' '--- Onboarding ---'; nl -ba src/renderer/src/pages/Onboarding.tsx | sed -n '1,260p'; printf '%s\\n' '--- ErrorScreen ---'; nl -ba src/renderer/src/pages/ErrorScreen.tsx | sed -n '1,220p';" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- WinChrome ---
     1	import { useEffect, useState } from "react";
     2	import { CloudBuddy } from "./CloudBuddy";
     3	
     4	function CapMin() {
     5	  return (
     6	    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
     7	      <path d="M2 5 H8" stroke="currentColor" strokeWidth="1" />
     8	    </svg>
     9	  );
    10	}
    11	
    12	function CapMax({ restored }: { restored: boolean }) {
    13	  if (restored) {
    14	    // "restore" glyph — two overlapping rects
    15	    return (
    16	      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    17	        <rect x="2.5" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1" />
    18	        <rect x="1" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="#FBFBFC" />
    19	      </svg>
    20	    );
    21	  }
    22	  return (
    23	    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    24	      <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
    25	    </svg>
    26	  );
    27	}
    28	
    29	function CapClose() {
    30	  return (
    31	    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
    32	      <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    33	    </svg>
    34	  );
    35	}
    36	
    37	export function WinChrome({ title = "포맷버디" }: { title?: string }) {
    38	  const [isMaximized, setIsMaximized] = useState(false);
    39	
    40	  useEffect(() => {
    41	    if (!window.fb?.onWindowState) return;
    42	    return window.fb.onWindowState((state) => setIsMaximized(state.isMaximized));
    43	  }, []);
    44	
    45	  return (
    46	    <div className="fb-win-chrome">
    47	      <div className="fb-win-left">
    48	        <CloudBuddy size={14} variant="primary" />
    49	        <span>{title}</span>
    50	      </div>
    51	      <div className="fb-win-caption">
    52	        <button
    53	          type="button"
    54	          className="fb-cap"
    55	          aria-label="최소화"
    56	          onClick={() => void window.fb?.minimizeWindow()}
    57	        >
    58	          <CapMin />
    59	        </button>
    60	        <button
    61	          type="button"
    62	          className="fb-cap"
    63	          aria-label={isMaximized ? "이전 크기로" : "최대화"}
    64	          onClick={() => void window.fb?.toggleMaximizeWindow()}
    65	        >
    66	          <CapMax restored={isMaximized} />
    67	        </button>
    68	        <button
    69	          type="button"
    70	          className="fb-cap fb-cap-close"
    71	          aria-label="닫기"
    72	          onClick={() => void window.fb?.closeWindow()}
    73	        >
    74	          <CapClose />
    75	        </button>
    76	      </div>
    77	    </div>
    78	  );
    79	}
--- TopBar ---
     1	interface TopBarProps {
     2	  here: string;
     3	  meta?: string;
     4	  version?: string;
     5	  onBack?: () => void;
     6	}
     7	
     8	function BackArrow() {
     9	  return (
    10	    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    11	      <path
    12	        d="M9 3 L5 7 L9 11"
    13	        stroke="currentColor"
    14	        strokeWidth="1.8"
    15	        strokeLinecap="round"
    16	        strokeLinejoin="round"
    17	      />
    18	    </svg>
    19	  );
    20	}
    21	
    22	export function TopBar({ here, meta, version, onBack }: TopBarProps) {
    23	  return (
    24	    <div className="fb-win-topbar">
    25	      <div className="fb-topbar-crumb">
    26	        {onBack && (
    27	          <button
    28	            type="button"
    29	            className="fb-topbar-back"
    30	            aria-label="홈으로 돌아가기"
    31	            onClick={onBack}
    32	          >
    33	            <BackArrow />
    34	          </button>
    35	        )}
    36	        <span>홈</span>
    37	        <span className="fb-topbar-sep">/</span>
    38	        <span className="fb-topbar-here">{here}</span>
    39	      </div>
    40	      <div className="fb-topbar-meta">
    41	        {meta && <span>{meta}</span>}
    42	        {version && <span>{version}</span>}
    43	      </div>
    44	    </div>
    45	  );
    46	}
--- Onboarding ---
     1	import { useState } from "react";
     2	import { CloudBuddy } from "../components/CloudBuddy";
     3	import { Button, ArrowRight } from "../components/Button";
     4	import { copy } from "@shared/copy";
     5	
     6	interface OnboardingProps {
     7	  onComplete: () => void;
     8	}
     9	
    10	const EXPRESSIONS: ReadonlyArray<"smile" | "calm" | "wink"> = ["smile", "calm", "wink"];
    11	
    12	export function Onboarding({ onComplete }: OnboardingProps) {
    13	  const [step, setStep] = useState<0 | 1 | 2>(0);
    14	  const cur = copy.onboardingSteps[step];
    15	  const isLast = step === 2;
    16	
    17	  const handleNext = () => {
    18	    if (isLast) onComplete();
    19	    else setStep((s) => (s + 1) as 0 | 1 | 2);
    20	  };
    21	
    22	  return (
    23	    <main className="fb-onboard">
    24	      <div className="fb-onboard-left">
    25	        <span className="fb-onboard-tag">{cur.tag}</span>
    26	        <h1 className="fb-onboard-head">
    27	          {cur.head}
    28	          <br />
    29	          <em>{cur.headEm}</em>
    30	        </h1>
    31	        <p className="fb-onboard-body">{cur.body}</p>
    32	        <div className="fb-onboard-dots" aria-hidden>
    33	          {[0, 1, 2].map((n) => (
    34	            <span key={n} className={`fb-onboard-dot ${n === step ? "on" : ""}`} />
    35	          ))}
    36	        </div>
    37	        <div className="fb-onboard-foot">
    38	          <Button variant="primary" size="md" onClick={handleNext} iconRight={<ArrowRight />}>
    39	            {isLast ? copy.onboardingStart : copy.onboardingNext}
    40	          </Button>
    41	          {!isLast && (
    42	            <button type="button" className="fb-onboard-skip" onClick={onComplete}>
    43	              {copy.onboardingSkip}
    44	            </button>
    45	          )}
    46	        </div>
    47	      </div>
    48	      <div className="fb-onboard-right">
    49	        <CloudBuddy size={220} variant="on-blue" animated={step === 0} expression={EXPRESSIONS[step]} />
    50	      </div>
    51	    </main>
    52	  );
    53	}
--- ErrorScreen ---
     1	import { useState } from "react";
     2	import { CloudBuddy } from "../components/CloudBuddy";
     3	import { Button } from "../components/Button";
     4	import { copy } from "@shared/copy";
     5	import type { ScanError } from "@shared/types";
     6	
     7	interface ErrorScreenProps {
     8	  error: ScanError;
     9	  onRetry: () => void;
    10	  onBack: () => void;
    11	}
    12	
    13	export function ErrorScreen({ error, onRetry, onBack }: ErrorScreenProps) {
    14	  const [showDetail, setShowDetail] = useState(false);
    15	  const code = error.code ?? "UNKNOWN";
    16	
    17	  return (
    18	    <main className="fb-err-screen">
    19	      <CloudBuddy size={108} variant="primary" expression="calm" />
    20	      <h2 className="fb-err-head">{copy.errorHead}</h2>
    21	      <p className="fb-err-body">{error.message || copy.errorBodyDefault}</p>
    22	      <div className="fb-err-actions">
    23	        <Button variant="primary" size="md" onClick={onRetry}>
    24	          {copy.errorRetry}
    25	        </Button>
    26	        <Button variant="secondary" size="md" onClick={onBack}>
    27	          {copy.reportBackCta}
    28	        </Button>
    29	      </div>
    30	      {error.detail && (
    31	        <button
    32	          type="button"
    33	          className="fb-err-toggle"
    34	          onClick={() => setShowDetail((v) => !v)}
    35	          aria-expanded={showDetail}
    36	        >
    37	          {showDetail ? "기술 정보 숨기기" : "기술 정보 보기"}
    38	          <span className="fb-err-code">
    39	            {copy.errorCodePrefix}
    40	            {code}
    41	          </span>
    42	        </button>
    43	      )}
    44	      {showDetail && error.detail && (
    45	        <div className="fb-err-detail">
    46	          <pre>{error.detail.slice(0, 1200)}</pre>
    47	        </div>
    48	      )}
    49	    </main>
    50	  );
    51	}

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '1,260p'
printf '\\n--- css 260-620 ---\\n'
nl -ba src/renderer/src/styles/globals.css | sed -n '260,620p'
printf '\\n--- css 620-980 ---\\n'
nl -ba src/renderer/src/styles/globals.css | sed -n '620,980p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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
    33	
    34	  /* v0.5.0 severity tones (from design_handoff_format_buddy_app).
    35	     mint → teal → brand-blue → deep-blue — single hue family,
    36	     "care intensity" scale (NOT risk). */
    37	  --color-fb-tone-safe:     #2dc9a8;
    38	  --color-fb-tone-watch:    #1ea0d6;
    39	  --color-fb-tone-organize: var(--color-fb-blue);
    40	  --color-fb-tone-format:   var(--color-fb-blue-heavy);
    41	}
    42	
    43	* { box-sizing: border-box; }
    44	
    45	html, body, #root {
    46	  margin: 0;
    47	  padding: 0;
    48	  height: 100%;
    49	  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
    50	  font-feature-settings: "ss01" on, "ss03" on;
    51	  -webkit-font-smoothing: antialiased;
    52	  text-rendering: optimizeLegibility;
    53	  color: var(--color-fb-ink-1);
    54	  background: #ffffff;
    55	  -webkit-user-select: none;
    56	  user-select: none;
    57	}
    58	
    59	button { font-family: inherit; }
    60	
    61	/* ============================================================
    62	   App shell
    63	   ============================================================ */
    64	.fb-app {
    65	  display: flex;
    66	  flex-direction: column;
    67	  height: 100vh;
    68	  background: #ffffff;
    69	  overflow: hidden;
    70	}
    71	.fb-app-body { overflow-y: auto; }
    72	.fb-app-footer {
    73	  display: flex;
    74	  justify-content: space-between;
    75	  align-items: center;
    76	  padding: 12px 24px;
    77	  border-top: 1px solid var(--color-fb-line);
    78	  background: #ffffff;
    79	  font-size: 11px;
    80	  color: var(--color-fb-ink-3);
    81	  font-weight: 500;
    82	  letter-spacing: 0.02em;
    83	}
    84	.fb-app-version { font-feature-settings: "tnum" on; }
    85	
    86	.fb-app-body {
    87	  flex: 1;
    88	  display: flex;
    89	  flex-direction: column;
    90	  min-height: 0;
    91	  background: #ffffff;
    92	}
    93	
    94	/* ============================================================
    95	   WinChrome (v0.5.1) — custom 32px Win11-style title bar.
    96	   `-webkit-app-region: drag` makes the bar draggable; the caption
    97	   buttons opt out via `no-drag` so they remain clickable.
    98	   ============================================================ */
    99	.fb-win-chrome {
   100	  height: 32px;
   101	  flex: 0 0 32px;
   102	  display: flex;
   103	  align-items: stretch;
   104	  justify-content: space-between;
   105	  border-bottom: 1px solid var(--color-fb-line);
   106	  background: #fbfbfc;
   107	  user-select: none;
   108	  -webkit-app-region: drag;
   109	}
   110	.fb-win-left {
   111	  display: flex;
   112	  align-items: center;
   113	  gap: 8px;
   114	  padding: 0 12px;
   115	  font-size: 12px;
   116	  font-weight: 600;
   117	  color: var(--color-fb-ink-2);
   118	  letter-spacing: -0.01em;
   119	}
   120	.fb-win-caption {
   121	  display: flex;
   122	  height: 100%;
   123	  -webkit-app-region: no-drag;
   124	}
   125	.fb-cap {
   126	  width: 46px;
   127	  border: 0;
   128	  background: transparent;
   129	  display: flex;
   130	  align-items: center;
   131	  justify-content: center;
   132	  cursor: pointer;
   133	  color: var(--color-fb-ink-2);
   134	  -webkit-app-region: no-drag;
   135	}
   136	.fb-cap:hover { background: #f1f2f4; }
   137	.fb-cap-close:hover { background: #e81123; color: #ffffff; }
   138	.fb-cap:focus-visible {
   139	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   140	  outline-offset: -2px;
   141	}
   142	
   143	/* ============================================================
   144	   TopBar (v0.5.1) — under WinChrome, shown on every screen except Home.
   145	   ============================================================ */
   146	.fb-win-topbar {
   147	  display: flex;
   148	  align-items: center;
   149	  justify-content: space-between;
   150	  padding: 12px 24px;
   151	  border-bottom: 1px solid var(--color-fb-line);
   152	  background: #ffffff;
   153	}
   154	.fb-topbar-crumb {
   155	  display: flex;
   156	  align-items: center;
   157	  gap: 10px;
   158	  font-size: 13px;
   159	  font-weight: 600;
   160	  color: var(--color-fb-ink-2);
   161	}
   162	.fb-topbar-back {
   163	  width: 28px;
   164	  height: 28px;
   165	  border: 0;
   166	  background: transparent;
   167	  display: flex;
   168	  align-items: center;
   169	  justify-content: center;
   170	  border-radius: 8px;
   171	  color: var(--color-fb-ink-2);
   172	  cursor: pointer;
   173	}
   174	.fb-topbar-back:hover {
   175	  background: #f4f5f7;
   176	  color: var(--color-fb-ink-1);
   177	}
   178	.fb-topbar-sep { color: var(--color-fb-ink-4); }
   179	.fb-topbar-here { color: var(--color-fb-ink-1); font-weight: 700; }
   180	.fb-topbar-meta {
   181	  font-size: 12px;
   182	  color: var(--color-fb-ink-3);
   183	  display: flex;
   184	  align-items: center;
   185	  gap: 14px;
   186	  font-feature-settings: "tnum" on;
   187	}
   188	
   189	.fb-update-banner {
   190	  display: flex;
   191	  align-items: center;
   192	  gap: 10px;
   193	  padding: 10px 16px;
   194	  background: var(--color-fb-blue-tint);
   195	  color: var(--color-fb-blue-heavy);
   196	  border-top: 1px solid var(--color-fb-line);
   197	  font-size: 13px;
   198	  font-weight: 600;
   199	  letter-spacing: -0.01em;
   200	}
   201	.fb-update-banner-detail {
   202	  margin-left: auto;
   203	  font-size: 12px;
   204	  color: var(--color-fb-ink-3);
   205	  font-weight: 500;
   206	  font-feature-settings: "tnum" on;
   207	}
   208	.fb-update-banner-quiet {
   209	  background: #ffffff;
   210	  color: var(--color-fb-ink-2);
   211	}
   212	.fb-update-banner-ready {
   213	  background: var(--color-fb-blue);
   214	  color: #ffffff;
   215	}
   216	.fb-update-banner-ready .fb-update-banner-detail { color: rgba(255,255,255,0.7); }
   217	.fb-update-banner-ready .fb-btn-on-blue { margin-left: auto; }
   218	
   219	/* ============================================================
   220	   Typography helpers
   221	   ============================================================ */
   222	.fb-h1 {
   223	  font-size: 44px;
   224	  line-height: 1.1;
   225	  font-weight: 800;
   226	  letter-spacing: -0.045em;
   227	  margin: 0 0 20px;
   228	  color: var(--color-fb-ink-1);
   229	}
   230	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
   231	.fb-h1-sm {
   232	  font-size: 32px;
   233	  line-height: 1.15;
   234	  font-weight: 800;
   235	  letter-spacing: -0.04em;
   236	  margin: 0 0 12px;
   237	  color: var(--color-fb-ink-1);
   238	}
   239	.fb-h2 {
   240	  font-size: 22px;
   241	  font-weight: 800;
   242	  letter-spacing: -0.025em;
   243	  color: var(--color-fb-ink-1);
   244	  margin: 0 0 16px;
   245	}
   246	.fb-lede {
   247	  font-size: 15px;
   248	  line-height: 24px;
   249	  color: var(--color-fb-ink-2);
   250	  font-weight: 500;
   251	  letter-spacing: -0.012em;
   252	  margin: 0 0 24px;
   253	  max-width: 520px;
   254	}
   255	
   256	/* ============================================================
   257	   Button
   258	   ============================================================ */
   259	.fb-btn {
   260	  display: inline-flex;

--- css 260-620 ---
   260	  display: inline-flex;
   261	  align-items: center;
   262	  justify-content: center;
   263	  gap: 8px;
   264	  font-weight: 700;
   265	  letter-spacing: -0.015em;
   266	  border: 1px solid transparent;
   267	  border-radius: 12px;
   268	  cursor: pointer;
   269	  white-space: nowrap;
   270	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   271	  user-select: none;
   272	}
   273	.fb-btn:focus-visible {
   274	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   275	  outline-offset: 2px;
   276	}
   277	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   278	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   279	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   280	.fb-btn-full { width: 100%; }
   281	
   282	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   283	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   284	.fb-btn-primary:active { transform: scale(0.98); }
   285	
   286	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   287	.fb-btn-secondary:hover { background: #f7f7f8; }
   288	
   289	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   290	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   291	
   292	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   293	.fb-btn-on-blue:hover { background: #f7f7f8; }
   294	
   295	/* ============================================================
   296	   Cloud-Buddy motion (from design styles.css)
   297	   ============================================================ */
   298	.cb-eye { transform-box: fill-box; transform-origin: center; }
   299	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   300	@keyframes cb-wink {
   301	  0%, 92%, 100% { transform: scaleY(1); }
   302	  94%, 96% { transform: scaleY(0.08); }
   303	}
   304	
   305	.cb-pulse-wrap {
   306	  transform-box: fill-box;
   307	  transform-origin: center;
   308	  opacity: 0;
   309	  animation: cb-pulse 2.4s ease-out infinite;
   310	  pointer-events: none;
   311	}
   312	.cb-pulse-2 { animation-delay: -1.2s; }
   313	@keyframes cb-pulse {
   314	  0% { transform: scale(0.55); opacity: 0.55; }
   315	  80% { opacity: 0.05; }
   316	  100% { transform: scale(1.75); opacity: 0; }
   317	}
   318	
   319	.cb-animated .cb-antenna-dot {
   320	  transform-box: fill-box;
   321	  transform-origin: center;
   322	  animation: cb-charge 1.4s ease-in-out infinite;
   323	}
   324	@keyframes cb-charge {
   325	  0%, 100% { transform: scale(1); }
   326	  50% { transform: scale(1.18); }
   327	}
   328	
   329	.cb-spark {
   330	  transform-box: fill-box;
   331	  transform-origin: center;
   332	  opacity: 0;
   333	  animation: cb-spark 1.4s ease-out infinite;
   334	  pointer-events: none;
   335	}
   336	.cb-spark-2 { animation-delay: -0.7s; }
   337	@keyframes cb-spark {
   338	  0% { transform: scale(0.6); opacity: 0.55; }
   339	  100% { transform: scale(2.2); opacity: 0; }
   340	}
   341	
   342	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   343	@keyframes fb-spin { to { transform: rotate(360deg); } }
   344	
   345	@media (prefers-reduced-motion: reduce) {
   346	  .cb-animated .cb-eye-l,
   347	  .cb-animated .cb-antenna-dot,
   348	  .cb-pulse-wrap,
   349	  .cb-spark,
   350	  .fb-spin { animation: none !important; }
   351	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   352	}
   353	
   354	/* ============================================================
   355	   Home
   356	   ============================================================ */
   357	.fb-home {
   358	  flex: 1;
   359	  display: flex;
   360	  flex-direction: column;
   361	  padding: 24px 40px 40px;
   362	  gap: 32px;
   363	  max-width: 1080px;
   364	  margin: 0 auto;
   365	  width: 100%;
   366	}
   367	.fb-home-header {
   368	  display: flex;
   369	  justify-content: space-between;
   370	  align-items: center;
   371	}
   372	.fb-home-pill {
   373	  display: inline-flex;
   374	  align-items: center;
   375	  gap: 8px;
   376	  height: 32px;
   377	  padding: 0 14px 0 12px;
   378	  background: var(--color-fb-blue-tint);
   379	  color: var(--color-fb-blue-heavy);
   380	  border-radius: 9999px;
   381	  font-size: 12px;
   382	  font-weight: 700;
   383	  letter-spacing: -0.01em;
   384	}
   385	.fb-home-pill-dot {
   386	  width: 6px; height: 6px;
   387	  border-radius: 9999px;
   388	  background: var(--color-fb-blue);
   389	}
   390	
   391	.fb-home-hero {
   392	  display: grid;
   393	  grid-template-columns: 1.4fr 1fr;
   394	  gap: 48px;
   395	  align-items: center;
   396	  padding: 32px 0 8px;
   397	}
   398	.fb-home-hero-copy { display: flex; flex-direction: column; }
   399	.fb-home-hero-mark {
   400	  display: flex;
   401	  justify-content: center;
   402	  align-items: center;
   403	}
   404	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   405	
   406	.fb-home-privacy {
   407	  background: var(--color-fb-blue-tint);
   408	  border-radius: 20px;
   409	  padding: 28px 32px;
   410	}
   411	.fb-home-bullets {
   412	  margin: 0;
   413	  padding-left: 18px;
   414	  color: var(--color-fb-ink-2);
   415	  font-size: 14px;
   416	  line-height: 22px;
   417	  font-weight: 500;
   418	}
   419	.fb-home-bullets li { margin: 0 0 6px; }
   420	
   421	/* ============================================================
   422	   Scanning
   423	   ============================================================ */
   424	.fb-scanning {
   425	  flex: 1;
   426	  display: flex;
   427	  flex-direction: column;
   428	  justify-content: center;
   429	  align-items: center;
   430	  padding: 40px;
   431	}
   432	.fb-scanning-wrap {
   433	  width: 100%;
   434	  max-width: 520px;
   435	  display: flex;
   436	  flex-direction: column;
   437	  gap: 20px;
   438	}
   439	.fb-scanning-actions {
   440	  display: flex;
   441	  gap: 8px;
   442	  justify-content: flex-end;
   443	}
   444	.fb-scanning-error {
   445	  background: #ffffff;
   446	  border: 1px solid var(--color-fb-line);
   447	  color: var(--color-fb-ink-1);
   448	  border-radius: 12px;
   449	  padding: 14px 16px;
   450	  font-size: 13px;
   451	}
   452	.fb-scanning-error strong {
   453	  display: block;
   454	  margin-bottom: 4px;
   455	  color: var(--color-fb-blue-heavy);
   456	}
   457	.fb-scanning-error p {
   458	  margin: 0;
   459	  word-break: break-word;
   460	  color: var(--color-fb-ink-2);
   461	}
   462	
   463	/* ============================================================
   464	   ScanCard
   465	   ============================================================ */
   466	.scan-card {
   467	  background: #ffffff;
   468	  border-radius: 24px;
   469	  border: 1px solid var(--color-fb-line-t);
   470	  box-shadow: 0 1px 6px rgb(23 23 25 / 0.06), 0 12px 32px rgb(23 23 25 / 0.10);
   471	  padding: 28px;
   472	  display: flex;
   473	  flex-direction: column;
   474	  gap: 22px;
   475	}
   476	.scan-card-head {
   477	  display: flex;
   478	  align-items: center;
   479	  justify-content: space-between;
   480	}
   481	.scan-card-who { display: flex; align-items: center; gap: 10px; }
   482	.scan-card-who-meta { display: flex; flex-direction: column; gap: 2px; }
   483	.scan-card-title { font-size: 14px; font-weight: 700; color: var(--color-fb-ink-1); }
   484	.scan-card-elapsed { font-size: 12px; font-weight: 500; color: var(--color-fb-ink-3); }
   485	.scan-card-live {
   486	  display: flex;
   487	  align-items: center;
   488	  gap: 6px;
   489	  font-size: 12px;
   490	  font-weight: 600;
   491	  color: var(--color-fb-positive);
   492	}
   493	.scan-card-live-dot {
   494	  width: 7px; height: 7px;
   495	  border-radius: 9999px;
   496	  background: var(--color-fb-positive);
   497	}
   498	
   499	.scan-score {
   500	  background: var(--color-fb-blue-tint);
   501	  border-radius: 20px;
   502	  padding: 22px 24px;
   503	  display: grid;
   504	  grid-template-columns: 1fr auto;
   505	  gap: 16px;
   506	  align-items: center;
   507	}
   508	.scan-score-label {
   509	  font-size: 12px;
   510	  font-weight: 700;
   511	  letter-spacing: 0.04em;
   512	  color: var(--color-fb-blue-heavy);
   513	  margin-bottom: 4px;
   514	}
   515	.scan-score-value {
   516	  font-size: 56px;
   517	  font-weight: 800;
   518	  letter-spacing: -0.045em;
   519	  color: var(--color-fb-ink-1);
   520	  line-height: 1;
   521	  font-feature-settings: "tnum" on;
   522	}
   523	.scan-score-unit {
   524	  font-size: 24px;
   525	  font-weight: 700;
   526	  margin-left: 2px;
   527	  letter-spacing: -0.02em;
   528	  color: var(--color-fb-ink-2);
   529	}
   530	.scan-score-sub {
   531	  font-size: 12px;
   532	  color: var(--color-fb-ink-3);
   533	  font-weight: 500;
   534	  margin-top: 8px;
   535	}
   536	
   537	.scan-steps { display: flex; flex-direction: column; gap: 6px; }
   538	.scan-step {
   539	  display: grid;
   540	  grid-template-columns: 32px 1fr auto;
   541	  align-items: center;
   542	  gap: 12px;
   543	  padding: 12px 14px;
   544	  border-radius: 12px;
   545	  background: #ffffff;
   546	  border: 1px solid var(--color-fb-line-t);
   547	}
   548	.scan-step.active {
   549	  background: var(--color-fb-blue-tint);
   550	  border-color: rgba(0,102,255,0.22);
   551	}
   552	.scan-step-idx {
   553	  width: 24px; height: 24px;
   554	  border-radius: 9999px;
   555	  background: var(--color-fb-blue-tint);
   556	  color: var(--color-fb-blue);
   557	  font-size: 12px;
   558	  font-weight: 800;
   559	  display: flex; align-items: center; justify-content: center;
   560	  font-feature-settings: "tnum" on;
   561	}
   562	.scan-step.done .scan-step-idx { background: var(--color-fb-blue); color: #ffffff; }
   563	.scan-step.pending .scan-step-idx { background: #f4f4f5; color: var(--color-fb-ink-3); }
   564	.scan-step-name { font-size: 14px; font-weight: 600; color: var(--color-fb-ink-1); }
   565	.scan-step-state {
   566	  font-size: 12px;
   567	  font-weight: 600;
   568	  letter-spacing: -0.01em;
   569	  color: var(--color-fb-ink-3);
   570	  display: flex; align-items: center; gap: 4px;
   571	}
   572	.scan-step.done .scan-step-state { color: var(--color-fb-positive); }
   573	.scan-step.active .scan-step-state { color: var(--color-fb-blue); }
   574	
   575	/* ============================================================
   576	   Report
   577	   ============================================================ */
   578	.fb-report {
   579	  flex: 1;
   580	  display: flex;
   581	  flex-direction: column;
   582	  padding: 24px 40px 40px;
   583	  gap: 24px;
   584	  max-width: 1080px;
   585	  margin: 0 auto;
   586	  width: 100%;
   587	}
   588	.fb-report-header {
   589	  display: flex;
   590	  justify-content: space-between;
   591	  align-items: center;
   592	}
   593	.fb-report-actions { display: flex; gap: 8px; }
   594	.fb-report-hero { padding: 8px 0 0; }
   595	
   596	.fb-report-grid {
   597	  display: grid;
   598	  grid-template-columns: repeat(2, 1fr);
   599	  gap: 16px;
   600	}
   601	.fb-card {
   602	  background: #ffffff;
   603	  border: 1px solid var(--color-fb-line);
   604	  border-radius: 20px;
   605	  padding: 22px 24px;
   606	  display: flex;
   607	  flex-direction: column;
   608	  gap: 6px;
   609	}
   610	.fb-card h3 {
   611	  margin: 0 0 8px;
   612	  font-size: 15px;
   613	  font-weight: 800;
   614	  letter-spacing: -0.02em;
   615	  color: var(--color-fb-ink-1);
   616	}
   617	.fb-card-checklist { grid-column: span 2; }
   618	
   619	.fb-report-row {
   620	  display: grid;

--- css 620-980 ---
   620	  display: grid;
   621	  grid-template-columns: 110px 1fr;
   622	  gap: 12px;
   623	  padding: 6px 0;
   624	  border-bottom: 1px dashed var(--color-fb-line-t);
   625	  font-size: 13px;
   626	}
   627	.fb-report-row:last-child { border-bottom: none; }
   628	.fb-report-row-label { color: var(--color-fb-ink-3); font-weight: 600; }
   629	.fb-report-row-value { color: var(--color-fb-ink-1); font-weight: 500; }
   630	
   631	.fb-report-checklist {
   632	  margin: 0;
   633	  padding-left: 18px;
   634	  color: var(--color-fb-ink-2);
   635	  font-size: 14px;
   636	  line-height: 22px;
   637	  font-weight: 500;
   638	}
   639	
   640	.fb-report-cta {
   641	  display: flex;
   642	  gap: 10px;
   643	  align-items: center;
   644	  flex-wrap: wrap;
   645	}
   646	.fb-report-cta-status {
   647	  flex-basis: 100%;
   648	  font-size: 12px;
   649	  color: var(--color-fb-ink-3);
   650	  margin: 4px 0 0;
   651	}
   652	
   653	.fb-report-meta {
   654	  display: flex;
   655	  justify-content: space-between;
   656	  color: var(--color-fb-ink-3);
   657	  font-size: 11px;
   658	}
   659	
   660	/* ============================================================
   661	   Onboarding (v0.5.2) — 3-step intro, left copy + right CloudBuddy on blue
   662	   ============================================================ */
   663	.fb-onboard {
   664	  flex: 1;
   665	  display: grid;
   666	  grid-template-columns: 1fr 1fr;
   667	  min-height: 0;
   668	}
   669	.fb-onboard-left {
   670	  display: flex;
   671	  flex-direction: column;
   672	  justify-content: center;
   673	  padding: 48px 56px;
   674	  gap: 14px;
   675	}
   676	.fb-onboard-tag {
   677	  display: inline-block;
   678	  font-size: 12px;
   679	  font-weight: 700;
   680	  letter-spacing: 0.04em;
   681	  color: var(--color-fb-blue-heavy);
   682	  background: var(--color-fb-blue-tint);
   683	  padding: 6px 12px;
   684	  border-radius: 9999px;
   685	  width: max-content;
   686	}
   687	.fb-onboard-head {
   688	  font-size: 40px;
   689	  font-weight: 800;
   690	  line-height: 1.15;
   691	  letter-spacing: -0.04em;
   692	  margin: 0;
   693	  color: var(--color-fb-ink-1);
   694	}
   695	.fb-onboard-head em {
   696	  font-style: normal;
   697	  color: var(--color-fb-blue);
   698	}
   699	.fb-onboard-body {
   700	  margin: 0;
   701	  font-size: 14px;
   702	  line-height: 22px;
   703	  color: var(--color-fb-ink-2);
   704	  font-weight: 500;
   705	  letter-spacing: -0.012em;
   706	  max-width: 360px;
   707	}
   708	.fb-onboard-dots {
   709	  display: flex;
   710	  gap: 6px;
   711	  margin-top: 10px;
   712	}
   713	.fb-onboard-dot {
   714	  width: 24px;
   715	  height: 6px;
   716	  border-radius: 9999px;
   717	  background: var(--color-fb-line);
   718	}
   719	.fb-onboard-dot.on {
   720	  background: var(--color-fb-blue);
   721	}
   722	.fb-onboard-foot {
   723	  display: flex;
   724	  gap: 10px;
   725	  margin-top: 18px;
   726	  align-items: center;
   727	}
   728	.fb-onboard-skip {
   729	  background: transparent;
   730	  border: 0;
   731	  font-size: 13px;
   732	  color: var(--color-fb-ink-3);
   733	  cursor: pointer;
   734	  padding: 0 8px;
   735	  font-weight: 600;
   736	  font-family: inherit;
   737	}
   738	.fb-onboard-skip:hover { color: var(--color-fb-ink-1); }
   739	.fb-onboard-right {
   740	  background: var(--color-fb-blue);
   741	  display: flex;
   742	  align-items: center;
   743	  justify-content: center;
   744	  position: relative;
   745	  overflow: hidden;
   746	}
   747	.fb-onboard-right::before,
   748	.fb-onboard-right::after {
   749	  content: "";
   750	  position: absolute;
   751	  border-radius: 50%;
   752	  background: rgba(255, 255, 255, 0.08);
   753	}
   754	.fb-onboard-right::before {
   755	  width: 380px;
   756	  height: 380px;
   757	  top: -60px;
   758	  right: -120px;
   759	}
   760	.fb-onboard-right::after {
   761	  width: 260px;
   762	  height: 260px;
   763	  bottom: -80px;
   764	  left: -60px;
   765	}
   766	
   767	/* ============================================================
   768	   Error screen (v0.5.2) — replaces the old red banner in Scanning
   769	   ============================================================ */
   770	.fb-err-screen {
   771	  flex: 1;
   772	  display: flex;
   773	  flex-direction: column;
   774	  align-items: center;
   775	  justify-content: center;
   776	  padding: 48px 40px;
   777	  gap: 16px;
   778	  text-align: center;
   779	}
   780	.fb-err-head {
   781	  font-size: 24px;
   782	  font-weight: 800;
   783	  letter-spacing: -0.025em;
   784	  color: var(--color-fb-ink-1);
   785	  margin: 0;
   786	}
   787	.fb-err-body {
   788	  margin: 0;
   789	  font-size: 14px;
   790	  line-height: 22px;
   791	  color: var(--color-fb-ink-2);
   792	  font-weight: 500;
   793	  letter-spacing: -0.012em;
   794	  max-width: 460px;
   795	  word-break: break-word;
   796	}
   797	.fb-err-actions {
   798	  display: flex;
   799	  gap: 8px;
   800	  margin-top: 6px;
   801	}
   802	.fb-err-toggle {
   803	  margin-top: 8px;
   804	  background: transparent;
   805	  border: 0;
   806	  font-family: inherit;
   807	  font-size: 12px;
   808	  color: var(--color-fb-ink-3);
   809	  cursor: pointer;
   810	  display: inline-flex;
   811	  align-items: center;
   812	  gap: 10px;
   813	  font-weight: 600;
   814	}
   815	.fb-err-toggle:hover { color: var(--color-fb-ink-1); }
   816	.fb-err-code {
   817	  background: var(--color-fb-blue-tint);
   818	  color: var(--color-fb-blue-heavy);
   819	  padding: 2px 8px;
   820	  border-radius: 9999px;
   821	  font-size: 11px;
   822	  font-feature-settings: "tnum" on;
   823	}
   824	.fb-err-detail {
   825	  margin-top: 4px;
   826	  max-width: 640px;
   827	  background: #ffffff;
   828	  border: 1px solid var(--color-fb-line);
   829	  border-radius: 12px;
   830	  padding: 14px 16px;
   831	  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
   832	  font-size: 11px;
   833	  color: var(--color-fb-ink-3);
   834	  line-height: 16px;
   835	  text-align: left;
   836	  white-space: pre-wrap;
   837	  word-break: break-word;
   838	}
   839	.fb-err-detail pre { margin: 0; }
   840	
   841	.fb-report-card-explain {
   842	  font-size: 13px;
   843	  line-height: 20px;
   844	  color: var(--color-fb-ink-2);
   845	  margin: 0 0 12px;
   846	  font-weight: 500;
   847	}
   848	
   849	.fb-report-manifest {
   850	  margin-top: 8px;
   851	  padding: 24px;
   852	  background: var(--color-fb-blue-tint);
   853	  border-radius: 20px;
   854	}
   855	.fb-report-manifest .fb-h2 {
   856	  margin-top: 0;
   857	}
   858	
   859	/* ============================================================
   860	   Recommendation score card
   861	   ============================================================ */
   862	.fb-score-card {
   863	  border-radius: 24px;
   864	  padding: 28px 32px;
   865	  background: var(--color-fb-blue-tint);
   866	  display: flex;
   867	  flex-direction: column;
   868	  gap: 14px;
   869	}
   870	.fb-score-card-head {
   871	  display: flex;
   872	  align-items: flex-start;
   873	  justify-content: space-between;
   874	  gap: 24px;
   875	}
   876	.fb-score-card-text {
   877	  display: flex;
   878	  flex-direction: column;
   879	  gap: 6px;
   880	}
   881	.fb-score-card-buddy {
   882	  flex-shrink: 0;
   883	  display: flex;
   884	  align-items: center;
   885	  justify-content: center;
   886	}
   887	.fb-score-card-label {
   888	  font-size: 12px;
   889	  font-weight: 700;
   890	  letter-spacing: 0.04em;
   891	  color: var(--color-fb-blue-heavy);
   892	  margin-bottom: 4px;
   893	}
   894	.fb-score-card-value {
   895	  display: flex;
   896	  align-items: baseline;
   897	  gap: 6px;
   898	  line-height: 1;
   899	}
   900	.fb-score-card-num {
   901	  font-size: 96px;
   902	  font-weight: 800;
   903	  letter-spacing: -0.045em;
   904	  line-height: 1;
   905	  font-feature-settings: "tnum" on;
   906	  color: var(--score-tone, var(--color-fb-ink-1));
   907	}
   908	.fb-score-card-unit {
   909	  font-size: 22px;
   910	  font-weight: 700;
   911	  letter-spacing: -0.02em;
   912	  color: var(--color-fb-ink-3);
   913	}
   914	.fb-score-card-headline {
   915	  margin-top: 8px;
   916	  font-size: 14px;
   917	  font-weight: 700;
   918	  color: var(--color-fb-ink-1);
   919	  letter-spacing: -0.012em;
   920	}
   921	.fb-score-card-summary {
   922	  margin: 0;
   923	  font-size: 14px;
   924	  line-height: 22px;
   925	  color: var(--color-fb-ink-2);
   926	  font-weight: 500;
   927	}
   928	.fb-score-card-badge {
   929	  align-self: flex-start;
   930	  display: inline-flex;
   931	  align-items: center;
   932	  gap: 8px;
   933	  background: #ffffff;
   934	  border: 1px solid var(--color-fb-line);
   935	  color: var(--score-tone, var(--color-fb-ink-1));
   936	  font-size: 13px;
   937	  font-weight: 700;
   938	  letter-spacing: -0.01em;
   939	  padding: 6px 14px 6px 12px;
   940	  border-radius: 9999px;
   941	  white-space: nowrap;
   942	}
   943	.fb-score-card-badge-dot {
   944	  width: 8px;
   945	  height: 8px;
   946	  border-radius: 9999px;
   947	  background: var(--score-tone, var(--color-fb-blue));
   948	}
   949	/* Severity tone variants — single hue family, mint → deep-blue.
   950	   The tone color drives both the score number and the badge text/dot
   951	   via the --score-tone CSS variable scoped to the card. */
   952	.fb-score-safe     { --score-tone: var(--color-fb-tone-safe); }
   953	.fb-score-watch    { --score-tone: var(--color-fb-tone-watch); }
   954	.fb-score-organize { --score-tone: var(--color-fb-tone-organize); }
   955	.fb-score-format   { --score-tone: var(--color-fb-tone-format); }
   956	
   957	/* ============================================================
   958	   Advice cards (try-first / reasons / after-format)
   959	   ============================================================ */
   960	.fb-report-advice {
   961	  display: grid;
   962	  grid-template-columns: repeat(2, 1fr);
   963	  gap: 16px;
   964	  margin-top: 8px;
   965	}
   966	.fb-report-advice .fb-card:nth-child(1) { grid-column: span 2; }
   967	.fb-advice-list {
   968	  list-style: none;
   969	  margin: 0;
   970	  padding: 0;
   971	  display: flex;
   972	  flex-direction: column;
   973	  gap: 12px;
   974	}
   975	.fb-advice-list li {
   976	  display: flex;
   977	  flex-direction: column;
   978	  gap: 4px;
   979	  padding: 12px 14px;
   980	  background: var(--color-fb-bg);

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '980,1220p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   980	  background: var(--color-fb-bg);
   981	  border: 1px solid var(--color-fb-line);
   982	  border-radius: 12px;
   983	}
   984	.fb-advice-list strong {
   985	  font-size: 14px;
   986	  font-weight: 700;
   987	  color: var(--color-fb-ink-1);
   988	  letter-spacing: -0.012em;
   989	}
   990	.fb-advice-list span {
   991	  font-size: 13px;
   992	  line-height: 20px;
   993	  color: var(--color-fb-ink-2);
   994	  font-weight: 500;
   995	}
   996	.fb-advice-cmd {
   997	  margin-top: 6px;
   998	  display: inline-block;
   999	  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  1000	  font-size: 12px;
  1001	  font-weight: 600;
  1002	  color: var(--color-fb-blue-heavy);
  1003	  background: var(--color-fb-blue-tint);
  1004	  padding: 4px 8px;
  1005	  border-radius: 6px;
  1006	  user-select: text;
  1007	  word-break: break-all;
  1008	}
  1009	.fb-advice-weight {
  1010	  font-size: 11px;
  1011	  font-weight: 600;
  1012	  color: var(--color-fb-blue-heavy);
  1013	  background: var(--color-fb-blue-tint);
  1014	  padding: 2px 8px;
  1015	  border-radius: 9999px;
  1016	  margin-left: 6px;
  1017	  font-feature-settings: "tnum" on;
  1018	  vertical-align: middle;
  1019	}
  1020	/* v0.5.3: high-weight reasons get a solid blue chip — flat hierarchy
  1021	   inside the same brand family, no extra colors. */
  1022	.fb-advice-weight-heavy {
  1023	  background: var(--color-fb-blue);
  1024	  color: #ffffff;
  1025	}
  1026	
  1027	.fb-advice-cmd-row {
  1028	  display: flex;
  1029	  align-items: center;
  1030	  gap: 8px;
  1031	  margin-top: 6px;
  1032	  flex-wrap: wrap;
  1033	}
  1034	.fb-advice-cmd-row .fb-advice-cmd {
  1035	  margin-top: 0;
  1036	  flex: 1;
  1037	  min-width: 0;
  1038	}
  1039	.fb-run-btn {
  1040	  flex-shrink: 0;
  1041	  height: 28px;
  1042	  padding: 0 12px;
  1043	  border-radius: 9999px;
  1044	  border: 1px solid var(--color-fb-line);
  1045	  background: #ffffff;
  1046	  color: var(--color-fb-blue);
  1047	  font-size: 12px;
  1048	  font-weight: 700;
  1049	  font-family: inherit;
  1050	  cursor: pointer;
  1051	  letter-spacing: -0.01em;
  1052	}
  1053	.fb-run-btn:hover {
  1054	  background: var(--color-fb-blue-tint);
  1055	  border-color: var(--color-fb-blue-tint);
  1056	}
  1057	.fb-run-btn:focus-visible {
  1058	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
  1059	  outline-offset: 2px;
  1060	}
  1061	
  1062	.fb-run-status {
  1063	  margin-top: 12px;
  1064	  padding: 10px 14px;
  1065	  background: var(--color-fb-blue-tint);
  1066	  color: var(--color-fb-blue-heavy);
  1067	  border-radius: 12px;
  1068	  font-size: 13px;
  1069	  font-weight: 500;
  1070	  line-height: 18px;
  1071	}

exec
/bin/zsh -lc "printf '%s\\n' '--- types ---'; nl -ba src/shared/types.ts | sed -n '1,260p'; printf '%s\\n' '--- copy ---'; nl -ba src/shared/copy.ts | sed -n '1,320p'; printf '%s\\n' '--- recommend ---'; nl -ba src/main/recommend.ts | sed -n '1,320p';" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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
   111	export interface DiskHealthDevice {
   112	  friendlyName?: string;
   113	  mediaType?: string;
   114	  busType?: string;
   115	  sizeGb?: number | null;
   116	  healthStatus?: string;
   117	  operationalStatus?: string;
   118	}
   119	
   120	export interface MemoryPressureInfo {
   121	  totalMemoryMb?: number | null;
   122	  freeMemoryMb?: number | null;
   123	  freeMemoryPercent?: number | null;
   124	  pageFileTotalMb?: number;
   125	  pageFileUsedMb?: number;
   126	  pageFileUsagePercent?: number;
   127	}
   128	
   129	export interface WindowsUpdateStatusInfo {
   130	  installedHotfixCount: number;
   131	  latestHotfixInstalledOn?: string | null;
   132	  daysSinceLatestHotfix?: number | null;
   133	}
   134	
   135	export interface EventLogSummaryInfo {
   136	  windowDays: number;
   137	  criticalCount: number;
   138	  errorCount: number;
   139	}
   140	
   141	export interface DriverAgeSummaryInfo {
   142	  totalWithDate: number;
   143	  olderThan2Years: number;
   144	  olderThan2YearsPercent: number;
   145	}
   146	
   147	export interface StartupProgramItem {
   148	  name?: string;
   149	  command?: string;
   150	  location?: string;
   151	  user?: string;
   152	}
   153	
   154	export interface StartupProgramsInfo {
   155	  count: number;
   156	  items: StartupProgramItem[];
   157	}
   158	
   159	export interface DefenderStatusInfo {
   160	  antivirusEnabled?: boolean | null;
   161	  realTimeProtectionEnabled?: boolean | null;
   162	  antivirusSignatureAgeDays?: number | null;
   163	  lastQuickScanDaysAgo?: number | null;
   164	  lastFullScanDaysAgo?: number | null;
   165	}
   166	
   167	export interface StorageWasteInfo {
   168	  userTempGb: number;
   169	  localAppDataTempGb: number;
   170	  windowsTempGb: number;
   171	  windowsOldExists: boolean;
   172	  windowsOldGb: number;
   173	}
   174	
   175	/**
   176	 * Severity scale (v0.5.0 — adopted from design_handoff_format_buddy_app).
   177	 * Frame is **care-intensity**, not risk:
   178	 *   safe     (0-25)  — "괜찮아요"
   179	 *   watch    (26-50) — "체크해보면 좋아요"
   180	 *   organize (51-75) — "정리가 필요해요"
   181	 *   format   (76-100)— "꼭 챙길게요"
   182	 *
   183	 * Tone colors flow mint → teal → brand-blue → deep-blue inside one family.
   184	 * No red / yellow / black / risk-signaling colors anywhere on the spectrum.
   185	 */
   186	export type FormatSeverity = "safe" | "watch" | "organize" | "format";
   187	
   188	export interface ActionItem {
   189	  title: string;
   190	  description: string;
   191	  command?: string;
   192	}
   193	
   194	export interface ReasonItem {
   195	  signal: string;
   196	  label: string;
   197	  weightedScore: number;
   198	  description: string;
   199	}
   200	
   201	export interface Recommendation {
   202	  formatScore: number;
   203	  severity: FormatSeverity;
   204	  headline: string;
   205	  summary: string;
   206	  tryFirst: ActionItem[];
   207	  formatReasons: ReasonItem[];
   208	  afterFormat: ActionItem[];
   209	}
   210	
   211	export interface PrivacyInfo {
   212	  localOnly: boolean;
   213	  noPasswordCollection: boolean;
   214	  noPrivateKeyUpload: boolean;
   215	  noBrowserPasswordExtraction: boolean;
   216	}
   217	
   218	export interface ChecklistInfo {
   219	  reviewNpkiManually: boolean;
   220	  exportWifiProfilesManually: boolean;
   221	  backupDesktopDocumentsDownloads: boolean;
   222	  verifyCloudSync: boolean;
   223	  saveReportBeforeFormat: boolean;
   224	}
   225	
   226	export interface ScanReport {
   227	  schemaVersion: string;
   228	  generatedAt: string;
   229	  mode?: "quick" | "manifest";
   230	  privacy: PrivacyInfo;
   231	  system: SystemInfo;
   232	  disks: DiskInfo[];
   233	  diskHealth?: DiskHealthDevice[];
   234	  memoryPressure?: MemoryPressureInfo;
   235	  windowsUpdate?: WindowsUpdateStatusInfo;
   236	  eventLog?: EventLogSummaryInfo;
   237	  driverAge?: DriverAgeSummaryInfo;
   238	  startupPrograms?: StartupProgramsInfo;
   239	  defender?: DefenderStatusInfo;
   240	  storageWaste?: StorageWasteInfo;
   241	  userFolders: UserFolderInfo[];
   242	  gpu: string[];
   243	  installedApps: InstalledApp[];
   244	  drivers: DriverInfo[];
   245	  printers: PrinterInfo[];
   246	  wifiProfiles: string[];
   247	  npkiCandidates: NpkiCandidate[];
   248	  bitlocker: BitLockerVolume[];
   249	  cloudSync: CloudSyncCandidate[];
   250	  browsers: BrowserPresence[];
   251	  winget: WingetStatus;
   252	  wingetExport?: WingetExport | null;
   253	  diagnostics: Array<{ step: string; message: string }>;
   254	  checklist: ChecklistInfo;
   255	}
   256	
   257	export interface ScanResult {
   258	  report: ScanReport;
   259	  recommendation: Recommendation;
   260	  jsonPath: string;
--- copy ---
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
    62	  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요.",
    63	
    64	  onboardingSteps: [
    65	    {
    66	      tag: "01 / 03 · 진단",
    67	      head: "먼저, 같이 한 번",
    68	      headEm: "살펴볼게요.",
    69	      body: "내 PC를 천천히 훑어서 무엇을 챙겨야 할지 정리해요. 서버로는 아무것도 보내지 않아요."
    70	    },
    71	    {
    72	      tag: "02 / 03 · 백업",
    73	      head: "놓치기 쉬운 것부터",
    74	      headEm: "먼저 챙길게요.",
    75	      body: "공동인증서, 카카오톡, Wi-Fi. 한국 사용자가 가장 자주 빠뜨리는 항목을 우선으로 안내해요."
    76	    },
    77	    {
    78	      tag: "03 / 03 · 포맷",
    79	      head: "결정은 그때",
    80	      headEm: "같이 정해요.",
    81	      body: "버디는 포맷을 강요하지 않아요. 정리만으로 충분하면 그렇게 안내하고, 필요할 때만 다음 단계로 가요."
    82	    }
    83	  ] as const,
    84	  onboardingNext: "다음",
    85	  onboardingStart: "시작하기",
    86	  onboardingSkip: "건너뛰기",
    87	
    88	  errorHead: "지금은 진단을 잠깐 멈출게요.",
    89	  errorBodyDefault:
    90	    "한 번 더 시도하면 대부분 풀려요. 안 풀리면 PC를 잠깐 재시작해주세요.",
    91	  errorRetry: "다시 시도",
    92	  errorOpenLogs: "로그 위치 열기",
    93	  errorCodePrefix: "오류 코드 ",
    94	
    95	  recommendSectionTitle: "버디의 포맷 추천 점수",
    96	  recommendScoreSuffix: "/ 100",
    97	  recommendTryFirstTitle: "포맷 전에 먼저 시도해볼 것",
    98	  recommendFormatReasonsTitle: "이런 점들이 신경 쓰여요",
    99	  recommendAfterFormatTitle: "포맷 후 같이 챙길 것",
   100	  recommendNoReasons: "지금 발견된 큰 문제는 없어요. 정기 정리만 해도 충분해요.",
   101	  recommendCommandLabel: "실행",
   102	  recommendRunButton: "실행",
   103	  recommendRunOpenedToast: "Windows 설정에서 해당 화면을 열어드렸어요.",
   104	  recommendRunCopiedToast: "명령어를 복사했어요. cmd 또는 PowerShell 창에 붙여넣어 실행해주세요.",
   105	  recommendRunRejectedToast: "지금은 직접 실행이 어려운 명령이에요. 복사도 안 됐어요.",
   106	  /**
   107	   * Severity copy moved to a structured table (v0.5.0) so recommend.ts can
   108	   * build headline/summary from the same single source.
   109	   * Source: design_handoff_format_buddy_app/desktop-app.jsx SEVERITY const.
   110	   */
   111	  recommendSeverity: {
   112	    safe: {
   113	      chip: "괜찮아요",
   114	      head: "지금 PC, 굳이 포맷 안 해도 괜찮아요.",
   115	      sub: "몇 가지 정리만 해도 충분히 더 쓸 수 있어요. 가볍게 같이 살펴볼게요."
   116	    },
   117	    watch: {
   118	      chip: "체크해보면 좋아요",
   119	      head: "한 번 정리하면 한참 더 쓸 수 있어요.",
   120	      sub: "먼저 시도해볼 작업이 몇 가지 있어요. 그 다음에 다시 점수 볼게요."
   121	    },
   122	    organize: {
   123	      chip: "정리가 필요해요",
   124	      head: "포맷 전에, 같이 정리부터 시도해볼게요.",
   125	      sub: "아래 정리 작업으로 점수가 충분히 내려가면 포맷을 미뤄도 돼요."
   126	    },
   127	    format: {
   128	      chip: "꼭 챙길게요",
   129	      head: "PC가 좀 지쳐 있어요. 포맷이 가장 깔끔해요.",
   130	      sub: "백업부터 같이 챙길게요. 포맷 후 복원할 항목도 미리 정리해드릴게요."
   131	    }
   132	  } as const
   133	} as const;
--- recommend ---
     1	/**
     2	 * Recommendation engine — turns a raw ScanReport into a "format score" plus
     3	 * actionable advice. Pure function, no I/O, no electron imports → easy to test.
     4	 *
     5	 * Scoring philosophy (subject to change as we get Windows-field data):
     6	 *   - 100 = format strongly recommended
     7	 *   - 0   = healthy
     8	 *
     9	 * Weights are tuned conservatively: a single bad signal cannot push the score
    10	 * over the "format-required" threshold by itself; multiple bad signals must
    11	 * agree. This matches the friend-tone — we suggest "first try X" before
    12	 * suggesting "format".
    13	 */
    14	
    15	import type {
    16	  ActionItem,
    17	  Recommendation,
    18	  ReasonItem,
    19	  ScanReport,
    20	  FormatSeverity
    21	} from "@shared/types";
    22	import { copy } from "@shared/copy";
    23	
    24	const WEIGHTS = {
    25	  diskHealth: 0.30,
    26	  diskFree: 0.15,
    27	  memoryPressure: 0.10,
    28	  eventLog: 0.10,
    29	  windowsUpdate: 0.10,
    30	  driverAge: 0.10,
    31	  defender: 0.05,
    32	  storageWaste: 0.10
    33	} as const;
    34	
    35	function clamp01to100(v: number): number {
    36	  if (!isFinite(v)) return 0;
    37	  if (v < 0) return 0;
    38	  if (v > 100) return 100;
    39	  return v;
    40	}
    41	
    42	function diskHealthScore(report: ScanReport): number {
    43	  const health = report.diskHealth ?? [];
    44	  if (health.length === 0) return 0;
    45	  let worst = 0;
    46	  for (const d of health) {
    47	    const status = (d.healthStatus ?? "").toLowerCase();
    48	    const op = (d.operationalStatus ?? "").toLowerCase();
    49	    if (status.includes("unhealthy") || status.includes("failed")) worst = Math.max(worst, 100);
    50	    else if (status.includes("warning")) worst = Math.max(worst, 70);
    51	    else if (op && !op.includes("ok") && !op.includes("online")) worst = Math.max(worst, 60);
    52	  }
    53	  return worst;
    54	}
    55	
    56	function diskFreeScore(report: ScanReport): number {
    57	  if (!report.disks || report.disks.length === 0) return 0;
    58	  let worst = 0;
    59	  for (const d of report.disks) {
    60	    if (!d.sizeGb || d.sizeGb <= 0) continue;
    61	    const pct = (d.freeGb / d.sizeGb) * 100;
    62	    if (pct < 3) worst = Math.max(worst, 100);
    63	    else if (pct < 7) worst = Math.max(worst, 80);
    64	    else if (pct < 12) worst = Math.max(worst, 55);
    65	    else if (pct < 20) worst = Math.max(worst, 25);
    66	  }
    67	  return worst;
    68	}
    69	
    70	function memoryPressureScore(report: ScanReport): number {
    71	  const m = report.memoryPressure;
    72	  if (!m) return 0;
    73	  let s = 0;
    74	  if (typeof m.pageFileUsagePercent === "number") {
    75	    if (m.pageFileUsagePercent > 85) s = Math.max(s, 80);
    76	    else if (m.pageFileUsagePercent > 60) s = Math.max(s, 50);
    77	    else if (m.pageFileUsagePercent > 40) s = Math.max(s, 25);
    78	  }
    79	  if (typeof m.freeMemoryPercent === "number" && m.freeMemoryPercent !== null) {
    80	    if (m.freeMemoryPercent < 5) s = Math.max(s, 80);
    81	    else if (m.freeMemoryPercent < 12) s = Math.max(s, 50);
    82	  }
    83	  return s;
    84	}
    85	
    86	function eventLogScore(report: ScanReport): number {
    87	  const e = report.eventLog;
    88	  if (!e) return 0;
    89	  if (e.criticalCount >= 10) return 100;
    90	  if (e.criticalCount >= 5) return 70;
    91	  if (e.criticalCount >= 1) return 40;
    92	  if (e.errorCount >= 30) return 50;
    93	  if (e.errorCount >= 10) return 25;
    94	  return 0;
    95	}
    96	
    97	function windowsUpdateScore(report: ScanReport): number {
    98	  const w = report.windowsUpdate;
    99	  if (!w || w.daysSinceLatestHotfix == null) return 0;
   100	  if (w.daysSinceLatestHotfix > 120) return 80;
   101	  if (w.daysSinceLatestHotfix > 60) return 50;
   102	  if (w.daysSinceLatestHotfix > 35) return 30;
   103	  return 0;
   104	}
   105	
   106	function driverAgeScore(report: ScanReport): number {
   107	  const d = report.driverAge;
   108	  if (!d || d.totalWithDate === 0) return 0;
   109	  const p = d.olderThan2YearsPercent;
   110	  if (p > 80) return 70;
   111	  if (p > 60) return 50;
   112	  if (p > 40) return 25;
   113	  return 0;
   114	}
   115	
   116	function defenderScore(report: ScanReport): number {
   117	  const d = report.defender;
   118	  if (!d) return 0;
   119	  if (d.antivirusEnabled === false) return 80;
   120	  if (d.realTimeProtectionEnabled === false) return 60;
   121	  if (typeof d.antivirusSignatureAgeDays === "number" && d.antivirusSignatureAgeDays > 14) return 40;
   122	  return 0;
   123	}
   124	
   125	function storageWasteScore(report: ScanReport): number {
   126	  const s = report.storageWaste;
   127	  if (!s) return 0;
   128	  let v = 0;
   129	  if (s.windowsOldExists && s.windowsOldGb > 5) v = Math.max(v, 60);
   130	  const tempTotal = s.userTempGb + s.localAppDataTempGb + s.windowsTempGb;
   131	  if (tempTotal > 20) v = Math.max(v, 50);
   132	  else if (tempTotal > 10) v = Math.max(v, 25);
   133	  return v;
   134	}
   135	
   136	function getSeverity(score: number): FormatSeverity {
   137	  // v0.5.0 — adopted from design_handoff_format_buddy_app desktop-app.jsx
   138	  // severityFor(). Equal-width quartiles, 4-tier care-intensity scale.
   139	  if (score <= 25) return "safe";
   140	  if (score <= 50) return "watch";
   141	  if (score <= 75) return "organize";
   142	  return "format";
   143	}
   144	
   145	/**
   146	 * Disk-health override: if any disk reports Unhealthy/Failed/Warning, the
   147	 * severity is forced upward regardless of the weighted total. A failing
   148	 * drive is "back up RIGHT NOW", not "safe", even if every other signal
   149	 * is clean. (Names updated for v0.5.0 severity union.)
   150	 */
   151	function applyDiskHealthOverride(severity: FormatSeverity, rawDiskHealth: number): FormatSeverity {
   152	  if (rawDiskHealth >= 100) {
   153	    // Unhealthy / Failed → at least "organize"
   154	    if (severity === "safe" || severity === "watch") return "organize";
   155	  } else if (rawDiskHealth >= 70) {
   156	    // Warning → at least "watch"
   157	    if (severity === "safe") return "watch";
   158	  }
   159	  return severity;
   160	}
   161	
   162	function getHeadline(severity: FormatSeverity, _score: number): string {
   163	  // Single source for severity copy is shared/copy.ts (v0.5.0). recommend.ts
   164	  // just looks up; the score number is rendered separately by the UI.
   165	  return copy.recommendSeverity[severity].head;
   166	}
   167	
   168	function getSummary(severity: FormatSeverity, _reasons: ReasonItem[]): string {
   169	  return copy.recommendSeverity[severity].sub;
   170	}
   171	
   172	function pushReason(
   173	  reasons: ReasonItem[],
   174	  signal: string,
   175	  label: string,
   176	  rawScore: number,
   177	  weight: number,
   178	  description: string
   179	) {
   180	  if (rawScore <= 0) return;
   181	  // v0.4.1: floor is now based on raw score (must be ≥30/100) so low-weight
   182	  // signals (Defender = 5%) still surface when they go bad — previously the
   183	  // absolute `weighted < 5` floor silently dropped every Defender problem.
   184	  if (rawScore < 30) return;
   185	  const weighted = rawScore * weight;
   186	  reasons.push({ signal, label, weightedScore: Math.round(weighted * 10) / 10, description });
   187	}
   188	
   189	function buildTryFirst(report: ScanReport, reasons: ReasonItem[]): ActionItem[] {
   190	  const actions: ActionItem[] = [];
   191	  const signals = new Set(reasons.map((r) => r.signal));
   192	
   193	  actions.push({
   194	    title: "Windows 디스크 정리",
   195	    description: "임시 파일, 휴지통, 캐시를 한 번에 비워요. 시스템 파일까지 함께.",
   196	    command: "cleanmgr /sageset:1"
   197	  });
   198	  actions.push({
   199	    title: "시스템 파일 검사",
   200	    description: "Windows 핵심 파일이 손상됐는지 확인하고 자동 복구해요.",
   201	    command: "sfc /scannow"
   202	  });
   203	  actions.push({
   204	    title: "Windows 이미지 복구",
   205	    description: "복구 대상 시스템 이미지를 Microsoft 서버에서 받아 채워줘요.",
   206	    command: "DISM /Online /Cleanup-Image /RestoreHealth"
   207	  });
   208	
   209	  if (signals.has("windows-update")) {
   210	    actions.push({
   211	      title: "Windows Update 실행",
   212	      description: "보안 패치가 한참 밀려 있어요. 업데이트만 받아도 많이 가벼워질 수 있어요.",
   213	      command: "start ms-settings:windowsupdate"
   214	    });
   215	  }
   216	  if (signals.has("disk-free")) {
   217	    actions.push({
   218	      title: "Storage Sense 켜기 + 큰 파일 정리",
   219	      description: "Downloads / Documents의 큰 파일부터 점검하면 여유 공간이 빨리 늘어요.",
   220	      command: "start ms-settings:storagesense"
   221	    });
   222	  }
   223	  if (signals.has("startup-bloat") || (report.startupPrograms && report.startupPrograms.count > 12)) {
   224	    actions.push({
   225	      title: "시작 프로그램 정리",
   226	      description: "PC를 켤 때 자동으로 뜨는 앱이 많아요. 필요 없는 것은 작업 관리자에서 꺼주세요.",
   227	      command: "taskmgr /0 /startup"
   228	    });
   229	  }
   230	  // v0.4.1: Defender action is now built directly from report.defender, not
   231	  // gated on signals.has("defender") — Defender's 5% weight means it could
   232	  // be filtered out of `reasons` even when antivirus is fully disabled.
   233	  const def = report.defender;
   234	  if (def && (def.antivirusEnabled === false || def.realTimeProtectionEnabled === false ||
   235	              (typeof def.antivirusSignatureAgeDays === "number" && def.antivirusSignatureAgeDays > 14))) {
   236	    actions.push({
   237	      title: "Windows Defender 보호 켜기",
   238	      description: "실시간 보호가 꺼져 있거나 시그니처가 오래됐어요. 보안 설정에서 한 번 확인해 주세요.",
   239	      command: "start windowsdefender:"
   240	    });
   241	  }
   242	
   243	  return actions;
   244	}
   245	
   246	function buildAfterFormat(report: ScanReport): ActionItem[] {
   247	  const actions: ActionItem[] = [];
   248	
   249	  if (report.winget?.available) {
   250	    actions.push({
   251	      title: "winget으로 앱 일괄 재설치",
   252	      description: "포맷 전 저장한 winget JSON으로 한 줄에 다시 깔 수 있어요.",
   253	      command: "winget import -i <winget-export.json>"
   254	    });
   255	  }
   256	  actions.push({
   257	    title: "백업 manifest 검증",
   258	    description: "포맷 전 만든 manifest의 SHA-256과 복원된 파일을 비교해 빠진 게 없는지 확인하세요."
   259	  });
   260	  if (report.npkiCandidates?.some((n) => n.exists)) {
   261	    actions.push({
   262	      title: "공동인증서(NPKI) 복원",
   263	      description: "NPKI 폴더를 통째로 새 PC의 같은 경로에 복사하면 바로 사용 가능해요."
   264	    });
   265	  }
   266	  if (report.cloudSync?.some((c) => c.exists)) {
   267	    actions.push({
   268	      title: "클라우드 동기화 재연결",
   269	      description: "OneDrive · Google Drive · Dropbox에 다시 로그인하고 동기화 폴더를 지정하세요."
   270	    });
   271	  }
   272	  actions.push({
   273	    title: "Windows Update + Defender 첫 스캔",
   274	    description: "새 시스템에서 가장 먼저 보안 업데이트와 풀 스캔을 한 번 돌려두세요."
   275	  });
   276	  return actions;
   277	}
   278	
   279	export function generateRecommendation(report: ScanReport): Recommendation {
   280	  const reasons: ReasonItem[] = [];
   281	
   282	  const dHealth = diskHealthScore(report);
   283	  const dFree = diskFreeScore(report);
   284	  const mem = memoryPressureScore(report);
   285	  const ev = eventLogScore(report);
   286	  const wu = windowsUpdateScore(report);
   287	  const da = driverAgeScore(report);
   288	  const def = defenderScore(report);
   289	  const sw = storageWasteScore(report);
   290	
   291	  pushReason(reasons, "disk-health", "디스크 건강", dHealth, WEIGHTS.diskHealth,
   292	    "디스크 자체가 보고하는 상태(S.M.A.R.T.)에 경고가 있어요. 하드웨어 문제일 수 있으니 데이터 백업이 가장 시급해요.");
   293	  pushReason(reasons, "disk-free", "저장 공간", dFree, WEIGHTS.diskFree,
   294	    "C 드라이브 여유 공간이 많이 부족해요. Windows 자체가 느려지는 가장 흔한 원인이에요.");
   295	  pushReason(reasons, "memory-pressure", "메모리 압박", mem, WEIGHTS.memoryPressure,
   296	    "메모리가 빠듯해서 디스크 페이지파일을 자주 쓰고 있어요. 평소 작업이 느릴 수 있어요.");
   297	  pushReason(reasons, "event-log", "시스템 이벤트", ev, WEIGHTS.eventLog,
   298	    "최근 7일간 시스템 critical/error 이벤트가 누적되어 있어요. 일관된 문제일 가능성.");
   299	  pushReason(reasons, "windows-update", "Windows 업데이트", wu, WEIGHTS.windowsUpdate,
   300	    "보안 패치가 오래 밀려 있어요. 업데이트만 받아도 안정성과 보안이 크게 좋아져요.");
   301	  pushReason(reasons, "driver-age", "드라이버 나이", da, WEIGHTS.driverAge,
   302	    "2년 이상 된 드라이버 비율이 높아요. 일부는 호환성 문제의 원인이 될 수 있어요.");
   303	  pushReason(reasons, "defender", "백신 상태", def, WEIGHTS.defender,
   304	    "Windows Defender 보호가 꺼져 있거나 시그니처가 오래됐어요.");
   305	  pushReason(reasons, "storage-waste", "잔여 시스템 찌꺼기", sw, WEIGHTS.storageWaste,
   306	    "windows.old 같은 큰 시스템 잔여물 또는 임시 파일이 누적되어 있어요. 청소로 회복 가능.");
   307	
   308	  reasons.sort((a, b) => b.weightedScore - a.weightedScore);
   309	
   310	  const totalWeighted =
   311	    dHealth * WEIGHTS.diskHealth +
   312	    dFree * WEIGHTS.diskFree +
   313	    mem * WEIGHTS.memoryPressure +
   314	    ev * WEIGHTS.eventLog +
   315	    wu * WEIGHTS.windowsUpdate +
   316	    da * WEIGHTS.driverAge +
   317	    def * WEIGHTS.defender +
   318	    sw * WEIGHTS.storageWaste;
   319	
   320	  const formatScore = Math.round(clamp01to100(totalWeighted));

exec
/bin/zsh -lc "nl -ba src/main/recommend.ts | sed -n '320,480p'
printf '\\n--- tests ---\\n'
nl -ba tests/recommend.test.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   320	  const formatScore = Math.round(clamp01to100(totalWeighted));
   321	  const severity = applyDiskHealthOverride(getSeverity(formatScore), dHealth);
   322	  const headline = getHeadline(severity, formatScore);
   323	  const summary = getSummary(severity, reasons);
   324	
   325	  return {
   326	    formatScore,
   327	    severity,
   328	    headline,
   329	    summary,
   330	    tryFirst: buildTryFirst(report, reasons),
   331	    formatReasons: reasons,
   332	    afterFormat: buildAfterFormat(report)
   333	  };
   334	}
   335	
   336	export const __testing = {
   337	  diskHealthScore,
   338	  diskFreeScore,
   339	  memoryPressureScore,
   340	  eventLogScore,
   341	  windowsUpdateScore,
   342	  driverAgeScore,
   343	  defenderScore,
   344	  storageWasteScore,
   345	  getSeverity,
   346	  applyDiskHealthOverride,
   347	  WEIGHTS
   348	};

--- tests ---
     1	import { describe, it, expect } from "vitest";
     2	import { generateRecommendation, __testing } from "../src/main/recommend";
     3	import type { ScanReport } from "../src/shared/types";
     4	
     5	function baseReport(overrides: Partial<ScanReport> = {}): ScanReport {
     6	  return {
     7	    schemaVersion: "0.4.0-quick-test",
     8	    generatedAt: new Date().toISOString(),
     9	    mode: "quick",
    10	    privacy: {
    11	      localOnly: true,
    12	      noPasswordCollection: true,
    13	      noPrivateKeyUpload: true,
    14	      noBrowserPasswordExtraction: true
    15	    },
    16	    system: {
    17	      manufacturer: "Mock",
    18	      model: "Test",
    19	      osCaption: "Windows 11 Pro",
    20	      osVersion: "10.0.22631",
    21	      cpu: "Mock CPU",
    22	      memoryGb: 16
    23	    },
    24	    disks: [{ drive: "C:", sizeGb: 500, freeGb: 250 }],
    25	    diskHealth: [
    26	      { healthStatus: "Healthy", operationalStatus: "OK", sizeGb: 500, mediaType: "SSD" }
    27	    ],
    28	    memoryPressure: {
    29	      totalMemoryMb: 16384,
    30	      freeMemoryMb: 8000,
    31	      freeMemoryPercent: 48.8,
    32	      pageFileTotalMb: 8192,
    33	      pageFileUsedMb: 1024,
    34	      pageFileUsagePercent: 12.5
    35	    },
    36	    windowsUpdate: { installedHotfixCount: 30, daysSinceLatestHotfix: 7 },
    37	    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 2 },
    38	    driverAge: { totalWithDate: 40, olderThan2Years: 5, olderThan2YearsPercent: 12.5 },
    39	    startupPrograms: { count: 5, items: [] },
    40	    defender: {
    41	      antivirusEnabled: true,
    42	      realTimeProtectionEnabled: true,
    43	      antivirusSignatureAgeDays: 1,
    44	      lastQuickScanDaysAgo: 2,
    45	      lastFullScanDaysAgo: 10
    46	    },
    47	    storageWaste: {
    48	      userTempGb: 0.5,
    49	      localAppDataTempGb: 1.0,
    50	      windowsTempGb: 0.2,
    51	      windowsOldExists: false,
    52	      windowsOldGb: 0
    53	    },
    54	    userFolders: [],
    55	    gpu: [],
    56	    installedApps: [],
    57	    drivers: [],
    58	    printers: [],
    59	    wifiProfiles: [],
    60	    npkiCandidates: [],
    61	    bitlocker: [],
    62	    cloudSync: [],
    63	    browsers: [],
    64	    winget: { available: true, note: "" },
    65	    diagnostics: [],
    66	    checklist: {
    67	      reviewNpkiManually: true,
    68	      exportWifiProfilesManually: true,
    69	      backupDesktopDocumentsDownloads: true,
    70	      verifyCloudSync: true,
    71	      saveReportBeforeFormat: true
    72	    },
    73	    ...overrides
    74	  };
    75	}
    76	
    77	describe("generateRecommendation — severity buckets", () => {
    78	  it("healthy PC scores in safe band and exposes no format reasons", () => {
    79	    const rec = generateRecommendation(baseReport());
    80	    expect(rec.severity).toBe("safe");
    81	    expect(rec.formatScore).toBeLessThanOrEqual(25);
    82	    expect(rec.formatReasons.length).toBe(0);
    83	    expect(rec.tryFirst.length).toBeGreaterThan(0); // always offers cleanmgr/sfc/dism
    84	    expect(rec.afterFormat.length).toBeGreaterThan(0);
    85	  });
    86	
    87	  it("low disk free + memory pressure pushes into watch / organize", () => {
    88	    const rec = generateRecommendation(
    89	      baseReport({
    90	        disks: [{ drive: "C:", sizeGb: 500, freeGb: 25 }],
    91	        memoryPressure: {
    92	          totalMemoryMb: 8192,
    93	          freeMemoryMb: 800,
    94	          freeMemoryPercent: 9.8,
    95	          pageFileTotalMb: 4096,
    96	          pageFileUsedMb: 3700,
    97	          pageFileUsagePercent: 90.3
    98	        }
    99	      })
   100	    );
   101	    expect(rec.formatScore).toBeGreaterThan(15);
   102	    expect(rec.formatReasons.some((r) => r.signal === "disk-free")).toBe(true);
   103	    expect(rec.formatReasons.some((r) => r.signal === "memory-pressure")).toBe(true);
   104	  });
   105	
   106	  it("unhealthy disk + event criticals + old updates pushes to organize or higher", () => {
   107	    const rec = generateRecommendation(
   108	      baseReport({
   109	        diskHealth: [
   110	          { healthStatus: "Unhealthy", operationalStatus: "Lost Communication", sizeGb: 500, mediaType: "HDD" }
   111	        ],
   112	        eventLog: { windowDays: 7, criticalCount: 12, errorCount: 40 },
   113	        windowsUpdate: { installedHotfixCount: 12, daysSinceLatestHotfix: 200 },
   114	        driverAge: { totalWithDate: 50, olderThan2Years: 45, olderThan2YearsPercent: 90 },
   115	        defender: {
   116	          antivirusEnabled: false,
   117	          realTimeProtectionEnabled: false,
   118	          antivirusSignatureAgeDays: 40,
   119	          lastQuickScanDaysAgo: 60,
   120	          lastFullScanDaysAgo: 365
   121	        },
   122	        storageWaste: {
   123	          userTempGb: 6,
   124	          localAppDataTempGb: 10,
   125	          windowsTempGb: 8,
   126	          windowsOldExists: true,
   127	          windowsOldGb: 12
   128	        },
   129	        disks: [{ drive: "C:", sizeGb: 256, freeGb: 6 }],
   130	        memoryPressure: {
   131	          totalMemoryMb: 4096,
   132	          freeMemoryMb: 100,
   133	          freeMemoryPercent: 2.4,
   134	          pageFileTotalMb: 2048,
   135	          pageFileUsedMb: 1900,
   136	          pageFileUsagePercent: 92.7
   137	        }
   138	      })
   139	    );
   140	    expect(["organize", "format"]).toContain(rec.severity);
   141	    expect(rec.formatReasons.length).toBeGreaterThanOrEqual(5);
   142	    // disk-health must be the top reason
   143	    expect(rec.formatReasons[0].signal).toBe("disk-health");
   144	  });
   145	
   146	  it("score clamps to 0..100", () => {
   147	    const rec = generateRecommendation(
   148	      baseReport({
   149	        diskHealth: [{ healthStatus: "Failed", operationalStatus: "Lost Communication" }],
   150	        disks: [{ drive: "C:", sizeGb: 100, freeGb: 0.5 }],
   151	        eventLog: { windowDays: 7, criticalCount: 100, errorCount: 500 },
   152	        windowsUpdate: { installedHotfixCount: 1, daysSinceLatestHotfix: 9999 },
   153	        driverAge: { totalWithDate: 100, olderThan2Years: 100, olderThan2YearsPercent: 100 },
   154	        defender: {
   155	          antivirusEnabled: false,
   156	          realTimeProtectionEnabled: false,
   157	          antivirusSignatureAgeDays: 9999,
   158	          lastQuickScanDaysAgo: 9999,
   159	          lastFullScanDaysAgo: 9999
   160	        },
   161	        storageWaste: {
   162	          userTempGb: 999,
   163	          localAppDataTempGb: 999,
   164	          windowsTempGb: 999,
   165	          windowsOldExists: true,
   166	          windowsOldGb: 999
   167	        },
   168	        memoryPressure: {
   169	          totalMemoryMb: 2048,
   170	          freeMemoryMb: 1,
   171	          freeMemoryPercent: 0.05,
   172	          pageFileTotalMb: 1024,
   173	          pageFileUsedMb: 1024,
   174	          pageFileUsagePercent: 100
   175	        }
   176	      })
   177	    );
   178	    expect(rec.formatScore).toBeGreaterThanOrEqual(0);
   179	    expect(rec.formatScore).toBeLessThanOrEqual(100);
   180	  });
   181	});
   182	
   183	describe("severity thresholds (v0.5.0 — adopted from design_handoff_format_buddy_app)", () => {
   184	  it("getSeverity maps quartile boundaries correctly", () => {
   185	    expect(__testing.getSeverity(0)).toBe("safe");
   186	    expect(__testing.getSeverity(25)).toBe("safe");
   187	    expect(__testing.getSeverity(26)).toBe("watch");
   188	    expect(__testing.getSeverity(50)).toBe("watch");
   189	    expect(__testing.getSeverity(51)).toBe("organize");
   190	    expect(__testing.getSeverity(75)).toBe("organize");
   191	    expect(__testing.getSeverity(76)).toBe("format");
   192	    expect(__testing.getSeverity(100)).toBe("format");
   193	  });
   194	
   195	  it("weights sum to 1.0", () => {
   196	    const total = Object.values(__testing.WEIGHTS).reduce((s, w) => s + w, 0);
   197	    expect(total).toBeCloseTo(1.0, 5);
   198	  });
   199	});
   200	
   201	describe("disk-health override + Defender visibility", () => {
   202	  it("failed disk alone forces at least organize even with low score", () => {
   203	    const rec = generateRecommendation(
   204	      baseReport({
   205	        diskHealth: [{ healthStatus: "Failed", operationalStatus: "Lost Communication" }]
   206	      })
   207	    );
   208	    // dHealth 100 * 0.30 = 30 raw → would map to watch without override
   209	    expect(["organize", "format"]).toContain(rec.severity);
   210	    expect(rec.formatReasons[0].signal).toBe("disk-health");
   211	  });
   212	
   213	  it("disabled Defender surfaces as both a reason AND a try-first action", () => {
   214	    const rec = generateRecommendation(
   215	      baseReport({
   216	        defender: {
   217	          antivirusEnabled: false,
   218	          realTimeProtectionEnabled: false,
   219	          antivirusSignatureAgeDays: 40,
   220	          lastQuickScanDaysAgo: 90,
   221	          lastFullScanDaysAgo: 365
   222	        }
   223	      })
   224	    );
   225	    expect(rec.formatReasons.some((r) => r.signal === "defender")).toBe(true);
   226	    const defenderAction = rec.tryFirst.find((a) => a.title.includes("Defender"));
   227	    expect(defenderAction).toBeDefined();
   228	  });
   229	
   230	  it("warning disk forces severity into at least watch", () => {
   231	    const rec = generateRecommendation(
   232	      baseReport({
   233	        diskHealth: [{ healthStatus: "Warning", operationalStatus: "OK", sizeGb: 500, mediaType: "SSD" }]
   234	      })
   235	    );
   236	    expect(["watch", "organize", "format"]).toContain(rec.severity);
   237	  });
   238	});

exec
/bin/zsh -lc "nl -ba src/shared/types.ts | sed -n '260,360p'
printf '\\n--- package ---\\n'
cat package.json" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   260	  jsonPath: string;
   261	}
   262	
   263	export interface ScanError {
   264	  message: string;
   265	  code?: string;
   266	  detail?: string;
   267	}
   268	
   269	export interface ExportOptions {
   270	  defaultFileName?: string;
   271	}
   272	
   273	export interface ExportResult {
   274	  saved: boolean;
   275	  path?: string;
   276	}
   277	
   278	export interface ManifestExportResult {
   279	  saved: boolean;
   280	  path?: string;
   281	  fileCount?: number;
   282	  totalBytes?: number;
   283	  message?: string;
   284	}
   285	
   286	export interface UpdateInfo {
   287	  version: string;
   288	  releaseDate?: string;
   289	  releaseNotes?: string | null;
   290	}
   291	
   292	export interface UpdateDownloadProgress {
   293	  bytesPerSecond: number;
   294	  percent: number;
   295	  transferred: number;
   296	  total: number;
   297	}
   298	
   299	export interface UpdateErrorPayload {
   300	  message: string;
   301	}
   302	
   303	export interface WindowState {
   304	  isMaximized: boolean;
   305	}
   306	
   307	export interface ActionRunResult {
   308	  mode: "opened-url" | "copied-to-clipboard" | "rejected";
   309	  detail?: string;
   310	}

--- package ---
{
  "name": "formatbuddy-desktop",
  "version": "0.5.3",
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
    "@electron-toolkit/utils": "3.0.0",
    "electron-updater": "^6.3.9"
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

exec
/bin/zsh -lc "python3 -c 'def lum(h):
    h=h.lstrip(\"#\"); rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    def f(c): return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    R,G,B=[f(c) for c in rgb]; return 0.2126*R+0.7152*G+0.0722*B
def con(a,b):
    la,lb=lum(a),lum(b); L1,L2=max(la,lb),min(la,lb); return (L1+0.05)/(L2+0.05)
for c in [\"#2dc9a8\",\"#1ea0d6\",\"#0066ff\",\"#0040b5\",\"#ffffff\",\"#eaf2fe\"]: print(c, round(lum(c),3), \"vs white\", round(con(c,\"#ffffff\"),2), \"vs tint\", round(con(c,\"#eaf2fe\"),2))'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2101ms:
2026-05-18 15:41:27.176 xcodebuild[4934:41804082]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:41:27.329 xcodebuild[4934:41804081] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
python3: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
python3: error: couldn't create cache file '/tmp/xcrun_db-sVpVSTjj' (errno=Operation not permitted)
2026-05-18 15:41:27.876 xcodebuild[4936:41804114]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:41:28.026 xcodebuild[4936:41804113] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
#2dc9a8 0.452 vs white 2.09 vs tint 1.86
#1ea0d6 0.303 vs white 2.98 vs tint 2.64
#0066ff 0.167 vs white 4.83 vs tint 4.29
#0040b5 0.07 vs white 8.75 vs tint 7.76
#ffffff 1.0 vs white 1.0 vs tint 1.13
#eaf2fe 0.882 vs white 1.13 vs tint 1.0

exec
/bin/zsh -lc "git diff 372f073..0513911 -- src/shared/copy.ts src/renderer/src/pages/Report.tsx src/main/index.ts src/renderer/src/App.tsx | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2059ms:
2026-05-18 15:42:20.017 xcodebuild[5001:41804947]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:42:20.169 xcodebuild[5001:41804946] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-P4O5SzRf' (errno=Operation not permitted)
2026-05-18 15:42:20.726 xcodebuild[5004:41804967]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:42:20.875 xcodebuild[5004:41804966] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/src/main/index.ts b/src/main/index.ts
index aacd759..123c944 100644
--- a/src/main/index.ts
+++ b/src/main/index.ts
@@ -1,9 +1,10 @@
-import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
+import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
 import { electronApp, optimizer } from "@electron-toolkit/utils";
 import { join } from "node:path";
 import { promises as fs } from "node:fs";
 import { IpcChannels } from "@shared/ipc";
 import type {
+  ActionRunResult,
   ExportOptions,
   ExportResult,
   ManifestExportResult,
@@ -11,6 +12,47 @@ import type {
   ScanProgress,
   ScanResult
 } from "@shared/types";
+
+/**
+ * Whitelist of safe URL schemes that we let `shell.openExternal` hand to
+ * the OS. ms-settings: deep links open the Settings app at the right pane
+ * (e.g. Windows Update, Storage Sense, Defender) — no shell injection
+ * surface. Anything else falls back to "copy to clipboard" so the user
+ * can review and paste manually.
+ */
+const SAFE_URL_SCHEMES = /^(ms-settings|windowsdefender|ms-store|ms-availablenetworks|https):/i;
+const DEEP_LINK_FROM_SHELL = /^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i;
+
+async function runActionCommand(rawCommand: string): Promise<ActionRunResult> {
+  const trimmed = (rawCommand ?? "").trim();
+  if (!trimmed) return { mode: "rejected", detail: "empty command" };
+
+  // 1) bare URL scheme → openExternal
+  if (SAFE_URL_SCHEMES.test(trimmed)) {
+    try {
+      await shell.openExternal(trimmed);
+      return { mode: "opened-url", detail: trimmed };
+    } catch (e) {
+      return { mode: "rejected", detail: (e as Error).message };
+    }
+  }
+
+  // 2) `start ms-settings:…` form → extract URL and openExternal
+  const deepLink = trimmed.match(DEEP_LINK_FROM_SHELL);
+  if (deepLink) {
+    try {
+      await shell.openExternal(deepLink[1]);
+      return { mode: "opened-url", detail: deepLink[1] };
+    } catch (e) {
+      return { mode: "rejected", detail: (e as Error).message };
+    }
+  }
+
+  // 3) anything else (cleanmgr, sfc, DISM, taskmgr, winget …) → clipboard.
+  // We refuse to spawn shell commands directly; the user reviews and pastes.
+  clipboard.writeText(trimmed);
+  return { mode: "copied-to-clipboard", detail: trimmed };
+}
 import { runBackupManifest, runScan } from "./scanner";
 import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
 import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";
@@ -28,6 +70,7 @@ function createWindow() {
     minHeight: 640,
     show: false,
     autoHideMenuBar: true,
+    frame: false, // v0.5.1 — custom WinChrome handles min/max/close
     backgroundColor: "#FFFFFF",
     title: "FormatBuddy",
     webPreferences: {
@@ -42,6 +85,15 @@ function createWindow() {
     mainWindow?.show();
   });
 
+  const emitWindowState = () => {
+    if (!mainWindow || mainWindow.isDestroyed()) return;
+    mainWindow.webContents.send(IpcChannels.windowState, {
+      isMaximized: mainWindow.isMaximized()
+    });
+  };
+  mainWindow.on("maximize", emitWindowState);
+  mainWindow.on("unmaximize", emitWindowState);
+
   mainWindow.webContents.setWindowOpenHandler(({ url }) => {
     try {
       const parsed = new URL(url);
@@ -142,6 +194,24 @@ function registerIpc() {
     return true;
   });
 
+  ipcMain.handle(IpcChannels.windowMinimize, () => {
+    BrowserWindow.getFocusedWindow()?.minimize();
+    return true;
+  });
+
+  ipcMain.handle(IpcChannels.windowMaximizeToggle, () => {
+    const win = BrowserWindow.getFocusedWindow();
+    if (!win) return false;
+    if (win.isMaximized()) win.unmaximize();
+    else win.maximize();
+    return win.isMaximized();
+  });
+
+  ipcMain.handle(IpcChannels.windowClose, () => {
+    BrowserWindow.getFocusedWindow()?.close();
+    return true;
+  });
+
   ipcMain.handle(IpcChannels.manifestExport, async (): Promise<ManifestExportResult> => {
     const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
     const defaultPath = getDefaultExportPath("formatbuddy-backup-manifest.json");
@@ -165,6 +235,10 @@ function registerIpc() {
       return { saved: false, message: e.message };
     }
   });
+
+  ipcMain.handle(IpcChannels.actionRun, async (_e, payload: { command: string }) => {
+    return runActionCommand(payload?.command ?? "");
+  });
 }
 
 app.whenReady().then(() => {
diff --git a/src/renderer/src/App.tsx b/src/renderer/src/App.tsx
index 7c40b61..e9c9af1 100644
--- a/src/renderer/src/App.tsx
+++ b/src/renderer/src/App.tsx
@@ -2,15 +2,38 @@ import { useCallback, useEffect, useMemo, useState } from "react";
 import { Home } from "./pages/Home";
 import { Scanning } from "./pages/Scanning";
 import { Report } from "./pages/Report";
+import { Onboarding } from "./pages/Onboarding";
+import { ErrorScreen } from "./pages/ErrorScreen";
 import { UpdateBanner } from "./components/UpdateBanner";
+import { WinChrome } from "./components/WinChrome";
+import { TopBar } from "./components/TopBar";
 import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
 
+const ONBOARDING_SEEN_KEY = "formatbuddy:onboardingSeenAt";
+
 type Phase =
+  | { kind: "onboarding" }
   | { kind: "home" }
   | { kind: "scanning"; progress: ScanProgress }
   | { kind: "report"; result: ScanResult }
   | { kind: "error"; error: ScanError };
 
+function readOnboardingSeen(): boolean {
+  try {
+    return Boolean(localStorage.getItem(ONBOARDING_SEEN_KEY));
+  } catch {
+    return false;
+  }
+}
+
+function markOnboardingSeen() {
+  try {
+    localStorage.setItem(ONBOARDING_SEEN_KEY, new Date().toISOString());
+  } catch {
+    // private mode / quota — ignore, user just sees onboarding next time
+  }
+}
+
 const INITIAL_PROGRESS: ScanProgress = {
   step: "준비",
   doneSteps: 0,
@@ -28,9 +51,16 @@ const INITIAL_PROGRESS: ScanProgress = {
 };
 
 export function App() {
-  const [phase, setPhase] = useState<Phase>({ kind: "home" });
+  const [phase, setPhase] = useState<Phase>(() =>
+    readOnboardingSeen() ? { kind: "home" } : { kind: "onboarding" }
+  );
   const [appVersion, setAppVersion] = useState<string>("");
 
+  const finishOnboarding = useCallback(() => {
+    markOnboardingSeen();
+    setPhase({ kind: "home" });
+  }, []);
+
   useEffect(() => {
     if (typeof window.fb?.appVersion === "function") {
       void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
@@ -78,8 +108,22 @@ export function App() {
 
   const goHome = useCallback(() => setPhase({ kind: "home" }), []);
 
+  const topBar = useMemo(() => {
+    if (phase.kind === "home" || phase.kind === "onboarding") return null;
+    const versionLabel = appVersion ? `v${appVersion}` : undefined;
+    if (phase.kind === "scanning")
+      return <TopBar here="진단 중" meta="로컬에서만 처리됨" version={versionLabel} onBack={goHome} />;
+    if (phase.kind === "report")
+      return <TopBar here="리포트" meta="로컬에서만 처리됨" version={versionLabel} onBack={goHome} />;
+    if (phase.kind === "error")
+      return <TopBar here="잠시 멈췄어요" version={versionLabel} onBack={goHome} />;
+    return null;
+  }, [phase, appVersion, goHome]);
+
   const content = useMemo(() => {
     switch (phase.kind) {
+      case "onboarding":
+        return <Onboarding onComplete={finishOnboarding} />;
       case "home":
         return <Home onStartScan={startScan} />;
       case "scanning":
@@ -87,20 +131,15 @@ export function App() {
       case "report":
         return <Report result={phase.result} onBack={goHome} />;
       case "error":
-        return (
-          <Scanning
-            progress={INITIAL_PROGRESS}
-            errorMessage={phase.error.message}
-            onCancel={goHome}
-            onRetry={startScan}
-          />
-        );
+        return <ErrorScreen error={phase.error} onRetry={startScan} onBack={goHome} />;
     }
-  }, [phase, startScan, cancelScan, goHome]);
+  }, [phase, startScan, cancelScan, goHome, finishOnboarding]);
 
   return (
     <div className="fb-app">
-      {content}
+      <WinChrome />
+      {topBar}
+      <div className="fb-app-body">{content}</div>
       <UpdateBanner />
       <footer className="fb-app-footer">
         <span>FormatBuddy Desktop</span>
diff --git a/src/renderer/src/pages/Report.tsx b/src/renderer/src/pages/Report.tsx
index cc36e54..713ab54 100644
--- a/src/renderer/src/pages/Report.tsx
+++ b/src/renderer/src/pages/Report.tsx
@@ -1,22 +1,34 @@
 import { useCallback, useMemo, useState } from "react";
 import { Button } from "../components/Button";
 import { Lockup } from "../components/Lockup";
+import { CloudBuddy } from "../components/CloudBuddy";
 import { copy } from "@shared/copy";
-import type { ScanResult } from "@shared/types";
+import type { ActionItem, ScanResult } from "@shared/types";
+
+function expressionForScore(score: number): "calm" | "smile" | "wink" {
+  if (score >= 76) return "calm";
+  if (score >= 26) return "smile";
+  return "wink";
+}
+
+const HEAVY_REASON_THRESHOLD = 5;
 
 function severityClass(s: ScanResult["recommendation"]["severity"]): string {
   switch (s) {
-    case "healthy":
-      return "fb-score-healthy";
+    case "safe":

2026-05-18T06:42:31.409533Z ERROR codex_core::tools::router: error=write_stdin failed: Unknown process id 89750
exec
/bin/zsh -lc "git diff 372f073..0513911 -- src/shared/copy.ts | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2036ms:
2026-05-18 15:42:36.928 xcodebuild[5024:41805274]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:42:37.078 xcodebuild[5024:41805272] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-KaxA2GYN' (errno=Operation not permitted)
2026-05-18 15:42:37.627 xcodebuild[5026:41805309]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:42:37.775 xcodebuild[5026:41805308] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/src/shared/copy.ts b/src/shared/copy.ts
index f34358a..552baf7 100644
--- a/src/shared/copy.ts
+++ b/src/shared/copy.ts
@@ -61,17 +61,73 @@ export const copy = {
   manifestExportErrorPrefix: "지금 만들지 못했어요: ",
   manifestWindowsOnly: "이 기능은 Windows에서만 동작해요.",
 
+  onboardingSteps: [
+    {
+      tag: "01 / 03 · 진단",
+      head: "먼저, 같이 한 번",
+      headEm: "살펴볼게요.",
+      body: "내 PC를 천천히 훑어서 무엇을 챙겨야 할지 정리해요. 서버로는 아무것도 보내지 않아요."
+    },
+    {
+      tag: "02 / 03 · 백업",
+      head: "놓치기 쉬운 것부터",
+      headEm: "먼저 챙길게요.",
+      body: "공동인증서, 카카오톡, Wi-Fi. 한국 사용자가 가장 자주 빠뜨리는 항목을 우선으로 안내해요."
+    },
+    {
+      tag: "03 / 03 · 포맷",
+      head: "결정은 그때",
+      headEm: "같이 정해요.",
+      body: "버디는 포맷을 강요하지 않아요. 정리만으로 충분하면 그렇게 안내하고, 필요할 때만 다음 단계로 가요."
+    }
+  ] as const,
+  onboardingNext: "다음",
+  onboardingStart: "시작하기",
+  onboardingSkip: "건너뛰기",
+
+  errorHead: "지금은 진단을 잠깐 멈출게요.",
+  errorBodyDefault:
+    "한 번 더 시도하면 대부분 풀려요. 안 풀리면 PC를 잠깐 재시작해주세요.",
+  errorRetry: "다시 시도",
+  errorOpenLogs: "로그 위치 열기",
+  errorCodePrefix: "오류 코드 ",
+
   recommendSectionTitle: "버디의 포맷 추천 점수",
-  recommendScoreSuffix: "점",
+  recommendScoreSuffix: "/ 100",
   recommendTryFirstTitle: "포맷 전에 먼저 시도해볼 것",
   recommendFormatReasonsTitle: "이런 점들이 신경 쓰여요",
   recommendAfterFormatTitle: "포맷 후 같이 챙길 것",
   recommendNoReasons: "지금 발견된 큰 문제는 없어요. 정기 정리만 해도 충분해요.",
-  recommendCommandLabel: "직접 실행",
+  recommendCommandLabel: "실행",
+  recommendRunButton: "실행",
+  recommendRunOpenedToast: "Windows 설정에서 해당 화면을 열어드렸어요.",
+  recommendRunCopiedToast: "명령어를 복사했어요. cmd 또는 PowerShell 창에 붙여넣어 실행해주세요.",
+  recommendRunRejectedToast: "지금은 직접 실행이 어려운 명령이에요. 복사도 안 됐어요.",
+  /**
+   * Severity copy moved to a structured table (v0.5.0) so recommend.ts can
+   * build headline/summary from the same single source.
+   * Source: design_handoff_format_buddy_app/desktop-app.jsx SEVERITY const.
+   */
   recommendSeverity: {
-    healthy: "건강해요",
-    watch: "조금 지쳐 있어요",
-    "format-recommended": "새로 시작 추천",
-    "format-required": "새로 시작 강력 추천"
+    safe: {
+      chip: "괜찮아요",
+      head: "지금 PC, 굳이 포맷 안 해도 괜찮아요.",
+      sub: "몇 가지 정리만 해도 충분히 더 쓸 수 있어요. 가볍게 같이 살펴볼게요."
+    },
+    watch: {
+      chip: "체크해보면 좋아요",
+      head: "한 번 정리하면 한참 더 쓸 수 있어요.",
+      sub: "먼저 시도해볼 작업이 몇 가지 있어요. 그 다음에 다시 점수 볼게요."
+    },
+    organize: {
+      chip: "정리가 필요해요",
+      head: "포맷 전에, 같이 정리부터 시도해볼게요.",
+      sub: "아래 정리 작업으로 점수가 충분히 내려가면 포맷을 미뤄도 돼요."
+    },
+    format: {
+      chip: "꼭 챙길게요",
+      head: "PC가 좀 지쳐 있어요. 포맷이 가장 깔끔해요.",
+      sub: "백업부터 같이 챙길게요. 포맷 후 복원할 항목도 미리 정리해드릴게요."
+    }
   } as const
 } as const;

exec
/bin/zsh -lc "grep -R \"interface Window\\|runActionCommand\\|onWindowState\\|minimizeWindow\" -n src | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 278ms:
src/renderer/src/components/WinChrome.tsx:41:    if (!window.fb?.onWindowState) return;
src/renderer/src/components/WinChrome.tsx:42:    return window.fb.onWindowState((state) => setIsMaximized(state.isMaximized));
src/renderer/src/components/WinChrome.tsx:56:          onClick={() => void window.fb?.minimizeWindow()}
src/renderer/src/pages/Report.tsx:93:    if (!action.command || !window.fb?.runActionCommand) return;
src/renderer/src/pages/Report.tsx:95:    const res = await window.fb.runActionCommand(action.command);
src/shared/types.ts:129:export interface WindowsUpdateStatusInfo {
src/shared/types.ts:303:export interface WindowState {
src/main/index.ts:26:async function runActionCommand(rawCommand: string): Promise<ActionRunResult> {
src/main/index.ts:240:    return runActionCommand(payload?.command ?? "");
src/preload/index.ts:89:  minimizeWindow: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowMinimize),
src/preload/index.ts:93:  onWindowState(cb: (state: WindowState) => void): () => void {
src/preload/index.ts:99:  runActionCommand: (command: string): Promise<ActionRunResult> =>
src/preload/index.d.ts:4:  interface Window {

exec
/bin/zsh -lc 'cat src/preload/index.d.ts && grep -R "FbBridge" -n src tsconfig*' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
import type { FbBridge } from "./index";

declare global {
  interface Window {
    fb: FbBridge;
  }
}

export {};
src/preload/index.ts:105:export type FbBridge = typeof fb;
src/preload/index.d.ts:1:import type { FbBridge } from "./index";
src/preload/index.d.ts:5:    fb: FbBridge;

exec
/bin/zsh -lc "nl -ba src/renderer/src/components/CloudBuddy.tsx | sed -n '1,280p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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

exec
/bin/zsh -lc "nl -ba src/renderer/src/components/Button.tsx | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
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

exec
/bin/zsh -lc "git show 372f073:src/renderer/src/App.tsx | nl -ba | sed -n '1,180p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2040ms:
2026-05-18 15:43:57.984 xcodebuild[5175:41807639]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:43:58.132 xcodebuild[5175:41807635] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-2lQzHg1p' (errno=Operation not permitted)
2026-05-18 15:43:58.678 xcodebuild[5178:41807672]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:43:58.829 xcodebuild[5178:41807671] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
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

exec
/bin/zsh -lc "find /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app -maxdepth 2 -type f | sed -n '1,120p' && grep -R \"SEVERITY\\|weighted\\|score\\|tone\\|start ms\\|execution\\|실행\" -n /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app | sed -n '1,200p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 396ms:
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/index.html:28:            <DCArtboard id="desktop-home" label="Home · 첫 실행 / 대기" width={1080} height={760}>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/index.html:37:              <ReportScreen score={86} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/CLAUDE_CODE_PROMPT.md:36:- severity 헬퍼: `desktop-app.jsx` 의 `SEVERITY` 상수 + `severityFor()` 를 `src/lib/severity.ts` 로 이관
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/CLAUDE_CODE_PROMPT.md:101:- **Severity tone 색이 일관성 없어 보일 때**: `severityFor()` 헬퍼만 통해서 접근하도록 컨벤션 잡기. tone 값 하드코딩 금지.
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:29:  --fb-blue-tint:   #EAF2FE; /* For pill chips, score panel, tag bg */
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:374:.scan-score {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:383:.scan-score .label {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:390:.scan-score .value {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:398:.scan-score .value .unit {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:405:.scan-score .sub {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:411:.scan-score .ring { width: 76px; height: 76px; }
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:693:.fb-review-stats .score {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1042:.score-hero {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1051:.score-hero .num-wrap {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1056:.score-hero .num {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1063:.score-hero .unit {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1069:.score-hero .body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1070:.score-hero .sev-chip {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1085:.score-hero .sev-chip .dot {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1089:.score-hero .hed {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1097:.score-hero .sub {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css:1106:.score-hero .sub .sep { color: var(--fb-ink-4); }
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:16:첫 실행
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:59:### 4단계 (`desktop-app.jsx` 의 `SEVERITY` 상수)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:61:| 단계 | 범위 | 칩 라벨 | tone (hex) | 헤드라인 |
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:71:`severityFor(score)` 헬퍼로 점수만 넘기면 단계 객체가 나옵니다 (desktop-app.jsx 참고).
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:76:- `score ≥ 76` → `calm` (작업 모드)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:77:- `26 ≤ score ≤ 75` → `smile` (기본)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:78:- `score ≤ 25` → `wink` (안심)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:88:| 1 | `<HomeScreen />` | Home — 첫 실행 / 대기 | 1080×760 | CloudBuddy 132 + 3-step 미니 카드 |
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:90:| 3 | `<ReportScreen score={86} />` | Report — 86점 풀 | 1080×1820 | Score hero + 4개 카드 (`TryBefore` / `Concerns` / `AfterFormat` / `Manifest`) |
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:92:| 5–7 | `<OnboardingScreen step={1\|2\|3} />` | 첫 실행 3-step | 1080×760 | 좌측 카피 + 우측 CloudBuddy(on-blue) |
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:100:1. **`<ScoreHero />`** — 큰 점수 (96px, tone 색) + severity 칩 + 메타 (진단 시각·항목수·로컬 처리됨) + CloudBuddy 88px (표정은 점수에 따라)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:101:2. **`<TryBeforeFormat />`** — *"포맷 전에 먼저 시도해볼 것"*. 디스크 정리 / SFC scan / 시작프로그램 정리 등. 각 행에 명령어 칩 + `[실행]` 버튼.
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:190:  score: number;                // 0-100, severityFor() 로 단계화
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/APP_HANDOFF.md:225:- 컬러 대비: tone 색은 본문 위 솔리드 사용 시 4.5:1 이상 보장 — mint(#2DC9A8)는 큰 숫자(96px)에만 사용, 작은 텍스트엔 ink-1 사용.
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:31:const SEVERITY = {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:35:    tone: '#2DC9A8',
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:42:    tone: '#1EA0D6',
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:49:    tone: 'var(--fb-blue)',
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:56:    tone: 'var(--fb-blue-heavy)',
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:61:function severityFor(score) {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:62:  if (score <= 25) return { key: 'safe', ...SEVERITY.safe };
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:63:  if (score <= 50) return { key: 'watch', ...SEVERITY.watch };
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:64:  if (score <= 75) return { key: 'organize', ...SEVERITY.organize };
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:65:  return { key: 'format', ...SEVERITY.format };
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:201:// 3) Report — full layout (score 86)
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:203:function SevChip({ tone, label }) {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:206:      <span className="dot" style={{ background: tone }}></span>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:212:function ScoreHero({ score = 86 }) {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:213:  const s = severityFor(score);
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:214:  const expression = score >= 76 ? 'calm' : score >= 26 ? 'smile' : 'wink';
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:216:    <div className="score-hero">
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:218:        <span className="num" style={{ color: s.tone }}>{score}</span>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:222:        <SevChip tone={s.tone} label={s.chip} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:262:              <button className="run-btn">실행</button>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:362:function ReportScreen({ score = 86 }) {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:364:    <DesktopWindow height={1820} label={`Desktop · Report (${score}점)`}>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:367:        <ScoreHero score={score} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:380:function SevCard({ score }) {
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:381:  const s = severityFor(score);
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:384:      <span className="chip"><span className="dot" style={{ background: s.tone }}></span>{s.chip}</span>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:385:      <div className="num" style={{ color: s.tone }}>{score}<span className="u">/ 100</span></div>
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:393:      <SevCard score={18} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:394:      <SevCard score={42} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:395:      <SevCard score={65} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:396:      <SevCard score={86} />
/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx:435:// 6) Error — calm tone (replaces red banner)
Binary file /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/fonts/PretendardVariable.ttf matches

exec
/bin/zsh -lc "nl -ba /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/styles.css | sed -n '1040,1095p'
nl -ba /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/desktop-app.jsx | sed -n '200,230p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
  1040	}
  1041	
  1042	.score-hero {
  1043	  border: 1px solid var(--fb-line);
  1044	  border-radius: var(--fb-r-20);
  1045	  padding: 28px 32px;
  1046	  display: grid;
  1047	  grid-template-columns: auto 1fr auto;
  1048	  gap: 28px;
  1049	  align-items: center;
  1050	}
  1051	.score-hero .num-wrap {
  1052	  display: flex;
  1053	  align-items: baseline;
  1054	  gap: 4px;
  1055	}
  1056	.score-hero .num {
  1057	  font-size: 96px;
  1058	  font-weight: 800;
  1059	  letter-spacing: -0.05em;
  1060	  line-height: 0.9;
  1061	  font-feature-settings: 'tnum' on;
  1062	}
  1063	.score-hero .unit {
  1064	  font-size: 22px;
  1065	  font-weight: 700;
  1066	  color: var(--fb-ink-3);
  1067	  letter-spacing: -0.02em;
  1068	}
  1069	.score-hero .body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  1070	.score-hero .sev-chip {
  1071	  display: inline-flex;
  1072	  align-items: center;
  1073	  gap: 7px;
  1074	  height: 28px;
  1075	  padding: 0 12px 0 10px;
  1076	  background: #fff;
  1077	  border: 1px solid var(--fb-line);
  1078	  border-radius: 99px;
  1079	  font-size: 12px;
  1080	  font-weight: 700;
  1081	  color: var(--fb-ink-1);
  1082	  letter-spacing: -0.012em;
  1083	  width: fit-content;
  1084	}
  1085	.score-hero .sev-chip .dot {
  1086	  width: 8px; height: 8px;
  1087	  border-radius: 99px;
  1088	}
  1089	.score-hero .hed {
  1090	  font-size: 22px;
  1091	  font-weight: 800;
  1092	  letter-spacing: -0.028em;
  1093	  color: var(--fb-ink-1);
  1094	  line-height: 1.25;
  1095	  margin: 0;
   200	// ============================================================
   201	// 3) Report — full layout (score 86)
   202	// ============================================================
   203	function SevChip({ tone, label }) {
   204	  return (
   205	    <div className="sev-chip">
   206	      <span className="dot" style={{ background: tone }}></span>
   207	      {label}
   208	    </div>
   209	  );
   210	}
   211	
   212	function ScoreHero({ score = 86 }) {
   213	  const s = severityFor(score);
   214	  const expression = score >= 76 ? 'calm' : score >= 26 ? 'smile' : 'wink';
   215	  return (
   216	    <div className="score-hero">
   217	      <div className="num-wrap">
   218	        <span className="num" style={{ color: s.tone }}>{score}</span>
   219	        <span className="unit">/ 100</span>
   220	      </div>
   221	      <div className="body">
   222	        <SevChip tone={s.tone} label={s.chip} />
   223	        <h2 className="hed">{s.head}</h2>
   224	        <div className="sub">
   225	          <span>5월 18일 23:14 진단</span>
   226	          <span className="sep">·</span>
   227	          <span>56개 항목 검사</span>
   228	          <span className="sep">·</span>
   229	          <span>로컬에서만 처리됨</span>
   230	        </div>

exec
/bin/zsh -lc "git diff 372f073..0513911 -- src/main/recommend.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2054ms:
2026-05-18 15:46:06.921 xcodebuild[5326:41810678]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:46:07.078 xcodebuild[5326:41810676] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-Cus3w4A7' (errno=Operation not permitted)
2026-05-18 15:46:07.621 xcodebuild[5328:41810687]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:46:07.770 xcodebuild[5328:41810686] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/src/main/recommend.ts b/src/main/recommend.ts
index 2d65b1f..f9194d4 100644
--- a/src/main/recommend.ts
+++ b/src/main/recommend.ts
@@ -19,6 +19,7 @@ import type {
   ScanReport,
   FormatSeverity
 } from "@shared/types";
+import { copy } from "@shared/copy";
 
 const WEIGHTS = {
   diskHealth: 0.30,
@@ -133,50 +134,39 @@ function storageWasteScore(report: ScanReport): number {
 }
 
 function getSeverity(score: number): FormatSeverity {
-  // Thresholds tightened in v0.4.1 so a single critical signal (e.g. failing
-  // disk weighted = 100 * 0.30 = 30) cannot land in the "healthy" bucket.
-  if (score < 15) return "healthy";
-  if (score < 40) return "watch";
-  if (score < 70) return "format-recommended";
-  return "format-required";
+  // v0.5.0 — adopted from design_handoff_format_buddy_app desktop-app.jsx
+  // severityFor(). Equal-width quartiles, 4-tier care-intensity scale.
+  if (score <= 25) return "safe";
+  if (score <= 50) return "watch";
+  if (score <= 75) return "organize";
+  return "format";
 }
 
 /**
  * Disk-health override: if any disk reports Unhealthy/Failed/Warning, the
  * severity is forced upward regardless of the weighted total. A failing
- * drive is "back up RIGHT NOW", not "healthy", even if every other signal
- * is clean.
+ * drive is "back up RIGHT NOW", not "safe", even if every other signal
+ * is clean. (Names updated for v0.5.0 severity union.)
  */
 function applyDiskHealthOverride(severity: FormatSeverity, rawDiskHealth: number): FormatSeverity {
   if (rawDiskHealth >= 100) {
-    // Unhealthy / Failed
-    if (severity === "healthy" || severity === "watch") return "format-recommended";
+    // Unhealthy / Failed → at least "organize"
+    if (severity === "safe" || severity === "watch") return "organize";
   } else if (rawDiskHealth >= 70) {
-    // Warning
-    if (severity === "healthy") return "watch";
+    // Warning → at least "watch"
+    if (severity === "safe") return "watch";
   }
   return severity;
 }
 
-function getHeadline(severity: FormatSeverity, score: number): string {
-  if (severity === "healthy") return `${score}점 — 지금은 새로 시작 안 해도 괜찮아요`;
-  if (severity === "watch") return `${score}점 — 먼저 가볍게 정리해볼까요`;
-  if (severity === "format-recommended") return `${score}점 — 새로 시작하면 더 편할 것 같아요`;
-  return `${score}점 — 새로 시작을 추천드려요`;
+function getHeadline(severity: FormatSeverity, _score: number): string {
+  // Single source for severity copy is shared/copy.ts (v0.5.0). recommend.ts
+  // just looks up; the score number is rendered separately by the UI.
+  return copy.recommendSeverity[severity].head;
 }
 
-function getSummary(severity: FormatSeverity, reasons: ReasonItem[]): string {
-  if (severity === "healthy") {
-    return "PC가 전반적으로 잘 지내고 있어요. 정기 청소 정도면 충분해요.";
-  }
-  if (severity === "watch") {
-    return "조금 지쳐 보이는 부분이 있어요. 아래 '먼저 시도할 것'부터 차근차근 해보면 회복될 가능성이 높아요.";
-  }
-  if (severity === "format-recommended") {
-    const top = reasons[0]?.label ?? "여러 신호";
-    return `${top} 같은 문제가 모여 있어요. 위 항목들을 시도해도 회복이 안 되면 새로 시작이 더 빠를 수 있어요.`;
-  }
-  return "PC가 많이 지쳐 있어요. 무리해서 쓰기보다 백업 후 새로 시작하는 게 더 편할 거예요.";
+function getSummary(severity: FormatSeverity, _reasons: ReasonItem[]): string {
+  return copy.recommendSeverity[severity].sub;
 }
 
 function pushReason(

exec
/bin/zsh -lc "grep -R \"healthy\\|format-recommended\\|format-required\\|fb-score-healthy\\|fb-score-format\" -n src tests | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 321ms:
src/renderer/src/styles/globals.css:955:.fb-score-format   { --score-tone: var(--color-fb-tone-format); }
src/renderer/src/pages/Report.tsx:25:      return "fb-score-format";
src/main/recommend.ts:7: *   - 0   = healthy
src/main/recommend.ts:10: * over the "format-required" threshold by itself; multiple bad signals must
src/main/recommend.ts:49:    if (status.includes("unhealthy") || status.includes("failed")) worst = Math.max(worst, 100);
src/main/recommend.ts:146: * Disk-health override: if any disk reports Unhealthy/Failed/Warning, the
src/main/recommend.ts:153:    // Unhealthy / Failed → at least "organize"
tests/recommend.test.ts:78:  it("healthy PC scores in safe band and exposes no format reasons", () => {
tests/recommend.test.ts:106:  it("unhealthy disk + event criticals + old updates pushes to organize or higher", () => {
tests/recommend.test.ts:110:          { healthStatus: "Unhealthy", operationalStatus: "Lost Communication", sizeGb: 500, mediaType: "HDD" }

exec
/bin/zsh -lc "cat logs/codex-review-v0.5.x.md | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
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
session id: 019e39cf-f287-7890-8bf6-f1f563d4c3a8
--------
user
# Code review — FormatBuddy Desktop v0.5.x design overhaul

The v0.5.x train (v0.5.0 → v0.5.3) implements the v0.4.2 design handoff
(`design_handoff_format_buddy_app/`). Skip everything you've already
cleared in v0.1–v0.4 reviews — focus only on the new surface.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (PUBLIC)
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`
- Last commit: `0513911` (v0.5.3)
- Handoff source: `/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy_app/`

## v0.5.x changes

### v0.5.0 — Severity system rewrite
- shared/types.ts: FormatSeverity union now safe/watch/organize/format
  (was healthy/watch/format-recommended/format-required)
- shared/copy.ts: recommendSeverity is now a structured table
  `{ chip, head, sub }` per severity — single source for headline/summary
- main/recommend.ts: getSeverity uses quartile boundaries ≤25/≤50/≤75/else.
  applyDiskHealthOverride renamed targets (organize / watch).
  getHeadline/getSummary now lookup copy table, no more score-interp.
- renderer/Report.tsx severityClass maps to .fb-score-safe/-watch/-organize/-format
- renderer/styles/globals.css: 4 new tone variables
  --color-fb-tone-safe (#2DC9A8 mint) → -watch (#1EA0D6 teal) → -organize
  (brand blue) → -format (deep blue). Score number + badge dot consume
  --score-tone CSS variable.
- tests/recommend.test.ts: 22/22 pass (thresholds + names migrated)

### v0.5.1 — WinChrome + TopBar (frameless window)
- main/index.ts: `frame: false`, IPC handlers window:minimize / -maximize-toggle / -close + window:state push on (un)maximize
- shared/ipc.ts: 4 new channels
- preload: minimizeWindow / toggleMaximizeWindow / closeWindow / onWindowState
- renderer/components/WinChrome.tsx — 32px bar, CloudBuddy 14px + title left, 3 caption buttons right. Restore glyph swaps when isMaximized.
- renderer/components/TopBar.tsx — breadcrumb + meta + version, shown on every screen except Home (and Onboarding from v0.5.2).
- renderer/App.tsx layout reflowed: WinChrome (always) → TopBar (conditional) → fb-app-body (scrollable) → UpdateBanner → footer
- globals.css uses -webkit-app-region: drag on .fb-win-chrome and no-drag on caption buttons; .fb-app uses height: 100vh + overflow: hidden so chrome stays put.

### v0.5.2 — Onboarding + ErrorScreen
- renderer/pages/Onboarding.tsx — 3-step intro, 2-col (copy left, CloudBuddy on solid blue right). Step expression maps smile/calm/wink, step 1 is animated. Buttons: 다음/시작하기/건너뛰기.
- renderer/pages/ErrorScreen.tsx — replaces inline red banner. CloudBuddy 108 calm + soft headline + 다시 시도/처음으로 + collapsible 기술 정보 detail block.
- App.tsx: Phase union extended with "onboarding". Initial phase read from localStorage["formatbuddy:onboardingSeenAt"]; markOnboardingSeen() runs on completion or skip.
- shared/copy.ts: onboardingSteps array + error* strings.

### v0.5.3 — ScoreHero CloudBuddy + .heavy + [실행] IPC
- src/main/index.ts new helper `runActionCommand(rawCommand)`:
  - URL schemes ms-settings: / windowsdefender: / ms-store: / ms-availablenetworks: / https: → shell.openExternal
  - `start <deep-link>` form → extract URL and openExternal
  - everything else → clipboard.writeText(command) + return mode "copied-to-clipboard"
  - rejected with mode "rejected" on errors/empty
  - **explicit decision: no shell spawn from renderer-supplied commands.**
- shared/ipc.ts new channel action:run; shared/types.ts new ActionRunResult union
- preload: runActionCommand(command)
- renderer/Report.tsx:
  - ScoreHero now embeds CloudBuddy 88px (variant primary, expression mapped from score, animated only on safe)
  - Each tryFirst / afterFormat action's command renders a 28px outlined pill `[실행]` button next to the chip
  - formatReasons whose weightedScore ≥ 5 render with .fb-advice-weight-heavy (solid brand-blue + white)
- globals.css: .fb-score-card-buddy split, .fb-advice-cmd-row, .fb-run-btn, .fb-run-status, .fb-advice-weight-heavy

## Specifically check

1. **Severity tone color contrast / accessibility**
   - mint #2DC9A8 used at 96px on white — large text, contrast ratio?
   - teal #1EA0D6 at the same size?
   - badge text uses --score-tone on white — small text contrast on watch/safe?

2. **Action runner whitelist**
   - SAFE_URL_SCHEMES regex covers ms-settings|windowsdefender|ms-store|ms-availablenetworks|https. Anything dangerous slip through? javascript:, file:, data:, mailto:?
   - DEEP_LINK_FROM_SHELL regex `^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i` — escape, quoting, multi-arg variants?
   - clipboard fallback for non-URL — anything we should refuse outright?

3. **Frameless window + drag region**
   - `-webkit-app-region: drag` on .fb-win-chrome + no-drag on captions — buttons clickable on all OSes?
   - macOS dev mode: are drag and close still reliable?
   - When body content overflows, does the scrollbar interfere with the chrome drag region?

4. **Onboarding gating**
   - localStorage read in initial useState — SSR concern? React strict-mode double-init? Stale flag from a previous user on shared PC?
   - "건너뛰기" still marks seen — desired?
   - any way for a malformed value to bypass the check?

5. **ScoreHero CloudBuddy**
   - expressionForScore boundaries: ≥76 calm, ≥26 smile, else wink. Match handoff (handoff said ≥76 calm / 26-75 smile / ≤25 wink — equivalent).
   - animated only on safe — feels right? off on watch/organize/format intentionally?

6. **Heavy weight threshold**
   - weightedScore ≥ 5 → heavy. With current weights (max single weighted = 30 for diskHealth), is 5 too low? Anything ever marked "heavy" that shouldn't be?

7. **Anything else that smells**
   - copy.ts tone violations ("스캔", "리셋", "필수" etc) — any slipped in?
   - new components missing aria / keyboard nav?
   - new IPC channels overlapping with existing ones?

## Output format

Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). file:line + 1-line
fix. **If zero new issues, say so explicitly so I can mark v0.5.3 as the
stable design preview and stop the cycle.**
2026-05-18T06:39:50.444615Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T06:39:50.691736Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse --show-toplevel && git log --oneline -5' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 6500ms:
2026-05-18 15:40:07.336 xcodebuild[4727:41802005]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:07.604 xcodebuild[4727:41802002] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-gNv8Idjc' (errno=Operation not permitted)
2026-05-18 15:40:08.229 xcodebuild[4729:41802020]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:08.392 xcodebuild[4729:41802019] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v0.5.x.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-BlBFgZam' (errno=Operation not permitted)
2026-05-18 15:40:09.621 xcodebuild[4740:41802136]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:09.769 xcodebuild[4740:41802135] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-aFj0Zc4Q' (errno=Operation not permitted)
2026-05-18 15:40:10.313 xcodebuild[4742:41802147]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:10.457 xcodebuild[4742:41802145] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
/Users/ryanbak/claude/formatbuddy/desktop
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-NPgqtp0G' (errno=Operation not permitted)
2026-05-18 15:40:11.673 xcodebuild[4746:41802170]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:11.820 xcodebuild[4746:41802169] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-n8FeG3c5' (errno=Operation not permitted)
2026-05-18 15:40:12.364 xcodebuild[4748:41802188]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:12.518 xcodebuild[4748:41802187] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
0513911 feat(ui): ScoreHero CloudBuddy + .heavy reasons + [실행] IPC (v0.5.3)
d4ae8ac feat(ui): Onboarding 3-step + ErrorScreen 정식 화면 (v0.5.2)
fe7668f feat(ui): WinChrome + TopBar (v0.5.1)
ee71585 feat(design): severity system v0.5.0 — care-intensity frame (mint→deep-blue)
372f073 fix: 5 Codex v0.4.0 findings — recommendation accuracy + PowerShell correctness (v0.4.1)

exec
/bin/zsh -lc 'git diff --stat 372f073..0513911 && git diff --name-only 372f073..0513911' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4098ms:
2026-05-18 15:40:20.836 xcodebuild[4794:41802597]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:20.987 xcodebuild[4794:41802596] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-YQDasooJ' (errno=Operation not permitted)
2026-05-18 15:40:21.539 xcodebuild[4796:41802608]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:21.690 xcodebuild[4796:41802607] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 package.json                              |   2 +-
 src/main/index.ts                         |  76 +++++-
 src/main/recommend.ts                     |  48 ++--
 src/preload/index.ts                      |  20 +-
 src/renderer/src/App.tsx                  |  61 ++++-
 src/renderer/src/components/TopBar.tsx    |  46 ++++
 src/renderer/src/components/WinChrome.tsx |  79 ++++++
 src/renderer/src/pages/ErrorScreen.tsx    |  51 ++++
 src/renderer/src/pages/Onboarding.tsx     |  53 ++++
 src/renderer/src/pages/Report.tsx         | 108 ++++++--
 src/renderer/src/styles/globals.css       | 404 ++++++++++++++++++++++++++++--
 src/shared/copy.ts                        |  68 ++++-
 src/shared/ipc.ts                         |   7 +-
 src/shared/types.ts                       |  22 +-
 tests/recommend.test.ts                   |  42 ++--
 15 files changed, 973 insertions(+), 114 deletions(-)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-1EHI5jo7' (errno=Operation not permitted)
2026-05-18 15:40:22.905 xcodebuild[4800:41802660]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:23.053 xcodebuild[4800:41802659] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-UTY6ERfj' (errno=Operation not permitted)
2026-05-18 15:40:23.598 xcodebuild[4802:41802668]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 15:40:23.745 xcodebuild[4802:41802667] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
package.json
src/main/index.ts
src/main/recommend.ts
src/preload/index.ts
src/renderer/src/App.tsx
src/renderer/src/components/TopBar.tsx
src/renderer/src/components/WinChrome.tsx
src/renderer/src/pages/ErrorScreen.tsx
src/renderer/src/pages/Onboarding.tsx
src/renderer/src/pages/Report.tsx
src/renderer/src/styles/globals.css
src/shared/copy.ts
src/shared/ipc.ts
src/shared/types.ts
tests/recommend.test.ts

exec
/bin/zsh -lc "nl -ba src/main/index.ts | sed -n '1,260p'
printf '\\n--- shared/ipc.ts ---\\n'
nl -ba src/shared/ipc.ts | sed -n '1,220p'
printf '\\n--- preload ---\\n'
nl -ba src/preload/index.ts | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type {
     7	  ActionRunResult,
     8	  ExportOptions,
     9	  ExportResult,
    10	  ManifestExportResult,
    11	  ScanError,
    12	  ScanProgress,
    13	  ScanResult
    14	} from "@shared/types";
    15	
    16	/**
    17	 * Whitelist of safe URL schemes that we let `shell.openExternal` hand to
    18	 * the OS. ms-settings: deep links open the Settings app at the right pane
    19	 * (e.g. Windows Update, Storage Sense, Defender) — no shell injection
    20	 * surface. Anything else falls back to "copy to clipboard" so the user
    21	 * can review and paste manually.
    22	 */
    23	const SAFE_URL_SCHEMES = /^(ms-settings|windowsdefender|ms-store|ms-availablenetworks|https):/i;
    24	const DEEP_LINK_FROM_SHELL = /^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i;
    25	
    26	async function runActionCommand(rawCommand: string): Promise<ActionRunResult> {
    27	  const trimmed = (rawCommand ?? "").trim();
    28	  if (!trimmed) return { mode: "rejected", detail: "empty command" };
    29	
    30	  // 1) bare URL scheme → openExternal
    31	  if (SAFE_URL_SCHEMES.test(trimmed)) {
    32	    try {
    33	      await shell.openExternal(trimmed);
    34	      return { mode: "opened-url", detail: trimmed };
    35	    } catch (e) {
    36	      return { mode: "rejected", detail: (e as Error).message };
    37	    }
    38	  }
    39	
    40	  // 2) `start ms-settings:…` form → extract URL and openExternal

codex
The new surface has a functional navigation bug during active scans and accessibility regressions in the severity foreground colors. The action runner whitelist did not show an obvious shell-spawn escape in the reviewed paths.

Full review comments:

- [P2] Cancel scans from the scanning TopBar — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/App.tsx:115-115
  When the scan screen is active, this back control only calls `goHome`; it does not invoke `cancelScan`. Any in-flight scan continues and the progress handler can move the app from home back into scanning, or the completion event can still navigate to the report, so the breadcrumb back button cannot actually leave an active scan. Use `cancelScan` for the scanning TopBar or hide/disable the back action while scanning.

- [P2] Split decorative tones from text colors — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:952-953
  For safe/watch cards, `--score-tone` becomes `#2DC9A8`/`#1EA0D6` and the same variable is used as foreground for the 96px score and 13px badge text. On the actual `#EAF2FE` card background the contrast is about 1.86:1/2.64:1, and on white it is 2.09:1/2.98:1, below WCAG large-text and normal-text thresholds; keep the decorative dot tone separate from an accessible text tone or darken the safe/watch foregrounds.

- [P3] Give run buttons action-specific accessible names — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/pages/Report.tsx:175-180
  When several try-first or after-format commands are listed, every button's accessible name is just `실행`, so keyboard and screen-reader users cannot tell which command will be opened or copied. Add an `aria-label` that includes the action title or command on both action button render sites.
The new surface has a functional navigation bug during active scans and accessibility regressions in the severity foreground colors. The action runner whitelist did not show an obvious shell-spawn escape in the reviewed paths.

Full review comments:

- [P2] Cancel scans from the scanning TopBar — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/App.tsx:115-115
  When the scan screen is active, this back control only calls `goHome`; it does not invoke `cancelScan`. Any in-flight scan continues and the progress handler can move the app from home back into scanning, or the completion event can still navigate to the report, so the breadcrumb back button cannot actually leave an active scan. Use `cancelScan` for the scanning TopBar or hide/disable the back action while scanning.

- [P2] Split decorative tones from text colors — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:952-953
  For safe/watch cards, `--score-tone` becomes `#2DC9A8`/`#1EA0D6` and the same variable is used as foreground for the 96px score and 13px badge text. On the actual `#EAF2FE` card background the contrast is about 1.86:1/2.64:1, and on white it is 2.09:1/2.98:1, below WCAG large-text and normal-text thresholds; keep the decorative dot tone separate from an accessible text tone or darken the safe/watch foregrounds.

- [P3] Give run buttons action-specific accessible names — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/pages/Report.tsx:175-180
  When several try-first or after-format commands are listed, every button's accessible name is just `실행`, so keyboard and screen-reader users cannot tell which command will be opened or copied. Add an `aria-label` that includes the action title or command on both action button render sites.
