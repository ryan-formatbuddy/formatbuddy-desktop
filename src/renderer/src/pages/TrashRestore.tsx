import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Lockup } from "../components/Lockup";
import {
  daysUntilTrashExpiry,
  isTrashEntryExpired,
  registryBackupKindLabel,
  registryBackupRestoreButtonLabel,
  restoreEntryExpiryLabel,
  restoreBinExpiryInsight,
  sortTrashEntriesByExpiry,
  summarizeRegistryBackupRestoreResults,
  summarizeScheduledTaskBackupRestoreResults,
  summarizeStartupFolderRestoreResults,
  summarizeTrashRestoreResults,
  type RestoreBinExpiryTone,
} from "@shared/cleanup-result";
import { friendlyErrorMessage } from "@shared/error-friendly";
import { RESTORE_BIN_RETENTION_DAYS } from "@shared/retention";
import {
  CLEANUP_RESTORE_ALL_MISSING_BRIDGE_MESSAGE,
  cleanupRestoreMissingBridge,
  cleanupRestorePlanFromItems,
  cleanupRestoreSummary,
  runCleanupRestorePlan
} from "./cleanupRestoreAll";
import type {
  CleanupCategoryId,
  CleanupTrashEntry,
  CleanupTrashRestoreResult,
  CleanupTrashSnapshot,
  RegistryBackupEntry,
  RegistryBackupRestoreResult,
  RegistryBackupSnapshot,
  ScheduledTaskBackupEntry,
  ScheduledTaskBackupRestoreResult,
  ScheduledTaskBackupSnapshot,
  StartupAutoDisabledEntry,
  StartupAutoDisabledSnapshot,
  StartupFolderToggleResult
} from "@shared/types";

interface TrashRestoreProps {
  onBack: () => void;
}

/**
 * FormatBuddy Trash (30-day restore bin) — UI surface.
 *
 * Built on the `cleanup-trash:*` IPC channels and the
 * `main/cleanup/trash.ts` engine. Every entry shown here represents a
 * file that the user explicitly selected in the Cleanup page; nothing
 * here was deleted automatically.
 *
 * User verbs:
 *   - "되돌리기" calls cleanup-trash:restore, which atomically moves
 *     the stored bytes back to `originalPath`. Refuses when a same-name
 *     file already exists at the target (no overwrite, ever).
 *   - "모두 되돌리기" loops through the same restore IPC for every
 *     entry and summarizes restored/blocked/missing outcomes.
 *   - Expired entries are cleaned by the main process on load/startup.
 *     We intentionally do NOT expose a manual single-entry empty action;
 *     purge is by expiry only so one wrong click can't remove a backup.
 */
const CATEGORY_LABEL: Record<CleanupCategoryId, string> = {
  "recycle-bin": "휴지통",
  "temp-user": "사용자 임시",
  "temp-windows": "Windows 임시",
  "browser-cache": "브라우저 캐시",
  "diagnostic-reports": "오류 리포트",
  "windows-old": "이전 Windows",
  "downloads-installers": "오래된 설치 파일",
  "large-files": "큰 파일",
  "app-leftovers": "앱 잔여 폴더"
};

type RestoreListItem =
  | {
      id: string;
      kind: "file";
      entry: CleanupTrashEntry;
      expiresAt: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "registry";
      entry: RegistryBackupEntry;
      expiresAt: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "startup";
      entry: StartupAutoDisabledEntry;
      expiresAt: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "scheduled-task";
      entry: ScheduledTaskBackupEntry;
      expiresAt: string;
      createdAt: string;
    };

function emptyTrashSnapshot(): CleanupTrashSnapshot {
  return {
    entries: [],
    totalBytes: 0,
    retentionDays: RESTORE_BIN_RETENTION_DAYS
  };
}

function emptyRegistrySnapshot(): RegistryBackupSnapshot {
  return {
    entries: [],
    retentionDays: RESTORE_BIN_RETENTION_DAYS
  };
}

function emptyStartupSnapshot(): StartupAutoDisabledSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    entries: [],
    notes: []
  };
}

function emptyScheduledTaskSnapshot(): ScheduledTaskBackupSnapshot {
  return {
    entries: [],
    retentionDays: RESTORE_BIN_RETENTION_DAYS
  };
}

function restoreBinPartialLoadMessage(failedLabels: string[]): string | null {
  if (failedLabels.length === 0) return null;
  const label = failedLabels.join(", ");
  return `${label}은 지금 불러오지 못했어요. 불러온 복구 항목은 그대로 보여드릴게요.`;
}

function restoreBinExpiryInsightColor(tone: RestoreBinExpiryTone): string {
  if (tone === "urgent") return "#1d4ed8";
  if (tone === "watch") return "#475569";
  return "#0f766e";
}

function restoreBinExpiryInsightBackground(tone: RestoreBinExpiryTone): string {
  if (tone === "urgent") return "rgba(37, 99, 235, 0.08)";
  if (tone === "watch") return "rgba(100, 116, 139, 0.10)";
  return "rgba(15, 118, 110, 0.08)";
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const mb = value / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} GB`;
}

function formatLocal(at: string): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return at;
  return new Date(t).toLocaleString("ko-KR");
}

function registryBackupTitle(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "startup-value") {
    const appName = entry.appName?.trim();
    const valueName = entry.valueName?.trim();
    if (appName) return `${appName} 시작 항목`;
    if (valueName) return `${valueName} 시작 항목`;
    return "시작 항목 이름을 확인하지 못했어요";
  }
  if (entry.backupKind === "environment-path-value") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} PATH 경로`;
    return "PATH 경로를 확인하지 못했어요";
  }
  if (entry.backupKind === "environment-variable-value") {
    const appName = entry.appName?.trim();
    const valueName = entry.valueName?.trim();
    if (appName) return `${appName} 환경 설정 흔적`;
    if (valueName) return `${valueName} 환경 설정 흔적`;
    return "환경 설정 흔적을 확인하지 못했어요";
  }
  if (entry.backupKind === "firewall-rule-value") {
    const appName = entry.appName?.trim();
    const valueName = entry.valueName?.trim();
    if (appName) return `${appName} 방화벽 규칙`;
    if (valueName) return `${valueName} 방화벽 규칙`;
    return "방화벽 규칙을 확인하지 못했어요";
  }
  if (entry.backupKind === "app-capabilities-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 기본 앱 기능`;
    return "기본 앱 기능을 확인하지 못했어요";
  }
  if (entry.backupKind === "protocol-handler-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 프로토콜 연결`;
    return "프로토콜 연결을 확인하지 못했어요";
  }
  if (entry.backupKind === "native-messaging-host-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 브라우저 연결 도우미`;
    return "브라우저 연결 도우미를 확인하지 못했어요";
  }
  if (entry.backupKind === "com-local-server-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 앱 실행 연결`;
    return "앱 실행 연결을 확인하지 못했어요";
  }
  if (entry.backupKind === "com-inproc-server-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 앱 확장 연결`;
    return "앱 확장 연결을 확인하지 못했어요";
  }
  if (entry.backupKind === "com-app-id-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 앱 실행 연결 정보`;
    return "앱 실행 연결 정보를 확인하지 못했어요";
  }
  if (entry.backupKind === "file-association-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 파일 형식 연결`;
    return "파일 형식 연결을 확인하지 못했어요";
  }
  if (entry.backupKind === "shell-extension-key") {
    const appName = entry.appName?.trim();
    if (appName) return `${appName} 우클릭 확장`;
    return "우클릭 확장을 확인하지 못했어요";
  }

  const appName = entry.appName?.trim();
  return appName ? `${appName} 삭제 흔적` : "앱 이름을 확인하지 못한 삭제 흔적";
}

function registryBackupSubtitle(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "startup-value") {
    const appPublisher = entry.appPublisher?.trim();
    const valueName = entry.valueName?.trim();
    const detail = valueName ? `시작 항목 이름 ${valueName}` : "Windows 시작 때 실행되는 항목";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "environment-path-value") {
    const appPublisher = entry.appPublisher?.trim();
    const segment = entry.environmentPathSegment?.trim();
    const detail = segment ? `남은 경로 ${segment}` : "앱 삭제 후 PATH에 남은 경로";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "environment-variable-value") {
    const appPublisher = entry.appPublisher?.trim();
    const valueName = entry.valueName?.trim();
    const detail = valueName ? `남은 환경 설정 ${valueName}` : "앱 삭제 후 남은 환경 설정";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "firewall-rule-value") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "앱 삭제 후 남은 네트워크 허용 규칙";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "app-capabilities-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "파일 형식과 기본 앱 화면에 남는 기능 연결";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "protocol-handler-key") {
    const appPublisher = entry.appPublisher?.trim();
    return appPublisher ? `${appPublisher} · 앱 실행 연결` : "앱 실행 연결";
  }
  if (entry.backupKind === "native-messaging-host-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "브라우저와 앱을 연결하는 도우미";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "com-local-server-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "앱 삭제 후 남은 실행 연결";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "com-inproc-server-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "앱 삭제 후 남은 확장 연결";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "com-app-id-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "앱 실행 연결을 함께 묶어두는 정보";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "file-association-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "파일을 어떤 앱으로 열지 정하는 연결";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }
  if (entry.backupKind === "shell-extension-key") {
    const appPublisher = entry.appPublisher?.trim();
    const detail = "우클릭 메뉴를 깊게 연결하는 확장";
    return appPublisher ? `${appPublisher} · ${detail}` : detail;
  }

  const appPublisher = entry.appPublisher?.trim();
  return appPublisher ? `${appPublisher} · 앱 삭제 흔적 위치` : "앱 삭제 흔적 위치";
}

function registryRestoreErrorLabel(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "environment-path-value") return "PATH 경로";
  if (entry.backupKind === "environment-variable-value") return "환경 설정 흔적";
  if (entry.backupKind === "firewall-rule-value") return "방화벽 규칙";
  if (entry.backupKind === "app-capabilities-key") return "기본 앱 기능";
  if (entry.backupKind === "protocol-handler-key") return "프로토콜 연결";
  if (entry.backupKind === "native-messaging-host-key") return "브라우저 연결 도우미";
  if (entry.backupKind === "com-local-server-key") return "앱 실행 연결";
  if (entry.backupKind === "com-inproc-server-key") return "앱 확장 연결";
  if (entry.backupKind === "com-app-id-key") return "앱 실행 연결 정보";
  if (entry.backupKind === "file-association-key") return "파일 형식 연결";
  if (entry.backupKind === "shell-extension-key") return "우클릭 확장";
  return entry.backupKind === "startup-value" ? "시작 항목" : "앱 흔적";
}

function registryBackupChangedNotice(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "environment-path-value") {
    return "PATH 경로 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "environment-variable-value") {
    return "환경 설정 흔적 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "firewall-rule-value") {
    return "방화벽 규칙 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "app-capabilities-key") {
    return "기본 앱 기능 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "protocol-handler-key") {
    return "프로토콜 연결 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "native-messaging-host-key") {
    return "브라우저 연결 도우미 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "com-local-server-key") {
    return "앱 실행 연결 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "com-inproc-server-key") {
    return "앱 확장 연결 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "com-app-id-key") {
    return "앱 실행 연결 정보 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "file-association-key") {
    return "파일 형식 연결 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  if (entry.backupKind === "shell-extension-key") {
    return "우클릭 확장 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
  }
  return entry.backupKind === "startup-value"
    ? "시작 항목 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요."
    : "앱 삭제 흔적 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
}

function registryBackupChangedButtonLabel(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "environment-path-value") return "PATH 경로 확인 필요";
  if (entry.backupKind === "environment-variable-value") return "환경 설정 흔적 확인 필요";
  if (entry.backupKind === "firewall-rule-value") return "방화벽 규칙 확인 필요";
  if (entry.backupKind === "app-capabilities-key") return "기본 앱 기능 확인 필요";
  if (entry.backupKind === "protocol-handler-key") return "프로토콜 연결 확인 필요";
  if (entry.backupKind === "native-messaging-host-key") return "브라우저 연결 확인 필요";
  if (entry.backupKind === "com-local-server-key") return "앱 실행 연결 확인 필요";
  if (entry.backupKind === "com-inproc-server-key") return "앱 확장 연결 확인 필요";
  if (entry.backupKind === "com-app-id-key") return "앱 실행 연결 정보 확인 필요";
  if (entry.backupKind === "file-association-key") return "파일 형식 연결 확인 필요";
  if (entry.backupKind === "shell-extension-key") return "우클릭 확장 확인 필요";
  return entry.backupKind === "startup-value" ? "시작 항목 확인 필요" : "앱 삭제 흔적 확인 필요";
}

function registryBackupLegacyNotice(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "environment-path-value") {
    return "PATH 경로 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "environment-variable-value") {
    return "환경 설정 흔적 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "firewall-rule-value") {
    return "방화벽 규칙 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "app-capabilities-key") {
    return "기본 앱 기능 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "protocol-handler-key") {
    return "프로토콜 연결 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "native-messaging-host-key") {
    return "브라우저 연결 도우미 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "com-local-server-key") {
    return "앱 실행 연결 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "com-inproc-server-key") {
    return "앱 확장 연결 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "com-app-id-key") {
    return "앱 실행 연결 정보 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "file-association-key") {
    return "파일 형식 연결 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  if (entry.backupKind === "shell-extension-key") {
    return "우클릭 확장 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
  }
  return entry.backupKind === "startup-value"
    ? "시작 항목 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요."
    : "앱 삭제 흔적 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
}

function registryBackupLegacyButtonLabel(entry: RegistryBackupEntry): string {
  if (entry.backupKind === "environment-path-value") return "PATH 경로 기록 확인 필요";
  if (entry.backupKind === "environment-variable-value") return "환경 설정 흔적 기록 확인 필요";
  if (entry.backupKind === "firewall-rule-value") return "방화벽 규칙 기록 확인 필요";
  if (entry.backupKind === "app-capabilities-key") return "기본 앱 기능 기록 확인 필요";
  if (entry.backupKind === "protocol-handler-key") return "프로토콜 연결 기록 확인 필요";
  if (entry.backupKind === "native-messaging-host-key") return "브라우저 연결 기록 확인 필요";
  if (entry.backupKind === "com-local-server-key") return "앱 실행 연결 기록 확인 필요";
  if (entry.backupKind === "com-inproc-server-key") return "앱 확장 연결 기록 확인 필요";
  if (entry.backupKind === "com-app-id-key") return "앱 실행 연결 정보 기록 확인 필요";
  if (entry.backupKind === "file-association-key") return "파일 형식 연결 기록 확인 필요";
  if (entry.backupKind === "shell-extension-key") return "우클릭 확장 기록 확인 필요";
  return entry.backupKind === "startup-value" ? "시작 항목 기록 확인 필요" : "앱 삭제 흔적 기록 확인 필요";
}

function isChangedTrashEntry(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus === "changed";
}

function isLegacyTrashEntry(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus === "legacy";
}

function trashEntryNeedsCheck(entry: CleanupTrashEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function isChangedRegistryBackupEntry(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus === "changed";
}

function isLegacyRegistryBackupEntry(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus === "legacy";
}

function registryBackupNeedsCheck(entry: RegistryBackupEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function startupDisabledNeedsCheck(entry: StartupAutoDisabledEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function scheduledTaskBackupNeedsCheck(entry: ScheduledTaskBackupEntry): boolean {
  return entry.integrityStatus !== "verified";
}

function restoreListItemNeedsCheck(item: RestoreListItem): boolean {
  if (item.kind === "registry") return registryBackupNeedsCheck(item.entry);
  if (item.kind === "startup") return startupDisabledNeedsCheck(item.entry);
  if (item.kind === "scheduled-task") return scheduledTaskBackupNeedsCheck(item.entry);
  return trashEntryNeedsCheck(item.entry);
}

function dedupeRestoreListItems(items: RestoreListItem[]): RestoreListItem[] {
  const seen = new Set<string>();
  const unique: RestoreListItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function startupDisabledChangedNotice(): string {
  return "보관된 시작 항목 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
}

function startupDisabledLegacyNotice(): string {
  return "시작 항목 보관 기록을 확인할 수 없어요. 오래된 보관 항목이라 자동으로 되돌리지 않아요.";
}

function scheduledTaskTitle(entry: ScheduledTaskBackupEntry): string {
  const appName = entry.appName?.trim();
  return appName ? `${appName} 예약 작업` : entry.taskName;
}

function scheduledTaskSubtitle(entry: ScheduledTaskBackupEntry): string {
  const appPublisher = entry.appPublisher?.trim();
  const detail = `작업 스케줄러 ${entry.taskPath}`;
  return appPublisher ? `${appPublisher} · ${detail}` : detail;
}

function scheduledTaskChangedNotice(): string {
  return "예약 작업 백업 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.";
}

function scheduledTaskLegacyNotice(): string {
  return "예약 작업 백업 기록을 확인할 수 없어요. 오래된 백업이라 자동으로 되돌리지 않아요.";
}

export function TrashRestore({ onBack }: TrashRestoreProps) {
  const [snapshot, setSnapshot] = useState<CleanupTrashSnapshot | null>(null);
  const [registrySnapshot, setRegistrySnapshot] = useState<RegistryBackupSnapshot | null>(null);
  const [startupSnapshot, setStartupSnapshot] = useState<StartupAutoDisabledSnapshot | null>(null);
  const [scheduledTaskSnapshot, setScheduledTaskSnapshot] = useState<ScheduledTaskBackupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const trashTask = window.fb?.getCleanupTrash
      ? window.fb.getCleanupTrash()
      : Promise.reject(new Error("missing cleanup trash bridge"));
    const registryTask = window.fb?.getRegistryBackups
      ? window.fb.getRegistryBackups()
      : Promise.reject(new Error("missing registry backup bridge"));
    const startupTask = window.fb?.listDisabledStartupAuto
      ? window.fb.listDisabledStartupAuto()
      : Promise.reject(new Error("missing startup restore bridge"));
    const scheduledTaskTask = window.fb?.getScheduledTaskBackups
      ? window.fb.getScheduledTaskBackups()
      : Promise.reject(new Error("missing scheduled task restore bridge"));

    const [trash, registry, startup, scheduledTask] = await Promise.allSettled([
      trashTask,
      registryTask,
      startupTask,
      scheduledTaskTask
    ]);
    const failedLabels: string[] = [];

    if (trash.status === "fulfilled") {
      setSnapshot(trash.value);
    } else {
      setSnapshot(emptyTrashSnapshot());
      failedLabels.push("파일 복구함");
    }
    if (registry.status === "fulfilled") {
      setRegistrySnapshot(registry.value);
    } else {
      setRegistrySnapshot(emptyRegistrySnapshot());
      failedLabels.push("앱 삭제 흔적 백업");
    }
    if (startup.status === "fulfilled") {
      setStartupSnapshot(startup.value);
    } else {
      setStartupSnapshot(emptyStartupSnapshot());
      failedLabels.push("잠시 꺼둔 시작 항목");
    }
    if (scheduledTask.status === "fulfilled") {
      setScheduledTaskSnapshot(scheduledTask.value);
    } else {
      setScheduledTaskSnapshot(emptyScheduledTaskSnapshot());
      failedLabels.push("예약 작업 백업");
    }

    setError(restoreBinPartialLoadMessage(failedLabels));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const registryEntries = useMemo(
    () => registrySnapshot?.entries ?? [],
    [registrySnapshot]
  );
  const startupEntries = useMemo(
    () => startupSnapshot?.entries ?? [],
    [startupSnapshot]
  );
  const scheduledTaskEntries = useMemo(
    () => scheduledTaskSnapshot?.entries ?? [],
    [scheduledTaskSnapshot]
  );
  const registryBytes = useMemo(
    () => registryEntries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0),
    [registryEntries]
  );
  const scheduledTaskBytes = useMemo(
    () => scheduledTaskEntries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0),
    [scheduledTaskEntries]
  );
  const startupDisabledBytes = useMemo(
    () => startupEntries.reduce((sum, entry) => sum + Math.max(0, entry.sizeBytes), 0),
    [startupEntries]
  );
  const totalEntryCount =
    entries.length + registryEntries.length + startupEntries.length + scheduledTaskEntries.length;
  const hasPartialLoadIssue = Boolean(error);
  const sortedRestoreItems = useMemo(() => {
    const items: RestoreListItem[] = [
      ...entries.map((entry) => ({
        id: `file:${entry.id}`,
        kind: "file" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      })),
      ...registryEntries.map((entry) => ({
        id: `registry:${entry.id}`,
        kind: "registry" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      })),
      ...startupEntries.map((entry) => ({
        id: `startup:${entry.id}`,
        kind: "startup" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.disabledAt
      })),
      ...scheduledTaskEntries.map((entry) => ({
        id: `scheduled-task:${entry.id}`,
        kind: "scheduled-task" as const,
        entry,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      }))
    ];
    return sortTrashEntriesByExpiry(dedupeRestoreListItems(items));
  }, [entries, registryEntries, startupEntries, scheduledTaskEntries]);
  const restorableRestoreItems = useMemo(
    () =>
      sortedRestoreItems.filter((item) => {
        if (isTrashEntryExpired(item.expiresAt)) return false;
        if (item.kind === "registry") return !registryBackupNeedsCheck(item.entry);
        if (item.kind === "startup") return !startupDisabledNeedsCheck(item.entry);
        if (item.kind === "scheduled-task") return !scheduledTaskBackupNeedsCheck(item.entry);
        return !trashEntryNeedsCheck(item.entry);
      }),
    [sortedRestoreItems]
  );
  const totalRestorableCount = restorableRestoreItems.length;
  const restoreStatusSummary = useMemo(() => {
    const expiredCount = sortedRestoreItems.filter((item) => isTrashEntryExpired(item.expiresAt)).length;
    const checkNeededCount = sortedRestoreItems.filter(
      (item) => !isTrashEntryExpired(item.expiresAt) && restoreListItemNeedsCheck(item)
    ).length;
    return {
      restorableCount: totalRestorableCount,
      checkNeededCount,
      expiredCount
    };
  }, [sortedRestoreItems, totalRestorableCount]);

  const onRestore = useCallback(
    async (entry: CleanupTrashEntry) => {
      if (!window.fb?.restoreCleanupTrash) {
        setToast("파일 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
        return;
      }
      setBusy(`file:${entry.id}`);
      setToast(null);
      try {
        const result: CleanupTrashRestoreResult = await window.fb.restoreCleanupTrash({
          entryId: entry.id
        });
        setToast(summarizeTrashRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(friendlyErrorMessage(e as Error));
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreRegistry = useCallback(
    async (entry: RegistryBackupEntry) => {
      if (!window.fb?.restoreRegistryBackup) {
        setToast(
          "앱 삭제 흔적 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요."
        );
        return;
      }
      setBusy(`registry:${entry.id}`);
      setToast(null);
      try {
        const result: RegistryBackupRestoreResult = await window.fb.restoreRegistryBackup({
          backupId: entry.id
        });
        setToast(summarizeRegistryBackupRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(`${registryRestoreErrorLabel(entry)} 되돌리기 중 문제가 생겼어요. ${friendlyErrorMessage(e as Error)}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreStartup = useCallback(
    async (entry: StartupAutoDisabledEntry) => {
      if (!window.fb?.restoreStartupAuto) {
        setToast("시작 항목 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
        return;
      }
      setBusy(`startup:${entry.id}`);
      setToast(null);
      try {
        const result: StartupFolderToggleResult = await window.fb.restoreStartupAuto({
          disabledId: entry.id
        });
        setToast(summarizeStartupFolderRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(`시작 항목 되돌리기 중 문제가 생겼어요. ${friendlyErrorMessage(e as Error)}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreScheduledTask = useCallback(
    async (entry: ScheduledTaskBackupEntry) => {
      if (!window.fb?.restoreScheduledTaskBackup) {
        setToast("예약 작업 되돌리기를 연결하지 못했어요. 포맷버디를 다시 열고 한 번 더 시도해주세요.");
        return;
      }
      setBusy(`scheduled-task:${entry.id}`);
      setToast(null);
      try {
        const result: ScheduledTaskBackupRestoreResult = await window.fb.restoreScheduledTaskBackup({
          backupId: entry.id
        });
        setToast(summarizeScheduledTaskBackupRestoreResults([result]));
        await load();
      } catch (e) {
        setToast(`예약 작업 되돌리기 중 문제가 생겼어요. ${friendlyErrorMessage(e as Error)}`);
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const onRestoreAll = useCallback(async () => {
    const restoreCleanupTrash = window.fb?.restoreCleanupTrash;
    const restoreRegistryBackup = window.fb?.restoreRegistryBackup;
    const restoreStartupAuto = window.fb?.restoreStartupAuto;
    const restoreScheduledTaskBackup = window.fb?.restoreScheduledTaskBackup;
    const restorePlan = cleanupRestorePlanFromItems(restorableRestoreItems);
    if (totalEntryCount === 0) {
      setToast("되돌릴 항목이 없어요.");
      return;
    }
    if (totalRestorableCount === 0) {
      setToast("지금 바로 되돌릴 수 있는 항목이 없어요. 보관 기간이나 복구 기록을 확인해 주세요.");
      return;
    }
    if (
      cleanupRestoreMissingBridge(restorePlan, {
        restoreCleanupTrash: Boolean(restoreCleanupTrash),
        restoreRegistryBackup: Boolean(restoreRegistryBackup),
        restoreStartupAuto: Boolean(restoreStartupAuto),
        restoreScheduledTaskBackup: Boolean(restoreScheduledTaskBackup)
      })
    ) {
      setToast(CLEANUP_RESTORE_ALL_MISSING_BRIDGE_MESSAGE);
      return;
    }
    setBusy("restore-all");
    setToast(null);
    try {
      const outcome = await runCleanupRestorePlan(restorePlan, {
        restoreCleanupTrash,
        restoreRegistryBackup,
        restoreStartupAuto,
        restoreScheduledTaskBackup
      });
      setToast(
        cleanupRestoreSummary(outcome)
      );
      await load();
    } catch (e) {
      setToast(friendlyErrorMessage(e as Error));
    } finally {
      setBusy(null);
    }
  }, [load, restorableRestoreItems, totalEntryCount, totalRestorableCount]);

  const headerSummary = useMemo(() => {
    if (!snapshot || !registrySnapshot || !startupSnapshot || !scheduledTaskSnapshot) return "복구함 불러오는 중...";
    if (totalEntryCount === 0) {
      return hasPartialLoadIssue ? "불러온 복구 항목은 아직 없어요." : "복구함이 비어 있어요.";
    }
    const totalBytes = snapshot.totalBytes + registryBytes + startupDisabledBytes + scheduledTaskBytes;
    const appTraceCount = registryEntries.filter(
      (entry) => entry.backupKind !== "startup-value"
    ).length;
    const registryStartupCount = registryEntries.length - appTraceCount;
    const backupSummary = [
      appTraceCount > 0 ? `앱 삭제 흔적 백업 ${appTraceCount}개` : "",
      registryStartupCount > 0 ? `시작 항목 백업 ${registryStartupCount}개` : "",
      startupEntries.length > 0 ? `잠시 꺼둔 시작 항목 ${startupEntries.length}개` : "",
      scheduledTaskEntries.length > 0 ? `예약 작업 백업 ${scheduledTaskEntries.length}개` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    return `파일 ${entries.length}개 · ${backupSummary || "백업 0개"} · 총 ${formatBytes(totalBytes)} · 보관 기간 30일`;
  }, [
    snapshot,
    registrySnapshot,
    startupSnapshot,
    entries.length,
    registryEntries,
    registryBytes,
    startupDisabledBytes,
    scheduledTaskBytes,
    startupEntries.length,
    scheduledTaskEntries.length,
    totalEntryCount,
    hasPartialLoadIssue,
    scheduledTaskSnapshot
  ]);

  const expiryInsight = useMemo(() => {
    if (
      !snapshot ||
      !registrySnapshot ||
      !startupSnapshot ||
      !scheduledTaskSnapshot ||
      totalEntryCount === 0
    ) return null;
    return restoreBinExpiryInsight(sortedRestoreItems);
  }, [totalEntryCount, sortedRestoreItems, snapshot, registrySnapshot, startupSnapshot, scheduledTaskSnapshot]);

  return (
    <main className="fb-report" aria-label="복구함 (30일)">
      <header className="fb-report-header">
        <Lockup markSize={36} kanjiSize={20} en={false} />
        <div className="fb-report-actions">
          <Button variant="ghost" size="sm" onClick={onBack}>
            처음으로
          </Button>
        </div>
      </header>

      <section className="fb-report-hero">
        <h1 className="fb-h1-sm">복구함 (30일)</h1>
        <p className="fb-lede">
          깔끔 정리에서 보낸 파일, 앱 정리 때 만든 백업, 잠시 꺼둔 시작 항목은 30일 동안 여기 보관해요.
          마음이 바뀌면 한 번에 되돌릴 수 있고, 30일 뒤 자동으로 비워요. {headerSummary}
        </p>
      </section>

      {error && (
        <section className="fb-card fb-card-hover">
          <p>{error}</p>
          <Button variant="primary" size="sm" onClick={() => void load()}>
            다시 시도
          </Button>
        </section>
      )}

      <section className="fb-card fb-card-hover" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8
          }}
        >
          <div>
            <strong>복구함 관리</strong>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              복구 가능한 항목만 되돌려요. 30일이 지난 항목은 앱이 알아서 정리해요.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onRestoreAll()}
            disabled={Boolean(busy) || totalRestorableCount === 0}
          >
            {busy === "restore-all"
              ? "되돌리는 중..."
              : totalRestorableCount === totalEntryCount
                ? "모두 원래 자리로"
                : "가능한 항목만 원래 자리로"}
          </Button>
        </div>
        {totalEntryCount > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>
              바로 되돌릴 수 있는 항목 {restoreStatusSummary.restorableCount}개
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
              확인 필요한 항목 {restoreStatusSummary.checkNeededCount}개
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              보관 기간 지난 항목 {restoreStatusSummary.expiredCount}개
            </span>
          </div>
        )}
        {expiryInsight && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              background: restoreBinExpiryInsightBackground(expiryInsight.tone),
              color: restoreBinExpiryInsightColor(expiryInsight.tone),
              fontSize: 13,
              fontWeight: 650
            }}
          >
            {expiryInsight.message}
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, opacity: 0.82 }}>
              {expiryInsight.detail}
            </div>
          </div>
        )}
        {toast && (
          <p style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>{toast}</p>
        )}
      </section>

      {snapshot && registrySnapshot && startupSnapshot && scheduledTaskSnapshot && totalEntryCount === 0 && !hasPartialLoadIssue && (
        <section className="fb-card fb-anim-fade">
          <h3 style={{ marginTop: 0 }}>복구함이 비어 있어요</h3>
          <p>
            깔끔 정리에서 보낸 파일, 앱 정리에서 만든 백업, 잠시 꺼둔 시작 항목이 있으면 여기 시간순으로 표시돼요.
            곧 만료될 항목부터 위에 보여드려요.
          </p>
        </section>
      )}

      {sortedRestoreItems.map((item, idx) => {
        const isExpired = isTrashEntryExpired(item.expiresAt);
        const days = daysUntilTrashExpiry(item.expiresAt);
        const isUrgent = !isExpired && days <= 3;
        const expiryLabel = restoreEntryExpiryLabel(item.expiresAt);
        if (item.kind === "file") {
          const entry = item.entry;
          const isChanged = isChangedTrashEntry(entry);
          const isLegacy = isLegacyTrashEntry(entry);
          const needsCheck = trashEntryNeedsCheck(entry);
          return (
            <article
              key={item.id}
              className="fb-card fb-anim-slide fb-card-hover"
              style={{
                marginBottom: 12,
                animationDelay: `${Math.min(idx, 8) * 30}ms`
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 4
                }}
              >
                <span
                  style={{
                    background: "#0ea5e9",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  {CATEGORY_LABEL[entry.categoryId] ?? entry.categoryId}
                </span>
                <strong style={{ fontSize: 14 }}>{entry.label}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                    fontWeight: isUrgent ? 600 : 400
                  }}
                >
                  {expiryLabel}
                </span>
              </header>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.originalPath}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
              </div>
              {isChanged && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  복구함 안의 파일이 바뀐 것 같아요. 안전하게 되돌리기 전에 다시 점검해 주세요.
                </div>
              )}
              {isLegacy && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  복구 기록을 확인할 수 없어요. 오래된 복구 항목이라 자동으로 되돌리지 않아요.
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onRestore(entry)}
                  disabled={Boolean(busy) || isExpired || needsCheck}
                >
                  {isExpired
                    ? "보관 기간이 지나 되돌릴 수 없어요"
                    : needsCheck
                      ? isChanged
                        ? "복구함 안 파일 확인 필요"
                        : "복구 기록 확인 필요"
                      : busy === `file:${entry.id}`
                      ? "되돌리는 중..."
                      : "원래 자리로 되돌리기"}
                </Button>
              </div>
            </article>
          );
        }
        if (item.kind === "startup") {
          const entry = item.entry;
          const isChanged = entry.integrityStatus === "changed";
          const isLegacy = entry.integrityStatus === "legacy";
          const needsCheck = startupDisabledNeedsCheck(entry);
          return (
            <article
              key={item.id}
              className="fb-card fb-anim-slide fb-card-hover"
              style={{
                marginBottom: 12,
                animationDelay: `${Math.min(idx, 8) * 30}ms`
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 4
                }}
              >
                <span
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  잠시 꺼둔 시작 항목
                </span>
                <strong style={{ fontSize: 14 }}>{entry.name}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                    fontWeight: isUrgent ? 600 : 400
                  }}
                >
                  {expiryLabel}
                </span>
              </header>
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: -2 }}>
                PC 켤 때 같이 뜨지 않게 잠시 보관한 항목
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, wordBreak: "break-all" }}>
                {entry.originalPath}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.disabledAt)}
              </div>
              {isChanged && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {startupDisabledChangedNotice()}
                </div>
              )}
              {isLegacy && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {startupDisabledLegacyNotice()}
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onRestoreStartup(entry)}
                  disabled={Boolean(busy) || isExpired || needsCheck}
                >
                  {isExpired
                    ? "보관 기간이 지나 되돌릴 수 없어요"
                    : needsCheck
                      ? isChanged
                        ? "시작 항목 파일 확인 필요"
                        : "시작 항목 기록 확인 필요"
                      : busy === `startup:${entry.id}`
                        ? "되돌리는 중..."
                        : "시작 항목 되돌리기"}
                </Button>
              </div>
            </article>
          );
        }
        if (item.kind === "scheduled-task") {
          const entry = item.entry;
          const isChanged = entry.integrityStatus === "changed";
          const isLegacy = entry.integrityStatus === "legacy";
          const needsCheck = scheduledTaskBackupNeedsCheck(entry);
          return (
            <article
              key={item.id}
              className="fb-card fb-anim-slide fb-card-hover"
              style={{
                marginBottom: 12,
                animationDelay: `${Math.min(idx, 8) * 30}ms`
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 4
                }}
              >
                <span
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  예약 작업 백업
                </span>
                <strong style={{ fontSize: 14 }}>{scheduledTaskTitle(entry)}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                    fontWeight: isUrgent ? 600 : 400
                  }}
                >
                  {expiryLabel}
                </span>
              </header>
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: -2 }}>
                {scheduledTaskSubtitle(entry)}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, wordBreak: "break-all" }}>
                {entry.taskName}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
              </div>
              {isChanged && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {scheduledTaskChangedNotice()}
                </div>
              )}
              {isLegacy && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.08)",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 650
                  }}
                >
                  {scheduledTaskLegacyNotice()}
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onRestoreScheduledTask(entry)}
                  disabled={Boolean(busy) || isExpired || needsCheck}
                >
                  {isExpired
                    ? "보관 기간이 지나 되돌릴 수 없어요"
                    : needsCheck
                      ? isChanged
                        ? "예약 작업 백업 확인 필요"
                        : "예약 작업 기록 확인 필요"
                      : busy === `scheduled-task:${entry.id}`
                        ? "되돌리는 중..."
                        : "예약 작업 되돌리기"}
                </Button>
              </div>
            </article>
          );
        }
        const entry = item.entry;
        const isChanged = isChangedRegistryBackupEntry(entry);
        const isLegacy = isLegacyRegistryBackupEntry(entry);
        const needsCheck = registryBackupNeedsCheck(entry);
        return (
          <article
            key={item.id}
            className="fb-card fb-anim-slide fb-card-hover"
            style={{
              marginBottom: 12,
              animationDelay: `${Math.min(idx, 8) * 30}ms`
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 4
              }}
            >
              <span
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                {registryBackupKindLabel(entry)}
              </span>
              <strong style={{ fontSize: 14 }}>{registryBackupTitle(entry)}</strong>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: isUrgent ? "#1d4ed8" : "rgba(0,0,0,0.55)",
                  fontWeight: isUrgent ? 600 : 400
                }}
              >
                {expiryLabel}
              </span>
            </header>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: -2 }}>
              {registryBackupSubtitle(entry)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, wordBreak: "break-all" }}>
              {entry.keyPath}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              {formatBytes(entry.sizeBytes)} · 보낸 시각 {formatLocal(entry.createdAt)}
            </div>
            {isChanged && (
              <div
                style={{
                  marginTop: 8,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(37, 99, 235, 0.08)",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 650
                }}
              >
                {registryBackupChangedNotice(entry)}
              </div>
            )}
            {isLegacy && (
              <div
                style={{
                  marginTop: 8,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(37, 99, 235, 0.08)",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 650
                }}
              >
                {registryBackupLegacyNotice(entry)}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onRestoreRegistry(entry)}
                disabled={Boolean(busy) || isExpired || needsCheck}
              >
                {isExpired
                  ? "보관 기간이 지나 되돌릴 수 없어요"
                  : needsCheck
                    ? isChanged
                      ? registryBackupChangedButtonLabel(entry)
                      : registryBackupLegacyButtonLabel(entry)
                    : busy === `registry:${entry.id}`
                    ? "되돌리는 중..."
                    : registryBackupRestoreButtonLabel(entry)}
              </Button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
