import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("app leftovers audit copy", () => {
  it("uses friendly wording for app cleanup traces in activity history", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).not.toContain("레지스트리 ${registryBackupIds.length}개를 백업 후 정리했어요");
    expect(source).toContain("앱 삭제 흔적 ${registryBackupIds.length}개를 백업 후 정리했어요");
    expect(source).not.toContain("폴더와 백업은 30일 뒤 자동으로 비워요");
    expect(source).toContain("잔여 폴더와 앱 삭제 흔적 백업은 30일 뒤 자동으로 비워요");
  });
});
