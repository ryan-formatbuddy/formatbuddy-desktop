import { Button, ArrowRight } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { copy } from "@shared/copy";

interface HomeProps {
  onStartScan: () => void;
}

export function Home({ onStartScan }: HomeProps) {
  return (
    <main className="fb-home">
      <header className="fb-home-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <span className="fb-home-pill">
          <span className="fb-home-pill-dot" />
          {copy.homeEyebrow}
        </span>
      </header>

      <section className="fb-home-hero">
        <div className="fb-home-hero-copy">
          <h1 className="fb-h1">
            {copy.homeTitle1}
            <br />
            {copy.homeTitle2} <em>{copy.homeTitle3}</em>
          </h1>
          <p className="fb-lede">{copy.homeLede}</p>
          <div className="fb-home-cta">
            <Button size="lg" variant="primary" onClick={onStartScan} iconRight={<ArrowRight />}>
              {copy.homeStartCta}
            </Button>
          </div>
        </div>
        <div className="fb-home-hero-mark">
          <CloudBuddy size={220} variant="primary" expression="smile" animated />
        </div>
      </section>

      <section className="fb-home-privacy">
        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
        <ul className="fb-home-bullets">
          {copy.privacyBullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
