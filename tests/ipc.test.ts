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

  it("channel values are unique", () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });
});
