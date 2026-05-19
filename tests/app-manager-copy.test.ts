import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_MANAGER_PAGE = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "pages",
  "AppManager.tsx"
);

describe("AppManager uninstall copy", () => {
  it("does not claim an app was removed just because the Windows wizard opened", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).not.toContain("방금 제거한 앱");
    expect(source).not.toContain("방금 제거한 앱 기준");
    expect(source).not.toContain("방금 제거를 연 앱 기준");
    expect(source).toContain("방금 제거를 연 앱");
    expect(source).toContain("제거 완료 확인됨");
    expect(source).toContain("다시 점검 후 정리 가능");
  });

  it("includes registry backup undo in the recent cleanup flow", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("restoreRegistryBackup");
    expect(source).toContain("restorableRegistryBackupIds");
    expect(source).toContain("방금 정리 되돌리기");
    expect(source).not.toContain("레지스트리는");
    expect(source).not.toContain("? \"레지스트리\"");
    expect(source).not.toContain("앱 삭제 흔적은 백업 후 처리해요");
    expect(source).toContain("앱 삭제 흔적도 30일 안에 되돌릴 수 있게 챙겨요");
    expect(source).toContain("앱 삭제 흔적도 30일 동안");
    expect(source).toContain("폴더와 시작 항목, 앱 삭제 흔적은 30일 안에 되돌릴 수 있게");
    expect(source).toContain("시작 항목");
    expect(source).not.toContain("시작 레지스트리");
    expect(source).toContain("시작 흔적");
  });

  it("shows the startup item name beside the startup location", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("leftoverDisplayPath");
    expect(source).toContain("path.registryValueName");
    expect(source).toContain('path.kind === "startup-registry"');
    expect(source).toContain("${path.path}\\\\${valueName}");
    expect(source).toContain("leftoverDisplayPath(path)} 선택");
  });

  it("does not show raw IPC errors in app cleanup messages", () => {
    const source = readFileSync(APP_MANAGER_PAGE, "utf8");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(err as Error).message");
  });
});
