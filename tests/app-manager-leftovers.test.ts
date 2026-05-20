import { describe, expect, it } from "vitest";
import {
  selectableLeftoverPathIds,
  summarizeLeftoverSnapshot
} from "../src/shared/app-leftovers";
import type { AppLeftoversSnapshot } from "../src/shared/types";

describe("AppManager leftover summary", () => {
  it("counts selectable, protected, missing, and still-installed leftover paths separately", () => {
    const snapshot: AppLeftoversSnapshot = {
      planId: "plan-1",
      confirmationToken: "token-1",
      generatedAt: "2026-05-19T00:00:00.000Z",
      groups: [
        {
          appName: "Acme Notes",
          source: "uninstall-launched",
          cleanupState: "removed-confirmed",
          paths: [
            { id: "selectable", path: "C:\\Users\\Ryan\\AppData\\Roaming\\Acme", exists: true },
            {
              id: "protected",
              path: "C:\\Users\\Ryan\\AppData\\Roaming\\KakaoTalk",
              exists: true,
              protectedBy: "KakaoTalk"
            },
            { id: "missing", path: "C:\\ProgramData\\Acme", exists: false }
          ]
        },
        {
          appName: "Still Installed",
          source: "installed",
          paths: [
            {
              id: "installed",
              path: "C:\\Users\\Ryan\\AppData\\Roaming\\StillInstalled",
              exists: true
            }
          ]
        },
        {
          appName: "Need Check",
          source: "uninstall-launched",
          cleanupState: "not-checked",
          paths: [
            {
              id: "not-checked",
              path: "C:\\Users\\Ryan\\AppData\\Roaming\\NeedCheck",
              exists: true
            }
          ]
        },
        {
          appName: "Manual Trace",
          source: "uninstall-launched",
          cleanupState: "removed-confirmed",
          paths: [
            {
              id: "manual-trace",
              kind: "startup-entry",
              startupEntryKind: "scheduled-task",
              path: "작업 스케줄러: Manual Trace Update",
              exists: true,
              protectedBy: "서비스·예약 작업은 수동 확인이 필요해요."
            }
          ]
        }
      ]
    };

    expect(summarizeLeftoverSnapshot(snapshot)).toEqual({
      total: 6,
      selectable: 1,
      protected: 1,
      missing: 1,
      installedLocked: 1,
      notChecked: 1,
      manualCheck: 1
    });
    expect(selectableLeftoverPathIds(snapshot)).toEqual(new Set(["selectable"]));
  });
});
