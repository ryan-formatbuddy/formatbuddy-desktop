import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import type {
  AppLeftoverGroup,
  AppLeftoversSnapshot,
  AppManagerItem,
  AppManagerSnapshot,
  AppUninstallResult
} from "@shared/types";

interface AppManagerProps {
  isWindows: boolean;
  onBack: () => void;
  onOpenCleanup: () => void;
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
  }
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
  onUninstall
}: {
  item: AppManagerItem;
  busy: boolean;
  lastStatus?: AppUninstallResult;
  onUninstall: (item: AppManagerItem) => void;
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

function LeftoverPanel({ state }: { state: LeftoverState }) {
  if (state.loading) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 폴더 후보를 살펴보는 중이에요…</p>
      </article>
    );
  }
  if (state.error) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>잔여 폴더 확인 중 문제가 생겼어요: {state.error}</p>
      </article>
    );
  }
  if (!state.snapshot) return null;
  if (state.snapshot.groups.length === 0) {
    return (
      <article className="fb-card fb-card-hover" style={{ marginTop: 16 }}>
        <p>알려진 잔여 폴더 후보가 보이지 않아요.</p>
      </article>
    );
  }
  return (
    <section style={{ marginTop: 16 }}>
      <h2 className="fb-h2">앱별 잔여 폴더 후보</h2>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Windows가 앱을 제거해도 남는 경우가 있는 폴더예요. 여기서는 보기만 하고, 실제 정리는 안전
        정리 센터에서 진행해주세요.
      </p>
      {state.snapshot.groups.map((group) => (
        <LeftoverGroupCard key={group.appName} group={group} />
      ))}
    </section>
  );
}

function LeftoverGroupCard({ group }: { group: AppLeftoverGroup }) {
  return (
    <article className="fb-card fb-card-hover" style={{ marginBottom: 12 }}>
      <header>
        <h3 style={{ margin: 0 }}>{group.appName}</h3>
        {group.publisher && <small style={{ opacity: 0.7 }}>{group.publisher}</small>}
      </header>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
        {group.paths.map((path) => (
          <li
            key={path.path}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
              padding: "6px 0",
              borderTop: "1px solid rgba(0,0,0,0.05)"
            }}
          >
            <code style={{ fontSize: 12, flex: 1, wordBreak: "break-all" }}>{path.path}</code>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {path.exists ? formatBytes(path.sizeBytes) : "없음"}
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

export function AppManager({ isWindows, onBack, onOpenCleanup }: AppManagerProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [leftovers, setLeftovers] = useState<LeftoverState>({ loading: false });
  const [activeUninstall, setActiveUninstall] = useState<string | null>(null);
  const [uninstallStatuses, setUninstallStatuses] = useState<Record<string, AppUninstallResult>>(
    {}
  );

  const refresh = useCallback(async () => {
    if (!window.fb?.listApps) {
      setLoad({ kind: "error", message: "Electron 브리지를 찾지 못했어요." });
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
      setLoad({ kind: "error", message: (err as Error).message });
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
    } catch (err) {
      setLeftovers({ loading: false, error: (err as Error).message });
    }
  }, []);

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
    } catch (err) {
      setUninstallStatuses((prev) => ({
        ...prev,
        [item.id]: {
          status: "spawn-failed",
          appName: item.name,
          message: (err as Error).message
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
        <h1 className="fb-h1-sm">앱 정리 센터</h1>
        <p className="fb-lede">
          설치된 앱을 카테고리별로 보여드리고, Windows 기본 제거 마법사를 띄워드려요. 잔여 폴더는
          보여만 드리고, 실제 정리는 안전 정리 센터에서 진행해주세요.
        </p>
        {!isWindows && (
          <p style={{ color: "#a36400", fontSize: 13 }}>
            Mac 미리보기에서는 앱 제거를 실행하지 않아요.
          </p>
        )}
      </section>

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
              잔여 폴더 보기
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
                />
              ))}
            </ul>
          </article>
        ))}

      <LeftoverPanel state={leftovers} />
    </main>
  );
}
