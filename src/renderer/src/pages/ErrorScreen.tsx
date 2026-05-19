import { useCallback, useState } from "react";
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

const SUPPORT_EMAIL = "support@formatbuddy.app";

function buildMailto(error: ScanError): string {
  const code = error.code ?? "UNKNOWN";
  const subject = `FormatBuddy 오류 신고 - ${code}`;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const stack = (error.detail ?? error.message ?? "").slice(0, 1200);
  const lines = [
    "[자동 채워진 정보. 그대로 보내주시면 큰 도움이 돼요]",
    `시각: ${new Date().toLocaleString("ko-KR")}`,
    `코드: ${code}`,
    `UA: ${ua}`,
    "",
    "[추가로 적어주실 부분]",
    "어떤 작업을 하다 발생했어요?:",
    "재현 가능한가요? (네 / 아니오):",
    "",
    "[오류 내용]",
    stack
  ];
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function ErrorScreen({ error, onRetry, onBack }: ErrorScreenProps) {
  const [showDetail, setShowDetail] = useState(false);
  const code = error.code ?? "UNKNOWN";
  const friendly = friendlyErrorMessage(error);

  const onSendMail = useCallback(() => {
    if (!window.fb?.runActionCommand) return;
    void window.fb.runActionCommand(buildMailto(error));
  }, [error]);

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
        <Button variant="secondary" size="md" onClick={onSendMail}>
          오류 메일 보내기
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
          {showDetail ? "자세한 내용 숨기기" : "자세한 내용 보기"}
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
