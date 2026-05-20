import type { StartupFolderRestoreRequest } from "@shared/types";
import { isSafeStartupDisabledId } from "./folderToggle";

export function normalizeStartupFolderRestoreRequest(
  request: unknown
): StartupFolderRestoreRequest {
  if (!request || typeof request !== "object") return { disabledId: "" };
  const disabledId = (request as Record<string, unknown>).disabledId;
  return {
    disabledId: isSafeStartupDisabledId(disabledId) ? disabledId : ""
  };
}
