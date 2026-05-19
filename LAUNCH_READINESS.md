# Launch Readiness Checklist — FormatBuddy Desktop

> **Round D 진척 (2026-05-19)**: v1.3 → v2 ascent의 Week 1-6 분량을
> 18개 commit으로 처리했어요. 신뢰 인프라(코드 사인 제외) + 한국 PC
> 특화 기능 핵심 + 디자인 시스템 토큰까지 들어갔습니다. 자세한 항목별
> 진척은 본 체크리스트 각 섹션 옆에 ✅/⏳ 표시로 따로 추적되어 있지
> 않아요 — 다음 출시 readiness 패스에서 본 문서를 한 번 더 업데이트해야
> 해요. 최신 commit 사이클은
> `~/.hermes/handovers/2026-05-19-formatbuddy-v2-roundd.md`.

완성형 프로그램으로 다듬기 위한 전체 체크리스트. 분야별 + 우선순위(P0~P3) + 자율 가능 여부.

- **P0**: 출시 직전 필수 (사용자 노출 전에 반드시)
- **P1**: 출시 직후 (첫 주 안에)
- **P2**: 안정화 (사용자 피드백 받으며 1~2개월)
- **P3**: 성장 (사용자 늘어나면)

자율 컬럼은 코드 작업자(Claude)가 Ryan 동의 후 직접 처리 가능한지.

---

## A. 기능 완성도

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| A1 | Windows 10/11 실기 quick scan → Report 전체 흐름 | **P0** | ❌ | 미검증 |
| A2 | 백업 manifest 실 Windows 동작 (대용량 Downloads 포함) | **P0** | ❌ | 미검증 |
| A3 | UAC 권한 흐름 (BitLocker, Driver 정보) | **P0** | ❌ | 미검증 |
| A4 | 에러 시나리오 — winget 없음, PS 5.1만, 한글 폴더 경로 | P1 | 부분 | 한글 경로 가드 ✅ (D-1) / winget · PS 5.1 정적 테스트만 |
| A5 | 진단 도중 sleep/wake 처리 | P2 | ✅ | 미처리 |
| A6 | 멀티 모니터, 4K, 고DPI 렌더링 | P1 | ❌ | 미검증 |
| A7 | 다중 사용자 계정 (한 PC 여러 Windows 사용자) | P2 | ✅ | userData 별도화 OK |

## B. UX / 접근성

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| B1 | 첫 실행 onboarding (3-step 인트로) | P1 | ✅ | ✅ 기본 3-step 있음 (인터랙티브 강화는 C6/D-9+) |
| B2 | 도움말 / FAQ in-app | P1 | ✅ | docs/FAQ.md 갱신됨 (D-17). 앱 내 노출 미구현 |
| B3 | 키보드 단축키 + Tab navigation | P1 | ✅ | Ctrl+R / Esc ✅ (D-7 C8). Tab 순서 + "?" sheet 미구현 |
| B4 | a11y (aria-label, role, screen reader) | P2 | ✅ | 부분 |
| B5 | Windows에서 Wanted Sans 렌더링 정확도 | **P0** | ❌ | 미검증 |
| B6 | 진단 cancel 시 부분 결과 표시 | P2 | ✅ | 기본만 |
| B7 | 다크모드 (정책상 X — 의도적 결정 명시 유지) | — | — | 의도적 X |
| B8 | 윈도우 리사이즈에 대한 반응형 | P1 | ✅ | min size만 |

## C. 보안 / 프라이버시

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| C1 | Windows 코드 사이닝 결정 (EV / OV / MS Store / 무) | **P0** | ❌ | deferred |
| C2 | `electron-updater verifyUpdateCodeSignature` 활성화 (C1 후) | P1 | ✅ | 비활성 |
| C3 | npm audit / Dependabot / Snyk 정기 자동 검사 | P1 | ✅ | 없음 |
| C4 | SBOM (Software Bill of Materials) | P3 | ✅ | 없음 |
| C5 | Codex 정기 사이클 (작지 끝마다 1회) | P2 | ✅ | 5회 누적 |
| C6 | 개인정보처리방침 (한국어) | **P0** | 부분 (초안) | `docs/PRIVACY_POLICY.md` |
| C7 | 이용약관 (한국어, 약관규제법) | **P0** | 부분 (초안) | `docs/TERMS_OF_SERVICE.md` |

## D. 성능 / 품질

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| D1 | 앱 시작 시간 측정 + 최적화 (목표 <3초) | P1 | 부분 | 미측정 |
| D2 | 번들 크기 절감 (85MB → ~65MB 가능, locale 제거 등) | P2 | ✅ | 미최적화 |
| D3 | 메모리 누수 검사 (장시간 세션) | P1 | 부분 | 미검사 |
| D4 | 진단 시간 벤치마크 (다양한 PC 환경) | P1 | ❌ | 미측정 |
| D5 | 백업 manifest 시간 측정 (100GB+ Downloads) | P1 | ❌ | 미측정 |
| D6 | E2E 테스트 (Playwright for Electron) | P2 | ✅ | 없음 |
| D7 | 단위 테스트 커버리지 측정 + 목표 (현재 13개) | P2 | ✅ | 미측정 |

## E. 호환성 / 현지화

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| E1 | Windows 10 / 11 / Server 동작 매트릭스 | P1 | ❌ | 미검증 |
| E2 | PowerShell 5.1 vs 7 fallback | P2 | ✅ | 5.1 default |
| E3 | ARM64 Windows 빌드 | P3 | ✅ | x64만 |
| E4 | 영어/일본어 UI 카피 (i18n) | P3 | ✅ | 한국어만 |
| E5 | 영문 Windows에서 한글 메뉴 렌더링 | P1 | ❌ | 미검증 |
| E6 | macOS 포팅 (별도 진단 스크립트 + 빌드) | P3 | ✅ (큰 작업) | 미진행 |

## F. 배포 / CI-CD

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| F1 | GitHub Actions: PR/push마다 typecheck/lint/test | P1 | ✅ | `.github/workflows/ci.yml` |
| F2 | GitHub Actions: tag push → 자동 빌드 + Release | P1 | ✅ | 수동 |
| F3 | `@claude` GitHub Action (web에서 사용 중인 것 desktop에도) | P2 | ✅ | 없음 |
| F4 | Branch protection (main에 직접 push 금지, PR 강제) | P2 | ❌ (GH 설정) | 없음 |
| F5 | Auto-update 실 동작 검증 (v0.3.1 → v0.3.2) | **P0** | ❌ | 미검증 |
| F6 | Release 체크리스트 자동화 (changelog 생성) | P2 | ✅ | 수동 |
| F7 | Rollback 절차 문서화 | P2 | ✅ | 없음 |

## G. 문서 / 법무

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| G1 | 사용자 가이드 (한국어, 스크린샷 포함) | **P0** | 부분 (텍스트만) | `docs/USER_GUIDE.md` |
| G2 | FAQ (한국어, SmartScreen 안내 포함) | **P0** | ✅ | `docs/FAQ.md` |
| G3 | 트러블슈팅 가이드 | P1 | ✅ | 부분 (FAQ에 포함) |
| G4 | LICENSE 명확화 (현재 UNLICENSED) | **P0** | ❌ | UNLICENSED |
| G5 | 개인정보처리방침 (C6) | **P0** | 부분 | `docs/PRIVACY_POLICY.md` |
| G6 | 이용약관 (C7) | **P0** | 부분 | `docs/TERMS_OF_SERVICE.md` |
| G7 | CONTRIBUTING.md (오픈소스 시) | P3 | ✅ | 없음 |
| G8 | CHANGELOG.md (Keep a Changelog) | P2 | ✅ | Release notes만 |

## H. 마케팅 / 브랜딩

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| H1 | 랜딩 페이지 (web) | **P0** | ❌ (web 별도 세션) | 진행 중 |
| H2 | 앱 스크린샷 5장 (Windows 실기) | **P0** | ❌ | 없음 |
| H3 | 데모 영상 60초 | P2 | ❌ | 없음 |
| H4 | 보도자료 / 블로그 포스트 (한국어) | P2 | ✅ 초안 | 없음 |
| H5 | SEO (메타, sitemap, OG) | P1 | ✅ (web) | 미점검 |
| H6 | 한국 커뮤니티 출시 글 (클리앙/뽐뿌/디시) | P2 | ❌ | — |
| H7 | "포맷버디" 상표권 출원 (KIPO) | P3 | ❌ | 미출원 |

## I. 운영 / 모니터링

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| I1 | 피드백 채널 (GitHub Issues + email) | **P0** | ✅ | `.github/ISSUE_TEMPLATE/` |
| I2 | 크래시 리포팅 (Sentry, **opt-in 필수**) | P2 | ✅ | 없음 |
| I3 | 익명 사용 통계 (PostHog, opt-in) | P3 | ✅ | 없음 |
| I4 | 다운로드/설치 수 추적 (GitHub Releases API) | P2 | ✅ | 미연결 |
| I5 | 자동 업데이트 성공률 추적 | P2 | ✅ | 미수집 |
| I6 | CVE 모니터링 / 보안 패치 cadence | P2 | ✅ | 없음 |

## J. 비즈니스 (선택)

| # | 항목 | P | 자율 | 상태 |
|---|------|---|------|------|
| J1 | 수익 모델 (무료 / 프리미엄 / 광고 / 후원) | P1 | ❌ | 미정 |
| J2 | 결제 시스템 (이니시스/토스/Stripe) | P3 | ✅ | — |
| J3 | 라이선스 키 발급/검증 | P3 | ✅ | — |
| J4 | 사업자 등록 / 통신판매업 신고 | P3 | ❌ | — |

---

## 📊 진행 요약 (이번 사이클 기준)

- **이미 처리됨**: Codex 5사이클 22개 finding fix, PowerShell 무결성(TS-anchored + TOCTOU-safe), auto-update infra, backup manifest, winget export, 보안 baseline, 디자인 핸드오프 적용
- **이번 docs 사이클에서 추가됨**: FAQ.md, USER_GUIDE.md, PRIVACY_POLICY.md, TERMS_OF_SERVICE.md, CI workflow, Issue 템플릿
- **Ryan만 가능 (블로커)**: Windows 실기 검증 (A1-A3, B5, F5), 스크린샷 (H2), LICENSE 결정 (G4), 코드 사이닝 결정 (C1)
- **다음 자율 후보**: i18n (E4), bundle 최적화 (D2), Sentry opt-in (I2), `@claude` GH Action (F3)
