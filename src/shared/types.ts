export type ScanStepState = "done" | "active" | "pending";

export interface ScanStepView {
  name: string;
  state: ScanStepState;
  detail: string;
}

export interface ScanProgress {
  step: string;
  doneSteps: number;
  totalSteps: number;
  score: number;
  elapsedMs: number;
  steps: ScanStepView[];
  message?: string;
}

export interface SystemInfo {
  manufacturer?: string | null;
  model?: string | null;
  serialNumberMasked?: string | null;
  osCaption?: string | null;
  osVersion?: string | null;
  cpu?: string | null;
  memoryGb?: number | null;
}

export interface DiskInfo {
  drive: string;
  sizeGb: number;
  freeGb: number;
}

export interface UserFolderInfo {
  name: string;
  path: string;
  exists: boolean;
  sizeGb: number | null;
}

export interface InstalledApp {
  name: string;
  version?: string | null;
  publisher?: string | null;
}

export interface DriverInfo {
  DeviceName?: string;
  DriverVersion?: string;
  Manufacturer?: string;
  DriverDate?: string;
}

export interface PrinterInfo {
  Name?: string;
  DriverName?: string;
  PortName?: string;
  Default?: boolean;
}

export interface NpkiCandidate {
  path: string;
  exists: boolean;
}

export interface BitLockerVolume {
  MountPoint?: string;
  VolumeStatus?: string;
  ProtectionStatus?: string;
  EncryptionPercentage?: number;
}

export interface CloudSyncCandidate {
  provider: string;
  path: string;
  exists: boolean;
}

export interface BrowserPresence {
  name: string;
  installed: boolean;
}

export interface WingetStatus {
  available: boolean;
  note: string;
}

export interface WingetExportPackage {
  PackageIdentifier?: string;
  Version?: string;
  Source?: string;
  [k: string]: unknown;
}

export interface WingetExportSource {
  SourceDetails?: { Name?: string; Argument?: string; Type?: string };
  Packages?: WingetExportPackage[];
  [k: string]: unknown;
}

export interface WingetExport {
  $schema?: string;
  CreationDate?: string;
  Sources?: WingetExportSource[];
  WinGetVersion?: string;
  [k: string]: unknown;
}

export interface PrivacyInfo {
  localOnly: boolean;
  noPasswordCollection: boolean;
  noPrivateKeyUpload: boolean;
  noBrowserPasswordExtraction: boolean;
}

export interface ChecklistInfo {
  reviewNpkiManually: boolean;
  exportWifiProfilesManually: boolean;
  backupDesktopDocumentsDownloads: boolean;
  verifyCloudSync: boolean;
  saveReportBeforeFormat: boolean;
}

export interface ScanReport {
  schemaVersion: string;
  generatedAt: string;
  mode?: "quick" | "manifest";
  privacy: PrivacyInfo;
  system: SystemInfo;
  disks: DiskInfo[];
  userFolders: UserFolderInfo[];
  gpu: string[];
  installedApps: InstalledApp[];
  drivers: DriverInfo[];
  printers: PrinterInfo[];
  wifiProfiles: string[];
  npkiCandidates: NpkiCandidate[];
  bitlocker: BitLockerVolume[];
  cloudSync: CloudSyncCandidate[];
  browsers: BrowserPresence[];
  winget: WingetStatus;
  wingetExport?: WingetExport | null;
  diagnostics: Array<{ step: string; message: string }>;
  checklist: ChecklistInfo;
}

export interface ScanResult {
  report: ScanReport;
  jsonPath: string;
}

export interface ScanError {
  message: string;
  code?: string;
  detail?: string;
}

export interface ExportOptions {
  defaultFileName?: string;
}

export interface ExportResult {
  saved: boolean;
  path?: string;
}

export interface ManifestExportResult {
  saved: boolean;
  path?: string;
  fileCount?: number;
  totalBytes?: number;
  message?: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface UpdateDownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateErrorPayload {
  message: string;
}
