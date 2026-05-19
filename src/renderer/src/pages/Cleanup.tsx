import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { CloudBuddy } from "../components/CloudBuddy";
import { Lockup } from "../components/Lockup";
import {
  daysUntilTrashExpiry,
  restorableTrashEntryIds,
  summarizeTrashRestoreResults
} from "@shared/cleanup-result";
import type {
  CleanupCategoryPlan,
  CleanupExecuteResult,
  CleanupItem,
  CleanupPlan,
  CleanupRiskLevel,
  CleanupTrashEntry,
  CleanupTrashSnapshot,
  LargeFileCandidate,
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
  const days = daysUntilTrashExpiry(expiresAt);
  if (days <= 0) return "오늘 비워질 예정이에요";
  return `${days}일 뒤 비워요`;
}

function trashSnapshotExpiryLabel(snapshot: CleanupTrashSnapshot): string {
  const nextExpiryAt = snapshot.nextExpiryAt ?? snapshot.entries[0]?.expiresAt;
  if (!nextExpiryAt) return `${snapshot.retentionDays}일 동안 보관해요`;

  const days = daysUntilTrashExpiry(nextExpiryAt);
  if (days <= 0) return "다음 항목은 오늘 비워질 예정이에요";
  return `다음 항목은 ${days}일 뒤 비워요`;
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
          30일 동안 포맷버디 복구함에 보관해요. 그 전에는 앱 안에서 원래 위치로 되돌릴 수 있고, 30일 뒤 자동으로 비워요.
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
  const restorableCount = restorableTrashEntryIds(result).length;
  const failedCount = result.skippedItems.filter((s) => s.reason !== "not-selected").length;
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
      <details>
        <summary>처리 내역 자세히 보기</summary>
        <pre style={{ fontSize: 11, maxHeight: 300, overflow: "auto" }}>
          {JSON.stringify(
            {
              mode: result.mode,
              freedBytes: result.totalFreedBytes,
              removed: result.removedItems.filter((i) => i.succeeded).map((i) => i.path),
              skipped: result.skippedItems
                .filter((s) => s.reason !== "not-selected")
                .map((s) => ({ path: s.path, reason: s.reason, detail: s.detail }))
            },
            null,
            2
          )}
        </pre>
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
        {result.mode === "trash" && removedCount > 0 && (
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
      {result.mode === "trash" && removedCount > 0 && (
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          정리한 항목은 포맷버디 복구함에 30일 동안 보관돼요. 마음이 바뀌면 이 화면에서 되돌릴 수 있어요.
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
      </div>
      <Button variant="secondary" size="sm" onClick={() => onRestore(entry.id)}>
        되돌리기
      </Button>
    </li>
  );
}

function TrashPanel({
  snapshot,
  onRestore,
  onOpenTrashRestore
}: {
  snapshot?: CleanupTrashSnapshot;
  onRestore: (entryId: string) => void;
  onOpenTrashRestore: () => void;
}) {
  if (!snapshot || snapshot.entries.length === 0) return null;
  const sample = snapshot.entries.slice(0, 4);
  const hidden = snapshot.entries.length - sample.length;
  return (
    <article className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0 }}>포맷버디 복구함</h2>
          <small>
            {snapshot.entries.length}개 · {formatBytes(snapshot.totalBytes)} 보관 중 · {trashSnapshotExpiryLabel(snapshot)}
          </small>
        </div>
      </header>
      <p style={{ fontSize: 13, opacity: 0.75, margin: "8px 0 0" }}>
        정리한 파일은 바로 사라지지 않아요. 30일 동안 여기서 되돌릴 수 있고, 기간이 지나면 포맷버디가 자동으로 비워요.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
        {sample.map((entry) => (
          <TrashEntryRow key={entry.id} entry={entry} onRestore={onRestore} />
        ))}
      </ul>
      {hidden > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <small style={{ opacity: 0.6 }}>나머지 {hidden}개도 전체 복구함에서 바로 볼 수 있어요.</small>
          <Button variant="ghost" size="sm" onClick={onOpenTrashRestore}>
            전체 복구함 열기
          </Button>
        </div>
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
  const [trashMessage, setTrashMessage] = useState<string | undefined>();
  const [recentRestoreBusy, setRecentRestoreBusy] = useState(false);
  const [recentRestoreMessage, setRecentRestoreMessage] = useState<string | undefined>();

  const largeFiles = useMemo<LargeFileCandidate[]>(() => report?.largeFiles ?? [], [report]);

  const loadTrash = useCallback(async () => {
    if (!window.fb?.getCleanupTrash) return;
    try {
      const snapshot = await window.fb.getCleanupTrash();
      setTrashSnapshot(snapshot);
    } catch {
      // 복구함은 보조 기능이므로 정리 흐름을 막지 않아요.
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
      await loadTrash();
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }, [largeFiles, loadTrash]);

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
    if (!window.fb?.executeCleanup) return;
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
      await loadTrash();
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }, [loadTrash, phase, selected]);

  const restoreRecentCleanup = useCallback(
    async (result: CleanupExecuteResult) => {
      if (!window.fb?.restoreCleanupTrash) return;
      const entryIds = restorableTrashEntryIds(result);
      if (entryIds.length === 0) {
        setRecentRestoreMessage("이 정리에서 바로 되돌릴 항목이 없어요.");
        return;
      }

      setRecentRestoreBusy(true);
      setRecentRestoreMessage(undefined);
      try {
        const results = [];
        for (const entryId of entryIds) {
          results.push(await window.fb.restoreCleanupTrash({ entryId }));
        }
        setRecentRestoreMessage(summarizeTrashRestoreResults(results));
        await loadTrash();
      } catch (err) {
        setRecentRestoreMessage(`되돌리기 중 문제가 생겼어요: ${(err as Error).message}`);
      } finally {
        setRecentRestoreBusy(false);
      }
    },
    [loadTrash]
  );

  const restoreFromTrash = useCallback(
    async (entryId: string) => {
      if (!window.fb?.restoreCleanupTrash) return;
      const result = await window.fb.restoreCleanupTrash({ entryId });
      setTrashMessage(result.message);
      await loadTrash();
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
        onRestore={restoreFromTrash}
        onOpenTrashRestore={onOpenTrashRestore}
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
