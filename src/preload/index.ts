import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@shared/ipc";
import type {
  ActionRunResult,
  AppLeftoversSnapshot,
  AppManagerSnapshot,
  AppStateSnapshot,
  AppUninstallRequest,
  AppUninstallResult,
  AuditSnapshot,
  CleanupExecuteRequest,
  CleanupExecuteResult,
  CleanupHistorySnapshot,
  CleanupPlan,
  DefenderLiveStatus,
  DefenderQuickScanResult,
  DefenderThreatSnapshot,
  ExportOptions,
  ExportResult,
  IgnoreListState,
  IgnoreListUpdate,
  LargeFileCandidate,
  ManifestExportResult,
  MonitorPreferences,
  Recommendation,
  ScanError,
  ScanProgress,
  ScanReport,
  ScanResult,
  UpdateDownloadProgress,
  UpdateErrorPayload,
  UpdateInfo,
  UpdateMonitorPreferencesRequest,
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
  appPlatform: (): Promise<"win32" | "darwin" | "linux" | "unknown"> =>
    ipcRenderer.invoke(IpcChannels.appPlatform),
  getAppState: (): Promise<AppStateSnapshot> => ipcRenderer.invoke(IpcChannels.appStateGet),
  updateIgnoreList: (update: IgnoreListUpdate): Promise<IgnoreListState> =>
    ipcRenderer.invoke(IpcChannels.ignoreListUpdate, update),

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

  exportHtmlReport: (report: ScanReport, recommendation: Recommendation): Promise<ExportResult> =>
    ipcRenderer.invoke(IpcChannels.reportExportHtml, { report, recommendation }),

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
    ipcRenderer.invoke(IpcChannels.actionRun, { command }),

  openLogsFolder: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.logsOpenFolder),

  planCleanup: (payload?: { largeFiles?: LargeFileCandidate[] }): Promise<CleanupPlan> =>
    ipcRenderer.invoke(IpcChannels.cleanupPlan, payload ?? {}),

  executeCleanup: (request: CleanupExecuteRequest): Promise<CleanupExecuteResult> =>
    ipcRenderer.invoke(IpcChannels.cleanupExecute, request),

  getCleanupHistory: (): Promise<CleanupHistorySnapshot> =>
    ipcRenderer.invoke(IpcChannels.cleanupHistory),

  listApps: (): Promise<AppManagerSnapshot> => ipcRenderer.invoke(IpcChannels.appsList),

  listAppLeftovers: (): Promise<AppLeftoversSnapshot> =>
    ipcRenderer.invoke(IpcChannels.appsLeftovers),

  uninstallApp: (request: AppUninstallRequest): Promise<AppUninstallResult> =>
    ipcRenderer.invoke(IpcChannels.appsUninstall, request),

  getDefenderStatus: (): Promise<DefenderLiveStatus> =>
    ipcRenderer.invoke(IpcChannels.securityStatus),

  runDefenderQuickScan: (): Promise<DefenderQuickScanResult> =>
    ipcRenderer.invoke(IpcChannels.securityQuickScan),

  getDefenderThreats: (): Promise<DefenderThreatSnapshot> =>
    ipcRenderer.invoke(IpcChannels.securityThreats),

  getMonitorPrefs: (): Promise<MonitorPreferences> =>
    ipcRenderer.invoke(IpcChannels.monitorGetPrefs),

  updateMonitorPrefs: (
    patch: UpdateMonitorPreferencesRequest
  ): Promise<MonitorPreferences> =>
    ipcRenderer.invoke(IpcChannels.monitorUpdatePrefs, patch),

  onTrayTriggerScan(cb: () => void): () => void {
    const wrapped = () => cb();
    ipcRenderer.on(IpcChannels.monitorTriggerScan, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.monitorTriggerScan, wrapped);
  },

  getAuditSnapshot: (): Promise<AuditSnapshot> =>
    ipcRenderer.invoke(IpcChannels.auditList)
};

contextBridge.exposeInMainWorld("fb", fb);

export type FbBridge = typeof fb;
