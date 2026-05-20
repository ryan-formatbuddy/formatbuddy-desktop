import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import {
  daysUntilTrashExpiry,
  isTrashEntryExpired,
  registryBackupKindLabel,
  registryBackupRestoreButtonLabel,
  restoreEntryExpiryLabel,
  sortTrashEntriesByExpiry,
  summarizeRegistryBackupRestoreResults,
  summarizeRestoreAllResults,
  summarizeStartupFolderRestoreResults,
  summarizeTrashRestoreResults,
  trashExpirySummary
} from "@shared/cleanup-result";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type {
  CleanupCategoryId,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot,
  RegistryBackupEntry,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot,
  StartupAutoDisabledEntry,
  StartupAutoDisabledSnapshot,
  StartupFolderToggleResult
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
 *     We intentionally do NOT expose a manual single-entry empty action;
 *     purge is by expiry only so one wrong click can't remove a backup.
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

type RestoreListItem =
  | {
      id: string;
      kind: "file";
      entry: CleanupTrashEntry;
      expiresAt: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "registry";
      entry: RegistryBackupEntry;
      expiresAt: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "startup";
      entry: StartupAutoDisabledEntry;
      expiresAt: string;
      createdAt: string;
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

function registryBackupTitle(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "startup-value") {
    const appName = entry.appName?.trim();
    const valueName = entry.valueName?.trim();
    if (appName) return `${appName} 시작 항목`;
    if (valueName) return `${valueName} 시작 항목`;
    return "시작 항목 이름을 확인하지 못했어요";
  }

  const appName = entry.appName?.trim();
  return appName ? `${appName} 삭제 흔적` : "앱 이름을 확인하지 못한 삭제 흔적";
}

function registryBackupSubtitle(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "startup-value") {
    const appPublisher = entry.appPublisher?.trim();
    const valueName = entry.valueName?.trim();
    const detail = valueName ? `시작 항목 이름 ${valueName}` : "Windows 시작 때 실행되는 항목";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }

  const appPublisher = entry.appPublisher?.trim();
  return appPublisher ? `${appPublisher} · 앱 삭제 흔적 위치` : "앱 삭제 흔적 위치";
}

function registryRestoreErrorLabel(entry: RegistryBackupEntry): string {
  return entry.backupKind === "startup-value" ? "시작 항목" : "앱 흔적";
}

function registryBackupChangedNotice(entry: RegistryBackupEntry): string {
  return entry.backupKind === "startup-value"
    ? "시작 항목 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요."
    : "앱 삭제 흔적 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
}

function registryBackupChangedButtonLabel(entry: RegistryBackupEntry): string {
  return entry.backupKind === "startup-value" ? "시작 항목 확인 필요" : "앱 삭제 흔적 확인 필요";
}

function registryBackupLegacyNotice(entry: RegistryBackupEntry): string {
  return entry.backupKind === "startup-value"
    ? "시작 항목 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요."
    : "앱 삭제 흔적 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
}

function registryBackupLegacyButtonLabel(entry: RegistryBackupEntry): string {
  return entry.backupKind === "startup-value" ? "시작 항목 기록 확인 필요" : "앱 삭제 흔적 기록 확인 필요";
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

function isChangedRegistryBackupEntry(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus === "changed";
}

function isLegacyRegistryBackupEntry(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus === "legacy";
}

function registryBackupNeedsCheck(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function startupDisabledNeedsCheck(entry: StartupAutoDisabledEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function restoreListItemNeedsCheck(item: RestoreListItem): boolean {
  if (item.kind === "registry") return registryBackupNeedsCheck(item.entry);
  if (item.kind === "startup") return startupDisabledNeedsCheck(item.entry);
  return trashEntryNeedsCheck(item.entry);
}

function startupDisabledChangedNotice(): string {
  return "보관된 시작 항목 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
}

function startupDisabledLegacyNotice(): string {
  return "시작 항목 보관 기록을 확인할 수 없어요. 오래된 보관 항목이라 자동으로 되돌리지 않아요.";
}

export function TrashRestore({ onBack }: TrashRestoreProps) {
  const [snapshot, setSnapshot] = useState<CleanupTrashSnapshot | null>(null);
  const [registrySnapshot, setRegistrySnapshot] = useState<RegistryBackupSnapshot | null>(null);
  const [startupSnapshot, setStartupSnapshot] = useState<StartupAutoDisabledSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.fb?.getCleanupTrash || !window.fb?.getRegistryBackups || !window.fb?.listDisabledStartupAuto) {
      setError("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
      return;
    }
    try {
      const [trash, registry, startup] = await Promise.all([
        window.fb.getCleanupTrash(),
        window.fb.getRegistryBackups(),
        window.fb.listDisabledStartupAuto()
      ]);
      setSnapshot(trash);
      setRegistrySnapshot(registry);
      setStartupSnapshot(startup);
      setError(null);
    } catch (e) {
      setError(friendlyErrorMessage(e as Error));
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
  const startupEntries = useMemo(
    () => startupSnapshot?.entries ?? [],
    [startupSnapshot]
  );
  const registryBytes = useMemo(
    () => registryEntries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0),
    [registryEntries]
  );
  const totalEntryCount = entries.length + registryEntries.length + startupEntries.length;
  const sortedRestoreItems = useMemo(() => {
    const items: RestoreListItem[] = [
      ...entries.map((entry) => ({
        id: `file:${entry.id}`,
        kind: "file" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      })),
      ...registryEntries.map((entry) => ({
        id: `registry:${entry.id}`,
        kind: "registry" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      })),
      ...startupEntries.map((entry) => ({
        id: `startup:${entry.id}`,
        kind: "startup" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.disabledAt
      }))
    ];
    return sortTrashEntriesByExpiry(items);
  }, [entries, registryEntries, startupEntries]);
  const restorableRestoreItems = useMemo(
    () =>
      sortedRestoreItems.filter((item) => {
        if (isTrashEntryExpired(item.expiresAt)) return false;
        if (item.kind === "registry") return !registryBackupNeedsCheck(item.entry);
        if (item.kind === "startup") return !startupDisabledNeedsCheck(item.entry);
        return !trashEntryNeedsCheck(item.entry);
      }),
    [sortedRestoreItems]
  );
  const totalRestorableCount = restorableRestoreItems.length;
  const restoreStatusSummary = useMemo(() => {
    const expiredCount = sortedRestoreItems.filter((item) => isTrashEntryExpired(item.expiresAt)).length;
    const checkNeededCount = sortedRestoreItems.filter(
      (item) => !isTrashEntryExpired(item.expiresAt) && restoreListItemNeedsCheck(item)
    ).length;
    return {
      restorableCount: totalRestorableCount,
      checkNeededCount,
      expiredCount
    };
  }, [sortedRestoreItems, totalRestorableCount]);

  const onRestore = useCallback(
    async (entry: CleanupTrashEntry) => {
      if (!window.fb?.restoreCleanupTrash) {
        setToast("파일 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
        return;
      }
      setBusy(`file:${entry.id}`);
      setToast(null);
      try {
        const result: CleanupTrashRestoreResult = await window.fb.restoreCleanupTrash({
          entryId: entry.id
        });
        setToast(summarizeTrashRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(friendlyErrorMessage(e as Error));
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreRegistry = useCallback(
    async (entry: RegistryBackupEntry) => {
      if (!window.fb?.restoreRegistryBackup) {
        setToast(
          "앱 삭제 흔적 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
        );
        return;
      }
      setBusy(`registry:${entry.id}`);
      setToast(null);
      try {
        const result: RegistryBackupRestoreResult = await window.fb.restoreRegistryBackup({
          backupId: entry.id
        });
        setToast(summarizeRegistryBackupRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(`${registryRestoreErrorLabel(entry)} 되돌리기 중 문제가 생겼어요. ${friendlyErrorMessage(e as Error)}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreStartup = useCallback(
    async (entry: StartupAutoDisabledEntry) => {
      if (!window.fb?.restoreStartupAuto) {
        setToast("시작 항목 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
        return;
      }
      setBusy(`startup:${entry.id}`);
      setToast(null);
      try {
        const result: StartupFolderToggleResult = await window.fb.restoreStartupAuto({
          disabledId: entry.id
        });
        setToast(summarizeStartupFolderRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(`시작 항목 되돌리기 중 문제가 생겼어요. ${friendlyErrorMessage(e as Error)}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreAll = useCallback(async () => {
    const restoreCleanupTrash = window.fb?.restoreCleanupTrash;
    const restoreRegistryBackup = window.fb?.restoreRegistryBackup;
    const restoreStartupAuto = window.fb?.restoreStartupAuto;
    if (totalEntryCount === 0) {
      setToast("되돌릴 항목이 없어요.");
      return;
    }
    if (totalRestorableCount === 0) {
      setToast("지금 바로 되돌릴 수 있는 항목이 없어요. 보관 기간이나 복구 기록을 확인해 주세요.");
      return;
    }
    const restorableFileCount = restorableRestoreItems.filter((item) => item.kind === "file").length;
    const restorableRegistryCount = restorableRestoreItems.filter((item) => item.kind === "registry").length;
    const restorableStartupCount = restorableRestoreItems.length - restorableFileCount - restorableRegistryCount;
    if (
      (!restoreCleanupTrash && restorableFileCount > 0) ||
      (!restoreRegistryBackup && restorableRegistryCount > 0) ||
      (!restoreStartupAuto && restorableStartupCount > 0)
    ) {
      setToast("모두 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
      return;
    }
    setBusy("restore-all");
    setToast(null);
    try {
      const results: CleanupTrashRestoreResult[] = [];
      const registryResults: RegistryBackupRestoreResult[] = [];
      const startupResults: StartupFolderToggleResult[] = [];
      let restoreAllFailureCount = 0;
      for (const item of restorableRestoreItems) {
        if (item.kind === "file") {
          if (restoreCleanupTrash) {
            try {
              results.push(await restoreCleanupTrash({ entryId: item.entry.id }));
            } catch {
              restoreAllFailureCount += 1;
            }
          }
          continue;
        }
        if (item.kind === "startup") {
          if (restoreStartupAuto) {
            try {
              startupResults.push(await restoreStartupAuto({ disabledId: item.entry.id }));
            } catch {
              restoreAllFailureCount += 1;
            }
          }
          continue;
        }
        if (restoreRegistryBackup) {
          try {
            registryResults.push(await restoreRegistryBackup({ backupId: item.entry.id }));
          } catch {
            restoreAllFailureCount += 1;
          }
        }
      }
      setToast(summarizeRestoreAllResults(results, registryResults, restoreAllFailureCount, startupResults));
      await load();
    } catch (e) {
      setToast(friendlyErrorMessage(e as Error));
    } finally {
      setBusy(null);
    }
  }, [load, restorableRestoreItems, totalEntryCount, totalRestorableCount]);

  const headerSummary = useMemo(() => {
    if (!snapshot || !registrySnapshot || !startupSnapshot) return "복구함 불러오는 중...";
    if (totalEntryCount === 0) return "복구함이 비어 있어요.";
    const totalBytes = snapshot.totalBytes + registryBytes;
    const appTraceCount = registryEntries.filter(
      (entry) => entry.backupKind !== "startup-value"
    ).length;
    const registryStartupCount = registryEntries.length - appTraceCount;
    const backupSummary = [
      appTraceCount > 0 ? `앱 삭제 흔적 백업 ${appTraceCount}개` : "",
      registryStartupCount > 0 ? `시작 항목 백업 ${registryStartupCount}개` : "",
      startupEntries.length > 0 ? `잠시 꺼둔 시작 항목 ${startupEntries.length}개` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    return `파일 ${entries.length}개 · ${backupSummary || "백업 0개"} · 총 ${formatBytes(totalBytes)} · 보관 기간 30일`;
  }, [
    snapshot,
    registrySnapshot,
    startupSnapshot,
    entries.length,
    registryEntries,
    registryBytes,
    startupEntries.length,
    totalEntryCount
  ]);

  const expirySummary = useMemo(
    () => trashExpirySummary([...entries, ...registryEntries, ...startupEntries]),
    [entries, registryEntries, startupEntries]
  );

  const expiryMessage = useMemo(() => {
    if (!snapshot || !registrySnapshot || !startupSnapshot || totalEntryCount === 0 || expirySummary.nextExpiryDays === null) return null;
    if (expirySummary.todayCount > 0) {
      return `${expirySummary.todayCount}개는 보관 기간이 지나 되돌릴 수 없어요. 앱이 다음 자동 비움 때 다시 정리해볼게요.`;
    }
    if (expirySummary.expiringSoonCount > 0) {
      return `${expirySummary.expiringSoonCount}개가 3일 안에 비워질 예정이에요. 오래된 항목부터 확인해볼게요.`;
    }
    return `가장 먼저 비워질 항목은 ${expirySummary.nextExpiryDays}일 뒤예요.`;
  }, [totalEntryCount, expirySummary, snapshot, registrySnapshot, startupSnapshot]);

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
          깔끔 정리에서 보낸 파일, 앱 정리 때 만든 백업, 잠시 꺼둔 시작 항목은 30일 동안 여기 보관해요.
          마음이 바뀌면 한 번에 되돌릴 수 있고, 30일 뒤 자동으로 비워요. {headerSummary}
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
              복구 가능한 항목만 되돌려요. 30일이 지난 항목은 앱이 알아서 정리해요.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onRestoreAll()}
            disabled={Boolean(busy) || totalRestorableCount === 0}
          >
            {busy === "restore-all"
              ? "되돌리는 중..."
              : totalRestorableCount === totalEntryCount
                ? "모두 원래 자리로"
                : "가능한 항목만 원래 자리로"}
          </Button>
        </div>
        {totalEntryCount > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>
              바로 되돌릴 수 있는 항목 {restoreStatusSummary.restorableCount}개
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
              확인 필요한 항목 {restoreStatusSummary.checkNeededCount}개
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              보관 기간 지난 항목 {restoreStatusSummary.expiredCount}개
            </span>
          </div>
        )}
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

      {snapshot && registrySnapshot && startupSnapshot && totalEntryCount === 0 && (
        <section className="fb-card fb-anim-fade">
          <h3 style={{ marginTop: 0 }}>복구함이 비어 있어요</h3>
          <p>
            깔끔 정리에서 보낸 파일, 앱 정리에서 만든 백업, 잠시 꺼둔 시작 항목이 있으면 여기 시간순으로 표시돼요.
            곧 만료될 항목부터 위에 보여드려요.
          </p>
        </section>
      )}

      {sortedRestoreItems.map((item, idx) => {
        const isExpired = isTrashEntryExpired(item.expiresAt);
        const days = daysUntilTrashExpiry(item.expiresAt);
        const isUrgent = !isExpired && days <= 3;
        const expiryLabel = restoreEntryExpiryLabel(item.expiresAt);
        if (item.kind === "file") {
          const entry = item.entry;
          const isChanged = isChangedTrashEntry(entry);
          const isLegacy = isLegacyTrashEntry(entry);
          const needsCheck = trashEntryNeedsCheck(entry);
          return (
            <article
              key={item.id}
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
                  {expiryLabel}
                </span>
              </header>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.originalPath}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
              </div>
              {isChanged && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  복구함 안의 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.
                </div>
              )}
              {isLegacy && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  복구 기록을 확인할 수 없어요. 오래된 복구 항목이라 자동으로 되돌리지 않아요.
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onRestore(entry)}
                  disabled={Boolean(busy) || isExpired || needsCheck}
                >
                  {isExpired
                    ? "보관 기간이 지나 되돌릴 수 없어요"
                    : needsCheck
                      ? isChanged
                        ? "복구함 안 파일 확인 필요"
                        : "복구 기록 확인 필요"
                      : busy === `file:${entry.id}`
                      ? "되돌리는 중..."
                      : "원래 자리로 되돌리기"}
                </Button>
              </div>
            </article>
          );
        }
        if (item.kind === "startup") {
          const entry = item.entry;
          const isChanged = entry.integrityStatus === "changed";
          const isLegacy = entry.integrityStatus === "legacy";
          const needsCheck = startupDisabledNeedsCheck(entry);
          return (
            <article
              key={item.id}
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
                    background: "#10b981",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  잠시 꺼둔 시작 항목
                </span>
                <strong style={{ fontSize: 14 }}>{entry.name}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                    fontWeight: isUrgent ? 600 : 400
                  }}
                >
                  {expiryLabel}
                </span>
              </header>
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: -2 }}>
                PC 켤 때 같이 뜨지 않게 잠시 보관한 항목
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, wordBreak: "break-all" }}>
                {entry.originalPath}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                보낸 시각 {formatLocal(entry.disabledAt)}
              </div>
              {isChanged && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {startupDisabledChangedNotice()}
                </div>
              )}
              {isLegacy && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {startupDisabledLegacyNotice()}
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onRestoreStartup(entry)}
                  disabled={Boolean(busy) || isExpired || needsCheck}
                >
                  {isExpired
                    ? "보관 기간이 지나 되돌릴 수 없어요"
                    : needsCheck
                      ? isChanged
                        ? "시작 항목 파일 확인 필요"
                        : "시작 항목 기록 확인 필요"
                      : busy === `startup:${entry.id}`
                        ? "되돌리는 중..."
                        : "시작 항목 되돌리기"}
                </Button>
              </div>
            </article>
          );
        }
        const entry = item.entry;
        const isChanged = isChangedRegistryBackupEntry(entry);
        const isLegacy = isLegacyRegistryBackupEntry(entry);
        const needsCheck = registryBackupNeedsCheck(entry);
        return (
          <article
            key={item.id}
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
                  background: "#2563eb",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {registryBackupKindLabel(entry)}
              </span>
              <strong style={{ fontSize: 14 }}>{registryBackupTitle(entry)}</strong>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                  fontWeight: isUrgent ? 600 : 400
                }}
              >
                {expiryLabel}
              </span>
            </header>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: -2 }}>
              {registryBackupSubtitle(entry)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, wordBreak: "break-all" }}>
              {entry.keyPath}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
            </div>
            {isChanged && (
              <div
                style={{
                  marginTop: 8,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(37, 99, 235, 0.08)",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 650
                }}
              >
                {registryBackupChangedNotice(entry)}
              </div>
            )}
            {isLegacy && (
              <div
                style={{
                  marginTop: 8,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(37, 99, 235, 0.08)",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 650
                }}
              >
                {registryBackupLegacyNotice(entry)}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onRestoreRegistry(entry)}
                disabled={Boolean(busy) || isExpired || needsCheck}
              >
                {isExpired
                  ? "보관 기간이 지나 되돌릴 수 없어요"
                  : needsCheck
                    ? isChanged
                      ? registryBackupChangedButtonLabel(entry)
                      : registryBackupLegacyButtonLabel(entry)
                    : busy === `registry:${entry.id}`
                    ? "되돌리는 중..."
                    : registryBackupRestoreButtonLabel(entry)}
              </Button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
