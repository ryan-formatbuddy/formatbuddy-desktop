import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = join(__dirname, "..");
const scriptPath = join(projectRoot, "scripts", "check-professional-readiness.mjs");

async function runReadiness(
  fieldReportDir: string,
  readinessReportDir: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        FORMATBUDDY_FIELD_E2E_REPORT_DIR: fieldReportDir,
        FORMATBUDDY_PRO_READINESS_REPORT_DIR: readinessReportDir
      }
    });
    return { code: 0, stdout: String(stdout), stderr: String(stderr) };
  } catch (err) {
    const error = err as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? "")
    };
  }
}

async function writeFieldReport(
  dir: string,
  name: string,
  payload: Record<string, unknown>
): Promise<void> {
  await writeFile(
    join(dir, name),
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        kind: "formatbuddy-windows-field-e2e",
        platform: "win32",
        status: "passed",
        requirementResults: [
          {
            description: "cleanup file enters the 30-day restore bin, restores, and auto-purges after expiry",
            status: "passed"
          }
        ],
        ...payload
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function latestReadinessReport(dir: string): Promise<Record<string, unknown>> {
  const files = (await readdir(dir))
    .filter((name) => name.startsWith("professional-readiness-"))
    .sort();
  const latest = files.at(-1);
  expect(latest).toBeTruthy();
  return JSON.parse(await readFile(join(dir, latest as string), "utf8")) as Record<string, unknown>;
}

describe("professional readiness gate", () => {
  it("blocks professional-ready claims when the latest Windows field report is not proven", async () => {
    const root = await mkdtemp(join(tmpdir(), "fb-professional-readiness-blocked-"));
    const actualFieldDir = await mkdtemp(join(root, "field-"));
    const actualReadinessDir = await mkdtemp(join(root, "readiness-"));
    await writeFieldReport(actualFieldDir, "windows-field-e2e-2026-05-21T07-27-41-629Z.json", {
      platform: "darwin",
      status: "blocked-non-windows",
      blockedReason: "Windows-only field test. Run this on a real Windows PC.",
      requirementResults: [
        {
          description: "cleanup file enters the 30-day restore bin, restores, and auto-purges after expiry",
          status: "not-proven"
        }
      ]
    });

    const result = await runReadiness(actualFieldDir, actualReadinessDir);
    const report = await latestReadinessReport(actualReadinessDir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Windows 실기 확인 필요");
    expect(report.status).toBe("blocked");
    expect(report.ready).toBe(false);
    expect(JSON.stringify(report)).toContain("blocked-non-windows");
    expect(JSON.stringify(report)).toContain("not-proven");
  });

  it("passes only when the latest Windows field report passed on Windows with all requirements proven", async () => {
    const root = await mkdtemp(join(tmpdir(), "fb-professional-readiness-passed-"));
    const actualFieldDir = await mkdtemp(join(root, "field-"));
    const actualReadinessDir = await mkdtemp(join(root, "readiness-"));
    await writeFieldReport(actualFieldDir, "windows-field-e2e-2026-05-21T07-30-00-000Z.json", {
      platform: "win32",
      status: "passed",
      requirementResults: [
        { description: "cleanup executor consumes a confirmation-token plan", status: "passed" },
        { description: "unified 30-day retention tick", status: "passed" }
      ]
    });

    const result = await runReadiness(actualFieldDir, actualReadinessDir);
    const report = await latestReadinessReport(actualReadinessDir);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("전문급 준비 확인 통과");
    expect(report.status).toBe("passed");
    expect(report.ready).toBe(true);
  });
});
