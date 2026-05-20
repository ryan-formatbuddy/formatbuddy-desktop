/**
 * 카피 톤 가이드는 web/CLAUDE.md 기준.
 * 권장: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
 * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
 */
export const copy = {
  appName: "포맷버디",
  appNameEn: "FORMAT BUDDY",

  homeEyebrow: "PC 포맷 동행 데스크탑",
  homeTitle1: "포맷하기 전에,",
  homeTitle2: "버디가 같이",
  homeTitle3: "살펴볼게요.",
  homeLede:
    "공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와드려요.",
  homeStartCta: "PC 점검 시작",
  homeOpenReportCta: "리포트 열기",
  macHomeEyebrow: "Mac 미리보기 모드",
  macHomeTitle1: "Mac에서는,",
  macHomeTitle2: "리포트를 먼저",
  macHomeTitle3: "보여드릴게요.",
  macHomeLede:
    "실제 PC 점검은 Windows에서만 돌아요. Mac 앱에서는 시연용 리포트를 보거나, Windows에서 만든 리포트를 브라우저로 확인할 수 있어요.",
  macHomeStartCta: "시연용 리포트 보기",
  macPreviewBullets: [
    "Mac에서는 내 파일을 검사하지 않아요",
    "Windows 점검 화면을 디자인 그대로 확인할 수 있어요",
    "실제 점검은 Windows 앱에서 진행해요"
  ],

  scanTitle: "버디가 살펴보는 중",
  scanWaiting: "잠깐, 진단 준비할게요",
  scanLiveLabel: "진단 중",
  scanCancelCta: "점검 멈추기",

  reportTitle: "살펴봤어요",
  reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
  reportExportCta: "문제 해결용 자세한 파일 저장",
  reportExportHtmlCta: "공유용 리포트 저장",
  reportOpenWebCta: "받은 리포트 열기",
  reportBackCta: "처음으로",
  reportSavedPrefix: "자세한 진단 파일을 저장했어요: ",
  reportSaveCancelled: "자세한 진단 파일 저장을 취소했어요.",
  reportHtmlSavedPrefix: "공유용 리포트를 저장했어요: ",
  reportHtmlCancelled: "공유용 리포트 저장을 취소했어요.",
  reportHtmlError: "공유용 리포트를 저장하지 못했어요.",

  privacyHeadline: "이 PC 안에서만 동작해요",
  privacyBullets: [
    "서버로 어떤 파일도 보내지 않아요",
    "인증서 개인키·비밀번호는 수집하지 않아요",
    "진단 결과 파일은 직접 저장하고 공유해요"
  ],

  errorHeadline: "지금 진단을 마치지 못했어요",
  errorRetryCta: "다시 시도",

  windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
  windowsOnlyBody:
    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요.",
  macReportPreviewNote:
    "Mac에서는 보기만 할게요. Windows 전용 작업과 빠진 파일 확인 목록 만들기는 Windows PC에서 진행해주세요.",

  updateAvailable: "새 버전 받는 중이에요",
  updateDownloading: "버디가 새 버전을 챙겨오고 있어요",
  updateDownloaded: "준비 끝났어요. 다시 켜면 새 버전으로 시작해요",
  updateInstallCta: "지금 재시작",
  updateErrorLabel: "업데이트를 받지 못했어요",

  wingetSectionTitle: "포맷 후 한 번에 다시 깔 수 있는 앱",
  wingetSummary: (count: number) => `${count}개 앱은 포맷 후 한 번에 다시 깔 수 있게 정리했어요`,
  wingetUnavailable: "이 PC에선 자동 설치 목록을 만들 수 없어요. 직접 하나씩 다시 설치해야 해요.",

  manifestSectionTitle: "빠진 파일이 있는지 확인하는 목록",
  manifestExplain:
    "바탕화면·문서·다운로드 같은 곳에 어떤 파일이 있었는지 적어두면, 포맷 후 다시 옮겼을 때 빠진 파일이 있는지 한눈에 알 수 있어요.",
  manifestExportCta: "빠진 파일 확인 목록 만들기",
  manifestExportInProgress: "버디가 파일을 천천히 살펴보는 중이에요 (수십 초~수 분)",
  manifestExportSavedPrefix: "목록을 저장했어요: ",
  manifestExportCancelled: "저장을 취소했어요.",
  manifestExportErrorPrefix: "지금 만들지 못했어요: ",
  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요.",

  onboardingSteps: [
    {
      tag: "01 / 03 · 진단",
      head: "먼저, 같이 한 번",
      headEm: "살펴볼게요.",
      body: "내 PC를 천천히 훑어서 무엇을 챙겨야 할지 정리해요. 서버로는 아무것도 보내지 않아요."
    },
    {
      tag: "02 / 03 · 백업",
      head: "놓치기 쉬운 것부터",
      headEm: "먼저 챙길게요.",
      body: "공동인증서, 카카오톡, Wi-Fi. 한국 사용자가 가장 자주 빠뜨리는 항목을 우선으로 안내해요."
    },
    {
      tag: "03 / 03 · 포맷",
      head: "결정은 그때",
      headEm: "같이 정해요.",
      body: "버디는 포맷을 강요하지 않아요. 정리만으로 충분하면 그렇게 안내하고, 필요할 때만 다음 단계로 가요."
    }
  ] as const,
  onboardingStepsMac: [
    {
      tag: "01 / 03 · 미리보기",
      head: "Mac에서는 먼저",
      headEm: "리포트를 볼게요.",
      body: "실제 PC 점검은 Windows에서만 돌아요. Mac 앱은 화면 확인과 시연용 리포트 확인에 집중해요."
    },
    {
      tag: "02 / 03 · 확인",
      head: "Windows에서 만든 결과도",
      headEm: "열어볼 수 있어요.",
      body: "공유받은 리포트는 브라우저로 확인하고, 앱 안에서는 같은 디자인 톤을 미리 볼 수 있어요."
    },
    {
      tag: "03 / 03 · 시연",
      head: "실제 진단처럼",
      headEm: "속이지 않아요.",
      body: "Mac에서는 예시 리포트라고 분명히 안내하고, Windows 전용 버튼은 실행하지 않아요."
    }
  ] as const,
  onboardingNext: "다음",
  onboardingStart: "시작하기",
  onboardingSkip: "건너뛰기",

  errorHead: "지금은 진단을 잠깐 멈출게요.",
  errorBodyDefault:
    "한 번 더 시도하면 대부분 풀려요. 안 풀리면 PC를 잠깐 재시작해주세요.",
  errorRetry: "다시 시도",
  errorOpenLogs: "기록 위치 열기",
  errorCodePrefix: "오류 코드 ",

  recommendSectionTitle: "버디의 포맷 추천 점수",
  recommendScoreSuffix: "/ 100",
  recommendTryFirstTitle: "포맷 전에 먼저 시도해볼 것",
  recommendFormatReasonsTitle: "이런 점들이 신경 쓰여요",
  recommendAfterFormatTitle: "포맷 후 같이 챙길 것",
  recommendNoReasons: "지금 발견된 큰 문제는 없어요. 정기 정리만 해도 충분해요.",
  smartCareTitle: "한눈에 보는 관리 요약",
  smartCareLede:
    "정리·보안·속도·앱·포맷 준비를 한 번에 묶어서, 지금 먼저 볼 순서만 보여드릴게요.",
  smartCareNextTitle: "지금 먼저 할 일",
  smartCarePrivacyNote: "자동 삭제나 비밀번호 확인은 하지 않아요. 필요한 위치와 다음 행동만 알려드려요.",
  monitorTitle: "최근 점검 스냅샷",
  monitorSubtitle: "실시간 감시가 아니라, 가장 최근 점검 기록을 그대로 보여드려요.",
  monitorNoScan: "아직 저장된 점검 기록이 없어요. 한 번 점검하면 다음부터 변화도 같이 보여드릴게요.",
  homeQuickTitle: "바로 관리하기",
  homeQuickLede:
    "점검부터 시작해도 좋고, 필요한 관리 기능만 바로 열어도 좋아요.",
  homeQuickCleanup: "안전 정리",
  homeQuickCleanupHint: "직접 고른 후보만 30일 복구함으로 보내요.",
  homeQuickApps: "앱 정리",
  homeQuickAppsHint: "앱을 분류해서 보고, 남은 폴더까지 확인해요.",
  homeQuickSecurity: "보안 점검",
  homeQuickSecurityHint: "Windows 보안 상태와 기록을 그대로 확인해요.",
  homeQuickTrash: "복구함",
  homeQuickTrashHint: "정리한 항목을 30일 안에 되돌릴 수 있어요.",
  // v2.0 (Round D-8 / C4) — empty-state copy. Pages should reach for
  // these instead of hardcoding a "데이터 없어요" string, so the tone
  // stays consistent and i18n keys are pinned.
  emptyStateAuditTitle: "아직 기록할 활동이 없어요",
  emptyStateAuditBody:
    "정리나 앱 제거를 한 번 하면 여기에 시간순으로 쌓여요. 진단만 봐도 충분할 땐 이 화면은 비어 있어도 괜찮아요.",
  emptyStateCleanupTitle: "지울 게 거의 없어요",
  emptyStateCleanupBody:
    "휴지통도 비어 있고 임시 파일도 적어요. 가벼운 PC네요. 다음 점검에서 다시 살펴볼게요.",
  emptyStateAppsTitle: "최근 진단이 없어요",
  emptyStateAppsBody:
    "앱 분류는 진단 결과를 바탕으로 보여드려요. 점검을 한 번 돌리면 카테고리별로 정리해드릴게요.",
  emptyStateSecurityTitle: "Windows 보안이 잘 켜져 있어요",
  emptyStateSecurityBody:
    "실시간 보호도 켜져 있고 최근 검사 날짜도 멀지 않아요. 가끔 한 번씩 빠른 검사만 돌려도 충분해요.",
  nextStepsTitle: "이 결과로 바로 할 수 있는 일",
  nextStepsLede: "점검 끝났다고 손에서 떼지 마세요. 다음 행동 한 가지만 골라도 좋아요.",
  nextStepsCleanup: "안전 정리 시작",
  nextStepsCleanupHint: "30일 복구함으로 보낼 후보를 사용자가 직접 골라요.",
  nextStepsApps: "앱 정리 시작",
  nextStepsAppsHint: "카테고리별로 보고 Windows 기본 제거를 띄워드려요.",
  nextStepsSecurity: "보안 점검 열기",
  nextStepsSecurityHint: "Windows 보안 상태와 위협 기록을 그대로 보여드려요.",
  nextStepsReport: "리포트 다시 저장",
  nextStepsReportHint: "공유용 HTML 또는 자세한 진단 파일을 저장해요.",
  nextStepsRescan: "다시 점검",
  nextStepsRescanHint: "정리/제거가 끝났으면 다시 한 번 점수 비교해보세요.",
  /** D-37/D-39 — 빠른 다시 점검. User-facing copy avoids cache jargon. */
  nextStepsQuickRescan: "빠르게 다시 보기",
  nextStepsQuickRescanHint:
    "1시간 안에 본 결과라면 바로 보여드려요. 정리/제거 직후라면 자동으로 새 점검으로 돌려요.",
  compareTitle: "지난 점검과 비교",
  compareFirstRun: "이번이 첫 기록이에요. 다음 점검부터 점수와 정리 후보 변화를 비교해드릴게요.",
  safetyPreviewTitle: "안전 정리 미리보기",
  safetyPreviewLede:
    "지우기 전에 먼저 분류만 해요. 비교적 안전한 항목, 직접 확인할 항목, 앱 잔여 후보를 나눠 보여드릴게요.",
  safetyPreviewSafe: "비교적 안전",
  safetyPreviewReview: "직접 확인",
  safetyPreviewLeftovers: "앱 잔여 후보",
  ignoreAdd: "잠시 숨기기",
  ignoreRemove: "다시 보기",
  ignoreListNote: "숨긴 항목은 이 PC 안에만 저장돼요. 언제든 다시 볼 수 있어요.",
  healthSectionTitle: "PC 건강 점검",
  healthSectionLede:
    "포맷을 바로 정하기 전에, 정리·보안·속도·백업을 나눠서 쉬운 말로 볼게요.",
  healthTooltipLabel: "쉽게 보기",
  healthActionLabel: "열기",
  healthStatus: {
    good: "괜찮아요",
    check: "확인해봐요",
    action: "먼저 해봐요"
  } as const,
  careActionsTitle: "바로 해볼 수 있는 관리 기능",
  careActionsLede:
    "삭제와 보안 검사는 Windows 기본 화면으로 연결하고, 중요한 선택은 직접 확인하게 할게요.",
  careActionBadge: {
    ready: "준비됨",
    check: "확인 추천",
    warning: "먼저 확인",
    unavailable: "확인 못함"
  } as const,
  cleanupCenterTitle: "정리 후보 센터",
  cleanupCenterLede:
    "바로 지우는 기능이 아니라, 직접 보고 고를 수 있게 정리 후보만 먼저 모았어요.",
  cleanupCenterCoverageNote:
    "개인 파일은 자동 삭제하지 않아요. 큰 파일과 중복 의심 파일은 직접 열어보고 결정해주세요.",
  cleanupCenterSummary: (gb: number, reviewCount: number) =>
    `바로 확인해볼 후보는 약 ${gb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}GB, 직접 봐야 할 묶음은 ${reviewCount}개예요.`,
  cleanupStatusBadge: {
    ready: "챙겨뒀어요",
    review: "직접 보기",
    empty: "괜찮아요"
  } as const,
  cleanupLargeFilesTitle: "용량 큰 파일",
  cleanupDuplicatesTitle: "중복 의심 파일",
  cleanupStartupTitle: "시작 앱",
  cleanupNoDetail: "지금은 따로 크게 볼 후보가 적어요.",
  appInventoryTitle: "설치된 프로그램 분류",
  appInventoryLede:
    "Windows에 설치 기록이 남아 있는 프로그램을 모두 모아, 포맷 전에 챙길 이유별로 나눠봤어요.",
  appInventoryCoverageNote: "포터블 앱처럼 설치 기록이 없는 프로그램은 안 보일 수 있어요.",
  buddyChecklistTitle: "버디가 먼저 확인해뒀어요",
  buddyChecklistLede:
    "제가 볼 수 있는 항목은 체크해두고, 직접 확인해야 하는 건 따로 표시했어요.",
  buddyChecklistPrivacy:
    "인증서 비밀번호, 카카오톡 백업 비밀번호, 브라우저 비밀번호는 보지 않아요. 필요한 위치와 다음 행동만 알려드릴게요.",
  buddyChecklistSummary: (confirmed: number, needsUser: number, warning: number) =>
    `15개 중 ${confirmed}개는 버디가 확인했어요. ${needsUser}개는 직접 확인이 필요해요. ${warning}개는 그냥 넘기기 전에 한 번 더 봐야 해요.`,
  buddyChecklistBadge: {
    confirmed: "버디 확인",
    needs_user: "직접 확인",
    warning: "주의",
    unknown: "아직 몰라요"
  } as const,
  buddyChecklistStatusText: {
    confirmed: "버디가 확인했어요.",
    needs_user: "이건 앱 안에서 직접 확인해야 해요.",
    warning: "그냥 넘어가기엔 조금 신경 쓰여요.",
    unknown: "아직 확인하지 못했어요."
  } as const,
  recommendCommandLabel: "실행",
  recommendRunButton: "실행",
  recommendRunOpenedToast: "Windows 설정에서 해당 화면을 열어드렸어요.",
  recommendCommandHint: "버튼을 누르면 필요한 작업을 준비해드려요.",
  recommendRunCopiedToast: "실행할 문장을 복사했어요. Windows 검색에서 관리자 창을 열고 붙여넣어 주세요.",
  recommendRunRejectedToast: "지금은 직접 실행이 어려운 명령이에요. 복사도 안 됐어요.",
  /**
   * Severity copy moved to a structured table (v0.5.0) so recommend.ts can
   * build headline/summary from the same single source.
   * Source: design_handoff_format_buddy_app/desktop-app.jsx SEVERITY const.
   */
  recommendSeverity: {
    safe: {
      chip: "괜찮아요",
      head: "지금 PC, 굳이 포맷 안 해도 괜찮아요.",
      sub: "몇 가지 정리만 해도 충분히 더 쓸 수 있어요. 가볍게 같이 살펴볼게요."
    },
    watch: {
      chip: "체크해보면 좋아요",
      head: "한 번 정리하면 한참 더 쓸 수 있어요.",
      sub: "먼저 시도해볼 작업이 몇 가지 있어요. 그 다음에 다시 점수 볼게요."
    },
    organize: {
      chip: "정리가 필요해요",
      head: "포맷 전에, 같이 정리부터 시도해볼게요.",
      sub: "아래 정리 작업으로 점수가 충분히 내려가면 포맷을 미뤄도 돼요."
    },
    format: {
      chip: "꼭 챙길게요",
      head: "PC가 좀 지쳐 있어요. 포맷이 가장 깔끔해요.",
      sub: "백업부터 같이 챙길게요. 포맷 후 복원할 항목도 미리 정리해드릴게요."
    }
  } as const
} as const;
