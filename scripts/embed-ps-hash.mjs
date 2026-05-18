#!/usr/bin/env node
/**
 * Compute SHA-256 of the PowerShell scan script and write it to
 * resources/powershell/script.sha256 so the packaged main process can
 * compare it at runtime before spawning.
 *
 * Runs as a `prebuild` and `predist:win` hook. Re-running is safe.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const scriptPath = join(projectRoot, "resources", "powershell", "Invoke-FormatBuddyScan.ps1");
const hashPath = join(projectRoot, "resources", "powershell", "script.sha256");

const contents = readFileSync(scriptPath);
const hash = createHash("sha256").update(contents).digest("hex");

writeFileSync(hashPath, `${hash}\n`, "utf8");

console.info(`[embed-ps-hash] ${scriptPath} → sha256 ${hash}`);
