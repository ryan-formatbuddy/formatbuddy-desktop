// CloudBuddy — 포맷버디 브랜드 마크. 240×240 viewBox.
// 모션은 CSS-only (globals.css의 .cb-* 키프레임).

import type { Ref } from "react";

type Variant = "primary" | "on-blue";
type Expression = "smile" | "calm" | "wink";

const FB_BLUE = "#0066FF";
const FB_WHITE = "#FFFFFF";

function getPalette(variant: Variant) {
  if (variant === "on-blue") return { body: FB_WHITE, face: FB_BLUE };
  return { body: FB_BLUE, face: FB_WHITE };
}

export interface CloudBuddyProps {
  size?: number;
  variant?: Variant;
  expression?: Expression;
  animated?: boolean;
  blink?: boolean;
  pulse?: boolean;
  ariaLabel?: string;
  className?: string;
  ref?: Ref<SVGSVGElement>;
}

export function CloudBuddy({
  size = 200,
  variant = "primary",
  expression = "smile",
  animated = false,
  blink = false,
  pulse = false,
  ariaLabel = "포맷버디",
  className,
  ref
}: CloudBuddyProps) {
  const c = getPalette(variant);
  const wantBlink = blink || animated;
  const wantPulse = pulse || animated;
  const classes = [wantBlink || wantPulse ? "cb-animated" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      role="img"
      aria-label={ariaLabel}
      className={classes || undefined}
      style={{ overflow: "visible" }}
    >
      {wantPulse && (
        <g>
          <g className="cb-pulse-wrap cb-pulse-1">
            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
          </g>
          <g className="cb-pulse-wrap cb-pulse-2">
            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
          </g>
        </g>
      )}

      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />

      {wantPulse && (
        <g>
          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
        </g>
      )}

      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />

      <g fill={c.body}>
        <ellipse cx="74" cy="146" rx="42" ry="40" />
        <ellipse cx="120" cy="124" rx="50" ry="48" />
        <ellipse cx="166" cy="146" rx="40" ry="38" />
        <rect x="56" y="146" width="128" height="42" rx="10" />
      </g>

      {expression !== "wink" && (
        <g className="cb-eye cb-eye-l">
          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
        </g>
      )}
      <g className="cb-eye cb-eye-r">
        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
      </g>

      {expression === "smile" && (
        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
      )}
      {expression === "calm" && <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />}
      {expression === "wink" && (
        <>
          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}
