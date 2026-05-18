import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import type {
  CleanupCategoryPlan,
  CleanupExecuteMode,
  CleanupExecuteResult,
  CleanupItem,
  CleanupPlan,
  CleanupRiskLevel,
  LargeFileCandidate,
  ScanReport
} from "@shared/types";

interface CleanupProps {
  report?: ScanReport;
  isWindows: boolean;
  onBack: () => void;
  onComplete: () => void;
}

type Phase =
  | { kind: "planning" }
  | { kind: "preview"; plan: CleanupPlan }
  | { kind: "confirm"; plan: CleanupPlan; mode: CleanupExecuteMode }
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
    <article className="fb-card" style={{ marginBottom: 16 }}>
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
  plan,
  selectedCount,
  selectedBytes,
  mode,
  onCancel,
  onConfirm
}: {
  plan: CleanupPlan;
  selectedCount: number;
  selectedBytes: number;
  mode: CleanupExecuteMode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const modeLabel = mode === "trash" ? "휴지통으로 보내기" : "영구 삭제";
  const modeDescription =
    mode === "trash"
      ? "Windows 휴지통으로 보내요. 마음이 바뀌면 휴지통에서 복원할 수 있어요."
      : "영구 삭제는 되돌릴 수 없어요. 정말 확신할 때만 사용해주세요.";

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
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          width: 480,
          maxWidth: "90%"
        }}
      >
        <h2 style={{ marginTop: 0 }}>{modeLabel}</h2>
        <p>
          선택한 <strong>{selectedCount}개</strong> 항목, 총 <strong>{formatBytes(selectedBytes)}</strong>을 정리해요.
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>{modeDescription}</p>
        <ul style={{ fontSize: 12, opacity: 0.7 }}>
          <li>Plan ID: {plan.planId.slice(0, 8)}</li>
          <li>Blocklist 버전: v{plan.blocklistVersion}</li>
        </ul>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {modeLabel} 진행
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  onBack
}: {
  result: CleanupExecuteResult;
  onBack: () => void;
}) {
  const removedCount = result.removedItems.filter((i) => i.succeeded).length;
  const failedCount = result.skippedItems.filter((s) => s.reason !== "not-selected").length;
  return (
    <article className="fb-card">
      <h2 style={{ marginTop: 0 }}>정리를 마쳤어요</h2>
      <p>
        총 <strong>{formatBytes(result.totalFreedBytes)}</strong>을 정리했어요. {removedCount}개 항목이 정상 처리됐어요.
      </p>
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
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={onBack}>
          처음으로
        </Button>
      </div>
    </article>
  );
}

export function Cleanup({ report, isWindows, onBack, onComplete }: CleanupProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "planning" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permanentMode, setPermanentMode] = useState(false);

  const largeFiles = useMemo<LargeFileCandidate[]>(() => report?.largeFiles ?? [], [report]);

  const startPlanning = useCallback(async () => {
    if (!window.fb?.planCleanup) {
      setPhase({ kind: "error", message: "Electron 브리지를 찾지 못했어요." });
      return;
    }
    setPhase({ kind: "planning" });
    try {
      const plan = await window.fb.planCleanup({ largeFiles });
      setSelected(defaultSelectionFor(plan));
      setPhase({ kind: "preview", plan });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }, [largeFiles]);

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
    (mode: CleanupExecuteMode) => {
      if (phase.kind !== "preview") return;
      if (selected.size === 0) return;
      setPhase({ kind: "confirm", plan: phase.plan, mode });
    },
    [phase, selected]
  );

  const runExecute = useCallback(async () => {
    if (phase.kind !== "confirm") return;
    if (!window.fb?.executeCleanup) return;
    const plan = phase.plan;
    const mode = phase.mode;
    setPhase({ kind: "executing", plan });
    try {
      const result = await window.fb.executeCleanup({
        planId: plan.planId,
        confirmationToken: plan.confirmationToken,
        selectedItemIds: Array.from(selected),
        mode
      });
      setPhase({ kind: "result", plan, result });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }, [phase, selected]);

  return (
    <main className="fb-report">
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
          정리하기 전에 후보를 다시 한 번 보여드릴게요. 선택한 항목만 휴지통으로 보내고, 보호 경로는 자동으로 빠져요.
        </p>
      </section>

      {phase.kind === "planning" && (
        <article className="fb-card">
          <p>정리 후보를 모으는 중이에요. 잠깐만 기다려주세요.</p>
        </article>
      )}

      {phase.kind === "error" && (
        <article className="fb-card">
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
          <section className="fb-card" style={{ marginBottom: 16 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <h2 style={{ margin: 0 }}>선택한 항목</h2>
                <small>
                  {selected.size}개 · 약 {formatBytes(selectedBytes)} · 전체 후보 약 {formatBytes(phase.plan.totalReclaimableBytes)}
                </small>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={permanentMode}
                  onChange={(e) => setPermanentMode(e.target.checked)}
                  disabled={phase.kind !== "preview"}
                />
                <span>휴지통 없이 영구 삭제 (위험)</span>
              </label>
            </header>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button
                variant="primary"
                onClick={() => requestConfirm(permanentMode ? "permanent" : "trash")}
                disabled={phase.kind !== "preview" || selected.size === 0}
              >
                {permanentMode ? "영구 삭제 진행" : "휴지통으로 보내기"}
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
          plan={phase.plan}
          selectedCount={selected.size}
          selectedBytes={selectedBytes}
          mode={phase.mode}
          onCancel={() => setPhase({ kind: "preview", plan: phase.plan })}
          onConfirm={() => void runExecute()}
        />
      )}

      {phase.kind === "executing" && (
        <article className="fb-card">
          <p>정리하는 중이에요. 큰 파일이 있으면 조금 걸릴 수 있어요.</p>
        </article>
      )}

      {phase.kind === "result" && (
        <ResultPanel
          result={phase.result}
          onBack={() => {
            onComplete();
          }}
        />
      )}
    </main>
  );
}
