import type {
  CleanupTrashPurgeResult,
  CleanupTrashPurgedItem,
  RegistryBackupPurgedItem,
  RegistryBackupPurgeResult,
  RestoreBinPurgeKind,
  RestoreBinPurgeResult,
  ScheduledTaskBackupPurgedItem,
  ScheduledTaskBackupPurgeResult,
  StartupDisabledPurgedItem,
  StartupDisabledPurgeResult
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";

export const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export type RetentionPurgeTrigger = "startup" | "scheduled" | "cleanup-plan" | "cleanup-execute";

export interface RetentionPurgeTickDeps {
  trigger: RetentionPurgeTrigger;
  purgeTrash: (trigger: RetentionPurgeTrigger) => Promise<CleanupTrashPurgeResult>;
  purgeRegistryBackups: (trigger: RetentionPurgeTrigger) => Promise<RegistryBackupPurgeResult>;
  purgeStartupDisabled?: (trigger: RetentionPurgeTrigger) => Promise<StartupDisabledPurgeResult>;
  purgeScheduledTaskBackups?: (trigger: RetentionPurgeTrigger) => Promise<ScheduledTaskBackupPurgeResult>;
  logInfo?: (message: string) => void;
  logWarn?: (message: string) => void;
}

export type RetentionPurgeTickResult = RestoreBinPurgeResult;

export interface RetentionPurgeAuditNotice {
  action: string;
  summary: string;
  detail: {
    trigger: RetentionPurgeTrigger;
    failedKinds: RestoreBinPurgeKind[];
    failedBucketCount: number;
    retentionDays: number;
  };
}

const PURGE_FAILURE_MESSAGES: Record<RestoreBinPurgeKind, string> = {
  trash: "파일 복구함을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요.",
  "registry-backups": "앱 삭제 흔적 백업을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요.",
  "startup-disabled": "잠시 꺼둔 시작 항목을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요.",
  "scheduled-task-backups": "예약 작업 백업을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
};

const PURGE_KIND_LABELS: Record<RestoreBinPurgeKind, string> = {
  trash: "파일 복구함",
  "registry-backups": "앱 삭제 흔적 백업",
  "startup-disabled": "잠시 꺼둔 시작 항목",
  "scheduled-task-backups": "예약 작업 백업"
};

const CLEANUP_TRASH_PURGED_CATEGORY_IDS = [
  "recycle-bin",
  "temp-user",
  "temp-windows",
  "browser-cache",
  "diagnostic-reports",
  "windows-old",
  "downloads-installers",
  "large-files",
  "app-leftovers"
] as const satisfies readonly CleanupTrashPurgedItem["categoryId"][];

function isCleanupTrashPurgedCategoryId(
  value: unknown
): value is CleanupTrashPurgedItem["categoryId"] {
  return (
    typeof value === "string" &&
    CLEANUP_TRASH_PURGED_CATEGORY_IDS.includes(value as CleanupTrashPurgedItem["categoryId"])
  );
}

function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const sanitized = raw
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "알 수 없는 문제";
}

function coerceNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function coerceRetentionDays(value: unknown): number {
  const days = coerceNonNegativeInteger(value);
  return days > 0 ? days : RESTORE_BIN_RETENTION_DAYS;
}

function coerceSafeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (
      typeof item !== "string" ||
      item.length === 0 ||
      item.trim() !== item ||
      item === "." ||
      item === ".." ||
      /\s/.test(item) ||
      /[\/\\]/.test(item) ||
      /[\u0000-\u001f\u007f]/.test(item)
    ) {
      continue;
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function coerceOptionalSafeIdList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? coerceSafeIdList(value) : undefined;
}

function sanitizePurgeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return label ? label.slice(0, 120) : null;
}

function normalizeTrashPurgedItems(
  value: unknown,
  allowedIds: Set<string>
): CleanupTrashPurgedItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: CleanupTrashPurgedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<CleanupTrashPurgedItem>;
    if (!item.id || !allowedIds.has(item.id) || seen.has(item.id)) continue;
    const label = sanitizePurgeLabel(item.label);
    if (!label || !isCleanupTrashPurgedCategoryId(item.categoryId)) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      label,
      categoryId: item.categoryId,
      sizeBytes: coerceNonNegativeInteger(item.sizeBytes)
    });
  }
  return items;
}

function normalizeRegistryBackupPurgedItems(
  value: unknown,
  allowedIds: Set<string>
): RegistryBackupPurgedItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: RegistryBackupPurgedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<RegistryBackupPurgedItem>;
    if (!item.id || !allowedIds.has(item.id) || seen.has(item.id)) continue;
    const label = sanitizePurgeLabel(item.label);
    const backupKind = normalizeRegistryBackupPurgedKind(item.backupKind);
    if (!label || !backupKind) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      label,
      backupKind,
      sizeBytes: coerceNonNegativeInteger(item.sizeBytes)
    });
  }
  return items;
}

function normalizeRegistryBackupPurgedKind(
  value: unknown
): RegistryBackupPurgedItem["backupKind"] | null {
  if (value === "key") return "key";
  if (value === "startup-value") return "startup-value";
  if (value === "registered-app-value") return "registered-app-value";
  if (value === "environment-path-value") return "environment-path-value";
  if (value === "environment-variable-value") return "environment-variable-value";
  if (value === "firewall-rule-value") return "firewall-rule-value";
  if (value === "app-path-key") return "app-path-key";
  if (value === "open-with-key") return "open-with-key";
  if (value === "file-association-key") return "file-association-key";
  if (value === "context-menu-key") return "context-menu-key";
  if (value === "shell-extension-key") return "shell-extension-key";
  if (value === "protocol-handler-key") return "protocol-handler-key";
  if (value === "native-messaging-host-key") return "native-messaging-host-key";
  if (value === "service-key") return "service-key";
  return null;
}

function normalizeStartupDisabledPurgedItems(
  value: unknown,
  allowedIds: Set<string>
): StartupDisabledPurgedItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: StartupDisabledPurgedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<StartupDisabledPurgedItem>;
    if (!item.id || !allowedIds.has(item.id) || seen.has(item.id)) continue;
    const label = sanitizePurgeLabel(item.label);
    if (!label) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      label,
      sizeBytes: coerceNonNegativeInteger(item.sizeBytes)
    });
  }
  return items;
}

function normalizeScheduledTaskBackupPurgedItems(
  value: unknown,
  allowedIds: Set<string>
): ScheduledTaskBackupPurgedItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: ScheduledTaskBackupPurgedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<ScheduledTaskBackupPurgedItem>;
    if (!item.id || !allowedIds.has(item.id) || seen.has(item.id)) continue;
    const label = sanitizePurgeLabel(item.label);
    if (!label) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      label,
      sizeBytes: coerceNonNegativeInteger(item.sizeBytes)
    });
  }
  return items;
}

function normalizeTrashPurgeResult(result: CleanupTrashPurgeResult): CleanupTrashPurgeResult {
  const purgedEntryIds = coerceSafeIdList(result.purgedEntryIds);
  const purgedIdSet = new Set(purgedEntryIds);
  return {
    ...result,
    purgedCount: purgedEntryIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedEntryIds,
    purgedItems: normalizeTrashPurgedItems(result.purgedItems, purgedIdSet),
    failedEntryIds: coerceOptionalSafeIdList(result.failedEntryIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeRegistryBackupPurgeResult(
  result: RegistryBackupPurgeResult
): RegistryBackupPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  const purgedIdSet = new Set(purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedIds,
    purgedItems: normalizeRegistryBackupPurgedItems(result.purgedItems, purgedIdSet),
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeStartupDisabledPurgeResult(
  result: StartupDisabledPurgeResult
): StartupDisabledPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  const purgedIdSet = new Set(purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedIds,
    purgedItems: normalizeStartupDisabledPurgedItems(result.purgedItems, purgedIdSet),
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeScheduledTaskBackupPurgeResult(
  result: ScheduledTaskBackupPurgeResult
): ScheduledTaskBackupPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  const purgedIdSet = new Set(purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedIds,
    purgedItems: normalizeScheduledTaskBackupPurgedItems(result.purgedItems, purgedIdSet),
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function recordPartialTrashFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.trash?.failedEntryIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `파일 복구함 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "trash", message });
  deps.logWarn?.(`30일 자동 비움 파일 복구함 일부 실패: ${failedCount}개`);
}

function recordPartialRegistryBackupFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.registryBackups?.failedIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `앱 삭제 흔적 백업 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "registry-backups", message });
  deps.logWarn?.(`30일 자동 비움 앱 삭제 흔적 백업 일부 실패: ${failedCount}개`);
}

function recordPartialStartupDisabledFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.startupDisabled?.failedIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `잠시 꺼둔 시작 항목 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "startup-disabled", message });
  deps.logWarn?.(`30일 자동 비움 잠시 꺼둔 시작 항목 일부 실패: ${failedCount}개`);
}

function recordPartialScheduledTaskBackupFailure(
  result: RetentionPurgeTickResult,
  deps: RetentionPurgeTickDeps
): void {
  const failedCount = result.scheduledTaskBackups?.failedIds?.length ?? 0;
  if (failedCount === 0) return;
  const message = `예약 작업 백업 ${failedCount}개를 아직 비우지 못했어요.`;
  result.failed.push({ kind: "scheduled-task-backups", message });
  deps.logWarn?.(`30일 자동 비움 예약 작업 백업 일부 실패: ${failedCount}개`);
}

function missingPurgeBuckets(result: RetentionPurgeTickResult): RestoreBinPurgeKind[] {
  const failedKinds = result.failed.map((failure) => failure.kind);
  const missingKinds = failedKinds.filter((kind) => {
    if (kind === "trash") return !result.trash;
    if (kind === "registry-backups") return !result.registryBackups;
    if (kind === "startup-disabled") return !result.startupDisabled;
    return !result.scheduledTaskBackups;
  });
  return Array.from(new Set(missingKinds));
}

export function buildRetentionPurgeAuditNotice(
  result: RetentionPurgeTickResult,
  trigger: RetentionPurgeTrigger
): RetentionPurgeAuditNotice | null {
  const failedKinds = missingPurgeBuckets(result);
  if (failedKinds.length === 0) return null;

  const labels = failedKinds.map((kind) => PURGE_KIND_LABELS[kind]);
  const joinedLabels = labels.length === 1 ? labels[0] : labels.join(", ");

  return {
    action: `restore-bin-expired-purge-failed-${trigger}`,
    summary: `30일 복구함 자동 비움에서 ${joinedLabels}을 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요.`,
    detail: {
      trigger,
      failedKinds,
      failedBucketCount: failedKinds.length,
      retentionDays: RESTORE_BIN_RETENTION_DAYS
    }
  };
}

export async function runRetentionPurgeTick(
  deps: RetentionPurgeTickDeps
): Promise<RetentionPurgeTickResult> {
  const result: RetentionPurgeTickResult = { failed: [] };

  try {
    result.trash = normalizeTrashPurgeResult(await deps.purgeTrash(deps.trigger));
    recordPartialTrashFailure(result, deps);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({ kind: "trash", message: PURGE_FAILURE_MESSAGES.trash });
    deps.logWarn?.(`30일 자동 비움 파일 복구함 실패: ${message}`);
  }

  try {
    result.registryBackups = normalizeRegistryBackupPurgeResult(
      await deps.purgeRegistryBackups(deps.trigger)
    );
    recordPartialRegistryBackupFailure(result, deps);
  } catch (err) {
    const message = errorMessage(err);
    result.failed.push({
      kind: "registry-backups",
      message: PURGE_FAILURE_MESSAGES["registry-backups"]
    });
    deps.logWarn?.(`30일 자동 비움 앱 삭제 흔적 백업 실패: ${message}`);
  }

  if (deps.purgeStartupDisabled) {
    try {
      result.startupDisabled = normalizeStartupDisabledPurgeResult(
        await deps.purgeStartupDisabled(deps.trigger)
      );
      recordPartialStartupDisabledFailure(result, deps);
    } catch (err) {
      const message = errorMessage(err);
      result.failed.push({
        kind: "startup-disabled",
        message: PURGE_FAILURE_MESSAGES["startup-disabled"]
      });
      deps.logWarn?.(`30일 자동 비움 잠시 꺼둔 시작 항목 실패: ${message}`);
    }
  }

  if (deps.purgeScheduledTaskBackups) {
    try {
      result.scheduledTaskBackups = normalizeScheduledTaskBackupPurgeResult(
        await deps.purgeScheduledTaskBackups(deps.trigger)
      );
      recordPartialScheduledTaskBackupFailure(result, deps);
    } catch (err) {
      const message = errorMessage(err);
      result.failed.push({
        kind: "scheduled-task-backups",
        message: PURGE_FAILURE_MESSAGES["scheduled-task-backups"]
      });
      deps.logWarn?.(`30일 자동 비움 예약 작업 백업 실패: ${message}`);
    }
  }

  const trashCount = result.trash?.purgedCount ?? 0;
  const registryCount = result.registryBackups?.purgedCount ?? 0;
  const startupCount = result.startupDisabled?.purgedCount ?? 0;
  const scheduledTaskCount = result.scheduledTaskBackups?.purgedCount ?? 0;
  if (trashCount > 0 || registryCount > 0 || startupCount > 0 || scheduledTaskCount > 0) {
    const summaryParts = [`파일 ${trashCount}개`, `앱 삭제 흔적 백업 ${registryCount}개`];
    if (result.startupDisabled) summaryParts.push(`잠시 꺼둔 시작 항목 ${startupCount}개`);
    if (result.scheduledTaskBackups) summaryParts.push(`예약 작업 백업 ${scheduledTaskCount}개`);
    deps.logInfo?.(`30일 자동 비움: ${summaryParts.join(", ")}`);
  }

  return result;
}
