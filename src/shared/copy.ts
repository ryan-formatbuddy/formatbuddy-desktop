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

  scanTitle: "버디가 살펴보는 중",
  scanWaiting: "잠깐, 진단 준비할게요",
  scanLiveLabel: "진단 중",
  scanCancelCta: "그만하기",

  reportTitle: "살펴봤어요",
  reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
  reportExportCta: "JSON으로 저장",
  reportOpenWebCta: "웹 리포트 뷰어 열기",
  reportBackCta: "처음으로",

  privacyHeadline: "Ryan의 PC 안에서만 동작해요",
  privacyBullets: [
    "서버로 어떤 파일도 보내지 않아요",
    "인증서 개인키·비밀번호는 수집하지 않아요",
    "JSON 리포트는 Ryan이 직접 저장하고 공유해요"
  ],

  errorHeadline: "지금 진단을 마치지 못했어요",
  errorRetryCta: "다시 시도",

  windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
  windowsOnlyBody:
    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요.",

  updateAvailable: "새 버전 받는 중이에요",
  updateDownloading: "버디가 새 버전을 챙겨오고 있어요",
  updateDownloaded: "준비 끝났어요. 다시 켜면 새 버전으로 시작해요",
  updateInstallCta: "지금 재시작",
  updateErrorLabel: "업데이트를 받지 못했어요",

  wingetSectionTitle: "winget으로 다시 설치할 앱",
  wingetSummary: (count: number) => `${count}개 앱을 winget으로 다시 설치할 수 있게 정리했어요`,
  wingetUnavailable: "winget이 없어요. 앱 재설치 목록은 이번 PC에선 비워둘게요",

  manifestSectionTitle: "백업 파일 무결성 manifest",
  manifestExplain:
    "Desktop·Documents·Downloads 같은 사용자 폴더의 파일을 해시(SHA-256)로 정리해 저장해요. 포맷 후 복원할 때 같은 파일이 잘 돌아왔는지 확인할 수 있어요.",
  manifestExportCta: "백업 manifest 만들기",
  manifestExportInProgress: "버디가 파일을 천천히 살펴보는 중이에요 (수십 초~수 분)",
  manifestExportSavedPrefix: "저장했어요: ",
  manifestExportCancelled: "저장을 취소했어요.",
  manifestExportErrorPrefix: "지금 만들지 못했어요: ",
  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요.",

  recommendSectionTitle: "버디의 포맷 추천 점수",
  recommendScoreSuffix: "/ 100",
  recommendTryFirstTitle: "포맷 전에 먼저 시도해볼 것",
  recommendFormatReasonsTitle: "이런 점들이 신경 쓰여요",
  recommendAfterFormatTitle: "포맷 후 같이 챙길 것",
  recommendNoReasons: "지금 발견된 큰 문제는 없어요. 정기 정리만 해도 충분해요.",
  recommendCommandLabel: "실행",
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
