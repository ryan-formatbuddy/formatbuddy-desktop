import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("moves selected app leftovers into the FormatBuddy 30-day trash", async () => {
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

  it("refuses protected leftover cleanup even with a valid plan", async () => {
    const kakaoRoaming = join(fx.roaming, "KakaoTalk");
    await fs.mkdir(kakaoRoaming, { recursive: true });
    await fs.writeFile(join(kakaoRoaming, "talk.db"), "secret", "utf8");

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
