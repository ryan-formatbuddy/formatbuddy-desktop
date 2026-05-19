import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";

interface PermissionsProps {
  onBack: () => void;
}

interface PermissionItem {
  what: string;
  why: string;
  /** PowerShell command, registry path, or API name we actually touch. */
  evidence?: string;
}

interface PermissionCategory {
  id: string;
  title: string;
  intro: string;
  badge: string;
  badgeColor: string;
  items: PermissionItem[];
}

/**
 * v2.0 — Permissions manifest. Everything FormatBuddy does on the user's
 * PC is listed here in plain Korean. We update this list any time a new
 * action lands (cleanup engine, app uninstaller, defender bridge, etc.)
 * so a user can answer "이 앱이 내 PC에서 정확히 뭘 해?" in one screen.
 *
 * Source-of-truth pairing:
 *   - 읽음 : main/scanner.ts + resources/powershell/Invoke-FormatBuddyScan.ps1
 *   - 씀   : main/localState.ts, main/cleanup/log.ts, manifest/HTML export
 *   - 실행 : main/cleanup/executor.ts (trashItem), main/apps/uninstaller.ts,
 *            main/security/defender.ts, main/index.ts runActionCommand
 *   - 안 함: web/CLAUDE.md privacy bullets + ui-tone-guard test
 */
const CATEGORIES: PermissionCategory[] = [
  {
    id: "read",
    title: "읽는 것",
    intro: "PC를 살펴보기 위해 읽기만 해요. 내용을 어디로도 보내지 않아요.",
    badge: "읽기",
    badgeColor: "#2563eb",
    items: [
      {
        what: "디스크/메모리/CPU 정보",
        why: "PC 상태를 점수로 알려드리기 위해서요.",
        evidence: "Get-CimInstance Win32_OperatingSystem / Win32_LogicalDisk"
      },
      {
        what: "설치된 프로그램 목록",
        why: "포맷 후 다시 깔 앱과 정리 후보를 보여드리기 위해서요.",
        evidence: "HKLM/HKCU\\Software\\…\\Uninstall (이름·버전·제조사만)"
      },
      {
        what: "Windows 업데이트 / 이벤트 로그 / 드라이버 날짜",
        why: "PC가 얼마나 지쳐 있는지 객관적으로 보여드리기 위해서요.",
        evidence: "Get-CimInstance Win32_QuickFixEngineering / Get-WinEvent"
      },
      {
        what: "사용자 폴더의 파일 이름·크기·수정 시각",
        why: "큰 파일과 중복 후보를 보여드리기 위해서요.",
        evidence: "Get-ChildItem (Desktop / Documents / Downloads / Videos …)"
      },
      {
        what: "Windows 보안 (Defender) 상태",
        why: "실시간 보호가 켜져 있는지, 마지막 검사 날짜가 언제인지 보여드리기 위해서요.",
        evidence: "Get-MpComputerStatus / Get-MpThreatDetection"
      },
      {
        what: "공동인증서(NPKI) / 클라우드 / Wi-Fi 프로필 존재 여부",
        why: "포맷 전에 챙겨야 할 항목을 안내하기 위해서요.",
        evidence: "Test-Path NPKI / netsh wlan show profiles (이름만)"
      },
      {
        what: "브라우저 설치 여부 / 북마크 파일 존재 여부",
        why: "포맷 전에 챙길 브라우저를 표시하기 위해서요.",
        evidence: "Test-Path Chrome / Edge / Whale / Firefox 폴더"
      }
    ]
  },
  {
    id: "write",
    title: "쓰는 것",
    intro: "Ryan의 PC 안에만 저장해요. 모두 로컬 파일이에요.",
    badge: "쓰기",
    badgeColor: "#0ea5e9",
    items: [
      {
        what: "점검 기록 / 정리 후보 무시 목록 / 모니터 설정",
        why: "이전 결과와 비교하고 다음 점검을 빠르게 하기 위해서요.",
        evidence: "%APPDATA%/FormatBuddy/formatbuddy-state.json + formatbuddy-monitor-prefs.json"
      },
      {
        what: "정리/제거 실행 기록 (감사 로그)",
        why: "내가 뭘 정리했는지 나중에 확인할 수 있게 하기 위해서요.",
        evidence: "%APPDATA%/FormatBuddy/formatbuddy-cleanup-log.json"
      },
      {
        what: "사용자가 선택한 위치에 진단 리포트(HTML/JSON) 저장",
        why: "공유하거나 따로 보관하기 위해서요. 저장은 Ryan이 직접 위치를 골라야 진행해요.",
        evidence: "dialog.showSaveDialog → fs.writeFile"
      }
    ]
  },
  {
    id: "execute",
    title: "실행하는 것",
    intro: "사용자가 명시적으로 확인할 때만 실행해요. 자동 실행은 없어요.",
    badge: "실행",
    badgeColor: "#9333ea",
    items: [
      {
        what: "선택한 파일을 Windows 휴지통으로 이동",
        why: "안전 정리 후보 중 사용자가 직접 체크한 항목만 보내요.",
        evidence: "Electron shell.trashItem (휴지통에서 복원 가능)"
      },
      {
        what: "Windows 기본 제거 마법사 실행",
        why: "사용자가 앱 매니저에서 '제거' 버튼을 눌렀을 때만요.",
        evidence: "cmd.exe /c <UninstallString> (cached scan에서 main이 lookup)"
      },
      {
        what: "Windows Defender 빠른 검사 시작",
        why: "사용자가 보안 페이지에서 '검사 시작' 버튼을 눌렀을 때만요.",
        evidence: "Start-MpScan -ScanType QuickScan (detached, Windows Security UI 사용)"
      },
      {
        what: "Windows 설정 화면 열기",
        why: "Windows 업데이트·저장 공간·앱 목록 같은 기본 화면으로 안내하기 위해서요.",
        evidence: "shell.openExternal(ms-settings:…, windowsdefender:…)"
      }
    ]
  },
  {
    id: "never",
    title: "절대 하지 않는 것",
    intro: "안전과 신뢰의 한계선이에요. 코드와 테스트로 막혀 있어요.",
    badge: "안 함",
    badgeColor: "#dc2626",
    items: [
      {
        what: "비밀번호 / 인증서 개인키 / 브라우저 Login Data 읽기",
        why: "필요 없어요. 위치만 보고 폴더 존재 여부만 확인해요.",
        evidence: "blocklist.ts — Login Data / Cookies / NPKI 절대 차단"
      },
      {
        what: "파일 자동 삭제",
        why: "정리는 항상 사용자 명시 선택 + 휴지통 이동이 기본이에요.",
        evidence: "cleanup/executor.ts requires confirmationToken + selectedItemIds"
      },
      {
        what: "결과·로그 외부 서버 전송",
        why: "모든 처리가 로컬이에요. 사용자가 직접 저장한 리포트만 공유돼요.",
        evidence: "텔레메트리 옵션 OFF 기본 (출시 후 사용자 동의 시에만 익명만)"
      },
      {
        what: "백신처럼 위협 직접 치료",
        why: "Windows Defender의 작업만 그대로 표시해요.",
        evidence: "ui-tone-guard.test.ts blocks 치료/감염/제거 완료 카피"
      },
      {
        what: "관리자 권한 없이 시스템 폴더 변경",
        why: "System32 / Program Files / 레지스트리 하이브 등은 모두 차단 경로에 있어요.",
        evidence: "blocklist.ts SYSTEM_BLOCK_RULES"
      }
    ]
  }
];

export function Permissions({ onBack }: PermissionsProps) {
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
        <h1 className="fb-h1-sm">포맷버디가 내 PC에서 하는 일</h1>
        <p className="fb-lede">
          무엇을 읽고, 어디에 쓰고, 어떤 행동을 실행하는지 한 화면에 모았어요. 안 하는 것까지
          명시해뒀어요. 항목은 코드와 테스트로 묶여 있어서 슬며시 바뀌지 않아요.
        </p>
      </section>

      {CATEGORIES.map((cat) => (
        <section
          key={cat.id}
          className="fb-card"
          style={{ marginBottom: 16 }}
          aria-labelledby={`perm-${cat.id}-title`}
        >
          <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                background: cat.badgeColor,
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {cat.badge}
            </span>
            <h2 id={`perm-${cat.id}-title`} style={{ margin: 0 }}>
              {cat.title}
            </h2>
          </header>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>{cat.intro}</p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {cat.items.map((item, idx) => (
              <li
                key={`${cat.id}-${idx}`}
                style={{
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  padding: "10px 0"
                }}
              >
                <div style={{ fontWeight: 500 }}>{item.what}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{item.why}</div>
                {item.evidence && (
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.55,
                      marginTop: 4,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
                    }}
                  >
                    {item.evidence}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="fb-card">
        <h3 style={{ marginTop: 0 }}>이 화면을 보고도 의심스러우면</h3>
        <p style={{ fontSize: 14 }}>
          이 앱의 소스 코드는 모두 공개돼 있어요. 진단 결과 파일(JSON)을 메모장으로 열어
          포맷버디가 어떤 정보를 기록했는지 직접 확인할 수도 있어요.
        </p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          뭔가 잘못 보였다면 보고해주세요. 보안 신고는 우선 처리할게요.
        </p>
      </section>
    </main>
  );
}

export const __testing = { CATEGORIES };
