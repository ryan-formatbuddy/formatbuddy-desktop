import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@shared/ipc";
import type {
  ExportOptions,
  ExportResult,
  ScanError,
  ScanProgress,
  ScanReport,
  ScanResult
} from "@shared/types";

type ProgressListener = (progress: ScanProgress) => void;
type CompleteListener = (result: ScanResult) => void;
type ErrorListener = (error: ScanError) => void;

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

  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb)
};

contextBridge.exposeInMainWorld("fb", fb);

export type FbBridge = typeof fb;
