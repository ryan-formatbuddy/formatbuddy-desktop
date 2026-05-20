import { describe, expect, it } from "vitest";
import { normalizeStartupFolderRestoreRequest } from "../src/main/startup/folderToggleRequestPolicy";

describe("startup folder restore request policy", () => {
  it("keeps a safe disabled startup id", () => {
    expect(
      normalizeStartupFolderRestoreRequest({ disabledId: "a1b2c3d4e5f6" })
    ).toEqual({ disabledId: "a1b2c3d4e5f6" });
  });

  it("clears missing or non-string disabled startup ids", () => {
    expect(normalizeStartupFolderRestoreRequest(undefined)).toEqual({ disabledId: "" });
    expect(normalizeStartupFolderRestoreRequest({ disabledId: 123 })).toEqual({ disabledId: "" });
    expect(normalizeStartupFolderRestoreRequest({})).toEqual({ disabledId: "" });
  });

  it("clears path-like, whitespace, and control-character ids", () => {
    const unsafeIds = [
      "../outside",
      "startup/id",
      "startup\\id",
      " startup",
      "startup ",
      "start up",
      "startup\nid",
      ".",
      ".."
    ];

    for (const disabledId of unsafeIds) {
      expect(normalizeStartupFolderRestoreRequest({ disabledId })).toEqual({
        disabledId: ""
      });
    }
  });
});
