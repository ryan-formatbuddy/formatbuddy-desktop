#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const projectRoot = process.cwd();
const vitestPath = join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const testFile = "tests/windows-field-e2e.test.ts";
const startedAt = new Date().toISOString();
const evidenceRequirements = [
  "cleanup file enters the 30-day restore bin, restores, and auto-purges after expiry",
  "startup-folder item is held for 30 days and restored",
  "HKCU Run value is backed up, disabled, and restored",
  "isolated Windows scheduled scan task is registered and removed",
  "uninstall registry key is backed up, removed, and restored",
  "unified 30-day retention tick empties file, app-deletion, and startup holding bins"
];

function evidenceReportPath(finishedAt) {
  const safeTimestamp = finishedAt.replace(/[:.]/g, "-");
  const dir = process.env.FORMATBUDDY_FIELD_E2E_REPORT_DIR || join(projectRoot, "dist", "field-e2e");
  return join(dir, `windows-field-e2e-${safeTimestamp}.json`);
}

function writeEvidenceReport(payload) {
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
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [vitestPath, "run", testFile],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORMATBUDDY_WINDOWS_FIELD_E2E: "1"
    },
    stdio: "inherit",
    windowsHide: true
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[field:e2e:win] stopped by ${signal}`);
    writeEvidenceReport({
      status: "stopped",
      signal,
      exitCode: code ?? null,
      command: [process.execPath, vitestPath, "run", testFile]
    });
    process.exit(1);
  }
  writeEvidenceReport({
    status: code === 0 ? "passed" : "failed",
    exitCode: code ?? 1,
    command: [process.execPath, vitestPath, "run", testFile]
  });
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`[field:e2e:win] ${err.message}`);
  writeEvidenceReport({
    status: "spawn-error",
    exitCode: 1,
    error: err.message,
    command: [process.execPath, vitestPath, "run", testFile]
  });
  process.exit(1);
});
