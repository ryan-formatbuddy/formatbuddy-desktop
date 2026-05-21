import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_SOURCE = join(__dirname, "..", "src", "renderer", "src", "App.tsx");

describe("scan start failure fallback", () => {
  it("does not leave the PC check button stuck when invoke rejects before an error event arrives", () => {
    const source = readFileSync(APP_SOURCE, "utf8");

    expect(source).toContain("scanErrorFromUnknown");
    expect(source).toContain("isScanCancelledError");
    expect(source).toContain("포맷 전 체크를 시작하지 못했어요");
    expect(source).toContain('setPhase({ kind: "error", error: scanErrorFromUnknown(error) })');
    expect(source).not.toContain("// 에러는 onScanError 이벤트로 처리");
  });

  it("keeps user cancellation separate from real scan-start failures", () => {
    const source = readFileSync(APP_SOURCE, "utf8");

    expect(source).toContain("if (isScanCancelledError(error)) return;");
    expect(source).toContain("/abort|cancel|취소/i");
  });
});
