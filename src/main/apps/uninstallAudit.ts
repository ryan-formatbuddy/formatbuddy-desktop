import type { AppUninstallResult } from "@shared/types";

function cleanAuditAppName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "선택한 앱";
}

export function appUninstallAuditSummary(
  result: AppUninstallResult,
  fallbackAppName: string
): string {
  const appName = cleanAuditAppName(result.appName || fallbackAppName);
  switch (result.status) {
    case "launched":
      return `Windows 제거 창으로 "${appName}"을 열었어요. 실제 삭제 여부는 Windows 창에서 한 번 더 확인해요.`;
    case "app-not-found":
      return `"${appName}"의 제거 정보를 찾지 못했어요. 다시 점검한 뒤 확인해주세요.`;
    case "blocked":
      if (result.detail === "systemComponent=true") {
        return `"${appName}"은 Windows 구성요소라 자동으로 열지 않았어요.`;
      }
      return `"${appName}" 제거 명령을 안전하게 확인하지 못해 멈췄어요. Windows 설정에서 직접 확인해주세요.`;
    case "no-scan-cache":
      return "최근 진단 결과가 없어서 앱 제거를 시작하지 않았어요. 점검을 먼저 해주세요.";
    case "no-uninstall-string":
      return `"${appName}"은 Windows 제거 명령이 없어서 자동으로 열지 않았어요. Windows 설정에서 직접 확인해주세요.`;
    case "spawn-failed":
      return `"${appName}"의 Windows 제거 창을 열지 못했어요. Windows 설정에서 직접 확인해주세요.`;
    default:
      return `"${appName}" 앱 제거 상태를 확인했어요. 필요하면 Windows 설정에서 직접 확인해주세요.`;
  }
}
