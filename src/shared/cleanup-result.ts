import type { CleanupExecuteResult } from "./types";

export function restorableTrashEntryIds(result: CleanupExecuteResult): string[] {
  return result.removedItems
    .filter((item) => item.succeeded && item.mode === "trash" && Boolean(item.trashEntryId))
    .map((item) => item.trashEntryId)
    .filter((id): id is string => typeof id === "string");
}
