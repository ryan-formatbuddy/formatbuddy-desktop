import type { AppUninstallRequest, AppUninstallResult, InstalledApp } from "@shared/types";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\//g, "\\").replace(/\\+/g, "\\").toLowerCase();
}

function samePublisher(cachedPublisher: string | null | undefined, currentPublisher: string | null | undefined): boolean {
  const wanted = norm(cachedPublisher);
  if (!wanted) return true;
  return norm(currentPublisher) === wanted;
}

export function currentInstalledAppMatchesCachedTarget(
  cachedApp: InstalledApp,
  currentApps: InstalledApp[]
): boolean {
  const wantedName = norm(cachedApp.name);
  if (!wantedName) return false;

  const wantedRegistryKeyPath = norm(cachedApp.registryKeyPath);
  if (wantedRegistryKeyPath) {
    return currentApps.some((app) =>
      norm(app.registryKeyPath) === wantedRegistryKeyPath &&
      norm(app.name) === wantedName &&
      samePublisher(cachedApp.publisher, app.publisher)
    );
  }

  return currentApps.some((app) =>
    norm(app.name) === wantedName &&
    samePublisher(cachedApp.publisher, app.publisher)
  );
}

export function currentInstallCheckUnavailableResult(
  request: AppUninstallRequest
): AppUninstallResult {
  return {
    status: "blocked",
    appName: request.appName,
    message: "지금 설치 상태를 확인하지 못해서 Windows 제거 창을 열지 않았어요. 다시 점검한 뒤 시도해주세요.",
    detail: "current-install-check-unavailable"
  };
}

export function currentInstallTargetNotFoundResult(
  request: AppUninstallRequest
): AppUninstallResult {
  return {
    status: "app-not-found",
    appName: request.appName,
    message: "현재 설치 목록에서 이 앱을 찾지 못했어요. 다시 점검한 뒤 시도해주세요.",
    detail: "current-install-not-found"
  };
}
