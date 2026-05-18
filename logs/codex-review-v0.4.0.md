OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e392c-b122-7eb1-a4a1-d38667471abc
--------
user
# Code review — FormatBuddy Desktop v0.4.0 new surface

v0.4.0 adds 8 new PowerShell health-signal functions, a TS recommendation engine that scores them, and a Report UI that surfaces the result. Skip surfaces you've already cleared in v0.1.0–v0.3.2 reviews.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (PUBLIC)
- Last commit: `1db4064`
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`

## What's NEW in v0.4.0

1. `resources/powershell/Invoke-FormatBuddyScan.ps1` — added: `Get-DiskHealth`, `Get-MemoryPressure`, `Get-WindowsUpdateStatus`, `Get-EventLogSummary`, `Get-DriverAgeSummary`, `Get-StartupPrograms`, `Get-DefenderStatus`, `Get-StorageWaste`. Quick-mode report schema bumped to `0.4.0-quick`.
2. `src/main/recommend.ts` (new) — pure TS recommendation engine. 8 per-signal score functions + weighted sum + severity buckets + tryFirst/afterFormat action builders.
3. `src/shared/types.ts` — new signal types + Recommendation/ActionItem/ReasonItem + ScanReport optional fields + ScanResult.recommendation.
4. `src/main/scanner.ts` — runScan/runMockScan/runPowershellScan all attach generateRecommendation(report) to the returned ScanResult; mock fixture extended with all new fields; isScanReport guard left tolerant of optional fields.
5. `src/renderer/src/pages/Report.tsx` — new score card + tryFirst card + formatReasons card + afterFormat card.
6. `src/shared/copy.ts` — score / severity / action labels.
7. `src/renderer/src/styles/globals.css` — score card styles + advice list / cmd chip / weight chip.
8. `tests/recommend.test.ts` — 6 cases (healthy / mixed signals / heavy bad / clamp / severity boundary / weight sum).

## Focus areas

### Recommendation engine
- Are the weights and thresholds **defensible**? Anything that would obviously over- or under-score a real Windows install?
- Is the scoring **idempotent and bounded** in edge cases (missing fields, negative numbers, NaN)?
- `pushReason` skips reasons whose `weighted < 5` — is that the right floor or should it be a percentage of the total?
- Anything that would make a user lose trust in the score (e.g. score swings wildly between near-identical scans)?

### PowerShell new functions
- `Get-EventLogSummary` uses `Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2; StartTime=...}` — failure modes? (no events / log full / permission)
- `Get-DefenderStatus` calls `Get-MpComputerStatus` which is unavailable on Windows Server / no-Defender systems. Caught?
- `Get-DriverAgeSummary` uses `[Management.ManagementDateTimeConverter]::ToDateTime` on `Win32_PnPSignedDriver.DriverDate`. Format on Korean Windows? Edge cases?
- `Get-StorageWaste`'s `Get-PathSizeGb` recurses into ReparsePoint dirs (we filter them in `Get-FilesSkippingReparsePoints` but not here). Risk?
- `Get-WindowsUpdateStatus` — does `Win32_QuickFixEngineering.InstalledOn` reliably return a parseable string across Windows 10/11/Server?

### UI / report
- Score card severity tinting uses `--color-fb-blue`/`--color-fb-positive`/`--color-fb-blue-heavy`/`--color-fb-ink-1` for the badge. Any handoff rule violation? (No colored shadows, no non-brand reds — confirm)
- Score card is always rendered, even when `recommendation` is somehow missing/null. Defensive null check needed?
- `severityClass` is exhaustive over the type — TS will catch new severities, but at runtime a stale field could fail. Acceptable?

### Anything else
- Tests rely entirely on synthetic fixtures; the recommendation engine has zero real-world tuning. Acceptable for an MVP or should we ship with a feature flag?

## Output format

Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). For each: `file:line — issue` + 1-line fix. **If zero new issues, say so explicitly so I can stop the cycle.**
2026-05-18T03:41:31.316895Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T03:41:31.599082Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse --show-toplevel && git rev-parse HEAD && git show --stat --oneline --decorate -1' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 8587ms:
2026-05-18 12:41:46.496 xcodebuild[92311:41548614]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:46.766 xcodebuild[92311:41548613] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-KIM9OqXa' (errno=Operation not permitted)
2026-05-18 12:41:47.401 xcodebuild[92315:41548644]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:47.560 xcodebuild[92315:41548643] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v0.4.0.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-VkrrXdxO' (errno=Operation not permitted)
2026-05-18 12:41:48.807 xcodebuild[92320:41548960]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:48.959 xcodebuild[92320:41548959] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-14u2dYeD' (errno=Operation not permitted)
2026-05-18 12:41:49.507 xcodebuild[92322:41548982]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:49.651 xcodebuild[92322:41548980] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
/Users/ryanbak/claude/formatbuddy/desktop
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-T98UUsvi' (errno=Operation not permitted)
2026-05-18 12:41:50.849 xcodebuild[92327:41549010]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:51.003 xcodebuild[92327:41549009] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-LJFGvx5n' (errno=Operation not permitted)
2026-05-18 12:41:51.543 xcodebuild[92329:41549019]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:51.697 xcodebuild[92329:41549018] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
1db406462ccc5397f34daffd8871dcda431b22dd
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-i77Jb0AB' (errno=Operation not permitted)
2026-05-18 12:41:52.895 xcodebuild[92333:41549045]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:53.041 xcodebuild[92333:41549044] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-c1myGAcr' (errno=Operation not permitted)
2026-05-18 12:41:53.575 xcodebuild[92335:41549054]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:53.727 xcodebuild[92335:41549053] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
1db4064 (HEAD -> main, origin/main) feat: PC health signals + format recommendation engine (v0.4.0)
 package.json                                    |   2 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 166 +++++++++++-
 src/main/recommend.ts                           | 330 ++++++++++++++++++++++++
 src/main/scanner.ts                             |  53 +++-
 src/renderer/src/pages/Report.tsx               |  87 ++++++-
 src/renderer/src/styles/globals.css             | 134 ++++++++++
 src/shared/copy.ts                              |  16 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  98 +++++++
 tests/recommend.test.ts                         | 199 ++++++++++++++
 tests/scanner.test.ts                           |   2 +-
 11 files changed, 1079 insertions(+), 10 deletions(-)

exec
/bin/zsh -lc 'git diff --stat HEAD''^ HEAD && git diff --unified=80 HEAD''^ HEAD -- src/main/recommend.ts src/main/scanner.ts src/shared/types.ts src/renderer/src/pages/Report.tsx src/shared/copy.ts tests/recommend.test.ts' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4057ms:
2026-05-18 12:42:00.930 xcodebuild[92360:41549370]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:01.078 xcodebuild[92360:41549369] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-l175EJyv' (errno=Operation not permitted)
2026-05-18 12:42:01.626 xcodebuild[92364:41549418]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:01.782 xcodebuild[92364:41549417] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 package.json                                    |   2 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 166 +++++++++++-
 src/main/recommend.ts                           | 330 ++++++++++++++++++++++++
 src/main/scanner.ts                             |  53 +++-
 src/renderer/src/pages/Report.tsx               |  87 ++++++-
 src/renderer/src/styles/globals.css             | 134 ++++++++++
 src/shared/copy.ts                              |  16 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  98 +++++++
 tests/recommend.test.ts                         | 199 ++++++++++++++
 tests/scanner.test.ts                           |   2 +-
 11 files changed, 1079 insertions(+), 10 deletions(-)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-V1Vs1hqQ' (errno=Operation not permitted)
2026-05-18 12:42:02.977 xcodebuild[92369:41549482]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:03.120 xcodebuild[92369:41549480] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-yOF1R8pO' (errno=Operation not permitted)
2026-05-18 12:42:03.659 xcodebuild[92389:41549575]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:03.805 xcodebuild[92389:41549573] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/src/main/recommend.ts b/src/main/recommend.ts
new file mode 100644
index 0000000..30800f5
--- /dev/null
+++ b/src/main/recommend.ts
@@ -0,0 +1,330 @@
+/**
+ * Recommendation engine — turns a raw ScanReport into a "format score" plus
+ * actionable advice. Pure function, no I/O, no electron imports → easy to test.
+ *
+ * Scoring philosophy (subject to change as we get Windows-field data):
+ *   - 100 = format strongly recommended
+ *   - 0   = healthy
+ *
+ * Weights are tuned conservatively: a single bad signal cannot push the score
+ * over the "format-required" threshold by itself; multiple bad signals must
+ * agree. This matches the friend-tone — we suggest "first try X" before
+ * suggesting "format".
+ */
+
+import type {
+  ActionItem,
+  Recommendation,
+  ReasonItem,
+  ScanReport,
+  FormatSeverity
+} from "@shared/types";
+
+const WEIGHTS = {
+  diskHealth: 0.30,
+  diskFree: 0.15,
+  memoryPressure: 0.10,
+  eventLog: 0.10,
+  windowsUpdate: 0.10,
+  driverAge: 0.10,
+  defender: 0.05,
+  storageWaste: 0.10
+} as const;
+
+function clamp01to100(v: number): number {
+  if (!isFinite(v)) return 0;
+  if (v < 0) return 0;
+  if (v > 100) return 100;
+  return v;
+}
+
+function diskHealthScore(report: ScanReport): number {
+  const health = report.diskHealth ?? [];
+  if (health.length === 0) return 0;
+  let worst = 0;
+  for (const d of health) {
+    const status = (d.healthStatus ?? "").toLowerCase();
+    const op = (d.operationalStatus ?? "").toLowerCase();
+    if (status.includes("unhealthy") || status.includes("failed")) worst = Math.max(worst, 100);
+    else if (status.includes("warning")) worst = Math.max(worst, 70);
+    else if (op && !op.includes("ok") && !op.includes("online")) worst = Math.max(worst, 60);
+  }
+  return worst;
+}
+
+function diskFreeScore(report: ScanReport): number {
+  if (!report.disks || report.disks.length === 0) return 0;
+  let worst = 0;
+  for (const d of report.disks) {
+    if (!d.sizeGb || d.sizeGb <= 0) continue;
+    const pct = (d.freeGb / d.sizeGb) * 100;
+    if (pct < 3) worst = Math.max(worst, 100);
+    else if (pct < 7) worst = Math.max(worst, 80);
+    else if (pct < 12) worst = Math.max(worst, 55);
+    else if (pct < 20) worst = Math.max(worst, 25);
+  }
+  return worst;
+}
+
+function memoryPressureScore(report: ScanReport): number {
+  const m = report.memoryPressure;
+  if (!m) return 0;
+  let s = 0;
+  if (typeof m.pageFileUsagePercent === "number") {
+    if (m.pageFileUsagePercent > 85) s = Math.max(s, 80);
+    else if (m.pageFileUsagePercent > 60) s = Math.max(s, 50);
+    else if (m.pageFileUsagePercent > 40) s = Math.max(s, 25);
+  }
+  if (typeof m.freeMemoryPercent === "number" && m.freeMemoryPercent !== null) {
+    if (m.freeMemoryPercent < 5) s = Math.max(s, 80);
+    else if (m.freeMemoryPercent < 12) s = Math.max(s, 50);
+  }
+  return s;
+}
+
+function eventLogScore(report: ScanReport): number {
+  const e = report.eventLog;
+  if (!e) return 0;
+  if (e.criticalCount >= 10) return 100;
+  if (e.criticalCount >= 5) return 70;
+  if (e.criticalCount >= 1) return 40;
+  if (e.errorCount >= 30) return 50;
+  if (e.errorCount >= 10) return 25;
+  return 0;
+}
+
+function windowsUpdateScore(report: ScanReport): number {
+  const w = report.windowsUpdate;
+  if (!w || w.daysSinceLatestHotfix == null) return 0;
+  if (w.daysSinceLatestHotfix > 120) return 80;
+  if (w.daysSinceLatestHotfix > 60) return 50;
+  if (w.daysSinceLatestHotfix > 35) return 30;
+  return 0;
+}
+
+function driverAgeScore(report: ScanReport): number {
+  const d = report.driverAge;
+  if (!d || d.totalWithDate === 0) return 0;
+  const p = d.olderThan2YearsPercent;
+  if (p > 80) return 70;
+  if (p > 60) return 50;
+  if (p > 40) return 25;
+  return 0;
+}
+
+function defenderScore(report: ScanReport): number {
+  const d = report.defender;
+  if (!d) return 0;
+  if (d.antivirusEnabled === false) return 80;
+  if (d.realTimeProtectionEnabled === false) return 60;
+  if (typeof d.antivirusSignatureAgeDays === "number" && d.antivirusSignatureAgeDays > 14) return 40;
+  return 0;
+}
+
+function storageWasteScore(report: ScanReport): number {
+  const s = report.storageWaste;
+  if (!s) return 0;
+  let v = 0;
+  if (s.windowsOldExists && s.windowsOldGb > 5) v = Math.max(v, 60);
+  const tempTotal = s.userTempGb + s.localAppDataTempGb + s.windowsTempGb;
+  if (tempTotal > 20) v = Math.max(v, 50);
+  else if (tempTotal > 10) v = Math.max(v, 25);
+  return v;
+}
+
+function getSeverity(score: number): FormatSeverity {
+  if (score <= 30) return "healthy";
+  if (score <= 60) return "watch";
+  if (score <= 85) return "format-recommended";
+  return "format-required";
+}
+
+function getHeadline(severity: FormatSeverity, score: number): string {
+  if (severity === "healthy") return `${score}점 — 지금은 새로 시작 안 해도 괜찮아요`;
+  if (severity === "watch") return `${score}점 — 먼저 가볍게 정리해볼까요`;
+  if (severity === "format-recommended") return `${score}점 — 새로 시작하면 더 편할 것 같아요`;
+  return `${score}점 — 새로 시작을 추천드려요`;
+}
+
+function getSummary(severity: FormatSeverity, reasons: ReasonItem[]): string {
+  if (severity === "healthy") {
+    return "PC가 전반적으로 잘 지내고 있어요. 정기 청소 정도면 충분해요.";
+  }
+  if (severity === "watch") {
+    return "조금 지쳐 보이는 부분이 있어요. 아래 '먼저 시도할 것'부터 차근차근 해보면 회복될 가능성이 높아요.";
+  }
+  if (severity === "format-recommended") {
+    const top = reasons[0]?.label ?? "여러 신호";
+    return `${top} 같은 문제가 모여 있어요. 위 항목들을 시도해도 회복이 안 되면 새로 시작이 더 빠를 수 있어요.`;
+  }
+  return "PC가 많이 지쳐 있어요. 무리해서 쓰기보다 백업 후 새로 시작하는 게 더 편할 거예요.";
+}
+
+function pushReason(
+  reasons: ReasonItem[],
+  signal: string,
+  label: string,
+  rawScore: number,
+  weight: number,
+  description: string
+) {
+  if (rawScore <= 0) return;
+  const weighted = rawScore * weight;
+  if (weighted < 5) return;
+  reasons.push({ signal, label, weightedScore: Math.round(weighted * 10) / 10, description });
+}
+
+function buildTryFirst(report: ScanReport, reasons: ReasonItem[]): ActionItem[] {
+  const actions: ActionItem[] = [];
+  const signals = new Set(reasons.map((r) => r.signal));
+
+  actions.push({
+    title: "Windows 디스크 정리",
+    description: "임시 파일, 휴지통, 캐시를 한 번에 비워요. 시스템 파일까지 함께.",
+    command: "cleanmgr /sageset:1"
+  });
+  actions.push({
+    title: "시스템 파일 검사",
+    description: "Windows 핵심 파일이 손상됐는지 확인하고 자동 복구해요.",
+    command: "sfc /scannow"
+  });
+  actions.push({
+    title: "Windows 이미지 복구",
+    description: "복구 대상 시스템 이미지를 Microsoft 서버에서 받아 채워줘요.",
+    command: "DISM /Online /Cleanup-Image /RestoreHealth"
+  });
+
+  if (signals.has("windows-update")) {
+    actions.push({
+      title: "Windows Update 실행",
+      description: "보안 패치가 한참 밀려 있어요. 업데이트만 받아도 많이 가벼워질 수 있어요.",
+      command: "start ms-settings:windowsupdate"
+    });
+  }
+  if (signals.has("disk-free")) {
+    actions.push({
+      title: "Storage Sense 켜기 + 큰 파일 정리",
+      description: "Downloads / Documents의 큰 파일부터 점검하면 여유 공간이 빨리 늘어요.",
+      command: "start ms-settings:storagesense"
+    });
+  }
+  if (signals.has("startup-bloat") || (report.startupPrograms && report.startupPrograms.count > 12)) {
+    actions.push({
+      title: "시작 프로그램 정리",
+      description: "PC를 켤 때 자동으로 뜨는 앱이 많아요. 필요 없는 것은 작업 관리자에서 꺼주세요.",
+      command: "taskmgr /0 /startup"
+    });
+  }
+  if (signals.has("defender")) {
+    actions.push({
+      title: "Windows Defender 보호 켜기",
+      description: "실시간 보호가 꺼져 있거나 시그니처가 오래됐어요. 보안 설정에서 한 번 확인해 주세요.",
+      command: "start windowsdefender:"
+    });
+  }
+
+  return actions;
+}
+
+function buildAfterFormat(report: ScanReport): ActionItem[] {
+  const actions: ActionItem[] = [];
+
+  if (report.winget?.available) {
+    actions.push({
+      title: "winget으로 앱 일괄 재설치",
+      description: "포맷 전 저장한 winget JSON으로 한 줄에 다시 깔 수 있어요.",
+      command: "winget import -i <winget-export.json>"
+    });
+  }
+  actions.push({
+    title: "백업 manifest 검증",
+    description: "포맷 전 만든 manifest의 SHA-256과 복원된 파일을 비교해 빠진 게 없는지 확인하세요."
+  });
+  if (report.npkiCandidates?.some((n) => n.exists)) {
+    actions.push({
+      title: "공동인증서(NPKI) 복원",
+      description: "NPKI 폴더를 통째로 새 PC의 같은 경로에 복사하면 바로 사용 가능해요."
+    });
+  }
+  if (report.cloudSync?.some((c) => c.exists)) {
+    actions.push({
+      title: "클라우드 동기화 재연결",
+      description: "OneDrive · Google Drive · Dropbox에 다시 로그인하고 동기화 폴더를 지정하세요."
+    });
+  }
+  actions.push({
+    title: "Windows Update + Defender 첫 스캔",
+    description: "새 시스템에서 가장 먼저 보안 업데이트와 풀 스캔을 한 번 돌려두세요."
+  });
+  return actions;
+}
+
+export function generateRecommendation(report: ScanReport): Recommendation {
+  const reasons: ReasonItem[] = [];
+
+  const dHealth = diskHealthScore(report);
+  const dFree = diskFreeScore(report);
+  const mem = memoryPressureScore(report);
+  const ev = eventLogScore(report);
+  const wu = windowsUpdateScore(report);
+  const da = driverAgeScore(report);
+  const def = defenderScore(report);
+  const sw = storageWasteScore(report);
+
+  pushReason(reasons, "disk-health", "디스크 건강", dHealth, WEIGHTS.diskHealth,
+    "디스크 자체가 보고하는 상태(S.M.A.R.T.)에 경고가 있어요. 하드웨어 문제일 수 있으니 데이터 백업이 가장 시급해요.");
+  pushReason(reasons, "disk-free", "저장 공간", dFree, WEIGHTS.diskFree,
+    "C 드라이브 여유 공간이 많이 부족해요. Windows 자체가 느려지는 가장 흔한 원인이에요.");
+  pushReason(reasons, "memory-pressure", "메모리 압박", mem, WEIGHTS.memoryPressure,
+    "메모리가 빠듯해서 디스크 페이지파일을 자주 쓰고 있어요. 평소 작업이 느릴 수 있어요.");
+  pushReason(reasons, "event-log", "시스템 이벤트", ev, WEIGHTS.eventLog,
+    "최근 7일간 시스템 critical/error 이벤트가 누적되어 있어요. 일관된 문제일 가능성.");
+  pushReason(reasons, "windows-update", "Windows 업데이트", wu, WEIGHTS.windowsUpdate,
+    "보안 패치가 오래 밀려 있어요. 업데이트만 받아도 안정성과 보안이 크게 좋아져요.");
+  pushReason(reasons, "driver-age", "드라이버 나이", da, WEIGHTS.driverAge,
+    "2년 이상 된 드라이버 비율이 높아요. 일부는 호환성 문제의 원인이 될 수 있어요.");
+  pushReason(reasons, "defender", "백신 상태", def, WEIGHTS.defender,
+    "Windows Defender 보호가 꺼져 있거나 시그니처가 오래됐어요.");
+  pushReason(reasons, "storage-waste", "잔여 시스템 찌꺼기", sw, WEIGHTS.storageWaste,
+    "windows.old 같은 큰 시스템 잔여물 또는 임시 파일이 누적되어 있어요. 청소로 회복 가능.");
+
+  reasons.sort((a, b) => b.weightedScore - a.weightedScore);
+
+  const totalWeighted =
+    dHealth * WEIGHTS.diskHealth +
+    dFree * WEIGHTS.diskFree +
+    mem * WEIGHTS.memoryPressure +
+    ev * WEIGHTS.eventLog +
+    wu * WEIGHTS.windowsUpdate +
+    da * WEIGHTS.driverAge +
+    def * WEIGHTS.defender +
+    sw * WEIGHTS.storageWaste;
+
+  const formatScore = Math.round(clamp01to100(totalWeighted));
+  const severity = getSeverity(formatScore);
+  const headline = getHeadline(severity, formatScore);
+  const summary = getSummary(severity, reasons);
+
+  return {
+    formatScore,
+    severity,
+    headline,
+    summary,
+    tryFirst: buildTryFirst(report, reasons),
+    formatReasons: reasons,
+    afterFormat: buildAfterFormat(report)
+  };
+}
+
+export const __testing = {
+  diskHealthScore,
+  diskFreeScore,
+  memoryPressureScore,
+  eventLogScore,
+  windowsUpdateScore,
+  driverAgeScore,
+  defenderScore,
+  storageWasteScore,
+  getSeverity,
+  WEIGHTS
+};
diff --git a/src/main/scanner.ts b/src/main/scanner.ts
index bfc1465..edc65d1 100644
--- a/src/main/scanner.ts
+++ b/src/main/scanner.ts
@@ -1,445 +1,490 @@
 import { spawn } from "node:child_process";
 import { existsSync, mkdirSync, promises as fs } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
 import { createHash, randomUUID } from "node:crypto";
 import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
 import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
+import { generateRecommendation } from "./recommend";
 
 const STDERR_MAX_BYTES = 64 * 1024;
 
 /**
  * Read the on-disk PowerShell script, hash it, compare against the bundled
  * expected digest, and (on match) copy the verified bytes into a private
  * temp file. The returned path is what the caller MUST spawn — that closes
  * the TOCTOU window between hash check and PowerShell open.
  *
  * Returns the staged path on success. Returns null when the on-disk script
  * cannot be read OR the hash does not match AND `enforce` is false (dev
  * workflow): the caller may then fall back to the original path or refuse
  * to run.
  */
 async function verifyAndStageScript(
   scriptPath: string,
   opts: { enforce: boolean; expectedHash?: string }
 ): Promise<string | null> {
   const expected = opts.expectedHash ?? EXPECTED_PS_SCRIPT_HASH;
 
   let buf: Buffer;
   try {
     buf = await fs.readFile(scriptPath);
   } catch (e) {
     if (opts.enforce) throw e;
     return null;
   }
 
   const actual = createHash("sha256").update(buf).digest("hex");
   if (actual !== expected) {
     if (opts.enforce) {
       throw new Error(
         `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
       );
     }
     console.warn(
       `[scanner] PowerShell hash mismatch in dev mode — using original path. expected=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…`
     );
     return null;
   }
 
   // Hash matches: stage verified bytes to a FRESH per-run private directory
   // so an attacker cannot pre-seed the staging path (predictable shared dir
   // would allow ACL/symlink games even with a random filename).
   //   - mkdtemp creates a brand-new directory with a random suffix
   //   - chmod 0700 restricts to the current user (POSIX; ignored on Windows
   //     where NTFS ACLs inherit from the parent — fail-open is acceptable
   //     because the prefix is per-run unpredictable)
   //   - writeFile with flag "wx" refuses to overwrite if the path somehow
   //     already exists (e.g. symlink) and mode 0600 on POSIX
   //   - on chmod/writeFile failure we MUST remove stagedDir before
   //     re-throwing, otherwise runScan's finally never learns the path
   //     and the per-run tempdir leaks
   const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
   try {
     try {
       await fs.chmod(stagedDir, 0o700);
     } catch {
       // non-POSIX (Windows) — directory inherits parent ACL; the per-run
       // random prefix is the main barrier
     }
     const stagedPath = join(stagedDir, "script.ps1");
     await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
     return stagedPath;
   } catch (e) {
     await fs.rm(stagedDir, { recursive: true, force: true }).catch(() => {
       // best-effort: at worst the OS reaps the dir
     });
     throw e;
   }
 }
 
 function isScanReport(value: unknown): value is ScanReport {
   if (!value || typeof value !== "object") return false;
   const r = value as Record<string, unknown>;
+  // v0.4.0+ adds optional health-signal fields; we keep the guard tolerant
+  // (presence-only on optional fields) so older mock fixtures stay valid.
   return (
     typeof r.schemaVersion === "string" &&
     typeof r.generatedAt === "string" &&
     Array.isArray(r.disks) &&
     Array.isArray(r.userFolders) &&
     Array.isArray(r.installedApps) &&
     Array.isArray(r.drivers) &&
     Array.isArray(r.printers) &&
     typeof r.system === "object" &&
     typeof r.privacy === "object" &&
     typeof r.checklist === "object"
   );
 }
 
 async function readAndDelete(path: string): Promise<string> {
   const raw = await fs.readFile(path, "utf8");
   await fs.unlink(path).catch(() => {
     // best-effort cleanup; ignore failures so a Windows lock doesn't crash the flow
   });
   return raw;
 }
 
 export interface RunScanOptions {
   scriptPath: string;
   outputDir: string;
   onProgress?: (progress: ScanProgress) => void;
   powershellExe?: string;
   signal?: AbortSignal;
   /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
   mock?: boolean;
   /** Require script.sha256 to exist and match. Set true for packaged production. */
   enforceIntegrity?: boolean;
 }
 
 export interface RunBackupManifestOptions {
   scriptPath: string;
   outputPath: string;
   signal?: AbortSignal;
   powershellExe?: string;
   enforceIntegrity?: boolean;
   manifestMaxFileSizeBytes?: number;
 }
 
 export interface RunBackupManifestResult {
   saved: boolean;
   path: string;
 }
 
 const PIPELINE_STEPS: readonly string[] = [
   "PC 정보 확인",
   "디스크 살펴보기",
   "사용자 폴더 챙기기",
   "설치 앱 / 드라이버 목록",
   "인증서·Wi-Fi·클라우드",
   "포맷 체크리스트 정리"
 ];
 
 const TOTAL_STEPS = PIPELINE_STEPS.length;
 
 function buildSteps(activeIndex: number): ScanStepView[] {
   return PIPELINE_STEPS.map((name, i) => {
     if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
     if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
     return { name, state: "pending", detail: "대기" };
   });
 }
 
 function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
   const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
   const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
   return {
     step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
     doneSteps: safeIndex,
     totalSteps: TOTAL_STEPS,
     score,
     elapsedMs: Date.now() - startedAt,
     steps: buildSteps(safeIndex),
     message
   };
 }
 
 export async function runScan(options: RunScanOptions): Promise<ScanResult> {
   const { onProgress, signal, mock, enforceIntegrity } = options;
   const startedAt = Date.now();
 
   let stagedPath: string | null = null;
   if (!mock) {
     stagedPath = await verifyAndStageScript(options.scriptPath, {
       enforce: !!enforceIntegrity
     });
   }
   const effectiveScriptPath = stagedPath ?? options.scriptPath;
 
   const tmpDir = join(tmpdir(), "formatbuddy-scans");
   ensureDir(tmpDir);
   const outPath = join(tmpDir, `report-${randomUUID()}.json`);
 
   onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
 
   try {
     if (mock || process.platform !== "win32") {
       return await runMockScan({ outPath, startedAt, onProgress, signal });
     }
     return await runPowershellScan({
       ...options,
       scriptPath: effectiveScriptPath,
       outPath,
       startedAt
     });
   } finally {
     if (stagedPath) {
       const stagedDir = dirname(stagedPath);
       await fs.unlink(stagedPath).catch(() => {
         // best-effort: the temp file is in a per-run mkdtemp directory and
         // will be reaped by the OS even if unlink fails
       });
       await fs.rmdir(stagedDir).catch(() => {
         // best-effort cleanup of the per-run directory
       });
     }
   }
 }
 
 function ensureDir(dir: string) {
   if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
 }
 
 interface InternalRunArgs {
   outPath: string;
   startedAt: number;
   onProgress?: (progress: ScanProgress) => void;
   signal?: AbortSignal;
 }
 
 async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
   const { outPath, startedAt, onProgress, signal } = args;
 
   for (let i = 1; i <= TOTAL_STEPS; i++) {
     if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
     await delay(380);
     onProgress?.(progressFor(i, startedAt));
   }
 
   const report: ScanReport = buildMockReport();
   ensureDir(dirname(outPath));
   await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
 
   // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
-  return { report, jsonPath: outPath };
+  return { report, recommendation: generateRecommendation(report), jsonPath: outPath };
 }
 
 interface PowershellRunArgs extends RunScanOptions {
   outPath: string;
   startedAt: number;
 }
 
 function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
   const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
 
   return new Promise<ScanResult>((resolveScan, rejectScan) => {
     const child = spawn(
       exe,
       ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
       { windowsHide: true }
     );
 
     let activeIndex = 0;
     let stderrBuf = "";
     const tick = setInterval(() => {
       if (activeIndex < TOTAL_STEPS) {
         activeIndex += 1;
         onProgress?.(progressFor(activeIndex, startedAt));
       }
     }, 700);
 
     const cleanup = () => {
       clearInterval(tick);
       signal?.removeEventListener("abort", onAbort);
     };
 
     const onAbort = () => {
       child.kill();
       cleanup();
       rejectScan(new DOMException("Scan cancelled", "AbortError"));
     };
 
     if (signal) {
       if (signal.aborted) {
         onAbort();
         return;
       }
       signal.addEventListener("abort", onAbort, { once: true });
     }
 
     child.stderr.on("data", (chunk: Buffer) => {
       stderrBuf += chunk.toString("utf8");
       if (stderrBuf.length > STDERR_MAX_BYTES) {
         stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
       }
     });
 
     child.on("error", (err) => {
       cleanup();
       rejectScan(err);
     });
 
     child.on("close", async (code) => {
       cleanup();
       if (code !== 0) {
         rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
         return;
       }
       try {
         const raw = await readAndDelete(outPath);
         const parsed: unknown = JSON.parse(raw);
         if (!isScanReport(parsed)) {
           rejectScan(new Error("Diagnostic JSON did not match expected ScanReport schema."));
           return;
         }
         const report = parsed;
         onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
-        resolveScan({ report, jsonPath: outPath });
+        resolveScan({ report, recommendation: generateRecommendation(report), jsonPath: outPath });
       } catch (e) {
         rejectScan(e as Error);
       }
     });
   });
 }
 
 function delay(ms: number) {
   return new Promise<void>((res) => setTimeout(res, ms));
 }
 
 function buildMockReport(): ScanReport {
   return {
-    schemaVersion: "0.1.0",
+    schemaVersion: "0.4.0-quick-mock",
     generatedAt: new Date().toISOString(),
+    mode: "quick",
     privacy: {
       localOnly: true,
       noPasswordCollection: true,
       noPrivateKeyUpload: true,
       noBrowserPasswordExtraction: true
     },
     system: {
       manufacturer: "Mock",
       model: "DevPreview",
       serialNumberMasked: "***0000",
       osCaption: "Windows 11 Pro (mock)",
       osVersion: "10.0.22631",
       cpu: "Mock CPU",
       memoryGb: 16
     },
     disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
+    diskHealth: [
+      {
+        friendlyName: "Mock NVMe",
+        mediaType: "SSD",
+        busType: "NVMe",
+        sizeGb: 476.62,
+        healthStatus: "Healthy",
+        operationalStatus: "OK"
+      }
+    ],
+    memoryPressure: {
+      totalMemoryMb: 16384,
+      freeMemoryMb: 6200,
+      freeMemoryPercent: 37.8,
+      pageFileTotalMb: 8192,
+      pageFileUsedMb: 1024,
+      pageFileUsagePercent: 12.5
+    },
+    windowsUpdate: {
+      installedHotfixCount: 24,
+      latestHotfixInstalledOn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
+      daysSinceLatestHotfix: 14
+    },
+    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 3 },
+    driverAge: { totalWithDate: 42, olderThan2Years: 8, olderThan2YearsPercent: 19.0 },
+    startupPrograms: { count: 6, items: [] },
+    defender: {
+      antivirusEnabled: true,
+      realTimeProtectionEnabled: true,
+      antivirusSignatureAgeDays: 1,
+      lastQuickScanDaysAgo: 2,
+      lastFullScanDaysAgo: 12
+    },
+    storageWaste: {
+      userTempGb: 0.8,
+      localAppDataTempGb: 1.2,
+      windowsTempGb: 0.3,
+      windowsOldExists: false,
+      windowsOldGb: 0
+    },
     userFolders: [
       { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
       { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
       { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
     ],
     gpu: ["Mock GPU"],
     installedApps: [
       { name: "Chrome", version: "131.0", publisher: "Google" },
       { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
     ],
     drivers: [],
     printers: [],
     wifiProfiles: ["home", "office"],
     npkiCandidates: [
       { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
       { path: "C:\\NPKI", exists: false }
     ],
     bitlocker: [],
     cloudSync: [
       { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
       { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
     ],
     browsers: [
       { name: "Chrome", installed: true },
       { name: "Edge", installed: true },
       { name: "Firefox", installed: false },
       { name: "Whale", installed: true }
     ],
-    winget: { available: true, note: "winget is available. App export can be added in Phase 2." },
+    winget: { available: true, note: "winget is available." },
+    wingetExport: null,
     diagnostics: [],
     checklist: {
       reviewNpkiManually: true,
       exportWifiProfilesManually: true,
       backupDesktopDocumentsDownloads: true,
       verifyCloudSync: true,
       saveReportBeforeFormat: true
     }
   };
 }
 
 export async function runBackupManifest(
   options: RunBackupManifestOptions
 ): Promise<RunBackupManifestResult> {
   if (process.platform !== "win32") {
     throw new Error("Backup manifest export is only available on Windows.");
   }
 
   const stagedPath = await verifyAndStageScript(options.scriptPath, {
     enforce: !!options.enforceIntegrity
   });
   if (!stagedPath) {
     throw new Error("PowerShell integrity check failed; refusing to spawn.");
   }
 
   const stagedDir = dirname(stagedPath);
   const exe =
     options.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   const maxFileSize = options.manifestMaxFileSizeBytes ?? 104_857_600;
 
   try {
     return await new Promise<RunBackupManifestResult>((resolveOk, rejectOk) => {
       const child = spawn(
         exe,
         [
           "-NoProfile",
           "-NonInteractive",
           "-ExecutionPolicy",
           "Bypass",
           "-File",
           stagedPath,
           "-OutputPath",
           options.outputPath,
           "-Mode",
           "manifest",
           "-ManifestMaxFileSizeBytes",
           String(maxFileSize)
         ],
         { windowsHide: true }
       );
 
       let stderrBuf = "";
 
       const cleanup = () => {
         if (options.signal) options.signal.removeEventListener("abort", onAbort);
       };
 
       const onAbort = () => {
         child.kill();
         cleanup();
         rejectOk(new DOMException("Manifest export cancelled", "AbortError"));
       };
 
       if (options.signal) {
         if (options.signal.aborted) {
           onAbort();
           return;
         }
         options.signal.addEventListener("abort", onAbort, { once: true });
       }
 
       child.stderr.on("data", (chunk: Buffer) => {
         stderrBuf += chunk.toString("utf8");
         if (stderrBuf.length > STDERR_MAX_BYTES) {
           stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
         }
       });
 
       child.on("error", (err) => {
         cleanup();
diff --git a/src/renderer/src/pages/Report.tsx b/src/renderer/src/pages/Report.tsx
index 9b79806..cc36e54 100644
--- a/src/renderer/src/pages/Report.tsx
+++ b/src/renderer/src/pages/Report.tsx
@@ -1,182 +1,267 @@
 import { useCallback, useMemo, useState } from "react";
 import { Button } from "../components/Button";
 import { Lockup } from "../components/Lockup";
 import { copy } from "@shared/copy";
 import type { ScanResult } from "@shared/types";
 
+function severityClass(s: ScanResult["recommendation"]["severity"]): string {
+  switch (s) {
+    case "healthy":
+      return "fb-score-healthy";
+    case "watch":
+      return "fb-score-watch";
+    case "format-recommended":
+      return "fb-score-recommend";
+    case "format-required":
+      return "fb-score-required";
+  }
+}
+
 interface ReportProps {
   result: ScanResult;
   onBack: () => void;
 }
 
 interface RowProps {
   label: string;
   value: React.ReactNode;
 }
 
 function Row({ label, value }: RowProps) {
   return (
     <div className="fb-report-row">
       <div className="fb-report-row-label">{label}</div>
       <div className="fb-report-row-value">{value}</div>
     </div>
   );
 }
 
 function formatGb(value?: number | null) {
   if (value == null) return "—";
   return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
 }
 
 export function Report({ result, onBack }: ReportProps) {
-  const { report } = result;
+  const { report, recommendation } = result;
   const [exportStatus, setExportStatus] = useState<string | null>(null);
   const [manifestStatus, setManifestStatus] = useState<string | null>(null);
   const [manifestRunning, setManifestRunning] = useState(false);
 
   const installedCount = report.installedApps.length;
   const driverCount = report.drivers.length;
   const wifiCount = report.wifiProfiles.length;
   const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
   const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
   const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
   const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
 
   const wingetPackageCount = useMemo(() => {
     if (!report.wingetExport?.Sources) return 0;
     return report.wingetExport.Sources.reduce(
       (sum, src) => sum + (src.Packages?.length ?? 0),
       0
     );
   }, [report.wingetExport]);
 
   const onExport = useCallback(async () => {
     if (!window.fb) return;
     setExportStatus(null);
     const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
     if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
     else setExportStatus("저장을 취소했어요.");
   }, [report]);
 
   const onOpenWeb = useCallback(async () => {
     if (!window.fb) return;
     await window.fb.openWebReport();
   }, []);
 
   const onExportManifest = useCallback(async () => {
     if (!window.fb) return;
     setManifestStatus(null);
     setManifestRunning(true);
     try {
       const res = await window.fb.exportBackupManifest();
       if (res.saved && res.path) {
         setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
       } else if (res.message) {
         setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
       } else {
         setManifestStatus(copy.manifestExportCancelled);
       }
     } catch (e) {
       const err = e as Error;
       setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
     } finally {
       setManifestRunning(false);
     }
   }, []);
 
   return (
     <main className="fb-report">
       <header className="fb-report-header">
         <Lockup markSize={36} kanjiSize={20} en={false} />
         <div className="fb-report-actions">
           <Button variant="ghost" size="sm" onClick={onBack}>
             {copy.reportBackCta}
           </Button>
         </div>
       </header>
 
       <section className="fb-report-hero">
         <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
         <p className="fb-lede">{copy.reportLede}</p>
       </section>
 
+      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
+        <div className="fb-score-card-head">
+          <div>
+            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
+            <div className="fb-score-card-value">
+              {recommendation.formatScore}
+              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
+            </div>
+            <div className="fb-score-card-headline">{recommendation.headline}</div>
+          </div>
+          <div className="fb-score-card-badge">
+            {copy.recommendSeverity[recommendation.severity]}
+          </div>
+        </div>
+        <p className="fb-score-card-summary">{recommendation.summary}</p>
+      </section>
+
+      <section className="fb-report-advice">
+        <article className="fb-card">
+          <h3>{copy.recommendTryFirstTitle}</h3>
+          <ul className="fb-advice-list">
+            {recommendation.tryFirst.map((a, i) => (
+              <li key={`tf-${i}`}>
+                <strong>{a.title}</strong>
+                <span>{a.description}</span>
+                {a.command && (
+                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
+                    {a.command}
+                  </code>
+                )}
+              </li>
+            ))}
+          </ul>
+        </article>
+
+        <article className="fb-card">
+          <h3>{copy.recommendFormatReasonsTitle}</h3>
+          {recommendation.formatReasons.length === 0 ? (
+            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
+          ) : (
+            <ul className="fb-advice-list">
+              {recommendation.formatReasons.map((r, i) => (
+                <li key={`fr-${i}`}>
+                  <strong>
+                    {r.label}{" "}
+                    <span className="fb-advice-weight">+{r.weightedScore.toFixed(1)}</span>
+                  </strong>
+                  <span>{r.description}</span>
+                </li>
+              ))}
+            </ul>
+          )}
+        </article>
+
+        <article className="fb-card">
+          <h3>{copy.recommendAfterFormatTitle}</h3>
+          <ul className="fb-advice-list">
+            {recommendation.afterFormat.map((a, i) => (
+              <li key={`af-${i}`}>
+                <strong>{a.title}</strong>
+                <span>{a.description}</span>
+                {a.command && (
+                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
+                    {a.command}
+                  </code>
+                )}
+              </li>
+            ))}
+          </ul>
+        </article>
+      </section>
+
       <section className="fb-report-grid">
         <article className="fb-card">
           <h3>이 PC</h3>
           <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
           <Row label="운영체제" value={report.system.osCaption ?? "—"} />
           <Row label="CPU" value={report.system.cpu ?? "—"} />
           <Row label="메모리" value={formatGb(report.system.memoryGb)} />
         </article>
 
         <article className="fb-card">
           <h3>저장 공간</h3>
           <Row label="총 용량" value={formatGb(totalDiskGb)} />
           <Row label="여유 공간" value={formatGb(totalFreeGb)} />
           {report.disks.map((d) => (
             <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
           ))}
         </article>
 
         <article className="fb-card">
           <h3>같이 챙길 것</h3>
           <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
           <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
           <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
           <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
         </article>
 
         <article className="fb-card">
           <h3>설치된 앱 / 드라이버</h3>
           <Row label="설치된 앱" value={`${installedCount}개`} />
           <Row label="드라이버" value={`${driverCount}개`} />
           <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
           <Row label="프린터" value={`${report.printers.length}개`} />
         </article>
 
         <article className="fb-card">
           <h3>사용자 폴더</h3>
           {report.userFolders.map((f) => (
             <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
           ))}
         </article>
 
         <article className="fb-card">
           <h3>{copy.wingetSectionTitle}</h3>
           {report.winget.available ? (
             <p className="fb-report-card-explain">
               {copy.wingetSummary(wingetPackageCount)}
             </p>
           ) : (
             <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
           )}
           <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
           <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
         </article>
 
         <article className="fb-card fb-card-checklist">
           <h3>포맷 전 체크리스트</h3>
           <ul className="fb-report-checklist">
             <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
             <li>Desktop·Documents·Downloads 백업</li>
             <li>클라우드 동기화 완료 확인</li>
             <li>리포트 JSON 저장 후 포맷</li>
           </ul>
         </article>
       </section>
 
       <section className="fb-report-manifest">
         <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
         <p className="fb-lede">{copy.manifestExplain}</p>
         <div className="fb-report-cta">
           <Button
             variant="primary"
             size="lg"
             onClick={onExportManifest}
             disabled={manifestRunning}
           >
             {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
           </Button>
           {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
         </div>
       </section>
diff --git a/src/shared/copy.ts b/src/shared/copy.ts
index 2966ed2..f34358a 100644
--- a/src/shared/copy.ts
+++ b/src/shared/copy.ts
@@ -1,63 +1,77 @@
 /**
  * 카피 톤 가이드는 web/CLAUDE.md 기준.
  * 권장: "살펴봤어요", "지쳐 있어요", "새로 시작", "같이 챙길게요", "추천드려요"
  * 회피: "스캔 완료", "심각한 상태", "초기화/리셋", "자동 처리", "필수입니다"
  */
 export const copy = {
   appName: "포맷버디",
   appNameEn: "FORMAT BUDDY",
 
   homeEyebrow: "PC 포맷 동행 데스크탑",
   homeTitle1: "포맷하기 전에,",
   homeTitle2: "버디가 같이",
   homeTitle3: "살펴볼게요.",
   homeLede:
     "공동인증서·카카오톡·드라이버·다운로드 파일까지. 포맷 전에 놓치기 쉬운 것들을 옆에서 챙기고, 복원 준비를 도와드려요.",
   homeStartCta: "PC 점검 시작",
   homeOpenReportCta: "리포트 열기",
 
   scanTitle: "버디가 살펴보는 중",
   scanWaiting: "잠깐, 진단 준비할게요",
   scanLiveLabel: "진단 중",
   scanCancelCta: "그만하기",
 
   reportTitle: "살펴봤어요",
   reportLede: "포맷 전에 같이 챙기면 좋은 것들을 정리해 드렸어요.",
   reportExportCta: "JSON으로 저장",
   reportOpenWebCta: "웹 리포트 뷰어 열기",
   reportBackCta: "처음으로",
 
   privacyHeadline: "Ryan의 PC 안에서만 동작해요",
   privacyBullets: [
     "서버로 어떤 파일도 보내지 않아요",
     "인증서 개인키·비밀번호는 수집하지 않아요",
     "JSON 리포트는 Ryan이 직접 저장하고 공유해요"
   ],
 
   errorHeadline: "지금 진단을 마치지 못했어요",
   errorRetryCta: "다시 시도",
 
   windowsOnlyHeadline: "이 버전은 Windows에서 동작해요",
   windowsOnlyBody:
     "지금은 Mac에서 테스트용 화면을 보고 계세요. 실제 PC 진단은 Windows에서 같이 살펴볼게요.",
 
   updateAvailable: "새 버전 받는 중이에요",
   updateDownloading: "버디가 새 버전을 챙겨오고 있어요",
   updateDownloaded: "준비 끝났어요. 다시 켜면 새 버전으로 시작해요",
   updateInstallCta: "지금 재시작",
   updateErrorLabel: "업데이트를 받지 못했어요",
 
   wingetSectionTitle: "winget으로 다시 설치할 앱",
   wingetSummary: (count: number) => `${count}개 앱을 winget으로 다시 설치할 수 있게 정리했어요`,
   wingetUnavailable: "winget이 없어요. 앱 재설치 목록은 이번 PC에선 비워둘게요",
 
   manifestSectionTitle: "백업 파일 무결성 manifest",
   manifestExplain:
     "Desktop·Documents·Downloads 같은 사용자 폴더의 파일을 해시(SHA-256)로 정리해 저장해요. 포맷 후 복원할 때 같은 파일이 잘 돌아왔는지 확인할 수 있어요.",
   manifestExportCta: "백업 manifest 만들기",
   manifestExportInProgress: "버디가 파일을 천천히 살펴보는 중이에요 (수십 초~수 분)",
   manifestExportSavedPrefix: "저장했어요: ",
   manifestExportCancelled: "저장을 취소했어요.",
   manifestExportErrorPrefix: "지금 만들지 못했어요: ",
-  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요."
+  manifestWindowsOnly: "이 기능은 Windows에서만 동작해요.",
+
+  recommendSectionTitle: "버디의 포맷 추천 점수",
+  recommendScoreSuffix: "점",
+  recommendTryFirstTitle: "포맷 전에 먼저 시도해볼 것",
+  recommendFormatReasonsTitle: "이런 점들이 신경 쓰여요",
+  recommendAfterFormatTitle: "포맷 후 같이 챙길 것",
+  recommendNoReasons: "지금 발견된 큰 문제는 없어요. 정기 정리만 해도 충분해요.",
+  recommendCommandLabel: "직접 실행",
+  recommendSeverity: {
+    healthy: "건강해요",
+    watch: "조금 지쳐 있어요",
+    "format-recommended": "새로 시작 추천",
+    "format-required": "새로 시작 강력 추천"
+  } as const
 } as const;
diff --git a/src/shared/types.ts b/src/shared/types.ts
index 5d4a2ce..002e0ac 100644
--- a/src/shared/types.ts
+++ b/src/shared/types.ts
@@ -31,162 +31,260 @@ export interface DiskInfo {
   sizeGb: number;
   freeGb: number;
 }
 
 export interface UserFolderInfo {
   name: string;
   path: string;
   exists: boolean;
   sizeGb: number | null;
 }
 
 export interface InstalledApp {
   name: string;
   version?: string | null;
   publisher?: string | null;
 }
 
 export interface DriverInfo {
   DeviceName?: string;
   DriverVersion?: string;
   Manufacturer?: string;
   DriverDate?: string;
 }
 
 export interface PrinterInfo {
   Name?: string;
   DriverName?: string;
   PortName?: string;
   Default?: boolean;
 }
 
 export interface NpkiCandidate {
   path: string;
   exists: boolean;
 }
 
 export interface BitLockerVolume {
   MountPoint?: string;
   VolumeStatus?: string;
   ProtectionStatus?: string;
   EncryptionPercentage?: number;
 }
 
 export interface CloudSyncCandidate {
   provider: string;
   path: string;
   exists: boolean;
 }
 
 export interface BrowserPresence {
   name: string;
   installed: boolean;
 }
 
 export interface WingetStatus {
   available: boolean;
   note: string;
 }
 
 export interface WingetExportPackage {
   PackageIdentifier?: string;
   Version?: string;
   Source?: string;
   [k: string]: unknown;
 }
 
 export interface WingetExportSource {
   SourceDetails?: { Name?: string; Argument?: string; Type?: string };
   Packages?: WingetExportPackage[];
   [k: string]: unknown;
 }
 
 export interface WingetExport {
   $schema?: string;
   CreationDate?: string;
   Sources?: WingetExportSource[];
   WinGetVersion?: string;
   [k: string]: unknown;
 }
 
+export interface DiskHealthDevice {
+  friendlyName?: string;
+  mediaType?: string;
+  busType?: string;
+  sizeGb?: number | null;
+  healthStatus?: string;
+  operationalStatus?: string;
+}
+
+export interface MemoryPressureInfo {
+  totalMemoryMb?: number | null;
+  freeMemoryMb?: number | null;
+  freeMemoryPercent?: number | null;
+  pageFileTotalMb?: number;
+  pageFileUsedMb?: number;
+  pageFileUsagePercent?: number;
+}
+
+export interface WindowsUpdateStatusInfo {
+  installedHotfixCount: number;
+  latestHotfixInstalledOn?: string | null;
+  daysSinceLatestHotfix?: number | null;
+}
+
+export interface EventLogSummaryInfo {
+  windowDays: number;
+  criticalCount: number;
+  errorCount: number;
+}
+
+export interface DriverAgeSummaryInfo {
+  totalWithDate: number;
+  olderThan2Years: number;
+  olderThan2YearsPercent: number;
+}
+
+export interface StartupProgramItem {
+  name?: string;
+  command?: string;
+  location?: string;
+  user?: string;
+}
+
+export interface StartupProgramsInfo {
+  count: number;
+  items: StartupProgramItem[];
+}
+
+export interface DefenderStatusInfo {
+  antivirusEnabled?: boolean | null;
+  realTimeProtectionEnabled?: boolean | null;
+  antivirusSignatureAgeDays?: number | null;
+  lastQuickScanDaysAgo?: number | null;
+  lastFullScanDaysAgo?: number | null;
+}
+
+export interface StorageWasteInfo {
+  userTempGb: number;
+  localAppDataTempGb: number;
+  windowsTempGb: number;
+  windowsOldExists: boolean;
+  windowsOldGb: number;
+}
+
+export type FormatSeverity = "healthy" | "watch" | "format-recommended" | "format-required";
+
+export interface ActionItem {
+  title: string;
+  description: string;
+  command?: string;
+}
+
+export interface ReasonItem {
+  signal: string;
+  label: string;
+  weightedScore: number;
+  description: string;
+}
+
+export interface Recommendation {
+  formatScore: number;
+  severity: FormatSeverity;
+  headline: string;
+  summary: string;
+  tryFirst: ActionItem[];
+  formatReasons: ReasonItem[];
+  afterFormat: ActionItem[];
+}
+
 export interface PrivacyInfo {
   localOnly: boolean;
   noPasswordCollection: boolean;
   noPrivateKeyUpload: boolean;
   noBrowserPasswordExtraction: boolean;
 }
 
 export interface ChecklistInfo {
   reviewNpkiManually: boolean;
   exportWifiProfilesManually: boolean;
   backupDesktopDocumentsDownloads: boolean;
   verifyCloudSync: boolean;
   saveReportBeforeFormat: boolean;
 }
 
 export interface ScanReport {
   schemaVersion: string;
   generatedAt: string;
   mode?: "quick" | "manifest";
   privacy: PrivacyInfo;
   system: SystemInfo;
   disks: DiskInfo[];
+  diskHealth?: DiskHealthDevice[];
+  memoryPressure?: MemoryPressureInfo;
+  windowsUpdate?: WindowsUpdateStatusInfo;
+  eventLog?: EventLogSummaryInfo;
+  driverAge?: DriverAgeSummaryInfo;
+  startupPrograms?: StartupProgramsInfo;
+  defender?: DefenderStatusInfo;
+  storageWaste?: StorageWasteInfo;
   userFolders: UserFolderInfo[];
   gpu: string[];
   installedApps: InstalledApp[];
   drivers: DriverInfo[];
   printers: PrinterInfo[];
   wifiProfiles: string[];
   npkiCandidates: NpkiCandidate[];
   bitlocker: BitLockerVolume[];
   cloudSync: CloudSyncCandidate[];
   browsers: BrowserPresence[];
   winget: WingetStatus;
   wingetExport?: WingetExport | null;
   diagnostics: Array<{ step: string; message: string }>;
   checklist: ChecklistInfo;
 }
 
 export interface ScanResult {
   report: ScanReport;
+  recommendation: Recommendation;
   jsonPath: string;
 }
 
 export interface ScanError {
   message: string;
   code?: string;
   detail?: string;
 }
 
 export interface ExportOptions {
   defaultFileName?: string;
 }
 
 export interface ExportResult {
   saved: boolean;
   path?: string;
 }
 
 export interface ManifestExportResult {
   saved: boolean;
   path?: string;
   fileCount?: number;
   totalBytes?: number;
   message?: string;
 }
 
 export interface UpdateInfo {
   version: string;
   releaseDate?: string;
   releaseNotes?: string | null;
 }
 
 export interface UpdateDownloadProgress {
   bytesPerSecond: number;
   percent: number;
   transferred: number;
   total: number;
 }
 
 export interface UpdateErrorPayload {
   message: string;
 }
diff --git a/tests/recommend.test.ts b/tests/recommend.test.ts
new file mode 100644
index 0000000..9d21a7a
--- /dev/null
+++ b/tests/recommend.test.ts
@@ -0,0 +1,199 @@
+import { describe, it, expect } from "vitest";
+import { generateRecommendation, __testing } from "../src/main/recommend";
+import type { ScanReport } from "../src/shared/types";
+
+function baseReport(overrides: Partial<ScanReport> = {}): ScanReport {
+  return {
+    schemaVersion: "0.4.0-quick-test",
+    generatedAt: new Date().toISOString(),
+    mode: "quick",
+    privacy: {
+      localOnly: true,
+      noPasswordCollection: true,
+      noPrivateKeyUpload: true,
+      noBrowserPasswordExtraction: true
+    },
+    system: {
+      manufacturer: "Mock",
+      model: "Test",
+      osCaption: "Windows 11 Pro",
+      osVersion: "10.0.22631",
+      cpu: "Mock CPU",
+      memoryGb: 16
+    },
+    disks: [{ drive: "C:", sizeGb: 500, freeGb: 250 }],
+    diskHealth: [
+      { healthStatus: "Healthy", operationalStatus: "OK", sizeGb: 500, mediaType: "SSD" }
+    ],
+    memoryPressure: {
+      totalMemoryMb: 16384,
+      freeMemoryMb: 8000,
+      freeMemoryPercent: 48.8,
+      pageFileTotalMb: 8192,
+      pageFileUsedMb: 1024,
+      pageFileUsagePercent: 12.5
+    },
+    windowsUpdate: { installedHotfixCount: 30, daysSinceLatestHotfix: 7 },
+    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 2 },
+    driverAge: { totalWithDate: 40, olderThan2Years: 5, olderThan2YearsPercent: 12.5 },
+    startupPrograms: { count: 5, items: [] },
+    defender: {
+      antivirusEnabled: true,
+      realTimeProtectionEnabled: true,
+      antivirusSignatureAgeDays: 1,
+      lastQuickScanDaysAgo: 2,
+      lastFullScanDaysAgo: 10
+    },
+    storageWaste: {
+      userTempGb: 0.5,
+      localAppDataTempGb: 1.0,
+      windowsTempGb: 0.2,
+      windowsOldExists: false,
+      windowsOldGb: 0
+    },
+    userFolders: [],
+    gpu: [],
+    installedApps: [],
+    drivers: [],
+    printers: [],
+    wifiProfiles: [],
+    npkiCandidates: [],
+    bitlocker: [],
+    cloudSync: [],
+    browsers: [],
+    winget: { available: true, note: "" },
+    diagnostics: [],
+    checklist: {
+      reviewNpkiManually: true,
+      exportWifiProfilesManually: true,
+      backupDesktopDocumentsDownloads: true,
+      verifyCloudSync: true,
+      saveReportBeforeFormat: true
+    },
+    ...overrides
+  };
+}
+
+describe("generateRecommendation — severity buckets", () => {
+  it("healthy PC scores in healthy band and exposes no format reasons", () => {
+    const rec = generateRecommendation(baseReport());
+    expect(rec.severity).toBe("healthy");
+    expect(rec.formatScore).toBeLessThanOrEqual(30);
+    expect(rec.formatReasons.length).toBe(0);
+    expect(rec.tryFirst.length).toBeGreaterThan(0); // always offers cleanmgr/sfc/dism
+    expect(rec.afterFormat.length).toBeGreaterThan(0);
+  });
+
+  it("low disk free + memory pressure pushes into watch / format-recommended", () => {
+    const rec = generateRecommendation(
+      baseReport({
+        disks: [{ drive: "C:", sizeGb: 500, freeGb: 25 }],
+        memoryPressure: {
+          totalMemoryMb: 8192,
+          freeMemoryMb: 800,
+          freeMemoryPercent: 9.8,
+          pageFileTotalMb: 4096,
+          pageFileUsedMb: 3700,
+          pageFileUsagePercent: 90.3
+        }
+      })
+    );
+    expect(rec.formatScore).toBeGreaterThan(15);
+    expect(rec.formatReasons.some((r) => r.signal === "disk-free")).toBe(true);
+    expect(rec.formatReasons.some((r) => r.signal === "memory-pressure")).toBe(true);
+  });
+
+  it("unhealthy disk + event criticals + old updates pushes to format-recommended or higher", () => {
+    const rec = generateRecommendation(
+      baseReport({
+        diskHealth: [
+          { healthStatus: "Unhealthy", operationalStatus: "Lost Communication", sizeGb: 500, mediaType: "HDD" }
+        ],
+        eventLog: { windowDays: 7, criticalCount: 12, errorCount: 40 },
+        windowsUpdate: { installedHotfixCount: 12, daysSinceLatestHotfix: 200 },
+        driverAge: { totalWithDate: 50, olderThan2Years: 45, olderThan2YearsPercent: 90 },
+        defender: {
+          antivirusEnabled: false,
+          realTimeProtectionEnabled: false,
+          antivirusSignatureAgeDays: 40,
+          lastQuickScanDaysAgo: 60,
+          lastFullScanDaysAgo: 365
+        },
+        storageWaste: {
+          userTempGb: 6,
+          localAppDataTempGb: 10,
+          windowsTempGb: 8,
+          windowsOldExists: true,
+          windowsOldGb: 12
+        },
+        disks: [{ drive: "C:", sizeGb: 256, freeGb: 6 }],
+        memoryPressure: {
+          totalMemoryMb: 4096,
+          freeMemoryMb: 100,
+          freeMemoryPercent: 2.4,
+          pageFileTotalMb: 2048,
+          pageFileUsedMb: 1900,
+          pageFileUsagePercent: 92.7
+        }
+      })
+    );
+    expect(["format-recommended", "format-required"]).toContain(rec.severity);
+    expect(rec.formatReasons.length).toBeGreaterThanOrEqual(5);
+    // disk-health must be the top reason
+    expect(rec.formatReasons[0].signal).toBe("disk-health");
+  });
+
+  it("score clamps to 0..100", () => {
+    const rec = generateRecommendation(
+      baseReport({
+        diskHealth: [{ healthStatus: "Failed", operationalStatus: "Lost Communication" }],
+        disks: [{ drive: "C:", sizeGb: 100, freeGb: 0.5 }],
+        eventLog: { windowDays: 7, criticalCount: 100, errorCount: 500 },
+        windowsUpdate: { installedHotfixCount: 1, daysSinceLatestHotfix: 9999 },
+        driverAge: { totalWithDate: 100, olderThan2Years: 100, olderThan2YearsPercent: 100 },
+        defender: {
+          antivirusEnabled: false,
+          realTimeProtectionEnabled: false,
+          antivirusSignatureAgeDays: 9999,
+          lastQuickScanDaysAgo: 9999,
+          lastFullScanDaysAgo: 9999
+        },
+        storageWaste: {
+          userTempGb: 999,
+          localAppDataTempGb: 999,
+          windowsTempGb: 999,
+          windowsOldExists: true,
+          windowsOldGb: 999
+        },
+        memoryPressure: {
+          totalMemoryMb: 2048,
+          freeMemoryMb: 1,
+          freeMemoryPercent: 0.05,
+          pageFileTotalMb: 1024,
+          pageFileUsedMb: 1024,
+          pageFileUsagePercent: 100
+        }
+      })
+    );
+    expect(rec.formatScore).toBeGreaterThanOrEqual(0);
+    expect(rec.formatScore).toBeLessThanOrEqual(100);
+  });
+});
+
+describe("severity thresholds", () => {
+  it("getSeverity maps boundaries correctly", () => {
+    expect(__testing.getSeverity(0)).toBe("healthy");
+    expect(__testing.getSeverity(30)).toBe("healthy");
+    expect(__testing.getSeverity(31)).toBe("watch");
+    expect(__testing.getSeverity(60)).toBe("watch");
+    expect(__testing.getSeverity(61)).toBe("format-recommended");
+    expect(__testing.getSeverity(85)).toBe("format-recommended");
+    expect(__testing.getSeverity(86)).toBe("format-required");
+    expect(__testing.getSeverity(100)).toBe("format-required");
+  });
+
+  it("weights sum to 1.0", () => {
+    const total = Object.values(__testing.WEIGHTS).reduce((s, w) => s + w, 0);
+    expect(total).toBeCloseTo(1.0, 5);
+  });
+});

exec
/bin/zsh -lc "nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '1,260p'
printf '\\n--- mid ---\\n'
nl -ba resources/powershell/Invoke-FormatBuddyScan.ps1 | sed -n '260,620p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	# FormatBuddy local diagnostic prototype
     2	# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
     3	#
     4	# Modes:
     5	#   -Mode quick     (default) full system diagnostics + installed apps + winget export summary
     6	#   -Mode manifest  per-user-folder SHA-256 manifest for backup/restore verification
     7	
     8	param(
     9	  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json",
    10	  [ValidateSet("quick", "manifest")]
    11	  [string]$Mode = "quick",
    12	  [int64]$ManifestMaxFileSizeBytes = 104857600
    13	)
    14	
    15	$ErrorActionPreference = "SilentlyContinue"
    16	$diagnostics = New-Object System.Collections.Generic.List[object]
    17	
    18	function Add-Diagnostic {
    19	  param([string]$Step, [string]$Message)
    20	  $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
    21	}
    22	
    23	function Get-SafeCimInstance {
    24	  param([string]$ClassName)
    25	  try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
    26	}
    27	
    28	function Get-InstalledApps {
    29	  $paths = @(
    30	    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    31	    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    32	    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    33	  )
    34	
    35	  foreach ($path in $paths) {
    36	    Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
    37	      [ordered]@{
    38	        name = $_.DisplayName
    39	        version = $_.DisplayVersion
    40	        publisher = $_.Publisher
    41	      }
    42	    }
    43	  }
    44	}
    45	
    46	function Test-NpkiLocation {
    47	  $candidates = @(
    48	    "$env:USERPROFILE\AppData\LocalLow\NPKI",
    49	    "$env:USERPROFILE\AppData\Roaming\NPKI",
    50	    "$env:SystemDrive\NPKI"
    51	  )
    52	
    53	  foreach ($path in $candidates) {
    54	    [ordered]@{
    55	      path = $path
    56	      exists = Test-Path $path
    57	    }
    58	  }
    59	}
    60	
    61	function Get-FolderSizeGb {
    62	  param([string]$Path)
    63	
    64	  if (!(Test-Path $Path)) { return $null }
    65	
    66	  try {
    67	    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
    68	      Measure-Object -Property Length -Sum
    69	
    70	    if ($null -eq $sum.Sum) { return 0 }
    71	    return [Math]::Round($sum.Sum / 1GB, 2)
    72	  } catch {
    73	    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    74	    return $null
    75	  }
    76	}
    77	
    78	function Get-UserFolders {
    79	  $folders = @(
    80	    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    81	    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    82	    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    83	    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    84	    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    85	    @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
    86	  )
    87	
    88	  foreach ($folder in $folders) {
    89	    $exists = Test-Path $folder.path
    90	    [ordered]@{
    91	      name = $folder.name
    92	      path = $folder.path
    93	      exists = $exists
    94	      sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
    95	    }
    96	  }
    97	}
    98	
    99	function Get-CloudSyncCandidates {
   100	  $candidates = @(
   101	    @{ provider = "OneDrive"; path = $env:OneDrive },
   102	    @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
   103	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
   104	    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
   105	    @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
   106	  ) | Where-Object { $_.path }
   107	
   108	  foreach ($candidate in $candidates) {
   109	    [ordered]@{
   110	      provider = $candidate.provider
   111	      path = $candidate.path
   112	      exists = Test-Path $candidate.path
   113	    }
   114	  }
   115	}
   116	
   117	function Get-BrowserPresence {
   118	  $browsers = @(
   119	    @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
   120	    @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
   121	    @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
   122	    @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
   123	  )
   124	
   125	  foreach ($browser in $browsers) {
   126	    [ordered]@{
   127	      name = $browser.name
   128	      installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
   129	    }
   130	  }
   131	}
   132	
   133	function Get-WingetStatus {
   134	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   135	  [ordered]@{
   136	    available = [bool]$winget
   137	    note = if ($winget) { "winget is available. App export captured in wingetExport." } else { "winget is not available on this PC." }
   138	  }
   139	}
   140	
   141	function Get-WingetExport {
   142	  $winget = Get-Command winget -ErrorAction SilentlyContinue
   143	  if (-not $winget) { return $null }
   144	
   145	  $tempBase = [System.IO.Path]::GetTempFileName()
   146	  Remove-Item $tempBase -Force -ErrorAction SilentlyContinue
   147	  $tempJson = "$tempBase.json"
   148	
   149	  try {
   150	    $null = & winget export -o $tempJson --accept-source-agreements --disable-interactivity 2>&1
   151	    if (Test-Path $tempJson) {
   152	      $raw = Get-Content -Raw -Path $tempJson -ErrorAction Stop
   153	      return ($raw | ConvertFrom-Json -Depth 16)
   154	    }
   155	  } catch {
   156	    Add-Diagnostic -Step "WingetExport" -Message $_.Exception.Message
   157	  } finally {
   158	    if (Test-Path $tempJson) { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
   159	  }
   160	
   161	  return $null
   162	}
   163	
   164	function Get-FilesSkippingReparsePoints {
   165	  # Manual recursion so we can skip ReparsePoint directories entirely.
   166	  # Get-ChildItem -Recurse will silently follow junctions/symlinks and can
   167	  # walk into the source tree, system folders, or infinite loops.
   168	  param([string]$Root)
   169	
   170	  $results = New-Object System.Collections.Generic.List[object]
   171	  $stack = New-Object System.Collections.Generic.Stack[string]
   172	  $stack.Push($Root)
   173	
   174	  while ($stack.Count -gt 0) {
   175	    $current = $stack.Pop()
   176	    Get-ChildItem -LiteralPath $current -Force -ErrorAction SilentlyContinue | ForEach-Object {
   177	      if ($_.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
   178	        return
   179	      }
   180	      if ($_ -is [System.IO.DirectoryInfo]) {
   181	        $stack.Push($_.FullName)
   182	      } elseif ($_ -is [System.IO.FileInfo]) {
   183	        $results.Add($_) | Out-Null
   184	      }
   185	    }
   186	  }
   187	
   188	  return $results
   189	}
   190	
   191	function Get-DiskHealth {
   192	  $physical = try { Get-PhysicalDisk -ErrorAction Stop } catch { Add-Diagnostic -Step "DiskHealth" -Message $_.Exception.Message; @() }
   193	  foreach ($d in $physical) {
   194	    [ordered]@{
   195	      friendlyName = $d.FriendlyName
   196	      mediaType = "$($d.MediaType)"
   197	      busType = "$($d.BusType)"
   198	      sizeGb = if ($d.Size) { [Math]::Round($d.Size / 1GB, 2) } else { $null }
   199	      healthStatus = "$($d.HealthStatus)"
   200	      operationalStatus = "$($d.OperationalStatus)"
   201	    }
   202	  }
   203	}
   204	
   205	function Get-MemoryPressure {
   206	  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   207	  $pageFiles = Get-SafeCimInstance Win32_PageFileUsage
   208	  $totalKb = if ($os) { $os.TotalVisibleMemorySize } else { 0 }
   209	  $freeKb = if ($os) { $os.FreePhysicalMemory } else { 0 }
   210	  $totalPageFileMb = ($pageFiles | Measure-Object -Property AllocatedBaseSize -Sum).Sum
   211	  $usedPageFileMb = ($pageFiles | Measure-Object -Property CurrentUsage -Sum).Sum
   212	  if ($null -eq $totalPageFileMb) { $totalPageFileMb = 0 }
   213	  if ($null -eq $usedPageFileMb) { $usedPageFileMb = 0 }
   214	  $pageFileUsagePercent = if ($totalPageFileMb -gt 0) { [Math]::Round(($usedPageFileMb / $totalPageFileMb) * 100, 1) } else { 0 }
   215	  $freeMemPercent = if ($totalKb -gt 0) { [Math]::Round(($freeKb / $totalKb) * 100, 1) } else { $null }
   216	  [ordered]@{
   217	    totalMemoryMb = if ($totalKb) { [Math]::Round($totalKb / 1024, 0) } else { $null }
   218	    freeMemoryMb = if ($freeKb) { [Math]::Round($freeKb / 1024, 0) } else { $null }
   219	    freeMemoryPercent = $freeMemPercent
   220	    pageFileTotalMb = $totalPageFileMb
   221	    pageFileUsedMb = $usedPageFileMb
   222	    pageFileUsagePercent = $pageFileUsagePercent
   223	  }
   224	}
   225	
   226	function Get-WindowsUpdateStatus {
   227	  $hotfixes = Get-SafeCimInstance Win32_QuickFixEngineering | Sort-Object -Property InstalledOn -Descending
   228	  $latestInstalledOn = if ($hotfixes -and $hotfixes.Count -gt 0) {
   229	    try { $hotfixes[0].InstalledOn.ToString("o") } catch { $null }
   230	  } else { $null }
   231	  $daysSinceLatest = if ($latestInstalledOn) {
   232	    try { [int]((Get-Date) - [DateTime]$latestInstalledOn).TotalDays } catch { $null }
   233	  } else { $null }
   234	  [ordered]@{
   235	    installedHotfixCount = if ($hotfixes) { @($hotfixes).Count } else { 0 }
   236	    latestHotfixInstalledOn = $latestInstalledOn
   237	    daysSinceLatestHotfix = $daysSinceLatest
   238	  }
   239	}
   240	
   241	function Get-EventLogSummary {
   242	  $since = (Get-Date).AddDays(-7)
   243	  $criticalCount = 0
   244	  $errorCount = 0
   245	  try {
   246	    $events = Get-WinEvent -FilterHashtable @{ LogName = "System"; Level = 1,2; StartTime = $since } -ErrorAction Stop
   247	    foreach ($e in $events) {
   248	      if ($e.Level -eq 1) { $criticalCount++ }
   249	      elseif ($e.Level -eq 2) { $errorCount++ }
   250	    }
   251	  } catch {
   252	    Add-Diagnostic -Step "EventLog" -Message $_.Exception.Message
   253	  }
   254	  [ordered]@{
   255	    windowDays = 7
   256	    criticalCount = $criticalCount
   257	    errorCount = $errorCount
   258	  }
   259	}
   260	

--- mid ---
   260	
   261	function Get-DriverAgeSummary {
   262	  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   263	  $total = 0
   264	  $olderThan2Years = 0
   265	  $cutoff = (Get-Date).AddYears(-2)
   266	  foreach ($d in $drivers) {
   267	    if ($d.DriverDate) {
   268	      $total++
   269	      try {
   270	        $date = [Management.ManagementDateTimeConverter]::ToDateTime($d.DriverDate)
   271	        if ($date -lt $cutoff) { $olderThan2Years++ }
   272	      } catch { }
   273	    }
   274	  }
   275	  $pct = if ($total -gt 0) { [Math]::Round(($olderThan2Years / $total) * 100, 1) } else { 0 }
   276	  [ordered]@{
   277	    totalWithDate = $total
   278	    olderThan2Years = $olderThan2Years
   279	    olderThan2YearsPercent = $pct
   280	  }
   281	}
   282	
   283	function Get-StartupPrograms {
   284	  $items = Get-SafeCimInstance Win32_StartupCommand
   285	  $list = New-Object System.Collections.Generic.List[object]
   286	  foreach ($i in $items) {
   287	    $list.Add([ordered]@{
   288	      name = $i.Name
   289	      command = $i.Command
   290	      location = $i.Location
   291	      user = $i.User
   292	    }) | Out-Null
   293	  }
   294	  [ordered]@{
   295	    count = $list.Count
   296	    items = @($list)
   297	  }
   298	}
   299	
   300	function Get-DefenderStatus {
   301	  try {
   302	    $s = Get-MpComputerStatus -ErrorAction Stop
   303	    [ordered]@{
   304	      antivirusEnabled = [bool]$s.AntivirusEnabled
   305	      realTimeProtectionEnabled = [bool]$s.RealTimeProtectionEnabled
   306	      antivirusSignatureAgeDays = $s.AntivirusSignatureAge
   307	      lastQuickScanDaysAgo = $s.QuickScanAge
   308	      lastFullScanDaysAgo = $s.FullScanAge
   309	    }
   310	  } catch {
   311	    Add-Diagnostic -Step "DefenderStatus" -Message $_.Exception.Message
   312	    [ordered]@{
   313	      antivirusEnabled = $null
   314	      realTimeProtectionEnabled = $null
   315	      antivirusSignatureAgeDays = $null
   316	      lastQuickScanDaysAgo = $null
   317	      lastFullScanDaysAgo = $null
   318	    }
   319	  }
   320	}
   321	
   322	function Get-StorageWaste {
   323	  function Get-PathSizeGb {
   324	    param([string]$Path)
   325	    if (-not (Test-Path $Path)) { return 0 }
   326	    try {
   327	      $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
   328	        Measure-Object -Property Length -Sum
   329	      if ($null -eq $sum.Sum) { return 0 }
   330	      return [Math]::Round($sum.Sum / 1GB, 2)
   331	    } catch { return 0 }
   332	  }
   333	  $tempGb = Get-PathSizeGb -Path $env:TEMP
   334	  $localAppDataTempGb = Get-PathSizeGb -Path (Join-Path $env:LOCALAPPDATA "Temp")
   335	  $windowsTempGb = Get-PathSizeGb -Path (Join-Path $env:SystemRoot "Temp")
   336	  $windowsOldExists = Test-Path (Join-Path $env:SystemDrive "Windows.old")
   337	  $windowsOldGb = if ($windowsOldExists) { Get-PathSizeGb -Path (Join-Path $env:SystemDrive "Windows.old") } else { 0 }
   338	  [ordered]@{
   339	    userTempGb = $tempGb
   340	    localAppDataTempGb = $localAppDataTempGb
   341	    windowsTempGb = $windowsTempGb
   342	    windowsOldExists = $windowsOldExists
   343	    windowsOldGb = $windowsOldGb
   344	  }
   345	}
   346	
   347	function Get-BackupManifest {
   348	  param(
   349	    [string[]]$Folders,
   350	    [int64]$MaxFileSize
   351	  )
   352	
   353	  $folderResults = New-Object System.Collections.Generic.List[object]
   354	
   355	  foreach ($folder in $Folders) {
   356	    if ([string]::IsNullOrWhiteSpace($folder)) { continue }
   357	    if (-not (Test-Path $folder)) {
   358	      $folderResults.Add([ordered]@{
   359	        folder = $folder
   360	        exists = $false
   361	        fileCount = 0
   362	        skippedCount = 0
   363	        totalBytes = 0
   364	        entries = @()
   365	        skipped = @()
   366	      }) | Out-Null
   367	      continue
   368	    }
   369	
   370	    $entries = New-Object System.Collections.Generic.List[object]
   371	    $skipped = New-Object System.Collections.Generic.List[object]
   372	    $folderNorm = $folder.TrimEnd('\','/')
   373	
   374	    $files = Get-FilesSkippingReparsePoints -Root $folder
   375	    foreach ($file in $files) {
   376	      $rel = $file.FullName
   377	      if ($rel.StartsWith($folderNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
   378	        $rel = $rel.Substring($folderNorm.Length).TrimStart('\','/')
   379	      }
   380	
   381	      if ($file.Length -gt $MaxFileSize) {
   382	        $skipped.Add([ordered]@{
   383	          path = $rel
   384	          sizeBytes = $file.Length
   385	          reason = "exceeds-max-size"
   386	        }) | Out-Null
   387	        continue
   388	      }
   389	
   390	      try {
   391	        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName -ErrorAction Stop
   392	        $entries.Add([ordered]@{
   393	          path = $rel
   394	          sizeBytes = $file.Length
   395	          sha256 = $hash.Hash
   396	          modifiedAt = $file.LastWriteTimeUtc.ToString("o")
   397	        }) | Out-Null
   398	      } catch {
   399	        $skipped.Add([ordered]@{
   400	          path = $rel
   401	          sizeBytes = $file.Length
   402	          reason = "hash-failed: $($_.Exception.Message)"
   403	        }) | Out-Null
   404	      }
   405	    }
   406	
   407	    $totalBytes = ($entries | Measure-Object -Property sizeBytes -Sum).Sum
   408	    if ($null -eq $totalBytes) { $totalBytes = 0 }
   409	
   410	    $folderResults.Add([ordered]@{
   411	      folder = $folder
   412	      exists = $true
   413	      fileCount = $entries.Count
   414	      skippedCount = $skipped.Count
   415	      totalBytes = $totalBytes
   416	      entries = @($entries)
   417	      skipped = @($skipped)
   418	    }) | Out-Null
   419	  }
   420	
   421	  return @($folderResults)
   422	}
   423	
   424	if ($Mode -eq "manifest") {
   425	  $manifestFolders = @(
   426	    [Environment]::GetFolderPath("Desktop"),
   427	    [Environment]::GetFolderPath("MyDocuments"),
   428	    [Environment]::GetFolderPath("MyPictures"),
   429	    [Environment]::GetFolderPath("MyMusic"),
   430	    [Environment]::GetFolderPath("MyVideos"),
   431	    (Join-Path $env:USERPROFILE "Downloads")
   432	  ) | Where-Object { $_ }
   433	
   434	  $report = [ordered]@{
   435	    schemaVersion = "0.2.0-manifest"
   436	    generatedAt = (Get-Date).ToString("o")
   437	    mode = "manifest"
   438	    privacy = [ordered]@{
   439	      localOnly = $true
   440	      noPasswordCollection = $true
   441	      noPrivateKeyUpload = $true
   442	      noBrowserPasswordExtraction = $true
   443	    }
   444	    maxFileSizeBytes = $ManifestMaxFileSizeBytes
   445	    folders = Get-BackupManifest -Folders $manifestFolders -MaxFileSize $ManifestMaxFileSizeBytes
   446	    diagnostics = @($diagnostics)
   447	  }
   448	} else {
   449	  $computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
   450	  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   451	  $bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
   452	  $cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
   453	  $gpu = Get-SafeCimInstance Win32_VideoController
   454	  $disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
   455	  $printers = Get-SafeCimInstance Win32_Printer
   456	  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   457	  $wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
   458	  $bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
   459	
   460	  $report = [ordered]@{
   461	    schemaVersion = "0.4.0-quick"
   462	    generatedAt = (Get-Date).ToString("o")
   463	    mode = "quick"
   464	    privacy = [ordered]@{
   465	      localOnly = $true
   466	      noPasswordCollection = $true
   467	      noPrivateKeyUpload = $true
   468	      noBrowserPasswordExtraction = $true
   469	    }
   470	    system = [ordered]@{
   471	      manufacturer = $computer.Manufacturer
   472	      model = $computer.Model
   473	      serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
   474	      osCaption = $os.Caption
   475	      osVersion = $os.Version
   476	      cpu = $cpu.Name
   477	      memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
   478	    }
   479	    disks = @($disk | ForEach-Object {
   480	      [ordered]@{
   481	        drive = $_.DeviceID
   482	        sizeGb = [Math]::Round($_.Size / 1GB, 2)
   483	        freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
   484	      }
   485	    })
   486	    diskHealth = @(Get-DiskHealth)
   487	    memoryPressure = Get-MemoryPressure
   488	    windowsUpdate = Get-WindowsUpdateStatus
   489	    eventLog = Get-EventLogSummary
   490	    driverAge = Get-DriverAgeSummary
   491	    startupPrograms = Get-StartupPrograms
   492	    defender = Get-DefenderStatus
   493	    storageWaste = Get-StorageWaste
   494	    userFolders = @(Get-UserFolders)
   495	    gpu = @($gpu | ForEach-Object { $_.Name })
   496	    installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
   497	    drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
   498	    printers = @($printers | Select-Object Name, DriverName, PortName, Default)
   499	    wifiProfiles = @($wifiProfiles)
   500	    npkiCandidates = @(Test-NpkiLocation)
   501	    bitlocker = @($bitlocker)
   502	    cloudSync = @(Get-CloudSyncCandidates)
   503	    browsers = @(Get-BrowserPresence)
   504	    winget = Get-WingetStatus
   505	    wingetExport = Get-WingetExport
   506	    diagnostics = @($diagnostics)
   507	    checklist = [ordered]@{
   508	      reviewNpkiManually = $true
   509	      exportWifiProfilesManually = $true
   510	      backupDesktopDocumentsDownloads = $true
   511	      verifyCloudSync = $true
   512	      saveReportBeforeFormat = $true
   513	    }
   514	  }
   515	}
   516	
   517	$parent = Split-Path -Parent $OutputPath
   518	if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
   519	$report | ConvertTo-Json -Depth 16 | Out-File -FilePath $OutputPath -Encoding utf8
   520	Write-Host "FormatBuddy report saved: $OutputPath (mode=$Mode)"

exec
/bin/zsh -lc "nl -ba src/main/scanner.ts | sed -n '1,260p'
printf '\\n--- 260-560 ---\\n'
nl -ba src/main/scanner.ts | sed -n '260,560p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	import { spawn } from "node:child_process";
     2	import { existsSync, mkdirSync, promises as fs } from "node:fs";
     3	import { tmpdir } from "node:os";
     4	import { dirname, join } from "node:path";
     5	import { createHash, randomUUID } from "node:crypto";
     6	import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
     7	import { EXPECTED_PS_SCRIPT_HASH } from "@shared/ps-script-hash";
     8	import { generateRecommendation } from "./recommend";
     9	
    10	const STDERR_MAX_BYTES = 64 * 1024;
    11	
    12	/**
    13	 * Read the on-disk PowerShell script, hash it, compare against the bundled
    14	 * expected digest, and (on match) copy the verified bytes into a private
    15	 * temp file. The returned path is what the caller MUST spawn — that closes
    16	 * the TOCTOU window between hash check and PowerShell open.
    17	 *
    18	 * Returns the staged path on success. Returns null when the on-disk script
    19	 * cannot be read OR the hash does not match AND `enforce` is false (dev
    20	 * workflow): the caller may then fall back to the original path or refuse
    21	 * to run.
    22	 */
    23	async function verifyAndStageScript(
    24	  scriptPath: string,
    25	  opts: { enforce: boolean; expectedHash?: string }
    26	): Promise<string | null> {
    27	  const expected = opts.expectedHash ?? EXPECTED_PS_SCRIPT_HASH;
    28	
    29	  let buf: Buffer;
    30	  try {
    31	    buf = await fs.readFile(scriptPath);
    32	  } catch (e) {
    33	    if (opts.enforce) throw e;
    34	    return null;
    35	  }
    36	
    37	  const actual = createHash("sha256").update(buf).digest("hex");
    38	  if (actual !== expected) {
    39	    if (opts.enforce) {
    40	      throw new Error(
    41	        `PowerShell integrity check failed (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
    42	      );
    43	    }
    44	    console.warn(
    45	      `[scanner] PowerShell hash mismatch in dev mode — using original path. expected=${expected.slice(0, 12)}… actual=${actual.slice(0, 12)}…`
    46	    );
    47	    return null;
    48	  }
    49	
    50	  // Hash matches: stage verified bytes to a FRESH per-run private directory
    51	  // so an attacker cannot pre-seed the staging path (predictable shared dir
    52	  // would allow ACL/symlink games even with a random filename).
    53	  //   - mkdtemp creates a brand-new directory with a random suffix
    54	  //   - chmod 0700 restricts to the current user (POSIX; ignored on Windows
    55	  //     where NTFS ACLs inherit from the parent — fail-open is acceptable
    56	  //     because the prefix is per-run unpredictable)
    57	  //   - writeFile with flag "wx" refuses to overwrite if the path somehow
    58	  //     already exists (e.g. symlink) and mode 0600 on POSIX
    59	  //   - on chmod/writeFile failure we MUST remove stagedDir before
    60	  //     re-throwing, otherwise runScan's finally never learns the path
    61	  //     and the per-run tempdir leaks
    62	  const stagedDir = await fs.mkdtemp(join(tmpdir(), "fb-script-"));
    63	  try {
    64	    try {
    65	      await fs.chmod(stagedDir, 0o700);
    66	    } catch {
    67	      // non-POSIX (Windows) — directory inherits parent ACL; the per-run
    68	      // random prefix is the main barrier
    69	    }
    70	    const stagedPath = join(stagedDir, "script.ps1");
    71	    await fs.writeFile(stagedPath, buf, { flag: "wx", mode: 0o600 });
    72	    return stagedPath;
    73	  } catch (e) {
    74	    await fs.rm(stagedDir, { recursive: true, force: true }).catch(() => {
    75	      // best-effort: at worst the OS reaps the dir
    76	    });
    77	    throw e;
    78	  }
    79	}
    80	
    81	function isScanReport(value: unknown): value is ScanReport {
    82	  if (!value || typeof value !== "object") return false;
    83	  const r = value as Record<string, unknown>;
    84	  // v0.4.0+ adds optional health-signal fields; we keep the guard tolerant
    85	  // (presence-only on optional fields) so older mock fixtures stay valid.
    86	  return (
    87	    typeof r.schemaVersion === "string" &&
    88	    typeof r.generatedAt === "string" &&
    89	    Array.isArray(r.disks) &&
    90	    Array.isArray(r.userFolders) &&
    91	    Array.isArray(r.installedApps) &&
    92	    Array.isArray(r.drivers) &&
    93	    Array.isArray(r.printers) &&
    94	    typeof r.system === "object" &&
    95	    typeof r.privacy === "object" &&
    96	    typeof r.checklist === "object"
    97	  );
    98	}
    99	
   100	async function readAndDelete(path: string): Promise<string> {
   101	  const raw = await fs.readFile(path, "utf8");
   102	  await fs.unlink(path).catch(() => {
   103	    // best-effort cleanup; ignore failures so a Windows lock doesn't crash the flow
   104	  });
   105	  return raw;
   106	}
   107	
   108	export interface RunScanOptions {
   109	  scriptPath: string;
   110	  outputDir: string;
   111	  onProgress?: (progress: ScanProgress) => void;
   112	  powershellExe?: string;
   113	  signal?: AbortSignal;
   114	  /** Synthetic mock instead of spawning powershell (for non-Windows dev / tests). */
   115	  mock?: boolean;
   116	  /** Require script.sha256 to exist and match. Set true for packaged production. */
   117	  enforceIntegrity?: boolean;
   118	}
   119	
   120	export interface RunBackupManifestOptions {
   121	  scriptPath: string;
   122	  outputPath: string;
   123	  signal?: AbortSignal;
   124	  powershellExe?: string;
   125	  enforceIntegrity?: boolean;
   126	  manifestMaxFileSizeBytes?: number;
   127	}
   128	
   129	export interface RunBackupManifestResult {
   130	  saved: boolean;
   131	  path: string;
   132	}
   133	
   134	const PIPELINE_STEPS: readonly string[] = [
   135	  "PC 정보 확인",
   136	  "디스크 살펴보기",
   137	  "사용자 폴더 챙기기",
   138	  "설치 앱 / 드라이버 목록",
   139	  "인증서·Wi-Fi·클라우드",
   140	  "포맷 체크리스트 정리"
   141	];
   142	
   143	const TOTAL_STEPS = PIPELINE_STEPS.length;
   144	
   145	function buildSteps(activeIndex: number): ScanStepView[] {
   146	  return PIPELINE_STEPS.map((name, i) => {
   147	    if (i < activeIndex) return { name, state: "done", detail: "살펴봤어요" };
   148	    if (i === activeIndex) return { name, state: "active", detail: "보고 있어요" };
   149	    return { name, state: "pending", detail: "대기" };
   150	  });
   151	}
   152	
   153	function progressFor(activeIndex: number, startedAt: number, message?: string): ScanProgress {
   154	  const safeIndex = Math.max(0, Math.min(TOTAL_STEPS, activeIndex));
   155	  const score = Math.min(100, Math.round((safeIndex / TOTAL_STEPS) * 100));
   156	  return {
   157	    step: PIPELINE_STEPS[Math.min(safeIndex, TOTAL_STEPS - 1)],
   158	    doneSteps: safeIndex,
   159	    totalSteps: TOTAL_STEPS,
   160	    score,
   161	    elapsedMs: Date.now() - startedAt,
   162	    steps: buildSteps(safeIndex),
   163	    message
   164	  };
   165	}
   166	
   167	export async function runScan(options: RunScanOptions): Promise<ScanResult> {
   168	  const { onProgress, signal, mock, enforceIntegrity } = options;
   169	  const startedAt = Date.now();
   170	
   171	  let stagedPath: string | null = null;
   172	  if (!mock) {
   173	    stagedPath = await verifyAndStageScript(options.scriptPath, {
   174	      enforce: !!enforceIntegrity
   175	    });
   176	  }
   177	  const effectiveScriptPath = stagedPath ?? options.scriptPath;
   178	
   179	  const tmpDir = join(tmpdir(), "formatbuddy-scans");
   180	  ensureDir(tmpDir);
   181	  const outPath = join(tmpDir, `report-${randomUUID()}.json`);
   182	
   183	  onProgress?.(progressFor(0, startedAt, "버디가 살펴볼 준비 중이에요"));
   184	
   185	  try {
   186	    if (mock || process.platform !== "win32") {
   187	      return await runMockScan({ outPath, startedAt, onProgress, signal });
   188	    }
   189	    return await runPowershellScan({
   190	      ...options,
   191	      scriptPath: effectiveScriptPath,
   192	      outPath,
   193	      startedAt
   194	    });
   195	  } finally {
   196	    if (stagedPath) {
   197	      const stagedDir = dirname(stagedPath);
   198	      await fs.unlink(stagedPath).catch(() => {
   199	        // best-effort: the temp file is in a per-run mkdtemp directory and
   200	        // will be reaped by the OS even if unlink fails
   201	      });
   202	      await fs.rmdir(stagedDir).catch(() => {
   203	        // best-effort cleanup of the per-run directory
   204	      });
   205	    }
   206	  }
   207	}
   208	
   209	function ensureDir(dir: string) {
   210	  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
   211	}
   212	
   213	interface InternalRunArgs {
   214	  outPath: string;
   215	  startedAt: number;
   216	  onProgress?: (progress: ScanProgress) => void;
   217	  signal?: AbortSignal;
   218	}
   219	
   220	async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
   221	  const { outPath, startedAt, onProgress, signal } = args;
   222	
   223	  for (let i = 1; i <= TOTAL_STEPS; i++) {
   224	    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError");
   225	    await delay(380);
   226	    onProgress?.(progressFor(i, startedAt));
   227	  }
   228	
   229	  const report: ScanReport = buildMockReport();
   230	  ensureDir(dirname(outPath));
   231	  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
   232	
   233	  // Mock pipeline echoes the on-disk path for parity but the file is ephemeral.
   234	  return { report, recommendation: generateRecommendation(report), jsonPath: outPath };
   235	}
   236	
   237	interface PowershellRunArgs extends RunScanOptions {
   238	  outPath: string;
   239	  startedAt: number;
   240	}
   241	
   242	function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
   243	  const { scriptPath, outPath, startedAt, onProgress, signal } = args;
   244	  const exe = args.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   245	
   246	  return new Promise<ScanResult>((resolveScan, rejectScan) => {
   247	    const child = spawn(
   248	      exe,
   249	      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputPath", outPath],
   250	      { windowsHide: true }
   251	    );
   252	
   253	    let activeIndex = 0;
   254	    let stderrBuf = "";
   255	    const tick = setInterval(() => {
   256	      if (activeIndex < TOTAL_STEPS) {
   257	        activeIndex += 1;
   258	        onProgress?.(progressFor(activeIndex, startedAt));
   259	      }
   260	    }, 700);

--- 260-560 ---
   260	    }, 700);
   261	
   262	    const cleanup = () => {
   263	      clearInterval(tick);
   264	      signal?.removeEventListener("abort", onAbort);
   265	    };
   266	
   267	    const onAbort = () => {
   268	      child.kill();
   269	      cleanup();
   270	      rejectScan(new DOMException("Scan cancelled", "AbortError"));
   271	    };
   272	
   273	    if (signal) {
   274	      if (signal.aborted) {
   275	        onAbort();
   276	        return;
   277	      }
   278	      signal.addEventListener("abort", onAbort, { once: true });
   279	    }
   280	
   281	    child.stderr.on("data", (chunk: Buffer) => {
   282	      stderrBuf += chunk.toString("utf8");
   283	      if (stderrBuf.length > STDERR_MAX_BYTES) {
   284	        stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
   285	      }
   286	    });
   287	
   288	    child.on("error", (err) => {
   289	      cleanup();
   290	      rejectScan(err);
   291	    });
   292	
   293	    child.on("close", async (code) => {
   294	      cleanup();
   295	      if (code !== 0) {
   296	        rejectScan(new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`));
   297	        return;
   298	      }
   299	      try {
   300	        const raw = await readAndDelete(outPath);
   301	        const parsed: unknown = JSON.parse(raw);
   302	        if (!isScanReport(parsed)) {
   303	          rejectScan(new Error("Diagnostic JSON did not match expected ScanReport schema."));
   304	          return;
   305	        }
   306	        const report = parsed;
   307	        onProgress?.(progressFor(TOTAL_STEPS, startedAt, "살펴보기 끝났어요"));
   308	        resolveScan({ report, recommendation: generateRecommendation(report), jsonPath: outPath });
   309	      } catch (e) {
   310	        rejectScan(e as Error);
   311	      }
   312	    });
   313	  });
   314	}
   315	
   316	function delay(ms: number) {
   317	  return new Promise<void>((res) => setTimeout(res, ms));
   318	}
   319	
   320	function buildMockReport(): ScanReport {
   321	  return {
   322	    schemaVersion: "0.4.0-quick-mock",
   323	    generatedAt: new Date().toISOString(),
   324	    mode: "quick",
   325	    privacy: {
   326	      localOnly: true,
   327	      noPasswordCollection: true,
   328	      noPrivateKeyUpload: true,
   329	      noBrowserPasswordExtraction: true
   330	    },
   331	    system: {
   332	      manufacturer: "Mock",
   333	      model: "DevPreview",
   334	      serialNumberMasked: "***0000",
   335	      osCaption: "Windows 11 Pro (mock)",
   336	      osVersion: "10.0.22631",
   337	      cpu: "Mock CPU",
   338	      memoryGb: 16
   339	    },
   340	    disks: [{ drive: "C:", sizeGb: 476.62, freeGb: 128.41 }],
   341	    diskHealth: [
   342	      {
   343	        friendlyName: "Mock NVMe",
   344	        mediaType: "SSD",
   345	        busType: "NVMe",
   346	        sizeGb: 476.62,
   347	        healthStatus: "Healthy",
   348	        operationalStatus: "OK"
   349	      }
   350	    ],
   351	    memoryPressure: {
   352	      totalMemoryMb: 16384,
   353	      freeMemoryMb: 6200,
   354	      freeMemoryPercent: 37.8,
   355	      pageFileTotalMb: 8192,
   356	      pageFileUsedMb: 1024,
   357	      pageFileUsagePercent: 12.5
   358	    },
   359	    windowsUpdate: {
   360	      installedHotfixCount: 24,
   361	      latestHotfixInstalledOn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
   362	      daysSinceLatestHotfix: 14
   363	    },
   364	    eventLog: { windowDays: 7, criticalCount: 0, errorCount: 3 },
   365	    driverAge: { totalWithDate: 42, olderThan2Years: 8, olderThan2YearsPercent: 19.0 },
   366	    startupPrograms: { count: 6, items: [] },
   367	    defender: {
   368	      antivirusEnabled: true,
   369	      realTimeProtectionEnabled: true,
   370	      antivirusSignatureAgeDays: 1,
   371	      lastQuickScanDaysAgo: 2,
   372	      lastFullScanDaysAgo: 12
   373	    },
   374	    storageWaste: {
   375	      userTempGb: 0.8,
   376	      localAppDataTempGb: 1.2,
   377	      windowsTempGb: 0.3,
   378	      windowsOldExists: false,
   379	      windowsOldGb: 0
   380	    },
   381	    userFolders: [
   382	      { name: "Desktop", path: "C:\\Users\\Ryan\\Desktop", exists: true, sizeGb: 0.42 },
   383	      { name: "Documents", path: "C:\\Users\\Ryan\\Documents", exists: true, sizeGb: 3.7 },
   384	      { name: "Downloads", path: "C:\\Users\\Ryan\\Downloads", exists: true, sizeGb: 12.1 }
   385	    ],
   386	    gpu: ["Mock GPU"],
   387	    installedApps: [
   388	      { name: "Chrome", version: "131.0", publisher: "Google" },
   389	      { name: "KakaoTalk", version: "3.x", publisher: "Kakao" }
   390	    ],
   391	    drivers: [],
   392	    printers: [],
   393	    wifiProfiles: ["home", "office"],
   394	    npkiCandidates: [
   395	      { path: "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI", exists: true },
   396	      { path: "C:\\NPKI", exists: false }
   397	    ],
   398	    bitlocker: [],
   399	    cloudSync: [
   400	      { provider: "OneDrive", path: "C:\\Users\\Ryan\\OneDrive", exists: true },
   401	      { provider: "Google Drive", path: "C:\\Users\\Ryan\\Google Drive", exists: false }
   402	    ],
   403	    browsers: [
   404	      { name: "Chrome", installed: true },
   405	      { name: "Edge", installed: true },
   406	      { name: "Firefox", installed: false },
   407	      { name: "Whale", installed: true }
   408	    ],
   409	    winget: { available: true, note: "winget is available." },
   410	    wingetExport: null,
   411	    diagnostics: [],
   412	    checklist: {
   413	      reviewNpkiManually: true,
   414	      exportWifiProfilesManually: true,
   415	      backupDesktopDocumentsDownloads: true,
   416	      verifyCloudSync: true,
   417	      saveReportBeforeFormat: true
   418	    }
   419	  };
   420	}
   421	
   422	export async function runBackupManifest(
   423	  options: RunBackupManifestOptions
   424	): Promise<RunBackupManifestResult> {
   425	  if (process.platform !== "win32") {
   426	    throw new Error("Backup manifest export is only available on Windows.");
   427	  }
   428	
   429	  const stagedPath = await verifyAndStageScript(options.scriptPath, {
   430	    enforce: !!options.enforceIntegrity
   431	  });
   432	  if (!stagedPath) {
   433	    throw new Error("PowerShell integrity check failed; refusing to spawn.");
   434	  }
   435	
   436	  const stagedDir = dirname(stagedPath);
   437	  const exe =
   438	    options.powershellExe ?? (process.platform === "win32" ? "powershell.exe" : "pwsh");
   439	  const maxFileSize = options.manifestMaxFileSizeBytes ?? 104_857_600;
   440	
   441	  try {
   442	    return await new Promise<RunBackupManifestResult>((resolveOk, rejectOk) => {
   443	      const child = spawn(
   444	        exe,
   445	        [
   446	          "-NoProfile",
   447	          "-NonInteractive",
   448	          "-ExecutionPolicy",
   449	          "Bypass",
   450	          "-File",
   451	          stagedPath,
   452	          "-OutputPath",
   453	          options.outputPath,
   454	          "-Mode",
   455	          "manifest",
   456	          "-ManifestMaxFileSizeBytes",
   457	          String(maxFileSize)
   458	        ],
   459	        { windowsHide: true }
   460	      );
   461	
   462	      let stderrBuf = "";
   463	
   464	      const cleanup = () => {
   465	        if (options.signal) options.signal.removeEventListener("abort", onAbort);
   466	      };
   467	
   468	      const onAbort = () => {
   469	        child.kill();
   470	        cleanup();
   471	        rejectOk(new DOMException("Manifest export cancelled", "AbortError"));
   472	      };
   473	
   474	      if (options.signal) {
   475	        if (options.signal.aborted) {
   476	          onAbort();
   477	          return;
   478	        }
   479	        options.signal.addEventListener("abort", onAbort, { once: true });
   480	      }
   481	
   482	      child.stderr.on("data", (chunk: Buffer) => {
   483	        stderrBuf += chunk.toString("utf8");
   484	        if (stderrBuf.length > STDERR_MAX_BYTES) {
   485	          stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
   486	        }
   487	      });
   488	
   489	      child.on("error", (err) => {
   490	        cleanup();
   491	        rejectOk(err);
   492	      });
   493	
   494	      child.on("close", async (code) => {
   495	        cleanup();
   496	        if (code !== 0) {
   497	          rejectOk(
   498	            new Error(`PowerShell exited with code ${code}. stderr: ${stderrBuf.slice(0, 500)}`)
   499	          );
   500	          return;
   501	        }
   502	        // PowerShell uses $ErrorActionPreference = "SilentlyContinue", so a
   503	        // failed Out-File can still leave exit code 0. Verify the file exists
   504	        // and is non-empty before reporting success.
   505	        try {
   506	          const stat = await fs.stat(options.outputPath);
   507	          if (!stat.isFile() || stat.size === 0) {
   508	            rejectOk(new Error("Manifest file was not written or is empty."));
   509	            return;
   510	          }
   511	          resolveOk({ saved: true, path: options.outputPath });
   512	        } catch (e) {
   513	          rejectOk(new Error(`Manifest file missing: ${(e as Error).message}`));
   514	        }
   515	      });
   516	    });
   517	  } finally {
   518	    await fs.unlink(stagedPath).catch(() => {});
   519	    await fs.rmdir(stagedDir).catch(() => {});
   520	  }
   521	}
   522	
   523	export const __testing = { PIPELINE_STEPS, TOTAL_STEPS, buildSteps, progressFor, verifyAndStageScript };

exec
/bin/zsh -lc "nl -ba src/renderer/src/pages/Report.tsx | sed -n '1,360p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	import { useCallback, useMemo, useState } from "react";
     2	import { Button } from "../components/Button";
     3	import { Lockup } from "../components/Lockup";
     4	import { copy } from "@shared/copy";
     5	import type { ScanResult } from "@shared/types";
     6	
     7	function severityClass(s: ScanResult["recommendation"]["severity"]): string {
     8	  switch (s) {
     9	    case "healthy":
    10	      return "fb-score-healthy";
    11	    case "watch":
    12	      return "fb-score-watch";
    13	    case "format-recommended":
    14	      return "fb-score-recommend";
    15	    case "format-required":
    16	      return "fb-score-required";
    17	  }
    18	}
    19	
    20	interface ReportProps {
    21	  result: ScanResult;
    22	  onBack: () => void;
    23	}
    24	
    25	interface RowProps {
    26	  label: string;
    27	  value: React.ReactNode;
    28	}
    29	
    30	function Row({ label, value }: RowProps) {
    31	  return (
    32	    <div className="fb-report-row">
    33	      <div className="fb-report-row-label">{label}</div>
    34	      <div className="fb-report-row-value">{value}</div>
    35	    </div>
    36	  );
    37	}
    38	
    39	function formatGb(value?: number | null) {
    40	  if (value == null) return "—";
    41	  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
    42	}
    43	
    44	export function Report({ result, onBack }: ReportProps) {
    45	  const { report, recommendation } = result;
    46	  const [exportStatus, setExportStatus] = useState<string | null>(null);
    47	  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
    48	  const [manifestRunning, setManifestRunning] = useState(false);
    49	
    50	  const installedCount = report.installedApps.length;
    51	  const driverCount = report.drivers.length;
    52	  const wifiCount = report.wifiProfiles.length;
    53	  const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
    54	  const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
    55	  const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
    56	  const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
    57	
    58	  const wingetPackageCount = useMemo(() => {
    59	    if (!report.wingetExport?.Sources) return 0;
    60	    return report.wingetExport.Sources.reduce(
    61	      (sum, src) => sum + (src.Packages?.length ?? 0),
    62	      0
    63	    );
    64	  }, [report.wingetExport]);
    65	
    66	  const onExport = useCallback(async () => {
    67	    if (!window.fb) return;
    68	    setExportStatus(null);
    69	    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
    70	    if (res.saved && res.path) setExportStatus(`저장했어요: ${res.path}`);
    71	    else setExportStatus("저장을 취소했어요.");
    72	  }, [report]);
    73	
    74	  const onOpenWeb = useCallback(async () => {
    75	    if (!window.fb) return;
    76	    await window.fb.openWebReport();
    77	  }, []);
    78	
    79	  const onExportManifest = useCallback(async () => {
    80	    if (!window.fb) return;
    81	    setManifestStatus(null);
    82	    setManifestRunning(true);
    83	    try {
    84	      const res = await window.fb.exportBackupManifest();
    85	      if (res.saved && res.path) {
    86	        setManifestStatus(`${copy.manifestExportSavedPrefix}${res.path}`);
    87	      } else if (res.message) {
    88	        setManifestStatus(`${copy.manifestExportErrorPrefix}${res.message}`);
    89	      } else {
    90	        setManifestStatus(copy.manifestExportCancelled);
    91	      }
    92	    } catch (e) {
    93	      const err = e as Error;
    94	      setManifestStatus(`${copy.manifestExportErrorPrefix}${err.message}`);
    95	    } finally {
    96	      setManifestRunning(false);
    97	    }
    98	  }, []);
    99	
   100	  return (
   101	    <main className="fb-report">
   102	      <header className="fb-report-header">
   103	        <Lockup markSize={36} kanjiSize={20} en={false} />
   104	        <div className="fb-report-actions">
   105	          <Button variant="ghost" size="sm" onClick={onBack}>
   106	            {copy.reportBackCta}
   107	          </Button>
   108	        </div>
   109	      </header>
   110	
   111	      <section className="fb-report-hero">
   112	        <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
   113	        <p className="fb-lede">{copy.reportLede}</p>
   114	      </section>
   115	
   116	      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
   117	        <div className="fb-score-card-head">
   118	          <div>
   119	            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
   120	            <div className="fb-score-card-value">
   121	              {recommendation.formatScore}
   122	              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
   123	            </div>
   124	            <div className="fb-score-card-headline">{recommendation.headline}</div>
   125	          </div>
   126	          <div className="fb-score-card-badge">
   127	            {copy.recommendSeverity[recommendation.severity]}
   128	          </div>
   129	        </div>
   130	        <p className="fb-score-card-summary">{recommendation.summary}</p>
   131	      </section>
   132	
   133	      <section className="fb-report-advice">
   134	        <article className="fb-card">
   135	          <h3>{copy.recommendTryFirstTitle}</h3>
   136	          <ul className="fb-advice-list">
   137	            {recommendation.tryFirst.map((a, i) => (
   138	              <li key={`tf-${i}`}>
   139	                <strong>{a.title}</strong>
   140	                <span>{a.description}</span>
   141	                {a.command && (
   142	                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
   143	                    {a.command}
   144	                  </code>
   145	                )}
   146	              </li>
   147	            ))}
   148	          </ul>
   149	        </article>
   150	
   151	        <article className="fb-card">
   152	          <h3>{copy.recommendFormatReasonsTitle}</h3>
   153	          {recommendation.formatReasons.length === 0 ? (
   154	            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
   155	          ) : (
   156	            <ul className="fb-advice-list">
   157	              {recommendation.formatReasons.map((r, i) => (
   158	                <li key={`fr-${i}`}>
   159	                  <strong>
   160	                    {r.label}{" "}
   161	                    <span className="fb-advice-weight">+{r.weightedScore.toFixed(1)}</span>
   162	                  </strong>
   163	                  <span>{r.description}</span>
   164	                </li>
   165	              ))}
   166	            </ul>
   167	          )}
   168	        </article>
   169	
   170	        <article className="fb-card">
   171	          <h3>{copy.recommendAfterFormatTitle}</h3>
   172	          <ul className="fb-advice-list">
   173	            {recommendation.afterFormat.map((a, i) => (
   174	              <li key={`af-${i}`}>
   175	                <strong>{a.title}</strong>
   176	                <span>{a.description}</span>
   177	                {a.command && (
   178	                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
   179	                    {a.command}
   180	                  </code>
   181	                )}
   182	              </li>
   183	            ))}
   184	          </ul>
   185	        </article>
   186	      </section>
   187	
   188	      <section className="fb-report-grid">
   189	        <article className="fb-card">
   190	          <h3>이 PC</h3>
   191	          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
   192	          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
   193	          <Row label="CPU" value={report.system.cpu ?? "—"} />
   194	          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
   195	        </article>
   196	
   197	        <article className="fb-card">
   198	          <h3>저장 공간</h3>
   199	          <Row label="총 용량" value={formatGb(totalDiskGb)} />
   200	          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
   201	          {report.disks.map((d) => (
   202	            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
   203	          ))}
   204	        </article>
   205	
   206	        <article className="fb-card">
   207	          <h3>같이 챙길 것</h3>
   208	          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
   209	          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
   210	          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
   211	          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
   212	        </article>
   213	
   214	        <article className="fb-card">
   215	          <h3>설치된 앱 / 드라이버</h3>
   216	          <Row label="설치된 앱" value={`${installedCount}개`} />
   217	          <Row label="드라이버" value={`${driverCount}개`} />
   218	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   219	          <Row label="프린터" value={`${report.printers.length}개`} />
   220	        </article>
   221	
   222	        <article className="fb-card">
   223	          <h3>사용자 폴더</h3>
   224	          {report.userFolders.map((f) => (
   225	            <Row key={f.name} label={f.name} value={formatGb(f.sizeGb)} />
   226	          ))}
   227	        </article>
   228	
   229	        <article className="fb-card">
   230	          <h3>{copy.wingetSectionTitle}</h3>
   231	          {report.winget.available ? (
   232	            <p className="fb-report-card-explain">
   233	              {copy.wingetSummary(wingetPackageCount)}
   234	            </p>
   235	          ) : (
   236	            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
   237	          )}
   238	          <Row label="winget" value={report.winget.available ? "사용 가능" : "사용 불가"} />
   239	          <Row label="가져온 패키지" value={`${wingetPackageCount}개`} />
   240	        </article>
   241	
   242	        <article className="fb-card fb-card-checklist">
   243	          <h3>포맷 전 체크리스트</h3>
   244	          <ul className="fb-report-checklist">
   245	            <li>공동인증서·Wi-Fi 프로필을 직접 옮겨주세요</li>
   246	            <li>Desktop·Documents·Downloads 백업</li>
   247	            <li>클라우드 동기화 완료 확인</li>
   248	            <li>리포트 JSON 저장 후 포맷</li>
   249	          </ul>
   250	        </article>
   251	      </section>
   252	
   253	      <section className="fb-report-manifest">
   254	        <h2 className="fb-h2">{copy.manifestSectionTitle}</h2>
   255	        <p className="fb-lede">{copy.manifestExplain}</p>
   256	        <div className="fb-report-cta">
   257	          <Button
   258	            variant="primary"
   259	            size="lg"
   260	            onClick={onExportManifest}
   261	            disabled={manifestRunning}
   262	          >
   263	            {manifestRunning ? copy.manifestExportInProgress : copy.manifestExportCta}
   264	          </Button>
   265	          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
   266	        </div>
   267	      </section>
   268	
   269	      <section className="fb-report-cta">
   270	        <Button variant="primary" size="lg" onClick={onExport}>
   271	          {copy.reportExportCta}
   272	        </Button>
   273	        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
   274	          {copy.reportOpenWebCta}
   275	        </Button>
   276	        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
   277	      </section>
   278	
   279	      <section className="fb-report-meta">
   280	        <small>리포트 생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
   281	        <small>schema {report.schemaVersion}</small>
   282	      </section>
   283	    </main>
   284	  );
   285	}

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '1,420p'" in /Users/ryanbak/claude/formatbuddy/desktop
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
    76	.fb-update-banner {
    77	  display: flex;
    78	  align-items: center;
    79	  gap: 10px;
    80	  padding: 10px 16px;
    81	  background: var(--color-fb-blue-tint);
    82	  color: var(--color-fb-blue-heavy);
    83	  border-top: 1px solid var(--color-fb-line);
    84	  font-size: 13px;
    85	  font-weight: 600;
    86	  letter-spacing: -0.01em;
    87	}
    88	.fb-update-banner-detail {
    89	  margin-left: auto;
    90	  font-size: 12px;
    91	  color: var(--color-fb-ink-3);
    92	  font-weight: 500;
    93	  font-feature-settings: "tnum" on;
    94	}
    95	.fb-update-banner-quiet {
    96	  background: #ffffff;
    97	  color: var(--color-fb-ink-2);
    98	}
    99	.fb-update-banner-ready {
   100	  background: var(--color-fb-blue);
   101	  color: #ffffff;
   102	}
   103	.fb-update-banner-ready .fb-update-banner-detail { color: rgba(255,255,255,0.7); }
   104	.fb-update-banner-ready .fb-btn-on-blue { margin-left: auto; }
   105	
   106	/* ============================================================
   107	   Typography helpers
   108	   ============================================================ */
   109	.fb-h1 {
   110	  font-size: 44px;
   111	  line-height: 1.1;
   112	  font-weight: 800;
   113	  letter-spacing: -0.045em;
   114	  margin: 0 0 20px;
   115	  color: var(--color-fb-ink-1);
   116	}
   117	.fb-h1 em { font-style: normal; color: var(--color-fb-blue); }
   118	.fb-h1-sm {
   119	  font-size: 32px;
   120	  line-height: 1.15;
   121	  font-weight: 800;
   122	  letter-spacing: -0.04em;
   123	  margin: 0 0 12px;
   124	  color: var(--color-fb-ink-1);
   125	}
   126	.fb-h2 {
   127	  font-size: 22px;
   128	  font-weight: 800;
   129	  letter-spacing: -0.025em;
   130	  color: var(--color-fb-ink-1);
   131	  margin: 0 0 16px;
   132	}
   133	.fb-lede {
   134	  font-size: 15px;
   135	  line-height: 24px;
   136	  color: var(--color-fb-ink-2);
   137	  font-weight: 500;
   138	  letter-spacing: -0.012em;
   139	  margin: 0 0 24px;
   140	  max-width: 520px;
   141	}
   142	
   143	/* ============================================================
   144	   Button
   145	   ============================================================ */
   146	.fb-btn {
   147	  display: inline-flex;
   148	  align-items: center;
   149	  justify-content: center;
   150	  gap: 8px;
   151	  font-weight: 700;
   152	  letter-spacing: -0.015em;
   153	  border: 1px solid transparent;
   154	  border-radius: 12px;
   155	  cursor: pointer;
   156	  white-space: nowrap;
   157	  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
   158	  user-select: none;
   159	}
   160	.fb-btn:focus-visible {
   161	  outline: 2px solid color-mix(in srgb, var(--color-fb-blue) 40%, transparent);
   162	  outline-offset: 2px;
   163	}
   164	.fb-btn-lg { height: 52px; padding: 0 26px; font-size: 16px; }
   165	.fb-btn-md { height: 42px; padding: 0 18px; font-size: 14px; }
   166	.fb-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 10px; }
   167	.fb-btn-full { width: 100%; }
   168	
   169	.fb-btn-primary { background: var(--color-fb-blue); color: #fff; }
   170	.fb-btn-primary:hover { background: var(--color-fb-blue-strong); }
   171	.fb-btn-primary:active { transform: scale(0.98); }
   172	
   173	.fb-btn-secondary { background: #fff; color: var(--color-fb-ink-1); border-color: var(--color-fb-line); }
   174	.fb-btn-secondary:hover { background: #f7f7f8; }
   175	
   176	.fb-btn-ghost { background: transparent; color: var(--color-fb-ink-2); }
   177	.fb-btn-ghost:hover { color: var(--color-fb-ink-1); background: #f7f7f8; }
   178	
   179	.fb-btn-on-blue { background: #fff; color: var(--color-fb-blue); }
   180	.fb-btn-on-blue:hover { background: #f7f7f8; }
   181	
   182	/* ============================================================
   183	   Cloud-Buddy motion (from design styles.css)
   184	   ============================================================ */
   185	.cb-eye { transform-box: fill-box; transform-origin: center; }
   186	.cb-animated .cb-eye-l { animation: cb-wink 4.6s ease-in-out infinite; }
   187	@keyframes cb-wink {
   188	  0%, 92%, 100% { transform: scaleY(1); }
   189	  94%, 96% { transform: scaleY(0.08); }
   190	}
   191	
   192	.cb-pulse-wrap {
   193	  transform-box: fill-box;
   194	  transform-origin: center;
   195	  opacity: 0;
   196	  animation: cb-pulse 2.4s ease-out infinite;
   197	  pointer-events: none;
   198	}
   199	.cb-pulse-2 { animation-delay: -1.2s; }
   200	@keyframes cb-pulse {
   201	  0% { transform: scale(0.55); opacity: 0.55; }
   202	  80% { opacity: 0.05; }
   203	  100% { transform: scale(1.75); opacity: 0; }
   204	}
   205	
   206	.cb-animated .cb-antenna-dot {
   207	  transform-box: fill-box;
   208	  transform-origin: center;
   209	  animation: cb-charge 1.4s ease-in-out infinite;
   210	}
   211	@keyframes cb-charge {
   212	  0%, 100% { transform: scale(1); }
   213	  50% { transform: scale(1.18); }
   214	}
   215	
   216	.cb-spark {
   217	  transform-box: fill-box;
   218	  transform-origin: center;
   219	  opacity: 0;
   220	  animation: cb-spark 1.4s ease-out infinite;
   221	  pointer-events: none;
   222	}
   223	.cb-spark-2 { animation-delay: -0.7s; }
   224	@keyframes cb-spark {
   225	  0% { transform: scale(0.6); opacity: 0.55; }
   226	  100% { transform: scale(2.2); opacity: 0; }
   227	}
   228	
   229	.fb-spin { animation: fb-spin 0.8s linear infinite; }
   230	@keyframes fb-spin { to { transform: rotate(360deg); } }
   231	
   232	@media (prefers-reduced-motion: reduce) {
   233	  .cb-animated .cb-eye-l,
   234	  .cb-animated .cb-antenna-dot,
   235	  .cb-pulse-wrap,
   236	  .cb-spark,
   237	  .fb-spin { animation: none !important; }
   238	  .cb-pulse-wrap, .cb-spark { opacity: 0 !important; }
   239	}
   240	
   241	/* ============================================================
   242	   Home
   243	   ============================================================ */
   244	.fb-home {
   245	  flex: 1;
   246	  display: flex;
   247	  flex-direction: column;
   248	  padding: 24px 40px 40px;
   249	  gap: 32px;
   250	  max-width: 1080px;
   251	  margin: 0 auto;
   252	  width: 100%;
   253	}
   254	.fb-home-header {
   255	  display: flex;
   256	  justify-content: space-between;
   257	  align-items: center;
   258	}
   259	.fb-home-pill {
   260	  display: inline-flex;
   261	  align-items: center;
   262	  gap: 8px;
   263	  height: 32px;
   264	  padding: 0 14px 0 12px;
   265	  background: var(--color-fb-blue-tint);
   266	  color: var(--color-fb-blue-heavy);
   267	  border-radius: 9999px;
   268	  font-size: 12px;
   269	  font-weight: 700;
   270	  letter-spacing: -0.01em;
   271	}
   272	.fb-home-pill-dot {
   273	  width: 6px; height: 6px;
   274	  border-radius: 9999px;
   275	  background: var(--color-fb-blue);
   276	}
   277	
   278	.fb-home-hero {
   279	  display: grid;
   280	  grid-template-columns: 1.4fr 1fr;
   281	  gap: 48px;
   282	  align-items: center;
   283	  padding: 32px 0 8px;
   284	}
   285	.fb-home-hero-copy { display: flex; flex-direction: column; }
   286	.fb-home-hero-mark {
   287	  display: flex;
   288	  justify-content: center;
   289	  align-items: center;
   290	}
   291	.fb-home-cta { display: flex; gap: 10px; margin-top: 8px; }
   292	
   293	.fb-home-privacy {
   294	  background: var(--color-fb-blue-tint);
   295	  border-radius: 20px;
   296	  padding: 28px 32px;
   297	}
   298	.fb-home-bullets {
   299	  margin: 0;
   300	  padding-left: 18px;
   301	  color: var(--color-fb-ink-2);
   302	  font-size: 14px;
   303	  line-height: 22px;
   304	  font-weight: 500;
   305	}
   306	.fb-home-bullets li { margin: 0 0 6px; }
   307	
   308	/* ============================================================
   309	   Scanning
   310	   ============================================================ */
   311	.fb-scanning {
   312	  flex: 1;
   313	  display: flex;
   314	  flex-direction: column;
   315	  justify-content: center;
   316	  align-items: center;
   317	  padding: 40px;
   318	}
   319	.fb-scanning-wrap {
   320	  width: 100%;
   321	  max-width: 520px;
   322	  display: flex;
   323	  flex-direction: column;
   324	  gap: 20px;
   325	}
   326	.fb-scanning-actions {
   327	  display: flex;
   328	  gap: 8px;
   329	  justify-content: flex-end;
   330	}
   331	.fb-scanning-error {
   332	  background: #ffffff;
   333	  border: 1px solid var(--color-fb-line);
   334	  color: var(--color-fb-ink-1);
   335	  border-radius: 12px;
   336	  padding: 14px 16px;
   337	  font-size: 13px;
   338	}
   339	.fb-scanning-error strong {
   340	  display: block;
   341	  margin-bottom: 4px;
   342	  color: var(--color-fb-blue-heavy);
   343	}
   344	.fb-scanning-error p {
   345	  margin: 0;
   346	  word-break: break-word;
   347	  color: var(--color-fb-ink-2);
   348	}
   349	
   350	/* ============================================================
   351	   ScanCard
   352	   ============================================================ */
   353	.scan-card {
   354	  background: #ffffff;
   355	  border-radius: 24px;
   356	  border: 1px solid var(--color-fb-line-t);
   357	  box-shadow: 0 1px 6px rgb(23 23 25 / 0.06), 0 12px 32px rgb(23 23 25 / 0.10);
   358	  padding: 28px;
   359	  display: flex;
   360	  flex-direction: column;
   361	  gap: 22px;
   362	}
   363	.scan-card-head {
   364	  display: flex;
   365	  align-items: center;
   366	  justify-content: space-between;
   367	}
   368	.scan-card-who { display: flex; align-items: center; gap: 10px; }
   369	.scan-card-who-meta { display: flex; flex-direction: column; gap: 2px; }
   370	.scan-card-title { font-size: 14px; font-weight: 700; color: var(--color-fb-ink-1); }
   371	.scan-card-elapsed { font-size: 12px; font-weight: 500; color: var(--color-fb-ink-3); }
   372	.scan-card-live {
   373	  display: flex;
   374	  align-items: center;
   375	  gap: 6px;
   376	  font-size: 12px;
   377	  font-weight: 600;
   378	  color: var(--color-fb-positive);
   379	}
   380	.scan-card-live-dot {
   381	  width: 7px; height: 7px;
   382	  border-radius: 9999px;
   383	  background: var(--color-fb-positive);
   384	}
   385	
   386	.scan-score {
   387	  background: var(--color-fb-blue-tint);
   388	  border-radius: 20px;
   389	  padding: 22px 24px;
   390	  display: grid;
   391	  grid-template-columns: 1fr auto;
   392	  gap: 16px;
   393	  align-items: center;
   394	}
   395	.scan-score-label {
   396	  font-size: 12px;
   397	  font-weight: 700;
   398	  letter-spacing: 0.04em;
   399	  color: var(--color-fb-blue-heavy);
   400	  margin-bottom: 4px;
   401	}
   402	.scan-score-value {
   403	  font-size: 56px;
   404	  font-weight: 800;
   405	  letter-spacing: -0.045em;
   406	  color: var(--color-fb-ink-1);
   407	  line-height: 1;
   408	  font-feature-settings: "tnum" on;
   409	}
   410	.scan-score-unit {
   411	  font-size: 24px;
   412	  font-weight: 700;
   413	  margin-left: 2px;
   414	  letter-spacing: -0.02em;
   415	  color: var(--color-fb-ink-2);
   416	}
   417	.scan-score-sub {
   418	  font-size: 12px;
   419	  color: var(--color-fb-ink-3);
   420	  font-weight: 500;

exec
/bin/zsh -lc "nl -ba src/renderer/src/styles/globals.css | sed -n '420,860p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
   420	  font-weight: 500;
   421	  margin-top: 8px;
   422	}
   423	
   424	.scan-steps { display: flex; flex-direction: column; gap: 6px; }
   425	.scan-step {
   426	  display: grid;
   427	  grid-template-columns: 32px 1fr auto;
   428	  align-items: center;
   429	  gap: 12px;
   430	  padding: 12px 14px;
   431	  border-radius: 12px;
   432	  background: #ffffff;
   433	  border: 1px solid var(--color-fb-line-t);
   434	}
   435	.scan-step.active {
   436	  background: var(--color-fb-blue-tint);
   437	  border-color: rgba(0,102,255,0.22);
   438	}
   439	.scan-step-idx {
   440	  width: 24px; height: 24px;
   441	  border-radius: 9999px;
   442	  background: var(--color-fb-blue-tint);
   443	  color: var(--color-fb-blue);
   444	  font-size: 12px;
   445	  font-weight: 800;
   446	  display: flex; align-items: center; justify-content: center;
   447	  font-feature-settings: "tnum" on;
   448	}
   449	.scan-step.done .scan-step-idx { background: var(--color-fb-blue); color: #ffffff; }
   450	.scan-step.pending .scan-step-idx { background: #f4f4f5; color: var(--color-fb-ink-3); }
   451	.scan-step-name { font-size: 14px; font-weight: 600; color: var(--color-fb-ink-1); }
   452	.scan-step-state {
   453	  font-size: 12px;
   454	  font-weight: 600;
   455	  letter-spacing: -0.01em;
   456	  color: var(--color-fb-ink-3);
   457	  display: flex; align-items: center; gap: 4px;
   458	}
   459	.scan-step.done .scan-step-state { color: var(--color-fb-positive); }
   460	.scan-step.active .scan-step-state { color: var(--color-fb-blue); }
   461	
   462	/* ============================================================
   463	   Report
   464	   ============================================================ */
   465	.fb-report {
   466	  flex: 1;
   467	  display: flex;
   468	  flex-direction: column;
   469	  padding: 24px 40px 40px;
   470	  gap: 24px;
   471	  max-width: 1080px;
   472	  margin: 0 auto;
   473	  width: 100%;
   474	}
   475	.fb-report-header {
   476	  display: flex;
   477	  justify-content: space-between;
   478	  align-items: center;
   479	}
   480	.fb-report-actions { display: flex; gap: 8px; }
   481	.fb-report-hero { padding: 8px 0 0; }
   482	
   483	.fb-report-grid {
   484	  display: grid;
   485	  grid-template-columns: repeat(2, 1fr);
   486	  gap: 16px;
   487	}
   488	.fb-card {
   489	  background: #ffffff;
   490	  border: 1px solid var(--color-fb-line);
   491	  border-radius: 20px;
   492	  padding: 22px 24px;
   493	  display: flex;
   494	  flex-direction: column;
   495	  gap: 6px;
   496	}
   497	.fb-card h3 {
   498	  margin: 0 0 8px;
   499	  font-size: 15px;
   500	  font-weight: 800;
   501	  letter-spacing: -0.02em;
   502	  color: var(--color-fb-ink-1);
   503	}
   504	.fb-card-checklist { grid-column: span 2; }
   505	
   506	.fb-report-row {
   507	  display: grid;
   508	  grid-template-columns: 110px 1fr;
   509	  gap: 12px;
   510	  padding: 6px 0;
   511	  border-bottom: 1px dashed var(--color-fb-line-t);
   512	  font-size: 13px;
   513	}
   514	.fb-report-row:last-child { border-bottom: none; }
   515	.fb-report-row-label { color: var(--color-fb-ink-3); font-weight: 600; }
   516	.fb-report-row-value { color: var(--color-fb-ink-1); font-weight: 500; }
   517	
   518	.fb-report-checklist {
   519	  margin: 0;
   520	  padding-left: 18px;
   521	  color: var(--color-fb-ink-2);
   522	  font-size: 14px;
   523	  line-height: 22px;
   524	  font-weight: 500;
   525	}
   526	
   527	.fb-report-cta {
   528	  display: flex;
   529	  gap: 10px;
   530	  align-items: center;
   531	  flex-wrap: wrap;
   532	}
   533	.fb-report-cta-status {
   534	  flex-basis: 100%;
   535	  font-size: 12px;
   536	  color: var(--color-fb-ink-3);
   537	  margin: 4px 0 0;
   538	}
   539	
   540	.fb-report-meta {
   541	  display: flex;
   542	  justify-content: space-between;
   543	  color: var(--color-fb-ink-3);
   544	  font-size: 11px;
   545	}
   546	
   547	.fb-report-card-explain {
   548	  font-size: 13px;
   549	  line-height: 20px;
   550	  color: var(--color-fb-ink-2);
   551	  margin: 0 0 12px;
   552	  font-weight: 500;
   553	}
   554	
   555	.fb-report-manifest {
   556	  margin-top: 8px;
   557	  padding: 24px;
   558	  background: var(--color-fb-blue-tint);
   559	  border-radius: 20px;
   560	}
   561	.fb-report-manifest .fb-h2 {
   562	  margin-top: 0;
   563	}
   564	
   565	/* ============================================================
   566	   Recommendation score card
   567	   ============================================================ */
   568	.fb-score-card {
   569	  border-radius: 24px;
   570	  padding: 28px 32px;
   571	  background: var(--color-fb-blue-tint);
   572	  display: flex;
   573	  flex-direction: column;
   574	  gap: 14px;
   575	}
   576	.fb-score-card-head {
   577	  display: flex;
   578	  align-items: flex-start;
   579	  justify-content: space-between;
   580	  gap: 24px;
   581	}
   582	.fb-score-card-label {
   583	  font-size: 12px;
   584	  font-weight: 700;
   585	  letter-spacing: 0.04em;
   586	  color: var(--color-fb-blue-heavy);
   587	  margin-bottom: 4px;
   588	}
   589	.fb-score-card-value {
   590	  font-size: 64px;
   591	  font-weight: 800;
   592	  letter-spacing: -0.045em;
   593	  color: var(--color-fb-ink-1);
   594	  line-height: 1;
   595	  font-feature-settings: "tnum" on;
   596	}
   597	.fb-score-card-unit {
   598	  font-size: 24px;
   599	  font-weight: 700;
   600	  margin-left: 4px;
   601	  letter-spacing: -0.02em;
   602	  color: var(--color-fb-ink-2);
   603	}
   604	.fb-score-card-headline {
   605	  margin-top: 8px;
   606	  font-size: 14px;
   607	  font-weight: 700;
   608	  color: var(--color-fb-ink-1);
   609	  letter-spacing: -0.012em;
   610	}
   611	.fb-score-card-summary {
   612	  margin: 0;
   613	  font-size: 14px;
   614	  line-height: 22px;
   615	  color: var(--color-fb-ink-2);
   616	  font-weight: 500;
   617	}
   618	.fb-score-card-badge {
   619	  align-self: flex-start;
   620	  background: var(--color-fb-blue);
   621	  color: #ffffff;
   622	  font-size: 12px;
   623	  font-weight: 700;
   624	  letter-spacing: -0.01em;
   625	  padding: 6px 12px;
   626	  border-radius: 9999px;
   627	  white-space: nowrap;
   628	}
   629	/* Severity tint variants — stays within white + blue token family */
   630	.fb-score-healthy .fb-score-card-badge { background: var(--color-fb-positive); }
   631	.fb-score-watch   .fb-score-card-badge { background: var(--color-fb-blue); }
   632	.fb-score-recommend .fb-score-card-badge { background: var(--color-fb-blue-heavy); }
   633	.fb-score-required .fb-score-card-badge { background: var(--color-fb-ink-1); }
   634	
   635	/* ============================================================
   636	   Advice cards (try-first / reasons / after-format)
   637	   ============================================================ */
   638	.fb-report-advice {
   639	  display: grid;
   640	  grid-template-columns: repeat(2, 1fr);
   641	  gap: 16px;
   642	  margin-top: 8px;
   643	}
   644	.fb-report-advice .fb-card:nth-child(1) { grid-column: span 2; }
   645	.fb-advice-list {
   646	  list-style: none;
   647	  margin: 0;
   648	  padding: 0;
   649	  display: flex;
   650	  flex-direction: column;
   651	  gap: 12px;
   652	}
   653	.fb-advice-list li {
   654	  display: flex;
   655	  flex-direction: column;
   656	  gap: 4px;
   657	  padding: 12px 14px;
   658	  background: var(--color-fb-bg);
   659	  border: 1px solid var(--color-fb-line);
   660	  border-radius: 12px;
   661	}
   662	.fb-advice-list strong {
   663	  font-size: 14px;
   664	  font-weight: 700;
   665	  color: var(--color-fb-ink-1);
   666	  letter-spacing: -0.012em;
   667	}
   668	.fb-advice-list span {
   669	  font-size: 13px;
   670	  line-height: 20px;
   671	  color: var(--color-fb-ink-2);
   672	  font-weight: 500;
   673	}
   674	.fb-advice-cmd {
   675	  margin-top: 6px;
   676	  display: inline-block;
   677	  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
   678	  font-size: 12px;
   679	  font-weight: 600;
   680	  color: var(--color-fb-blue-heavy);
   681	  background: var(--color-fb-blue-tint);
   682	  padding: 4px 8px;
   683	  border-radius: 6px;
   684	  user-select: text;
   685	  word-break: break-all;
   686	}
   687	.fb-advice-weight {
   688	  font-size: 11px;
   689	  font-weight: 600;
   690	  color: var(--color-fb-blue-heavy);
   691	  background: var(--color-fb-blue-tint);
   692	  padding: 2px 8px;
   693	  border-radius: 9999px;
   694	  margin-left: 6px;
   695	  font-feature-settings: "tnum" on;
   696	  vertical-align: middle;
   697	}

exec
/bin/zsh -lc "cat package.json && printf '\\n--- tsconfig ---\\n' && ls && find . -maxdepth 3 -name 'tsconfig*.json' -print -exec cat {} \\;" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 241ms:
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
		"maxNodeModuleJsDepth": 0,
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/set-function-name/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "es2022",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                                  /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */

    /* JavaScript Support */
    "allowJs": true,                                    /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                    /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 1,                          /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    // "emitDeclarationOnly": true,                      /* Only output d.ts files and not JavaScript files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */
    "noImplicitAny": true,                               /* Enable error reporting for expressions and declarations with an implied 'any' type. */
    "noImplicitThis": true,                              /* Enable error reporting when 'this' is given the type 'any'. */
    "useUnknownInCatchVariables": true,                  /* Default catch clause variables as 'unknown' instead of 'any'. */
    "noUnusedLocals": true,                              /* Enable error reporting when local variables aren't read. */
    "noUnusedParameters": true,                          /* Raise an error when a function parameter isn't read. */
    "noImplicitReturns": true,                           /* Enable error reporting for codepaths that do not explicitly return in a function. */
    "noFallthroughCasesInSwitch": true,                  /* Enable error reporting for fallthrough cases in switch statements. */
    "noUncheckedIndexedAccess": true,                    /* Add 'undefined' to a type when accessed using an index. */
    "noImplicitOverride": true,                          /* Ensure overriding members in derived classes are marked with an override modifier. */
    // "noPropertyAccessFromIndexSignature": true,       /* Enforces using indexed accessors for keys declared using an indexed type. */

    /* Completeness */
    // "skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/dunder-proto/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/hasown/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "exclude": [
    "coverage",
  ],
}
./node_modules/side-channel-weakmap/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/data-view-buffer/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",																	/* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
	},
	"exclude": [
		"coverage",
		"test/list-exports"
	],
}
./node_modules/typed-array-byte-length/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/unbox-primitive/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"exclude": [
		"coverage",
	],
}
./node_modules/is-shared-array-buffer/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/typed-array-byte-offset/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
		"maxNodeModuleJsDepth": 0,
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/array-buffer-byte-length/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ES2021",
  },
  "exclude": [
    "coverage",
  ],
}
./node_modules/has-symbols/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
		"maxNodeModuleJsDepth": 0,
	},
	"exclude": [
		"coverage"
	]
}
./node_modules/internal-slot/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		//"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/set-proto/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		//"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/which-builtin-type/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ES2021",
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/safe-array-concat/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "es2021",
  },
  "exclude": [
    "coverage",
  ],
}
./node_modules/is-finalizationregistry/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ES2021",
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/is-weakset/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/is-map/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "ESNext",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                              /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */
    // "allowArbitraryExtensions": true,                 /* Enable importing files with any extension, provided a declaration file is present. */

    /* JavaScript Support */
    "allowJs": true,                                     /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                     /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 0,                           /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */

    /* Completeness */
    //"skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/stop-iteration-iterator/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"exclude": [
		"coverage",
	],
}./node_modules/boolean/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "declaration": true,
    "esModuleInterop": true,
    "lib": [ "esnext" ],
    "module": "commonjs",
    "outDir": "build",
    "resolveJsonModule": true,
    "strict": true,
    "target": "es2019"
  },
  "include": [
    "./**/*.ts"
  ],
  "exclude": [
    "./build"
  ]
}
./node_modules/has-bigints/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ES2021",
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/side-channel/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/set-function-length/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/es-shim-unscopables/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
		"test/list-exports"
	],
}
./node_modules/safe-regex-test/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		// "target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}./node_modules/get-symbol-description/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/get-proto/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		//"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/generator-function/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/is-data-view/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/is-boolean-object/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage"
	]
}
./node_modules/which-collection/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "ESNext",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                              /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */
    // "allowArbitraryExtensions": true,                 /* Enable importing files with any extension, provided a declaration file is present. */

    /* JavaScript Support */
    "allowJs": true,                                     /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                     /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 0,                           /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */

    /* Completeness */
    //"skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/is-regex/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "ES2021",
	},
	"exclude": [
		"coverage"
	]
}
./node_modules/gopd/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/safe-push-apply/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "es2021",
  },
  "exclude": [
    "coverage",
  ],
}
./node_modules/for-each/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/which-typed-array/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/is-weakmap/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "ESNext",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                              /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */
    // "allowArbitraryExtensions": true,                 /* Enable importing files with any extension, provided a declaration file is present. */

    /* JavaScript Support */
    "allowJs": true,                                     /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                     /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 0,                           /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */

    /* Completeness */
    //"skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/data-view-byte-length/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",																	/* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/is-set/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "ESNext",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                              /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */
    // "allowArbitraryExtensions": true,                 /* Enable importing files with any extension, provided a declaration file is present. */

    /* JavaScript Support */
    "allowJs": true,                                     /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                     /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 0,                           /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */

    /* Completeness */
    //"skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/available-typed-arrays/tsconfig.json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig to read more about this file */

    /* Projects */

    /* Language and Environment */
    "target": "es2016",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    "useDefineForClassFields": true,                     /* Emit ECMAScript-standard-compliant class fields. */
    // "moduleDetection": "auto",                        /* Control what method is used to detect module-format JS files. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    // "rootDir": "./",                                  /* Specify the root folder within your source files. */
    // "moduleResolution": "node10",                     /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    "typeRoots": ["types"],                              /* Specify multiple folders that act like './node_modules/@types'. */
    "resolveJsonModule": true,                           /* Enable importing .json files. */
    // "allowArbitraryExtensions": true,                 /* Enable importing files with any extension, provided a declaration file is present. */

    /* JavaScript Support */
    "allowJs": true,                                     /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    "checkJs": true,                                     /* Enable error reporting in type-checked JavaScript files. */
    "maxNodeModuleJsDepth": 1,                           /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    "noEmit": true,                                      /* Disable emitting files from a compilation. */

    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */

    /* Completeness */
    //"skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/es-set-tostringtag/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/is-string/tsconfig.json
{
  "extends": "@ljharb/tsconfig",
  "compilerOptions": {
    "target": "ES2021",
  },
  "exclude": [
    "coverage"
  ]
}
./node_modules/side-channel-map/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/typed-array-buffer/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es2021",
	},
	"exclude": [
		"coverage",
	],
}
./node_modules/es-object-atoms/tsconfig.json
{
	"extends": "@ljharb/tsconfig",
	"compilerOptions": {
		"target": "es5",
	},
}
./tsconfig.web.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "composite": true,
    "outDir": "out/types-web",
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": [
    "src/renderer/src/**/*.ts",
    "src/renderer/src/**/*.tsx",
    "src/shared/**/*.ts",
    "src/preload/index.d.ts"
  ]
}
./tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}

exec
/bin/zsh -lc "grep -R \"ScanResult\\|recommendation\\|runScan\\|setResult\" -n src tests --exclude-dir=node_modules | sed -n '1,240p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 278ms:
src/renderer/src/App.tsx:6:import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
src/renderer/src/App.tsx:11:  | { kind: "report"; result: ScanResult }
src/renderer/src/pages/Report.tsx:5:import type { ScanResult } from "@shared/types";
src/renderer/src/pages/Report.tsx:7:function severityClass(s: ScanResult["recommendation"]["severity"]): string {
src/renderer/src/pages/Report.tsx:21:  result: ScanResult;
src/renderer/src/pages/Report.tsx:45:  const { report, recommendation } = result;
src/renderer/src/pages/Report.tsx:116:      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
src/renderer/src/pages/Report.tsx:121:              {recommendation.formatScore}
src/renderer/src/pages/Report.tsx:124:            <div className="fb-score-card-headline">{recommendation.headline}</div>
src/renderer/src/pages/Report.tsx:127:            {copy.recommendSeverity[recommendation.severity]}
src/renderer/src/pages/Report.tsx:130:        <p className="fb-score-card-summary">{recommendation.summary}</p>
src/renderer/src/pages/Report.tsx:137:            {recommendation.tryFirst.map((a, i) => (
src/renderer/src/pages/Report.tsx:153:          {recommendation.formatReasons.length === 0 ? (
src/renderer/src/pages/Report.tsx:157:              {recommendation.formatReasons.map((r, i) => (
src/renderer/src/pages/Report.tsx:173:            {recommendation.afterFormat.map((a, i) => (
src/shared/types.ts:246:export interface ScanResult {
src/shared/types.ts:248:  recommendation: Recommendation;
src/main/index.ts:12:  ScanResult
src/main/index.ts:14:import { runBackupManifest, runScan } from "./scanner";
src/main/index.ts:80:      const result: ScanResult = await runScan({
src/main/scanner.ts:6:import type { ScanProgress, ScanReport, ScanResult, ScanStepView } from "@shared/types";
src/main/scanner.ts:60:  //     re-throwing, otherwise runScan's finally never learns the path
src/main/scanner.ts:167:export async function runScan(options: RunScanOptions): Promise<ScanResult> {
src/main/scanner.ts:220:async function runMockScan(args: InternalRunArgs): Promise<ScanResult> {
src/main/scanner.ts:234:  return { report, recommendation: generateRecommendation(report), jsonPath: outPath };
src/main/scanner.ts:242:function runPowershellScan(args: PowershellRunArgs): Promise<ScanResult> {
src/main/scanner.ts:246:  return new Promise<ScanResult>((resolveScan, rejectScan) => {
src/main/scanner.ts:308:        resolveScan({ report, recommendation: generateRecommendation(report), jsonPath: outPath });
src/preload/index.ts:10:  ScanResult,
src/preload/index.ts:17:type CompleteListener = (result: ScanResult) => void;
src/preload/index.ts:27:  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
src/preload/index.ts:36:    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
tests/scanner.test.ts:6:import { runScan, __testing } from "../src/main/scanner";
tests/scanner.test.ts:28:  it("runScan(mock) emits progress, completes, writes JSON", async () => {
tests/scanner.test.ts:32:      const res = await runScan({
tests/scanner.test.ts:49:  it("runScan(mock) cancels on abort", async () => {
tests/scanner.test.ts:53:      const p = runScan({

exec
/bin/zsh -lc "nl -ba src/main/index.ts | sed -n '1,180p'
printf '\\n--- preload ---\\n'
nl -ba src/preload/index.ts | sed -n '1,120p'
printf '\\n--- App ---\\n'
nl -ba src/renderer/src/App.tsx | sed -n '1,160p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
     1	import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
     2	import { electronApp, optimizer } from "@electron-toolkit/utils";
     3	import { join } from "node:path";
     4	import { promises as fs } from "node:fs";
     5	import { IpcChannels } from "@shared/ipc";
     6	import type {
     7	  ExportOptions,
     8	  ExportResult,
     9	  ManifestExportResult,
    10	  ScanError,
    11	  ScanProgress,
    12	  ScanResult
    13	} from "@shared/types";
    14	import { runBackupManifest, runScan } from "./scanner";
    15	import { getDefaultExportPath, getScanOutputDir, getScanScriptPath, getWebReportImportUrl } from "./paths";
    16	import { initAutoUpdater, installAndRestart, shutdownAutoUpdater } from "./updater";
    17	
    18	let mainWindow: BrowserWindow | null = null;
    19	let activeAbort: AbortController | null = null;
    20	
    21	const DEV_RENDERER_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
    22	
    23	function createWindow() {
    24	  mainWindow = new BrowserWindow({
    25	    width: 1080,
    26	    height: 760,
    27	    minWidth: 880,
    28	    minHeight: 640,
    29	    show: false,
    30	    autoHideMenuBar: true,
    31	    backgroundColor: "#FFFFFF",
    32	    title: "FormatBuddy",
    33	    webPreferences: {
    34	      preload: join(__dirname, "..", "preload", "index.js"),
    35	      contextIsolation: true,
    36	      nodeIntegration: false,
    37	      sandbox: true
    38	    }
    39	  });
    40	
    41	  mainWindow.on("ready-to-show", () => {
    42	    mainWindow?.show();
    43	  });
    44	
    45	  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    46	    try {
    47	      const parsed = new URL(url);
    48	      if (parsed.protocol === "https:") {
    49	        void shell.openExternal(url);
    50	      }
    51	    } catch {
    52	      // ignore malformed URLs
    53	    }
    54	    return { action: "deny" };
    55	  });
    56	
    57	  const devUrl = process.env.ELECTRON_RENDERER_URL;
    58	  if (!app.isPackaged && devUrl && DEV_RENDERER_PATTERN.test(devUrl)) {
    59	    void mainWindow.loadURL(devUrl);
    60	  } else {
    61	    void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
    62	  }
    63	}
    64	
    65	function registerIpc() {
    66	  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());
    67	
    68	  ipcMain.handle(IpcChannels.scanStart, async (event) => {
    69	    if (activeAbort) activeAbort.abort();
    70	    const controller = new AbortController();
    71	    activeAbort = controller;
    72	    const sender = event.sender;
    73	
    74	    const emit = (progress: ScanProgress) => {
    75	      if (sender.isDestroyed() || controller.signal.aborted) return;
    76	      sender.send(IpcChannels.scanProgress, progress);
    77	    };
    78	
    79	    try {
    80	      const result: ScanResult = await runScan({
    81	        scriptPath: getScanScriptPath(),
    82	        outputDir: getScanOutputDir(),
    83	        signal: controller.signal,
    84	        onProgress: emit,
    85	        enforceIntegrity: app.isPackaged
    86	      });
    87	      if (!sender.isDestroyed() && !controller.signal.aborted) {
    88	        sender.send(IpcChannels.scanComplete, result);
    89	      }
    90	      return result;
    91	    } catch (err) {
    92	      const e = err as Error;
    93	      const isAbort = e.name === "AbortError" || /cancel/i.test(e.message || "");
    94	      const payload: ScanError = {
    95	        message: e.message,
    96	        code: (e as NodeJS.ErrnoException).code ?? undefined,
    97	        detail: e.stack
    98	      };
    99	      if (!isAbort && !sender.isDestroyed()) {
   100	        sender.send(IpcChannels.scanError, payload);
   101	      }
   102	      throw payload;
   103	    } finally {
   104	      if (activeAbort === controller) activeAbort = null;
   105	    }
   106	  });
   107	
   108	  ipcMain.handle(IpcChannels.scanCancel, () => {
   109	    if (activeAbort) {
   110	      activeAbort.abort();
   111	      activeAbort = null;
   112	      return true;
   113	    }
   114	    return false;
   115	  });
   116	
   117	  ipcMain.handle(
   118	    IpcChannels.reportExport,
   119	    async (_event, payload: { report: unknown; options?: ExportOptions }): Promise<ExportResult> => {
   120	      const defaultPath = getDefaultExportPath(payload.options?.defaultFileName);
   121	      const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   122	      const dialogResult = await dialog.showSaveDialog(win!, {
   123	        title: "리포트 JSON 저장",
   124	        defaultPath,
   125	        filters: [{ name: "FormatBuddy report", extensions: ["json"] }]
   126	      });
   127	      if (dialogResult.canceled || !dialogResult.filePath) {
   128	        return { saved: false };
   129	      }
   130	      await fs.writeFile(dialogResult.filePath, JSON.stringify(payload.report, null, 2), "utf8");
   131	      return { saved: true, path: dialogResult.filePath };
   132	    }
   133	  );
   134	
   135	  ipcMain.handle(IpcChannels.reportOpenWeb, async () => {
   136	    await shell.openExternal(getWebReportImportUrl());
   137	    return true;
   138	  });
   139	
   140	  ipcMain.handle(IpcChannels.updateInstall, () => {
   141	    installAndRestart();
   142	    return true;
   143	  });
   144	
   145	  ipcMain.handle(IpcChannels.manifestExport, async (): Promise<ManifestExportResult> => {
   146	    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
   147	    const defaultPath = getDefaultExportPath("formatbuddy-backup-manifest.json");
   148	    const dialogResult = await dialog.showSaveDialog(win!, {
   149	      title: "백업 manifest 저장 위치",
   150	      defaultPath,
   151	      filters: [{ name: "FormatBuddy backup manifest", extensions: ["json"] }]
   152	    });
   153	    if (dialogResult.canceled || !dialogResult.filePath) {
   154	      return { saved: false };
   155	    }
   156	    try {
   157	      const result = await runBackupManifest({
   158	        scriptPath: getScanScriptPath(),
   159	        outputPath: dialogResult.filePath,
   160	        enforceIntegrity: app.isPackaged
   161	      });
   162	      return { saved: result.saved, path: result.path };
   163	    } catch (err) {
   164	      const e = err as Error;
   165	      return { saved: false, message: e.message };
   166	    }
   167	  });
   168	}
   169	
   170	app.whenReady().then(() => {
   171	  electronApp.setAppUserModelId("app.formatbuddy.desktop");
   172	
   173	  app.on("browser-window-created", (_event, window) => {
   174	    optimizer.watchWindowShortcuts(window);
   175	  });
   176	
   177	  registerIpc();
   178	  createWindow();
   179	  if (mainWindow) initAutoUpdater(mainWindow);
   180	

--- preload ---
     1	import { contextBridge, ipcRenderer } from "electron";
     2	import { IpcChannels } from "@shared/ipc";
     3	import type {
     4	  ExportOptions,
     5	  ExportResult,
     6	  ManifestExportResult,
     7	  ScanError,
     8	  ScanProgress,
     9	  ScanReport,
    10	  ScanResult,
    11	  UpdateDownloadProgress,
    12	  UpdateErrorPayload,
    13	  UpdateInfo
    14	} from "@shared/types";
    15	
    16	type ProgressListener = (progress: ScanProgress) => void;
    17	type CompleteListener = (result: ScanResult) => void;
    18	type ErrorListener = (error: ScanError) => void;
    19	type UpdateInfoListener = (info: UpdateInfo) => void;
    20	type UpdateProgressListener = (p: UpdateDownloadProgress) => void;
    21	type UpdateErrorListener = (e: UpdateErrorPayload) => void;
    22	type VoidListener = () => void;
    23	
    24	const fb = {
    25	  appVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),
    26	
    27	  startScan: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.scanStart),
    28	  cancelScan: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.scanCancel),
    29	
    30	  onScanProgress(cb: ProgressListener): () => void {
    31	    const wrapped = (_e: unknown, progress: ScanProgress) => cb(progress);
    32	    ipcRenderer.on(IpcChannels.scanProgress, wrapped);
    33	    return () => ipcRenderer.removeListener(IpcChannels.scanProgress, wrapped);
    34	  },
    35	  onScanComplete(cb: CompleteListener): () => void {
    36	    const wrapped = (_e: unknown, result: ScanResult) => cb(result);
    37	    ipcRenderer.on(IpcChannels.scanComplete, wrapped);
    38	    return () => ipcRenderer.removeListener(IpcChannels.scanComplete, wrapped);
    39	  },
    40	  onScanError(cb: ErrorListener): () => void {
    41	    const wrapped = (_e: unknown, err: ScanError) => cb(err);
    42	    ipcRenderer.on(IpcChannels.scanError, wrapped);
    43	    return () => ipcRenderer.removeListener(IpcChannels.scanError, wrapped);
    44	  },
    45	
    46	  exportReport: (report: ScanReport, options?: ExportOptions): Promise<ExportResult> =>
    47	    ipcRenderer.invoke(IpcChannels.reportExport, { report, options }),
    48	
    49	  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),
    50	
    51	  onUpdateChecking(cb: VoidListener): () => void {
    52	    const wrapped = () => cb();
    53	    ipcRenderer.on(IpcChannels.updateChecking, wrapped);
    54	    return () => ipcRenderer.removeListener(IpcChannels.updateChecking, wrapped);
    55	  },
    56	  onUpdateAvailable(cb: UpdateInfoListener): () => void {
    57	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    58	    ipcRenderer.on(IpcChannels.updateAvailable, wrapped);
    59	    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, wrapped);
    60	  },
    61	  onUpdateNotAvailable(cb: VoidListener): () => void {
    62	    const wrapped = () => cb();
    63	    ipcRenderer.on(IpcChannels.updateNotAvailable, wrapped);
    64	    return () => ipcRenderer.removeListener(IpcChannels.updateNotAvailable, wrapped);
    65	  },
    66	  onUpdateDownloadProgress(cb: UpdateProgressListener): () => void {
    67	    const wrapped = (_e: unknown, p: UpdateDownloadProgress) => cb(p);
    68	    ipcRenderer.on(IpcChannels.updateDownloadProgress, wrapped);
    69	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloadProgress, wrapped);
    70	  },
    71	  onUpdateDownloaded(cb: UpdateInfoListener): () => void {
    72	    const wrapped = (_e: unknown, info: UpdateInfo) => cb(info);
    73	    ipcRenderer.on(IpcChannels.updateDownloaded, wrapped);
    74	    return () => ipcRenderer.removeListener(IpcChannels.updateDownloaded, wrapped);
    75	  },
    76	  onUpdateError(cb: UpdateErrorListener): () => void {
    77	    const wrapped = (_e: unknown, err: UpdateErrorPayload) => cb(err);
    78	    ipcRenderer.on(IpcChannels.updateError, wrapped);
    79	    return () => ipcRenderer.removeListener(IpcChannels.updateError, wrapped);
    80	  },
    81	  installUpdate: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.updateInstall),
    82	
    83	  exportBackupManifest: (): Promise<ManifestExportResult> =>
    84	    ipcRenderer.invoke(IpcChannels.manifestExport)
    85	};
    86	
    87	contextBridge.exposeInMainWorld("fb", fb);
    88	
    89	export type FbBridge = typeof fb;

--- App ---
     1	import { useCallback, useEffect, useMemo, useState } from "react";
     2	import { Home } from "./pages/Home";
     3	import { Scanning } from "./pages/Scanning";
     4	import { Report } from "./pages/Report";
     5	import { UpdateBanner } from "./components/UpdateBanner";
     6	import type { ScanError, ScanProgress, ScanResult } from "@shared/types";
     7	
     8	type Phase =
     9	  | { kind: "home" }
    10	  | { kind: "scanning"; progress: ScanProgress }
    11	  | { kind: "report"; result: ScanResult }
    12	  | { kind: "error"; error: ScanError };
    13	
    14	const INITIAL_PROGRESS: ScanProgress = {
    15	  step: "준비",
    16	  doneSteps: 0,
    17	  totalSteps: 6,
    18	  score: 0,
    19	  elapsedMs: 0,
    20	  steps: [
    21	    { name: "PC 정보 확인", state: "pending", detail: "대기" },
    22	    { name: "디스크 살펴보기", state: "pending", detail: "대기" },
    23	    { name: "사용자 폴더 챙기기", state: "pending", detail: "대기" },
    24	    { name: "설치 앱 / 드라이버 목록", state: "pending", detail: "대기" },
    25	    { name: "인증서·Wi-Fi·클라우드", state: "pending", detail: "대기" },
    26	    { name: "포맷 체크리스트 정리", state: "pending", detail: "대기" }
    27	  ]
    28	};
    29	
    30	export function App() {
    31	  const [phase, setPhase] = useState<Phase>({ kind: "home" });
    32	  const [appVersion, setAppVersion] = useState<string>("");
    33	
    34	  useEffect(() => {
    35	    if (typeof window.fb?.appVersion === "function") {
    36	      void window.fb.appVersion().then(setAppVersion).catch(() => setAppVersion(""));
    37	    }
    38	  }, []);
    39	
    40	  useEffect(() => {
    41	    if (!window.fb) return;
    42	    const offProgress = window.fb.onScanProgress((p) => {
    43	      setPhase((prev) =>
    44	        prev.kind === "scanning" || prev.kind === "home" ? { kind: "scanning", progress: p } : prev
    45	      );
    46	    });
    47	    const offComplete = window.fb.onScanComplete((r) => {
    48	      setPhase({ kind: "report", result: r });
    49	    });
    50	    const offError = window.fb.onScanError((err) => {
    51	      setPhase({ kind: "error", error: err });
    52	    });
    53	    return () => {
    54	      offProgress();
    55	      offComplete();
    56	      offError();
    57	    };
    58	  }, []);
    59	
    60	  const startScan = useCallback(async () => {
    61	    if (!window.fb) {
    62	      setPhase({ kind: "error", error: { message: "Electron 브리지를 찾지 못했어요." } });
    63	      return;
    64	    }
    65	    setPhase({ kind: "scanning", progress: INITIAL_PROGRESS });
    66	    try {
    67	      await window.fb.startScan();
    68	    } catch {
    69	      // 에러는 onScanError 이벤트로 처리
    70	    }
    71	  }, []);
    72	
    73	  const cancelScan = useCallback(async () => {
    74	    if (!window.fb) return;
    75	    await window.fb.cancelScan();
    76	    setPhase({ kind: "home" });
    77	  }, []);
    78	
    79	  const goHome = useCallback(() => setPhase({ kind: "home" }), []);
    80	
    81	  const content = useMemo(() => {
    82	    switch (phase.kind) {
    83	      case "home":
    84	        return <Home onStartScan={startScan} />;
    85	      case "scanning":
    86	        return <Scanning progress={phase.progress} onCancel={cancelScan} />;
    87	      case "report":
    88	        return <Report result={phase.result} onBack={goHome} />;
    89	      case "error":
    90	        return (
    91	          <Scanning
    92	            progress={INITIAL_PROGRESS}
    93	            errorMessage={phase.error.message}
    94	            onCancel={goHome}
    95	            onRetry={startScan}
    96	          />
    97	        );
    98	    }
    99	  }, [phase, startScan, cancelScan, goHome]);
   100	
   101	  return (
   102	    <div className="fb-app">
   103	      {content}
   104	      <UpdateBanner />
   105	      <footer className="fb-app-footer">
   106	        <span>FormatBuddy Desktop</span>
   107	        {appVersion && <span className="fb-app-version">v{appVersion}</span>}
   108	      </footer>
   109	    </div>
   110	  );
   111	}

exec
/bin/zsh -lc 'git diff --unified=20 HEAD''^ HEAD -- resources/powershell/Invoke-FormatBuddyScan.ps1 src/renderer/src/pages/Report.tsx src/shared/ps-script-hash.ts tests/scanner.test.ts' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 2059ms:
2026-05-18 12:42:37.242 xcodebuild[92587:41551569]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:37.397 xcodebuild[92587:41551568] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-BH16gtF5' (errno=Operation not permitted)
2026-05-18 12:42:37.942 xcodebuild[92589:41551580]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:38.094 xcodebuild[92589:41551579] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/resources/powershell/Invoke-FormatBuddyScan.ps1 b/resources/powershell/Invoke-FormatBuddyScan.ps1
index 07ee39f..9c75dd3 100644
--- a/resources/powershell/Invoke-FormatBuddyScan.ps1
+++ b/resources/powershell/Invoke-FormatBuddyScan.ps1
@@ -171,40 +171,196 @@ function Get-FilesSkippingReparsePoints {
   $stack = New-Object System.Collections.Generic.Stack[string]
   $stack.Push($Root)
 
   while ($stack.Count -gt 0) {
     $current = $stack.Pop()
     Get-ChildItem -LiteralPath $current -Force -ErrorAction SilentlyContinue | ForEach-Object {
       if ($_.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
         return
       }
       if ($_ -is [System.IO.DirectoryInfo]) {
         $stack.Push($_.FullName)
       } elseif ($_ -is [System.IO.FileInfo]) {
         $results.Add($_) | Out-Null
       }
     }
   }
 
   return $results
 }
 
+function Get-DiskHealth {
+  $physical = try { Get-PhysicalDisk -ErrorAction Stop } catch { Add-Diagnostic -Step "DiskHealth" -Message $_.Exception.Message; @() }
+  foreach ($d in $physical) {
+    [ordered]@{
+      friendlyName = $d.FriendlyName
+      mediaType = "$($d.MediaType)"
+      busType = "$($d.BusType)"
+      sizeGb = if ($d.Size) { [Math]::Round($d.Size / 1GB, 2) } else { $null }
+      healthStatus = "$($d.HealthStatus)"
+      operationalStatus = "$($d.OperationalStatus)"
+    }
+  }
+}
+
+function Get-MemoryPressure {
+  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
+  $pageFiles = Get-SafeCimInstance Win32_PageFileUsage
+  $totalKb = if ($os) { $os.TotalVisibleMemorySize } else { 0 }
+  $freeKb = if ($os) { $os.FreePhysicalMemory } else { 0 }
+  $totalPageFileMb = ($pageFiles | Measure-Object -Property AllocatedBaseSize -Sum).Sum
+  $usedPageFileMb = ($pageFiles | Measure-Object -Property CurrentUsage -Sum).Sum
+  if ($null -eq $totalPageFileMb) { $totalPageFileMb = 0 }
+  if ($null -eq $usedPageFileMb) { $usedPageFileMb = 0 }
+  $pageFileUsagePercent = if ($totalPageFileMb -gt 0) { [Math]::Round(($usedPageFileMb / $totalPageFileMb) * 100, 1) } else { 0 }
+  $freeMemPercent = if ($totalKb -gt 0) { [Math]::Round(($freeKb / $totalKb) * 100, 1) } else { $null }
+  [ordered]@{
+    totalMemoryMb = if ($totalKb) { [Math]::Round($totalKb / 1024, 0) } else { $null }
+    freeMemoryMb = if ($freeKb) { [Math]::Round($freeKb / 1024, 0) } else { $null }
+    freeMemoryPercent = $freeMemPercent
+    pageFileTotalMb = $totalPageFileMb
+    pageFileUsedMb = $usedPageFileMb
+    pageFileUsagePercent = $pageFileUsagePercent
+  }
+}
+
+function Get-WindowsUpdateStatus {
+  $hotfixes = Get-SafeCimInstance Win32_QuickFixEngineering | Sort-Object -Property InstalledOn -Descending
+  $latestInstalledOn = if ($hotfixes -and $hotfixes.Count -gt 0) {
+    try { $hotfixes[0].InstalledOn.ToString("o") } catch { $null }
+  } else { $null }
+  $daysSinceLatest = if ($latestInstalledOn) {
+    try { [int]((Get-Date) - [DateTime]$latestInstalledOn).TotalDays } catch { $null }
+  } else { $null }
+  [ordered]@{
+    installedHotfixCount = if ($hotfixes) { @($hotfixes).Count } else { 0 }
+    latestHotfixInstalledOn = $latestInstalledOn
+    daysSinceLatestHotfix = $daysSinceLatest
+  }
+}
+
+function Get-EventLogSummary {
+  $since = (Get-Date).AddDays(-7)
+  $criticalCount = 0
+  $errorCount = 0
+  try {
+    $events = Get-WinEvent -FilterHashtable @{ LogName = "System"; Level = 1,2; StartTime = $since } -ErrorAction Stop
+    foreach ($e in $events) {
+      if ($e.Level -eq 1) { $criticalCount++ }
+      elseif ($e.Level -eq 2) { $errorCount++ }
+    }
+  } catch {
+    Add-Diagnostic -Step "EventLog" -Message $_.Exception.Message
+  }
+  [ordered]@{
+    windowDays = 7
+    criticalCount = $criticalCount
+    errorCount = $errorCount
+  }
+}
+
+function Get-DriverAgeSummary {
+  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
+  $total = 0
+  $olderThan2Years = 0
+  $cutoff = (Get-Date).AddYears(-2)
+  foreach ($d in $drivers) {
+    if ($d.DriverDate) {
+      $total++
+      try {
+        $date = [Management.ManagementDateTimeConverter]::ToDateTime($d.DriverDate)
+        if ($date -lt $cutoff) { $olderThan2Years++ }
+      } catch { }
+    }
+  }
+  $pct = if ($total -gt 0) { [Math]::Round(($olderThan2Years / $total) * 100, 1) } else { 0 }
+  [ordered]@{
+    totalWithDate = $total
+    olderThan2Years = $olderThan2Years
+    olderThan2YearsPercent = $pct
+  }
+}
+
+function Get-StartupPrograms {
+  $items = Get-SafeCimInstance Win32_StartupCommand
+  $list = New-Object System.Collections.Generic.List[object]
+  foreach ($i in $items) {
+    $list.Add([ordered]@{
+      name = $i.Name
+      command = $i.Command
+      location = $i.Location
+      user = $i.User
+    }) | Out-Null
+  }
+  [ordered]@{
+    count = $list.Count
+    items = @($list)
+  }
+}
+
+function Get-DefenderStatus {
+  try {
+    $s = Get-MpComputerStatus -ErrorAction Stop
+    [ordered]@{
+      antivirusEnabled = [bool]$s.AntivirusEnabled
+      realTimeProtectionEnabled = [bool]$s.RealTimeProtectionEnabled
+      antivirusSignatureAgeDays = $s.AntivirusSignatureAge
+      lastQuickScanDaysAgo = $s.QuickScanAge
+      lastFullScanDaysAgo = $s.FullScanAge
+    }
+  } catch {
+    Add-Diagnostic -Step "DefenderStatus" -Message $_.Exception.Message
+    [ordered]@{
+      antivirusEnabled = $null
+      realTimeProtectionEnabled = $null
+      antivirusSignatureAgeDays = $null
+      lastQuickScanDaysAgo = $null
+      lastFullScanDaysAgo = $null
+    }
+  }
+}
+
+function Get-StorageWaste {
+  function Get-PathSizeGb {
+    param([string]$Path)
+    if (-not (Test-Path $Path)) { return 0 }
+    try {
+      $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
+        Measure-Object -Property Length -Sum
+      if ($null -eq $sum.Sum) { return 0 }
+      return [Math]::Round($sum.Sum / 1GB, 2)
+    } catch { return 0 }
+  }
+  $tempGb = Get-PathSizeGb -Path $env:TEMP
+  $localAppDataTempGb = Get-PathSizeGb -Path (Join-Path $env:LOCALAPPDATA "Temp")
+  $windowsTempGb = Get-PathSizeGb -Path (Join-Path $env:SystemRoot "Temp")
+  $windowsOldExists = Test-Path (Join-Path $env:SystemDrive "Windows.old")
+  $windowsOldGb = if ($windowsOldExists) { Get-PathSizeGb -Path (Join-Path $env:SystemDrive "Windows.old") } else { 0 }
+  [ordered]@{
+    userTempGb = $tempGb
+    localAppDataTempGb = $localAppDataTempGb
+    windowsTempGb = $windowsTempGb
+    windowsOldExists = $windowsOldExists
+    windowsOldGb = $windowsOldGb
+  }
+}
+
 function Get-BackupManifest {
   param(
     [string[]]$Folders,
     [int64]$MaxFileSize
   )
 
   $folderResults = New-Object System.Collections.Generic.List[object]
 
   foreach ($folder in $Folders) {
     if ([string]::IsNullOrWhiteSpace($folder)) { continue }
     if (-not (Test-Path $folder)) {
       $folderResults.Add([ordered]@{
         folder = $folder
         exists = $false
         fileCount = 0
         skippedCount = 0
         totalBytes = 0
         entries = @()
         skipped = @()
       }) | Out-Null
@@ -285,65 +441,73 @@ if ($Mode -eq "manifest") {
       noPrivateKeyUpload = $true
       noBrowserPasswordExtraction = $true
     }
     maxFileSizeBytes = $ManifestMaxFileSizeBytes
     folders = Get-BackupManifest -Folders $manifestFolders -MaxFileSize $ManifestMaxFileSizeBytes
     diagnostics = @($diagnostics)
   }
 } else {
   $computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
   $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
   $bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
   $cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
   $gpu = Get-SafeCimInstance Win32_VideoController
   $disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
   $printers = Get-SafeCimInstance Win32_Printer
   $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
   $wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
   $bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }
 
   $report = [ordered]@{
-    schemaVersion = "0.2.0-quick"
+    schemaVersion = "0.4.0-quick"
     generatedAt = (Get-Date).ToString("o")
     mode = "quick"
     privacy = [ordered]@{
       localOnly = $true
       noPasswordCollection = $true
       noPrivateKeyUpload = $true
       noBrowserPasswordExtraction = $true
     }
     system = [ordered]@{
       manufacturer = $computer.Manufacturer
       model = $computer.Model
       serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
       osCaption = $os.Caption
       osVersion = $os.Version
       cpu = $cpu.Name
       memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
     }
     disks = @($disk | ForEach-Object {
       [ordered]@{
         drive = $_.DeviceID
         sizeGb = [Math]::Round($_.Size / 1GB, 2)
         freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
       }
     })
+    diskHealth = @(Get-DiskHealth)
+    memoryPressure = Get-MemoryPressure
+    windowsUpdate = Get-WindowsUpdateStatus
+    eventLog = Get-EventLogSummary
+    driverAge = Get-DriverAgeSummary
+    startupPrograms = Get-StartupPrograms
+    defender = Get-DefenderStatus
+    storageWaste = Get-StorageWaste
     userFolders = @(Get-UserFolders)
     gpu = @($gpu | ForEach-Object { $_.Name })
     installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
     drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
     printers = @($printers | Select-Object Name, DriverName, PortName, Default)
     wifiProfiles = @($wifiProfiles)
     npkiCandidates = @(Test-NpkiLocation)
     bitlocker = @($bitlocker)
     cloudSync = @(Get-CloudSyncCandidates)
     browsers = @(Get-BrowserPresence)
     winget = Get-WingetStatus
     wingetExport = Get-WingetExport
     diagnostics = @($diagnostics)
     checklist = [ordered]@{
       reviewNpkiManually = $true
       exportWifiProfilesManually = $true
       backupDesktopDocumentsDownloads = $true
       verifyCloudSync = $true
       saveReportBeforeFormat = $true
     }
diff --git a/src/renderer/src/pages/Report.tsx b/src/renderer/src/pages/Report.tsx
index 9b79806..cc36e54 100644
--- a/src/renderer/src/pages/Report.tsx
+++ b/src/renderer/src/pages/Report.tsx
@@ -1,52 +1,65 @@
 import { useCallback, useMemo, useState } from "react";
 import { Button } from "../components/Button";
 import { Lockup } from "../components/Lockup";
 import { copy } from "@shared/copy";
 import type { ScanResult } from "@shared/types";
 
+function severityClass(s: ScanResult["recommendation"]["severity"]): string {
+  switch (s) {
+    case "healthy":
+      return "fb-score-healthy";
+    case "watch":
+      return "fb-score-watch";
+    case "format-recommended":
+      return "fb-score-recommend";
+    case "format-required":
+      return "fb-score-required";
+  }
+}
+
 interface ReportProps {
   result: ScanResult;
   onBack: () => void;
 }
 
 interface RowProps {
   label: string;
   value: React.ReactNode;
 }
 
 function Row({ label, value }: RowProps) {
   return (
     <div className="fb-report-row">
       <div className="fb-report-row-label">{label}</div>
       <div className="fb-report-row-value">{value}</div>
     </div>
   );
 }
 
 function formatGb(value?: number | null) {
   if (value == null) return "—";
   return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
 }
 
 export function Report({ result, onBack }: ReportProps) {
-  const { report } = result;
+  const { report, recommendation } = result;
   const [exportStatus, setExportStatus] = useState<string | null>(null);
   const [manifestStatus, setManifestStatus] = useState<string | null>(null);
   const [manifestRunning, setManifestRunning] = useState(false);
 
   const installedCount = report.installedApps.length;
   const driverCount = report.drivers.length;
   const wifiCount = report.wifiProfiles.length;
   const npkiFound = useMemo(() => report.npkiCandidates.filter((n) => n.exists).length, [report.npkiCandidates]);
   const cloudFound = useMemo(() => report.cloudSync.filter((c) => c.exists).length, [report.cloudSync]);
   const totalDiskGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.sizeGb || 0), 0), [report.disks]);
   const totalFreeGb = useMemo(() => report.disks.reduce((sum, d) => sum + (d.freeGb || 0), 0), [report.disks]);
 
   const wingetPackageCount = useMemo(() => {
     if (!report.wingetExport?.Sources) return 0;
     return report.wingetExport.Sources.reduce(
       (sum, src) => sum + (src.Packages?.length ?? 0),
       0
     );
   }, [report.wingetExport]);
 
@@ -83,40 +96,112 @@ export function Report({ result, onBack }: ReportProps) {
       setManifestRunning(false);
     }
   }, []);
 
   return (
     <main className="fb-report">
       <header className="fb-report-header">
         <Lockup markSize={36} kanjiSize={20} en={false} />
         <div className="fb-report-actions">
           <Button variant="ghost" size="sm" onClick={onBack}>
             {copy.reportBackCta}
           </Button>
         </div>
       </header>
 
       <section className="fb-report-hero">
         <h1 className="fb-h1-sm">{copy.reportTitle}</h1>
         <p className="fb-lede">{copy.reportLede}</p>
       </section>
 
+      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
+        <div className="fb-score-card-head">
+          <div>
+            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
+            <div className="fb-score-card-value">
+              {recommendation.formatScore}
+              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
+            </div>
+            <div className="fb-score-card-headline">{recommendation.headline}</div>
+          </div>
+          <div className="fb-score-card-badge">
+            {copy.recommendSeverity[recommendation.severity]}
+          </div>
+        </div>
+        <p className="fb-score-card-summary">{recommendation.summary}</p>
+      </section>
+
+      <section className="fb-report-advice">
+        <article className="fb-card">
+          <h3>{copy.recommendTryFirstTitle}</h3>
+          <ul className="fb-advice-list">
+            {recommendation.tryFirst.map((a, i) => (
+              <li key={`tf-${i}`}>
+                <strong>{a.title}</strong>
+                <span>{a.description}</span>
+                {a.command && (
+                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
+                    {a.command}
+                  </code>
+                )}
+              </li>
+            ))}
+          </ul>
+        </article>
+
+        <article className="fb-card">
+          <h3>{copy.recommendFormatReasonsTitle}</h3>
+          {recommendation.formatReasons.length === 0 ? (
+            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
+          ) : (
+            <ul className="fb-advice-list">
+              {recommendation.formatReasons.map((r, i) => (
+                <li key={`fr-${i}`}>
+                  <strong>
+                    {r.label}{" "}
+                    <span className="fb-advice-weight">+{r.weightedScore.toFixed(1)}</span>
+                  </strong>
+                  <span>{r.description}</span>
+                </li>
+              ))}
+            </ul>
+          )}
+        </article>
+
+        <article className="fb-card">
+          <h3>{copy.recommendAfterFormatTitle}</h3>
+          <ul className="fb-advice-list">
+            {recommendation.afterFormat.map((a, i) => (
+              <li key={`af-${i}`}>
+                <strong>{a.title}</strong>
+                <span>{a.description}</span>
+                {a.command && (
+                  <code className="fb-advice-cmd" title={copy.recommendCommandLabel}>
+                    {a.command}
+                  </code>
+                )}
+              </li>
+            ))}
+          </ul>
+        </article>
+      </section>
+
       <section className="fb-report-grid">
         <article className="fb-card">
           <h3>이 PC</h3>
           <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
           <Row label="운영체제" value={report.system.osCaption ?? "—"} />
           <Row label="CPU" value={report.system.cpu ?? "—"} />
           <Row label="메모리" value={formatGb(report.system.memoryGb)} />
         </article>
 
         <article className="fb-card">
           <h3>저장 공간</h3>
           <Row label="총 용량" value={formatGb(totalDiskGb)} />
           <Row label="여유 공간" value={formatGb(totalFreeGb)} />
           {report.disks.map((d) => (
             <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
           ))}
         </article>
 
         <article className="fb-card">
           <h3>같이 챙길 것</h3>
diff --git a/src/shared/ps-script-hash.ts b/src/shared/ps-script-hash.ts
index 6750b4e..9e4ec95 100644
--- a/src/shared/ps-script-hash.ts
+++ b/src/shared/ps-script-hash.ts
@@ -1,8 +1,8 @@
 // AUTO-GENERATED by scripts/embed-ps-hash.mjs — do not edit by hand.
 // Run `npm run embed-ps-hash` (or any build/test/dev script) to refresh.
 //
 // SHA-256 of resources/powershell/Invoke-FormatBuddyScan.ps1, anchored in
 // the bundled main code so an attacker cannot bypass the integrity check
 // by editing an external manifest alongside the script.
 
-export const EXPECTED_PS_SCRIPT_HASH = "95fc04e56aa5756d7e2fc2c104d47c57fb3346345b6b116fb6f4fbd938641432";
+export const EXPECTED_PS_SCRIPT_HASH = "76dfbf11a2c1ce92160fef86b3b081a2d2d102cabe7797a7125d78558d8e52cd";
diff --git a/tests/scanner.test.ts b/tests/scanner.test.ts
index 453534d..132f654 100644
--- a/tests/scanner.test.ts
+++ b/tests/scanner.test.ts
@@ -19,41 +19,41 @@ describe("scanner mock pipeline", () => {
   it("progressFor computes score and elapsed", () => {
     const started = Date.now() - 1234;
     const p = __testing.progressFor(3, started);
     expect(p.totalSteps).toBe(__testing.TOTAL_STEPS);
     expect(p.doneSteps).toBe(3);
     expect(p.score).toBeGreaterThanOrEqual(50);
     expect(p.elapsedMs).toBeGreaterThanOrEqual(1000);
   });
 
   it("runScan(mock) emits progress, completes, writes JSON", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-scan-test-"));
     const events: ScanProgress[] = [];
     try {
       const res = await runScan({
         scriptPath: "ignored.ps1",
         outputDir: dir,
         mock: true,
         onProgress: (p) => events.push(p)
       });
       expect(events.length).toBeGreaterThanOrEqual(__testing.TOTAL_STEPS);
-      expect(res.report.schemaVersion).toBe("0.1.0");
+      expect(res.report.schemaVersion).toMatch(/^0\./);
       expect(res.report.privacy.localOnly).toBe(true);
       const fileText = readFileSync(res.jsonPath, "utf8");
       const parsed = JSON.parse(fileText) as ScanReport;
       expect(parsed.system.osCaption).toContain("Windows");
     } finally {
       rmSync(dir, { recursive: true, force: true });
     }
   });
 
   it("runScan(mock) cancels on abort", async () => {
     const dir = mkdtempSync(join(tmpdir(), "fb-cancel-test-"));
     const controller = new AbortController();
     try {
       const p = runScan({
         scriptPath: "ignored.ps1",
         outputDir: dir,
         mock: true,
         signal: controller.signal
       });
       setTimeout(() => controller.abort(), 50);

exec
/bin/zsh -lc 'npx tsc --noEmit -p tsconfig.node.json --composite false && npx tsc --noEmit -p tsconfig.web.json --composite false' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 1531ms:
exec
/bin/zsh -lc "grep -R \"openWebReport\\|formatbuddy-report\\|recommendation\\|wingetExport\" -n README.md docs src | sed -n '1,260p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 275ms:
src/renderer/src/pages/Report.tsx:7:function severityClass(s: ScanResult["recommendation"]["severity"]): string {
src/renderer/src/pages/Report.tsx:45:  const { report, recommendation } = result;
src/renderer/src/pages/Report.tsx:59:    if (!report.wingetExport?.Sources) return 0;
src/renderer/src/pages/Report.tsx:60:    return report.wingetExport.Sources.reduce(
src/renderer/src/pages/Report.tsx:64:  }, [report.wingetExport]);
src/renderer/src/pages/Report.tsx:69:    const res = await window.fb.exportReport(report, { defaultFileName: "formatbuddy-report.json" });
src/renderer/src/pages/Report.tsx:76:    await window.fb.openWebReport();
src/renderer/src/pages/Report.tsx:116:      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
src/renderer/src/pages/Report.tsx:121:              {recommendation.formatScore}
src/renderer/src/pages/Report.tsx:124:            <div className="fb-score-card-headline">{recommendation.headline}</div>
src/renderer/src/pages/Report.tsx:127:            {copy.recommendSeverity[recommendation.severity]}
src/renderer/src/pages/Report.tsx:130:        <p className="fb-score-card-summary">{recommendation.summary}</p>
src/renderer/src/pages/Report.tsx:137:            {recommendation.tryFirst.map((a, i) => (
src/renderer/src/pages/Report.tsx:153:          {recommendation.formatReasons.length === 0 ? (
src/renderer/src/pages/Report.tsx:157:              {recommendation.formatReasons.map((r, i) => (
src/renderer/src/pages/Report.tsx:173:            {recommendation.afterFormat.map((a, i) => (
src/shared/types.ts:241:  wingetExport?: WingetExport | null;
src/shared/types.ts:248:  recommendation: Recommendation;
src/main/paths.ts:27:export function getDefaultExportPath(fileName = "formatbuddy-report.json"): string {
src/main/scanner.ts:234:  return { report, recommendation: generateRecommendation(report), jsonPath: outPath };
src/main/scanner.ts:308:        resolveScan({ report, recommendation: generateRecommendation(report), jsonPath: outPath });
src/main/scanner.ts:410:    wingetExport: null,
src/preload/index.ts:49:  openWebReport: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.reportOpenWeb),

exec
/bin/zsh -lc "grep -R \"startup\" -n src tests resources | sed -n '1,220p'" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
src/shared/types.ts:227:  startupPrograms?: StartupProgramsInfo;
src/main/recommend.ts:211:  if (signals.has("startup-bloat") || (report.startupPrograms && report.startupPrograms.count > 12)) {
src/main/recommend.ts:215:      command: "taskmgr /0 /startup"
src/main/scanner.ts:366:    startupPrograms: { count: 6, items: [] },
tests/recommend.test.ts:39:    startupPrograms: { count: 5, items: [] },
resources/powershell/Invoke-FormatBuddyScan.ps1:491:    startupPrograms = Get-StartupPrograms

exec
/bin/zsh -lc "if [ -f logs/codex-review-v0.4.0.md ]; then sed -n '1,240p' logs/codex-review-v0.4.0.md; fi" in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 0ms:
OpenAI Codex v0.130.0
--------
workdir: /Users/ryanbak/claude/formatbuddy/desktop
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e392c-b122-7eb1-a4a1-d38667471abc
--------
user
# Code review — FormatBuddy Desktop v0.4.0 new surface

v0.4.0 adds 8 new PowerShell health-signal functions, a TS recommendation engine that scores them, and a Report UI that surfaces the result. Skip surfaces you've already cleared in v0.1.0–v0.3.2 reviews.

- Repo: https://github.com/ryan-formatbuddy/formatbuddy-desktop (PUBLIC)
- Last commit: `1db4064`
- Working tree: `/Users/ryanbak/claude/formatbuddy/desktop`

## What's NEW in v0.4.0

1. `resources/powershell/Invoke-FormatBuddyScan.ps1` — added: `Get-DiskHealth`, `Get-MemoryPressure`, `Get-WindowsUpdateStatus`, `Get-EventLogSummary`, `Get-DriverAgeSummary`, `Get-StartupPrograms`, `Get-DefenderStatus`, `Get-StorageWaste`. Quick-mode report schema bumped to `0.4.0-quick`.
2. `src/main/recommend.ts` (new) — pure TS recommendation engine. 8 per-signal score functions + weighted sum + severity buckets + tryFirst/afterFormat action builders.
3. `src/shared/types.ts` — new signal types + Recommendation/ActionItem/ReasonItem + ScanReport optional fields + ScanResult.recommendation.
4. `src/main/scanner.ts` — runScan/runMockScan/runPowershellScan all attach generateRecommendation(report) to the returned ScanResult; mock fixture extended with all new fields; isScanReport guard left tolerant of optional fields.
5. `src/renderer/src/pages/Report.tsx` — new score card + tryFirst card + formatReasons card + afterFormat card.
6. `src/shared/copy.ts` — score / severity / action labels.
7. `src/renderer/src/styles/globals.css` — score card styles + advice list / cmd chip / weight chip.
8. `tests/recommend.test.ts` — 6 cases (healthy / mixed signals / heavy bad / clamp / severity boundary / weight sum).

## Focus areas

### Recommendation engine
- Are the weights and thresholds **defensible**? Anything that would obviously over- or under-score a real Windows install?
- Is the scoring **idempotent and bounded** in edge cases (missing fields, negative numbers, NaN)?
- `pushReason` skips reasons whose `weighted < 5` — is that the right floor or should it be a percentage of the total?
- Anything that would make a user lose trust in the score (e.g. score swings wildly between near-identical scans)?

### PowerShell new functions
- `Get-EventLogSummary` uses `Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2; StartTime=...}` — failure modes? (no events / log full / permission)
- `Get-DefenderStatus` calls `Get-MpComputerStatus` which is unavailable on Windows Server / no-Defender systems. Caught?
- `Get-DriverAgeSummary` uses `[Management.ManagementDateTimeConverter]::ToDateTime` on `Win32_PnPSignedDriver.DriverDate`. Format on Korean Windows? Edge cases?
- `Get-StorageWaste`'s `Get-PathSizeGb` recurses into ReparsePoint dirs (we filter them in `Get-FilesSkippingReparsePoints` but not here). Risk?
- `Get-WindowsUpdateStatus` — does `Win32_QuickFixEngineering.InstalledOn` reliably return a parseable string across Windows 10/11/Server?

### UI / report
- Score card severity tinting uses `--color-fb-blue`/`--color-fb-positive`/`--color-fb-blue-heavy`/`--color-fb-ink-1` for the badge. Any handoff rule violation? (No colored shadows, no non-brand reds — confirm)
- Score card is always rendered, even when `recommendation` is somehow missing/null. Defensive null check needed?
- `severityClass` is exhaustive over the type — TS will catch new severities, but at runtime a stale field could fail. Acceptable?

### Anything else
- Tests rely entirely on synthetic fixtures; the recommendation engine has zero real-world tuning. Acceptable for an MVP or should we ship with a feature flag?

## Output format

Severity-rated (CRITICAL / HIGH / MEDIUM / LOW / NIT). For each: `file:line — issue` + 1-line fix. **If zero new issues, say so explicitly so I can stop the cycle.**
2026-05-18T03:41:31.316895Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
2026-05-18T03:41:31.599082Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
exec
/bin/zsh -lc 'git status --short && git rev-parse --show-toplevel && git rev-parse HEAD && git show --stat --oneline --decorate -1' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 8587ms:
2026-05-18 12:41:46.496 xcodebuild[92311:41548614]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:46.766 xcodebuild[92311:41548613] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-KIM9OqXa' (errno=Operation not permitted)
2026-05-18 12:41:47.401 xcodebuild[92315:41548644]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:47.560 xcodebuild[92315:41548643] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
?? logs/codex-review-v0.4.0.md
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-VkrrXdxO' (errno=Operation not permitted)
2026-05-18 12:41:48.807 xcodebuild[92320:41548960]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:48.959 xcodebuild[92320:41548959] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-14u2dYeD' (errno=Operation not permitted)
2026-05-18 12:41:49.507 xcodebuild[92322:41548982]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:49.651 xcodebuild[92322:41548980] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
/Users/ryanbak/claude/formatbuddy/desktop
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-T98UUsvi' (errno=Operation not permitted)
2026-05-18 12:41:50.849 xcodebuild[92327:41549010]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:51.003 xcodebuild[92327:41549009] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-LJFGvx5n' (errno=Operation not permitted)
2026-05-18 12:41:51.543 xcodebuild[92329:41549019]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:51.697 xcodebuild[92329:41549018] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
1db406462ccc5397f34daffd8871dcda431b22dd
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-i77Jb0AB' (errno=Operation not permitted)
2026-05-18 12:41:52.895 xcodebuild[92333:41549045]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:53.041 xcodebuild[92333:41549044] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-c1myGAcr' (errno=Operation not permitted)
2026-05-18 12:41:53.575 xcodebuild[92335:41549054]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:41:53.727 xcodebuild[92335:41549053] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
1db4064 (HEAD -> main, origin/main) feat: PC health signals + format recommendation engine (v0.4.0)
 package.json                                    |   2 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 166 +++++++++++-
 src/main/recommend.ts                           | 330 ++++++++++++++++++++++++
 src/main/scanner.ts                             |  53 +++-
 src/renderer/src/pages/Report.tsx               |  87 ++++++-
 src/renderer/src/styles/globals.css             | 134 ++++++++++
 src/shared/copy.ts                              |  16 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  98 +++++++
 tests/recommend.test.ts                         | 199 ++++++++++++++
 tests/scanner.test.ts                           |   2 +-
 11 files changed, 1079 insertions(+), 10 deletions(-)

exec
/bin/zsh -lc 'git diff --stat HEAD''^ HEAD && git diff --unified=80 HEAD''^ HEAD -- src/main/recommend.ts src/main/scanner.ts src/shared/types.ts src/renderer/src/pages/Report.tsx src/shared/copy.ts tests/recommend.test.ts' in /Users/ryanbak/claude/formatbuddy/desktop
 succeeded in 4057ms:
2026-05-18 12:42:00.930 xcodebuild[92360:41549370]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:01.078 xcodebuild[92360:41549369] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-l175EJyv' (errno=Operation not permitted)
2026-05-18 12:42:01.626 xcodebuild[92364:41549418]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:01.782 xcodebuild[92364:41549417] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
 package.json                                    |   2 +-
 resources/powershell/Invoke-FormatBuddyScan.ps1 | 166 +++++++++++-
 src/main/recommend.ts                           | 330 ++++++++++++++++++++++++
 src/main/scanner.ts                             |  53 +++-
 src/renderer/src/pages/Report.tsx               |  87 ++++++-
 src/renderer/src/styles/globals.css             | 134 ++++++++++
 src/shared/copy.ts                              |  16 +-
 src/shared/ps-script-hash.ts                    |   2 +-
 src/shared/types.ts                             |  98 +++++++
 tests/recommend.test.ts                         | 199 ++++++++++++++
 tests/scanner.test.ts                           |   2 +-
 11 files changed, 1079 insertions(+), 10 deletions(-)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-V1Vs1hqQ' (errno=Operation not permitted)
2026-05-18 12:42:02.977 xcodebuild[92369:41549482]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:03.120 xcodebuild[92369:41549480] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-yOF1R8pO' (errno=Operation not permitted)
2026-05-18 12:42:03.659 xcodebuild[92389:41549575]  DVTFilePathFSEvents: Failed to start fs event stream.
2026-05-18 12:42:03.805 xcodebuild[92389:41549573] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 "Input/output error". Using NSCachesDirectory instead.
diff --git a/src/main/recommend.ts b/src/main/recommend.ts
new file mode 100644
index 0000000..30800f5
--- /dev/null
+++ b/src/main/recommend.ts
@@ -0,0 +1,330 @@
+/**
+ * Recommendation engine — turns a raw ScanReport into a "format score" plus
+ * actionable advice. Pure function, no I/O, no electron imports → easy to test.
+ *
+ * Scoring philosophy (subject to change as we get Windows-field data):
+ *   - 100 = format strongly recommended
+ *   - 0   = healthy
+ *
+ * Weights are tuned conservatively: a single bad signal cannot push the score
+ * over the "format-required" threshold by itself; multiple bad signals must
+ * agree. This matches the friend-tone — we suggest "first try X" before
+ * suggesting "format".
+ */
+
+import type {
+  ActionItem,
+  Recommendation,
+  ReasonItem,
+  ScanReport,
+  FormatSeverity
+} from "@shared/types";
+
+const WEIGHTS = {
+  diskHealth: 0.30,
+  diskFree: 0.15,
+  memoryPressure: 0.10,
+  eventLog: 0.10,
+  windowsUpdate: 0.10,
+  driverAge: 0.10,
+  defender: 0.05,
+  storageWaste: 0.10
+} as const;
+
+function clamp01to100(v: number): number {
+  if (!isFinite(v)) return 0;
+  if (v < 0) return 0;
+  if (v > 100) return 100;
+  return v;
+}
+
+function diskHealthScore(report: ScanReport): number {
+  const health = report.diskHealth ?? [];
+  if (health.length === 0) return 0;
+  let worst = 0;
+  for (const d of health) {
+    const status = (d.healthStatus ?? "").toLowerCase();
+    const op = (d.operationalStatus ?? "").toLowerCase();
+    if (status.includes("unhealthy") || status.includes("failed")) worst = Math.max(worst, 100);
+    else if (status.includes("warning")) worst = Math.max(worst, 70);
+    else if (op && !op.includes("ok") && !op.includes("online")) worst = Math.max(worst, 60);
+  }
+  return worst;
+}
+
+function diskFreeScore(report: ScanReport): number {
+  if (!report.disks || report.disks.length === 0) return 0;
+  let worst = 0;
+  for (const d of report.disks) {
+    if (!d.sizeGb || d.sizeGb <= 0) continue;
+    const pct = (d.freeGb / d.sizeGb) * 100;
+    if (pct < 3) worst = Math.max(worst, 100);
+    else if (pct < 7) worst = Math.max(worst, 80);
+    else if (pct < 12) worst = Math.max(worst, 55);
+    else if (pct < 20) worst = Math.max(worst, 25);
+  }
+  return worst;
+}
+
+function memoryPressureScore(report: ScanReport): number {
+  const m = report.memoryPressure;
+  if (!m) return 0;
+  let s = 0;
+  if (typeof m.pageFileUsagePercent === "number") {
+    if (m.pageFileUsagePercent > 85) s = Math.max(s, 80);
+    else if (m.pageFileUsagePercent > 60) s = Math.max(s, 50);
+    else if (m.pageFileUsagePercent > 40) s = Math.max(s, 25);
+  }
+  if (typeof m.freeMemoryPercent === "number" && m.freeMemoryPercent !== null) {
+    if (m.freeMemoryPercent < 5) s = Math.max(s, 80);
+    else if (m.freeMemoryPercent < 12) s = Math.max(s, 50);
+  }
+  return s;
+}
+
+function eventLogScore(report: ScanReport): number {
+  const e = report.eventLog;
+  if (!e) return 0;
+  if (e.criticalCount >= 10) return 100;
+  if (e.criticalCount >= 5) return 70;
+  if (e.criticalCount >= 1) return 40;
+  if (e.errorCount >= 30) return 50;
+  if (e.errorCount >= 10) return 25;
+  return 0;
+}
+
+function windowsUpdateScore(report: ScanReport): number {

codex
The new recommendation and PowerShell surfaces have several correctness issues that can mislabel serious disk health as healthy, hide Defender failures, miss Windows Update age entirely, and overcount or hang while scanning storage waste. These affect the accuracy and reliability of the new v0.4.0 health score.

Full review comments:

- [P1] Don’t classify failed disks as healthy — /Users/ryanbak/claude/formatbuddy/desktop/src/main/recommend.ts:129-129
  When `diskHealthScore` returns 100 for an Unhealthy/Failed drive and every other signal is clean, the weighted total is exactly `100 * 0.30 = 30`; this branch maps 30 to `healthy`, so the headline says the PC is fine even while the reason tells the user to back up urgently. Treat the healthy bucket as below that boundary or add a disk-health override so a failing disk cannot be labeled healthy.

- [P2] Surface Defender failures despite low weight — /Users/ryanbak/claude/formatbuddy/desktop/src/main/recommend.ts:162-163
  For any Defender-only problem, the largest weighted value is `80 * 0.05 = 4`, so this `< 5` floor always drops the Defender reason; because `buildTryFirst` derives its signal set from `formatReasons`, the Windows Defender action is also never shown when antivirus or real-time protection is off. Lower or scale the floor for low-weight signals, or build the Defender action directly from `report.defender`.

- [P2] Parse QFE InstalledOn before formatting — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:229-232
  On Windows 10/11/Server, `Win32_QuickFixEngineering.InstalledOn` is commonly a locale-specific string, not a `DateTime`, so calling `.ToString("o")` with a format argument throws and leaves `daysSinceLatestHotfix` null; stale Windows Update installs then never contribute to the recommendation score. Parse the raw InstalledOn values with culture/FILETIME fallbacks and sort by parsed dates before computing days.

- [P2] Avoid double-counting the same temp folder — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:333-335
  On default Windows profiles, `$env:TEMP` usually resolves to `%LOCALAPPDATA%\Temp`, so these two measurements scan the same tree twice and `storageWasteScore` adds both values. A user with 11 GB of temp files can be reported as 22 GB and jump to a higher waste score; resolve and de-duplicate the paths before sizing, or keep only one user temp source.

- [P2] Skip reparse-point directories when sizing waste — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:327-328
  With `-Recurse -File -Force`, temp folders or `Windows.old` that contain junctions/symlinks can be followed during the quick scan, which can overcount unrelated trees or make the health scan hang on reparse loops. Reuse the existing reparse-safe traversal here before measuring storage waste.
The new recommendation and PowerShell surfaces have several correctness issues that can mislabel serious disk health as healthy, hide Defender failures, miss Windows Update age entirely, and overcount or hang while scanning storage waste. These affect the accuracy and reliability of the new v0.4.0 health score.

Full review comments:

- [P1] Don’t classify failed disks as healthy — /Users/ryanbak/claude/formatbuddy/desktop/src/main/recommend.ts:129-129
  When `diskHealthScore` returns 100 for an Unhealthy/Failed drive and every other signal is clean, the weighted total is exactly `100 * 0.30 = 30`; this branch maps 30 to `healthy`, so the headline says the PC is fine even while the reason tells the user to back up urgently. Treat the healthy bucket as below that boundary or add a disk-health override so a failing disk cannot be labeled healthy.

- [P2] Surface Defender failures despite low weight — /Users/ryanbak/claude/formatbuddy/desktop/src/main/recommend.ts:162-163
  For any Defender-only problem, the largest weighted value is `80 * 0.05 = 4`, so this `< 5` floor always drops the Defender reason; because `buildTryFirst` derives its signal set from `formatReasons`, the Windows Defender action is also never shown when antivirus or real-time protection is off. Lower or scale the floor for low-weight signals, or build the Defender action directly from `report.defender`.

- [P2] Parse QFE InstalledOn before formatting — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:229-232
  On Windows 10/11/Server, `Win32_QuickFixEngineering.InstalledOn` is commonly a locale-specific string, not a `DateTime`, so calling `.ToString("o")` with a format argument throws and leaves `daysSinceLatestHotfix` null; stale Windows Update installs then never contribute to the recommendation score. Parse the raw InstalledOn values with culture/FILETIME fallbacks and sort by parsed dates before computing days.

- [P2] Avoid double-counting the same temp folder — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:333-335
  On default Windows profiles, `$env:TEMP` usually resolves to `%LOCALAPPDATA%\Temp`, so these two measurements scan the same tree twice and `storageWasteScore` adds both values. A user with 11 GB of temp files can be reported as 22 GB and jump to a higher waste score; resolve and de-duplicate the paths before sizing, or keep only one user temp source.

- [P2] Skip reparse-point directories when sizing waste — /Users/ryanbak/claude/formatbuddy/desktop/resources/powershell/Invoke-FormatBuddyScan.ps1:327-328
  With `-Recurse -File -Force`, temp folders or `Windows.old` that contain junctions/symlinks can be followed during the quick scan, which can overcount unrelated trees or make the health scan hang on reparse loops. Reuse the existing reparse-safe traversal here before measuring storage waste.
