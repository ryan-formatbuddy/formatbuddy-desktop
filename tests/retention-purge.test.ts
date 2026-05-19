import { describe, expect, it, vi } from "vitest";
import {
  RETENTION_PURGE_INTERVAL_MS,
  runRetentionPurgeTick
} from "../src/main/retentionPurge";

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
});
