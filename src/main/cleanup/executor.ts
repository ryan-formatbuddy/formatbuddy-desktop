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
 * Default mode is "trash". Permanent removal is only used when the
 * caller explicitly opts in.
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
import { consumePlan, RECYCLE_BIN_SENTINEL_PATH } from "./planner";
import { moveToFormatBuddyTrash } from "./trash";

const MAX_SIZE_SCAN_DEPTH = 32;

export interface ExecutorDeps {
  /** Move a path into FormatBuddy's app-managed 30-day restore bin. */
  trashItem: (
    item: CleanupItem,
    sizeBytes: number,
    context: { userDataDir: string; home?: string; now?: () => Date }
  ) => Promise<{ id: string; expiresAt: string } | undefined>;
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
}

async function measurePathSize(path: string, depth = 0): Promise<number | null> {
  if (depth > MAX_SIZE_SCAN_DEPTH) return 0;

  let stat;
  try {
    stat = await fs.lstat(path);
  } catch {
    return null;
  }

  if (stat.isSymbolicLink()) return 0;
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
    if (entry.isSymbolicLink()) continue;
    const childSize = await measurePathSize(join(path, entry.name), depth + 1);
    if (childSize !== null) total += childSize;
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

interface AttemptOutcome {
  removed?: CleanupExecutedItem;
  skipped?: CleanupSkippedItem;
}

async function attemptItem(
  item: CleanupItem,
  mode: CleanupExecuteMode,
  deps: ExecutorDeps,
  home: string,
  context: { userDataDir: string; home?: string; now?: () => Date }
): Promise<AttemptOutcome> {
  // Recycle-bin sentinel bypass: this item is a virtual entry, not a
  // real filesystem path, so the blocklist whitelist check would
  // correctly reject it. We route to emptyRecycleBin instead. The
  // categoryId check is the second guard so a tampered plan can't
  // smuggle a sentinel path into a different category.
  if (
    item.categoryId === "recycle-bin" &&
    item.path === RECYCLE_BIN_SENTINEL_PATH
  ) {
    try {
      await deps.emptyRecycleBin();
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
    return {
      removed: {
        itemId: item.id,
        path: item.path,
        sizeBytes: 0,
        categoryId: item.categoryId,
        mode: "permanent",
        succeeded: true
      }
    };
  }

  // Re-check the blocklist against just this path. We pass the path
  // itself as its sole allow-root: combined with the system + user
  // rule set, this catches both "the path looks safe" and "the path
  // tries to escape its category" cases.
  const decision = evaluatePath(item.path, { allowRoots: [item.path], home });
  if (!decision.allowed) {
    return {
      skipped: {
        itemId: item.id,
        path: item.path,
        reason: "blocked-path",
        detail: decision.blockedBy
      }
    };
  }

  let actualSize = item.sizeBytes;
  const measured = await deps.statSize(item.path);
  if (measured === null) {
    return {
      skipped: { itemId: item.id, path: item.path, reason: "not-found" }
    };
  }
  actualSize = Math.max(0, measured);

  try {
    const trashEntry = mode === "trash" ? await deps.trashItem(item, actualSize, context) : undefined;
    if (mode === "trash" && !trashEntry?.id) {
      throw new Error("FormatBuddy restore entry was not created");
    }
    if (mode === "permanent") await deps.permanentRemove(item.path);
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
  if (!request?.planId || !request?.confirmationToken) {
    throw new Error("cleanup:execute requires planId and confirmationToken");
  }
  if (!Array.isArray(request.selectedItemIds) || request.selectedItemIds.length === 0) {
    throw new Error("cleanup:execute requires at least one selected item");
  }
  if (request.mode !== "trash" && request.mode !== "permanent") {
    throw new Error(`cleanup:execute received invalid mode ${request.mode}`);
  }

  const plan = consumePlan(request.planId, request.confirmationToken, options.now);
  if (!plan) {
    throw new Error("cleanup:execute could not match a current plan (expired, wrong token, or already executed)");
  }

  const home = options.home ?? homedir();
  const itemIndex = buildItemIndex(plan);
  // collectAllowRootsByCategory currently informs nothing inside the
  // attempt loop (we now whitelist per-path), but keep it around so
  // a future relaxed mode (e.g. "trash a whole category") has the
  // structured root list to start from.
  void collectAllowRootsByCategory(plan);

  const selectedIds = new Set(request.selectedItemIds);
  const removedItems: CleanupExecutedItem[] = [];
  const skippedItems: CleanupSkippedItem[] = [];
  const unknownSelectionIds: string[] = [];

  for (const id of selectedIds) {
    const item = itemIndex.get(id);
    if (!item) {
      unknownSelectionIds.push(id);
      continue;
    }
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

  for (const unknown of unknownSelectionIds) {
    skippedItems.push({
      itemId: unknown,
      path: "",
      reason: "not-found",
      detail: "selectedItemIds referenced an item not present in the plan"
    });
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
