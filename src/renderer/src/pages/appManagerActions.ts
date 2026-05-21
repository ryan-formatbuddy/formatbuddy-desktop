import type { CleanupExecuteResult } from "@shared/types";

export type AppLeftoverResultActionId =
  | "rescan"
  | "trashRestore"
  | "restoreRecent"
  | "auditLog";

export type AppLeftoverResultActionVariant = "primary" | "secondary" | "ghost";

export interface AppLeftoverResultAction {
  id: AppLeftoverResultActionId;
  label: string;
  variant: AppLeftoverResultActionVariant;
  disabled?: boolean;
}

export function appLeftoverResultActions({
  result,
  restorableCount,
  restoreRecentBusy
}: {
  result: CleanupExecuteResult;
  restorableCount: number;
  restoreRecentBusy: boolean;
}): AppLeftoverResultAction[] {
  const actions: AppLeftoverResultAction[] = [
    {
      id: "rescan",
      label: "다시 점검해서 효과 보기",
      variant: "primary"
    }
  ];

  if (result.mode === "trash" && restorableCount > 0) {
    actions.push({
      id: "trashRestore",
      label: "복구함 보기",
      variant: "secondary"
    });
  }

  if (restorableCount > 0) {
    actions.push({
      id: "restoreRecent",
      label: restoreRecentBusy ? "되돌리는 중…" : "방금 정리 되돌리기",
      variant: "ghost",
      disabled: restoreRecentBusy
    });
  }

  actions.push({
    id: "auditLog",
    label: "활동 기록 보기",
    variant: "ghost"
  });

  return actions;
}
