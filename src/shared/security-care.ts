import type { DefenderLiveStatus } from "./types";

export type SecurityCareLevel = "ok" | "check" | "attention";

export interface SecurityCareItem {
  id: string;
  level: SecurityCareLevel;
  title: string;
  detail: string;
  action: string;
}

export interface SecurityCareSummary {
  level: SecurityCareLevel;
  title: string;
  detail: string;
  items: SecurityCareItem[];
}

const SIGNATURE_STALE_DAYS = 7;
const QUICK_SCAN_STALE_DAYS = 30;
const FULL_SCAN_STALE_DAYS = 90;
const MAX_VISIBLE_ITEMS = 5;

function hasAttention(items: SecurityCareItem[]): boolean {
  return items.some((item) => item.level === "attention");
}

function hasCheck(items: SecurityCareItem[]): boolean {
  return items.some((item) => item.level === "check");
}

function addIfMissing(items: SecurityCareItem[], item: SecurityCareItem): void {
  if (!items.some((existing) => existing.id === item.id)) items.push(item);
}

export function buildSecurityCareSummary(status?: DefenderLiveStatus): SecurityCareSummary {
  if (!status) {
    return {
      level: "check",
      title: "Windows 보안 상태를 불러오는 중이에요",
      detail: "잠시 뒤 상태가 들어오면 먼저 볼 항목만 추려드릴게요.",
      items: []
    };
  }

  if (!status.available) {
    return {
      level: "check",
      title: "Windows 보안 상태를 직접 확인해주세요",
      detail: status.unavailableReason ?? "이 PC에서는 자동 확인을 지원하지 않아요.",
      items: [
        {
          id: "open-windows-security",
          level: "check",
          title: "Windows 보안 화면 확인",
          detail: "앱에서 상태를 읽지 못했어요. Windows 보안 화면에서 보호 상태를 직접 확인해주세요.",
          action: "Windows 보안 열기"
        }
      ]
    };
  }

  const items: SecurityCareItem[] = [];

  if (status.antivirusEnabled === false) {
    addIfMissing(items, {
      id: "antivirus-off",
      level: "attention",
      title: "기본 보호가 꺼져 보여요",
      detail: "Windows 보안의 기본 보호가 비활성으로 보입니다. 먼저 Windows 보안 화면에서 확인해주세요.",
      action: "Windows 보안에서 확인"
    });
  }

  if (status.realTimeProtectionEnabled === false) {
    addIfMissing(items, {
      id: "realtime-off",
      level: "attention",
      title: "실시간 보호 확인",
      detail: "실시간 보호가 꺼져 보여요. 파일을 열기 전에 Windows 보안에서 켜져 있는지 확인해주세요.",
      action: "보호 상태 보기"
    });
  }

  if (status.signatureAgeDays == null) {
    addIfMissing(items, {
      id: "signature-unknown",
      level: "check",
      title: "보안 업데이트 날짜 확인",
      detail: "최근 보안 업데이트 날짜를 읽지 못했어요. Windows 보안에서 최신 상태인지 봐주세요.",
      action: "업데이트 확인"
    });
  } else if (status.signatureAgeDays >= SIGNATURE_STALE_DAYS) {
    addIfMissing(items, {
      id: "signature-stale",
      level: "check",
      title: "보안 업데이트 확인",
      detail: `${status.signatureAgeDays}일 전에 업데이트됐어요. Windows 보안에서 최신 업데이트를 확인해보면 좋아요.`,
      action: "업데이트 확인"
    });
  }

  if (status.lastQuickScanDaysAgo == null) {
    addIfMissing(items, {
      id: "quick-scan-missing",
      level: "check",
      title: "빠른 검사 한 번 권장",
      detail: "최근 빠른 검사 기록을 읽지 못했어요. 오래 쓴 PC라면 한 번 확인해두면 마음이 편해요.",
      action: "빠른 검사 시작"
    });
  } else if (status.lastQuickScanDaysAgo >= QUICK_SCAN_STALE_DAYS) {
    addIfMissing(items, {
      id: "quick-scan-stale",
      level: "check",
      title: "빠른 검사 한 번 권장",
      detail: `마지막 빠른 검사가 ${status.lastQuickScanDaysAgo}일 전이에요. 지금 한 번 확인해보면 좋아요.`,
      action: "빠른 검사 시작"
    });
  }

  if (status.puaProtection === "disabled") {
    addIfMissing(items, {
      id: "pua-off",
      level: "check",
      title: "원치 않는 앱 차단 확인",
      detail: "광고성 설치나 원치 않는 앱을 막는 설정이 꺼져 보여요. 필요하면 Windows 보안에서 켤 수 있어요.",
      action: "차단 설정 보기"
    });
  }

  if (status.controlledFolderAccess === "disabled") {
    addIfMissing(items, {
      id: "folder-protection-off",
      level: "check",
      title: "중요 폴더 보호 확인",
      detail: "문서와 사진 폴더를 보호하는 Windows 옵션이 꺼져 보여요. 업무 PC라면 한 번 살펴보세요.",
      action: "폴더 보호 보기"
    });
  }

  if (status.networkProtection === "disabled") {
    addIfMissing(items, {
      id: "network-protection-off",
      level: "check",
      title: "웹 보호 옵션 확인",
      detail: "위험한 웹 연결을 줄이는 Windows 옵션이 꺼져 보여요. 자주 다운로드하는 PC라면 확인해보세요.",
      action: "보호 옵션 보기"
    });
  }

  if (status.lastFullScanDaysAgo != null && status.lastFullScanDaysAgo >= FULL_SCAN_STALE_DAYS) {
    addIfMissing(items, {
      id: "full-scan-stale",
      level: "check",
      title: "전체 검사도 가끔 확인",
      detail: `마지막 전체 검사가 ${status.lastFullScanDaysAgo}일 전이에요. 시간이 괜찮을 때 Windows 보안에서 돌려보세요.`,
      action: "Windows 보안 열기"
    });
  }

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);

  if (hasAttention(items)) {
    return {
      level: "attention",
      title: "먼저 확인할 보안 항목이 있어요",
      detail: "포맷버디가 고치는 건 아니고, Windows 보안에서 먼저 봐야 할 항목만 추렸어요.",
      items: visibleItems
    };
  }

  if (hasCheck(items)) {
    return {
      level: "check",
      title: "가볍게 확인하면 좋은 항목이 있어요",
      detail: "급한 경고보다는 챙김에 가까워요. 필요한 것만 Windows 보안에서 확인하면 됩니다.",
      items: visibleItems
    };
  }

  return {
    level: "ok",
    title: "크게 신경 쓰이는 항목은 적어요",
    detail: "Windows 보안에서 읽은 상태 기준으로는 바로 먼저 볼 항목이 많지 않아요.",
    items: [
      {
        id: "security-ok",
        level: "ok",
        title: "지금은 가볍게 넘어가도 괜찮아요",
        detail: "빠른 검사와 업데이트 기록이 무난해 보여요. 다음 점검 때 다시 같이 볼게요.",
        action: "상태 유지"
      }
    ]
  };
}
