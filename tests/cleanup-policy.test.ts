import { describe, expect, it } from "vitest";
import { enforceProductCleanupPolicy } from "../src/main/cleanup/policy";
import type { CleanupExecuteRequest } from "../src/shared/types";

function request(mode: CleanupExecuteRequest["mode"]): CleanupExecuteRequest {
  return {
    planId: "plan",
    confirmationToken: "token",
    selectedItemIds: ["item"],
    mode
  };
}

describe("enforceProductCleanupPolicy", () => {
  it("allows the 30-day restore-bin cleanup path", () => {
    const input = request("trash");

    expect(enforceProductCleanupPolicy(input)).toBe(input);
  });

  it("blocks direct permanent deletion at the product IPC boundary", () => {
    expect(() => enforceProductCleanupPolicy(request("permanent"))).toThrow(
      /영구 삭제하지 않아요|30일 복구함/
    );
  });
});
