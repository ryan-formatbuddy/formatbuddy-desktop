import { describe, expect, it } from "vitest";
import { appUninstallAuditSummary } from "../src/main/apps/uninstallAudit";
import type { AppUninstallResult } from "../src/shared/types";

function result(overrides: Partial<AppUninstallResult>): AppUninstallResult {
  return {
    status: "launched",
    appName: "Friendly Tool",
    message: "ok",
    ...overrides
  };
}

describe("appUninstallAuditSummary", () => {
  it.each([
    ["launched", "실제 삭제 여부"],
    ["app-not-found", "제거 정보를 찾지 못했어요"],
    ["blocked", "안전하게 확인하지 못해"],
    ["no-scan-cache", "점검을 먼저"],
    ["no-uninstall-string", "제거 명령이 없어서"],
    ["spawn-failed", "제거 창을 열지 못했어요"]
  ] as const)("keeps %s audit summaries friendly", (status, expected) => {
    const summary = appUninstallAuditSummary(result({ status }), "Fallback App");

    expect(summary).toContain(expected);
    expect(summary).not.toMatch(
      /spawn-failed|app-not-found|no-scan-cache|no-uninstall-string|unsafe-uninstall-command|quiet-uninstall-blocked|invalid-uninstall/i
    );
  });

  it("uses a softer system component message for protected apps", () => {
    const summary = appUninstallAuditSummary(
      result({ status: "blocked", detail: "systemComponent=true" }),
      "Friendly Tool"
    );

    expect(summary).toContain("Windows 구성요소");
    expect(summary).not.toContain("systemComponent");
  });

  it("cleans app names before writing audit summaries", () => {
    const summary = appUninstallAuditSummary(
      result({ appName: " Friendly\nTool\0Beta " }),
      "Fallback App"
    );

    expect(summary).toContain("Friendly Tool Beta");
    expect(summary).not.toMatch(/[\u0000-\u001f\u007f]/);
  });
});
