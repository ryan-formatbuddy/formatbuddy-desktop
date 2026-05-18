/**
 * Per-app leftover-path catalog.
 *
 * Windows uninstallers routinely leave AppData and ProgramData behind
 * "by design" (preserves user data on reinstall). We surface those
 * leftover paths so Ryan can see what's there — but we DO NOT delete
 * them from this surface. The Phase-1 cleanup engine is the only path
 * that ever removes files; if the user later wants to add a leftover
 * to their cleanup plan they can do it from there, where the blocklist
 * already applies.
 *
 * Each entry is matched by case-insensitive substring against
 * `${app.name} ${app.publisher}`. Keep patterns narrow — false
 * positives risk pointing the user at the wrong app's data.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AppLeftoverGroup,
  AppLeftoverPath,
  AppLeftoversSnapshot,
  InstalledApp
} from "@shared/types";
import { evaluatePath, normalizePath } from "../cleanup/blocklist";

interface LeftoverRule {
  match: RegExp;
  appLabel: string;
  paths: ((env: LeftoverEnv) => string)[];
}

interface LeftoverEnv {
  home: string;
  roaming: string;
  localAppData: string;
  programData: string;
}

const RULES: LeftoverRule[] = [
  {
    match: /kakaotalk|kakao talk|카카오톡/i,
    appLabel: "KakaoTalk",
    paths: [
      ({ roaming }) => join(roaming, "KakaoTalk"),
      ({ localAppData }) => join(localAppData, "Kakao", "KakaoTalk")
    ]
  },
  {
    match: /\bchrome\b/i,
    appLabel: "Google Chrome",
    paths: [({ localAppData }) => join(localAppData, "Google", "Chrome", "User Data")]
  },
  {
    match: /\bedge\b/i,
    appLabel: "Microsoft Edge",
    paths: [({ localAppData }) => join(localAppData, "Microsoft", "Edge", "User Data")]
  },
  {
    match: /firefox/i,
    appLabel: "Mozilla Firefox",
    paths: [
      ({ roaming }) => join(roaming, "Mozilla", "Firefox"),
      ({ localAppData }) => join(localAppData, "Mozilla", "Firefox")
    ]
  },
  {
    match: /whale|naver whale/i,
    appLabel: "Naver Whale",
    paths: [({ localAppData }) => join(localAppData, "Naver", "Naver Whale", "User Data")]
  },
  {
    match: /slack/i,
    appLabel: "Slack",
    paths: [
      ({ roaming }) => join(roaming, "Slack"),
      ({ localAppData }) => join(localAppData, "slack")
    ]
  },
  {
    match: /discord/i,
    appLabel: "Discord",
    paths: [
      ({ roaming }) => join(roaming, "discord"),
      ({ localAppData }) => join(localAppData, "Discord")
    ]
  },
  {
    match: /microsoft teams|^teams$/i,
    appLabel: "Microsoft Teams",
    paths: [
      ({ roaming }) => join(roaming, "Microsoft", "Teams"),
      ({ localAppData }) => join(localAppData, "Microsoft", "Teams")
    ]
  },
  {
    match: /zoom/i,
    appLabel: "Zoom",
    paths: [
      ({ roaming }) => join(roaming, "Zoom"),
      ({ localAppData }) => join(localAppData, "Zoom")
    ]
  },
  {
    match: /spotify/i,
    appLabel: "Spotify",
    paths: [
      ({ roaming }) => join(roaming, "Spotify"),
      ({ localAppData }) => join(localAppData, "Spotify")
    ]
  },
  {
    match: /steam/i,
    appLabel: "Steam",
    paths: [({ roaming }) => join(roaming, "Steam")]
  },
  {
    match: /adobe|creative cloud/i,
    appLabel: "Adobe",
    paths: [
      ({ roaming }) => join(roaming, "Adobe"),
      ({ localAppData }) => join(localAppData, "Adobe"),
      ({ programData }) => join(programData, "Adobe")
    ]
  },
  {
    match: /visual studio code|\bvs code\b/i,
    appLabel: "Visual Studio Code",
    paths: [
      ({ roaming }) => join(roaming, "Code"),
      ({ home }) => join(home, ".vscode")
    ]
  },
  {
    match: /cursor/i,
    appLabel: "Cursor",
    paths: [
      ({ roaming }) => join(roaming, "Cursor"),
      ({ home }) => join(home, ".cursor")
    ]
  },
  {
    match: /jetbrains|intellij|pycharm|webstorm|goland/i,
    appLabel: "JetBrains",
    paths: [
      ({ roaming }) => join(roaming, "JetBrains"),
      ({ localAppData }) => join(localAppData, "JetBrains")
    ]
  }
];

export interface PlanLeftoversOptions {
  home?: string;
  env?: Partial<LeftoverEnv>;
}

function defaultEnv(home: string, override?: Partial<LeftoverEnv>): LeftoverEnv {
  const roaming =
    override?.roaming ??
    process.env.APPDATA ??
    join(home, "AppData", "Roaming");
  const localAppData =
    override?.localAppData ??
    process.env.LOCALAPPDATA ??
    join(home, "AppData", "Local");
  const programData =
    override?.programData ??
    process.env.ProgramData ??
    "C:\\ProgramData";
  return {
    home: override?.home ?? home,
    roaming,
    localAppData,
    programData
  };
}

async function pathInfo(
  raw: string,
  env: LeftoverEnv
): Promise<AppLeftoverPath> {
  const normalized = normalizePath(raw);
  // The blocklist tells us whether Cleanup engine could ever touch
  // this path. If not, we mark it `protectedBy` so the UI explains why
  // the user can't enqueue it for deletion. We're not blocking the
  // surface from showing the path — only making the protection
  // transparent.
  const decision = evaluatePath(raw, { allowRoots: [raw], home: env.home });

  let exists = false;
  let sizeBytes: number | undefined;
  let lastModifiedAt: string | undefined;
  try {
    const stat = await fs.stat(raw);
    exists = true;
    sizeBytes = stat.size;
    lastModifiedAt = stat.mtime.toISOString();
  } catch {
    exists = false;
  }

  return {
    path: raw,
    exists,
    sizeBytes,
    lastModifiedAt,
    protectedBy: decision.allowed ? undefined : decision.blockedBy ?? normalized
  };
}

export async function planAppLeftovers(
  apps: InstalledApp[],
  options: PlanLeftoversOptions = {}
): Promise<AppLeftoversSnapshot> {
  const home = options.home ?? homedir();
  const env = defaultEnv(home, options.env);

  const groups: AppLeftoverGroup[] = [];
  const seenLabels = new Set<string>();

  for (const app of apps) {
    if (!app.name) continue;
    const text = `${app.name} ${app.publisher ?? ""}`;
    const rule = RULES.find((r) => r.match.test(text));
    if (!rule) continue;
    if (seenLabels.has(rule.appLabel)) continue;
    seenLabels.add(rule.appLabel);

    const paths: AppLeftoverPath[] = [];
    for (const builder of rule.paths) {
      paths.push(await pathInfo(builder(env), env));
    }

    groups.push({
      appName: rule.appLabel,
      publisher: app.publisher,
      paths
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    groups
  };
}

export const __testing = { RULES, defaultEnv };
