import { describe, expect, it } from "vitest";
import {
  enforceAppLeftoversCleanupPolicy,
  enforceProductCleanupPolicy
} from "../src/main/cleanup/policy";
import type { AppLeftoversCleanupRequest, CleanupExecuteRequest } from "../src/shared/types";

function request(mode: unknown): CleanupExecuteRequest {
  return {
    planId: "plan",
    confirmationToken: "token",
    selectedItemIds: ["item"],
    mode
  } as CleanupExecuteRequest;
}

function leftoversRequest(): AppLeftoversCleanupRequest {
  return {
    planId: "leftovers-plan",
    confirmationToken: "leftovers-token",
    selectedPathIds: ["path-1"]
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

  it("blocks malformed cleanup requests before execution can start", () => {
    expect(() =>
      enforceProductCleanupPolicy({ ...request("trash"), selectedItemIds: [] })
    ).toThrow(/선택한 항목/);

    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        selectedItemIds: ["item", 123]
      } as unknown as CleanupExecuteRequest)
    ).toThrow(/선택한 항목/);

    expect(() =>
      enforceProductCleanupPolicy({
        planId: "",
        confirmationToken: "token",
        selectedItemIds: ["item"],
        mode: "trash"
      })
    ).toThrow(/정리 계획/);
  });

  it("blocks duplicate cleanup selections before execution can start", () => {
    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        selectedItemIds: ["item", "item"]
      })
    ).toThrow(/중복|선택한 항목/);
  });

  it("blocks cleanup ids with leading or trailing whitespace", () => {
    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        planId: " plan"
      })
    ).toThrow(/공백|정리 계획/);

    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        confirmationToken: "token "
      })
    ).toThrow(/공백|정리 계획/);

    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        selectedItemIds: [" item"]
      })
    ).toThrow(/공백|선택한 항목/);
  });

  it("blocks cleanup ids with internal control characters at the product boundary", () => {
    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        planId: "pl\nan"
      })
    ).toThrow(/제어 문자|정리 계획/);

    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        confirmationToken: "to\rken"
      })
    ).toThrow(/제어 문자|정리 계획/);

    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        selectedItemIds: ["it\nem"]
      })
    ).toThrow(/제어 문자|선택한 항목/);
  });

  it("blocks unknown cleanup modes at the product IPC boundary", () => {
    expect(() =>
      enforceProductCleanupPolicy({
        ...request("trash"),
        mode: "wipe-now"
      } as unknown as CleanupExecuteRequest)
    ).toThrow(/30일 복구함/);
  });
});

describe("enforceAppLeftoversCleanupPolicy", () => {
  it("allows a confirmed app leftovers cleanup request", () => {
    const input = leftoversRequest();

    expect(enforceAppLeftoversCleanupPolicy(input)).toBe(input);
  });

  it("blocks malformed app leftovers requests before execution can start", () => {
    expect(() =>
      enforceAppLeftoversCleanupPolicy({ ...leftoversRequest(), selectedPathIds: [] })
    ).toThrow(/앱 잔여 항목|선택한 항목/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        selectedPathIds: ["path-1", 123]
      } as unknown as AppLeftoversCleanupRequest)
    ).toThrow(/앱 잔여 항목|선택한 항목/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        planId: ""
      })
    ).toThrow(/앱 잔여 정리 계획|정리 계획/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        confirmationToken: ""
      })
    ).toThrow(/앱 잔여 정리 계획|정리 계획/);
  });

  it("blocks duplicate app leftovers selections before execution can start", () => {
    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        selectedPathIds: ["path-1", "path-1"]
      })
    ).toThrow(/중복|앱 잔여 항목|선택한 항목/);
  });

  it("blocks app leftovers ids with leading or trailing whitespace", () => {
    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        planId: " leftovers-plan"
      })
    ).toThrow(/공백|앱 잔여 정리 계획|정리 계획/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        confirmationToken: "leftovers-token "
      })
    ).toThrow(/공백|앱 잔여 정리 계획|정리 계획/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        selectedPathIds: [" path-1"]
      })
    ).toThrow(/공백|앱 잔여 항목|선택한 항목/);
  });

  it("blocks app leftovers ids with internal control characters at the product boundary", () => {
    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        planId: "leftovers\n-plan"
      })
    ).toThrow(/제어 문자|앱 잔여 정리 계획|정리 계획/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        confirmationToken: "leftovers\r-token"
      })
    ).toThrow(/제어 문자|앱 잔여 정리 계획|정리 계획/);

    expect(() =>
      enforceAppLeftoversCleanupPolicy({
        ...leftoversRequest(),
        selectedPathIds: ["path\n-1"]
      })
    ).toThrow(/제어 문자|앱 잔여 항목|선택한 항목/);
  });
});
