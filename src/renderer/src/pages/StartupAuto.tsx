import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { friendlyErrorMessage } from "@shared/error-friendly";
import type {
  StartupAutoDisabledEntry,
  StartupAutoDisabledSnapshot,
  StartupAutoEntry,
  StartupAutoKind,
  StartupAutoSnapshot
} from "@shared/types";

interface StartupAutoProps {
  onBack: () => void;
}

const KIND_LABEL: Record<StartupAutoKind, string> = {
  registry: "앱이 스스로 등록한 항목",
  "startup-folder": "시작 폴더에 들어간 항목",
  "scheduled-task": "예약된 자동 실행",
  service: "Windows 기본 동작"
};

const KIND_HINT: Record<StartupAutoKind, string> = {
  registry: "대부분 앱 설정에서 켜고 끌 수 있어요. 지금은 이름과 위치를 먼저 보여드려요.",
  "startup-folder": "여기는 포맷버디가 가장 안전하게 잠시 꺼둘 수 있는 영역이에요.",
  "scheduled-task": "업데이트나 동기화처럼 정해진 조건에 맞춰 켜지는 항목이에요. 아직은 보기만 해요.",
  service: "프린터, 보안, 드라이버처럼 Windows와 가까운 항목이에요. 실수 방지를 위해 보기만 해요."
};

const KIND_COLOR: Record<StartupAutoKind, string> = {
  registry: "#0ea5e9",
  "startup-folder": "#10b981",
  "scheduled-task": "#2563eb",
  service: "#1d4ed8"
};

const KIND_ORDER: StartupAutoKind[] = [
  "startup-folder",
  "registry",
  "scheduled-task",
  "service"
];

function shortStatus(snapshot: StartupAutoSnapshot | null): string {
  if (!snapshot) return "조회 중...";
  if (snapshot.status === "ok") {
    return `${snapshot.entries.length}개 항목이 PC 켤 때 같이 떠요.`;
  }
  if (snapshot.status === "windows-only") {
    return "이 기능은 Windows 앱에서 자세히 볼 수 있어요.";
  }
  return "조회 중 문제가 생겨 결과가 비어 있을 수 있어요.";
}

function canDisable(entry: StartupAutoEntry): boolean {
  return entry.kind === "startup-folder" && Boolean(entry.path);
}

function PathLine({ path }: { path?: string }) {
  if (!path) return null;
  return (
    <div
      style={{
        fontSize: 11,
        opacity: 0.6,
        marginTop: 2,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
      title={path}
    >
      {path}
    </div>
  );
}

export function StartupAuto({ onBack }: StartupAutoProps) {
  const [snapshot, setSnapshot] = useState<StartupAutoSnapshot | null>(null);
  const [disabledSnapshot, setDisabledSnapshot] = useState<StartupAutoDisabledSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.fb?.listStartupAuto) {
      setError("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [auto, disabled] = await Promise.all([
        window.fb.listStartupAuto(),
        window.fb.listDisabledStartupAuto
          ? window.fb.listDisabledStartupAuto()
          : Promise.resolve<StartupAutoDisabledSnapshot>({
              capturedAt: new Date().toISOString(),
              entries: [],
              notes: []
            })
      ]);
      setSnapshot(auto);
      setDisabledSnapshot(disabled);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<StartupAutoKind, StartupAutoEntry[]>();
    for (const kind of KIND_ORDER) map.set(kind, []);
    for (const entry of snapshot?.entries ?? []) {
      const list = map.get(entry.kind);
      if (list) list.push(entry);
    }
    return KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_LABEL[kind],
      hint: KIND_HINT[kind],
      color: KIND_COLOR[kind],
      entries: map.get(kind) ?? []
    }));
  }, [snapshot]);

  const disabledEntries = disabledSnapshot?.entries ?? [];
  const summary = shortStatus(snapshot);

  const handleDisable = useCallback(
    async (entry: StartupAutoEntry) => {
      if (!window.fb?.disableStartupAuto) {
        setMessage("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
        return;
      }
      const ok = window.confirm(
        `"${entry.name}"을 PC 켤 때 자동으로 뜨지 않게 잠시 보관할까요?\n\n파일은 포맷버디 안에 보관해서 다시 되돌릴 수 있어요.`
      );
      if (!ok) return;
      setBusyId(entry.id);
      setMessage(null);
      try {
        const result = await window.fb.disableStartupAuto({ entryId: entry.id });
        setMessage(result.message);
        await load();
      } catch (e) {
        setMessage(friendlyErrorMessage(e));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const handleRestore = useCallback(
    async (entry: StartupAutoDisabledEntry) => {
      if (!window.fb?.restoreStartupAuto) {
        setMessage("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
        return;
      }
      setBusyId(entry.id);
      setMessage(null);
      try {
        const result = await window.fb.restoreStartupAuto({ disabledId: entry.id });
        setMessage(result.message);
        await load();
      } catch (e) {
        setMessage(friendlyErrorMessage(e));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return (
    <main className="fb-report" aria-label="시작 시 자동 실행">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            {loading ? "조회 중..." : "다시 조회"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">PC 켤 때 같이 뜨는 것</h1>
        <p className="fb-lede">
          부팅 직후 자동으로 켜지는 앱을 한 화면에 모았어요. 시작 폴더 항목은 여기서 잠시
          꺼둘 수 있고, 나중에 다시 되돌릴 수 있어요. {summary}
        </p>
      </section>

      {message && (
        <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{message}</p>
        </section>
      )}

      {error && (
        <section className="fb-card fb-card-hover">
          <p>{error}</p>
          <Button variant="primary" size="sm" onClick={() => void load()}>
            다시 시도
          </Button>
        </section>
      )}

      {snapshot && snapshot.notes.length > 0 && (
        <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
          <strong>조회 메모</strong>
          <ul style={{ fontSize: 13, marginTop: 6 }}>
            {snapshot.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="fb-card fb-card-hover fb-anim-slide"
        style={{
          marginBottom: 16,
          borderLeft: "4px solid #10b981"
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>잠시 꺼둔 시작 항목</h2>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              포맷버디 안에 보관된 항목이에요. 필요하면 다시 PC 켤 때 같이 뜨게 돌려둘 수 있어요.
            </p>
          </div>
          <span
            style={{
              background: "#10b981",
              color: "#fff",
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {disabledEntries.length}개
          </span>
        </header>

        {disabledEntries.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
            아직 잠시 꺼둔 시작 항목이 없어요.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {disabledEntries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  padding: "10px 0",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 8,
                  alignItems: "center"
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{entry.name}</div>
                  <PathLine path={entry.originalPath} />
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    꺼둔 시각: {new Date(entry.disabledAt).toLocaleString("ko-KR")}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRestore(entry)}
                  disabled={busyId === entry.id}
                >
                  {busyId === entry.id ? "처리 중..." : "되돌리기"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.map((group, gIdx) => (
        <section
          key={group.kind}
          className="fb-card fb-card-hover fb-anim-slide"
          style={{
            marginBottom: 16,
            animationDelay: `${gIdx * 40}ms`,
            borderLeft: `4px solid ${group.color}`
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>{group.label}</h2>
              <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{group.hint}</p>
            </div>
            <span
              style={{
                background: group.color,
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {group.entries.length}개
            </span>
          </header>

          {group.entries.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
              이 영역에서는 자동 시작 항목을 찾지 못했어요.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
              {group.entries.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    padding: "10px 0",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 8,
                    alignItems: "center"
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{entry.name}</div>
                    <PathLine path={entry.path} />
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                      {entry.origin}
                      {entry.publisher ? ` · ${entry.publisher}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {typeof entry.enabled === "boolean" && (
                      <span
                        style={{
                          fontSize: 12,
                          alignSelf: "center",
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: entry.enabled ? "transparent" : "rgba(0,0,0,0.04)",
                          opacity: entry.enabled ? 1 : 0.7,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {entry.enabled ? "켜짐" : "꺼짐"}
                      </span>
                    )}
                    {canDisable(entry) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDisable(entry)}
                        disabled={busyId === entry.id}
                      >
                        {busyId === entry.id ? "처리 중..." : "잠시 끄기"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {snapshot && (
        <section className="fb-card fb-card-hover" style={{ marginBottom: 16, opacity: 0.7 }}>
          <p style={{ fontSize: 12, margin: 0 }}>
            조회 시각: {new Date(snapshot.capturedAt).toLocaleString("ko-KR")}
          </p>
        </section>
      )}
    </main>
  );
}
