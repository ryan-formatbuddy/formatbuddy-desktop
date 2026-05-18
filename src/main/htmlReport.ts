import type { ScanReport, Recommendation, FormatSeverity } from "@shared/types";
import { copy } from "@shared/copy";

/**
 * Pure HTML report builder. Deliberately has NO electron / fs imports so
 * tests and standalone sample generators can call it without booting an
 * Electron app. The caller is responsible for reading the Wanted Sans ttf
 * and passing it as base64 via `options.fontBase64`. When omitted, the
 * report falls back to system fonts.
 */

/**
 * Build a single-file HTML report from a ScanReport + its Recommendation.
 *
 * Constraints (from Ryan):
 *  - Core report structure: ScoreHero / SmartCare / CleanupCenter / Care /
 *    AppInventory / TryBefore / Concerns / AfterFormat / Manifest
 *  - Wanted Sans Variable inlined (recipient gets the same font)
 *  - "로컬에서만 처리됨" meta is visible
 *  - File name format handled at the IPC layer:
 *      포맷버디_리포트_{YYYY-MM-DD}_{score}점.html
 *  - No remote network calls, no external CSS / JS — strict CSP.
 */

const SEVERITY_TONE: Record<FormatSeverity, { hex: string; textHex: string }> = {
  // text colors mirror v0.5.4 WCAG fix: mint/teal are too light for body text,
  // use ink-1 there; organize/format keep their hue tinted text.
  safe: { hex: "#2DC9A8", textHex: "#0E1116" },
  watch: { hex: "#1EA0D6", textHex: "#0E1116" },
  organize: { hex: "#0066FF", textHex: "#0066FF" },
  format: { hex: "#0040B5", textHex: "#0040B5" }
};

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function fmtGb(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GB`;
}

function friendlyFolderName(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "desktop") return "바탕화면";
  if (key === "documents") return "문서";
  if (key === "downloads") return "다운로드";
  if (key === "pictures") return "사진";
  if (key === "videos") return "동영상";
  if (key === "music") return "음악";
  return name;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function chipBadge(label: string, tone: string): string {
  return `<span class="chip"><span class="chip-dot" style="background:${tone}"></span>${esc(label)}</span>`;
}

function renderScoreHero(rec: Recommendation): string {
  const tone = SEVERITY_TONE[rec.severity];
  const sevCopy = copy.recommendSeverity[rec.severity];
  return `
  <section class="card card-score" style="--tone:${tone.hex};--tone-text:${tone.textHex}">
    <div class="score-head">
      <div class="score-text">
        <div class="score-label">${esc(copy.recommendSectionTitle)}</div>
        <div class="score-value"><span class="score-num">${rec.formatScore}</span><span class="score-unit">${esc(
          copy.recommendScoreSuffix
        )}</span></div>
        <div class="score-headline">${esc(rec.headline)}</div>
        ${chipBadge(sevCopy.chip, tone.hex)}
      </div>
    </div>
    <p class="score-summary">${esc(rec.summary)}</p>
  </section>`;
}

function renderTryBefore(rec: Recommendation): string {
  if (rec.tryFirst.length === 0) return "";
  const healthMini =
    rec.healthPillars.length > 0
      ? `
    <div class="health-mini">
      <h4>${esc(copy.healthSectionTitle)}</h4>
      <div class="health-mini-grid">
        ${rec.healthPillars
          .map(
            (p) => `
        <div>
          <strong>${esc(p.title)}</strong>
          <span>${esc(copy.healthStatus[p.status])}</span>
          <p>${esc(p.summary)}</p>
        </div>`
          )
          .join("")}
      </div>
    </div>`
      : "";
  const items = rec.tryFirst
    .map(
      (a) => `
    <li>
      <strong>${esc(a.title)}</strong>
      <span>${esc(a.description)}</span>
      ${a.command ? `<p class="action-hint">${esc(copy.recommendCommandHint)}</p>` : ""}
    </li>`
    )
    .join("");
  return `
  <section class="card">
    <h3>${esc(copy.recommendTryFirstTitle)}</h3>
    <ul class="advice-list">${items}</ul>
    ${healthMini}
  </section>`;
}

function renderCareActions(rec: Recommendation): string {
  if (rec.careActions.length === 0) return "";
  const items = rec.careActions
    .map(
      (a) => `
    <li>
      <strong>${esc(a.title)} <span class="care-badge">${esc(copy.careActionBadge[a.status])}</span></strong>
      <span>${esc(a.evidence)}</span>
      <p class="action-hint">${esc(a.safetyNote)}</p>
    </li>`
    )
    .join("");
  return `
  <section class="card">
    <h3>${esc(copy.careActionsTitle)}</h3>
    <p class="explain">${esc(copy.careActionsLede)}</p>
    <ul class="advice-list">${items}</ul>
  </section>`;
}

function renderSmartCareOverview(report: ScanReport, rec: Recommendation): string {
  const cleanup = rec.cleanupCenter;
  const security = rec.healthPillars.find((p) => p.id === "security");
  const performance = rec.healthPillars.find((p) => p.id === "performance");
  const backup = rec.healthPillars.find((p) => p.id === "backup");
  const directChecks = rec.buddyChecklist.filter((i) => i.status === "needs_user").length;
  const warnings = rec.buddyChecklist.filter((i) => i.status === "warning").length;
  const startupCount = cleanup.startupItems.length || report.startupPrograms?.count || 0;
  const rows = [
    ["정리", fmtGb(cleanup.reclaimableGb), cleanup.reviewCount > 0 ? `${cleanup.reviewCount}개 후보를 직접 보면 돼요.` : "크게 지울 후보가 적어요."],
    ["보안", security ? copy.healthStatus[security.status] : "확인 필요", security?.summary ?? "Windows 보안 상태를 한 번 더 확인해주세요."],
    ["속도", startupCount > 0 ? `${startupCount}개 시작 앱` : "괜찮아요", performance?.summary ?? "시작 앱과 저장 공간을 같이 보면 좋아요."],
    ["앱", `${rec.appInventory.needsCheck}개 확인`, `${rec.appInventory.total}개 설치 앱을 분류했어요.`],
    ["포맷 준비", `${directChecks + warnings}개 확인`, backup?.summary ?? "인증서, 파일, 계정을 포맷 전에 챙겨요."]
  ];
  const nextActions = [
    cleanup.reviewCount > 0 ? `정리 후보 ${cleanup.reviewCount}개를 먼저 훑어보세요.` : "정리 후보는 가볍게만 확인하면 돼요.",
    warnings > 0 ? `주의 항목 ${warnings}개는 그냥 넘기기 전에 확인해주세요.` : `${directChecks}개 직접 확인 항목을 차례대로 보면 돼요.`,
    rec.appInventory.needsCheck > 0
      ? `앱 ${rec.appInventory.needsCheck}개는 계정, 라이선스, 복원 여부를 확인해주세요.`
      : "앱 쪽은 크게 챙길 후보가 적어요."
  ];

  return `
  <section class="card card-smart">
    <h3>${esc(copy.smartCareTitle)}</h3>
    <p class="explain">${esc(copy.smartCareLede)}</p>
    <div class="smart-grid">
      ${rows
        .map(
          ([label, value, detail]) => `
      <div>
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
        <p>${esc(detail)}</p>
      </div>`
        )
        .join("")}
    </div>
    <h4>${esc(copy.smartCareNextTitle)}</h4>
    <ol class="smart-next">
      ${nextActions.map((a) => `<li>${esc(a)}</li>`).join("")}
    </ol>
    <p class="explain">${esc(copy.smartCarePrivacyNote)}</p>
  </section>`;
}

function renderCleanupCenter(rec: Recommendation): string {
  const cleanup = rec.cleanupCenter;
  const candidateItems = cleanup.candidates
    .map(
      (c) => `
    <li>
      <strong>${esc(c.title)} <span class="care-badge">${esc(copy.cleanupStatusBadge[c.status])}</span></strong>
      <span>${esc(c.evidence)}</span>
      <p class="action-hint">${esc(c.action)}</p>
      <small>${esc(c.safetyNote)}</small>
    </li>`
    )
    .join("");
  const largeRows = cleanup.largeFiles
    .slice(0, 8)
    .map(
      (f) => `
      <tr>
        <td>${esc(f.name)}</td>
        <td>${esc(friendlyFolderName(f.folderName))}</td>
        <td class="num">${esc(fmtGb(f.sizeGb))}</td>
      </tr>`
    )
    .join("");
  const duplicateRows = cleanup.duplicateGroups
    .slice(0, 6)
    .map(
      (g) => `
      <tr>
        <td>${esc(g.name)}</td>
        <td>${g.count}개</td>
        <td class="num">${esc(fmtGb(g.totalWastedGb))}</td>
      </tr>`
    )
    .join("");
  const startupRows = cleanup.startupItems
    .slice(0, 8)
    .map(
      (s) => `
      <tr>
        <td>${esc(s.name || "이름 없는 시작 앱")}</td>
        <td>${esc(s.location || "시작 앱 목록")}</td>
        <td class="num">${esc(s.user || "PC")}</td>
      </tr>`
    )
    .join("");
  const details =
    largeRows || duplicateRows || startupRows
      ? `
    <div class="cleanup-detail-grid">
      ${
        largeRows
          ? `<div><h4>${esc(copy.cleanupLargeFilesTitle)}</h4><table class="simple-table"><tbody>${largeRows}</tbody></table></div>`
          : ""
      }
      ${
        duplicateRows
          ? `<div><h4>${esc(copy.cleanupDuplicatesTitle)}</h4><table class="simple-table"><tbody>${duplicateRows}</tbody></table></div>`
          : ""
      }
      ${
        startupRows
          ? `<div><h4>${esc(copy.cleanupStartupTitle)}</h4><table class="simple-table"><tbody>${startupRows}</tbody></table></div>`
          : ""
      }
    </div>`
      : `<p class="explain">${esc(copy.cleanupNoDetail)}</p>`;

  return `
  <section class="card">
    <h3>${esc(copy.cleanupCenterTitle)}</h3>
    <p class="explain">${esc(copy.cleanupCenterLede)}</p>
    <p class="action-hint">${esc(copy.cleanupCenterSummary(cleanup.reclaimableGb, cleanup.reviewCount))}</p>
    <p class="explain">${esc(copy.cleanupCenterCoverageNote)}</p>
    <ul class="advice-list">${candidateItems}</ul>
    ${details}
  </section>`;
}

function renderAppInventory(rec: Recommendation): string {
  const inv = rec.appInventory;
  if (inv.total === 0) return "";
  const groups = inv.groups
    .map((group) => {
      const rows = group.items
        .map(
          (item) => `
      <tr>
        <td>${esc(item.name)}</td>
        <td>${esc(item.publisher ?? "제조사 정보 없음")}</td>
        <td>${esc(item.attentionLabel)}</td>
      </tr>`
        )
        .join("");
      return `
    <h4>${esc(group.label)} · ${group.count}개</h4>
    <table class="app-list-table"><tbody>${rows}</tbody></table>`;
    })
    .join("");
  return `
  <section class="card">
    <h3>${esc(copy.appInventoryTitle)}</h3>
    <p class="explain">${esc(copy.appInventoryLede)}</p>
    <p class="action-hint">${inv.total}개 중 ${inv.classified}개 분류 · ${inv.needsCheck}개 확인 추천</p>
    <p class="explain">${esc(copy.appInventoryCoverageNote)}</p>
    ${groups}
  </section>`;
}

function renderConcerns(rec: Recommendation): string {
  if (rec.formatReasons.length === 0) {
    return `
  <section class="card">
    <h3>${esc(copy.recommendFormatReasonsTitle)}</h3>
    <p class="explain">${esc(copy.recommendNoReasons)}</p>
  </section>`;
  }
  const items = rec.formatReasons
    .map((r) => {
      const heavy = r.weightedScore >= 5 ? " heavy" : "";
      return `
    <li>
      <strong>${esc(r.label)} <span class="weight${heavy}">+${r.weightedScore.toFixed(1)}</span></strong>
      <span>${esc(r.description)}</span>
    </li>`;
    })
    .join("");
  return `
  <section class="card">
    <h3>${esc(copy.recommendFormatReasonsTitle)}</h3>
    <ul class="advice-list">${items}</ul>
  </section>`;
}

function renderAfterFormat(rec: Recommendation): string {
  if (rec.afterFormat.length === 0) return "";
  const items = rec.afterFormat
    .map(
      (a) => `
    <li>
      <strong>${esc(a.title)}</strong>
      <span>${esc(a.description)}</span>
      ${a.command ? `<p class="action-hint">${esc(copy.recommendCommandHint)}</p>` : ""}
    </li>`
    )
    .join("");
  return `
  <section class="card">
    <h3>${esc(copy.recommendAfterFormatTitle)}</h3>
    <ul class="advice-list">${items}</ul>
  </section>`;
}

function renderManifest(report: ScanReport): string {
  const folderRows = report.userFolders
    .filter((f) => f.exists)
    .map(
      (f) => `
      <tr>
        <td>${esc(friendlyFolderName(f.name))}</td>
        <td class="path">${esc(f.path)}</td>
        <td class="num">${fmtGb(f.sizeGb)}</td>
      </tr>`
    )
    .join("");
  return `
  <section class="card card-backup">
    <h3>${esc(copy.manifestSectionTitle)}</h3>
    <p class="explain">${esc(copy.manifestExplain)}</p>
    <p class="explain">이 리포트에는 폴더 요약만 들어 있어요. 자세한 파일 목록은 따로 만든 빠진 파일 확인 목록에서 볼 수 있어요.</p>
    <table class="backup-list-table">
      <thead>
        <tr><th>폴더</th><th>위치</th><th class="num">크기</th></tr>
      </thead>
      <tbody>${folderRows}</tbody>
    </table>
  </section>`;
}

function renderSystemInline(report: ScanReport): string {
  const sys = report.system;
  const totalDisk = report.disks.reduce((s, d) => s + (d.sizeGb || 0), 0);
  const freeDisk = report.disks.reduce((s, d) => s + (d.freeGb || 0), 0);
  return `
  <section class="card">
    <h3>이 PC</h3>
    <div class="kv">
      <div><span>모델</span><strong>${esc(`${sys.manufacturer ?? "—"} ${sys.model ?? ""}`.trim() || "—")}</strong></div>
      <div><span>운영체제</span><strong>${esc(sys.osCaption ?? "—")}</strong></div>
      <div><span>CPU</span><strong>${esc(sys.cpu ?? "—")}</strong></div>
      <div><span>메모리</span><strong>${esc(fmtGb(sys.memoryGb))}</strong></div>
      <div><span>저장 공간</span><strong>${esc(fmtGb(totalDisk))} (여유 ${esc(fmtGb(freeDisk))})</strong></div>
      <div><span>설치된 앱</span><strong>${esc(`${report.installedApps.length}개`)}</strong></div>
    </div>
  </section>`;
}

function styles(fontBase64: string | null): string {
  const fontFace = fontBase64
    ? `@font-face{font-family:'Wanted Sans';font-style:normal;font-weight:100 950;font-display:swap;src:url(data:font/ttf;base64,${fontBase64}) format('truetype');}`
    : "";
  return `
  ${fontFace}
  :root{
    --fb-blue:#0066FF;--fb-blue-heavy:#0040B5;--fb-blue-tint:#EAF2FE;
    --fb-ink-1:#0E1116;--fb-ink-2:rgba(46,47,51,0.88);--fb-ink-3:rgba(55,56,60,0.61);
    --fb-line:#E1E2E4;--fb-line-t:rgba(112,115,124,0.22);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:var(--fb-ink-1);
    font-family:'Wanted Sans','Pretendard',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;
    font-feature-settings:"ss01" on,"ss03" on;-webkit-font-smoothing:antialiased;}
  .page{max-width:880px;margin:0 auto;padding:48px 32px 64px;}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--fb-line);padding-bottom:20px;margin-bottom:28px;}
  header h1{margin:0;font-size:32px;font-weight:800;letter-spacing:-0.04em;line-height:1.1;}
  header .meta{font-size:12px;color:var(--fb-ink-3);font-weight:500;text-align:right;line-height:1.6;}
  header .meta strong{color:var(--fb-ink-2);display:block;font-weight:600;}
  .card{background:#fff;border:1px solid var(--fb-line);border-radius:20px;padding:24px 28px;margin-bottom:16px;}
  .card-score{background:var(--fb-blue-tint);border-color:transparent;padding:28px 32px;}
  .score-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;}
  .score-text{display:flex;flex-direction:column;gap:6px;}
  .score-label{font-size:12px;font-weight:700;letter-spacing:0.04em;color:var(--fb-blue-heavy);}
  .score-value{display:flex;align-items:baseline;gap:6px;line-height:1;}
  .score-num{font-size:96px;font-weight:800;letter-spacing:-0.045em;color:var(--tone-text,#0E1116);font-feature-settings:"tnum" on;}
  .score-unit{font-size:22px;font-weight:700;color:var(--fb-ink-3);}
  .score-headline{margin-top:8px;font-size:14px;font-weight:700;color:var(--fb-ink-1);}
  .score-summary{margin:14px 0 0;font-size:14px;line-height:22px;color:var(--fb-ink-2);font-weight:500;}
  .chip{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--fb-line);padding:6px 14px 6px 12px;border-radius:9999px;font-size:13px;font-weight:700;color:var(--tone-text,#0E1116);margin-top:6px;}
  .chip-dot{width:8px;height:8px;border-radius:9999px;}
  .card h3{margin:0 0 10px;font-size:15px;font-weight:800;letter-spacing:-0.02em;color:var(--fb-ink-1);}
  .explain{margin:0 0 12px;font-size:13px;line-height:20px;color:var(--fb-ink-2);font-weight:500;}
  .advice-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;}
  .advice-list li{display:flex;flex-direction:column;gap:4px;padding:12px 14px;background:#fff;border:1px solid var(--fb-line);border-radius:12px;}
  .advice-list strong{font-size:14px;font-weight:700;color:var(--fb-ink-1);}
  .advice-list span{font-size:13px;line-height:20px;color:var(--fb-ink-2);font-weight:500;}
  .action-hint{margin:6px 0 0;display:inline-flex;font-size:12px;font-weight:650;letter-spacing:-0.01em;color:var(--fb-blue-heavy);background:var(--fb-blue-tint);padding:4px 10px;border-radius:9999px;align-self:flex-start;}
  .care-badge{display:inline-flex;font-size:11px;font-weight:800;color:var(--fb-blue-heavy);background:var(--fb-blue-tint);padding:2px 8px;border-radius:9999px;margin-left:6px;}
  .advice-list small{font-size:12px;line-height:18px;color:var(--fb-ink-3);font-weight:600;}
  .card-smart{background:linear-gradient(180deg,#f8fbff 0%,#fff 100%);border-color:rgba(0,102,255,0.14);}
  .smart-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0;}
  .smart-grid div{border:1px solid var(--fb-line);border-top:4px solid var(--fb-blue);border-radius:12px;padding:10px 11px;min-height:108px;}
  .smart-grid span{display:block;font-size:10px;font-weight:850;color:var(--fb-ink-3);margin-bottom:5px;}
  .smart-grid strong{display:block;font-size:15px;font-weight:850;color:var(--fb-blue-heavy);line-height:1.2;margin-bottom:5px;}
  .smart-grid p{margin:0;font-size:11px;line-height:16px;color:var(--fb-ink-2);font-weight:550;}
  .smart-next{margin:6px 0 12px;padding-left:18px;color:var(--fb-ink-1);font-size:13px;line-height:21px;font-weight:650;}
  .weight{font-size:11px;font-weight:600;color:var(--fb-blue-heavy);background:var(--fb-blue-tint);padding:2px 8px;border-radius:9999px;margin-left:6px;font-feature-settings:"tnum" on;vertical-align:middle;}
  .weight.heavy{background:var(--fb-blue);color:#fff;}
  .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 24px;}
  .kv div{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dashed var(--fb-line-t);padding:6px 0;font-size:13px;}
  .kv div:last-child{border-bottom:none;}
  .kv span{color:var(--fb-ink-3);font-weight:600;}
  .kv strong{color:var(--fb-ink-1);font-weight:500;font-family:inherit;}
  .backup-list-table{width:100%;border-collapse:collapse;font-size:12px;}
  .backup-list-table th{text-align:left;font-weight:700;color:var(--fb-ink-3);padding:8px 10px;border-bottom:1px solid var(--fb-line);font-size:11px;letter-spacing:0.04em;text-transform:uppercase;}
  .backup-list-table td{padding:8px 10px;border-bottom:1px dashed var(--fb-line-t);color:var(--fb-ink-1);}
  .backup-list-table td.num{font-feature-settings:"tnum" on;text-align:right;font-weight:600;}
  .backup-list-table td.path{color:var(--fb-ink-3);font-size:11px;letter-spacing:-0.005em;}
  .app-list-table{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px;}
  .card h4{margin:14px 0 6px;font-size:13px;color:var(--fb-ink-1);}
  .app-list-table td{padding:7px 8px;border-bottom:1px dashed var(--fb-line-t);color:var(--fb-ink-1);}
  .app-list-table td:nth-child(2){color:var(--fb-ink-3);}
  .app-list-table td:nth-child(3){text-align:right;color:var(--fb-blue-heavy);font-weight:700;}
  .cleanup-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px;}
  .simple-table{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 4px;}
  .simple-table td{padding:7px 8px;border-bottom:1px dashed var(--fb-line-t);color:var(--fb-ink-1);vertical-align:top;}
  .simple-table td:nth-child(2){color:var(--fb-ink-3);}
  .simple-table td.num{text-align:right;color:var(--fb-blue-heavy);font-weight:800;font-feature-settings:"tnum" on;white-space:nowrap;}
  .health-mini{margin-top:18px;padding-top:16px;border-top:1px solid var(--fb-line);}
  .health-mini h4{margin:0 0 10px;font-size:13px;color:var(--fb-ink-1);}
  .health-mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
  .health-mini-grid div{border:1px solid var(--fb-line);border-radius:10px;padding:10px 11px;}
  .health-mini-grid strong{display:block;font-size:12px;color:var(--fb-ink-1);margin-bottom:3px;}
  .health-mini-grid span{display:inline-flex;font-size:10px;font-weight:800;color:var(--fb-blue-heavy);background:var(--fb-blue-tint);border-radius:9999px;padding:2px 7px;margin-bottom:7px;}
  .health-mini-grid p{margin:0;font-size:11px;line-height:17px;color:var(--fb-ink-2);}
  footer{margin-top:32px;padding-top:20px;border-top:1px solid var(--fb-line);font-size:11px;color:var(--fb-ink-3);display:flex;justify-content:space-between;}
  .privacy-pill{display:inline-flex;align-items:center;gap:6px;background:var(--fb-blue-tint);color:var(--fb-blue-heavy);font-size:11px;font-weight:700;padding:4px 10px;border-radius:9999px;letter-spacing:-0.01em;}
  .privacy-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--fb-blue);}
  @media print{.page{padding:24px 16px;}.card{break-inside:avoid;}}
  `;
}

export interface BuildHtmlReportOptions {
  /** Base64-encoded Wanted Sans Variable TTF. When null/omitted, the
   *  HTML falls back to system fonts. */
  fontBase64?: string | null;
}

export function buildHtmlReport(
  report: ScanReport,
  recommendation: Recommendation,
  options: BuildHtmlReportOptions = {}
): string {
  const fontBase64 = options.fontBase64 ?? null;
  const generatedAt = formatDate(report.generatedAt);
  const dateOnly = (() => {
    try {
      return new Date(report.generatedAt).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  })();

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:; img-src 'none'">
<title>포맷버디 리포트 — ${esc(dateOnly)} (${recommendation.formatScore}점)</title>
<style>${styles(fontBase64)}</style>
</head>
<body>
<div class="page">
  <header>
    <h1>${esc(copy.appName)} 리포트</h1>
    <div class="meta">
      <strong>${esc(generatedAt)}</strong>
      <span class="privacy-pill">로컬에서만 처리됨</span>
    </div>
  </header>
  ${renderScoreHero(recommendation)}
  ${renderSystemInline(report)}
  ${renderSmartCareOverview(report, recommendation)}
  ${renderCleanupCenter(recommendation)}
  ${renderCareActions(recommendation)}
  ${renderAppInventory(recommendation)}
  ${renderTryBefore(recommendation)}
  ${renderConcerns(recommendation)}
  ${renderAfterFormat(recommendation)}
  ${renderManifest(report)}
  <footer>
    <span>포맷버디 · PC 포맷 동행</span>
    <span>로컬에서만 만들어진 리포트예요</span>
  </footer>
</div>
</body>
</html>`;
}

export function buildHtmlReportFilename(report: ScanReport, recommendation: Recommendation): string {
  let date = "";
  try {
    date = new Date(report.generatedAt).toISOString().slice(0, 10);
  } catch {
    date = new Date().toISOString().slice(0, 10);
  }
  return `포맷버디_리포트_${date}_${recommendation.formatScore}점.html`;
}
