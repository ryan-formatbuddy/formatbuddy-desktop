import { describe, expect, it } from "vitest";
import { summarizeLeftoverSnapshot } from "../src/shared/app-leftovers";
import type { AppLeftoversSnapshot } from "../src/shared/types";

describe("AppManager leftover summary", () => {
  it("counts selectable, protected, and missing leftover paths separately", () => {
    const snapshot: AppLeftoversSnapshot = {
      planId: "plan-1",
      confirmationToken: "token-1",
      generatedAt: "2026-05-19T00:00:00.000Z",
      groups: [
        {
          appName: "Acme Notes",
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
        }
      ]
    };

    expect(summarizeLeftoverSnapshot(snapshot)).toEqual({
      total: 3,
      selectable: 1,
      protected: 1,
      missing: 1
    });
  });
});
