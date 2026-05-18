import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planAppLeftovers } from "../src/main/apps/leftovers";
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
    fx = makeFixture();
  });

  afterEach(() => {
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
    expect(snapshot.groups[0].appName).toBe("KakaoTalk");
    const existing = snapshot.groups[0].paths.find((p) => p.path === kakaoRoaming);
    expect(existing?.exists).toBe(true);
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
});
