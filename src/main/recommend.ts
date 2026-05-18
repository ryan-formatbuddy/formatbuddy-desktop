/**
 * Recommendation engine — turns a raw ScanReport into a "format score" plus
 * actionable advice. Pure function, no I/O, no electron imports → easy to test.
 *
 * Scoring philosophy (subject to change as we get Windows-field data):
 *   - 100 = format strongly recommended
 *   - 0   = healthy
 *
 * Weights are tuned conservatively: a single bad signal cannot push the score
 * over the "format-required" threshold by itself; multiple bad signals must
 * agree. This matches the friend-tone — we suggest "first try X" before
 * suggesting "format".
 */

import type {
  ActionItem,
  HealthPillar,
  HealthPillarStatus,
  Recommendation,
  ReasonItem,
  ScanReport,
  FormatSeverity
} from "@shared/types";
import { copy } from "@shared/copy";
import { buildBuddyChecklist } from "./buddyChecklist";

const WEIGHTS = {
  diskHealth: 0.30,
  diskFree: 0.15,
  memoryPressure: 0.10,
  eventLog: 0.10,
  windowsUpdate: 0.10,
  driverAge: 0.10,
  defender: 0.05,
  storageWaste: 0.10
} as const;

function clamp01to100(v: number): number {
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function diskHealthScore(report: ScanReport): number {
  const health = report.diskHealth ?? [];
  if (health.length === 0) return 0;
  let worst = 0;
  for (const d of health) {
    const status = (d.healthStatus ?? "").toLowerCase();
    const op = (d.operationalStatus ?? "").toLowerCase();
    if (status.includes("unhealthy") || status.includes("failed")) worst = Math.max(worst, 100);
    else if (status.includes("warning")) worst = Math.max(worst, 70);
    else if (op && !op.includes("ok") && !op.includes("online")) worst = Math.max(worst, 60);
  }
  return worst;
}

function diskFreeScore(report: ScanReport): number {
  if (!report.disks || report.disks.length === 0) return 0;
  let worst = 0;
  for (const d of report.disks) {
    if (!d.sizeGb || d.sizeGb <= 0) continue;
    const pct = (d.freeGb / d.sizeGb) * 100;
    if (pct < 3) worst = Math.max(worst, 100);
    else if (pct < 7) worst = Math.max(worst, 80);
    else if (pct < 12) worst = Math.max(worst, 55);
    else if (pct < 20) worst = Math.max(worst, 25);
  }
  return worst;
}

function memoryPressureScore(report: ScanReport): number {
  const m = report.memoryPressure;
  if (!m) return 0;
  let s = 0;
  if (typeof m.pageFileUsagePercent === "number") {
    if (m.pageFileUsagePercent > 85) s = Math.max(s, 80);
    else if (m.pageFileUsagePercent > 60) s = Math.max(s, 50);
    else if (m.pageFileUsagePercent > 40) s = Math.max(s, 25);
  }
  if (typeof m.freeMemoryPercent === "number" && m.freeMemoryPercent !== null) {
    if (m.freeMemoryPercent < 5) s = Math.max(s, 80);
    else if (m.freeMemoryPercent < 12) s = Math.max(s, 50);
  }
  return s;
}

function eventLogScore(report: ScanReport): number {
  const e = report.eventLog;
  if (!e) return 0;
  if (e.criticalCount >= 10) return 100;
  if (e.criticalCount >= 5) return 70;
  if (e.criticalCount >= 1) return 40;
  if (e.errorCount >= 30) return 50;
  if (e.errorCount >= 10) return 25;
  return 0;
}

function windowsUpdateScore(report: ScanReport): number {
  const w = report.windowsUpdate;
  if (!w || w.daysSinceLatestHotfix == null) return 0;
  if (w.daysSinceLatestHotfix > 120) return 80;
  if (w.daysSinceLatestHotfix > 60) return 50;
  if (w.daysSinceLatestHotfix > 35) return 30;
  return 0;
}

function driverAgeScore(report: ScanReport): number {
  const d = report.driverAge;
  if (!d || d.totalWithDate === 0) return 0;
  const p = d.olderThan2YearsPercent;
  if (p > 80) return 70;
  if (p > 60) return 50;
  if (p > 40) return 25;
  return 0;
}

function defenderScore(report: ScanReport): number {
  const d = report.defender;
  if (!d) return 0;
  if (d.antivirusEnabled === false) return 80;
  if (d.realTimeProtectionEnabled === false) return 60;
  if (typeof d.antivirusSignatureAgeDays === "number" && d.antivirusSignatureAgeDays > 14) return 40;
  return 0;
}

function storageWasteScore(report: ScanReport): number {
  const s = report.storageWaste;
  if (!s) return 0;
  let v = 0;
  if (s.windowsOldExists && s.windowsOldGb > 5) v = Math.max(v, 60);
  const tempTotal = s.userTempGb + s.localAppDataTempGb + s.windowsTempGb;
  if (tempTotal > 20) v = Math.max(v, 50);
  else if (tempTotal > 10) v = Math.max(v, 25);
  return v;
}

function getSeverity(score: number): FormatSeverity {
  // v0.5.0 — adopted from design_handoff_format_buddy_app desktop-app.jsx
  // severityFor(). Equal-width quartiles, 4-tier care-intensity scale.
  if (score <= 25) return "safe";
  if (score <= 50) return "watch";
  if (score <= 75) return "organize";
  return "format";
}

/**
 * Disk-health override: if any disk reports Unhealthy/Failed/Warning, the
 * severity is forced upward regardless of the weighted total. A failing
 * drive is "back up RIGHT NOW", not "safe", even if every other signal
 * is clean. (Names updated for v0.5.0 severity union.)
 */
function applyDiskHealthOverride(severity: FormatSeverity, rawDiskHealth: number): FormatSeverity {
  if (rawDiskHealth >= 100) {
    // Unhealthy / Failed → at least "organize"
    if (severity === "safe" || severity === "watch") return "organize";
  } else if (rawDiskHealth >= 70) {
    // Warning → at least "watch"
    if (severity === "safe") return "watch";
  }
  return severity;
}

function getHeadline(severity: FormatSeverity, _score: number): string {
  // Single source for severity copy is shared/copy.ts (v0.5.0). recommend.ts
  // just looks up; the score number is rendered separately by the UI.
  return copy.recommendSeverity[severity].head;
}

function getSummary(severity: FormatSeverity, _reasons: ReasonItem[]): string {
  return copy.recommendSeverity[severity].sub;
}

function pushReason(
  reasons: ReasonItem[],
  signal: string,
  label: string,
  rawScore: number,
  weight: number,
  description: string,
  help?: string,
  nextStep?: string
) {
  if (rawScore <= 0) return;
  // v0.4.1: floor is now based on raw score (must be ≥30/100) so low-weight
  // signals (Defender = 5%) still surface when they go bad — previously the
  // absolute `weighted < 5` floor silently dropped every Defender problem.
  if (rawScore < 30) return;
  const weighted = rawScore * weight;
  reasons.push({
    signal,
    label,
    weightedScore: Math.round(weighted * 10) / 10,
    description,
    help,
    nextStep
  });
}

function buildTryFirst(report: ScanReport, reasons: ReasonItem[]): ActionItem[] {
  const actions: ActionItem[] = [];
  const signals = new Set(reasons.map((r) => r.signal));

  actions.push({
    title: "임시 파일 정리",
    description: "휴지통과 오래 쌓인 임시 파일을 비워요. 포맷 전에 가장 먼저 해볼 만해요.",
    command: "cleanmgr /sageset:1"
  });
  actions.push({
    title: "Windows 기본 파일 확인",
    description: "Windows가 꼭 필요한 파일을 스스로 확인하고, 가능한 것은 고쳐요.",
    command: "sfc /scannow"
  });
  actions.push({
    title: "Windows 복구 도구 실행",
    description: "업데이트나 복구에 필요한 재료가 빠졌는지 확인하고 다시 받아요.",
    command: "DISM /Online /Cleanup-Image /RestoreHealth"
  });

  if (signals.has("windows-update")) {
    actions.push({
      title: "Windows Update 실행",
      description: "오래 밀린 업데이트를 받아요. 보안과 안정성이 같이 좋아질 수 있어요.",
      command: "start ms-settings:windowsupdate"
    });
  }
  if (signals.has("disk-free")) {
    actions.push({
      title: "저장 공간 정리 화면 열기",
      description: "큰 파일과 오래된 임시 파일을 확인해요. 지울지 말지는 Ryan이 직접 고르면 돼요.",
      command: "start ms-settings:storagesense"
    });
  }
  if (signals.has("startup-bloat") || (report.startupPrograms && report.startupPrograms.count > 12)) {
    actions.push({
      title: "시작 프로그램 정리",
      description: "PC 켤 때 같이 뜨는 앱을 줄여요. 삭제가 아니라 끄기라서 부담이 적어요.",
      command: "taskmgr /0 /startup"
    });
  }
  // v0.4.1: Defender action is now built directly from report.defender, not
  // gated on signals.has("defender") — Defender's 5% weight means it could
  // be filtered out of `reasons` even when antivirus is fully disabled.
  const def = report.defender;
  if (def && (def.antivirusEnabled === false || def.realTimeProtectionEnabled === false ||
              (typeof def.antivirusSignatureAgeDays === "number" && def.antivirusSignatureAgeDays > 14))) {
    actions.push({
      title: "Windows 보안 확인",
      description: "포맷버디가 직접 잡는 게 아니라, Windows 기본 보안 기능을 열어 확인하게 도와요.",
      command: "start windowsdefender:"
    });
  }

  return actions;
}

function buildAfterFormat(report: ScanReport): ActionItem[] {
  const actions: ActionItem[] = [];

  if (report.winget?.available) {
    actions.push({
      title: "앱 한 번에 다시 깔 준비",
      description: "포맷 전에 저장한 앱 목록으로, 자주 쓰던 앱을 빠르게 다시 깔 수 있어요."
    });
  }
  actions.push({
    title: "옮겨온 파일이 잘 왔는지 확인",
    description: "포맷 전 만들어둔 빠진 파일 확인 목록을 열어, 옮겨온 파일이 빠진 게 없는지 한 번 살펴주세요."
  });
  if (report.npkiCandidates?.some((n) => n.exists)) {
    actions.push({
      title: "공동인증서(NPKI) 복원",
      description: "NPKI 폴더를 통째로 새 PC의 같은 경로에 복사하면 바로 사용 가능해요."
    });
  }
  if (report.cloudSync?.some((c) => c.exists)) {
    actions.push({
      title: "클라우드 동기화 재연결",
      description: "OneDrive · Google Drive · Dropbox에 다시 로그인하고 동기화 폴더를 지정하세요."
    });
  }
  actions.push({
    title: "업데이트 + 보안 검사",
    description: "새로 시작한 뒤에는 Windows 업데이트와 빠른 보안 검사를 먼저 해두면 좋아요."
  });
  return actions;
}

function healthStatus(score: number, actionAt = 60, checkAt = 25): HealthPillarStatus {
  if (score >= actionAt) return "action";
  if (score >= checkAt) return "check";
  return "good";
}

function tempWasteGb(report: ScanReport): number {
  const s = report.storageWaste;
  if (!s) return 0;
  return s.userTempGb + s.localAppDataTempGb + s.windowsTempGb + (s.windowsOldExists ? s.windowsOldGb : 0);
}

function formatSmallGb(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}GB`;
}

function buildHealthPillars(report: ScanReport, scores: {
  diskFree: number;
  memoryPressure: number;
  eventLog: number;
  windowsUpdate: number;
  defender: number;
  storageWaste: number;
}): HealthPillar[] {
  const cleanupGb = tempWasteGb(report);
  const startupCount = report.startupPrograms?.count ?? 0;
  const cleanupScore = Math.max(scores.storageWaste, startupCount > 18 ? 75 : startupCount > 10 ? 45 : 0);
  const securityScore = Math.max(scores.defender, scores.windowsUpdate);
  const performanceScore = Math.max(scores.diskFree, scores.memoryPressure, scores.eventLog, startupCount > 18 ? 70 : 0);
  const backupFolders = report.userFolders.filter((f) => f.exists);
  const hasSensitiveBackupHints = report.npkiCandidates.some((n) => n.exists) || report.wifiProfiles.length > 0;
  const hasCloud = report.cloudSync.some((c) => c.exists);

  return [
    {
      id: "cleanup",
      title: "깔끔 정리",
      status: healthStatus(cleanupScore, 60, 25),
      summary:
        cleanupScore >= 60
          ? `지워도 되는지 확인할 후보가 있어요. 대략 ${formatSmallGb(cleanupGb)} 정도부터 살펴보면 좋아요.`
          : cleanupScore >= 25
            ? "가벼운 정리만 해도 체감이 좋아질 수 있어요."
            : "지금은 크게 지울 만한 찌꺼기가 많아 보이지 않아요.",
      detail:
        "자동 삭제는 하지 않아요. 임시 파일, 이전 Windows 파일, 시작 앱처럼 비교적 안전한 후보를 먼저 보여주고 Ryan이 직접 고르게 하는 방식이 좋아요.",
      actions: [
        {
          title: "저장 공간 정리 열기",
          description: "Windows가 분류한 임시 파일을 확인해요.",
          command: "start ms-settings:storagesense"
        },
        {
          title: "앱 삭제 화면 열기",
          description: "오래 안 쓰는 앱을 Ryan이 직접 보고 지울 수 있어요.",
          command: "start ms-settings:appsfeatures"
        }
      ]
    },
    {
      id: "security",
      title: "보안 점검",
      status: healthStatus(securityScore, 60, 30),
      summary:
        securityScore >= 60
          ? "Windows 보안 상태를 먼저 확인하는 게 좋아요."
          : securityScore >= 30
            ? "업데이트나 보안 검사 날짜를 한 번 확인해보면 좋아요."
            : "Windows 보안 상태는 크게 신경 쓰이는 부분이 적어요.",
      detail:
        "포맷버디가 백신처럼 직접 치료하지는 않아요. 대신 Windows 기본 보안 기능이 켜져 있는지 보고, 검사 화면을 바로 열어드리는 역할을 해요.",
      actions: [
        {
          title: "Windows 보안 열기",
          description: "빠른 검사나 보호 상태를 확인해요.",
          command: "start windowsdefender:"
        },
        {
          title: "Windows 업데이트 확인",
          description: "보안 업데이트가 밀렸는지 확인해요.",
          command: "start ms-settings:windowsupdate"
        }
      ]
    },
    {
      id: "performance",
      title: "속도 점검",
      status: healthStatus(performanceScore, 70, 30),
      summary:
        performanceScore >= 70
          ? "느려지는 원인이 몇 가지 겹쳐 보여요."
          : performanceScore >= 30
            ? "시작 앱이나 저장 공간을 정리하면 더 가벼워질 수 있어요."
            : "속도 쪽은 지금 큰 문제 신호가 적어요.",
      detail:
        "여유 공간, 메모리, 시작 앱, 최근 Windows 오류를 함께 봐요. 하나만 보고 포맷을 권하지 않기 위해 나눠서 확인합니다.",
      actions: [
        {
          title: "시작 앱 확인",
          description: "부팅할 때 같이 켜지는 앱을 줄여요.",
          command: "taskmgr /0 /startup"
        }
      ]
    },
    {
      id: "backup",
      title: "백업 준비",
      status: hasSensitiveBackupHints || backupFolders.length > 0 ? "check" : "good",
      summary:
        backupFolders.length > 0
          ? `${backupFolders.length}개 사용자 폴더를 포맷 전에 챙기면 좋아요.`
          : "지금 리포트에서는 크게 챙길 폴더 신호가 적어요.",
      detail:
        hasCloud
          ? "클라우드 폴더가 있어도 동기화가 끝났는지 확인해야 해요. 공동인증서와 Wi-Fi 정보는 따로 챙기는 쪽이 안전합니다."
          : "바탕화면, 문서, 다운로드처럼 자주 쓰는 폴더와 공동인증서, Wi-Fi 정보를 먼저 확인하는 흐름이 안전합니다.",
      actions: []
    }
  ];
}

export function generateRecommendation(report: ScanReport): Recommendation {
  const reasons: ReasonItem[] = [];

  const dHealth = diskHealthScore(report);
  const dFree = diskFreeScore(report);
  const mem = memoryPressureScore(report);
  const ev = eventLogScore(report);
  const wu = windowsUpdateScore(report);
  const da = driverAgeScore(report);
  const def = defenderScore(report);
  const sw = storageWasteScore(report);

  pushReason(
    reasons,
    "disk-health",
    "디스크 상태",
    dHealth,
    WEIGHTS.diskHealth,
    "저장장치가 스스로 보내는 상태 신호에 경고가 있어요.",
    "디스크는 파일을 담는 부품이에요. 여기서 경고가 나오면 정리보다 백업이 먼저예요.",
    "중요한 파일부터 다른 곳에 복사한 뒤, 디스크 상태를 다시 확인해주세요."
  );
  pushReason(reasons, "disk-free", "저장 공간", dFree, WEIGHTS.diskFree,
    "C 드라이브 여유 공간이 부족해요. Windows가 숨 쉴 공간이 줄면 전체가 느려질 수 있어요.",
    "Windows는 업데이트와 임시 작업을 하려고 빈 공간을 계속 써요.",
    "큰 파일과 임시 파일부터 확인해주세요.");
  pushReason(reasons, "memory-pressure", "메모리 여유", mem, WEIGHTS.memoryPressure,
    "한 번에 켜진 작업이 많아서 PC가 버거워할 수 있어요.",
    "메모리는 책상 넓이와 비슷해요. 부족하면 Windows가 저장장치를 대신 써서 느려집니다.",
    "무거운 앱을 줄이거나 시작 앱을 정리해보세요.");
  pushReason(reasons, "event-log", "최근 오류", ev, WEIGHTS.eventLog,
    "최근 며칠 사이 Windows 오류 기록이 쌓였어요.",
    "오류 기록은 PC가 넘어졌던 흔적이에요. 같은 흔적이 반복되면 원인을 따로 봐야 해요.",
    "업데이트와 기본 파일 확인을 먼저 해보세요.");
  pushReason(reasons, "windows-update", "Windows 업데이트", wu, WEIGHTS.windowsUpdate,
    "Windows 업데이트가 오래 밀려 있어요. 보안과 안정성에 영향을 줄 수 있어요.",
    "업데이트는 Windows가 고치는 약속된 수리 목록이에요.",
    "Windows Update 화면을 열어 밀린 업데이트부터 받아주세요.");
  pushReason(reasons, "driver-age", "장치 연결 파일", da, WEIGHTS.driverAge,
    "장치가 Windows와 대화할 때 쓰는 파일이 오래된 편이에요.",
    "드라이버는 프린터, 그래픽, 무선랜 같은 장치를 움직이는 설명서예요.",
    "제조사 업데이트나 Windows Update의 선택 업데이트를 확인해보세요.");
  pushReason(reasons, "defender", "백신 상태", def, WEIGHTS.defender,
    "Windows 기본 보안 기능이 꺼져 있거나 오래 업데이트되지 않았어요.",
    "포맷버디가 바이러스를 직접 잡지는 않아요. Windows 보안이 잘 켜져 있는지 확인합니다.",
    "Windows 보안을 열고 빠른 검사를 한 번 실행해주세요.");
  pushReason(reasons, "storage-waste", "정리할 파일", sw, WEIGHTS.storageWaste,
    "오래된 임시 파일이나 이전 Windows 파일이 쌓여 있어요.",
    "이런 파일은 보통 앱이 잠깐 쓰고 남긴 파일이에요. 바로 포맷하기 전에 먼저 정리해볼 수 있어요.",
    "저장 공간 정리 화면에서 지울 항목을 직접 고르세요.");

  reasons.sort((a, b) => b.weightedScore - a.weightedScore);

  const totalWeighted =
    dHealth * WEIGHTS.diskHealth +
    dFree * WEIGHTS.diskFree +
    mem * WEIGHTS.memoryPressure +
    ev * WEIGHTS.eventLog +
    wu * WEIGHTS.windowsUpdate +
    da * WEIGHTS.driverAge +
    def * WEIGHTS.defender +
    sw * WEIGHTS.storageWaste;

  const formatScore = Math.round(clamp01to100(totalWeighted));
  const severity = applyDiskHealthOverride(getSeverity(formatScore), dHealth);
  const headline = getHeadline(severity, formatScore);
  const summary = getSummary(severity, reasons);

  return {
    formatScore,
    severity,
    headline,
    summary,
    tryFirst: buildTryFirst(report, reasons),
    formatReasons: reasons,
    afterFormat: buildAfterFormat(report),
    healthPillars: buildHealthPillars(report, {
      diskFree: dFree,
      memoryPressure: mem,
      eventLog: ev,
      windowsUpdate: wu,
      defender: def,
      storageWaste: sw
    }),
    buddyChecklist: buildBuddyChecklist(report)
  };
}

export const __testing = {
  diskHealthScore,
  diskFreeScore,
  memoryPressureScore,
  eventLogScore,
  windowsUpdateScore,
  driverAgeScore,
  defenderScore,
  storageWasteScore,
  getSeverity,
  applyDiskHealthOverride,
  WEIGHTS
};
