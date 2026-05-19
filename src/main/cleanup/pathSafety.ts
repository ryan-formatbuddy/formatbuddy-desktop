import { lstat, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizePath } from "./blocklist";

const MAX_LINK_DESCENDANT_DEPTH = 32;

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

export async function findLinkedDescendant(
  root: string,
  depth = 0
): Promise<string | undefined> {
  if (depth > MAX_LINK_DESCENDANT_DEPTH) return root;

  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch {
    return undefined;
  }

  if (rootStat.isSymbolicLink()) return root;
  if (!rootStat.isDirectory()) return undefined;

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    const child = join(root, entry.name);
    if (entry.isSymbolicLink()) return child;
    if (!entry.isDirectory()) continue;
    const nested = await findLinkedDescendant(child, depth + 1);
    if (nested) return nested;
  }

  return undefined;
}

export const __testing = {
  MAX_LINK_DESCENDANT_DEPTH
};
