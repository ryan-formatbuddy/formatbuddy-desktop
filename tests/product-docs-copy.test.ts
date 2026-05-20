import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

const USER_HELP_DOCS = ["docs/FAQ.md", "docs/USER_GUIDE.md"];

describe("user help docs copy", () => {
  it("keeps backup and restore wording approachable", () => {
    const source = USER_HELP_DOCS.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");

    expect(source).not.toMatch(/manifest/i);
    expect(source).not.toContain("winget");
    expect(source).not.toContain("한 줄 명령");
    expect(source).not.toContain("명령어");
    expect(source).not.toContain("터미널");
    expect(source).not.toContain("PowerShell");
    expect(source).toContain("빠진 파일 확인 목록");
    expect(source).toContain("앱 다시 설치 준비");
  });

  it("keeps README public checklist wording consistent with product copy", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");

    expect(readme).not.toContain("백업 manifest");
    expect(readme).not.toContain("manifest + winget");
    expect(readme).not.toContain("PowerShell 진단");
    expect(readme).toContain("복원 준비 목록");
    expect(readme).toContain("앱 다시 설치 준비");
  });
});
