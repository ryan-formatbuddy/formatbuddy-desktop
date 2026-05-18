import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@shared/ipc";
import type {
  ActionRunResult,
  ExportOptions,
  ExportResult,
  ManifestExportResult,
  ScanError,
  ScanProgress,
  ScanReport,
  ScanResult,
  UpdateDownloadProgress,
  UpdateErrorPayload,
  UpdateInfo,
  WindowState
} from "@shared/types";

type ProgressListener = (progress: ScanProgress) => void;
type CompleteListener = (result: ScanResult) => void;
type ErrorListener = (error: ScanError) => void;
type UpdateInfoListener = (info: UpdateInfo) => void;
type UpdateProgressListener = (p: UpdateDownloadProgress) => void;
type UpdateErrorListener = (e: UpdateErrorPayload) => void;
type VoidListener = () => void;

const fb = {
  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),

  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),

  onScanProgress(cb: ProgressListener): () => void {
    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
  },
  onScanComplete(cb: CompleteListener): () => void {
    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
  },
  onScanError(cb: ErrorListener): () => void {
    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    ipcRenderer.on(IpcChannels.scanError, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
  },

  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),

  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),

  onUpdateChecking(cb: VoidListener): () => void {
    const wrapped = () => cb();
    ipcRenderer.on(IpcChannels.updateChecking, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateChecking, wrapped);
  },
  onUpdateAvailable(cb: UpdateInfoListener): () => void {
    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    ipcRenderer.on(IpcChannels.updateAvailable, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, wrapped);
  },
  onUpdateNotAvailable(cb: VoidListener): () => void {
    const wrapped = () => cb();
    ipcRenderer.on(IpcChannels.updateNotAvailable, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateNotAvailable, wrapped);
  },
  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
    const wrapped = (_e: unknown, p: UpdateDownloadProgress) => cb(p);
    ipcRenderer.on(IpcChannels.updateDownloadProgress, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateDownloadProgress, wrapped);
  },
  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    ipcRenderer.on(IpcChannels.updateDownloaded, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateDownloaded, wrapped);
  },
  onUpdateError(cb: UpdateErrorListener): () => void {
    const wrapped = (_e: unknown, err: UpdateErrorPayload) => cb(err);
    ipcRenderer.on(IpcChannels.updateError, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.updateError, wrapped);
  },
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),

  exportBackupManifest: (): Promise<ManifestExportResult> =>
    ipcRenderer.invoke(IpcChannels.manifestExport),

  // v0.5.1 — custom WinChrome controls
  minimizeWindow: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowMinimize),
  toggleMaximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.windowMaximizeToggle),
  closeWindow: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowClose),
  onWindowState(cb: (state: WindowState) => void): () => void {
    const wrapped = (_e: unknown, state: WindowState) => cb(state);
    ipcRenderer.on(IpcChannels.windowState, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.windowState, wrapped);
  },

  runActionCommand: (command: string): Promise<ActionRunResult> =>
    ipcRenderer.invoke(IpcChannels.actionRun, { command })
};

contextBridge.exposeInMainWorld("fb", fb);

export type FbBridge = typeof fb;
