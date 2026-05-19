import { lstat } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizePath } from "./blocklist";

export async function findLinkedPathPart(
  targetPath: string,
  boundary?: string,
  includeSelf = false
): Promise<string | undefined> {
  const normalizedBoundary = boundary ? normalizePath(boundary) : undefined;
  let current = includeSelf ? targetPath : dirname(targetPath);

  while (current) {
    const normalizedCurrent = normalizePath(current);
    if (normalizedBoundary) {
      const insideBoundary =
        normalizedCurrent === normalizedBoundary ||
        normalizedCurrent.startsWith(`${normalizedBoundary}\\`);
      if (!insideBoundary) break;
    }

    try {
      const pathStat = await lstat(current);
      if (pathStat.isSymbolicLink()) return current;
    } catch {
      // Missing parents are fine: callers may create them after the
      // existing parent chain has passed this link check.
    }

    if (normalizedBoundary && normalizedCurrent === normalizedBoundary) break;
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }

  return undefined;
}
