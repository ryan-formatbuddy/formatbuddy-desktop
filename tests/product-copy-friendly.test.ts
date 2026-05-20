import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENDERER_ROOT = join(__dirname, "..", "src", "renderer", "src");
const PERMISSIONS_PAGE = join(RENDERER_ROOT, "pages", "Permissions.tsx");
const SRC_ROOT = join(__dirname, "..", "src");

const USER_FACING_FILES = [
  "App.tsx",
  "pages/AuditLog.tsx",
  "pages/AppManager.tsx",
  "pages/Cleanup.tsx",
  "pages/Permissions.tsx",
  "pages/Report.tsx",
  "pages/SecurityCenter.tsx",
  "pages/StartupAuto.tsx",
  "pages/TrashRestore.tsx"
];

const PRODUCT_COPY_FILES = [
  "shared/copy.ts",
  "renderer/src/pages/Permissions.tsx",
  "main/appInventory.ts",
  "main/buddyChecklist.ts",
  "main/recommend.ts",
  "main/apps/manager.ts",
  "main/apps/uninstallRequestPolicy.ts"
];

describe("product copy friendliness", () => {
  it("keeps developer plumbing terms out of user-facing screens", () => {
    const source = USER_FACING_FILES.map((file) =>
      readFileSync(join(RENDERER_ROOT, file), "utf8")
    ).join("\n");

    expect(source).not.toContain("Electron 브리지");
    expect(source).not.toContain("Plan ID");
    expect(source).not.toContain("Blocklist 버전");
    expect(source).not.toContain("PowerShell을 다시 돌리지");
    expect(source).not.toContain("레지스트리 하이브");
    expect(source).not.toContain("Get-CimInstance");
    expect(source).not.toContain("Start-MpScan");
    expect(source).not.toContain("cmd.exe /c");
    expect(source).not.toContain("pnputil");
    expect(source).not.toContain("netsh");
    expect(source).not.toContain("HTML 저장");
    expect(source).not.toContain("JSON 저장");
    expect(source).not.toContain("진단 리포트(HTML/JSON)");
    expect(source).not.toContain("진단 결과 파일(JSON)");
    expect(source).not.toContain("HKLM/HKCU");
    expect(source).not.toContain("formatbuddy-trash/items");
    expect(source).toContain("Windows가 제공하는 기본 제거 화면으로 연결해요");
    expect(source).toContain("포맷버디 복구함 안에 30일 동안 보관해요");
  });

  it("uses friendly 30-day restore-bin language instead of permanent-delete wording", () => {
    const source = USER_FACING_FILES.map((file) =>
      readFileSync(join(RENDERER_ROOT, file), "utf8")
    ).join("\n");

    expect(source).not.toContain("영구 삭제");
    expect(source).not.toContain("자동 삭제돼요");
    expect(source).not.toContain("자동 삭제될");
    expect(source).not.toContain("permanent-mode");
    expect(source).not.toContain("permanently delete");
    expect(source).not.toContain("치료/제거");
    expect(source).not.toContain("백신처럼 위협 직접 치료");
    expect(source).toContain("30일 뒤 자동으로 비워요");
  });

  it("uses one user-facing name for Windows security on the permissions screen", () => {
    const source = readFileSync(PERMISSIONS_PAGE, "utf8");

    expect(source).not.toContain("Defender");
    expect(source).toContain("Windows 보안 상태");
    expect(source).toContain("Windows 보안 빠른 검사 시작");
  });

  it("keeps raw caught error messages out of user-facing screens", () => {
    const source = USER_FACING_FILES.map((file) =>
      readFileSync(join(RENDERER_ROOT, file), "utf8")
    ).join("\n");

    expect(source).toContain("friendlyErrorMessage");
    expect(source).not.toContain("(e as Error).message");
    expect(source).not.toContain("(err as Error).message");
    expect(source).not.toContain("err.message");
  });

  it("routes backup checklist export failures through friendly copy", () => {
    const source = readFileSync(join(RENDERER_ROOT, "pages", "Report.tsx"), "utf8");

    expect(source).toContain("friendlyErrorMessage(res.message)");
    expect(source).not.toContain("${copy.manifestExportErrorPrefix}${res.message}");
  });

  it("keeps personal Ryan-only wording out of product-facing copy", () => {
    const source = PRODUCT_COPY_FILES.map((file) => readFileSync(join(SRC_ROOT, file), "utf8")).join(
      "\n"
    );

    expect(source).not.toContain("Ryan");
  });
});
