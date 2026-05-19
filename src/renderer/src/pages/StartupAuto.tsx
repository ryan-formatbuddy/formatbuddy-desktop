import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import type {
  StartupAutoEntry,
  StartupAutoKind,
  StartupAutoSnapshot
} from "@shared/types";

interface StartupAutoProps {
  onBack: () => void;
}

/**
 * "PC 켤 때 같이 뜨는 것" (Round D-27 / B3 read-only)
 *
 * Surfaces the four startup sources Windows actually uses, grouped by
 * kind so the user can see which channel is loading what. Toggle
 * (Disable/Enable) lands in a follow-up round — this page is purely
 * descriptive on purpose. Selecting the wrong service to disable can
 * brick a boot, so we make the user explicitly read what's there
 * before we expose any switch.
 */
const KIND_LABEL: Record<StartupAutoKind, string> = {
  registry: "레지스트리 (Run)",
  "startup-folder": "시작 프로그램 폴더",
  "scheduled-task": "작업 스케줄러",
  service: "Windows 서비스"
};

const KIND_HINT: Record<StartupAutoKind, string> = {
  registry: "PC 켤 때 HKLM/HKCU Run 키에서 자동으로 켜져요. 끄기 가장 안전한 영역이에요.",
  "startup-folder": "시작 프로그램 폴더에 바로가기가 들어 있는 항목이에요.",
  "scheduled-task": "작업 스케줄러가 로그인/부팅 트리거로 실행해요. 시스템 작업도 섞여 있어서 잘 보고 끄세요.",
  service: "Windows 서비스 중 자동 시작으로 설정된 항목이에요. 시스템 핵심 서비스는 절대 끄지 마세요."
};

const KIND_COLOR: Record<StartupAutoKind, string> = {
  registry: "#0ea5e9",
  "startup-folder": "#16a34a",
  "scheduled-task": "#9333ea",
  service: "#dc2626"
};

const KIND_ORDER: StartupAutoKind[] = [
  "registry",
  "startup-folder",
  "scheduled-task",
  "service"
];

export function StartupAuto({ onBack }: StartupAutoProps) {
  const [snapshot, setSnapshot] = useState<StartupAutoSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!window.fb?.listStartupAuto) {
      setError("Electron 브리지를 찾지 못했어요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.fb.listStartupAuto();
      setSnapshot(result);
    } catch (e) {
      setError((e as Error).message);
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

  const total = snapshot?.entries.length ?? 0;
  const summary = snapshot
    ? snapshot.status === "ok"
      ? `${total}개 항목이 시작 시 자동으로 켜져요.`
      : snapshot.status === "windows-only"
        ? "시작 앱 깊은 조회는 Windows에서만 동작해요."
        : "조회 중 문제가 생겨 결과가 비어 있을 수 있어요."
    : "조회 중...";

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
          Windows가 부팅 / 로그인 직후 자동으로 실행하는 항목을 한 화면에 모았어요. 끄기는 다음
          단계에서 따로 추가할게요. 지금은 무엇이 켜지는지 먼저 확인해주세요. {summary}
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
                    gridTemplateColumns: "1fr auto",
                    gap: 8
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{entry.name}</div>
                    {entry.path && (
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
                      >
                        {entry.path}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                      {entry.origin}
                      {entry.publisher ? ` · ${entry.publisher}` : ""}
                    </div>
                  </div>
                  {typeof entry.enabled === "boolean" && (
                    <span
                      style={{
                        fontSize: 12,
                        alignSelf: "center",
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: entry.enabled ? "transparent" : "rgba(0,0,0,0.04)",
                        opacity: entry.enabled ? 1 : 0.7
                      }}
                    >
                      {entry.enabled ? "활성" : "비활성"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {snapshot && (
        <section className="fb-card fb-card-hover" style={{ marginBottom: 16, opacity: 0.7 }}>
          <p style={{ fontSize: 12, margin: 0 }}>
            조회 시각: {new Date(snapshot.capturedAt).toLocaleString("ko-KR")} · 상태: {snapshot.status}
          </p>
        </section>
      )}
    </main>
  );
}
