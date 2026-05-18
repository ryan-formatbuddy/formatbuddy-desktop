import { useEffect, useState } from "react";
import { CloudBuddy } from "./CloudBuddy";

function CapMin() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M2 5 H8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CapMax({ restored }: { restored: boolean }) {
  if (restored) {
    // "restore" glyph — two overlapping rects
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <rect x="2.5" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1" />
        <rect x="1" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="#FBFBFC" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CapClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function WinChrome({ title = "포맷버디" }: { title?: string }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.fb?.onWindowState) return;
    return window.fb.onWindowState((state) => setIsMaximized(state.isMaximized));
  }, []);

  return (
    <div className="fb-win-chrome">
      <div className="fb-win-left">
        <CloudBuddy size={14} variant="primary" />
        <span>{title}</span>
      </div>
      <div className="fb-win-caption">
        <button
          type="button"
          className="fb-cap"
          aria-label="최소화"
          onClick={() => void window.fb?.minimizeWindow()}
        >
          <CapMin />
        </button>
        <button
          type="button"
          className="fb-cap"
          aria-label={isMaximized ? "이전 크기로" : "최대화"}
          onClick={() => void window.fb?.toggleMaximizeWindow()}
        >
          <CapMax restored={isMaximized} />
        </button>
        <button
          type="button"
          className="fb-cap fb-cap-close"
          aria-label="닫기"
          onClick={() => void window.fb?.closeWindow()}
        >
          <CapClose />
        </button>
      </div>
    </div>
  );
}
