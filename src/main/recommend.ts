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
  Recommendation,
  ReasonItem,
  ScanReport,
  FormatSeverity
} from "@shared/types";
import { copy } from "@shared/copy";

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
  description: string
) {
  if (rawScore <= 0) return;
  // v0.4.1: floor is now based on raw score (must be ≥30/100) so low-weight
  // signals (Defender = 5%) still surface when they go bad — previously the
  // absolute `weighted < 5` floor silently dropped every Defender problem.
  if (rawScore < 30) return;
  const weighted = rawScore * weight;
  reasons.push({ signal, label, weightedScore: Math.round(weighted * 10) / 10, description });
}

function buildTryFirst(report: ScanReport, reasons: ReasonItem[]): ActionItem[] {
  const actions: ActionItem[] = [];
  const signals = new Set(reasons.map((r) => r.signal));

  actions.push({
    title: "Windows 디스크 정리",
    description: "임시 파일, 휴지통, 캐시를 한 번에 비워요. 시스템 파일까지 함께.",
    command: "cleanmgr /sageset:1"
  });
  actions.push({
    title: "시스템 파일 검사",
    description: "Windows 핵심 파일이 손상됐는지 확인하고 자동 복구해요.",
    command: "sfc /scannow"
  });
  actions.push({
    title: "Windows 이미지 복구",
    description: "복구 대상 시스템 이미지를 Microsoft 서버에서 받아 채워줘요.",
    command: "DISM /Online /Cleanup-Image /RestoreHealth"
  });

  if (signals.has("windows-update")) {
    actions.push({
      title: "Windows Update 실행",
      description: "보안 패치가 한참 밀려 있어요. 업데이트만 받아도 많이 가벼워질 수 있어요.",
      command: "start ms-settings:windowsupdate"
    });
  }
  if (signals.has("disk-free")) {
    actions.push({
      title: "Storage Sense 켜기 + 큰 파일 정리",
      description: "Downloads / Documents의 큰 파일부터 점검하면 여유 공간이 빨리 늘어요.",
      command: "start ms-settings:storagesense"
    });
  }
  if (signals.has("startup-bloat") || (report.startupPrograms && report.startupPrograms.count > 12)) {
    actions.push({
      title: "시작 프로그램 정리",
      description: "PC를 켤 때 자동으로 뜨는 앱이 많아요. 필요 없는 것은 작업 관리자에서 꺼주세요.",
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
      title: "Windows Defender 보호 켜기",
      description: "실시간 보호가 꺼져 있거나 시그니처가 오래됐어요. 보안 설정에서 한 번 확인해 주세요.",
      command: "start windowsdefender:"
    });
  }

  return actions;
}

function buildAfterFormat(report: ScanReport): ActionItem[] {
  const actions: ActionItem[] = [];

  if (report.winget?.available) {
    actions.push({
      title: "winget으로 앱 일괄 재설치",
      description: "포맷 전 저장한 winget JSON으로 한 줄에 다시 깔 수 있어요.",
      command: "winget import -i <winget-export.json>"
    });
  }
  actions.push({
    title: "백업 manifest 검증",
    description: "포맷 전 만든 manifest의 SHA-256과 복원된 파일을 비교해 빠진 게 없는지 확인하세요."
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
    title: "Windows Update + Defender 첫 스캔",
    description: "새 시스템에서 가장 먼저 보안 업데이트와 풀 스캔을 한 번 돌려두세요."
  });
  return actions;
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

  pushReason(reasons, "disk-health", "디스크 건강", dHealth, WEIGHTS.diskHealth,
    "디스크 자체가 보고하는 상태(S.M.A.R.T.)에 경고가 있어요. 하드웨어 문제일 수 있으니 데이터 백업이 가장 시급해요.");
  pushReason(reasons, "disk-free", "저장 공간", dFree, WEIGHTS.diskFree,
    "C 드라이브 여유 공간이 많이 부족해요. Windows 자체가 느려지는 가장 흔한 원인이에요.");
  pushReason(reasons, "memory-pressure", "메모리 압박", mem, WEIGHTS.memoryPressure,
    "메모리가 빠듯해서 디스크 페이지파일을 자주 쓰고 있어요. 평소 작업이 느릴 수 있어요.");
  pushReason(reasons, "event-log", "시스템 이벤트", ev, WEIGHTS.eventLog,
    "최근 7일간 시스템 critical/error 이벤트가 누적되어 있어요. 일관된 문제일 가능성.");
  pushReason(reasons, "windows-update", "Windows 업데이트", wu, WEIGHTS.windowsUpdate,
    "보안 패치가 오래 밀려 있어요. 업데이트만 받아도 안정성과 보안이 크게 좋아져요.");
  pushReason(reasons, "driver-age", "드라이버 나이", da, WEIGHTS.driverAge,
    "2년 이상 된 드라이버 비율이 높아요. 일부는 호환성 문제의 원인이 될 수 있어요.");
  pushReason(reasons, "defender", "백신 상태", def, WEIGHTS.defender,
    "Windows Defender 보호가 꺼져 있거나 시그니처가 오래됐어요.");
  pushReason(reasons, "storage-waste", "잔여 시스템 찌꺼기", sw, WEIGHTS.storageWaste,
    "windows.old 같은 큰 시스템 잔여물 또는 임시 파일이 누적되어 있어요. 청소로 회복 가능.");

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
    afterFormat: buildAfterFormat(report)
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
