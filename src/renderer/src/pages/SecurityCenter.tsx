import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import type {
  DefenderLiveStatus,
  DefenderQuickScanResult,
  DefenderThreatRecord,
  DefenderThreatSnapshot
} from "@shared/types";

interface SecurityCenterProps {
  isWindows: boolean;
  onBack: () => void;
}

interface StatusState {
  loading: boolean;
  data?: DefenderLiveStatus;
  error?: string;
}

interface ThreatState {
  loading: boolean;
  data?: DefenderThreatSnapshot;
  error?: string;
}

function dayLabel(days?: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "오늘";
  return `${days}일 전`;
}

function severityLabel(severity: DefenderThreatRecord["severity"]): string {
  switch (severity) {
    case "severe":
      return "심각도 표시: 매우 높음 (Windows 기준)";
    case "high":
      return "심각도 표시: 높음 (Windows 기준)";
    case "moderate":
      return "심각도 표시: 보통 (Windows 기준)";
    case "low":
      return "심각도 표시: 낮음 (Windows 기준)";
    default:
      return "심각도 표시 없음";
  }
}

function actionLabel(record: DefenderThreatRecord): string {
  // Pure read-out. We never claim FormatBuddy did anything to the threat.
  switch (record.actionStatus) {
    case "cleaned":
      return "Windows 처리: 정리됨";
    case "quarantined":
      return "Windows 처리: 격리됨";
    case "removed":
      return "Windows 처리: 제거됨";
    case "allowed":
      return "Windows 처리: 허용됨";
    case "blocked":
      return "Windows 처리: 차단됨";
    case "no-action":
      return "Windows 처리: 동작 없음";
    case "unknown":
      return `Windows 처리: ${record.rawStatus ?? "알 수 없음"}`;
  }
}

function StatusPanel({
  state,
  onRefresh,
  busy
}: {
  state: StatusState;
  onRefresh: () => void;
  busy: boolean;
}) {
  const protectionOff =
    state.data && state.data.available && state.data.realTimeProtectionEnabled === false;
  return (
    <article className="fb-card fb-anim-slide fb-card-hover" style={{ marginBottom: 16 }}>
      <header
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Windows 보안 상태</h2>
          {state.data?.capturedAt && (
            <small>
              마지막 조회: {new Date(state.data.capturedAt).toLocaleString("ko-KR")}
            </small>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={busy}>
          {busy ? "조회 중…" : "다시 조회"}
        </Button>
      </header>

      {state.loading && <p>Windows 보안 상태를 가져오는 중이에요…</p>}

      {state.error && <p style={{ color: "#a36400" }}>{state.error}</p>}

      {state.data && !state.data.available && (
        <p style={{ color: "#a36400" }}>
          {state.data.unavailableReason ?? "Windows 보안 정보를 가져오지 못했어요."}
        </p>
      )}

      {state.data && state.data.available && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8, fontSize: 14 }}>
          <li style={{ padding: "4px 0" }}>
            <strong>실시간 보호</strong>:{" "}
            {state.data.realTimeProtectionEnabled === true
              ? "켜짐"
              : state.data.realTimeProtectionEnabled === false
                ? "꺼짐"
                : "—"}
            {protectionOff && (
              <span style={{ color: "#a36400", marginLeft: 8 }}>
                보호가 꺼져 있어요. Windows 보안 화면에서 확인해주세요.
              </span>
            )}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>실시간 보호 가능 여부</strong>:{" "}
            {state.data.antivirusEnabled === true
              ? "활성"
              : state.data.antivirusEnabled === false
                ? "비활성"
                : "—"}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>변조 방지</strong>:{" "}
            {state.data.tamperProtectionEnabled === true
              ? "켜짐"
              : state.data.tamperProtectionEnabled === false
                ? "꺼짐"
                : "—"}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>시그니처 업데이트</strong>: {dayLabel(state.data.signatureAgeDays)}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>최근 빠른 검사</strong>: {dayLabel(state.data.lastQuickScanDaysAgo)}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>최근 전체 검사</strong>: {dayLabel(state.data.lastFullScanDaysAgo)}
          </li>
        </ul>
      )}
    </article>
  );
}

function QuickScanCard({
  isWindows,
  onRunScan,
  lastResult,
  busy
}: {
  isWindows: boolean;
  onRunScan: () => void;
  lastResult?: DefenderQuickScanResult;
  busy: boolean;
}) {
  return (
    <article className="fb-card fb-anim-slide fb-card-hover" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>빠른 검사 시작</h2>
      <p style={{ fontSize: 13 }}>
        Windows 보안의 빠른 검사를 시작해요. 진행과 결과는 Windows 보안 화면에서 직접 보여드려요.
        포맷버디가 위협을 직접 치료하지 않아요.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={onRunScan} disabled={busy || !isWindows}>
          {!isWindows ? "Windows 전용" : busy ? "시작 중…" : "빠른 검사 시작"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void window.fb?.runActionCommand("start windowsdefender:")}
        >
          Windows 보안 화면 열기
        </Button>
      </div>
      {lastResult && (
        <p style={{ marginTop: 12, fontSize: 13 }}>
          {lastResult.message}
          {lastResult.detail ? ` (${lastResult.detail})` : ""}
        </p>
      )}
    </article>
  );
}

function ThreatsPanel({
  state,
  onLoad,
  busy
}: {
  state: ThreatState;
  onLoad: () => void;
  busy: boolean;
}) {
  return (
    <article className="fb-card fb-card-hover">
      <header
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Windows가 기록한 위협 내역</h2>
          <small>
            Windows 보안에 남아 있는 기록만 그대로 보여드려요. 포맷버디는 치료/제거를 하지 않아요.
          </small>
        </div>
        <Button variant="ghost" size="sm" onClick={onLoad} disabled={busy}>
          {busy ? "조회 중…" : "기록 불러오기"}
        </Button>
      </header>

      {state.loading && <p>위협 기록을 가져오는 중이에요…</p>}
      {state.error && <p style={{ color: "#a36400" }}>{state.error}</p>}

      {state.data && !state.data.available && (
        <p style={{ color: "#a36400" }}>
          {state.data.unavailableReason ?? "Windows 위협 기록을 가져오지 못했어요."}
        </p>
      )}

      {state.data && state.data.available && state.data.records.length === 0 && (
        <p>Windows 보안에 남아 있는 위협 기록이 없어요.</p>
      )}

      {state.data && state.data.records.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {state.data.records.map((record) => (
            <li
              key={record.id}
              style={{
                padding: "10px 0",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                fontSize: 13
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {record.threatName ?? "이름 없는 항목"}
              </div>
              <div style={{ opacity: 0.75 }}>
                {record.detectionTime
                  ? new Date(record.detectionTime).toLocaleString("ko-KR")
                  : "탐지 시각 정보 없음"}
              </div>
              <div style={{ opacity: 0.75 }}>{actionLabel(record)}</div>
              <div style={{ opacity: 0.6, fontSize: 12 }}>{severityLabel(record.severity)}</div>
              {record.resources && record.resources.length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary>관련 항목 {record.resources.length}개</summary>
                  <ul style={{ paddingLeft: 16 }}>
                    {record.resources.slice(0, 5).map((res) => (
                      <li key={res} style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {res}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function SecurityCenter({ isWindows, onBack }: SecurityCenterProps) {
  const [status, setStatus] = useState<StatusState>({ loading: false });
  const [threats, setThreats] = useState<ThreatState>({ loading: false });
  const [scanResult, setScanResult] = useState<DefenderQuickScanResult | undefined>();
  const [scanBusy, setScanBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!window.fb?.getDefenderStatus) {
      setStatus({ loading: false, error: "Electron 브리지를 찾지 못했어요." });
      return;
    }
    setStatus({ loading: true });
    try {
      const data = await window.fb.getDefenderStatus();
      setStatus({ loading: false, data });
    } catch (err) {
      setStatus({ loading: false, error: (err as Error).message });
    }
  }, []);

  const loadThreats = useCallback(async () => {
    if (!window.fb?.getDefenderThreats) return;
    setThreats({ loading: true });
    try {
      const data = await window.fb.getDefenderThreats();
      setThreats({ loading: false, data });
    } catch (err) {
      setThreats({ loading: false, error: (err as Error).message });
    }
  }, []);

  const runScan = useCallback(async () => {
    if (!window.fb?.runDefenderQuickScan) return;
    setScanBusy(true);
    try {
      const result = await window.fb.runDefenderQuickScan();
      setScanResult(result);
    } catch (err) {
      setScanResult({
        status: "spawn-failed",
        startedAt: new Date().toISOString(),
        message: (err as Error).message
      });
    } finally {
      setScanBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return (
    <main className="fb-report">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">보안 점검 센터</h1>
        <p className="fb-lede">
          Windows 보안의 상태와 기록을 그대로 보여드려요. 치료와 제거는 모두 Windows가 직접 결정해요.
          포맷버디는 화면을 띄워주는 역할만 합니다.
        </p>
        {!isWindows && (
          <p style={{ color: "#a36400", fontSize: 13 }}>
            Mac 미리보기에서는 보안 검사를 실행하지 않아요.
          </p>
        )}
      </section>

      <StatusPanel state={status} onRefresh={() => void refreshStatus()} busy={status.loading} />

      <QuickScanCard
        isWindows={isWindows}
        onRunScan={() => void runScan()}
        lastResult={scanResult}
        busy={scanBusy}
      />

      <ThreatsPanel state={threats} onLoad={() => void loadThreats()} busy={threats.loading} />
    </main>
  );
}
