import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import {
  canCleanupLeftoverGroup,
  selectableLeftoverPathIds,
  summarizeLeftoverSnapshot
} from "@shared/app-leftovers";
import {
  restorableRegistryBackupIds,
  restorableTrashEntryIds,
  summarizeRestoreAllResults
} from "@shared/cleanup-result";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type {
  AppLeftoverGroup,
  AppLeftoverPath,
  AppLeftoversSnapshot,
  AppManagerItem,
  AppManagerSnapshot,
  CleanupExecuteResult,
  AppUninstallResult,
  CleanupTrashRestoreResult,
  RegistryBackupRestoreResult
} from "@shared/types";

interface AppManagerProps {
  isWindows: boolean;
  onBack: () => void;
  onOpenCleanup: () => void;
  onRescan: () => void;
  onVerifyUninstall?: () => void;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
  autoOpenLeftovers?: boolean;
  notice?: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: AppManagerSnapshot }
  | { kind: "empty" }
  | { kind: "error"; message: string };

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
    case "registry":
      return "앱 삭제 흔적";
    case "startup-folder":
      return "시작 항목";
    case "startup-registry":
      return "시작 항목";
    case "startup-entry":
      return "시작 흔적";
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
            {lastStatus.detail ? ` (${lastStatus.detail})` : ""}
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

function LeftoverPanel({
  state,
  selected,
  busy,
  result,
  onToggle,
  onCleanup,
  onRescan,
  onRestoreRecent,
  restoreRecentBusy,
  restoreRecentMessage,
  onOpenTrashRestore,
  onOpenAuditLog
}: {
  state: LeftoverState;
  selected: Set<string>;
  busy: boolean;
  result?: CleanupExecuteResult;
  onToggle: (pathId: string, checked: boolean) => void;
  onCleanup: () => void;
  onRescan: () => void;
  onRestoreRecent: (result: CleanupExecuteResult) => void;
  restoreRecentBusy: boolean;
  restoreRecentMessage?: string;
  onOpenTrashRestore: () => void;
  onOpenAuditLog: () => void;
}) {
  if (state.loading) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 항목 후보를 살펴보는 중이에요…</p>
      </article>
    );
  }
  if (state.error) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 항목 확인 중 문제가 생겼어요: {state.error}</p>
      </article>
    );
  }
  if (!state.snapshot) return null;
  const restorableCount = result
    ? restorableTrashEntryIds(result).length + restorableRegistryBackupIds(result).length
    : 0;
  if (state.snapshot.groups.length === 0) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>알려진 잔여 항목 후보가 보이지 않아요.</p>
      </article>
    );
  }
  const leftoverSummary = summarizeLeftoverSnapshot(state.snapshot);
  const selectableIds = selectableLeftoverPathIds(state.snapshot);
  const selectedValidCount = Array.from(selected).filter((id) => selectableIds.has(id)).length;
  return (
    <section style={{ marginTop: 16 }}>
      <h2 className="fb-h2">앱별 잔여 후보</h2>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Windows가 앱을 제거해도 남는 경우가 있는 폴더와 앱 삭제 흔적 후보예요. 직접 고른
        항목만 정리하고, 폴더는 복구함에 30일 동안 보관해요. 앱 삭제 흔적도 30일 동안
        되돌릴 수 있게 백업해요.
      </p>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        총 {leftoverSummary.total}개 후보 중 {leftoverSummary.selectable}개를 선택할 수 있어요.
        아직 설치된 앱 데이터 {leftoverSummary.installedLocked}개, 보호 경로 {leftoverSummary.protected}개,
        제거 확인 전 {leftoverSummary.notChecked}개, 지금 없는 항목 {leftoverSummary.missing}개는 자동으로 빠져요.
      </p>
      <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <strong>선택한 잔여 항목</strong>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {selectedValidCount}개 · 보호됨/없는 항목은 선택할 수 없어요.
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onCleanup}
            disabled={busy || selectedValidCount === 0}
          >
            {busy ? "정리하는 중…" : "선택 항목 정리하기"}
          </Button>
        </header>
        {result && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, opacity: 0.82, margin: "0 0 8px" }}>
              {result.removedItems.length}개를 정리했어요. 실패/건너뜀{" "}
              {result.skippedItems.filter((s) => s.reason !== "not-selected").length}개.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" size="sm" onClick={onRescan}>
                다시 점검해서 효과 보기
              </Button>
              {result.mode === "trash" && result.removedItems.length > 0 && (
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
      {state.snapshot.groups.map((group) => (
        <LeftoverGroupCard
          key={group.appName}
          group={group}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
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
        {group.paths.map((path) => (
          <li
            key={path.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
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
                보호됨
              </span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AppManager({
  isWindows,
  onBack,
  onOpenCleanup,
  onRescan,
  onVerifyUninstall,
  onOpenTrashRestore,
  onOpenAuditLog,
  autoOpenLeftovers,
  notice
}: AppManagerProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [leftovers, setLeftovers] = useState<LeftoverState>({ loading: false });
  const [selectedLeftovers, setSelectedLeftovers] = useState<Set<string>>(new Set());
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupExecuteResult | undefined>();
  const [recentRestoreBusy, setRecentRestoreBusy] = useState(false);
  const [recentRestoreMessage, setRecentRestoreMessage] = useState<string | undefined>();
  const [activeUninstall, setActiveUninstall] = useState<string | null>(null);
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
      if (snapshot.total === 0) {
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
    if (!window.fb?.listAppLeftovers) return;
    setLeftovers({ loading: true });
    try {
      const snapshot = await window.fb.listAppLeftovers();
      setLeftovers({ loading: false, snapshot });
      setSelectedLeftovers(new Set());
    } catch (err) {
      setLeftovers({ loading: false, error: friendlyErrorMessage(err) });
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

  const cleanupSelectedLeftovers = useCallback(async () => {
    if (!window.fb?.cleanupAppLeftovers) return;
    const snapshot = leftovers.snapshot;
    if (!snapshot || selectedLeftovers.size === 0) return;
    const selectableIds = selectableLeftoverPathIds(snapshot);
    const selectedPathIds = Array.from(selectedLeftovers).filter((id) => selectableIds.has(id));
    if (selectedPathIds.length === 0) return;
    const confirmed = window.confirm(
      `선택한 앱 잔여 항목 ${selectedPathIds.length}개를 정리할게요. 폴더와 시작 항목, 앱 삭제 흔적은 30일 안에 되돌릴 수 있게 챙겨둘게요.`
    );
    if (!confirmed) return;
    setCleanupBusy(true);
    setRecentRestoreMessage(undefined);
    try {
      const result = await window.fb.cleanupAppLeftovers({
        planId: snapshot.planId,
        confirmationToken: snapshot.confirmationToken,
        selectedPathIds
      });
      setCleanupResult(result);
      setSelectedLeftovers(new Set());
      await loadLeftovers();
    } catch (err) {
      setLeftovers((prev) => ({ ...prev, loading: false, error: friendlyErrorMessage(err) }));
    } finally {
      setCleanupBusy(false);
    }
  }, [leftovers.snapshot, loadLeftovers, selectedLeftovers]);

  const restoreRecentLeftovers = useCallback(
    async (result: CleanupExecuteResult) => {
      const entryIds = restorableTrashEntryIds(result);
      const registryBackupIds = restorableRegistryBackupIds(result);
      if (entryIds.length === 0 && registryBackupIds.length === 0) {
        setRecentRestoreMessage("이 정리에서 바로 되돌릴 항목이 없어요.");
        return;
      }
      if (entryIds.length > 0 && !window.fb?.restoreCleanupTrash) return;
      if (registryBackupIds.length > 0 && !window.fb?.restoreRegistryBackup) return;

      setRecentRestoreBusy(true);
      setRecentRestoreMessage(undefined);
      try {
        const results: CleanupTrashRestoreResult[] = [];
        const registryResults: RegistryBackupRestoreResult[] = [];
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
        setRecentRestoreMessage(summarizeRestoreAllResults(results, registryResults, restoreFailureCount));
        await loadLeftovers();
      } finally {
        setRecentRestoreBusy(false);
      }
    },
    [loadLeftovers]
  );

  const onUninstall = useCallback(async (item: AppManagerItem) => {
    if (!window.fb?.uninstallApp) return;
    if (item.uninstallAvailability !== "ready") return;
    const confirmed = window.confirm(
      `${item.name}의 Windows 제거 마법사를 띄울게요. 진행 여부는 마법사 안에서 직접 확인해주세요.`
    );
    if (!confirmed) return;
    setActiveUninstall(item.id);
    try {
      const result = await window.fb.uninstallApp({
        appName: item.name,
        publisher: item.publisher
      });
      setUninstallStatuses((prev) => ({ ...prev, [item.id]: result }));
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
    } finally {
      setActiveUninstall(null);
    }
  }, []);

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
          설치된 앱을 카테고리별로 보여드리고, Windows 기본 제거 마법사를 띄워드려요. 잔여 항목은
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
            Windows 제거 마법사를 끝냈다면 먼저 제거 완료를 확인해볼게요. 제거 확인이 끝나면 남은 항목을 바로 보여드려요.
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
              최근 24시간 안에 Windows 제거 마법사를 띄운 앱이에요. 실제 제거 완료 여부는 다시 점검으로 확인해요.
            </small>
          </header>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0" }}>
            {load.snapshot.recentlyUninstallLaunched.map((app) => (
              <li key={`${app.name}|${app.publisher ?? ""}`} style={{ padding: "4px 0" }}>
                <strong>{app.name}</strong>
                {app.publisher && <small style={{ opacity: 0.68 }}> · {app.publisher}</small>}
                <small style={{ opacity: 0.68 }}>
                  {" "}
                  · {app.stillInstalled ? "아직 앱 목록에 있어요" : "현재 앱 목록에서는 안 보여요"}
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
        onCleanup={cleanupSelectedLeftovers}
        onRescan={onRescan}
        onRestoreRecent={(result) => void restoreRecentLeftovers(result)}
        restoreRecentBusy={recentRestoreBusy}
        restoreRecentMessage={recentRestoreMessage}
        onOpenTrashRestore={onOpenTrashRestore}
        onOpenAuditLog={onOpenAuditLog}
      />
    </main>
  );
}
