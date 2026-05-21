import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, promises as fs, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  backupAndDeleteScheduledTask,
  isScheduledTaskBackupPreservedError,
  listScheduledTaskBackups,
  purgeExpiredScheduledTaskBackups,
  restoreScheduledTaskBackup,
  type ScheduledTaskBackupRunner
} from "../src/main/startup/scheduledTaskBackup";

interface Fixture {
  root: string;
  userDataDir: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-task-backup-"));
  return {
    root,
    userDataDir: join(root, "userdata"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

function makeRunner(state = { exists: true }): ScheduledTaskBackupRunner {
  return {
    exportTask: vi.fn(async (_taskName, _taskPath, backupPath) => {
      await fs.mkdir(dirname(backupPath), { recursive: true });
      await fs.writeFile(
        backupPath,
        '<?xml version="1.0" encoding="UTF-16"?><Task version="1.4"></Task>',
        "utf8"
      );
    }),
    deleteTask: vi.fn(async () => {
      state.exists = false;
    }),
    restoreTask: vi.fn(async () => {
      state.exists = true;
    }),
    taskExists: vi.fn(async () => state.exists)
  };
}

describe("scheduled task backup", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("exports and deletes a scheduled task with a 30-day restorable backup", async () => {
    const runner = makeRunner();

    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner,
      app: { name: "Acme Notes", publisher: "Acme Corp." }
    });

    expect(backup).toMatchObject({
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      appName: "Acme Notes",
      appPublisher: "Acme Corp.",
      expiresAt: "2026-06-18T00:00:00.000Z",
      integrityStatus: "verified"
    });
    expect(runner.exportTask).toHaveBeenCalledWith(
      "Acme Notes Update",
      "\\Acme\\",
      expect.stringContaining("task.xml")
    );
    expect(runner.deleteTask).toHaveBeenCalledWith("Acme Notes Update", "\\Acme\\");

    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].id).toBe(backup.id);
  });

  it("restores a scheduled task from the backup and removes the backup item", async () => {
    const state = { exists: true };
    const runner = makeRunner(state);
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const result = await restoreScheduledTaskBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      now: () => new Date("2026-05-20T00:00:00.000Z"),
      runner
    });

    expect(result).toMatchObject({
      status: "restored",
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\"
    });
    expect(runner.restoreTask).toHaveBeenCalledWith(
      "Acme Notes Update",
      "\\Acme\\",
      expect.stringContaining("task.xml")
    );
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("does not report a scheduled task restore as finished when the backup item remains", async () => {
    const state = { exists: true };
    const runner = makeRunner(state);
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    const result = await restoreScheduledTaskBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      now: () => new Date("2026-05-20T00:00:00.000Z"),
      runner,
      removeEntryDir: async () => undefined
    });

    expect(result).toMatchObject({
      status: "restore-failed",
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\"
    });
    expect(result.message).toContain("아직");
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup.id]);
  });

  it("reports scheduled task restore success when backup item removal reports a late failure after deletion", async () => {
    const state = { exists: true };
    const runner = makeRunner(state);
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });
    const backupDir = join(fx.userDataDir, "formatbuddy-scheduled-task-backups", "items", backup.id);

    const result = await restoreScheduledTaskBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      now: () => new Date("2026-05-20T00:00:00.000Z"),
      runner,
      removeEntryDir: async (dir) => {
        await fs.rm(dir, { recursive: true, force: true });
        throw new Error("scheduled task restore entry remove reported a late failure");
      }
    });

    expect(result).toMatchObject({
      status: "restored",
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\"
    });
    expect(existsSync(backupDir)).toBe(false);
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("runs the safety hook only after a scheduled task backup is proven restorable", async () => {
    const state = { exists: true };
    const runner = makeRunner(state);
    const beforeRestore = vi.fn(async () => undefined);
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-19T00:00:00.000Z"),
      runner
    });

    await restoreScheduledTaskBackup({
      userDataDir: fx.userDataDir,
      backupId: backup.id,
      now: () => new Date("2026-05-20T00:00:00.000Z"),
      runner,
      beforeRestore
    });

    expect(beforeRestore).toHaveBeenCalledTimes(1);
    expect(beforeRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        id: backup.id,
        taskName: "Acme Notes Update",
        taskPath: "\\Acme\\"
      })
    );

    await restoreScheduledTaskBackup({
      userDataDir: fx.userDataDir,
      backupId: "missing-backup",
      now: () => new Date("2026-05-20T00:00:00.000Z"),
      runner,
      beforeRestore
    });

    expect(beforeRestore).toHaveBeenCalledTimes(1);
  });

  it("preserves the scheduled task backup when delete reports an error after the task disappeared", async () => {
    const state = { exists: true };
    const runner = makeRunner(state);
    vi.mocked(runner.deleteTask).mockImplementationOnce(async () => {
      state.exists = false;
      throw new Error("schtasks reported a late failure");
    });

    let thrown: unknown;
    try {
      await backupAndDeleteScheduledTask({
        userDataDir: fx.userDataDir,
        taskName: "Acme Notes Update",
        taskPath: "\\Acme\\",
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isScheduledTaskBackupPreservedError(thrown)).toBe(true);
    const backup = isScheduledTaskBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup?.id]);
  });

  it("preserves the scheduled task backup when delete reports an error and the task check is unavailable", async () => {
    const runner = makeRunner();
    if (!runner.taskExists) {
      throw new Error("test runner is missing taskExists");
    }
    vi.mocked(runner.deleteTask).mockRejectedValueOnce(
      new Error("schtasks reported a late failure")
    );
    vi.mocked(runner.taskExists).mockRejectedValueOnce(
      new Error("scheduled task check unavailable")
    );

    let thrown: unknown;
    try {
      await backupAndDeleteScheduledTask({
        userDataDir: fx.userDataDir,
        taskName: "Acme Notes Update",
        taskPath: "\\Acme\\",
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        runner
      });
    } catch (err) {
      thrown = err;
    }

    expect(isScheduledTaskBackupPreservedError(thrown)).toBe(true);
    const backup = isScheduledTaskBackupPreservedError(thrown) ? thrown.backup : null;
    expect(backup?.expiresAt).toBe("2026-06-18T00:00:00.000Z");
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([backup?.id]);
  });

  it("auto-purges expired scheduled task backups after 30 days", async () => {
    const runner = makeRunner();
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-01T00:00:00.000Z"),
      runner
    });

    const purged = await purgeExpiredScheduledTaskBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });

    expect(purged).toMatchObject({
      purgedCount: 1,
      purgedIds: [backup.id],
      retentionDays: 30
    });
    expect(purged.purgedBytes).toBeGreaterThan(0);
    const snapshot = await listScheduledTaskBackups({ userDataDir: fx.userDataDir });
    expect(snapshot.entries).toHaveLength(0);
  });

  it("counts an expired scheduled task backup as purged when folder removal reports a late failure after deletion", async () => {
    const runner = makeRunner();
    const backup = await backupAndDeleteScheduledTask({
      userDataDir: fx.userDataDir,
      taskName: "Acme Notes Update",
      taskPath: "\\Acme\\",
      now: () => new Date("2026-05-01T00:00:00.000Z"),
      runner
    });
    const backupDir = join(fx.userDataDir, "formatbuddy-scheduled-task-backups", "items", backup.id);

    const purged = await purgeExpiredScheduledTaskBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-01T00:00:00.000Z"),
      removeEntryDir: async (dir) => {
        await fs.rm(dir, { recursive: true, force: true });
        throw new Error("scheduled task backup remove reported a late failure");
      }
    });

    expect(purged.purgedCount).toBe(1);
    expect(purged.purgedIds).toEqual([backup.id]);
    expect(purged.failedIds).toBeUndefined();
    expect(existsSync(backupDir)).toBe(false);
  });

  it("removes a linked scheduled task backup root without touching the external target", async () => {
    const linkedRoot = join(fx.userDataDir, "formatbuddy-scheduled-task-backups", "items");
    const outside = join(fx.root, "outside-task-backups");
    await fs.mkdir(dirname(linkedRoot), { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(join(outside, "keep.xml"), "<Task></Task>", "utf8");
    symlinkSync(outside, linkedRoot, "dir");

    const purged = await purgeExpiredScheduledTaskBackups({
      userDataDir: fx.userDataDir,
      now: () => new Date("2026-06-01T00:00:00.000Z"),
      pruneNonRestorable: true
    });

    expect(purged).toMatchObject({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: 30
    });
    expect(existsSync(linkedRoot)).toBe(false);
    expect(existsSync(join(outside, "keep.xml"))).toBe(true);
  });

  it("blocks unsafe scheduled task metadata before exporting", async () => {
    const runner = makeRunner();

    await expect(
      backupAndDeleteScheduledTask({
        userDataDir: fx.userDataDir,
        taskName: "Bad | Task",
        taskPath: "\\Acme\\",
        runner
      })
    ).rejects.toThrow(/예약 작업 정보/);
    expect(runner.exportTask).not.toHaveBeenCalled();
    expect(runner.deleteTask).not.toHaveBeenCalled();
  });
});
