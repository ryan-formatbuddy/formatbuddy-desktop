import { describe, it, expect } from "vitest";
import { IpcChannels } from "../src/shared/ipc";

describe("IpcChannels", () => {
  it("contains all expected scan/report/app channels", () => {
    expect(IpcChannels.scanStart).toBe("scan:start");
    expect(IpcChannels.scanCancel).toBe("scan:cancel");
    expect(IpcChannels.scanProgress).toBe("scan:progress");
    expect(IpcChannels.scanComplete).toBe("scan:complete");
    expect(IpcChannels.scanError).toBe("scan:error");
    expect(IpcChannels.reportExport).toBe("report:export");
    expect(IpcChannels.reportOpenWeb).toBe("report:open-web");
    expect(IpcChannels.appVersion).toBe("app:version");
    expect(IpcChannels.appPlatform).toBe("app:platform");
  });

  it("contains all expected update channels", () => {
    expect(IpcChannels.updateChecking).toBe("update:checking");
    expect(IpcChannels.updateAvailable).toBe("update:available");
    expect(IpcChannels.updateNotAvailable).toBe("update:not-available");
    expect(IpcChannels.updateDownloadProgress).toBe("update:download-progress");
    expect(IpcChannels.updateDownloaded).toBe("update:downloaded");
    expect(IpcChannels.updateError).toBe("update:error");
    expect(IpcChannels.updateInstall).toBe("update:install");
  });

  it("contains manifest channel", () => {
    expect(IpcChannels.manifestExport).toBe("manifest:export");
  });

  it("contains local state channels", () => {
    expect(IpcChannels.appStateGet).toBe("app-state:get");
    expect(IpcChannels.ignoreListUpdate).toBe("ignore-list:update");
  });

  it("contains registry backup restore-bin channels", () => {
    expect(IpcChannels.registryBackupsList).toBe("registry-backups:list");
    expect(IpcChannels.registryBackupRestore).toBe("registry-backups:restore");
  });

  it("contains startup auto-toggle channels", () => {
    expect(IpcChannels.startupList).toBe("startup:list");
    expect(IpcChannels.startupDisabledList).toBe("startup:disabled-list");
    expect(IpcChannels.startupDisable).toBe("startup:disable");
    expect(IpcChannels.startupRestore).toBe("startup:restore");
  });

  it("channel values are unique", () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });
});
