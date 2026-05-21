import { useCallback, useEffect, useState } from "react";
import { Button, ArrowRight } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { applyThemeMode } from "../theme";
import { restoreBinExpiryInsight } from "@shared/cleanup-result";
import { copy } from "@shared/copy";
import {
  buildSecurityCareSummary,
  type SecurityCareLevel,
  type SecurityCareSummary
} from "@shared/security-care";
import type {
  AuditEntry,
  AuditSnapshot,
  CleanupHistorySnapshot,
  CleanupLogEntry,
  CleanupTrashSnapshot,
  DefenderLiveStatus,
  MonitorPreferences,
  RegistryBackupSnapshot,
  ScheduledTaskBackupSnapshot,
  StatusMonitorSnapshot,
  StartupAutoDisabledSnapshot,
  ThemeMode
} from "@shared/types";

interface HomeProps {
  onStartScan: () => void;
  onOpenWebReport?: () => void;
  isMacPreview?: boolean;
  monitor?: StatusMonitorSnapshot;
  onOpenPermissions?: () => void;
  onOpenAuditLog?: () => void;
  onOpenTrashRestore?: () => void;
  onOpenStartupAuto?: () => void;
  onOpenCleanup?: () => void;
  onOpenAppManager?: () => void;
  onOpenSecurity?: () => void;
}

const FORMAT_CHECK_ITEMS = [
  { label: "공동인증서", detail: "NPKI 위치 확인" },
  { label: "카카오톡", detail: "백업 필요 여부" },
  { label: "개인 폴더", detail: "바탕화면·문서·다운로드" },
  { label: "브라우저", detail: "즐겨찾기와 프로필" },
  { label: "Wi-Fi", detail: "다시 연결할 네트워크" },
  { label: "드라이버", detail: "프린터·그래픽·오디오" },
  { label: "앱 목록", detail: "다시 깔 프로그램" }
] as const;

const FORMAT_FLOW = [
  {
    step: "01",
    title: "버디가 먼저 찾아요",
    body: "앱이 확인할 수 있는 위치는 자동으로 살펴보고, 민감한 비밀번호는 보지 않아요."
  },
  {
    step: "02",
    title: "직접 볼 것만 남겨요",
    body: "카톡 백업, 인증서, 개인 폴더처럼 사람이 확인해야 하는 항목은 따로 표시해요."
  },
  {
    step: "03",
    title: "4,900원 리포트로 저장",
    body: "포맷 전 체크 결과와 포맷 후 다시 챙길 순서를 한 장으로 정리해요."
  }
] as const;

function MonitorPrefsCard() {
  const [prefs, setPrefs] = useState<MonitorPreferences | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.fb?.getMonitorPrefs) {
      setPrefsMessage("알림 설정을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
      return;
    }
    void window.fb
      .getMonitorPrefs()
      .then((next) => {
        setPrefs(next);
        setPrefsMessage(null);
        applyThemeMode(next.themeMode);
      })
      .catch(() => {
        setPrefs(null);
        setPrefsMessage("알림 설정을 불러오지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
      });
  }, []);

  const update = useCallback(async (patch: Parameters<NonNullable<typeof window.fb.updateMonitorPrefs>>[0]) => {
    if (!window.fb?.updateMonitorPrefs) {
      setPrefsMessage("알림 설정 저장을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
      return;
    }
    setBusy(true);
    try {
      const next = await window.fb.updateMonitorPrefs(patch);
      setPrefs(next);
      setPrefsMessage(null);
      applyThemeMode(next.themeMode);
    } catch {
      setPrefsMessage("알림 설정 저장을 마치지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!prefs && !prefsMessage) return null;

  return (
    <section
      className="fb-home-monitor"
      style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}
    >
      <div>
        <h2 className="fb-h2">버디 자동 알림 설정</h2>
        <small style={{ opacity: 0.7 }}>
          기본은 모두 꺼짐이에요. 켜야만 트레이/알림이 동작해요.
        </small>
      </div>
      {prefsMessage && <p style={{ fontSize: 13, margin: 0 }}>{prefsMessage}</p>}
      {prefs && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.trayEnabled}
              disabled={busy}
              onChange={(e) => void update({ trayEnabled: e.target.checked })}
            />
            <span>시스템 트레이 아이콘 표시 (포맷 전 체크 시작 / 종료 메뉴)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.launchAtLoginEnabled}
              disabled={busy}
              onChange={(e) => void update({ launchAtLoginEnabled: e.target.checked })}
            />
            <span>PC 켤 때 포맷버디도 조용히 켜기 (트레이도 같이 켜져요)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.reminderEnabled}
              disabled={busy}
              onChange={(e) => void update({ reminderEnabled: e.target.checked })}
            />
            <span>주기 알림 (마지막 점검 후 며칠이 지나면 알려줘요)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span>알림 주기:</span>
            <input
              type="number"
              min={1}
              max={90}
              value={prefs.reminderDays}
              disabled={busy || !prefs.reminderEnabled}
              onChange={(e) =>
                void update({ reminderDays: Math.max(1, Math.min(90, Number(e.target.value) || 14)) })
              }
              style={{ width: 70, padding: "4px 6px" }}
            />
            <span>일</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.autoScanEnabled}
              disabled={busy}
              onChange={(e) => void update({ autoScanEnabled: e.target.checked })}
            />
            <span>정기 자동 점검 예약 (Windows가 주기에 맞춰 포맷버디를 열고 점검을 시작해요)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span>점검 주기:</span>
            <input
              type="number"
              min={1}
              max={90}
              value={prefs.autoScanDays}
              disabled={busy || !prefs.autoScanEnabled}
              onChange={(e) =>
                void update({ autoScanDays: Math.max(1, Math.min(90, Number(e.target.value) || 30)) })
              }
              style={{ width: 70, padding: "4px 6px" }}
            />
            <span>일</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.restorePointEnabled}
              disabled={busy}
              onChange={(e) => void update({ restorePointEnabled: e.target.checked })}
            />
            <span>정리·앱 제거 전에 시스템 복원 지점 자동 생성 (권장 ON)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span>업데이트 채널:</span>
            <select
              value={prefs.updateChannel}
              disabled={busy}
              onChange={(e) =>
                void update({ updateChannel: e.target.value === "beta" ? "beta" : "stable" })
              }
              style={{ padding: "4px 6px" }}
            >
              <option value="stable">안정 (stable) — 검증된 업데이트만</option>
              <option value="beta">베타 (beta) — 새 기능 먼저 받기</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={prefs.telemetryOptIn}
              disabled={busy}
              onChange={(e) => void update({ telemetryOptIn: e.target.checked })}
            />
            <span>
              향후 익명 사용 통계 허용 (기본 꺼짐 — 아직 전송 기능은 없어요)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span>화면 모드:</span>
            <select
              value={prefs.themeMode}
              disabled={busy}
              onChange={(e) => void update({ themeMode: e.target.value as ThemeMode })}
              style={{ padding: "4px 6px" }}
            >
              <option value="system">PC 설정 따라가기</option>
              <option value="light">밝게 보기</option>
              <option value="dark">어둡게 보기</option>
            </select>
          </label>
        </>
      )}
      <small style={{ opacity: 0.6 }}>
        정기 자동 점검은 실시간 감시가 아니에요. 켜면 Windows가 정해진 날에 포맷버디를 열고,
        평소와 같은 로컬 점검을 시작해요. 30일 복구함 정리는 앱이 켜져 있을 때 함께 챙겨져요.
        베타 채널은 가끔 불안정할 수 있고, 화면 모드는 이 PC에만 저장돼요.
      </small>
    </section>
  );
}

function MonitorCard({ monitor }: { monitor?: StatusMonitorSnapshot }) {
  if (!monitor?.lastScanAt) {
    return (
      <section className="fb-home-monitor">
        <div>
          <h2 className="fb-h2">{copy.monitorTitle}</h2>
          <small style={{ opacity: 0.7 }}>{copy.monitorSubtitle}</small>
          <p>{copy.monitorNoScan}</p>
        </div>
        <span>대기 중</span>
      </section>
    );
  }

  return (
    <section className="fb-home-monitor">
      <div>
        <h2 className="fb-h2">{copy.monitorTitle}</h2>
        <small style={{ opacity: 0.7 }}>{copy.monitorSubtitle}</small>
        <p>{monitor.message}</p>
      </div>
      <div className="fb-home-monitor-stats">
        <span>마지막 점검 {monitor.staleDays ?? 0}일 전</span>
        <span>점수 {monitor.lastScore}점</span>
        <span>{monitor.cleanupLabel}</span>
      </div>
    </section>
  );
}

type HomeRestoreBinItem = { expiresAt: string };

interface HomeRestoreBinState {
  loading: boolean;
  message: string;
  detail: string;
  count: number;
  partial: boolean;
  latestCleanup?: CleanupLogEntry;
  historyMessage?: string;
  latestAutoEmpty?: AuditEntry;
  auditMessage?: string;
}

function settledValue<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === "fulfilled" ? result.value : undefined;
}

function restoreItemsFromSnapshots({
  fileSnapshot,
  registrySnapshot,
  startupSnapshot,
  scheduledTaskSnapshot
}: {
  fileSnapshot?: CleanupTrashSnapshot;
  registrySnapshot?: RegistryBackupSnapshot;
  startupSnapshot?: StartupAutoDisabledSnapshot;
  scheduledTaskSnapshot?: ScheduledTaskBackupSnapshot;
}): HomeRestoreBinItem[] {
  return [
    ...(fileSnapshot?.entries ?? []),
    ...(registrySnapshot?.entries ?? []),
    ...(startupSnapshot?.entries ?? []),
    ...(scheduledTaskSnapshot?.entries ?? [])
  ];
}

function formatHomeBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) {
    return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function homeCleanupDateLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "최근 정리";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function homeLatestCleanupSummary(entry: CleanupLogEntry): string {
  const parts: string[] = [];
  if (entry.totalFreedBytes > 0) {
    parts.push(`확보한 공간 ${formatHomeBytes(entry.totalFreedBytes)}`);
  }
  if (entry.removedCount > 0) {
    parts.push(`복구함에 둔 항목 ${entry.removedCount}개`);
  }
  if (entry.notSelectedCount > 0) {
    parts.push(`남겨둔 후보 ${entry.notSelectedCount}개`);
  }
  if (entry.skippedCount > 0) {
    parts.push(`건드리지 않은 항목 ${entry.skippedCount}개`);
  }
  return parts.length > 0 ? parts.join(" · ") : "처리한 항목은 없어요.";
}

function latestRestoreBinAutoEmpty(entries: AuditEntry[]): AuditEntry | undefined {
  return entries.find(
    (entry) => entry.category === "cleanup" && entry.action.includes("expired-purge")
  );
}

function HomeRestoreBinCard({
  onOpenTrashRestore,
  onOpenAuditLog
}: {
  onOpenTrashRestore?: () => void;
  onOpenAuditLog?: () => void;
}) {
  const [state, setState] = useState<HomeRestoreBinState>({
    loading: true,
    message: "복구함 상태를 확인하는 중이에요.",
    detail: "정리한 항목이 있으면 30일 보관 기간도 같이 살펴볼게요.",
    count: 0,
    partial: false,
    historyMessage: "최근 정리 기록도 같이 확인하는 중이에요.",
    auditMessage: "자동 비움 기록도 같이 확인하는 중이에요."
  });

  useEffect(() => {
    if (
      !window.fb?.getCleanupTrash ||
      !window.fb.getRegistryBackups ||
      !window.fb.listDisabledStartupAuto ||
      !window.fb.getScheduledTaskBackups
    ) {
      setState({
        loading: false,
        message: "복구함 상태를 연결하지 못했어요.",
        detail: "포맷버디를 다시 열고 한 번 더 확인해주세요.",
        count: 0,
        partial: true
      });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true }));
    const historyTask = window.fb.getCleanupHistory
      ? window.fb.getCleanupHistory()
      : Promise.resolve<CleanupHistorySnapshot | undefined>(undefined);
    const auditTask = window.fb.getAuditSnapshot
      ? window.fb.getAuditSnapshot()
      : Promise.resolve<AuditSnapshot | undefined>(undefined);

    void Promise.allSettled([
      window.fb.getCleanupTrash(),
      window.fb.getRegistryBackups(),
      window.fb.listDisabledStartupAuto(),
      window.fb.getScheduledTaskBackups(),
      historyTask,
      auditTask
    ]).then(([
      fileResult,
      registryResult,
      startupResult,
      scheduledTaskResult,
      historyResult,
      auditResult
    ]) => {
      if (!active) return;

      const partial = [fileResult, registryResult, startupResult, scheduledTaskResult].some(
        (result) => result.status === "rejected"
      );
      const history = settledValue(historyResult);
      const latestCleanup = history?.entries[0];
      const audit = settledValue(auditResult);
      const latestAutoEmpty = latestRestoreBinAutoEmpty(audit?.entries ?? []);
      const historyMessage =
        historyResult.status === "rejected"
          ? "최근 정리 기록은 지금 불러오지 못했어요."
          : latestCleanup
            ? undefined
            : "아직 정리 기록은 없어요. 정리한 뒤에는 여기에서 바로 확인할게요.";
      const auditMessage =
        auditResult.status === "rejected"
          ? "자동 비움 기록은 지금 불러오지 못했어요."
          : latestAutoEmpty
            ? undefined
            : "아직 자동 비움 기록은 없어요.";
      const restoreItems = restoreItemsFromSnapshots({
        fileSnapshot: settledValue(fileResult),
        registrySnapshot: settledValue(registryResult),
        startupSnapshot: settledValue(startupResult),
        scheduledTaskSnapshot: settledValue(scheduledTaskResult)
      });
      const insight = restoreBinExpiryInsight(restoreItems);

      if (restoreItems.length === 0) {
        setState({
          loading: false,
          message: partial ? "보이는 항목만 먼저 확인했어요." : "복구함이 비어 있어요.",
          detail: partial
            ? "일부 복구 목록은 지금 불러오지 못했어요. 포맷버디를 다시 열면 다시 살펴볼게요."
            : "정리한 항목이 생기면 30일 동안 챙겨둘게요.",
          count: 0,
          partial,
          latestCleanup,
          historyMessage,
          latestAutoEmpty,
          auditMessage
        });
        return;
      }

      setState({
        loading: false,
        message:
          partial
            ? "보이는 항목만 먼저 확인했어요."
            : insight?.message ?? "복구함에 보관 중인 항목이 있어요.",
        detail:
          partial
            ? insight?.message ?? "복구함에서 남은 항목을 확인해 주세요."
            : insight?.detail ?? "필요한 항목은 복구함에서 다시 원래 자리로 되돌릴 수 있어요.",
        count: restoreItems.length,
        partial,
        latestCleanup,
        historyMessage,
        latestAutoEmpty,
        auditMessage
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="fb-home-restore" aria-label="복구함 상태">
      <div className="fb-home-security-main">
        <span className="fb-home-security-kicker">
          <span className="fb-home-security-dot" aria-hidden="true" />
          복구함 상태
        </span>
        <h2 className="fb-h2">{state.message}</h2>
        <p>{state.detail}</p>
        {state.count > 0 && !state.loading && (
          <p className="fb-home-security-next">
            <strong>{state.count}개 보관 중</strong>
            <span>{state.partial ? "전체 목록은 복구함에서 다시 확인해 주세요." : "보관 기간 안에는 되돌릴 수 있어요."}</span>
          </p>
        )}
        {!state.loading && (
          <p className="fb-home-restore-latest">
            <strong>최근 정리 결과</strong>
            <span>
              {state.latestCleanup
                ? `${homeCleanupDateLabel(state.latestCleanup.executedAt)} · ${homeLatestCleanupSummary(state.latestCleanup)}`
                : state.historyMessage}
            </span>
          </p>
        )}
        {!state.loading && (
          <p className="fb-home-restore-latest">
            <strong>최근 자동 비움</strong>
            <span>
              {state.latestAutoEmpty
                ? `${homeCleanupDateLabel(state.latestAutoEmpty.at)} · ${state.latestAutoEmpty.summary}`
                : state.auditMessage}
            </span>
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="fb-home-security-action"
          onClick={onOpenTrashRestore}
          disabled={!onOpenTrashRestore}
        >
          복구함 열기
        </button>
        {onOpenAuditLog && (
          <button
            type="button"
            className="fb-home-security-action"
            onClick={onOpenAuditLog}
          >
            자동 비움 기록 보기
          </button>
        )}
      </div>
    </section>
  );
}

interface HomeSecurityState {
  loading: boolean;
  data?: DefenderLiveStatus;
  error?: string;
}

function homeSecurityLevelLabel(level: SecurityCareLevel): string {
  switch (level) {
    case "attention":
      return "먼저 확인";
    case "check":
      return "확인해봐요";
    case "ok":
      return "괜찮아요";
  }
}

function HomeSecuritySummaryCard({
  isMacPreview,
  onOpenSecurity
}: {
  isMacPreview: boolean;
  onOpenSecurity?: () => void;
}) {
  const [state, setState] = useState<HomeSecurityState>({ loading: false });

  useEffect(() => {
    if (isMacPreview) {
      setState({
        loading: false,
        error: "Mac 미리보기에서는 Windows 보안 상태를 읽지 않아요. Windows PC에서 같이 확인할게요."
      });
      return;
    }
    if (!window.fb?.getDefenderStatus) {
      setState({
        loading: false,
        error: "보안 점검을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      });
      return;
    }

    let active = true;
    setState({ loading: true });
    void window.fb
      .getDefenderStatus()
      .then((data) => {
        if (active) setState({ loading: false, data });
      })
      .catch(() => {
        if (active) {
          setState({
            loading: false,
            error: "보안 상태를 불러오지 못했어요. Windows 보안 화면에서 직접 확인해도 괜찮아요."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [isMacPreview]);

  const summary: SecurityCareSummary = state.error
    ? {
        level: "check",
        title: "Windows 보안은 직접 확인해주세요",
        detail: state.error,
        items: []
      }
    : buildSecurityCareSummary(state.data);

  const topItem = summary.items[0];

  return (
    <section
      className={`fb-home-security fb-home-security-${summary.level}`}
      aria-label="Windows 보안 점검 요약"
    >
      <div className="fb-home-security-main">
        <span className="fb-home-security-kicker">
          <span className="fb-home-security-dot" aria-hidden="true" />
          Windows 보안 점검 요약
        </span>
        <h2 className="fb-h2">{state.loading ? "보안 상태를 살펴보는 중이에요" : summary.title}</h2>
        <p>{state.loading ? "앱을 켤 때 한 번만 가볍게 확인하고 있어요." : summary.detail}</p>
        {topItem && !state.loading && (
          <p className="fb-home-security-next">
            <strong>{homeSecurityLevelLabel(topItem.level)}</strong>
            <span>{topItem.title}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        className="fb-home-security-action"
        onClick={onOpenSecurity}
        disabled={!onOpenSecurity || isMacPreview}
      >
        보안 점검 열기
      </button>
    </section>
  );
}

export function Home({
  onStartScan,
  onOpenWebReport,
  isMacPreview = false,
  monitor,
  onOpenPermissions,
  onOpenAuditLog,
  onOpenTrashRestore,
  onOpenStartupAuto,
  onOpenCleanup,
  onOpenAppManager,
  onOpenSecurity
}: HomeProps) {
  const bullets = isMacPreview ? copy.macPreviewBullets : copy.privacyBullets;

  return (
    <main className="fb-home" aria-label="포맷버디 홈">
      <header className="fb-home-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <span className="fb-home-pill">
          <span className="fb-home-pill-dot" />
          {isMacPreview ? copy.macHomeEyebrow : copy.homeEyebrow}
        </span>
      </header>

      <section className="fb-home-hero">
        <div className="fb-home-hero-copy">
          <span className="fb-home-format-price">내 PC용 체크 리포트 · 4,900원</span>
          <h1 className="fb-h1">
            {isMacPreview ? copy.macHomeTitle1 : copy.homeTitle1}
            <br />
            {isMacPreview ? copy.macHomeTitle2 : copy.homeTitle2}{" "}
            <em>{isMacPreview ? copy.macHomeTitle3 : copy.homeTitle3}</em>
          </h1>
          <p className="fb-lede">{isMacPreview ? copy.macHomeLede : copy.homeLede}</p>
          <div className="fb-home-cta">
            <Button size="lg" variant="primary" onClick={onStartScan} iconRight={<ArrowRight />}>
              {isMacPreview ? copy.macHomeStartCta : copy.homeStartCta}
            </Button>
            {isMacPreview && onOpenWebReport && (
              <Button size="lg" variant="secondary" onClick={onOpenWebReport}>
                {copy.homeOpenReportCta}
              </Button>
            )}
          </div>
          {!isMacPreview && (
            <p className="fb-home-format-note">
              지금은 포맷 전 체크에 집중해요. 정리·삭제·보안 기능은 필요할 때 아래 고급 도구에서 열 수 있어요.
            </p>
          )}
        </div>
        <div className="fb-home-hero-mark" aria-hidden="true">
          <div className="fb-buddy-stage">
            <span className="fb-buddy-orbit fb-buddy-orbit-1">인증서</span>
            <span className="fb-buddy-orbit fb-buddy-orbit-2">카톡</span>
            <span className="fb-buddy-orbit fb-buddy-orbit-3">Wi-Fi</span>
            <CloudBuddy size={220} variant="primary" expression="smile" animated />
            <span className="fb-buddy-stamp">포맷 전 체크</span>
          </div>
        </div>
      </section>

      {!isMacPreview && (
        <section className="fb-format-focus" aria-label="포맷 전 체크 항목">
          <div className="fb-format-focus-head">
            <span>버디가 챙길 것</span>
            <strong>놓치면 귀찮은 7개만 먼저</strong>
          </div>
          <div className="fb-format-item-grid">
            {FORMAT_CHECK_ITEMS.map((item, idx) => (
              <article
                key={item.label}
                className="fb-format-item fb-anim-pop"
                style={{ animationDelay: `${Math.min(idx, 6) * 45}ms` }}
              >
                <div className="fb-format-item-mark">{idx + 1}</div>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!isMacPreview && (
        <section className="fb-format-flow" aria-label="포맷 전 체크 진행 방식">
          {FORMAT_FLOW.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </section>
      )}

      <details className="fb-home-advanced">
        <summary>
          <span>고급 도구</span>
          <strong>정리·삭제·보안 기능은 필요할 때만 열어요</strong>
        </summary>
        <div className="fb-home-advanced-body">
          <MonitorCard monitor={monitor} />

          <HomeRestoreBinCard
            onOpenTrashRestore={onOpenTrashRestore}
            onOpenAuditLog={onOpenAuditLog}
          />

          <HomeSecuritySummaryCard isMacPreview={isMacPreview} onOpenSecurity={onOpenSecurity} />

          <section className="fb-home-quick" aria-labelledby="home-quick-title">
            <div className="fb-home-quick-head">
              <h2 id="home-quick-title" className="fb-h2">
                {copy.homeQuickTitle}
              </h2>
              <p>{copy.homeQuickLede}</p>
            </div>
            <div className="fb-home-quick-grid">
              {onOpenCleanup && (
                <button
                  type="button"
                  className="fb-home-quick-action"
                  onClick={onOpenCleanup}
                  disabled={isMacPreview}
                >
                  <strong>{isMacPreview ? "안전 정리 (Windows 전용)" : copy.homeQuickCleanup}</strong>
                  <span>{copy.homeQuickCleanupHint}</span>
                </button>
              )}
              {onOpenAppManager && (
                <button
                  type="button"
                  className="fb-home-quick-action"
                  onClick={onOpenAppManager}
                  disabled={isMacPreview}
                >
                  <strong>{isMacPreview ? "앱 정리 (Windows 전용)" : copy.homeQuickApps}</strong>
                  <span>{copy.homeQuickAppsHint}</span>
                </button>
              )}
              {onOpenSecurity && (
                <button
                  type="button"
                  className="fb-home-quick-action"
                  onClick={onOpenSecurity}
                  disabled={isMacPreview}
                >
                  <strong>{isMacPreview ? "보안 점검 (Windows 전용)" : copy.homeQuickSecurity}</strong>
                  <span>{copy.homeQuickSecurityHint}</span>
                </button>
              )}
              {onOpenTrashRestore && (
                <button
                  type="button"
                  className="fb-home-quick-action"
                  onClick={onOpenTrashRestore}
                >
                  <strong>{copy.homeQuickTrash}</strong>
                  <span>{copy.homeQuickTrashHint}</span>
                </button>
              )}
            </div>
          </section>

          <MonitorPrefsCard />
        </div>
      </details>

      <section className="fb-home-privacy">
        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
        <ul className="fb-home-bullets">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenPermissions && (
            <button
              type="button"
              onClick={onOpenPermissions}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              이 앱이 내 PC에서 정확히 뭘 하는지 보기 →
            </button>
          )}
          {onOpenAuditLog && (
            <button
              type="button"
              onClick={onOpenAuditLog}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              지금까지 한 일 보기 (활동 기록) →
            </button>
          )}
          {onOpenTrashRestore && (
            <button
              type="button"
              onClick={onOpenTrashRestore}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              복구함 열기 (30일 보관) →
            </button>
          )}
          {onOpenStartupAuto && (
            <button
              type="button"
              onClick={onOpenStartupAuto}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              PC 켤 때 같이 뜨는 것 보기 →
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
