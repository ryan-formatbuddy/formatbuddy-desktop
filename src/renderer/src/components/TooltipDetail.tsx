import { useId } from "react";

interface TooltipDetailProps {
  label: string;
  title: string;
  body: string;
}

export function TooltipDetail({ label, title, body }: TooltipDetailProps) {
  const id = useId();

  return (
    <span className="fb-tooltip">
      <button type="button" className="fb-tooltip-trigger" aria-describedby={id}>
        {label}
      </button>
      <span id={id} role="tooltip" className="fb-tooltip-box">
        <strong>{title}</strong>
        <span>{body}</span>
      </span>
    </span>
  );
}
