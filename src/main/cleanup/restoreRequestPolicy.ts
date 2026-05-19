import type {
  CleanupTrashRestoreRequest,
  RegistryBackupRestoreRequest
} from "@shared/types";

function objectField(value: unknown, field: string): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" ? raw : "";
}

export function normalizeCleanupTrashRestoreRequest(
  request: unknown
): CleanupTrashRestoreRequest {
  return { entryId: objectField(request, "entryId") };
}

export function normalizeRegistryBackupRestoreRequest(
  request: unknown
): RegistryBackupRestoreRequest {
  return { backupId: objectField(request, "backupId") };
}
