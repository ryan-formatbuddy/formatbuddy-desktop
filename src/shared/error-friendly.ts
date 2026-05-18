/**
 * Converts raw error strings / Node errno codes into friendly Korean
 * sentences that match the FormatBuddy tone (살펴봤어요 / 같이 챙길게요 /
 * 잠시 멈췄어요). Never surfaces stack traces or OS error codes in the
 * returned string — that goes into a collapsible "기술 정보" section
 * separately.
 *
 * Pure function, no I/O — safe to call from both main and renderer.
 */

interface FriendlyInput {
  message?: string;
  code?: string;
  detail?: string;
}

const DEFAULT = "진단 도중 알 수 없는 문제가 있었어요. '기술 정보 보기'에서 자세한 내용을 확인할 수 있어요.";

export function friendlyErrorMessage(input: FriendlyInput | Error | string | null | undefined): string {
  if (!input) return DEFAULT;

  const message =
    typeof input === "string"
      ? input
      : "message" in input
        ? input.message ?? ""
        : "";
  const code = typeof input === "object" && input !== null && "code" in input ? input.code ?? "" : "";

  const haystack = `${code} ${message}`.toLowerCase();

  // Integrity / staging — surface first because these are real refusal cases.
  if (/integrity check failed/i.test(message)) {
    return "진단 스크립트가 변조된 것 같아 실행을 멈췄어요. 포맷버디를 다시 설치해주세요.";
  }
  if (/integrity manifest missing/i.test(message)) {
    return "포맷버디 내부 검증 파일이 없어요. 다시 설치해주세요.";
  }
  if (/refusing to spawn/i.test(message)) {
    return "진단 스크립트를 안전하게 준비하지 못해 실행을 보류했어요. 다시 시도해주세요.";
  }

  // Manifest export specific
  if (/manifest file was not written|manifest file is empty/i.test(message)) {
    return "manifest 파일을 저장하지 못했어요. 다른 폴더를 선택해 다시 시도해보세요.";
  }
  if (/manifest file missing/i.test(message)) {
    return "manifest 파일이 사라졌어요. 다른 폴더를 선택해 다시 시도해보세요.";
  }

  // Cancellation — neutral phrasing
  if (/cancel/i.test(message) || haystack.includes("aborterror")) {
    return "진단을 중간에 그만뒀어요. 다시 시작하시면 처음부터 살펴볼게요.";
  }

  // Filesystem
  if (/enospc|disk full|not enough space/i.test(haystack)) {
    return "디스크 공간이 부족해서 진단을 마치지 못했어요. 임시 파일을 정리한 뒤 다시 시도해주세요.";
  }
  if (/eacces|eperm|access.*denied|permission.*denied/i.test(haystack)) {
    return "권한이 부족해서 일부 정보를 읽지 못했어요. 포맷버디를 관리자 권한으로 다시 실행해보세요.";
  }
  if (/enoent|no such file/i.test(haystack)) {
    return "필요한 파일을 찾지 못했어요. 포맷버디를 다시 설치하거나 다시 시도해보세요.";
  }
  if (/ebusy|locked/i.test(haystack)) {
    return "다른 프로그램이 파일을 잡고 있어요. 잠시 후 다시 시도해주세요.";
  }

  // PowerShell exit codes
  const psExit = message.match(/powershell exited with code (-?\d+)/i);
  if (psExit) {
    const exitCode = psExit[1];
    if (/access.*denied|cannot.*be.*loaded|execution.*policy/i.test(message)) {
      return "PowerShell 실행 권한이 막혔어요. 관리자 권한으로 다시 실행해보세요.";
    }
    return `PowerShell이 코드 ${exitCode}로 멈췄어요. 다시 시도하거나 PC를 잠깐 재시작해주세요.`;
  }

  // JSON / schema
  if (/did not match expected scanreport schema|json/i.test(message)) {
    return "진단 결과 형식이 예상과 달라요. 다시 시도해주세요. 계속 같은 문제면 PC 재시작 후 다시 한 번.";
  }

  // Renderer bridge
  if (/electron 머린지|bridge/i.test(message)) {
    return "포맷버디 내부 연결이 끊겼어요. 앱을 다시 시작해주세요.";
  }

  // Network — auto-update path
  if (/enotfound|eai_again|econnrefused|network|fetch/i.test(haystack)) {
    return "인터넷 연결이 잠시 끊긴 것 같아요. 자동 업데이트는 다음에 다시 시도할게요.";
  }

  return DEFAULT;
}

export const __testing = { DEFAULT };
