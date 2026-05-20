import { lstat, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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
      const boundaryChildPrefix = normalizedBoundary.endsWith("\\")
        ? normalizedBoundary
        : `${normalizedBoundary}\\`;
      const insideBoundary =
        normalizedCurrent === normalizedBoundary ||
        normalizedCurrent.startsWith(boundaryChildPrefix);
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

function isProgramFilesFolderName(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "program files" || normalized === "program files (x86)";
}

function nearestProgramFilesAncestorPath(targetPath: string): string | undefined {
  let current = targetPath;

  while (current) {
    if (isProgramFilesFolderName(basename(current))) return current;
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }

  return undefined;
}

export async function findLinkedInstallFolderPathPart(
  targetPath: string
): Promise<string | undefined> {
  return findLinkedPathPart(
    targetPath,
    nearestProgramFilesAncestorPath(targetPath) ?? dirname(targetPath),
    true
  );
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
