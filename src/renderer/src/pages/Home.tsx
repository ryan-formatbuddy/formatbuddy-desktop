import { Button, ArrowRight } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { copy } from "@shared/copy";
import type { StatusMonitorSnapshot } from "@shared/types";

interface HomeProps {
  onStartScan: () => void;
  onOpenWebReport?: () => void;
  isMacPreview?: boolean;
  monitor?: StatusMonitorSnapshot;
}

function MonitorCard({ monitor }: { monitor?: StatusMonitorSnapshot }) {
  if (!monitor?.lastScanAt) {
    return (
      <section className="fb-home-monitor">
        <div>
          <h2 className="fb-h2">{copy.monitorTitle}</h2>
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

export function Home({ onStartScan, onOpenWebReport, isMacPreview = false, monitor }: HomeProps) {
  const bullets = isMacPreview ? copy.macPreviewBullets : copy.privacyBullets;

  return (
    <main className="fb-home">
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

      <section className="fb-home-privacy">
        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
        <ul className="fb-home-bullets">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
