export type AppPlatform = "win32" | "darwin" | "linux" | "unknown";

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
  profilePath?: string | null;
  profileExists?: boolean;
  bookmarksFileExists?: boolean;
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

export interface DiskHealthDevice {
  friendlyName?: string;
  mediaType?: string;
  busType?: string;
  sizeGb?: number | null;
  healthStatus?: string;
  operationalStatus?: string;
}

export interface MemoryPressureInfo {
  totalMemoryMb?: number | null;
  freeMemoryMb?: number | null;
  freeMemoryPercent?: number | null;
  pageFileTotalMb?: number;
  pageFileUsedMb?: number;
  pageFileUsagePercent?: number;
}

export interface WindowsUpdateStatusInfo {
  installedHotfixCount: number;
  latestHotfixInstalledOn?: string | null;
  daysSinceLatestHotfix?: number | null;
}

export interface EventLogSummaryInfo {
  windowDays: number;
  criticalCount: number;
  errorCount: number;
}

export interface DriverAgeSummaryInfo {
  totalWithDate: number;
  olderThan2Years: number;
  olderThan2YearsPercent: number;
}

export interface StartupProgramItem {
  name?: string;
  command?: string;
  location?: string;
  user?: string;
}

export interface StartupProgramsInfo {
  count: number;
  items: StartupProgramItem[];
}

export interface DefenderStatusInfo {
  antivirusEnabled?: boolean | null;
  realTimeProtectionEnabled?: boolean | null;
  antivirusSignatureAgeDays?: number | null;
  lastQuickScanDaysAgo?: number | null;
  lastFullScanDaysAgo?: number | null;
}

export interface AppDataCandidate {
  app: string;
  path: string;
  exists: boolean;
  sizeGb?: number | null;
  lastModifiedAt?: string | null;
}

export interface MailDataFileInfo {
  path: string;
  extension: ".pst" | ".ost" | string;
  sizeGb: number;
  lastModifiedAt?: string | null;
}

export interface StorageWasteInfo {
  userTempGb: number;
  localAppDataTempGb: number;
  windowsTempGb: number;
  windowsOldExists: boolean;
  windowsOldGb: number;
}

/**
 * Severity scale (v0.5.0 — adopted from design_handoff_format_buddy_app).
 * Frame is **care-intensity**, not risk:
 *   safe     (0-25)  — "괜찮아요"
 *   watch    (26-50) — "체크해보면 좋아요"
 *   organize (51-75) — "정리가 필요해요"
 *   format   (76-100)— "꼭 챙길게요"
 *
 * Tone colors flow mint → teal → brand-blue → deep-blue inside one family.
 * No red / yellow / black / risk-signaling colors anywhere on the spectrum.
 */
export type FormatSeverity = "safe" | "watch" | "organize" | "format";

export interface ActionItem {
  title: string;
  description: string;
  command?: string;
}

export type CareActionStatus = "ready" | "check" | "warning" | "unavailable";
export type CareActionCategory = "cleanup" | "delete" | "security" | "protection" | "performance";

export interface CareAction {
  id: string;
  category: CareActionCategory;
  title: string;
  status: CareActionStatus;
  evidence: string;
  description: string;
  safetyNote: string;
  cta: string;
  command?: string;
}

export interface ReasonItem {
  signal: string;
  label: string;
  weightedScore: number;
  description: string;
  help?: string;
  nextStep?: string;
}

export type HealthPillarId = "cleanup" | "security" | "performance" | "backup";
export type HealthPillarStatus = "good" | "check" | "action";

export interface HealthPillar {
  id: HealthPillarId;
  title: string;
  status: HealthPillarStatus;
  summary: string;
  detail: string;
  actions: ActionItem[];
}

export type AppInventoryCategory =
  | "browser"
  | "messenger"
  | "cloud"
  | "office"
  | "security"
  | "driver"
  | "work"
  | "finance"
  | "creative"
  | "developer"
  | "game"
  | "media"
  | "utility"
  | "system"
  | "unknown";

export type AppInventoryAttention =
  | "none"
  | "backup"
  | "license"
  | "sync"
  | "security"
  | "driver"
  | "cleanup"
  | "reinstall";

export interface AppInventoryItem {
  name: string;
  version?: string | null;
  publisher?: string | null;
  category: AppInventoryCategory;
  categoryLabel: string;
  confidence: "high" | "medium" | "low";
  attention: AppInventoryAttention;
  attentionLabel: string;
  reason: string;
}

export interface AppInventoryGroup {
  category: AppInventoryCategory;
  label: string;
  count: number;
  items: AppInventoryItem[];
}

export interface AppInventorySummary {
  total: number;
  classified: number;
  needsCheck: number;
  groups: AppInventoryGroup[];
}

export type BuddyCheckStatus = "confirmed" | "needs_user" | "warning" | "unknown";

export type BuddyChecklistCategory =
  | "certificate"
  | "files"
  | "security"
  | "apps"
  | "drivers"
  | "cloud"
  | "backup"
  | "browser"
  | "mail"
  | "license"
  | "work"
  | "account";

export type BuddyChecklistPriority = "high" | "medium" | "low";

export interface BuddyChecklistItem {
  id: string;
  category: BuddyChecklistCategory;
  label: string;
  priority: BuddyChecklistPriority;
  status: BuddyCheckStatus;
  evidence?: string;
  helperText: string;
  guide: string[];
}

export interface Recommendation {
  formatScore: number;
  severity: FormatSeverity;
  headline: string;
  summary: string;
  tryFirst: ActionItem[];
  formatReasons: ReasonItem[];
  afterFormat: ActionItem[];
  healthPillars: HealthPillar[];
  appInventory: AppInventorySummary;
  buddyChecklist: BuddyChecklistItem[];
  careActions: CareAction[];
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
  diskHealth?: DiskHealthDevice[];
  memoryPressure?: MemoryPressureInfo;
  windowsUpdate?: WindowsUpdateStatusInfo;
  eventLog?: EventLogSummaryInfo;
  driverAge?: DriverAgeSummaryInfo;
  startupPrograms?: StartupProgramsInfo;
  defender?: DefenderStatusInfo;
  appDataCandidates?: AppDataCandidate[];
  mailDataFiles?: MailDataFileInfo[];
  storageWaste?: StorageWasteInfo;
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
  recommendation: Recommendation;
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

export interface WindowState {
  isMaximized: boolean;
}

export interface ActionRunResult {
  mode: "opened-url" | "copied-to-clipboard" | "rejected";
  detail?: string;
}
