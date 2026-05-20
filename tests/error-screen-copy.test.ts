import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ERROR_SCREEN_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "ErrorScreen.tsx"
);

describe("ErrorScreen copy", () => {
  it("does not render raw diagnostic detail on the user-facing error screen", () => {
    const source = readFileSync(ERROR_SCREEN_PAGE, "utf8");

    expect(source).toContain("오류 원문은 메일에만 담아둘게요");
    expect(source).toContain("기록 폴더를 열면 자세한 단서를 확인할 수 있어요");
    expect(source).not.toContain("<pre>");
    expect(source).not.toContain('(error.detail ?? error.message ?? "").slice(0, 1200)</pre>');
  });
});
