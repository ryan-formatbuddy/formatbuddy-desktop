import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_TSX = join(__dirname, "..", "src", "renderer", "src", "App.tsx");
const CLEANUP_TSX = join(__dirname, "..", "src", "renderer", "src", "pages", "Cleanup.tsx");

describe("Cleanup rescan flow", () => {
  it("wires cleanup success to the fast rescan path that leads back to the report insight", () => {
    const appSource = readFileSync(APP_TSX, "utf8");
    const cleanupSource = readFileSync(CLEANUP_TSX, "utf8");

    expect(appSource).toContain("onQuickRescan={() => void startScan({ fast: true })}");
    expect(cleanupSource).toContain("onQuickRescan?: () => void");
    expect(cleanupSource).toContain("onClick={onQuickRescan ?? onRescan}");
    expect(cleanupSource).toContain("다시 점검해서 효과 보기");
  });
});
