/**
 * Electron Tray adapter.
 *
 * Only instantiated when MonitorPreferences.trayEnabled is true.
 * Destroyed when the user flips the toggle off, when the main window
 * quits, or when the app shuts down.
 *
 * Menu (kept intentionally short — tray menus are not a settings UI):
 *   - PC 점검 시작
 *   - FormatBuddy 열기
 *   - 종료
 *
 * The tray icon comes from the same app-icon assets we ship for the
 * NSIS installer / Mac bundle. If the asset can't be found at runtime
 * we return null and the caller silently keeps the previous (no-tray)
 * state — better than crashing on a missing icon during dev.
 */
import { app, Menu, nativeImage, Tray } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface TrayHandlers {
  onShowWindow: () => void;
  onStartScan: () => void;
  onQuit: () => void;
}

function resolveIconPath(): string | null {
  // Windows ships .ico, mac ships .icns, but Electron Tray needs a
  // PNG (or NativeImage) on macOS for menubar templating. We accept
  // either; if PNG is missing fall through to ICO so dev builds at
  // least show something.
  const candidates = [
    app.isPackaged ? join(process.resourcesPath, "icons", "tray.png") : null,
    app.isPackaged ? join(process.resourcesPath, "icons", "app-icon.png") : null,
    app.isPackaged ? join(process.resourcesPath, "icons", "app-icon.ico") : null,
    join(__dirname, "..", "..", "resources", "icons", "tray.png"),
    join(__dirname, "..", "..", "resources", "icons", "app-icon.png"),
    join(__dirname, "..", "..", "resources", "icons", "app-icon.ico"),
    join(process.cwd(), "resources", "icons", "tray.png"),
    join(process.cwd(), "resources", "icons", "app-icon.png"),
    join(process.cwd(), "resources", "icons", "app-icon.ico")
  ].filter((p): p is string => Boolean(p));
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export function createTray(handlers: TrayHandlers): Tray | null {
  const iconPath = resolveIconPath();
  if (!iconPath) return null;

  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return null;

  // Mac menubar wants a small template image. .ico converts at the
  // OS level but is often huge — downscale defensively.
  if (process.platform === "darwin") {
    image = image.resize({ width: 18, height: 18 });
    image.setTemplateImage(true);
  }

  const tray = new Tray(image);
  tray.setToolTip("FormatBuddy");
  const menu = Menu.buildFromTemplate([
    {
      label: "PC 점검 시작",
      click: () => {
        handlers.onShowWindow();
        handlers.onStartScan();
      }
    },
    { type: "separator" },
    {
      label: "FormatBuddy 열기",
      click: () => handlers.onShowWindow()
    },
    { type: "separator" },
    {
      label: "FormatBuddy 종료",
      click: () => handlers.onQuit()
    }
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => handlers.onShowWindow());
  return tray;
}

export function destroyTray(tray: Tray | null): void {
  if (!tray) return;
  try {
    tray.destroy();
  } catch {
    // best effort — Electron sometimes complains if the tray is
    // already gone (e.g. during quit)
  }
}

export const __testing = { resolveIconPath };
