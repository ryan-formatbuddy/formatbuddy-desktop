/**
 * Accessibility contract — every renderer page must label its main
 * landmark. Without this, NVDA / Narrator skip "main content" and the
 * user has no idea which screen they're on.
 *
 * Rule:
 *   - Each tsx in src/renderer/src/pages/ that renders a <main> element
 *     must include either aria-label="…" or aria-labelledby="…" on that
 *     main. Nothing else is enforced -- specific labels are reviewed in
 *     code, but having SOME label is a contract a unit test can lock.
 *
 * Round D-28 / C9.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PAGES_DIR = join(__dirname, "..", "src", "renderer", "src", "pages");

function listPageFiles(): string[] {
  return readdirSync(PAGES_DIR).filter((f) => f.endsWith(".tsx"));
}

describe("every renderer page's <main> landmark carries an aria label", () => {
  const files = listPageFiles();

  it.each(files)("%s — <main …> has aria-label or aria-labelledby", (file) => {
    const text = readFileSync(join(PAGES_DIR, file), "utf8");
    const mainOpens = text.match(/<main\b[^>]*>/g) ?? [];
    if (mainOpens.length === 0) {
      // Some pages render inside the host layout without their own
      // <main> element -- those are fine, the host wraps them.
      return;
    }
    for (const open of mainOpens) {
      const labelled =
        /\baria-label\s*=/.test(open) || /\baria-labelledby\s*=/.test(open);
      expect(
        labelled,
        `<main> in ${file} missing aria-label / aria-labelledby: ${open}`
      ).toBe(true);
    }
  });
});
