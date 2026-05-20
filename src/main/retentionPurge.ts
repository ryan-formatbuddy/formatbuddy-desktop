import type {
  CleanupTrashPurgeResult,
  RegistryBackupPurgeResult,
  RestoreBinPurgeKind,
  RestoreBinPurgeResult,
  StartupDisabledPurgeResult
} from "@shared/types";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";

export const RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export type RetentionPurgeTrigger = "startup" | "scheduled";

export interface RetentionPurgeTickDeps {
  trigger: RetentionPurgeTrigger;
  purgeTrash: (trigger: RetentionPurgeTrigger) => Promise<CleanupTrashPurgeResult>;
  purgeRegistryBackups: (trigger: RetentionPurgeTrigger) => Promise<RegistryBackupPurgeResult>;
  purgeStartupDisabled?: (trigger: RetentionPurgeTrigger) => Promise<StartupDisabledPurgeResult>;
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
  "startup-disabled": "잠시 꺼둔 시작 항목을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
};

const PURGE_KIND_LABELS: Record<RestoreBinPurgeKind, string> = {
  trash: "파일 복구함",
  "registry-backups": "앱 삭제 흔적 백업",
  "startup-disabled": "잠시 꺼둔 시작 항목"
};

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

function normalizeTrashPurgeResult(result: CleanupTrashPurgeResult): CleanupTrashPurgeResult {
  const purgedEntryIds = coerceSafeIdList(result.purgedEntryIds);
  return {
    ...result,
    purgedCount: purgedEntryIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedEntryIds,
    failedEntryIds: coerceOptionalSafeIdList(result.failedEntryIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeRegistryBackupPurgeResult(
  result: RegistryBackupPurgeResult
): RegistryBackupPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedBytes: coerceNonNegativeInteger(result.purgedBytes),
    purgedIds,
    failedIds: coerceOptionalSafeIdList(result.failedIds),
    retentionDays: coerceRetentionDays(result.retentionDays)
  };
}

function normalizeStartupDisabledPurgeResult(
  result: StartupDisabledPurgeResult
): StartupDisabledPurgeResult {
  const purgedIds = coerceSafeIdList(result.purgedIds);
  return {
    ...result,
    purgedCount: purgedIds.length,
    purgedIds,
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

function missingPurgeBuckets(result: RetentionPurgeTickResult): RestoreBinPurgeKind[] {
  const failedKinds = result.failed.map((failure) => failure.kind);
  const missingKinds = failedKinds.filter((kind) => {
    if (kind === "trash") return !result.trash;
    if (kind === "registry-backups") return !result.registryBackups;
    return !result.startupDisabled;
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

  const trashCount = result.trash?.purgedCount ?? 0;
  const registryCount = result.registryBackups?.purgedCount ?? 0;
  const startupCount = result.startupDisabled?.purgedCount ?? 0;
  if (trashCount > 0 || registryCount > 0 || startupCount > 0) {
    const summary = `파일 ${trashCount}개, 앱 삭제 흔적 백업 ${registryCount}개`;
    deps.logInfo?.(
      result.startupDisabled
        ? `30일 자동 비움: ${summary}, 잠시 꺼둔 시작 항목 ${startupCount}개`
        : `30일 자동 비움: ${summary}`
    );
  }

  return result;
}
