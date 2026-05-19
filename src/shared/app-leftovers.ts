import type { AppLeftoversSnapshot } from "./types";

export function summarizeLeftoverSnapshot(snapshot: AppLeftoversSnapshot): {
  total: number;
  selectable: number;
  protected: number;
  missing: number;
} {
  const stats = {
    total: 0,
    selectable: 0,
    protected: 0,
    missing: 0
  };

  for (const group of snapshot.groups) {
    for (const path of group.paths) {
      stats.total += 1;
      if (!path.exists) stats.missing += 1;
      else if (path.protectedBy) stats.protected += 1;
      else stats.selectable += 1;
    }
  }

  return stats;
}
