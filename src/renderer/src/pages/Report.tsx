import { useCallback, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import { CloudBuddy } from "../components/CloudBuddy";
import { TooltipDetail } from "../components/TooltipDetail";
import { copy } from "@shared/copy";
import type {
  ActionItem,
  AppInventoryGroup,
  AppInventoryItem,
  AppPlatform,
  BuddyChecklistCategory,
  BuddyChecklistItem,
  BuddyCheckStatus,
  CareAction,
  CareActionCategory,
  CareActionStatus,
  CleanupCandidate,
  CleanupCandidateStatus,
  DuplicateFileCandidateGroup,
  FileCandidateKind,
  AppStateSnapshot,
  HealthPillar,
  IgnoreListState,
  LargeFileCandidate,
  ScanResult
} from "@shared/types";

function expressionForScore(score: number): "calm" | "smile" | "wink" {
  if (score >= 76) return "calm";
  if (score >= 26) return "smile";
  return "wink";
}

const HEAVY_REASON_THRESHOLD = 5;

function severityClass(s: ScanResult["recommendation"]["severity"]): string {
  switch (s) {
    case "safe":
      return "fb-score-safe";
    case "watch":
      return "fb-score-watch";
    case "organize":
      return "fb-score-organize";
    case "format":
      return "fb-score-format";
  }
}

function healthStatusClass(status: HealthPillar["status"]): string {
  switch (status) {
    case "good":
      return "fb-health-good";
    case "check":
      return "fb-health-check";
    case "action":
      return "fb-health-action-needed";
  }
}

const BUDDY_CATEGORY_LABEL: Record<BuddyChecklistCategory, string> = {
  certificate: "인증서",
  files: "개인 파일",
  security: "보안",
  apps: "앱",
  drivers: "장치",
  cloud: "클라우드",
  backup: "복원 준비",
  browser: "브라우저",
  mail: "메일",
  license: "라이선스",
  work: "작업 자료",
  account: "계정"
};

const CARE_CATEGORY_LABEL: Record<CareActionCategory, string> = {
  cleanup: "깔끔 정리",
  delete: "삭제 확인",
  security: "보안 검사",
  protection: "실시간 보호",
  performance: "속도"
};

function buddyStatusClass(status: BuddyCheckStatus): string {
  switch (status) {
    case "confirmed":
      return "fb-buddy-confirmed";
    case "needs_user":
      return "fb-buddy-needs-user";
    case "warning":
      return "fb-buddy-warning";
    case "unknown":
      return "fb-buddy-unknown";
  }
}

function careStatusClass(status: CareActionStatus): string {
  switch (status) {
    case "ready":
      return "fb-care-ready";
    case "check":
      return "fb-care-check";
    case "warning":
      return "fb-care-warning";
    case "unavailable":
      return "fb-care-unavailable";
  }
}

function smartStatusClass(status: HealthPillar["status"] | "good" | "check" | "action"): string {
  switch (status) {
    case "good":
      return "fb-smart-good";
    case "check":
      return "fb-smart-check";
    case "action":
      return "fb-smart-action";
  }
}

function cleanupStatusClass(status: CleanupCandidateStatus): string {
  switch (status) {
    case "ready":
      return "fb-cleanup-ready";
    case "review":
      return "fb-cleanup-review";
    case "empty":
      return "fb-cleanup-empty";
  }
}

const FILE_KIND_LABEL: Record<FileCandidateKind, string> = {
  installer: "설치 파일",
  archive: "압축 파일",
  video: "영상",
  image: "이미지",
  document: "문서",
  audio: "음악",
  other: "기타"
};

// expressionForScore helper will land in v0.5.3 when the ScoreHero card
// gains its own CloudBuddy. For now severity drives the tone color only.

interface ReportProps {
  result: ScanResult;
  onBack: () => void;
  appPlatform?: AppPlatform;
  appState?: AppStateSnapshot;
  onOpenCleanup?: (report: ScanResult["report"]) => void;
  onOpenAppManager?: () => void;
  onOpenSecurity?: () => void;
  onRescan?: () => void;
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

interface HealthPillarCardProps {
  pillar: HealthPillar;
  isWindows: boolean;
  onRunAction: (action: ActionItem) => void;
}

function HealthPillarCard({ pillar, isWindows, onRunAction }: HealthPillarCardProps) {
  return (
    <article className={`fb-health-card ${healthStatusClass(pillar.status)}`}>
      <div className="fb-health-card-head">
        <h3>{pillar.title}</h3>
        <span className="fb-health-chip">{copy.healthStatus[pillar.status]}</span>
      </div>
      <p>{pillar.summary}</p>
      <TooltipDetail
        label={copy.healthTooltipLabel}
        title={`${pillar.title}을 보는 이유`}
        body={pillar.detail}
      />
      {pillar.actions.length > 0 && (
        <ul className="fb-health-actions">
          {pillar.actions.map((action) => (
            <li key={`${pillar.id}-${action.title}`}>
              <span>{action.title}</span>
              {action.command && isWindows ? (
                <button
                  type="button"
                  className="fb-health-action-btn"
                  onClick={() => onRunAction(action)}
                >
                  {copy.healthActionLabel}
                </button>
              ) : (
                <small>{isWindows ? action.description : "Windows에서 진행"}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function BuddyChecklistPanel({ items }: { items: BuddyChecklistItem[] }) {
  const confirmed = items.filter((i) => i.status === "confirmed").length;
  const needsUser = items.filter((i) => i.status === "needs_user").length;
  const warning = items.filter((i) => i.status === "warning").length;
  const unknown = items.filter((i) => i.status === "unknown").length;

  return (
    <section className="fb-buddy-checklist" aria-labelledby="buddy-checklist-title">
      <div className="fb-buddy-checklist-head">
        <div>
          <h2 id="buddy-checklist-title" className="fb-h2">
            {copy.buddyChecklistTitle}
          </h2>
          <p>{copy.buddyChecklistLede}</p>
        </div>
        <div className="fb-buddy-checklist-summary" aria-label="체크리스트 요약">
          <strong>{confirmed}</strong>
          <span>버디 확인</span>
        </div>
      </div>

      <p className="fb-buddy-checklist-counts">
        {copy.buddyChecklistSummary(confirmed, needsUser, warning)}
        {unknown > 0 ? ` ${unknown}개는 아직 확인하지 못했어요.` : ""}
      </p>
      <p className="fb-buddy-checklist-privacy">{copy.buddyChecklistPrivacy}</p>

      <div className="fb-buddy-checklist-grid">
        {items.map((check) => (
          <article
            key={check.id}
            className={`fb-buddy-check-card ${buddyStatusClass(check.status)} fb-buddy-priority-${check.priority}`}
          >
            <div className="fb-buddy-check-top">
              <input
                type="checkbox"
                checked={check.status === "confirmed"}
                readOnly
                aria-label={`${check.label} ${copy.buddyChecklistBadge[check.status]}`}
              />
              <div className="fb-buddy-check-title">
                <span>{BUDDY_CATEGORY_LABEL[check.category]}</span>
                <h3>{check.label}</h3>
              </div>
              <span className="fb-buddy-check-badge">{copy.buddyChecklistBadge[check.status]}</span>
            </div>

            <p className="fb-buddy-check-evidence">{check.evidence}</p>
            <div className="fb-buddy-next">
              <strong>{copy.buddyChecklistStatusText[check.status]}</strong>
              <span>{check.helperText}</span>
            </div>

            <ul className="fb-buddy-guide">
              {check.guide.slice(0, 3).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function CareActionsPanel({
  actions,
  isWindows,
  onRunAction
}: {
  actions: CareAction[];
  isWindows: boolean;
  onRunAction: (action: ActionItem) => void;
}) {
  return (
    <section className="fb-care-panel" aria-labelledby="care-actions-title">
      <div className="fb-care-panel-head">
        <h2 id="care-actions-title" className="fb-h2">
          {copy.careActionsTitle}
        </h2>
        <p>{copy.careActionsLede}</p>
      </div>
      <div className="fb-care-grid">
        {actions.map((action) => (
          <article key={action.id} className={`fb-care-card ${careStatusClass(action.status)}`}>
            <div className="fb-care-card-top">
              <span>{CARE_CATEGORY_LABEL[action.category]}</span>
              <strong>{copy.careActionBadge[action.status]}</strong>
            </div>
            <h3>{action.title}</h3>
            <p>{action.evidence}</p>
            <small>{action.safetyNote}</small>
            {action.command && isWindows ? (
              <button type="button" className="fb-care-action-btn" onClick={() => onRunAction(action)}>
                {action.cta}
              </button>
            ) : (
              <em>{isWindows ? "지금은 실행 준비가 어려워요." : "Windows에서 진행"}</em>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AppInventoryRow({ item }: { item: AppInventoryItem }) {
  return (
    <li className={`fb-app-inventory-row fb-app-inventory-attention-${item.attention}`}>
      <div className="fb-app-inventory-name">
        <strong>{item.name}</strong>
        <span>{[item.publisher, item.version].filter(Boolean).join(" · ") || "제조사 정보 없음"}</span>
      </div>
      <div className="fb-app-inventory-meta">
        <span>{item.attentionLabel}</span>
        <small>{item.reason}</small>
      </div>
    </li>
  );
}

function AppInventoryGroupCard({ group }: { group: AppInventoryGroup }) {
  return (
    <article className="fb-app-inventory-group">
      <div className="fb-app-inventory-group-head">
        <h3>{group.label}</h3>
        <span>{group.count}개</span>
      </div>
      <ul className="fb-app-inventory-list">
        {group.items.map((item) => (
          <AppInventoryRow key={`${group.category}-${item.name}-${item.publisher ?? ""}`} item={item} />
        ))}
      </ul>
    </article>
  );
}

function AppInventoryPanel({ groups, total, classified, needsCheck }: {
  groups: AppInventoryGroup[];
  total: number;
  classified: number;
  needsCheck: number;
}) {
  return (
    <section className="fb-app-inventory" aria-labelledby="app-inventory-title">
      <div className="fb-app-inventory-head">
        <div>
          <h2 id="app-inventory-title" className="fb-h2">
            {copy.appInventoryTitle}
          </h2>
          <p>{copy.appInventoryLede}</p>
        </div>
        <div className="fb-app-inventory-summary" aria-label="앱 분류 요약">
          <strong>{total}</strong>
          <span>설치 앱</span>
        </div>
      </div>
      <div className="fb-app-inventory-stats">
        <span>{classified}개 분류됨</span>
        <span>{needsCheck}개 확인 추천</span>
        <span>{copy.appInventoryCoverageNote}</span>
      </div>
      <div className="fb-app-inventory-groups">
        {groups.map((group) => (
          <AppInventoryGroupCard key={group.category} group={group} />
        ))}
      </div>
    </section>
  );
}

function CleanupCandidateCard({
  candidate,
  ignored,
  onToggleIgnore
}: {
  candidate: CleanupCandidate;
  ignored: boolean;
  onToggleIgnore: (id: string, ignored: boolean) => void;
}) {
  return (
    <article className={`fb-cleanup-candidate ${cleanupStatusClass(candidate.status)}${ignored ? " fb-cleanup-ignored" : ""}`}>
      <div className="fb-cleanup-candidate-top">
        <h3>{candidate.title}</h3>
        <span>{ignored ? "숨김" : copy.cleanupStatusBadge[candidate.status]}</span>
      </div>
      <p>{candidate.evidence}</p>
      <div className="fb-cleanup-candidate-meta">
        {candidate.sizeGb !== undefined && <strong>{formatGb(candidate.sizeGb)}</strong>}
        {candidate.count !== undefined && <strong>{candidate.count}개</strong>}
      </div>
      <small>{candidate.action}</small>
      <em>{candidate.safetyNote}</em>
      <button type="button" className="fb-cleanup-ignore-btn" onClick={() => onToggleIgnore(candidate.id, !ignored)}>
        {ignored ? copy.ignoreRemove : copy.ignoreAdd}
      </button>
    </article>
  );
}

function LargeFileRow({ file }: { file: LargeFileCandidate }) {
  return (
    <li className="fb-cleanup-detail-row">
      <div>
        <strong>{file.name}</strong>
        <span>
          {friendlyFolderName(file.folderName)} · {FILE_KIND_LABEL[file.kind]}
        </span>
      </div>
      <b>{formatGb(file.sizeGb)}</b>
    </li>
  );
}

function DuplicateRow({ group }: { group: DuplicateFileCandidateGroup }) {
  return (
    <li className="fb-cleanup-detail-row">
      <div>
        <strong>{group.name}</strong>
        <span>
          같은 이름과 크기 {group.count}개 · 후보 위치 {group.paths.length}곳
        </span>
      </div>
      <b>{formatGb(group.totalWastedGb)}</b>
    </li>
  );
}

function CleanupCenterPanel({
  cleanup,
  ignoreList,
  onToggleIgnore
}: {
  cleanup: ScanResult["recommendation"]["cleanupCenter"];
  ignoreList: IgnoreListState;
  onToggleIgnore: (id: string, ignored: boolean) => void;
}) {
  const largeFiles = cleanup.largeFiles.slice(0, 8);
  const duplicateGroups = cleanup.duplicateGroups.slice(0, 6);
  const startupItems = cleanup.startupItems.slice(0, 8);
  const hasDetail = largeFiles.length > 0 || duplicateGroups.length > 0 || startupItems.length > 0;

  return (
    <section className="fb-cleanup-center" aria-labelledby="cleanup-center-title">
      <div className="fb-cleanup-center-head">
        <div>
          <h2 id="cleanup-center-title" className="fb-h2">
            {copy.cleanupCenterTitle}
          </h2>
          <p>{copy.cleanupCenterLede}</p>
        </div>
        <div className="fb-cleanup-center-summary" aria-label="정리 후보 요약">
          <strong>{formatGb(cleanup.reclaimableGb)}</strong>
          <span>정리 후보</span>
        </div>
      </div>

      <p className="fb-cleanup-center-counts">
        {copy.cleanupCenterSummary(cleanup.reclaimableGb, cleanup.reviewCount)}
      </p>
      <p className="fb-cleanup-center-note">{copy.cleanupCenterCoverageNote}</p>

      <div className="fb-cleanup-candidate-grid">
        {cleanup.candidates.map((candidate) => (
          <CleanupCandidateCard
            key={candidate.id}
            candidate={candidate}
            ignored={ignoreList.cleanupItemIds.includes(candidate.id)}
            onToggleIgnore={onToggleIgnore}
          />
        ))}
      </div>
      <p className="fb-cleanup-ignore-note">{copy.ignoreListNote}</p>

      {hasDetail ? (
        <div className="fb-cleanup-detail-grid">
          {largeFiles.length > 0 && (
            <article className="fb-cleanup-detail-card">
              <h3>{copy.cleanupLargeFilesTitle}</h3>
              <ul>
                {largeFiles.map((file) => (
                  <LargeFileRow key={`${file.path}-${file.sizeGb}`} file={file} />
                ))}
              </ul>
            </article>
          )}

          {duplicateGroups.length > 0 && (
            <article className="fb-cleanup-detail-card">
              <h3>{copy.cleanupDuplicatesTitle}</h3>
              <ul>
                {duplicateGroups.map((group) => (
                  <DuplicateRow key={`${group.name}-${group.sizeGb}-${group.count}`} group={group} />
                ))}
              </ul>
            </article>
          )}

          {startupItems.length > 0 && (
            <article className="fb-cleanup-detail-card">
              <h3>{copy.cleanupStartupTitle}</h3>
              <ul>
                {startupItems.map((item, index) => (
                  <li key={`${item.name ?? "startup"}-${item.location ?? ""}-${index}`} className="fb-cleanup-detail-row">
                    <div>
                      <strong>{item.name || "이름 없는 시작 앱"}</strong>
                      <span>{item.location || "시작 앱 목록"}</span>
                    </div>
                    <b>{item.user || "PC"}</b>
                  </li>
                ))}
              </ul>
            </article>
          )}
        </div>
      ) : (
        <p className="fb-cleanup-empty-detail">{copy.cleanupNoDetail}</p>
      )}
    </section>
  );
}

function SafetyPreviewPanel({ result }: { result: ScanResult }) {
  const { report, recommendation } = result;
  const safeItems = recommendation.cleanupCenter.candidates.filter((c) => c.status === "ready" || c.id === "temporary-files");
  const reviewItems = recommendation.cleanupCenter.candidates.filter((c) => c.status === "review" && c.id !== "temporary-files");
  const leftovers = (report.appDataCandidates ?? []).filter((c) => c.exists);

  return (
    <section className="fb-safety-preview" aria-labelledby="safety-preview-title">
      <div className="fb-safety-preview-head">
        <h2 id="safety-preview-title" className="fb-h2">{copy.safetyPreviewTitle}</h2>
        <p>{copy.safetyPreviewLede}</p>
      </div>
      <div className="fb-safety-preview-grid">
        <article>
          <span>{copy.safetyPreviewSafe}</span>
          <strong>{safeItems.length}개</strong>
          <p>Windows가 다시 만들 수 있는 임시 파일 위주로 먼저 봐요.</p>
        </article>
        <article>
          <span>{copy.safetyPreviewReview}</span>
          <strong>{reviewItems.length}개</strong>
          <p>큰 파일, 중복 의심, 이전 Windows 파일은 직접 확인이 먼저예요.</p>
        </article>
        <article>
          <span>{copy.safetyPreviewLeftovers}</span>
          <strong>{leftovers.length}개</strong>
          <p>앱 데이터 폴더 후보만 보여줘요. 자동 삭제하지 않아요.</p>
        </article>
      </div>
      {leftovers.length > 0 && (
        <ul className="fb-safety-leftovers">
          {leftovers.slice(0, 5).map((item) => (
            <li key={`${item.app}-${item.path}`}>
              <strong>{item.app}</strong>
              <span>{formatGb(item.sizeGb)} · {item.path}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryComparePanel({ appState }: { appState?: AppStateSnapshot }) {
  const comparison = appState?.comparison;
  if (!comparison?.current) return null;
  const previous = comparison.previous;
  const showDelta = (value?: number, suffix = "") => {
    if (value === undefined) return "첫 기록";
    if (value === 0) return `변화 없음${suffix}`;
    return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${suffix}`;
  };

  return (
    <section className="fb-history-compare" aria-labelledby="history-compare-title">
      <div className="fb-history-compare-head">
        <h2 id="history-compare-title" className="fb-h2">{copy.compareTitle}</h2>
        <p>{previous ? "지난 점검과 달라진 부분만 짧게 보여드릴게요." : copy.compareFirstRun}</p>
      </div>
      <div className="fb-history-compare-grid">
        <article>
          <span>포맷 추천 점수</span>
          <strong>{comparison.current.score}점</strong>
          <p>{showDelta(comparison.scoreDelta, "점")}</p>
        </article>
        <article>
          <span>정리 후보</span>
          <strong>{formatGb(comparison.current.reclaimableGb)}</strong>
          <p>{showDelta(comparison.reclaimableDeltaGb, "GB")}</p>
        </article>
        <article>
          <span>직접 확인</span>
          <strong>{comparison.current.directCheckCount}개</strong>
          <p>{showDelta(comparison.directCheckDelta, "개")}</p>
        </article>
        <article>
          <span>주의 항목</span>
          <strong>{comparison.current.warningCount}개</strong>
          <p>{showDelta(comparison.warningDelta, "개")}</p>
        </article>
      </div>
    </section>
  );
}

function SmartCareOverview({ result, appState }: { result: ScanResult; appState?: AppStateSnapshot }) {
  const { report, recommendation } = result;
  const cleanup = recommendation.cleanupCenter;
  const security = recommendation.healthPillars.find((p) => p.id === "security");
  const performance = recommendation.healthPillars.find((p) => p.id === "performance");
  const backup = recommendation.healthPillars.find((p) => p.id === "backup");
  const directChecks = recommendation.buddyChecklist.filter((i) => i.status === "needs_user").length;
  const warnings = recommendation.buddyChecklist.filter((i) => i.status === "warning").length;
  const startupCount = cleanup.startupItems.length || report.startupPrograms?.count || 0;

  const routes = [
    {
      label: "정리",
      value: formatGb(cleanup.reclaimableGb),
      detail: cleanup.reviewCount > 0 ? `${cleanup.reviewCount}개 후보를 직접 보면 돼요.` : "크게 지울 후보가 적어요.",
      status: cleanup.reviewCount > 0 ? "check" : "good"
    },
    {
      label: "보안",
      value: security ? copy.healthStatus[security.status] : "확인 필요",
      detail: security?.summary ?? "Windows 보안 상태를 한 번 더 확인해주세요.",
      status: security?.status ?? "check"
    },
    {
      label: "속도",
      value: startupCount > 0 ? `${startupCount}개 시작 앱` : "괜찮아요",
      detail: performance?.summary ?? "시작 앱과 저장 공간을 같이 보면 좋아요.",
      status: performance?.status ?? "good"
    },
    {
      label: "앱",
      value: `${recommendation.appInventory.needsCheck}개 확인`,
      detail: `${recommendation.appInventory.total}개 설치 앱을 분류했어요.`,
      status: recommendation.appInventory.needsCheck > 0 ? "check" : "good"
    },
    {
      label: "포맷 준비",
      value: `${directChecks + warnings}개 확인`,
      detail: backup?.summary ?? "인증서, 파일, 계정을 포맷 전에 챙겨요.",
      status: warnings > 0 ? "action" : directChecks > 0 ? "check" : "good"
    }
  ] as const;

  const nextActions = [
    cleanup.reviewCount > 0 ? `정리 후보 ${cleanup.reviewCount}개를 먼저 훑어보세요.` : "정리 후보는 가볍게만 확인하면 돼요.",
    warnings > 0 ? `주의 항목 ${warnings}개는 그냥 넘기기 전에 확인해주세요.` : `${directChecks}개 직접 확인 항목을 차례대로 보면 돼요.`,
    recommendation.appInventory.needsCheck > 0
      ? `앱 ${recommendation.appInventory.needsCheck}개는 계정·라이선스·복원 여부를 확인해주세요.`
      : "앱 쪽은 크게 챙길 후보가 적어요."
  ];

  return (
    <section className="fb-smart-care" aria-labelledby="smart-care-title">
      <div className="fb-smart-care-head">
        <div>
          <h2 id="smart-care-title" className="fb-h2">
            {copy.smartCareTitle}
          </h2>
          <p>{copy.smartCareLede}</p>
        </div>
        <span>{copy.recommendSeverity[recommendation.severity].chip}</span>
      </div>

      <div className="fb-smart-route-grid">
        {routes.map((route) => (
          <article key={route.label} className={`fb-smart-route ${smartStatusClass(route.status)}`}>
            <div className="fb-smart-route-label">{route.label}</div>
            <strong>{route.value}</strong>
            <p>{route.detail}</p>
          </article>
        ))}
      </div>

      <div className="fb-smart-next">
        <div>
          <h3>{copy.smartCareNextTitle}</h3>
          <p>{copy.smartCarePrivacyNote}</p>
        </div>
        <ol>
          {nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </div>

      {appState?.monitor && (
        <div className="fb-smart-monitor-strip">
          <strong>{copy.monitorTitle}</strong>
          <span>{appState.monitor.message}</span>
          {appState.monitor.lastScanAt && <b>마지막 점검 {appState.monitor.staleDays ?? 0}일 전</b>}
        </div>
      )}
    </section>
  );
}

export function Report({ result, onBack, appPlatform = "unknown", appState, onOpenCleanup, onOpenAppManager, onOpenSecurity, onRescan }: ReportProps) {
  const { report, recommendation } = result;
  const isWindows = appPlatform === "win32";
  const initialIgnoreList = appState?.ignoreList ?? result.appState?.ignoreList ?? { cleanupItemIds: [], pathHints: [] };
  const [ignoreList, setIgnoreList] = useState<IgnoreListState>(initialIgnoreList);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [manifestStatus, setManifestStatus] = useState<string | null>(null);
  const [manifestRunning, setManifestRunning] = useState(false);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [driverRunning, setDriverRunning] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<string | null>(null);
  const [wifiRunning, setWifiRunning] = useState(false);
  const [wifiIncludePasswords, setWifiIncludePasswords] = useState(false);

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
    const res = await window.fb.exportReport(report, { defaultFileName: "포맷버디_문제해결용_자세한파일.json" });
    if (res.saved && res.path) setExportStatus(`${copy.reportSavedPrefix}${res.path}`);
    else setExportStatus(copy.reportSaveCancelled);
  }, [report]);

  const onExportHtml = useCallback(async () => {
    if (!window.fb?.exportHtmlReport) return;
    setExportStatus(null);
    const res = await window.fb.exportHtmlReport(report, recommendation);
    if (res.saved && res.path)
      setExportStatus(`${copy.reportHtmlSavedPrefix}${res.path}`);
    else setExportStatus(copy.reportHtmlCancelled);
  }, [report, recommendation]);

  const onOpenWeb = useCallback(async () => {
    if (!window.fb) return;
    await window.fb.openWebReport();
  }, []);

  const [runStatus, setRunStatus] = useState<string | null>(null);
  const runAction = useCallback(async (action: ActionItem) => {
    if (!action.command || !window.fb?.runActionCommand) return;
    setRunStatus(null);
    const res = await window.fb.runActionCommand(action.command);
    if (res.mode === "opened-url") setRunStatus(copy.recommendRunOpenedToast);
    else if (res.mode === "copied-to-clipboard") setRunStatus(copy.recommendRunCopiedToast);
    else setRunStatus(copy.recommendRunRejectedToast);
  }, []);

  const onToggleIgnore = useCallback(async (id: string, ignored: boolean) => {
    setIgnoreList((prev) => {
      const values = new Set(prev.cleanupItemIds);
      if (ignored) values.add(id);
      else values.delete(id);
      return { ...prev, cleanupItemIds: Array.from(values), updatedAt: new Date().toISOString() };
    });
    if (window.fb?.updateIgnoreList) {
      const next = await window.fb.updateIgnoreList({ kind: "cleanup", id, ignored });
      setIgnoreList(next);
    }
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

  const onBackupDrivers = useCallback(async () => {
    if (!window.fb?.backupDrivers) return;
    setDriverStatus(null);
    setDriverRunning(true);
    try {
      const r = await window.fb.backupDrivers();
      setDriverStatus(r.summary);
    } catch (e) {
      setDriverStatus((e as Error).message);
    } finally {
      setDriverRunning(false);
    }
  }, []);

  const onExportWifi = useCallback(async () => {
    if (!window.fb?.exportWifiProfiles) return;
    setWifiStatus(null);
    setWifiRunning(true);
    try {
      const r = await window.fb.exportWifiProfiles({
        includePasswords: wifiIncludePasswords
      });
      setWifiStatus(r.summary);
    } catch (e) {
      setWifiStatus((e as Error).message);
    } finally {
      setWifiRunning(false);
    }
  }, [wifiIncludePasswords]);

  return (
    <main className="fb-report" aria-label="진단 결과">
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
        {result.source === "cache" && (
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--color-fb-blue-tint)",
              color: "var(--color-fb-blue-heavy)",
              marginTop: 8
            }}
            role="note"
            aria-label="캐시된 점검 결과"
          >
            ⚡ 캐시된 결과 — 1시간 안에 본 점검을 다시 보여드렸어요.
          </p>
        )}
        {!isWindows && <p className="fb-report-preview-note">{copy.macReportPreviewNote}</p>}
      </section>

      <section className={`fb-score-card ${severityClass(recommendation.severity)}`}>
        <div className="fb-score-card-head">
          <div className="fb-score-card-text">
            <div className="fb-score-card-label">{copy.recommendSectionTitle}</div>
            <div className="fb-score-card-value">
              <span className="fb-score-card-num">{recommendation.formatScore}</span>
              <span className="fb-score-card-unit">{copy.recommendScoreSuffix}</span>
            </div>
            <div className="fb-score-card-headline">{recommendation.headline}</div>
            <div className="fb-score-card-badge">
              <span className="fb-score-card-badge-dot" />
              {copy.recommendSeverity[recommendation.severity].chip}
            </div>
          </div>
          <div className="fb-score-card-buddy">
            <CloudBuddy
              size={88}
              variant="primary"
              expression={expressionForScore(recommendation.formatScore)}
              animated={recommendation.severity === "safe"}
            />
          </div>
        </div>
        <p className="fb-score-card-summary">{recommendation.summary}</p>
      </section>

      <section
        aria-labelledby="category-scores-title"
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 8 }}>
          <h2 id="category-scores-title" className="fb-h2">
            축별 점수
          </h2>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            정리·보안·속도·디스크 네 축으로 나눠봤어요. 숫자가 낮을수록 좋아요.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10
          }}
        >
          {(
            [
              { id: "cleanup", label: "정리", value: recommendation.categoryScores.cleanup },
              { id: "security", label: "보안", value: recommendation.categoryScores.security },
              {
                id: "performance",
                label: "속도",
                value: recommendation.categoryScores.performance
              },
              { id: "disk", label: "디스크", value: recommendation.categoryScores.disk }
            ] as const
          ).map((axis) => {
            const tone =
              axis.value <= 25
                ? "var(--color-fb-tone-safe)"
                : axis.value <= 50
                  ? "var(--color-fb-tone-watch)"
                  : axis.value <= 75
                    ? "var(--color-fb-tone-organize)"
                    : "var(--color-fb-tone-format)";
            const verdict =
              axis.value <= 25
                ? "괜찮아요"
                : axis.value <= 50
                  ? "한 번 보면 좋아요"
                  : axis.value <= 75
                    ? "정리가 필요해요"
                    : "꼭 챙길게요";
            return (
              <article
                key={axis.id}
                className="fb-card fb-card-hover"
                style={{ borderLeft: `4px solid ${tone}` }}
              >
                <div style={{ fontSize: 12, opacity: 0.65 }}>{axis.label}</div>
                <strong style={{ fontSize: 26 }}>{axis.value}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>{verdict}</div>
              </article>
            );
          })}
        </div>
      </section>

      <SmartCareOverview result={result} appState={appState ?? result.appState} />

      <section
        className="fb-report-next-steps"
        aria-labelledby="report-next-steps-title"
        style={{ marginTop: 24 }}
      >
        <div style={{ marginBottom: 12 }}>
          <h2 id="report-next-steps-title" className="fb-h2">
            {copy.nextStepsTitle}
          </h2>
          <p style={{ opacity: 0.75 }}>{copy.nextStepsLede}</p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          {onOpenCleanup && (
            <article className="fb-card fb-card-hover">
              <h3 style={{ marginTop: 0 }}>{copy.nextStepsCleanup}</h3>
              <p style={{ fontSize: 13 }}>{copy.nextStepsCleanupHint}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenCleanup(report)}
                disabled={!isWindows}
              >
                {isWindows ? "열기" : "Windows 전용"}
              </Button>
            </article>
          )}
          {onOpenAppManager && (
            <article className="fb-card fb-card-hover">
              <h3 style={{ marginTop: 0 }}>{copy.nextStepsApps}</h3>
              <p style={{ fontSize: 13 }}>{copy.nextStepsAppsHint}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenAppManager}
                disabled={!isWindows}
              >
                {isWindows ? "열기" : "Windows 전용"}
              </Button>
            </article>
          )}
          {onOpenSecurity && (
            <article className="fb-card fb-card-hover">
              <h3 style={{ marginTop: 0 }}>{copy.nextStepsSecurity}</h3>
              <p style={{ fontSize: 13 }}>{copy.nextStepsSecurityHint}</p>
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenSecurity}
                disabled={!isWindows}
              >
                {isWindows ? "열기" : "Windows 전용"}
              </Button>
            </article>
          )}
          <article className="fb-card fb-card-hover">
            <h3 style={{ marginTop: 0 }}>{copy.nextStepsReport}</h3>
            <p style={{ fontSize: 13 }}>{copy.nextStepsReportHint}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="primary" size="sm" onClick={onExportHtml}>
                HTML 저장
              </Button>
              <Button variant="ghost" size="sm" onClick={onExport}>
                JSON 저장
              </Button>
            </div>
          </article>
          {onRescan && (
            <article className="fb-card fb-card-hover">
              <h3 style={{ marginTop: 0 }}>{copy.nextStepsRescan}</h3>
              <p style={{ fontSize: 13 }}>{copy.nextStepsRescanHint}</p>
              <Button variant="primary" size="sm" onClick={onRescan}>
                다시 점검
              </Button>
            </article>
          )}
        </div>
      </section>

      <HistoryComparePanel appState={appState ?? result.appState} />

      <SafetyPreviewPanel result={result} />

      <CleanupCenterPanel cleanup={recommendation.cleanupCenter} ignoreList={ignoreList} onToggleIgnore={onToggleIgnore} />

      <BuddyChecklistPanel items={recommendation.buddyChecklist} />

      <CareActionsPanel
        actions={recommendation.careActions}
        isWindows={isWindows}
        onRunAction={runAction}
      />

      <AppInventoryPanel
        groups={recommendation.appInventory.groups}
        total={recommendation.appInventory.total}
        classified={recommendation.appInventory.classified}
        needsCheck={recommendation.appInventory.needsCheck}
      />

      <section className="fb-health-panel" aria-labelledby="health-panel-title">
        <div className="fb-health-panel-head">
          <div>
            <h2 id="health-panel-title" className="fb-h2">
              {copy.healthSectionTitle}
            </h2>
            <p>{copy.healthSectionLede}</p>
          </div>
        </div>
        <div className="fb-health-grid">
          {recommendation.healthPillars.map((pillar) => (
            <HealthPillarCard
              key={pillar.id}
              pillar={pillar}
              isWindows={isWindows}
              onRunAction={runAction}
            />
          ))}
        </div>
      </section>

      <section className="fb-report-advice">
        <article className="fb-card fb-card-hover">
          <h3>{copy.recommendTryFirstTitle}</h3>
          <ul className="fb-advice-list">
            {recommendation.tryFirst.map((a, i) => (
              <li key={`tf-${i}`}>
                <strong>{a.title}</strong>
                <span>{a.description}</span>
                {a.command && isWindows && (
                  <div className="fb-advice-cmd-row">
                    <span className="fb-advice-cmd-hint">{copy.recommendCommandHint}</span>
                    <button
                      type="button"
                      className="fb-run-btn"
                      aria-label={`${a.title} — ${copy.recommendRunButton}`}
                      onClick={() => void runAction(a)}
                    >
                      {copy.recommendRunButton}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="fb-card fb-card-hover">
          <h3>{copy.recommendFormatReasonsTitle}</h3>
          {recommendation.formatReasons.length === 0 ? (
            <p className="fb-report-card-explain">{copy.recommendNoReasons}</p>
          ) : (
            <ul className="fb-advice-list">
              {recommendation.formatReasons.map((r, i) => {
                const heavy = r.weightedScore >= HEAVY_REASON_THRESHOLD;
                return (
                  <li key={`fr-${i}`}>
                    <strong>
                      <TooltipDetail
                        label={r.label}
                        title={`${r.label} 쉽게 보기`}
                        body={r.help ?? r.description}
                      />{" "}
                      <span className={`fb-advice-weight${heavy ? " fb-advice-weight-heavy" : ""}`}>
                        +{r.weightedScore.toFixed(1)}
                      </span>
                    </strong>
                    <span>{r.description}</span>
                    {r.nextStep && <span className="fb-advice-next">다음: {r.nextStep}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="fb-card fb-card-hover">
          <h3>{copy.recommendAfterFormatTitle}</h3>
          <ul className="fb-advice-list">
            {recommendation.afterFormat.map((a, i) => (
              <li key={`af-${i}`}>
                <strong>{a.title}</strong>
                <span>{a.description}</span>
                {a.command && isWindows && (
                  <div className="fb-advice-cmd-row">
                    <span className="fb-advice-cmd-hint">{copy.recommendCommandHint}</span>
                    <button
                      type="button"
                      className="fb-run-btn"
                      aria-label={`${a.title} — ${copy.recommendRunButton}`}
                      onClick={() => void runAction(a)}
                    >
                      {copy.recommendRunButton}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </article>
      </section>

      {runStatus && (
        <div className="fb-run-status" role="status" aria-live="polite">
          {runStatus}
        </div>
      )}

      <section className="fb-report-grid">
        <article className="fb-card fb-card-hover">
          <h3>이 PC</h3>
          <Row label="모델" value={`${report.system.manufacturer ?? "—"} ${report.system.model ?? ""}`.trim() || "—"} />
          <Row label="운영체제" value={report.system.osCaption ?? "—"} />
          <Row label="CPU" value={report.system.cpu ?? "—"} />
          <Row label="메모리" value={formatGb(report.system.memoryGb)} />
        </article>

        <article className="fb-card fb-card-hover">
          <h3>저장 공간</h3>
          <Row label="총 용량" value={formatGb(totalDiskGb)} />
          <Row label="여유 공간" value={formatGb(totalFreeGb)} />
          {report.disks.map((d) => (
            <Row key={d.drive} label={d.drive} value={`${formatGb(d.sizeGb)} (여유 ${formatGb(d.freeGb)})`} />
          ))}
        </article>

        <article className="fb-card fb-card-hover">
          <h3>같이 챙길 것</h3>
          <Row label="공동인증서 후보" value={npkiFound > 0 ? `${npkiFound}곳 발견` : "찾지 못했어요"} />
          <Row label="클라우드 동기화" value={cloudFound > 0 ? `${cloudFound}개 연결됨` : "연결 없음"} />
          <Row label="Wi-Fi 프로필" value={`${wifiCount}개`} />
          <Row label="BitLocker" value={report.bitlocker.length > 0 ? "암호화 볼륨 있음" : "확인 필요"} />
        </article>

        <article className="fb-card fb-card-hover">
          <h3>설치된 앱 / 드라이버</h3>
          <Row label="설치된 앱" value={`${installedCount}개`} />
          <Row label="드라이버" value={`${driverCount}개`} />
          <Row label="앱 자동 설치 준비" value={report.winget.available ? "가능" : "어려움"} />
          <Row label="프린터" value={`${report.printers.length}개`} />
        </article>

        <article className="fb-card fb-card-hover">
          <h3>사용자 폴더</h3>
          {report.userFolders.map((f) => (
            <Row key={f.name} label={friendlyFolderName(f.name)} value={formatGb(f.sizeGb)} />
          ))}
        </article>

        <article className="fb-card fb-card-hover">
          <h3>{copy.wingetSectionTitle}</h3>
          {report.winget.available ? (
            <p className="fb-report-card-explain">
              {copy.wingetSummary(wingetPackageCount)}
            </p>
          ) : (
            <p className="fb-report-card-explain">{copy.wingetUnavailable}</p>
          )}
          <Row label="앱 자동 설치 준비" value={report.winget.available ? "가능" : "어려움"} />
          <Row label="정리된 앱" value={`${wingetPackageCount}개`} />
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
            disabled={!isWindows || manifestRunning}
          >
            {!isWindows
              ? copy.manifestWindowsOnly
              : manifestRunning
                ? copy.manifestExportInProgress
                : copy.manifestExportCta}
          </Button>
          {!isWindows && <p className="fb-report-cta-status">{copy.macReportPreviewNote}</p>}
          {manifestStatus && <p className="fb-report-cta-status">{manifestStatus}</p>}
        </div>
      </section>

      <section className="fb-report-manifest" aria-labelledby="format-prep-title">
        <h2 id="format-prep-title" className="fb-h2">
          포맷 전에 같이 챙길 백업
        </h2>
        <p className="fb-lede">
          드라이버는 pnputil, Wi-Fi 프로필은 netsh로 사용자가 고른 폴더에만 저장해요. Windows 외에는
          준비만 보여드려요.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12
          }}
        >
          <article className="fb-card fb-card-hover">
            <h3 style={{ marginTop: 0 }}>드라이버 백업</h3>
            <p style={{ fontSize: 13 }}>
              네트워크·프린터·지문인식 같은 제3자 드라이버를 사용자가 고른 폴더에 모아둬요. 포맷
              후 같은 폴더로 다시 설치할 수 있어요.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={onBackupDrivers}
              disabled={!isWindows || driverRunning}
            >
              {!isWindows
                ? "Windows 전용"
                : driverRunning
                  ? "백업 중이에요..."
                  : "드라이버 백업"}
            </Button>
            {driverStatus && (
              <p style={{ fontSize: 13, marginTop: 8 }}>{driverStatus}</p>
            )}
          </article>

          <article className="fb-card fb-card-hover">
            <h3 style={{ marginTop: 0 }}>Wi-Fi 프로필 백업</h3>
            <p style={{ fontSize: 13 }}>
              저장된 Wi-Fi 프로필을 XML로 내보내요. 비밀번호는 기본으로 빼고, 필요할 때만 평문 포함해요.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                marginBottom: 8
              }}
            >
              <input
                type="checkbox"
                checked={wifiIncludePasswords}
                onChange={(e) => setWifiIncludePasswords(e.target.checked)}
                disabled={wifiRunning}
              />
              <span>비밀번호 평문 포함 (위험 — 파일이 새면 회선이 노출됨)</span>
            </label>
            <Button
              variant="primary"
              size="md"
              onClick={onExportWifi}
              disabled={!isWindows || wifiRunning}
            >
              {!isWindows
                ? "Windows 전용"
                : wifiRunning
                  ? "백업 중이에요..."
                  : wifiIncludePasswords
                    ? "Wi-Fi 프로필 백업 (비밀번호 포함)"
                    : "Wi-Fi 프로필 백업"}
            </Button>
            {wifiStatus && <p style={{ fontSize: 13, marginTop: 8 }}>{wifiStatus}</p>}
          </article>
        </div>
      </section>

      <section className="fb-report-cta">
        {onOpenCleanup && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => onOpenCleanup(report)}
            disabled={!isWindows}
          >
            {isWindows ? "안전 정리 시작" : "안전 정리는 Windows 전용"}
          </Button>
        )}
        {onOpenAppManager && (
          <Button
            variant="primary"
            size="lg"
            onClick={onOpenAppManager}
            disabled={!isWindows}
          >
            {isWindows ? "앱 정리 시작" : "앱 정리는 Windows 전용"}
          </Button>
        )}
        {onOpenSecurity && (
          <Button
            variant="primary"
            size="lg"
            onClick={onOpenSecurity}
            disabled={!isWindows}
          >
            {isWindows ? "보안 점검 열기" : "보안 점검은 Windows 전용"}
          </Button>
        )}
        <Button variant="primary" size="lg" onClick={onExportHtml}>
          {copy.reportExportHtmlCta}
        </Button>
        <Button variant="secondary" size="lg" onClick={onOpenWeb}>
          {copy.reportOpenWebCta}
        </Button>
        <Button variant="ghost" size="lg" onClick={onExport}>
          {copy.reportExportCta}
        </Button>
        {exportStatus && <p className="fb-report-cta-status">{exportStatus}</p>}
      </section>

      <section className="fb-report-meta">
        <small>리포트 만든 시각: {new Date(report.generatedAt).toLocaleString("ko-KR")}</small>
        <small>로컬에서만 만들어졌어요</small>
      </section>
    </main>
  );
}
