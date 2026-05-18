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

export type FileCandidateKind = "installer" | "archive" | "video" | "image" | "document" | "audio" | "other";

export interface LargeFileCandidate {
  name: string;
  path: string;
  folderName: string;
  extension?: string | null;
  kind: FileCandidateKind;
  sizeGb: number;
  modifiedAt?: string | null;
}

export interface DuplicateFileCandidateGroup {
  name: string;
  sizeGb: number;
  count: number;
  totalWastedGb: number;
  paths: string[];
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

export type CleanupCandidateKind = "trash" | "temporary" | "windows-old" | "large-files" | "duplicates" | "startup";
export type CleanupCandidateStatus = "ready" | "review" | "empty";

export interface CleanupCandidate {
  id: string;
  kind: CleanupCandidateKind;
  title: string;
  status: CleanupCandidateStatus;
  sizeGb?: number;
  count?: number;
  evidence: string;
  action: string;
  safetyNote: string;
}

export interface CleanupCenterSummary {
  reclaimableGb: number;
  reviewCount: number;
  candidates: CleanupCandidate[];
  largeFiles: LargeFileCandidate[];
  duplicateGroups: DuplicateFileCandidateGroup[];
  startupItems: StartupProgramItem[];
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
  cleanupCenter: CleanupCenterSummary;
  appInventory: AppInventorySummary;
  buddyChecklist: BuddyChecklistItem[];
  careActions: CareAction[];
}

export interface ScanHistoryEntry {
  id: string;
  generatedAt: string;
  score: number;
  severity: FormatSeverity;
  headline: string;
  reclaimableGb: number;
  reviewCount: number;
  directCheckCount: number;
  warningCount: number;
  installedAppCount: number;
  largeFileCount: number;
  duplicateGroupCount: number;
  startupCount: number;
}

export interface ScanHistoryComparison {
  current: ScanHistoryEntry;
  previous?: ScanHistoryEntry;
  scoreDelta?: number;
  reclaimableDeltaGb?: number;
  directCheckDelta?: number;
  warningDelta?: number;
}

export interface IgnoreListState {
  cleanupItemIds: string[];
  pathHints: string[];
  updatedAt?: string;
}

export interface StatusMonitorSnapshot {
  lastScanAt?: string;
  lastScore?: number;
  severity?: FormatSeverity;
  staleDays?: number;
  nextSuggestedScanAt?: string;
  cleanupLabel: string;
  protectionLabel: string;
  backupLabel: string;
  message: string;
}

export interface AppStateSnapshot {
  history: ScanHistoryEntry[];
  comparison?: ScanHistoryComparison;
  ignoreList: IgnoreListState;
  monitor: StatusMonitorSnapshot;
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
  largeFiles?: LargeFileCandidate[];
  duplicateFileCandidates?: DuplicateFileCandidateGroup[];
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
  appState?: AppStateSnapshot;
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

export interface IgnoreListUpdate {
  kind: "cleanup" | "path";
  id: string;
  ignored: boolean;
}

/**
 * v1.3.0 — Safe cleanup execution engine.
 *
 * Two-step flow:
 *   1. planCleanup()    → dry-run, builds CleanupPlan with explicit items
 *   2. executeCleanup() → requires planId + matching confirmationToken +
 *                        explicit selectedItemIds, blocklist re-checked
 *                        per item, results logged.
 *
 * Risk levels:
 *   - safe       Windows/Apps regenerate this (temp, recycle bin, browser
 *                cache without credentials). Auto-checked by default in UI.
 *   - review     User-owned content (large files, Windows.old, old
 *                installers in Downloads). Unchecked by default.
 *   - restricted Blocklist tripped. Never deletable; surfaced only as
 *                "skipped because…" so user understands what was protected.
 */
export type CleanupCategoryId =
  | "recycle-bin"
  | "temp-user"
  | "temp-windows"
  | "browser-cache"
  | "windows-old"
  | "downloads-installers"
  | "large-files";

export type CleanupRiskLevel = "safe" | "review" | "restricted";

export type CleanupExecuteMode = "trash" | "permanent";

export type CleanupSkipReason =
  | "blocked-path"
  | "not-selected"
  | "access-denied"
  | "not-found"
  | "below-min-age"
  | "execute-failed";

export interface CleanupItem {
  /** Stable hash derived from absolute path; safe to use as React key. */
  id: string;
  /** Absolute path on disk. Always normalized to the host's native separator. */
  path: string;
  /** Display label — usually the basename of the path. */
  label: string;
  sizeBytes: number;
  /** ISO-8601 UTC; may be missing for synthetic group entries. */
  modifiedAt?: string;
  categoryId: CleanupCategoryId;
  riskLevel: CleanupRiskLevel;
  /** Short rationale for *why* this candidate is here (e.g. "30일 이상 미사용"). */
  reason: string;
  /** When riskLevel === "restricted", the blocklist rule that matched. */
  blockedBy?: string;
}

export interface CleanupCategoryPlan {
  id: CleanupCategoryId;
  label: string;
  description: string;
  safetyNote: string;
  riskLevel: CleanupRiskLevel;
  totalBytes: number;
  itemCount: number;
  items: CleanupItem[];
  /** Items blocked by the safety net. Shown for transparency, never executable. */
  blockedItems: CleanupItem[];
}

export interface CleanupPlan {
  planId: string;
  generatedAt: string;
  /**
   * Opaque token that executeCleanup() will re-verify. Prevents stale plans
   * from a previous scan being replayed against a freshly mutated filesystem.
   */
  confirmationToken: string;
  blocklistVersion: number;
  totalReclaimableBytes: number;
  categories: CleanupCategoryPlan[];
  /** Diagnostic notes (e.g. "Downloads 폴더 접근이 거부됐어요"). */
  notes: string[];
}

export interface CleanupExecuteRequest {
  planId: string;
  confirmationToken: string;
  selectedItemIds: string[];
  mode: CleanupExecuteMode;
}

export interface CleanupExecutedItem {
  itemId: string;
  path: string;
  sizeBytes: number;
  categoryId: CleanupCategoryId;
  mode: CleanupExecuteMode;
  succeeded: boolean;
  error?: string;
}

export interface CleanupSkippedItem {
  itemId: string;
  path: string;
  reason: CleanupSkipReason;
  detail?: string;
}

export interface CleanupCategoryBreakdown {
  categoryId: CleanupCategoryId;
  bytesFreed: number;
  itemCount: number;
}

export interface CleanupLogEntry {
  id: string;
  executedAt: string;
  mode: CleanupExecuteMode;
  totalFreedBytes: number;
  removedCount: number;
  skippedCount: number;
  categories: CleanupCategoryBreakdown[];
}

export interface CleanupExecuteResult {
  planId: string;
  executedAt: string;
  mode: CleanupExecuteMode;
  totalFreedBytes: number;
  removedItems: CleanupExecutedItem[];
  skippedItems: CleanupSkippedItem[];
  logEntry: CleanupLogEntry;
}

export interface CleanupHistorySnapshot {
  entries: CleanupLogEntry[];
}
