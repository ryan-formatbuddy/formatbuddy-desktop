import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureSafeOutputFilePath } from "../src/main/safeOutputPath";

describe("ensureSafeOutputFilePath", () => {
  it("refuses an output file that is a symbolic link", async () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(join(tmpdir(), "fb-output-file-link-test-"));
    const outside = join(root, "outside.json");
    const outputPath = join(root, "report.json");
    try {
      writeFileSync(outside, "outside stays put", "utf8");
      symlinkSync(outside, outputPath);

      await expect(
        ensureSafeOutputFilePath(outputPath, { label: "Report export" })
      ).rejects.toThrow(/report export|output|link/i);
      expect(readFileSync(outside, "utf8")).toBe("outside stays put");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses an output folder chain that crosses a symbolic link", async () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(join(tmpdir(), "fb-output-parent-link-test-"));
    const outside = mkdtempSync(join(root, "outside-"));
    const linkedParent = join(root, "linked-parent");
    const outputPath = join(linkedParent, "nested", "report.html");
    try {
      symlinkSync(outside, linkedParent, "dir");

      await expect(
        ensureSafeOutputFilePath(outputPath, { label: "Report export" })
      ).rejects.toThrow(/report export|output|link/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates the output parent folder for a normal path", async () => {
    const root = mkdtempSync(join(tmpdir(), "fb-output-normal-test-"));
    const outputPath = join(root, "nested", "report.json");
    try {
      await expect(
        ensureSafeOutputFilePath(outputPath, { label: "Report export" })
      ).resolves.toBe(outputPath);
      writeFileSync(outputPath, "{}", "utf8");
      expect(readFileSync(outputPath, "utf8")).toBe("{}");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses when the output path is already a folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "fb-output-folder-test-"));
    const outputPath = mkdtempSync(join(root, "folder-"));
    try {
      await expect(
        ensureSafeOutputFilePath(outputPath, { label: "Report export" })
      ).rejects.toThrow(/report export|folder/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
