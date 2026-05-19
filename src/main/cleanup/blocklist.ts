/**
 * Cleanup safety net — the last line of defense before any file is moved
 * to the recycle bin or permanently deleted.
 *
 * Design rules (do not soften without Ryan's explicit go-ahead):
 *
 *   1. Everything is a substring match against a NORMALIZED path
 *      (lowercased, backslash-only, \\?\ prefix stripped, trailing
 *      separators removed). False positives are intentional — we'd
 *      rather skip a deletable file than ever touch a sensitive one.
 *
 *   2. A path is allowed ONLY if it lives under the category's whitelist
 *      AND does not match any blocklist rule. Whitelist-without-blocklist
 *      is not enough; blocklist-without-whitelist is never reached.
 *
 *   3. Categories cannot import from each other's blocklists. A user
 *      explicitly opting into "browser cache" must not, as a side effect,
 *      unlock anything else.
 *
 *   4. BLOCKLIST_VERSION is bumped any time we change a rule. The cleanup
 *      planner stamps it into the plan, and the executor refuses to run
 *      a plan with a different version — so a stale plan from a previous
 *      app version cannot bypass new rules.
 */
import { homedir } from "node:os";
import { sep } from "node:path";
import type { CleanupCategoryId } from "@shared/types";

export const BLOCKLIST_VERSION = 3;

/**
 * Normalize a path the way every blocklist comparison must see it:
 *   - strip Win32 long-path prefix
 *   - convert forward slashes to backslashes (we always compare in
 *     Windows style because the planner targets Windows even when
 *     unit tests run on macOS via mocks)
 *   - lowercase
 *   - collapse runs of separators
 *   - drop trailing separator
 */
export function normalizePath(input: string): string {
  if (!input) return "";
  let p = input.trim();
  // \\?\C:\foo → C:\foo (long-path prefix used by some Windows APIs)
  if (p.startsWith("\\\\?\\")) p = p.slice(4);
  // Normalize separator to backslash for stable substring rules
  p = p.replace(/\//g, "\\");
  // Collapse repeated separators (but preserve a leading "\\" for UNC)
  if (p.startsWith("\\\\")) {
    p = "\\\\" + p.slice(2).replace(/\\+/g, "\\");
  } else {
    p = p.replace(/\\+/g, "\\");
  }
  // Drop trailing separator unless this is a bare drive root like "C:\"
  if (p.length > 3 && p.endsWith("\\")) p = p.slice(0, -1);
  return p.toLowerCase();
}

/**
 * Rules that apply to every cleanup category. If any of these match,
 * the file is restricted no matter which category surfaced it.
 *
 * The rule's `match` is run against the already-normalized path; the
 * rule's `label` is shown to the user (in Korean — these are surfaced
 * in the safety preview UI).
 */
interface BlockRule {
  id: string;
  label: string;
  match: (normalizedPath: string) => boolean;
}

function containsSegment(p: string, segment: string): boolean {
  const seg = segment.toLowerCase();
  return (
    p === seg ||
    p.startsWith(seg + "\\") ||
    p.includes("\\" + seg + "\\") ||
    p.endsWith("\\" + seg)
  );
}

function startsWithAny(p: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    const pre = prefix.toLowerCase();
    const childPrefix = pre.endsWith("\\") ? pre : pre + "\\";
    return p === pre || p.startsWith(childPrefix);
  });
}

const KOREAN_CERT_FOLDER_EXACT = new Set([
  "crosscert",
  "inipki",
  "kica",
  "ncasign",
  "signkorea",
  "tradesign",
  "yessign"
]);

const CHROMIUM_PROFILE_ROOT_MARKERS = [
  "\\google\\chrome\\user data",
  "\\microsoft\\edge\\user data",
  "\\naver\\naver whale\\user data"
];

function endsWithBrowserProfileRoot(p: string): boolean {
  if (
    p.endsWith("\\mozilla\\firefox") ||
    p.endsWith("\\mozilla\\firefox\\profiles")
  ) {
    return true;
  }

  return CHROMIUM_PROFILE_ROOT_MARKERS.some((marker) => {
    const at = p.indexOf(marker);
    if (at < 0) return false;
    const tail = p.slice(at + marker.length);
    if (tail === "") return true;
    const segments = tail.split("\\").filter(Boolean);
    if (segments.length !== 1) return false;
    return segments[0] === "default" || /^profile \d+$/i.test(segments[0]);
  });
}

function includesKoreanCertificateFolder(p: string): boolean {
  return p
    .split("\\")
    .filter(Boolean)
    .some((segment) => {
      const name = segment.toLowerCase();
      return (
        name.includes("npki") ||
        name.includes("공동인증서") ||
        KOREAN_CERT_FOLDER_EXACT.has(name)
      );
    });
}

/** Build the user-specific rules each time so tests can override $HOME. */
function userScopedRules(home: string): BlockRule[] {
  const userHome = normalizePath(home);
  const userRules: BlockRule[] = [];

  if (userHome) {
    const protectedUserDirs = [
      // Credentials / keys
      `${userHome}\\.ssh`,
      `${userHome}\\.gnupg`,
      `${userHome}\\.aws`,
      `${userHome}\\.docker`,
      `${userHome}\\.kube`,
      // Korean public-key infrastructure (공동인증서)
      `${userHome}\\appdata\\locallow\\npki`,
      `${userHome}\\appdata\\roaming\\npki`,
      // Browser credential stores — even a "cache" category must not
      // touch these. Cookies / Login Data live in the same folder tree
      // as Cache, so the planner whitelists ONLY explicit cache subdirs
      // and this rule covers the rest.
      `${userHome}\\appdata\\local\\google\\chrome\\user data\\default\\login data`,
      `${userHome}\\appdata\\local\\google\\chrome\\user data\\default\\cookies`,
      `${userHome}\\appdata\\local\\google\\chrome\\user data\\default\\web data`,
      `${userHome}\\appdata\\local\\microsoft\\edge\\user data\\default\\login data`,
      `${userHome}\\appdata\\local\\microsoft\\edge\\user data\\default\\cookies`,
      `${userHome}\\appdata\\local\\microsoft\\edge\\user data\\default\\web data`,
      `${userHome}\\appdata\\local\\naver\\naver whale\\user data\\default\\login data`,
      // Messenger data
      `${userHome}\\appdata\\roaming\\kakaotalk`,
      `${userHome}\\appdata\\local\\kakao`,
      // Cloud sync roots — the user is actively writing here
      `${userHome}\\onedrive`,
      `${userHome}\\dropbox`,
      `${userHome}\\google drive`,
      `${userHome}\\my drive`
    ];

    for (const dir of protectedUserDirs) {
      userRules.push({
        id: `user:${dir}`,
        label: dir,
        match: (p) => startsWithAny(p, [dir])
      });
    }
  }

  return userRules;
}

/** System paths that are never deletable, regardless of category. */
const SYSTEM_BLOCK_RULES: BlockRule[] = [
  {
    id: "system:windows-core",
    label: "Windows 시스템 폴더 (System32, SysWOW64, WindowsApps, Boot, EFI, Recovery, Fonts, Drivers)",
    match: (p) => {
      return (
        containsSegment(p, "system32") ||
        containsSegment(p, "syswow64") ||
        containsSegment(p, "windowsapps") ||
        containsSegment(p, "boot") ||
        containsSegment(p, "efi") ||
        containsSegment(p, "recovery") ||
        containsSegment(p, "drivers") ||
        // The Fonts folder lives at \Windows\Fonts. Allowed font names
        // are sometimes mistaken for cache entries by aggressive temp
        // cleaners.
        p.includes("\\windows\\fonts")
      );
    }
  },
  {
    id: "system:program-files",
    label: "Program Files (installed applications)",
    match: (p) => p.includes("\\program files\\") || p.includes("\\program files (x86)\\")
  },
  {
    id: "system:programdata-microsoft",
    label: "ProgramData\\Microsoft (Defender, certificate store)",
    match: (p) => p.includes("\\programdata\\microsoft\\")
  },
  {
    id: "system:bitlocker",
    label: "BitLocker recovery and key files",
    match: (p) => p.includes("bitlocker") || p.endsWith(".bek") || p.endsWith(".tpm")
  },
  {
    id: "system:korean-certificate-folders",
    label: "공동인증서/NPKI 보관 폴더",
    match: includesKoreanCertificateFolder
  },
  {
    id: "system:browser-profile-root",
    label: "브라우저 프로필 폴더 (비밀번호·쿠키 포함 가능)",
    match: endsWithBrowserProfileRoot
  },
  {
    id: "system:hibernation",
    label: "Hibernation / pagefile / swapfile",
    match: (p) =>
      p.endsWith("\\hiberfil.sys") ||
      p.endsWith("\\pagefile.sys") ||
      p.endsWith("\\swapfile.sys")
  },
  {
    id: "system:registry-hive",
    label: "Registry hives",
    match: (p) =>
      p.endsWith("\\ntuser.dat") ||
      p.includes("\\windows\\system32\\config\\")
  },
  {
    id: "system:certificate-stores",
    label: "Certificate stores (.pfx, .p12, .key, .pem in non-cache locations)",
    match: (p) => {
      // Bare cert files surfaced anywhere outside an explicit cache dir
      const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
      const isCert = [".pfx", ".p12", ".key", ".pem", ".cer", ".crt", ".jks"].includes(ext);
      if (!isCert) return false;
      // Allow only if the path lives under an obvious cache (the planner
      // would never produce this, but we belt-and-suspender it here)
      const isInCache =
        p.includes("\\cache\\") ||
        p.includes("\\code cache\\") ||
        p.includes("\\gpucache\\");
      return !isInCache;
    }
  },
  {
    id: "system:office-data",
    label: "Outlook / OneNote / Office data",
    match: (p) =>
      p.endsWith(".pst") ||
      p.endsWith(".ost") ||
      p.endsWith(".onepkg") ||
      p.includes("\\microsoft\\outlook\\")
  }
];

export interface BlocklistDecision {
  allowed: boolean;
  /** Human-readable rule label, populated when allowed === false. */
  blockedBy?: string;
}

export interface BlocklistOptions {
  /**
   * Whitelist for the category being evaluated. A path must START with
   * one of these (after normalization) to be considered at all.
   * Caller passes the absolute roots they intend to clean.
   */
  allowRoots: string[];
  /** Home directory override (defaults to os.homedir()). */
  home?: string;
}

/**
 * Decide whether a single path is deletable for the given cleanup category.
 *
 * The check runs both directions:
 *   1. Whitelist: path must live under one of allowRoots.
 *   2. Blocklist: path must not match any system or user rule.
 *
 * Neither rule alone is sufficient — both must agree.
 */
export function evaluatePath(rawPath: string, opts: BlocklistOptions): BlocklistDecision {
  const normalized = normalizePath(rawPath);
  if (!normalized) return { allowed: false, blockedBy: "empty-path" };

  const home = opts.home ?? homedir();
  const normalizedAllowRoots = opts.allowRoots
    .map(normalizePath)
    .filter((root) => root.length > 0);

  if (normalizedAllowRoots.length === 0) {
    return { allowed: false, blockedBy: "no-allow-root" };
  }

  const inAllowedRoot = startsWithAny(normalized, normalizedAllowRoots);
  if (!inAllowedRoot) {
    return { allowed: false, blockedBy: "not-under-allowed-root" };
  }

  for (const rule of SYSTEM_BLOCK_RULES) {
    if (rule.match(normalized)) return { allowed: false, blockedBy: rule.label };
  }
  for (const rule of userScopedRules(home)) {
    if (rule.match(normalized)) return { allowed: false, blockedBy: rule.label };
  }

  return { allowed: true };
}

/**
 * Convenience helper for code that wants to check a single category root
 * without spelling out the allowRoots option each time.
 */
export function isCategoryRootAllowed(
  _category: CleanupCategoryId,
  root: string,
  home: string = homedir()
): boolean {
  const normalizedRoot = normalizePath(root);
  if (!normalizedRoot) return false;
  // The category root itself must not match a blocklist rule. We use
  // the root as its own allow-root so the whitelist check trivially
  // passes.
  return evaluatePath(root, { allowRoots: [normalizedRoot], home }).allowed;
}

export const __testing = {
  SYSTEM_BLOCK_RULES,
  userScopedRules,
  startsWithAny,
  containsSegment,
  pathSeparator: sep
};
