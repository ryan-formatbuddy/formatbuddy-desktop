import { useState } from "react";
import { CloudBuddy } from "../components/CloudBuddy";
import { Button, ArrowRight } from "../components/Button";
import { copy } from "@shared/copy";

interface OnboardingProps {
  /** Mark onboarding seen and land on Home. */
  onComplete: () => void;
  /**
   * v2.0 (Round D-26 / C6) — last-step secondary CTA.
   * When present, the final onboarding panel shows "권한 안내 먼저 보기"
   * which marks onboarding seen AND navigates to the Permissions
   * page so the user can audit what the app touches before scanning.
   */
  onOpenPermissions?: () => void;
  /**
   * v2.0 (Round D-26 / C6) — last-step primary CTA upgrade.
   * When present, the final onboarding panel adds "지금 첫 점검 시작"
   * which marks onboarding seen AND immediately kicks off a scan, so
   * a brand-new install can land in the report screen on first click.
   */
  onStartFirstScan?: () => void;
  isMacPreview?: boolean;
}

const EXPRESSIONS: ReadonlyArray<"smile" | "calm" | "wink"> = ["smile", "calm", "wink"];

export function Onboarding({
  onComplete,
  onOpenPermissions,
  onStartFirstScan,
  isMacPreview = false
}: OnboardingProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const steps = isMacPreview ? copy.onboardingStepsMac : copy.onboardingSteps;
  const cur = steps[step];
  const isLast = step === 2;

  const handleNext = () => {
    if (isLast) onComplete();
    else setStep((s) => (s + 1) as 0 | 1 | 2);
  };

  const finalCtaLabel = isLast
    ? onStartFirstScan
      ? "처음으로 가기"
      : copy.onboardingStart
    : copy.onboardingNext;

  return (
    <main className="fb-onboard" aria-label="처음 사용 안내">
      <div className="fb-onboard-left">
        <span className="fb-onboard-tag">{cur.tag}</span>
        <h1 className="fb-onboard-head">
          {cur.head}
          <br />
          <em>{cur.headEm}</em>
        </h1>
        <p className="fb-onboard-body">{cur.body}</p>
        <div className="fb-onboard-dots" aria-hidden>
          {[0, 1, 2].map((n) => (
            <span key={n} className={`fb-onboard-dot ${n === step ? "on" : ""}`} />
          ))}
        </div>
        <div className="fb-onboard-foot">
          {isLast && onStartFirstScan && (
            <Button
              variant="primary"
              size="md"
              onClick={onStartFirstScan}
              iconRight={<ArrowRight />}
            >
              지금 첫 점검 시작
            </Button>
          )}
          <Button
            variant={isLast && onStartFirstScan ? "ghost" : "primary"}
            size="md"
            onClick={handleNext}
            iconRight={isLast && onStartFirstScan ? undefined : <ArrowRight />}
          >
            {finalCtaLabel}
          </Button>
          {isLast && onOpenPermissions && (
            <button
              type="button"
              className="fb-onboard-skip"
              onClick={onOpenPermissions}
              aria-label="권한 안내 먼저 보기"
            >
              권한 안내 먼저 보기 →
            </button>
          )}
          {!isLast && (
            <button type="button" className="fb-onboard-skip" onClick={onComplete}>
              {copy.onboardingSkip}
            </button>
          )}
        </div>
      </div>
      <div className="fb-onboard-right">
        <CloudBuddy size={220} variant="on-blue" animated={step === 0} expression={EXPRESSIONS[step]} />
      </div>
    </main>
  );
}
