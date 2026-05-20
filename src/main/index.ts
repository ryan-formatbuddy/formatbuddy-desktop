import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from "electron";
import type { Tray } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import log from "electron-log/main";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { IpcChannels } from "@shared/ipc";
import {
  preservedRegistryBackupIds,
  recoverableRegistryBackupIds,
  registryBackupKindLabel,
  restorableRegistryBackupIds,
  restorableStartupDisabledIds,
  restorableTrashEntryIds
} from "@shared/cleanup-result";
import type {
  ActionRunResult,
  AppStateSnapshot,
  AppPlatform,
  AuditSnapshot,
  CleanupExecuteRequest,
  CleanupExecuteResult,
  CleanupHistorySnapshot,
  CleanupPlan,
  CleanupTrashRestoreRequest,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot,
  DriverBackupResult,
  StartupAutoDisabledSnapshot,
  StartupAutoSnapshot,
  StartupFolderDisableRequest,
  StartupFolderRestoreRequest,
  StartupFolderToggleResult,
  WifiExportRequest,
  WifiExportResult,
  ExportOptions,
  ExportResult,
  IgnoreListUpdate,
  InstalledApp,
  LargeFileCandidate,
  ManifestExportResult,
  RegistryBackupRestoreRequest,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot,
  RestoreBinPurgeResult,
  ScanError,
  ScanProgress,
  ScanStartRequest,
  ScanResult
} from "@shared/types";
import { planCleanup } from "./cleanup/planner";
import { defaultDeps, executeCleanup } from "./cleanup/executor";
import { enforceAppLeftoversCleanupPolicy, enforceProductCleanupPolicy } from "./cleanup/policy";
import {
  normalizeCleanupTrashRestoreRequest,
  normalizeRegistryBackupRestoreRequest
} from "./cleanup/restoreRequestPolicy";
import { getCleanupHistory } from "./cleanup/log";
import { getTrashSnapshot, restoreTrashEntry } from "./cleanup/trash";
import { purgeExpiredTrashWithAudit } from "./cleanup/trashAudit";
import {
  RETENTION_PURGE_INTERVAL_MS,
  runRetentionPurgeTick,
  type RetentionPurgeTrigger
} from "./retentionPurge";
import {
  createRestorePoint,
  defaultRestorePointRunner,
  type RestorePointResult
} from "./cleanup/restorePoint";
import { appendAuditEntry, getAuditSnapshot } from "./audit/log";
import { defaultDriverBackupRunner, exportDrivers } from "./driver/backup";
import { defaultWifiExportRunner, exportWifiProfiles } from "./wifi/export";
import { defaultStartupRunner, listStartupAuto } from "./startup/list";
import {
  disableStartupFolderEntry,
  listDisabledStartupFolderEntries,
  restoreStartupFolderEntry
} from "./startup/folderToggle";
import { normalizeStartupFolderRestoreRequest } from "./startup/folderToggleRequestPolicy";
import { purgeExpiredStartupFolderEntriesWithAudit } from "./startup/folderToggleAudit";
import { buildAppManagerSnapshot } from "./apps/manager";
import { cleanupAppLeftovers, planAppLeftovers } from "./apps/leftovers";
import { probeInstalledAppsForLeftoverGuard } from "./apps/installedAppsProbe";
import {
  listRegistryBackups,
  restoreRegistryBackup
} from "./apps/registryCleanup";
import { purgeExpiredRegistryBackupsWithAudit } from "./apps/registryBackupAudit";
import { canLaunchUninstall, runUninstall } from "./apps/uninstaller";
import { enforceAppUninstallRequestPolicy } from "./apps/uninstallRequestPolicy";
import {
  forgetUninstallFollowup,
  listUninstallFollowups,
  mergeUninstallFollowupApps,
  rememberUninstallFollowup
} from "./apps/uninstallFollowups";
import {
  clearLastScan,
  findInstalledApp,
  forgetRecentlyUninstallLaunchedApp,
  getLastScan,
  getLastScanIfFresh,
  getRecentlyUninstallLaunchedApps,
  rememberRecentlyUninstallLaunchedApp,
  setLastScan
} from "./lastScan";
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
import { reconcileLaunchAtLogin, shouldStartHiddenFromArgs } from "./monitorLogin";
import { createTray, destroyTray } from "./tray";
import type {
  AppLeftoversSnapshot,
  AppLeftoversCleanupRequest,
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
import { getAppStateSnapshot, getLatestScanAt, recordScanResult, updateIgnoreList } from "./localState";
import { ensureSafeOutputFilePath } from "./safeOutputPath";
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
let retentionPurgeTimer: NodeJS.Timeout | null = null;
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

async function runAppRetentionPurgeTick(
  trigger: RetentionPurgeTrigger
): Promise<RestoreBinPurgeResult> {
  return runRetentionPurgeTick({
    trigger,
    purgeTrash: (purgeTrigger) =>
      purgeExpiredTrashWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: purgeTrigger
      }),
    purgeRegistryBackups: (purgeTrigger) =>
      purgeExpiredRegistryBackupsWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: purgeTrigger
      }),
    purgeStartupDisabled: (purgeTrigger) =>
      purgeExpiredStartupFolderEntriesWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: purgeTrigger
      }),
    logInfo: (message) => log.info(`retention:${message}`),
    logWarn: (message) => log.warn(`retention:${message}`)
  });
}

function reconcileRetentionPurgeTimer(): void {
  if (retentionPurgeTimer) return;
  retentionPurgeTimer = setInterval(() => {
    void runAppRetentionPurgeTick("scheduled");
  }, RETENTION_PURGE_INTERVAL_MS);
}

function restorePointAuditSummary(result: RestorePointResult, actionDescription: string): string {
  if (result.created) {
    return `시스템 복원 지점을 만들었어요 (${actionDescription}).`;
  }
  switch (result.reason) {
    case "non-windows":
      return `이 기기에서는 시스템 복원 지점을 만들지 않아도 괜찮아요 (${actionDescription}).`;
    case "timeout":
      return `복원 지점 생성이 오래 걸려 안전 기록은 건너뛰었어요 (${actionDescription}). 작업은 계속 진행했어요.`;
    case "spawn-failed":
      return `Windows 복원 지점 도구를 열지 못해 안전 기록은 건너뛰었어요 (${actionDescription}). 작업은 계속 진행했어요.`;
    case "ps-error":
    default:
      return `Windows가 복원 지점 생성을 허용하지 않았어요 (${actionDescription}). 작업은 계속 진행했어요.`;
  }
}

function defenderQuickScanAuditSummary(result: DefenderQuickScanResult): string {
  switch (result.status) {
    case "launched":
      return "Windows 보안 빠른 검사를 시작했어요. 결과는 Windows 보안에서 확인하세요.";
    case "blocked":
      return "Windows 보안 빠른 검사는 Windows에서만 실행할 수 있어요.";
    case "spawn-failed":
      return "Windows 보안 빠른 검사를 시작하지 못했어요. Windows 보안 화면에서 직접 실행해주세요.";
    case "unavailable":
      return "이 PC에서는 Windows 보안 빠른 검사를 자동으로 시작하지 못했어요. Windows 보안 화면에서 직접 확인해주세요.";
    default:
      return "Windows 보안 빠른 검사 상태를 확인했어요. 결과는 Windows 보안에서 확인해주세요.";
  }
}

/**
 * Best-effort restore point trigger. Reads prefs each call so a user
 * who just toggled "취소" sees the new behavior immediately. Never
 * throws -- caller proceeds with the destructive action either way.
 */
async function maybeCreateRestorePoint(
  actionDescription: string,
  type: "MODIFY_SETTINGS" | "APPLICATION_INSTALL" | "APPLICATION_UNINSTALL" = "MODIFY_SETTINGS"
): Promise<void> {
  try {
    const prefs = await loadMonitorPrefs(app.getPath("userData"));
    if (!prefs.restorePointEnabled) {
      log.info(`restore-point skipped (user opt-out): ${actionDescription}`);
      return;
    }
    const result = await createRestorePoint({
      description: actionDescription,
      type,
      runner: defaultRestorePointRunner()
    });
    if (result.created) {
      log.info(`restore-point created: ${actionDescription}`);
    } else {
      log.warn(
        `restore-point not created (${result.reason})${
          "detail" in result && result.detail ? ": " + result.detail : ""
        }`
      );
    }
    await appendAuditEntry(app.getPath("userData"), {
      category: "system",
      action: result.created ? "restore-point-created" : "restore-point-skipped",
      summary: restorePointAuditSummary(result, actionDescription),
      detail: { ...result, actionDescription }
    }).catch(() => {});
  } catch (err) {
    log.warn("restore-point trigger failed:", (err as Error).message);
  }
}

function restoredRegistryBackupFollowupApp(restoredApp: {
  name: string;
  publisher?: string | null;
  backupKind?: "key" | "startup-value";
  registryKeyPath?: string;
}): InstalledApp {
  return {
    name: restoredApp.name,
    publisher: restoredApp.publisher ?? null,
    ...(restoredApp.backupKind === "key" && restoredApp.registryKeyPath
      ? { registryKeyPath: restoredApp.registryKeyPath }
      : {})
  };
}

async function runReminderTick(): Promise<void> {
  try {
    const prefs = await loadMonitorPrefs(app.getPath("userData"));
    const lastScanAt = getLastScan()?.report.generatedAt ?? (await getLatestScanAt(app.getPath("userData")));
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
    if (shouldStartHiddenFromArgs()) {
      mainWindow?.hide();
      return;
    }
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

  ipcMain.handle(IpcChannels.scanStart, async (event, request?: ScanStartRequest) => {
    const sender = event.sender;

    // v2.0 (D-33 / D4) — fast-path: if the renderer opted in AND we
    // have a cached scan younger than 1 hour, return it without
    // re-running PowerShell. The cached result picks up source="cache"
    // so the UI (and audit log) can distinguish it from a fresh run.
    if (request?.fast === true) {
      const cached = getLastScanIfFresh();
      if (cached) {
        const result: ScanResult = { ...cached, source: "cache" };
        log.info("scan:start fast-path hit (cached result returned)");
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.scanComplete, result);
        }
        return result;
      }
      log.info("scan:start fast-path requested but cache was missing or stale");
    }

    if (activeAbort) activeAbort.abort();
    const controller = new AbortController();
    activeAbort = controller;

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
      result.source = "fresh";
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
      try {
        const outputPath = await ensureSafeOutputFilePath(dialogResult.filePath, {
          label: "Report export"
        });
        await fs.writeFile(outputPath, JSON.stringify(payload.report, null, 2), "utf8");
        return { saved: true, path: outputPath };
      } catch (err) {
        log.error("report:export failed:", err);
        return { saved: false };
      }
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

  /**
   * Driver backup. Ask the user where to save, then shell out to
   * pnputil. We never write outside the user-chosen folder.
   */
  ipcMain.handle(IpcChannels.driverBackup, async (): Promise<DriverBackupResult> => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const defaultPath = join(app.getPath("documents"), "포맷버디_드라이버백업");
    const dialogResult = await dialog.showOpenDialog(win!, {
      title: "드라이버 백업 위치 고르기",
      defaultPath,
      properties: ["openDirectory", "createDirectory"]
    });
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return {
        status: "user-cancelled",
        summary: "드라이버 백업 위치 고르기를 취소했어요."
      };
    }
    const targetDir = dialogResult.filePaths[0];
    const result = await exportDrivers({
      targetDir,
      runner: defaultDriverBackupRunner()
    });
    log.info(
      `driver:backup status=${result.status} count=${result.driverCount ?? "?"} target=${result.targetDir ?? "?"}`
    );
    await appendAuditEntry(app.getPath("userData"), {
      category: "system",
      action: `driver-backup-${result.status}`,
      summary: result.summary,
      detail: { ...result }
    }).catch((e) => log.warn("audit append (driver-backup) failed:", (e as Error).message));
    return result;
  });

  /**
   * Wi-Fi profile export. includePasswords requires an explicit toggle
   * in the renderer -- main treats omitting/false the same way.
   */
  ipcMain.handle(
    IpcChannels.wifiExport,
    async (_e, request?: WifiExportRequest): Promise<WifiExportResult> => {
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
      const defaultPath = join(app.getPath("documents"), "포맷버디_와이파이백업");
      const dialogResult = await dialog.showOpenDialog(win!, {
        title: "Wi-Fi 프로필 저장 위치 고르기",
        defaultPath,
        properties: ["openDirectory", "createDirectory"]
      });
      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return {
          status: "user-cancelled",
          summary: "Wi-Fi 프로필 저장 위치 고르기를 취소했어요.",
          includedPasswords: Boolean(request?.includePasswords)
        };
      }
      const targetDir = dialogResult.filePaths[0];
      const result = await exportWifiProfiles({
        targetDir,
        includePasswords: Boolean(request?.includePasswords),
        runner: defaultWifiExportRunner()
      });
      log.info(
        `wifi:export status=${result.status} count=${result.profileCount ?? "?"} includeSensitive=${result.includedPasswords}`
      );
      await appendAuditEntry(app.getPath("userData"), {
        category: "system",
        action: `wifi-export-${result.status}`,
        summary: result.summary,
        detail: { ...result }
      }).catch((e) => log.warn("audit append (wifi-export) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(IpcChannels.startupList, async (): Promise<StartupAutoSnapshot> => {
    const snapshot = await listStartupAuto({ runner: defaultStartupRunner() });
    log.info(
      `startup:list status=${snapshot.status} count=${snapshot.entries.length}`
    );
    return snapshot;
  });

  ipcMain.handle(
    IpcChannels.startupDisabledList,
    async (): Promise<StartupAutoDisabledSnapshot> => {
      await purgeExpiredStartupFolderEntriesWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: "startup-list"
      }).catch((err) => {
        log.warn("startup-disabled:purge-before-list failed:", (err as Error).message);
      });
      return listDisabledStartupFolderEntries({ userDataDir: app.getPath("userData") });
    }
  );

  ipcMain.handle(
    IpcChannels.startupDisable,
    async (_e, request: StartupFolderDisableRequest): Promise<StartupFolderToggleResult> => {
      if (process.platform !== "win32") {
        return {
          status: "windows-only",
          message: "시작 항목 끄기는 Windows 앱에서만 동작해요."
        };
      }
      const userDataDir = app.getPath("userData");
      const snapshot = await listStartupAuto({ runner: defaultStartupRunner() });
      const entry = snapshot.entries.find((item) => item.id === request?.entryId);
      if (!entry) {
        return {
          status: "not-found",
          message: "지금 목록에서 해당 시작 항목을 찾지 못했어요. 다시 조회한 뒤 시도해주세요."
        };
      }
      if (entry.kind === "startup-folder") {
        await maybeCreateRestorePoint(`시작 항목 끄기 (${entry.name})`);
      }
      const result = await disableStartupFolderEntry({ userDataDir, entry });
      log.info(`startup:disable status=${result.status} entry=${entry.name}`);
      await appendAuditEntry(userDataDir, {
        category: "system",
        action: `startup-disable-${result.status}`,
        summary:
          result.status === "disabled"
            ? `"${entry.name}"이 PC 켤 때 같이 뜨지 않게 보관했어요.`
            : `시작 항목 끄기 결과: ${result.message}`,
        detail: {
          entryId: entry.id,
          disabledId: result.entry?.id,
          status: result.status,
          name: entry.name,
          originalPath: result.entry?.originalPath
        }
      }).catch((e) => log.warn("audit append (startup-disable) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(
    IpcChannels.startupRestore,
    async (_e, request: StartupFolderRestoreRequest): Promise<StartupFolderToggleResult> => {
      if (process.platform !== "win32") {
        return {
          status: "windows-only",
          message: "시작 항목 되돌리기는 Windows 앱에서만 동작해요."
        };
      }
      const userDataDir = app.getPath("userData");
      const safeRequest = normalizeStartupFolderRestoreRequest(request);
      if (safeRequest.disabledId) {
        await maybeCreateRestorePoint("시작 항목 되돌리기");
      }
      const result = await restoreStartupFolderEntry({
        userDataDir,
        disabledId: safeRequest.disabledId
      });
      log.info(`startup:restore status=${result.status} id=${safeRequest.disabledId}`);
      await appendAuditEntry(userDataDir, {
        category: "system",
        action: `startup-restore-${result.status}`,
        summary:
          result.status === "restored"
            ? `"${result.entry?.name ?? "시작 항목"}"을 다시 PC 켤 때 같이 뜨도록 되돌렸어요.`
            : `시작 항목 되돌리기 결과: ${result.message}`,
        detail: {
          disabledId: safeRequest.disabledId,
          status: result.status,
          name: result.entry?.name,
          originalPath: result.entry?.originalPath
        }
      }).catch((e) => log.warn("audit append (startup-restore) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(
    IpcChannels.cleanupPlan,
    async (_e, payload?: { largeFiles?: LargeFileCandidate[] }): Promise<CleanupPlan> => {
      await purgeExpiredTrashWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: "cleanup-plan"
      }).catch((err) => {
        log.warn("cleanup-trash:purge-before-plan failed:", (err as Error).message);
      });
      return planCleanup({ env: { largeFiles: payload?.largeFiles ?? [] } });
    }
  );

  ipcMain.handle(
    IpcChannels.cleanupExecute,
    async (_e, request: CleanupExecuteRequest): Promise<CleanupExecuteResult> => {
      const userDataDir = app.getPath("userData");
      const deps = defaultDeps(userDataDir);
      try {
        const safeRequest = enforceProductCleanupPolicy(request);
        // Safety net first. If the prefs disabled this, the helper
        // logs + returns silently. We never block cleanup on the
        // restore point succeeding.
        await maybeCreateRestorePoint(`정리 실행 (${safeRequest.mode})`);
        const result = await executeCleanup(safeRequest, {
          userDataDir,
          deps
        });
        log.info(
          `cleanup:execute mode=${result.mode} removed=${result.removedItems.length} freedBytes=${result.totalFreedBytes}`
        );
        const freedMb = (result.totalFreedBytes / 1024 / 1024).toFixed(1);
        const trashEntryIds = restorableTrashEntryIds(result);
        const removedCount = trashEntryIds.length;
        const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length;
        const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length;
        await appendAuditEntry(app.getPath("userData"), {
          category: "cleanup",
          action: "trash",
          summary: `포맷버디 복구함으로 ${removedCount}개 항목(약 ${freedMb} MB)을 보냈어요. 30일 뒤 자동으로 비워요.`,
          detail: {
            mode: safeRequest.mode,
            removedCount,
            skippedCount,
            notSelectedCount,
            totalFreedBytes: result.totalFreedBytes,
            trashEntryIds
          }
        }).catch((e) => log.warn("audit append (cleanup) failed:", (e as Error).message));
        // v2.0 (D-34) — invalidate the scan cache so a follow-up
        // fast:true rescan never returns a stale view of installedApps
        // / userFolders / largeFiles that we just changed under the
        // user. apps-list / leftovers will rebuild from a fresh scan.
        clearLastScan();
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

  ipcMain.handle(IpcChannels.cleanupTrashList, async (): Promise<CleanupTrashSnapshot> => {
    await purgeExpiredTrashWithAudit({
      userDataDir: app.getPath("userData"),
      trigger: "trash-list"
    }).catch((err) => {
      log.warn("cleanup-trash:purge-before-list failed:", (err as Error).message);
    });
    return getTrashSnapshot({ userDataDir: app.getPath("userData") });
  });

  ipcMain.handle(
    IpcChannels.cleanupTrashRestore,
    async (_e, request: CleanupTrashRestoreRequest): Promise<CleanupTrashRestoreResult> => {
      const safeRequest = normalizeCleanupTrashRestoreRequest(request);
      await purgeExpiredTrashWithAudit({
        userDataDir: app.getPath("userData"),
        trigger: "restore"
      }).catch((err) => {
        log.warn("cleanup-trash:purge-before-restore failed:", (err as Error).message);
      });
      const result = await restoreTrashEntry({
        userDataDir: app.getPath("userData"),
        entryId: safeRequest.entryId,
        home: app.getPath("home"),
        onAppLeftoverRestored: async (restoredApp) => {
          rememberRecentlyUninstallLaunchedApp(restoredApp);
          await rememberUninstallFollowup(app.getPath("userData"), restoredApp).catch((err) => {
            log.warn("cleanup-trash restore followup remember failed:", (err as Error).message);
          });
        }
      });
      await appendAuditEntry(app.getPath("userData"), {
        category: "cleanup",
        action: `trash-restore-${result.status}`,
        summary:
          result.status === "restored"
            ? `"${result.entry?.label ?? result.entryId}"을 원래 위치로 되돌렸어요.`
            : `복구함 되돌리기 결과: ${result.message}`,
        detail: {
          entryId: safeRequest.entryId,
          status: result.status,
          originalPath: result.originalPath
        }
      }).catch((e) => log.warn("audit append (cleanup-trash-restore) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(IpcChannels.cleanupTrashPurgeExpired, async (): Promise<RestoreBinPurgeResult> => {
    return runAppRetentionPurgeTick("manual");
  });

  ipcMain.handle(IpcChannels.registryBackupsList, async (): Promise<RegistryBackupSnapshot> => {
    await purgeExpiredRegistryBackupsWithAudit({
      userDataDir: app.getPath("userData"),
      trigger: "registry-list"
    }).catch((err) => {
      log.warn("registry-backup:purge-before-list failed:", (err as Error).message);
    });
    return listRegistryBackups({ userDataDir: app.getPath("userData") });
  });

  ipcMain.handle(
    IpcChannels.registryBackupRestore,
    async (_e, request: RegistryBackupRestoreRequest): Promise<RegistryBackupRestoreResult> => {
      const userDataDir = app.getPath("userData");
      const safeRequest = normalizeRegistryBackupRestoreRequest(request);
      await purgeExpiredRegistryBackupsWithAudit({
        userDataDir,
        trigger: "registry-restore"
      }).catch((err) => {
        log.warn("registry-backup:purge-before-restore failed:", (err as Error).message);
      });
      const result = await restoreRegistryBackup({
        userDataDir,
        backupId: safeRequest.backupId,
        beforeImport: () => maybeCreateRestorePoint("앱 삭제 흔적 백업 되돌리기"),
        onAppRegistryBackupRestored: async (restoredApp) => {
          const followupApp = restoredRegistryBackupFollowupApp(restoredApp);
          rememberRecentlyUninstallLaunchedApp(followupApp);
          await rememberUninstallFollowup(userDataDir, followupApp).catch((err) => {
            log.warn("registry-backup restore followup remember failed:", (err as Error).message);
          });
        }
      });
      const registryBackupAuditLabel = registryBackupKindLabel(result.entry ?? {});
      await appendAuditEntry(userDataDir, {
        category: "cleanup",
        action: `registry-backup-restore-${result.status}`,
        summary:
          result.status === "restored"
            ? `${registryBackupAuditLabel}을 복구함에서 되돌렸어요.`
            : `${registryBackupAuditLabel} 되돌리기 결과: ${result.message}`,
        detail: {
          backupId: result.backupId,
          keyPath: result.keyPath,
          status: result.status
        }
      }).catch((e) => log.warn("audit append (registry-backup-restore) failed:", (e as Error).message));
      return result;
    }
  );

  ipcMain.handle(IpcChannels.appsList, async (): Promise<AppManagerSnapshot> => {
    const cached = getLastScan();
    const userDataDir = app.getPath("userData");
    const persistedFollowups = await listUninstallFollowups(userDataDir).catch((err) => {
      log.warn("apps:list uninstall followups unavailable:", (err as Error).message);
      return [];
    });
    return buildAppManagerSnapshot(cached?.report.installedApps ?? [], {
      recentlyUninstallLaunched: mergeUninstallFollowupApps(
        getRecentlyUninstallLaunchedApps(),
        persistedFollowups
      )
    });
  });

  ipcMain.handle(IpcChannels.appsLeftovers, async (): Promise<AppLeftoversSnapshot> => {
    const cached = getLastScan();
    const userDataDir = app.getPath("userData");
    const persistedFollowups = await listUninstallFollowups(userDataDir).catch((err) => {
      log.warn("apps:leftovers uninstall followups unavailable:", (err as Error).message);
      return [];
    });
    const startupEntries = await listStartupAuto({
      runner: defaultStartupRunner()
    })
      .then((snapshot) => snapshot.entries)
      .catch((err) => {
        log.warn("apps:leftovers startup traces unavailable:", (err as Error).message);
        return [];
      });
    return planAppLeftovers(cached?.report.installedApps ?? [], {
      extraApps: mergeUninstallFollowupApps(getRecentlyUninstallLaunchedApps(), persistedFollowups),
      installedAppsKnown: Boolean(cached),
      startupEntries
    });
  });

  ipcMain.handle(
    IpcChannels.appsLeftoversCleanup,
    async (_e, request: AppLeftoversCleanupRequest): Promise<CleanupExecuteResult> => {
      const userDataDir = app.getPath("userData");
      try {
        const safeLeftoversRequest = enforceAppLeftoversCleanupPolicy(request);
        await maybeCreateRestorePoint("앱 잔여 폴더 정리");
        await purgeExpiredTrashWithAudit({
          userDataDir,
          trigger: "app-leftovers"
        }).catch((err) => {
          log.warn("cleanup-trash:purge-before-app-leftovers failed:", (err as Error).message);
        });
        await purgeExpiredRegistryBackupsWithAudit({
          userDataDir,
          trigger: "app-leftovers"
        }).catch((err) => {
          log.warn("registry-backup:purge-before-app-leftovers failed:", (err as Error).message);
        });
        await purgeExpiredStartupFolderEntriesWithAudit({
          userDataDir,
          trigger: "app-leftovers"
        }).catch((err) => {
          log.warn("startup-disabled:purge-before-app-leftovers failed:", (err as Error).message);
        });
        const currentInstalledAppsProbe = await probeInstalledAppsForLeftoverGuard()
          .then((apps) => ({ known: true as const, apps }))
          .catch((err) => {
            log.warn("apps:leftovers current install guard unavailable:", (err as Error).message);
            return { known: false as const, apps: [] };
          });
        const result = await cleanupAppLeftovers(safeLeftoversRequest, {
          userDataDir,
          currentInstalledApps: currentInstalledAppsProbe.apps,
          currentInstalledAppsKnown: currentInstalledAppsProbe.known,
          onFollowupCleaned: async (cleanedApp) => {
            forgetRecentlyUninstallLaunchedApp(cleanedApp);
            await forgetUninstallFollowup(userDataDir, cleanedApp).catch((err) => {
              log.warn("apps:leftovers followup forget failed:", (err as Error).message);
            });
          }
        });
        const freedMb = (result.totalFreedBytes / 1024 / 1024).toFixed(1);
        const trashEntryIds = restorableTrashEntryIds(result);
        const registryBackupIds = restorableRegistryBackupIds(result);
        const preservedBackupIds = preservedRegistryBackupIds(result);
        const recoverableBackupIds = recoverableRegistryBackupIds(result);
        const startupDisabledIds = restorableStartupDisabledIds(result);
        const removedCount = trashEntryIds.length + registryBackupIds.length + startupDisabledIds.length;
        const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length;
        const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length;
        const summaryParts = [
          trashEntryIds.length > 0
            ? `앱 잔여 폴더 ${trashEntryIds.length}개(약 ${freedMb} MB)를 복구함으로 보냈어요`
            : "",
          registryBackupIds.length > 0
            ? `앱 삭제 흔적 ${registryBackupIds.length}개를 백업 후 정리했어요`
            : "",
          preservedBackupIds.length > 0
            ? `확인을 끝내지 못한 앱 삭제 흔적 백업 ${preservedBackupIds.length}개는 복구함에 남겨뒀어요`
            : "",
          startupDisabledIds.length > 0
            ? `잠시 꺼둔 시작 항목 ${startupDisabledIds.length}개를 보관했어요`
            : ""
        ].filter(Boolean);
        await appendAuditEntry(userDataDir, {
          category: "cleanup",
          action: "app-leftovers-trash",
          summary:
            summaryParts.length > 0
              ? `${summaryParts.join(", ")}. 보관한 항목은 30일 뒤 자동으로 비워요.`
              : "앱 잔여 정리를 실행했지만 정리된 항목은 없어요.",
          detail: {
            planId: result.planId,
            removedCount,
            skippedCount,
            notSelectedCount,
            totalFreedBytes: result.totalFreedBytes,
            trashEntryIds,
            registryBackupIds,
            preservedRegistryBackupIds: preservedBackupIds,
            recoverableRegistryBackupIds: recoverableBackupIds,
            startupDisabledIds
          }
        }).catch((e) => log.warn("audit append (apps-leftovers-cleanup) failed:", (e as Error).message));
        return result;
      } catch (err) {
        log.error("apps:leftovers-cleanup failed:", (err as Error).message);
        throw err;
      }
    }
  );

  ipcMain.handle(
    IpcChannels.appsUninstall,
    async (_e, request: AppUninstallRequest): Promise<AppUninstallResult> => {
      const safeUninstallRequest = enforceAppUninstallRequestPolicy(request);
      const userDataDir = app.getPath("userData");
      if (!getLastScan()) {
        return {
          status: "no-scan-cache",
          appName: safeUninstallRequest.appName,
          message: "최근 진단 결과가 없어요. 점검을 한 번 돌린 뒤 다시 시도해주세요."
        };
      }
      const matchedApp = findInstalledApp(safeUninstallRequest.appName, safeUninstallRequest.publisher);
      if (canLaunchUninstall(safeUninstallRequest, matchedApp)) {
        await maybeCreateRestorePoint(`앱 제거 (${safeUninstallRequest.appName})`, "APPLICATION_UNINSTALL");
      }
      const result = await runUninstall(safeUninstallRequest, {
        findApp: () => matchedApp
      });
      if (result.status === "launched" && matchedApp) {
        rememberRecentlyUninstallLaunchedApp(matchedApp);
        await rememberUninstallFollowup(userDataDir, matchedApp).catch((err) => {
          log.warn("apps:uninstall followup persist failed:", (err as Error).message);
        });
      }
      log.info(
        `apps:uninstall app=${safeUninstallRequest.appName} status=${result.status} detail=${result.detail ?? ""}`
      );
      await appendAuditEntry(userDataDir, {
        category: "uninstall",
        action: result.status,
        summary:
          result.status === "launched"
            ? `Windows 제거 창으로 "${safeUninstallRequest.appName}"을 열었어요.`
            : result.status === "app-not-found"
              ? `"${safeUninstallRequest.appName}"의 제거 정보를 찾지 못했어요.`
              : result.status === "blocked"
                ? `"${safeUninstallRequest.appName}" 제거가 차단됐어요 (시스템 보호).`
                : result.status === "no-scan-cache"
                  ? "최근 진단 결과가 없어서 안내만 했어요."
                  : `"${safeUninstallRequest.appName}" 제거 시도 결과: ${result.status}`,
        detail: { appName: safeUninstallRequest.appName, status: result.status, detail: result.detail }
      }).catch((e) => log.warn("audit append (uninstall) failed:", (e as Error).message));
      // v2.0 (D-34) — only invalidate the scan cache when the uninstaller
      // actually launched. For app-not-found / blocked / no-scan-cache
      // nothing changed on disk so the cache is still accurate.
      if (result.status === "launched") {
        clearLastScan();
      }
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
      summary: defenderQuickScanAuditSummary(result),
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
        `monitor:prefs tray=${next.trayEnabled} login=${next.launchAtLoginEnabled} reminder=${next.reminderEnabled} days=${next.reminderDays} channel=${next.updateChannel} theme=${next.themeMode} telemetry=${next.telemetryOptIn}`
      );
      await reconcileTray(next);
      reconcileLaunchAtLogin(app, next, (message) => log.warn(`monitor:${message}`));
      setUpdaterChannel(next.updateChannel);
      await appendAuditEntry(app.getPath("userData"), {
        category: "monitor",
        action: "prefs-changed",
        summary: `자동 알림 설정을 바꿨어요 — 트레이 ${next.trayEnabled ? "ON" : "OFF"}, PC 시작 ${next.launchAtLoginEnabled ? "ON" : "OFF"}, 알림 ${next.reminderEnabled ? "ON" : "OFF"}(${next.reminderDays}일), 채널 ${next.updateChannel}, 화면 ${next.themeMode}, 익명 통계 ${next.telemetryOptIn ? "허용" : "꺼짐"}.`,
        detail: {
          trayEnabled: next.trayEnabled,
          launchAtLoginEnabled: next.launchAtLoginEnabled,
          reminderEnabled: next.reminderEnabled,
          reminderDays: next.reminderDays,
          updateChannel: next.updateChannel,
          themeMode: next.themeMode,
          telemetryOptIn: next.telemetryOptIn
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
        const outputPath = await ensureSafeOutputFilePath(dialogResult.filePath, {
          label: "Report export"
        });
        const fontBase64 = await readWantedSansBase64();
        const html = buildHtmlReport(payload.report, payload.recommendation, { fontBase64 });
        await fs.writeFile(outputPath, html, "utf8");
        return { saved: true, path: outputPath };
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
      reconcileLaunchAtLogin(app, prefs, (message) => log.warn(`monitor:${message}`));
      if (shouldStartHiddenFromArgs() && (!prefs.launchAtLoginEnabled || !trayInstance)) {
        focusMainWindow();
      }
      await reconcileReminderTimer();
      await runAppRetentionPurgeTick("startup");
      reconcileRetentionPurgeTimer();
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
  if (retentionPurgeTimer) {
    clearInterval(retentionPurgeTimer);
    retentionPurgeTimer = null;
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
