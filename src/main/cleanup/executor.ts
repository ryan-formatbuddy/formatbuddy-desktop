/**
 * Cleanup executor — the only place that ever removes files from disk.
 *
 * Safety chain (every link must hold):
 *   1. consumePlan() validates planId + confirmationToken + blocklist
 *      version, then atomically removes the plan from cache so it can
 *      only run once.
 *   2. The selectedItemIds whitelist is applied — items the user did
 *      not explicitly check are skipped, not silently deleted.
 *   3. evaluatePath() runs again per item against the per-category
 *      allowRoots, so even a tampered plan (impossible in practice
 *      because of #1, but we re-check anyway) cannot reach a blocked
 *      path.
 *   4. Real removal goes through injected `trashItem` / `permanentRemove`
 *      so tests don't touch the host filesystem.
 *
 * Product IPC only allows "trash" mode. The internal permanent branch is
 * kept for lower-level tests and future maintenance tools, not user flows.
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  CleanupCategoryId,
  CleanupExecuteMode,
  CleanupExecuteRequest,
  CleanupExecuteResult,
  CleanupExecutedItem,
  CleanupItem,
  CleanupPlan,
  CleanupSkipReason,
  CleanupSkippedItem
} from "@shared/types";
import { evaluatePath } from "./blocklist";
import { buildLogEntry, recordCleanupExecution } from "./log";
import { findLinkedPathPart } from "./pathSafety";
import { consumePlan, peekPlan, RECYCLE_BIN_SENTINEL_PATH } from "./planner";
import {
  assertManagedTrashEntryManifest,
  findLinkedManagedTrashStoredPath,
  isManagedTrashEntryStoredPath,
  isManagedTrashStoredPath,
  isSafeTrashEntryId,
  moveToFormatBuddyTrash
} from "./trash";

const MAX_SIZE_SCAN_DEPTH = 32;

export interface ExecutorDeps {
  /** Move a path into FormatBuddy's app-managed 30-day restore bin. */
  trashItem: (
    item: CleanupItem,
    sizeBytes: number,
    context: { userDataDir: string; home?: string; now?: () => Date }
  ) => Promise<{ id: string; expiresAt: string; storedPath: string } | undefined>;
  /** Permanently delete a file or directory tree. */
  permanentRemove: (path: string) => Promise<void>;
  /** Stat a path on disk; returns null if missing. */
  statSize: (path: string) => Promise<number | null>;
  /**
   * Empty the Windows recycle bin. Returns void on success; throws to
   * surface a skip ("execute-failed") in the executor. Injected so
   * tests don't shell out to powershell.
   */
  emptyRecycleBin: () => Promise<void>;
}

export interface ExecuteCleanupOptions {
  userDataDir: string;
  deps: ExecutorDeps;
  home?: string;
  /** Inject "now" for deterministic logs in tests. */
  now?: () => Date;
  /**
   * Product flows never set this. It exists only for controlled
   * maintenance tests/tools that deliberately need to exercise the
   * permanent branch.
   */
  allowPermanentForMaintenance?: boolean;
}

async function measurePathSize(path: string, depth = 0): Promise<number | null> {
  if (depth > MAX_SIZE_SCAN_DEPTH) return null;

  let stat;
  try {
    stat = await fs.lstat(path);
  } catch {
    return null;
  }

  if (stat.isSymbolicLink()) return null;
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;

  let entries;
  try {
    entries = await fs.readdir(path, { withFileTypes: true });
  } catch {
    return null;
  }

  let total = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink()) return null;
    const childSize = await measurePathSize(join(path, entry.name), depth + 1);
    if (childSize === null) return null;
    total += childSize;
  }
  return total;
}

/**
 * Default deps wired against electron.shell.trashItem and node:fs. Keep this
 * factory in this module (not at the call site) so tests can swap in mocks
 * by constructing their own deps object instead of monkey-patching electron.
 */
export function defaultDeps(userDataDir: string): ExecutorDeps {
  return {
    trashItem: (item, sizeBytes, context) =>
      moveToFormatBuddyTrash({
        userDataDir: context.userDataDir || userDataDir,
        item,
        sizeBytes,
        home: context.home,
        now: context.now
      }),
    permanentRemove: async (path) => {
      await fs.rm(path, { recursive: true, force: true });
    },
    statSize: async (path) => {
      return measurePathSize(path);
    },
    emptyRecycleBin: () =>
      new Promise<void>((resolve, reject) => {
        if (process.platform !== "win32") {
          reject(new Error("Recycle bin emptying is Windows-only"));
          return;
        }
        const child = spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
          ],
          { windowsHide: true }
        );
        let stderr = "";
        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
          if (stderr.length > 8192) stderr = stderr.slice(-8192);
        });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
          // Clear-RecycleBin returns 0 even when the bin was empty; a
          // non-zero exit usually means the user denied UAC or the
          // shell session lacked privileges. Pass stderr along so the
          // skip detail is actionable.
          if (code === 0) resolve();
          else reject(new Error(`Clear-RecycleBin exited ${code}: ${stderr.slice(0, 300)}`));
        });
      })
  };
}

function collectAllowRootsByCategory(plan: CleanupPlan): Map<CleanupCategoryId, string[]> {
  // Re-derive allow-roots from the plan: for each item, the directory
  // chain leading up to it. Simplest correct rule = the path itself
  // (so executor's evaluatePath uses a single-root whitelist that
  // covers exactly the file being removed). This makes the second
  // blocklist pass equivalent to "is this path itself safe to touch".
  const map = new Map<CleanupCategoryId, string[]>();
  for (const category of plan.categories) {
    const roots = new Set<string>();
    for (const item of category.items) roots.add(item.path);
    map.set(category.id, Array.from(roots));
  }
  return map;
}

function buildItemIndex(plan: CleanupPlan): Map<string, CleanupItem> {
  const idx = new Map<string, CleanupItem>();
  for (const category of plan.categories) {
    for (const item of category.items) idx.set(item.id, item);
  }
  return idx;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTrimmedString(value: string): boolean {
  return value.trim() === value;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function isValidIsoDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

interface AttemptOutcome {
  removed?: CleanupExecutedItem;
  skipped?: CleanupSkippedItem;
}

async function validateLivePath(
  item: CleanupItem,
  home: string
): Promise<CleanupSkippedItem | undefined> {
  // Re-check the blocklist against just this path. We pass the path
  // itself as its sole allow-root: combined with the system + user
  // rule set, this catches both "the path looks safe" and "the path
  // tries to escape its category" cases.
  const decision = evaluatePath(item.path, { allowRoots: [item.path], home });
  if (!decision.allowed) {
    return {
      itemId: item.id,
      path: item.path,
      reason: "blocked-path",
      detail: decision.blockedBy
    };
  }

  const linkedSource = await findLinkedPathPart(item.path, home, true);
  if (linkedSource) {
    return {
      itemId: item.id,
      path: item.path,
      reason: "blocked-path",
      detail: `링크 경로라 자동 정리하지 않아요: ${linkedSource}`
    };
  }

  return undefined;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function attemptItem(
  item: CleanupItem,
  mode: CleanupExecuteMode,
  deps: ExecutorDeps,
  home: string,
  context: { userDataDir: string; home?: string; now?: () => Date }
): Promise<AttemptOutcome> {
  // Recycle-bin sentinel bypass: this item is a virtual entry, not a
  // real filesystem path that FormatBuddy can move into its own 30-day
  // restore bin. Older cached plans may still contain it as selectable,
  // so refuse it here too and never route to Clear-RecycleBin.
  if (
    item.categoryId === "recycle-bin" &&
    item.path === RECYCLE_BIN_SENTINEL_PATH
  ) {
    return {
      skipped: {
        itemId: item.id,
        path: item.path,
        reason: "blocked-path",
        detail: "Windows 휴지통은 포맷버디 30일 복구함으로 옮길 수 없어 직접 확인만 안내해요."
      }
    };
  }

  const preMeasureSkip = await validateLivePath(item, home);
  if (preMeasureSkip) return { skipped: preMeasureSkip };

  let actualSize = item.sizeBytes;
  const measured = await deps.statSize(item.path);
  if (measured === null) {
    return {
      skipped: { itemId: item.id, path: item.path, reason: "not-found" }
    };
  }
  actualSize = Math.max(0, measured);

  const preRemoveSkip = await validateLivePath(item, home);
  if (preRemoveSkip) return { skipped: preRemoveSkip };

  try {
    const trashEntry = mode === "trash" ? await deps.trashItem(item, actualSize, context) : undefined;
    if (mode === "trash") {
      if (!trashEntry?.id) {
        throw new Error("FormatBuddy restore entry was not created");
      }
      if (!isSafeTrashEntryId(trashEntry.id)) {
        throw new Error("FormatBuddy restore entry id is not safe");
      }
      if (!isValidIsoDateString(trashEntry.expiresAt)) {
        throw new Error("FormatBuddy restore expiry was not created");
      }
    }
    if (mode === "permanent") await deps.permanentRemove(item.path);
    if (await pathExists(item.path)) {
      throw new Error("Source path still exists after cleanup");
    }
    if (mode === "trash") {
      if (!isNonEmptyString(trashEntry?.storedPath) || !(await pathExists(trashEntry.storedPath))) {
        throw new Error("FormatBuddy stored trash path was not created");
      }
      if (!isManagedTrashStoredPath(context.userDataDir, trashEntry.storedPath)) {
        throw new Error("FormatBuddy stored trash path is outside the managed restore bin");
      }
      if (!isManagedTrashEntryStoredPath(context.userDataDir, trashEntry.id, trashEntry.storedPath)) {
        throw new Error("FormatBuddy stored trash path is outside the restore entry folder");
      }
      const linkedStoredPath = await findLinkedManagedTrashStoredPath(
        context.userDataDir,
        trashEntry.id,
        trashEntry.storedPath
      );
      if (linkedStoredPath) {
        throw new Error(`FormatBuddy stored trash path contains a link: ${linkedStoredPath}`);
      }
      await assertManagedTrashEntryManifest({
        userDataDir: context.userDataDir,
        entryId: trashEntry.id,
        itemId: item.id,
        categoryId: item.categoryId,
        sizeBytes: actualSize,
        originalPath: item.path,
        storedPath: trashEntry.storedPath,
        expiresAt: trashEntry.expiresAt,
        now: context.now
      });
    }
    return {
      removed: {
        itemId: item.id,
        path: item.path,
        sizeBytes: actualSize,
        categoryId: item.categoryId,
        mode,
        succeeded: true,
        trashEntryId: trashEntry?.id,
        expiresAt: trashEntry?.expiresAt
      }
    };
  } catch (err) {
    return {
      skipped: {
        itemId: item.id,
        path: item.path,
        reason: "execute-failed",
        detail: (err as Error).message
      }
    };
  }

}

export async function executeCleanup(
  request: CleanupExecuteRequest,
  options: ExecuteCleanupOptions
): Promise<CleanupExecuteResult> {
  if (!isNonEmptyString(request?.planId) || !isNonEmptyString(request?.confirmationToken)) {
    throw new Error("cleanup:execute requires planId and confirmationToken");
  }
  if (!isTrimmedString(request.planId) || !isTrimmedString(request.confirmationToken)) {
    throw new Error("cleanup:execute requires planId and confirmationToken without whitespace padding");
  }
  if (!Array.isArray(request.selectedItemIds) || request.selectedItemIds.length === 0) {
    throw new Error("cleanup:execute requires at least one selected item");
  }
  if (!request.selectedItemIds.every(isNonEmptyString)) {
    throw new Error("cleanup:execute requires selectedItemIds to contain only strings");
  }
  if (!request.selectedItemIds.every(isTrimmedString)) {
    throw new Error("cleanup:execute requires selectedItemIds without whitespace padding");
  }
  if (hasDuplicates(request.selectedItemIds)) {
    throw new Error("cleanup:execute requires selectedItemIds to be unique without duplicates");
  }
  if (request.mode !== "trash" && request.mode !== "permanent") {
    throw new Error(`cleanup:execute received invalid mode ${request.mode}`);
  }
  if (request.mode === "permanent" && !options.allowPermanentForMaintenance) {
    throw new Error("cleanup:execute permanent mode is blocked. 포맷버디 정리는 30일 복구함으로만 보내요.");
  }

  const currentPlan = peekPlan(request.planId, request.confirmationToken, options.now);
  if (!currentPlan) {
    throw new Error("cleanup:execute could not match a current plan (expired, wrong token, or already executed)");
  }

  const currentItemIndex = buildItemIndex(currentPlan);
  const selectedIds = new Set(request.selectedItemIds);
  const unknownSelectionIds = Array.from(selectedIds).filter((id) => !currentItemIndex.has(id));
  if (unknownSelectionIds.length > 0) {
    throw new Error(
      `cleanup:execute selectedItemIds not present in the plan: ${unknownSelectionIds.join(", ")}`
    );
  }

  const plan = consumePlan(request.planId, request.confirmationToken, options.now);
  if (!plan) {
    throw new Error("cleanup:execute could not match a current plan (expired, wrong token, or already executed)");
  }

  const home = options.home ?? homedir();
  const itemIndex = currentItemIndex;
  // collectAllowRootsByCategory currently informs nothing inside the
  // attempt loop (we now whitelist per-path), but keep it around so
  // a future relaxed mode (e.g. "trash a whole category") has the
  // structured root list to start from.
  void collectAllowRootsByCategory(plan);

  const removedItems: CleanupExecutedItem[] = [];
  const skippedItems: CleanupSkippedItem[] = [];

  for (const id of selectedIds) {
    const item = itemIndex.get(id);
    if (!item) continue;
    const outcome = await attemptItem(item, request.mode, options.deps, home, {
      userDataDir: options.userDataDir,
      home,
      now: options.now
    });
    if (outcome.removed) removedItems.push(outcome.removed);
    if (outcome.skipped) skippedItems.push(outcome.skipped);
  }

  // Items the user did not select are NOT auto-cleaned. We surface
  // them as `not-selected` only when they were in the plan but
  // intentionally left unchecked — useful for the post-run UI to
  // say "you skipped X items" without re-walking the disk.
  for (const category of plan.categories) {
    for (const item of category.items) {
      if (selectedIds.has(item.id)) continue;
      skippedItems.push({
        itemId: item.id,
        path: item.path,
        reason: "not-selected"
      });
    }
  }

  const executedAt = options.now?.().toISOString() ?? new Date().toISOString();
  const logEntry = buildLogEntry({
    mode: request.mode,
    executedAt,
    removedItems,
    skippedItems
  });
  const totalFreedBytes = logEntry.totalFreedBytes;

  await recordCleanupExecution(options.userDataDir, logEntry);

  return {
    planId: plan.planId,
    executedAt,
    mode: request.mode,
    totalFreedBytes,
    removedItems,
    skippedItems,
    logEntry
  };
}

export const __testing = {
  attemptItem,
  buildItemIndex,
  collectAllowRootsByCategory
};

// Re-export skip reasons enum-like helper for callers that want to
// pattern-match without importing the shared union.
export const SKIP_REASONS: CleanupSkipReason[] = [
  "blocked-path",
  "not-selected",
  "access-denied",
  "not-found",
  "below-min-age",
  "execute-failed"
];
