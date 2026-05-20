import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  cleanupAppLeftovers as cleanupAppLeftoversBase,
  planAppLeftovers,
  __resetLeftoversPlanCacheForTests,
  __testing as leftoversTesting
} from "../src/main/apps/leftovers";
import { listRegistryBackups } from "../src/main/apps/registryCleanup";
import { getTrashSnapshot, __testing as trashTesting } from "../src/main/cleanup/trash";
import { listDisabledStartupFolderEntries } from "../src/main/startup/folderToggle";
import { preservedRegistryBackupIds } from "../src/shared/cleanup-result";
import {
  CLEANUP_FOLLOWUP_SAVE_WARNING,
  CLEANUP_HISTORY_SAVE_WARNING
} from "../src/shared/cleanup-warnings";
import type { InstalledApp, StartupAutoEntry } from "../src/shared/types";

const REGISTRY_BACKUP_HEADER = "Windows Registry Editor Version 5.00";

type CleanupAppLeftoversRequestArg = Parameters<typeof cleanupAppLeftoversBase>[0];
type CleanupAppLeftoversOptionsArg = Parameters<typeof cleanupAppLeftoversBase>[1];

function cleanupAppLeftovers(
  request: CleanupAppLeftoversRequestArg,
  options: CleanupAppLeftoversOptionsArg
) {
  return cleanupAppLeftoversBase(request, {
    currentInstalledAppsKnown: true,
    currentInstalledApps: [],
    ...options
  });
}

function registryBackupContentFor(keyPath: string): string {
  const canonicalKeyPath = keyPath
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\");
  return [REGISTRY_BACKUP_HEADER, "", `[${canonicalKeyPath}]`, '"DisplayName"="Acme Notes"', ""].join(
    "\r\n"
  );
}

interface Fixture {
  root: string;
  home: string;
  roaming: string;
  localAppData: string;
  localLow: string;
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
    localLow: join(root, "home", "AppData", "LocalLow"),
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

  it("finds generic LocalLow leftovers even for apps with built-in rules", async () => {
    const slackLocalLow = join(fx.localLow, "Slack");
    await fs.mkdir(slackLocalLow, { recursive: true });
    await fs.writeFile(join(slackLocalLow, "webview-cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Slack", publisher: "Slack Technologies" }],
      {
        home: fx.home,
        env: {
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          localLow: fx.localLow,
          programData: fx.programData
        }
      }
    );

    const path = snapshot.groups[0].paths.find((p) => p.path === slackLocalLow);
    expect(path).toMatchObject({ kind: "folder", exists: true });
    expect(path?.protectedBy).toBeUndefined();
  });

  it("cleans app labels before exposing leftover groups", async () => {
    const appRoot = join(fx.roaming, "Acme Notes");
    await fs.mkdir(appRoot, { recursive: true });
    await fs.writeFile(join(appRoot, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: {
        roaming: fx.roaming,
        localAppData: fx.localAppData,
        localLow: fx.localLow,
        programData: fx.programData
      },
      extraApps: [{ name: " Acme\nNotes ", publisher: " Acme\tLabs " }]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe("Acme Notes");
    expect(snapshot.groups[0].publisher).toBe("Acme Labs");
    expect(snapshot.groups[0].paths.some((path) => path.path === appRoot)).toBe(true);
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
    const notionLocalLow = join(fx.localLow, "Notion");
    await fs.mkdir(notionRoaming, { recursive: true });
    await fs.mkdir(notionLocal, { recursive: true });
    await fs.mkdir(notionLocalLow, { recursive: true });
    await fs.writeFile(join(notionRoaming, "settings.json"), "{}", "utf8");
    await fs.writeFile(join(notionLocal, "cache.bin"), "abc", "utf8");
    await fs.writeFile(join(notionLocalLow, "renderer-cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Notion", publisher: "Notion Labs, Inc." }],
      {
        home: fx.home,
        env: {
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          localLow: fx.localLow,
          programData: fx.programData
        }
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].appName).toBe("Notion");
    expect(snapshot.groups[0].paths.map((p) => p.path).sort()).toEqual(
      [notionLocal, notionLocalLow, notionRoaming].sort()
    );
  });

  it("moves a selected LocalLow leftover into the 30-day trash after uninstall follow-up", async () => {
    const localLowFolder = join(fx.localLow, "Acme Notes");
    await fs.mkdir(localLowFolder, { recursive: true });
    await fs.writeFile(join(localLowFolder, "unity-cache.bin"), "cache", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: {
        roaming: fx.roaming,
        localAppData: fx.localAppData,
        localLow: fx.localLow,
        programData: fx.programData
      },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === localLowFolder)!;
    expect(path).toMatchObject({ kind: "folder", exists: true });
    expect(path.protectedBy).toBeUndefined();

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
    await expect(fs.stat(localLowFolder)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries[0].originalPath).toBe(localLowFolder);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("rolls back an unverified app-leftover trash move only through a normal original parent", async () => {
    const userDataDir = join(fx.root, "userdata");
    const entryId = "entry-safe";
    const originalPath = join(fx.roaming, "Acme Notes", "cache.bin");
    const storedPath = trashTesting.storedPathFor(userDataDir, entryId, originalPath);
    await fs.mkdir(dirname(storedPath), { recursive: true });
    await fs.writeFile(storedPath, "cached", "utf8");

    await leftoversTesting.cleanupUnverifiedTrashMove({
      userDataDir,
      originalPath,
      trashEntry: { id: entryId, storedPath },
      rollbackBoundary: fx.home
    });

    await expect(fs.readFile(originalPath, "utf8")).resolves.toBe("cached");
    await expect(fs.stat(storedPath)).rejects.toThrow();
    await expect(fs.stat(trashTesting.entryDir(userDataDir, entryId))).rejects.toThrow();
  });

  it("keeps an unverified app-leftover trash move in the restore bin when the original parent is a link", async () => {
    if (process.platform === "win32") return;
    const userDataDir = join(fx.root, "userdata");
    const entryId = "entry-linked-parent";
    const originalParent = join(fx.roaming, "Acme Notes");
    const originalPath = join(originalParent, "cache.bin");
    const outsideParent = join(fx.root, "outside-rollback");
    const storedPath = trashTesting.storedPathFor(userDataDir, entryId, originalPath);
    await fs.mkdir(dirname(storedPath), { recursive: true });
    await fs.writeFile(storedPath, "cached", "utf8");
    await fs.mkdir(dirname(originalParent), { recursive: true });
    await fs.mkdir(outsideParent, { recursive: true });
    await fs.symlink(outsideParent, originalParent, "dir");

    await leftoversTesting.cleanupUnverifiedTrashMove({
      userDataDir,
      originalPath,
      trashEntry: { id: entryId, storedPath },
      rollbackBoundary: fx.home
    });

    await expect(fs.readFile(storedPath, "utf8")).resolves.toBe("cached");
    await expect(fs.readdir(outsideParent)).resolves.toEqual([]);
    const parentStat = await fs.lstat(originalParent);
    expect(parentStat.isSymbolicLink()).toBe(true);
  });

  it("refuses best-effort rollback moves through a linked destination parent at move time", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.root, "stored-cache.bin");
    const linkedParent = join(fx.roaming, "Acme Notes");
    const outsideParent = join(fx.root, "outside-move-target");
    const destination = join(linkedParent, "cache.bin");
    await fs.writeFile(source, "cached", "utf8");
    await fs.mkdir(dirname(linkedParent), { recursive: true });
    await fs.mkdir(outsideParent, { recursive: true });
    await fs.symlink(outsideParent, linkedParent, "dir");

    await expect(
      leftoversTesting.movePathBestEffort(source, destination, {
        destinationBoundary: fx.home
      })
    ).rejects.toThrow(/link/i);

    await expect(fs.readFile(source, "utf8")).resolves.toBe("cached");
    await expect(fs.readdir(outsideParent)).resolves.toEqual([]);
  });

  it("refuses Program Files rollback moves through a linked Program Files root before creating parents", async () => {
    if (process.platform === "win32") return;
    const source = join(fx.root, "stored-install-cache.bin");
    const programFilesLink = join(fx.root, "Program Files");
    const outsideProgramFiles = join(fx.root, "outside-program-files");
    const destination = join(programFilesLink, "Acme Corp", "Acme Notes", "cache.bin");
    await fs.writeFile(source, "cached", "utf8");
    await fs.mkdir(outsideProgramFiles, { recursive: true });
    await fs.symlink(outsideProgramFiles, programFilesLink, "dir");

    await expect(
      leftoversTesting.movePathBestEffort(source, destination, {
        destinationBoundary: leftoversTesting.rollbackBoundaryForPath(destination, {
          home: fx.home,
          roaming: fx.roaming,
          localAppData: fx.localAppData,
          localLow: fx.localLow,
          programData: fx.programData
        })
      })
    ).rejects.toThrow(/link/i);

    await expect(fs.readFile(source, "utf8")).resolves.toBe("cached");
    await expect(fs.readdir(outsideProgramFiles)).resolves.toEqual([]);
  });

  it("keeps an unverified app-leftover trash move when a new item already exists at the original path", async () => {
    const userDataDir = join(fx.root, "userdata");
    const entryId = "entry-target-exists";
    const originalPath = join(fx.roaming, "Acme Notes", "cache.bin");
    const storedPath = trashTesting.storedPathFor(userDataDir, entryId, originalPath);
    await fs.mkdir(dirname(storedPath), { recursive: true });
    await fs.mkdir(dirname(originalPath), { recursive: true });
    await fs.writeFile(storedPath, "original cached data", "utf8");
    await fs.writeFile(originalPath, "new data at original path", "utf8");

    await leftoversTesting.cleanupUnverifiedTrashMove({
      userDataDir,
      originalPath,
      trashEntry: { id: entryId, storedPath },
      rollbackBoundary: fx.home
    });

    await expect(fs.readFile(originalPath, "utf8")).resolves.toBe("new data at original path");
    await expect(fs.readFile(storedPath, "utf8")).resolves.toBe("original cached data");
    await expect(fs.stat(trashTesting.entryDir(userDataDir, entryId))).resolves.toBeTruthy();
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

  it("finds desktop and start-menu shortcut leftovers for recently uninstalled apps", async () => {
    const desktopShortcut = join(fx.home, "Desktop", "Acme Notes.lnk");
    const publicDesktopShortcut = join(dirname(fx.home), "Public", "Desktop", "Acme Notes Shared.lnk");
    const startMenuShortcut = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme",
      "Acme Notes Helper.lnk"
    );
    const unrelatedShortcut = join(fx.home, "Desktop", "Other Tool.lnk");
    await fs.mkdir(dirname(desktopShortcut), { recursive: true });
    await fs.mkdir(dirname(publicDesktopShortcut), { recursive: true });
    await fs.mkdir(dirname(startMenuShortcut), { recursive: true });
    await fs.writeFile(desktopShortcut, "shortcut", "utf8");
    await fs.writeFile(publicDesktopShortcut, "shortcut", "utf8");
    await fs.writeFile(startMenuShortcut, "shortcut", "utf8");
    await fs.writeFile(unrelatedShortcut, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });

    const shortcutPaths = snapshot.groups[0].paths
      .filter((p) => p.kind === "shortcut")
      .map((p) => p.path)
      .sort();
    expect(shortcutPaths).toEqual([desktopShortcut, publicDesktopShortcut, startMenuShortcut].sort());
  });

  it("finds app start-menu shortcut folders without listing their child shortcuts twice", async () => {
    const startMenuFolder = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes"
    );
    const nestedShortcut = join(startMenuFolder, "Acme Notes.lnk");
    await fs.mkdir(startMenuFolder, { recursive: true });
    await fs.writeFile(nestedShortcut, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });

    const groupPaths = snapshot.groups[0].paths;
    expect(groupPaths.find((p) => p.path === startMenuFolder)).toMatchObject({
      kind: "shortcut-folder",
      exists: true,
      protectedBy: undefined
    });
    expect(groupPaths.some((p) => p.path === nestedShortcut)).toBe(false);
  });

  it("does not treat desktop folders as shortcut-folder leftovers", async () => {
    const desktopFolder = join(fx.home, "Desktop", "Acme Notes");
    await fs.mkdir(desktopFolder, { recursive: true });
    await fs.writeFile(join(desktopFolder, "notes.txt"), "user data", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });

    expect(snapshot.groups.some((group) => group.paths.some((p) => p.path === desktopFolder))).toBe(false);
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

  it("allows an exact Program Files install folder for a recently uninstalled app", async () => {
    const installFolder = join(fx.root, "Program Files", "Acme Notes");
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

    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder);
    expect(path).toMatchObject({
      kind: "install-folder",
      exists: true,
      protectedBy: undefined
    });
  });

  it("keeps nested Program Files-looking install folders protected", async () => {
    const installFolder = join(fx.root, "Backups", "Program Files", "Acme Notes");
    await fs.mkdir(installFolder, { recursive: true });
    await fs.writeFile(join(installFolder, "user-note.txt"), "private", "utf8");

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

    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder);
    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/Program Files|설치|루트|넓은|자동 정리/);
    await expect(fs.readFile(join(installFolder, "user-note.txt"), "utf8")).resolves.toBe(
      "private"
    );
  });

  it("keeps Program Files install folders protected when the Program Files parent is a link", async () => {
    if (process.platform === "win32") return;
    const programFilesLink = join(fx.root, "Program Files");
    const outsideProgramFiles = join(fx.root, "outside-program-files");
    const realInstallFolder = join(outsideProgramFiles, "Acme Notes");
    const installFolder = join(programFilesLink, "Acme Notes");
    await fs.mkdir(realInstallFolder, { recursive: true });
    await fs.writeFile(join(realInstallFolder, "AcmeNotes.exe"), "binary", "utf8");
    await fs.symlink(outsideProgramFiles, programFilesLink, "dir");

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

    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder);
    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/링크|link/i);
    await expect(fs.readFile(join(realInstallFolder, "AcmeNotes.exe"), "utf8")).resolves.toBe("binary");
  });

  it("keeps nested Program Files install folders protected when the Program Files ancestor is a link", async () => {
    if (process.platform === "win32") return;
    const programFilesLink = join(fx.root, "Program Files");
    const outsideProgramFiles = join(fx.root, "outside-program-files");
    const realInstallFolder = join(outsideProgramFiles, "Acme Corp", "Acme Notes");
    const installFolder = join(programFilesLink, "Acme Corp", "Acme Notes");
    await fs.mkdir(realInstallFolder, { recursive: true });
    await fs.writeFile(join(realInstallFolder, "AcmeNotes.exe"), "binary", "utf8");
    await fs.symlink(outsideProgramFiles, programFilesLink, "dir");

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

    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder);
    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/링크|link/i);
    await expect(fs.readFile(join(realInstallFolder, "AcmeNotes.exe"), "utf8")).resolves.toBe("binary");
  });

  it("keeps mismatched Program Files install folders protected", async () => {
    const installFolder = join(fx.root, "Program Files", "Shared Tools");
    await fs.mkdir(installFolder, { recursive: true });
    await fs.writeFile(join(installFolder, "shared.dll"), "binary", "utf8");

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

    const path = snapshot.groups[0].paths.find((p) => p.path === installFolder);
    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/Program Files|installed applications|설치/);
  });

  it("does not expose a Program Files file as a selectable install folder", async () => {
    const installFile = join(fx.root, "Program Files", "Acme Notes");
    await fs.mkdir(dirname(installFile), { recursive: true });
    await fs.writeFile(installFile, "not a folder", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [
        {
          name: "Acme Notes",
          publisher: "Acme Corp.",
          installLocation: installFile
        }
      ]
    });

    const path = snapshot.groups[0].paths.find((p) => p.path === installFile);
    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/Program Files|installed applications|설치/);
  });

  it("moves a selected shortcut leftover into the 30-day trash after uninstall follow-up", async () => {
    const desktopShortcut = join(fx.home, "Desktop", "Acme Notes.lnk");
    await fs.mkdir(dirname(desktopShortcut), { recursive: true });
    await fs.writeFile(desktopShortcut, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === desktopShortcut)!;
    expect(path.kind).toBe("shortcut");

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
    await expect(fs.stat(desktopShortcut)).rejects.toThrow();

    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(1);
    expect(trash.entries[0].originalPath).toBe(desktopShortcut);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("moves a selected start-menu shortcut folder into the 30-day trash after uninstall follow-up", async () => {
    const startMenuFolder = join(
      fx.programData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes"
    );
    await fs.mkdir(startMenuFolder, { recursive: true });
    await fs.writeFile(join(startMenuFolder, "Acme Notes.lnk"), "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startMenuFolder)!;
    expect(path).toMatchObject({ kind: "shortcut-folder", exists: true });
    expect(path.protectedBy).toBeUndefined();

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
    expect(result.removedItems[0].trashEntryId).toBeTruthy();
    await expect(fs.stat(startMenuFolder)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries[0].originalPath).toBe(startMenuFolder);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("moves a selected Program Files install folder into the 30-day trash after uninstall follow-up", async () => {
    const installFolder = join(fx.root, "Program Files", "Acme Notes");
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
    expect(path).toMatchObject({ kind: "install-folder", exists: true });

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
    expect(result.removedItems[0].trashEntryId).toBeTruthy();
    await expect(fs.stat(installFolder)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries[0].originalPath).toBe(installFolder);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("blocks a stale install-folder plan if the path is changed to a nested Program Files alias", async () => {
    const installFolder = join(fx.root, "Program Files", "Acme Notes");
    const aliasFolder = join(fx.root, "Backups", "Program Files", "Acme Notes");
    await fs.mkdir(installFolder, { recursive: true });
    await fs.mkdir(aliasFolder, { recursive: true });
    await fs.writeFile(join(installFolder, "AcmeNotes.exe"), "binary", "utf8");
    await fs.writeFile(join(aliasFolder, "AcmeNotes.exe"), "binary", "utf8");

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
    expect(path.kind).toBe("install-folder");
    const plannedTime = new Date(path.lastModifiedAt!);
    await fs.utimes(join(aliasFolder, "AcmeNotes.exe"), plannedTime, plannedTime);
    await fs.utimes(aliasFolder, plannedTime, plannedTime);
    path.path = aliasFolder;

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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: aliasFolder,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/Program Files|설치|안전/);
    await expect(fs.readFile(join(aliasFolder, "AcmeNotes.exe"), "utf8")).resolves.toBe(
      "binary"
    );
  });

  it("refuses shortcut-folder cleanup when the folder was replaced with a file after the plan", async () => {
    const startMenuFolder = join(
      fx.programData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes"
    );
    await fs.mkdir(startMenuFolder, { recursive: true });
    await fs.writeFile(join(startMenuFolder, "Acme Notes.lnk"), "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startMenuFolder)!;
    const plannedTime = new Date(path.lastModifiedAt!);
    await fs.rm(startMenuFolder, { recursive: true, force: true });
    await fs.writeFile(startMenuFolder, "shortcut", "utf8");
    await fs.utimes(startMenuFolder, plannedTime, plannedTime);

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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: startMenuFolder,
      reason: "blocked-path"
    });
    await expect(fs.readFile(startMenuFolder, "utf8")).resolves.toBe("shortcut");
  });

  it("moves all-user start-menu shortcut leftovers into the 30-day trash", async () => {
    const startMenuShortcut = join(
      fx.programData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(startMenuShortcut), { recursive: true });
    await fs.writeFile(startMenuShortcut, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startMenuShortcut)!;
    expect(path).toMatchObject({ kind: "shortcut", exists: true });
    expect(path.protectedBy).toBeUndefined();

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
    await expect(fs.stat(startMenuShortcut)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries[0].originalPath).toBe(startMenuShortcut);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("moves all-user desktop shortcut leftovers into the 30-day trash", async () => {
    const publicDesktopShortcut = join(dirname(fx.home), "Public", "Desktop", "Acme Notes.lnk");
    await fs.mkdir(dirname(publicDesktopShortcut), { recursive: true });
    await fs.writeFile(publicDesktopShortcut, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === publicDesktopShortcut)!;
    expect(path).toMatchObject({ kind: "shortcut", exists: true });
    expect(path.protectedBy).toBeUndefined();

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
    await expect(fs.stat(publicDesktopShortcut)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries[0].originalPath).toBe(publicDesktopShortcut);
    expect(trash.entries[0].expiresAt).toBe("2026-06-18T00:00:00.000Z");
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

  it("returns the app leftover cleanup result when history recording fails after moving files", async () => {
    const installFolder = join(fx.localAppData, "Programs", "Acme Notes");
    const userDataDir = join(fx.root, "userdata");
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
        userDataDir,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        recordCleanupExecution: async () => {
          throw new Error("history disk full at C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\history.json");
        }
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(result.totalFreedBytes).toBeGreaterThan(0);
    expect(result.logPersistenceWarning).toBe(CLEANUP_HISTORY_SAVE_WARNING);
    expect(result.logPersistenceWarning).not.toContain("history disk full");
    expect(result.logPersistenceWarning).not.toContain("C:\\Users");
    await expect(fs.stat(installFolder)).rejects.toThrow();
    const trash = await getTrashSnapshot({
      userDataDir,
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(1);
  });

  it.each([
    ["user home", (fx: Fixture) => fx.home],
    ["AppData Local", (fx: Fixture) => fx.localAppData],
    ["AppData LocalLow", (fx: Fixture) => fx.localLow],
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

  it.each([
    ["Desktop", (fx: Fixture) => join(fx.home, "Desktop", "Acme Notes")],
    ["Documents", (fx: Fixture) => join(fx.home, "Documents", "Acme Notes")],
    ["Downloads", (fx: Fixture) => join(fx.home, "Downloads", "Acme Notes")],
    ["Pictures", (fx: Fixture) => join(fx.home, "Pictures", "Acme Notes")],
    ["Videos", (fx: Fixture) => join(fx.home, "Videos", "Acme Notes")],
    ["Music", (fx: Fixture) => join(fx.home, "Music", "Acme Notes")]
  ] as const)("marks personal-folder installLocation leftovers as protected: %s", async (_label, folderFor) => {
    const installLocation = folderFor(fx);
    await fs.mkdir(installLocation, { recursive: true });
    await fs.writeFile(join(installLocation, "user-note.txt"), "private", "utf8");

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
    expect(path?.protectedBy).toMatch(/개인 폴더|바탕화면|문서|다운로드|사진|영상|음악/);
  });

  it("does not trust a Program Files-looking install folder inside Downloads", async () => {
    const installLocation = join(fx.home, "Downloads", "Program Files", "Acme Notes");
    await fs.mkdir(installLocation, { recursive: true });
    await fs.writeFile(join(installLocation, "user-note.txt"), "private", "utf8");

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

    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/개인 폴더|바탕화면|문서|다운로드|사진|영상|음악/);
  });

  it("does not trust a Program Files-looking install folder anywhere under the user home", async () => {
    const installLocation = join(fx.home, "Work", "Program Files", "Acme Notes");
    await fs.mkdir(installLocation, { recursive: true });
    await fs.writeFile(join(installLocation, "work-note.txt"), "private", "utf8");

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

    expect(path?.kind).toBe("folder");
    expect(path?.protectedBy).toMatch(/개인 폴더|사용자 폴더|home|user/i);
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
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
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

    const registryBackups = await listRegistryBackups({ userDataDir: join(fx.root, "userdata") });
    expect(registryBackups.entries[0]).toMatchObject({
      appName: "Acme Notes",
      appPublisher: "Acme Corp.",
      keyPath: registryKeyPath
    });
  });

  it("rejects unsafe uninstall registry key paths before consuming the leftover plan", async () => {
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
    const originalPath = path.path;
    path.path = "HKCU\\Software\\Acme Notes";
    const registryRunner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: join(fx.root, "userdata"),
          registryRunner
        }
      )
    ).rejects.toThrow(/leftover plan metadata|uninstall registry key|registry key/);

    expect(registryRunner.exportKey).not.toHaveBeenCalled();
    expect(registryRunner.deleteKey).not.toHaveBeenCalled();

    path.path = originalPath;
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
    expect(result.removedItems).toHaveLength(1);
  });

  it("moves a selected startup-folder trace into the 30-day startup holding bin after uninstall follow-up", async () => {
    const startupShortcut = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(startupShortcut), { recursive: true });
    await fs.writeFile(startupShortcut, "shortcut", "utf8");
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "startup-folder|acme-notes",
        kind: "startup-folder",
        name: "Acme\nNotes.lnk",
        path: startupShortcut,
        publisher: "Acme Corp.",
        origin: dirname(startupShortcut)
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startupShortcut)!;
    expect(path).toMatchObject({
      kind: "startup-folder",
      exists: true,
      startupEntryId: "startup-folder|acme-notes",
      startupEntryName: "Acme Notes.lnk",
      startupOrigin: dirname(startupShortcut)
    });
    expect(path.protectedBy).toBeUndefined();

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
    expect(result.removedItems[0]).toMatchObject({
      itemId: path.id,
      path: startupShortcut,
      sizeBytes: 0,
      categoryId: "app-leftovers",
      mode: "trash",
      succeeded: true,
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    expect(result.removedItems[0].startupDisabledId).toBeTruthy();
    expect(result.removedItems[0].trashEntryId).toBeUndefined();
    expect(result.totalFreedBytes).toBe(0);
    expect(result.logEntry.categories).toEqual([
      { categoryId: "app-leftovers", bytesFreed: 0, itemCount: 1 }
    ]);
    await expect(fs.stat(startupShortcut)).rejects.toThrow();

    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(0);

    const disabled = await listDisabledStartupFolderEntries({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(disabled.entries[0]).toMatchObject({
      id: result.removedItems[0].startupDisabledId,
      name: "Acme Notes.lnk",
      originalPath: startupShortcut,
      origin: dirname(startupShortcut),
      expiresAt: "2026-06-18T00:00:00.000Z",
      integrityStatus: "verified"
    });
  });

  it("does not count a startup-folder cleanup as successful when the source still exists", async () => {
    const startupShortcut = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(startupShortcut), { recursive: true });
    await fs.writeFile(startupShortcut, "shortcut", "utf8");
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "startup-folder|acme-notes",
        kind: "startup-folder",
        name: "Acme Notes.lnk",
        path: startupShortcut,
        publisher: "Acme Corp.",
        origin: dirname(startupShortcut)
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startupShortcut)!;
    const disableStartupFolderEntry = vi.fn(async () => ({
      status: "disabled" as const,
      message: "ok",
      entry: {
        id: "safe-startup-holding",
        entryId: "startup-folder|acme-notes",
        name: "Acme Notes.lnk",
        originalPath: startupShortcut,
        storedPath: join(
          fx.root,
          "userdata",
          "formatbuddy-startup-disabled",
          "items",
          "safe-startup-holding",
          "files",
          "Acme Notes.lnk"
        ),
        origin: dirname(startupShortcut),
        disabledAt: "2026-05-19T00:00:00.000Z",
        expiresAt: "2026-06-18T00:00:00.000Z",
        integrityStatus: "verified" as const
      }
    }));

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        disableStartupFolderEntry
      }
    );

    expect(result.removedItems).toHaveLength(0);
    const skipped = result.skippedItems.find((item) => item.itemId === path.id);
    expect(skipped).toMatchObject({ reason: "execute-failed" });
    expect(skipped?.detail).toBe("시작 항목 원래 위치가 아직 남아 있어서 완료로 보지 않았어요.");
    expect(skipped?.detail).not.toMatch(/source|still exists/i);
    await expect(fs.readFile(startupShortcut, "utf8")).resolves.toBe("shortcut");
  });

  it("does not count a startup-folder cleanup as successful without a stored holding file", async () => {
    const startupShortcut = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(startupShortcut), { recursive: true });
    await fs.writeFile(startupShortcut, "shortcut", "utf8");
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "startup-folder|acme-notes",
        kind: "startup-folder",
        name: "Acme Notes.lnk",
        path: startupShortcut,
        publisher: "Acme Corp.",
        origin: dirname(startupShortcut)
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startupShortcut)!;
    const missingStoredPath = join(
      fx.root,
      "userdata",
      "formatbuddy-startup-disabled",
      "items",
      "safe-startup-holding",
      "files",
      "Acme Notes.lnk"
    );
    const disableStartupFolderEntry = vi.fn(async () => {
      await fs.rm(startupShortcut, { force: true });
      return {
        status: "disabled" as const,
        message: "ok",
        entry: {
          id: "safe-startup-holding",
          entryId: "startup-folder|acme-notes",
          name: "Acme Notes.lnk",
          originalPath: startupShortcut,
          storedPath: missingStoredPath,
          origin: dirname(startupShortcut),
          disabledAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z",
          contentHash: {
            algorithm: "sha256" as const,
            value: "a".repeat(64)
          },
          integrityStatus: "verified" as const
        }
      };
    });

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        disableStartupFolderEntry
      }
    );

    expect(result.removedItems).toHaveLength(0);
    const skipped = result.skippedItems.find((item) => item.itemId === path.id);
    expect(skipped).toMatchObject({ reason: "execute-failed" });
    expect(skipped?.detail).toMatch(/stored|보관|holding/i);
  });

  it("does not count a startup-folder cleanup as successful when the stored holding hash does not match", async () => {
    const startupShortcut = join(
      fx.roaming,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(startupShortcut), { recursive: true });
    await fs.writeFile(startupShortcut, "shortcut", "utf8");
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "startup-folder|acme-notes",
        kind: "startup-folder",
        name: "Acme Notes.lnk",
        path: startupShortcut,
        publisher: "Acme Corp.",
        origin: dirname(startupShortcut)
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === startupShortcut)!;
    const storedPath = join(
      fx.root,
      "userdata",
      "formatbuddy-startup-disabled",
      "items",
      "safe-startup-holding",
      "files",
      "Acme Notes.lnk"
    );
    const disableStartupFolderEntry = vi.fn(async () => {
      await fs.mkdir(dirname(storedPath), { recursive: true });
      await fs.rm(startupShortcut, { force: true });
      await fs.writeFile(storedPath, "changed shortcut", "utf8");
      return {
        status: "disabled" as const,
        message: "ok",
        entry: {
          id: "safe-startup-holding",
          entryId: "startup-folder|acme-notes",
          name: "Acme Notes.lnk",
          originalPath: startupShortcut,
          storedPath,
          origin: dirname(startupShortcut),
          disabledAt: "2026-05-19T00:00:00.000Z",
          expiresAt: "2026-06-18T00:00:00.000Z",
          contentHash: {
            algorithm: "sha256" as const,
            value: "a".repeat(64)
          },
          integrityStatus: "verified" as const
        }
      };
    });

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        disableStartupFolderEntry
      }
    );

    expect(result.removedItems).toHaveLength(0);
    const skipped = result.skippedItems.find((item) => item.itemId === path.id);
    expect(skipped).toMatchObject({ reason: "execute-failed" });
    expect(skipped?.detail).toBe("시작 항목 보관 파일이 바뀐 것 같아 정리하지 않았어요.");
    expect(skipped?.detail).not.toMatch(/hash|integrity|changed/i);
  });

  it("surfaces service and scheduled-task traces as protected app deletion leftovers", async () => {
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "service|acme-notes",
        kind: "service",
        name: "Acme\nNotes Helper",
        publisher: "Acme Corp.",
        origin: "Windows\n서비스",
        enabled: true
      },
      {
        id: "scheduled-task|acme-notes",
        kind: "scheduled-task",
        name: "Acme Notes\nUpdate",
        path: "\\Acme\\",
        publisher: "Acme Corp.",
        origin: "작업\t스케줄러",
        enabled: true
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });

    const traces = snapshot.groups[0].paths.filter((p) => p.kind === "startup-entry");
    expect(traces).toHaveLength(2);
    expect(traces.map((path) => path.path)).toEqual([
      "Windows 서비스: Acme Notes Helper",
      "작업 스케줄러: Acme Notes Update"
    ]);
    expect(traces.map((path) => path.startupEntryKind)).toEqual(["service", "scheduled-task"]);
    expect(traces.map((path) => path.startupEntryName)).toEqual([
      "Acme Notes Helper",
      "Acme Notes Update"
    ]);
    expect(traces.map((path) => path.startupOrigin)).toEqual(["Windows 서비스", "작업 스케줄러"]);
    expect(traces.every((path) => path.exists)).toBe(true);
    expect(traces.every((path) => path.protectedBy?.includes("시작 항목"))).toBe(true);
  });

  it("rejects tampered manual startup trace metadata before cleanup", async () => {
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries: [
        {
          id: "service|acme-notes",
          kind: "service",
          name: "Acme Notes Helper",
          publisher: "Acme Corp.",
          origin: "Windows 서비스",
          enabled: true
        }
      ]
    });
    const path = snapshot.groups[0].paths.find((p) => p.kind === "startup-entry")!;
    path.startupEntryKind = "registry";

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/startup entry kind|leftover plan metadata/);
  });

  it("backs up and deletes a selected startup registry value after uninstall follow-up", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "registry|acme-notes",
        kind: "registry",
        name: valueName,
        path: "C:\\Acme\\Acme.exe",
        registryKeyPath: keyPath,
        registryValueName: valueName,
        publisher: "Acme Corp.",
        origin: "HKCU Run"
      }
    ];
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.kind === "startup-registry")!;
    expect(path).toMatchObject({
      path: keyPath,
      registryValueName: valueName,
      exists: true
    });
    expect(path.protectedBy).toBeUndefined();

    const registryRunner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(
          backupPath,
          `Windows Registry Editor Version 5.00\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined)
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

    expect(registryRunner.exportValue).toHaveBeenCalledWith(
      keyPath,
      valueName,
      expect.stringMatching(/backup\.reg$/)
    );
    expect(registryRunner.deleteValue).toHaveBeenCalledWith(keyPath, valueName);
    expect(result.removedItems).toHaveLength(1);
    expect(result.removedItems[0]).toMatchObject({
      itemId: path.id,
      path: `${keyPath}\\${valueName}`,
      categoryId: "app-leftovers",
      mode: "trash",
      succeeded: true,
      expiresAt: "2026-06-18T00:00:00.000Z"
    });

    const registryBackups = await listRegistryBackups({ userDataDir: join(fx.root, "userdata") });
    expect(registryBackups.entries[0]).toMatchObject({
      appName: "Acme Notes",
      appPublisher: "Acme Corp.",
      keyPath,
      valueName,
      backupKind: "startup-value"
    });
  });

  it("rejects unsafe startup registry value names before consuming the leftover plan", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "registry|acme-notes",
        kind: "registry",
        name: valueName,
        path: "C:\\Acme\\Acme.exe",
        registryKeyPath: keyPath,
        registryValueName: valueName,
        publisher: "Acme Corp.",
        origin: "HKCU Run"
      }
    ];
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.kind === "startup-registry")!;
    const originalValueName = path.registryValueName;
    path.registryValueName = 'Acme "Notes"';

    const registryRunner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(
          backupPath,
          `Windows Registry Editor Version 5.00\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined)
    };

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: join(fx.root, "userdata"),
          registryRunner
        }
      )
    ).rejects.toThrow(/leftover plan metadata|startup registry value|registry value name/);

    expect(registryRunner.exportValue).not.toHaveBeenCalled();
    expect(registryRunner.deleteValue).not.toHaveBeenCalled();

    path.registryValueName = originalValueName;
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
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects whitespace-padded startup registry value names before consuming the leftover plan", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const valueName = "Acme Notes";
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "registry|acme-notes",
        kind: "registry",
        name: valueName,
        path: "C:\\Acme\\Acme.exe",
        registryKeyPath: keyPath,
        registryValueName: valueName,
        publisher: "Acme Corp.",
        origin: "HKCU Run"
      }
    ];
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });
    const path = snapshot.groups[0].paths.find((p) => p.kind === "startup-registry")!;
    const originalValueName = path.registryValueName;
    path.registryValueName = ` ${valueName}`;

    const registryRunner = {
      exportKey: vi.fn(async () => undefined),
      deleteKey: vi.fn(async () => undefined),
      exportValue: vi.fn(async (_keyPath: string, _valueName: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(
          backupPath,
          `Windows Registry Editor Version 5.00\n\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\n"Acme Notes"="C:\\\\Acme\\\\Acme.exe"\n`,
          "utf8"
        );
      }),
      deleteValue: vi.fn(async () => undefined)
    };

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: join(fx.root, "userdata"),
          registryRunner
        }
      )
    ).rejects.toThrow(/leftover plan metadata|startup registry value|registry value name/);

    expect(registryRunner.exportValue).not.toHaveBeenCalled();
    expect(registryRunner.deleteValue).not.toHaveBeenCalled();

    path.registryValueName = originalValueName;
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
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects whitespace-padded registry key paths before consuming the leftover plan", async () => {
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
    const originalPath = path.path;
    path.path = `${registryKeyPath} `;
    const registryRunner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined)
    };

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        {
          userDataDir: join(fx.root, "userdata"),
          registryRunner
        }
      )
    ).rejects.toThrow(/leftover plan metadata|uninstall registry key|registry key/);

    expect(registryRunner.exportKey).not.toHaveBeenCalled();
    expect(registryRunner.deleteKey).not.toHaveBeenCalled();

    path.path = originalPath;
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
    expect(result.removedItems).toHaveLength(1);
  });

  it("keeps multiple startup registry values under the same Run key as separate cleanup choices", async () => {
    const keyPath = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const startupEntries: StartupAutoEntry[] = [
      {
        id: "registry|acme-notes",
        kind: "registry",
        name: "Acme Notes",
        path: "C:\\Acme\\Acme.exe",
        registryKeyPath: keyPath,
        registryValueName: "Acme Notes",
        publisher: "Acme Corp.",
        origin: "HKCU Run"
      },
      {
        id: "registry|acme-notes-helper",
        kind: "registry",
        name: "Acme Notes Helper",
        path: "C:\\Acme\\Helper.exe",
        registryKeyPath: keyPath,
        registryValueName: "Acme Notes Helper",
        publisher: "Acme Corp.",
        origin: "HKCU Run"
      }
    ];

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }],
      startupEntries
    });

    const startupValues = snapshot.groups[0].paths.filter((p) => p.kind === "startup-registry");
    expect(startupValues.map((p) => p.registryValueName).sort()).toEqual([
      "Acme Notes",
      "Acme Notes Helper"
    ]);
    expect(new Set(startupValues.map((p) => p.id)).size).toBe(2);
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
    expect(result.skippedItems[0].detail).toBe(
      "앱 삭제 흔적 백업을 만들지 못해서 정리하지 않았어요."
    );
    expect(result.skippedItems[0].detail).not.toMatch(/export failed/i);
  });

  it("does not count a registry leftover as successful when the backup disappears after deletion", async () => {
    const registryKeyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp.", registryKeyPath }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === registryKeyPath)!;
    let exportedBackupPath = "";
    const registryRunner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        exportedBackupPath = backupPath;
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => {
        await fs.rm(exportedBackupPath, { force: true });
      })
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

    expect(result.removedItems).toHaveLength(0);
    expect(result.totalFreedBytes).toBe(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: registryKeyPath,
      reason: "execute-failed"
    });
    expect(result.skippedItems[0].detail).toMatch(/백업|backup|보이지|찾지/i);
  });

  it("surfaces a preserved registry backup when the post-delete check fails", async () => {
    const registryKeyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme Notes";
    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp.", registryKeyPath }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === registryKeyPath)!;
    const registryRunner = {
      exportKey: vi.fn(async (_keyPath: string, backupPath: string) => {
        await fs.mkdir(dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, registryBackupContentFor(_keyPath), "utf8");
      }),
      deleteKey: vi.fn(async () => undefined),
      keyExists: vi.fn(async () => {
        throw new Error("post-delete registry check unavailable");
      })
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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: registryKeyPath,
      reason: "execute-failed",
      registryBackupId: expect.any(String),
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    expect(result.skippedItems[0].detail).toMatch(/백업|30일|복구함|남겨/);
    expect(preservedRegistryBackupIds(result, Date.parse("2026-05-20T00:00:00.000Z"))).toEqual([
      result.skippedItems[0].registryBackupId
    ]);

    const registryBackups = await listRegistryBackups({ userDataDir: join(fx.root, "userdata") });
    expect(registryBackups.entries).toHaveLength(1);
    expect(registryBackups.entries[0]).toMatchObject({
      appName: "Acme Notes",
      appPublisher: "Acme Corp.",
      keyPath: registryKeyPath,
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
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

  it("plans leftovers for a recently opened uninstall window even after the app left the scan", async () => {
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
    expect(snapshot.groups[0].cleanupState).toBe("removed-confirmed");
    expect(snapshot.groups[0].paths.find((p) => p.path === slack)?.exists).toBe(true);
  });

  it("keeps the original app identity when a leftover rule uses a grouped label", async () => {
    const adobe = join(fx.roaming, "Adobe");
    await fs.mkdir(adobe, { recursive: true });
    await fs.writeFile(join(adobe, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]).toMatchObject({
      appName: "Adobe",
      sourceAppName: "Adobe Photoshop 2024",
      source: "uninstall-launched",
      cleanupState: "removed-confirmed"
    });
  });

  it("locks grouped-rule leftovers while a sibling app in the same family is still installed", async () => {
    const adobe = join(fx.roaming, "Adobe");
    await fs.mkdir(adobe, { recursive: true });
    await fs.writeFile(join(adobe, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Adobe Illustrator 2024", publisher: "Adobe Inc." }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
        extraApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]).toMatchObject({
      appName: "Adobe",
      sourceAppName: "Adobe Photoshop 2024",
      source: "uninstall-launched",
      cleanupState: "still-installed"
    });
  });

  it("locks a recently opened uninstall window while the latest scan still shows the app", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");
    const stillInstalledApp = { name: "Slack", publisher: "Slack Technologies" };

    const snapshot = await planAppLeftovers([stillInstalledApp], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [stillInstalledApp]
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].source).toBe("uninstall-launched");
    expect(snapshot.groups[0].cleanupState).toBe("still-installed");

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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      reason: "blocked-path",
      detail: "아직 앱 목록에 있어요. 다시 점검으로 제거 완료를 확인한 뒤 정리해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();
  });

  it("locks a publisher-missing uninstall follow-up when the same app name remains installed", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers(
      [{ name: "Slack", publisher: "Slack Technologies" }],
      {
        home: fx.home,
        env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
        extraApps: [{ name: "Slack", publisher: null }]
      }
    );

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0].cleanupState).toBe("still-installed");
  });

  it("locks a recently opened uninstall window when no latest scan exists yet", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }],
      installedAppsKnown: false
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]).toMatchObject({
      source: "uninstall-launched",
      cleanupState: "not-checked"
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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      reason: "blocked-path",
      detail: "제거 완료 여부를 아직 확인하지 못했어요. 다시 점검 후 정리해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();
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

    const unsafeResult = await cleanupAppLeftoversBase(
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

    expect(unsafeResult.removedItems).toHaveLength(0);
    expect(unsafeResult.skippedItems[0]).toMatchObject({
      itemId: path.id,
      reason: "blocked-path",
      detail: "앱 제거 완료 여부를 지금 다시 확인하지 못했어요. 다시 점검한 뒤 정리해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();

    const freshSnapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const freshPath = freshSnapshot.groups[0].paths.find((p) => p.path === slack)!;

    const result = await cleanupAppLeftovers(
      {
        planId: freshSnapshot.planId,
        confirmationToken: freshSnapshot.confirmationToken,
        selectedPathIds: [freshPath.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        currentInstalledAppsKnown: true,
        currentInstalledApps: []
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

  it("refuses to clean app leftovers when the app was installed again after the plan", async () => {
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
        currentInstalledAppsKnown: true,
        currentInstalledApps: [{ name: "Slack", publisher: "Slack Technologies" }]
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: slack,
      reason: "blocked-path",
      detail: "앱이 다시 설치된 상태예요. 제거가 끝난 뒤 다시 점검하고 정리해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();
    const trash = await getTrashSnapshot({ userDataDir: join(fx.root, "userdata") });
    expect(trash.entries).toEqual([]);
  });

  it("refuses grouped-rule leftovers when the original app was installed again after the plan", async () => {
    const adobe = join(fx.roaming, "Adobe");
    await fs.mkdir(adobe, { recursive: true });
    await fs.writeFile(join(adobe, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === adobe)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        currentInstalledAppsKnown: true,
        currentInstalledApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: adobe,
      reason: "blocked-path",
      detail: "앱이 다시 설치된 상태예요. 제거가 끝난 뒤 다시 점검하고 정리해주세요."
    });
    await expect(fs.stat(adobe)).resolves.toBeTruthy();
    const trash = await getTrashSnapshot({ userDataDir: join(fx.root, "userdata") });
    expect(trash.entries).toEqual([]);
  });

  it("refuses grouped-rule leftovers when a sibling app in the same family was installed after the plan", async () => {
    const adobe = join(fx.roaming, "Adobe");
    await fs.mkdir(adobe, { recursive: true });
    await fs.writeFile(join(adobe, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === adobe)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        currentInstalledAppsKnown: true,
        currentInstalledApps: [{ name: "Adobe Illustrator 2024", publisher: "Adobe Inc." }]
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: adobe,
      reason: "blocked-path",
      detail: "앱이 다시 설치된 상태예요. 제거가 끝난 뒤 다시 점검하고 정리해주세요."
    });
    await expect(fs.stat(adobe)).resolves.toBeTruthy();
    const trash = await getTrashSnapshot({ userDataDir: join(fx.root, "userdata") });
    expect(trash.entries).toEqual([]);
  });

  it("forgets grouped-rule follow-ups by original app identity after cleanup", async () => {
    const adobe = join(fx.roaming, "Adobe");
    await fs.mkdir(adobe, { recursive: true });
    await fs.writeFile(join(adobe, "cache.bin"), "abc", "utf8");
    const onFollowupCleaned = vi.fn();

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Adobe Photoshop 2024", publisher: "Adobe Inc." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === adobe)!;

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        onFollowupCleaned
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(onFollowupCleaned).toHaveBeenCalledWith({
      name: "Adobe Photoshop 2024",
      publisher: "Adobe Inc."
    });
  });

  it("refuses to clean app leftovers when current install state could not be checked", async () => {
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
        currentInstalledAppsKnown: false,
        currentInstalledApps: []
      }
    );

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: slack,
      reason: "blocked-path",
      detail: "앱 제거 완료 여부를 지금 다시 확인하지 못했어요. 다시 점검한 뒤 정리해주세요."
    });
    await expect(fs.stat(slack)).resolves.toBeTruthy();
    const trash = await getTrashSnapshot({ userDataDir: join(fx.root, "userdata") });
    expect(trash.entries).toEqual([]);
  });

  it("refuses to clean app leftovers when the folder changed after the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    const cacheFile = join(slack, "cache.bin");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(cacheFile, "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;

    await fs.writeFile(cacheFile, "new important app data", "utf8");

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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: slack,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/다시 점검|바뀌/);
    await expect(fs.readFile(cacheFile, "utf8")).resolves.toBe("new important app data");
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toEqual([]);
  });

  it("refuses to clean an app leftover folder when it became a file after the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    const cacheFile = join(slack, "cache.bin");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(cacheFile, "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const plannedTime = new Date(path.lastModifiedAt!);
    expect(path).toMatchObject({ kind: "folder", sizeBytes: 3 });

    await fs.rm(slack, { recursive: true, force: true });
    await fs.writeFile(slack, "abc", "utf8");
    await fs.utimes(slack, plannedTime, plannedTime);

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

    expect(result.removedItems).toHaveLength(0);
    expect(result.skippedItems[0]).toMatchObject({
      itemId: path.id,
      path: slack,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/종류|폴더|다시 점검/);
    await expect(fs.readFile(slack, "utf8")).resolves.toBe("abc");
    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toEqual([]);
  });

  it("notifies the caller to close the uninstall follow-up after a successful leftover cleanup", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const onFollowupCleaned = vi.fn();

    await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        onFollowupCleaned
      }
    );

    expect(onFollowupCleaned).toHaveBeenCalledTimes(1);
    expect(onFollowupCleaned).toHaveBeenCalledWith({
      name: "Slack",
      publisher: "Slack Technologies"
    });
  });

  it("keeps the uninstall follow-up open when only part of an app's leftovers were cleaned", async () => {
    const roamingSlack = join(fx.roaming, "Slack");
    const localSlack = join(fx.localAppData, "slack");
    await fs.mkdir(roamingSlack, { recursive: true });
    await fs.mkdir(localSlack, { recursive: true });
    await fs.writeFile(join(roamingSlack, "cache.bin"), "abc", "utf8");
    await fs.writeFile(join(localSlack, "state.bin"), "still here", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const selectedPath = snapshot.groups[0].paths.find((p) => p.path === roamingSlack)!;
    expect(snapshot.groups[0].paths.filter((p) => p.exists)).toHaveLength(2);
    const onFollowupCleaned = vi.fn();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [selectedPath.id]
      },
      {
        userDataDir: join(fx.root, "userdata"),
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        onFollowupCleaned
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(result.skippedItems).toEqual([
      { itemId: expect.any(String), path: localSlack, reason: "not-selected" }
    ]);
    expect(onFollowupCleaned).not.toHaveBeenCalled();
    await expect(fs.stat(roamingSlack)).rejects.toThrow();
    await expect(fs.stat(localSlack)).resolves.toBeTruthy();
  });

  it("keeps app leftover cleanup results when the uninstall follow-up update fails", async () => {
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
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        onFollowupCleaned: async () => {
          throw new Error("followup store failed at C:\\Users\\Ryan\\AppData\\Local\\FormatBuddy\\state.json");
        }
      }
    );

    expect(result.removedItems).toHaveLength(1);
    expect(result.totalFreedBytes).toBeGreaterThan(0);
    expect(result.followupPersistenceWarning).toBe(CLEANUP_FOLLOWUP_SAVE_WARNING);
    expect(result.followupPersistenceWarning).not.toContain("followup store failed");
    expect(result.followupPersistenceWarning).not.toContain("C:\\Users");
    await expect(fs.stat(slack)).rejects.toThrow();

    const trash = await getTrashSnapshot({
      userDataDir: join(fx.root, "userdata"),
      now: () => new Date("2026-05-20T00:00:00.000Z")
    });
    expect(trash.entries).toHaveLength(1);
    expect(trash.entries[0].originalPath).toBe(slack);
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

  it("reports a blocked path when an all-user shortcut root becomes a symbolic-link parent before cleanup", async () => {
    if (process.platform === "win32") return;
    const shortcutPath = join(
      fx.programData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes.lnk"
    );
    await fs.mkdir(dirname(shortcutPath), { recursive: true });
    await fs.writeFile(shortcutPath, "shortcut", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Acme Notes", publisher: "Acme Corp." }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === shortcutPath)!;
    const plannedTime = new Date(path.lastModifiedAt!);

    const outsideProgramData = join(fx.root, "outside-program-data");
    const outsideShortcut = join(
      outsideProgramData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Acme Notes.lnk"
    );
    await fs.rm(fx.programData, { recursive: true, force: true });
    await fs.mkdir(dirname(outsideShortcut), { recursive: true });
    await fs.writeFile(outsideShortcut, "shortcut", "utf8");
    await fs.utimes(outsideShortcut, plannedTime, plannedTime);
    await fs.symlink(outsideProgramData, fx.programData, "dir");

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
      path: shortcutPath,
      reason: "blocked-path"
    });
    expect(result.skippedItems[0].detail).toMatch(/링크/);
    await expect(fs.readFile(outsideShortcut, "utf8")).resolves.toBe("shortcut");
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

  it("rejects malformed selectedPathIds before touching any leftover path", async () => {
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
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id, 123 as unknown as string]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/selectedPathIds/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();
  });

  it("rejects duplicate selectedPathIds before touching any leftover path or consuming the plan", async () => {
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
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id, path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/duplicate|selectedPathIds/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects whitespace-padded selectedPathIds before touching any leftover path or consuming the plan", async () => {
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
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [` ${path.id}`]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/whitespace|selectedPathIds/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects control-character plan ids and tokens before consuming the plan", async () => {
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
          planId: `${snapshot.planId.slice(0, 8)}\n${snapshot.planId.slice(8)}`,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/control characters/);

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: `${snapshot.confirmationToken.slice(0, 8)}\r${snapshot.confirmationToken.slice(8)}`,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/control characters/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects control-character selectedPathIds before touching any leftover path or consuming the plan", async () => {
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
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [`${path.id.slice(0, 8)}\n${path.id.slice(8)}`]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/control characters/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects unknown selectedPathIds before touching any leftover path", async () => {
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
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id, "ghost-id-that-does-not-exist"]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/not present in the leftover plan/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();
  });

  it("rejects corrupted leftover plan path metadata before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalPath = path.path;
    path.path = `${originalPath}\n`;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|control characters/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.path = originalPath;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects whitespace-padded leftover plan paths before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalPath = path.path;
    path.path = `${originalPath} `;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|path|whitespace|padded|공백/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.path = originalPath;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects invalid leftover plan modified timestamps before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalLastModifiedAt = path.lastModifiedAt;
    path.lastModifiedAt = "not-a-date";

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|modified|timestamp|date/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.lastModifiedAt = originalLastModifiedAt;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects impossible leftover plan sizes before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalSizeBytes = path.sizeBytes;
    path.sizeBytes = -1;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|size/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.sizeBytes = originalSizeBytes;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects corrupted leftover plan app labels before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalAppName = snapshot.groups[0].appName;
    snapshot.groups[0].appName = `${originalAppName}\n`;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|control characters/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    snapshot.groups[0].appName = originalAppName;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects corrupted leftover plan path kind before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalKind = path.kind;
    path.kind = "registry\n" as unknown as typeof path.kind;

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|kind/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.kind = originalKind;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects relative leftover plan paths before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalPath = path.path;
    path.path = "Slack";

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|absolute|path/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    path.path = originalPath;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects corrupted leftover plan group state before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalSource = snapshot.groups[0].source;
    const originalCleanupState = snapshot.groups[0].cleanupState;
    const mutableGroup = snapshot.groups[0] as unknown as {
      source: string;
      cleanupState: string;
    };
    mutableGroup.source = "uninstall-launched\n";
    mutableGroup.cleanupState = "removed-confirmed\n";

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|source|cleanup state/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    snapshot.groups[0].source = originalSource;
    snapshot.groups[0].cleanupState = originalCleanupState;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
  });

  it("rejects uninstall follow-up plans without a source app identity before consuming the plan", async () => {
    const slack = join(fx.roaming, "Slack");
    await fs.mkdir(slack, { recursive: true });
    await fs.writeFile(join(slack, "cache.bin"), "abc", "utf8");

    const snapshot = await planAppLeftovers([], {
      home: fx.home,
      env: { roaming: fx.roaming, localAppData: fx.localAppData, programData: fx.programData },
      extraApps: [{ name: "Slack", publisher: "Slack Technologies" }]
    });
    const path = snapshot.groups[0].paths.find((p) => p.path === slack)!;
    const originalSourceAppName = snapshot.groups[0].sourceAppName;
    snapshot.groups[0].sourceAppName = " ";

    await expect(
      cleanupAppLeftovers(
        {
          planId: snapshot.planId,
          confirmationToken: snapshot.confirmationToken,
          selectedPathIds: [path.id]
        },
        { userDataDir: join(fx.root, "userdata") }
      )
    ).rejects.toThrow(/leftover plan metadata|source app name/);

    await expect(fs.stat(slack)).resolves.toBeTruthy();

    snapshot.groups[0].sourceAppName = originalSourceAppName;
    const result = await cleanupAppLeftovers(
      {
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds: [path.id]
      },
      { userDataDir: join(fx.root, "userdata") }
    );
    expect(result.removedItems).toHaveLength(1);
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
