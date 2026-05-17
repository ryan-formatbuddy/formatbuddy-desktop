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
