import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { summarizeTrashRestoreResults } from "@shared/cleanup-result";
import type {
  CleanupCategoryId,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot
} from "@shared/types";

interface TrashRestoreProps {
  onBack: () => void;
}

/**
 * FormatBuddy Trash (30-day restore bin) — UI surface.
 *
 * Built on the `cleanup-trash:*` IPC channels and the
 * `main/cleanup/trash.ts` engine. Every entry shown here represents a
 * file that the user explicitly selected in the Cleanup page; nothing
 * here was deleted automatically.
 *
 * User verbs:
 *   - "되돌리기" calls cleanup-trash:restore, which atomically moves
 *     the stored bytes back to `originalPath`. Refuses when a same-name
 *     file already exists at the target (no overwrite, ever).
 *   - "모두 되돌리기" loops through the same restore IPC for every
 *     entry and summarizes restored/blocked/missing outcomes.
 *   - "지금 비우기" calls cleanup-trash:purge-expired and reflects the
 *     freed bytes in a small toast row. We intentionally do NOT expose
 *     "permanently delete this single entry" — purge is by expiry only
 *     so users can't shoot themselves in the foot with one wrong click.
 */
const CATEGORY_LABEL: Record<CleanupCategoryId, string> = {
  "recycle-bin": "휴지통",
  "temp-user": "사용자 임시",
  "temp-windows": "Windows 임시",
  "browser-cache": "브라우저 캐시",
  "windows-old": "이전 Windows",
  "downloads-installers": "오래된 설치 파일",
  "large-files": "큰 파일",
  "app-leftovers": "앱 잔여 폴더"
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function formatLocal(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at;
  return new Date(t).toLocaleString("ko-KR");
}

function daysUntil(expiresAt: string, now = Date.now()): number {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / 86_400_000));
}

export function TrashRestore({ onBack }: TrashRestoreProps) {
  const [snapshot, setSnapshot] = useState<CleanupTrashSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.fb?.getCleanupTrash) {
      setError("Electron 브리지를 찾지 못했어요.");
      return;
    }
    try {
      const result = await window.fb.getCleanupTrash();
      setSnapshot(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);

  const onRestore = useCallback(
    async (entry: CleanupTrashEntry) => {
      if (!window.fb?.restoreCleanupTrash) return;
      setBusy(entry.id);
      setToast(null);
      try {
        const result: CleanupTrashRestoreResult = await window.fb.restoreCleanupTrash({
          entryId: entry.id
        });
        setToast(result.message);
        await load();
      } catch (e) {
        setToast(`되돌리기 중 문제가 생겼어요: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreAll = useCallback(async () => {
    if (!window.fb?.restoreCleanupTrash || entries.length === 0) return;
    setBusy("restore-all");
    setToast(null);
    try {
      const results: CleanupTrashRestoreResult[] = [];
      for (const entry of entries) {
        results.push(await window.fb.restoreCleanupTrash({ entryId: entry.id }));
      }
      setToast(summarizeTrashRestoreResults(results));
      await load();
    } catch (e) {
      setToast(`되돌리기 중 문제가 생겼어요: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [entries, load]);

  const onPurgeExpired = useCallback(async () => {
    if (!window.fb?.purgeExpiredCleanupTrash) return;
    setBusy("purge");
    setToast(null);
    try {
      const result = await window.fb.purgeExpiredCleanupTrash();
      if (result.purgedCount === 0) {
        setToast("만료된 항목이 없어요. 30일이 지난 항목만 영구 삭제돼요.");
      } else {
        setToast(
          `만료된 ${result.purgedCount}개 항목(약 ${formatBytes(result.purgedBytes)})을 영구 정리했어요.`
        );
      }
      await load();
    } catch (e) {
      setToast(`정리 중 문제가 생겼어요: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [load]);

  const headerSummary = useMemo(() => {
    if (!snapshot) return "복구함 불러오는 중...";
    if (entries.length === 0) return "복구함이 비어 있어요.";
    return `${entries.length}개 항목 · 총 ${formatBytes(snapshot.totalBytes)} · 보관 기간 ${snapshot.retentionDays}일`;
  }, [snapshot, entries.length]);

  return (
    <main className="fb-report" aria-label="복구함 (30일)">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">복구함 (30일)</h1>
        <p className="fb-lede">
          깔끔 정리에서 보낸 파일은 곧바로 사라지지 않고 30일 동안 여기 보관해요. 마음이 바뀌면
          한 번에 되돌릴 수 있고, 30일이 지나면 자동으로 영구 삭제돼요. {headerSummary}
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

      <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8
          }}
        >
          <div>
            <strong>복구함 관리</strong>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              모두 되돌리거나, 30일이 지난 항목만 영구 삭제할 수 있어요.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onRestoreAll()}
            disabled={Boolean(busy) || entries.length === 0}
          >
            {busy === "restore-all" ? "되돌리는 중..." : "모두 원래 자리로"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onPurgeExpired()}
            disabled={Boolean(busy)}
          >
            {busy === "purge" ? "정리 중..." : "지금 비우기"}
          </Button>
        </div>
        {toast && (
          <p style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>{toast}</p>
        )}
      </section>

      {snapshot && entries.length === 0 && (
        <section className="fb-card fb-anim-fade">
          <h3 style={{ marginTop: 0 }}>복구함이 비어 있어요</h3>
          <p>
            깔끔 정리에서 휴지통으로 보낸 항목이 있으면 여기 시간순으로 표시돼요. 곧 만료될
            항목부터 위에 보여드려요.
          </p>
        </section>
      )}

      {entries.map((entry, idx) => {
        const days = daysUntil(entry.expiresAt);
        const isUrgent = days <= 3;
        return (
          <article
            key={entry.id}
            className="fb-card fb-anim-slide fb-card-hover"
            style={{
              marginBottom: 12,
              animationDelay: `${Math.min(idx, 8) * 30}ms`
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
                  background: "#0ea5e9",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {CATEGORY_LABEL[entry.categoryId] ?? entry.categoryId}
              </span>
              <strong style={{ fontSize: 14 }}>{entry.label}</strong>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: isUrgent ? "#dc2626" : "rgba(0,0,0,0.55)",
                  fontWeight: isUrgent ? 600 : 400
                }}
              >
                {days === 0 ? "오늘 만료" : `${days}일 뒤 만료`}
              </span>
            </header>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.originalPath}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onRestore(entry)}
                disabled={Boolean(busy)}
              >
                {busy === entry.id ? "되돌리는 중..." : "원래 자리로 되돌리기"}
              </Button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
