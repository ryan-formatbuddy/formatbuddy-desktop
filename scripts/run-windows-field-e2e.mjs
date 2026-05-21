#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const projectRoot = process.cwd();
const vitestPath = join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const testFile = "tests/windows-field-e2e.test.ts";
const startedAt = new Date().toISOString();
const maxCapturedLogChars = 120_000;
const vitestCommand = [process.execPath, vitestPath, "run", testFile];
const evidenceRequirements = JSON.parse(
  readFileSync(join(projectRoot, "scripts", "windows-field-requirements.json"), "utf8")
);
const fieldProofPrefix = "[formatbuddy-field-proof] ";
const provenRequirements = new Set();
let stdoutTail = "";
let stderrTail = "";
let stdoutTruncated = false;
let stderrTruncated = false;
let proofLineRemainder = "";

function appendCapturedOutput(current, chunk) {
  const next = current + String(chunk);
  if (next.length <= maxCapturedLogChars) {
    return { text: next, truncated: false };
  }
  return {
    text: next.slice(next.length - maxCapturedLogChars),
    truncated: true
  };
}

function recordProofLine(line) {
  const markerIndex = line.indexOf(fieldProofPrefix);
  if (markerIndex === -1) return;
  const description = line.slice(markerIndex + fieldProofPrefix.length).trim();
  if (evidenceRequirements.includes(description)) {
    provenRequirements.add(description);
  }
}

function recordProofMarkers(chunk) {
  const next = `${proofLineRemainder}${String(chunk)}`;
  const lines = next.split(/\r?\n/);
  proofLineRemainder = lines.pop() ?? "";
  for (const line of lines) recordProofLine(line);
}

function flushProofMarkers() {
  if (!proofLineRemainder) return;
  recordProofLine(proofLineRemainder);
  proofLineRemainder = "";
}

function requirementResults(status) {
  return evidenceRequirements.map((description) => ({
    description,
    status: status === "passed" && provenRequirements.has(description) ? "passed" : "not-proven"
  }));
}

function evidenceReportPath(finishedAt) {
  const safeTimestamp = finishedAt.replace(/[:.]/g, "-");
  const dir = process.env.FORMATBUDDY_FIELD_E2E_REPORT_DIR || join(projectRoot, "dist", "field-e2e");
  return join(dir, `windows-field-e2e-${safeTimestamp}.json`);
}

function writeEvidenceReport(payload) {
  flushProofMarkers();
  const finishedAt = new Date().toISOString();
  const reportPath = evidenceReportPath(finishedAt);
  const report = {
    schemaVersion: "1.0",
    kind: "formatbuddy-windows-field-e2e",
    startedAt,
    finishedAt,
    projectRoot,
    platform: process.platform,
    node: process.version,
    testFile,
    requirements: evidenceRequirements,
    requirementResults: requirementResults(payload.status),
    provenRequirements: evidenceRequirements.filter((description) => provenRequirements.has(description)),
    unprovenRequirements: evidenceRequirements.filter(
      (description) => !provenRequirements.has(description)
    ),
    capturedLog: {
      maxCharsPerStream: maxCapturedLogChars,
      stdoutTail,
      stderrTail,
      stdoutTruncated,
      stderrTruncated
    },
    ...payload
  };
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.error(`[field:e2e:win] evidence report: ${reportPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[field:e2e:win] evidence report failed: ${message}`);
  }
}

if (process.platform !== "win32") {
  console.error("[field:e2e:win] Windows-only field test. Run this on a real Windows PC.");
  writeEvidenceReport({
    status: "blocked-non-windows",
    exitCode: 1,
    blockedReason: "Windows-only field test. Run this on a real Windows PC.",
    command: vitestCommand
  });
  process.exit(1);
}

const child = spawn(
  vitestCommand[0],
  vitestCommand.slice(1),
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORMATBUDDY_WINDOWS_FIELD_E2E: "1"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  }
);

child.stdout?.on("data", (chunk) => {
  process.stdout.write(chunk);
  recordProofMarkers(chunk);
  const captured = appendCapturedOutput(stdoutTail, chunk);
  stdoutTail = captured.text;
  stdoutTruncated ||= captured.truncated;
});

child.stderr?.on("data", (chunk) => {
  process.stderr.write(chunk);
  const captured = appendCapturedOutput(stderrTail, chunk);
  stderrTail = captured.text;
  stderrTruncated ||= captured.truncated;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[field:e2e:win] stopped by ${signal}`);
    writeEvidenceReport({
      status: "stopped",
      signal,
      exitCode: code ?? null,
      command: vitestCommand
    });
    process.exit(1);
  }
  writeEvidenceReport({
    status: code === 0 ? "passed" : "failed",
    exitCode: code ?? 1,
    command: vitestCommand
  });
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`[field:e2e:win] ${err.message}`);
  writeEvidenceReport({
    status: "spawn-error",
    exitCode: 1,
    error: err.message,
    command: vitestCommand
  });
  process.exit(1);
});
