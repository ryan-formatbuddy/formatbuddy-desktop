import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupAppLeftovers,
  planAppLeftovers,
  __resetLeftoversPlanCacheForTests
} from "../src/main/apps/leftovers";
import { getTrashSnapshot } from "../src/main/cleanup/trash";
import type { InstalledApp } from "../src/shared/types";

interface Fixture {
  root: string;
  home: string;
  roaming: string;
  localAppData: string;
  programData: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fb-leftover-"));
  return {
    root,
    home: join(root, "home"),
    roaming: join(root, "home", "AppData", "Roaming"),
    localAppData: join(root, "home", "AppData", "Local"),
    programData: join(root, "ProgramData"),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe("planAppLeftovers", () => {
  let fx: Fixture;

  beforeEach(() => {
    __resetLeftoversPlanCacheForTests();
    fx = makeFixture();
  });

  afterEach(() => {
    __resetLeftoversPlanCacheForTests();
    fx.cleanup();
  });

  it("finds matching leftover folders when they exist on disk", async () => {
    const kakaoRoaming = join(fx.roaming, "KakaoTalk");
    await fs.mkdir(kakaoRoaming, { recursive: true });
    await fs.writeFile(join(kakaoRoaming, "settings.dat"), "x", "utf8");

    const apps: InstalledApp[] = [
      { name: "KakaoTalk", publisher: "Kakao Corp." }
    ];

    const snapshot = await planAppLeftovers(apps, {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.planId).toBeTruthy();
    expect(snapshot.confirmationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.groups[0].appName).toBe("KakaoTalk");
    const existing = snapshot.groups[0].paths.find((p) => p.path === kakaoRoaming);
    expect(existing?.exists).toBe(true);
    expect(existing?.id).toBeTruthy();
  });

  it("measures leftover folders recursively", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(join(slack, "Cache"), { recursive: true });
    await fs.writeFile(join(slack, "Cache", "a.bin"), "12345", "utf8");
    await fs.writeFile(join(slack, "b.bin"), "1234567", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Slack", publisher: "Slack Technologies" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    const path = snapshot.groups[0].paths.find((p) => p.path === slack);
    expect(path?.exists).toBe(true);
    expect(path?.sizeBytes).toBe(12);
  });

  it("marks leftover folders containing symbolic links as protected", async () => {
    if (process.platform === "win32") return;
    const slack = join(fx.roaming, "Slack");
    const target = join(fx.root, "outside-cache");
    await fs.mkdir(slack, { recursive: true });
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
    await fs.symlink(target, join(slack, "linked-cache"));

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });

    const path = snapshot.groups[0].paths.find((p) => p.path === slack);
    expect(path?.exists).toBe(true);
    expect(path?.protectedBy).toMatch(/링크/);
  });

  it("marks overly deep leftover folders as protected", async () => {
    let current = join(fx.roaming, "Slack");
    for (let index = 0; index < 10; index += 1) {
      current = join(current, `level-${index}`);
    }
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(join(current, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });

    const path = snapshot.groups[0].paths.find((p) => p.path === join(fx.roaming, "Slack"));
    expect(path?.exists).toBe(true);
    expect(path?.protectedBy).toMatch(/깊/);
  });

  it("marks unreadable leftover folders as protected instead of zero-byte cleanup candidates", async () => {
    if (process.platform === "win32") return;
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
    await fs.chmod(slack, 0o000);

    try {
      const snapshot = await planAppLeftovers([], {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
        extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
      });

      const path = snapshot.groups[0].paths.find((p) => p.path === slack);
      expect(path?.exists).toBe(true);
      expect(path?.sizeBytes).toBeUndefined();
      expect(path?.protectedBy).toMatch(/권한/);
    } finally {
      await fs.chmod(slack, 0o700).catch(() => {});
    }
  });

  it("marks blocklist-protected leftover paths with protectedBy", async () => {
    const kakaoRoaming = join(fx.roaming, "KakaoTalk");
    await fs.mkdir(kakaoRoaming, { recursive: true });

    const snapshot = await planAppLeftovers(
      [{ name: "KakaoTalk", publisher: "Kakao" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    const path = snapshot.groups[0].paths.find((p) => p.path === kakaoRoaming);
    // KakaoTalk is on the user-scoped blocklist — even when the cleanup
    // surface ever tries to delete it, it should be refused. Leftover
    // panel surfaces this as protectedBy so the UI explains the lock.
    expect(path?.protectedBy).toBeTruthy();
  });

  it.each([
    [
      { name: "Google Chrome", publisher: "Google LLC" },
      (fx: Fixture) => join(fx.localAppData, "Google", "Chrome", "User Data")
    ],
    [
      { name: "Microsoft Edge", publisher: "Microsoft Corporation" },
      (fx: Fixture) => join(fx.localAppData, "Microsoft", "Edge", "User Data")
    ],
    [
      { name: "Naver Whale", publisher: "NAVER" },
      (fx: Fixture) => join(fx.localAppData, "Naver", "Naver Whale", "User Data")
    ],
    [
      { name: "Mozilla Firefox", publisher: "Mozilla" },
      (fx: Fixture) => join(fx.roaming, "Mozilla", "Firefox")
    ]
  ] as const)("marks browser profile leftovers as protected: %s", async (app, folderFor) => {
    const profileRoot = folderFor(fx);
    await fs.mkdir(profileRoot, { recursive: true });
    await fs.writeFile(join(profileRoot, "profile-data.sqlite"), "private", "utf8");

    const snapshot = await planAppLeftovers([app as InstalledApp], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === profileRoot);

    expect(path?.exists).toBe(true);
    expect(path?.protectedBy).toMatch(/브라우저|프로필|비밀번호|쿠키/);
  });

  it("returns an empty group set when no app matches", async () => {
    const snapshot = await planAppLeftovers(
      [{ name: "Some Random Tool", publisher: "Unknown" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    expect(snapshot.groups).toEqual([]);
  });

  it("finds existing AppData leftovers for apps outside the built-in dictionary", async () => {
    const notionRoaming = join(fx.roaming, "Notion");
    const notionLocal = join(fx.localAppData, "Notion");
    await fs.mkdir(notionRoaming, { recursive: true });
    await fs.mkdir(notionLocal, { recursive: true });
    await fs.writeFile(join(notionRoaming, "settings.json"), "{}", "utf8");
    await fs.writeFile(join(notionLocal, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Notion", publisher: "Notion Labs, Inc." }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe("Notion");
    expect(snapshot.groups[0].paths.map((p) => p.path).sort()).toEqual(
      [notionLocal, notionRoaming].sort()
    );
  });

  it("finds nested publisher/app folders for apps outside the built-in dictionary", async () => {
    const nestedRoaming = join(fx.roaming, "Acme Corp", "Acme Notes");
    const nestedLocal = join(fx.localAppData, "Acme", "AcmeNotes");
    await fs.mkdir(nestedRoaming, { recursive: true });
    await fs.mkdir(nestedLocal, { recursive: true });
    await fs.writeFile(join(nestedRoaming, "settings.json"), "{}", "utf8");
    await fs.writeFile(join(nestedLocal, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Acme Notes", publisher: "Acme Corp." }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe("Acme Notes");
    expect(snapshot.groups[0].paths.map((p) => p.path).sort()).toEqual(
      [nestedLocal, nestedRoaming].sort()
    );
  });

  it("finds nested publisher folders with multi-part legal suffixes", async () => {
    const nestedRoaming = join(fx.roaming, "Acme Co", "Acme Notes");
    const nestedLocal = join(fx.localAppData, "Acme", "AcmeNotes");
    await fs.mkdir(nestedRoaming, { recursive: true });
    await fs.mkdir(nestedLocal, { recursive: true });
    await fs.writeFile(join(nestedRoaming, "settings.json"), "{}", "utf8");
    await fs.writeFile(join(nestedLocal, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Acme Notes", publisher: "Acme Co., Ltd." }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].paths.map((p) => p.path).sort()).toEqual(
      [nestedLocal, nestedRoaming].sort()
    );
  });

  it("finds a recently uninstalled app's install folder even outside AppData roots", async () => {
    const installFolder = join(fx.localAppData, "Programs", "Acme Notes");
    await fs.mkdir(installFolder, { recursive: true });
    await fs.writeFile(join(installFolder, "AcmeNotes.exe"), "binary", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          installLocation: installFolder
        }
      ]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]).toMatchObject({
      appName: "Acme Notes",
      source: "uninstall-launched"
    });
    expect(snapshot.groups[0].paths.some((p) => p.path === installFolder && p.exists)).toBe(true);
  });

  it("moves a selected install folder leftover into the 30-day trash after uninstall follow-up", async () => {
    const installFolder = join(fx.localAppData, "Programs", "Acme Notes");
    await fs.mkdir(installFolder, { recursive: true });
    await fs.writeFile(join(installFolder, "AcmeNotes.exe"), "binary", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          installLocation: installFolder
        }
      ]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(1);
    await expect(fs.stat(installFolder)).rejects.toThrow();

    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(1);
    expect(trash.entries[0].originalPath).toBe(installFolder);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it.each([
    ["user home", (fx: Fixture) => fx.home],
    ["AppData Local", (fx: Fixture) => fx.localAppData],
    ["AppData Roaming", (fx: Fixture) => fx.roaming],
    ["ProgramData", (fx: Fixture) => fx.programData]
  ] as const)("marks broad installLocation roots as protected: %s", async (_label, folderFor) => {
    const installLocation = folderFor(fx);
    await fs.mkdir(installLocation, { recursive: true });
    await fs.writeFile(join(installLocation, "should-not-clean.txt"), "private", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          installLocation
        }
      ]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === installLocation);

    expect(path?.exists).toBe(true);
    expect(path?.protectedBy).toMatch(/사용자|AppData|시스템|루트|넓은/);
  });

  it("shows uninstall registry leftovers as selectable backup-first candidates", async () => {
    const registryKeyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          registryKeyPath
        }
      ]
    });

    expect(snapshot.groups).toHaveLength(1);
    const registryCandidate = snapshot.groups[0].paths.find((p) => p.path === registryKeyPath);
    expect(registryCandidate).toMatchObject({
      kind: "registry",
      exists: true
    });
    expect(registryCandidate?.protectedBy).toBeUndefined();
  });

  it("backs up and deletes selected uninstall registry leftovers after uninstall follow-up", async () => {
    const registryKeyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          registryKeyPath
        }
      ]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === registryKeyPath)!;
    const registryRunner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined)
    };

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        registryRunner
      }
    );

    expect(registryRunner.exportKey).toHaveBeenCalledWith(
      registryKeyPath,
      expect.stringMatching(/backup\.reg$/)
    );
    expect(registryRunner.deleteKey).toHaveBeenCalledWith(registryKeyPath);
    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0]).toMatchObject({
      itemId: path.id,
      path: registryKeyPath,
      sizeBytes: 0,
      categoryId: "app-leftovers",
      mode: "trash",
      succeeded: true,
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    expect(result.removedItems[0].registryBackupId).toBeTruthy();
  });

  it("does not delete a registry key when backup export fails", async () => {
    const registryKeyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp.", registryKeyPath }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === registryKeyPath)!;
    const registryRunner = {
      exportKey: vi.fn(async () => {
        throw new Error("export failed");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        registryRunner
      }
    );

    expect(registryRunner.deleteKey).not.toHaveBeenCalled();
    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: registryKeyPath,
      reason: "execute-failed"
    });
    expect(result.skippedItems[0].detail).toMatch(/export failed/);
  });

  it("does not create generic leftover groups when the app folders do not exist", async () => {
    const snapshot = await planAppLeftovers(
      [{ name: "Obscure Notes", publisher: "Tiny Vendor" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    expect(snapshot.groups).toEqual([]);
  });

  it("does not use generic matching for system/runtime style app names", async () => {
    const runtimeFolder = join(fx.programData, "Microsoft Visual C++ 2015 Redistributable");
    await fs.mkdir(runtimeFolder, { recursive: true });
    await fs.writeFile(join(runtimeFolder, "runtime.dat"), "x", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Microsoft Visual C++ 2015 Redistributable", publisher: "Microsoft Corporation" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );

    expect(snapshot.groups).toEqual([]);
  });

  it("does not duplicate groups when the same app appears twice in the registry", async () => {
    const snapshot = await planAppLeftovers(
      [
        { name: "Slack", publisher: "Slack Technologies" },
        { name: "Slack", publisher: "Slack Technologies" }
      ],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    expect(snapshot.groups).toHaveLength(1);
  });

  it("reports non-existent folders as exists=false", async () => {
    const snapshot = await planAppLeftovers(
      [{ name: "Discord", publisher: "Discord Inc." }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].paths.every((p) => !p.exists)).toBe(true);
  });

  it("plans leftovers for a recently opened uninstall wizard even after the app left the scan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe("Slack");
    expect(snapshot.groups[0].source).toBe("uninstall-launched");
    expect(snapshot.groups[0].paths.find((p) => p.path === slack)?.exists).toBe(true);
  });

  it("lets a recently opened uninstall wizard override the stale installed-app scan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
    const staleInstalledApp = { name: "Slack", publisher: "Slack Technologies" };

    const snapshot = await planAppLeftovers([staleInstalledApp], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [staleInstalledApp]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].source).toBe("uninstall-launched");

    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(1);
    await expect(fs.stat(slack)).rejects.toThrow();
  });

  it("refuses to clean leftovers while the app is still installed", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Slack", publisher: "Slack Technologies" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      reason: "blocked-path",
      detail: "앱이 아직 설치된 상태예요. Windows 제거 후 다시 확인해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();
  });

  it("moves selected app leftovers into the FormatBuddy 30-day trash after uninstall follow-up", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z")
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0].categoryId).toBe("app-leftovers");
    expect(result.removedItems[0].trashEntryId).toBeTruthy();
    await expect(fs.stat(slack)).rejects.toThrow();

    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(1);
    expect(trash.entries[0].originalPath).toBe(slack);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("reports a blocked path when a leftover path starts going through a symbolic-link parent before cleanup", async () => {
    if (process.platform === "win32") return;
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

    const outsideRoaming = join(fx.root, "outside-roaming");
    await fs.rm(fx.roaming, { recursive: true, force: true });
    await fs.mkdir(join(outsideRoaming, "Slack"), { recursive: true });
    await fs.writeFile(join(outsideRoaming, "Slack", "cache.bin"), "outside", "utf8");
    await fs.symlink(outsideRoaming, fx.roaming, "dir");

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: slack,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/링크/);
    await expect(fs.readFile(join(outsideRoaming, "Slack", "cache.bin"), "utf8")).resolves.toBe(
      "outside"
    );
  });

  it("discards an app leftover cleanup plan after a wrong confirmation token", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: "wrong-token",
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/could not match a current plan/);

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/could not match a current plan/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();
  });

  it("refuses protected leftover cleanup even with a valid plan", async () => {
    const kakaoRoaming = join(fx.roaming, "KakaoTalk");
    await fs.mkdir(kakaoRoaming, { recursive: true });
    await fs.writeFile(join(kakaoRoaming, "talk.db"), "private-db-placeholder", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "KakaoTalk", publisher: "Kakao" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    const path = snapshot.groups[0].paths.find((p) => p.path === kakaoRoaming)!;
    expect(path.protectedBy).toBeTruthy();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0].reason).toBe("blocked-path");
    await expect(fs.stat(kakaoRoaming)).resolves.toBeTruthy();
  });

  // ====================================================================
  // v2.0 / Round D-3 (B2) — Korean-user dictionary regression tests.
  // We do not list every rule -- just one per category so a future
  // refactor that drops a category trips immediately.
  // ====================================================================
  it.each([
    [{ name: "안랩 V3 Internet Security 9.0", publisher: "AhnLab, Inc." }, "안랩 V3"],
    [{ name: "알약 공개용 (ALYac)", publisher: "ESTsoft" }, "알약 (ESTsoft)"],
    [{ name: "한컴오피스 2024", publisher: "한글과컴퓨터" }, "한컴 오피스 / 한글"],
    [{ name: "더존 Smart A", publisher: "더존비즈온" }, "더존"],
    [{ name: "위하고 (WEHAGO)", publisher: "더존" }, "위하고"],
    [{ name: "세무사랑 Pro", publisher: "DUZON" }, "세무사랑"],
    [{ name: "카카오게임즈 런처", publisher: "Kakao Games Corp." }, "카카오게임즈"],
    [{ name: "넥슨 런처", publisher: "NEXON Korea" }, "넥슨 런처"],
    [{ name: "미르4 (위메이드)", publisher: "Wemade" }, "위메이드 / 미르4"],
    [{ name: "Purple Launcher (엔씨소프트)", publisher: "NCSOFT" }, "엔씨소프트 / Purple"],
    [{ name: "검은사막 (Black Desert)", publisher: "Pearl Abyss" }, "펄어비스 / 검은사막"],
    [{ name: "곰플레이어", publisher: "GRETECH" }, "곰플레이어 (GOM)"],
    [{ name: "다음 팟플레이어", publisher: "Daum" }, "다음 팟플레이어"],
    [{ name: "토스 (Toss)", publisher: "비바리퍼블리카" }, "토스"],
    [{ name: "신한플레이", publisher: "신한카드" }, "신한플레이"]
  ] as const)("recognizes Korean-locale app: %s", async (app, expectedAppLabel) => {
    const snapshot = await planAppLeftovers(
      [app as InstalledApp],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData }
      }
    );
    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe(expectedAppLabel);
    expect(snapshot.groups[0].paths.length).toBeGreaterThan(0);
  });
});
