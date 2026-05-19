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
  /** Windows Uninstall registry — used by main/apps/uninstaller.ts. Never invented. */
  uninstallString?: string | null;
  quietUninstallString?: string | null;
  installLocation?: string | null;
  estimatedSizeKb?: number | null;
  installDate?: string | null;
  /** SystemComponent=1 in registry — hide from user-facing uninstall lists. */
  systemComponent?: boolean | null;
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

/**
 * v2.0 (Round D-4 / B7) -- Per-category 0..100 scores.
 *
 * The single `formatScore` answers "should I format?"; these answer
 * "where exactly is this PC tired?". 0 = healthy, 100 = action needed.
 * Lives on the recommendation so the UI can render trend cards vs.
 * the prior scan without recomputing.
 */
export interface CategoryScores {
  cleanup: number;
  security: number;
  performance: number;
  disk: number;
}

export interface Recommendation {
  formatScore: number;
  severity: FormatSeverity;
  headline: string;
  summary: string;
  categoryScores: CategoryScores;
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
  | "large-files"
  | "app-leftovers";

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
  /** Present when mode === "trash" and the item is restorable from FormatBuddy's 30-day bin. */
  trashEntryId?: string;
  /** ISO-8601 UTC. FormatBuddy auto-deletes the trashed copy after this time. */
  expiresAt?: string;
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

/**
 * FormatBuddy Trash — a local 30-day restore bin.
 *
 * Unlike the Windows Recycle Bin, this bin is app-managed:
 *   - files are moved under userData/formatbuddy-trash/items/<entryId>
 *   - index stores the original path for one-click restore
 *   - expired entries are permanently removed after 30 days
 *
 * This is the product-level safety layer behind "깔끔 삭제".
 */
export interface CleanupTrashEntry {
  id: string;
  itemId: string;
  originalPath: string;
  storedPath: string;
  label: string;
  categoryId: CleanupCategoryId;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

export interface CleanupTrashSnapshot {
  entries: CleanupTrashEntry[];
  totalBytes: number;
  retentionDays: number;
  nextExpiryAt?: string;
}

export interface CleanupTrashRestoreRequest {
  entryId: string;
}

export type CleanupTrashRestoreStatus =
  | "restored"
  | "not-found"
  | "target-exists"
  | "missing-stored-item"
  | "restore-failed";

export interface CleanupTrashRestoreResult {
  entryId: string;
  status: CleanupTrashRestoreStatus;
  message: string;
  originalPath?: string;
  entry?: CleanupTrashEntry;
}

export interface CleanupTrashPurgeResult {
  purgedCount: number;
  purgedBytes: number;
  purgedEntryIds: string[];
  retentionDays: number;
}

/**
 * v2.0 — Unified audit log. Cleanup, uninstall, Defender quick scan,
 * monitor toggles all funnel into the same append-only timeline so a
 * user can see "everything FormatBuddy did on this PC" in one screen.
 *
 * Entries are stored under userData/formatbuddy-audit-log.json. The
 * reader prunes anything older than retentionDays (default 90) on load.
 *
 * The structured `detail` object is intentionally untyped at the shared
 * boundary — each emitter decides its own shape. Renderer only renders
 * `summary`; detail is shown verbatim in a collapsible debug block.
 */
export type AuditCategory =
  | "cleanup"
  | "uninstall"
  | "defender"
  | "monitor"
  | "system";

export interface AuditEntry {
  id: string;
  at: string;
  category: AuditCategory;
  action: string;
  summary: string;
  detail?: Record<string, unknown>;
}

export interface AuditSnapshot {
  entries: AuditEntry[];
  retentionDays: number;
}

/**
 * v2.0 (Round D-5 / B4) -- Driver backup snapshot.
 * Wraps `pnputil /export-driver` so the user has third-party drivers
 * ready to re-install after a format. Plain JS result so the renderer
 * can render a Korean summary without parsing PowerShell stdout.
 */
export type DriverBackupStatus =
  | "ok"
  | "windows-only"
  | "user-cancelled"
  | "pnputil-missing"
  | "exec-failed";

export interface DriverBackupResult {
  status: DriverBackupStatus;
  /** Folder we asked pnputil to write into. */
  targetDir?: string;
  /** Best-effort count of .inf packages exported, parsed from pnputil output. */
  driverCount?: number;
  /** Human-readable summary line for the audit log + Report status row. */
  summary: string;
  /** Truncated pnputil stderr when status is exec-failed. */
  detail?: string;
}

/**
 * v2.0 (Round D-5 / B5) -- Wi-Fi profile export.
 * Wraps `netsh wlan export profile`. The plaintext-password option is
 * intentionally separate so it requires an explicit user toggle.
 */
export type WifiExportStatus =
  | "ok"
  | "windows-only"
  | "user-cancelled"
  | "netsh-missing"
  | "exec-failed";

export interface WifiExportRequest {
  /** When true, embed the WPA passphrase as cleartext in the XML. */
  includePasswords?: boolean;
}

/**
 * v2.0 (Round D-27 / B3) — Deeper "PC 켤 때 같이 뜨는 것" inventory.
 *
 * The original ScanReport.startupPrograms only covered the four
 * Win32_StartupCommand sources. Windows actually launches things at
 * boot from several more places, and a real PC-care tool has to show
 * them all in one place so the user can see *why* the boot is slow.
 *
 * Four sources we read (read-only, this round):
 *   - registry           : HKLM/HKCU Run + RunOnce (Win32_StartupCommand)
 *   - startup-folder     : %APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
 *   - scheduled-task     : Get-ScheduledTask filtered to ones marked Ready/Running
 *                          AND triggered at logon / boot
 *   - service            : Get-Service where StartType -in @('Automatic','AutomaticDelayedStart')
 *
 * Disable/Enable lands in a follow-up round (B3 toggle). Today's
 * scope is "show me everything that auto-starts" with provenance.
 */
export type StartupAutoKind =
  | "registry"
  | "startup-folder"
  | "scheduled-task"
  | "service";

export type StartupAutoStatus = "ok" | "windows-only" | "powershell-failed";

export interface StartupAutoEntry {
  /** Stable id derived from `${kind}|${name}|${path}`. */
  id: string;
  kind: StartupAutoKind;
  /** Display name. ScheduledTask: TaskName, Service: DisplayName, etc. */
  name: string;
  /** Best-effort path / command line. May be empty for services. */
  path?: string;
  /** Vendor / publisher when we can read it. */
  publisher?: string;
  /** Free-form Korean note: 어디서 켜지는지 한 줄 (e.g. "HKCU Run", "TaskScheduler"). */
  origin: string;
  /** When kind === 'scheduled-task' or 'service', whether it is enabled now. */
  enabled?: boolean;
}

export interface StartupAutoSnapshot {
  status: StartupAutoStatus;
  /** Wall-clock when the snapshot was taken. */
  capturedAt: string;
  entries: StartupAutoEntry[];
  /** Per-kind diagnostic note (e.g. timeouts, permission errors). */
  notes: string[];
}

export interface WifiExportResult {
  status: WifiExportStatus;
  targetDir?: string;
  /** Best-effort count of profile XML files written. */
  profileCount?: number;
  summary: string;
  detail?: string;
  /** Echo of the cleartext-password choice so audit log is unambiguous. */
  includedPasswords: boolean;
}

/**
 * v1.3.x — App manager. Phase 2 of the professional-grade rollout.
 *
 * Two surfaces:
 *   1. apps:list      → enriched + classified view of installed apps.
 *                       Source of truth is the last scan's
 *                       installedApps array, cached in the main
 *                       process so the renderer cannot inject a
 *                       fake UninstallString.
 *   2. apps:leftovers → per-app AppData / ProgramData paths that
 *                       might be left behind after Windows uninstall.
 *                       Display only; never deleted from this surface.
 *                       The Cleanup engine (Phase 1) is the only place
 *                       that ever removes user files.
 *   3. apps:uninstall → main process looks up the app by (name,
 *                       publisher) in the cached scan, validates the
 *                       UninstallString, then spawns Windows' own
 *                       uninstaller through cmd.exe. We never run a
 *                       string supplied directly by the renderer.
 */
export type AppManagerCategory =
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

export type AppUninstallAvailability =
  | "ready"
  | "no-uninstall-string"
  | "system-component"
  | "registry-only";

export interface AppManagerItem {
  id: string;
  name: string;
  publisher?: string | null;
  version?: string | null;
  category: AppManagerCategory;
  categoryLabel: string;
  installLocation?: string | null;
  estimatedSizeBytes?: number | null;
  installDate?: string | null;
  uninstallAvailability: AppUninstallAvailability;
  /** Short human note explaining the availability state. */
  availabilityNote: string;
  /** When availability === "ready", how the uninstaller will be invoked. */
  uninstallMode?: "interactive" | "quiet";
}

export interface AppManagerGroup {
  category: AppManagerCategory;
  label: string;
  count: number;
  items: AppManagerItem[];
}

export interface AppManagerSnapshot {
  generatedAt: string;
  total: number;
  classified: number;
  groups: AppManagerGroup[];
  /** Items the user agent chose to hide (system components, mostly). */
  hiddenSystemCount: number;
}

export interface AppLeftoverPath {
  id: string;
  path: string;
  exists: boolean;
  sizeBytes?: number | null;
  lastModifiedAt?: string | null;
  /** When true, the path is inside a Phase 1 blocklist root and must not be cleaned. */
  protectedBy?: string;
}

export interface AppLeftoverGroup {
  appName: string;
  publisher?: string | null;
  paths: AppLeftoverPath[];
}

export interface AppLeftoversSnapshot {
  planId: string;
  confirmationToken: string;
  generatedAt: string;
  groups: AppLeftoverGroup[];
}

export interface AppLeftoversCleanupRequest {
  planId: string;
  confirmationToken: string;
  selectedPathIds: string[];
}

export type AppUninstallMode = "interactive" | "quiet";

export interface AppUninstallRequest {
  appName: string;
  publisher?: string | null;
  mode?: AppUninstallMode;
}

export type AppUninstallStatus =
  | "launched"
  | "no-uninstall-string"
  | "app-not-found"
  | "blocked"
  | "spawn-failed"
  | "no-scan-cache";

export interface AppUninstallResult {
  status: AppUninstallStatus;
  appName: string;
  message: string;
  /** Detail used by the UI to disambiguate similar statuses (e.g. blocked reason). */
  detail?: string;
}

/**
 * v1.3.x — Defender bridge (Phase 3 of the professional-grade rollout).
 *
 * What we do:
 *   - Read Windows Defender state via Get-MpComputerStatus.
 *   - Trigger a Quick Scan via Start-MpScan -ScanType QuickScan
 *     (detached; Windows Security UI surfaces the progress).
 *   - List threat history via Get-MpThreatDetection.
 *
 * What we never do:
 *   - Claim FormatBuddy "removed" or "treated" a threat. Only
 *     Windows itself takes that action.
 *   - Disable or alter Defender's settings.
 *   - Hide Defender errors — we surface them so Ryan can act.
 */
export interface DefenderLiveStatus {
  /** ISO timestamp this status was sampled. */
  capturedAt: string;
  available: boolean;
  antivirusEnabled?: boolean | null;
  realTimeProtectionEnabled?: boolean | null;
  tamperProtectionEnabled?: boolean | null;
  signatureAgeDays?: number | null;
  lastQuickScanDaysAgo?: number | null;
  lastFullScanDaysAgo?: number | null;
  /** Diagnostic string when Defender cannot be queried (non-Windows, missing module, etc.). */
  unavailableReason?: string;
}

export type DefenderQuickScanStatus =
  | "launched"
  | "blocked"
  | "spawn-failed"
  | "unavailable";

export interface DefenderQuickScanResult {
  status: DefenderQuickScanStatus;
  startedAt: string;
  message: string;
  detail?: string;
}

export type DefenderThreatActionSuccess = "cleaned" | "quarantined" | "removed" | "allowed" | "blocked" | "no-action" | "unknown";

export interface DefenderThreatRecord {
  id: string;
  threatName?: string | null;
  detectionTime?: string | null;
  severity?: "low" | "moderate" | "high" | "severe" | "unknown";
  /** Defender's own status string (translated by Windows, not by us). */
  actionStatus: DefenderThreatActionSuccess;
  resources?: string[];
  rawStatus?: string;
}

export interface DefenderThreatSnapshot {
  capturedAt: string;
  available: boolean;
  records: DefenderThreatRecord[];
  unavailableReason?: string;
}

/**
 * v1.3.x — Optional tray + periodic reminder (Phase 5).
 *
 * Off by default. The user opts in from Home settings, never the
 * other way around. When trayEnabled flips on we instantiate Electron
 * Tray; off again we destroy it. When reminderEnabled is true the
 * main process checks once an hour: if the last scan is older than
 * `reminderDays`, surface a Notification — once per stale window,
 * tracked via lastReminderAt.
 *
 * We deliberately stop short of running scans automatically. The
 * notification only opens the FormatBuddy main window so the user
 * decides when to scan.
 */
export type UpdateChannel = "stable" | "beta";

/**
 * v2.0 (Round D-31 / C7 follow-up) — manual theme override.
 *
 *   "system" : follow the OS prefers-color-scheme (default).
 *   "light"  : force the light token set even on a dark OS.
 *   "dark"   : force the dark token set even on a light OS.
 *
 * Renderer translates this into a body class (`theme-light` /
 * `theme-dark`) which the dark @media block in globals.css respects
 * via a `:where(:root[data-theme="dark"], …)` companion selector.
 */
export type ThemeMode = "system" | "light" | "dark";

export interface MonitorPreferences {
  trayEnabled: boolean;
  reminderEnabled: boolean;
  /** Days since the last scan before we'll show a reminder. 1..90. */
  reminderDays: number;
  /** ISO of the last reminder we surfaced (so we don't spam). */
  lastReminderAt?: string;
  /**
   * v2.0 — which release feed electron-updater listens to. "stable" keeps
   * only GitHub releases without the prerelease flag; "beta" also accepts
   * prerelease tags so early adopters can opt into nightlies.
   */
  updateChannel: UpdateChannel;
  /**
   * v2.0 — when true, FormatBuddy asks Windows to create a System
   * Restore Point right before each cleanup execute / app uninstall.
   * Default ON. Failure to create one never blocks the action.
   */
  restorePointEnabled: boolean;
  /** v2.0 (D-31) — manual theme override; defaults to "system". */
  themeMode: ThemeMode;
  updatedAt?: string;
}

export interface UpdateMonitorPreferencesRequest {
  trayEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderDays?: number;
  updateChannel?: UpdateChannel;
  restorePointEnabled?: boolean;
  themeMode?: ThemeMode;
}
