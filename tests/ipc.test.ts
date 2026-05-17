import { describe, it, expect } from "vitest";
import { IpcChannels } from "../src/shared/ipc";

describe("IpcChannels", () => {
  it("contains all expected channels", () => {
    expect(IpcChannels.scanStart).toBe("scan:start");
    expect(IpcChannels.scanCancel).toBe("scan:cancel");
    expect(IpcChannels.scanProgress).toBe("scan:progress");
    expect(IpcChannels.scanComplete).toBe("scan:complete");
    expect(IpcChannels.scanError).toBe("scan:error");
    expect(IpcChannels.reportExport).toBe("report:export");
    expect(IpcChannels.reportOpenWeb).toBe("report:open-web");
    expect(IpcChannels.appVersion).toBe("app:version");
  });

  it("channel values are unique", () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });
});
