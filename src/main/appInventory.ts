import type {
  AppInventoryAttention,
  AppInventoryCategory,
  AppInventoryGroup,
  AppInventoryItem,
  AppInventorySummary,
  InstalledApp,
  ScanReport
} from "@shared/types";

const CATEGORY_LABEL: Record<AppInventoryCategory, string> = {
  browser: "브라우저",
  messenger: "메신저",
  cloud: "클라우드",
  office: "문서/오피스",
  security: "보안",
  driver: "장치/드라이버",
  work: "업무",
  finance: "금융/세무",
  creative: "디자인/제작",
  developer: "개발",
  game: "게임",
  media: "영상/음악",
  utility: "관리 도구",
  system: "Windows 구성요소",
  unknown: "기타"
};

const ATTENTION_LABEL: Record<AppInventoryAttention, string> = {
  none: "확인 낮음",
  backup: "자료 확인",
  license: "계정/라이선스",
  sync: "동기화 확인",
  security: "보안 확인",
  driver: "장치 확인",
  cleanup: "삭제 후보",
  reinstall: "재설치 준비"
};

const CATEGORY_ORDER: AppInventoryCategory[] = [
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

type Rule = {
  category: AppInventoryCategory;
  attention: AppInventoryAttention;
  confidence: AppInventoryItem["confidence"];
  reason: string;
  patterns: RegExp[];
};

const RULES: Rule[] = [
  {
    category: "finance",
    attention: "backup",
    confidence: "high",
    reason: "금융/세무/인증 업무에 쓰일 수 있어요. 포맷 전 자료와 로그인 수단을 직접 확인하세요.",
    patterns: [/더존/i, /douzone/i, /위하고/i, /wehago/i, /세무/i, /hometax/i, /홈택스/i, /tax/i, /bank/i, /은행/i, /증권/i]
  },
  {
    category: "work",
    attention: "backup",
    confidence: "high",
    reason: "업무 자료가 이 PC에만 있을 수 있어요. 데이터 위치와 복원 방법을 확인하세요.",
    patterns: [/erp/i, /회계/i, /accounting/i, /scanner/i, /scan/i, /label/i, /barcode/i]
  },
  {
    category: "office",
    attention: "license",
    confidence: "high",
    reason: "문서 작업과 라이선스 확인이 필요할 수 있어요.",
    patterns: [/microsoft office/i, /microsoft 365/i, /\boffice\b/i, /word/i, /excel/i, /powerpoint/i, /outlook/i, /hancom/i, /한컴/i, /hwp/i, /폴라리스/i, /polaris/i]
  },
  {
    category: "cloud",
    attention: "sync",
    confidence: "high",
    reason: "동기화가 끝나지 않은 파일이 있을 수 있어요.",
    patterns: [/onedrive/i, /google drive/i, /dropbox/i, /icloud/i, /naver mybox/i, /mybox/i, /synology/i]
  },
  {
    category: "messenger",
    attention: "backup",
    confidence: "high",
    reason: "대화 백업과 같은 계정 복원 가능 여부를 확인하세요.",
    patterns: [/kakaotalk/i, /kakao talk/i, /카카오톡/i, /line/i, /telegram/i, /slack/i, /discord/i, /teams/i, /zoom/i]
  },
  {
    category: "browser",
    attention: "sync",
    confidence: "high",
    reason: "즐겨찾기와 로그인 계정 동기화를 확인하세요.",
    patterns: [/chrome/i, /edge/i, /firefox/i, /whale/i, /naver whale/i, /brave/i, /opera/i]
  },
  {
    category: "security",
    attention: "security",
    confidence: "high",
    reason: "보안 프로그램 상태와 계정 로그인 여부를 확인하세요.",
    patterns: [/defender/i, /ahnlab/i, /v3/i, /alyac/i, /알약/i, /norton/i, /mcafee/i, /avast/i, /eset/i, /kaspersky/i, /bitdefender/i]
  },
  {
    category: "driver",
    attention: "driver",
    confidence: "medium",
    reason: "포맷 후 장치가 바로 안 잡힐 수 있어요. 제조사와 모델을 확인하세요.",
    patterns: [/nvidia/i, /amd/i, /intel/i, /realtek/i, /synaptics/i, /logitech/i, /hp/i, /canon/i, /epson/i, /brother/i, /driver/i, /printer/i, /audio/i, /bluetooth/i]
  },
  {
    category: "creative",
    attention: "license",
    confidence: "high",
    reason: "계정, 라이선스, 플러그인, 프리셋을 확인하세요.",
    patterns: [/adobe/i, /photoshop/i, /illustrator/i, /premiere/i, /after effects/i, /lightroom/i, /autocad/i, /autodesk/i, /figma/i, /sketch/i, /clip studio/i]
  },
  {
    category: "developer",
    attention: "backup",
    confidence: "high",
    reason: "개발 설정, SSH 키, 작업 폴더가 이 PC에만 있을 수 있어요.",
    patterns: [/visual studio code/i, /\bvs code\b/i, /visual studio/i, /cursor/i, /\bgit\b/i, /github/i, /sourcetree/i, /node\.?js/i, /python/i, /docker/i, /postman/i, /jetbrains/i, /intellij/i, /pycharm/i]
  },
  {
    category: "game",
    attention: "sync",
    confidence: "medium",
    reason: "저장 데이터와 계정 동기화 상태를 확인하세요.",
    patterns: [/steam/i, /epic games/i, /riot/i, /battle\.net/i, /blizzard/i, /kakao games/i, /kakaogames/i, /nexon/i, /ncsoft/i, /game/i]
  },
  {
    category: "media",
    attention: "backup",
    confidence: "medium",
    reason: "프로젝트 파일과 라이브러리 위치를 확인하세요.",
    patterns: [/vlc/i, /potplayer/i, /곰플레이어/i, /melon/i, /spotify/i, /ableton/i, /cubase/i, /fl studio/i, /obs/i]
  },
  {
    category: "utility",
    attention: "cleanup",
    confidence: "medium",
    reason: "자주 쓰지 않는 관리 도구라면 삭제 후보로 볼 수 있어요.",
    patterns: [/7-zip/i, /winrar/i, /bandizip/i, /반디집/i, /ccleaner/i, /notepad\+\+/i, /teamviewer/i, /anydesk/i, /remote/i]
  },
  {
    category: "system",
    attention: "none",
    confidence: "medium",
    reason: "Windows나 하드웨어가 같이 설치한 구성요소일 수 있어요.",
    patterns: [/microsoft visual c\+\+/i, /\.net/i, /runtime/i, /redistributable/i, /update/i, /supportassist/i]
  }
];

function appKey(app: InstalledApp): string {
  const displayApp = normalizeInstalledAppForDisplay(app);
  return `${displayApp?.name ?? ""} ${displayApp?.publisher ?? ""}`.toLowerCase();
}

function isUninstallNoise(app: InstalledApp): boolean {
  const key = appKey(app);
  return /security update|hotfix|kb\d{6,}|language pack/i.test(key);
}

export function cleanAppDisplayText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed || undefined;
}

function cleanAppMetadataText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeInstalledAppForDisplay(app: InstalledApp): InstalledApp | null {
  const name = cleanAppDisplayText(app.name);
  if (!name) return null;
  return {
    ...app,
    name,
    version: cleanAppDisplayText(app.version) ?? null,
    publisher: cleanAppDisplayText(app.publisher) ?? null,
    installLocation: cleanAppMetadataText(app.installLocation) ?? null,
    registryKeyPath: cleanAppMetadataText(app.registryKeyPath) ?? null
  };
}

export function classifyInstalledApp(app: InstalledApp): AppInventoryItem {
  const displayApp = normalizeInstalledAppForDisplay(app);
  const key = appKey(app);
  if (!displayApp || isUninstallNoise(displayApp)) {
    return {
      name: displayApp?.name || "이름 없는 항목",
      version: displayApp?.version,
      publisher: displayApp?.publisher,
      category: "system",
      categoryLabel: CATEGORY_LABEL.system,
      confidence: "low",
      attention: "none",
      attentionLabel: ATTENTION_LABEL.none,
      reason: "Windows 업데이트나 구성요소일 가능성이 높아요."
    };
  }

  const rule = RULES.find((r) => r.patterns.some((p) => p.test(key)));
  if (rule) {
    return {
      name: displayApp.name,
      version: displayApp.version,
      publisher: displayApp.publisher,
      category: rule.category,
      categoryLabel: CATEGORY_LABEL[rule.category],
      confidence: rule.confidence,
      attention: rule.attention,
      attentionLabel: ATTENTION_LABEL[rule.attention],
      reason: rule.reason
    };
  }

  return {
    name: displayApp.name,
    version: displayApp.version,
    publisher: displayApp.publisher,
    category: "unknown",
    categoryLabel: CATEGORY_LABEL.unknown,
    confidence: "low",
    attention: "reinstall",
    attentionLabel: ATTENTION_LABEL.reinstall,
    reason: "자동 분류 근거가 약해요. 포맷 후 다시 필요한 앱인지 직접 판단해야 해요."
  };
}

export function buildAppInventory(report: ScanReport): AppInventorySummary {
  const seen = new Set<string>();
  const items = report.installedApps
    .map(normalizeInstalledAppForDisplay)
    .filter((app): app is InstalledApp => app !== null)
    .map(classifyInstalledApp)
    .filter((item) => {
      const key = `${item.name}|${item.publisher ?? ""}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, "ko") || a.name.localeCompare(b.name, "ko"));

  const groups: AppInventoryGroup[] = CATEGORY_ORDER.map((category) => {
    const groupItems = items.filter((item) => item.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      count: groupItems.length,
      items: groupItems
    };
  }).filter((group) => group.count > 0);

  return {
    total: items.length,
    classified: items.filter((item) => item.category !== "unknown").length,
    needsCheck: items.filter((item) => item.attention !== "none").length,
    groups
  };
}
