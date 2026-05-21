import type { AppLeftoverGroup, AppLeftoverPath, AppLeftoversSnapshot } from "./types";

export function canCleanupLeftoverGroup(group: AppLeftoverGroup): boolean {
  return group.source === "uninstall-launched" && group.cleanupState === "removed-confirmed";
}

export function selectableLeftoverPathIds(snapshot: AppLeftoversSnapshot): Set<string> {
  const ids = new Set<string>();

  for (const group of snapshot.groups) {
    if (!canCleanupLeftoverGroup(group)) continue;
    for (const path of group.paths) {
      if (path.exists && !path.protectedBy) ids.add(path.id);
    }
  }

  return ids;
}

export function summarizeLeftoverSnapshot(snapshot: AppLeftoversSnapshot): {
  total: number;
  selectable: number;
  protected: number;
  missing: number;
  installedLocked: number;
  notChecked: number;
  manualCheck: number;
} {
  const stats = {
    total: 0,
    selectable: 0,
    protected: 0,
    missing: 0,
    installedLocked: 0,
    notChecked: 0,
    manualCheck: 0
  };

  for (const group of snapshot.groups) {
    for (const path of group.paths) {
      stats.total += 1;
      if (!path.exists) stats.missing += 1;
      else if (leftoverPathNeedsManualCheck(path)) stats.manualCheck += 1;
      else if (path.protectedBy) stats.protected += 1;
      else if (group.source !== "uninstall-launched" || group.cleanupState === "still-installed") {
        stats.installedLocked += 1;
      }
      else if (group.cleanupState !== "removed-confirmed") stats.notChecked += 1;
      else stats.selectable += 1;
    }
  }

  return stats;
}

export function leftoverPathNeedsManualCheck(
  path: Pick<AppLeftoverPath, "kind" | "protectedBy" | "startupEntryKind">
): boolean {
  return (
    (path.kind === "startup-entry" &&
      (path.startupEntryKind !== "scheduled-task" || Boolean(path.protectedBy))) ||
    (path.kind === "startup-registry" && Boolean(path.protectedBy))
  );
}
