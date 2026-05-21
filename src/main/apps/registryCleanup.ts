import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  InstalledApp,
  RegistryBackupEntry,
  RegistryBackupPurgedItem,
  RegistryBackupPurgeResult,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot
} from "@shared/types";
import { registryBackupKindLabel } from "@shared/cleanup-result";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import { ensureSafeOutputDirectoryPath } from "../safeOutputPath";
import { findLinkedDescendant, findLinkedPathPart } from "../cleanup/pathSafety";
import { normalizePath } from "../cleanup/blocklist";

export const REGISTRY_BACKUP_RETENTION_DAYS = RESTORE_BIN_RETENTION_DAYS;

export interface RegistryCleanupRunner {
  exportKey: (keyPath: string, backupPath: string) => Promise<void>;
  deleteKey: (keyPath: string) => Promise<void>;
  keyExists?: (keyPath: string) => Promise<boolean>;
  listSubKeys?: (keyPath: string) => Promise<string[]>;
  deleteService?: (serviceName: string) => Promise<void>;
  serviceExists?: (serviceName: string) => Promise<boolean>;
  queryValue?: (keyPath: string, valueName: string) => Promise<RegistryValueRecord | undefined>;
  queryDefaultValue?: (keyPath: string) => Promise<RegistryValueRecord | undefined>;
  listValues?: (keyPath: string) => Promise<RegistryNamedValueRecord[]>;
  setValue?: (keyPath: string, valueName: string, type: string, data: string) => Promise<void>;
  exportValue?: (keyPath: string, valueName: string, backupPath: string) => Promise<void>;
  deleteValue?: (keyPath: string, valueName: string) => Promise<void>;
  valueExists?: (keyPath: string, valueName: string) => Promise<boolean>;
  importFile?: (backupPath: string) => Promise<void>;
}

export class RegistryBackupPreservedError extends Error {
  readonly backup: Pick<RegistryBackupEntry, "id" | "expiresAt">;

  constructor(
    message: string,
    backup: Pick<RegistryBackupEntry, "id" | "expiresAt">,
    cause?: unknown
  ) {
    super(message);
    this.name = "RegistryBackupPreservedError";
    this.backup = backup;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, RegistryBackupPreservedError.prototype);
  }
}

export function isRegistryBackupPreservedError(err: unknown): err is RegistryBackupPreservedError {
  return (
    err instanceof RegistryBackupPreservedError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "RegistryBackupPreservedError" &&
      typeof (err as { backup?: { id?: unknown } }).backup?.id === "string")
  );
}

type RegistryBackupRestoredApp = {
  name: string;
  publisher?: string | null;
  backupKind:
    | "key"
    | "startup-value"
    | "registered-app-value"
    | "app-capabilities-key"
    | "environment-path-value"
    | "environment-variable-value"
    | "firewall-rule-value"
    | "app-execution-history-value"
    | "app-path-key"
    | "open-with-key"
    | "file-association-key"
    | "context-menu-key"
    | "shell-extension-key"
    | "explorer-extension-key"
    | "protocol-handler-key"
    | "native-messaging-host-key"
    | "com-local-server-key"
    | "com-inproc-server-key"
    | "com-app-id-key"
    | "service-key";
  registryKeyPath?: string;
  valueName?: string;
};

type RegistryKeyBackupKind =
  | "key"
  | "app-capabilities-key"
  | "app-path-key"
  | "open-with-key"
  | "file-association-key"
  | "context-menu-key"
  | "shell-extension-key"
  | "explorer-extension-key"
  | "protocol-handler-key"
  | "native-messaging-host-key"
  | "com-local-server-key"
  | "com-inproc-server-key"
  | "com-app-id-key"
  | "service-key";

function restoreAppBackupKindFromEntry(
  backupKind?: RegistryBackupEntry["backupKind"]
): RegistryBackupRestoredApp["backupKind"] {
  if (backupKind === "startup-value") return "startup-value";
  if (backupKind === "registered-app-value") return "registered-app-value";
  if (backupKind === "app-capabilities-key") return "app-capabilities-key";
  if (backupKind === "environment-path-value") return "environment-path-value";
  if (backupKind === "environment-variable-value") return "environment-variable-value";
  if (backupKind === "firewall-rule-value") return "firewall-rule-value";
  if (backupKind === "app-execution-history-value") return "app-execution-history-value";
  if (backupKind === "app-path-key") return "app-path-key";
  if (backupKind === "open-with-key") return "open-with-key";
  if (backupKind === "file-association-key") return "file-association-key";
  if (backupKind === "context-menu-key") return "context-menu-key";
  if (backupKind === "shell-extension-key") return "shell-extension-key";
  if (backupKind === "explorer-extension-key") return "explorer-extension-key";
  if (backupKind === "protocol-handler-key") return "protocol-handler-key";
  if (backupKind === "native-messaging-host-key") return "native-messaging-host-key";
  if (backupKind === "com-local-server-key") return "com-local-server-key";
  if (backupKind === "com-inproc-server-key") return "com-inproc-server-key";
  if (backupKind === "com-app-id-key") return "com-app-id-key";
  if (backupKind === "service-key") return "service-key";
  return "key";
}

function purgedItemBackupKindFromEntry(
  backupKind?: RegistryBackupEntry["backupKind"]
): NonNullable<RegistryBackupPurgedItem["backupKind"]> {
  return restoreAppBackupKindFromEntry(backupKind);
}
type RegistryValueBackupKind =
  | "startup-value"
  | "registered-app-value"
  | "environment-variable-value"
  | "firewall-rule-value"
  | "app-execution-history-value";
type RegistryValueRecord = {
  type: string;
  data: string;
};
type RegistryNamedValueRecord = RegistryValueRecord & {
  valueName: string;
};

const SAFE_UNINSTALL_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+)$/i;
const SAFE_STARTUP_VALUE_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run(?:Once)?)$/i;
const SAFE_REGISTERED_APPLICATIONS_VALUE_KEY_PATTERN =
  /^(?:HKCU\\Software\\RegisteredApplications|HKLM\\Software\\RegisteredApplications)$/i;
const SAFE_APP_CAPABILITIES_KEY_PATTERN =
  /^(?:HKCU\\Software\\(?:[^\\/:*?"'`|&<>\u0000-\u001f\u007f]+\\)+Capabilities|HKLM\\Software\\(?:WOW6432Node\\)?(?:[^\\/:*?"'`|&<>\u0000-\u001f\u007f]+\\)+Capabilities)$/i;
const SAFE_ENVIRONMENT_PATH_VALUE_KEY_PATTERN =
  /^(?:HKCU\\Environment|HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment)$/i;
const SAFE_ENVIRONMENT_VARIABLE_VALUE_KEY_PATTERN =
  /^(?:HKCU\\Environment|HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment)$/i;
const SAFE_FIREWALL_RULE_VALUE_KEY_PATTERN =
  /^HKLM\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\FirewallRules$/i;
const SAFE_APP_EXECUTION_HISTORY_VALUE_KEY_PATTERN =
  /^HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Compatibility Assistant\\Store$/i;
const SAFE_APP_PATHS_KEY_PATTERN =
  /^(?:HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\[^\\]+\.exe|HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\[^\\]+\.exe|HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\[^\\]+\.exe)$/i;
const SAFE_OPEN_WITH_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\Applications\\[^\\]+\.exe|HKLM\\Software\\Classes\\Applications\\[^\\]+\.exe)$/i;
const SAFE_FILE_ASSOCIATION_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\[A-Za-z][A-Za-z0-9._-]{2,127}|HKLM\\Software\\Classes\\[A-Za-z][A-Za-z0-9._-]{2,127})$/i;
const SAFE_CONTEXT_MENU_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\(?:\*|Directory|Directory\\Background|Folder)\\shell\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128}|HKLM\\Software\\Classes\\(?:\*|Directory|Directory\\Background|Folder)\\shell\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128})$/i;
const SAFE_SHELL_EXTENSION_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\(?:\*|AllFilesystemObjects|Directory|Directory\\Background|Drive|Folder)\\shellex\\ContextMenuHandlers\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128}|HKLM\\Software\\Classes\\(?:\*|AllFilesystemObjects|Directory|Directory\\Background|Drive|Folder)\\shellex\\ContextMenuHandlers\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128})$/i;
const SAFE_EXPLORER_EXTENSION_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\(?:\*|AllFilesystemObjects|Directory|Directory\\Background|Drive|Folder)\\shellex\\(?:ContextMenuHandlers|CopyHookHandlers|DragDropHandlers|PropertySheetHandlers|ColumnHandlers)\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128}|HKLM\\Software\\Classes\\(?:\*|AllFilesystemObjects|Directory|Directory\\Background|Drive|Folder)\\shellex\\(?:ContextMenuHandlers|CopyHookHandlers|DragDropHandlers|PropertySheetHandlers|ColumnHandlers)\\[^\\/:*?"'`|&<>\u0000-\u001f\u007f]{1,128})$/i;
const SAFE_PROTOCOL_HANDLER_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\[A-Za-z][A-Za-z0-9+.-]{1,63}|HKLM\\Software\\Classes\\[A-Za-z][A-Za-z0-9+.-]{1,63})$/i;
const SAFE_NATIVE_MESSAGING_HOST_KEY_PATTERN =
  /^(?:HKCU\\Software\\(?:Google\\Chrome|Microsoft\\Edge|Mozilla)\\NativeMessagingHosts\\[A-Za-z0-9][A-Za-z0-9._-]{0,127}|HKLM\\Software\\(?:Google\\Chrome|Microsoft\\Edge|Mozilla)\\NativeMessagingHosts\\[A-Za-z0-9][A-Za-z0-9._-]{0,127})$/i;
const SAFE_COM_LOCAL_SERVER_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\CLSID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}|HKLM\\Software\\Classes\\CLSID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}|HKLM\\Software\\WOW6432Node\\Classes\\CLSID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\})$/i;
const SAFE_COM_INPROC_SERVER_KEY_PATTERN = SAFE_COM_LOCAL_SERVER_KEY_PATTERN;
const SAFE_COM_APP_ID_KEY_PATTERN =
  /^(?:HKCU\\Software\\Classes\\AppID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}|HKLM\\Software\\Classes\\AppID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}|HKLM\\Software\\WOW6432Node\\Classes\\AppID\\\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\})$/i;
const SAFE_SERVICE_KEY_PATTERN =
  /^HKLM\\SYSTEM\\CurrentControlSet\\Services\\[A-Za-z0-9._-]{1,128}$/i;
const SERVICE_KEY_PREFIX = "HKLM\\SYSTEM\\CurrentControlSet\\Services\\";
const COMMON_PROTOCOL_SCHEME_BLOCKLIST = new Set([
  "callto",
  "file",
  "ftp",
  "http",
  "https",
  "mailto",
  "ms-settings",
  "ms-windows-store",
  "search",
  "shell",
  "sms",
  "tel",
  "urn",
  "webcal"
]);
const COMMON_FILE_ASSOCIATION_KEY_BLOCKLIST = new Set([
  "app",
  "appid",
  "application",
  "applications",
  "batfile",
  "cmdfile",
  "clsid",
  "comfile",
  "directory",
  "dllfile",
  "drive",
  "exefile",
  "folder",
  "helpfile",
  "htmlfile",
  "http",
  "https",
  "inffile",
  "inifile",
  "interface",
  "jpegfile",
  "jsfile",
  "lnkfile",
  "mscfile",
  "pdffile",
  "piffile",
  "pngfile",
  "regfile",
  "scrfile",
  "sysfile",
  "txtfile",
  "typelib",
  "unknown"
]);
const COMMON_APP_CAPABILITIES_ROOT_BLOCKLIST = new Set([
  "classes",
  "clients",
  "microsoft",
  "policies",
  "registeredapplications",
  "windows"
]);

function normalizeRegistryKeyPath(keyPath: string): string {
  return keyPath.trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
}

function canonicalRegistryKeyForComparison(keyPath: string): string {
  return normalizeRegistryKeyPath(keyPath)
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\")
    .toLowerCase();
}

export function isSafeUninstallRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_UNINSTALL_KEY_PATTERN.test(normalized);
}

export function isSafeAppPathRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_APP_PATHS_KEY_PATTERN.test(normalized);
}

export function isSafeAppCapabilitiesRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  if (!SAFE_APP_CAPABILITIES_KEY_PATTERN.test(normalized)) return false;

  const softwarePrefix = normalized.match(/^HK(?:CU|LM)\\Software\\/i)?.[0];
  if (!softwarePrefix) return false;
  let tail = normalized.slice(softwarePrefix.length);
  if (/^WOW6432Node\\/i.test(tail)) tail = tail.slice("WOW6432Node\\".length);
  const parts = tail.split("\\").filter(Boolean);
  if (parts.length < 2 || parts.at(-1)?.toLowerCase() !== "capabilities") return false;
  const root = parts[0]?.toLowerCase();
  if (!root || COMMON_APP_CAPABILITIES_ROOT_BLOCKLIST.has(root)) return false;
  return parts.slice(0, -1).every((part) => /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/.test(part));
}

export function isSafeOpenWithRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_OPEN_WITH_KEY_PATTERN.test(normalized);
}

export function isSafeFileAssociationRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  if (!SAFE_FILE_ASSOCIATION_KEY_PATTERN.test(normalized)) return false;
  const className = normalized.split("\\").pop();
  if (!className) return false;
  if (className.startsWith(".")) return false;
  if (COMMON_FILE_ASSOCIATION_KEY_BLOCKLIST.has(className.toLowerCase())) return false;
  return true;
}

export function isSafeContextMenuRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (normalized.includes("*") && !/\\\*\\shell\\/i.test(normalized)) return false;
  if (/\?/.test(normalized)) return false;
  return SAFE_CONTEXT_MENU_KEY_PATTERN.test(normalized);
}

export function isSafeShellExtensionRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (normalized.includes("*") && !/\\\*\\shellex\\ContextMenuHandlers\\/i.test(normalized)) return false;
  if (/\?/.test(normalized)) return false;
  return SAFE_SHELL_EXTENSION_KEY_PATTERN.test(normalized);
}

export function isSafeExplorerExtensionRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (normalized.includes("*") && !/\\\*\\shellex\\/i.test(normalized)) return false;
  if (/\?/.test(normalized)) return false;
  return SAFE_EXPLORER_EXTENSION_KEY_PATTERN.test(normalized);
}

export function normalizeSafeProtocolScheme(scheme: unknown): string | undefined {
  if (typeof scheme !== "string") return undefined;
  const trimmed = scheme.trim();
  if (!trimmed || trimmed !== scheme) return undefined;
  const normalized = trimmed.toLowerCase();
  if (!/^[a-z][a-z0-9+.-]{1,63}$/.test(normalized)) return undefined;
  if (COMMON_PROTOCOL_SCHEME_BLOCKLIST.has(normalized)) return undefined;
  if (normalized.startsWith("ms-")) return undefined;
  return normalized;
}

export function isSafeProtocolHandlerRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  if (!SAFE_PROTOCOL_HANDLER_KEY_PATTERN.test(normalized)) return false;
  const scheme = normalized.split("\\").pop();
  return normalizeSafeProtocolScheme(scheme) === scheme?.toLowerCase();
}

export function normalizeSafeNativeMessagingHostName(hostName: unknown): string | undefined {
  if (typeof hostName !== "string") return undefined;
  const trimmed = hostName.trim();
  if (!trimmed || trimmed !== hostName) return undefined;
  const normalized = trimmed.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(normalized)) return undefined;
  if (/^(?:chrome|edge|firefox|mozilla|google|microsoft)$/.test(normalized)) return undefined;
  if (/^com\.(?:google|microsoft|mozilla)(?:\.|$)/.test(normalized)) return undefined;
  return normalized;
}

export function isSafeNativeMessagingHostRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  if (!SAFE_NATIVE_MESSAGING_HOST_KEY_PATTERN.test(normalized)) return false;
  const hostName = normalized.split("\\").pop();
  return normalizeSafeNativeMessagingHostName(hostName) === hostName?.toLowerCase();
}

export function isSafeComLocalServerRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_COM_LOCAL_SERVER_KEY_PATTERN.test(normalized);
}

export function isSafeComInprocServerRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_COM_INPROC_SERVER_KEY_PATTERN.test(normalized);
}

export function isSafeComAppIdRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_COM_APP_ID_KEY_PATTERN.test(normalized);
}

export function normalizeSafeServiceName(serviceName: unknown): string | undefined {
  if (typeof serviceName !== "string") return undefined;
  const trimmed = serviceName.trim();
  if (!trimmed || trimmed !== serviceName) return undefined;
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(trimmed)) return undefined;
  if (/^(?:win|windows|microsoft|ms|wuauserv|bits|spooler|themes|eventlog|windefend|securityhealthservice)$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function serviceRegistryKeyPath(serviceName: string): string {
  const safeServiceName = normalizeSafeServiceName(serviceName);
  if (!safeServiceName) {
    throw new Error("지원하는 Windows 서비스 이름이 아니라 자동 정리하지 않아요.");
  }
  return `${SERVICE_KEY_PREFIX}${safeServiceName}`;
}

export function isSafeServiceRegistryKeyPath(keyPath: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  if (!SAFE_SERVICE_KEY_PATTERN.test(normalized)) return false;
  const serviceName = normalized.slice(SERVICE_KEY_PREFIX.length);
  return normalizeSafeServiceName(serviceName) === serviceName;
}

function serviceNameFromRegistryKeyPath(keyPath: string): string | undefined {
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!isSafeServiceRegistryKeyPath(normalized)) return undefined;
  return normalizeSafeServiceName(normalized.slice(SERVICE_KEY_PREFIX.length));
}

function isSafeRegistryValueName(valueName: string): boolean {
  const trimmed = valueName.trim();
  if (!trimmed) return false;
  if (trimmed !== valueName) return false;
  if (trimmed.length > 256) return false;
  if (/[\0\r\n"'`|&<>\\]/.test(trimmed)) return false;
  if (/[*?]/.test(trimmed)) return false;
  return true;
}

export function isSafeStartupRegistryValuePath(keyPath: string, valueName: string): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_STARTUP_VALUE_KEY_PATTERN.test(normalized) && isSafeRegistryValueName(valueName);
}

export function isSafeRegisteredApplicationRegistryValuePath(
  keyPath: string,
  valueName: string
): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_REGISTERED_APPLICATIONS_VALUE_KEY_PATTERN.test(normalized) && isSafeRegistryValueName(valueName);
}

export function isSafeEnvironmentPathRegistryValuePath(
  keyPath: string,
  valueName: string
): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  return SAFE_ENVIRONMENT_PATH_VALUE_KEY_PATTERN.test(normalized) && /^Path$/i.test(valueName.trim());
}

const CRITICAL_ENVIRONMENT_VALUE_NAMES = new Set([
  "allusersprofile",
  "appdata",
  "commonprogramfiles",
  "commonprogramfiles(x86)",
  "commonprogramw6432",
  "computername",
  "comspec",
  "driverdata",
  "homepath",
  "homedrive",
  "localappdata",
  "logonserver",
  "number_of_processors",
  "os",
  "path",
  "pathext",
  "processor_architecture",
  "processor_identifier",
  "processor_level",
  "processor_revision",
  "programdata",
  "programfiles",
  "programfiles(x86)",
  "programw6432",
  "psmodulepath",
  "public",
  "systemdrive",
  "systemroot",
  "temp",
  "tmp",
  "userdomain",
  "userdomain_roamingprofile",
  "username",
  "userprofile",
  "windir"
]);

export function isSafeEnvironmentVariableRegistryValuePath(
  keyPath: string,
  valueName: string
): boolean {
  if (keyPath.trim() !== keyPath) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized)) return false;
  if (/[*?]/.test(normalized)) return false;
  const trimmedValueName = valueName.trim();
  if (!isSafeRegistryValueName(trimmedValueName)) return false;
  if (trimmedValueName !== valueName) return false;
  if (!/^[A-Za-z][A-Za-z0-9_]{1,127}$/.test(trimmedValueName)) return false;
  if (CRITICAL_ENVIRONMENT_VALUE_NAMES.has(trimmedValueName.toLowerCase())) return false;
  return SAFE_ENVIRONMENT_VARIABLE_VALUE_KEY_PATTERN.test(normalized);
}

export function isSafeFirewallRuleRegistryValuePath(
  keyPath: string,
  valueName: string
): boolean {
  if (keyPath.trim() !== keyPath || valueName.trim() !== valueName) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized || !valueName) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized) || /[\0\r\n"'`|&<>]/.test(valueName)) return false;
  if (/[*?]/.test(normalized) || /[*?]/.test(valueName)) return false;
  if (!SAFE_FIREWALL_RULE_VALUE_KEY_PATTERN.test(normalized)) return false;
  return /^[{}A-Za-z0-9._-]{1,256}$/.test(valueName);
}

export function isSafeAppExecutionHistoryRegistryValuePath(
  keyPath: string,
  valueName: string
): boolean {
  if (keyPath.trim() !== keyPath || valueName.trim() !== valueName) return false;
  const normalized = normalizeRegistryKeyPath(keyPath);
  if (!normalized || !valueName) return false;
  if (/[\0\r\n"'`|&<>]/.test(normalized) || /[\0\r\n"'`|&<>]/.test(valueName)) return false;
  if (/[*?]/.test(normalized) || /[*?]/.test(valueName)) return false;
  if (!SAFE_APP_EXECUTION_HISTORY_VALUE_KEY_PATTERN.test(normalized)) return false;
  if (valueName.length > 1024) return false;
  if (!/^[A-Za-z]:\\[^:]+\.exe$/i.test(valueName)) return false;
  return true;
}

export function normalizeSafeEnvironmentPathSegment(segment: unknown): string | undefined {
  if (typeof segment !== "string") return undefined;
  const trimmed = segment.trim();
  if (!trimmed || trimmed !== segment) return undefined;
  if (trimmed.length > 1024) return undefined;
  if (/[\0\r\n"'`|&<>;]/.test(trimmed)) return undefined;
  if (/[*?]/.test(trimmed)) return undefined;
  if (!/^[A-Za-z]:\\[^:]+/.test(trimmed)) return undefined;
  return trimmed.replace(/\//g, "\\").replace(/\\+/g, "\\").replace(/\\+$/g, "");
}

export function isSafeRegistryBackupId(backupId: unknown): backupId is string {
  if (typeof backupId !== "string") return false;
  const trimmed = backupId.trim();
  return (
    trimmed.length > 0 &&
    trimmed === backupId &&
    backupId !== "." &&
    backupId !== ".." &&
    !/\s/.test(backupId) &&
    !backupId.includes("/") &&
    !backupId.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(backupId)
  );
}

function normalizeRegistryKeyBackupKind(value: unknown): RegistryKeyBackupKind {
  if (value === "app-capabilities-key") return "app-capabilities-key";
  if (value === "app-path-key") return "app-path-key";
  if (value === "open-with-key") return "open-with-key";
  if (value === "file-association-key") return "file-association-key";
  if (value === "context-menu-key") return "context-menu-key";
  if (value === "shell-extension-key") return "shell-extension-key";
  if (value === "explorer-extension-key") return "explorer-extension-key";
  if (value === "protocol-handler-key") return "protocol-handler-key";
  if (value === "native-messaging-host-key") return "native-messaging-host-key";
  if (value === "com-local-server-key") return "com-local-server-key";
  if (value === "com-inproc-server-key") return "com-inproc-server-key";
  if (value === "com-app-id-key") return "com-app-id-key";
  if (value === "service-key") return "service-key";
  return "key";
}

async function registryTargetStillExistsAfterDelete(
  options: {
    backupKind: RegistryKeyBackupKind;
    keyPath: string;
    serviceName?: string;
    runner: RegistryCleanupRunner;
  }
): Promise<boolean | undefined> {
  if (options.backupKind === "service-key" && options.serviceName) {
    if (options.runner.serviceExists) return options.runner.serviceExists(options.serviceName);
    if (options.runner.keyExists) return options.runner.keyExists(options.keyPath);
    return undefined;
  }
  if (options.runner.keyExists) return options.runner.keyExists(options.keyPath);
  return undefined;
}

function registryBackupExpiry(now: Date): string {
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + REGISTRY_BACKUP_RETENTION_DAYS);
  return expiresAt.toISOString();
}

function canonicalRegistryBackupExpiry(createdAt: string): string {
  return registryBackupExpiry(new Date(createdAt));
}

function isOutsideRegistryBackupRestorableWindow(
  entry: Pick<RegistryBackupEntry, "createdAt" | "expiresAt">,
  now: Date
): boolean {
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isFinite(createdAt) && createdAt > now.getTime()) return true;

  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 1024);
}

function cleanDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 1024);
}

function registryBackupItemsRoot(userDataDir: string): string {
  return join(userDataDir, "formatbuddy-registry-backups", "items");
}

function registryBackupPurgeLabel(entry: RegistryBackupEntry): string {
  if (entry.appName) return entry.appName;
  if (
    (entry.backupKind === "startup-value" ||
      entry.backupKind === "registered-app-value" ||
      entry.backupKind === "environment-path-value" ||
      entry.backupKind === "environment-variable-value" ||
      entry.backupKind === "firewall-rule-value" ||
      entry.backupKind === "app-execution-history-value") &&
    entry.valueName
  ) {
    return entry.valueName;
  }
  const parts = normalizeRegistryKeyPath(entry.keyPath).split("\\").filter(Boolean);
  return parts.at(-1) ?? "앱 삭제 흔적";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function errorMessageText(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "");
}

function friendlyRegistryBackupBlockedMessage(
  err: unknown,
  entry?: Pick<RegistryBackupEntry, "backupKind">
): string {
  const label = entry ? registryBackupKindLabel(entry) : "앱 삭제 흔적 백업";
  const raw = errorMessageText(err);
  if (/링크|symbolic|symlink/i.test(raw)) {
    return `${label} 파일이 링크라 자동으로 되돌리지 않았어요.`;
  }
  if (/형식|REGEDIT4|Registry Editor/i.test(raw)) {
    return `${label} 파일 형식을 확인하지 못해 자동으로 되돌리지 않았어요.`;
  }
  if (/위치|section|expected|다른 키/i.test(raw)) {
    return `${label} 파일의 위치가 맞지 않아 자동으로 되돌리지 않았어요.`;
  }
  if (/값 삭제|삭제 항목/i.test(raw)) {
    return `${label} 파일에 지우기 값이 섞여 있어 자동으로 되돌리지 않았어요.`;
  }
  if (/되돌릴 값|시작 항목 값/i.test(raw)) {
    return `${label} 파일에서 되돌릴 값을 확인하지 못해 자동으로 되돌리지 않았어요.`;
  }
  if (/바뀐|changed|hash|무결성/i.test(raw)) {
    return `${label} 파일이 바뀐 것 같아 자동으로 되돌리지 않았어요.`;
  }
  if (/비어|empty/i.test(raw)) {
    return `${label} 파일이 비어 있어 자동으로 되돌리지 않았어요.`;
  }
  if (/보이지|없|not found|ENOENT/i.test(raw)) {
    return `${label} 파일이 보이지 않아 자동으로 되돌리지 않았어요.`;
  }
  return `${label} 파일을 안전하게 확인하지 못해 자동으로 되돌리지 않았어요.`;
}

function friendlyRegistryRestoreFailureMessage(
  err: unknown,
  entry: Pick<RegistryBackupEntry, "backupKind">
): string {
  const label = registryBackupKindLabel(entry);
  const raw = errorMessageText(err);
  if (/아직.*되살아나지|still missing|not restored/i.test(raw)) {
    return `${label}을 아직 되돌리지 못했어요. 복원 결과를 확인하지 못했어요.`;
  }
  if (/still exists|folder is busy|busy|locked|EBUSY|ENOTEMPTY|사용 중|잠금/i.test(raw)) {
    return `${label}은 되돌렸지만 복구함 기록을 아직 지우지 못했어요. 다음 확인 때 다시 정리할게요.`;
  }
  if (/denied|access|permission|EACCES|EPERM|권한/i.test(raw)) {
    return `${label}을 되돌릴 권한이 부족했어요. Windows에서 한 번 더 확인해주세요.`;
  }
  if (/reg\.exe|import|failed|backup\.reg|ENOENT|not found|cannot/i.test(raw)) {
    return `${label}을 되돌리지 못했어요. 백업 파일을 다시 확인해주세요.`;
  }
  return `${label}을 되돌리지 못했어요. 다시 시도하거나 Windows 설정에서 직접 확인해주세요.`;
}

async function hashFile(path: string): Promise<string> {
  const content = await fs.readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function readRegistryBackupText(path: string): Promise<string> {
  const content = await fs.readFile(path);
  if (content.length >= 2 && content[0] === 0xff && content[1] === 0xfe) {
    return content.subarray(2).toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
    return content.subarray(3).toString("utf8").replace(/^\uFEFF/, "");
  }
  const sample = content.subarray(0, Math.min(content.length, 128));
  let oddNulls = 0;
  let oddSlots = 0;
  for (let i = 1; i < sample.length; i += 2) {
    oddSlots += 1;
    if (sample[i] === 0) oddNulls += 1;
  }
  if (oddSlots > 0 && oddNulls / oddSlots > 0.6) {
    return content.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return content.toString("utf8").replace(/^\uFEFF/, "");
}

function isValidRegistryBackupContentHash(
  value: unknown
): value is NonNullable<RegistryBackupEntry["contentHash"]> {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<NonNullable<RegistryBackupEntry["contentHash"]>>;
  return raw.algorithm === "sha256" && typeof raw.value === "string" && /^[a-f0-9]{64}$/.test(raw.value);
}

async function removeRegistryBackupStoreItem(root: string, name: string): Promise<boolean> {
  if (!isSafeRegistryBackupId(name)) return false;
  const target = join(root, name);
  await fs.rm(target, { recursive: true, force: true }).catch(() => {});
  return !(await pathExists(target));
}

async function removeLinkedRegistryBackupRootIfManaged(
  userDataDir: string,
  linkedRoot: string
): Promise<void> {
  if (normalizePath(resolve(linkedRoot)) === normalizePath(resolve(userDataDir))) return;
  await fs.rm(linkedRoot, { force: true }).catch(() => {});
}

function runRegCommand(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("reg.exe", args, {
      windowsHide: true,
      shell: false
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `reg.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

function runScCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("sc.exe", args, {
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error((stderr || stdout).trim() || `sc.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

function runRegQuery(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("reg.exe", args, {
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `reg.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

function isServiceMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /1060|does not exist|service.*not.*exist|not found|찾을 수|지정된.*서비스/i.test(message);
}

async function serviceExistsWithSc(serviceName: string): Promise<boolean> {
  try {
    await runScCommand(["query", serviceName]);
    return true;
  } catch (err) {
    if (isServiceMissingError(err)) return false;
    throw err;
  }
}

function isRegistryMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unable to find|cannot find|not found|찾을 수|지정된.*찾|reg\.exe exited with code 1/i.test(
    message
  );
}

async function registryKeyExistsWithReg(keyPath: string): Promise<boolean> {
  try {
    await runRegQuery(["query", keyPath]);
    return true;
  } catch (err) {
    if (isRegistryMissingError(err)) return false;
    throw err;
  }
}

function canonicalRegistryKeyForFile(keyPath: string): string {
  return normalizeRegistryKeyPath(keyPath)
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\");
}

function escapeRegistryString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function hexBytes(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(",");
}

function utf16Hex(value: string, extraNulls = 1): string {
  const buffer = Buffer.from(`${value}${"\0".repeat(extraNulls)}`, "utf16le");
  return hexBytes(Array.from(buffer));
}

function registryValueLine(valueName: string, type: string, data: string): string {
  const name = `"${escapeRegistryString(valueName)}"`;
  switch (type.toUpperCase()) {
    case "REG_DWORD": {
      const hex = data.match(/0x([0-9a-f]+)/i)?.[1];
      const decimal = data.match(/^\d+$/)?.[0];
      const n = hex ? Number.parseInt(hex, 16) : decimal ? Number.parseInt(decimal, 10) : Number.NaN;
      if (!Number.isFinite(n)) throw new Error("레지스트리 값을 백업할 수 없어요.");
      return `${name}=dword:${(n >>> 0).toString(16).padStart(8, "0")}`;
    }
    case "REG_QWORD": {
      const hex = data.match(/0x([0-9a-f]+)/i)?.[1] ?? "";
      if (!hex) throw new Error("레지스트리 값을 백업할 수 없어요.");
      const padded = hex.padStart(16, "0").slice(-16);
      const bytes = padded.match(/../g)?.reverse().join(",") ?? "";
      return `${name}=hex(b):${bytes}`;
    }
    case "REG_BINARY": {
      const compact = data.replace(/[^0-9a-f]/gi, "");
      if (compact.length % 2 !== 0) throw new Error("레지스트리 값을 백업할 수 없어요.");
      return `${name}=hex:${compact.match(/../g)?.join(",") ?? ""}`;
    }
    case "REG_EXPAND_SZ":
      return `${name}=hex(2):${utf16Hex(data)}`;
    case "REG_MULTI_SZ":
      return `${name}=hex(7):${utf16Hex(data.replace(/\\0/g, "\0"), 2)}`;
    case "REG_SZ":
    default:
      return `${name}="${escapeRegistryString(data)}"`;
  }
}

async function exportRegistryValueWithReg(
  keyPath: string,
  valueName: string,
  backupPath: string
): Promise<void> {
  const { type, data } = await queryRegistryValueWithReg(keyPath, valueName);
  const content = [
    "Windows Registry Editor Version 5.00",
    "",
    `[${canonicalRegistryKeyForFile(keyPath)}]`,
    registryValueLine(valueName, type, data),
    ""
  ].join("\r\n");
  await fs.mkdir(dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, content, "utf8");
}

async function queryRegistryValueWithReg(
  keyPath: string,
  valueName: string
): Promise<RegistryValueRecord> {
  const stdout = await runRegQuery(["query", keyPath, "/v", valueName]);
  const row = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(valueName.toLowerCase()));
  if (!row) throw new Error("레지스트리 값을 찾지 못했어요.");

  const parts = row.split(/\s{2,}/);
  if (parts.length < 3) throw new Error("레지스트리 값을 읽지 못했어요.");
  const [, type, ...dataParts] = parts;
  const data = dataParts.join("  ");
  return { type, data };
}

async function queryRegistryDefaultValueWithReg(keyPath: string): Promise<RegistryValueRecord> {
  const stdout = await runRegQuery(["query", keyPath, "/ve"]);
  for (const line of stdout.split(/\r?\n/)) {
    const row = line.trim();
    if (!row || /^HKEY_/i.test(row)) continue;
    const parts = row.split(/\s{2,}/);
    const typeIndex = parts.findIndex((part) => /^REG_/i.test(part));
    if (typeIndex < 0) continue;
    const type = parts[typeIndex];
    const data = parts.slice(typeIndex + 1).join("  ");
    if (data) return { type, data };
  }
  throw new Error("레지스트리 기본값을 읽지 못했어요.");
}

async function listRegistryValuesWithReg(keyPath: string): Promise<RegistryNamedValueRecord[]> {
  const stdout = await runRegQuery(["query", keyPath]);
  const values: RegistryNamedValueRecord[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const row = line.trim();
    if (!row || /^HKEY_/i.test(row)) continue;
    const parts = row.split(/\s{2,}/);
    if (parts.length < 3) continue;
    const [valueName, type, ...dataParts] = parts;
    if (!valueName || !/^REG_/i.test(type)) continue;
    values.push({ valueName, type, data: dataParts.join("  ") });
  }
  return values;
}

function registrySubKeysFromRegOutput(keyPath: string, stdout: string): string[] {
  const rootKey = canonicalRegistryKeyForComparison(keyPath);
  const rootPrefix = `${rootKey}\\`;
  const names = new Set<string>();

  for (const line of stdout.split(/\r?\n/)) {
    const row = normalizeRegistryKeyPath(line.trim());
    if (!/^(?:HKEY_|HKCU\\|HKLM\\)/i.test(row)) continue;
    const canonicalRow = canonicalRegistryKeyForComparison(row);
    if (!canonicalRow.startsWith(rootPrefix)) continue;
    const remainder = canonicalRow.slice(rootPrefix.length);
    if (!remainder || remainder.includes("\\")) continue;
    const subkeyName = row.split("\\").pop()?.trim();
    if (subkeyName) names.add(subkeyName);
  }

  return Array.from(names);
}

async function listRegistrySubKeysWithReg(keyPath: string): Promise<string[]> {
  const stdout = await runRegQuery(["query", keyPath]);
  return registrySubKeysFromRegOutput(keyPath, stdout);
}

async function registryValueExistsWithReg(keyPath: string, valueName: string): Promise<boolean> {
  try {
    await queryRegistryValueWithReg(keyPath, valueName);
    return true;
  } catch (err) {
    if (isRegistryMissingError(err)) return false;
    throw err;
  }
}

function normalizeWritableRegistryValueType(type: string): string {
  const normalized = type.trim().toUpperCase();
  if (normalized === "REG_SZ" || normalized === "REG_EXPAND_SZ") return normalized;
  throw new Error("지원하는 PATH 값 형식이 아니라 자동 정리하지 않아요.");
}

async function setRegistryValueWithReg(
  keyPath: string,
  valueName: string,
  type: string,
  data: string
): Promise<void> {
  await runRegCommand([
    "add",
    keyPath,
    "/v",
    valueName,
    "/t",
    normalizeWritableRegistryValueType(type),
    "/d",
    data,
    "/f"
  ]);
}

async function assertRestorableRegistryBackupFile(
  entryDir: string,
  backupPath: string,
  expectedKeyPath?: string,
  expectedValueName?: string
): Promise<number> {
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) {
    throw new Error(`앱 삭제 흔적 백업 파일이 링크라 정리하지 않았어요: ${linkedBackup}`);
  }

  let stat;
  try {
    stat = await fs.lstat(backupPath);
  } catch {
    throw new Error("앱 삭제 흔적 백업 파일을 만들지 못해 정리하지 않았어요.");
  }

  if (stat.isSymbolicLink()) {
    throw new Error("앱 삭제 흔적 백업 파일이 링크라 정리하지 않았어요.");
  }
  if (!stat.isFile()) {
    throw new Error("앱 삭제 흔적 백업 파일이 파일이 아니라 정리하지 않았어요.");
  }
  if (stat.size <= 0) {
    throw new Error("앱 삭제 흔적 백업 파일이 비어 있어 정리하지 않았어요.");
  }

  const content = await readRegistryBackupText(backupPath);
  const head = content.slice(0, 256).trimStart();
  if (!/^Windows Registry Editor Version\s+\d+(?:\.\d+)?/i.test(head) && !/^REGEDIT4\b/i.test(head)) {
    throw new Error("앱 삭제 흔적 백업 파일이 레지스트리 백업 형식이 아니라 정리하지 않았어요.");
  }
  if (registryBackupContainsValueDeleteLine(content)) {
    throw new Error("앱 삭제 흔적 백업 파일에 값 삭제 항목이 있어 되돌리지 않았어요.");
  }
  if (expectedKeyPath && !registryBackupSectionsMatchExpectedKey(content, expectedKeyPath)) {
    throw new Error("앱 삭제 흔적 백업 파일의 레지스트리 위치가 달라 되돌리지 않았어요.");
  }
  if (expectedKeyPath && !registryBackupContainsRestorableValueLine(content, expectedKeyPath)) {
    throw new Error("앱 삭제 흔적 백업 파일에 되돌릴 값이 없어 정리하지 않았어요.");
  }
  if (expectedValueName && !registryBackupContainsOnlyValue(content, expectedKeyPath, expectedValueName)) {
    throw new Error("앱 삭제 흔적 백업 파일의 시작 항목 값이 달라 되돌리지 않았어요.");
  }

  return Math.max(0, stat.size);
}

function registryBackupSectionsMatchExpectedKey(content: string, expectedKeyPath: string): boolean {
  const expected = canonicalRegistryKeyForComparison(expectedKeyPath);
  let foundSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("[")) continue;
    const match = /^\[(-?)([^\]]+)\]$/.exec(line);
    if (!match) return false;
    if (match[1] === "-") return false;
    const sectionKey = canonicalRegistryKeyForComparison(match[2]);
    if (sectionKey !== expected && !sectionKey.startsWith(`${expected}\\`)) {
      return false;
    }
    foundSection = true;
  }
  return foundSection;
}

function registryBackupContainsValueDeleteLine(content: string): boolean {
  return content.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.trim();
    return /^@\s*=\s*-$/.test(line) || /^"((?:\\"|[^"])*)"\s*=\s*-$/.test(line);
  });
}

function registryBackupLineSection(line: string): string | null | undefined {
  if (!line.startsWith("[")) return undefined;
  const match = /^\[(-?)([^\]]+)\]$/.exec(line);
  if (!match || match[1] === "-") return null;
  return canonicalRegistryKeyForComparison(match[2]);
}

function registryBackupSectionMatches(currentSection: string | null, expectedKeyPath: string): boolean {
  const expected = canonicalRegistryKeyForComparison(expectedKeyPath);
  return Boolean(currentSection && (currentSection === expected || currentSection.startsWith(`${expected}\\`)));
}

function registryBackupContainsRestorableValueLine(content: string, expectedKeyPath: string): boolean {
  let currentSection: string | null = null;
  return content.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.trim();
    const section = registryBackupLineSection(line);
    if (section !== undefined) {
      currentSection = section;
      return false;
    }
    const isValueLine = /^@\s*=/.test(line) || /^"((?:\\"|[^"])*)"\s*=/.test(line);
    return isValueLine && registryBackupSectionMatches(currentSection, expectedKeyPath);
  });
}

function registryBackupContainsOnlyValue(
  content: string,
  expectedKeyPath: string | undefined,
  expectedValueName: string
): boolean {
  const escaped = expectedValueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let found = false;
  let currentSection: string | null = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^Windows Registry Editor Version/i.test(line) || /^REGEDIT4\b/i.test(line)) {
      continue;
    }
    const section = registryBackupLineSection(line);
    if (section !== undefined) {
      currentSection = section;
      continue;
    }
    const match = /^"((?:\\"|[^"])*)"=/.exec(line);
    if (!match) return false;
    if (expectedKeyPath && !registryBackupSectionMatches(currentSection, expectedKeyPath)) {
      return false;
    }
    const actualValueName = match[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    if (!new RegExp(`^${escaped}$`, "i").test(actualValueName)) {
      return false;
    }
    found = true;
  }
  return found;
}

async function writeRegistryBackupMetaFile(
  entryDir: string,
  metaPath: string,
  payload: unknown
): Promise<void> {
  const linkedMetaBefore = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaBefore) {
    throw new Error(`앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaBefore}`);
  }

  await fs.writeFile(metaPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    flag: "wx"
  });

  const linkedMetaAfter = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMetaAfter) {
    throw new Error(`앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMetaAfter}`);
  }

  const stat = await fs.lstat(metaPath);
  if (stat.isSymbolicLink()) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요.");
  }
  if (!stat.isFile()) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 파일이 아니라 정리하지 않았어요.");
  }
  if (stat.size <= 0) {
    throw new Error("앱 삭제 흔적 백업 정보 파일이 비어 있어 정리하지 않았어요.");
  }
}

async function ensureRegistryBackupMetaFile(
  entryDir: string,
  metaPath: string,
  payload: unknown
): Promise<void> {
  const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMeta) {
    throw new Error(`앱 삭제 흔적 백업 정보 파일이 링크라 정리하지 않았어요: ${linkedMeta}`);
  }

  try {
    const stat = await fs.lstat(metaPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("앱 삭제 흔적 백업 정보 파일이 안전하지 않아 정리하지 않았어요.");
    }
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  await writeRegistryBackupMetaFile(entryDir, metaPath, payload);
}

export function defaultRegistryCleanupRunner(): RegistryCleanupRunner {
  return {
    exportKey: (keyPath, backupPath) => runRegCommand(["export", keyPath, backupPath, "/y"]),
    deleteKey: (keyPath) => runRegCommand(["delete", keyPath, "/f"]),
    keyExists: (keyPath) => registryKeyExistsWithReg(keyPath),
    listSubKeys: (keyPath) => listRegistrySubKeysWithReg(keyPath),
    deleteService: (serviceName) => runScCommand(["delete", serviceName]).then(() => undefined),
    serviceExists: (serviceName) => serviceExistsWithSc(serviceName),
    queryValue: (keyPath, valueName) => queryRegistryValueWithReg(keyPath, valueName),
    queryDefaultValue: (keyPath) => queryRegistryDefaultValueWithReg(keyPath),
    setValue: (keyPath, valueName, type, data) =>
      setRegistryValueWithReg(keyPath, valueName, type, data),
    exportValue: (keyPath, valueName, backupPath) =>
      exportRegistryValueWithReg(keyPath, valueName, backupPath),
    deleteValue: (keyPath, valueName) => runRegCommand(["delete", keyPath, "/v", valueName, "/f"]),
    valueExists: (keyPath, valueName) => registryValueExistsWithReg(keyPath, valueName),
    importFile: (backupPath) => runRegCommand(["import", backupPath]),
    listValues: (keyPath) => listRegistryValuesWithReg(keyPath)
  };
}

export async function backupAndDeleteRegistryKey(options: {
  userDataDir: string;
  keyPath: string;
  backupKind?:
    | "key"
    | "app-capabilities-key"
    | "app-path-key"
    | "open-with-key"
    | "file-association-key"
    | "context-menu-key"
    | "shell-extension-key"
    | "explorer-extension-key"
    | "protocol-handler-key"
    | "native-messaging-host-key"
    | "com-local-server-key"
    | "com-inproc-server-key"
    | "com-app-id-key"
    | "service-key";
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<RegistryBackupEntry> {
  const backupKind = normalizeRegistryKeyBackupKind(options.backupKind);
  const safeKey =
    backupKind === "app-capabilities-key"
      ? isSafeAppCapabilitiesRegistryKeyPath(options.keyPath)
      : backupKind === "app-path-key"
      ? isSafeAppPathRegistryKeyPath(options.keyPath)
      : backupKind === "open-with-key"
        ? isSafeOpenWithRegistryKeyPath(options.keyPath)
        : backupKind === "file-association-key"
          ? isSafeFileAssociationRegistryKeyPath(options.keyPath)
          : backupKind === "context-menu-key"
            ? isSafeContextMenuRegistryKeyPath(options.keyPath)
            : backupKind === "shell-extension-key"
              ? isSafeShellExtensionRegistryKeyPath(options.keyPath)
              : backupKind === "explorer-extension-key"
                ? isSafeExplorerExtensionRegistryKeyPath(options.keyPath)
              : backupKind === "protocol-handler-key"
                ? isSafeProtocolHandlerRegistryKeyPath(options.keyPath)
                : backupKind === "native-messaging-host-key"
                  ? isSafeNativeMessagingHostRegistryKeyPath(options.keyPath)
                  : backupKind === "com-local-server-key"
                    ? isSafeComLocalServerRegistryKeyPath(options.keyPath)
                    : backupKind === "com-app-id-key"
                      ? isSafeComAppIdRegistryKeyPath(options.keyPath)
                      : backupKind === "com-inproc-server-key"
                        ? isSafeComInprocServerRegistryKeyPath(options.keyPath)
                        : backupKind === "service-key"
                          ? isSafeServiceRegistryKeyPath(options.keyPath)
                          : isSafeUninstallRegistryKeyPath(options.keyPath);
  if (!safeKey) {
    throw new Error("지원하는 앱 제거 레지스트리 위치가 아니라 자동 정리하지 않아요.");
  }
  const keyPath = normalizeRegistryKeyPath(options.keyPath);

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = registryBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = join(registryBackupItemsRoot(options.userDataDir), id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Registry backup" });

  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");
  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const appName = cleanDisplayString(options.app?.name);
  const appPublisher = cleanDisplayString(options.app?.publisher);
  let sizeBytes = 0;
  let contentHash: NonNullable<RegistryBackupEntry["contentHash"]> | null = null;
  let metaPayload: Omit<RegistryBackupEntry, "integrityStatus"> | null = null;
  let deleteInvoked = false;
  let deleteConfirmedIncomplete = false;
  const serviceName = backupKind === "service-key" ? serviceNameFromRegistryKeyPath(keyPath) : undefined;

  try {
    await runner.exportKey(keyPath, backupPath);
    sizeBytes = await assertRestorableRegistryBackupFile(entryDir, backupPath, keyPath);
    contentHash = { algorithm: "sha256", value: await hashFile(backupPath) };
    metaPayload = {
      id,
      keyPath,
      ...(backupKind !== "key" ? { backupKind } : {}),
      backupPath,
      sizeBytes,
      contentHash,
      appName,
      appPublisher,
      createdAt,
      expiresAt
    };
    await writeRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    try {
      if (backupKind === "service-key") {
        if (!serviceName || !runner.deleteService) {
          throw new Error("지원하는 Windows 서비스 정리 방식이 아니라 자동 정리하지 않아요.");
        }
        await runner.deleteService(serviceName);
      } else {
        await runner.deleteKey(keyPath);
      }
      deleteInvoked = true;
    } catch (deleteErr) {
      const hasExistenceCheck =
        backupKind === "service-key"
          ? Boolean(runner.serviceExists || runner.keyExists)
          : Boolean(runner.keyExists);
      if (hasExistenceCheck) {
        try {
          const stillExists = await registryTargetStillExistsAfterDelete({
            backupKind,
            keyPath,
            serviceName,
            runner
          });
          if (stillExists === undefined) {
            deleteInvoked = true;
          } else if (stillExists) {
            deleteConfirmedIncomplete = true;
          } else {
            deleteInvoked = true;
          }
        } catch {
          deleteInvoked = true;
        }
      }
      throw deleteErr;
    }
    const stillExists =
      (await registryTargetStillExistsAfterDelete({ backupKind, keyPath, serviceName, runner })) ?? false;
    if (stillExists) {
      deleteConfirmedIncomplete = true;
      throw new Error("Registry key still exists after deletion");
    }
    await ensureRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    return await assertRegistryBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    if (deleteInvoked && !deleteConfirmedIncomplete) {
      const preservedBackup = await restorableRegistryBackupEntry(options.userDataDir, id);
      if (preservedBackup) {
        const message = err instanceof Error ? err.message : String(err);
        throw new RegistryBackupPreservedError(
          message,
          { id: preservedBackup.id, expiresAt: preservedBackup.expiresAt },
          err
        );
      }
    }
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function backupAndDeleteRegistryValue(options: {
  userDataDir: string;
  keyPath: string;
  valueName: string;
  backupKind?: RegistryValueBackupKind;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<RegistryBackupEntry> {
  const backupKind: RegistryValueBackupKind =
    options.backupKind === "registered-app-value"
      ? "registered-app-value"
      : options.backupKind === "environment-variable-value"
        ? "environment-variable-value"
        : options.backupKind === "firewall-rule-value"
          ? "firewall-rule-value"
          : options.backupKind === "app-execution-history-value"
            ? "app-execution-history-value"
            : "startup-value";
  const safeValue =
    backupKind === "registered-app-value"
      ? isSafeRegisteredApplicationRegistryValuePath(options.keyPath, options.valueName)
      : backupKind === "environment-variable-value"
        ? isSafeEnvironmentVariableRegistryValuePath(options.keyPath, options.valueName)
        : backupKind === "firewall-rule-value"
          ? isSafeFirewallRuleRegistryValuePath(options.keyPath, options.valueName)
          : backupKind === "app-execution-history-value"
            ? isSafeAppExecutionHistoryRegistryValuePath(options.keyPath, options.valueName)
            : isSafeStartupRegistryValuePath(options.keyPath, options.valueName);
  if (!safeValue) {
    throw new Error("지원하는 레지스트리 값 위치가 아니라 자동 정리하지 않아요.");
  }
  const keyPath = normalizeRegistryKeyPath(options.keyPath);
  const valueName = options.valueName;

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = registryBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = join(registryBackupItemsRoot(options.userDataDir), id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Registry value backup" });

  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");
  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const exportValue = runner.exportValue ?? defaultRegistryCleanupRunner().exportValue;
  const deleteValue = runner.deleteValue ?? defaultRegistryCleanupRunner().deleteValue;
  const appName = cleanDisplayString(options.app?.name);
  const appPublisher = cleanDisplayString(options.app?.publisher);
  let sizeBytes = 0;
  let contentHash: NonNullable<RegistryBackupEntry["contentHash"]> | null = null;
  let metaPayload: Omit<RegistryBackupEntry, "integrityStatus"> | null = null;
  let deleteInvoked = false;
  let deleteConfirmedIncomplete = false;

  if (!exportValue || !deleteValue) {
    throw new Error("레지스트리 값을 백업할 준비가 되지 않았어요.");
  }

  try {
    await exportValue(keyPath, valueName, backupPath);
    sizeBytes = await assertRestorableRegistryBackupFile(
      entryDir,
      backupPath,
      keyPath,
      valueName
    );
    contentHash = { algorithm: "sha256", value: await hashFile(backupPath) };
    metaPayload = {
      id,
      keyPath,
      valueName,
      backupKind,
      backupPath,
      sizeBytes,
      contentHash,
      appName,
      appPublisher,
      createdAt,
      expiresAt
    };
    await writeRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    try {
      await deleteValue(keyPath, valueName);
      deleteInvoked = true;
    } catch (deleteErr) {
      if (runner.valueExists) {
        try {
          const stillExists = await runner.valueExists(keyPath, valueName);
          if (stillExists) {
            deleteConfirmedIncomplete = true;
          } else {
            deleteInvoked = true;
          }
        } catch {
          deleteInvoked = true;
        }
      }
      throw deleteErr;
    }
    if (runner.valueExists && (await runner.valueExists(keyPath, valueName))) {
      deleteConfirmedIncomplete = true;
      throw new Error("Registry value still exists after deletion");
    }
    await ensureRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    return await assertRegistryBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    if (deleteInvoked && !deleteConfirmedIncomplete) {
      const preservedBackup = await restorableRegistryBackupEntry(options.userDataDir, id);
      if (preservedBackup) {
        const message = err instanceof Error ? err.message : String(err);
        throw new RegistryBackupPreservedError(
          message,
          { id: preservedBackup.id, expiresAt: preservedBackup.expiresAt },
          err
        );
      }
    }
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

function environmentPathSegments(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function environmentPathSegmentKey(value: string): string {
  return normalizePath(value).replace(/\\+$/g, "").toLowerCase();
}

function removeEnvironmentPathSegment(currentValue: string, segment: string): string {
  const safeSegment = normalizeSafeEnvironmentPathSegment(segment);
  if (!safeSegment) throw new Error("지원하는 PATH 경로가 아니라 자동 정리하지 않아요.");
  const target = environmentPathSegmentKey(safeSegment);
  const nextSegments = environmentPathSegments(currentValue).filter(
    (candidate) => environmentPathSegmentKey(candidate) !== target
  );
  if (nextSegments.length === environmentPathSegments(currentValue).length) {
    throw new Error("PATH에서 정리할 앱 경로를 찾지 못했어요.");
  }
  if (nextSegments.length === 0) {
    throw new Error("PATH 값이 비게 되어 자동 정리하지 않아요.");
  }
  return nextSegments.join(";");
}

function environmentPathContainsSegment(currentValue: string, segment: string): boolean {
  const safeSegment = normalizeSafeEnvironmentPathSegment(segment);
  if (!safeSegment) return false;
  const target = environmentPathSegmentKey(safeSegment);
  return environmentPathSegments(currentValue).some(
    (candidate) => environmentPathSegmentKey(candidate) === target
  );
}

export async function backupAndRemoveEnvironmentPathSegment(options: {
  userDataDir: string;
  keyPath: string;
  valueName: string;
  segment: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  app?: Pick<InstalledApp, "name" | "publisher">;
}): Promise<RegistryBackupEntry> {
  if (!isSafeEnvironmentPathRegistryValuePath(options.keyPath, options.valueName)) {
    throw new Error("지원하는 PATH 레지스트리 위치가 아니라 자동 정리하지 않아요.");
  }
  const segment = normalizeSafeEnvironmentPathSegment(options.segment);
  if (!segment) {
    throw new Error("지원하는 PATH 경로가 아니라 자동 정리하지 않아요.");
  }
  const keyPath = normalizeRegistryKeyPath(options.keyPath);
  const valueName = options.valueName;

  const createdAtDate = options.now?.() ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = registryBackupExpiry(createdAtDate);
  const id = randomUUID();
  const entryDir = join(registryBackupItemsRoot(options.userDataDir), id);
  await ensureSafeOutputDirectoryPath(entryDir, { label: "Registry value backup" });

  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");
  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const queryValue = runner.queryValue ?? defaultRegistryCleanupRunner().queryValue;
  const setValue = runner.setValue ?? defaultRegistryCleanupRunner().setValue;
  const exportValue = runner.exportValue ?? defaultRegistryCleanupRunner().exportValue;
  const appName = cleanDisplayString(options.app?.name);
  const appPublisher = cleanDisplayString(options.app?.publisher);
  let metaPayload: Omit<RegistryBackupEntry, "integrityStatus"> | null = null;
  let updateInvoked = false;

  if (!queryValue || !setValue || !exportValue) {
    throw new Error("PATH 값을 백업할 준비가 되지 않았어요.");
  }

  try {
    const before = await queryValue(keyPath, valueName);
    if (!before) {
      throw new Error("PATH 값을 찾지 못했어요.");
    }
    const valueType = normalizeWritableRegistryValueType(before.type);
    const nextValue = removeEnvironmentPathSegment(before.data, segment);
    await exportValue(keyPath, valueName, backupPath);
    const sizeBytes = await assertRestorableRegistryBackupFile(entryDir, backupPath, keyPath, valueName);
    const contentHash = { algorithm: "sha256" as const, value: await hashFile(backupPath) };
    metaPayload = {
      id,
      keyPath,
      valueName,
      environmentPathSegment: segment,
      backupKind: "environment-path-value",
      backupPath,
      sizeBytes,
      contentHash,
      appName,
      appPublisher,
      createdAt,
      expiresAt
    };
    await writeRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    await setValue(keyPath, valueName, valueType, nextValue);
    updateInvoked = true;
    const after = await queryValue(keyPath, valueName);
    if (!after) {
      throw new Error("PATH 값을 다시 확인하지 못해서 완료로 보지 않았어요.");
    }
    if (environmentPathContainsSegment(after.data, segment)) {
      throw new Error("PATH 경로가 아직 남아 있어서 완료로 보지 않았어요.");
    }
    await ensureRegistryBackupMetaFile(entryDir, metaPath, metaPayload);
    return await assertRegistryBackupEntryStillRestorable(options.userDataDir, id);
  } catch (err) {
    if (updateInvoked) {
      const preservedBackup = await restorableRegistryBackupEntry(options.userDataDir, id);
      if (preservedBackup) {
        const message = err instanceof Error ? err.message : String(err);
        throw new RegistryBackupPreservedError(
          message,
          { id: preservedBackup.id, expiresAt: preservedBackup.expiresAt },
          err
        );
      }
    }
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

function isValidIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

async function readRegistryBackupEntry(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupEntry | null> {
  const result = await readRegistryBackupEntryForRestore(userDataDir, backupId, {
    allowChangedContent: true
  });
  return result.kind === "entry" ? result.entry : null;
}

async function assertRegistryBackupEntryStillRestorable(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupEntry> {
  const result = await readRegistryBackupEntryForRestore(userDataDir, backupId);
  if (result.kind === "entry") return result.entry;
  throw new Error(result.result.message);
}

async function restorableRegistryBackupEntry(
  userDataDir: string,
  backupId: string
): Promise<RegistryBackupEntry | null> {
  try {
    return await assertRegistryBackupEntryStillRestorable(userDataDir, backupId);
  } catch {
    return null;
  }
}

type RegistryBackupReadResult =
  | { kind: "entry"; entry: RegistryBackupEntry }
  | { kind: "restore-result"; result: RegistryBackupRestoreResult };

type RegistryBackupReadOptions = {
  allowChangedContent?: boolean;
};

async function readRegistryBackupEntryForRestore(
  userDataDir: string,
  backupId: string,
  options: RegistryBackupReadOptions = {}
): Promise<RegistryBackupReadResult> {
  if (!isSafeRegistryBackupId(backupId)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
      }
    };
  }

  const root = registryBackupItemsRoot(userDataDir);
  const entryDir = join(root, backupId);
  const backupPath = join(entryDir, "backup.reg");
  const metaPath = join(entryDir, "meta.json");

  const linkedEntry = await findLinkedPathPart(entryDir, userDataDir, true);
  if (linkedEntry) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 폴더가 링크라 되돌리지 않았어요."
      }
    };
  }
  const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
  if (linkedMeta) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 정보 파일이 링크라 되돌리지 않았어요."
      }
    };
  }
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "앱 삭제 흔적 백업 파일이 링크라 되돌리지 않았어요."
      }
    };
  }

  let raw: Partial<RegistryBackupEntry>;
  try {
    raw = JSON.parse(await fs.readFile(metaPath, "utf8")) as Partial<RegistryBackupEntry>;
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업을 찾지 못했어요."
      }
    };
  }

  if (raw.id !== backupId) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업 정보를 확인하지 못했어요."
      }
    };
  }
  const backupKind = restoreAppBackupKindFromEntry(raw.backupKind);
  const valueName = cleanOptionalString(raw.valueName);
  const rawKeyPath = typeof raw.keyPath === "string" ? raw.keyPath : "";
  const safeLocation =
    rawKeyPath.length > 0 &&
    (backupKind === "startup-value" && valueName
      ? isSafeStartupRegistryValuePath(rawKeyPath, valueName)
      : backupKind === "registered-app-value" && valueName
        ? isSafeRegisteredApplicationRegistryValuePath(rawKeyPath, valueName)
        : backupKind === "environment-path-value" && valueName
          ? isSafeEnvironmentPathRegistryValuePath(rawKeyPath, valueName)
          : backupKind === "environment-variable-value" && valueName
            ? isSafeEnvironmentVariableRegistryValuePath(rawKeyPath, valueName)
            : backupKind === "firewall-rule-value" && valueName
              ? isSafeFirewallRuleRegistryValuePath(rawKeyPath, valueName)
              : backupKind === "app-execution-history-value" && valueName
                ? isSafeAppExecutionHistoryRegistryValuePath(rawKeyPath, valueName)
              : backupKind === "app-capabilities-key"
                ? isSafeAppCapabilitiesRegistryKeyPath(rawKeyPath)
              : backupKind === "app-path-key"
                ? isSafeAppPathRegistryKeyPath(rawKeyPath)
                : backupKind === "open-with-key"
                  ? isSafeOpenWithRegistryKeyPath(rawKeyPath)
                  : backupKind === "file-association-key"
                    ? isSafeFileAssociationRegistryKeyPath(rawKeyPath)
                    : backupKind === "context-menu-key"
                      ? isSafeContextMenuRegistryKeyPath(rawKeyPath)
                      : backupKind === "shell-extension-key"
                        ? isSafeShellExtensionRegistryKeyPath(rawKeyPath)
                        : backupKind === "explorer-extension-key"
                          ? isSafeExplorerExtensionRegistryKeyPath(rawKeyPath)
                        : backupKind === "protocol-handler-key"
                          ? isSafeProtocolHandlerRegistryKeyPath(rawKeyPath)
                          : backupKind === "native-messaging-host-key"
                            ? isSafeNativeMessagingHostRegistryKeyPath(rawKeyPath)
                            : backupKind === "com-local-server-key"
                              ? isSafeComLocalServerRegistryKeyPath(rawKeyPath)
                              : backupKind === "com-app-id-key"
                                ? isSafeComAppIdRegistryKeyPath(rawKeyPath)
                                : backupKind === "com-inproc-server-key"
                                  ? isSafeComInprocServerRegistryKeyPath(rawKeyPath)
                                  : backupKind === "service-key"
                                    ? isSafeServiceRegistryKeyPath(rawKeyPath)
                                    : isSafeUninstallRegistryKeyPath(rawKeyPath));
  if (!safeLocation) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "blocked-path",
        message: "지원하는 앱 삭제 흔적 레지스트리 위치가 아니라 되돌리지 않았어요."
      }
    };
  }
  if (!isValidIso(raw.createdAt) || !isValidIso(raw.expiresAt)) {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "not-found",
        message: "앱 삭제 흔적 백업 정보를 확인하지 못했어요."
      }
    };
  }

  const entry: RegistryBackupEntry = {
    id: backupId,
    keyPath: normalizeRegistryKeyPath(rawKeyPath),
    backupPath,
    sizeBytes: 0,
    contentHash: isValidRegistryBackupContentHash(raw.contentHash) ? raw.contentHash : null,
    integrityStatus: isValidRegistryBackupContentHash(raw.contentHash) ? "verified" : "legacy",
    createdAt: raw.createdAt,
    expiresAt: canonicalRegistryBackupExpiry(raw.createdAt)
  };
  if (backupKind === "startup-value") {
    entry.backupKind = "startup-value";
    entry.valueName = valueName ?? null;
  } else if (backupKind === "registered-app-value") {
    entry.backupKind = "registered-app-value";
    entry.valueName = valueName ?? null;
  } else if (backupKind === "environment-path-value") {
    entry.backupKind = "environment-path-value";
    entry.valueName = valueName ?? null;
    entry.environmentPathSegment =
      cleanOptionalString(raw.environmentPathSegment) ?? null;
  } else if (backupKind === "environment-variable-value") {
    entry.backupKind = "environment-variable-value";
    entry.valueName = valueName ?? null;
  } else if (backupKind === "firewall-rule-value") {
    entry.backupKind = "firewall-rule-value";
    entry.valueName = valueName ?? null;
  } else if (backupKind === "app-execution-history-value") {
    entry.backupKind = "app-execution-history-value";
    entry.valueName = valueName ?? null;
  } else if (backupKind === "app-capabilities-key") {
    entry.backupKind = "app-capabilities-key";
  } else if (backupKind === "app-path-key") {
    entry.backupKind = "app-path-key";
  } else if (backupKind === "open-with-key") {
    entry.backupKind = "open-with-key";
  } else if (backupKind === "file-association-key") {
    entry.backupKind = "file-association-key";
  } else if (backupKind === "context-menu-key") {
    entry.backupKind = "context-menu-key";
  } else if (backupKind === "shell-extension-key") {
    entry.backupKind = "shell-extension-key";
  } else if (backupKind === "explorer-extension-key") {
    entry.backupKind = "explorer-extension-key";
  } else if (backupKind === "protocol-handler-key") {
    entry.backupKind = "protocol-handler-key";
  } else if (backupKind === "native-messaging-host-key") {
    entry.backupKind = "native-messaging-host-key";
  } else if (backupKind === "com-local-server-key") {
    entry.backupKind = "com-local-server-key";
  } else if (backupKind === "com-inproc-server-key") {
    entry.backupKind = "com-inproc-server-key";
  } else if (backupKind === "com-app-id-key") {
    entry.backupKind = "com-app-id-key";
  } else if (backupKind === "service-key") {
    entry.backupKind = "service-key";
  }
  const appName = cleanDisplayString(raw.appName);
  const appPublisher = cleanDisplayString(raw.appPublisher);
  if (appName) entry.appName = appName;
  if (appPublisher) entry.appPublisher = appPublisher;

  try {
    const backupStat = await fs.lstat(backupPath);
    if (backupStat.isSymbolicLink()) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: "앱 삭제 흔적 백업 파일이 링크라 되돌리지 않았어요.",
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    if (!backupStat.isFile()) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "missing-backup",
          message: "앱 삭제 흔적 백업 파일이 보이지 않아요.",
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    try {
      entry.sizeBytes = await assertRestorableRegistryBackupFile(
        entryDir,
        backupPath,
        entry.keyPath,
        entry.backupKind === "startup-value" ||
          entry.backupKind === "registered-app-value" ||
          entry.backupKind === "environment-path-value" ||
          entry.backupKind === "environment-variable-value" ||
          entry.backupKind === "firewall-rule-value" ||
          entry.backupKind === "app-execution-history-value"
          ? entry.valueName ?? undefined
          : undefined
      );
    } catch (err) {
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: friendlyRegistryBackupBlockedMessage(err, entry),
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    if (!entry.contentHash) {
      if (options.allowChangedContent) {
        return { kind: "entry", entry };
      }
      const label = registryBackupKindLabel(entry);
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: `${label} 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않았어요.`,
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    const actualHash = await hashFile(backupPath);
    if (actualHash !== entry.contentHash.value) {
      entry.integrityStatus = "changed";
      if (options.allowChangedContent) {
        return { kind: "entry", entry };
      }
      return {
        kind: "restore-result",
        result: {
          backupId,
          status: "blocked-path",
          message: "앱 삭제 흔적 백업 파일이 바뀐 것 같아요. 안전하게 되돌리지 않았어요.",
          keyPath: entry.keyPath,
          entry
        }
      };
    }
    entry.integrityStatus = "verified";
    return { kind: "entry", entry };
  } catch {
    return {
      kind: "restore-result",
      result: {
        backupId,
        status: "missing-backup",
        message: "앱 삭제 흔적 백업 파일이 보이지 않아요.",
        keyPath: entry.keyPath,
        entry
      }
    };
  }
}

async function pruneNonRestorableRegistryBackupItems(userDataDir: string): Promise<void> {
  const root = registryBackupItemsRoot(userDataDir);
  const linkedRoot = await findLinkedPathPart(root, userDataDir, true);
  if (linkedRoot) {
    await removeLinkedRegistryBackupRootIfManaged(userDataDir, linkedRoot);
    return;
  }

  let dirs;
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      await removeRegistryBackupStoreItem(root, dir.name);
      continue;
    }

    const result = await readRegistryBackupEntryForRestore(userDataDir, dir.name, {
      allowChangedContent: true
    });
    if (result.kind === "restore-result") {
      await removeRegistryBackupStoreItem(root, dir.name);
    }
  }
}

async function measureRegistryBackupPurgeBytes(entryDir: string): Promise<number> {
  const backupPath = join(entryDir, "backup.reg");
  const linkedBackup = await findLinkedPathPart(backupPath, entryDir, true);
  if (linkedBackup) return 0;

  try {
    const stat = await fs.lstat(backupPath);
    if (stat.isSymbolicLink() || !stat.isFile()) return 0;
    return Math.max(0, stat.size);
  } catch {
    return 0;
  }
}

async function removeRegistryBackupDirAcceptingLateSuccess(
  removeEntryDir: (dir: string, entryId: string) => Promise<void>,
  entryDir: string,
  entryId: string
): Promise<void> {
  try {
    await removeEntryDir(entryDir, entryId);
  } catch (err) {
    if (!(await pathExists(entryDir))) return;
    throw err;
  }
  if (await pathExists(entryDir)) {
    throw new Error("Expired registry backup still exists after purge");
  }
}

async function assertSafeRegistryBackupEntryDirForPurge(
  userDataDir: string,
  backupId: string
): Promise<string> {
  if (!isSafeRegistryBackupId(backupId)) {
    throw new Error("FormatBuddy registry backup purge id is not safe");
  }

  const root = registryBackupItemsRoot(userDataDir);
  const normalizedRoot = normalizePath(resolve(root));
  const entryDir = join(root, backupId);
  const normalizedEntryDir = normalizePath(resolve(entryDir));
  if (!normalizedEntryDir.startsWith(`${normalizedRoot}\\`)) {
    throw new Error("FormatBuddy registry backup purge folder is outside the backup bin");
  }

  const linkedEntryDir = await findLinkedPathPart(entryDir, userDataDir, true);
  if (linkedEntryDir) {
    throw new Error(`FormatBuddy registry backup purge folder is a link: ${linkedEntryDir}`);
  }

  const stat = await fs.lstat(entryDir);
  if (!stat.isDirectory()) {
    throw new Error("FormatBuddy registry backup purge folder is not a folder");
  }

  return entryDir;
}

export async function listRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
}): Promise<RegistryBackupSnapshot> {
  await purgeExpiredRegistryBackups(options);
  await pruneNonRestorableRegistryBackupItems(options.userDataDir);

  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    return { entries: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  let dirs;
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { entries: [], retentionDays: REGISTRY_BACKUP_RETENTION_DAYS };
  }

  const entries: RegistryBackupEntry[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const entry = await readRegistryBackupEntry(options.userDataDir, dir.name);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

  return {
    entries,
    retentionDays: REGISTRY_BACKUP_RETENTION_DAYS,
    nextExpiryAt: entries[0]?.expiresAt
  };
}

export async function purgeExpiredRegistryBackups(options: {
  userDataDir: string;
  now?: () => Date;
  pruneNonRestorable?: boolean;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
}): Promise<RegistryBackupPurgeResult> {
  const root = registryBackupItemsRoot(options.userDataDir);
  const linkedRoot = await findLinkedPathPart(root, options.userDataDir, true);
  if (linkedRoot) {
    await removeLinkedRegistryBackupRootIfManaged(options.userDataDir, linkedRoot);
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
    };
  }

  if (options.pruneNonRestorable) {
    await pruneNonRestorableRegistryBackupItems(options.userDataDir);
  }

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return {
      purgedCount: 0,
      purgedBytes: 0,
      purgedIds: [],
      retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
    };
  }

  const now = options.now?.() ?? new Date();
  const purgedIds: string[] = [];
  const purgedItems: RegistryBackupPurgedItem[] = [];
  const failedIds: string[] = [];
  let purgedBytes = 0;
  const removeEntryDir =
    options.removeEntryDir ??
    ((dir: string) => fs.rm(dir, { recursive: true, force: true }));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const entryDir = await assertSafeRegistryBackupEntryDirForPurge(
        options.userDataDir,
        entry.name
      );
      const metaPath = join(entryDir, "meta.json");
      const linkedMeta = await findLinkedPathPart(metaPath, entryDir, true);
      if (linkedMeta) {
        if (await removeRegistryBackupStoreItem(root, entry.name)) {
          purgedIds.push(entry.name);
        }
        continue;
      }
      const linkedEntryDescendant = await findLinkedDescendant(entryDir);
      if (linkedEntryDescendant) {
        throw new Error(`Expired registry backup contains a nested link: ${linkedEntryDescendant}`);
      }
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as {
        createdAt?: unknown;
        expiresAt?: unknown;
      };
      if (typeof meta.expiresAt !== "string") continue;
      const effectiveExpiresAt =
        typeof meta.createdAt === "string" && isValidIso(meta.createdAt)
          ? canonicalRegistryBackupExpiry(meta.createdAt)
          : meta.expiresAt;
      if (
        !isOutsideRegistryBackupRestorableWindow(
          {
            createdAt:
              typeof meta.createdAt === "string" && isValidIso(meta.createdAt)
                ? meta.createdAt
                : now.toISOString(),
            expiresAt: effectiveExpiresAt
          },
          now
        )
      ) {
        continue;
      }
      const readableEntry = await readRegistryBackupEntry(options.userDataDir, entry.name).catch(
        () => null
      );
      const entryBytes = await measureRegistryBackupPurgeBytes(entryDir);
      await removeRegistryBackupDirAcceptingLateSuccess(removeEntryDir, entryDir, entry.name);
      purgedBytes += entryBytes;
      purgedIds.push(entry.name);
      if (readableEntry) {
        purgedItems.push({
          id: readableEntry.id,
          label: registryBackupPurgeLabel(readableEntry),
          backupKind: purgedItemBackupKindFromEntry(readableEntry.backupKind),
          sizeBytes: entryBytes
        });
      }
    } catch {
      if (isSafeRegistryBackupId(entry.name)) failedIds.push(entry.name);
      continue;
    }
  }

  return {
    purgedCount: purgedIds.length,
    purgedBytes,
    purgedIds,
    ...(purgedItems.length > 0 ? { purgedItems } : {}),
    ...(failedIds.length > 0 ? { failedIds } : {}),
    retentionDays: REGISTRY_BACKUP_RETENTION_DAYS
  };
}

function registryBackupExpiredRestoreResult(
  entry: RegistryBackupEntry
): RegistryBackupRestoreResult {
  return {
    backupId: entry.id,
    status: "expired",
    message: "30일 보관 기간이 지나서 되돌릴 수 없어요. 자동 비움이 아직 끝나지 않았다면 다음 확인 때 다시 비울게요.",
    keyPath: entry.keyPath,
    entry
  };
}

export async function restoreRegistryBackup(options: {
  userDataDir: string;
  backupId: string;
  now?: () => Date;
  runner?: RegistryCleanupRunner;
  beforeImport?: () => Promise<void>;
  removeEntryDir?: (dir: string, entryId: string) => Promise<void>;
  onAppRegistryBackupRestored?: (app: RegistryBackupRestoredApp) => void | Promise<void>;
}): Promise<RegistryBackupRestoreResult> {
  if (!isSafeRegistryBackupId(options.backupId)) {
    return {
      backupId: typeof options.backupId === "string" ? options.backupId : "",
      status: "blocked-path",
      message: "복구함 항목 이름이 안전하지 않아 되돌리지 않았어요."
    };
  }

  await purgeExpiredRegistryBackups({
    userDataDir: options.userDataDir,
    now: options.now,
    removeEntryDir: options.removeEntryDir
  });

  const readResult = await readRegistryBackupEntryForRestore(options.userDataDir, options.backupId);
  if (readResult.kind === "restore-result") return readResult.result;
  let { entry } = readResult;
  const now = options.now?.() ?? new Date();
  if (isOutsideRegistryBackupRestorableWindow(entry, now)) {
    return registryBackupExpiredRestoreResult(entry);
  }

  const runner = options.runner ?? defaultRegistryCleanupRunner();
  const importFile = runner.importFile;
  if (!importFile) {
    const label = registryBackupKindLabel(entry);
    return {
      backupId: options.backupId,
      status: "restore-failed",
      message: `${label}을 되돌릴 준비가 되지 않았어요.`,
      keyPath: entry.keyPath,
      entry
    };
  }

  try {
    await options.beforeImport?.().catch(() => {});
    const latestReadResult = await readRegistryBackupEntryForRestore(
      options.userDataDir,
      options.backupId
    );
    if (latestReadResult.kind === "restore-result") return latestReadResult.result;
    entry = latestReadResult.entry;
    const latestNow = options.now?.() ?? new Date();
    if (isOutsideRegistryBackupRestorableWindow(entry, latestNow)) {
      return registryBackupExpiredRestoreResult(entry);
    }
    await importFile(entry.backupPath);
    await assertRegistryBackupRestored(entry, runner);
    const restoredEntryDir = join(registryBackupItemsRoot(options.userDataDir), entry.id);
    const removeEntryDir =
      options.removeEntryDir ??
      ((dir: string) => fs.rm(dir, { recursive: true, force: true }));
    await removeRegistryBackupDirAcceptingLateSuccess(removeEntryDir, restoredEntryDir, entry.id);
    const appName = cleanDisplayString(entry.appName);
    const appPublisher = cleanDisplayString(entry.appPublisher) ?? null;
    if (appName) {
      const backupKind = restoreAppBackupKindFromEntry(entry.backupKind);
      const restoredApp: RegistryBackupRestoredApp =
        backupKind === "startup-value" ||
        backupKind === "registered-app-value" ||
        backupKind === "environment-path-value" ||
        backupKind === "environment-variable-value" ||
        backupKind === "firewall-rule-value" ||
        backupKind === "app-execution-history-value"
          ? {
              name: appName,
              publisher: appPublisher,
              backupKind,
              ...(entry.valueName ? { valueName: entry.valueName } : {})
            }
          : {
              name: appName,
              publisher: appPublisher,
              backupKind,
              registryKeyPath: entry.keyPath
            };
      await Promise.resolve(
        options.onAppRegistryBackupRestored?.(restoredApp)
      ).catch(() => {});
    }
    const label = registryBackupKindLabel(entry);
    return {
      backupId: entry.id,
      status: "restored",
      message: `${label}을 되돌렸어요.`,
      keyPath: entry.keyPath,
      entry
    };
  } catch (err) {
    return {
      backupId: entry.id,
      status: "restore-failed",
      message: friendlyRegistryRestoreFailureMessage(err, entry),
      keyPath: entry.keyPath,
      entry
    };
  }
}

async function assertRegistryBackupRestored(
  entry: RegistryBackupEntry,
  runner: RegistryCleanupRunner
): Promise<void> {
  const label = registryBackupKindLabel(entry);
  if (
    entry.backupKind === "startup-value" ||
    entry.backupKind === "registered-app-value" ||
    entry.backupKind === "environment-path-value" ||
    entry.backupKind === "environment-variable-value" ||
    entry.backupKind === "firewall-rule-value" ||
    entry.backupKind === "app-execution-history-value"
  ) {
    if (!entry.valueName || !runner.valueExists) return;
    if (!(await runner.valueExists(entry.keyPath, entry.valueName))) {
      throw new Error(`${label}이 아직 되살아나지 않았어요.`);
    }
    return;
  }

  if (!runner.keyExists) return;
  if (!(await runner.keyExists(entry.keyPath))) {
    throw new Error(`${label}이 아직 되살아나지 않았어요.`);
  }
}

export const __testing = {
  normalizeRegistryKeyPath,
  registrySubKeysFromRegOutput,
  registryBackupExpiry,
  registryBackupItemsRoot,
  assertSafeRegistryBackupEntryDirForPurge
};
