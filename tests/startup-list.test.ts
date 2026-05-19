import { describe, expect, it, vi } from "vitest";
import { listStartupAuto, parseStartupPayload, __testing } from "../src/main/startup/list";

describe("parseStartupPayload", () => {
  it("returns empty for non-JSON garbage", () => {
    expect(parseStartupPayload("not json")).toEqual([]);
    expect(parseStartupPayload("")).toEqual([]);
  });

  it("collapses the four shapes into one StartupAutoEntry array", () => {
    const entries = parseStartupPayload(
      JSON.stringify({
        registry: [{ name: "KakaoTalk", path: "C:\\K\\KakaoTalk.exe", origin: "HKCU Run", user: "Ryan" }],
        tasks: [{ name: "Update", path: "\\Microsoft\\", enabled: true, author: "Microsoft" }],
        services: [
          { name: "Spooler", displayName: "Print Spooler", enabled: true, status: "Running" }
        ],
        folderItems: [
          { name: "Steam.lnk", path: "C:\\Users\\Ryan\\AppData\\…\\Startup\\Steam.lnk", origin: "user" }
        ]
      })
    );
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.kind).sort()).toEqual([
      "registry",
      "scheduled-task",
      "service",
      "startup-folder"
    ]);
  });

  it("skips entries missing a name", () => {
    const entries = parseStartupPayload(
      JSON.stringify({
        registry: [{ path: "x" }, { name: "KakaoTalk", path: "y" }],
        tasks: [],
        services: [],
        folderItems: []
      })
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("KakaoTalk");
  });

  it("preserves Korean app + publisher strings exactly", () => {
    const entries = parseStartupPayload(
      JSON.stringify({
        registry: [],
        tasks: [{ name: "한컴 자동 업데이트", author: "한글과컴퓨터" }],
        services: [{ name: "AhnLabSvc", displayName: "안랩 V3 서비스" }],
        folderItems: []
      })
    );
    expect(entries.find((e) => e.kind === "scheduled-task")?.name).toBe("한컴 자동 업데이트");
    expect(entries.find((e) => e.kind === "scheduled-task")?.publisher).toBe("한글과컴퓨터");
    expect(entries.find((e) => e.kind === "service")?.name).toBe("안랩 V3 서비스");
  });

  it("safeId is stable and lowercased", () => {
    expect(__testing.safeId("registry", "KakaoTalk", "C:\\App.exe")).toBe(
      "registry|kakaotalk|c:\\app.exe"
    );
  });
});

describe("listStartupAuto", () => {
  it("short-circuits on non-Windows hosts without invoking PowerShell", async () => {
    const invoke = vi.fn();
    const snapshot = await listStartupAuto({
      platform: "darwin",
      runner: { invoke }
    });
    expect(snapshot.status).toBe("windows-only");
    expect(snapshot.entries).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns parsed entries on a successful PowerShell run", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        registry: [{ name: "KakaoTalk", path: "C:\\K\\KakaoTalk.exe", origin: "HKCU Run" }],
        tasks: [],
        services: [],
        folderItems: []
      }),
      stderr: ""
    }));
    const snapshot = await listStartupAuto({ platform: "win32", runner: { invoke } });
    expect(snapshot.status).toBe("ok");
    expect(snapshot.entries.map((e) => e.name)).toEqual(["KakaoTalk"]);
  });

  it("returns powershell-failed when exit code is non-zero", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "Access denied"
    }));
    const snapshot = await listStartupAuto({ platform: "win32", runner: { invoke } });
    expect(snapshot.status).toBe("powershell-failed");
    expect(snapshot.notes[0]).toMatch(/Access denied/);
  });

  it("classifies a timeout cleanly", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("timeout");
    });
    const snapshot = await listStartupAuto({ platform: "win32", runner: { invoke } });
    expect(snapshot.status).toBe("powershell-failed");
    expect(snapshot.notes[0]).toMatch(/시간/);
  });

  it("notes empty result clearly when entries array is empty", async () => {
    const invoke = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify({ registry: [], tasks: [], services: [], folderItems: [] }),
      stderr: ""
    }));
    const snapshot = await listStartupAuto({ platform: "win32", runner: { invoke } });
    expect(snapshot.status).toBe("ok");
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.notes[0]).toMatch(/찾지 못/);
  });
});
