import { app } from "electron";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Resolve the PowerShell scan script path.
 * Packaged: process.resourcesPath/powershell/Invoke-FormatBuddyScan.ps1
 * Dev: <projectRoot>/resources/powershell/Invoke-FormatBuddyScan.ps1
 */
export function getScanScriptPath(): string {
  const fileName = "Invoke-FormatBuddyScan.ps1";

  if (app.isPackaged) {
    return join(process.resourcesPath, "powershell", fileName);
  }

  const devPath = resolve(__dirname, "..", "..", "resources", "powershell", fileName);
  if (existsSync(devPath)) return devPath;

  return resolve(process.cwd(), "resources", "powershell", fileName);
}

export function getScanOutputDir(): string {
  return join(app.getPath("userData"), "scans");
}

export function getDefaultExportPath(fileName = "formatbuddy-report.json"): string {
  return join(app.getPath("desktop"), fileName);
}

export function getWebReportImportUrl(): string {
  return "https://formatbuddy.vercel.app/report/import";
}
