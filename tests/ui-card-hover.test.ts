/**
 * UI consistency guard: every renderer page that uses fb-card should
 * pair it with fb-card-hover, and globals.css must define both
 * keyframes + the hover transition.
 *
 * This test is the lockstep for Round D-9..D-22 -- if a future page
 * lands a bare fb-card we want CI to nag instead of leaving a single
 * non-hover surface in the middle of an otherwise consistent app.
 *
 * Exceptions:
 *   - components/ folder (Button etc.) is exempt; cards inside reusable
 *     components don't carry the hover lift by default.
 *   - Cleanup's ItemRow + LargeFileRow are list items, not click
 *     targets; they explicitly do NOT use className="fb-card".
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGES_DIR = join(__dirname, "..", "src", "renderer", "src", "pages");
const GLOBALS_CSS = join(
  __dirname,
  "..",
  "src",
  "renderer",
  "src",
  "styles",
  "globals.css"
);

function loadPages(): string[] {
  return readdirSync(PAGES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(join(PAGES_DIR, name), "utf8"));
}

describe("globals.css defines the card hover contract", () => {
  const css = readFileSync(GLOBALS_CSS, "utf8");

  it("contains .fb-card-hover with translateY + box-shadow transition", () => {
    expect(css).toMatch(/\.fb-card-hover\s*\{/);
    expect(css).toMatch(/translateY\(-2px\)/);
    expect(css).toMatch(/var\(--fb-shadow-2\)/);
  });

  it("disables every motion class under prefers-reduced-motion", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/transition:\s*none\s*!important/);
  });

  it("defines the four animation keyframes the renderer relies on", () => {
    expect(css).toMatch(/@keyframes fb-fade-in/);
    expect(css).toMatch(/@keyframes fb-slide-up/);
    expect(css).toMatch(/@keyframes fb-pop/);
    expect(css).toMatch(/@keyframes fb-count-pulse/);
  });
});

describe("every renderer page that uses fb-card pairs it with fb-card-hover", () => {
  const pages = loadPages();

  it.each(readdirSync(PAGES_DIR).filter((name) => name.endsWith(".tsx")))(
    "%s contains no bare className=\"fb-card\" (without -hover)",
    (file) => {
      const text = readFileSync(join(PAGES_DIR, file), "utf8");
      // Match bare className="fb-card" only — anything followed by a
      // space or extra class token (fb-anim-*, fb-card-hover, etc.) is
      // fine. We don't flag componentized card factories.
      const bareMatches = text.match(/className="fb-card"/g);
      expect(bareMatches, `bare fb-card className in ${file}: ${bareMatches?.length}`).toBeNull();
    }
  );

  it("collectively every page imports CloudBuddy / Lockup / Button as expected", () => {
    // Smoke check: at least one page should use each (otherwise the
    // imports list above is out of date).
    const all = pages.join("\n");
    expect(all).toMatch(/import \{[^}]*Button[^}]*\}/);
    expect(all).toMatch(/import \{[^}]*Lockup[^}]*\}/);
    expect(all).toMatch(/import \{[^}]*CloudBuddy[^}]*\}/);
  });
});
