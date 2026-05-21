import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { appLeftoverResultActions } from "./appManagerActions";
import {
  appLeftoverConfirmRestorePlan,
  type LeftoverCleanupConfirm
} from "./appManagerConfirmCopy";
import { appLeftoverPanelDecision } from "./appManagerLeftoverState";
import {
  CLEANUP_RECENT_RESTORE_EMPTY_MESSAGE,
  CLEANUP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE,
  cleanupRestoreMissingBridge,
  cleanupRestorePlanCount,
  cleanupRestorePlanFromResult,
  cleanupRestoreSummary,
  runCleanupRestorePlan
} from "./cleanupRestoreAll";
import {
  appLeftoverEffectLines,
  appLeftoverRestorableCount,
  appLeftoverRestoreBinBreakdown,
  appLeftoverResultHeadline,
  appLeftoverResultLines,
  appLeftoverSkippedPreviewLines,
  type LeftoverEffectSummary
} from "./appManagerResultCopy";
import {
  canCleanupLeftoverGroup,
  leftoverPathNeedsManualCheck,
  selectableLeftoverPathIds,
  summarizeLeftoverSnapshot
} from "@shared/app-leftovers";
import {
  CLEANUP_FOLLOWUP_SAVE_WARNING,
  CLEANUP_HISTORY_SAVE_WARNING
} from "@shared/cleanup-warnings";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type {
  AppLeftoverGroup,
  AppLeftoverPath,
  AppLeftoversSnapshot,
  AppManagerItem,
  AppManagerSnapshot,
  AppUninstallFollowUpItem,
  CleanupExecuteResult,
  AppUninstallResult
} from "@shared/types";

interface AppManagerProps {
  isWindows: boolean;
  onBack: () => void;
  onOpenCleanup: () => void;
  onRescan: () => void;
  onQuickRescan?: () => void;
  onVerifyUninstall?: () => void;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
  onOpenStartupAuto: () => void;
  autoOpenLeftovers?: boolean;
  notice?: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: AppManagerSnapshot }
  | { kind: "empty" }
  | { kind: "error"; message: string };

type UninstallConfirm = AppManagerItem;

function formatBytes(value?: number | null): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function formatInstallDate(value?: string | null): string {
  if (!value) return "";
  // Windows registry sometimes stores as YYYYMMDD
  const ymd = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return value;
}

function availabilityBadge(item: AppManagerItem): { label: string; tone: string } {
  switch (item.uninstallAvailability) {
    case "ready":
      return { label: "Windows 제거 가능", tone: "ready" };
    case "no-uninstall-string":
      return { label: "수동 제거 필요", tone: "muted" };
    case "registry-only":
      return { label: "설정에서 직접", tone: "muted" };
    case "system-component":
      return { label: "Windows 구성요소", tone: "warning" };
    case "blocked":
      return { label: "자동 실행 안 함", tone: "warning" };
  }
}

function leftoverKindLabel(path: AppLeftoverPath): string {
  switch (path.kind) {
    case "install-folder":
      return path.exists ? formatBytes(path.sizeBytes) : "설치 폴더";
    case "registry":
      return "앱 삭제 흔적";
    case "registered-app-registry":
      return "기본 앱 목록";
    case "app-capabilities-registry":
      return "기본 앱 기능";
    case "environment-path-registry":
      return "PATH 경로";
    case "environment-variable-registry":
      return "환경 설정 흔적";
    case "firewall-rule-registry":
      return "방화벽 규칙";
    case "app-path-registry":
      return "앱 실행 경로";
    case "open-with-registry":
      return "앱 연결 흔적";
    case "file-association-registry":
      return "파일 형식 연결";
    case "protocol-handler-registry":
      return "프로토콜 연결";
    case "native-messaging-host-registry":
      return "브라우저 연결 도우미";
    case "com-local-server-registry":
      return "앱 실행 연결";
    case "com-inproc-server-registry":
      return "앱 확장 연결";
    case "com-app-id-registry":
      return "앱 실행 연결 정보";
    case "service-registry":
      return "서비스";
    case "context-menu-registry":
      return "우클릭 메뉴";
    case "shell-extension-registry":
      return "우클릭 확장";
    case "explorer-extension-registry":
      return "탐색기 확장 연결";
    case "startup-folder":
      return "시작 항목";
    case "startup-registry":
      return "시작 항목";
    case "startup-entry":
      if (path.startupEntryKind === "service") return "서비스";
      if (path.startupEntryKind === "scheduled-task") return "예약 작업";
      return "시작 흔적";
    case "pinned-shortcut":
      return "고정 바로가기";
    case "shortcut":
    case "shortcut-folder":
      return "바로가기";
    case "folder":
    default:
      return path.exists ? formatBytes(path.sizeBytes) : "없음";
  }
}

function leftoverDisplayPath(path: AppLeftoverPath): string {
  if (
    path.kind === "startup-registry" ||
    path.kind === "environment-path-registry" ||
    path.kind === "environment-variable-registry" ||
    path.kind === "firewall-rule-registry"
  ) {
    const valueName = path.registryValueName?.trim();
    const suffix =
        path.kind === "environment-path-registry" && path.environmentPathSegment
          ? `: ${path.environmentPathSegment}`
          : "";
    return valueName ? `${path.path}\\${valueName}${suffix}` : path.path;
  }
  if (path.kind === "service-registry") {
    const serviceName = path.serviceName?.trim();
    return serviceName ? `서비스: ${serviceName}` : "서비스";
  }
  return path.path;
}

function isRestoreBinLeftover(path: AppLeftoverPath): boolean {
  return (
    path.kind === "folder" ||
    path.kind === "install-folder" ||
    path.kind === "shortcut" ||
    path.kind === "pinned-shortcut" ||
    path.kind === "shortcut-folder" ||
    path.kind === "startup-folder"
  );
}

function isAppTraceLeftover(path: AppLeftoverPath): boolean {
  return (
    path.kind === "registry" ||
    path.kind === "registered-app-registry" ||
    path.kind === "app-capabilities-registry" ||
    path.kind === "app-path-registry" ||
    path.kind === "open-with-registry" ||
    path.kind === "file-association-registry" ||
    path.kind === "protocol-handler-registry" ||
    path.kind === "native-messaging-host-registry" ||
    path.kind === "com-local-server-registry" ||
    path.kind === "com-inproc-server-registry" ||
    path.kind === "com-app-id-registry" ||
    path.kind === "context-menu-registry" ||
    path.kind === "shell-extension-registry" ||
    path.kind === "explorer-extension-registry"
  );
}

function isWindowsTraceLeftover(path: AppLeftoverPath): boolean {
  return (
    path.kind === "environment-path-registry" ||
    path.kind === "environment-variable-registry" ||
    path.kind === "firewall-rule-registry" ||
    path.kind === "service-registry" ||
    path.kind === "startup-registry" ||
    path.kind === "startup-entry"
  );
}

function compactCount(label: string, count: number): string | null {
  return count > 0 ? `${label} ${count}개` : null;
}

function leftoverFamilySummary(paths: AppLeftoverPath[]): string {
  const counts = [
    compactCount("복구함 보관", paths.filter(isRestoreBinLeftover).length),
    compactCount("앱 연결 흔적", paths.filter(isAppTraceLeftover).length),
    compactCount("Windows 연결 흔적", paths.filter(isWindowsTraceLeftover).length),
    compactCount("수동 확인", paths.filter(leftoverPathNeedsManualCheck).length)
  ].filter((value): value is string => Boolean(value));
  return counts.length > 0 ? counts.join(" · ") : "확인할 잔여 항목 없음";
}

function manualLeftoverReviewHint(path: AppLeftoverPath): string | null {
  if (!leftoverPathNeedsManualCheck(path)) return null;
  if (path.startupEntryKind === "service") {
    return "서비스 이름을 안전하게 확인하지 못해서 바로 지우지 않아요. 시작 항목 화면에서 이름을 다시 확인해주세요.";
  }
  if (path.startupEntryKind === "scheduled-task") {
    return "예약 작업은 업데이트·동기화 조건이 섞여 있어 앱에서 바로 지우지 않아요. 시작 항목 화면에서 이름을 다시 확인해주세요.";
  }
  return "시작 항목 화면에서 한 번 더 확인해주세요. 안전하게 확인되지 않은 흔적은 앱에서 바로 지우지 않아요.";
}

function selectedLeftoverPaths(
  snapshot: AppLeftoversSnapshot,
  selectedPathIds: string[]
): AppLeftoverPath[] {
  const selected = new Set(selectedPathIds);
  return snapshot.groups.flatMap((group) => group.paths).filter((path) => selected.has(path.id));
}

function buildLeftoverCleanupConfirm(
  snapshot: AppLeftoversSnapshot,
  selectedPathIds: string[]
): LeftoverCleanupConfirm {
  const paths = selectedLeftoverPaths(snapshot, selectedPathIds);

  return {
    planId: snapshot.planId,
    confirmationToken: snapshot.confirmationToken,
    selectedPathIds,
    selectedBytes: paths.reduce((sum, path) => sum + Math.max(0, Math.round(path.sizeBytes ?? 0)), 0),
    folderCount: paths.filter((path) => path.kind === "folder" || path.kind === "install-folder").length,
    shortcutCount: paths.filter((path) => path.kind === "shortcut" || path.kind === "pinned-shortcut" || path.kind === "shortcut-folder").length,
    restoreBinCount: paths.filter(isRestoreBinLeftover).length,
    appTraceBackupCount: paths.filter(isAppTraceLeftover).length,
    windowsTraceBackupCount: paths.filter(isWindowsTraceLeftover).length,
    backupCount: paths.filter((path) => isAppTraceLeftover(path) || isWindowsTraceLeftover(path)).length,
    startupHoldCount: paths.filter((path) => path.kind === "startup-folder").length,
    serviceCount: paths.filter(
      (path) =>
        path.kind === "service-registry" ||
        (path.kind === "startup-entry" && path.startupEntryKind === "service")
    ).length,
    scheduledTaskCount: paths.filter(
      (path) => path.kind === "startup-entry" && path.startupEntryKind === "scheduled-task"
    ).length
  };
}

function uninstallStatusDetailLabel(result: AppUninstallResult): string {
  const detail = result.detail?.toLowerCase() ?? "";

  if (result.status === "launched") return "제거 창을 안전하게 열었어요";
  if (detail.includes("unsafe-uninstall-command")) return "제거 명령을 안전하게 확인하지 못했어요";
  if (detail.includes("quiet-uninstall-blocked")) return "조용히 지우는 명령은 실행하지 않아요";
  if (detail.includes("systemcomponent=true")) return "Windows 구성요소라 자동으로 실행하지 않아요";
  if (result.status === "spawn-failed") return "Windows 제거 창을 열지 못했어요";
  if (result.status === "blocked") return "안전 확인이 필요해 멈췄어요";
  if (result.status === "app-not-found") return "최근 앱 목록에서 찾지 못했어요";
  if (result.status === "no-scan-cache") return "최근 점검 결과가 필요해요";

  return detail ? "상세 확인이 필요해요" : "";
}

function followupInstallStateLabel(app: AppUninstallFollowUpItem): string {
  if (app.stillInstalledReason === "shared-leftover-family") {
    return "같은 제품군 앱이 남아 있어요";
  }
  if (app.stillInstalled) return "아직 앱 목록에 있어요";
  return "현재 앱 목록에서는 안 보여요";
}

interface LeftoverState {
  loading: boolean;
  snapshot?: AppLeftoversSnapshot;
  error?: string;
}

function AppRow({
  item,
  busy,
  lastStatus,
  onUninstall,
  onCheckLeftovers,
  onVerifyUninstall
}: {
  item: AppManagerItem;
  busy: boolean;
  lastStatus?: AppUninstallResult;
  onUninstall: (item: AppManagerItem) => void;
  onCheckLeftovers: () => void;
  onVerifyUninstall: () => void;
}) {
  const badge = availabilityBadge(item);
  const meta = [item.publisher, item.version].filter(Boolean).join(" · ");
  const installInfo = [
    formatInstallDate(item.installDate),
    formatBytes(item.estimatedSizeBytes)
  ]
    .filter((s) => s && s !== "—")
    .join(" · ");
  const lastStatusDetail = lastStatus ? uninstallStatusDetailLabel(lastStatus) : "";

  return (
    <li
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "10px 0",
        borderTop: "1px solid rgba(0,0,0,0.06)"
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <small style={{ opacity: 0.7, display: "block" }}>{meta || "제조사 정보 없음"}</small>
        {installInfo && (
          <small style={{ opacity: 0.55, display: "block" }}>{installInfo}</small>
        )}
        {item.installLocation && (
          <small style={{ opacity: 0.55, display: "block", fontFamily: "monospace" }}>
            {item.installLocation}
          </small>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.75 }}>
          {item.availabilityNote}
        </p>
        {lastStatus && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: lastStatus.status === "launched" ? "#0a7b53" : "#a36400"
            }}
          >
            {lastStatus.message}
            {lastStatusDetail ? ` (${lastStatusDetail})` : ""}
          </p>
        )}
        {lastStatus?.status === "launched" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={onCheckLeftovers}>
              잔여 항목 확인
            </Button>
            <Button variant="primary" size="sm" onClick={onVerifyUninstall}>
              제거 확인하기
            </Button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background:
              badge.tone === "ready"
                ? "rgba(20, 130, 200, 0.12)"
                : badge.tone === "warning"
                  ? "rgba(180, 100, 0, 0.12)"
                  : "rgba(0,0,0,0.06)"
          }}
        >
          {badge.label}
        </span>
        <Button
          variant={item.uninstallAvailability === "ready" ? "primary" : "ghost"}
          size="sm"
          onClick={() => onUninstall(item)}
          disabled={busy || item.uninstallAvailability !== "ready"}
        >
          {busy ? "실행 중…" : "Windows 제거 띄우기"}
        </Button>
      </div>
    </li>
  );
}

function AppLeftoverConfirmDialog({
  confirm,
  busy,
  onCancel,
  onConfirm
}: {
  confirm: LeftoverCleanupConfirm;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedCount = confirm.selectedPathIds.length;
  const hasSizedItems = confirm.selectedBytes > 0;
  const restorePlan = appLeftoverConfirmRestorePlan(confirm);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-leftover-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: 16
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          borderRadius: 12,
          background: "var(--color-fb-bg-elev)",
          color: "var(--color-fb-ink-1)",
          boxShadow: "var(--fb-shadow-3)",
          padding: 24
        }}
      >
        <h2 id="app-leftover-confirm-title" style={{ marginTop: 0 }}>
          선택한 앱 잔여 항목을 정리할까요?
        </h2>
        <p>
          선택한 <strong>{selectedCount}개</strong> 항목을 정리해요.{" "}
          {hasSizedItems ? (
            <>
              예상 <strong>{formatBytes(confirm.selectedBytes)}</strong>을 비울 수 있어요.
            </>
          ) : (
            <>앱 삭제 흔적처럼 용량 변화가 거의 없는 항목도 포함돼요.</>
          )}
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          먼저 챙겨두고 정리해요. 폴더와 바로가기는 복구함에 보관하고, 앱 연결 흔적과 Windows 연결 흔적은 백업해 30일 동안 되돌릴 수 있어요. 보호 경로나 점검 후 바뀐 항목은 자동으로 건드리지 않아요.
        </p>
        <div
          style={{
            border: "1px solid rgba(39,196,154,0.22)",
            borderRadius: 10,
            background: "rgba(39,196,154,0.08)",
            padding: 12,
            marginBottom: 12
          }}
        >
          <strong style={{ display: "block", fontSize: 13, marginBottom: 6 }}>30일 보관 계획</strong>
          {restorePlan.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {restorePlan.map((row) => (
                <div key={row.label} style={{ fontSize: 12, lineHeight: "18px" }}>
                  <strong>{row.label} {row.count}개</strong>
                  <div style={{ opacity: 0.72 }}>{row.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <small style={{ opacity: 0.72 }}>
              보관할 항목이 없으면 정리 전 한 번 더 알려드려요.
            </small>
          )}
        </div>
        <ul style={{ fontSize: 12, opacity: 0.75, margin: "0 0 16px", paddingLeft: 18 }}>
          {confirm.restoreBinCount > 0 && (
            <li>복구함 보관 {confirm.restoreBinCount}개: 폴더·바로가기·시작 항목을 30일 동안 챙겨요.</li>
          )}
          {confirm.appTraceBackupCount > 0 && (
            <li>앱 연결 흔적 {confirm.appTraceBackupCount}개: 기본 앱·파일 형식·프로토콜·브라우저 도우미·우클릭 메뉴를 백업해요.</li>
          )}
          {confirm.windowsTraceBackupCount > 0 && (
            <li>Windows 연결 흔적 {confirm.windowsTraceBackupCount}개: 서비스·예약 작업·방화벽·PATH·환경 설정을 백업해요.</li>
          )}
          <li>전체 백업 {confirm.backupCount}개는 30일 동안 되돌릴 수 있어요.</li>
        </ul>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? "정리하는 중…" : "30일 복구함으로 정리"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UninstallConfirmDialog({
  item,
  busy,
  onCancel,
  onConfirm
}: {
  item: UninstallConfirm;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-uninstall-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: 16
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          borderRadius: 12,
          background: "var(--color-fb-bg-elev)",
          color: "var(--color-fb-ink-1)",
          boxShadow: "var(--fb-shadow-3)",
          padding: 24
        }}
      >
        <h2 id="app-uninstall-confirm-title" style={{ marginTop: 0 }}>
          Windows 제거 창을 열까요?
        </h2>
        <p>
          <strong>{item.name}</strong>
          {item.publisher ? ` · ${item.publisher}` : ""} 제거 창을 열어드릴게요.
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          실제 삭제 여부는 Windows 제거 창에서 직접 한 번 더 선택해요. 제거가 끝나면 포맷버디가
          남은 폴더와 앱 삭제 흔적을 다시 확인해드릴게요.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            marginTop: 16
          }}
        >
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? "여는 중…" : "Windows 제거 창 열기"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeftoverCleanupResultBody({
  result,
  restorableCount,
  beforeSummary,
  afterSnapshot,
  onRescan,
  onQuickRescan,
  onRestoreRecent,
  restoreRecentBusy,
  restoreRecentMessage,
  onOpenTrashRestore,
  onOpenAuditLog
}: {
  result: CleanupExecuteResult;
  restorableCount: number;
  beforeSummary?: LeftoverEffectSummary;
  afterSnapshot?: AppLeftoversSnapshot;
  onRescan: () => void;
  onQuickRescan?: () => void;
  onRestoreRecent: (result: CleanupExecuteResult) => void;
  restoreRecentBusy: boolean;
  restoreRecentMessage?: string;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
}) {
  const failedRemovedCount = result.removedItems.filter((item) => !item.succeeded).length;
  const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length;
  const needsCheckCount = failedRemovedCount + skippedCount;
  const resultLines = appLeftoverResultLines(result);
  const restoreBreakdown = appLeftoverRestoreBinBreakdown(result);
  const skippedPreviewLines = appLeftoverSkippedPreviewLines(result);
  const effectLines = appLeftoverEffectLines({ beforeSummary, afterSnapshot });
  const actions = appLeftoverResultActions({ result, restorableCount, restoreRecentBusy });
  const runAction = (id: (typeof actions)[number]["id"]): void => {
    switch (id) {
      case "rescan":
        (onQuickRescan ?? onRescan)();
        return;
      case "trashRestore":
        onOpenTrashRestore();
        return;
      case "restoreRecent":
        onRestoreRecent(result);
        return;
      case "auditLog":
        onOpenAuditLog();
        return;
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 13, opacity: 0.82, margin: "0 0 8px" }}>
        {appLeftoverResultHeadline(result)}
      </p>
      {needsCheckCount > 0 && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 8px" }}>
          확인 필요한 항목 {needsCheckCount}개는 건드리지 않았어요.
        </p>
      )}
      {restoreBreakdown.length > 0 && (
        <div
          style={{
            border: "1px solid rgba(39,196,154,0.18)",
            borderRadius: 10,
            background: "rgba(39,196,154,0.07)",
            padding: 10,
            margin: "0 0 8px"
          }}
        >
          <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>30일 보관 요약</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {restoreBreakdown.map((row) => (
              <span
                key={row.label}
                title={row.detail}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 26,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.78)",
                  padding: "0 10px",
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                {row.label} {row.count}개
              </span>
            ))}
          </div>
        </div>
      )}
      {effectLines.length > 0 && (
        <div
          style={{
            border: "1px solid rgba(34,118,255,0.18)",
            borderRadius: 10,
            background: "rgba(34,118,255,0.06)",
            padding: 10,
            margin: "0 0 8px"
          }}
        >
          <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
            정리 전후 비교
          </strong>
          <ul style={{ fontSize: 12, opacity: 0.78, margin: 0, paddingLeft: 18 }}>
            {effectLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {skippedPreviewLines.length > 0 && (
        <div style={{ margin: "0 0 8px" }}>
          <strong style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            그대로 둔 이유
          </strong>
          <ul style={{ fontSize: 12, opacity: 0.78, margin: 0, paddingLeft: 18 }}>
            {skippedPreviewLines.map((line) => (
              <li key={`${line.path}:${line.message}`}>
                <code style={{ wordBreak: "break-all" }}>{line.path}</code>
                <span> · {line.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {resultLines.length > 0 && (
        <ul style={{ fontSize: 12, opacity: 0.78, margin: "0 0 8px", paddingLeft: 18 }}>
          {resultLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {result.logPersistenceWarning && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 8px" }}>
          {CLEANUP_HISTORY_SAVE_WARNING}
        </p>
      )}
      {result.followupPersistenceWarning && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 8px" }}>
          {CLEANUP_FOLLOWUP_SAVE_WARNING}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant}
            size="sm"
            onClick={() => runAction(action.id)}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {restoreRecentMessage && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: "8px 0 0" }}>
          {restoreRecentMessage}
        </p>
      )}
    </div>
  );
}

function LeftoverPanel({
  state,
  selected,
  busy,
  result,
  beforeSummary,
  onToggle,
  onSelectAllSelectable,
  onClearSelection,
  onCleanup,
  onRescan,
  onQuickRescan,
  onRestoreRecent,
  restoreRecentBusy,
  restoreRecentMessage,
  onOpenTrashRestore,
  onOpenAuditLog,
  onOpenStartupAuto
}: {
  state: LeftoverState;
  selected: Set<string>;
  busy: boolean;
  result?: CleanupExecuteResult;
  beforeSummary?: LeftoverEffectSummary;
  onToggle: (pathId: string, checked: boolean) => void;
  onSelectAllSelectable: () => void;
  onClearSelection: () => void;
  onCleanup: () => void;
  onRescan: () => void;
  onQuickRescan?: () => void;
  onRestoreRecent: (result: CleanupExecuteResult) => void;
  restoreRecentBusy: boolean;
  restoreRecentMessage?: string;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
  onOpenStartupAuto: () => void;
}) {
  const panelDecision = appLeftoverPanelDecision({
    loading: state.loading,
    hasSnapshot: Boolean(state.snapshot),
    hasResult: Boolean(result),
    error: state.error
  });

  if (panelDecision.mode === "loading-empty") {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>{panelDecision.statusMessage}</p>
      </article>
    );
  }
  if (panelDecision.mode === "error-empty") {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>{panelDecision.statusMessage}</p>
      </article>
    );
  }
  if (panelDecision.mode === "result-only" && result) {
    const restorableCount = appLeftoverRestorableCount(result);
    return (
      <section style={{ marginTop: 16 }}>
        <h2 className="fb-h2">{panelDecision.heading}</h2>
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          {panelDecision.intro}
        </p>
        {panelDecision.statusMessage && (
          <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0 }}>
              {panelDecision.statusMessage}
            </p>
          </article>
        )}
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <LeftoverCleanupResultBody
            result={result}
            restorableCount={restorableCount}
            beforeSummary={beforeSummary}
            afterSnapshot={state.snapshot}
            onRescan={onRescan}
            onQuickRescan={onQuickRescan}
            onRestoreRecent={onRestoreRecent}
            restoreRecentBusy={restoreRecentBusy}
            restoreRecentMessage={restoreRecentMessage}
            onOpenTrashRestore={onOpenTrashRestore}
            onOpenAuditLog={onOpenAuditLog}
          />
        </article>
      </section>
    );
  }
  if (panelDecision.mode === "hidden" || !state.snapshot) return null;
  const restorableCount = result ? appLeftoverRestorableCount(result) : 0;
  const leftoverSummary = summarizeLeftoverSnapshot(state.snapshot);
  const selectableIds = selectableLeftoverPathIds(state.snapshot);
  const selectedValidCount = Array.from(selected).filter((id) => selectableIds.has(id)).length;
  return (
    <section style={{ marginTop: 16 }}>
      <h2 className="fb-h2">앱별 잔여 후보</h2>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        앱 제거 뒤 남는 후보를 복구함 보관, 앱 연결 흔적, Windows 연결 흔적으로 나눠 보여드려요.
        직접 고른 항목만 정리하고 30일 동안 되돌릴 수 있게 챙겨둬요.
      </p>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        총 {leftoverSummary.total}개 후보 중 {leftoverSummary.selectable}개를 선택할 수 있어요.
        아직 설치된 앱 데이터 {leftoverSummary.installedLocked}개, 보호 경로 {leftoverSummary.protected}개,
        서비스·예약 작업 같은 수동 확인 흔적 {leftoverSummary.manualCheck}개, 제거 확인 전 {leftoverSummary.notChecked}개,
        지금 없는 항목 {leftoverSummary.missing}개는 자동으로 빠져요.
      </p>
      {panelDecision.statusMessage && !result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            {panelDecision.statusMessage}
          </p>
        </article>
      )}
      {panelDecision.statusMessage && result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            {panelDecision.statusMessage}
          </p>
        </article>
      )}
      <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <strong>선택한 잔여 항목</strong>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {selectedValidCount}개 · 보호됨/없는 항목은 선택할 수 없어요.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSelectAllSelectable}
              disabled={busy || selectableIds.size === 0}
            >
              정리 가능 항목 전체 선택
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={busy || selected.size === 0}
            >
              선택 해제
            </Button>
            {leftoverSummary.manualCheck > 0 && (
              <Button variant="ghost" size="sm" onClick={onOpenStartupAuto} disabled={busy}>
                시작 항목에서 확인
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onCleanup}
              disabled={busy || selectedValidCount === 0}
            >
              {busy ? "정리하는 중…" : "선택 항목 정리하기"}
            </Button>
          </div>
        </header>
        {result && (
          <LeftoverCleanupResultBody
            result={result}
            restorableCount={restorableCount}
            beforeSummary={beforeSummary}
            afterSnapshot={state.snapshot}
            onRescan={onRescan}
            onQuickRescan={onQuickRescan}
            onRestoreRecent={onRestoreRecent}
            restoreRecentBusy={restoreRecentBusy}
            restoreRecentMessage={restoreRecentMessage}
            onOpenTrashRestore={onOpenTrashRestore}
            onOpenAuditLog={onOpenAuditLog}
          />
        )}
      </article>
      {state.snapshot.groups.length === 0 ? (
        <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
          <p>정리 후 남은 잔여 항목 후보가 없어요.</p>
        </article>
      ) : (
        state.snapshot.groups.map((group) => (
          <LeftoverGroupCard
            key={group.appName}
            group={group}
            selected={selected}
            onToggle={onToggle}
          />
        ))
      )}
    </section>
  );
}

function LeftoverGroupCard({
  group,
  selected,
  onToggle
}: {
  group: AppLeftoverGroup;
  selected: Set<string>;
  onToggle: (pathId: string, checked: boolean) => void;
}) {
  const cleanupAllowed = canCleanupLeftoverGroup(group);
  const followUpLabel =
    group.source === "uninstall-launched"
      ? group.cleanupState === "removed-confirmed"
        ? "제거 완료 확인됨"
        : group.cleanupState === "still-installed"
          ? "아직 앱 목록에 있어요"
          : "다시 점검 후 정리 가능"
      : "";
  const groupMeta = [
    group.publisher,
    group.source === "uninstall-launched" ? followUpLabel : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const lockCopy =
    group.source !== "uninstall-launched"
      ? "아직 설치된 앱 데이터라 미리보기만 해요. Windows 제거 후 다시 확인하면 선택할 수 있어요."
      : group.cleanupState === "still-installed"
        ? "아직 앱 목록에 있어요. 제거를 끝냈다면 다시 점검 후 정리할 수 있어요."
        : "제거 완료 여부 확인 전이라 미리보기만 해요. 다시 점검 후 정리할 수 있어요.";

  return (
    <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
      <header>
        <h3 style={{ margin: 0 }}>{group.appName}</h3>
        {groupMeta && <small style={{ opacity: 0.7 }}>{groupMeta}</small>}
        <small style={{ opacity: 0.7, display: "block" }}>
          {leftoverFamilySummary(group.paths)}
        </small>
        {!cleanupAllowed && (
          <small style={{ opacity: 0.7, display: "block" }}>
            {lockCopy}
          </small>
        )}
      </header>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
        {group.paths.map((path) => {
          const manualHint = manualLeftoverReviewHint(path);
          return (
            <li
              key={path.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                flexWrap: "wrap",
                padding: "6px 0",
                borderTop: "1px solid rgba(0,0,0,0.05)"
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(path.id)}
                disabled={!cleanupAllowed || !path.exists || Boolean(path.protectedBy)}
                onChange={(e) => onToggle(path.id, e.target.checked)}
                aria-label={`${leftoverDisplayPath(path)} 선택`}
              />
              <code style={{ fontSize: 12, flex: 1, wordBreak: "break-all" }}>
                {leftoverDisplayPath(path)}
              </code>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {leftoverKindLabel(path)}
              </span>
              {path.protectedBy && (
                <span
                  title={path.protectedBy}
                  style={{ fontSize: 11, color: "#a36400" }}
                >
                  {leftoverPathNeedsManualCheck(path) ? "수동 확인" : "보호됨"}
                </span>
              )}
              {manualHint && (
                <small style={{ flexBasis: "100%", marginLeft: 24, opacity: 0.72 }}>
                  {manualHint}
                </small>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function AppManager({
  isWindows,
  onBack,
  onOpenCleanup,
  onRescan,
  onQuickRescan,
  onVerifyUninstall,
  onOpenTrashRestore,
  onOpenAuditLog,
  onOpenStartupAuto,
  autoOpenLeftovers,
  notice
}: AppManagerProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [leftovers, setLeftovers] = useState<LeftoverState>({ loading: false });
  const [selectedLeftovers, setSelectedLeftovers] = useState<Set<string>>(new Set());
  const [leftoverCleanupConfirm, setLeftoverCleanupConfirm] = useState<LeftoverCleanupConfirm | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupExecuteResult | undefined>();
  const [cleanupBeforeSummary, setCleanupBeforeSummary] = useState<LeftoverEffectSummary | undefined>();
  const [recentRestoreBusy, setRecentRestoreBusy] = useState(false);
  const [recentRestoreMessage, setRecentRestoreMessage] = useState<string | undefined>();
  const [activeUninstall, setActiveUninstall] = useState<string | null>(null);
  const [uninstallConfirm, setUninstallConfirm] = useState<UninstallConfirm | null>(null);
  const [postUninstallAppName, setPostUninstallAppName] = useState<string | null>(null);
  const [uninstallStatuses, setUninstallStatuses] = useState<Record<string, AppUninstallResult>>(
    {}
  );
  const autoOpenedLeftoversRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!window.fb?.listApps) {
      setLoad({ kind: "error", message: "앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요." });
      return;
    }
    setLoad({ kind: "loading" });
    try {
      const snapshot = await window.fb.listApps();
      if (snapshot.total === 0 && snapshot.recentlyUninstallLaunched.length === 0) {
        setLoad({ kind: "empty" });
      } else {
        setLoad({ kind: "ready", snapshot });
      }
    } catch (err) {
      setLoad({ kind: "error", message: friendlyErrorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadLeftovers = useCallback(async () => {
    if (!window.fb?.listAppLeftovers) {
      setLeftovers((prev) => ({
        ...prev,
        loading: false,
        error: "잔여 항목 확인을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      }));
      return;
    }
    setLeftovers((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const snapshot = await window.fb.listAppLeftovers();
      setLeftovers({ loading: false, snapshot });
      setSelectedLeftovers(new Set());
      setLeftoverCleanupConfirm(null);
    } catch (err) {
      setLeftovers((prev) => ({ ...prev, loading: false, error: friendlyErrorMessage(err) }));
    }
  }, []);

  useEffect(() => {
    if (!autoOpenLeftovers || autoOpenedLeftoversRef.current) return;
    autoOpenedLeftoversRef.current = true;
    void loadLeftovers();
  }, [autoOpenLeftovers, loadLeftovers]);

  const toggleLeftover = useCallback((pathId: string, checked: boolean) => {
    setSelectedLeftovers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pathId);
      else next.delete(pathId);
      return next;
    });
  }, []);

  const selectAllSelectableLeftovers = useCallback(() => {
    const snapshot = leftovers.snapshot;
    if (!snapshot) return;
    setSelectedLeftovers(selectableLeftoverPathIds(snapshot));
  }, [leftovers.snapshot]);

  const cleanupSelectedLeftovers = useCallback(async () => {
    if (!window.fb?.cleanupAppLeftovers) {
      setLeftovers((prev) => ({
        ...prev,
        loading: false,
        error: "잔여 항목 정리를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      }));
      return;
    }
    const snapshot = leftovers.snapshot;
    if (!snapshot || selectedLeftovers.size === 0) return;
    const selectableIds = selectableLeftoverPathIds(snapshot);
    const selectedPathIds = Array.from(selectedLeftovers).filter((id) => selectableIds.has(id));
    if (selectedPathIds.length === 0) return;
    setLeftoverCleanupConfirm(buildLeftoverCleanupConfirm(snapshot, selectedPathIds));
  }, [leftovers.snapshot, selectedLeftovers]);

  const runConfirmedLeftoverCleanup = useCallback(async () => {
    if (!leftoverCleanupConfirm) return;
    if (!window.fb?.cleanupAppLeftovers) {
      setLeftoverCleanupConfirm(null);
      setLeftovers((prev) => ({
        ...prev,
        loading: false,
        error: "잔여 항목 정리를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      }));
      return;
    }
    setCleanupBusy(true);
    setRecentRestoreMessage(undefined);
    const snapshot = leftovers.snapshot;
    if (snapshot) setCleanupBeforeSummary(summarizeLeftoverSnapshot(snapshot));
    try {
      const result = await window.fb.cleanupAppLeftovers({
        planId: leftoverCleanupConfirm.planId,
        confirmationToken: leftoverCleanupConfirm.confirmationToken,
        selectedPathIds: leftoverCleanupConfirm.selectedPathIds
      });
      setCleanupResult(result);
      setSelectedLeftovers(new Set());
      setLeftoverCleanupConfirm(null);
      await loadLeftovers();
    } catch (err) {
      setLeftovers((prev) => ({ ...prev, loading: false, error: friendlyErrorMessage(err) }));
      setLeftoverCleanupConfirm(null);
    } finally {
      setCleanupBusy(false);
    }
  }, [leftoverCleanupConfirm, loadLeftovers, leftovers.snapshot]);

  const restoreRecentLeftovers = useCallback(
    async (result: CleanupExecuteResult) => {
      const plan = cleanupRestorePlanFromResult(result);
      if (cleanupRestorePlanCount(plan) === 0) {
        setRecentRestoreMessage(CLEANUP_RECENT_RESTORE_EMPTY_MESSAGE);
        return;
      }
      const restoreCleanupTrash = window.fb?.restoreCleanupTrash;
      const restoreRegistryBackup = window.fb?.restoreRegistryBackup;
      const restoreStartupAuto = window.fb?.restoreStartupAuto;
      const restoreScheduledTaskBackup = window.fb?.restoreScheduledTaskBackup;
      if (
        cleanupRestoreMissingBridge(plan, {
          restoreCleanupTrash: Boolean(restoreCleanupTrash),
          restoreRegistryBackup: Boolean(restoreRegistryBackup),
          restoreStartupAuto: Boolean(restoreStartupAuto),
          restoreScheduledTaskBackup: Boolean(restoreScheduledTaskBackup)
        })
      ) {
        setRecentRestoreMessage(CLEANUP_RECENT_RESTORE_MISSING_BRIDGE_MESSAGE);
        return;
      }

      setRecentRestoreBusy(true);
      setRecentRestoreMessage(undefined);
      try {
        const outcome = await runCleanupRestorePlan(plan, {
          restoreCleanupTrash,
          restoreRegistryBackup,
          restoreStartupAuto,
          restoreScheduledTaskBackup
        });
        setRecentRestoreMessage(
          cleanupRestoreSummary(outcome)
        );
        await loadLeftovers();
      } finally {
        setRecentRestoreBusy(false);
      }
    },
    [loadLeftovers]
  );

  const onUninstall = useCallback((item: AppManagerItem) => {
    if (item.uninstallAvailability !== "ready") return;
    setUninstallConfirm(item);
  }, []);

  const runConfirmedUninstall = useCallback(async () => {
    if (!uninstallConfirm) return;
    const item = uninstallConfirm;
    if (!window.fb?.uninstallApp) {
      setUninstallConfirm(null);
      setUninstallStatuses((prev) => ({
        ...prev,
        [item.id]: {
          status: "spawn-failed",
          appName: item.name,
          message: "앱 제거 실행을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
        }
      }));
      return;
    }
    setActiveUninstall(item.id);
    try {
      const result = await window.fb.uninstallApp({
        appName: item.name,
        publisher: item.publisher
      });
      setUninstallStatuses((prev) => ({ ...prev, [item.id]: result }));
      setUninstallConfirm(null);
      if (result.status === "launched") {
        setPostUninstallAppName(item.name);
      }
    } catch (err) {
      setUninstallStatuses((prev) => ({
        ...prev,
        [item.id]: {
          status: "spawn-failed",
          appName: item.name,
          message: friendlyErrorMessage(err)
        }
      }));
      setUninstallConfirm(null);
    } finally {
      setActiveUninstall(null);
    }
  }, [uninstallConfirm]);

  const totalReady = useMemo(() => {
    if (load.kind !== "ready") return 0;
    return load.snapshot.groups
      .flatMap((g) => g.items)
      .filter((i) => i.uninstallAvailability === "ready").length;
  }, [load]);

  return (
    <main className="fb-report" aria-label="앱 정리">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">앱 정리 센터</h1>
        <p className="fb-lede">
          설치된 앱을 카테고리별로 보여드리고, Windows 기본 제거 창을 열어드려요. 잔여 항목은
          직접 고른 것만 정리하고, 앱 삭제 흔적도 30일 안에 되돌릴 수 있게 챙겨요.
        </p>
        {!isWindows && (
          <p style={{ color: "#a36400", fontSize: 13 }}>
            Mac 미리보기에서는 앱 제거를 실행하지 않아요.
          </p>
        )}
      </section>

      {notice && (
        <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{notice}</p>
        </section>
      )}

      <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
        <header
          style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
        >
          <div>
            <h2 style={{ margin: 0 }}>설치된 앱</h2>
            {load.kind === "ready" && (
              <small>
                전체 {load.snapshot.total}개 · Windows 제거 가능 {totalReady}개 · 숨김(시스템){" "}
                {load.snapshot.hiddenSystemCount}개
              </small>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              새로고침
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void loadLeftovers()}>
              잔여 항목 보기
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenCleanup}>
              안전 정리 센터로
            </Button>
          </div>
        </header>
      </section>

      {load.kind === "loading" && (
        <article className="fb-card fb-card-hover">
          <p>앱 목록을 가져오는 중이에요…</p>
        </article>
      )}

      {load.kind === "empty" && (
        <article className="fb-card fb-card-hover">
          <p>최근 진단 결과가 비어 있어요. 먼저 PC 점검을 한 번 돌려주세요.</p>
          <Button variant="primary" onClick={onBack}>
            처음으로
          </Button>
        </article>
      )}

      {load.kind === "error" && (
        <article className="fb-card fb-card-hover">
          <h2>잠시 멈췄어요</h2>
          <p>{load.message}</p>
          <Button variant="primary" onClick={() => void refresh()}>
            다시 시도
          </Button>
        </article>
      )}

      {postUninstallAppName && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
          <header>
            <h2 style={{ margin: 0 }}>{postUninstallAppName} 제거 후도 같이 챙길게요</h2>
          </header>
          <p style={{ fontSize: 13, opacity: 0.78 }}>
            Windows 제거 창을 끝냈다면 먼저 제거 완료를 확인해볼게요. 제거 확인이 끝나면 남은 항목을 바로 보여드려요.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" size="sm" onClick={onVerifyUninstall ?? onRescan}>
              제거 확인하기
            </Button>
            <Button variant="secondary" size="sm" onClick={onRescan}>
              다시 점검
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void loadLeftovers()}>
              잔여 후보 미리보기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPostUninstallAppName(null)}>
              닫기
            </Button>
          </div>
        </article>
      )}

      {load.kind === "ready" && load.snapshot.recentlyUninstallLaunched.length > 0 && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
          <header>
            <h2 style={{ margin: 0 }}>방금 제거를 연 앱</h2>
            <small style={{ opacity: 0.7 }}>
              최근 24시간 안에 Windows 제거 창을 연 앱이에요. 실제 제거 완료 여부는 다시 점검으로 확인해요.
            </small>
          </header>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0" }}>
            {load.snapshot.recentlyUninstallLaunched.map((app) => (
              <li key={`${app.name}|${app.publisher ?? ""}`} style={{ padding: "4px 0" }}>
                <strong>{app.name}</strong>
                {app.publisher && <small style={{ opacity: 0.68 }}> · {app.publisher}</small>}
                <small style={{ opacity: 0.68 }}>
                  {" "}· {followupInstallStateLabel(app)}
                </small>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" size="sm" onClick={() => void loadLeftovers()}>
              잔여 항목 확인
            </Button>
            <Button variant="secondary" size="sm" onClick={onVerifyUninstall ?? onRescan}>
              제거 확인하기
            </Button>
          </div>
        </article>
      )}

      {load.kind === "ready" &&
        load.snapshot.groups.map((group, idx) => (
          <article
            key={group.category}
            className="fb-card fb-anim-slide fb-card-hover"
            style={{ marginBottom: 16, animationDelay: `${Math.min(idx, 6) * 35}ms` }}
          >
            <header
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
            >
              <h3 style={{ margin: 0 }}>{group.label}</h3>
              <small>{group.count}개</small>
            </header>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {group.items.map((item) => (
                <AppRow
                  key={item.id}
                  item={item}
                  busy={activeUninstall === item.id}
                  lastStatus={uninstallStatuses[item.id]}
                  onUninstall={onUninstall}
                  onCheckLeftovers={() => void loadLeftovers()}
                  onVerifyUninstall={onVerifyUninstall ?? onRescan}
                />
              ))}
            </ul>
          </article>
        ))}

      <LeftoverPanel
        state={leftovers}
        selected={selectedLeftovers}
        busy={cleanupBusy}
        result={cleanupResult}
        beforeSummary={cleanupBeforeSummary}
        onToggle={toggleLeftover}
        onSelectAllSelectable={selectAllSelectableLeftovers}
        onClearSelection={() => setSelectedLeftovers(new Set())}
        onCleanup={cleanupSelectedLeftovers}
        onRescan={onRescan}
        onQuickRescan={onQuickRescan}
        onRestoreRecent={(result) => void restoreRecentLeftovers(result)}
        restoreRecentBusy={recentRestoreBusy}
        restoreRecentMessage={recentRestoreMessage}
        onOpenTrashRestore={onOpenTrashRestore}
        onOpenAuditLog={onOpenAuditLog}
        onOpenStartupAuto={onOpenStartupAuto}
      />
      {leftoverCleanupConfirm && (
        <AppLeftoverConfirmDialog
          confirm={leftoverCleanupConfirm}
          busy={cleanupBusy}
          onCancel={() => setLeftoverCleanupConfirm(null)}
          onConfirm={() => void runConfirmedLeftoverCleanup()}
        />
      )}
      {uninstallConfirm && (
        <UninstallConfirmDialog
          item={uninstallConfirm}
          busy={activeUninstall === uninstallConfirm.id}
          onCancel={() => setUninstallConfirm(null)}
          onConfirm={() => void runConfirmedUninstall()}
        />
      )}
    </main>
  );
}
