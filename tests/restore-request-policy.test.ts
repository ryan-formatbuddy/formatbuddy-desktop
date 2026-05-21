import { describe, expect, it } from "vitest";
import {
  normalizeCleanupTrashRestoreRequest,
  normalizeRegistryBackupRestoreRequest,
  normalizeScheduledTaskBackupRestoreRequest
} from "../src/main/cleanup/restoreRequestPolicy";

describe("restore request policy", () => {
  it("keeps valid cleanup trash restore ids", () => {
    expect(normalizeCleanupTrashRestoreRequest({ entryId: "trash-1" })).toEqual({
      entryId: "trash-1"
    });
  });

  it("normalizes malformed cleanup trash restore requests to a blocked id", () => {
    expect(normalizeCleanupTrashRestoreRequest(undefined)).toEqual({ entryId: "" });
    expect(normalizeCleanupTrashRestoreRequest({ entryId: 123 })).toEqual({ entryId: "" });
  });

  it("blocks unsafe cleanup trash restore ids at the request boundary", () => {
    for (const entryId of [
      "../outside",
      "trash/id",
      "trash\\id",
      "  ",
      " trash-1",
      "trash-1 ",
      "trash 1",
      "trash\nid"
    ]) {
      expect(normalizeCleanupTrashRestoreRequest({ entryId })).toEqual({ entryId: "" });
    }
  });

  it("keeps valid registry backup restore ids", () => {
    expect(normalizeRegistryBackupRestoreRequest({ backupId: "registry-1" })).toEqual({
      backupId: "registry-1"
    });
  });

  it("normalizes malformed registry backup restore requests to a blocked id", () => {
    expect(normalizeRegistryBackupRestoreRequest(null)).toEqual({ backupId: "" });
    expect(normalizeRegistryBackupRestoreRequest({ backupId: ["registry-1"] })).toEqual({
      backupId: ""
    });
  });

  it("blocks unsafe registry backup restore ids at the request boundary", () => {
    for (const backupId of [
      "../outside",
      "registry/id",
      "registry\\id",
      "  ",
      " registry-1",
      "registry-1 ",
      "registry 1",
      "registry\nid"
    ]) {
      expect(normalizeRegistryBackupRestoreRequest({ backupId })).toEqual({ backupId: "" });
    }
  });

  it("keeps valid scheduled task backup restore ids", () => {
    expect(normalizeScheduledTaskBackupRestoreRequest({ backupId: "scheduled-task-1" })).toEqual({
      backupId: "scheduled-task-1"
    });
  });

  it("blocks unsafe scheduled task backup restore ids at the request boundary", () => {
    for (const backupId of [
      "../outside",
      "scheduled/id",
      "scheduled\\id",
      "  ",
      " scheduled-task-1",
      "scheduled-task-1 ",
      "scheduled task 1",
      "scheduled\nid"
    ]) {
      expect(normalizeScheduledTaskBackupRestoreRequest({ backupId })).toEqual({ backupId: "" });
    }
  });
});
