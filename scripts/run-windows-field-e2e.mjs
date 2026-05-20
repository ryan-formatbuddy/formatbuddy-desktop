#!/usr/bin/env node
import { spawn } from "node:child_process";
import { join } from "node:path";

const projectRoot = process.cwd();
const vitestPath = join(projectRoot, "node_modules", "vitest", "vitest.mjs");

if (process.platform !== "win32") {
  console.error("[field:e2e:win] Windows-only field test. Run this on a real Windows PC.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [vitestPath, "run", "tests/windows-field-e2e.test.ts"],
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
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`[field:e2e:win] ${err.message}`);
  process.exit(1);
});
