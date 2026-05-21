import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { CloudBuddy } from "../components/CloudBuddy";
import { Lockup } from "../components/Lockup";
import {
  daysUntilTrashExpiry,
  isTrashEntryExpired,
  recoverableRegistryBackupIds,
  restorableScheduledTaskBackupIds,
  restorableStartupDisabledIds,
  restorableTrashEntryIds,
  restoreEntryExpiryLabel,
  summarizeRestoreAllResults,
  summarizeTrashRestoreResults
} from "@shared/cleanup-result";
import { CLEANUP_HISTORY_SAVE_WARNING } from "@shared/cleanup-warnings";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type {
  CleanupCategoryPlan,
  CleanupExecuteResult,
  CleanupHistorySnapshot,
  CleanupItem,
  CleanupLogEntry,
  CleanupPlan,
  CleanupRiskLevel,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot,
  LargeFileCandidate,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot,
  ScheduledTaskBackupRestoreResult,
  ScheduledTaskBackupSnapshot,
  StartupAutoDisabledSnapshot,
  StartupFolderToggleResult,
  ScanReport
} from "@shared/types";

interface CleanupProps {
  report?: ScanReport;
  isWindows: boolean;
  onBack: () => void;
  onComplete: () => void;
  onRescan: () => void;
  onQuickRescan?: () => void;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
}

type Phase =
  | { kind: "planning" }
  | { kind: "preview"; plan: CleanupPlan }
  | { kind: "confirm"; plan: CleanupPlan }
  | { kind: "executing"; plan: CleanupPlan }
  | { kind: "result"; plan: CleanupPlan; result: CleanupExecuteResult }
  | { kind: "error"; message: string };

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function riskLabel(level: CleanupRiskLevel): string {
  switch (level) {
    case "safe":
      return "안전";
    case "review":
      return "직접 확인";
    case "restricted":
      return "보호됨";
  }
}

function trashEntryExpiryLabel(expiresAt: string): string {
  return restoreEntryExpiryLabel(expiresAt);
}

function trashSnapshotExpiryLabel(snapshot: CleanupTrashSnapshot): string {
  const nextExpiryAt = snapshot.nextExpiryAt ?? snapshot.entries[0]?.expiresAt;
  if (!nextExpiryAt) return "30일 동안 보관해요";

  const days = daysUntilTrashExpiry(nextExpiryAt);
  if (isTrashEntryExpired(nextExpiryAt)) return "보관 기간이 지난 항목이 있어요";
  return `다음 항목은 ${days}일 뒤 비워요`;
}

function registryBackupBytes(snapshot?: RegistryBackupSnapshot): number {
  return snapshot?.entries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0) ?? 0;
}

function scheduledTaskBackupBytes(snapshot?: ScheduledTaskBackupSnapshot): number {
  return snapshot?.entries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0) ?? 0;
}

function registryBackupKindCounts(snapshot?: RegistryBackupSnapshot): {
  appBackupCount: number;
  startupBackupCount: number;
} {
  const entries = snapshot?.entries ?? [];
  const appBackupCount = entries.filter((entry) => entry.backupKind !== "startup-value").length;
  return {
    appBackupCount,
    startupBackupCount: entries.length - appBackupCount
  };
}

function cleanupHistoryDateLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "정리 기록";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function cleanupHistoryDetailLines(entry: CleanupLogEntry): string[] {
  const lines: string[] = [];
  if (entry.totalFreedBytes > 0) lines.push(`확보한 공간 ${formatBytes(entry.totalFreedBytes)}`);
  if (entry.removedCount > 0) lines.push(`30일 안에 되돌릴 수 있는 항목 ${entry.removedCount}개`);
  if (entry.notSelectedCount > 0) lines.push(`선택하지 않은 후보 ${entry.notSelectedCount}개`);
  if (entry.skippedCount > 0) lines.push(`건드리지 않은 항목 ${entry.skippedCount}개`);
  return lines.length > 0 ? lines : ["처리한 항목은 없어요"];
}

function isChangedTrashEntry(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus === "changed";
}

function isLegacyTrashEntry(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus === "legacy";
}

function trashEntryNeedsCheck(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function defaultSelectionFor(plan: CleanupPlan): Set<string> {
  const selected = new Set<string>();
  for (const category of plan.categories) {
    if (category.riskLevel !== "safe") continue;
    for (const item of category.items) selected.add(item.id);
  }
  return selected;
}

function CategorySection({
  category,
  selected,
  onToggle,
  onToggleAll
}: {
  category: CleanupCategoryPlan;
  selected: Set<string>;
  onToggle: (itemId: string, checked: boolean) => void;
  onToggleAll: (category: CleanupCategoryPlan, checked: boolean) => void;
}) {
  const allChecked =
    category.items.length > 0 && category.items.every((item) => selected.has(item.id));
  const someChecked = category.items.some((item) => selected.has(item.id));
  const sampleItems = category.items.slice(0, 5);
  const remaining = category.items.length - sampleItems.length;

  return (
    <article className="fb-card fb-anim-slide fb-card-hover" style={{ marginBottom: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>{category.label}</h3>
          <small>{category.description}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{formatBytes(category.totalBytes)}</strong>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {category.itemCount}개 · {riskLabel(category.riskLevel)}
          </div>
        </div>
      </header>

      <p style={{ fontSize: 12, opacity: 0.75, margin: "8px 0" }}>{category.safetyNote}</p>

      {category.items.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>지금 정리할 후보가 없어요.</p>
      ) : (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              padding: "6px 0",
              borderTop: "1px solid rgba(0,0,0,0.06)"
            }}
          >
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = !allChecked && someChecked;
              }}
              onChange={(e) => onToggleAll(category, e.target.checked)}
            />
            <span>이 카테고리 전체 선택</span>
          </label>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sampleItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                checked={selected.has(item.id)}
                onToggle={onToggle}
              />
            ))}
          </ul>

          {remaining > 0 && (
            <small style={{ opacity: 0.6 }}>
              미리보기에는 {sampleItems.length}개만 보여드렸어요. 카테고리 전체 선택을 누르면 {category.itemCount}개 전체를 함께 처리해요.
            </small>
          )}
        </>
      )}

      {category.blockedItems.length > 0 && (
        <details style={{ marginTop: 12, fontSize: 12 }}>
          <summary>보호되어 정리에서 제외된 항목 {category.blockedItems.length}개</summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0" }}>
            {category.blockedItems.slice(0, 5).map((item) => (
              <li key={item.id} style={{ opacity: 0.75 }}>
                <code>{item.path}</code>
                {item.blockedBy && <span> — {item.blockedBy}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function ItemRow({
  item,
  checked,
  onToggle
}: {
  item: CleanupItem;
  checked: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderTop: "1px solid rgba(0,0,0,0.04)"
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(item.id, e.target.checked)}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.label}
        </div>
        <small style={{ opacity: 0.7 }}>
          <code style={{ fontSize: 11 }}>{item.path}</code>
        </small>
      </div>
      <strong style={{ fontSize: 13 }}>{formatBytes(item.sizeBytes)}</strong>
    </li>
  );
}

function ConfirmDialog({
  selectedCount,
  selectedBytes,
  onCancel,
  onConfirm
}: {
  selectedCount: number;
  selectedBytes: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "var(--color-fb-bg-elev)",
          color: "var(--color-fb-ink-1)",
          padding: 24,
          borderRadius: 12,
          width: 480,
          maxWidth: "90%",
          boxShadow: "var(--fb-shadow-3)"
        }}
      >
        <h2 style={{ marginTop: 0 }}>포맷버디 복구함으로 보내기</h2>
        <p>
          선택한 <strong>{selectedCount}개</strong> 항목, 총 <strong>{formatBytes(selectedBytes)}</strong>을 정리해요.
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          30일 동안 포맷버디 복구함에 보관해요. 보관 기간 안에는 앱 안에서 원래 위치로 되돌릴 수 있고, 30일 뒤 자동으로 비워요.
        </p>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          보호 경로를 한 번 더 확인하고 진행해요. 같은 이름 파일이나 잠긴 파일은 건드리지 않아요.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            포맷버디 복구함으로 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

type CleanupRemovedItem = CleanupExecuteResult["removedItems"][number];
type CleanupSkippedResultItem = CleanupExecuteResult["skippedItems"][number];

function cleanupPathLabel(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

function cleanupSkipReasonLabel(reason: CleanupSkippedResultItem["reason"]): string {
  switch (reason) {
    case "not-selected":
      return "선택하지 않음";
    case "blocked-path":
      return "보호 경로";
    case "access-denied":
      return "권한 확인 필요";
    case "not-found":
      return "이미 없음";
    case "below-min-age":
      return "아직 최근 항목";
    case "execute-failed":
      return "권한 또는 잠금 확인 필요";
  }
}

function friendlyCleanupDetail(detail?: string): string {
  if (!detail) return "";
  const lower = detail.toLowerCase();

  if (/30-day|30일|expiry|만료/.test(lower)) {
    return "30일 보관 기간을 확인하지 못했어요";
  }
  if (/manifest|복구함 정보/.test(lower)) {
    return "복구함 정보를 확인하지 못했어요";
  }
  if (/stored trash path|restore entry|managed restore bin|restore bin/.test(lower)) {
    return "복구함 저장 위치를 안전하게 확인하지 못했어요";
  }
  if (/link|symbolic|링크/.test(lower)) {
    return "링크 경로라 안전 확인이 필요해요";
  }
  if (/access|permission|eacces|eperm|권한/.test(lower)) {
    return "권한이 부족해서 처리하지 못했어요";
  }
  if (/locked|busy|사용 중|잠금/.test(lower)) {
    return "다른 프로그램이 사용 중이라 처리하지 못했어요";
  }
  if (/still exists|아직 남아/.test(lower)) {
    return "정리 후에도 항목이 남아 있어요";
  }

  return "상세 확인이 필요해요";
}

function cleanupResultDetailLines(result: CleanupExecuteResult): string[] {
  const succeededCount = result.removedItems.filter((item) => item.succeeded).length;
  const restorableCount = restorableCleanupResultCount(result);
  const skippedCount = result.skippedItems.filter((item) => item.reason !== "not-selected").length;
  const notSelectedCount = result.skippedItems.filter((item) => item.reason === "not-selected").length;
  const lines: string[] = [];

  if (result.totalFreedBytes > 0) lines.push(`확보한 공간 ${formatBytes(result.totalFreedBytes)}`);
  if (succeededCount > 0) lines.push(`정상 처리 ${succeededCount}개`);
  if (restorableCount > 0) lines.push(`복구함에서 되돌릴 수 있는 항목 ${restorableCount}개`);
  if (skippedCount > 0) lines.push(`건너뛴 항목 ${skippedCount}개`);
  if (notSelectedCount > 0) lines.push(`선택하지 않은 후보 ${notSelectedCount}개`);

  return lines.length > 0 ? lines : ["이번 정리에서 처리된 항목은 없어요."];
}

function restorableCleanupResultCount(result: CleanupExecuteResult): number {
  return (
    restorableTrashEntryIds(result).length +
    recoverableRegistryBackupIds(result).length +
    restorableStartupDisabledIds(result).length +
    restorableScheduledTaskBackupIds(result).length
  );
}

function cleanupRemovedItemLines(result: CleanupExecuteResult): string[] {
  const succeeded = result.removedItems.filter((item) => item.succeeded);
  const sample = succeeded.slice(0, 8).map((item: CleanupRemovedItem) => {
    const restoreState = item.trashEntryId ? "복구함 보관" : "처리됨";
    return `${cleanupPathLabel(item.path)} · ${formatBytes(item.sizeBytes)} · ${restoreState}`;
  });
  const hidden = succeeded.length - sample.length;
  if (hidden > 0) sample.push(`외 ${hidden}개 항목도 처리했어요.`);
  return sample;
}

function cleanupSkippedItemLines(result: CleanupExecuteResult): string[] {
  const skipped = result.skippedItems.filter((item) => item.reason !== "not-selected");
  const sample = skipped.slice(0, 6).map((item: CleanupSkippedResultItem) => {
    const detail = friendlyCleanupDetail(item.detail);
    return `${cleanupPathLabel(item.path)} · ${cleanupSkipReasonLabel(item.reason)}${detail ? ` · ${detail}` : ""}`;
  });
  const hidden = skipped.length - sample.length;
  if (hidden > 0) sample.push(`외 ${hidden}개 항목은 건드리지 않았어요.`);
  return sample;
}

function ResultPanel({
  result,
  onBack,
  onRescan,
  onQuickRescan,
  onRestoreRecent,
  restoreRecentBusy,
  restoreRecentMessage,
  onOpenTrashRestore,
  onOpenAuditLog
}: {
  result: CleanupExecuteResult;
  onBack: () => void;
  onRescan: () => void;
  onQuickRescan?: () => void;
  onRestoreRecent: (result: CleanupExecuteResult) => void;
  restoreRecentBusy: boolean;
  restoreRecentMessage?: string;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
}) {
  const removedCount = result.removedItems.filter((i) => i.succeeded).length;
  const restorableCount = restorableCleanupResultCount(result);
  const failedCount = result.skippedItems.filter((s) => s.reason !== "not-selected").length;
  const detailLines = cleanupResultDetailLines(result);
  const removedLines = cleanupRemovedItemLines(result);
  const skippedLines = cleanupSkippedItemLines(result);
  return (
    <article className="fb-card fb-anim-pop">
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CloudBuddy size={64} variant="primary" expression={removedCount > 0 ? "success" : "calm"} />
        <div>
          <h2 style={{ margin: 0 }}>정리를 마쳤어요</h2>
          <p style={{ margin: "4px 0 0" }}>
            총 <strong className="fb-anim-count">{formatBytes(result.totalFreedBytes)}</strong>을 정리했어요. {removedCount}개 항목이 정상 처리됐어요.
          </p>
        </div>
      </header>
      {failedCount > 0 && (
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          {failedCount}개 항목은 권한 또는 잠금 때문에 처리하지 못해 건너뛰었어요.
        </p>
      )}
      {result.logPersistenceWarning && (
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          {CLEANUP_HISTORY_SAVE_WARNING}
        </p>
      )}
      <details>
        <summary>처리 내역 자세히 보기</summary>
        <ul style={{ fontSize: 12, lineHeight: 1.7, margin: "8px 0 0", paddingLeft: 18 }}>
          {detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {removedLines.length > 0 && (
          <>
            <strong style={{ display: "block", fontSize: 12, marginTop: 10 }}>정리한 항목</strong>
            <ul style={{ fontSize: 12, lineHeight: 1.7, margin: "4px 0 0", paddingLeft: 18 }}>
              {removedLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
        {skippedLines.length > 0 && (
          <>
            <strong style={{ display: "block", fontSize: 12, marginTop: 10 }}>건드리지 않은 항목</strong>
            <ul style={{ fontSize: 12, lineHeight: 1.7, margin: "4px 0 0", paddingLeft: 18 }}>
              {skippedLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </details>
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={onRescan}>
          다시 점검해서 효과 보기
        </Button>
        {onQuickRescan && (
          <Button variant="secondary" onClick={onQuickRescan}>
            빠르게 다시 보기
          </Button>
        )}
        {result.mode === "trash" && restorableCount > 0 && (
          <Button variant="secondary" onClick={onOpenTrashRestore}>
            복구함 보기
          </Button>
        )}
        {restorableCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => onRestoreRecent(result)}
            disabled={restoreRecentBusy}
          >
            {restoreRecentBusy ? "되돌리는 중…" : "방금 정리 되돌리기"}
          </Button>
        )}
        <Button variant="ghost" onClick={onOpenAuditLog}>
          활동 기록 보기
        </Button>
        <Button variant="ghost" onClick={onBack}>
          처음으로
        </Button>
      </div>
      {result.mode === "trash" && restorableCount > 0 && (
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          30일 안에 되돌릴 수 있는 항목은 포맷버디 복구함에서 다시 확인할 수 있어요.
        </p>
      )}
      {restoreRecentMessage && (
        <p style={{ fontSize: 13, opacity: 0.78, marginTop: 8 }}>{restoreRecentMessage}</p>
      )}
    </article>
  );
}

function TrashEntryRow({
  entry,
  onRestore
}: {
  entry: CleanupTrashEntry;
  onRestore: (entryId: string) => void;
}) {
  const isExpired = isTrashEntryExpired(entry.expiresAt);
  const isChanged = isChangedTrashEntry(entry);
  const isLegacy = isLegacyTrashEntry(entry);
  const needsCheck = trashEntryNeedsCheck(entry);

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderTop: "1px solid rgba(0,0,0,0.06)"
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.label}
        </div>
        <small style={{ opacity: 0.7 }}>
          {formatBytes(entry.sizeBytes)} · {trashEntryExpiryLabel(entry.expiresAt)}
        </small>
        <div style={{ fontSize: 11, opacity: 0.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.originalPath}
        </div>
        {isChanged && (
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 650, marginTop: 4 }}>
            복구함 안의 파일이 바뀐 것 같아요.
          </div>
        )}
        {isLegacy && (
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 650, marginTop: 4 }}>
            복구 기록을 확인할 수 없어요.
          </div>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onRestore(entry.id)}
        disabled={isExpired || needsCheck}
      >
        {isExpired
          ? "보관 기간이 지나 되돌릴 수 없어요"
          : needsCheck
            ? isChanged
              ? "복구함 안 파일 확인 필요"
              : "복구 기록 확인 필요"
            : "되돌리기"}
      </Button>
    </li>
  );
}

function TrashPanel({
  snapshot,
  registrySnapshot,
  startupSnapshot,
  scheduledTaskSnapshot,
  onRestore,
  onOpenTrashRestore
}: {
  snapshot?: CleanupTrashSnapshot;
  registrySnapshot?: RegistryBackupSnapshot;
  startupSnapshot?: StartupAutoDisabledSnapshot;
  scheduledTaskSnapshot?: ScheduledTaskBackupSnapshot;
  onRestore: (entryId: string) => void;
  onOpenTrashRestore: () => void;
}) {
  const fileEntries = snapshot?.entries ?? [];
  const { appBackupCount, startupBackupCount } = registryBackupKindCounts(registrySnapshot);
  const heldStartupCount = startupSnapshot?.entries.length ?? 0;
  const scheduledTaskBackupCount = scheduledTaskSnapshot?.entries.length ?? 0;
  const totalCount =
    fileEntries.length +
    appBackupCount +
    startupBackupCount +
    heldStartupCount +
    scheduledTaskBackupCount;
  if (totalCount === 0) return null;

  const sample = fileEntries.slice(0, 4);
  const hidden = fileEntries.length - sample.length;
  const totalBytes =
    (snapshot?.totalBytes ?? 0) +
    registryBackupBytes(registrySnapshot) +
    scheduledTaskBackupBytes(scheduledTaskSnapshot);
  const summaryParts = [
    fileEntries.length > 0 ? `정리 파일 ${fileEntries.length}개` : "",
    appBackupCount > 0 ? `앱 삭제 흔적 ${appBackupCount}개` : "",
    startupBackupCount > 0 ? `시작 항목 백업 ${startupBackupCount}개` : "",
    heldStartupCount > 0 ? `잠시 꺼둔 시작 항목 ${heldStartupCount}개` : "",
    scheduledTaskBackupCount > 0 ? `예약 작업 백업 ${scheduledTaskBackupCount}개` : ""
  ].filter(Boolean);
  return (
    <article className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>포맷버디 복구함</h2>
          <small>
            전체 {totalCount}개 · {formatBytes(totalBytes)} 보관 중
            {snapshot ? ` · ${trashSnapshotExpiryLabel(snapshot)}` : ""}
          </small>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenTrashRestore}>
          전체 복구함 열기
        </Button>
      </header>
      <p style={{ fontSize: 13, opacity: 0.75, margin: "8px 0 0" }}>
        {summaryParts.join(" · ")}를 30일 동안 보관하고 있어요. 정리 파일은 여기서 바로 되돌릴 수 있고,
        앱 삭제 흔적, 시작 항목, 예약 작업은 전체 복구함에서 같이 확인할 수 있어요.
      </p>
      {sample.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
          {sample.map((entry) => (
            <TrashEntryRow key={entry.id} entry={entry} onRestore={onRestore} />
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, opacity: 0.66, margin: "10px 0 0" }}>
          지금은 정리 파일보다 앱 삭제 흔적, 시작 항목, 예약 작업 보관분이 남아 있어요.
        </p>
      )}
      {hidden > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <small style={{ opacity: 0.6 }}>나머지 {hidden}개도 전체 복구함에서 바로 볼 수 있어요.</small>
        </div>
      )}
    </article>
  );
}

function CleanupHistoryPanel({
  snapshot,
  message,
  onOpenAuditLog
}: {
  snapshot?: CleanupHistorySnapshot;
  message?: string;
  onOpenAuditLog: () => void;
}) {
  const entries = snapshot?.entries.slice(0, 3) ?? [];
  if (entries.length === 0 && !message) return null;

  return (
    <article className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>최근 정리 기록</h2>
          <small>이 PC에서 처리한 정리만 로컬로 남겨요.</small>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenAuditLog}>
          활동 기록 보기
        </Button>
      </header>
      {message && <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.75 }}>{message}</p>}
      {entries.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 0",
                borderTop: "1px solid var(--line)"
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{cleanupHistoryDateLabel(entry.executedAt)}</strong>
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  {cleanupHistoryDetailLines(entry).join(" · ")}
                </div>
              </div>
              <small style={{ opacity: 0.62, whiteSpace: "nowrap" }}>30일 복구함</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Cleanup({
  report,
  isWindows,
  onBack,
  onComplete,
  onRescan,
  onQuickRescan,
  onOpenTrashRestore,
  onOpenAuditLog
}: CleanupProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "planning" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [trashSnapshot, setTrashSnapshot] = useState<CleanupTrashSnapshot | undefined>();
  const [registrySnapshot, setRegistrySnapshot] = useState<RegistryBackupSnapshot | undefined>();
  const [startupSnapshot, setStartupSnapshot] = useState<StartupAutoDisabledSnapshot | undefined>();
  const [scheduledTaskSnapshot, setScheduledTaskSnapshot] = useState<ScheduledTaskBackupSnapshot | undefined>();
  const [trashMessage, setTrashMessage] = useState<string | undefined>();
  const [cleanupHistory, setCleanupHistory] = useState<CleanupHistorySnapshot | undefined>();
  const [historyMessage, setHistoryMessage] = useState<string | undefined>();
  const [recentRestoreBusy, setRecentRestoreBusy] = useState(false);
  const [recentRestoreMessage, setRecentRestoreMessage] = useState<string | undefined>();

  const largeFiles = useMemo<LargeFileCandidate[]>(() => report?.largeFiles ?? [], [report]);

  const loadTrash = useCallback(async () => {
    const bridge = window.fb;
    if (!bridge) {
      setTrashSnapshot(undefined);
      setRegistrySnapshot(undefined);
      setStartupSnapshot(undefined);
      setScheduledTaskSnapshot(undefined);
      setTrashMessage("복구함 목록을 연결하지 못했어요. 정리는 계속할 수 있고, 포맷버디를 다시 열면 복구함을 다시 확인할 수 있어요.");
      return;
    }

    const fileTask = Promise.resolve().then(() => bridge.getCleanupTrash());
    const registryTask = Promise.resolve().then(() => bridge.getRegistryBackups());
    const startupTask = Promise.resolve().then(() => bridge.listDisabledStartupAuto());
    const scheduledTaskTask = Promise.resolve().then(() => bridge.getScheduledTaskBackups());

    const [file, registry, startup, scheduledTask] = await Promise.allSettled([
      fileTask,
      registryTask,
      startupTask,
      scheduledTaskTask
    ]);
    const failedLabels: string[] = [];

    if (file.status === "fulfilled") {
      setTrashSnapshot(file.value);
    } else {
      setTrashSnapshot(undefined);
      failedLabels.push("정리 파일");
    }
    if (registry.status === "fulfilled") {
      setRegistrySnapshot(registry.value);
    } else {
      setRegistrySnapshot(undefined);
      failedLabels.push("앱 삭제 흔적");
    }
    if (startup.status === "fulfilled") {
      setStartupSnapshot(startup.value);
    } else {
      setStartupSnapshot(undefined);
      failedLabels.push("잠시 꺼둔 시작 항목");
    }
    if (scheduledTask.status === "fulfilled") {
      setScheduledTaskSnapshot(scheduledTask.value);
    } else {
      setScheduledTaskSnapshot(undefined);
      failedLabels.push("예약 작업");
    }

    setTrashMessage(
      failedLabels.length > 0
        ? `${failedLabels.join(", ")} 복구 목록을 지금 불러오지 못했어요. 정리는 계속할 수 있고, 전체 복구함에서 다시 확인할 수 있어요.`
        : undefined
    );
  }, []);

  const loadHistory = useCallback(async () => {
    if (!window.fb?.getCleanupHistory) {
      setHistoryMessage("최근 정리 기록을 연결하지 못했어요. 정리는 계속할 수 있어요.");
      return;
    }
    try {
      const snapshot = await window.fb.getCleanupHistory();
      setCleanupHistory(snapshot);
      setHistoryMessage(undefined);
    } catch {
      setHistoryMessage("최근 정리 기록을 불러오지 못했어요. 정리는 계속할 수 있어요.");
    }
  }, []);

  const startPlanning = useCallback(async () => {
    if (!window.fb?.planCleanup) {
      setPhase({ kind: "error", message: "앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요." });
      return;
    }
    setPhase({ kind: "planning" });
    try {
      const plan = await window.fb.planCleanup({ largeFiles });
      setSelected(defaultSelectionFor(plan));
      setPhase({ kind: "preview", plan });
      await Promise.all([loadTrash(), loadHistory()]);
    } catch (err) {
      setPhase({ kind: "error", message: friendlyErrorMessage(err) });
    }
  }, [largeFiles, loadHistory, loadTrash]);

  useEffect(() => {
    if (!isWindows) {
      setPhase({
        kind: "error",
        message: "Mac 미리보기에서는 실제 정리 기능을 실행하지 않아요. Windows 앱에서 사용해주세요."
      });
      return;
    }
    void startPlanning();
  }, [isWindows, startPlanning]);

  const toggleItem = useCallback((itemId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const toggleCategoryAll = useCallback(
    (category: CleanupCategoryPlan, checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of category.items) {
          if (checked) next.add(item.id);
          else next.delete(item.id);
        }
        return next;
      });
    },
    []
  );

  const selectedBytes = useMemo(() => {
    if (phase.kind !== "preview" && phase.kind !== "confirm" && phase.kind !== "executing") return 0;
    const plan = "plan" in phase ? phase.plan : undefined;
    if (!plan) return 0;
    let bytes = 0;
    for (const category of plan.categories) {
      for (const item of category.items) {
        if (selected.has(item.id)) bytes += item.sizeBytes;
      }
    }
    return bytes;
  }, [phase, selected]);

  const requestConfirm = useCallback(
    () => {
      if (phase.kind !== "preview") return;
      if (selected.size === 0) return;
      setPhase({ kind: "confirm", plan: phase.plan });
    },
    [phase, selected]
  );

  const runExecute = useCallback(async () => {
    if (phase.kind !== "confirm") return;
    if (!window.fb?.executeCleanup) {
      setPhase({
        kind: "error",
        message: "정리 실행을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
      });
      return;
    }
    const plan = phase.plan;
    setPhase({ kind: "executing", plan });
    setRecentRestoreMessage(undefined);
    try {
      const result = await window.fb.executeCleanup({
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: Array.from(selected),
        mode: "trash"
      });
      setPhase({ kind: "result", plan, result });
      await Promise.all([loadTrash(), loadHistory()]);
    } catch (err) {
      setPhase({ kind: "error", message: friendlyErrorMessage(err) });
    }
  }, [loadHistory, loadTrash, phase, selected]);

  const restoreRecentCleanup = useCallback(
    async (result: CleanupExecuteResult) => {
      const entryIds = restorableTrashEntryIds(result);
      const registryBackupIds = recoverableRegistryBackupIds(result);
      const startupDisabledIds = restorableStartupDisabledIds(result);
      const scheduledTaskBackupIds = restorableScheduledTaskBackupIds(result);
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
            startupResults.push(await window.fb.restoreStartupAuto({ disabledId }));
          } catch {
            restoreFailureCount += 1;
          }
        }
        for (const backupId of scheduledTaskBackupIds) {
          try {
            scheduledTaskResults.push(await window.fb.restoreScheduledTaskBackup({ backupId }));
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
        await Promise.all([loadTrash(), loadHistory()]);
      } finally {
        setRecentRestoreBusy(false);
      }
    },
    [loadHistory, loadTrash]
  );

  const restoreFromTrash = useCallback(
    async (entryId: string) => {
      if (!window.fb?.restoreCleanupTrash) {
        setTrashMessage(
          "복구함 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 복구함에서 확인해주세요."
        );
        return;
      }
      try {
        const result = await window.fb.restoreCleanupTrash({ entryId });
        setTrashMessage(summarizeTrashRestoreResults([result]));
        await loadTrash();
      } catch (err) {
        setTrashMessage(friendlyErrorMessage(err));
      }
    },
    [loadTrash]
  );

  return (
    <main className="fb-report" aria-label="안전 정리">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">안전 정리 센터</h1>
        <p className="fb-lede">
          정리하기 전에 후보를 다시 한 번 보여드릴게요. 선택한 항목만 포맷버디 복구함으로 보내고, 보호 경로는 자동으로 빠져요.
        </p>
      </section>

      {trashMessage && (
        <article className="fb-card fb-anim-pop" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{trashMessage}</p>
        </article>
      )}

      <TrashPanel
        snapshot={trashSnapshot}
        registrySnapshot={registrySnapshot}
        startupSnapshot={startupSnapshot}
        scheduledTaskSnapshot={scheduledTaskSnapshot}
        onRestore={restoreFromTrash}
        onOpenTrashRestore={onOpenTrashRestore}
      />

      <CleanupHistoryPanel
        snapshot={cleanupHistory}
        message={historyMessage}
        onOpenAuditLog={onOpenAuditLog}
      />

      {phase.kind === "planning" && (
        <article className="fb-card fb-card-hover">
          <p>정리 후보를 모으는 중이에요. 잠깐만 기다려주세요.</p>
        </article>
      )}

      {phase.kind === "error" && (
        <article className="fb-card fb-card-hover">
          <h2>잠시 멈췄어요</h2>
          <p>{phase.message}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={() => void startPlanning()}>
              다시 시도
            </Button>
            <Button variant="ghost" onClick={onBack}>
              처음으로
            </Button>
          </div>
        </article>
      )}

      {(phase.kind === "preview" || phase.kind === "confirm" || phase.kind === "executing") && (
        <>
          <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <h2 style={{ margin: 0 }}>선택한 항목</h2>
                <small>
                  {selected.size}개 · 약 {formatBytes(selectedBytes)} · 전체 후보 약 {formatBytes(phase.plan.totalReclaimableBytes)}
                </small>
              </div>
            </header>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button
                variant="primary"
                onClick={() => requestConfirm()}
                disabled={phase.kind !== "preview" || selected.size === 0}
              >
                포맷버디 복구함으로 보내기
              </Button>
              <Button variant="ghost" onClick={onBack}>
                정리하지 않고 나가기
              </Button>
            </div>
            {phase.plan.notes.length > 0 && (
              <ul style={{ fontSize: 12, opacity: 0.75 }}>
                {phase.plan.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </section>

          {phase.plan.categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              selected={selected}
              onToggle={toggleItem}
              onToggleAll={toggleCategoryAll}
            />
          ))}
        </>
      )}

      {phase.kind === "confirm" && (
        <ConfirmDialog
          selectedCount={selected.size}
          selectedBytes={selectedBytes}
          onCancel={() => setPhase({ kind: "preview", plan: phase.plan })}
          onConfirm={() => void runExecute()}
        />
      )}

      {phase.kind === "executing" && (
        <article className="fb-card fb-card-hover">
          <p>정리하는 중이에요. 큰 파일이 있으면 조금 걸릴 수 있어요.</p>
        </article>
      )}

      {phase.kind === "result" && (
        <ResultPanel
          result={phase.result}
          onBack={() => {
            onComplete();
          }}
          onRescan={onRescan}
          onQuickRescan={onQuickRescan}
          onRestoreRecent={(result) => void restoreRecentCleanup(result)}
          restoreRecentBusy={recentRestoreBusy}
          restoreRecentMessage={recentRestoreMessage}
          onOpenTrashRestore={onOpenTrashRestore}
          onOpenAuditLog={onOpenAuditLog}
        />
      )}
    </main>
  );
}
