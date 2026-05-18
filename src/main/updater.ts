import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { IpcChannels } from "@shared/ipc";
import type {
  UpdateDownloadProgress,
  UpdateErrorPayload,
  UpdateInfo
} from "@shared/types";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let checkTimer: NodeJS.Timeout | null = null;
let bound = false;

export function initAutoUpdater(window: BrowserWindow): void {
  // electron-updater requires a packaged app + a published feed.
  // In dev (npm run dev) skip silently so the developer doesn't see
  // spurious "no published versions" errors.
  if (!app.isPackaged) return;
  if (bound) return;
  bound = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;

  const send = (channel: string, payload?: unknown) => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  };

  autoUpdater.on("checking-for-update", () => {
    send(IpcChannels.updateChecking);
  });

  autoUpdater.on("update-available", (info) => {
    const payload: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null
    };
    send(IpcChannels.updateAvailable, payload);
  });

  autoUpdater.on("update-not-available", () => {
    send(IpcChannels.updateNotAvailable);
  });

  autoUpdater.on("download-progress", (p) => {
    const payload: UpdateDownloadProgress = {
      bytesPerSecond: p.bytesPerSecond,
      percent: p.percent,
      transferred: p.transferred,
      total: p.total
    };
    send(IpcChannels.updateDownloadProgress, payload);
  });

  autoUpdater.on("update-downloaded", (info) => {
    const payload: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : null
    };
    send(IpcChannels.updateDownloaded, payload);
  });

  autoUpdater.on("error", (e) => {
    const payload: UpdateErrorPayload = { message: e.message };
    send(IpcChannels.updateError, payload);
  });

  // First check fires shortly after window-ready; recurring checks afterwards.
  void autoUpdater.checkForUpdates().catch(() => {
    // network errors here are surfaced via the "error" event above
  });

  checkTimer = setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

export function installAndRestart(): void {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall();
}

export function shutdownAutoUpdater(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  autoUpdater.removeAllListeners();
  bound = false;
}
