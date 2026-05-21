import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import {
  canCleanupLeftoverGroup,
  leftoverPathNeedsManualCheck,
  selectableLeftoverPathIds,
  summarizeLeftoverSnapshot
} from "@shared/app-leftovers";
import {
  preservedRegistryBackupIds,
  preservedScheduledTaskBackupIds,
  recoverableRegistryBackupIds,
  recoverableScheduledTaskBackupIds,
  restorableStartupDisabledIds,
  restorableTrashEntryIds,
  summarizeRestoreAllResults
} from "@shared/cleanup-result";
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
  AppUninstallResult,
  CleanupTrashRestoreResult,
  RegistryBackupRestoreResult,
  ScheduledTaskBackupRestoreResult,
  StartupFolderToggleResult
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

type LeftoverCleanupConfirm = {
  planId: string;
  confirmationToken: string;
  selectedPathIds: string[];
  selectedBytes: number;
  folderCount: number;
  shortcutCount: number;
  backupCount: number;
  startupHoldCount: number;
  serviceCount: number;
  scheduledTaskCount: number;
};

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
    case "app-path-registry":
      return "앱 실행 경로";
    case "open-with-registry":
      return "앱 연결 흔적";
    case "context-menu-registry":
      return "우클릭 메뉴";
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
  if (path.kind === "startup-registry") {
    const valueName = path.registryValueName?.trim();
    return valueName ? `${path.path}\\${valueName}` : path.path;
  }
  return path.path;
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

function appLeftoverResultLines(result: CleanupExecuteResult): string[] {
  const fileOrFolderCount = restorableTrashEntryIds(result).length;
  const backupCount = recoverableRegistryBackupIds(result).length;
  const startupCount = restorableStartupDisabledIds(result).length;
  const scheduledTaskCount = recoverableScheduledTaskBackupIds(result).length;
  const untouchedCount =
    result.removedItems.filter((item) => !item.succeeded).length +
    result.skippedItems.filter((item) => item.reason !== "not-selected").length;
  const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length;
  const lines: string[] = [];

  if (fileOrFolderCount > 0) {
    lines.push(`잔여 파일/폴더 ${fileOrFolderCount}개는 복구함에 30일 동안 보관해요.`);
  }
  if (backupCount > 0) {
    lines.push(`앱 삭제 흔적/실행 경로/앱 연결/우클릭 메뉴/서비스/시작 항목 백업 ${backupCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (startupCount > 0) {
    lines.push(`잠시 꺼둔 시작 항목 ${startupCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (scheduledTaskCount > 0) {
    lines.push(`예약 작업 ${scheduledTaskCount}개는 30일 안에 되돌릴 수 있어요.`);
  }
  if (untouchedCount > 0) {
    lines.push(`건드리지 않은 항목 ${untouchedCount}개는 그대로 뒀어요.`);
  }
  if (notSelectedCount > 0) {
    lines.push(`선택하지 않은 후보 ${notSelectedCount}개는 그대로 남겨뒀어요.`);
  }

  return lines;
}

function friendlyAppLeftoverBlockedDetail(detail?: string): string {
  const text = detail?.trim();
  if (!text) return "보호가 필요한 항목이라 그대로 뒀어요.";
  const lower = text.toLowerCase();

  if (/30-day|30일|expiry|만료/.test(lower)) {
    return "30일 보관 기간을 확인하지 못해서 그대로 뒀어요.";
  }
  if (/manifest|복구함 정보/.test(lower)) {
    return "복구함 정보를 확인하지 못해서 그대로 뒀어요.";
  }
  if (/link|symbolic|링크/.test(lower)) {
    return "링크 경로라 안전 확인이 필요해요.";
  }
  if (/access|denied|eacces|eperm|permission|권한/.test(lower)) {
    return "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요.";
  }
  if (/backup|export|reg\.exe|registry|레지스트리/.test(lower)) {
    return "앱 삭제 흔적은 안전하게 확인되지 않아 그대로 뒀어요.";
  }
  const rawInternalDetailPattern = new RegExp(
    ["power\\s?shell", "eno" + "ent", "format" + "buddy", "c:\\\\", "\\/users\\/"].join("|"),
    "i"
  );
  if (rawInternalDetailPattern.test(text)) {
    return "보호가 필요한 항목이라 그대로 뒀어요.";
  }
  if (/startup|holding|hash|integrity|source path|still exists|시작 항목/.test(lower)) {
    return text.includes("시작 항목")
      ? text
      : "시작 항목은 안전하게 보관되지 않아 그대로 뒀어요.";
  }

  return text;
}

function appLeftoverSkippedMessage(
  item: CleanupExecuteResult["skippedItems"][number]
): string {
  switch (item.reason) {
    case "blocked-path":
      return friendlyAppLeftoverBlockedDetail(item.detail);
    case "access-denied":
      return "권한 때문에 자동 정리하지 않았어요. 직접 확인이 필요해요.";
    case "not-found":
      return "이미 없어져서 건드릴 항목이 없었어요.";
    case "below-min-age":
      return "아직 최근 항목이라 이번에는 그대로 뒀어요.";
    case "execute-failed":
      if (item.registryBackupId && item.expiresAt) {
        return "정리 확인을 끝내지 못했지만 백업은 30일 복구함에 남겨뒀어요.";
      }
      return "정리 중 문제가 생겨서 그대로 뒀어요. 다시 점검 후 한 번 더 시도해주세요.";
    case "not-selected":
    default:
      return "선택하지 않아서 그대로 남겨뒀어요.";
  }
}

function appLeftoverSkippedPreviewLines(
  result: CleanupExecuteResult
): { path: string; message: string }[] {
  const skipped = result.skippedItems.filter((item) => item.reason !== "not-selected");
  const preview = skipped.slice(0, 4).map((item) => ({
    path: item.path || "확인 필요한 항목",
    message: appLeftoverSkippedMessage(item)
  }));
  const remaining = skipped.length - preview.length;

  if (remaining > 0) {
    preview.push({
      path: "추가 확인",
      message: `${remaining}개는 활동 기록에서 이어서 볼 수 있어요.`
    });
  }

  return preview;
}

function appLeftoverResultHeadline(result: CleanupExecuteResult): string {
  const cleanedCount = result.removedItems.filter((item) => item.succeeded).length;
  const preservedBackupCount =
    preservedRegistryBackupIds(result).length +
    preservedScheduledTaskBackupIds(result).length;
  const restorableCount =
    restorableTrashEntryIds(result).length +
    recoverableRegistryBackupIds(result).length +
    restorableStartupDisabledIds(result).length +
    recoverableScheduledTaskBackupIds(result).length;

  if (cleanedCount > 0 && restorableCount > 0) {
    return `${cleanedCount}개를 정리했고, ${restorableCount}개는 30일 안에 되돌릴 수 있어요.`;
  }
  if (cleanedCount > 0) return `${cleanedCount}개를 정리했어요.`;
  if (preservedBackupCount > 0) {
    return `정리 확인을 끝내지 못했지만 백업 ${preservedBackupCount}개는 30일 안에 되돌릴 수 있어요.`;
  }
  return "이번 정리에서 처리된 항목은 없어요.";
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
    backupCount: paths.filter(
      (path) =>
        path.kind === "registry" ||
        path.kind === "app-path-registry" ||
        path.kind === "open-with-registry" ||
        path.kind === "context-menu-registry" ||
        (path.kind === "startup-entry" && path.startupEntryKind === "service") ||
        path.kind === "startup-registry"
    ).length,
    startupHoldCount: paths.filter((path) => path.kind === "startup-folder").length,
    serviceCount: paths.filter(
      (path) => path.kind === "startup-entry" && path.startupEntryKind === "service"
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
          폴더·바로가기와 시작 항목, 서비스, 앱 삭제 흔적과 앱 연결, 우클릭 메뉴 흔적은 30일 안에 되돌릴 수 있게 챙겨둘게요. 보호 경로나 점검 후 바뀐 항목은 자동으로 건드리지 않아요.
        </p>
        <ul style={{ fontSize: 12, opacity: 0.75, margin: "0 0 16px", paddingLeft: 18 }}>
          <li>잔여 폴더 {confirm.folderCount}개는 포맷버디 복구함에 보관해요.</li>
          <li>바탕화면·시작 메뉴·작업표시줄 바로가기 {confirm.shortcutCount}개도 30일 동안 되돌릴 수 있어요.</li>
          <li>앱 삭제 흔적/실행 경로/앱 연결/우클릭 메뉴/서비스/시작 항목 백업 {confirm.backupCount}개는 30일 동안 되돌릴 수 있어요.</li>
          <li>시작 항목 {confirm.startupHoldCount}개는 잠시 꺼두고 원복할 수 있게 챙겨요.</li>
          <li>서비스 {confirm.serviceCount}개는 백업하고 지운 뒤 30일 동안 되돌릴 수 있어요.</li>
          <li>예약 작업 {confirm.scheduledTaskCount}개는 백업하고 지운 뒤 30일 동안 되돌릴 수 있어요.</li>
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

function LeftoverPanel({
  state,
  selected,
  busy,
  result,
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
  if (state.loading && !state.snapshot && !result) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 항목 후보를 살펴보는 중이에요…</p>
      </article>
    );
  }
  if (state.error && !state.snapshot && !result) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 항목 확인 중 문제가 생겼어요: {state.error}</p>
      </article>
    );
  }
  if (!state.snapshot) return null;
  const restorableCount = result
    ? restorableTrashEntryIds(result).length +
      recoverableRegistryBackupIds(result).length +
      restorableStartupDisabledIds(result).length
    : 0;
  const failedRemovedCount = result
    ? result.removedItems.filter((item) => !item.succeeded).length
    : 0;
  const skippedCount = result
    ? result.skippedItems.filter((item) => item.reason !== "not-selected").length
    : 0;
  const needsCheckCount = failedRemovedCount + skippedCount;
  const resultLines = result ? appLeftoverResultLines(result) : [];
  const skippedPreviewLines = result ? appLeftoverSkippedPreviewLines(result) : [];
  const leftoverSummary = summarizeLeftoverSnapshot(state.snapshot);
  const selectableIds = selectableLeftoverPathIds(state.snapshot);
  const selectedValidCount = Array.from(selected).filter((id) => selectableIds.has(id)).length;
  return (
    <section style={{ marginTop: 16 }}>
      <h2 className="fb-h2">앱별 잔여 후보</h2>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Windows가 앱을 제거해도 남는 경우가 있는 숨은 앱 데이터 폴더, 바탕화면·시작 메뉴·작업표시줄 바로가기,
        앱 삭제 흔적 후보예요. 직접 고른 항목만 정리하고, 폴더와 바로가기, 시작 항목은 복구함에 30일 동안 보관해요. 앱 삭제 흔적도
        30일 동안 되돌릴 수 있게 백업해요.
      </p>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        총 {leftoverSummary.total}개 후보 중 {leftoverSummary.selectable}개를 선택할 수 있어요.
        아직 설치된 앱 데이터 {leftoverSummary.installedLocked}개, 보호 경로 {leftoverSummary.protected}개,
        서비스·예약 작업 같은 수동 확인 흔적 {leftoverSummary.manualCheck}개, 제거 확인 전 {leftoverSummary.notChecked}개,
        지금 없는 항목 {leftoverSummary.missing}개는 자동으로 빠져요.
      </p>
      {state.loading && !result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            잔여 항목을 다시 확인하는 중이에요. 기존 후보는 그대로 남겨둘게요.
          </p>
        </article>
      )}
      {state.error && !result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            잔여 항목을 다시 불러오진 못했지만, 기존 후보는 남겨둘게요. {state.error}
          </p>
        </article>
      )}
      {state.loading && result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>잔여 항목을 다시 확인하는 중이에요. 방금 정리 결과는 그대로 남겨둘게요.</p>
        </article>
      )}
      {state.error && result && (
        <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>
            잔여 항목을 다시 불러오진 못했지만, 방금 정리 결과는 남겨둘게요. {state.error}
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
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, opacity: 0.82, margin: "0 0 8px" }}>
              {appLeftoverResultHeadline(result)}
            </p>
            {needsCheckCount > 0 && (
              <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 8px" }}>
                확인 필요한 항목 {needsCheckCount}개는 건드리지 않았어요.
              </p>
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
              <Button variant="primary" size="sm" onClick={onQuickRescan ?? onRescan}>
                다시 점검해서 효과 보기
              </Button>
              {result.mode === "trash" && restorableCount > 0 && (
                <Button variant="secondary" size="sm" onClick={onOpenTrashRestore}>
                  복구함 보기
                </Button>
              )}
              {restorableCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestoreRecent(result)}
                  disabled={restoreRecentBusy}
                >
                  {restoreRecentBusy ? "되돌리는 중…" : "방금 정리 되돌리기"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onOpenAuditLog}>
                활동 기록 보기
              </Button>
            </div>
            {restoreRecentMessage && (
              <p style={{ fontSize: 12, opacity: 0.75, margin: "8px 0 0" }}>
                {restoreRecentMessage}
              </p>
            )}
          </div>
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
  }, [leftoverCleanupConfirm, loadLeftovers]);

  const restoreRecentLeftovers = useCallback(
    async (result: CleanupExecuteResult) => {
      const entryIds = restorableTrashEntryIds(result);
      const registryBackupIds = recoverableRegistryBackupIds(result);
      const startupDisabledIds = restorableStartupDisabledIds(result);
      const scheduledTaskBackupIds = recoverableScheduledTaskBackupIds(result);
      if (
        entryIds.length === 0 &&
        registryBackupIds.length === 0 &&
        startupDisabledIds.length === 0 &&
        scheduledTaskBackupIds.length === 0
      ) {
        setRecentRestoreMessage("이 정리에서 바로 되돌릴 항목이 없어요.");
        return;
      }
      const missingRestoreBridge =
        (entryIds.length > 0 && !window.fb?.restoreCleanupTrash) ||
        (registryBackupIds.length > 0 && !window.fb?.restoreRegistryBackup) ||
        (startupDisabledIds.length > 0 && !window.fb?.restoreStartupAuto) ||
        (scheduledTaskBackupIds.length > 0 && !window.fb?.restoreScheduledTaskBackup);
      if (missingRestoreBridge) {
        setRecentRestoreMessage(
          "방금 정리 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 복구함이나 활동 기록에서 확인해주세요."
        );
        return;
      }

      setRecentRestoreBusy(true);
      setRecentRestoreMessage(undefined);
      try {
        const results: CleanupTrashRestoreResult[] = [];
        const registryResults: RegistryBackupRestoreResult[] = [];
        const startupResults: StartupFolderToggleResult[] = [];
        const scheduledTaskResults: ScheduledTaskBackupRestoreResult[] = [];
        let restoreFailureCount = 0;
        for (const entryId of entryIds) {
          try {
            results.push(await window.fb.restoreCleanupTrash({ entryId }));
          } catch {
            restoreFailureCount += 1;
          }
        }
        for (const backupId of registryBackupIds) {
          try {
            registryResults.push(await window.fb.restoreRegistryBackup({ backupId }));
          } catch {
            restoreFailureCount += 1;
          }
        }
        for (const disabledId of startupDisabledIds) {
          try {
            if (window.fb?.restoreStartupAuto) {
              startupResults.push(await window.fb.restoreStartupAuto({ disabledId }));
            }
          } catch {
            restoreFailureCount += 1;
          }
        }
        for (const backupId of scheduledTaskBackupIds) {
          try {
            if (window.fb?.restoreScheduledTaskBackup) {
              scheduledTaskResults.push(await window.fb.restoreScheduledTaskBackup({ backupId }));
            }
          } catch {
            restoreFailureCount += 1;
          }
        }
        setRecentRestoreMessage(
          summarizeRestoreAllResults(
            results,
            registryResults,
            restoreFailureCount,
            startupResults,
            scheduledTaskResults
          )
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
