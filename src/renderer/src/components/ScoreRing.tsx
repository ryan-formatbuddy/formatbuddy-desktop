export interface ScoreRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

export function ScoreRing({
  value,
  size = 76,
  strokeWidth = 6,
  showLabel = true,
  className
}: ScoreRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, value));
  const offset = c - (safe / 100) * c;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`진행률 ${safe}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(0,102,255,0.18)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--color-fb-blue)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {showLabel && (
        <text
          x={size / 2}
          y={size / 2 + Math.round(size * 0.08)}
          textAnchor="middle"
          fontSize={Math.round(size * 0.21)}
          fontWeight={800}
          fontFamily="'Wanted Sans','Pretendard',sans-serif"
          fill="var(--color-fb-blue)"
          style={{ fontFeatureSettings: '"tnum" on' }}
        >
          {safe}%
        </text>
      )}
    </svg>
  );
}
