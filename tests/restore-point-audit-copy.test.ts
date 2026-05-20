import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("restore point audit copy", () => {
  it("keeps raw restore point reasons out of user-visible audit summaries", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("restorePointAuditSummary");
    expect(source).toContain("Windows가 복원 지점 생성을 허용하지 않았어요");
    expect(source).toContain("Windows 복원 지점 도구를 열지 못해 안전 기록은 건너뛰었어요");
    expect(source).toContain("복원 지점 생성이 오래 걸려 안전 기록은 건너뛰었어요");
    expect(source).toContain("이 기기에서는 시스템 복원 지점을 만들지 않아도 괜찮아요");
    expect(source).toContain("작업은 계속 진행했어요");
    expect(source).not.toContain("reason=${result.reason}");
  });
});
