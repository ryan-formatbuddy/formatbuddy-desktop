/**
 * Safe startup-folder toggle.
 *
 * We only support files that Windows loads from the Startup folders.
 * Registry Run keys, services, and scheduled tasks stay read-only until
 * they have separate rules, because disabling the wrong one can break
 * login, networking, or security software.
 */
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  StartupAutoDisabledEntry,
  StartupAutoDisabledSnapshot,
  StartupAutoEntry,
  StartupFolderToggleResult
} from "@shared/types";
import { normalizePath } from "../cleanup/blocklist";
import { findLinkedPathPart } from "../cleanup/pathSafety";

const STARTUP_DISABLED_DIR = "formatbuddy-startup-disabled";
const ITEMS_DIR = "items";
const META_FILE = "meta.json";

export interface StartupFolderToggleRuntime {
  userDataDir: string;
  now?: () => Date;
}

export interface DisableStartupFolderEntryOptions extends StartupFolderToggleRuntime {
  entry: StartupAutoEntry;
}

export interface RestoreStartupFolderEntryOptions extends StartupFolderToggleRuntime {
  disabledId: string;
}

function disabledRoot(userDataDir: string): string {
  return join(userDataDir, STARTUP_DISABLED_DIR);
}

function itemsRoot(userDataDir: string): string {
  return join(disabledRoot(userDataDir), ITEMS_DIR);
}

function entryDir(userDataDir: string, disabledId: string): string {
  return join(itemsRoot(userDataDir), disabledId);
}

function metaPath(userDataDir: string, disabledId: string): string {
  return join(entryDir(userDataDir, disabledId), META_FILE);
}

function storedPathFor(userDataDir: string, disabledId: string, originalPath: string): string {
  return join(entryDir(userDataDir, disabledId), "files", basename(originalPath) || "startup-item");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSafeStartupDisabledId(disabledId: string): boolean {
  return (
    disabledId.length > 0 &&
    disabledId !== "." &&
    disabledId !== ".." &&
    !disabledId.includes("/") &&
    !disabledId.includes("\\") &&
    !disabledId.includes("\0")
  );
}

function makeDisabledId(entry: StartupAutoEntry, now: Date): string {
  return createHash("sha1")
    .update(`${entry.id}|${now.toISOString()}`)
    .digest("hex")
    .slice(0, 24);
}

function isUnderRoot(childPath: string, rootPath: string): boolean {
  const child = normalizePath(resolve(childPath));
  const root = normalizePath(resolve(rootPath));
  return child === root || child.startsWith(`${root}\\`);
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function coerceDisabledEntry(value: unknown): StartupAutoDisabledEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<StartupAutoDisabledEntry>;
  if (!isNonEmptyString(raw.id) || !isSafeStartupDisabledId(raw.id)) return null;
  if (!isNonEmptyString(raw.entryId)) return null;
  if (!isNonEmptyString(raw.name)) return null;
  if (!isNonEmptyString(raw.originalPath)) return null;
  if (!isNonEmptyString(raw.storedPath)) return null;
  if (!isNonEmptyString(raw.origin)) return null;
  if (!validIso(raw.disabledAt)) return null;
  return {
    id: raw.id,
    entryId: raw.entryId,
    name: raw.name,
    originalPath: raw.originalPath,
    storedPath: raw.storedPath,
    origin: raw.origin,
    disabledAt: raw.disabledAt
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureManagedItemsRoot(userDataDir: string): Promise<void> {
  const linkedRoot = await findLinkedPathPart(itemsRoot(userDataDir), userDataDir, true);
  if (linkedRoot) {
    throw new Error(`FormatBuddy startup holding area is a link: ${linkedRoot}`);
  }
  await mkdir(itemsRoot(userDataDir), { recursive: true });
}

async function ensureSafeEntryWritePath(userDataDir: string, disabledId: string): Promise<void> {
  const dir = entryDir(userDataDir, disabledId);
  const linkedDir = await findLinkedPathPart(dir, userDataDir, true);
  if (linkedDir) {
    throw new Error(`FormatBuddy startup holding entry is a link: ${linkedDir}`);
  }
}

async function safeMove(source: string, target: string): Promise<void> {
  try {
    await rename(source, target);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
    await cp(source, target, { recursive: true, force: false, errorOnExist: true });
    await rm(source, { recursive: true, force: false });
  }
}

async function readDisabledEntry(userDataDir: string, disabledId: string): Promise<StartupAutoDisabledEntry | null> {
  if (!isSafeStartupDisabledId(disabledId)) return null;
  const linkedMeta = await findLinkedPathPart(metaPath(userDataDir, disabledId), entryDir(userDataDir, disabledId), true);
  if (linkedMeta) return null;
  try {
    const raw = await readFile(metaPath(userDataDir, disabledId), "utf8");
    return coerceDisabledEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function listDisabledStartupFolderEntries(
  options: StartupFolderToggleRuntime
): Promise<StartupAutoDisabledSnapshot> {
  const now = options.now?.() ?? new Date();
  const root = itemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    return {
      capturedAt: now.toISOString(),
      entries: [],
      notes: ["시작 항목 보관함 경로가 안전하지 않아 목록을 비웠어요."]
    };
  }

  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return { capturedAt: now.toISOString(), entries: [], notes: [] };
  }

  const entries: StartupAutoDisabledEntry[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const entry = await readDisabledEntry(options.userDataDir, dir.name);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => Date.parse(b.disabledAt) - Date.parse(a.disabledAt));
  return { capturedAt: now.toISOString(), entries, notes: [] };
}

export async function disableStartupFolderEntry(
  options: DisableStartupFolderEntryOptions
): Promise<StartupFolderToggleResult> {
  const { entry, userDataDir } = options;
  if (entry.kind !== "startup-folder") {
    return {
      status: "unsupported-kind",
      message: "이 항목은 아직 앱에서 끌 수 없어요. 시작 프로그램 폴더 항목부터 안전하게 지원해요."
    };
  }
  if (!isNonEmptyString(entry.path) || !isNonEmptyString(entry.origin)) {
    return {
      status: "blocked-path",
      message: "원래 위치를 확인하지 못해서 건드리지 않았어요."
    };
  }

  const source = resolve(entry.path);
  const origin = resolve(entry.origin);
  if (!isUnderRoot(source, origin)) {
    return {
      status: "blocked-path",
      message: "시작 프로그램 폴더 밖의 파일이라 건드리지 않았어요."
    };
  }

  const linkedSource = await findLinkedPathPart(source, origin, true);
  if (linkedSource) {
    return {
      status: "blocked-path",
      message: "연결된 경로가 섞여 있어서 건드리지 않았어요.",
      detail: linkedSource
    };
  }

  let sourceStat;
  try {
    sourceStat = await lstat(source);
  } catch {
    return {
      status: "not-found",
      message: "이미 사라진 시작 항목이라 끌 수 없어요."
    };
  }
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    return {
      status: "blocked-path",
      message: "일반 시작 파일이 아니라 건드리지 않았어요."
    };
  }

  const disabledAt = (options.now?.() ?? new Date()).toISOString();
  const disabledId = makeDisabledId(entry, new Date(disabledAt));
  const storedPath = storedPathFor(userDataDir, disabledId, source);
  const disabledEntry: StartupAutoDisabledEntry = {
    id: disabledId,
    entryId: entry.id,
    name: entry.name,
    originalPath: source,
    storedPath,
    origin,
    disabledAt
  };

  let movedToHoldingArea = false;
  try {
    await ensureManagedItemsRoot(userDataDir);
    await ensureSafeEntryWritePath(userDataDir, disabledId);
    await mkdir(dirname(storedPath), { recursive: true });
    const linkedStored = await findLinkedPathPart(storedPath, entryDir(userDataDir, disabledId), true);
    if (linkedStored) {
      return {
        status: "blocked-path",
        message: "보관 위치가 안전하지 않아 건드리지 않았어요.",
        detail: linkedStored
      };
    }
    if (await pathExists(storedPath)) {
      return {
        status: "target-exists",
        message: "보관 위치에 같은 항목이 이미 있어요. 먼저 보관함을 확인해주세요."
      };
    }
    await safeMove(source, storedPath);
    movedToHoldingArea = true;
    await writeFile(metaPath(userDataDir, disabledId), JSON.stringify(disabledEntry, null, 2), "utf8");
    return {
      status: "disabled",
      message: "이제 PC 켤 때 자동으로 같이 뜨지 않게 보관했어요. 필요하면 언제든 되돌릴 수 있어요.",
      entry: disabledEntry
    };
  } catch (err) {
    if (movedToHoldingArea && (await pathExists(storedPath)) && !(await pathExists(source))) {
      await mkdir(dirname(source), { recursive: true }).catch(() => {});
      await safeMove(storedPath, source).catch(() => {});
      await rm(entryDir(userDataDir, disabledId), { recursive: true, force: true }).catch(() => {});
    }
    return {
      status: "failed",
      message: "시작 항목을 끄는 중 문제가 생겼어요. 파일은 그대로 두려고 멈췄어요.",
      detail: (err as Error).message
    };
  }
}

export async function restoreStartupFolderEntry(
  options: RestoreStartupFolderEntryOptions
): Promise<StartupFolderToggleResult> {
  const { userDataDir, disabledId } = options;
  if (!isSafeStartupDisabledId(disabledId)) {
    return {
      status: "not-found",
      message: "되돌릴 항목을 찾지 못했어요."
    };
  }

  const entry = await readDisabledEntry(userDataDir, disabledId);
  if (!entry) {
    return {
      status: "not-found",
      message: "되돌릴 항목을 찾지 못했어요."
    };
  }

  const dir = entryDir(userDataDir, disabledId);
  if (!isUnderRoot(entry.storedPath, dir) || !isUnderRoot(entry.originalPath, entry.origin)) {
    return {
      status: "blocked-path",
      message: "보관 기록의 경로가 안전하지 않아 되돌리지 않았어요.",
      entry
    };
  }
  const linkedStored = await findLinkedPathPart(entry.storedPath, dir, true);
  if (linkedStored) {
    return {
      status: "blocked-path",
      message: "보관된 위치가 안전하지 않아 되돌리지 않았어요.",
      detail: linkedStored,
      entry
    };
  }
  if (!(await pathExists(entry.storedPath))) {
    return {
      status: "missing-stored-item",
      message: "보관된 파일을 찾지 못했어요.",
      entry
    };
  }
  if (await pathExists(entry.originalPath)) {
    return {
      status: "target-exists",
      message: "원래 위치에 같은 이름이 이미 있어요. 덮어쓰지 않았어요.",
      entry
    };
  }

  const linkedParent = await findLinkedPathPart(dirname(entry.originalPath), entry.origin, true);
  if (linkedParent) {
    return {
      status: "blocked-path",
      message: "원래 위치에 연결된 경로가 있어 되돌리지 않았어요.",
      detail: linkedParent,
      entry
    };
  }

  try {
    await mkdir(dirname(entry.originalPath), { recursive: true });
    await safeMove(entry.storedPath, entry.originalPath);
    await rm(dir, { recursive: true, force: true });
    return {
      status: "restored",
      message: "다시 PC 켤 때 같이 뜨도록 되돌렸어요.",
      entry
    };
  } catch (err) {
    return {
      status: "failed",
      message: "되돌리는 중 문제가 생겼어요.",
      detail: (err as Error).message,
      entry
    };
  }
}

export const __testing = {
  STARTUP_DISABLED_DIR,
  ITEMS_DIR,
  META_FILE,
  isUnderRoot,
  isSafeStartupDisabledId,
  coerceDisabledEntry
};
