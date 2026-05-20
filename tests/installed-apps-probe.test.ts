import { describe, expect, it, vi } from "vitest";
import {
  probeInstalledAppsForLeftoverGuard,
  __testing
} from "../src/main/apps/installedAppsProbe";

describe("installed apps leftover guard probe", () => {
  it("parses installed app arrays from the registry probe", () => {
    const apps = __testing.parseInstalledAppsProbe(
      JSON.stringify([
        {
          name: "Slack",
          publisher: "Slack Technologies",
          registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack"
        },
        {
          name: "Bad\u0000Name",
          publisher: "Acme\rCorp"
        },
        {
          name: ""
        }
      ])
    );

    expect(apps).toEqual([
      {
        name: "Slack",
        publisher: "Slack Technologies",
        registryKeyPath: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Slack"
      },
      {
        name: "Bad Name",
        publisher: "Acme Corp",
        registryKeyPath: null
      }
    ]);
  });

  it("parses a single installed app object from PowerShell JSON", () => {
    expect(
      __testing.parseInstalledAppsProbe(
        JSON.stringify({
          name: "KakaoTalk",
          publisher: "Kakao"
        })
      )
    ).toEqual([
      {
        name: "KakaoTalk",
        publisher: "Kakao",
        registryKeyPath: null
      }
    ]);
  });

  it("throws when the live probe cannot confirm installed app state", async () => {
    await expect(
      probeInstalledAppsForLeftoverGuard({
        platform: "win32",
        runner: {
          run: vi.fn(async () => ({
            stdout: "",
            stderr: "Access denied at C:\\Users\\Ryan\\AppData",
            code: 1,
            timedOut: false
          }))
        }
      })
    ).rejects.toThrow("installed-apps-probe-failed");
  });

  it("returns parsed apps from the injected Windows runner", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([{ name: "Slack", publisher: "Slack Technologies" }]),
        stderr: "",
        code: 0,
        timedOut: false
      }))
    };

    const apps = await probeInstalledAppsForLeftoverGuard({
      platform: "win32",
      runner
    });

    expect(runner.run).toHaveBeenCalledWith(
      expect.stringContaining("CurrentVersion\\Uninstall"),
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(apps).toEqual([
      {
        name: "Slack",
        publisher: "Slack Technologies",
        registryKeyPath: null
      }
    ]);
  });
});
