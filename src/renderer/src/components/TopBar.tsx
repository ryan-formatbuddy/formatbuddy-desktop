interface TopBarProps {
  here: string;
  meta?: string;
  version?: string;
  onBack?: () => void;
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M9 3 L5 7 L9 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopBar({ here, meta, version, onBack }: TopBarProps) {
  return (
    <div className="fb-win-topbar">
      <div className="fb-topbar-crumb">
        {onBack && (
          <button
            type="button"
            className="fb-topbar-back"
            aria-label="홈으로 돌아가기"
            onClick={onBack}
          >
            <BackArrow />
          </button>
        )}
        <span>홈</span>
        <span className="fb-topbar-sep">/</span>
        <span className="fb-topbar-here">{here}</span>
      </div>
      <div className="fb-topbar-meta">
        {meta && <span>{meta}</span>}
        {version && <span>{version}</span>}
      </div>
    </div>
  );
}
