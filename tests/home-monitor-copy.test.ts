import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HOME_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "Home.tsx"
);

describe("Home monitor copy", () => {
  it("does not hide monitor preference failures behind silent returns", () => {
    const source = readFileSync(HOME_PAGE, "utf8");

    expect(source).toContain("알림 설정을 연결하지 못했어요");
    expect(source).toContain("알림 설정 저장을 연결하지 못했어요");
    expect(source).toContain("prefsMessage");
    expect(source).not.toContain("if (!window.fb?.getMonitorPrefs) return;");
    expect(source).not.toContain("if (!window.fb?.updateMonitorPrefs) return;");
  });
});
