// Lockup — CloudBuddy 마크 + 한글 워드마크 (옵션: 영문 서브)
import { CloudBuddy } from "./CloudBuddy";

const FB_BLUE = "#0066FF";
const FB_WHITE = "#FFFFFF";
const INK_1 = "#0E1116";

export interface LockupProps {
  markSize?: number;
  kanjiSize?: number;
  variant?: "primary" | "on-blue";
  en?: boolean;
  color?: string;
  animated?: boolean;
  className?: string;
}

export function Lockup({
  markSize = 44,
  kanjiSize = 22,
  variant = "primary",
  en = true,
  color,
  animated = false,
  className
}: LockupProps) {
  const wmColor = color || (variant === "on-blue" ? FB_WHITE : INK_1);
  const enColor = variant === "on-blue" ? "rgba(255,255,255,0.72)" : FB_BLUE;

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <CloudBuddy size={markSize} variant={variant} animated={animated} />
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontFamily: "'Wanted Sans','Pretendard',sans-serif",
            fontWeight: 800,
            fontSize: kanjiSize,
            letterSpacing: "-0.045em",
            color: wmColor,
            lineHeight: 1
          }}
        >
          포맷버디
        </span>
        {en && (
          <span
            style={{
              fontFamily: "'Wanted Sans','Pretendard',sans-serif",
              fontWeight: 700,
              fontSize: Math.round(kanjiSize * 0.42),
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: enColor,
              lineHeight: 1
            }}
          >
            Format Buddy
          </span>
        )}
      </span>
    </span>
  );
}
