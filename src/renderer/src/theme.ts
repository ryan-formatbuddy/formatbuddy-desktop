/**
 * v2.0 (Round D-31 / C7 follow-up) — theme application helper.
 *
 * Single source of truth for "translate MonitorPreferences.themeMode
 * into the document attribute that globals.css listens to". We DON'T
 * set this directly from MonitorPrefsCard render so a `system` user
 * who flips their OS theme while the app is running still sees the
 * change without re-rendering the prefs card.
 *
 * The previous matchMedia listener is torn down on each call so we
 * don't leak event handlers when the user toggles between system /
 * light / dark.
 */
import type { ThemeMode } from "@shared/types";

let cleanup: (() => void) | null = null;

function setRoot(theme: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyThemeMode(mode: ThemeMode): void {
  cleanup?.();
  cleanup = null;

  if (typeof window === "undefined") return;

  if (mode === "light" || mode === "dark") {
    setRoot(mode);
    return;
  }

  // system follow
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => setRoot(mq.matches ? "dark" : "light");
  apply();
  mq.addEventListener("change", apply);
  cleanup = () => mq.removeEventListener("change", apply);
}
