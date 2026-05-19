import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home } from "./pages/Home";
import { Scanning } from "./pages/Scanning";
import { Report } from "./pages/Report";
import { Cleanup } from "./pages/Cleanup";
import { AppManager } from "./pages/AppManager";
import { SecurityCenter } from "./pages/SecurityCenter";
import { Permissions } from "./pages/Permissions";
import { AuditLog } from "./pages/AuditLog";
import { Onboarding } from "./pages/Onboarding";
import { ErrorScreen } from "./pages/ErrorScreen";
import { UpdateBanner } from "./components/UpdateBanner";
import { WinChrome } from "./components/WinChrome";
import { TopBar } from "./components/TopBar";
import type {
  AppPlatform,
  AppStateSnapshot,
  ScanError,
  ScanProgress,
  ScanReport,
  ScanResult
} from "@shared/types";

const ONBOARDING_SEEN_KEY = "formatbuddy:onboardingSeenAt";

type Phase =
  | { kind: "onboarding" }
  | { kind: "home" }
  | { kind: "scanning"; progress: ScanProgress }
  | { kind: "report"; result: ScanResult }
  | { kind: "cleanup"; report?: ScanReport }
  | { kind: "apps" }
  | { kind: "security" }
  | { kind: "permissions" }
  | { kind: "audit" }
  | { kind: "error"; error: ScanError };

function readOnboardingSeen(): boolean {
  try {
    return Boolean(localStorage.getItem(ONBOARDING_SEEN_KEY));
  } catch {
    return false;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, new Date().toISOString());
  } catch {
    // private mode / quota — ignore, user just sees onboarding next time
  }
}

function guessPlatform(): AppPlatform {
  const navPlatform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (navPlatform.includes("mac") || userAgent.includes("mac os")) return "darwin";
  if (navPlatform.includes("win") || userAgent.includes("windows")) return "win32";
  if (navPlatform.includes("linux") || userAgent.includes("linux")) return "linux";
  return "unknown";
}

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
  const [phase, setPhase] = useState<Phase>(() =>
    readOnboardingSeen() ? { kind: "home" } : { kind: "onboarding" }
  );
  const [appVersion, setAppVersion] = useState<string>("");
  const [appPlatform, setAppPlatform] = useState<AppPlatform>(() => guessPlatform());
  const [appState, setAppState] = useState<AppStateSnapshot | null>(null);
  const isMacPreview = appPlatform === "darwin";

  const finishOnboarding = useCallback(() => {
    markOnboardingSeen();
    setPhase({ kind: "home" });
  }, []);

  useEffect(() => {
    if (typeof window.fb?.appVersion === "function") {
      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    }
    if (typeof window.fb?.appPlatform === "function") {
      void window.fb
        .appPlatform()
        .then((platform) => setAppPlatform(platform as AppPlatform))
        .catch(() => undefined);
    }
    if (typeof window.fb?.getAppState === "function") {
      void window.fb.getAppState().then(setAppState).catch(() => setAppState(null));
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
      if (r.appState) setAppState(r.appState);
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

  // Tray "PC 점검 시작" forwards through window.fb.onTrayTriggerScan.
  // We re-bind whenever startScan changes (which is never, since
  // startScan is memoized with no deps, but the lint rule wants it).
  useEffect(() => {
    if (!window.fb?.onTrayTriggerScan) return;
    return window.fb.onTrayTriggerScan(() => {
      void startScanRef.current();
    });
  }, []);

  const startScan = useCallback(async () => {
    if (!window.fb) {
      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
      return;
    }
    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    try {
      const result = await window.fb.startScan();
      if (result.appState) setAppState(result.appState);
      setPhase({ kind: "report", result });
    } catch {
      // 에러는 onScanError 이벤트로 처리
    }
  }, []);

  // Stable ref so the tray listener (registered once) always invokes
  // the latest startScan implementation.
  const startScanRef = useRef(startScan);
  useEffect(() => {
    startScanRef.current = startScan;
  }, [startScan]);

  const cancelScan = useCallback(async () => {
    if (!window.fb) return;
    await window.fb.cancelScan();
    setPhase({ kind: "home" });
  }, []);

  const goHome = useCallback(() => setPhase({ kind: "home" }), []);

  const topBar = useMemo(() => {
    if (phase.kind === "home" || phase.kind === "onboarding") return null;
    const versionLabel = appVersion ? `v${appVersion}` : undefined;
    if (phase.kind === "scanning")
      return (
        <TopBar
          here={isMacPreview ? "시연 중" : "진단 중"}
          meta={isMacPreview ? "Mac 미리보기 모드" : "로컬에서만 처리됨"}
          version={versionLabel}
          onBack={cancelScan}
        />
      );
    if (phase.kind === "report")
      return (
        <TopBar
          here="리포트"
          meta={isMacPreview ? "Mac 미리보기 모드 · 로컬에서만 처리됨" : "로컬에서만 처리됨"}
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "cleanup")
      return (
        <TopBar
          here="안전 정리"
          meta={isMacPreview ? "Mac 미리보기 모드" : "로컬에서만 처리됨"}
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "apps")
      return (
        <TopBar
          here="앱 정리"
          meta={isMacPreview ? "Mac 미리보기 모드" : "로컬에서만 처리됨"}
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "security")
      return (
        <TopBar
          here="보안 점검"
          meta={isMacPreview ? "Mac 미리보기 모드" : "로컬에서만 처리됨"}
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "permissions")
      return (
        <TopBar
          here="권한 안내"
          meta="이 앱이 PC에서 하는 일"
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "audit")
      return (
        <TopBar
          here="활동 기록"
          meta="이 PC에서 한 일"
          version={versionLabel}
          onBack={goHome}
        />
      );
    if (phase.kind === "error")
      return <TopBar here="잠시 멈췄어요" version={versionLabel} onBack={goHome} />;
    return null;
  }, [phase, appVersion, goHome, cancelScan, isMacPreview]);

  const content = useMemo(() => {
    switch (phase.kind) {
      case "onboarding":
        return <Onboarding onComplete={finishOnboarding} isMacPreview={isMacPreview} />;
      case "home":
        return (
          <Home
            onStartScan={startScan}
            onOpenWebReport={() => void window.fb?.openWebReport()}
            isMacPreview={isMacPreview}
            monitor={appState?.monitor}
            onOpenPermissions={() => setPhase({ kind: "permissions" })}
            onOpenAuditLog={() => setPhase({ kind: "audit" })}
          />
        );
      case "scanning":
        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
      case "report":
        return (
          <Report
            result={phase.result}
            onBack={goHome}
            appPlatform={appPlatform}
            appState={phase.result.appState ?? appState ?? undefined}
            onOpenCleanup={(report) => setPhase({ kind: "cleanup", report })}
            onOpenAppManager={() => setPhase({ kind: "apps" })}
            onOpenSecurity={() => setPhase({ kind: "security" })}
            onRescan={() => void startScan()}
          />
        );
      case "cleanup":
        return (
          <Cleanup
            report={phase.report}
            isWindows={appPlatform === "win32"}
            onBack={goHome}
            onComplete={goHome}
          />
        );
      case "apps":
        return (
          <AppManager
            isWindows={appPlatform === "win32"}
            onBack={goHome}
            onOpenCleanup={() => setPhase({ kind: "cleanup" })}
          />
        );
      case "security":
        return <SecurityCenter isWindows={appPlatform === "win32"} onBack={goHome} />;
      case "permissions":
        return <Permissions onBack={goHome} />;
      case "audit":
        return <AuditLog onBack={goHome} />;
      case "error":
        return <ErrorScreen error={phase.error} onRetry={startScan} onBack={goHome} />;
    }
  }, [phase, startScan, cancelScan, goHome, finishOnboarding, appPlatform, isMacPreview, appState]);

  return (
    <div className="fb-app">
      <WinChrome />
      {topBar}
      <div className="fb-app-body">{content}</div>
      <UpdateBanner />
      <footer className="fb-app-footer">
        <span>포맷버디 데스크탑</span>
        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
      </footer>
    </div>
  );
}
