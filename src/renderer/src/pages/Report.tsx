import { useCallback, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { copy } from "@shared/copy";
import type { ActionItem, ScanResult } from "@shared/types";

function expressionForScore(score: number): "calm" | "smile" | "wink" {
  if (score >= 76) return "calm";
  if (score >= 26) return "smile";
  return "wink";
}

const HEAVY_REASON_THRESHOLD = 5;

function severityClass(s: ScanResult["recommendation"]["severity"]): string {
  switch (s) {
    case "safe":
      return "fb-score-safe";
    case "watch":
      return "fb-score-watch";
    case "organize":
      return "fb-score-organize";
    case "format":
      return "fb-score-format";
  }
}

// expressionForScore helper will land in v0.5.3 when the ScoreHero card
// gains its own CloudBuddy. For now severity drives the tone color only.

interface ReportProps {
  result: ScanResult;
  onBack: () => void;
}

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="fb-report-row">
      <div className="fb-report-row-label">{label}</div>
      <div className="fb-report-row-value">{value}</div>
    </div>
  );
}

function formatGb(value?: number | null) {
  if (value == null) return "—";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
}

export function Report({ result, onBack }: ReportProps) {
  const { report, recommendation } = result;
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
  const [manifestRunning, setManifestRunning] = useState(false);

  const installedCount = report.installedApps.length;
  const driverCount = report.drivers.length;
  const wifiCount = report.wifiProfiles.length;
  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);

  const wingetPackageCount = useMemo(() => {
    if (!report.wingetExport?.Sources) return 0;
    return report.wingetExport.Sources.reduce(
      (sum, src) => sum + (src.Packages?.length ?? 0),
      0
    );
  }, [report.wingetExport]);

  const onExport = useCallback(async () => {
    if (!window.fb) return;
    setExportStatus(null);
    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    else setExportStatus("저장을 취소했어요.");
  }, [report]);

  const onExportHtml = useCallback(async () => {
    if (!window.fb?.exportHtmlReport) return;
    setExportStatus(null);
    const res = await window.fb.exportHtmlReport(report, recommendation);
    if (res.saved && res.path)
      setExportStatus(`${copy.reportHtmlSavedPrefix}${res.path}`);
    else setExportStatus(copy.reportHtmlCancelled);
  }, [report, recommendation]);

  const onOpenWeb = useCallback(async () => {
    if (!window.fb) return;
    await window.fb.openWebReport();
  }, []);

  const [runStatus, setRunStatus] = useState<string | null>(null);
  const runAction = useCallback(async (action: ActionItem) => {
    if (!action.command || !window.fb?.runActionCommand) return;
    setRunStatus(null);
    const res = await window.fb.runActionCommand(action.command);
    if (res.mode === "opened-url") setRunStatus(copy.recommendRunOpenedToast);
    else if (res.mode === "copied-to-clipboard") setRunStatus(copy.recommendRunCopiedToast);
    else setRunStatus(copy.recommendRunRejectedToast);
  }, []);

  const onExportManifest = useCallback(async () => {
    if (!window.fb) return;
    setManifestStatus(null);
    setManifestRunning(true);
    try {
      const res = await window.fb.exportBackupManifest();
      if (res.saved && res.path) {
        setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
      } else if (res.message) {
        setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
      } else {
        setManifestStatus(copy.manifestExportCancelled);
      }
    } catch (e) {
      const err = e as Error;
      setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
    } finally {
      setManifestRunning(false);
    }
  }, []);

  return (
    <main className="fb-report">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            {copy.reportBackCta}
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
        <p className="fb-lede">{copy.reportLede}</p>
      </section>

      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
        <div className="fb-score-card-head">
          <div className="fb-score-card-text">
            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
            <div className="fb-score-card-value">
              <span className="fb-score-card-num">{recommendation.formatScore}</span>
              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
            </div>
            <div className="fb-score-card-headline">{recommendation.headline}</div>
            <div className="fb-score-card-badge">
              <span className="fb-score-card-badge-dot" />
              {copy.recommendSeverity[recommendation.severity].chip}
            </div>
          </div>
          <div className="fb-score-card-buddy">
            <CloudBuddy
              size={88}
              variant="primary"
              expression={expressionForScore(recommendation.formatScore)}
              animated={recommendation.severity === "safe"}
            />
          </div>
        </div>
        <p className="fb-score-card-summary">{recommendation.summary}</p>
      </section>

      <section className="fb-report-advice">
        <article className="fb-card">
          <h3>{copy.recommendTryFirstTitle}</h3>
          <ul className="fb-advice-list">
            {recommendation.tryFirst.map((a, i) => (
              <li key={`tf-${i}`}>
                <strong>{a.title}</strong>
                <span>{a.description}</span>
                {a.command && (
                  <div className="fb-advice-cmd-row">
                    <code className="fb-advice-cmd">{a.command}</code>
                    <button
                      type="button"
                      className="fb-run-btn"
                      aria-label={`${a.title} — ${copy.recommendRunButton}`}
                      onClick={() => void runAction(a)}
                    >
                      {copy.recommendRunButton}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="fb-card">
          <h3>{copy.recommendFormatReasonsTitle}</h3>
          {recommendation.formatReasons.length === 0 ? (
            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
          ) : (
            <ul className="fb-advice-list">
              {recommendation.formatReasons.map((r, i) => {
                const heavy = r.weightedScore >= HEAVY_REASON_THRESHOLD;
                return (
                  <li key={`fr-${i}`}>
                    <strong>
                      {r.label}{" "}
                      <span className={`fb-advice-weight${heavy ? " fb-advice-weight-heavy" : ""}`}>
                        +{r.weightedScore.toFixed(1)}
                      </span>
                    </strong>
                    <span>{r.description}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="fb-card">
          <h3>{copy.recommendAfterFormatTitle}</h3>
          <ul className="fb-advice-list">
            {recommendation.afterFormat.map((a, i) => (
              <li key={`af-${i}`}>
                <strong>{a.title}</strong>
                <span>{a.description}</span>
                {a.command && (
                  <div className="fb-advice-cmd-row">
                    <code className="fb-advice-cmd">{a.command}</code>
                    <button
                      type="button"
                      className="fb-run-btn"
                      aria-label={`${a.title} — ${copy.recommendRunButton}`}
                      onClick={() => void runAction(a)}
                    >
                      {copy.recommendRunButton}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>
      </section>

      {runStatus && (
        <div className="fb-run-status" role="status" aria-live="polite">
          {runStatus}
        </div>
      )}

      <section className="fb-report-grid">
        <article className="fb-card">
          <h3>이 PC</h3>
          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
          <Row label="CPU" value={report.system.cpu ?? "—"} />
          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
        </article>

        <article className="fb-card">
          <h3>저장 공간</h3>
          <Row label="총 용량" value={formatGb(totalDiskGb)} />
          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
          {report.disks.map((d) => (
            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
          ))}
        </article>

        <article className="fb-card">
          <h3>같이 챙길 것</h3>
          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
        </article>

        <article className="fb-card">
          <h3>설치된 앱 / 드라이버</h3>
          <Row label="설치된 앱" value={`${installedCount}개`} />
          <Row label="드라이버" value={`${driverCount}개`} />
          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
          <Row label="프린터" value={`${report.printers.length}개`} />
        </article>

        <article className="fb-card">
          <h3>사용자 폴더</h3>
          {report.userFolders.map((f) => (
            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
          ))}
        </article>

        <article className="fb-card">
          <h3>{copy.wingetSectionTitle}</h3>
          {report.winget.available ? (
            <p className="fb-report-card-explain">
              {copy.wingetSummary(wingetPackageCount)}
            </p>
          ) : (
            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
          )}
          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
          <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
        </article>

        <article className="fb-card fb-card-checklist">
          <h3>포맷 전 체크리스트</h3>
          <ul className="fb-report-checklist">
            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
            <li>Desktop·Documents·Downloads 백업</li>
            <li>클라우드 동기화 완료 확인</li>
            <li>리포트 JSON 저장 후 포맷</li>
          </ul>
        </article>
      </section>

      <section className="fb-report-manifest">
        <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
        <p className="fb-lede">{copy.manifestExplain}</p>
        <div className="fb-report-cta">
          <Button
            variant="primary"
            size="lg"
            onClick={onExportManifest}
            disabled={manifestRunning}
          >
            {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
          </Button>
          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
        </div>
      </section>

      <section className="fb-report-cta">
        <Button variant="primary" size="lg" onClick={onExportHtml}>
          {copy.reportExportHtmlCta}
        </Button>
        <Button variant="secondary" size="lg" onClick={onExport}>
          {copy.reportExportCta}
        </Button>
        <Button variant="ghost" size="lg" onClick={onOpenWeb}>
          {copy.reportOpenWebCta}
        </Button>
        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
      </section>

      <section className="fb-report-meta">
        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
        <small>schema {report.schemaVersion}</small>
      </section>
    </main>
  );
}
