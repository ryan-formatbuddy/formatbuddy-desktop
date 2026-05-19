import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from "electron";
import type { Tray } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import log from "electron-log/main";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { IpcChannels } from "@shared/ipc";
import type {
  ActionRunResult,
  AppStateSnapshot,
  AppPlatform,
  AuditSnapshot,
  CleanupExecuteRequest,
  CleanupExecuteResult,
  CleanupHistorySnapshot,
  CleanupPlan,
  ExportOptions,
  ExportResult,
  IgnoreListUpdate,
  LargeFileCandidate,
  ManifestExportResult,
  ScanError,
  ScanProgress,
  ScanResult
} from "@shared/types";
import { planCleanup } from "./cleanup/planner";
import { defaultDeps, executeCleanup } from "./cleanup/executor";
import { getCleanupHistory } from "./cleanup/log";
import { appendAuditEntry, getAuditSnapshot } from "./audit/log";
import { buildAppManagerSnapshot } from "./apps/manager";
import { planAppLeftovers } from "./apps/leftovers";
import { runUninstall } from "./apps/uninstaller";
import { findInstalledApp, getLastScan, setLastScan } from "./lastScan";
import {
  defaultPowerShellRunner,
  getDefenderStatus,
  getThreatHistory,
  runQuickScan
} from "./security/defender";
import {
  loadPrefs as loadMonitorPrefs,
  markReminderShown,
  shouldRemind,
  updatePrefs as updateMonitorPrefs
} from "./monitor";
import { createTray, destroyTray } from "./tray";
import type {
  AppLeftoversSnapshot,
  AppManagerSnapshot,
  AppUninstallRequest,
  AppUninstallResult,
  DefenderLiveStatus,
  DefenderQuickScanResult,
  DefenderThreatSnapshot,
  MonitorPreferences,
  UpdateMonitorPreferencesRequest
} from "@shared/types";

/**
 * Whitelist of safe URL schemes that we let `shell.openExternal` hand to
 * the OS. ms-settings: deep links open the Settings app at the right pane
 * (e.g. Windows Update, Storage Sense, Defender) — no shell injection
 * surface. Anything else falls back to "copy to clipboard" so the user
 * can review and paste manually.
 */
const SAFE_URL_SCHEMES = /^(ms-settings|windowsdefender|ms-store|ms-availablenetworks|https|mailto):/i;
const DEEP_LINK_FROM_SHELL = /^start\s+(ms-settings:[\w-]+|windowsdefender:|ms-store:[^\s]+)$/i;

async function runActionCommand(rawCommand: string): Promise<ActionRunResult> {
  const trimmed = (rawCommand ?? "").trim();
  if (!trimmed) return { mode: "rejected", detail: "empty command" };

  // 1) bare URL scheme → openExternal
  if (SAFE_URL_SCHEMES.test(trimmed)) {
    try {
      await shell.openExternal(trimmed);
      return { mode: "opened-url", detail: trimmed };
    } catch (e) {
      return { mode: "rejected", detail: (e as Error).message };
    }
  }

  // 2) `start ms-settings:…` form → extract URL and openExternal
  const deepLink = trimmed.match(DEEP_LINK_FROM_SHELL);
  if (deepLink) {
    try {
      await shell.openExternal(deepLink[1]);
      return { mode: "opened-url", detail: deepLink[1] };
    } catch (e) {
      return { mode: "rejected", detail: (e as Error).message };
    }
  }

  // 3) anything else (cleanmgr, sfc, DISM, taskmgr, winget …) → clipboard.
  // We refuse to spawn shell commands directly; the user reviews and pastes.
  clipboard.writeText(trimmed);
  return { mode: "copied-to-clipboard", detail: trimmed };
}
import { runBackupManifest, runScan } from "./scanner";
import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
import {
  initAutoUpdater,
  installAndRestart,
  setUpdaterChannel,
  shutdownAutoUpdater
} from "./updater";
import { buildHtmlReport, buildHtmlReportFilename } from "./htmlReport";
import { getAppStateSnapshot, recordScanResult, updateIgnoreList } from "./localState";
import type { Recommendation, ScanReport } from "@shared/types";

/**
 * Lazily resolve and base64-encode the Wanted Sans Variable TTF so the
 * exported HTML embeds the same font for the recipient. Returns null when
 * the asset isn't shipped or readable; in that case the HTML report falls
 * back to system fonts.
 */
async function readWantedSansBase64(): Promise<string | null> {
  const candidates = [
    app.isPackaged ? join(process.resourcesPath, "fonts", "WantedSansVariable.ttf") : null,
    join(__dirname, "..", "..", "resources", "fonts", "WantedSansVariable.ttf"),
    join(process.cwd(), "resources", "fonts", "WantedSansVariable.ttf")
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(p);
      return buf.toString("base64");
    } catch {
      // try next
    }
  }
  return null;
}

let mainWindow: BrowserWindow | null = null;
let activeAbort: AbortController | null = null;
let trayInstance: Tray | null = null;
let reminderTimer: NodeJS.Timeout | null = null;
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function reconcileTray(prefs: MonitorPreferences): Promise<void> {
  if (prefs.trayEnabled) {
    if (trayInstance) return;
    trayInstance = createTray({
      onShowWindow: focusMainWindow,
      onStartScan: () => {
        focusMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IpcChannels.monitorTriggerScan);
        }
      },
      onQuit: () => {
        // Quit fully even if main window was just hidden. Without
        // app.quit the renderer thread can stay alive on macOS.
        app.quit();
      }
    });
    if (!trayInstance) {
      log.warn("monitor:tray failed to initialize (icon missing?)");
    } else {
      log.info("monitor:tray active");
    }
  } else if (trayInstance) {
    destroyTray(trayInstance);
    trayInstance = null;
    log.info("monitor:tray destroyed");
  }
}

async function reconcileReminderTimer(): Promise<void> {
  // The timer always runs once an hour while the app is alive. The
  // shouldRemind() decision inside decides whether to actually fire
  // a notification, so we don't need to start/stop the timer based
  // on prefs — and that means flipping the toggle takes effect on
  // the next tick without any wiring.
  if (reminderTimer) return;
  reminderTimer = setInterval(() => {
    void runReminderTick();
  }, REMINDER_CHECK_INTERVAL_MS);
  // Run once on startup so users who enable reminders right after
  // install don't wait an hour for the first check.
  setTimeout(() => void runReminderTick(), 30_000);
}

async function runReminderTick(): Promise<void> {
  try {
    const prefs = await loadMonitorPrefs(app.getPath("userData"));
    const lastScanAt = getLastScan()?.report.generatedAt;
    const decision = shouldRemind(prefs, lastScanAt, new Date());
    if (!decision.show) return;
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: "포맷버디",
      body:
        decision.staleDays !== undefined
          ? `마지막 점검이 ${decision.staleDays}일 전이에요. 한 번 더 살펴볼까요?`
          : "마지막 점검 이후 시간이 좀 지났어요. 한 번 더 살펴볼까요?"
    });
    notification.on("click", () => focusMainWindow());
    notification.show();
    await markReminderShown(app.getPath("userData"));
    log.info(`monitor:reminder shown staleDays=${decision.staleDays}`);
  } catch (err) {
    log.warn("monitor:reminder tick failed:", (err as Error).message);
  }
}

/**
 * electron-log setup. Logs land at:
 *   Windows: %APPDATA%/FormatBuddy/logs/main.log
 *   macOS:   ~/Library/Logs/FormatBuddy/main.log
 *   Linux:   ~/.config/FormatBuddy/logs/main.log
 * Rotating cap: 5 MiB per file. Renderer logs flow through the same
 * file via log.initialize() (works with our `frame: false` setup).
 */
log.initialize({ preload: false });
log.transports.file.level = "info";
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = "warn";

function logFilePath(): string {
  return log.transports.file.getFile().path;
}

const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 880,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    frame: false, // v0.5.1 — custom WinChrome handles min/max/close
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

  const emitWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IpcChannels.windowState, {
      isMaximized: mainWindow.isMaximized()
    });
  };
  mainWindow.on("maximize", emitWindowState);
  mainWindow.on("unmaximize", emitWindowState);

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
  ipcMain.handle(IpcChannels.appPlatform, (): AppPlatform => {
    if (process.platform === "win32" || process.platform === "darwin" || process.platform === "linux") {
      return process.platform;
    }
    return "unknown";
  });

  ipcMain.handle(IpcChannels.scanStart, async (event) => {
    if (activeAbort) activeAbort.abort();
    const controller = new AbortController();
    activeAbort = controller;
    const sender = event.sender;

    const emit = (progress: ScanProgress) => {
      if (sender.isDestroyed() || controller.signal.aborted) return;
      sender.send(IpcChannels.scanProgress, progress);
    };

    const isPreviewMode = process.platform !== "win32";
    log.info(isPreviewMode ? "scan:start invoked in preview mode" : "scan:start invoked");
    try {
      const result: ScanResult = await runScan({
        scriptPath: getScanScriptPath(),
        outputDir: getScanOutputDir(),
        signal: controller.signal,
        onProgress: emit,
        mock: isPreviewMode,
        enforceIntegrity: app.isPackaged
      });
      result.appState = await recordScanResult(app.getPath("userData"), result.report, result.recommendation);
      // Cache the result for app-manager IPC handlers — they need
      // installedApps with UninstallString, which only the scan has.
      setLastScan(result);
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
      if (isAbort) {
        log.info("scan cancelled");
      } else {
        log.error("scan failed:", e.message, "\n", e.stack);
      }
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

  ipcMain.handle(IpcChannels.appStateGet, async (): Promise<AppStateSnapshot> => {
    return getAppStateSnapshot(app.getPath("userData"));
  });

  ipcMain.handle(
    IpcChannels.ignoreListUpdate,
    async (_e, payload: IgnoreListUpdate) => {
      return updateIgnoreList(app.getPath("userData"), payload);
    }
  );

  ipcMain.handle(
    IpcChannels.reportExport,
    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const dialogResult = await dialog.showSaveDialog(win!, {
        title: "문제 해결용 자세한 파일 저장",
        defaultPath,
        filters: [{ name: "포맷버디 자세한 진단 파일", extensions: ["json"] }]
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

  ipcMain.handle(IpcChannels.updateInstall, () => {
    installAndRestart();
    return true;
  });

  ipcMain.handle(IpcChannels.windowMinimize, () => {
    BrowserWindow.getFocusedWindow()?.minimize();
    return true;
  });

  ipcMain.handle(IpcChannels.windowMaximizeToggle, () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle(IpcChannels.windowClose, () => {
    BrowserWindow.getFocusedWindow()?.close();
    return true;
  });

  ipcMain.handle(IpcChannels.manifestExport, async (): Promise<ManifestExportResult> => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const defaultPath = getDefaultExportPath("포맷버디_빠진파일_확인목록.json");
    const dialogResult = await dialog.showSaveDialog(win!, {
      title: "빠진 파일 확인 목록 저장 위치",
      defaultPath,
      filters: [{ name: "포맷버디 빠진 파일 확인 목록", extensions: ["json"] }]
    });
    if (dialogResult.canceled || !dialogResult.filePath) {
      return { saved: false };
    }
    try {
      const result = await runBackupManifest({
        scriptPath: getScanScriptPath(),
        outputPath: dialogResult.filePath,
        enforceIntegrity: app.isPackaged
      });
      return { saved: result.saved, path: result.path };
    } catch (err) {
      const e = err as Error;
      return { saved: false, message: e.message };
    }
  });

  ipcMain.handle(IpcChannels.actionRun, async (_e, payload: { command: string }) => {
    return runActionCommand(payload?.command ?? "");
  });

  ipcMain.handle(IpcChannels.logsOpenFolder, async () => {
    try {
      const folder = dirname(logFilePath());
      const result = await shell.openPath(folder);
      if (result) {
        log.warn("logs:open-folder failed:", result);
        return false;
      }
      return true;
    } catch (err) {
      log.error("logs:open-folder threw:", err);
      return false;
    }
  });

  /**
   * Open the Windows Recycle Bin so the user can restore something they
   * just sent there. shell:RecycleBinFolder is the standard Explorer
   * special namespace path; we spawn explorer.exe detached so the
   * Electron main process doesn't block on the GUI.
   */
  ipcMain.handle(IpcChannels.systemOpenRecycleBin, async (): Promise<boolean> => {
    if (process.platform !== "win32") {
      log.info("system:open-recycle-bin called on non-Windows; ignoring");
      return false;
    }
    try {
      const child = spawn("explorer.exe", ["shell:RecycleBinFolder"], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });
      child.unref();
      return true;
    } catch (err) {
      log.error("system:open-recycle-bin threw:", err);
      return false;
    }
  });

  ipcMain.handle(
    IpcChannels.cleanupPlan,
    async (_e, payload?: { largeFiles?: LargeFileCandidate[] }): Promise<CleanupPlan> => {
      return planCleanup({ env: { largeFiles: payload?.largeFiles ?? [] } });
    }
  );

  ipcMain.handle(
    IpcChannels.cleanupExecute,
    async (_e, request: CleanupExecuteRequest): Promise<CleanupExecuteResult> => {
      const deps = defaultDeps((path: string) => shell.trashItem(path));
      try {
        const result = await executeCleanup(request, {
          userDataDir: app.getPath("userData"),
          deps
        });
        log.info(
          `cleanup:execute mode=${result.mode} removed=${result.removedItems.length} freedBytes=${result.totalFreedBytes}`
        );
        const freedMb = (result.totalFreedBytes / 1024 / 1024).toFixed(1);
        await appendAuditEntry(app.getPath("userData"), {
          category: "cleanup",
          action: result.mode === "trash" ? "trash" : "permanent-delete",
          summary:
            result.mode === "trash"
              ? `휴지통으로 ${result.removedItems.length}개 항목(약 ${freedMb} MB)을 보냈어요.`
              : `${result.removedItems.length}개 항목(약 ${freedMb} MB)을 영구 삭제했어요.`,
          detail: {
            mode: result.mode,
            removedCount: result.removedItems.length,
            skippedCount: result.skippedItems.length,
            totalFreedBytes: result.totalFreedBytes
          }
        }).catch((e) => log.warn("audit append (cleanup) failed:", (e as Error).message));
        return result;
      } catch (err) {
        log.error("cleanup:execute failed:", (err as Error).message);
        throw err;
      }
    }
  );

  ipcMain.handle(IpcChannels.cleanupHistory, async (): Promise<CleanupHistorySnapshot> => {
    return getCleanupHistory(app.getPath("userData"));
  });

  ipcMain.handle(IpcChannels.appsList, async (): Promise<AppManagerSnapshot> => {
    const cached = getLastScan();
    return buildAppManagerSnapshot(cached?.report.installedApps ?? []);
  });

  ipcMain.handle(IpcChannels.appsLeftovers, async (): Promise<AppLeftoversSnapshot> => {
    const cached = getLastScan();
    return planAppLeftovers(cached?.report.installedApps ?? []);
  });

  ipcMain.handle(
    IpcChannels.appsUninstall,
    async (_e, request: AppUninstallRequest): Promise<AppUninstallResult> => {
      if (!getLastScan()) {
        return {
          status: "no-scan-cache",
          appName: request?.appName ?? "",
          message: "최근 진단 결과가 없어요. 점검을 한 번 돌린 뒤 다시 시도해주세요."
        };
      }
      const result = await runUninstall(request, {
        findApp: (req) => findInstalledApp(req.appName, req.publisher)
      });
      log.info(
        `apps:uninstall app=${request.appName} status=${result.status} detail=${result.detail ?? ""}`
      );
      await appendAuditEntry(app.getPath("userData"), {
        category: "uninstall",
        action: result.status,
        summary:
          result.status === "launched"
            ? `Windows 제거 마법사로 "${request.appName}"을 열었어요.`
            : result.status === "app-not-found"
              ? `"${request.appName}"의 제거 정보를 찾지 못했어요.`
              : result.status === "blocked"
                ? `"${request.appName}" 제거가 차단됐어요 (시스템 보호).`
                : result.status === "no-scan-cache"
                  ? "최근 진단 결과가 없어서 안내만 했어요."
                  : `"${request.appName}" 제거 시도 결과: ${result.status}`,
        detail: { appName: request.appName, status: result.status, detail: result.detail }
      }).catch((e) => log.warn("audit append (uninstall) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(IpcChannels.securityStatus, async (): Promise<DefenderLiveStatus> => {
    return getDefenderStatus({ shell: defaultPowerShellRunner() });
  });

  ipcMain.handle(IpcChannels.securityQuickScan, async (): Promise<DefenderQuickScanResult> => {
    const result = await runQuickScan({ shell: defaultPowerShellRunner() });
    log.info(`security:quick-scan status=${result.status} detail=${result.detail ?? ""}`);
    await appendAuditEntry(app.getPath("userData"), {
      category: "defender",
      action: result.status,
      summary:
        result.status === "launched"
          ? "Windows Defender 빠른 검사를 시작했어요. 결과는 Windows 보안에서 확인하세요."
          : result.status === "blocked"
            ? "Defender 빠른 검사를 시작하지 못했어요."
            : `Defender 빠른 검사 결과: ${result.status}`,
      detail: { status: result.status, detail: result.detail }
    }).catch((e) => log.warn("audit append (defender) failed:", (e as Error).message));
    return result;
  });

  ipcMain.handle(IpcChannels.securityThreats, async (): Promise<DefenderThreatSnapshot> => {
    return getThreatHistory({ shell: defaultPowerShellRunner() });
  });

  ipcMain.handle(IpcChannels.monitorGetPrefs, async (): Promise<MonitorPreferences> => {
    return loadMonitorPrefs(app.getPath("userData"));
  });

  ipcMain.handle(
    IpcChannels.monitorUpdatePrefs,
    async (_e, patch: UpdateMonitorPreferencesRequest): Promise<MonitorPreferences> => {
      const next = await updateMonitorPrefs(app.getPath("userData"), patch);
      log.info(
        `monitor:prefs tray=${next.trayEnabled} reminder=${next.reminderEnabled} days=${next.reminderDays} channel=${next.updateChannel}`
      );
      await reconcileTray(next);
      setUpdaterChannel(next.updateChannel);
      await appendAuditEntry(app.getPath("userData"), {
        category: "monitor",
        action: "prefs-changed",
        summary: `자동 알림 설정을 바꿨어요 — 트레이 ${next.trayEnabled ? "ON" : "OFF"}, 알림 ${next.reminderEnabled ? "ON" : "OFF"}(${next.reminderDays}일), 채널 ${next.updateChannel}.`,
        detail: {
          trayEnabled: next.trayEnabled,
          reminderEnabled: next.reminderEnabled,
          reminderDays: next.reminderDays,
          updateChannel: next.updateChannel
        }
      }).catch((e) => log.warn("audit append (monitor) failed:", (e as Error).message));
      return next;
    }
  );

  ipcMain.handle(IpcChannels.monitorReminderShown, async (): Promise<MonitorPreferences> => {
    return markReminderShown(app.getPath("userData"));
  });

  ipcMain.handle(IpcChannels.auditList, async (): Promise<AuditSnapshot> => {
    return getAuditSnapshot(app.getPath("userData"));
  });

  ipcMain.handle(
    IpcChannels.reportExportHtml,
    async (
      _e,
      payload: { report: ScanReport; recommendation: Recommendation }
    ): Promise<ExportResult> => {
      if (!payload?.report || !payload?.recommendation) {
        return { saved: false };
      }
      const fileName = buildHtmlReportFilename(payload.report, payload.recommendation);
      const defaultPath = join(app.getPath("desktop"), fileName);
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const dialogResult = await dialog.showSaveDialog(win!, {
        title: "공유용 리포트 저장 위치",
        defaultPath,
        filters: [{ name: "포맷버디 공유용 리포트", extensions: ["html"] }]
      });
      if (dialogResult.canceled || !dialogResult.filePath) {
        return { saved: false };
      }
      try {
        const fontBase64 = await readWantedSansBase64();
        const html = buildHtmlReport(payload.report, payload.recommendation, { fontBase64 });
        await fs.writeFile(dialogResult.filePath, html, "utf8");
        return { saved: true, path: dialogResult.filePath };
      } catch (err) {
        log.error("report:export-html failed:", err);
        return { saved: false };
      }
    }
  );
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("app.formatbuddy.desktop");

  app.on("browser-window-created", (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpc();
  createWindow();
  if (mainWindow) initAutoUpdater(mainWindow);

  void (async () => {
    try {
      const prefs = await loadMonitorPrefs(app.getPath("userData"));
      await reconcileTray(prefs);
      await reconcileReminderTimer();
      // Push the persisted update channel onto electron-updater. Initial
      // init() above used the default (stable) so this catches the case
      // where the user previously opted into beta.
      setUpdaterChannel(prefs.updateChannel);
    } catch (err) {
      log.warn("monitor:init failed:", (err as Error).message);
    }
  })();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    if (mainWindow) initAutoUpdater(mainWindow);
  });
});

app.on("before-quit", () => {
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  destroyTray(trayInstance);
  trayInstance = null;
  shutdownAutoUpdater();
});

app.on("window-all-closed", () => {
  // When the tray is active we keep the process alive so the icon
  // stays in the system tray and the reminder loop keeps ticking.
  // Without the tray we follow normal platform conventions.
  if (trayInstance) return;
  if (process.platform !== "darwin") app.quit();
});
