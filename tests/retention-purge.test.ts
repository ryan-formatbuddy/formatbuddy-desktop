import { describe, expect, it, vi } from "vitest";
import {
  buildRetentionPurgeAuditNotice,
  RETENTION_PURGE_INTERVAL_MS,
  runRetentionPurgeTick
} from "../src/main/retentionPurge";
import type {
  CleanupTrashPurgeResult,
  RegistryBackupPurgeResult,
  ScheduledTaskBackupPurgeResult,
  StartupDisabledPurgeResult
} from "../src/shared/types";

describe("retention purge scheduler", () => {
  it("purges file trash and app deletion backups on the scheduled tick", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 2,
      purgedBytes: 1024,
      purgedEntryIds: ["trash-a", "trash-b"],
      retentionDays: 30
    }));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 512,
      purgedIds: ["reg-a"],
      retentionDays: 30
    }));
    const logInfo = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      logInfo
    });

    expect(RETENTION_PURGE_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(purgeTrash).toHaveBeenCalledWith("scheduled");
    expect(purgeRegistryBackups).toHaveBeenCalledWith("scheduled");
    expect(result.failed).toEqual([]);
    expect(result.trash?.purgedCount).toBe(2);
    expect(result.registryBackups?.purgedCount).toBe(1);
    expect(logInfo).toHaveBeenCalledWith("30일 자동 비움: 파일 2개, 앱 삭제 흔적 백업 1개");
  });

  it("keeps purging registry backups even if file trash purge fails", async () => {
    const purgeTrash = vi.fn(async () => {
      throw new Error("trash unavailable");
    });
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 512,
      purgedIds: ["reg-a"],
      retentionDays: 30
    }));
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      logWarn
    });

    expect(purgeTrash).toHaveBeenCalledWith("scheduled");
    expect(purgeRegistryBackups).toHaveBeenCalledWith("scheduled");
    expect(result.trash).toBeUndefined();
    expect(result.registryBackups?.purgedCount).toBe(1);
    expect(result.failed).toEqual([
      {
        kind: "trash",
        message: "파일 복구함을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
      }
    ]);
    expect(logWarn).toHaveBeenCalledWith("30일 자동 비움 파일 복구함 실패: trash unavailable");
  });

  it("sanitizes thrown purge errors before returning warning messages", async () => {
    const purgeTrash = vi.fn(async () => {
      throw new Error("trash\nunavailable\0");
    });
    const purgeRegistryBackups = vi.fn(async () => {
      throw new Error("registry\tbad\rmessage");
    });
    const purgeStartupDisabled = vi.fn(async () => {
      throw new Error("startup\nbad");
    });
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeStartupDisabled,
      logWarn
    });

    expect(result.failed).toEqual([
      {
        kind: "trash",
        message: "파일 복구함을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
      },
      {
        kind: "registry-backups",
        message: "앱 삭제 흔적 백업을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
      },
      {
        kind: "startup-disabled",
        message: "잠시 꺼둔 시작 항목을 지금 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요."
      }
    ]);
    expect(logWarn).toHaveBeenCalledWith("30일 자동 비움 파일 복구함 실패: trash unavailable");
    expect(logWarn).toHaveBeenCalledWith(
      "30일 자동 비움 앱 삭제 흔적 백업 실패: registry bad message"
    );
    expect(logWarn).toHaveBeenCalledWith(
      "30일 자동 비움 잠시 꺼둔 시작 항목 실패: startup bad"
    );
  });

  it("does not return raw local paths when an automatic emptying bucket fails", async () => {
    const purgeTrash = vi.fn(async () => {
      throw new Error("EPERM C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\formatbuddy-trash");
    });
    const purgeRegistryBackups = vi.fn(async () => {
      throw new Error("EACCES C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\formatbuddy-registry-backups");
    });
    const purgeStartupDisabled = vi.fn(async () => {
      throw new Error("ENOENT C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\formatbuddy-startup-disabled");
    });

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeStartupDisabled
    });

    const returnedMessages = result.failed.map((item) => item.message).join("\n");
    expect(returnedMessages).not.toContain("C:\\Users");
    expect(returnedMessages).not.toContain("EPERM");
    expect(returnedMessages).toContain("다음 자동 비움 때 다시 시도할게요");
  });

  it("records a warning when only some expired restore-bin items could not be emptied", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 256,
      purgedEntryIds: ["trash-ok"],
      failedEntryIds: ["trash-busy", "trash-locked"],
      retentionDays: 30
    }));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: 30
    }));
    const logInfo = vi.fn();
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      logInfo,
      logWarn
    });

    expect(result.failed).toEqual([
      { kind: "trash", message: "파일 복구함 2개를 아직 비우지 못했어요." }
    ]);
    expect(logWarn).toHaveBeenCalledWith("30일 자동 비움 파일 복구함 일부 실패: 2개");
    expect(logInfo).toHaveBeenCalledWith("30일 자동 비움: 파일 1개, 앱 삭제 흔적 백업 0개");
  });

  it("records a warning when only some expired app deletion backups could not be emptied", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedEntryIds: [],
      retentionDays: 30
    }));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 128,
      purgedIds: ["reg-ok"],
      failedIds: ["reg-busy"],
      retentionDays: 30
    }));
    const logInfo = vi.fn();
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      logInfo,
      logWarn
    });

    expect(result.failed).toEqual([
      { kind: "registry-backups", message: "앱 삭제 흔적 백업 1개를 아직 비우지 못했어요." }
    ]);
    expect(logWarn).toHaveBeenCalledWith("30일 자동 비움 앱 삭제 흔적 백업 일부 실패: 1개");
    expect(logInfo).toHaveBeenCalledWith("30일 자동 비움: 파일 0개, 앱 삭제 흔적 백업 1개");
  });

  it("purges disabled startup items when the app retention tick provides that bin", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedEntryIds: [],
      retentionDays: 30
    }));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: 30
    }));
    const purgeStartupDisabled = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 7,
      purgedIds: ["startup-a"],
      retentionDays: 30
    }));
    const logInfo = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeStartupDisabled,
      logInfo
    });

    expect(purgeStartupDisabled).toHaveBeenCalledWith("scheduled");
    expect(result.failed).toEqual([]);
    expect(result.startupDisabled?.purgedCount).toBe(1);
    expect(result.startupDisabled?.purgedBytes).toBe(7);
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 0개, 앱 삭제 흔적 백업 0개, 잠시 꺼둔 시작 항목 1개"
    );
  });

  it("purges scheduled task backups when the app retention tick provides that bin", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedEntryIds: [],
      retentionDays: 30
    }));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: 30
    }));
    const purgeScheduledTaskBackups = vi.fn(async () => ({
      purgedCount: 1,
      purgedBytes: 64,
      purgedIds: ["task-a"],
      retentionDays: 30
    }));
    const logInfo = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeScheduledTaskBackups,
      logInfo
    });

    expect(purgeScheduledTaskBackups).toHaveBeenCalledWith("scheduled");
    expect(result.failed).toEqual([]);
    expect(result.scheduledTaskBackups?.purgedCount).toBe(1);
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 0개, 앱 삭제 흔적 백업 0개, 예약 작업 백업 1개"
    );
  });

  it("normalizes malformed purge results before logging counts", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 999,
      purgedBytes: Number.NaN,
      purgedEntryIds: ["trash-ok"],
      failedEntryIds: ["trash-busy"],
      retentionDays: -1
    } as unknown as CleanupTrashPurgeResult));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: -4,
      purgedBytes: Number.POSITIVE_INFINITY,
      purgedIds: ["reg-ok"],
      purgedItems: [
        { id: "reg-ok", label: "Acme\tNotes", backupKind: "startup-value", sizeBytes: 123 },
        { id: "reg-bad-kind", label: "Bad", backupKind: "unknown", sizeBytes: 1 }
      ],
      failedIds: ["reg-busy"],
      retentionDays: Number.NaN
    } as unknown as RegistryBackupPurgeResult));
    const purgeStartupDisabled = vi.fn(async () => ({
      purgedCount: Number.NaN,
      purgedIds: ["startup-ok"],
      purgedItems: [
        { id: "startup-ok", label: "KakaoTalk\n.lnk", sizeBytes: 7 },
        { id: "startup/unsafe", label: "Bad", sizeBytes: 1 }
      ],
      failedIds: ["startup-busy"],
      retentionDays: 0
    } as unknown as StartupDisabledPurgeResult));
    const purgeScheduledTaskBackups = vi.fn(async () => ({
      purgedCount: Number.NaN,
      purgedBytes: Number.POSITIVE_INFINITY,
      purgedIds: ["task-ok"],
      purgedItems: [
        { id: "task-ok", label: "Acme\nUpdate", sizeBytes: 9 },
        { id: "task/unsafe", label: "Bad", sizeBytes: 1 }
      ],
      failedIds: ["task-busy"],
      retentionDays: 0
    } as unknown as ScheduledTaskBackupPurgeResult));
    const logInfo = vi.fn();
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeStartupDisabled,
      purgeScheduledTaskBackups,
      logInfo,
      logWarn
    });

    expect(result.trash).toMatchObject({
      purgedCount: 1,
      purgedBytes: 0,
      purgedEntryIds: ["trash-ok"],
      failedEntryIds: ["trash-busy"],
      retentionDays: 30
    });
    expect(result.registryBackups).toMatchObject({
      purgedCount: 1,
      purgedBytes: 0,
      purgedIds: ["reg-ok"],
      purgedItems: [
        { id: "reg-ok", label: "Acme Notes", backupKind: "startup-value", sizeBytes: 123 }
      ],
      failedIds: ["reg-busy"],
      retentionDays: 30
    });
    expect(result.startupDisabled).toMatchObject({
      purgedCount: 1,
      purgedBytes: 0,
      purgedIds: ["startup-ok"],
      purgedItems: [
        { id: "startup-ok", label: "KakaoTalk .lnk", sizeBytes: 7 }
      ],
      failedIds: ["startup-busy"],
      retentionDays: 30
    });
    expect(result.scheduledTaskBackups).toMatchObject({
      purgedCount: 1,
      purgedBytes: 0,
      purgedIds: ["task-ok"],
      purgedItems: [
        { id: "task-ok", label: "Acme Update", sizeBytes: 9 }
      ],
      failedIds: ["task-busy"],
      retentionDays: 30
    });
    expect(result.failed).toEqual([
      { kind: "trash", message: "파일 복구함 1개를 아직 비우지 못했어요." },
      { kind: "registry-backups", message: "앱 삭제 흔적 백업 1개를 아직 비우지 못했어요." },
      { kind: "startup-disabled", message: "잠시 꺼둔 시작 항목 1개를 아직 비우지 못했어요." },
      { kind: "scheduled-task-backups", message: "예약 작업 백업 1개를 아직 비우지 못했어요." }
    ]);
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 1개, 앱 삭제 흔적 백업 1개, 잠시 꺼둔 시작 항목 1개, 예약 작업 백업 1개"
    );
  });

  it("drops unsafe purge result ids before counting and logging failures", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 6,
      purgedBytes: 42,
      purgedEntryIds: ["trash-ok", "trash-ok", "../trash", "trash\\path", ".", ".."],
      purgedItems: [
        { id: "trash-ok", label: "old\ncache.tmp", categoryId: "temp-user", sizeBytes: 42 },
        { id: "trash-bad-category", label: "bad category", categoryId: "unknown", sizeBytes: 42 },
        { id: "../trash", label: "bad", categoryId: "temp-user", sizeBytes: 7 },
        { id: "trash-ok", label: "duplicate", categoryId: "temp-user", sizeBytes: 1 }
      ],
      failedEntryIds: ["trash-busy", "trash/bad", " trash-padded"],
      retentionDays: 30
    } as unknown as CleanupTrashPurgeResult));
    const purgeRegistryBackups = vi.fn(async () => ({
      purgedCount: 4,
      purgedBytes: 9,
      purgedIds: ["reg-ok", "reg/path", ".."],
      failedIds: ["reg-busy", "reg\\bad"],
      retentionDays: 30
    } as unknown as RegistryBackupPurgeResult));
    const purgeStartupDisabled = vi.fn(async () => ({
      purgedCount: 4,
      purgedBytes: 17,
      purgedIds: ["startup-ok", "startup/path", "."],
      failedIds: ["startup-busy", "startup\\bad"],
      retentionDays: 30
    } as unknown as StartupDisabledPurgeResult));
    const logInfo = vi.fn();
    const logWarn = vi.fn();

    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash,
      purgeRegistryBackups,
      purgeStartupDisabled,
      logInfo,
      logWarn
    });

    expect(result.trash?.purgedEntryIds).toEqual(["trash-ok"]);
    expect(result.trash?.purgedItems).toEqual([
      { id: "trash-ok", label: "old cache.tmp", categoryId: "temp-user", sizeBytes: 42 }
    ]);
    expect(result.trash?.failedEntryIds).toEqual(["trash-busy"]);
    expect(result.registryBackups?.purgedIds).toEqual(["reg-ok"]);
    expect(result.registryBackups?.failedIds).toEqual(["reg-busy"]);
    expect(result.startupDisabled?.purgedIds).toEqual(["startup-ok"]);
    expect(result.startupDisabled?.purgedBytes).toBe(17);
    expect(result.startupDisabled?.failedIds).toEqual(["startup-busy"]);
    expect(result.failed).toEqual([
      { kind: "trash", message: "파일 복구함 1개를 아직 비우지 못했어요." },
      { kind: "registry-backups", message: "앱 삭제 흔적 백업 1개를 아직 비우지 못했어요." },
      { kind: "startup-disabled", message: "잠시 꺼둔 시작 항목 1개를 아직 비우지 못했어요." }
    ]);
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 1개, 앱 삭제 흔적 백업 1개, 잠시 꺼둔 시작 항목 1개"
    );
  });

  it("builds a user-facing audit notice when a restore-bin bucket could not be checked", async () => {
    const result = await runRetentionPurgeTick({
      trigger: "startup",
      purgeTrash: vi.fn(async () => {
        throw new Error("EPERM C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\formatbuddy-trash");
      }),
      purgeRegistryBackups: vi.fn(async () => ({
        purgedCount: 0,
        purgedBytes: 0,
        purgedIds: [],
        failedIds: ["reg-busy"],
        retentionDays: 30
      })),
      purgeStartupDisabled: vi.fn(async () => ({
        purgedCount: 0,
        purgedBytes: 0,
        purgedIds: [],
        retentionDays: 30
      }))
    });

    const notice = buildRetentionPurgeAuditNotice(result, "startup");

    expect(notice).toEqual({
      action: "restore-bin-expired-purge-failed-startup",
      summary: "30일 복구함 자동 비움에서 파일 복구함을 확인하지 못했어요. 다음 자동 비움 때 다시 시도할게요.",
      detail: {
        trigger: "startup",
        failedKinds: ["trash"],
        failedBucketCount: 1,
        retentionDays: 30
      }
    });
    expect(notice?.summary).not.toContain("C:\\Users");
    expect(notice?.summary).not.toContain("EPERM");
  });

  it("does not create a bucket-level audit notice for partial item failures", async () => {
    const result = await runRetentionPurgeTick({
      trigger: "scheduled",
      purgeTrash: vi.fn(async () => ({
        purgedCount: 0,
        purgedBytes: 0,
        purgedEntryIds: [],
        failedEntryIds: ["trash-busy"],
        retentionDays: 30
      })),
      purgeRegistryBackups: vi.fn(async () => ({
        purgedCount: 0,
        purgedBytes: 0,
        purgedIds: [],
        retentionDays: 30
      }))
    });

    expect(buildRetentionPurgeAuditNotice(result, "scheduled")).toBeNull();
  });
});
