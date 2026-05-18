import { useState } from "react";
import { CloudBuddy } from "../components/CloudBuddy";
import { Button } from "../components/Button";
import { copy } from "@shared/copy";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type { ScanError } from "@shared/types";

interface ErrorScreenProps {
  error: ScanError;
  onRetry: () => void;
  onBack: () => void;
}

export function ErrorScreen({ error, onRetry, onBack }: ErrorScreenProps) {
  const [showDetail, setShowDetail] = useState(false);
  const code = error.code ?? "UNKNOWN";
  const friendly = friendlyErrorMessage(error);

  return (
    <main className="fb-err-screen">
      <CloudBuddy size={108} variant="primary" expression="calm" />
      <h2 className="fb-err-head">{copy.errorHead}</h2>
      <p className="fb-err-body">{friendly}</p>
      <div className="fb-err-actions">
        <Button variant="primary" size="md" onClick={onRetry}>
          {copy.errorRetry}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => void window.fb?.openLogsFolder?.()}
        >
          {copy.errorOpenLogs}
        </Button>
        <Button variant="ghost" size="md" onClick={onBack}>
          {copy.reportBackCta}
        </Button>
      </div>
      {(error.detail || error.message) && (
        <button
          type="button"
          className="fb-err-toggle"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
        >
          {showDetail ? "기술 정보 숨기기" : "기술 정보 보기"}
          <span className="fb-err-code">
            {copy.errorCodePrefix}
            {code}
          </span>
        </button>
      )}
      {showDetail && (
        <div className="fb-err-detail">
          <pre>{(error.detail ?? error.message ?? "").slice(0, 1200)}</pre>
        </div>
      )}
    </main>
  );
}
