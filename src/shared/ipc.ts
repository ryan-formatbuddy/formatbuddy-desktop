export const IpcChannels = {
  scanStart: "scan:start",
  scanCancel: "scan:cancel",
  scanProgress: "scan:progress",
  scanComplete: "scan:complete",
  scanError: "scan:error",
  reportExport: "report:export",
  reportOpenWeb: "report:open-web",
  appVersion: "app:version",
  updateChecking: "update:checking",
  updateAvailable: "update:available",
  updateNotAvailable: "update:not-available",
  updateDownloadProgress: "update:download-progress",
  updateDownloaded: "update:downloaded",
  updateError: "update:error",
  updateInstall: "update:install"
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
