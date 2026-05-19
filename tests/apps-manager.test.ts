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

  it("does not advertise unsafe automatic uninstall commands", () => {
    const snapshot = buildAppManagerSnapshot([
      app({
        name: "Friendly Tool",
        publisher: "Friendly Co.",
        uninstallString: '"C:\\Program Files\\Friendly Tool\\unins000.exe"',
        quietUninstallString: "powershell.exe -NoProfile -File uninstall.ps1"
      })
    ]);

    const item = snapshot.groups.flatMap((g) => g.items)[0];
    expect(item.uninstallAvailability).toBe("ready");
    expect(item.availabilityNote).toMatch(/Windows 제거 마법사/);
    expect(item.availabilityNote).toMatch(/자동 제거 명령/);
    expect(item.availabilityNote).toMatch(/별도 실행 도구/);
    expect(item.availabilityNote).not.toMatch(/PowerShell|명령 프롬프트|터미널/);
    expect(item.availabilityNote).not.toMatch(/선택할 수/);
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

  it("pre-blocks uninstall strings that cmd.exe could reinterpret", () => {
    const snapshot = buildAppManagerSnapshot([
      app({
        name: "Sketchy Tool",
        publisher: "Unknown",
        uninstallString: '"C:\\Program Files\\Sketchy Tool\\unins000.exe" %COMSPEC%'
      })
    ]);
    const item = snapshot.groups.flatMap((g) => g.items)[0];
    expect(item.uninstallAvailability).toBe("blocked");
    expect(item.availabilityNote).toMatch(/Windows 설정/);
  });

  it.each([
    [
      "shell host",
      "powershell.exe -NoProfile -File uninstall.ps1",
      /별도 실행 도구/
    ],
    [
      "script target",
      '"C:\\Program Files\\Sketchy Tool\\uninstall.ps1"',
      /스크립트/
    ],
    [
      "unquoted spaced path",
      "C:\\Program Files\\Sketchy Tool\\unins000.exe /remove",
      /공백|따옴표/
    ]
  ] as const)("explains blocked uninstall reason for %s", (_label, uninstallString, expected) => {
    const snapshot = buildAppManagerSnapshot([
      app({
        name: "Sketchy Tool",
        publisher: "Unknown",
        uninstallString
      })
    ]);
    const item = snapshot.groups.flatMap((g) => g.items)[0];
    expect(item.uninstallAvailability).toBe("blocked");
    expect(item.availabilityNote).toMatch(expected);
    expect(item.availabilityNote).toMatch(/Windows 설정/);
    expect(item.availabilityNote).not.toMatch(/PowerShell|명령 프롬프트|터미널/);
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
      { name: "Slack", publisher: "Slack Technologies", stillInstalled: false }
    ]);
  });

  it("marks a recently opened uninstall wizard as still installed when it remains in the app list", () => {
    const snapshot = buildAppManagerSnapshot(
      [app({ name: "Slack", publisher: "Slack Technologies", uninstallString: "uninstall.exe" })],
      {
        recentlyUninstallLaunched: [
          app({ name: "Slack", publisher: "Slack Technologies" }),
          app({ name: "Ghost App", publisher: "Ghost Co." })
        ]
      }
    );

    expect(snapshot.recentlyUninstallLaunched).toEqual([
      { name: "Slack", publisher: "Slack Technologies", stillInstalled: true },
      { name: "Ghost App", publisher: "Ghost Co.", stillInstalled: false }
    ]);
  });

  it("treats a publisher-missing recent uninstall as still installed when the same app name remains", () => {
    const snapshot = buildAppManagerSnapshot(
      [app({ name: "Slack", publisher: "Slack Technologies", uninstallString: "uninstall.exe" })],
      {
        recentlyUninstallLaunched: [app({ name: "Slack", publisher: null })]
      }
    );

    expect(snapshot.recentlyUninstallLaunched).toEqual([
      { name: "Slack", publisher: null, stillInstalled: true }
    ]);
  });
});

describe("availability evaluator", () => {
  it("hides quiet uninstall choices and keeps the Windows wizard as the only launch path", () => {
    const result = __testing.evaluateAvailability({
      name: "Foo",
      uninstallString: "uninstall.exe",
      quietUninstallString: "uninstall.exe /S"
    });
    expect(result.availability).toBe("ready");
    expect(result.mode).toBe("interactive");
    expect(result.note).toContain("Windows 제거 마법사");
    expect(result.note).toContain("자동 제거 명령은 숨겨요");
    expect(result.note).not.toContain("선택할 수 있어요");
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
