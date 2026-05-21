import type {
  CleanupTrashRestoreRequest,
  RegistryBackupRestoreRequest,
  ScheduledTaskBackupRestoreRequest
} from "@shared/types";
import { isSafeScheduledTaskBackupId } from "../startup/scheduledTaskBackup";

function objectField(value: unknown, field: string): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" ? raw : "";
}

function isSafeRestoreRequestId(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed === value &&
    value !== "." &&
    value !== ".." &&
    !/\s/.test(value) &&
    !/[\/\\\u0000-\u001f\u007f]/.test(value)
  );
}

function objectSafeId(value: unknown, field: string): string {
  const raw = objectField(value, field);
  return isSafeRestoreRequestId(raw) ? raw : "";
}

export function normalizeCleanupTrashRestoreRequest(
  request: unknown
): CleanupTrashRestoreRequest {
  return { entryId: objectSafeId(request, "entryId") };
}

export function normalizeRegistryBackupRestoreRequest(
  request: unknown
): RegistryBackupRestoreRequest {
  return { backupId: objectSafeId(request, "backupId") };
}

export function normalizeScheduledTaskBackupRestoreRequest(
  request: unknown
): ScheduledTaskBackupRestoreRequest {
  const backupId = objectField(request, "backupId");
  return { backupId: isSafeScheduledTaskBackupId(backupId) ? backupId : "" };
}
