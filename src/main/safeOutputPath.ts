import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { findLinkedPathPart } from "./cleanup/pathSafety";

export interface SafeOutputFilePathOptions {
  label: string;
}

async function findNearestExistingPath(targetPath: string): Promise<string> {
  let current = targetPath;

  while (current) {
    try {
      await fs.lstat(current);
      return current;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }

    const next = dirname(current);
    if (next === current) return current;
    current = next;
  }

  return targetPath;
}

export async function ensureSafeOutputFilePath(
  outputPath: string,
  options: SafeOutputFilePathOptions
): Promise<string> {
  const parent = dirname(outputPath);
  const existingBoundary = await findNearestExistingPath(parent);
  const linkedBefore = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedBefore) {
    throw new Error(`${options.label} output path is behind a link: ${linkedBefore}`);
  }

  await fs.mkdir(parent, { recursive: true });

  const linkedAfter = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedAfter) {
    throw new Error(`${options.label} output path is behind a link: ${linkedAfter}`);
  }

  try {
    const stat = await fs.lstat(outputPath);
    if (stat.isDirectory()) {
      throw new Error(`${options.label} output path is a folder: ${outputPath}`);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  return outputPath;
}

export async function ensureSafeOutputDirectoryPath(
  outputPath: string,
  options: SafeOutputFilePathOptions
): Promise<string> {
  const existingBoundary = await findNearestExistingPath(outputPath);
  const linkedBefore = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedBefore) {
    throw new Error(`${options.label} output folder is behind a link: ${linkedBefore}`);
  }

  await fs.mkdir(outputPath, { recursive: true });

  const linkedAfter = await findLinkedPathPart(outputPath, existingBoundary, true);
  if (linkedAfter) {
    throw new Error(`${options.label} output folder is behind a link: ${linkedAfter}`);
  }

  const stat = await fs.lstat(outputPath);
  if (!stat.isDirectory()) {
    throw new Error(`${options.label} output path is not a folder: ${outputPath}`);
  }

  return outputPath;
}

export const __testing = { findNearestExistingPath };
