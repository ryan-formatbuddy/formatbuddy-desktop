import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import {
  daysUntilTrashExpiry,
  summarizeTrashRestoreResults,
  trashExpirySummary
} from "@shared/cleanup-result";
import type {
  CleanupCategoryId,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot,
  RegistryBackupEntry,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot
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
 *   - Expired entries are cleaned by the main process on load/startup.
 *     We intentionally do NOT expose "permanently delete this single
 *     entry" — purge is by expiry only so users can't shoot themselves
 *     in the foot with one wrong click.
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

function summarizeRegistryRestoreResults(results: RegistryBackupRestoreResult[]): string {
  if (results.length === 0) return "";
  const restored = results.filter((r) => r.status === "restored").length;
  const skipped = results.length - restored;
  if (restored > 0 && skipped === 0) return `레지스트리 백업 ${restored}개를 되돌렸어요.`;
  if (restored > 0) return `레지스트리 백업 ${restored}개를 되돌렸고, ${skipped}개는 확인이 필요해요.`;
  return "레지스트리 백업을 되돌리지 못했어요. 활동 기록에서 이유를 확인해주세요.";
}

export function TrashRestore({ onBack }: TrashRestoreProps) {
  const [snapshot, setSnapshot] = useState<CleanupTrashSnapshot | null>(null);
  const [registrySnapshot, setRegistrySnapshot] = useState<RegistryBackupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.fb?.getCleanupTrash || !window.fb?.getRegistryBackups) {
      setError("Electron 브리지를 찾지 못했어요.");
      return;
    }
    try {
      const [trash, registry] = await Promise.all([
        window.fb.getCleanupTrash(),
        window.fb.getRegistryBackups()
      ]);
      setSnapshot(trash);
      setRegistrySnapshot(registry);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const registryEntries = useMemo(
    () => registrySnapshot?.entries ?? [],
    [registrySnapshot]
  );
  const totalEntryCount = entries.length + registryEntries.length;

  const onRestore = useCallback(
    async (entry: CleanupTrashEntry) => {
      if (!window.fb?.restoreCleanupTrash) return;
      setBusy(`file:${entry.id}`);
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

  const onRestoreRegistry = useCallback(
    async (entry: RegistryBackupEntry) => {
      if (!window.fb?.restoreRegistryBackup) return;
      setBusy(`registry:${entry.id}`);
      setToast(null);
      try {
        const result: RegistryBackupRestoreResult = await window.fb.restoreRegistryBackup({
          backupId: entry.id
        });
        setToast(result.message);
        await load();
      } catch (e) {
        setToast(`레지스트리 되돌리기 중 문제가 생겼어요: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreAll = useCallback(async () => {
    if (
      (!window.fb?.restoreCleanupTrash && entries.length > 0) ||
      (!window.fb?.restoreRegistryBackup && registryEntries.length > 0) ||
      totalEntryCount === 0
    ) {
      return;
    }
    setBusy("restore-all");
    setToast(null);
    try {
      const results: CleanupTrashRestoreResult[] = [];
      for (const entry of entries) {
        results.push(await window.fb.restoreCleanupTrash({ entryId: entry.id }));
      }
      const registryResults: RegistryBackupRestoreResult[] = [];
      for (const entry of registryEntries) {
        registryResults.push(await window.fb.restoreRegistryBackup({ backupId: entry.id }));
      }
      setToast(
        [
          results.length > 0 ? summarizeTrashRestoreResults(results) : "",
          summarizeRegistryRestoreResults(registryResults)
        ]
          .filter(Boolean)
          .join(" ")
      );
      await load();
    } catch (e) {
      setToast(`되돌리기 중 문제가 생겼어요: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [entries, load, registryEntries, totalEntryCount]);

  const headerSummary = useMemo(() => {
    if (!snapshot || !registrySnapshot) return "복구함 불러오는 중...";
    if (totalEntryCount === 0) return "복구함이 비어 있어요.";
    return `파일 ${entries.length}개 · 레지스트리 백업 ${registryEntries.length}개 · 총 ${formatBytes(snapshot.totalBytes)} · 보관 기간 ${snapshot.retentionDays}일`;
  }, [snapshot, registrySnapshot, entries.length, registryEntries.length, totalEntryCount]);

  const expirySummary = useMemo(
    () => trashExpirySummary([...entries, ...registryEntries]),
    [entries, registryEntries]
  );

  const expiryMessage = useMemo(() => {
    if (!snapshot || totalEntryCount === 0 || expirySummary.nextExpiryDays === null) return null;
    if (expirySummary.todayCount > 0) {
      return `${expirySummary.todayCount}개가 오늘 자동 삭제돼요. 필요한 게 있으면 먼저 되돌려주세요.`;
    }
    if (expirySummary.expiringSoonCount > 0) {
      return `${expirySummary.expiringSoonCount}개가 3일 안에 자동 삭제돼요. 오래된 항목부터 확인해볼게요.`;
    }
    return `가장 먼저 자동 삭제될 항목은 ${expirySummary.nextExpiryDays}일 뒤예요.`;
  }, [totalEntryCount, expirySummary, snapshot]);

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
          깔끔 정리에서 보낸 파일과 앱 정리 때 만든 레지스트리 백업은 30일 동안 여기 보관해요.
          마음이 바뀌면 한 번에 되돌릴 수 있고, 30일이 지나면 자동으로 영구 삭제돼요. {headerSummary}
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
              모두 되돌릴 수 있어요. 30일이 지난 항목은 앱이 알아서 정리해요.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onRestoreAll()}
            disabled={Boolean(busy) || totalEntryCount === 0}
          >
            {busy === "restore-all" ? "되돌리는 중..." : "모두 원래 자리로"}
          </Button>
        </div>
        {expiryMessage && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(37, 99, 235, 0.08)",
              color: "#1d4ed8",
              fontSize: 13,
              fontWeight: 650
            }}
          >
            {expiryMessage}
          </div>
        )}
        {toast && (
          <p style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>{toast}</p>
        )}
      </section>

      {snapshot && registrySnapshot && totalEntryCount === 0 && (
        <section className="fb-card fb-anim-fade">
          <h3 style={{ marginTop: 0 }}>복구함이 비어 있어요</h3>
          <p>
            깔끔 정리에서 보낸 파일이나 앱 정리에서 만든 레지스트리 백업이 있으면 여기 시간순으로
            표시돼요. 곧 만료될 항목부터 위에 보여드려요.
          </p>
        </section>
      )}

      {entries.map((entry, idx) => {
        const days = daysUntilTrashExpiry(entry.expiresAt);
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
                  color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
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
                {busy === `file:${entry.id}` ? "되돌리는 중..." : "원래 자리로 되돌리기"}
              </Button>
            </div>
          </article>
        );
      })}

      {registryEntries.map((entry, idx) => {
        const days = daysUntilTrashExpiry(entry.expiresAt);
        const isUrgent = days <= 3;
        return (
          <article
            key={entry.id}
            className="fb-card fb-anim-slide fb-card-hover"
            style={{
              marginBottom: 12,
              animationDelay: `${Math.min(idx + entries.length, 8) * 30}ms`
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
                  background: "#2563eb",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                레지스트리 백업
              </span>
              <strong style={{ fontSize: 14 }}>앱 제거 정보 백업</strong>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                  fontWeight: isUrgent ? 600 : 400
                }}
              >
                {days === 0 ? "오늘 만료" : `${days}일 뒤 만료`}
              </span>
            </header>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.keyPath}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              보낸 시각 {formatLocal(entry.createdAt)}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onRestoreRegistry(entry)}
                disabled={Boolean(busy)}
              >
                {busy === `registry:${entry.id}` ? "되돌리는 중..." : "레지스트리 되돌리기"}
              </Button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
