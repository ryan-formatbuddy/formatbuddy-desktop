import { useState } from "react";
import { CloudBuddy } from "../components/CloudBuddy";
import { Button, ArrowRight } from "../components/Button";
import { copy } from "@shared/copy";

interface OnboardingProps {
  onComplete: () => void;
  isMacPreview?: boolean;
}

const EXPRESSIONS: ReadonlyArray<"smile" | "calm" | "wink"> = ["smile", "calm", "wink"];

export function Onboarding({ onComplete, isMacPreview = false }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const steps = isMacPreview ? copy.onboardingStepsMac : copy.onboardingSteps;
  const cur = steps[step];
  const isLast = step === 2;

  const handleNext = () => {
    if (isLast) onComplete();
    else setStep((s) => (s + 1) as 0 | 1 | 2);
  };

  return (
    <main className="fb-onboard">
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
          <Button variant="primary" size="md" onClick={handleNext} iconRight={<ArrowRight />}>
            {isLast ? copy.onboardingStart : copy.onboardingNext}
          </Button>
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
