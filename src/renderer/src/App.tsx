import { useCallback, useEffect, useMemo, useState } from "react";
import { Home } from "./pages/Home";
import { Scanning } from "./pages/Scanning";
import { Report } from "./pages/Report";
import type { ScanError, ScanProgress, ScanResult } from "@shared/types";

type Phase =
  | { kind: "home" }
  | { kind: "scanning"; progress: ScanProgress }
  | { kind: "report"; result: ScanResult }
  | { kind: "error"; error: ScanError };

const INITIAL_PROGRESS: ScanProgress = {
  step: "준비",
  doneSteps: 0,
  totalSteps: 6,
  score: 0,
  elapsedMs: 0,
  steps: [
    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
  ]
};

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "home" });
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    if (typeof window.fb?.appVersion === "function") {
      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    }
  }, []);

  useEffect(() => {
    if (!window.fb) return;
    const offProgress = window.fb.onScanProgress((p) => {
      setPhase((prev) =>
        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
      );
    });
    const offComplete = window.fb.onScanComplete((r) => {
      setPhase({ kind: "report", result: r });
    });
    const offError = window.fb.onScanError((err) => {
      setPhase({ kind: "error", error: err });
    });
    return () => {
      offProgress();
      offComplete();
      offError();
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!window.fb) {
      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
      return;
    }
    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    try {
      await window.fb.startScan();
    } catch {
      // 에러는 onScanError 이벤트로 처리
    }
  }, []);

  const cancelScan = useCallback(async () => {
    if (!window.fb) return;
    await window.fb.cancelScan();
    setPhase({ kind: "home" });
  }, []);

  const goHome = useCallback(() => setPhase({ kind: "home" }), []);

  const content = useMemo(() => {
    switch (phase.kind) {
      case "home":
        return <Home onStartScan={startScan} />;
      case "scanning":
        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
      case "report":
        return <Report result={phase.result} onBack={goHome} />;
      case "error":
        return (
          <Scanning
            progress={INITIAL_PROGRESS}
            errorMessage={phase.error.message}
            onCancel={goHome}
            onRetry={startScan}
          />
        );
    }
  }, [phase, startScan, cancelScan, goHome]);

  return (
    <div className="fb-app">
      {content}
      <footer className="fb-app-footer">
        <span>FormatBuddy Desktop</span>
        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
      </footer>
    </div>
  );
}
