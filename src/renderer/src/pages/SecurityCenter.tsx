import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { friendlyErrorMessage } from "@shared/error-friendly";
import {
  buildSecurityCareSummary,
  type SecurityCareLevel,
  type SecurityCareSummary
} from "@shared/security-care";
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

function cloudProtectionLabel(value: DefenderLiveStatus["cloudProtection"]): string {
  switch (value) {
    case "disabled":
      return "꺼짐";
    case "basic":
      return "기본";
    case "advanced":
      return "강화";
    default:
      return "—";
  }
}

function protectionModeLabel(
  value: DefenderLiveStatus["puaProtection"] | DefenderLiveStatus["networkProtection"]
): string {
  switch (value) {
    case "enabled":
      return "켜짐";
    case "audit":
      return "감사 모드";
    case "disabled":
      return "꺼짐";
    default:
      return "—";
  }
}

function folderProtectionLabel(value: DefenderLiveStatus["controlledFolderAccess"]): string {
  switch (value) {
    case "enabled":
      return "켜짐";
    case "audit":
      return "감사 모드";
    case "block-disk":
      return "디스크 변경 차단";
    case "audit-disk":
      return "디스크 변경 감사";
    case "disabled":
      return "꺼짐";
    default:
      return "—";
  }
}

function threatActionLabel(record: DefenderThreatRecord): string {
  // Pure read-out. We never claim FormatBuddy did anything to the threat.
  switch (record.actionStatus) {
    case "cleaned":
      return "Windows 기록: 조치됨";
    case "quarantined":
      return "Windows 기록: 격리됨";
    case "removed":
      return "Windows 기록: 조치됨";
    case "allowed":
      return "Windows 기록: 허용됨";
    case "blocked":
      return "Windows 기록: 차단됨";
    case "no-action":
      return "Windows 기록: 동작 없음";
    case "unknown":
      return "Windows 보안에서 다시 확인해주세요";
  }
}

function quickScanDetailLabel(result: DefenderQuickScanResult): string | null {
  const detail = result.detail?.toLowerCase() ?? "";

  if (
    detail.includes("permission-denied") ||
    detail.includes("access") ||
    detail.includes("denied") ||
    detail.includes("eacces") ||
    detail.includes("eperm")
  ) {
    return "권한이 부족해서 시작하지 못했어요. Windows 보안 화면에서 직접 확인해주세요.";
  }
  if (
    detail.includes("windows-security-launcher-unavailable") ||
    detail.includes("enoent") ||
    detail.includes("spawn") ||
    detail.includes("powershell")
  ) {
    return "Windows 보안 검사를 시작하지 못했어요. Windows 보안 화면에서 직접 실행해주세요.";
  }
  if (
    detail.includes("windows-policy-blocked") ||
    detail.includes("executionpolicy") ||
    detail.includes("script")
  ) {
    return "Windows 설정 때문에 실행이 막혔어요. Windows 보안 화면에서 직접 확인해주세요.";
  }
  if (detail.includes("security-scan-timeout") || detail.includes("timeout")) {
    return "응답이 늦어서 잠시 멈췄어요. Windows 보안 화면에서 이어서 확인해주세요.";
  }

  switch (result.status) {
    case "blocked":
      return "Windows 보안에서 직접 확인해주세요.";
    case "spawn-failed":
      return "Windows 보안 검사를 시작하지 못했어요. Windows 보안 화면에서 직접 실행해주세요.";
    case "unavailable":
      return "이 PC에서는 자동 확인을 지원하지 않아요. Windows 보안 화면에서 직접 확인해주세요.";
    case "launched":
      return null;
  }
}

function careLevelLabel(level: SecurityCareLevel): string {
  switch (level) {
    case "attention":
      return "먼저 확인";
    case "check":
      return "확인해봐요";
    case "ok":
      return "괜찮아요";
  }
}

function careLevelColor(level: SecurityCareLevel): { background: string; color: string; dot: string } {
  switch (level) {
    case "attention":
      return { background: "#fff4df", color: "#8a4f00", dot: "#f59e0b" };
    case "check":
      return { background: "#eef7ff", color: "#1456c0", dot: "#1d6cf2" };
    case "ok":
      return { background: "#eafbf5", color: "#0b7257", dot: "#27c49a" };
  }
}

function securityCareActionKind(item: SecurityCareSummary["items"][number]): "quick-scan" | "open-security" | "none" {
  if (item.id === "security-ok") return "none";
  if (item.id.startsWith("quick-scan")) return "quick-scan";
  return "open-security";
}

function SecurityCareSummaryPanel({
  summary,
  isWindows,
  onRunScan,
  onOpenSecurity,
  actionBusy
}: {
  summary: SecurityCareSummary;
  isWindows: boolean;
  onRunScan: () => void;
  onOpenSecurity: () => void;
  actionBusy: boolean;
}) {
  const meta = careLevelColor(summary.level);

  return (
    <section
      aria-label="Windows 보안 점검 요약"
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 14,
        background: meta.background,
        color: meta.color
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: meta.dot,
            display: "inline-block"
          }}
        />
        <strong>{careLevelLabel(summary.level)}</strong>
        <span style={{ fontWeight: 700 }}>{summary.title}</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "inherit", opacity: 0.86 }}>
        {summary.detail}
      </p>

      {summary.items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {summary.items.map((item) => {
            const itemMeta = careLevelColor(item.level);
            const actionKind = securityCareActionKind(item);
            return (
              <li
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  padding: "9px 0",
                  borderTop: "1px solid rgba(0,0,0,0.07)"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: itemMeta.dot,
                        display: "inline-block",
                        flex: "0 0 auto"
                      }}
                    />
                    <strong style={{ color: "#111827" }}>{item.title}</strong>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4b5563" }}>
                    {item.detail}
                  </p>
                </div>
                {actionKind === "none" ? (
                  <span
                    style={{
                      alignSelf: "start",
                      whiteSpace: "nowrap",
                      fontSize: 12,
                      fontWeight: 700,
                      color: itemMeta.color
                    }}
                  >
                    {item.action}
                  </span>
                ) : (
                  <Button
                    variant={actionKind === "quick-scan" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={actionKind === "quick-scan" ? onRunScan : onOpenSecurity}
                    disabled={!isWindows || actionBusy}
                  >
                    {item.action}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusPanel({
  state,
  onRefresh,
  onRunScan,
  onOpenSecurity,
  busy,
  actionBusy,
  isWindows
}: {
  state: StatusState;
  onRefresh: () => void;
  onRunScan: () => void;
  onOpenSecurity: () => void;
  busy: boolean;
  actionBusy: boolean;
  isWindows: boolean;
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

      {state.data && (
        <SecurityCareSummaryPanel
          summary={buildSecurityCareSummary(state.data)}
          isWindows={isWindows}
          onRunScan={onRunScan}
          onOpenSecurity={onOpenSecurity}
          actionBusy={actionBusy}
        />
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
            <strong>클라우드 보호</strong>: {cloudProtectionLabel(state.data.cloudProtection)}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>원치 않는 앱 차단</strong>: {protectionModeLabel(state.data.puaProtection)}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>랜섬웨어 폴더 보호</strong>: {folderProtectionLabel(state.data.controlledFolderAccess)}
          </li>
          <li style={{ padding: "4px 0" }}>
            <strong>네트워크 보호</strong>: {protectionModeLabel(state.data.networkProtection)}
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
      {state.data && state.data.available && (
        <p style={{ fontSize: 12, opacity: 0.68, marginBottom: 0 }}>
          보호 설정은 Windows가 관리해요. 포맷버디는 꺼져 보이는 항목을 알려주고, 바꾸려면 Windows 보안 화면으로 이어드려요.
        </p>
      )}
    </article>
  );
}

function QuickScanCard({
  isWindows,
  onRunScan,
  onOpenSecurity,
  lastResult,
  refreshMessage,
  busy
}: {
  isWindows: boolean;
  onRunScan: () => void;
  onOpenSecurity: () => void;
  lastResult?: DefenderQuickScanResult;
  refreshMessage?: string;
  busy: boolean;
}) {
  const quickScanDetail = lastResult ? quickScanDetailLabel(lastResult) : null;

  return (
    <article className="fb-card fb-anim-slide fb-card-hover" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>빠른 검사 시작</h2>
      <p style={{ fontSize: 13 }}>
        Windows 보안의 빠른 검사를 시작해요. 진행과 결과는 Windows 보안 화면에서 직접 보여드려요.
        시작 직후 상태와 기록을 한 번 다시 읽고, 포맷버디가 위협을 직접 처리하지는 않아요.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={onRunScan} disabled={busy || !isWindows}>
          {!isWindows ? "Windows 전용" : busy ? "시작 중…" : "빠른 검사 시작"}
        </Button>
        <Button
          variant="secondary"
          onClick={onOpenSecurity}
          disabled={!isWindows}
        >
          Windows 보안 화면 열기
        </Button>
      </div>
      {lastResult && (
        <p style={{ marginTop: 12, fontSize: 13 }}>
          {lastResult.message}
          {quickScanDetail ? ` ${quickScanDetail}` : ""}
        </p>
      )}
      {refreshMessage && (
        <p style={{ marginTop: 8, fontSize: 12, opacity: 0.72 }}>
          {refreshMessage}
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
            Windows 보안에 남아 있는 기록만 그대로 보여드려요. 포맷버디는 처리 결과를 만들지 않아요.
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
              <div style={{ opacity: 0.75 }}>{threatActionLabel(record)}</div>
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
  const [scanRefreshMessage, setScanRefreshMessage] = useState<string | undefined>();
  const [scanBusy, setScanBusy] = useState(false);

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    if (!window.fb?.getDefenderStatus) {
      setStatus({
        loading: false,
        error: "앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요."
      });
      return false;
    }
    setStatus({ loading: true });
    try {
      const data = await window.fb.getDefenderStatus();
      setStatus({ loading: false, data });
      return true;
    } catch (err) {
      setStatus({ loading: false, error: friendlyErrorMessage(err) });
      return false;
    }
  }, []);

  const loadThreats = useCallback(async (): Promise<boolean> => {
    if (!window.fb?.getDefenderThreats) {
      setThreats({
        loading: false,
        error: "위협 기록 조회를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      });
      return false;
    }
    setThreats({ loading: true });
    try {
      const data = await window.fb.getDefenderThreats();
      setThreats({ loading: false, data });
      return true;
    } catch (err) {
      setThreats({ loading: false, error: friendlyErrorMessage(err) });
      return false;
    }
  }, []);

  const runScan = useCallback(async () => {
    if (!window.fb?.runDefenderQuickScan) {
      setScanRefreshMessage(undefined);
      setScanResult({
        status: "spawn-failed",
        startedAt: new Date().toISOString(),
        message: "빠른 검사 시작을 연결하지 못했어요. Windows 보안 화면에서 직접 실행해주세요."
      });
      return;
    }
    setScanBusy(true);
    setScanRefreshMessage(undefined);
    try {
      const result = await window.fb.runDefenderQuickScan();
      setScanResult(result);
      const [statusRefreshed, threatsRefreshed] = await Promise.all([
        refreshStatus(),
        loadThreats()
      ]);
      if (statusRefreshed && threatsRefreshed) {
        setScanRefreshMessage("빠른 검사 요청 후 상태와 기록을 다시 읽었어요.");
      } else if (statusRefreshed || threatsRefreshed) {
        setScanRefreshMessage("빠른 검사 요청은 남겼고, 일부 상태만 다시 읽었어요.");
      } else {
        setScanRefreshMessage("빠른 검사 요청은 남겼지만 상태 새로고침은 이어서 확인해주세요.");
      }
    } catch (err) {
      setScanResult({
        status: "spawn-failed",
        startedAt: new Date().toISOString(),
        message: friendlyErrorMessage(err)
      });
      setScanRefreshMessage(undefined);
    } finally {
      setScanBusy(false);
    }
  }, [loadThreats, refreshStatus]);

  const openSecurity = useCallback(async () => {
    if (!window.fb?.runActionCommand) {
      setScanRefreshMessage(undefined);
      setScanResult({
        status: "spawn-failed",
        startedAt: new Date().toISOString(),
        message: "Windows 보안 화면 열기를 연결하지 못했어요. 시작 메뉴에서 Windows 보안을 직접 열어주세요."
      });
      return;
    }
    try {
      await window.fb.runActionCommand("start windowsdefender:");
    } catch (err) {
      setScanRefreshMessage(undefined);
      setScanResult({
        status: "spawn-failed",
        startedAt: new Date().toISOString(),
        message: friendlyErrorMessage(err)
      });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void loadThreats();
  }, [loadThreats, refreshStatus]);

  return (
    <main className="fb-report" aria-label="보안 점검">
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
          Windows 보안의 상태와 기록을 그대로 보여드려요. 확인과 조치는 모두 Windows가 직접 결정해요.
          포맷버디는 화면을 띄워주는 역할만 합니다.
        </p>
        {!isWindows && (
          <p style={{ color: "#a36400", fontSize: 13 }}>
            Mac 미리보기에서는 보안 검사를 실행하지 않아요.
          </p>
        )}
      </section>

      <StatusPanel
        state={status}
        onRefresh={() => void refreshStatus()}
        onRunScan={() => void runScan()}
        onOpenSecurity={() => void openSecurity()}
        busy={status.loading}
        actionBusy={scanBusy}
        isWindows={isWindows}
      />

      <QuickScanCard
        isWindows={isWindows}
        onRunScan={() => void runScan()}
        onOpenSecurity={() => void openSecurity()}
        lastResult={scanResult}
        refreshMessage={scanRefreshMessage}
        busy={scanBusy}
      />

      <ThreatsPanel state={threats} onLoad={() => void loadThreats()} busy={threats.loading} />
    </main>
  );
}
