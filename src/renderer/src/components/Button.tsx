import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "on-blue";
type Size = "lg" | "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  iconRight,
  iconLeft,
  className,
  children,
  full,
  ...rest
}: ButtonProps) {
  const cls = ["fb-btn", `fb-btn-${variant}`, `fb-btn-${size}`, full ? "fb-btn-full" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} className={cls}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}

export function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
