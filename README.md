# FormatBuddy Desktop

Windows-only PC 포맷 동행 데스크탑 앱. Electron + React + TypeScript.

기존 `local-agent/Invoke-FormatBuddyScan.ps1` PowerShell 진단을 GUI로 감싸고, `design_handoff_format_buddy/`의 디자인을 그대로 적용했습니다.

## Quick start

```bash
npm install
npm run dev          # Electron 개발 창 (mock scan으로 동작 검증)
npm run typecheck
npm run lint
npm run test
npm run build
npm run dist:win     # → dist/FormatBuddy-Setup-X.Y.Z-x64.exe
```

## 검증 한계

| 항목 | macOS에서 가능 | Windows 실기 필요 |
|------|---------------|-------------------|
| 코드 컴파일 / lint / test | O | — |
| Electron UI 렌더링 (mock scan) | O | — |
| `.exe` 패키지 생성 (cross-build) | O | — |
| 실제 PowerShell 진단 실행 | X | O |
| UAC 권한 흐름 | X | O |
| Windows 폰트 렌더링 정확도 | X | O |

## Privacy

- 100% 로컬 동작. 서버 업로드 없음.
- 인증서 개인키, 비밀번호, 브라우저 저장 비밀번호 수집하지 않음.
- 사용자가 export한 JSON만 웹 리포트 뷰어(`/report/import`)로 직접 이동.

## Structure

- `src/main/` — Electron 메인 프로세스, PowerShell 호출
- `src/preload/` — contextBridge로 안전한 IPC 노출
- `src/renderer/` — React UI (Home / Scanning / Report 3페이지)
- `src/shared/` — 메인/렌더러 공유 타입 + IPC 채널 상수
- `resources/powershell/` — `Invoke-FormatBuddyScan.ps1` (extraResources로 번들)
- `resources/fonts/` — Wanted Sans Variable, Pretendard Variable
- `resources/icons/` — 로고 SVG + 앱 아이콘
- `tests/` — Vitest unit tests (scanner mock, IPC bridge)

## 문서

- [사용 가이드 (한국어)](docs/USER_GUIDE.md) — 다운로드부터 백업 manifest까지 step-by-step
- [자주 묻는 질문 (FAQ)](docs/FAQ.md) — SmartScreen 안내, 무엇을 수집/안 함, 트러블슈팅
- [개인정보 처리방침 (초안)](docs/PRIVACY_POLICY.md) — 100% 로컬 동작 명문화
- [이용약관 (초안)](docs/TERMS_OF_SERVICE.md) — 한국 약관규제법 기본 원칙
- [전체 출시 체크리스트](LAUNCH_READINESS.md) — 분야별 P0~P3 + 자율 가능 여부

## Pre-launch checklist (요약)

전체 체크리스트는 [LAUNCH_READINESS.md](LAUNCH_READINESS.md) 참조. 출시 전 결정이 필요한 Must 항목만:

- [ ] **Windows 코드 사이닝 결정** (EV $500/yr / OV $300/yr / MS Store $19 / unsigned + 가이드). 현재 deferred — 사용자 100+ 시점 검토
- [ ] **LICENSE 결정** (현재 UNLICENSED)
- [ ] **Windows 실기 검증** (Ryan): 인스톨러 → quick scan → 백업 manifest → 자동 업데이트
- [ ] **앱 스크린샷 5장** (Ryan, Windows 실기)
- [x] 개인정보 처리방침 / 이용약관 초안 (`docs/` 안)
- [x] FAQ + 사용 가이드 한국어 (`docs/` 안)
- [x] CI 자동화 (PR/push마다 typecheck/lint/test/build)
- [x] GitHub Issue 템플릿 (`.github/ISSUE_TEMPLATE/`)
- [x] Codex 5사이클 22개 findings 모두 fix
- [x] PowerShell 무결성 (app.asar-anchored hash + TOCTOU-safe staging + ReparsePoint 필터)
- [x] Auto-update 인프라 (repo public 전환 완료)
- [x] 백업 manifest + winget export
- [x] CSP / sandbox / IPC 보안 baseline
- [x] 디자인 핸드오프 적용
