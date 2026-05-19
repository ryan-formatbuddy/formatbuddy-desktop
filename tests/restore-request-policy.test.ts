import { describe, expect, it } from "vitest";
import {
  normalizeCleanupTrashRestoreRequest,
  normalizeRegistryBackupRestoreRequest
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
});
