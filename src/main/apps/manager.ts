/**
 * App manager — turns the raw `installedApps` array from a scan into
 * a UI-ready snapshot grouped by category, with uninstall availability
 * already computed.
 *
 * We deliberately do NOT carry UninstallString into the renderer. The
 * uninstaller helper (./uninstaller.ts) re-derives it from the same
 * cached scan when the user confirms — so a tampered renderer can't
 * inject its own executable string.
 */
import type {
  AppManagerCategory,
  AppManagerGroup,
  AppManagerItem,
  AppManagerSnapshot,
  AppUninstallAvailability,
  InstalledApp
} from "@shared/types";
import { classifyInstalledApp } from "../appInventory";

const CATEGORY_ORDER: AppManagerCategory[] = [
  "work",
  "finance",
  "office",
  "cloud",
  "messenger",
  "browser",
  "security",
  "driver",
  "creative",
  "developer",
  "game",
  "media",
  "utility",
  "system",
  "unknown"
];

function makeId(app: InstalledApp): string {
  // Stable per (name, publisher); registry uniqueness is best-effort
  // so we don't rely on Windows registry GUIDs that may be empty.
  const seed = `${app.name ?? ""}|${app.publisher ?? ""}|${app.installLocation ?? ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return `app-${(h >>> 0).toString(36)}`;
}

function isWindowsUpdateNoise(app: InstalledApp): boolean {
  const text = `${app.name ?? ""} ${app.publisher ?? ""}`.toLowerCase();
  return /security update|hotfix|kb\d{6,}|language pack/i.test(text);
}

function evaluateAvailability(app: InstalledApp): {
  availability: AppUninstallAvailability;
  note: string;
  mode?: "interactive" | "quiet";
} {
  if (app.systemComponent === true) {
    return {
      availability: "system-component",
      note: "Windows 구성요소로 표시돼 있어요. 제거하면 다른 앱이 흔들릴 수 있어요."
    };
  }
  if (!app.uninstallString || !app.uninstallString.trim()) {
    if (app.installLocation || isWindowsUpdateNoise(app)) {
      return {
        availability: "registry-only",
        note: "Windows에 설치 기록은 있지만 제거 명령이 함께 등록되어 있지 않아요."
      };
    }
    return {
      availability: "no-uninstall-string",
      note: "제거 명령이 없어서 Windows 기본 제거를 자동으로 띄울 수 없어요."
    };
  }
  if (app.quietUninstallString && app.quietUninstallString.trim()) {
    return {
      availability: "ready",
      note: "Windows 제거 마법사 또는 조용한 제거 중 선택할 수 있어요.",
      mode: "interactive"
    };
  }
  return {
    availability: "ready",
    note: "Windows 제거 마법사가 떠요. 진행 여부는 Ryan이 직접 결정해요.",
    mode: "interactive"
  };
}

function toItem(app: InstalledApp): AppManagerItem {
  const classified = classifyInstalledApp(app);
  const availability = evaluateAvailability(app);
  return {
    id: makeId(app),
    name: classified.name,
    publisher: classified.publisher,
    version: classified.version,
    category: classified.category,
    categoryLabel: classified.categoryLabel,
    installLocation: app.installLocation ?? undefined,
    estimatedSizeBytes:
      typeof app.estimatedSizeKb === "number" ? app.estimatedSizeKb * 1024 : undefined,
    installDate: app.installDate ?? undefined,
    uninstallAvailability: availability.availability,
    availabilityNote: availability.note,
    uninstallMode: availability.mode
  };
}

export interface BuildAppManagerSnapshotOptions {
  /**
   * Apps whose Windows uninstall wizard was opened recently. Renderer
   * surfaces these for 24h so the user can check leftovers after the
   * wizard finishes. Not deduplicated against the live `apps` list
   * because a still-installed app reappearing here may mean the user
   * canceled the wizard.
   */
  recentlyUninstallLaunched?: InstalledApp[];
}

export function buildAppManagerSnapshot(
  apps: InstalledApp[],
  opts: BuildAppManagerSnapshotOptions = {}
): AppManagerSnapshot {
  const seen = new Set<string>();
  const usable = apps
    .filter((app) => Boolean(app.name?.trim()))
    .filter((app) => !isWindowsUpdateNoise(app));

  const hiddenSystemCount = apps.filter((app) => app.systemComponent === true).length;

  const items: AppManagerItem[] = usable
    .map(toItem)
    .filter((item) => {
      const key = `${item.name}|${item.publisher ?? ""}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.categoryLabel.localeCompare(b.categoryLabel, "ko") ||
        a.name.localeCompare(b.name, "ko")
    );

  const groups: AppManagerGroup[] = CATEGORY_ORDER.map((category) => {
    const groupItems = items.filter((item) => item.category === category);
    return {
      category,
      label: groupItems[0]?.categoryLabel ?? category,
      count: groupItems.length,
      items: groupItems
    };
  }).filter((group) => group.count > 0);

  return {
    generatedAt: new Date().toISOString(),
    total: items.length,
    classified: items.filter((item) => item.category !== "unknown").length,
    groups,
    hiddenSystemCount,
    recentlyUninstallLaunched: (opts.recentlyUninstallLaunched ?? [])
      .filter((app) => Boolean(app.name?.trim()))
      .map((app) => ({
        name: app.name,
        publisher: app.publisher ?? null
      }))
  };
}

export const __testing = {
  evaluateAvailability,
  makeId,
  isWindowsUpdateNoise
};
