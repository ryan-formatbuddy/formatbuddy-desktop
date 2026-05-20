import type {
  BuddyChecklistCategory,
  BuddyChecklistItem,
  BuddyChecklistPriority,
  BuddyCheckStatus,
  InstalledApp,
  ScanReport,
  UserFolderInfo
} from "@shared/types";

type ItemInput = {
  id: string;
  category: BuddyChecklistCategory;
  label: string;
  priority: BuddyChecklistPriority;
  status: BuddyCheckStatus;
  evidence: string;
  helperText: string;
  guide: string[];
};

const PERSONAL_FOLDER_NAMES = new Set(["desktop", "documents", "downloads", "pictures", "videos"]);

function item(input: ItemInput): BuddyChecklistItem {
  return input;
}

function formatGb(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}GB`;
}

function folderSize(folder: UserFolderInfo | undefined): number {
  return folder?.exists && typeof folder.sizeGb === "number" ? folder.sizeGb : 0;
}

function folderByName(report: ScanReport, name: string): UserFolderInfo | undefined {
  return report.userFolders.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

function appText(app: InstalledApp): string {
  return `${app.name ?? ""} ${app.publisher ?? ""}`.toLowerCase();
}

function matchingApps(report: ScanReport, patterns: RegExp[]): InstalledApp[] {
  return report.installedApps.filter((app) => patterns.some((p) => p.test(appText(app))));
}

function names(apps: InstalledApp[], limit = 3): string {
  const picked = apps.map((a) => a.name).filter(Boolean).slice(0, limit);
  if (picked.length === 0) return "관련 앱";
  const suffix = apps.length > picked.length ? ` 외 ${apps.length - picked.length}개` : "";
  return `${picked.join(", ")}${suffix}`;
}

function installedBrowserNames(report: ScanReport): string[] {
  const fromPresence = report.browsers
    .filter((b) => b.installed || b.profileExists || b.bookmarksFileExists)
    .map((b) => b.name);
  const fromApps = matchingApps(report, [/chrome/i, /edge/i, /firefox/i, /whale/i]).map((a) => a.name);
  return Array.from(new Set([...fromPresence, ...fromApps].filter(Boolean)));
}

function hasBitlockerOn(report: ScanReport): boolean {
  return report.bitlocker.some((v) => {
    const protection = String(v.ProtectionStatus ?? "").toLowerCase();
    const volume = String(v.VolumeStatus ?? "").toLowerCase();
    const pct = typeof v.EncryptionPercentage === "number" ? v.EncryptionPercentage : 0;
    return protection.includes("on") || volume.includes("encrypted") || pct > 0;
  });
}

function hasBitlockerWarning(report: ScanReport): boolean {
  return report.bitlocker.some((v) => {
    const protection = String(v.ProtectionStatus ?? "").toLowerCase();
    const volume = String(v.VolumeStatus ?? "").toLowerCase();
    const pct = typeof v.EncryptionPercentage === "number" ? v.EncryptionPercentage : 0;
    const active = protection.includes("on") || volume.includes("encrypted") || pct > 0;
    return (
      active &&
      (protection.includes("unknown") ||
        protection.includes("off") ||
        volume.includes("lock") ||
        volume.includes("progress") ||
        volume.includes("unknown"))
    );
  });
}

function defenderScanAge(report: ScanReport): number | null {
  const quick = report.defender?.lastQuickScanDaysAgo;
  const full = report.defender?.lastFullScanDaysAgo;
  const values = [quick, full].filter((v): v is number => typeof v === "number");
  return values.length ? Math.min(...values) : null;
}

export function buildBuddyChecklist(report: ScanReport): BuddyChecklistItem[] {
  const existingNpki = report.npkiCandidates.filter((n) => n.exists);
  const personalFolders = report.userFolders.filter(
    (f) => f.exists && PERSONAL_FOLDER_NAMES.has(f.name.toLowerCase())
  );
  const totalPersonalGb = personalFolders.reduce((sum, f) => sum + folderSize(f), 0);
  const downloadsGb = folderSize(folderByName(report, "Downloads"));
  const cloudFolders = report.cloudSync.filter((c) => c.exists);
  const browsers = installedBrowserNames(report);
  const browserProfiles = report.browsers.filter((b) => b.profileExists || b.bookmarksFileExists);
  const browserBookmarks = report.browsers.filter((b) => b.bookmarksFileExists);
  const kakaoApps = matchingApps(report, [/kakaotalk/i, /kakao talk/i, /카카오톡/i]);
  const kakaoData = (report.appDataCandidates ?? []).filter((c) => /kakao/i.test(c.app) && c.exists);
  const kakaoDataGb = kakaoData.reduce((sum, c) => sum + (typeof c.sizeGb === "number" ? c.sizeGb : 0), 0);
  const outlookApps = matchingApps(report, [/outlook/i, /microsoft 365/i, /microsoft office/i, /office 365/i]);
  const mailFiles = report.mailDataFiles ?? [];
  const mailFileGb = mailFiles.reduce((sum, f) => sum + (typeof f.sizeGb === "number" ? f.sizeGb : 0), 0);
  const paidApps = matchingApps(report, [
    /adobe/i,
    /hancom/i,
    /한컴/i,
    /hwp/i,
    /office/i,
    /microsoft 365/i,
    /autocad/i,
    /autodesk/i,
    /더존/i,
    /douzone/i,
    /위하고/i,
    /wehago/i
  ]);
  const legacyPaidApps = paidApps.filter((a) => /hancom|한컴|hwp|autocad|autodesk|더존|douzone/i.test(appText(a)));
  const workApps = matchingApps(report, [
    /더존/i,
    /douzone/i,
    /위하고/i,
    /wehago/i,
    /세무사랑/i,
    /홈택스/i,
    /hometax/i,
    /tax/i,
    /accounting/i,
    /회계/i
  ]);
  const gameWorkApps = matchingApps(report, [
    /steam/i,
    /epic games/i,
    /kakaogames/i,
    /kakao games/i,
    /battle\.net/i,
    /riot/i,
    /visual studio code/i,
    /\bvs code\b/i,
    /cursor/i,
    /\bgit\b/i,
    /sourcetree/i,
    /premiere/i,
    /after effects/i,
    /ableton/i,
    /cubase/i,
    /fl studio/i
  ]);
  const devLikeApps = gameWorkApps.filter((a) => /visual studio code|vs code|cursor|\bgit\b|sourcetree/i.test(appText(a)));
  const accountSignals = [
    ...browsers,
    ...kakaoApps.map((a) => a.name),
    ...cloudFolders.map((c) => c.provider),
    ...matchingApps(report, [/google/i, /apple/i, /microsoft/i]).map((a) => a.name)
  ].filter(Boolean);
  const oldDriverPct = report.driverAge?.olderThan2YearsPercent ?? 0;
  const scanAge = defenderScanAge(report);

  return [
    item({
      id: "certificate-backed-up",
      category: "certificate",
      label: "공동인증서/NPKI를 직접 백업했나요?",
      priority: "high",
      status: existingNpki.length > 1 ? "warning" : existingNpki.length === 1 ? "needs_user" : "confirmed",
      evidence:
        existingNpki.length > 1
          ? `NPKI 폴더가 ${existingNpki.length}곳에서 발견됐어요. 흩어져 있을 수 있어요.`
          : existingNpki.length === 1
            ? "NPKI 폴더가 1곳에서 발견됐어요. 백업 완료 여부는 직접 확인해주세요."
            : "공동인증서 폴더가 보이지 않아요. 사용하지 않는 PC라면 넘어가도 괜찮아요.",
      helperText:
        existingNpki.length > 0
          ? "인증서 파일과 비밀번호는 보지 않아요. 폴더 위치만 알려드릴게요."
          : "공동인증서를 쓰지 않는 PC라면 이 항목은 괜찮아요.",
      guide: [
        "은행·증권·홈택스 인증서를 쓰는지 먼저 떠올려보세요.",
        "쓰고 있다면 NPKI 폴더를 통째로 외장 저장소에 옮겨두세요.",
        "비밀번호는 앱이 확인하지 않으니 직접 기억해두셔야 해요."
      ]
    }),
    item({
      id: "personal-folders-reviewed",
      category: "files",
      label: "다운로드·문서·바탕화면 용량을 확인했나요?",
      priority: "high",
      status: totalPersonalGb >= 50 || downloadsGb >= 50 ? "warning" : totalPersonalGb >= 5 ? "needs_user" : "confirmed",
      evidence:
        downloadsGb >= 50
          ? `다운로드 폴더에 ${formatGb(downloadsGb)}가 있어요. 포맷 전 꼭 확인해주세요.`
          : totalPersonalGb >= 5
            ? `자주 쓰는 폴더에 총 ${formatGb(totalPersonalGb)}가 있어요.`
            : `자주 쓰는 폴더 용량이 ${formatGb(totalPersonalGb)} 정도라 가벼워 보여요.`,
      helperText:
        totalPersonalGb >= 5
          ? "파일은 자동으로 옮기지 않아요. 어디에 둘지만 먼저 정하면 됩니다."
          : "큰 파일 신호는 적지만, 중요한 문서는 한 번만 눈으로 확인해주세요.",
      guide: [
        "바탕화면, 문서, 다운로드를 먼저 확인하세요.",
        "사진·영상처럼 큰 파일은 외장 저장소나 클라우드에 따로 옮겨두세요.",
        "필요 없는 설치 파일은 포맷 전에 정리해도 괜찮아요."
      ]
    }),
    item({
      id: "bitlocker-key-ready",
      category: "security",
      label: "BitLocker 복구 키를 확인했나요?",
      priority: "high",
      status: hasBitlockerWarning(report) ? "warning" : hasBitlockerOn(report) ? "needs_user" : "confirmed",
      evidence: hasBitlockerOn(report)
        ? `${report.bitlocker[0]?.MountPoint ?? "드라이브"}에 BitLocker가 켜져 있어요. 복구 키 위치를 직접 확인해주세요.`
        : "BitLocker가 켜진 드라이브는 보이지 않아요.",
      helperText: hasBitlockerOn(report)
        ? "복구 키 자체는 앱이 읽지 않아요. 저장 위치만 직접 확인해주세요."
        : "암호화 드라이브 신호가 없어 이 항목은 가볍게 넘어가도 돼요.",
      guide: [
        "Microsoft 계정의 복구 키 페이지를 확인하세요.",
        "회사 PC라면 관리자나 전산 담당자에게 먼저 물어보세요.",
        "복구 키를 모르면 포맷/복원 중 막힐 수 있어요."
      ]
    }),
    item({
      id: "messenger-backup-ready",
      category: "apps",
      label: "카카오톡 백업 후 같은 계정으로 복원 가능한가요?",
      priority: "high",
      status: kakaoDataGb >= 5 ? "warning" : kakaoApps.length > 0 || kakaoData.length > 0 ? "needs_user" : "confirmed",
      evidence: kakaoDataGb >= 5
        ? `카카오톡 데이터 폴더 후보가 약 ${formatGb(kakaoDataGb)}로 보여요. 대화 백업을 꼭 확인해주세요.`
        : kakaoApps.length > 0 || kakaoData.length > 0
          ? "카카오톡이 설치되어 있거나 데이터 폴더 후보가 있어요. 대화 백업은 앱 안에서 직접 확인해주세요."
        : "카카오톡 설치 흔적은 보이지 않아요.",
      helperText: "카카오톡 백업 비밀번호나 대화 내용은 포맷버디가 보지 않아요.",
      guide: [
        "카카오톡 설정에서 대화 백업 상태를 확인하세요.",
        "백업 비밀번호와 로그인 계정을 직접 챙겨주세요.",
        "사진·파일은 별도로 저장되어 있는지도 확인하면 좋아요."
      ]
    }),
    item({
      id: "browser-backup-ready",
      category: "browser",
      label: "브라우저 즐겨찾기와 로그인 계정을 확인했나요?",
      priority: "high",
      status: browserProfiles.length > 1 ? "warning" : browsers.length > 0 || browserBookmarks.length > 0 ? "needs_user" : "confirmed",
      evidence:
        browserProfiles.length > 1
          ? `${browserProfiles.map((b) => b.name).slice(0, 3).join(", ")} 프로필 후보가 보여요. 즐겨찾기와 계정 동기화를 확인해주세요.`
          : browserBookmarks.length > 0
            ? `${browserBookmarks[0].name} 즐겨찾기 파일 후보가 보여요. 동기화 상태를 확인해주세요.`
            : browsers.length > 0
              ? `${browsers[0]} 사용 흔적이 있어요. 즐겨찾기와 로그인 계정을 확인해주세요.`
            : "브라우저 프로필 후보가 보이지 않아요.",
      helperText: "브라우저 비밀번호는 읽지 않아요. 동기화 상태만 직접 확인하면 됩니다.",
      guide: [
        "Chrome, Edge, Whale 중 실제로 쓰는 브라우저를 확인하세요.",
        "즐겨찾기와 비밀번호 동기화가 켜져 있는지 보세요.",
        "회사/개인 계정을 나눠 쓰면 둘 다 로그인 가능한지 확인하세요."
      ]
    }),
    item({
      id: "mail-outlook-backed-up",
      category: "mail",
      label: "Outlook에만 있는 메일·연락처·일정이 있나요?",
      priority: "medium",
      status: mailFiles.length > 1 || mailFileGb >= 5 ? "warning" : mailFiles.length > 0 || outlookApps.length > 0 ? "needs_user" : "confirmed",
      evidence: mailFiles.length > 1 || mailFileGb >= 5
        ? `Outlook 데이터 파일 ${mailFiles.length}개, 약 ${formatGb(mailFileGb)}가 발견됐어요. 백업 여부를 확인해주세요.`
        : mailFiles.length > 0
          ? "Outlook 데이터 파일 후보가 발견됐어요. PC에만 있는 메일 자료인지 확인해주세요."
          : outlookApps.length > 0
            ? `${names(outlookApps)} 후보가 발견됐어요. PC에만 있는 메일 자료가 있는지 확인해주세요.`
        : "Outlook 또는 Office 메일 후보는 보이지 않아요.",
      helperText: "메일 내용은 열어보지 않아요. 자료가 이 PC에만 있는지만 확인해주세요.",
      guide: [
        "Outlook에서 계정이 클라우드 동기화인지 확인하세요.",
        "PST 파일을 따로 쓰는 경우 외장 저장소에 옮겨두세요.",
        "연락처와 일정도 함께 확인하면 안전해요."
      ]
    }),
    item({
      id: "paid-app-license-ready",
      category: "license",
      label: "유료 앱 계정·라이선스·기기 해제를 확인했나요?",
      priority: "medium",
      status: legacyPaidApps.length > 0 ? "warning" : paidApps.length > 0 ? "needs_user" : "confirmed",
      evidence: paidApps.length > 0
        ? `${names(paidApps)}가 설치되어 있어요. 로그인 계정과 라이선스를 확인해주세요.`
        : "유료 앱 후보는 크게 보이지 않아요.",
      helperText: "라이선스 번호나 계정 비밀번호는 앱이 확인하지 않아요.",
      guide: [
        "Adobe, 한컴, Office, AutoCAD 같은 앱을 먼저 보세요.",
        "기기 해제가 필요한 앱은 포맷 전에 해제해두세요.",
        "구형 영구 라이선스는 설치 파일과 시리얼을 따로 보관하세요."
      ]
    }),
    item({
      id: "driver-list-saved",
      category: "drivers",
      label: "프린터·Wi‑Fi·그래픽 드라이버를 확인했나요?",
      priority: "medium",
      status: oldDriverPct >= 60 ? "warning" : report.printers.length > 1 ? "needs_user" : "confirmed",
      evidence:
        oldDriverPct >= 60
          ? `오래된 드라이버 비율이 ${oldDriverPct.toFixed(1)}%예요. 포맷 후 드라이버를 다시 챙겨주세요.`
          : `프린터 ${report.printers.length}개, Wi‑Fi 프로필 ${report.wifiProfiles.length}개를 기록했어요.`,
      helperText: "Wi‑Fi 비밀번호는 읽지 않아요. 프로필 이름과 장치 목록만 기록해요.",
      guide: [
        "프린터가 여러 대라면 모델명을 사진으로 남겨두세요.",
        "Wi‑Fi 이름은 기록했지만 비밀번호는 직접 챙겨야 해요.",
        "그래픽·오디오·네트워크 드라이버는 포맷 후 Windows Update도 확인하세요."
      ]
    }),
    item({
      id: "cloud-sync-checked",
      category: "cloud",
      label: "OneDrive/Google Drive 동기화 상태를 확인했나요?",
      priority: "high",
      status: cloudFolders.length > 1 ? "warning" : cloudFolders.length === 1 ? "needs_user" : "confirmed",
      evidence: cloudFolders.length > 0
        ? `${cloudFolders.map((c) => c.provider).join(", ")} 폴더가 있어요. 동기화 완료 상태를 확인해주세요.`
        : "클라우드 동기화 폴더 후보는 보이지 않아요.",
      helperText: "동기화 완료 여부는 앱이 확정하지 않아요. 상태 아이콘을 직접 봐주세요.",
      guide: [
        "동기화 앱 아이콘에 오류 표시가 없는지 확인하세요.",
        "온라인 전용 파일은 포맷 후 다시 받아야 할 수 있어요.",
        "중요 폴더는 웹에서도 열리는지 한 번 확인하면 안전해요."
      ]
    }),
    item({
      id: "windows-backup-settings-ready",
      category: "backup",
      label: "Windows 계정과 백업 설정이 켜져 있나요?",
      priority: "medium",
      status: cloudFolders.some((c) => /onedrive/i.test(c.provider)) ? "needs_user" : "unknown",
      evidence: cloudFolders.some((c) => /onedrive/i.test(c.provider))
        ? "OneDrive 폴더가 보여요. Windows 백업 설정은 한 번 더 확인해주세요."
        : "Microsoft 계정/Windows 백업 상태는 아직 앱이 확정하지 못했어요.",
      helperText: "계정 비밀번호는 확인하지 않아요. 백업 설정 화면에서 직접 확인해주세요.",
      guide: [
        "Windows 설정의 계정 메뉴를 열어 로그인 계정을 확인하세요.",
        "바탕화면·문서·사진 백업이 켜져 있는지 보세요.",
        "저장 용량이 부족하면 동기화가 멈출 수 있어요."
      ]
    }),
    item({
      id: "security-scan-ready",
      category: "security",
      label: "포맷 전에 수상한 흔적을 한 번 검사했나요?",
      priority: "high",
      status:
        report.defender?.antivirusEnabled === false || report.defender?.realTimeProtectionEnabled === false
          ? "warning"
          : scanAge == null
            ? "unknown"
            : scanAge <= 7
              ? "confirmed"
              : "needs_user",
      evidence:
        report.defender?.antivirusEnabled === false || report.defender?.realTimeProtectionEnabled === false
          ? "Windows 보안 실시간 보호가 꺼져 있어요. 포맷 전 먼저 확인해주세요."
          : scanAge == null
            ? "최근 보안 검사 날짜를 확인하지 못했어요."
            : scanAge <= 7
              ? "Windows 보안 실시간 보호가 켜져 있고 최근 검사 기록도 있어요."
              : `최근 검사 기록이 ${scanAge}일 전이에요. 포맷 전 한 번 검사해보세요.`,
      helperText: "포맷버디는 백신처럼 치료하지 않아요. 수상한 흔적을 확인하도록 도와요.",
      guide: [
        "Windows 보안에서 빠른 검사를 한 번 실행하세요.",
        "위협 기록이 있다면 이름과 날짜를 메모해두세요.",
        "Windows 보안 화면의 실제 상태를 기준으로 확인하세요."
      ]
    }),
    item({
      id: "work-program-data-ready",
      category: "work",
      label: "업무용 프로그램 자료가 이 PC에만 있나요?",
      priority: "high",
      status: workApps.length > 0 ? "needs_user" : "confirmed",
      evidence: workApps.length > 0
        ? `${names(workApps)} 후보가 발견됐어요. 데이터 위치와 복원 방법을 확인해주세요.`
        : "업무용 프로그램 후보는 크게 보이지 않아요.",
      helperText: "업무 자료 내용은 열어보지 않아요. 프로그램 이름만 보고 알려드려요.",
      guide: [
        "더존, 위하고, 세무사랑 같은 프로그램은 복원 방법이 따로 있을 수 있어요.",
        "스캐너/회계/세무 프로그램은 데이터 폴더 위치를 담당자에게 확인하세요.",
        "회사 자료라면 포맷 전에 반드시 관리자에게 물어보세요."
      ]
    }),
    item({
      id: "game-work-app-settings-ready",
      category: "work",
      label: "게임 저장 데이터나 작업 앱 설정을 따로 쓰고 있나요?",
      priority: "medium",
      status: devLikeApps.length > 0 ? "warning" : gameWorkApps.length > 0 ? "needs_user" : "confirmed",
      evidence: gameWorkApps.length > 0
        ? `${names(gameWorkApps)} 설정 후보가 보여요. 저장 데이터와 작업 환경을 확인해주세요.`
        : "게임 저장 데이터나 작업 앱 설정 후보는 크게 보이지 않아요.",
      helperText: "앱 설정 파일을 직접 열지 않고, 설치된 앱 이름으로만 후보를 잡아요.",
      guide: [
        "Steam/Epic 게임은 클라우드 저장이 켜져 있는지 확인하세요.",
        "VS Code, Cursor, Git을 쓰면 설정과 SSH 키를 직접 확인하세요.",
        "영상·음악 작업 앱은 플러그인과 프리셋 위치도 챙기면 좋아요."
      ]
    }),
    item({
      id: "account-recovery-ready",
      category: "account",
      label: "주요 계정의 로그인 수단을 다시 확인했나요?",
      priority: "high",
      status: accountSignals.length > 0 ? "needs_user" : "confirmed",
      evidence: accountSignals.length > 0
        ? `${Array.from(new Set(accountSignals)).slice(0, 3).join(", ")} 사용 흔적이 있어요. 복구 이메일과 2단계 인증을 확인해주세요.`
        : "주요 계정 앱이나 브라우저 사용 흔적이 크게 보이지 않아요.",
      helperText: "비밀번호와 2단계 인증 상태는 앱이 볼 수 없어서 직접 확인이 필요해요.",
      guide: [
        "Google, Microsoft, Apple, 카카오 계정에 다시 로그인 가능한지 확인하세요.",
        "복구 이메일과 휴대폰 번호가 지금도 맞는지 보세요.",
        "2단계 인증 앱과 백업 코드는 포맷 전에 따로 챙겨주세요."
      ]
    }),
    item({
      id: "report-saved",
      category: "backup",
      label: "포맷 전 리포트와 복원 준비 파일을 저장했나요?",
      priority: "high",
      status: report.generatedAt ? "needs_user" : "warning",
      evidence: report.generatedAt
        ? "진단 리포트는 만들어졌어요. 공유용 리포트와 빠진 파일 확인 목록은 버튼으로 저장해주세요."
        : "진단 리포트 생성 상태를 확인하지 못했어요.",
      helperText: "저장 버튼을 눌러야 포맷 후 다시 볼 수 있는 파일이 남아요.",
      guide: [
        "공유용 리포트를 먼저 저장하세요.",
        "Windows PC에서는 빠진 파일 확인 목록도 만들어두세요.",
        "저장한 파일은 외장 저장소나 클라우드에도 한 번 더 옮기면 좋아요."
      ]
    })
  ];
}
