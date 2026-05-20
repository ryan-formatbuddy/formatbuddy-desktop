import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { restoreEntryExpiryLabel } from "@shared/cleanup-result";
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
  registry: "앱이 PC 켤 때 같이 뜨도록 등록한 항목이에요. 안전하게 확인되는 항목은 30일 복구함에 백업하고 잠시 끌 수 있어요.",
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
  if (entry.kind === "startup-folder") return Boolean(entry.path);
  return entry.kind === "registry" && Boolean(entry.registryKeyPath && entry.registryValueName);
}

function readonlyEntryHint(entry: StartupAutoEntry): string | null {
  if (entry.kind === "scheduled-task") {
    return "예약 작업은 업데이트·동기화 같은 조건 실행이 섞여 있어서 이번 버전에서는 보기만 해요.";
  }
  if (entry.kind === "service") {
    return "서비스는 보안·프린터·드라이버와 가까워서 앱에서 자동으로 끄지 않아요.";
  }
  return null;
}

function disabledEntryIntegrityLabel(entry: StartupAutoDisabledEntry): string {
  if (entry.integrityStatus === "changed") return "보관 파일 확인 필요";
  if (entry.integrityStatus === "legacy") return "오래된 보관 기록";
  if (entry.integrityStatus === "verified") return "바로 되돌릴 수 있어요";
  return "보관 상태 확인 중";
}

function disabledEntryIntegrityHint(entry: StartupAutoDisabledEntry): string | null {
  if (entry.integrityStatus === "changed") {
    return "보관된 파일이 처음과 달라 보여요. 자동으로 되돌리지 않고 다시 조회해볼게요.";
  }
  if (entry.integrityStatus === "legacy") {
    return "이전 버전에서 보관한 항목이라 파일 확인 기록이 부족해요. 자동으로 되돌리지 않아요.";
  }
  if (entry.integrityStatus && entry.integrityStatus !== "verified") {
    return "보관 상태를 확인한 뒤 되돌릴 수 있어요.";
  }
  return null;
}

function canRestoreDisabledEntry(entry: StartupAutoDisabledEntry): boolean {
  return entry.integrityStatus === "verified";
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

function StartupDisableConfirmDialog({
  entry,
  busy,
  onCancel,
  onConfirm
}: {
  entry: StartupAutoEntry;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isRegistryEntry = entry.kind === "registry";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-disable-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: 16
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          borderRadius: 12,
          background: "var(--color-fb-bg-elev)",
          color: "var(--color-fb-ink-1)",
          boxShadow: "var(--fb-shadow-3)",
          padding: 24
        }}
      >
        <h2 id="startup-disable-confirm-title" style={{ marginTop: 0 }}>
          PC 켤 때 같이 뜨지 않게 할까요?
        </h2>
        <p>
          <strong>{entry.name}</strong>을 잠시 꺼둘게요.
          {entry.publisher ? ` ${entry.publisher} 항목이에요.` : ""}
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          {isRegistryEntry
            ? "시작 설정은 포맷버디 복구함에 30일 동안 백업해요. 마음이 바뀌면 복구함에서 다시 PC 켤 때 같이 뜨게 되돌릴 수 있어요."
            : "파일은 포맷버디 안에 30일 동안 보관해요. 마음이 바뀌면 복구함이나 이 화면에서 다시 PC 켤 때 같이 뜨게 되돌릴 수 있어요."}
        </p>
        <PathLine path={entry.path} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? "보관하는 중..." : "30일 보관하고 잠시 끄기"}
          </Button>
        </div>
      </div>
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
  const [disableConfirm, setDisableConfirm] = useState<StartupAutoEntry | null>(null);

  const load = useCallback(async () => {
    if (!window.fb?.listStartupAuto) {
      setError("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auto = await window.fb.listStartupAuto();
      const disabled: StartupAutoDisabledSnapshot = window.fb.listDisabledStartupAuto
        ? await window.fb.listDisabledStartupAuto()
        : {
            capturedAt: new Date().toISOString(),
            entries: [],
            notes: ["잠시 꺼둔 시작 항목 목록을 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."]
          };
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

  const openStartupSettings = useCallback(async () => {
    if (!window.fb?.runActionCommand) {
      setMessage("Windows 시작 앱 설정을 연결하지 못했어요. Windows 설정에서 '시작 앱'을 검색해보세요.");
      return;
    }
    try {
      const result = await window.fb.runActionCommand("ms-settings:startupapps");
      if (result.mode === "opened-url") {
        setMessage("Windows 시작 앱 설정을 열었어요. 포맷버디에서 보기만 하는 항목은 거기서 한 번 더 확인해주세요.");
      } else if (result.mode === "copied-to-clipboard") {
        setMessage("Windows 시작 앱 설정 주소를 복사했어요. 실행 창에 붙여넣어 열 수 있어요.");
      } else {
        setMessage("Windows 시작 앱 설정을 바로 열지 못했어요. Windows 설정에서 '시작 앱'을 검색해보세요.");
      }
    } catch {
      setMessage("Windows 시작 앱 설정을 바로 열지 못했어요. Windows 설정에서 '시작 앱'을 검색해보세요.");
    }
  }, []);

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
  const disabledNotes = disabledSnapshot?.notes ?? [];
  const summary = shortStatus(snapshot);

  const handleDisable = useCallback((entry: StartupAutoEntry) => {
    if (!canDisable(entry)) return;
    setDisableConfirm(entry);
  }, []);

  const runConfirmedDisable = useCallback(
    async () => {
      const entry = disableConfirm;
      if (!entry) return;
      if (!window.fb?.disableStartupAuto) {
        setDisableConfirm(null);
        setMessage("앱 연결을 확인하지 못했어요. 포맷버디를 다시 열어주세요.");
        return;
      }
      setBusyId(entry.id);
      setMessage(null);
      try {
        const result = await window.fb.disableStartupAuto({ entryId: entry.id });
        setMessage(result.message);
        setDisableConfirm(null);
        await load();
      } catch (e) {
        setMessage(friendlyErrorMessage(e));
        setDisableConfirm(null);
      } finally {
        setBusyId(null);
      }
    },
    [disableConfirm, load]
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
          <Button variant="secondary" size="sm" onClick={() => void openStartupSettings()}>
            Windows 시작 앱 설정 열기
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
          꺼둘 수 있고, 30일 안에 다시 되돌릴 수 있어요. {summary}
        </p>
        <p style={{ fontSize: 13, opacity: 0.72 }}>
          서비스와 예약 작업은 Windows와 가까워서 자동으로 끄지 않아요. 대신 어떤 항목인지 보여드리고,
          필요하면 Windows 시작 앱 설정도 열어 일반 시작 앱부터 직접 확인할 수 있게 이어드려요.
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
              포맷버디 안에 30일 동안 보관된 항목이에요. 필요하면 다시 PC 켤 때 같이 뜨게 돌려둘 수 있어요.
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
                    꺼둔 시각: {new Date(entry.disabledAt).toLocaleString("ko-KR")} ·{" "}
                    {restoreEntryExpiryLabel(entry.expiresAt)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 6
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: canRestoreDisabledEntry(entry) ? "#047857" : "#b45309",
                        background: canRestoreDisabledEntry(entry) ? "#dcfce7" : "#fef3c7",
                        padding: "2px 8px",
                        borderRadius: 999
                      }}
                    >
                      {disabledEntryIntegrityLabel(entry)}
                    </span>
                    {disabledEntryIntegrityHint(entry) && (
                      <span style={{ fontSize: 12, opacity: 0.72 }}>
                        {disabledEntryIntegrityHint(entry)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRestore(entry)}
                  disabled={busyId === entry.id || !canRestoreDisabledEntry(entry)}
                >
                  {busyId === entry.id
                    ? "처리 중..."
                    : canRestoreDisabledEntry(entry)
                      ? "되돌리기"
                      : "확인 필요"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {disabledNotes.length > 0 && (
          <ul style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
            {disabledNotes.map((note, i) => (
              <li key={i}>{note}</li>
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
                    {!canDisable(entry) && readonlyEntryHint(entry) && (
                      <div style={{ fontSize: 12, opacity: 0.68, marginTop: 4 }}>
                        {readonlyEntryHint(entry)}
                      </div>
                    )}
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
                    {canDisable(entry) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDisable(entry)}
                        disabled={busyId === entry.id}
                      >
                        {busyId === entry.id ? "처리 중..." : "잠시 끄기"}
                      </Button>
                    ) : readonlyEntryHint(entry) ? (
                      <span
                        style={{
                          fontSize: 12,
                          alignSelf: "center",
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.14)",
                          opacity: 0.72,
                          whiteSpace: "nowrap"
                        }}
                      >
                        보기만
                      </span>
                    ) : null}
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
      {disableConfirm && (
        <StartupDisableConfirmDialog
          entry={disableConfirm}
          busy={busyId === disableConfirm.id}
          onCancel={() => setDisableConfirm(null)}
          onConfirm={() => void runConfirmedDisable()}
        />
      )}
    </main>
  );
}
