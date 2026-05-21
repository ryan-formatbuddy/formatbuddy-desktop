#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const projectRoot = process.cwd();
const FIELD_REPORT_PREFIX = "windows-field-e2e-";
const FIELD_REPORT_SUFFIX = ".json";
const READINESS_REPORT_PREFIX = "professional-readiness-";
const maxBlockersToPrint = 8;

function defaultFieldReportDir() {
  return process.env.FORMATBUDDY_FIELD_E2E_REPORT_DIR || join(projectRoot, "dist", "field-e2e");
}

function defaultReadinessReportDir() {
  return (
    process.env.FORMATBUDDY_PRO_READINESS_REPORT_DIR ||
    join(projectRoot, "dist", "professional-readiness")
  );
}

function latestFieldReportPath(dir) {
  if (!existsSync(dir)) return null;
  const candidates = readdirSync(dir)
    .filter((name) => name.startsWith(FIELD_REPORT_PREFIX) && name.endsWith(FIELD_REPORT_SUFFIX))
    .sort();
  const latest = candidates.at(-1);
  return latest ? join(dir, latest) : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requirementSummary(report) {
  const results = Array.isArray(report?.requirementResults) ? report.requirementResults : [];
  const total = results.length;
  const passed = results.filter((item) => item?.status === "passed").length;
  const notProven = total - passed;
  return { total, passed, notProven };
}

function evaluateFieldEvidence(report, reportPath) {
  const blockers = [];
  const summary = requirementSummary(report);
  const kind = report?.kind;
  const status = report?.status;
  const platform = report?.platform;
  const results = Array.isArray(report?.requirementResults) ? report.requirementResults : [];

  if (kind !== "formatbuddy-windows-field-e2e") {
    blockers.push("Windows 실기 확인 필요: field E2E 증거 파일 형식이 맞지 않아요.");
  }
  if (status !== "passed") {
    blockers.push(`Windows 실기 확인 필요: 최신 field E2E 상태가 '${status ?? "unknown"}'입니다.`);
  }
  if (platform !== "win32") {
    blockers.push(`Windows 실기 확인 필요: 최신 field E2E가 Windows가 아닌 '${platform ?? "unknown"}'에서 만들어졌어요.`);
  }
  if (results.length === 0) {
    blockers.push("Windows 실기 확인 필요: 증거 파일에 요구사항별 결과가 없어요.");
  }
  for (const item of results) {
    if (item?.status !== "passed") {
      blockers.push(`Windows 실기 확인 필요: '${item?.description ?? "이름 없는 항목"}' 증거가 ${item?.status ?? "없음"} 상태입니다.`);
    }
  }

  return {
    ready: blockers.length === 0,
    status: blockers.length === 0 ? "passed" : "blocked",
    latestFieldReportPath: reportPath,
    fieldEvidence: {
      kind,
      status,
      platform,
      requirementSummary: summary
    },
    blockers
  };
}

function buildMissingReportResult(fieldReportDir) {
  return {
    ready: false,
    status: "blocked",
    latestFieldReportPath: null,
    fieldEvidence: {
      kind: null,
      status: "missing",
      platform: null,
      requirementSummary: { total: 0, passed: 0, notProven: 0 }
    },
    blockers: [
      `Windows 실기 확인 필요: '${fieldReportDir}' 안에서 field E2E 증거 파일을 찾지 못했어요.`
    ]
  };
}

function readinessReportPath(dir, generatedAt) {
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");
  return join(dir, `${READINESS_REPORT_PREFIX}${safeTimestamp}.json`);
}

function writeReadinessReport(result) {
  const generatedAt = new Date().toISOString();
  const dir = defaultReadinessReportDir();
  const reportPath = readinessReportPath(dir, generatedAt);
  const payload = {
    schemaVersion: "1.0",
    kind: "formatbuddy-professional-readiness",
    generatedAt,
    projectRoot,
    ...result
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return reportPath;
}

function main() {
  const fieldReportDir = defaultFieldReportDir();
  const reportPath = latestFieldReportPath(fieldReportDir);
  const result = reportPath
    ? evaluateFieldEvidence(readJson(reportPath), reportPath)
    : buildMissingReportResult(fieldReportDir);
  const readinessPath = writeReadinessReport(result);

  if (result.ready) {
    console.log(`전문급 준비 확인 통과: ${readinessPath}`);
    process.exit(0);
  }

  console.error(`Windows 실기 확인 필요: ${readinessPath}`);
  for (const blocker of result.blockers.slice(0, maxBlockersToPrint)) {
    console.error(`- ${blocker}`);
  }
  if (result.blockers.length > maxBlockersToPrint) {
    console.error(`- 외 ${result.blockers.length - maxBlockersToPrint}개 항목`);
  }
  process.exit(1);
}

main();
