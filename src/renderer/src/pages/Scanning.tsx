import { ScanCard } from "../components/ScanCard";
import { Button } from "../components/Button";
import { copy } from "@shared/copy";
import type { ScanProgress } from "@shared/types";

interface ScanningProps {
  progress: ScanProgress;
  errorMessage?: string;
  onCancel: () => void;
  onRetry?: () => void;
}

function formatElapsed(ms: number) {
  if (!ms || ms < 0) return "잠시만요";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}초 경과`;
  return `${min}분 ${sec}초 경과`;
}

export function Scanning({ progress, errorMessage, onCancel, onRetry }: ScanningProps) {
  return (
    <main className="fb-scanning">
      <div className="fb-scanning-wrap">
        <ScanCard
          score={progress.score}
          elapsedLabel={formatElapsed(progress.elapsedMs)}
          doneSteps={progress.doneSteps}
          totalSteps={progress.totalSteps}
          steps={progress.steps}
          message={progress.message ?? "진단이 끝나면 자동으로 리포트로 넘어가요."}
          title={errorMessage ? copy.errorHeadline : copy.scanTitle}
          liveLabel={errorMessage ? "잠시 멈췄어요" : copy.scanLiveLabel}
        />

        {errorMessage && (
          <div className="fb-scanning-error" role="alert">
            <strong>{copy.errorHeadline}</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="fb-scanning-actions">
          {onRetry && (
            <Button variant="primary" size="md" onClick={onRetry}>
              {copy.errorRetryCta}
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={onCancel}>
            {copy.scanCancelCta}
          </Button>
        </div>
      </div>
    </main>
  );
}
