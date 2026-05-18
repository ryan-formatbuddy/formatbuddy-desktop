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

## Pre-launch checklist (출시 전 처리)

본격 출시 — 외부 채널 마케팅, 사용자 100명 이상, 또는 비즈니스 사용 — 전에 정리해야 할 항목들. preview/베타 단계인 지금은 의도적으로 deferred.

### Must-have (출시 전 결정 필요)

- [ ] **Windows 코드 사이닝 인증서** 결정
  - 현재 상태: unsigned `.exe` → 사용자가 SmartScreen "More info → Run anyway" 2단계 클릭 필요
  - 옵션 A — **EV 인증서 (~$500/년)**: USB 하드웨어 토큰, SmartScreen 즉시 깨끗
  - 옵션 B — OV 인증서 (~$300/년): 다운로드 reputation 쌓일 때까지 한동안 경고 유지
  - 옵션 C — **MS Store 입점 ($19 일회성)**: MSIX 변환 필요, Store가 업데이트도 처리
  - 옵션 D — 현 상태 유지 + 한국어 SmartScreen 가이드
  - **의사결정 시점**: 사용자 100명 이상 또는 외부 마케팅 직전. 현재는 D 유지.
- [ ] **사용자 안내 (한국어)** — Release notes / 랜딩 페이지에 SmartScreen "More info → Run anyway" 가이드 + 스크린샷
- [ ] **개인정보 처리방침 / 이용약관** — 진단 100% 로컬이지만 명문화 필요 (한국 개인정보보호법 대비)
- [ ] **`webPreferences.spellcheck` 등 nice-to-have 보안 옵션 한 번 더 점검**

### Phase 2 기능

- [ ] **macOS 포팅** — zsh/bash 진단 스크립트 (NPKI/winget 컨텍스트 없음 → Mac 전용 진단 항목 재설계: Time Machine, FileVault, brew, iCloud 등) + electron-builder mac 타깃
- [ ] **electron-updater `verifyUpdateCodeSignature`** — Windows 코드 사이닝 인증서 확보 후 활성화 (현재는 unsigned라 비활성)
- [ ] **`@claude` GitHub Action** — `web/`에 이미 설치된 `claude-pr-review.yml`을 desktop repo에도 적용

### Nice-to-have

- [ ] Storybook 컴포넌트 카탈로그
- [ ] 다국어 (영어/일본어) 카피
- [ ] Telemetry opt-in (사용 통계, 명시적 동의 사용자만, 100% 로컬 원칙 위반 주의)
- [ ] 한국어 macOS notarization 가이드 (Mac 포팅 후)

### 이미 처리됨

- [x] Codex 코드 리뷰 5번 사이클 (v0.1.0 → v0.3.1, 22개 findings 모두 fix)
- [x] PowerShell 무결성 검증 (app.asar-anchored hash + per-run mkdtemp staging + ReparsePoint 필터)
- [x] Auto-update infrastructure (electron-updater + GitHub Releases, repo public 전환 완료)
- [x] 백업 manifest (SHA-256 per-file) + winget export 통합
- [x] CSP / sandbox: true / IPC bridge 최소 노출 / window.open https-only
- [x] 디자인 핸드오프 적용 + 카피 톤 규칙 (살펴봤어요 / 같이 챙길게요)
