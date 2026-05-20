import { describe, expect, it, vi } from "vitest";
import {
  RETENTION_PURGE_INTERVAL_MS,
  runRetentionPurgeTick
} from "../src/main/retentionPurge";
import type {
  CleanupTrashPurgeResult,
  RegistryBackupPurgeResult,
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
    expect(result.failed).toEqual([{ kind: "trash", message: "trash unavailable" }]);
    expect(logWarn).toHaveBeenCalledWith("30일 자동 비움 파일 복구함 실패: trash unavailable");
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
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 0개, 앱 삭제 흔적 백업 0개, 잠시 꺼둔 시작 항목 1개"
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
      failedIds: ["reg-busy"],
      retentionDays: Number.NaN
    } as unknown as RegistryBackupPurgeResult));
    const purgeStartupDisabled = vi.fn(async () => ({
      purgedCount: Number.NaN,
      purgedIds: ["startup-ok"],
      failedIds: ["startup-busy"],
      retentionDays: 0
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
      failedIds: ["reg-busy"],
      retentionDays: 30
    });
    expect(result.startupDisabled).toMatchObject({
      purgedCount: 1,
      purgedIds: ["startup-ok"],
      failedIds: ["startup-busy"],
      retentionDays: 30
    });
    expect(result.failed).toEqual([
      { kind: "trash", message: "파일 복구함 1개를 아직 비우지 못했어요." },
      { kind: "registry-backups", message: "앱 삭제 흔적 백업 1개를 아직 비우지 못했어요." },
      { kind: "startup-disabled", message: "잠시 꺼둔 시작 항목 1개를 아직 비우지 못했어요." }
    ]);
    expect(logInfo).toHaveBeenCalledWith(
      "30일 자동 비움: 파일 1개, 앱 삭제 흔적 백업 1개, 잠시 꺼둔 시작 항목 1개"
    );
  });

  it("drops unsafe purge result ids before counting and logging failures", async () => {
    const purgeTrash = vi.fn(async () => ({
      purgedCount: 6,
      purgedBytes: 42,
      purgedEntryIds: ["trash-ok", "trash-ok", "../trash", "trash\\path", ".", ".."],
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
    expect(result.trash?.failedEntryIds).toEqual(["trash-busy"]);
    expect(result.registryBackups?.purgedIds).toEqual(["reg-ok"]);
    expect(result.registryBackups?.failedIds).toEqual(["reg-busy"]);
    expect(result.startupDisabled?.purgedIds).toEqual(["startup-ok"]);
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
});
