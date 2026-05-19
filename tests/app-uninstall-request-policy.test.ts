import { describe, expect, it } from "vitest";
import { enforceAppUninstallRequestPolicy } from "../src/main/apps/uninstallRequestPolicy";
import type { AppUninstallRequest } from "../src/shared/types";

function request(): AppUninstallRequest {
  return {
    appName: "Slack",
    publisher: "Slack Technologies",
    mode: "interactive"
  };
}

describe("enforceAppUninstallRequestPolicy", () => {
  it("allows a valid app uninstall request", () => {
    const input = request();

    expect(enforceAppUninstallRequestPolicy(input)).toBe(input);
  });

  it("allows omitted optional fields", () => {
    const input: AppUninstallRequest = { appName: "Slack" };

    expect(enforceAppUninstallRequestPolicy(input)).toBe(input);
  });

  it("blocks malformed app names before uninstall can start", () => {
    expect(() =>
      enforceAppUninstallRequestPolicy({ ...request(), appName: "" })
    ).toThrow(/앱 제거 대상/);

    expect(() =>
      enforceAppUninstallRequestPolicy({ ...request(), appName: "   " })
    ).toThrow(/앱 제거 대상/);

    expect(() =>
      enforceAppUninstallRequestPolicy({
        ...request(),
        appName: 123
      } as unknown as AppUninstallRequest)
    ).toThrow(/앱 제거 대상/);
  });

  it("blocks malformed publisher and mode values", () => {
    expect(() =>
      enforceAppUninstallRequestPolicy({
        ...request(),
        publisher: 123
      } as unknown as AppUninstallRequest)
    ).toThrow(/앱 제거 정보를 확인하지 못했어요/);

    expect(() =>
      enforceAppUninstallRequestPolicy({
        ...request(),
        mode: "silent"
      } as unknown as AppUninstallRequest)
    ).toThrow(/앱 제거 방식/);
  });
});
