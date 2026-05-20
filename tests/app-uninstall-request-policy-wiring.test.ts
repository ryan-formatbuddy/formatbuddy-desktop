import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_PROCESS = join(__dirname, "..", "src", "main", "index.ts");

describe("app uninstall request policy wiring", () => {
  it("validates app uninstall requests before reading scan cache or creating restore points", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("enforceAppUninstallRequestPolicy");
    expect(source).toContain("const safeUninstallRequest = enforceAppUninstallRequestPolicy(request)");
    expect(source).toContain("findInstalledApp(safeUninstallRequest.appName");
    expect(source).toContain("canLaunchUninstall(safeUninstallRequest");
    expect(source).toContain("runUninstall(safeUninstallRequest");

    const policyIndex = source.indexOf(
      "const safeUninstallRequest = enforceAppUninstallRequestPolicy(request)"
    );
    const cacheIndex = source.indexOf("if (!getLastScan())");
    const restoreIndex = source.indexOf("await maybeCreateRestorePoint(`앱 제거");
    expect(policyIndex).toBeGreaterThanOrEqual(0);
    expect(cacheIndex).toBeGreaterThanOrEqual(0);
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    expect(policyIndex).toBeLessThan(cacheIndex);
    expect(policyIndex).toBeLessThan(restoreIndex);
  });

  it("uses friendly app uninstall audit summaries instead of raw status text", () => {
    const source = readFileSync(MAIN_PROCESS, "utf8");

    expect(source).toContain("appUninstallAuditSummary(result, safeUninstallRequest.appName)");
    expect(source).not.toContain("제거 시도 결과: ${result.status}");
  });
});
