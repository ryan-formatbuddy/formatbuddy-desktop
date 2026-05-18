import { useEffect, useState } from "react";
import { copy } from "@shared/copy";
import type { UpdateDownloadProgress, UpdateInfo } from "@shared/types";

type UpdatePhase =
  | { kind: "idle" }
  | { kind: "available"; info: UpdateInfo }
  | { kind: "downloading"; percent: number }
  | { kind: "downloaded"; info: UpdateInfo }
  | { kind: "error"; message: string };

function formatPercent(p: number): string {
  if (!isFinite(p) || p < 0) return "0%";
  return `${Math.min(100, Math.round(p))}%`;
}

export function UpdateBanner() {
  const [phase, setPhase] = useState<UpdatePhase>({ kind: "idle" });

  useEffect(() => {
    if (!window.fb) return;

    const offAvailable = window.fb.onUpdateAvailable((info) => {
      setPhase({ kind: "available", info });
    });
    const offProgress = window.fb.onUpdateDownloadProgress((p: UpdateDownloadProgress) => {
      setPhase({ kind: "downloading", percent: p.percent });
    });
    const offDownloaded = window.fb.onUpdateDownloaded((info) => {
      setPhase({ kind: "downloaded", info });
    });
    const offError = window.fb.onUpdateError((e) => {
      setPhase({ kind: "error", message: e.message });
    });

    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  if (phase.kind === "idle") return null;

  if (phase.kind === "error") {
    return (
      <div className="fb-update-banner fb-update-banner-quiet" role="status">
        <span>{copy.updateErrorLabel}</span>
        <span className="fb-update-banner-detail">{phase.message.slice(0, 80)}</span>
      </div>
    );
  }

  if (phase.kind === "available") {
    return (
      <div className="fb-update-banner" role="status">
        <span>{copy.updateAvailable}</span>
        <span className="fb-update-banner-detail">v{phase.info.version}</span>
      </div>
    );
  }

  if (phase.kind === "downloading") {
    return (
      <div className="fb-update-banner" role="status">
        <span>{copy.updateDownloading}</span>
        <span className="fb-update-banner-detail">{formatPercent(phase.percent)}</span>
      </div>
    );
  }

  // downloaded
  return (
    <div className="fb-update-banner fb-update-banner-ready" role="status">
      <span>{copy.updateDownloaded}</span>
      <button
        type="button"
        className="fb-btn fb-btn-on-blue fb-btn-sm"
        onClick={() => {
          void window.fb?.installUpdate();
        }}
      >
        {copy.updateInstallCta}
      </button>
    </div>
  );
}
