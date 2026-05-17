// ScanCard — 진단 진행 카드.
// web 버전을 Electron 환경 + 일반 CSS 변수 기반으로 단순화.

import type { ScanStepView } from "@shared/types";
import { CloudBuddy } from "./CloudBuddy";
import { ScoreRing } from "./ScoreRing";

export interface ScanCardProps {
  score: number;
  elapsedLabel: string;
  doneSteps: number;
  totalSteps: number;
  steps: ScanStepView[];
  title?: string;
  liveLabel?: string;
}

function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7.5 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="fb-spin">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M10.5 6 A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ScanCard({
  score,
  elapsedLabel,
  doneSteps,
  totalSteps,
  steps,
  title = "버디가 살펴보는 중",
  liveLabel = "진단 중"
}: ScanCardProps) {
  return (
    <div className="scan-card">
      <div className="scan-card-head">
        <div className="scan-card-who">
          <CloudBuddy size={36} variant="primary" expression="smile" animated />
          <div className="scan-card-who-meta">
            <div className="scan-card-title">{title}</div>
            <div className="scan-card-elapsed">{elapsedLabel}</div>
          </div>
        </div>
        <div className="scan-card-live">
          <span className="scan-card-live-dot" />
          {liveLabel}
        </div>
      </div>

      <div className="scan-score">
        <div>
          <div className="scan-score-label">버디 진행 점수</div>
          <div className="scan-score-value">
            {score}
            <span className="scan-score-unit">점</span>
          </div>
          <div className="scan-score-sub">
            전체 {totalSteps}단계 중 {doneSteps}단계 살펴봤어요
          </div>
        </div>
        <ScoreRing value={score} />
      </div>

      <div className="scan-steps">
        {steps.map((s, i) => (
          <div key={`${s.name}-${i}`} className={`scan-step ${s.state}`}>
            <div className="scan-step-idx">{s.state === "done" ? <CheckIcon /> : i + 1}</div>
            <div className="scan-step-name">{s.name}</div>
            <div className="scan-step-state">
              {s.state === "active" && <SpinIcon />}
              {s.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
