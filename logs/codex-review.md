OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e36df-feba-7193-ab70-ef477f6f4b37
--------
user
# Full code review request — FormatBuddy Desktop

## Project context

Electron + React + TypeScript, Windows-only desktop app. Scaffolded autonomously in one overnight session. Wraps a PowerShell PC-diagnostic script (Invoke-FormatBuddyScan.ps1) with a GUI.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (private)
- Release v0.1.0: https://github.com/ryan-formatbuddy/formatbuddy-desktop/releases/tag/v0.1.0
- macOS cross-build: typecheck / lint / vitest (6/6) / electron-vite build / electron-builder dist:win all pass
- NOT YET verified on a real Windows machine (the human will do that separately — not your scope)

## Review scope

Please produce a severity-rated review (CRITICAL / HIGH / MEDIUM / LOW / NIT).

For each finding:
- One line: file:line — issue
- One line: suggested fix
- No praise. Issues only. If a section has no issues, write "no issues".

### 1. Electron security baseline
- `src/main/index.ts`: BrowserWindow webPreferences (contextIsolation, nodeIntegration, sandbox), window-open handler, ipcMain handlers
- `src/preload/index.ts`: contextBridge surface — does any exposed function leak privileged capability beyond what the renderer needs?
- `src/renderer/index.html` CSP — is it tight enough? Anything we should add?
- `electron-builder.yml` asar / asarUnpack — do unpacked resources widen the attack surface?

### 2. PowerShell invocation safety
- `src/main/scanner.ts`: spawn() arguments, no shell:true, abort signal handling, stderr capture limits
- Any path where user-controlled data flows into powershell args?
- `-ExecutionPolicy Bypass` risks
- Output JSON parsing — any prototype pollution / unsafe JSON.parse risk?

### 3. Design handoff fidelity
Compare `/Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy/HANDOFF.md` (single source of truth) against:
- `src/renderer/src/components/CloudBuddy.tsx`
- `src/renderer/src/components/ScanCard.tsx`
- `src/renderer/src/components/Lockup.tsx`
- `src/renderer/src/components/ScoreRing.tsx`
- `src/renderer/src/styles/globals.css` (tokens, typography, motion keyframes)

Hard rules to enforce:
- Background = #FFFFFF only, key color = #0066FF only (no cream/dark/grey surfaces)
- Wanted Sans Variable + Pretendard fallback
- No dark mode, no emoji in product UI, no hard grid patterns / colored shadows

Copy tone (`src/shared/copy.ts`):
- Preferred: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
- Avoid: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
- Flag any string that violates these (and any I missed)

### 4. Code quality
- Any use of `any` or unsafe casts (especially in IPC payloads)?
- AbortController cancellation: is the cancel path race-safe in both main and renderer?
- IPC error propagation: do failed scans always reach `onScanError` in the renderer?
- `App.tsx` useEffect: listeners cleanup, stale closures, dependency array correctness
- `main/index.ts` `activeAbort` global: race condition if two startScan calls land back-to-back?
- Memory: any retained closures / event listeners that don't get removed on window close?

### 5. Build / packaging
- `electron-builder.yml`: extraResources copy correctness (PowerShell + fonts + icons reachable at runtime via process.resourcesPath?)
- NSIS settings reasonable for first-time Korean users?
- `tsconfig.json` references + `tsconfig.node.json` + `tsconfig.web.json` consistency
- `electron.vite.config.ts`: any prod-only setting missing (minify, sourcemap policy, asset inlining limit)?

### 6. Dependency health
- `package.json` — any obviously deprecated or known-vulnerable headline (no full audit needed)
- electron 33.3.1 / react 19 / vite 5.4.11 / electron-vite 2.3.0 compatibility caveats?
- Should I lock electron to a specific patch?

### 7. Anything else you'd flag a teammate about
Free form — anything that smells.

## What I do NOT need
- Praise or "this is well-structured"
- General architecture sermons
- Suggestions to add features

Just issues + fixes. Cite file:line. Be terse.
2026-05-17T16:58:30.520683Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-17T16:58:30.749055Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'cat /Users/ryanbak/.agents/skills/user/cto-code-review/SKILL.md' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
---
name: cto-code-review
description: "'코드 리뷰', 'CTO 리뷰', '강민혁 리뷰', '작지 검토', '기술 검토', '아키텍처 리뷰' 등을 말할 때 이 스킬을 사용하세요. CTO 강민혁이 코드/아키텍처/보안/비용 관점에서 리뷰합니다."
---

# CTO 코드 리뷰 — 강민혁

## 개요
CTO 강민혁(토스 서버 챕터 리드 3년 + 당근마켓 백엔드 테크리드 2년)이
코드, 아키텍처, 보안, 비용 관점에서 리뷰.

---

## 호출 방법

| 호출 | 동작 |
|------|------|
| "코드 리뷰" / "CTO 리뷰" | 전체 코드 리뷰 |
| "작지 검토" | 작지(작업지시서) 기술 검토 |
| "아키텍처 리뷰" | 아키텍처/설계 관점 리뷰 |
| "비용 체크" | API/인프라 비용 시뮬레이션 |
| "보안 체크" | 보안 체크리스트 10항목 점검 |

---

## 리뷰 프레임워크

### Phase 1 — 작지 검토 체크리스트
| 항목 | 체크 |
|------|------|
| DB 스키마 변경 | 마이그레이션 필요 여부, 인덱스 |
| API Route 설계 | RESTful 원칙, 네이밍, 버전관리 |
| 의존성 추가 | 번들 사이즈, 라이선스, 유지보수 |
| Rate Limiting | IP/사용자/API별 제한 설정 |
| 환경변수 | NEXT_PUBLIC_ 노출 여부 |
| Supabase RLS | Row Level Security 정책 |
| N+1 쿼리 | 쿼리 최적화, join/batch 여부 |
| Codex API 비용 | 월 예상 비용 시뮬레이션 |
| 에러 핸들링 | 사용자 영향, 폴백 전략 |
| 테스트 커버리지 | 핵심 로직 테스트 존재 여부 |

### Phase 2 — 아키텍처 원칙
- **YAGNI** — 필요없으면 안 만듦. 2인 팀이면 사치야.
- **수직 슬라이스** — DB→API→UI 한 번에 완성
- **3단계 스케일링** — 1만→10만→100만 유저 단계별 설계
- **기술부채 20% 할당** — 스프린트마다 리팩토링 시간 확보
- **비용 대시보드** — "이 API 비용이면 월 이만큼"

### Phase 3 — 보안 체크리스트 10항목
1. 인증/인가 (JWT, RLS)
2. API Rate Limiting
3. 입력값 검증 (SQL Injection, XSS)
4. 환경변수 노출
5. CORS 설정
6. SERVICE_ROLE_KEY 서버사이드 한정
7. 에러 메시지 정보 노출
8. 파일 업로드 검증
9. 로깅 민감정보 제외
10. 의존성 취약점 (npm audit)

---

## 출력 형식

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 CTO 강민혁 — 코드 리뷰
대상: [리뷰 대상]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 작지 검토
[체크리스트 항목별 ✅/⚠️/❌]

🏗️ 아키텍처
[설계 관점 피드백]

🔒 보안
[보안 체크리스트 결과]

💰 비용
[API/인프라 월 예상 비용]

📊 종합 판정: ✅승인 / ⚠️수정 필요 / ❌재작성
[수정사항 우선순위 + 이번 주 액션]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 핵심 원칙

- "돌아가게 먼저. 예쁘게는 사용자 오고 나서"
- "2인 팀이면 사치야" — 오버엔지니어링 경계
- "테스트 안 하면 터져" — 핵심 로직은 반드시 테스트
- 숫자로 말한다 — 비용, TPS, 응답시간 구체적 명시

exec
/bin/zsh -lc "git status --short && printf '\\n--- files ---\\n' && find . -maxdepth 4 -type f | sed 's#"'^./##'"' | sort | head -200" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2701ms:
2026-05-18 01:58:46.876 xcodebuild[45927:40844821]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 01:58:47.133 xcodebuild[45927:40844820] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-4X46xnHG' (errno=Operation not permitted)
2026-05-18 01:58:47.745 xcodebuild[45929:40844835]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 01:58:47.886 xcodebuild[45929:40844834] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? .omc/
?? logs/

--- files ---
.git/COMMIT_EDITMSG
.git/HEAD
.git/config
.git/description
.git/hooks/applypatch-msg.sample
.git/hooks/commit-msg.sample
.git/hooks/fsmonitor-watchman.sample
.git/hooks/post-update.sample
.git/hooks/pre-applypatch.sample
.git/hooks/pre-commit.sample
.git/hooks/pre-merge-commit.sample
.git/hooks/pre-push.sample
.git/hooks/pre-rebase.sample
.git/hooks/pre-receive.sample
.git/hooks/prepare-commit-msg.sample
.git/hooks/push-to-checkout.sample
.git/hooks/sendemail-validate.sample
.git/hooks/update.sample
.git/index
.git/info/exclude
.git/logs/HEAD
.git/objects/02/5b4d883729a26f75210d781eaaa6780c129bc1
.git/objects/08/ff04e0ab75d8fb8fb09c60a1933b9f6d68b5c4
.git/objects/0e/92179efec29637e3c6f52be41393c1db299fbc
.git/objects/12/497d03f178d8b2c154f929fd9542305664b6b7
.git/objects/13/977cc3dc7abdc42d2ef27adb315d3fa7daaecf
.git/objects/13/ad61cab8f048a72fdfbe1f31f96b81479ffa76
.git/objects/14/e63511e215014a21da344cc5c96b600255ffc6
.git/objects/15/5ebaa6759855152876985c5984541283abb0a1
.git/objects/19/f5efcca51d9535457de714dd70250885eab774
.git/objects/1e/23ce35c918d2682bb885fcd17332d954cc06a7
.git/objects/20/ae6122456540122b0d527b267bab49f1550138
.git/objects/25/b856556a624510ef4ca4a1b40e431bca352209
.git/objects/28/e21a5cee81af004f074f4fc7524df45cd3b33f
.git/objects/29/c95a7b820e646821b0e6d2ad993ec13f5a5d09
.git/objects/2b/463ac311f3dcd8f786e1e135e01f55d735973b
.git/objects/2e/f8ba9bb268afdf3eb2ed9e4b0ec172591db780
.git/objects/32/b0811eae2cbfeb5f6ddaf34015ecaa726b006a
.git/objects/33/ddf09c114964c8e14f807c23679c26206508cd
.git/objects/35/9881eaac6bcf154de7213aa667d82bea2600f8
.git/objects/36/066dc76a4ebeda0e81216d80ae83c949ab43b6
.git/objects/36/bf14ad64e68f9850f2358eaa55d3cf80617ff5
.git/objects/3d/96a935bd4688d911c5ee70f819943f6d30b233
.git/objects/3f/5e186d1b5e9370eae5085bba6ae3fb759a6aa6
.git/objects/40/740820bd8277561eab0dfe15a918f8b240eae4
.git/objects/48/4f8aceaa6dcb78528f5c16a70b2e9cbd726470
.git/objects/4a/536e777e88255e4c8ea7c4b9a2afa36ad0b045
.git/objects/4c/ba341dac96f0869c8651b7ce84c0e78a2a8dfe
.git/objects/4d/fc3b58161c33640f240f2839fdb256ab6d353e
.git/objects/53/217428538940fec64575b4c71f46893ebdcb8c
.git/objects/63/a8bd6026efda1cc931ba54999e7748ab524238
.git/objects/6d/3b9842683d4baf28909e4d8da173629e73c868
.git/objects/71/c461af5b40a5b1434164dc5dfca8476b351feb
.git/objects/75/8b90465c4055916b7d3e780e7ddd741a40736f
.git/objects/7c/2b1aa916c4867a008b6cff4c3e36b0bed09878
.git/objects/87/85eccfb524d7259c85e10584e2825a7983e544
.git/objects/8c/9bdd709496cf1c4ceed965676a73ec2985bed1
.git/objects/8d/46c2c2745f9db88c7f3ae318b26889762f5f41
.git/objects/93/938d6cefbbc23750617849bd8a65d02cf914b1
.git/objects/96/883c26882a2b005b1ce6543bba6b1b463c6613
.git/objects/9e/1c1fe9491c873f57eeeb20490b1a532628b45c
.git/objects/a4/0e1785b8e1557cb7a107ba8fab4d032822dab9
.git/objects/ac/6c780177f8ae53a2793c9ebc098af8e29c1ee3
.git/objects/af/a856d0b3080945a07cbb8d3c0aa51de0ba8bf9
.git/objects/b0/a6e2e043c6a0d339c2b99afbecd85ee22fb098
.git/objects/b2/97647a7c7b37c19d15884f7234bd7b0c82607a
.git/objects/b2/c0464f7ac8c236981a106b032657468c01770c
.git/objects/bd/fb9dce6b3a000dcfc572168c992f4d6ca789b3
.git/objects/c0/3d19fbe3466d243203869512bb3e40c435763e
.git/objects/c0/b07042e7053f36c89ac7ece089b2a61157f480
.git/objects/c4/013d07e7e95a3ed7b62038aff1566665826abc
.git/objects/c9/2ad2764fadfa7649533d33a712d2ef305e4bd4
.git/objects/d9/491bdaa3031afbceb609263fe7587c53f6b905
.git/objects/df/0fcfbe5b6a7df105d2202909b67aa6f5e9156f
.git/objects/e4/97498f09d3f93b4d9a20b895e1ced7f265a6cc
.git/objects/e6/daf6faccdac2217766f995ec9607a445197c83
.git/objects/ee/6c2e302a1b8b4bd447073b76a3a6baa899b2cc
.git/objects/f0/c789f61eddce8f8b67bcb7558eaee59a00a585
.git/objects/f6/7868ac3417f493609d19aa00ea0afef084c347
.git/objects/f7/828e4771dd4ae00c78a304f3b233516cc7325a
.git/objects/f8/dc8d42ca578cef9a0ee04306beb77b87d87150
.git/objects/fa/363dc165edcfebe686d0ef29e917baa0f1cfe5
.git/refs/heads/main
.gitignore
.npmrc
.omc/state/idle-notif-cooldown.json
README.md
dist/FormatBuddy-Setup-0.1.0-x64.exe
dist/FormatBuddy-Setup-0.1.0-x64.exe.blockmap
dist/builder-debug.yml
dist/latest.yml
dist/win-unpacked/FormatBuddy.exe
dist/win-unpacked/LICENSE.electron.txt
dist/win-unpacked/LICENSES.chromium.html
dist/win-unpacked/chrome_100_percent.pak
dist/win-unpacked/chrome_200_percent.pak
dist/win-unpacked/d3dcompiler_47.dll
dist/win-unpacked/ffmpeg.dll
dist/win-unpacked/icudtl.dat
dist/win-unpacked/libEGL.dll
dist/win-unpacked/libGLESv2.dll
dist/win-unpacked/locales/af.pak
dist/win-unpacked/locales/am.pak
dist/win-unpacked/locales/ar.pak
dist/win-unpacked/locales/bg.pak
dist/win-unpacked/locales/bn.pak
dist/win-unpacked/locales/ca.pak
dist/win-unpacked/locales/cs.pak
dist/win-unpacked/locales/da.pak
dist/win-unpacked/locales/de.pak
dist/win-unpacked/locales/el.pak
dist/win-unpacked/locales/en-GB.pak
dist/win-unpacked/locales/en-US.pak
dist/win-unpacked/locales/es-419.pak
dist/win-unpacked/locales/es.pak
dist/win-unpacked/locales/et.pak
dist/win-unpacked/locales/fa.pak
dist/win-unpacked/locales/fi.pak
dist/win-unpacked/locales/fil.pak
dist/win-unpacked/locales/fr.pak
dist/win-unpacked/locales/gu.pak
dist/win-unpacked/locales/he.pak
dist/win-unpacked/locales/hi.pak
dist/win-unpacked/locales/hr.pak
dist/win-unpacked/locales/hu.pak
dist/win-unpacked/locales/id.pak
dist/win-unpacked/locales/it.pak
dist/win-unpacked/locales/ja.pak
dist/win-unpacked/locales/kn.pak
dist/win-unpacked/locales/ko.pak
dist/win-unpacked/locales/lt.pak
dist/win-unpacked/locales/lv.pak
dist/win-unpacked/locales/ml.pak
dist/win-unpacked/locales/mr.pak
dist/win-unpacked/locales/ms.pak
dist/win-unpacked/locales/nb.pak
dist/win-unpacked/locales/nl.pak
dist/win-unpacked/locales/pl.pak
dist/win-unpacked/locales/pt-BR.pak
dist/win-unpacked/locales/pt-PT.pak
dist/win-unpacked/locales/ro.pak
dist/win-unpacked/locales/ru.pak
dist/win-unpacked/locales/sk.pak
dist/win-unpacked/locales/sl.pak
dist/win-unpacked/locales/sr.pak
dist/win-unpacked/locales/sv.pak
dist/win-unpacked/locales/sw.pak
dist/win-unpacked/locales/ta.pak
dist/win-unpacked/locales/te.pak
dist/win-unpacked/locales/th.pak
dist/win-unpacked/locales/tr.pak
dist/win-unpacked/locales/uk.pak
dist/win-unpacked/locales/ur.pak
dist/win-unpacked/locales/vi.pak
dist/win-unpacked/locales/zh-CN.pak
dist/win-unpacked/locales/zh-TW.pak
dist/win-unpacked/resources.pak
dist/win-unpacked/resources/app-update.yml
dist/win-unpacked/resources/app.asar
dist/win-unpacked/resources/elevate.exe
dist/win-unpacked/snapshot_blob.bin
dist/win-unpacked/v8_context_snapshot.bin
dist/win-unpacked/vk_swiftshader.dll
dist/win-unpacked/vk_swiftshader_icd.json
dist/win-unpacked/vulkan-1.dll
electron-builder.yml
electron.vite.config.ts
eslint.config.mjs
logs/build.log
logs/codex-review.md
logs/dist-win.log
logs/lint.log
logs/npm-install.log
logs/test.log
logs/typecheck.log
node_modules/.package-lock.json
node_modules/.vite/vitest/results.json
node_modules/7zip-bin/7x.sh
node_modules/7zip-bin/LICENSE.txt
node_modules/7zip-bin/README.md
node_modules/7zip-bin/index.d.ts
node_modules/7zip-bin/index.js
node_modules/7zip-bin/package.json
node_modules/@asamuzakjp/css-color/LICENSE
node_modules/@asamuzakjp/css-color/README.md
node_modules/@asamuzakjp/css-color/package.json
node_modules/@babel/code-frame/LICENSE
node_modules/@babel/code-frame/README.md
node_modules/@babel/code-frame/package.json
node_modules/@babel/compat-data/LICENSE
node_modules/@babel/compat-data/README.md
node_modules/@babel/compat-data/corejs2-built-ins.js
node_modules/@babel/compat-data/corejs3-shipped-proposals.js
node_modules/@babel/compat-data/native-modules.js
node_modules/@babel/compat-data/overlapping-plugins.js
node_modules/@babel/compat-data/package.json
node_modules/@babel/compat-data/plugin-bugfixes.js
node_modules/@babel/compat-data/plugins.js
node_modules/@babel/core/LICENSE
node_modules/@babel/core/README.md

exec
/bin/zsh -lc "printf '%s\\n' '--- package.json ---'; nl -ba package.json; printf '%s\\n' '--- electron-builder.yml ---'; nl -ba electron-builder.yml; printf '%s\\n' '--- electron.vite.config.ts ---'; nl -ba electron.vite.config.ts; printf '%s\\n' '--- tsconfig root ---'; nl -ba tsconfig.json; printf '%s\\n' '--- tsconfig node ---'; nl -ba tsconfig.node.json; printf '%s\\n' '--- tsconfig web ---'; nl -ba tsconfig.web.json" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- package.json ---
     1	{
     2	  "name": "formatbuddy-desktop",
     3	  "version": "0.1.0",
     4	  "private": true,
     5	  "description": "FormatBuddy Desktop — Windows-only PC format companion built on Electron.",
     6	  "author": {
     7	    "name": "FormatBuddy",
     8	    "email": "support@formatbuddy.app"
     9	  },
    10	  "license": "UNLICENSED",
    11	  "main": "out/main/index.js",
    12	  "scripts": {
    13	    "dev": "electron-vite dev",
    14	    "build": "electron-vite build",
    15	    "preview": "electron-vite preview",
    16	    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    17	    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    18	    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    19	    "lint": "eslint .",
    20	    "test": "vitest run",
    21	    "test:watch": "vitest",
    22	    "dist:win": "electron-vite build && electron-builder --win --publish never"
    23	  },
    24	  "dependencies": {
    25	    "@electron-toolkit/preload": "3.0.1",
    26	    "@electron-toolkit/utils": "3.0.0"
    27	  },
    28	  "devDependencies": {
    29	    "@tailwindcss/vite": "4.0.6",
    30	    "@testing-library/react": "16.1.0",
    31	    "@types/node": "22.10.5",
    32	    "@types/react": "19.0.7",
    33	    "@types/react-dom": "19.0.3",
    34	    "@typescript-eslint/eslint-plugin": "8.20.0",
    35	    "@typescript-eslint/parser": "8.20.0",
    36	    "@vitejs/plugin-react": "4.3.4",
    37	    "electron": "33.3.1",
    38	    "electron-builder": "25.1.8",
    39	    "electron-vite": "2.3.0",
    40	    "eslint": "9.18.0",
    41	    "eslint-plugin-react": "7.37.4",
    42	    "eslint-plugin-react-hooks": "5.1.0",
    43	    "jsdom": "26.0.0",
    44	    "react": "19.0.0",
    45	    "react-dom": "19.0.0",
    46	    "tailwindcss": "4.0.6",
    47	    "typescript": "5.7.3",
    48	    "vite": "5.4.11",
    49	    "vitest": "2.1.8"
    50	  }
    51	}
--- electron-builder.yml ---
     1	appId: app.formatbuddy.desktop
     2	productName: FormatBuddy
     3	copyright: Copyright (c) ${author}
     4	directories:
     5	  output: dist
     6	  buildResources: resources
     7	
     8	files:
     9	  - out/**/*
    10	  - package.json
    11	  - "!**/.vscode/*"
    12	  - "!**/{.eslintrc.cjs,.eslintrc,.prettierrc,.editorconfig,.gitignore,.npmrc}"
    13	  - "!**/{tsconfig.*,vite.config.*,vitest.config.*,electron-builder.yml,electron.vite.config.*}"
    14	
    15	extraResources:
    16	  - from: resources/powershell
    17	    to: powershell
    18	  - from: resources/fonts
    19	    to: fonts
    20	  - from: resources/icons
    21	    to: icons
    22	
    23	win:
    24	  target:
    25	    - target: nsis
    26	      arch:
    27	        - x64
    28	  artifactName: ${productName}-Setup-${version}-${arch}.${ext}
    29	  icon: resources/icons/app-icon.ico
    30	  # Phase 1: unsigned. macOS cross-build cannot run Windows signtool.
    31	  # Ryan must accept SmartScreen warning on first launch on Windows.
    32	  signtoolOptions: null
    33	  signAndEditExecutable: false
    34	  verifyUpdateCodeSignature: false
    35	
    36	nsis:
    37	  oneClick: false
    38	  perMachine: false
    39	  allowToChangeInstallationDirectory: true
    40	  createDesktopShortcut: true
    41	  shortcutName: FormatBuddy
    42	  installerLanguages:
    43	    - ko_KR
    44	    - en_US
    45	
    46	asar: true
    47	asarUnpack:
    48	  - resources/**
--- electron.vite.config.ts ---
     1	import { resolve } from "node:path";
     2	import { defineConfig, externalizeDepsPlugin } from "electron-vite";
     3	import react from "@vitejs/plugin-react";
     4	
     5	export default defineConfig({
     6	  main: {
     7	    plugins: [externalizeDepsPlugin()],
     8	    build: {
     9	      outDir: "out/main",
    10	      rollupOptions: {
    11	        input: { index: resolve(__dirname, "src/main/index.ts") }
    12	      }
    13	    },
    14	    resolve: {
    15	      alias: { "@shared": resolve(__dirname, "src/shared") }
    16	    }
    17	  },
    18	  preload: {
    19	    plugins: [externalizeDepsPlugin()],
    20	    build: {
    21	      outDir: "out/preload",
    22	      rollupOptions: {
    23	        input: { index: resolve(__dirname, "src/preload/index.ts") }
    24	      }
    25	    },
    26	    resolve: {
    27	      alias: { "@shared": resolve(__dirname, "src/shared") }
    28	    }
    29	  },
    30	  renderer: {
    31	    root: resolve(__dirname, "src/renderer"),
    32	    plugins: [react()],
    33	    build: {
    34	      outDir: resolve(__dirname, "out/renderer"),
    35	      rollupOptions: {
    36	        input: { index: resolve(__dirname, "src/renderer/index.html") }
    37	      }
    38	    },
    39	    resolve: {
    40	      alias: {
    41	        "@renderer": resolve(__dirname, "src/renderer/src"),
    42	        "@shared": resolve(__dirname, "src/shared")
    43	      }
    44	    },
    45	    server: {
    46	      port: 5273
    47	    }
    48	  }
    49	});
--- tsconfig root ---
     1	{
     2	  "files": [],
     3	  "references": [
     4	    { "path": "./tsconfig.node.json" },
     5	    { "path": "./tsconfig.web.json" }
     6	  ]
     7	}
--- tsconfig node ---
     1	{
     2	  "compilerOptions": {
     3	    "target": "ES2022",
     4	    "module": "ESNext",
     5	    "moduleResolution": "Bundler",
     6	    "lib": ["ES2022"],
     7	    "types": ["node", "electron-vite/node"],
     8	    "strict": true,
     9	    "noUnusedLocals": true,
    10	    "noUnusedParameters": true,
    11	    "esModuleInterop": true,
    12	    "resolveJsonModule": true,
    13	    "skipLibCheck": true,
    14	    "isolatedModules": true,
    15	    "composite": true,
    16	    "outDir": "out/types-node",
    17	    "baseUrl": ".",
    18	    "paths": {
    19	      "@shared/*": ["src/shared/*"],
    20	      "@main/*": ["src/main/*"]
    21	    }
    22	  },
    23	  "include": [
    24	    "electron.vite.config.ts",
    25	    "src/main/**/*.ts",
    26	    "src/preload/**/*.ts",
    27	    "src/shared/**/*.ts",
    28	    "tests/**/*.test.ts"
    29	  ]
    30	}
--- tsconfig web ---
     1	{
     2	  "compilerOptions": {
     3	    "target": "ES2022",
     4	    "module": "ESNext",
     5	    "moduleResolution": "Bundler",
     6	    "lib": ["ES2022", "DOM", "DOM.Iterable"],
     7	    "types": ["vite/client"],
     8	    "jsx": "react-jsx",
     9	    "strict": true,
    10	    "noUnusedLocals": true,
    11	    "noUnusedParameters": true,
    12	    "esModuleInterop": true,
    13	    "resolveJsonModule": true,
    14	    "skipLibCheck": true,
    15	    "isolatedModules": true,
    16	    "composite": true,
    17	    "outDir": "out/types-web",
    18	    "baseUrl": ".",
    19	    "paths": {
    20	      "@renderer/*": ["src/renderer/src/*"],
    21	      "@shared/*": ["src/shared/*"]
    22	    }
    23	  },
    24	  "include": [
    25	    "src/renderer/src/**/*.ts",
    26	    "src/renderer/src/**/*.tsx",
    27	    "src/shared/**/*.ts",
    28	    "src/preload/index.d.ts"
    29	  ]
    30	}

exec
/bin/zsh -lc "for f in src/main/index.ts src/main/scanner.ts src/preload/index.ts src/preload/index.d.ts src/renderer/index.html src/renderer/src/App.tsx src/shared/copy.ts src/renderer/src/components/CloudBuddy.tsx src/renderer/src/components/ScanCard.tsx src/renderer/src/components/Lockup.tsx src/renderer/src/components/ScoreRing.tsx src/renderer/src/styles/globals.css; do echo '---' "'$f; nl -ba $f; done' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- src/main/index.ts
     1	import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type { ExportOptions, ExportResult, ScanError, ScanProgress, ScanResult } from "@shared/types";
     7	import { runScan } from "./scanner";
     8	import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
     9	
    10	let mainWindow: BrowserWindow | null = null;
    11	let activeAbort: AbortController | null = null;
    12	
    13	function createWindow() {
    14	  mainWindow = new BrowserWindow({
    15	    width: 1080,
    16	    height: 760,
    17	    minWidth: 880,
    18	    minHeight: 640,
    19	    show: false,
    20	    autoHideMenuBar: true,
    21	    backgroundColor: "#FFFFFF",
    22	    title: "FormatBuddy",
    23	    webPreferences: {
    24	      preload: join(__dirname, "..", "preload", "index.js"),
    25	      contextIsolation: true,
    26	      nodeIntegration: false,
    27	      sandbox: false
    28	    }
    29	  });
    30	
    31	  mainWindow.on("ready-to-show", () => {
    32	    mainWindow?.show();
    33	  });
    34	
    35	  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    36	    shell.openExternal(url);
    37	    return { action: "deny" };
    38	  });
    39	
    40	  if (process.env.ELECTRON_RENDERER_URL) {
    41	    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    42	  } else {
    43	    void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
    44	  }
    45	}
    46	
    47	function registerIpc() {
    48	  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
    49	
    50	  ipcMain.handle(IpcChannels.scanStart, async (event) => {
    51	    if (activeAbort) activeAbort.abort();
    52	    activeAbort = new AbortController();
    53	    const sender = event.sender;
    54	
    55	    const emit = (progress: ScanProgress) => {
    56	      if (sender.isDestroyed()) return;
    57	      sender.send(IpcChannels.scanProgress, progress);
    58	    };
    59	
    60	    try {
    61	      const result: ScanResult = await runScan({
    62	        scriptPath: getScanScriptPath(),
    63	        outputDir: getScanOutputDir(),
    64	        signal: activeAbort.signal,
    65	        onProgress: emit
    66	      });
    67	      if (!sender.isDestroyed()) {
    68	        sender.send(IpcChannels.scanComplete, result);
    69	      }
    70	      return result;
    71	    } catch (err) {
    72	      const e = err as Error;
    73	      const payload: ScanError = {
    74	        message: e.message,
    75	        code: (e as NodeJS.ErrnoException).code ?? undefined,
    76	        detail: e.stack
    77	      };
    78	      if (!sender.isDestroyed()) {
    79	        sender.send(IpcChannels.scanError, payload);
    80	      }
    81	      throw payload;
    82	    } finally {
    83	      activeAbort = null;
    84	    }
    85	  });
    86	
    87	  ipcMain.handle(IpcChannels.scanCancel, () => {
    88	    if (activeAbort) {
    89	      activeAbort.abort();
    90	      activeAbort = null;
    91	      return true;
    92	    }
    93	    return false;
    94	  });
    95	
    96	  ipcMain.handle(
    97	    IpcChannels.reportExport,
    98	    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
    99	      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
   100	      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   101	      const dialogResult = await dialog.showSaveDialog(win!, {
   102	        title: "리포트 JSON 저장",
   103	        defaultPath,
   104	        filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
   105	      });
   106	      if (dialogResult.canceled || !dialogResult.filePath) {
   107	        return { saved: false };
   108	      }
   109	      await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
   110	      return { saved: true, path: dialogResult.filePath };
   111	    }
   112	  );
   113	
   114	  ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
   115	    await shell.openExternal(getWebReportImportUrl());
   116	    return true;
   117	  });
   118	}
   119	
   120	app.whenReady().then(() => {
   121	  electronApp.setAppUserModelId("app.formatbuddy.desktop");
   122	
   123	  app.on("browser-window-created", (_event, window) => {
   124	    optimizer.watchWindowShortcuts(window);
   125	  });
   126	
   127	  registerIpc();
   128	  createWindow();
   129	
   130	  app.on("activate", () => {
   131	    if (BrowserWindow.getAllWindows().length === 0) createWindow();
   132	  });
   133	});
   134	
   135	app.on("window-all-closed", () => {
   136	  if (process.platform !== "darwin") app.quit();
   137	});
--- src/main/scanner.ts
     1	import { spawn } from "node:child_process";
     2	import { existsSync, mkdirSync, promises as fs } from "node:fs";
     3	import { dirname, join } from "node:path";
     4	import { randomUUID } from "node:crypto";
     5	import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
     6	
     7	export interface RunScanOptions {
     8	  scriptPath: string;
     9	  outputDir: string;
    10	  onProgress?: (progress: ScanProgress) => void;
    11	  powershellExe?: string;
    12	  signal?: AbortSignal;
    13	  /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
    14	  mock?: boolean;
    15	}
    16	
    17	const PIPELINE_STEPS: readonly string[] = [
    18	  "PC 정보 확인",
    19	  "디스크 살펴보기",
    20	  "사용자 폴더 챙기기",
    21	  "설치 앱 / 드라이버 목록",
    22	  "인증서·Wi-Fi·클라우드",
    23	  "포맷 체크리스트 정리"
    24	];
    25	
    26	const TOTAL_STEPS = PIPELINE_STEPS.length;
    27	
    28	function buildSteps(activeIndex: number): ScanStepView[] {
    29	  return PIPELINE_STEPS.map((name, i) => {
    30	    if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
    31	    if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
    32	    return { name, state: "pending", detail: "대기" };
    33	  });
    34	}
    35	
    36	function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
    37	  const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
    38	  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
    39	  return {
    40	    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
    41	    doneSteps: safeIndex,
    42	    totalSteps: TOTAL_STEPS,
    43	    score,
    44	    elapsedMs: Date.now() - startedAt,
    45	    steps: buildSteps(safeIndex),
    46	    message
    47	  };
    48	}
    49	
    50	export async function runScan(options: RunScanOptions): Promise<ScanResult> {
    51	  const { onProgress, signal, mock } = options;
    52	  const startedAt = Date.now();
    53	
    54	  ensureDir(options.outputDir);
    55	  const outPath = join(options.outputDir, `report-${randomUUID()}.json`);
    56	
    57	  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
    58	
    59	  if (mock || process.platform !== "win32") {
    60	    return runMockScan({ outPath, startedAt, onProgress, signal });
    61	  }
    62	
    63	  return runPowershellScan({ ...options, outPath, startedAt });
    64	}
    65	
    66	function ensureDir(dir: string) {
    67	  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    68	}
    69	
    70	interface InternalRunArgs {
    71	  outPath: string;
    72	  startedAt: number;
    73	  onProgress?: (progress: ScanProgress) => void;
    74	  signal?: AbortSignal;
    75	}
    76	
    77	async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
    78	  const { outPath, startedAt, onProgress, signal } = args;
    79	
    80	  for (let i = 1; i <= TOTAL_STEPS; i++) {
    81	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
    82	    await delay(380);
    83	    onProgress?.(progressFor(i, startedAt));
    84	  }
    85	
    86	  const report: ScanReport = buildMockReport();
    87	  ensureDir(dirname(outPath));
    88	  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
    89	
    90	  return { report, jsonPath: outPath };
    91	}
    92	
    93	interface PowershellRunArgs extends RunScanOptions {
    94	  outPath: string;
    95	  startedAt: number;
    96	}
    97	
    98	function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
    99	  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   100	  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   101	
   102	  return new Promise<ScanResult>((resolveScan, rejectScan) => {
   103	    const child = spawn(
   104	      exe,
   105	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
   106	      { windowsHide: true }
   107	    );
   108	
   109	    let activeIndex = 0;
   110	    let stderrBuf = "";
   111	    const tick = setInterval(() => {
   112	      if (activeIndex < TOTAL_STEPS) {
   113	        activeIndex += 1;
   114	        onProgress?.(progressFor(activeIndex, startedAt));
   115	      }
   116	    }, 700);
   117	
   118	    const cleanup = () => {
   119	      clearInterval(tick);
   120	      signal?.removeEventListener("abort", onAbort);
   121	    };
   122	
   123	    const onAbort = () => {
   124	      child.kill();
   125	      cleanup();
   126	      rejectScan(new DOMException("Scan cancelled", "AbortError"));
   127	    };
   128	
   129	    if (signal) {
   130	      if (signal.aborted) {
   131	        onAbort();
   132	        return;
   133	      }
   134	      signal.addEventListener("abort", onAbort, { once: true });
   135	    }
   136	
   137	    child.stderr.on("data", (chunk: Buffer) => {
   138	      stderrBuf += chunk.toString("utf8");
   139	    });
   140	
   141	    child.on("error", (err) => {
   142	      cleanup();
   143	      rejectScan(err);
   144	    });
   145	
   146	    child.on("close", async (code) => {
   147	      cleanup();
   148	      if (code !== 0) {
   149	        rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
   150	        return;
   151	      }
   152	      try {
   153	        const raw = await fs.readFile(outPath, "utf8");
   154	        const report = JSON.parse(raw) as ScanReport;
   155	        onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
   156	        resolveScan({ report, jsonPath: outPath });
   157	      } catch (e) {
   158	        rejectScan(e as Error);
   159	      }
   160	    });
   161	  });
   162	}
   163	
   164	function delay(ms: number) {
   165	  return new Promise<void>((res) => setTimeout(res, ms));
   166	}
   167	
   168	function buildMockReport(): ScanReport {
   169	  return {
   170	    schemaVersion: "0.1.0",
   171	    generatedAt: new Date().toISOString(),
   172	    privacy: {
   173	      localOnly: true,
   174	      noPasswordCollection: true,
   175	      noPrivateKeyUpload: true,
   176	      noBrowserPasswordExtraction: true
   177	    },
   178	    system: {
   179	      manufacturer: "Mock",
   180	      model: "DevPreview",
   181	      serialNumberMasked: "***0000",
   182	      osCaption: "Windows 11 Pro (mock)",
   183	      osVersion: "10.0.22631",
   184	      cpu: "Mock CPU",
   185	      memoryGb: 16
   186	    },
   187	    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
   188	    userFolders: [
   189	      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
   190	      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
   191	      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
   192	    ],
   193	    gpu: ["Mock GPU"],
   194	    installedApps: [
   195	      { name: "Chrome", version: "131.0", publisher: "Google" },
   196	      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
   197	    ],
   198	    drivers: [],
   199	    printers: [],
   200	    wifiProfiles: ["home", "office"],
   201	    npkiCandidates: [
   202	      { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
   203	      { path: "C:\\NPKI", exists: false }
   204	    ],
   205	    bitlocker: [],
   206	    cloudSync: [
   207	      { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
   208	      { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
   209	    ],
   210	    browsers: [
   211	      { name: "Chrome", installed: true },
   212	      { name: "Edge", installed: true },
   213	      { name: "Firefox", installed: false },
   214	      { name: "Whale", installed: true }
   215	    ],
   216	    winget: { available: true, note: "winget is available. App export can be added in Phase 2." },
   217	    diagnostics: [],
   218	    checklist: {
   219	      reviewNpkiManually: true,
   220	      exportWifiProfilesManually: true,
   221	      backupDesktopDocumentsDownloads: true,
   222	      verifyCloudSync: true,
   223	      saveReportBeforeFormat: true
   224	    }
   225	  };
   226	}
   227	
   228	export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor };
--- src/preload/index.ts
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ExportOptions,
     5	  ExportResult,
     6	  ScanError,
     7	  ScanProgress,
     8	  ScanReport,
     9	  ScanResult
    10	} from "@shared/types";
    11	
    12	type ProgressListener = (progress: ScanProgress) => void;
    13	type CompleteListener = (result: ScanResult) => void;
    14	type ErrorListener = (error: ScanError) => void;
    15	
    16	const fb = {
    17	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    18	
    19	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    20	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    21	
    22	  onScanProgress(cb: ProgressListener): () => void {
    23	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    24	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    25	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    26	  },
    27	  onScanComplete(cb: CompleteListener): () => void {
    28	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    29	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    30	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    31	  },
    32	  onScanError(cb: ErrorListener): () => void {
    33	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    34	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    35	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    36	  },
    37	
    38	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    39	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    40	
    41	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb)
    42	};
    43	
    44	contextBridge.exposeInMainWorld("fb", fb);
    45	
    46	export type FbBridge = typeof fb;
--- src/preload/index.d.ts
     1	import type { FbBridge } from "./index";
     2	
     3	declare global {
     4	  interface Window {
     5	    fb: FbBridge;
     6	  }
     7	}
     8	
     9	export {};
--- src/renderer/index.html
     1	<!doctype html>
     2	<html lang="ko">
     3	  <head>
     4	    <meta charset="UTF-8" />
     5	    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     6	    <meta http-equiv="Content-Security-Policy"
     7	      content="default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'" />
     8	    <title>FormatBuddy</title>
     9	  </head>
    10	  <body>
    11	    <div id="root"></div>
    12	    <script type="module" src="/src/main.tsx"></script>
    13	  </body>
    14	</html>
--- src/renderer/src/App.tsx
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     6	
     7	type Phase =
     8	  | { kind: "home" }
     9	  | { kind: "scanning"; progress: ScanProgress }
    10	  | { kind: "report"; result: ScanResult }
    11	  | { kind: "error"; error: ScanError };
    12	
    13	const INITIAL_PROGRESS: ScanProgress = {
    14	  step: "준비",
    15	  doneSteps: 0,
    16	  totalSteps: 6,
    17	  score: 0,
    18	  elapsedMs: 0,
    19	  steps: [
    20	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    21	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    22	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    23	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    24	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    25	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    26	  ]
    27	};
    28	
    29	export function App() {
    30	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    31	  const [appVersion, setAppVersion] = useState<string>("");
    32	
    33	  useEffect(() => {
    34	    if (typeof window.fb?.appVersion === "function") {
    35	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    36	    }
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    if (!window.fb) return;
    41	    const offProgress = window.fb.onScanProgress((p) => {
    42	      setPhase((prev) =>
    43	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    44	      );
    45	    });
    46	    const offComplete = window.fb.onScanComplete((r) => {
    47	      setPhase({ kind: "report", result: r });
    48	    });
    49	    const offError = window.fb.onScanError((err) => {
    50	      setPhase({ kind: "error", error: err });
    51	    });
    52	    return () => {
    53	      offProgress();
    54	      offComplete();
    55	      offError();
    56	    };
    57	  }, []);
    58	
    59	  const startScan = useCallback(async () => {
    60	    if (!window.fb) {
    61	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    62	      return;
    63	    }
    64	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    65	    try {
    66	      await window.fb.startScan();
    67	    } catch {
    68	      // 에러는 onScanError 이벤트로 처리
    69	    }
    70	  }, []);
    71	
    72	  const cancelScan = useCallback(async () => {
    73	    if (!window.fb) return;
    74	    await window.fb.cancelScan();
    75	    setPhase({ kind: "home" });
    76	  }, []);
    77	
    78	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    79	
    80	  const content = useMemo(() => {
    81	    switch (phase.kind) {
    82	      case "home":
    83	        return <Home onStartScan={startScan} />;
    84	      case "scanning":
    85	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    86	      case "report":
    87	        return <Report result={phase.result} onBack={goHome} />;
    88	      case "error":
    89	        return (
    90	          <Scanning
    91	            progress={INITIAL_PROGRESS}
    92	            errorMessage={phase.error.message}
    93	            onCancel={goHome}
    94	            onRetry={startScan}
    95	          />
    96	        );
    97	    }
    98	  }, [phase, startScan, cancelScan, goHome]);
    99	
   100	  return (
   101	    <div className="fb-app">
   102	      {content}
   103	      <footer className="fb-app-footer">
   104	        <span>FormatBuddy Desktop</span>
   105	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   106	      </footer>
   107	    </div>
   108	  );
   109	}
--- src/shared/copy.ts
     1	/**
     2	 * 카피 톤 가이드는 web/CLAUDE.md 기준.
     3	 * 권장: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
     4	 * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
     5	 */
     6	export const copy = {
     7	  appName: "포맷버디",
     8	  appNameEn: "FORMAT BUDDY",
     9	
    10	  homeEyebrow: "PC 포맷 동행 데스크탑",
    11	  homeTitle1: "포맷하기 전에,",
    12	  homeTitle2: "버디가 같이",
    13	  homeTitle3: "살펴볼게요.",
    14	  homeLede:
    15	    "공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와드려요.",
    16	  homeStartCta: "PC 점검 시작",
    17	  homeOpenReportCta: "리포트 열기",
    18	
    19	  scanTitle: "버디가 살펴보는 중",
    20	  scanWaiting: "잠깐, 진단 준비할게요",
    21	  scanLiveLabel: "진단 중",
    22	  scanCancelCta: "그만하기",
    23	
    24	  reportTitle: "살펴봤어요",
    25	  reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
    26	  reportExportCta: "JSON으로 저장",
    27	  reportOpenWebCta: "웹 리포트 뷰어 열기",
    28	  reportBackCta: "처음으로",
    29	
    30	  privacyHeadline: "Ryan의 PC 안에서만 동작해요",
    31	  privacyBullets: [
    32	    "서버로 어떤 파일도 보내지 않아요",
    33	    "인증서 개인키·비밀번호는 수집하지 않아요",
    34	    "JSON 리포트는 Ryan이 직접 저장하고 공유해요"
    35	  ],
    36	
    37	  errorHeadline: "지금 진단을 마치지 못했어요",
    38	  errorRetryCta: "다시 시도",
    39	
    40	  windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
    41	  windowsOnlyBody:
    42	    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요."
    43	} as const;
--- src/renderer/src/components/CloudBuddy.tsx
     1	// CloudBuddy — 포맷버디 브랜드 마크. 240×240 viewBox.
     2	// 모션은 CSS-only (globals.css의 .cb-* 키프레임).
     3	
     4	import type { Ref } from "react";
     5	
     6	type Variant = "primary" | "on-blue";
     7	type Expression = "smile" | "calm" | "wink";
     8	
     9	const FB_BLUE = "#0066FF";
    10	const FB_WHITE = "#FFFFFF";
    11	
    12	function getPalette(variant: Variant) {
    13	  if (variant === "on-blue") return { body: FB_WHITE, face: FB_BLUE };
    14	  return { body: FB_BLUE, face: FB_WHITE };
    15	}
    16	
    17	export interface CloudBuddyProps {
    18	  size?: number;
    19	  variant?: Variant;
    20	  expression?: Expression;
    21	  animated?: boolean;
    22	  blink?: boolean;
    23	  pulse?: boolean;
    24	  ariaLabel?: string;
    25	  className?: string;
    26	  ref?: Ref<SVGSVGElement>;
    27	}
    28	
    29	export function CloudBuddy({
    30	  size = 200,
    31	  variant = "primary",
    32	  expression = "smile",
    33	  animated = false,
    34	  blink = false,
    35	  pulse = false,
    36	  ariaLabel = "포맷버디",
    37	  className,
    38	  ref
    39	}: CloudBuddyProps) {
    40	  const c = getPalette(variant);
    41	  const wantBlink = blink || animated;
    42	  const wantPulse = pulse || animated;
    43	  const classes = [wantBlink || wantPulse ? "cb-animated" : "", className]
    44	    .filter(Boolean)
    45	    .join(" ");
    46	
    47	  return (
    48	    <svg
    49	      ref={ref}
    50	      width={size}
    51	      height={size}
    52	      viewBox="0 0 240 240"
    53	      fill="none"
    54	      role="img"
    55	      aria-label={ariaLabel}
    56	      className={classes || undefined}
    57	      style={{ overflow: "visible" }}
    58	    >
    59	      {wantPulse && (
    60	        <g>
    61	          <g className="cb-pulse-wrap cb-pulse-1">
    62	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    63	          </g>
    64	          <g className="cb-pulse-wrap cb-pulse-2">
    65	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    66	          </g>
    67	        </g>
    68	      )}
    69	
    70	      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />
    71	
    72	      {wantPulse && (
    73	        <g>
    74	          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    75	          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    76	        </g>
    77	      )}
    78	
    79	      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />
    80	
    81	      <g fill={c.body}>
    82	        <ellipse cx="74" cy="146" rx="42" ry="40" />
    83	        <ellipse cx="120" cy="124" rx="50" ry="48" />
    84	        <ellipse cx="166" cy="146" rx="40" ry="38" />
    85	        <rect x="56" y="146" width="128" height="42" rx="10" />
    86	      </g>
    87	
    88	      {expression !== "wink" && (
    89	        <g className="cb-eye cb-eye-l">
    90	          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    91	        </g>
    92	      )}
    93	      <g className="cb-eye cb-eye-r">
    94	        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    95	      </g>
    96	
    97	      {expression === "smile" && (
    98	        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
    99	      )}
   100	      {expression === "calm" && <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />}
   101	      {expression === "wink" && (
   102	        <>
   103	          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" fill="none" />
   104	          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
   105	        </>
   106	      )}
   107	    </svg>
   108	  );
   109	}
--- src/renderer/src/components/ScanCard.tsx
     1	// ScanCard — 진단 진행 카드.
     2	// web 버전을 Electron 환경 + 일반 CSS 변수 기반으로 단순화.
     3	
     4	import type { ScanStepView } from "@shared/types";
     5	import { CloudBuddy } from "./CloudBuddy";
     6	import { ScoreRing } from "./ScoreRing";
     7	
     8	export interface ScanCardProps {
     9	  score: number;
    10	  elapsedLabel: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  steps: ScanStepView[];
    14	  title?: string;
    15	  liveLabel?: string;
    16	}
    17	
    18	function CheckIcon({ size = 13 }: { size?: number }) {
    19	  return (
    20	    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    21	      <path d="M3 7.5 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    22	    </svg>
    23	  );
    24	}
    25	
    26	function SpinIcon({ size = 12 }: { size?: number }) {
    27	  return (
    28	    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="fb-spin">
    29	      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    30	      <path d="M10.5 6 A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    31	    </svg>
    32	  );
    33	}
    34	
    35	export function ScanCard({
    36	  score,
    37	  elapsedLabel,
    38	  doneSteps,
    39	  totalSteps,
    40	  steps,
    41	  title = "버디가 살펴보는 중",
    42	  liveLabel = "진단 중"
    43	}: ScanCardProps) {
    44	  return (
    45	    <div className="scan-card">
    46	      <div className="scan-card-head">
    47	        <div className="scan-card-who">
    48	          <CloudBuddy size={36} variant="primary" expression="smile" animated />
    49	          <div className="scan-card-who-meta">
    50	            <div className="scan-card-title">{title}</div>
    51	            <div className="scan-card-elapsed">{elapsedLabel}</div>
    52	          </div>
    53	        </div>
    54	        <div className="scan-card-live">
    55	          <span className="scan-card-live-dot" />
    56	          {liveLabel}
    57	        </div>
    58	      </div>
    59	
    60	      <div className="scan-score">
    61	        <div>
    62	          <div className="scan-score-label">버디 진행 점수</div>
    63	          <div className="scan-score-value">
    64	            {score}
    65	            <span className="scan-score-unit">점</span>
    66	          </div>
    67	          <div className="scan-score-sub">
    68	            전체 {totalSteps}단계 중 {doneSteps}단계 살펴봤어요
    69	          </div>
    70	        </div>
    71	        <ScoreRing value={score} />
    72	      </div>
    73	
    74	      <div className="scan-steps">
    75	        {steps.map((s, i) => (
    76	          <div key={`${s.name}-${i}`} className={`scan-step ${s.state}`}>
    77	            <div className="scan-step-idx">{s.state === "done" ? <CheckIcon /> : i + 1}</div>
    78	            <div className="scan-step-name">{s.name}</div>
    79	            <div className="scan-step-state">
    80	              {s.state === "active" && <SpinIcon />}
    81	              {s.detail}
    82	            </div>
    83	          </div>
    84	        ))}
    85	      </div>
    86	    </div>
    87	  );
    88	}
--- src/renderer/src/components/Lockup.tsx
     1	// Lockup — CloudBuddy 마크 + 한글 워드마크 (옵션: 영문 서브)
     2	import { CloudBuddy } from "./CloudBuddy";
     3	
     4	const FB_BLUE = "#0066FF";
     5	const FB_WHITE = "#FFFFFF";
     6	const INK_1 = "#0E1116";
     7	
     8	export interface LockupProps {
     9	  markSize?: number;
    10	  kanjiSize?: number;
    11	  variant?: "primary" | "on-blue";
    12	  en?: boolean;
    13	  color?: string;
    14	  animated?: boolean;
    15	  className?: string;
    16	}
    17	
    18	export function Lockup({
    19	  markSize = 44,
    20	  kanjiSize = 22,
    21	  variant = "primary",
    22	  en = true,
    23	  color,
    24	  animated = false,
    25	  className
    26	}: LockupProps) {
    27	  const wmColor = color || (variant === "on-blue" ? FB_WHITE : INK_1);
    28	  const enColor = variant === "on-blue" ? "rgba(255,255,255,0.72)" : FB_BLUE;
    29	
    30	  return (
    31	    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    32	      <CloudBuddy size={markSize} variant={variant} animated={animated} />
    33	      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    34	        <span
    35	          style={{
    36	            fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    37	            fontWeight: 800,
    38	            fontSize: kanjiSize,
    39	            letterSpacing: "-0.045em",
    40	            color: wmColor,
    41	            lineHeight: 1
    42	          }}
    43	        >
    44	          포맷버디
    45	        </span>
    46	        {en && (
    47	          <span
    48	            style={{
    49	              fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    50	              fontWeight: 700,
    51	              fontSize: Math.round(kanjiSize * 0.42),
    52	              letterSpacing: "0.22em",
    53	              textTransform: "uppercase",
    54	              color: enColor,
    55	              lineHeight: 1
    56	            }}
    57	          >
    58	            Format Buddy
    59	          </span>
    60	        )}
    61	      </span>
    62	    </span>
    63	  );
    64	}
--- src/renderer/src/components/ScoreRing.tsx
     1	export interface ScoreRingProps {
     2	  value: number;
     3	  size?: number;
     4	  strokeWidth?: number;
     5	  showLabel?: boolean;
     6	  className?: string;
     7	}
     8	
     9	export function ScoreRing({
    10	  value,
    11	  size = 76,
    12	  strokeWidth = 6,
    13	  showLabel = true,
    14	  className
    15	}: ScoreRingProps) {
    16	  const r = (size - strokeWidth * 2) / 2;
    17	  const c = 2 * Math.PI * r;
    18	  const safe = Math.max(0, Math.min(100, value));
    19	  const offset = c - (safe / 100) * c;
    20	
    21	  return (
    22	    <svg
    23	      viewBox={`0 0 ${size} ${size}`}
    24	      width={size}
    25	      height={size}
    26	      className={className}
    27	      role="img"
    28	      aria-label={`진행률 ${safe}%`}
    29	    >
    30	      <circle
    31	        cx={size / 2}
    32	        cy={size / 2}
    33	        r={r}
    34	        stroke="rgba(0,102,255,0.18)"
    35	        strokeWidth={strokeWidth}
    36	        fill="none"
    37	      />
    38	      <circle
    39	        cx={size / 2}
    40	        cy={size / 2}
    41	        r={r}
    42	        stroke="var(--color-fb-blue)"
    43	        strokeWidth={strokeWidth}
    44	        fill="none"
    45	        strokeDasharray={c}
    46	        strokeDashoffset={offset}
    47	        strokeLinecap="round"
    48	        transform={`rotate(-90 ${size / 2} ${size / 2})`}
    49	      />
    50	      {showLabel && (
    51	        <text
    52	          x={size / 2}
    53	          y={size / 2 + Math.round(size * 0.08)}
    54	          textAnchor="middle"
    55	          fontSize={Math.round(size * 0.21)}
    56	          fontWeight={800}
    57	          fontFamily="'Wanted Sans', sans-serif"
    58	          fill="var(--color-fb-blue)"
    59	          style={{ fontFeatureSettings: '"tnum" on' }}
    60	        >
    61	          {safe}%
    62	        </text>
    63	      )}
    64	    </svg>
    65	  );
    66	}
--- src/renderer/src/styles/globals.css
     1	@font-face {
     2	  font-family: "Wanted Sans";
     3	  font-weight: 100 950;
     4	  font-style: normal;
     5	  src: url("./fonts/WantedSansVariable.ttf") format("truetype-variations"),
     6	       url("./fonts/WantedSansVariable.ttf") format("truetype");
     7	  font-display: swap;
     8	}
     9	
    10	@font-face {
    11	  font-family: "Pretendard";
    12	  font-weight: 100 900;
    13	  font-style: normal;
    14	  src: url("./fonts/PretendardVariable.ttf") format("truetype-variations"),
    15	       url("./fonts/PretendardVariable.ttf") format("truetype");
    16	  font-display: swap;
    17	}
    18	
    19	:root {
    20	  --color-fb-blue: #0066ff;
    21	  --color-fb-blue-strong: #005eeb;
    22	  --color-fb-blue-heavy: #0040b5;
    23	  --color-fb-blue-tint: #eaf2fe;
    24	  --color-fb-ink-1: #0e1116;
    25	  --color-fb-ink-2: rgba(46, 47, 51, 0.88);
    26	  --color-fb-ink-3: rgba(55, 56, 60, 0.61);
    27	  --color-fb-ink-4: rgba(55, 56, 60, 0.28);
    28	  --color-fb-bg: #ffffff;
    29	  --color-fb-line: #e1e2e4;
    30	  --color-fb-line-t: rgba(112, 115, 124, 0.22);
    31	  --color-fb-positive: #00bf40;
    32	  --color-fb-warn: #ff9200;
    33	}
    34	
    35	* { box-sizing: border-box; }
    36	
    37	html, body, #root {
    38	  margin: 0;
    39	  padding: 0;
    40	  height: 100%;
    41	  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
    42	  font-feature-settings: "ss01" on, "ss03" on;
    43	  -webkit-font-smoothing: antialiased;
    44	  text-rendering: optimizeLegibility;
    45	  color: var(--color-fb-ink-1);
    46	  background: #ffffff;
    47	  -webkit-user-select: none;
    48	  user-select: none;
    49	}
    50	
    51	button { font-family: inherit; }
    52	
    53	/* ============================================================
    54	   App shell
    55	   ============================================================ */
    56	.fb-app {
    57	  display: flex;
    58	  flex-direction: column;
    59	  min-height: 100vh;
    60	  background: #ffffff;
    61	}
    62	.fb-app-footer {
    63	  display: flex;
    64	  justify-content: space-between;
    65	  align-items: center;
    66	  padding: 12px 24px;
    67	  border-top: 1px solid var(--color-fb-line);
    68	  background: #ffffff;
    69	  font-size: 11px;
    70	  color: var(--color-fb-ink-3);
    71	  font-weight: 500;
    72	  letter-spacing: 0.02em;
    73	}
    74	.fb-app-version { font-feature-settings: "tnum" on; }
    75	
    76	/* ============================================================
    77	   Typography helpers
    78	   ============================================================ */
    79	.fb-h1 {
    80	  font-size: 44px;
    81	  line-height: 1.1;
    82	  font-weight: 800;
    83	  letter-spacing: -0.045em;
    84	  margin: 0 0 20px;
    85	  color: var(--color-fb-ink-1);
    86	}
    87	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
    88	.fb-h1-sm {
    89	  font-size: 32px;
    90	  line-height: 1.15;
    91	  font-weight: 800;
    92	  letter-spacing: -0.04em;
    93	  margin: 0 0 12px;
    94	  color: var(--color-fb-ink-1);
    95	}
    96	.fb-h2 {
    97	  font-size: 22px;
    98	  font-weight: 800;
    99	  letter-spacing: -0.025em;
   100	  color: var(--color-fb-ink-1);
   101	  margin: 0 0 16px;
   102	}
   103	.fb-lede {
   104	  font-size: 15px;
   105	  line-height: 24px;
   106	  color: var(--color-fb-ink-2);
   107	  font-weight: 500;
   108	  letter-spacing: -0.012em;
   109	  margin: 0 0 24px;
   110	  max-width: 520px;
   111	}
   112	
   113	/* ============================================================
   114	   Button
   115	   ============================================================ */
   116	.fb-btn {
   117	  display: inline-flex;
   118	  align-items: center;
   119	  justify-content: center;
   120	  gap: 8px;
   121	  font-weight: 700;
   122	  letter-spacing: -0.015em;
   123	  border: 1px solid transparent;
   124	  border-radius: 12px;
   125	  cursor: pointer;
   126	  white-space: nowrap;
   127	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   128	  user-select: none;
   129	}
   130	.fb-btn:focus-visible {
   131	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   132	  outline-offset: 2px;
   133	}
   134	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   135	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   136	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   137	.fb-btn-full { width: 100%; }
   138	
   139	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   140	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   141	.fb-btn-primary:active { transform: scale(0.98); }
   142	
   143	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   144	.fb-btn-secondary:hover { background: #f7f7f8; }
   145	
   146	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   147	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   148	
   149	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   150	.fb-btn-on-blue:hover { background: #f7f7f8; }
   151	
   152	/* ============================================================
   153	   Cloud-Buddy motion (from design styles.css)
   154	   ============================================================ */
   155	.cb-eye { transform-box: fill-box; transform-origin: center; }
   156	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   157	@keyframes cb-wink {
   158	  0%, 92%, 100% { transform: scaleY(1); }
   159	  94%, 96% { transform: scaleY(0.08); }
   160	}
   161	
   162	.cb-pulse-wrap {
   163	  transform-box: fill-box;
   164	  transform-origin: center;
   165	  opacity: 0;
   166	  animation: cb-pulse 2.4s ease-out infinite;
   167	  pointer-events: none;
   168	}
   169	.cb-pulse-2 { animation-delay: -1.2s; }
   170	@keyframes cb-pulse {
   171	  0% { transform: scale(0.55); opacity: 0.55; }
   172	  80% { opacity: 0.05; }
   173	  100% { transform: scale(1.75); opacity: 0; }
   174	}
   175	
   176	.cb-animated .cb-antenna-dot {
   177	  transform-box: fill-box;
   178	  transform-origin: center;
   179	  animation: cb-charge 1.4s ease-in-out infinite;
   180	}
   181	@keyframes cb-charge {
   182	  0%, 100% { transform: scale(1); }
   183	  50% { transform: scale(1.18); }
   184	}
   185	
   186	.cb-spark {
   187	  transform-box: fill-box;
   188	  transform-origin: center;
   189	  opacity: 0;
   190	  animation: cb-spark 1.4s ease-out infinite;
   191	  pointer-events: none;
   192	}
   193	.cb-spark-2 { animation-delay: -0.7s; }
   194	@keyframes cb-spark {
   195	  0% { transform: scale(0.6); opacity: 0.55; }
   196	  100% { transform: scale(2.2); opacity: 0; }
   197	}
   198	
   199	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   200	@keyframes fb-spin { to { transform: rotate(360deg); } }
   201	
   202	@media (prefers-reduced-motion: reduce) {
   203	  .cb-animated .cb-eye-l,
   204	  .cb-animated .cb-antenna-dot,
   205	  .cb-pulse-wrap,
   206	  .cb-spark,
   207	  .fb-spin { animation: none !important; }
   208	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   209	}
   210	
   211	/* ============================================================
   212	   Home
   213	   ============================================================ */
   214	.fb-home {
   215	  flex: 1;
   216	  display: flex;
   217	  flex-direction: column;
   218	  padding: 24px 40px 40px;
   219	  gap: 32px;
   220	  max-width: 1080px;
   221	  margin: 0 auto;
   222	  width: 100%;
   223	}
   224	.fb-home-header {
   225	  display: flex;
   226	  justify-content: space-between;
   227	  align-items: center;
   228	}
   229	.fb-home-pill {
   230	  display: inline-flex;
   231	  align-items: center;
   232	  gap: 8px;
   233	  height: 32px;
   234	  padding: 0 14px 0 12px;
   235	  background: var(--color-fb-blue-tint);
   236	  color: var(--color-fb-blue-heavy);
   237	  border-radius: 9999px;
   238	  font-size: 12px;
   239	  font-weight: 700;
   240	  letter-spacing: -0.01em;
   241	}
   242	.fb-home-pill-dot {
   243	  width: 6px; height: 6px;
   244	  border-radius: 9999px;
   245	  background: var(--color-fb-blue);
   246	}
   247	
   248	.fb-home-hero {
   249	  display: grid;
   250	  grid-template-columns: 1.4fr 1fr;
   251	  gap: 48px;
   252	  align-items: center;
   253	  padding: 32px 0 8px;
   254	}
   255	.fb-home-hero-copy { display: flex; flex-direction: column; }
   256	.fb-home-hero-mark {
   257	  display: flex;
   258	  justify-content: center;
   259	  align-items: center;
   260	}
   261	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   262	
   263	.fb-home-privacy {
   264	  background: var(--color-fb-blue-tint);
   265	  border-radius: 20px;
   266	  padding: 28px 32px;
   267	}
   268	.fb-home-bullets {
   269	  margin: 0;
   270	  padding-left: 18px;
   271	  color: var(--color-fb-ink-2);
   272	  font-size: 14px;
   273	  line-height: 22px;
   274	  font-weight: 500;
   275	}
   276	.fb-home-bullets li { margin: 0 0 6px; }
   277	
   278	/* ============================================================
   279	   Scanning
   280	   ============================================================ */
   281	.fb-scanning {
   282	  flex: 1;
   283	  display: flex;
   284	  flex-direction: column;
   285	  justify-content: center;
   286	  align-items: center;
   287	  padding: 40px;
   288	}
   289	.fb-scanning-wrap {
   290	  width: 100%;
   291	  max-width: 520px;
   292	  display: flex;
   293	  flex-direction: column;
   294	  gap: 20px;
   295	}
   296	.fb-scanning-actions {
   297	  display: flex;
   298	  gap: 8px;
   299	  justify-content: flex-end;
   300	}
   301	.fb-scanning-error {
   302	  background: #fff5f5;
   303	  border: 1px solid #ffd6d6;
   304	  color: #8b0000;
   305	  border-radius: 12px;
   306	  padding: 14px 16px;
   307	  font-size: 13px;
   308	}
   309	.fb-scanning-error strong { display: block; margin-bottom: 4px; }
   310	.fb-scanning-error p { margin: 0; word-break: break-word; }
   311	
   312	/* ============================================================
   313	   ScanCard
   314	   ============================================================ */
   315	.scan-card {
   316	  background: #ffffff;
   317	  border-radius: 24px;
   318	  border: 1px solid var(--color-fb-line-t);
   319	  box-shadow: 0 1px 6px rgb(23 23 25 / 0.06), 0 12px 32px rgb(23 23 25 / 0.10);
   320	  padding: 28px;
   321	  display: flex;
   322	  flex-direction: column;
   323	  gap: 22px;
   324	}
   325	.scan-card-head {
   326	  display: flex;
   327	  align-items: center;
   328	  justify-content: space-between;
   329	}
   330	.scan-card-who { display: flex; align-items: center; gap: 10px; }
   331	.scan-card-who-meta { display: flex; flex-direction: column; gap: 2px; }
   332	.scan-card-title { font-size: 14px; font-weight: 700; color: var(--color-fb-ink-1); }
   333	.scan-card-elapsed { font-size: 12px; font-weight: 500; color: var(--color-fb-ink-3); }
   334	.scan-card-live {
   335	  display: flex;
   336	  align-items: center;
   337	  gap: 6px;
   338	  font-size: 12px;
   339	  font-weight: 600;
   340	  color: var(--color-fb-positive);
   341	}
   342	.scan-card-live-dot {
   343	  width: 7px; height: 7px;
   344	  border-radius: 9999px;
   345	  background: var(--color-fb-positive);
   346	  box-shadow: 0 0 0 3px rgba(0,191,64,0.18);
   347	}
   348	
   349	.scan-score {
   350	  background: var(--color-fb-blue-tint);
   351	  border-radius: 20px;
   352	  padding: 22px 24px;
   353	  display: grid;
   354	  grid-template-columns: 1fr auto;
   355	  gap: 16px;
   356	  align-items: center;
   357	}
   358	.scan-score-label {
   359	  font-size: 12px;
   360	  font-weight: 700;
   361	  letter-spacing: 0.04em;
   362	  color: var(--color-fb-blue-heavy);
   363	  margin-bottom: 4px;
   364	}
   365	.scan-score-value {
   366	  font-size: 56px;
   367	  font-weight: 800;
   368	  letter-spacing: -0.045em;
   369	  color: var(--color-fb-ink-1);
   370	  line-height: 1;
   371	  font-feature-settings: "tnum" on;
   372	}
   373	.scan-score-unit {
   374	  font-size: 24px;
   375	  font-weight: 700;
   376	  margin-left: 2px;
   377	  letter-spacing: -0.02em;
   378	  color: var(--color-fb-ink-2);
   379	}
   380	.scan-score-sub {
   381	  font-size: 12px;
   382	  color: var(--color-fb-ink-3);
   383	  font-weight: 500;
   384	  margin-top: 8px;
   385	}
   386	
   387	.scan-steps { display: flex; flex-direction: column; gap: 6px; }
   388	.scan-step {
   389	  display: grid;
   390	  grid-template-columns: 32px 1fr auto;
   391	  align-items: center;
   392	  gap: 12px;
   393	  padding: 12px 14px;
   394	  border-radius: 12px;
   395	  background: #ffffff;
   396	  border: 1px solid var(--color-fb-line-t);
   397	}
   398	.scan-step.active {
   399	  background: var(--color-fb-blue-tint);
   400	  border-color: rgba(0,102,255,0.22);
   401	}
   402	.scan-step-idx {
   403	  width: 24px; height: 24px;
   404	  border-radius: 9999px;
   405	  background: var(--color-fb-blue-tint);
   406	  color: var(--color-fb-blue);
   407	  font-size: 12px;
   408	  font-weight: 800;
   409	  display: flex; align-items: center; justify-content: center;
   410	  font-feature-settings: "tnum" on;
   411	}
   412	.scan-step.done .scan-step-idx { background: var(--color-fb-blue); color: #ffffff; }
   413	.scan-step.pending .scan-step-idx { background: #f4f4f5; color: var(--color-fb-ink-3); }
   414	.scan-step-name { font-size: 14px; font-weight: 600; color: var(--color-fb-ink-1); }
   415	.scan-step-state {
   416	  font-size: 12px;
   417	  font-weight: 600;
   418	  letter-spacing: -0.01em;
   419	  color: var(--color-fb-ink-3);
   420	  display: flex; align-items: center; gap: 4px;
   421	}
   422	.scan-step.done .scan-step-state { color: var(--color-fb-positive); }
   423	.scan-step.active .scan-step-state { color: var(--color-fb-blue); }
   424	
   425	/* ============================================================
   426	   Report
   427	   ============================================================ */
   428	.fb-report {
   429	  flex: 1;
   430	  display: flex;
   431	  flex-direction: column;
   432	  padding: 24px 40px 40px;
   433	  gap: 24px;
   434	  max-width: 1080px;
   435	  margin: 0 auto;
   436	  width: 100%;
   437	}
   438	.fb-report-header {
   439	  display: flex;
   440	  justify-content: space-between;
   441	  align-items: center;
   442	}
   443	.fb-report-actions { display: flex; gap: 8px; }
   444	.fb-report-hero { padding: 8px 0 0; }
   445	
   446	.fb-report-grid {
   447	  display: grid;
   448	  grid-template-columns: repeat(2, 1fr);
   449	  gap: 16px;
   450	}
   451	.fb-card {
   452	  background: #ffffff;
   453	  border: 1px solid var(--color-fb-line);
   454	  border-radius: 20px;
   455	  padding: 22px 24px;
   456	  display: flex;
   457	  flex-direction: column;
   458	  gap: 6px;
   459	}
   460	.fb-card h3 {
   461	  margin: 0 0 8px;
   462	  font-size: 15px;
   463	  font-weight: 800;
   464	  letter-spacing: -0.02em;
   465	  color: var(--color-fb-ink-1);
   466	}
   467	.fb-card-checklist { grid-column: span 2; }
   468	
   469	.fb-report-row {
   470	  display: grid;
   471	  grid-template-columns: 110px 1fr;
   472	  gap: 12px;
   473	  padding: 6px 0;
   474	  border-bottom: 1px dashed var(--color-fb-line-t);
   475	  font-size: 13px;
   476	}
   477	.fb-report-row:last-child { border-bottom: none; }
   478	.fb-report-row-label { color: var(--color-fb-ink-3); font-weight: 600; }
   479	.fb-report-row-value { color: var(--color-fb-ink-1); font-weight: 500; }
   480	
   481	.fb-report-checklist {
   482	  margin: 0;
   483	  padding-left: 18px;
   484	  color: var(--color-fb-ink-2);
   485	  font-size: 14px;
   486	  line-height: 22px;
   487	  font-weight: 500;
   488	}
   489	
   490	.fb-report-cta {
   491	  display: flex;
   492	  gap: 10px;
   493	  align-items: center;
   494	  flex-wrap: wrap;
   495	}
   496	.fb-report-cta-status {
   497	  flex-basis: 100%;
   498	  font-size: 12px;
   499	  color: var(--color-fb-ink-3);
   500	  margin: 4px 0 0;
   501	}
   502	
   503	.fb-report-meta {
   504	  display: flex;
   505	  justify-content: space-between;
   506	  color: var(--color-fb-ink-3);
   507	  font-size: 11px;
   508	}

exec
/bin/zsh -lc "for f in src/renderer/src/App.tsx src/renderer/src/pages/Home.tsx src/renderer/src/pages/Scanning.tsx src/renderer/src/pages/Report.tsx src/renderer/src/components/CloudBuddy.tsx src/renderer/src/components/ScanCard.tsx src/renderer/src/components/Lockup.tsx src/shared/copy.ts src/shared/types.ts src/shared/ipc.ts src/main/paths.ts; do echo '---' "'$f; nl -ba $f; done' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- src/renderer/src/App.tsx
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     6	
     7	type Phase =
     8	  | { kind: "home" }
     9	  | { kind: "scanning"; progress: ScanProgress }
    10	  | { kind: "report"; result: ScanResult }
    11	  | { kind: "error"; error: ScanError };
    12	
    13	const INITIAL_PROGRESS: ScanProgress = {
    14	  step: "준비",
    15	  doneSteps: 0,
    16	  totalSteps: 6,
    17	  score: 0,
    18	  elapsedMs: 0,
    19	  steps: [
    20	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    21	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    22	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    23	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    24	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    25	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    26	  ]
    27	};
    28	
    29	export function App() {
    30	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    31	  const [appVersion, setAppVersion] = useState<string>("");
    32	
    33	  useEffect(() => {
    34	    if (typeof window.fb?.appVersion === "function") {
    35	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    36	    }
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    if (!window.fb) return;
    41	    const offProgress = window.fb.onScanProgress((p) => {
    42	      setPhase((prev) =>
    43	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    44	      );
    45	    });
    46	    const offComplete = window.fb.onScanComplete((r) => {
    47	      setPhase({ kind: "report", result: r });
    48	    });
    49	    const offError = window.fb.onScanError((err) => {
    50	      setPhase({ kind: "error", error: err });
    51	    });
    52	    return () => {
    53	      offProgress();
    54	      offComplete();
    55	      offError();
    56	    };
    57	  }, []);
    58	
    59	  const startScan = useCallback(async () => {
    60	    if (!window.fb) {
    61	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    62	      return;
    63	    }
    64	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    65	    try {
    66	      await window.fb.startScan();
    67	    } catch {
    68	      // 에러는 onScanError 이벤트로 처리
    69	    }
    70	  }, []);
    71	
    72	  const cancelScan = useCallback(async () => {
    73	    if (!window.fb) return;
    74	    await window.fb.cancelScan();
    75	    setPhase({ kind: "home" });
    76	  }, []);
    77	
    78	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    79	
    80	  const content = useMemo(() => {
    81	    switch (phase.kind) {
    82	      case "home":
    83	        return <Home onStartScan={startScan} />;
    84	      case "scanning":
    85	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    86	      case "report":
    87	        return <Report result={phase.result} onBack={goHome} />;
    88	      case "error":
    89	        return (
    90	          <Scanning
    91	            progress={INITIAL_PROGRESS}
    92	            errorMessage={phase.error.message}
    93	            onCancel={goHome}
    94	            onRetry={startScan}
    95	          />
    96	        );
    97	    }
    98	  }, [phase, startScan, cancelScan, goHome]);
    99	
   100	  return (
   101	    <div className="fb-app">
   102	      {content}
   103	      <footer className="fb-app-footer">
   104	        <span>FormatBuddy Desktop</span>
   105	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   106	      </footer>
   107	    </div>
   108	  );
   109	}
--- src/renderer/src/pages/Home.tsx
     1	import { Button, ArrowRight } from "../components/Button";
     2	import { Lockup } from "../components/Lockup";
     3	import { CloudBuddy } from "../components/CloudBuddy";
     4	import { copy } from "@shared/copy";
     5	
     6	interface HomeProps {
     7	  onStartScan: () => void;
     8	}
     9	
    10	export function Home({ onStartScan }: HomeProps) {
    11	  return (
    12	    <main className="fb-home">
    13	      <header className="fb-home-header">
    14	        <Lockup markSize={36} kanjiSize={20} en={false} />
    15	        <span className="fb-home-pill">
    16	          <span className="fb-home-pill-dot" />
    17	          {copy.homeEyebrow}
    18	        </span>
    19	      </header>
    20	
    21	      <section className="fb-home-hero">
    22	        <div className="fb-home-hero-copy">
    23	          <h1 className="fb-h1">
    24	            {copy.homeTitle1}
    25	            <br />
    26	            {copy.homeTitle2} <em>{copy.homeTitle3}</em>
    27	          </h1>
    28	          <p className="fb-lede">{copy.homeLede}</p>
    29	          <div className="fb-home-cta">
    30	            <Button size="lg" variant="primary" onClick={onStartScan} iconRight={<ArrowRight />}>
    31	              {copy.homeStartCta}
    32	            </Button>
    33	          </div>
    34	        </div>
    35	        <div className="fb-home-hero-mark">
    36	          <CloudBuddy size={220} variant="primary" expression="smile" animated />
    37	        </div>
    38	      </section>
    39	
    40	      <section className="fb-home-privacy">
    41	        <h2 className="fb-h2">{copy.privacyHeadline}</h2>
    42	        <ul className="fb-home-bullets">
    43	          {copy.privacyBullets.map((b) => (
    44	            <li key={b}>{b}</li>
    45	          ))}
    46	        </ul>
    47	      </section>
    48	    </main>
    49	  );
    50	}
--- src/renderer/src/pages/Scanning.tsx
     1	import { ScanCard } from "../components/ScanCard";
     2	import { Button } from "../components/Button";
     3	import { copy } from "@shared/copy";
     4	import type { ScanProgress } from "@shared/types";
     5	
     6	interface ScanningProps {
     7	  progress: ScanProgress;
     8	  errorMessage?: string;
     9	  onCancel: () => void;
    10	  onRetry?: () => void;
    11	}
    12	
    13	function formatElapsed(ms: number) {
    14	  if (!ms || ms < 0) return "잠시만요";
    15	  const totalSec = Math.floor(ms / 1000);
    16	  const min = Math.floor(totalSec / 60);
    17	  const sec = totalSec % 60;
    18	  if (min === 0) return `${sec}초 경과`;
    19	  return `${min}분 ${sec}초 경과`;
    20	}
    21	
    22	export function Scanning({ progress, errorMessage, onCancel, onRetry }: ScanningProps) {
    23	  return (
    24	    <main className="fb-scanning">
    25	      <div className="fb-scanning-wrap">
    26	        <ScanCard
    27	          score={progress.score}
    28	          elapsedLabel={formatElapsed(progress.elapsedMs)}
    29	          doneSteps={progress.doneSteps}
    30	          totalSteps={progress.totalSteps}
    31	          steps={progress.steps}
    32	          title={errorMessage ? copy.errorHeadline : copy.scanTitle}
    33	          liveLabel={errorMessage ? "잠시 멈췄어요" : copy.scanLiveLabel}
    34	        />
    35	
    36	        {errorMessage && (
    37	          <div className="fb-scanning-error" role="alert">
    38	            <strong>{copy.errorHeadline}</strong>
    39	            <p>{errorMessage}</p>
    40	          </div>
    41	        )}
    42	
    43	        <div className="fb-scanning-actions">
    44	          {onRetry && (
    45	            <Button variant="primary" size="md" onClick={onRetry}>
    46	              {copy.errorRetryCta}
    47	            </Button>
    48	          )}
    49	          <Button variant="secondary" size="md" onClick={onCancel}>
    50	            {copy.scanCancelCta}
    51	          </Button>
    52	        </div>
    53	      </div>
    54	    </main>
    55	  );
    56	}
--- src/renderer/src/pages/Report.tsx
     1	import { useCallback, useMemo, useState } from "react";
     2	import { Button } from "../components/Button";
     3	import { Lockup } from "../components/Lockup";
     4	import { copy } from "@shared/copy";
     5	import type { ScanResult } from "@shared/types";
     6	
     7	interface ReportProps {
     8	  result: ScanResult;
     9	  onBack: () => void;
    10	}
    11	
    12	interface RowProps {
    13	  label: string;
    14	  value: React.ReactNode;
    15	}
    16	
    17	function Row({ label, value }: RowProps) {
    18	  return (
    19	    <div className="fb-report-row">
    20	      <div className="fb-report-row-label">{label}</div>
    21	      <div className="fb-report-row-value">{value}</div>
    22	    </div>
    23	  );
    24	}
    25	
    26	function formatGb(value?: number | null) {
    27	  if (value == null) return "—";
    28	  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
    29	}
    30	
    31	export function Report({ result, onBack }: ReportProps) {
    32	  const { report } = result;
    33	  const [exportStatus, setExportStatus] = useState<string | null>(null);
    34	
    35	  const installedCount = report.installedApps.length;
    36	  const driverCount = report.drivers.length;
    37	  const wifiCount = report.wifiProfiles.length;
    38	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    39	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    40	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    41	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    42	
    43	  const onExport = useCallback(async () => {
    44	    if (!window.fb) return;
    45	    setExportStatus(null);
    46	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    47	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    48	    else setExportStatus("저장을 취소했어요.");
    49	  }, [report]);
    50	
    51	  const onOpenWeb = useCallback(async () => {
    52	    if (!window.fb) return;
    53	    await window.fb.openWebReport();
    54	  }, []);
    55	
    56	  return (
    57	    <main className="fb-report">
    58	      <header className="fb-report-header">
    59	        <Lockup markSize={36} kanjiSize={20} en={false} />
    60	        <div className="fb-report-actions">
    61	          <Button variant="ghost" size="sm" onClick={onBack}>
    62	            {copy.reportBackCta}
    63	          </Button>
    64	        </div>
    65	      </header>
    66	
    67	      <section className="fb-report-hero">
    68	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
    69	        <p className="fb-lede">{copy.reportLede}</p>
    70	      </section>
    71	
    72	      <section className="fb-report-grid">
    73	        <article className="fb-card">
    74	          <h3>이 PC</h3>
    75	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
    76	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
    77	          <Row label="CPU" value={report.system.cpu ?? "—"} />
    78	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
    79	        </article>
    80	
    81	        <article className="fb-card">
    82	          <h3>저장 공간</h3>
    83	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
    84	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
    85	          {report.disks.map((d) => (
    86	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
    87	          ))}
    88	        </article>
    89	
    90	        <article className="fb-card">
    91	          <h3>같이 챙길 것</h3>
    92	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
    93	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
    94	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
    95	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
    96	        </article>
    97	
    98	        <article className="fb-card">
    99	          <h3>설치된 앱 / 드라이버</h3>
   100	          <Row label="설치된 앱" value={`${installedCount}개`} />
   101	          <Row label="드라이버" value={`${driverCount}개`} />
   102	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   103	          <Row label="프린터" value={`${report.printers.length}개`} />
   104	        </article>
   105	
   106	        <article className="fb-card">
   107	          <h3>사용자 폴더</h3>
   108	          {report.userFolders.map((f) => (
   109	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   110	          ))}
   111	        </article>
   112	
   113	        <article className="fb-card fb-card-checklist">
   114	          <h3>포맷 전 체크리스트</h3>
   115	          <ul className="fb-report-checklist">
   116	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   117	            <li>Desktop·Documents·Downloads 백업</li>
   118	            <li>클라우드 동기화 완료 확인</li>
   119	            <li>리포트 JSON 저장 후 포맷</li>
   120	          </ul>
   121	        </article>
   122	      </section>
   123	
   124	      <section className="fb-report-cta">
   125	        <Button variant="primary" size="lg" onClick={onExport}>
   126	          {copy.reportExportCta}
   127	        </Button>
   128	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   129	          {copy.reportOpenWebCta}
   130	        </Button>
   131	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   132	      </section>
   133	
   134	      <section className="fb-report-meta">
   135	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   136	        <small>schema {report.schemaVersion}</small>
   137	      </section>
   138	    </main>
   139	  );
   140	}
--- src/renderer/src/components/CloudBuddy.tsx
     1	// CloudBuddy — 포맷버디 브랜드 마크. 240×240 viewBox.
     2	// 모션은 CSS-only (globals.css의 .cb-* 키프레임).
     3	
     4	import type { Ref } from "react";
     5	
     6	type Variant = "primary" | "on-blue";
     7	type Expression = "smile" | "calm" | "wink";
     8	
     9	const FB_BLUE = "#0066FF";
    10	const FB_WHITE = "#FFFFFF";
    11	
    12	function getPalette(variant: Variant) {
    13	  if (variant === "on-blue") return { body: FB_WHITE, face: FB_BLUE };
    14	  return { body: FB_BLUE, face: FB_WHITE };
    15	}
    16	
    17	export interface CloudBuddyProps {
    18	  size?: number;
    19	  variant?: Variant;
    20	  expression?: Expression;
    21	  animated?: boolean;
    22	  blink?: boolean;
    23	  pulse?: boolean;
    24	  ariaLabel?: string;
    25	  className?: string;
    26	  ref?: Ref<SVGSVGElement>;
    27	}
    28	
    29	export function CloudBuddy({
    30	  size = 200,
    31	  variant = "primary",
    32	  expression = "smile",
    33	  animated = false,
    34	  blink = false,
    35	  pulse = false,
    36	  ariaLabel = "포맷버디",
    37	  className,
    38	  ref
    39	}: CloudBuddyProps) {
    40	  const c = getPalette(variant);
    41	  const wantBlink = blink || animated;
    42	  const wantPulse = pulse || animated;
    43	  const classes = [wantBlink || wantPulse ? "cb-animated" : "", className]
    44	    .filter(Boolean)
    45	    .join(" ");
    46	
    47	  return (
    48	    <svg
    49	      ref={ref}
    50	      width={size}
    51	      height={size}
    52	      viewBox="0 0 240 240"
    53	      fill="none"
    54	      role="img"
    55	      aria-label={ariaLabel}
    56	      className={classes || undefined}
    57	      style={{ overflow: "visible" }}
    58	    >
    59	      {wantPulse && (
    60	        <g>
    61	          <g className="cb-pulse-wrap cb-pulse-1">
    62	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    63	          </g>
    64	          <g className="cb-pulse-wrap cb-pulse-2">
    65	            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
    66	          </g>
    67	        </g>
    68	      )}
    69	
    70	      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />
    71	
    72	      {wantPulse && (
    73	        <g>
    74	          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    75	          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
    76	        </g>
    77	      )}
    78	
    79	      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />
    80	
    81	      <g fill={c.body}>
    82	        <ellipse cx="74" cy="146" rx="42" ry="40" />
    83	        <ellipse cx="120" cy="124" rx="50" ry="48" />
    84	        <ellipse cx="166" cy="146" rx="40" ry="38" />
    85	        <rect x="56" y="146" width="128" height="42" rx="10" />
    86	      </g>
    87	
    88	      {expression !== "wink" && (
    89	        <g className="cb-eye cb-eye-l">
    90	          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    91	        </g>
    92	      )}
    93	      <g className="cb-eye cb-eye-r">
    94	        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
    95	      </g>
    96	
    97	      {expression === "smile" && (
    98	        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
    99	      )}
   100	      {expression === "calm" && <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />}
   101	      {expression === "wink" && (
   102	        <>
   103	          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" fill="none" />
   104	          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6" strokeLinecap="round" fill="none" />
   105	        </>
   106	      )}
   107	    </svg>
   108	  );
   109	}
--- src/renderer/src/components/ScanCard.tsx
     1	// ScanCard — 진단 진행 카드.
     2	// web 버전을 Electron 환경 + 일반 CSS 변수 기반으로 단순화.
     3	
     4	import type { ScanStepView } from "@shared/types";
     5	import { CloudBuddy } from "./CloudBuddy";
     6	import { ScoreRing } from "./ScoreRing";
     7	
     8	export interface ScanCardProps {
     9	  score: number;
    10	  elapsedLabel: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  steps: ScanStepView[];
    14	  title?: string;
    15	  liveLabel?: string;
    16	}
    17	
    18	function CheckIcon({ size = 13 }: { size?: number }) {
    19	  return (
    20	    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
    21	      <path d="M3 7.5 L6 10 L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    22	    </svg>
    23	  );
    24	}
    25	
    26	function SpinIcon({ size = 12 }: { size?: number }) {
    27	  return (
    28	    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="fb-spin">
    29	      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    30	      <path d="M10.5 6 A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    31	    </svg>
    32	  );
    33	}
    34	
    35	export function ScanCard({
    36	  score,
    37	  elapsedLabel,
    38	  doneSteps,
    39	  totalSteps,
    40	  steps,
    41	  title = "버디가 살펴보는 중",
    42	  liveLabel = "진단 중"
    43	}: ScanCardProps) {
    44	  return (
    45	    <div className="scan-card">
    46	      <div className="scan-card-head">
    47	        <div className="scan-card-who">
    48	          <CloudBuddy size={36} variant="primary" expression="smile" animated />
    49	          <div className="scan-card-who-meta">
    50	            <div className="scan-card-title">{title}</div>
    51	            <div className="scan-card-elapsed">{elapsedLabel}</div>
    52	          </div>
    53	        </div>
    54	        <div className="scan-card-live">
    55	          <span className="scan-card-live-dot" />
    56	          {liveLabel}
    57	        </div>
    58	      </div>
    59	
    60	      <div className="scan-score">
    61	        <div>
    62	          <div className="scan-score-label">버디 진행 점수</div>
    63	          <div className="scan-score-value">
    64	            {score}
    65	            <span className="scan-score-unit">점</span>
    66	          </div>
    67	          <div className="scan-score-sub">
    68	            전체 {totalSteps}단계 중 {doneSteps}단계 살펴봤어요
    69	          </div>
    70	        </div>
    71	        <ScoreRing value={score} />
    72	      </div>
    73	
    74	      <div className="scan-steps">
    75	        {steps.map((s, i) => (
    76	          <div key={`${s.name}-${i}`} className={`scan-step ${s.state}`}>
    77	            <div className="scan-step-idx">{s.state === "done" ? <CheckIcon /> : i + 1}</div>
    78	            <div className="scan-step-name">{s.name}</div>
    79	            <div className="scan-step-state">
    80	              {s.state === "active" && <SpinIcon />}
    81	              {s.detail}
    82	            </div>
    83	          </div>
    84	        ))}
    85	      </div>
    86	    </div>
    87	  );
    88	}
--- src/renderer/src/components/Lockup.tsx
     1	// Lockup — CloudBuddy 마크 + 한글 워드마크 (옵션: 영문 서브)
     2	import { CloudBuddy } from "./CloudBuddy";
     3	
     4	const FB_BLUE = "#0066FF";
     5	const FB_WHITE = "#FFFFFF";
     6	const INK_1 = "#0E1116";
     7	
     8	export interface LockupProps {
     9	  markSize?: number;
    10	  kanjiSize?: number;
    11	  variant?: "primary" | "on-blue";
    12	  en?: boolean;
    13	  color?: string;
    14	  animated?: boolean;
    15	  className?: string;
    16	}
    17	
    18	export function Lockup({
    19	  markSize = 44,
    20	  kanjiSize = 22,
    21	  variant = "primary",
    22	  en = true,
    23	  color,
    24	  animated = false,
    25	  className
    26	}: LockupProps) {
    27	  const wmColor = color || (variant === "on-blue" ? FB_WHITE : INK_1);
    28	  const enColor = variant === "on-blue" ? "rgba(255,255,255,0.72)" : FB_BLUE;
    29	
    30	  return (
    31	    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    32	      <CloudBuddy size={markSize} variant={variant} animated={animated} />
    33	      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    34	        <span
    35	          style={{
    36	            fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    37	            fontWeight: 800,
    38	            fontSize: kanjiSize,
    39	            letterSpacing: "-0.045em",
    40	            color: wmColor,
    41	            lineHeight: 1
    42	          }}
    43	        >
    44	          포맷버디
    45	        </span>
    46	        {en && (
    47	          <span
    48	            style={{
    49	              fontFamily: "'Wanted Sans','Pretendard',sans-serif",
    50	              fontWeight: 700,
    51	              fontSize: Math.round(kanjiSize * 0.42),
    52	              letterSpacing: "0.22em",
    53	              textTransform: "uppercase",
    54	              color: enColor,
    55	              lineHeight: 1
    56	            }}
    57	          >
    58	            Format Buddy
    59	          </span>
    60	        )}
    61	      </span>
    62	    </span>
    63	  );
    64	}
--- src/shared/copy.ts
     1	/**
     2	 * 카피 톤 가이드는 web/CLAUDE.md 기준.
     3	 * 권장: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
     4	 * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
     5	 */
     6	export const copy = {
     7	  appName: "포맷버디",
     8	  appNameEn: "FORMAT BUDDY",
     9	
    10	  homeEyebrow: "PC 포맷 동행 데스크탑",
    11	  homeTitle1: "포맷하기 전에,",
    12	  homeTitle2: "버디가 같이",
    13	  homeTitle3: "살펴볼게요.",
    14	  homeLede:
    15	    "공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와드려요.",
    16	  homeStartCta: "PC 점검 시작",
    17	  homeOpenReportCta: "리포트 열기",
    18	
    19	  scanTitle: "버디가 살펴보는 중",
    20	  scanWaiting: "잠깐, 진단 준비할게요",
    21	  scanLiveLabel: "진단 중",
    22	  scanCancelCta: "그만하기",
    23	
    24	  reportTitle: "살펴봤어요",
    25	  reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
    26	  reportExportCta: "JSON으로 저장",
    27	  reportOpenWebCta: "웹 리포트 뷰어 열기",
    28	  reportBackCta: "처음으로",
    29	
    30	  privacyHeadline: "Ryan의 PC 안에서만 동작해요",
    31	  privacyBullets: [
    32	    "서버로 어떤 파일도 보내지 않아요",
    33	    "인증서 개인키·비밀번호는 수집하지 않아요",
    34	    "JSON 리포트는 Ryan이 직접 저장하고 공유해요"
    35	  ],
    36	
    37	  errorHeadline: "지금 진단을 마치지 못했어요",
    38	  errorRetryCta: "다시 시도",
    39	
    40	  windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
    41	  windowsOnlyBody:
    42	    "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요."
    43	} as const;
--- src/shared/types.ts
     1	export type ScanStepState = "done" | "active" | "pending";
     2	
     3	export interface ScanStepView {
     4	  name: string;
     5	  state: ScanStepState;
     6	  detail: string;
     7	}
     8	
     9	export interface ScanProgress {
    10	  step: string;
    11	  doneSteps: number;
    12	  totalSteps: number;
    13	  score: number;
    14	  elapsedMs: number;
    15	  steps: ScanStepView[];
    16	  message?: string;
    17	}
    18	
    19	export interface SystemInfo {
    20	  manufacturer?: string | null;
    21	  model?: string | null;
    22	  serialNumberMasked?: string | null;
    23	  osCaption?: string | null;
    24	  osVersion?: string | null;
    25	  cpu?: string | null;
    26	  memoryGb?: number | null;
    27	}
    28	
    29	export interface DiskInfo {
    30	  drive: string;
    31	  sizeGb: number;
    32	  freeGb: number;
    33	}
    34	
    35	export interface UserFolderInfo {
    36	  name: string;
    37	  path: string;
    38	  exists: boolean;
    39	  sizeGb: number | null;
    40	}
    41	
    42	export interface InstalledApp {
    43	  name: string;
    44	  version?: string | null;
    45	  publisher?: string | null;
    46	}
    47	
    48	export interface DriverInfo {
    49	  DeviceName?: string;
    50	  DriverVersion?: string;
    51	  Manufacturer?: string;
    52	  DriverDate?: string;
    53	}
    54	
    55	export interface PrinterInfo {
    56	  Name?: string;
    57	  DriverName?: string;
    58	  PortName?: string;
    59	  Default?: boolean;
    60	}
    61	
    62	export interface NpkiCandidate {
    63	  path: string;
    64	  exists: boolean;
    65	}
    66	
    67	export interface BitLockerVolume {
    68	  MountPoint?: string;
    69	  VolumeStatus?: string;
    70	  ProtectionStatus?: string;
    71	  EncryptionPercentage?: number;
    72	}
    73	
    74	export interface CloudSyncCandidate {
    75	  provider: string;
    76	  path: string;
    77	  exists: boolean;
    78	}
    79	
    80	export interface BrowserPresence {
    81	  name: string;
    82	  installed: boolean;
    83	}
    84	
    85	export interface WingetStatus {
    86	  available: boolean;
    87	  note: string;
    88	}
    89	
    90	export interface PrivacyInfo {
    91	  localOnly: boolean;
    92	  noPasswordCollection: boolean;
    93	  noPrivateKeyUpload: boolean;
    94	  noBrowserPasswordExtraction: boolean;
    95	}
    96	
    97	export interface ChecklistInfo {
    98	  reviewNpkiManually: boolean;
    99	  exportWifiProfilesManually: boolean;
   100	  backupDesktopDocumentsDownloads: boolean;
   101	  verifyCloudSync: boolean;
   102	  saveReportBeforeFormat: boolean;
   103	}
   104	
   105	export interface ScanReport {
   106	  schemaVersion: string;
   107	  generatedAt: string;
   108	  privacy: PrivacyInfo;
   109	  system: SystemInfo;
   110	  disks: DiskInfo[];
   111	  userFolders: UserFolderInfo[];
   112	  gpu: string[];
   113	  installedApps: InstalledApp[];
   114	  drivers: DriverInfo[];
   115	  printers: PrinterInfo[];
   116	  wifiProfiles: string[];
   117	  npkiCandidates: NpkiCandidate[];
   118	  bitlocker: BitLockerVolume[];
   119	  cloudSync: CloudSyncCandidate[];
   120	  browsers: BrowserPresence[];
   121	  winget: WingetStatus;
   122	  diagnostics: Array<{ step: string; message: string }>;
   123	  checklist: ChecklistInfo;
   124	}
   125	
   126	export interface ScanResult {
   127	  report: ScanReport;
   128	  jsonPath: string;
   129	}
   130	
   131	export interface ScanError {
   132	  message: string;
   133	  code?: string;
   134	  detail?: string;
   135	}
   136	
   137	export interface ExportOptions {
   138	  defaultFileName?: string;
   139	}
   140	
   141	export interface ExportResult {
   142	  saved: boolean;
   143	  path?: string;
   144	}
--- src/shared/ipc.ts
     1	export const IpcChannels = {
     2	  scanStart: "scan:start",
     3	  scanCancel: "scan:cancel",
     4	  scanProgress: "scan:progress",
     5	  scanComplete: "scan:complete",
     6	  scanError: "scan:error",
     7	  reportExport: "report:export",
     8	  reportOpenWeb: "report:open-web",
     9	  appVersion: "app:version"
    10	} as const;
    11	
    12	export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
--- src/main/paths.ts
     1	import { app } from "electron";
     2	import { existsSync } from "node:fs";
     3	import { join, resolve } from "node:path";
     4	
     5	/**
     6	 * Resolve the PowerShell scan script path.
     7	 * Packaged: process.resourcesPath/powershell/Invoke-FormatBuddyScan.ps1
     8	 * Dev: <projectRoot>/resources/powershell/Invoke-FormatBuddyScan.ps1
     9	 */
    10	export function getScanScriptPath(): string {
    11	  const fileName = "Invoke-FormatBuddyScan.ps1";
    12	
    13	  if (app.isPackaged) {
    14	    return join(process.resourcesPath, "powershell", fileName);
    15	  }
    16	
    17	  const devPath = resolve(__dirname, "..", "..", "resources", "powershell", fileName);
    18	  if (existsSync(devPath)) return devPath;
    19	
    20	  return resolve(process.cwd(), "resources", "powershell", fileName);
    21	}
    22	
    23	export function getScanOutputDir(): string {
    24	  return join(app.getPath("userData"), "scans");
    25	}
    26	
    27	export function getDefaultExportPath(fileName = "formatbuddy-report.json"): string {
    28	  return join(app.getPath("desktop"), fileName);
    29	}
    30	
    31	export function getWebReportImportUrl(): string {
    32	  return "https://formatbuddy.vercel.app/report/import";
    33	}

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '1,620p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	@font-face {
     2	  font-family: "Wanted Sans";
     3	  font-weight: 100 950;
     4	  font-style: normal;
     5	  src: url("./fonts/WantedSansVariable.ttf") format("truetype-variations"),
     6	       url("./fonts/WantedSansVariable.ttf") format("truetype");
     7	  font-display: swap;
     8	}
     9	
    10	@font-face {
    11	  font-family: "Pretendard";
    12	  font-weight: 100 900;
    13	  font-style: normal;
    14	  src: url("./fonts/PretendardVariable.ttf") format("truetype-variations"),
    15	       url("./fonts/PretendardVariable.ttf") format("truetype");
    16	  font-display: swap;
    17	}
    18	
    19	:root {
    20	  --color-fb-blue: #0066ff;
    21	  --color-fb-blue-strong: #005eeb;
    22	  --color-fb-blue-heavy: #0040b5;
    23	  --color-fb-blue-tint: #eaf2fe;
    24	  --color-fb-ink-1: #0e1116;
    25	  --color-fb-ink-2: rgba(46, 47, 51, 0.88);
    26	  --color-fb-ink-3: rgba(55, 56, 60, 0.61);
    27	  --color-fb-ink-4: rgba(55, 56, 60, 0.28);
    28	  --color-fb-bg: #ffffff;
    29	  --color-fb-line: #e1e2e4;
    30	  --color-fb-line-t: rgba(112, 115, 124, 0.22);
    31	  --color-fb-positive: #00bf40;
    32	  --color-fb-warn: #ff9200;
    33	}
    34	
    35	* { box-sizing: border-box; }
    36	
    37	html, body, #root {
    38	  margin: 0;
    39	  padding: 0;
    40	  height: 100%;
    41	  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
    42	  font-feature-settings: "ss01" on, "ss03" on;
    43	  -webkit-font-smoothing: antialiased;
    44	  text-rendering: optimizeLegibility;
    45	  color: var(--color-fb-ink-1);
    46	  background: #ffffff;
    47	  -webkit-user-select: none;
    48	  user-select: none;
    49	}
    50	
    51	button { font-family: inherit; }
    52	
    53	/* ============================================================
    54	   App shell
    55	   ============================================================ */
    56	.fb-app {
    57	  display: flex;
    58	  flex-direction: column;
    59	  min-height: 100vh;
    60	  background: #ffffff;
    61	}
    62	.fb-app-footer {
    63	  display: flex;
    64	  justify-content: space-between;
    65	  align-items: center;
    66	  padding: 12px 24px;
    67	  border-top: 1px solid var(--color-fb-line);
    68	  background: #ffffff;
    69	  font-size: 11px;
    70	  color: var(--color-fb-ink-3);
    71	  font-weight: 500;
    72	  letter-spacing: 0.02em;
    73	}
    74	.fb-app-version { font-feature-settings: "tnum" on; }
    75	
    76	/* ============================================================
    77	   Typography helpers
    78	   ============================================================ */
    79	.fb-h1 {
    80	  font-size: 44px;
    81	  line-height: 1.1;
    82	  font-weight: 800;
    83	  letter-spacing: -0.045em;
    84	  margin: 0 0 20px;
    85	  color: var(--color-fb-ink-1);
    86	}
    87	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
    88	.fb-h1-sm {
    89	  font-size: 32px;
    90	  line-height: 1.15;
    91	  font-weight: 800;
    92	  letter-spacing: -0.04em;
    93	  margin: 0 0 12px;
    94	  color: var(--color-fb-ink-1);
    95	}
    96	.fb-h2 {
    97	  font-size: 22px;
    98	  font-weight: 800;
    99	  letter-spacing: -0.025em;
   100	  color: var(--color-fb-ink-1);
   101	  margin: 0 0 16px;
   102	}
   103	.fb-lede {
   104	  font-size: 15px;
   105	  line-height: 24px;
   106	  color: var(--color-fb-ink-2);
   107	  font-weight: 500;
   108	  letter-spacing: -0.012em;
   109	  margin: 0 0 24px;
   110	  max-width: 520px;
   111	}
   112	
   113	/* ============================================================
   114	   Button
   115	   ============================================================ */
   116	.fb-btn {
   117	  display: inline-flex;
   118	  align-items: center;
   119	  justify-content: center;
   120	  gap: 8px;
   121	  font-weight: 700;
   122	  letter-spacing: -0.015em;
   123	  border: 1px solid transparent;
   124	  border-radius: 12px;
   125	  cursor: pointer;
   126	  white-space: nowrap;
   127	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   128	  user-select: none;
   129	}
   130	.fb-btn:focus-visible {
   131	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   132	  outline-offset: 2px;
   133	}
   134	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   135	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   136	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   137	.fb-btn-full { width: 100%; }
   138	
   139	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   140	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   141	.fb-btn-primary:active { transform: scale(0.98); }
   142	
   143	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   144	.fb-btn-secondary:hover { background: #f7f7f8; }
   145	
   146	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   147	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   148	
   149	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   150	.fb-btn-on-blue:hover { background: #f7f7f8; }
   151	
   152	/* ============================================================
   153	   Cloud-Buddy motion (from design styles.css)
   154	   ============================================================ */
   155	.cb-eye { transform-box: fill-box; transform-origin: center; }
   156	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   157	@keyframes cb-wink {
   158	  0%, 92%, 100% { transform: scaleY(1); }
   159	  94%, 96% { transform: scaleY(0.08); }
   160	}
   161	
   162	.cb-pulse-wrap {
   163	  transform-box: fill-box;
   164	  transform-origin: center;
   165	  opacity: 0;
   166	  animation: cb-pulse 2.4s ease-out infinite;
   167	  pointer-events: none;
   168	}
   169	.cb-pulse-2 { animation-delay: -1.2s; }
   170	@keyframes cb-pulse {
   171	  0% { transform: scale(0.55); opacity: 0.55; }
   172	  80% { opacity: 0.05; }
   173	  100% { transform: scale(1.75); opacity: 0; }
   174	}
   175	
   176	.cb-animated .cb-antenna-dot {
   177	  transform-box: fill-box;
   178	  transform-origin: center;
   179	  animation: cb-charge 1.4s ease-in-out infinite;
   180	}
   181	@keyframes cb-charge {
   182	  0%, 100% { transform: scale(1); }
   183	  50% { transform: scale(1.18); }
   184	}
   185	
   186	.cb-spark {
   187	  transform-box: fill-box;
   188	  transform-origin: center;
   189	  opacity: 0;
   190	  animation: cb-spark 1.4s ease-out infinite;
   191	  pointer-events: none;
   192	}
   193	.cb-spark-2 { animation-delay: -0.7s; }
   194	@keyframes cb-spark {
   195	  0% { transform: scale(0.6); opacity: 0.55; }
   196	  100% { transform: scale(2.2); opacity: 0; }
   197	}
   198	
   199	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   200	@keyframes fb-spin { to { transform: rotate(360deg); } }
   201	
   202	@media (prefers-reduced-motion: reduce) {
   203	  .cb-animated .cb-eye-l,
   204	  .cb-animated .cb-antenna-dot,
   205	  .cb-pulse-wrap,
   206	  .cb-spark,
   207	  .fb-spin { animation: none !important; }
   208	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   209	}
   210	
   211	/* ============================================================
   212	   Home
   213	   ============================================================ */
   214	.fb-home {
   215	  flex: 1;
   216	  display: flex;
   217	  flex-direction: column;
   218	  padding: 24px 40px 40px;
   219	  gap: 32px;
   220	  max-width: 1080px;
   221	  margin: 0 auto;
   222	  width: 100%;
   223	}
   224	.fb-home-header {
   225	  display: flex;
   226	  justify-content: space-between;
   227	  align-items: center;
   228	}
   229	.fb-home-pill {
   230	  display: inline-flex;
   231	  align-items: center;
   232	  gap: 8px;
   233	  height: 32px;
   234	  padding: 0 14px 0 12px;
   235	  background: var(--color-fb-blue-tint);
   236	  color: var(--color-fb-blue-heavy);
   237	  border-radius: 9999px;
   238	  font-size: 12px;
   239	  font-weight: 700;
   240	  letter-spacing: -0.01em;
   241	}
   242	.fb-home-pill-dot {
   243	  width: 6px; height: 6px;
   244	  border-radius: 9999px;
   245	  background: var(--color-fb-blue);
   246	}
   247	
   248	.fb-home-hero {
   249	  display: grid;
   250	  grid-template-columns: 1.4fr 1fr;
   251	  gap: 48px;
   252	  align-items: center;
   253	  padding: 32px 0 8px;
   254	}
   255	.fb-home-hero-copy { display: flex; flex-direction: column; }
   256	.fb-home-hero-mark {
   257	  display: flex;
   258	  justify-content: center;
   259	  align-items: center;
   260	}
   261	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   262	
   263	.fb-home-privacy {
   264	  background: var(--color-fb-blue-tint);
   265	  border-radius: 20px;
   266	  padding: 28px 32px;
   267	}
   268	.fb-home-bullets {
   269	  margin: 0;
   270	  padding-left: 18px;
   271	  color: var(--color-fb-ink-2);
   272	  font-size: 14px;
   273	  line-height: 22px;
   274	  font-weight: 500;
   275	}
   276	.fb-home-bullets li { margin: 0 0 6px; }
   277	
   278	/* ============================================================
   279	   Scanning
   280	   ============================================================ */
   281	.fb-scanning {
   282	  flex: 1;
   283	  display: flex;
   284	  flex-direction: column;
   285	  justify-content: center;
   286	  align-items: center;
   287	  padding: 40px;
   288	}
   289	.fb-scanning-wrap {
   290	  width: 100%;
   291	  max-width: 520px;
   292	  display: flex;
   293	  flex-direction: column;
   294	  gap: 20px;
   295	}
   296	.fb-scanning-actions {
   297	  display: flex;
   298	  gap: 8px;
   299	  justify-content: flex-end;
   300	}
   301	.fb-scanning-error {
   302	  background: #fff5f5;
   303	  border: 1px solid #ffd6d6;
   304	  color: #8b0000;
   305	  border-radius: 12px;
   306	  padding: 14px 16px;
   307	  font-size: 13px;
   308	}
   309	.fb-scanning-error strong { display: block; margin-bottom: 4px; }
   310	.fb-scanning-error p { margin: 0; word-break: break-word; }
   311	
   312	/* ============================================================
   313	   ScanCard
   314	   ============================================================ */
   315	.scan-card {
   316	  background: #ffffff;
   317	  border-radius: 24px;
   318	  border: 1px solid var(--color-fb-line-t);
   319	  box-shadow: 0 1px 6px rgb(23 23 25 / 0.06), 0 12px 32px rgb(23 23 25 / 0.10);
   320	  padding: 28px;
   321	  display: flex;
   322	  flex-direction: column;
   323	  gap: 22px;
   324	}
   325	.scan-card-head {
   326	  display: flex;
   327	  align-items: center;
   328	  justify-content: space-between;
   329	}
   330	.scan-card-who { display: flex; align-items: center; gap: 10px; }
   331	.scan-card-who-meta { display: flex; flex-direction: column; gap: 2px; }
   332	.scan-card-title { font-size: 14px; font-weight: 700; color: var(--color-fb-ink-1); }
   333	.scan-card-elapsed { font-size: 12px; font-weight: 500; color: var(--color-fb-ink-3); }
   334	.scan-card-live {
   335	  display: flex;
   336	  align-items: center;
   337	  gap: 6px;
   338	  font-size: 12px;
   339	  font-weight: 600;
   340	  color: var(--color-fb-positive);
   341	}
   342	.scan-card-live-dot {
   343	  width: 7px; height: 7px;
   344	  border-radius: 9999px;
   345	  background: var(--color-fb-positive);
   346	  box-shadow: 0 0 0 3px rgba(0,191,64,0.18);
   347	}
   348	
   349	.scan-score {
   350	  background: var(--color-fb-blue-tint);
   351	  border-radius: 20px;
   352	  padding: 22px 24px;
   353	  display: grid;
   354	  grid-template-columns: 1fr auto;
   355	  gap: 16px;
   356	  align-items: center;
   357	}
   358	.scan-score-label {
   359	  font-size: 12px;
   360	  font-weight: 700;
   361	  letter-spacing: 0.04em;
   362	  color: var(--color-fb-blue-heavy);
   363	  margin-bottom: 4px;
   364	}
   365	.scan-score-value {
   366	  font-size: 56px;
   367	  font-weight: 800;
   368	  letter-spacing: -0.045em;
   369	  color: var(--color-fb-ink-1);
   370	  line-height: 1;
   371	  font-feature-settings: "tnum" on;
   372	}
   373	.scan-score-unit {
   374	  font-size: 24px;
   375	  font-weight: 700;
   376	  margin-left: 2px;
   377	  letter-spacing: -0.02em;
   378	  color: var(--color-fb-ink-2);
   379	}
   380	.scan-score-sub {
   381	  font-size: 12px;
   382	  color: var(--color-fb-ink-3);
   383	  font-weight: 500;
   384	  margin-top: 8px;
   385	}
   386	
   387	.scan-steps { display: flex; flex-direction: column; gap: 6px; }
   388	.scan-step {
   389	  display: grid;
   390	  grid-template-columns: 32px 1fr auto;
   391	  align-items: center;
   392	  gap: 12px;
   393	  padding: 12px 14px;
   394	  border-radius: 12px;
   395	  background: #ffffff;
   396	  border: 1px solid var(--color-fb-line-t);
   397	}
   398	.scan-step.active {
   399	  background: var(--color-fb-blue-tint);
   400	  border-color: rgba(0,102,255,0.22);
   401	}
   402	.scan-step-idx {
   403	  width: 24px; height: 24px;
   404	  border-radius: 9999px;
   405	  background: var(--color-fb-blue-tint);
   406	  color: var(--color-fb-blue);
   407	  font-size: 12px;
   408	  font-weight: 800;
   409	  display: flex; align-items: center; justify-content: center;
   410	  font-feature-settings: "tnum" on;
   411	}
   412	.scan-step.done .scan-step-idx { background: var(--color-fb-blue); color: #ffffff; }
   413	.scan-step.pending .scan-step-idx { background: #f4f4f5; color: var(--color-fb-ink-3); }
   414	.scan-step-name { font-size: 14px; font-weight: 600; color: var(--color-fb-ink-1); }
   415	.scan-step-state {
   416	  font-size: 12px;
   417	  font-weight: 600;
   418	  letter-spacing: -0.01em;
   419	  color: var(--color-fb-ink-3);
   420	  display: flex; align-items: center; gap: 4px;
   421	}
   422	.scan-step.done .scan-step-state { color: var(--color-fb-positive); }
   423	.scan-step.active .scan-step-state { color: var(--color-fb-blue); }
   424	
   425	/* ============================================================
   426	   Report
   427	   ============================================================ */
   428	.fb-report {
   429	  flex: 1;
   430	  display: flex;
   431	  flex-direction: column;
   432	  padding: 24px 40px 40px;
   433	  gap: 24px;
   434	  max-width: 1080px;
   435	  margin: 0 auto;
   436	  width: 100%;
   437	}
   438	.fb-report-header {
   439	  display: flex;
   440	  justify-content: space-between;
   441	  align-items: center;
   442	}
   443	.fb-report-actions { display: flex; gap: 8px; }
   444	.fb-report-hero { padding: 8px 0 0; }
   445	
   446	.fb-report-grid {
   447	  display: grid;
   448	  grid-template-columns: repeat(2, 1fr);
   449	  gap: 16px;
   450	}
   451	.fb-card {
   452	  background: #ffffff;
   453	  border: 1px solid var(--color-fb-line);
   454	  border-radius: 20px;
   455	  padding: 22px 24px;
   456	  display: flex;
   457	  flex-direction: column;
   458	  gap: 6px;
   459	}
   460	.fb-card h3 {
   461	  margin: 0 0 8px;
   462	  font-size: 15px;
   463	  font-weight: 800;
   464	  letter-spacing: -0.02em;
   465	  color: var(--color-fb-ink-1);
   466	}
   467	.fb-card-checklist { grid-column: span 2; }
   468	
   469	.fb-report-row {
   470	  display: grid;
   471	  grid-template-columns: 110px 1fr;
   472	  gap: 12px;
   473	  padding: 6px 0;
   474	  border-bottom: 1px dashed var(--color-fb-line-t);
   475	  font-size: 13px;
   476	}
   477	.fb-report-row:last-child { border-bottom: none; }
   478	.fb-report-row-label { color: var(--color-fb-ink-3); font-weight: 600; }
   479	.fb-report-row-value { color: var(--color-fb-ink-1); font-weight: 500; }
   480	
   481	.fb-report-checklist {
   482	  margin: 0;
   483	  padding-left: 18px;
   484	  color: var(--color-fb-ink-2);
   485	  font-size: 14px;
   486	  line-height: 22px;
   487	  font-weight: 500;
   488	}
   489	
   490	.fb-report-cta {
   491	  display: flex;
   492	  gap: 10px;
   493	  align-items: center;
   494	  flex-wrap: wrap;
   495	}
   496	.fb-report-cta-status {
   497	  flex-basis: 100%;
   498	  font-size: 12px;
   499	  color: var(--color-fb-ink-3);
   500	  margin: 4px 0 0;
   501	}
   502	
   503	.fb-report-meta {
   504	  display: flex;
   505	  justify-content: space-between;
   506	  color: var(--color-fb-ink-3);
   507	  font-size: 11px;
   508	}

exec
/bin/zsh -lc "nl -ba /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy/HANDOFF.md | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	# Handoff: 포맷버디 (Format Buddy) — 로고 + 홈페이지
     2	
     3	> PC 포맷 동행 서비스 **포맷버디** 의 브랜드 마크 + 데스크탑 홈페이지 디자인 핸드오프.
     4	
     5	---
     6	
     7	## Overview
     8	
     9	**포맷버디 (Format Buddy)** 는 PC 포맷 전에 사용자가 놓치기 쉬운 항목(공동인증서, 카카오톡 백업, 드라이버, 라이센스 등)을 함께 챙겨주는 한국형 PC 포맷 동행 서비스입니다. 이 핸드오프에는 다음이 포함되어 있어요:
    10	
    11	1. **클라우드-버디 (Cloud-Buddy)** — 캐릭터 로고 시스템 (모션 포함)
    12	2. **데스크탑 홈페이지 (1440px)** — 헤더 / 히어로 / 사용 방식 / 피처 / 후기 / CTA / 풋터
    13	
    14	---
    15	
    16	## About the Design Files
    17	
    18	이 폴더 안에 있는 HTML / JSX / CSS 파일들은 **디자인 레퍼런스**예요. 브라우저에서 인-라인 Babel 로 돌아가는 프로토타입으로, 실제 외형과 동작을 보여주는 용도이지 그대로 복사해서 프로덕션에 올리려고 만든 코드는 아니에요.
    19	
    20	**개발자가 해야 할 일은**: 이 디자인을 우리(혹은 신규) 코드베이스의 기존 패턴/라이브러리로 다시 구현하는 거예요.
    21	
    22	- 코드베이스가 이미 있다면 → 거기 쓰는 React/Next.js, Vue, SvelteKit, Tailwind/CSS Modules, 컴포넌트 라이브러리 패턴 그대로 사용
    23	- 코드베이스가 없다면 → **Next.js 14 + App Router + Tailwind** 또는 **Vite + React + CSS Modules** 추천 (가장 일반적인 디폴트)
    24	
    25	CSS 토큰(`styles.css` 의 `:root`)과 SVG, 폰트 파일은 **그대로 추출해서 가져다 쓰면 돼요**. 컴포넌트 JSX 는 구조 참고용이에요.
    26	
    27	---
    28	
    29	## Fidelity
    30	
    31	**High-fidelity (hifi)**. 컬러·타이포·간격·인터랙션은 모두 최종이에요. 픽셀 단위로 그대로 옮기세요.
    32	
    33	- 그리드: **12-col, 80px / 24px gutter at 1280+**
    34	- 본 디자인 폭: **1440px (데스크탑 기준)**
    35	- 모바일 / 태블릿 시안은 아직 없음 → 디자이너와 협의 필요 (개발 시 기본 가이드는 본 문서 마지막 "Responsive Guidance" 참고)
    36	
    37	---
    38	
    39	## Design Principles (반드시 지킬 것)
    40	
    41	1. **배경은 순수 화이트 `#FFFFFF` 1색만.** 크림·민트·그레이·블랙 등 틴티드/다크 배경 금지.
    42	2. **키컬러는 Wanted Blue `#0066FF` 1색.** 모든 CTA / 액센트 / 액티브 상태는 이 블루.
    43	3. **강조 면(예: CTA 밴드)** 도 다크가 아닌 **블루 배경 + 화이트 텍스트** 로 처리.
    44	4. **로고 변형 2종만**: Primary (블루 on 화이트) / On-blue (화이트 on 블루). 다크·크림·모노 사용 금지.
    45	5. **이모지·하드 그리드 패턴·컬러 섀도·인셋 섀도** 금지.
    46	6. **타이포는 Wanted Sans Variable.** 디스플레이는 트래킹 `-4.5%`, weight `700-800`.
    47	7. **다크 모드는 사용하지 않음** (원칙 #1 과 충돌).
    48	
    49	---
    50	
    51	## Design Tokens
    52	
    53	`styles.css` 의 `:root` 블록이 **단일 진실원(single source of truth)** 입니다. Tailwind config 든 Style Dictionary 든, 이 블록 그대로 변환하세요.
    54	
    55	### Color
    56	
    57	```css
    58	/* Brand */
    59	--fb-blue:        #0066FF;   /* primary */
    60	--fb-blue-strong: #005EEB;   /* hover */
    61	--fb-blue-heavy:  #0040B5;   /* pressed / display-on-tint */
    62	--fb-blue-tint:   #EAF2FE;   /* chip bg, score panel, tags */
    63	
    64	/* Ink */
    65	--fb-ink-1: #0E1116;                     /* headings */
    66	--fb-ink-2: rgba(46, 47, 51, 0.88);      /* body */
    67	--fb-ink-3: rgba(55, 56, 60, 0.61);      /* captions */
    68	--fb-ink-4: rgba(55, 56, 60, 0.28);      /* disabled */
    69	
    70	/* Surface */
    71	--fb-bg:     #FFFFFF;
    72	--fb-line:   #E1E2E4;
    73	--fb-line-t: rgba(112,115,124,0.22);
    74	
    75	/* Status */
    76	--fb-positive: #00BF40;
    77	--fb-warn:     #FF9200;
    78	```
    79	
    80	### Typography
    81	
    82	폰트는 `fonts/` 폴더에 가변 폰트로 들어 있어요.
    83	
    84	```css
    85	font-family: 'Wanted Sans', 'Pretendard', -apple-system, system-ui, sans-serif;
    86	font-feature-settings: "ss01" on, "ss03" on;
    87	```
    88	
    89	| 토큰 | size / line-height / tracking | weight |
    90	|---|---|---|
    91	| Display (Hero H1)  | 72 / 76 / −4.5% | 800 |
    92	| Section H2         | 40 / 46 / −4%   | 800 |
    93	| Card H3            | 22 / 28 / −2%   | 700 |
    94	| Body L (lede)      | 19 / 30 / −1.2% | 500 |
    95	| Body               | 16 / 26 / −1%   | 500 |
    96	| Label              | 14 / 20 / −1%   | 600 |
    97	| Caption            | 12 / 16 / +0.4% | 500 |
    98	
    99	### Spacing (4-pt scale)
   100	
   101	`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 · 128`
   102	
   103	### Radius
   104	
   105	`8 · 10 · 12 · 16 · 20 · 24 · 9999(pill)`
   106	- 버튼: 12 · 입력: 12 · 카드: 16-20 · 모달: 24 · 칩/아바타: 9999
   107	
   108	### Shadow
   109	
   110	```css
   111	--fb-shadow-emphasize: 0 1px 4px rgba(23,23,25,0.07), 0 4px 12px rgba(23,23,25,0.08);
   112	--fb-shadow-strong:    0 1px 6px rgba(23,23,25,0.06), 0 12px 32px rgba(23,23,25,0.10);
   113	```
   114	
   115	**컬러 섀도·인셋 섀도 사용 금지.**
   116	
   117	---
   118	
   119	## Logo System (Cloud-Buddy)
   120	
   121	브랜드 마크는 **구름 = 버디의 몸** 이라는 메타포로, 백업/저장과 친구 캐릭터를 한 형태에 결합했어요.
   122	
   123	### Variants (2종)
   124	
   125	| Variant | Body | Face | Background |
   126	|---|---|---|---|
   127	| `primary` | `#0066FF` | `#FFFFFF` | `#FFFFFF` |
   128	| `on-blue` | `#FFFFFF` | `#0066FF` | `#0066FF` |
   129	
   130	> 다크/그레이/크림 위에는 절대 올리지 마세요. 두 변형 모두 트랜스페어런트 백그라운드의 SVG 로 제공.
   131	
   132	### SVG Assets
   133	
   134	- `assets/logo/cloud-buddy-primary.svg` (240×240 viewBox, blue body)
   135	- `assets/logo/cloud-buddy-on-blue.svg` (240×240 viewBox, white body — blue 위에 올릴 것)
   136	
   137	### Component API (logos.jsx 참고)
   138	
   139	```jsx
   140	<CloudBuddy
   141	  size={40}                       // 픽셀 단위 정사각형
   142	  variant="primary"               // 'primary' | 'on-blue'
   143	  expression="smile"              // 'smile' | 'calm' | 'wink'
   144	  animated={true}                 // false 기본. true 시 wink + pulse + charge
   145	  blink                           // 개별: 왼쪽 눈 윙크만
   146	  pulse                           // 개별: 본체 스캔 펄스 + 안테나 차징
   147	/>
   148	```
   149	
   150	### Motion (animated 모드)
   151	
   152	진단 중 상태에서만 사용. 정적 표시(헤더/풋터/CTA)에서는 끔.
   153	
   154	| 모션 | 대상 | 주기 | 효과 |
   155	|---|---|---|---|
   156	| **Wink** | 왼쪽 눈 (`.cb-eye-l`) | 4.6s | 4.6초마다 한 번 눈을 살짝 감음 (scaleY 1 → 0.08) |
   157	| **Pulse** | 본체 주위 두 개 동심원 (`.cb-pulse-wrap`) | 2.4s (1.2s 오프셋) | 클라우드 뒤에서 링이 바깥으로 확장하며 페이드 |
   158	| **Charge** | 안테나 점 + 두 개 스파크 | 1.4s (0.7s 오프셋) | 점이 살짝 커졌다 작아지며, 주위로 빛이 번짐 (피카츄 차징) |
   159	
   160	모든 모션은 `prefers-reduced-motion: reduce` 시 자동 비활성화 (CSS `@media` 규칙).
   161	
   162	### 최소 사이즈
   163	
   164	- 디지털: **16px** (그 이하는 워드마크 단독)
   165	- 인쇄: **8mm** (높이 기준)
   166	- 안전 여백: 마크 높이의 **1/4** 클리어 스페이스
   167	
   168	### Lockup (가로형 워드마크)
   169	
   170	```
   171	[ Cloud-Buddy ]  포맷버디
   172	                 FORMAT BUDDY    ← optional, en={true}
   173	```
   174	
   175	- 한글 워드마크: Wanted Sans 800, 트래킹 −4.5%
   176	- 영문 서브: Wanted Sans 700, 트래킹 +22%, ALL CAPS
   177	- 마크와 워드마크 간격: 10px
   178	
   179	---
   180	
   181	## Screens / Views
   182	
   183	### View 1 — Desktop Home (1440 × ~3300)
   184	
   185	**Purpose**: 첫 방문자에게 "포맷 전에 같이 챙겨주는 서비스" 라는 가치를 전달하고, 무료 진단 CTA 로 유도.
   186	
   187	**Layout**: 단일 컬럼 풀-블리드. 모든 섹션은 `padding: 96px 80px` (히어로만 `88px 80px 96px`).
   188	
   189	#### 1.1 Header (height: 72px, sticky)
   190	
   191	- 좌측: Lockup (마크 36px + 한글 워드마크 20px, 영문 서브 없음) + nav 5개 (`진단 시작 · 리포트 · 체크리스트 · 다운로드 · 지원`)
   192	- 우측: `로그인` (text-only) + `무료 점검 시작` (Primary, md, with arrow icon)
   193	- 배경: `rgba(255,255,255,0.88)` + `backdrop-filter: blur(12px) saturate(180%)`
   194	- 하단 보더: `1px solid var(--fb-line)`
   195	
   196	#### 1.2 Hero (좌측 카피 + 우측 스캔 카드)
   197	
   198	**그리드**: `grid-template-columns: 1fr 540px; gap: 64px; align-items: center;`
   199	
   200	**좌측 컬럼**:
   201	- Eyebrow chip (블루 틴트 배경, 블루 텍스트): `● PC 포맷 동행 서비스`
   202	- H1 (72/76 / 800 / −4.5%):
   203	  > 포맷하기 전에,
   204	  > 버디가 같이 **살펴볼게요.**   ← '살펴볼게요' 만 블루
   205	- Lede (19/30 / 500 / max-width 520):
   206	  > 공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와주는 로컬 우선 동행 서비스예요.
   207	- CTA group (gap 10):
   208	  - Primary lg: `무료 PC 점검 시작 →`
   209	  - Secondary lg: `버디 리포트 보기`
   210	- Trust row (margin-top 40):
   211	  - 4 개 아바타 스택 (28px, 2px 화이트 보더, −8px 오버랩, 모두 블루 틴트 배경)
   212	  - `지난주 동안 **1,284명** 이 안전하게 포맷을 마쳤어요.`
   213	
   214	**우측 컬럼 — ScanCard (`<ScanCard />`)**:
   215	- 위치: 카드 위에 floating 말풍선 `완료까지 약 4분 남았어요!` (블루 배경, 화이트 텍스트, 꼬리는 아래로 향해서 카드 안 버디 아바타를 가리킴)
   216	- 카드: 화이트, radius 24, `--fb-shadow-strong`, `1px solid --fb-line-t`, padding 28
   217	- 카드 내부 구조:
   218	  1. **head**: `<CloudBuddy size={36} animated />` + "버디가 살펴보는 중 / 3분 18초 경과" + "● 진단 중" (positive 라이브 닷)
   219	  2. **score panel** (블루 틴트 배경, radius 20, padding 22/24):
   220	     - `버디 안심 점수` 라벨 (12 / 700 / blue-heavy)
   221	     - `72점` 큰 숫자 (56 / 800 / −4.5% / tnum)
   222	     - `전체 56개 항목 중 24개 검사 완료` 서브
   223	     - 우측 76×76 SVG 도넛 (블루 stroke, 진행률 표시)
   224	  3. **steps**: 4 개 진행 단계 행. 각 행:
   225	     - 24×24 인덱스 칩 (완료=블루필+화이트체크, 진행중=블루틴트+블루숫자, 대기=라이트필+회색숫자)
   226	     - 이름 (14 / 600)
   227	     - 상태 텍스트 우측 정렬 (진행중=스피너+블루, 완료=positive, 대기=회색)
   228	     - 진행 중 행은 배경이 블루 틴트 + 보더 블루 22% 알파
   229	
   230	#### 1.3 How it works (white)
   231	
   232	- Section head: kicker `HOW IT WORKS` (블루) + H2 `버디가 동행하는 방식` + 우측 lede
   233	- 3 개 카드 가로 grid (gap 20):
   234	  - 각 카드: 화이트 배경, `1px solid --fb-line`, radius 20, padding 32
   235	  - 좌상단 36px 블루 원형 번호 칩 (`01` / `02` / `03`)
   236	  - H3 + 본문 4-5 줄
   237	
   238	**Copy**:
   239	- 01 한 번에 진단해요 → 내 PC 를 천천히 훑으면서 백업이 필요한 항목, 인증서, 설치된 앱 목록까지 한 번에 모아봐요.
   240	- 02 쉬운 말로 알려줘요 → "이건 지금 해도 돼요" / "이건 멈추고 확인해요" 처럼 친구가 옆에서 알려주듯 안내해요.
   241	- 03 복원 준비까지 같이 → 포맷 후에도 원래대로 돌리도록, 어디에 무엇이 있어야 하는지 체크리스트로 정리해드려요.
   242	
   243	#### 1.4 Features (white)
   244	
   245	- Section head: kicker `WHY 포맷버디` + H2 `딱딱한 점검 프로그램이 아니에요`
   246	- 3 개 카드:
   247	  - 좌상단 44×44 블루 틴트 아이콘 박스 (radius 12)
   248	  - 아이콘: 한국 PC = 화면+한글, 로컬 = 방패+체크, 쉬운 언어 = 말풍선+텍스트선 (Wanted 1.5px round-cap 스타일, 24×24)
   249	  - H3 + 본문 + 태그 칩 (블루 틴트 배경, blue-heavy 텍스트)
   250	
   251	#### 1.5 Reviews (white) — **신규 섹션**
   252	
   253	- Section head: kicker `사용자 후기` + H2 `포맷, 이번엔 마음 편했어요` + 우측 통계:
   254	  - 별 5개 (블루)
   255	  - `4.9 / 5` (40px 800)
   256	  - `1,284명의 후기` (작은 텍스트, 좌측 보더 분리)
   257	- 3 개 후기 카드:
   258	  - 별 5개 → 인용구 (18 / 28 / 600, text-wrap pretty) → 보더 위 작성자 (40×40 아바타 + 이름/서브)
   259	
   260	**Copy** (3 개):

exec
/bin/zsh -lc "nl -ba /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy/HANDOFF.md | sed -n '260,560p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   260	**Copy** (3 개):
   261	- 김민지 (직장인 · 포맷 6번째): "공동인증서 옮기는 게 늘 골치였는데, 버디 덕에 처음으로 안 빼먹고 포맷했어요."
   262	- 이서준 (프리랜서 · 31세): "'지금 해도 돼 / 멈추고 확인' 표현이 진짜 편해요. 전문용어가 무서운 사람도 안심하고 진행할 수 있어요."
   263	- 박지원 (대학원생): "어머니 노트북 포맷할 때 양이 옆에서 같이 보면서 따라하기 좋았어요. 친구가 도와주는 느낌."
   264	
   265	#### 1.6 CTA Band (blue background)
   266	
   267	- 배경: `var(--fb-blue)` 풀-블리드, padding `72px 80px`
   268	- 그리드: `1fr auto; align-items: center; gap: 48px;`
   269	- 좌측: H2 `준비됐다면, 같이 시작해볼게요.` + 본문 `설치 없이 브라우저에서 바로. 약 5분이면 진단이 끝나요.` (화이트, 82% 알파)
   270	- 우측: `<CloudBuddy size={72} variant="on-blue" />` + `무료 PC 점검 시작 →` (`btn-on-blue` 클래스 — 화이트 배경 + 블루 텍스트)
   271	
   272	#### 1.7 Footer (white, 40px 80px)
   273	
   274	- 좌측: 마크 28px + 한글 워드마크 15px (회색) + © 카피
   275	- 우측: `이용약관 · 개인정보처리방침 · 고객센터 · 공지사항`
   276	- 위 보더: `1px solid --fb-line`
   277	
   278	---
   279	
   280	## Interactions & Behavior
   281	
   282	### Hover / Press / Focus
   283	
   284	- **Primary 버튼**: hover → `--fb-blue-strong`. active → `transform: scale(0.98)`
   285	- **Secondary 버튼**: hover → background `#F7F7F8`
   286	- **Nav link**: hover → ink-2 → ink-1
   287	- **Card hover** (선택 사항, 디자인 캔버스에서는 미적용): shadow `--fb-shadow-emphasize` 적용, 보더 translucent 로 페이드
   288	- **Focus ring (모든 인터랙티브)**: `2px solid var(--fb-blue) at 40% alpha`, offset 2px
   289	
   290	### Scan Card (실데이터)
   291	
   292	`<ScanCard />` 는 현재 하드코딩이지만, 프로덕션에선 props 로 분리하세요:
   293	
   294	```ts
   295	interface ScanCardProps {
   296	  score: number;          // 0-100
   297	  elapsedSec: number;     // 초 단위
   298	  totalSteps: number;     // 진단 항목 총수
   299	  doneSteps: number;      // 완료된 항목 수
   300	  steps: ScanStep[];      // 4-stage 진행 상태
   301	}
   302	
   303	interface ScanStep {
   304	  name: string;
   305	  state: 'done' | 'active' | 'pending';
   306	  detail: string;         // '완료' | '진행 중' | '대기'
   307	}
   308	```
   309	
   310	도넛 SVG 는 `(score/100) * 2π r` 만큼 stroke-dasharray 로 계산.
   311	
   312	### Animation Spec
   313	
   314	| 컴포넌트 | 속성 | 값 |
   315	|---|---|---|
   316	| 모든 transition | duration / easing | 150ms / `cubic-bezier(0.2, 0, 0, 1)` (entry), `cubic-bezier(0.4, 0, 1, 1)` (exit) |
   317	| 모달 (해당없음) | duration | 300ms |
   318	| CloudBuddy wink | duration / 트리거 | 4.6s loop / `animated` prop |
   319	| CloudBuddy pulse | duration / 트리거 | 2.4s loop / `animated` prop |
   320	| CloudBuddy charge | duration / 트리거 | 1.4s loop / `animated` prop |
   321	
   322	### Reduced Motion
   323	
   324	`@media (prefers-reduced-motion: reduce)` 시 모든 캐릭터 모션을 비활성화. `styles.css` 의 미디어 쿼리 그대로 차용.
   325	
   326	---
   327	
   328	## State Management
   329	
   330	전체 페이지는 정적 콘텐츠가 대부분이라 클라이언트 스테이트가 크지 않아요. 필요한 곳:
   331	
   332	- **ScanCard**: 진단 진행률 (서버에서 폴링 / WebSocket 으로 받아오기 — 현재 정적 mock)
   333	- **Hero CTA**: `무료 PC 점검 시작` 클릭 시 진단 페이지(`/scan`) 로 이동 — 라우터 처리
   334	- **Header nav**: 5 개 경로 (`/start`, `/report`, `/checklist`, `/download`, `/support`) — 다른 시안 필요
   335	
   336	---
   337	
   338	## Assets
   339	
   340	| 파일 | 출처 | 비고 |
   341	|---|---|---|
   342	| `fonts/WantedSansVariable.ttf` | Wanted Design System (Community Figma) | 가변 폰트, 100-950 |
   343	| `fonts/PretendardVariable.ttf` | Pretendard 오픈 | 가변 폰트, 폴백 |
   344	| `assets/logo/cloud-buddy-primary.svg` | 본 디자인 | 트랜스페어런트, 블루 마크 |
   345	| `assets/logo/cloud-buddy-on-blue.svg` | 본 디자인 | 트랜스페어런트, 화이트 마크 |
   346	
   347	폰트 라이센스: Wanted Sans 는 Wanted Lab 의 오픈 폰트. Pretendard 는 SIL OFL. 둘 다 상업 사용 가능 — 자세한 라이센스는 각 폰트 페이지 확인.
   348	
   349	---
   350	
   351	## Files in This Bundle
   352	
   353	| 파일 | 역할 |
   354	|---|---|
   355	| `HANDOFF.md` | **이 문서.** 개발자가 가장 먼저 읽는 문서. |
   356	| `index.html` | 디자인 캔버스 (로고 시안 + 풀 페이지). 브라우저에서 열어 실 외형 확인용. |
   357	| `styles.css` | 모든 디자인 토큰(`:root`) + 컴포넌트 스타일. **그대로 추출해서 가져다 쓰면 됨.** |
   358	| `logos.jsx` | `<CloudBuddy />`, `<Wordmark />`, `<WordmarkEN />`, `<Lockup />` 정의. 구조 참고. |
   359	| `homepage.jsx` | `<Header />`, `<Hero />`, `<ScanCard />`, `<HowItWorks />`, `<Features />`, `<Reviews />`, `<CtaBand />`, `<Footer />` 정의. 구조 참고. |
   360	| `design-canvas.jsx` | 디자인 캔버스 프리뷰 래퍼. **프로덕션에는 사용 X.** |
   361	| `assets/logo/*.svg` | 로고 마크 SVG (트랜스페어런트). 그대로 사용 가능. |
   362	| `fonts/*.ttf` | Wanted Sans + Pretendard 가변 폰트. 호스팅 가능한 곳으로 이관. |
   363	
   364	### 빠르게 띄워 보기
   365	
   366	```sh
   367	cd design_handoff_format_buddy
   368	python3 -m http.server 8000   # 또는 npx serve .
   369	# http://localhost:8000/index.html
   370	```
   371	
   372	---
   373	
   374	## Responsive Guidance (모바일 시안 없음 — 구현 시 가이드)
   375	
   376	본 핸드오프에는 데스크탑(1440) 만 있어요. 모바일/태블릿 구현 시 적용 권장:
   377	
   378	| Breakpoint | 그리드 | 페이지 패딩 | 변경점 |
   379	|---|---|---|---|
   380	| ≥1280px | 12-col, 80px gutter | 80px | 본 시안 그대로 |
   381	| 1024-1279px | 12-col, 24px gutter | 64px | 히어로 우측 카드 폭 축소 (480px) |
   382	| 768-1023px | 8-col | 40px | 히어로 1-col 스택 (스캔 카드 아래) + 섹션 카드 2-col |
   383	| ≤767px (mobile) | 4-col | 20px | 헤더 nav 햄버거화, 모든 카드 1-col 스택, H1 → 40px |
   384	
   385	CloudBuddy 크기: 헤더 32 → 28 (모바일), 스캔 카드 36 → 32, CTA 72 → 56.
   386	
   387	---
   388	
   389	## Claude Code 작업 체크리스트
   390	
   391	이 패키지를 받은 개발자가 우선 처리할 것:
   392	
   393	- [ ] 프로젝트 세팅 (Next.js 14 + App Router + Tailwind 권장, 혹은 기존 코드베이스에 맞춤)
   394	- [ ] `fonts/` 내 가변 폰트를 `public/fonts/` 로 이관 + `@font-face` 등록 (또는 `next/font/local`)
   395	- [ ] `styles.css` 의 `:root` 변수를 Tailwind config(`theme.extend.colors`, `fontFamily`, etc.) 또는 CSS Modules 토큰으로 변환
   396	- [ ] `<CloudBuddy />` 컴포넌트를 프로젝트 컴포넌트 라이브러리로 이동 (Storybook 등록 권장). `forwardRef` + TypeScript `type CloudBuddyProps` 추가
   397	- [ ] `.btn-*` 클래스를 `<Button variant size>` 컴포넌트로 추상화
   398	- [ ] `<ScanCard />` 의 props 인터페이스화 (위 State Management 섹션 참고). 실 데이터 hook 연결
   399	- [ ] 5 개 라우트(`/scan`, `/report`, `/checklist`, `/download`, `/support`)는 스텁만. 디자인은 추가 핸드오프로.
   400	- [ ] 반응형 (위 표 참고). 모바일 시안이 없으니, 1차 구현 후 디자이너와 리뷰 권장
   401	- [ ] 접근성 패스: 모든 인터랙티브에 포커스 링, 이미지 alt, 색상 대비 검증
   402	- [ ] 모션 비활성화 (`prefers-reduced-motion`) 동작 확인
   403	- [ ] Lighthouse / 코어 웹 바이탈 점검
   404	
   405	---
   406	
   407	## Quick Start Prompt for Claude Code
   408	
   409	이 폴더를 Claude Code 에 던지고 시작할 때 첫 메시지 예시:
   410	
   411	> 이 폴더(`design_handoff_format_buddy/`)는 **포맷버디** 웹사이트의 디자인 핸드오프야. `HANDOFF.md` 먼저 읽어줘. 거기 적힌 디자인 원칙을 지켜서 Next.js 14 + App Router + Tailwind 프로젝트로 새로 셋업해줘.
   412	>
   413	> 1단계: 프로젝트 스캐폴딩 + `styles.css` 의 토큰을 Tailwind config 으로 변환 + Wanted Sans 폰트 등록.
   414	> 2단계: `<CloudBuddy />` 컴포넌트를 TypeScript + forwardRef 로 재구현 (인-라인 SVG, 애니메이션 포함).
   415	> 3단계: 홈페이지를 섹션 컴포넌트로 분리해서 `app/page.tsx` 에 조립.
   416	>
   417	> `homepage.jsx` 의 카피와 구조는 그대로 유지, `index.html` 캔버스에서 시각 확인 가능.
   418	
   419	---
   420	
   421	## Change Log
   422	
   423	| 버전 | 일자 | 내용 |
   424	|---|---|---|
   425	| v1.0 | 2026.05.17 | Cloud-Buddy 로고 + 홈페이지 1차 |
   426	| v1.1 | 2026.05.17 | 모노 변형 제거, 모션(눈/펄스) 1차 |
   427	| v1.2 | 2026.05.17 | 눈동자 단순화 (사이즈 축소, 솔리드 닷) |
   428	| v1.3 | 2026.05.17 | 윙크 한쪽 눈만 + 안테나 차징 모션 추가 |
   429	
   430	문의: 포맷버디 디자인 팀

exec
/bin/zsh -lc "find resources -maxdepth 4 -type f -print | sort | while read f; do echo '---' "'$f; file "$f"; done && echo '"'--- ps1 ---' && nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- resources/fonts/PretendardVariable.ttf
resources/fonts/PretendardVariable.ttf: TrueType Font data, 16 tables, 1st "GDEF", 167 names, Macintosh, type 274 string, Straight-sided six and nineOpen fourVertically centered colonKorean localizationHigh legibilityO
--- resources/fonts/WantedSansVariable.ttf
resources/fonts/WantedSansVariable.ttf: TrueType Font data, 16 tables, 1st "GDEF", name offset 0x279b08
--- resources/icons/app-icon.ico
resources/icons/app-icon.ico: MS Windows icon resource - 4 icons, 48x48, 32 bits/pixel, 32x32, 32 bits/pixel
--- resources/icons/cloud-buddy-on-blue.svg
resources/icons/cloud-buddy-on-blue.svg: SVG Scalable Vector Graphics image
--- resources/icons/cloud-buddy-primary.svg
resources/icons/cloud-buddy-primary.svg: SVG Scalable Vector Graphics image
--- resources/powershell/Invoke-FormatBuddyScan.ps1
resources/powershell/Invoke-FormatBuddyScan.ps1: Unicode text, UTF-8 text
--- ps1 ---
     1	# FormatBuddy local diagnostic prototype
     2	# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
     3	
     4	param(
     5	  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json"
     6	)
     7	
     8	$ErrorActionPreference = "SilentlyContinue"
     9	$diagnostics = New-Object System.Collections.Generic.List[object]
    10	
    11	function Add-Diagnostic {
    12	  param([string]$Step, [string]$Message)
    13	  $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
    14	}
    15	
    16	function Get-SafeCimInstance {
    17	  param([string]$ClassName)
    18	  try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
    19	}
    20	
    21	function Get-InstalledApps {
    22	  $paths = @(
    23	    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    24	    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    25	    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    26	  )
    27	
    28	  foreach ($path in $paths) {
    29	    Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    30	      [ordered]@{
    31	        name = $_.DisplayName
    32	        version = $_.DisplayVersion
    33	        publisher = $_.Publisher
    34	      }
    35	    }
    36	  }
    37	}
    38	
    39	function Test-NpkiLocation {
    40	  $candidates = @(
    41	    "$env:USERPROFILE\AppData\LocalLow\NPKI",
    42	    "$env:USERPROFILE\AppData\Roaming\NPKI",
    43	    "$env:SystemDrive\NPKI"
    44	  )
    45	
    46	  foreach ($path in $candidates) {
    47	    [ordered]@{
    48	      path = $path
    49	      exists = Test-Path $path
    50	    }
    51	  }
    52	}
    53	
    54	function Get-FolderSizeGb {
    55	  param([string]$Path)
    56	
    57	  if (!(Test-Path $Path)) { return $null }
    58	
    59	  try {
    60	    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
    61	      Measure-Object -Property Length -Sum
    62	
    63	    if ($null -eq $sum.Sum) { return 0 }
    64	    return [Math]::Round($sum.Sum / 1GB, 2)
    65	  } catch {
    66	    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    67	    return $null
    68	  }
    69	}
    70	
    71	function Get-UserFolders {
    72	  $folders = @(
    73	    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    74	    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    75	    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    76	    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    77	    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    78	    @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
    79	  )
    80	
    81	  foreach ($folder in $folders) {
    82	    $exists = Test-Path $folder.path
    83	    [ordered]@{
    84	      name = $folder.name
    85	      path = $folder.path
    86	      exists = $exists
    87	      sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
    88	    }
    89	  }
    90	}
    91	
    92	function Get-CloudSyncCandidates {
    93	  $candidates = @(
    94	    @{ provider = "OneDrive"; path = $env:OneDrive },
    95	    @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
    96	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
    97	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
    98	    @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
    99	  ) | Where-Object { $_.path }
   100	
   101	  foreach ($candidate in $candidates) {
   102	    [ordered]@{
   103	      provider = $candidate.provider
   104	      path = $candidate.path
   105	      exists = Test-Path $candidate.path
   106	    }
   107	  }
   108	}
   109	
   110	function Get-BrowserPresence {
   111	  $browsers = @(
   112	    @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
   113	    @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
   114	    @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
   115	    @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   116	  )
   117	
   118	  foreach ($browser in $browsers) {
   119	    [ordered]@{
   120	      name = $browser.name
   121	      installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
   122	    }
   123	  }
   124	}
   125	
   126	function Get-WingetStatus {
   127	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   128	  [ordered]@{
   129	    available = [bool]$winget
   130	    note = if ($winget) { "winget is available. App export can be added in Phase 2." } else { "winget is not available on this PC." }
   131	  }
   132	}
   133	
   134	$computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
   135	$os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   136	$bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
   137	$cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
   138	$gpu = Get-SafeCimInstance Win32_VideoController
   139	$disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
   140	$printers = Get-SafeCimInstance Win32_Printer
   141	$drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   142	$wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
   143	$bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
   144	
   145	$report = [ordered]@{
   146	  schemaVersion = "0.1.0"
   147	  generatedAt = (Get-Date).ToString("o")
   148	  privacy = [ordered]@{
   149	    localOnly = $true
   150	    noPasswordCollection = $true
   151	    noPrivateKeyUpload = $true
   152	    noBrowserPasswordExtraction = $true
   153	  }
   154	  system = [ordered]@{
   155	    manufacturer = $computer.Manufacturer
   156	    model = $computer.Model
   157	    serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
   158	    osCaption = $os.Caption
   159	    osVersion = $os.Version
   160	    cpu = $cpu.Name
   161	    memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
   162	  }
   163	  disks = @($disk | ForEach-Object {
   164	    [ordered]@{
   165	      drive = $_.DeviceID
   166	      sizeGb = [Math]::Round($_.Size / 1GB, 2)
   167	      freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
   168	    }
   169	  })
   170	  userFolders = @(Get-UserFolders)
   171	  gpu = @($gpu | ForEach-Object { $_.Name })
   172	  installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
   173	  drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
   174	  printers = @($printers | Select-Object Name, DriverName, PortName, Default)
   175	  wifiProfiles = @($wifiProfiles)
   176	  npkiCandidates = @(Test-NpkiLocation)
   177	  bitlocker = @($bitlocker)
   178	  cloudSync = @(Get-CloudSyncCandidates)
   179	  browsers = @(Get-BrowserPresence)
   180	  winget = Get-WingetStatus
   181	  diagnostics = @($diagnostics)
   182	  checklist = [ordered]@{
   183	    reviewNpkiManually = $true
   184	    exportWifiProfilesManually = $true
   185	    backupDesktopDocumentsDownloads = $true
   186	    verifyCloudSync = $true
   187	    saveReportBeforeFormat = $true
   188	  }
   189	}
   190	
   191	$parent = Split-Path -Parent $OutputPath
   192	if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
   193	$report | ConvertTo-Json -Depth 8 | Out-File -FilePath $OutputPath -Encoding utf8
   194	Write-Host "FormatBuddy report saved: $OutputPath"

exec
/bin/zsh -lc "find tests src -path '*test*' -type f -maxdepth 5 -print -exec sh -c 'echo --- "'$1; nl -ba "$1" | sed -n "1,240p"'"' _ {} \\;" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
tests/ipc.test.ts
--- tests/ipc.test.ts
     1	import { describe, it, expect } from "vitest";
     2	import { IpcChannels } from "../src/shared/ipc";
     3	
     4	describe("IpcChannels", () => {
     5	  it("contains all expected channels", () => {
     6	    expect(IpcChannels.scanStart).toBe("scan:start");
     7	    expect(IpcChannels.scanCancel).toBe("scan:cancel");
     8	    expect(IpcChannels.scanProgress).toBe("scan:progress");
     9	    expect(IpcChannels.scanComplete).toBe("scan:complete");
    10	    expect(IpcChannels.scanError).toBe("scan:error");
    11	    expect(IpcChannels.reportExport).toBe("report:export");
    12	    expect(IpcChannels.reportOpenWeb).toBe("report:open-web");
    13	    expect(IpcChannels.appVersion).toBe("app:version");
    14	  });
    15	
    16	  it("channel values are unique", () => {
    17	    const values = Object.values(IpcChannels);
    18	    expect(new Set(values).size).toBe(values.length);
    19	  });
    20	});
tests/scanner.test.ts
--- tests/scanner.test.ts
     1	import { describe, it, expect } from "vitest";
     2	import { mkdtempSync, readFileSync, rmSync } from "node:fs";
     3	import { tmpdir } from "node:os";
     4	import { join } from "node:path";
     5	import { runScan, __testing } from "../src/main/scanner";
     6	import type { ScanProgress, ScanReport } from "../src/shared/types";
     7	
     8	describe("scanner mock pipeline", () => {
     9	  it("buildSteps marks states correctly", () => {
    10	    const steps = __testing.buildSteps(2);
    11	    expect(steps.length).toBe(__testing.TOTAL_STEPS);
    12	    expect(steps[0].state).toBe("done");
    13	    expect(steps[1].state).toBe("done");
    14	    expect(steps[2].state).toBe("active");
    15	    expect(steps[3].state).toBe("pending");
    16	  });
    17	
    18	  it("progressFor computes score and elapsed", () => {
    19	    const started = Date.now() - 1234;
    20	    const p = __testing.progressFor(3, started);
    21	    expect(p.totalSteps).toBe(__testing.TOTAL_STEPS);
    22	    expect(p.doneSteps).toBe(3);
    23	    expect(p.score).toBeGreaterThanOrEqual(50);
    24	    expect(p.elapsedMs).toBeGreaterThanOrEqual(1000);
    25	  });
    26	
    27	  it("runScan(mock) emits progress, completes, writes JSON", async () => {
    28	    const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
    29	    const events: ScanProgress[] = [];
    30	    try {
    31	      const res = await runScan({
    32	        scriptPath: "ignored.ps1",
    33	        outputDir: dir,
    34	        mock: true,
    35	        onProgress: (p) => events.push(p)
    36	      });
    37	      expect(events.length).toBeGreaterThanOrEqual(__testing.TOTAL_STEPS);
    38	      expect(res.report.schemaVersion).toBe("0.1.0");
    39	      expect(res.report.privacy.localOnly).toBe(true);
    40	      const fileText = readFileSync(res.jsonPath, "utf8");
    41	      const parsed = JSON.parse(fileText) as ScanReport;
    42	      expect(parsed.system.osCaption).toContain("Windows");
    43	    } finally {
    44	      rmSync(dir, { recursive: true, force: true });
    45	    }
    46	  });
    47	
    48	  it("runScan(mock) cancels on abort", async () => {
    49	    const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
    50	    const controller = new AbortController();
    51	    try {
    52	      const p = runScan({
    53	        scriptPath: "ignored.ps1",
    54	        outputDir: dir,
    55	        mock: true,
    56	        signal: controller.signal
    57	      });
    58	      setTimeout(() => controller.abort(), 50);
    59	      await expect(p).rejects.toThrowError(/cancel/i);
    60	    } finally {
    61	      rmSync(dir, { recursive: true, force: true });
    62	    }
    63	  });
    64	});

exec
/bin/zsh -lc "ls -la && test -f package-lock.json && head -80 package-lock.json || true && find src -type f -maxdepth 5 -not -path '*/node_modules/*' | sort" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
total 872
drwxr-xr-x@  23 ryanbak  staff     736 May 18 01:38 .
drwxr-xr-x    8 ryanbak  staff     256 May 18 01:58 ..
drwxr-xr-x@  12 ryanbak  staff     384 May 18 01:39 .git
-rw-r--r--@   1 ryanbak  staff      85 May 18 01:25 .gitignore
-rw-r--r--@   1 ryanbak  staff      76 May 18 01:25 .npmrc
drwxr-xr-x@   3 ryanbak  staff      96 May 18 01:41 .omc
-rw-r--r--@   1 ryanbak  staff    1677 May 18 01:26 README.md
drwxr-xr-x@   7 ryanbak  staff     224 May 18 01:38 dist
-rw-r--r--@   1 ryanbak  staff    1152 May 18 01:38 electron-builder.yml
-rw-r--r--@   1 ryanbak  staff    1208 May 18 01:35 electron.vite.config.ts
-rw-r--r--@   1 ryanbak  staff    1095 May 18 01:26 eslint.config.mjs
drwxr-xr-x@   9 ryanbak  staff     288 May 18 01:58 logs
drwxr-xr-x@ 551 ryanbak  staff   17632 May 18 01:34 node_modules
drwxr-xr-x@   5 ryanbak  staff     160 May 18 01:35 out
-rw-r--r--@   1 ryanbak  staff  397718 May 18 01:33 package-lock.json
-rw-r--r--@   1 ryanbak  staff    1621 May 18 01:36 package.json
drwxr-xr-x@   5 ryanbak  staff     160 May 18 01:25 resources
drwxr-xr-x@   6 ryanbak  staff     192 May 18 01:25 src
drwxr-xr-x@   4 ryanbak  staff     128 May 18 01:31 tests
-rw-r--r--@   1 ryanbak  staff     119 May 18 01:25 tsconfig.json
-rw-r--r--@   1 ryanbak  staff     695 May 18 01:34 tsconfig.node.json
-rw-r--r--@   1 ryanbak  staff     725 May 18 01:25 tsconfig.web.json
-rw-r--r--@   1 ryanbak  staff     385 May 18 01:26 vitest.config.ts
{
  "name": "formatbuddy-desktop",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "formatbuddy-desktop",
      "version": "0.1.0",
      "license": "UNLICENSED",
      "dependencies": {
        "@electron-toolkit/preload": "3.0.1",
        "@electron-toolkit/utils": "3.0.0"
      },
      "devDependencies": {
        "@tailwindcss/vite": "4.0.6",
        "@testing-library/react": "16.1.0",
        "@types/node": "22.10.5",
        "@types/react": "19.0.7",
        "@types/react-dom": "19.0.3",
        "@typescript-eslint/eslint-plugin": "8.20.0",
        "@typescript-eslint/parser": "8.20.0",
        "@vitejs/plugin-react": "4.3.4",
        "electron": "33.3.1",
        "electron-builder": "25.1.8",
        "electron-vite": "2.3.0",
        "eslint": "9.18.0",
        "eslint-plugin-react": "7.37.4",
        "eslint-plugin-react-hooks": "5.1.0",
        "jsdom": "26.0.0",
        "react": "19.0.0",
        "react-dom": "19.0.0",
        "tailwindcss": "4.0.6",
        "typescript": "5.7.3",
        "vite": "5.4.11",
        "vitest": "2.1.8"
      }
    },
    "node_modules/@asamuzakjp/css-color": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/@asamuzakjp/css-color/-/css-color-3.2.0.tgz",
      "integrity": "sha512-K1A6z8tS3XsmCMM86xoWdn7Fkdn9m6RSVtocUrJYIwZnFVkng/PvkEoWtOWmP+Scc6saYWHWZYbndEEXxl24jw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@csstools/css-calc": "^2.1.3",
        "@csstools/css-color-parser": "^3.0.9",
        "@csstools/css-parser-algorithms": "^3.0.4",
        "@csstools/css-tokenizer": "^3.0.3",
        "lru-cache": "^10.4.3"
      }
    },
    "node_modules/@asamuzakjp/css-color/node_modules/lru-cache": {
      "version": "10.4.3",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-10.4.3.tgz",
      "integrity": "sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/@babel/code-frame": {
      "version": "7.29.0",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.0.tgz",
      "integrity": "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.28.5",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.29.3",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.3.tgz",
      "integrity": "sha512-LIVqM46zQWZhj17qA8wb4nW/ixr2y1Nw+r1etiAWgRM6U1IqP+LNhL1yg440jYZR72jCWcWbLWzIosH+uP1fqg==",
      "dev": true,
      "license": "MIT",
src/main/index.ts
src/main/paths.ts
src/main/scanner.ts
src/preload/index.d.ts
src/preload/index.ts
src/renderer/index.html
src/renderer/src/App.tsx
src/renderer/src/components/Button.tsx
src/renderer/src/components/CloudBuddy.tsx
src/renderer/src/components/Lockup.tsx
src/renderer/src/components/ScanCard.tsx
src/renderer/src/components/ScoreRing.tsx
src/renderer/src/main.tsx
src/renderer/src/pages/Home.tsx
src/renderer/src/pages/Report.tsx
src/renderer/src/pages/Scanning.tsx
src/renderer/src/styles/fonts/PretendardVariable.ttf
src/renderer/src/styles/fonts/WantedSansVariable.ttf
src/renderer/src/styles/globals.css
src/shared/copy.ts
src/shared/ipc.ts
src/shared/types.ts

exec
/bin/zsh -lc "for f in src/renderer/src/components/Button.tsx src/renderer/src/main.tsx vitest.config.ts eslint.config.mjs README.md .npmrc .gitignore; do echo '---' "'$f; nl -ba $f; done' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
--- src/renderer/src/components/Button.tsx
     1	import type { ButtonHTMLAttributes, ReactNode } from "react";
     2	
     3	type Variant = "primary" | "secondary" | "ghost" | "on-blue";
     4	type Size = "lg" | "md" | "sm";
     5	
     6	export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     7	  variant?: Variant;
     8	  size?: Size;
     9	  iconRight?: ReactNode;
    10	  iconLeft?: ReactNode;
    11	  full?: boolean;
    12	}
    13	
    14	export function Button({
    15	  variant = "primary",
    16	  size = "md",
    17	  iconRight,
    18	  iconLeft,
    19	  className,
    20	  children,
    21	  full,
    22	  ...rest
    23	}: ButtonProps) {
    24	  const cls = ["fb-btn", `fb-btn-${variant}`, `fb-btn-${size}`, full ? "fb-btn-full" : "", className]
    25	    .filter(Boolean)
    26	    .join(" ");
    27	  return (
    28	    <button {...rest} className={cls}>
    29	      {iconLeft}
    30	      <span>{children}</span>
    31	      {iconRight}
    32	    </button>
    33	  );
    34	}
    35	
    36	export function ArrowRight({ size = 16 }: { size?: number }) {
    37	  return (
    38	    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    39	      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    40	    </svg>
    41	  );
    42	}
--- src/renderer/src/main.tsx
     1	import { StrictMode } from "react";
     2	import { createRoot } from "react-dom/client";
     3	import { App } from "./App";
     4	import "./styles/globals.css";
     5	
     6	const rootEl = document.getElementById("root");
     7	if (!rootEl) throw new Error("Root element not found");
     8	
     9	createRoot(rootEl).render(
    10	  <StrictMode>
    11	    <App />
    12	  </StrictMode>
    13	);
--- vitest.config.ts
     1	import { defineConfig } from "vitest/config";
     2	import { resolve } from "node:path";
     3	
     4	export default defineConfig({
     5	  test: {
     6	    environment: "node",
     7	    include: ["tests/**/*.test.ts"],
     8	    globals: false,
     9	    coverage: { reporter: ["text"] }
    10	  },
    11	  resolve: {
    12	    alias: {
    13	      "@shared": resolve(__dirname, "src/shared"),
    14	      "@main": resolve(__dirname, "src/main")
    15	    }
    16	  }
    17	});
--- eslint.config.mjs
     1	import tseslint from "@typescript-eslint/eslint-plugin";
     2	import tsParser from "@typescript-eslint/parser";
     3	import reactPlugin from "eslint-plugin-react";
     4	import reactHooks from "eslint-plugin-react-hooks";
     5	
     6	export default [
     7	  {
     8	    files: ["src/**/*.{ts,tsx}", "tests/**/*.ts"],
     9	    languageOptions: {
    10	      parser: tsParser,
    11	      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } }
    12	    },
    13	    plugins: {
    14	      "@typescript-eslint": tseslint,
    15	      react: reactPlugin,
    16	      "react-hooks": reactHooks
    17	    },
    18	    settings: { react: { version: "19" } },
    19	    rules: {
    20	      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    21	      "@typescript-eslint/consistent-type-imports": "error",
    22	      "react/jsx-uses-react": "off",
    23	      "react/react-in-jsx-scope": "off",
    24	      "react-hooks/rules-of-hooks": "error",
    25	      "react-hooks/exhaustive-deps": "warn",
    26	      "no-console": ["warn", { allow: ["info", "warn", "error"] }]
    27	    }
    28	  },
    29	  {
    30	    ignores: ["out/**", "dist/**", "node_modules/**", "**/*.d.ts"]
    31	  }
    32	];
--- README.md
     1	# FormatBuddy Desktop
     2	
     3	Windows-only PC 포맷 동행 데스크탑 앱. Electron + React + TypeScript.
     4	
     5	기존 `local-agent/Invoke-FormatBuddyScan.ps1` PowerShell 진단을 GUI로 감싸고, `design_handoff_format_buddy/`의 디자인을 그대로 적용했습니다.
     6	
     7	## Quick start
     8	
     9	```bash
    10	npm install
    11	npm run dev          # Electron 개발 창 (mock scan으로 동작 검증)
    12	npm run typecheck
    13	npm run lint
    14	npm run test
    15	npm run build
    16	npm run dist:win     # → dist/FormatBuddy-Setup-X.Y.Z-x64.exe
    17	```
    18	
    19	## 검증 한계
    20	
    21	| 항목 | macOS에서 가능 | Windows 실기 필요 |
    22	|------|---------------|-------------------|
    23	| 코드 컴파일 / lint / test | O | — |
    24	| Electron UI 렌더링 (mock scan) | O | — |
    25	| `.exe` 패키지 생성 (cross-build) | O | — |
    26	| 실제 PowerShell 진단 실행 | X | O |
    27	| UAC 권한 흐름 | X | O |
    28	| Windows 폰트 렌더링 정확도 | X | O |
    29	
    30	## Privacy
    31	
    32	- 100% 로컬 동작. 서버 업로드 없음.
    33	- 인증서 개인키, 비밀번호, 브라우저 저장 비밀번호 수집하지 않음.
    34	- 사용자가 export한 JSON만 웹 리포트 뷰어(`/report/import`)로 직접 이동.
    35	
    36	## Structure
    37	
    38	- `src/main/` — Electron 메인 프로세스, PowerShell 호출
    39	- `src/preload/` — contextBridge로 안전한 IPC 노출
    40	- `src/renderer/` — React UI (Home / Scanning / Report 3페이지)
    41	- `src/shared/` — 메인/렌더러 공유 타입 + IPC 채널 상수
    42	- `resources/powershell/` — `Invoke-FormatBuddyScan.ps1` (extraResources로 번들)
    43	- `resources/fonts/` — Wanted Sans Variable, Pretendard Variable
    44	- `resources/icons/` — 로고 SVG + 앱 아이콘
    45	- `tests/` — Vitest unit tests (scanner mock, IPC bridge)
--- .npmrc
     1	engine-strict=false
     2	electron_mirror=https://npmmirror.com/mirrors/electron/
--- .gitignore
     1	node_modules
     2	out
     3	dist
     4	.DS_Store
     5	*.log
     6	logs/*.log
     7	.env
     8	.env.local
     9	.vite-temp
    10	coverage

exec
/bin/zsh -lc "find dist/win-unpacked/resources -maxdepth 3 -type f -print | sort | sed -n '1,200p'; echo '--- asar list maybe'; npx asar list dist/win-unpacked/resources/app.asar | sed -n '1,160p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 566ms:
npm warn Unknown project config "electron_mirror". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
/node_modules
/node_modules/@electron-toolkit
/node_modules/@electron-toolkit/preload
/node_modules/@electron-toolkit/preload/LICENSE
/node_modules/@electron-toolkit/preload/dist
/node_modules/@electron-toolkit/preload/dist/index.cjs
/node_modules/@electron-toolkit/preload/dist/index.d.cts
/node_modules/@electron-toolkit/preload/dist/index.d.mts
/node_modules/@electron-toolkit/preload/dist/index.mjs
/node_modules/@electron-toolkit/preload/package.json
/node_modules/@electron-toolkit/utils
/node_modules/@electron-toolkit/utils/LICENSE
/node_modules/@electron-toolkit/utils/dist
/node_modules/@electron-toolkit/utils/dist/index.cjs
/node_modules/@electron-toolkit/utils/dist/index.d.cts
/node_modules/@electron-toolkit/utils/dist/index.d.mts
/node_modules/@electron-toolkit/utils/dist/index.mjs
/node_modules/@electron-toolkit/utils/package.json
/out
/out/main
/out/main/index.js
/out/preload
/out/preload/index.js
/out/renderer
/out/renderer/assets
/out/renderer/assets/PretendardVariable-Bh9nN6Cq.ttf
/out/renderer/assets/WantedSansVariable-BTZASzci.ttf
/out/renderer/assets/index-KATdQEKe.css
/out/renderer/assets/index-mWO0pZZv.js
/out/renderer/index.html
/package.json

exec
/bin/zsh -lc "grep -RIn \"\\bany\\b\\|as \\|unknown\\|shell.openExternal\\|openExternal\\|window.open\\|<webview\\|nodeIntegration\\|contextIsolation\\|sandbox\\|ExecutionPolicy\\|Bypass\\|JSON.parse\\|dangerouslySetInnerHTML\\|eval\\|innerHTML\\|스캔 완료\\|심각한 상태\\|초기화\\|리셋\\|자동 처리\\|필수입니다\\|스캔\\|완료\\|초기화\\|리셋\" src electron-builder.yml package.json resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
src/renderer/src/pages/Report.tsx:118:            <li>클라우드 동기화 완료 확인</li>
src/shared/copy.ts:4: * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
src/shared/copy.ts:43:} as const;
src/shared/ipc.ts:10:} as const;
src/main/index.ts:4:import { promises as fs } from "node:fs";
src/main/index.ts:25:      contextIsolation: true,
src/main/index.ts:26:      nodeIntegration: false,
src/main/index.ts:27:      sandbox: false
src/main/index.ts:36:    shell.openExternal(url);
src/main/index.ts:72:      const e = err as Error;
src/main/index.ts:75:        code: (e as NodeJS.ErrnoException).code ?? undefined,
src/main/index.ts:98:    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
src/main/index.ts:115:    await shell.openExternal(getWebReportImportUrl());
src/main/scanner.ts:2:import { existsSync, mkdirSync, promises as fs } from "node:fs";
src/main/scanner.ts:105:      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
src/main/scanner.ts:154:        const report = JSON.parse(raw) as ScanReport;
src/main/scanner.ts:158:        rejectScan(e as Error);
src/preload/index.ts:23:    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
src/preload/index.ts:28:    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
src/preload/index.ts:33:    const wrapped = (_e: unknown, err: ScanError) => cb(err);

exec
/bin/zsh -lc "nl -ba out/renderer/index.html; echo '--- css excerpt ---'; sed -n '1,60p' out/renderer/assets/index-KATdQEKe.css" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	<!doctype html>
     2	<html lang="ko">
     3	  <head>
     4	    <meta charset="UTF-8" />
     5	    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     6	    <meta http-equiv="Content-Security-Policy"
     7	      content="default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'" />
     8	    <title>FormatBuddy</title>
     9	    <script type="module" crossorigin src="./assets/index-mWO0pZZv.js"></script>
    10	    <link rel="stylesheet" crossorigin href="./assets/index-KATdQEKe.css">
    11	  </head>
    12	  <body>
    13	    <div id="root"></div>
    14	  </body>
    15	</html>
--- css excerpt ---
@font-face {
  font-family: "Wanted Sans";
  font-weight: 100 950;
  font-style: normal;
  src: url("./WantedSansVariable-BTZASzci.ttf") format("truetype-variations"),
       url("./WantedSansVariable-BTZASzci.ttf") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Pretendard";
  font-weight: 100 900;
  font-style: normal;
  src: url("./PretendardVariable-Bh9nN6Cq.ttf") format("truetype-variations"),
       url("./PretendardVariable-Bh9nN6Cq.ttf") format("truetype");
  font-display: swap;
}

:root {
  --color-fb-blue: #0066ff;
  --color-fb-blue-strong: #005eeb;
  --color-fb-blue-heavy: #0040b5;
  --color-fb-blue-tint: #eaf2fe;
  --color-fb-ink-1: #0e1116;
  --color-fb-ink-2: rgba(46, 47, 51, 0.88);
  --color-fb-ink-3: rgba(55, 56, 60, 0.61);
  --color-fb-ink-4: rgba(55, 56, 60, 0.28);
  --color-fb-bg: #ffffff;
  --color-fb-line: #e1e2e4;
  --color-fb-line-t: rgba(112, 115, 124, 0.22);
  --color-fb-positive: #00bf40;
  --color-fb-warn: #ff9200;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: "Wanted Sans", "Pretendard", system-ui, -apple-system, sans-serif;
  font-feature-settings: "ss01" on, "ss03" on;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  color: var(--color-fb-ink-1);
  background: #ffffff;
  -webkit-user-select: none;
  user-select: none;
}

button { font-family: inherit; }

/* ============================================================
   App shell
   ============================================================ */
.fb-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #ffffff;

exec
/bin/zsh -lc "sed -n '1,220p' /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy/logos.jsx; echo '--- design css root/motion'; sed -n '1,220p' /Users/ryanbak/claude/formatbuddy/design_handoff_format_buddy/styles.css" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
// ============================================================
// 포맷버디 — Cloud-Buddy logo system
// ----------------------------------------------------------------
// Brand mark: cloud body + face. One geometric form expresses
// both "backup/cloud" and "buddy/helper" in a single silhouette.
//
// Variants (only 2 official):
//   - primary    : blue mark on white         → default
//   - on-blue    : white mark on #0066FF      → for blue surfaces
//
// Background rule: PURE WHITE (#FFFFFF) or BRAND BLUE (#0066FF).
// Never on dark / cream / tinted surfaces.
//
// Animation flags:
//   - blink  : eyes blink ~every 4.5s
//   - pulse  : radar-like pulse rings emanate from the cloud
//   - animated : convenience = blink + pulse
//
// All marks render on a 240×240 viewBox.
// ============================================================

const FB_BLUE  = '#0066FF';
const FB_WHITE = '#FFFFFF';

function _palette(variant) {
  if (variant === 'on-blue') return { body: FB_WHITE, face: FB_BLUE,  eyepip: FB_WHITE };
  return { body: FB_BLUE, face: FB_WHITE, eyepip: FB_BLUE }; // primary (default)
}

function CloudBuddy({
  size = 200,
  variant = 'primary',
  expression = 'smile',
  blink = false,
  pulse = false,
  animated = false,
}) {
  const c = _palette(variant);
  const wantBlink = blink || animated;
  const wantPulse = pulse || animated;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      aria-label="포맷버디"
      className={wantBlink || wantPulse ? 'cb-animated' : ''}
      style={{ overflow: 'visible' }}
    >
      {/* Pulse rings — behind the cloud body so only the outer arc is visible */}
      {wantPulse && (
        <g>
          <g className="cb-pulse-wrap cb-pulse-1">
            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
          </g>
          <g className="cb-pulse-wrap cb-pulse-2">
            <circle cx="120" cy="140" r="60" fill="none" stroke={c.body} strokeWidth="3" />
          </g>
        </g>
      )}

      {/* Antenna */}
      <rect x="116" y="44" width="8" height="22" rx="4" fill={c.body} />

      {/* Antenna sparks — charging halo (animated only). Behind the dot. */}
      {wantPulse && (
        <g>
          <circle className="cb-spark cb-spark-1" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
          <circle className="cb-spark cb-spark-2" cx="120" cy="38" r="9" fill={c.body} opacity="0.45" />
        </g>
      )}

      <circle className="cb-antenna-dot" cx="120" cy="38" r="9" fill={c.body} />

      {/* Cloud body */}
      <g fill={c.body}>
        <ellipse cx="74"  cy="146" rx="42" ry="40" />
        <ellipse cx="120" cy="124" rx="50" ry="48" />
        <ellipse cx="166" cy="146" rx="40" ry="38" />
        <rect    x="56"   y="146"  width="128" height="42" rx="10" />
      </g>

      {/* Eyes — simple solid dots (no inner pupil). Cute mascot style. */}
      {expression !== 'wink' && (
        <g className="cb-eye cb-eye-l">
          <ellipse cx="104" cy="140" rx="5.5" ry="6.8" fill={c.face} />
        </g>
      )}
      <g className="cb-eye cb-eye-r">
        <ellipse cx="136" cy="140" rx="5.5" ry="6.8" fill={c.face} />
      </g>

      {/* Expression */}
      {expression === 'smile' && (
        <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6"
              strokeLinecap="round" fill="none" />
      )}
      {expression === 'calm' && (
        <rect x="113" y="164" width="14" height="4" rx="2" fill={c.face} />
      )}
      {/* Wink — left eye becomes a closed-eye curve */}
      {expression === 'wink' && (
        <>
          <path d="M98 141 Q104 135 110 141" stroke={c.face} strokeWidth="4.5"
                strokeLinecap="round" fill="none" />
          <path d="M106 162 Q120 174 134 162" stroke={c.face} strokeWidth="6"
                strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}

function Wordmark({ size = 28, color = '#0E1116', weight = 800 }) {
  return (
    <span style={{
      fontFamily: "'Wanted Sans','Pretendard',sans-serif",
      fontWeight: weight,
      fontSize: size,
      letterSpacing: '-0.045em',
      color,
      lineHeight: 1,
    }}>포맷버디</span>
  );
}

function WordmarkEN({ size = 11, color = FB_BLUE }) {
  return (
    <span style={{
      fontFamily: "'Wanted Sans','Pretendard',sans-serif",
      fontWeight: 700,
      fontSize: size,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color,
      lineHeight: 1,
    }}>Format Buddy</span>
  );
}

function Lockup({
  markSize = 44,
  kanjiSize = 22,
  variant = 'primary',
  en = true,
  color,
  animated = false,
}) {
  const wmColor = color || (variant === 'on-blue' ? FB_WHITE : '#0E1116');
  const enColor = variant === 'on-blue' ? 'rgba(255,255,255,0.72)' : FB_BLUE;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <CloudBuddy size={markSize} variant={variant} animated={animated} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Wordmark size={kanjiSize} color={wmColor} />
        {en && <WordmarkEN size={Math.round(kanjiSize * 0.42)} color={enColor} />}
      </div>
    </div>
  );
}

Object.assign(window, { CloudBuddy, Wordmark, WordmarkEN, Lockup });
--- design css root/motion
/* ============================================================
   포맷버디 — Design tokens & global styles
   Subset of Wanted Design System tokens + product-specific tokens.

   Background rule: pure white #FFFFFF or brand blue #0066FF only.
   No cream / no dark / no tinted gray surfaces.
   ============================================================ */

@font-face {
  font-family: 'Wanted Sans';
  font-weight: 100 950;
  font-style: normal;
  src: url('fonts/WantedSansVariable.ttf') format('truetype-variations');
  font-display: swap;
}
@font-face {
  font-family: 'Pretendard';
  font-weight: 100 900;
  font-style: normal;
  src: url('fonts/PretendardVariable.ttf') format('truetype-variations');
  font-display: swap;
}

:root {
  /* Brand — Wanted blue */
  --fb-blue:        #0066FF;
  --fb-blue-strong: #005EEB;
  --fb-blue-heavy:  #0040B5;
  --fb-blue-tint:   #EAF2FE; /* For pill chips, score panel, tag bg */

  /* Ink scale */
  --fb-ink-1: #0E1116;                     /* Headings */
  --fb-ink-2: rgba(46, 47, 51, 0.88);      /* Body */
  --fb-ink-3: rgba(55, 56, 60, 0.61);      /* Tertiary / captions */
  --fb-ink-4: rgba(55, 56, 60, 0.28);      /* Disabled */

  /* Surface — pure white only */
  --fb-bg:     #FFFFFF;
  --fb-line:   #E1E2E4;
  --fb-line-t: rgba(112,115,124,0.22);

  /* Status */
  --fb-positive: #00BF40;
  --fb-warn:     #FF9200;

  /* Shadow */
  --fb-shadow-emphasize: 0 1px 4px rgba(23,23,25,0.07), 0 4px 12px rgba(23,23,25,0.08);
  --fb-shadow-strong:    0 1px 6px rgba(23,23,25,0.06), 0 12px 32px rgba(23,23,25,0.10);

  /* Radius */
  --fb-r-8:  8px;
  --fb-r-10: 10px;
  --fb-r-12: 12px;
  --fb-r-16: 16px;
  --fb-r-20: 20px;
  --fb-r-24: 24px;
  --fb-r-pill: 9999px;
}

html, body {
  font-family: 'Wanted Sans', 'Pretendard', -apple-system, system-ui, sans-serif;
  font-feature-settings: "ss01" on, "ss03" on;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  margin: 0;
  color: var(--fb-ink-1);
  background: #EFF1F4; /* canvas surround, only visible outside artboards */
}
* { box-sizing: border-box; }

/* ============================================================
   Animation — Cloud-Buddy wink + scanning pulse + antenna charge
   ============================================================ */
.cb-eye {
  transform-box: fill-box;
  transform-origin: center;
}
/* Only the LEFT eye winks. Right eye stays open. */
.cb-animated .cb-eye-l {
  animation: cb-wink 4.6s ease-in-out infinite;
}
@keyframes cb-wink {
  0%, 92%, 100%   { transform: scaleY(1); }
  94%, 96%        { transform: scaleY(0.08); }
}

/* Body scanning pulse rings */
.cb-pulse-wrap {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: cb-pulse 2.4s ease-out infinite;
  pointer-events: none;
}
.cb-pulse-2 { animation-delay: -1.2s; }
@keyframes cb-pulse {
  0%   { transform: scale(0.55); opacity: 0.55; }
  80%  { opacity: 0.05; }
  100% { transform: scale(1.75); opacity: 0; }
}

/* Antenna — dot pulses, sparks ripple outward (Pikachu charging) */
.cb-animated .cb-antenna-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: cb-charge 1.4s ease-in-out infinite;
}
@keyframes cb-charge {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.18); }
}
.cb-spark {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: cb-spark 1.4s ease-out infinite;
  pointer-events: none;
}
.cb-spark-2 { animation-delay: -0.7s; }
@keyframes cb-spark {
  0%   { transform: scale(0.6); opacity: 0.55; }
  100% { transform: scale(2.2); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cb-animated .cb-eye-l,
  .cb-animated .cb-antenna-dot,
  .cb-pulse-wrap,
  .cb-spark { animation: none !important; }
  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
}

/* ============================================================
   Logo artboards (preview only)
   ============================================================ */
.logo-ab {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;
  background: var(--stage, #fff);
  position: relative;
  overflow: hidden;
}
.logo-ab .stage {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.logo-ab .strip {
  padding: 14px 20px;
  border-top: 1px solid var(--fb-line);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--fb-ink-3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
}
.logo-ab .strip .hex {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0;
  color: var(--fb-ink-3);
}

.size-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: end;
  justify-items: center;
  gap: 24px;
  padding: 24px;
  width: 100%;
}
.size-grid .item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.size-grid .item .lbl {
  font-size: 10px;
  font-weight: 600;
  color: var(--fb-ink-3);
  letter-spacing: 0.04em;
}

/* ============================================================
   Homepage
   ============================================================ */
.fb-page {
  width: 1440px;
  background: var(--fb-bg);
  font-family: 'Wanted Sans','Pretendard',sans-serif;
  color: var(--fb-ink-1);
  position: relative;
  overflow: hidden;
}

/* ── Header ────────────────────────────────── */
.fb-header {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 80px;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(12px) saturate(180%);
  border-bottom: 1px solid var(--fb-line);
  position: sticky;
  top: 0;
  z-index: 10;
}
.fb-header .left { display: flex; align-items: center; gap: 56px; }
.fb-header nav  { display: flex; gap: 32px; }
.fb-header nav a {

codex
The release has fixable security and lifecycle issues: packaged builds can load a remote renderer via an env var, overlapping scans race on the global abort controller, and cancellation can surface as an error. Several lower-severity packaging, CSP, PowerShell buffering, persistence, and design-fidelity issues should also be addressed before shipping.

Full review comments:

- [P1] HIGH: Ignore dev renderer URLs in packaged builds — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:40-41
  Severity: HIGH. If a packaged app is launched with `ELECTRON_RENDERER_URL` set, this branch loads arbitrary remote content while still exposing the preload bridge, so that page can call `startScan()` and read the local diagnostic report. Suggested fix: only honor this env var when `!app.isPackaged` and restrict it to the localhost dev origin.

- [P1] HIGH: Keep scan controllers scoped to their run — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:82-84
  Severity: HIGH. If two `scan:start` calls arrive back-to-back, the first handler's `finally` can run after the second assigns `activeAbort` and clear the newer controller, leaving the active scan uncancelable and allowing stale events to win. Suggested fix: capture a local controller and only clear `activeAbort` when it still matches that controller, ideally with a scan id on emitted events.

- [P2] MEDIUM: Do not show cancellation as a scan error — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/App.tsx:49-50
  Severity: MEDIUM. After the user clicks cancel, `cancelScan` returns Home but the still-running `scan:start` promise can emit an `AbortError`, and this listener unconditionally switches the UI to the error state. Suggested fix: suppress expected `AbortError` in main or track the current/cancelled scan id in the renderer before accepting `scan:error`.

- [P2] MEDIUM: Avoid persisting hidden diagnostic reports — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:54-55
  Severity: MEDIUM. Every scan writes the full report to `userData/scans` before Ryan chooses export, so local diagnostics persist outside the explicit save flow promised by the privacy copy. Suggested fix: write to a temp file and delete it after parsing, or implement explicit retention/cleanup.

- [P2] MEDIUM: Restrict external URL opening — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:35-37
  Severity: MEDIUM. Any renderer-created `window.open()` URL is handed to the OS, so a compromised renderer or future user-controlled link could open `file:`, custom protocols, or unexpected hosts. Suggested fix: parse the URL and allow only expected `https:` origins before calling `shell.openExternal`.

- [P2] MEDIUM: Enable the renderer sandbox — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:23-28
  Severity: MEDIUM. `sandbox: false` removes Chromium's renderer OS sandbox, so any renderer compromise has a larger post-exploitation surface even with `nodeIntegration` off. Suggested fix: set `sandbox: true` and keep the preload limited to `contextBridge`/`ipcRenderer`.

- [P2] MEDIUM: Verify unpacked PowerShell before execution — /Users/ryanbak/claude/formatbuddy/desktop/electron-builder.yml:15-17
  Severity: MEDIUM. The PowerShell script is copied as an unpacked resource and later run with `-ExecutionPolicy Bypass`, so a tampered per-user install resource can execute arbitrary script on the next scan. Suggested fix: verify a bundled hash/signature before spawning, or copy a verified embedded script to a temp path and avoid `Bypass` where possible.

- [P2] MEDIUM: Abort scans when the app quits — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:135-136
  Severity: MEDIUM. Closing the window quits the app without aborting an active scan, so on Windows the spawned PowerShell process can continue after the UI is gone. Suggested fix: abort `activeAbort` in `before-quit`/`window-all-closed` and ensure the child process is killed.

- [P2] MEDIUM: Validate parsed scan JSON before completing — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:153-155
  Severity: MEDIUM. `JSON.parse(raw) as ScanReport` accepts any valid JSON shape, so a partial/tampered script output can be sent as `scan:complete` and then crash the report UI when required arrays are missing. Suggested fix: validate the minimal `ScanReport` schema before resolving, and emit `scan:error` on invalid output.

- [P2] MEDIUM: Use the official Electron binary source — /Users/ryanbak/claude/formatbuddy/desktop/.npmrc:2-2
  Severity: MEDIUM. Release builds download Electron binaries from `npmmirror.com`, and those downloaded binaries are not protected by `package-lock.json` integrity. Suggested fix: remove this project-level mirror or use an official/controlled mirror with checksum verification.

- [P3] LOW: Bound stderr buffering from PowerShell — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:137-139
  Severity: LOW. `stderrBuf` grows without a cap, so a noisy PowerShell failure can consume memory even though the final error only reports the first 500 characters. Suggested fix: keep only the last fixed-size chunk, such as 64 KiB.

- [P3] LOW: Tighten the renderer CSP baseline — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/index.html:6-7
  Severity: LOW. The CSP omits explicit `object-src`, `base-uri`, `form-action`, `frame-src`, and `connect-src`, so defaults remain broader than this offline renderer needs. Suggested fix: add `object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'` for production.

- [P3] LOW: Remove non-brand error colors — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:301-304
  Severity: LOW. The handoff hard rule keeps product surfaces to white and the key blue, but this error banner introduces pink/red background, border, and text. Suggested fix: render the error state on white with approved blue/ink tokens or add a design-approved status token.

- [P3] LOW: Remove the colored live-dot shadow — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:342-346
  Severity: LOW. The handoff bans colored shadows, but the live indicator adds a green glow with `box-shadow`. Suggested fix: remove the glow or replace it with a neutral approved shadow token.

- [P3] NIT: Keep the Pretendard fallback in SVG labels — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/components/ScoreRing.tsx:55-58
  Severity: NIT. The typography rule requires Wanted Sans with Pretendard fallback, but the score ring SVG text only declares Wanted Sans. Suggested fix: use `fontFamily="'Wanted Sans','Pretendard',sans-serif"`.
The release has fixable security and lifecycle issues: packaged builds can load a remote renderer via an env var, overlapping scans race on the global abort controller, and cancellation can surface as an error. Several lower-severity packaging, CSP, PowerShell buffering, persistence, and design-fidelity issues should also be addressed before shipping.

Full review comments:

- [P1] HIGH: Ignore dev renderer URLs in packaged builds — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:40-41
  Severity: HIGH. If a packaged app is launched with `ELECTRON_RENDERER_URL` set, this branch loads arbitrary remote content while still exposing the preload bridge, so that page can call `startScan()` and read the local diagnostic report. Suggested fix: only honor this env var when `!app.isPackaged` and restrict it to the localhost dev origin.

- [P1] HIGH: Keep scan controllers scoped to their run — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:82-84
  Severity: HIGH. If two `scan:start` calls arrive back-to-back, the first handler's `finally` can run after the second assigns `activeAbort` and clear the newer controller, leaving the active scan uncancelable and allowing stale events to win. Suggested fix: capture a local controller and only clear `activeAbort` when it still matches that controller, ideally with a scan id on emitted events.

- [P2] MEDIUM: Do not show cancellation as a scan error — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/App.tsx:49-50
  Severity: MEDIUM. After the user clicks cancel, `cancelScan` returns Home but the still-running `scan:start` promise can emit an `AbortError`, and this listener unconditionally switches the UI to the error state. Suggested fix: suppress expected `AbortError` in main or track the current/cancelled scan id in the renderer before accepting `scan:error`.

- [P2] MEDIUM: Avoid persisting hidden diagnostic reports — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:54-55
  Severity: MEDIUM. Every scan writes the full report to `userData/scans` before Ryan chooses export, so local diagnostics persist outside the explicit save flow promised by the privacy copy. Suggested fix: write to a temp file and delete it after parsing, or implement explicit retention/cleanup.

- [P2] MEDIUM: Restrict external URL opening — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:35-37
  Severity: MEDIUM. Any renderer-created `window.open()` URL is handed to the OS, so a compromised renderer or future user-controlled link could open `file:`, custom protocols, or unexpected hosts. Suggested fix: parse the URL and allow only expected `https:` origins before calling `shell.openExternal`.

- [P2] MEDIUM: Enable the renderer sandbox — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:23-28
  Severity: MEDIUM. `sandbox: false` removes Chromium's renderer OS sandbox, so any renderer compromise has a larger post-exploitation surface even with `nodeIntegration` off. Suggested fix: set `sandbox: true` and keep the preload limited to `contextBridge`/`ipcRenderer`.

- [P2] MEDIUM: Verify unpacked PowerShell before execution — /Users/ryanbak/claude/formatbuddy/desktop/electron-builder.yml:15-17
  Severity: MEDIUM. The PowerShell script is copied as an unpacked resource and later run with `-ExecutionPolicy Bypass`, so a tampered per-user install resource can execute arbitrary script on the next scan. Suggested fix: verify a bundled hash/signature before spawning, or copy a verified embedded script to a temp path and avoid `Bypass` where possible.

- [P2] MEDIUM: Abort scans when the app quits — /Users/ryanbak/claude/formatbuddy/desktop/src/main/index.ts:135-136
  Severity: MEDIUM. Closing the window quits the app without aborting an active scan, so on Windows the spawned PowerShell process can continue after the UI is gone. Suggested fix: abort `activeAbort` in `before-quit`/`window-all-closed` and ensure the child process is killed.

- [P2] MEDIUM: Validate parsed scan JSON before completing — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:153-155
  Severity: MEDIUM. `JSON.parse(raw) as ScanReport` accepts any valid JSON shape, so a partial/tampered script output can be sent as `scan:complete` and then crash the report UI when required arrays are missing. Suggested fix: validate the minimal `ScanReport` schema before resolving, and emit `scan:error` on invalid output.

- [P2] MEDIUM: Use the official Electron binary source — /Users/ryanbak/claude/formatbuddy/desktop/.npmrc:2-2
  Severity: MEDIUM. Release builds download Electron binaries from `npmmirror.com`, and those downloaded binaries are not protected by `package-lock.json` integrity. Suggested fix: remove this project-level mirror or use an official/controlled mirror with checksum verification.

- [P3] LOW: Bound stderr buffering from PowerShell — /Users/ryanbak/claude/formatbuddy/desktop/src/main/scanner.ts:137-139
  Severity: LOW. `stderrBuf` grows without a cap, so a noisy PowerShell failure can consume memory even though the final error only reports the first 500 characters. Suggested fix: keep only the last fixed-size chunk, such as 64 KiB.

- [P3] LOW: Tighten the renderer CSP baseline — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/index.html:6-7
  Severity: LOW. The CSP omits explicit `object-src`, `base-uri`, `form-action`, `frame-src`, and `connect-src`, so defaults remain broader than this offline renderer needs. Suggested fix: add `object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'` for production.

- [P3] LOW: Remove non-brand error colors — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:301-304
  Severity: LOW. The handoff hard rule keeps product surfaces to white and the key blue, but this error banner introduces pink/red background, border, and text. Suggested fix: render the error state on white with approved blue/ink tokens or add a design-approved status token.

- [P3] LOW: Remove the colored live-dot shadow — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/styles/globals.css:342-346
  Severity: LOW. The handoff bans colored shadows, but the live indicator adds a green glow with `box-shadow`. Suggested fix: remove the glow or replace it with a neutral approved shadow token.

- [P3] NIT: Keep the Pretendard fallback in SVG labels — /Users/ryanbak/claude/formatbuddy/desktop/src/renderer/src/components/ScoreRing.tsx:55-58
  Severity: NIT. The typography rule requires Wanted Sans with Pretendard fallback, but the score ring SVG text only declares Wanted Sans. Suggested fix: use `fontFamily="'Wanted Sans','Pretendard',sans-serif"`.
