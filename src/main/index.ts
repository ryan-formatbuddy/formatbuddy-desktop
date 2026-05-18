import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { IpcChannels } from "@shared/ipc";
import type { ExportOptions, ExportResult, ScanError, ScanProgress, ScanResult } from "@shared/types";
import { runScan } from "./scanner";
import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";

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
        onProgress: emit,
        enforceIntegrity: app.isPackaged
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

  ipcMain.handle(IpcChannels.updateInstall, () => {
    installAndRestart();
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
