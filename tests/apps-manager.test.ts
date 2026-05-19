import { describe, expect, it } from "vitest";
import { buildAppManagerSnapshot, __testing } from "../src/main/apps/manager";
import type { InstalledApp } from "../src/shared/types";

function app(overrides: Partial<InstalledApp> & { name: string }): InstalledApp {
  return {
    name: overrides.name,
    version: overrides.version,
    publisher: overrides.publisher,
    uninstallString: overrides.uninstallString ?? null,
    quietUninstallString: overrides.quietUninstallString ?? null,
    installLocation: overrides.installLocation ?? null,
    estimatedSizeKb: overrides.estimatedSizeKb ?? null,
    installDate: overrides.installDate ?? null,
    systemComponent: overrides.systemComponent ?? null
  };
}

describe("buildAppManagerSnapshot", () => {
  it("groups apps by category and computes uninstall availability", () => {
    const snapshot = buildAppManagerSnapshot([
      app({
        name: "Google Chrome",
        publisher: "Google LLC",
        uninstallString: '"C:\\Program Files\\Google\\Chrome\\Application\\uninstall.exe"',
        installLocation: "C:\\Program Files\\Google\\Chrome",
        estimatedSizeKb: 250000
      }),
      app({
        name: "KakaoTalk",
        publisher: "Kakao Corp.",
        uninstallString: "C:\\Program Files (x86)\\Kakao\\KakaoTalk\\unins000.exe",
        quietUninstallString: "C:\\Program Files (x86)\\Kakao\\KakaoTalk\\unins000.exe /S"
      }),
      app({
        name: "Visual Studio Code",
        publisher: "Microsoft Corporation",
        uninstallString: "C:\\Users\\Ryan\\AppData\\Local\\Programs\\Microsoft VS Code\\unins000.exe"
      })
    ]);

    expect(snapshot.total).toBe(3);
    expect(snapshot.classified).toBe(3);
    const categories = snapshot.groups.map((g) => g.category);
    expect(categories).toEqual(expect.arrayContaining(["browser", "messenger", "developer"]));

    const chrome = snapshot.groups
      .flatMap((g) => g.items)
      .find((i) => i.name === "Google Chrome");
    expect(chrome?.uninstallAvailability).toBe("ready");
    expect(chrome?.estimatedSizeBytes).toBe(250000 * 1024);
    expect(chrome?.uninstallMode).toBe("interactive");
  });

  it("marks apps without UninstallString as no-uninstall-string", () => {
    const snapshot = buildAppManagerSnapshot([
      app({ name: "Strange Tool", publisher: "Unknown Co.", uninstallString: null })
    ]);
    const item = snapshot.groups.flatMap((g) => g.items)[0];
    expect(item.uninstallAvailability).toBe("no-uninstall-string");
    expect(item.availabilityNote).toMatch(/제거 명령/);
  });

  it("flags systemComponent apps as not-removable", () => {
    const snapshot = buildAppManagerSnapshot([
      app({
        name: "Microsoft Visual C++ 2019 Redistributable",
        publisher: "Microsoft",
        uninstallString: "MsiExec.exe /X{abc}",
        systemComponent: true
      })
    ]);
    const item = snapshot.groups.flatMap((g) => g.items)[0];
    expect(item.uninstallAvailability).toBe("system-component");
    expect(snapshot.hiddenSystemCount).toBe(1);
  });

  it("filters out KB/hotfix noise but still counts in hiddenSystemCount=0", () => {
    const snapshot = buildAppManagerSnapshot([
      app({ name: "Security Update for Windows (KB1234567)", publisher: "Microsoft" }),
      app({ name: "Hotfix for Windows (KB7654321)", publisher: "Microsoft" }),
      app({ name: "Slack", publisher: "Slack Technologies", uninstallString: "noop" })
    ]);
    const flat = snapshot.groups.flatMap((g) => g.items).map((i) => i.name);
    expect(flat).toEqual(["Slack"]);
    expect(snapshot.hiddenSystemCount).toBe(0);
  });

  it("deduplicates by name+publisher (multiple registry hits for same app)", () => {
    const snapshot = buildAppManagerSnapshot([
      app({ name: "Steam", publisher: "Valve", uninstallString: "x" }),
      app({ name: "Steam", publisher: "Valve", uninstallString: "x" })
    ]);
    expect(snapshot.total).toBe(1);
  });

  it("surfaces recently opened uninstall wizards with minimal identity only", () => {
    const snapshot = buildAppManagerSnapshot([], {
      recentlyUninstallLaunched: [
        app({
          name: "Slack",
          publisher: "Slack Technologies",
          uninstallString: '"C:\\Program Files\\Slack\\unins000.exe"',
          installLocation: "C:\\Program Files\\Slack"
        })
      ]
    });

    expect(snapshot.recentlyUninstallLaunched).toEqual([
      { name: "Slack", publisher: "Slack Technologies" }
    ]);
  });
});

describe("availability evaluator", () => {
  it("recognizes ready apps with both interactive and quiet strings", () => {
    const result = __testing.evaluateAvailability({
      name: "Foo",
      uninstallString: "uninstall.exe",
      quietUninstallString: "uninstall.exe /S"
    });
    expect(result.availability).toBe("ready");
    expect(result.mode).toBe("interactive");
  });

  it("treats install-location-only entries as registry-only", () => {
    const result = __testing.evaluateAvailability({
      name: "Quiet App",
      installLocation: "C:\\Program Files\\Quiet App"
    });
    expect(result.availability).toBe("registry-only");
  });

  it("produces stable ids for the same name+publisher+location", () => {
    const a = __testing.makeId({ name: "App", publisher: "Co", installLocation: "C:\\App" });
    const b = __testing.makeId({ name: "App", publisher: "Co", installLocation: "C:\\App" });
    expect(a).toBe(b);
  });
});
