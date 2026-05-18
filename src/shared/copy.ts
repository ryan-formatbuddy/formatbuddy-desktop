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
  updateErrorLabel: "업데이트를 받지 못했어요"
} as const;
