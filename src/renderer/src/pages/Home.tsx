import { useCallback, useEffect, useState } from "react";
import { Button, ArrowRight } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { applyThemeMode } from "../theme";
import { copy } from "@shared/copy";
import type { MonitorPreferences, StatusMonitorSnapshot, ThemeMode } from "@shared/types";

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
            <span>시스템 트레이 아이콘 표시 (PC 점검 시작 / 종료 메뉴)</span>
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
        포맷버디는 자동 점검을 하지 않아요. 알림이 오면 직접 점검을 시작할지 결정해주세요.
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
        </div>
        <div className="fb-home-hero-mark">
          <CloudBuddy size={220} variant="primary" expression="smile" animated />
        </div>
      </section>

      <MonitorCard monitor={monitor} />

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
