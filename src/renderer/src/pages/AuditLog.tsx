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

function isAuditWarning(entry: AuditEntry): boolean {
  return entry.action.includes("-failed-") || entry.summary.includes("못했어요");
}

function auditActionLabel(entry: AuditEntry): string {
  if (entry.action.includes("expired-purge-failed")) return "30일 자동 비움 확인";
  if (entry.action.includes("expired-purge")) return "30일 자동 비움";
  if (entry.action === "trash") return "복구함으로 이동";
  if (entry.action.includes("restore")) return "되돌리기";
  if (entry.action.includes("defender")) return "Windows 보안 확인";
  return "활동 기록";
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
                아직 비우지 못한 항목은 복구함에 남겨뒀어요. 다음 자동 비움 때 한 번 더 확인해요.
              </small>
            )}
            {entry.category === "cleanup" && entry.action === "trash" && (
              <small style={{ display: "block", opacity: 0.65, marginTop: 4 }}>
                되돌리기는 안전 정리 센터의 포맷버디 복구함에서 할 수 있어요.
              </small>
            )}
            {entry.detail && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, opacity: 0.65, cursor: "pointer" }}>
                  상세 보기
                </summary>
                <pre
                  style={{
                    fontSize: 11,
                    background: "rgba(0,0,0,0.04)",
                    padding: 8,
                    borderRadius: 4,
                    marginTop: 6,
                    maxHeight: 200,
                    overflow: "auto"
                  }}
                >
                  {JSON.stringify(entry.detail, null, 2)}
                </pre>
              </details>
            )}
          </article>
        );
      })}
    </main>
  );
}
