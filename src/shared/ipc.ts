export const IpcChannels = {
  scanStart: "scan:start",
  scanCancel: "scan:cancel",
  scanProgress: "scan:progress",
  scanComplete: "scan:complete",
  scanError: "scan:error",
  reportExport: "report:export",
  reportOpenWeb: "report:open-web",
  appVersion: "app:version"
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
