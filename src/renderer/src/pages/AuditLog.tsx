import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { copy } from "@shared/copy";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type { AuditCategory, AuditEntry, AuditSnapshot } from "@shared/types";

interface AuditLogProps {
  onBack: () => void;
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  cleanup: "정리",
  uninstall: "앱 제거",
  defender: "보안 검사",
  monitor: "설정",
  system: "시스템"
};

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  cleanup: "#0ea5e9",
  uninstall: "#9333ea",
  defender: "#dc2626",
  monitor: "#16a34a",
  system: "#475569"
};

type FilterMode = "all" | AuditCategory;

function formatLocal(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at;
  return new Date(t).toLocaleString("ko-KR");
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function isAuditWarning(entry: AuditEntry): boolean {
  return (
    entry.action.includes("-failed-") ||
    entry.summary.includes("못했어요") ||
    auditRestoreNeedsAttention(entry) ||
    auditFailureDetailCount(entry.detail) > 0
  );
}

function isRestoreBinAuditEntry(entry: AuditEntry): boolean {
  return (
    entry.category === "cleanup" &&
    (entry.action === "trash" || entry.action === "app-leftovers-trash") &&
    auditRestorableDetailCount(entry.detail) > 0
  );
}

function auditActionLabel(entry: AuditEntry): string {
  if (entry.action.includes("expired-purge-failed")) return "30일 자동 비움 확인";
  if (entry.action.includes("expired-purge")) return "30일 자동 비움";
  if (entry.action.startsWith("restore-point-")) return "복원 지점";
  if (entry.action === "app-leftovers-trash") return "앱 잔여 정리";
  if (entry.action === "uninstall-followup-resolved") return "잔여 없음 확인";
  if (entry.action === "trash") return "복구함으로 이동";
  if (entry.action.startsWith("trash-restore-")) return "복구함 되돌리기";
  if (entry.action.startsWith("registry-backup-restore-")) return "앱 흔적 되돌리기";
  if (entry.action.startsWith("startup-restore-")) return "시작 항목 되돌리기";
  if (entry.action.includes("restore")) return "되돌리기";
  if (entry.action.includes("defender")) return "Windows 보안 확인";
  return "활동 기록";
}

function numberDetail(detail: Record<string, unknown>, key: string): number | null {
  const value = detail[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringDetail(detail: AuditEntry["detail"], key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" ? value : null;
}

function arrayCountDetail(detail: Record<string, unknown>, key: string): number {
  const value = detail[key];
  return Array.isArray(value) ? value.length : 0;
}

function stringArrayDetail(detail: Record<string, unknown>, key: string): string[] {
  const value = detail[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isActualRestoreAuditEntry(entry: AuditEntry): boolean {
  return (
    entry.action.startsWith("trash-restore-") ||
    entry.action.startsWith("registry-backup-restore-") ||
    entry.action.startsWith("startup-restore-")
  );
}

function auditRestoreNeedsAttention(entry: AuditEntry): boolean {
  return isActualRestoreAuditEntry(entry) && stringDetail(entry.detail, "status") !== "restored";
}

function auditFailureDetailCount(detail: AuditEntry["detail"]): number {
  if (!detail) return 0;
  return arrayCountDetail(detail, "failedEntryIds") + arrayCountDetail(detail, "failedIds");
}

function auditRegistryBackupDetailCount(detail: Record<string, unknown>): number {
  const recoverableCount = arrayCountDetail(detail, "recoverableRegistryBackupIds");
  if (recoverableCount > 0) return recoverableCount;
  return new Set([
    ...stringArrayDetail(detail, "registryBackupIds"),
    ...stringArrayDetail(detail, "preservedRegistryBackupIds")
  ]).size;
}

function auditRestorableDetailCount(detail: AuditEntry["detail"]): number {
  if (!detail) return 0;
  return (
    arrayCountDetail(detail, "trashEntryIds") +
    auditRegistryBackupDetailCount(detail) +
    arrayCountDetail(detail, "startupDisabledIds")
  );
}

function auditWarningMessage(entry: AuditEntry): string {
  if (entry.action.includes("expired-purge") || auditFailureDetailCount(entry.detail) > 0) {
    return "아직 비우지 못한 항목은 복구함에 남겨뒀어요. 다음 자동 비움 때 한 번 더 확인해요.";
  }
  return "작업을 끝내지 못했어요. 상세 내용을 확인해 주세요.";
}

function auditDetailLines(detail: AuditEntry["detail"]): string[] {
  if (!detail) return [];
  const lines: string[] = [];
  const purgedCount = numberDetail(detail, "purgedCount");
  const removedCount = numberDetail(detail, "removedCount") ?? arrayCountDetail(detail, "removedItems");
  const failedCount = auditFailureDetailCount(detail);
  const failedBucketCount = numberDetail(detail, "failedBucketCount");
  const skippedCount = numberDetail(detail, "skippedCount") ?? arrayCountDetail(detail, "skippedItems");
  const notSelectedCount = numberDetail(detail, "notSelectedCount");
  const restorableCount = auditRestorableDetailCount(detail);
  const purgedBytes = numberDetail(detail, "purgedBytes");
  const totalFreedBytes = numberDetail(detail, "totalFreedBytes");

  if (purgedCount !== null && purgedCount > 0) lines.push(`비운 항목 ${purgedCount}개`);
  if (removedCount > 0) lines.push(`정리한 항목 ${removedCount}개`);
  if (restorableCount > 0) lines.push(`30일 안에 되돌릴 수 있는 항목 ${restorableCount}개`);
  if (failedCount > 0) lines.push(`아직 남아 있는 항목 ${failedCount}개`);
  if (failedBucketCount !== null && failedBucketCount > 0) {
    lines.push(`확인 못 한 복구함 영역 ${failedBucketCount}곳`);
  }
  if (skippedCount > 0) lines.push(`건드리지 않은 항목 ${skippedCount}개`);
  if (notSelectedCount !== null && notSelectedCount > 0) {
    lines.push(`선택하지 않은 후보 ${notSelectedCount}개`);
  }
  if (purgedBytes !== null && purgedBytes > 0) {
    lines.push(`확보한 공간 ${formatBytes(purgedBytes)}`);
  }
  if (totalFreedBytes !== null && totalFreedBytes > 0) {
    lines.push(`확보한 공간 ${formatBytes(totalFreedBytes)}`);
  }

  return lines;
}

export function AuditLog({ onBack }: AuditLogProps) {
  const [snapshot, setSnapshot] = useState<AuditSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");

  const load = useCallback(async () => {
    if (!window.fb?.getAuditSnapshot) {
      setError("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
      return;
    }
    try {
      const result = await window.fb.getAuditSnapshot();
      setSnapshot(result);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo<AuditEntry[]>(() => {
    if (!snapshot) return [];
    if (filter === "all") return snapshot.entries;
    return snapshot.entries.filter((e) => e.category === filter);
  }, [snapshot, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: snapshot?.entries.length ?? 0 };
    for (const e of snapshot?.entries ?? []) {
      map[e.category] = (map[e.category] ?? 0) + 1;
    }
    return map;
  }, [snapshot]);

  return (
    <main className="fb-report" aria-label="활동 기록">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero" aria-labelledby="audit-page-title">
        <h1 id="audit-page-title" className="fb-h1-sm">활동 기록</h1>
        <p className="fb-lede">
          포맷버디가 이 PC에서 실행한 일을 시간순으로 보여드려요. 정리·앱 제거·보안 검사·설정
          변경이 모두 한 자리에 모여요. {snapshot ? `최근 ${snapshot.retentionDays}일 보관 중.` : ""}
        </p>
      </section>

      {error && (
        <section className="fb-card fb-card-hover">
          <p>{error}</p>
          <Button variant="primary" size="sm" onClick={() => void load()}>
            다시 시도
          </Button>
        </section>
      )}

      {snapshot && (
        <section
          className="fb-card fb-card-hover"
          style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {(["all", "cleanup", "uninstall", "defender", "monitor", "system"] as FilterMode[]).map(
            (mode) => {
              const isAll = mode === "all";
              const label = isAll ? "전체" : CATEGORY_LABEL[mode];
              const count = counts[mode] ?? 0;
              const active = filter === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: active ? "1px solid #2563eb" : "1px solid rgba(0,0,0,0.15)",
                    background: active ? "#2563eb" : "transparent",
                    color: active ? "#fff" : "inherit",
                    cursor: "pointer",
                    fontSize: 13
                  }}
                >
                  {label} ({count})
                </button>
              );
            }
          )}
        </section>
      )}

      {snapshot && entries.length === 0 && (
        <section className="fb-card fb-anim-fade">
          <h3 style={{ marginTop: 0 }}>{copy.emptyStateAuditTitle}</h3>
          <p>{copy.emptyStateAuditBody}</p>
        </section>
      )}

      {entries.map((entry, idx) => {
        const warning = isAuditWarning(entry);
        const detailLines = auditDetailLines(entry.detail);
        return (
          <article
            key={entry.id}
            className="fb-card fb-anim-slide fb-card-hover"
            style={{
              marginBottom: 12,
              animationDelay: `${Math.min(idx, 8) * 30}ms`,
              borderColor: warning ? "rgba(217, 119, 6, 0.35)" : undefined,
              background: warning
                ? "linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98))"
                : undefined
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 4
              }}
            >
              <span
                style={{
                  background: CATEGORY_COLOR[entry.category],
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {CATEGORY_LABEL[entry.category]}
              </span>
              {warning && (
                <span
                  style={{
                    background: "#f59e0b",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  확인 필요
                </span>
              )}
              <strong style={{ fontSize: 14 }}>{auditActionLabel(entry)}</strong>
              <small style={{ opacity: 0.6, marginLeft: "auto" }}>
                {formatLocal(entry.at)}
              </small>
            </header>
            <p style={{ fontSize: 14, margin: "4px 0" }}>{entry.summary}</p>
            {warning && (
              <small style={{ display: "block", opacity: 0.72, marginTop: 4 }}>
                {auditWarningMessage(entry)}
              </small>
            )}
            {isRestoreBinAuditEntry(entry) && (
              <small style={{ display: "block", opacity: 0.65, marginTop: 4 }}>
                되돌리기는 안전 정리 센터의 포맷버디 복구함에서 할 수 있어요.
              </small>
            )}
            {detailLines.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, opacity: 0.65, cursor: "pointer" }}>
                  상세 보기
                </summary>
                <ul
                  style={{
                    fontSize: 12,
                    background: "rgba(15, 23, 42, 0.04)",
                    padding: "8px 8px 8px 24px",
                    borderRadius: 6,
                    marginTop: 6,
                    lineHeight: 1.7
                  }}
                >
                  {detailLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </main>
  );
}
