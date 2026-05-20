import { describe, expect, it } from "vitest";
import {
  currentInstallCheckUnavailableResult,
  currentInstalledAppMatchesCachedTarget,
  currentInstallTargetNotFoundResult
} from "../src/main/apps/uninstallCurrentGuard";
import type { InstalledApp } from "../src/shared/types";

function app(overrides: Partial<InstalledApp> & { name: string }): InstalledApp {
  return {
    name: overrides.name,
    publisher: overrides.publisher ?? null,
    registryKeyPath: overrides.registryKeyPath ?? null
  };
}

describe("uninstall current install guard", () => {
  it("confirms the cached uninstall target by registry key, name, and publisher", () => {
    const cached = app({
      name: "Friendly Tool",
      publisher: "Friendly Co.",
      registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Friendly"
    });

    expect(
      currentInstalledAppMatchesCachedTarget(cached, [
        app({
          name: "Friendly Tool",
          publisher: "Friendly Co.",
          registryKeyPath: "HKCU/Software/Microsoft/Windows/CurrentVersion/Uninstall/Friendly"
        })
      ])
    ).toBe(true);
  });

  it("does not confirm a stale cached target when the registry key now belongs to another app", () => {
    const cached = app({
      name: "Friendly Tool",
      publisher: "Friendly Co.",
      registryKeyPath: "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Friendly"
    });

    expect(
      currentInstalledAppMatchesCachedTarget(cached, [
        app({
          name: "Different Tool",
          publisher: "Different Co.",
          registryKeyPath: "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Friendly"
        })
      ])
    ).toBe(false);
  });

  it("falls back to name and publisher when the cached app has no registry key", () => {
    expect(
      currentInstalledAppMatchesCachedTarget(
        app({ name: "Friendly Tool", publisher: "Friendly Co." }),
        [app({ name: "Friendly Tool", publisher: "Friendly Co." })]
      )
    ).toBe(true);
    expect(
      currentInstalledAppMatchesCachedTarget(
        app({ name: "Friendly Tool", publisher: "Friendly Co." }),
        [app({ name: "Friendly Tool", publisher: "Other Co." })]
      )
    ).toBe(false);
  });

  it("returns friendly block results when current install state cannot be checked", () => {
    const result = currentInstallCheckUnavailableResult({ appName: "Friendly Tool" });

    expect(result.status).toBe("blocked");
    expect(result.message).toContain("지금 설치 상태");
    expect(result.detail).toBe("current-install-check-unavailable");
  });

  it("returns friendly not-found results when the current app disappeared", () => {
    const result = currentInstallTargetNotFoundResult({ appName: "Friendly Tool" });

    expect(result.status).toBe("app-not-found");
    expect(result.message).toContain("현재 설치 목록");
    expect(result.detail).toBe("current-install-not-found");
  });
});
