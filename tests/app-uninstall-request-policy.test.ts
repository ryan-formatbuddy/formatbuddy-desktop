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

  it("blocks padded or control-character app names before uninstall can start", () => {
    for (const appName of [" Slack", "Slack ", "Slack\nBeta", "Slack\tBeta"]) {
      expect(() =>
        enforceAppUninstallRequestPolicy({ ...request(), appName })
      ).toThrow(/앱 제거 대상/);
    }
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

  it("blocks padded or control-character publisher values before uninstall can start", () => {
    for (const publisher of [
      " Slack Technologies",
      "Slack Technologies ",
      "Slack\nTechnologies"
    ]) {
      expect(() =>
        enforceAppUninstallRequestPolicy({ ...request(), publisher })
      ).toThrow(/앱 제거 정보를 확인하지 못했어요/);
    }
  });

  it("blocks quiet uninstall requests at the product IPC boundary", () => {
    expect(() =>
      enforceAppUninstallRequestPolicy({
        ...request(),
        mode: "quiet"
      })
    ).toThrow(/Windows 제거 마법사|직접 확인/);
  });
});
