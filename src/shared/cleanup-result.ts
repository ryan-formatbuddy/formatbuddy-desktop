import type { CleanupExecuteResult, CleanupTrashRestoreResult } from "./types";

export function restorableTrashEntryIds(result: CleanupExecuteResult): string[] {
  return result.removedItems
    .filter((item) => item.succeeded && item.mode === "trash" && Boolean(item.trashEntryId))
    .map((item) => item.trashEntryId)
    .filter((id): id is string => typeof id === "string");
}

export function summarizeTrashRestoreResults(
  results: CleanupTrashRestoreResult[]
): string {
  const restored = results.filter((item) => item.status === "restored").length;
  const blocked = results.filter((item) => item.status === "target-exists").length;
  const failed = results.length - restored - blocked;
  const parts: string[] = [];

  if (restored > 0) parts.push(`${restored}개를 원래 위치로 되돌렸어요.`);
  if (blocked > 0) parts.push(`${blocked}개는 원래 위치에 같은 이름이 있어 멈췄어요.`);
  if (failed > 0) parts.push(`${failed}개는 이미 없거나 되돌리지 못했어요.`);

  return parts.length > 0 ? parts.join(" ") : "되돌린 항목이 없어요.";
}
