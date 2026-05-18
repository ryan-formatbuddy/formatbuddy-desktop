import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import log from "electron-log/main";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { IpcChannels } from "@shared/ipc";
import type {
  ActionRunResult,
  AppStateSnapshot,
  AppPlatform,
  ExportOptions,
  ExportResult,
  IgnoreListUpdate,
  ManifestExportResult,
  ScanError,
  ScanProgress,
  ScanResult
} from "@shared/types";

/**
 * Whitelist of safe URL schemes that we let `shell.openExternal` hand to
 * the OS. ms-settings: deep links open the Settings app at the right pane
 * (e.g. Windows Update, Storage Sense, Defender) — no shell injection
 * surface. Anything else falls back to "copy to clipboard" so the user
 * can review and paste manually.
 */
const SAFE_URL_SCHEMES = /^(ms-settings|windowsdefender|ms-store|ms-availablenetworks|https):/i;
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
import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";
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
  shutdownAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
