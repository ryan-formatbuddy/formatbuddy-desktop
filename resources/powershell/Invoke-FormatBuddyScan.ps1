# FormatBuddy local diagnostic prototype
# Runs locally on Windows. Does not upload files, passwords, private keys, or browser credentials.
#
# Modes:
#   -Mode quick     (default) full system diagnostics + installed apps + winget export summary
#   -Mode manifest  per-user-folder SHA-256 manifest for backup/restore verification

param(
  [string]$OutputPath = "$env:USERPROFILE\Desktop\formatbuddy-report.json",
  [ValidateSet("quick", "manifest")]
  [string]$Mode = "quick",
  [int64]$ManifestMaxFileSizeBytes = 104857600
)

$ErrorActionPreference = "SilentlyContinue"
$diagnostics = New-Object System.Collections.Generic.List[object]

function Add-Diagnostic {
  param([string]$Step, [string]$Message)
  $script:diagnostics.Add([ordered]@{ step = $Step; message = $Message }) | Out-Null
}

function Get-SafeCimInstance {
  param([string]$ClassName)
  try { Get-CimInstance -ClassName $ClassName } catch { Add-Diagnostic -Step "CIM:$ClassName" -Message $_.Exception.Message; @() }
}

function Join-PathSafe {
  param([string]$Base, [string]$Child)
  if ([string]::IsNullOrWhiteSpace($Base)) { return $null }
  try {
    return (Join-Path -Path $Base -ChildPath $Child -ErrorAction Stop)
  } catch {
    Add-Diagnostic -Step "JoinPath:$Child" -Message $_.Exception.Message
    return $null
  }
}

function Get-InstalledApps {
  $paths = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )

  foreach ($path in $paths) {
    Get-ItemProperty $path | Where-Object { $_.DisplayName } | ForEach-Object {
      [ordered]@{
        name = $_.DisplayName
        version = $_.DisplayVersion
        publisher = $_.Publisher
      }
    }
  }
}

function Test-NpkiLocation {
  $candidates = @(
    (Join-PathSafe -Base $env:USERPROFILE -Child "AppData\LocalLow\NPKI"),
    (Join-PathSafe -Base $env:USERPROFILE -Child "AppData\Roaming\NPKI"),
    (Join-PathSafe -Base $env:SystemDrive -Child "NPKI")
  ) | Where-Object { $_ }

  foreach ($path in $candidates) {
    [ordered]@{
      path = $path
      exists = Test-Path $path
    }
  }
}

function Get-FolderSizeGb {
  param([string]$Path)

  if (!(Test-Path $Path)) { return $null }

  try {
    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -ErrorAction SilentlyContinue |
      Where-Object { -not $_.PSIsContainer } |
      Measure-Object -Property Length -Sum

    if ($null -eq $sum.Sum) { return 0 }
    return [Math]::Round($sum.Sum / 1GB, 2)
  } catch {
    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    return $null
  }
}

function Get-FolderLastModifiedIso {
  param([string]$Path)
  if (!(Test-Path $Path)) { return $null }
  try {
    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    return $item.LastWriteTimeUtc.ToString("o")
  } catch {
    return $null
  }
}

function Get-UserFolders {
  $downloads = Join-PathSafe -Base $env:USERPROFILE -Child "Downloads"
  $folders = @(
    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    @{ name = "Downloads"; path = $downloads }
  )

  foreach ($folder in ($folders | Where-Object { $_.path })) {
    $exists = Test-Path $folder.path
    [ordered]@{
      name = $folder.name
      path = $folder.path
      exists = $exists
      sizeGb = if ($exists) { Get-FolderSizeGb -Path $folder.path } else { $null }
    }
  }
}

function Get-CloudSyncCandidates {
  $userProfile = $env:USERPROFILE
  $candidates = @(
    @{ provider = "OneDrive"; path = $env:OneDrive },
    @{ provider = "OneDrive"; path = (Join-PathSafe -Base $userProfile -Child "OneDrive") },
    @{ provider = "Google Drive"; path = (Join-PathSafe -Base $userProfile -Child "Google Drive") },
    @{ provider = "Google Drive"; path = (Join-PathSafe -Base $userProfile -Child "My Drive") },
    @{ provider = "Dropbox"; path = (Join-PathSafe -Base $userProfile -Child "Dropbox") }
  ) | Where-Object { $_.path }

  foreach ($candidate in $candidates) {
    [ordered]@{
      provider = $candidate.provider
      path = $candidate.path
      exists = Test-Path $candidate.path
    }
  }
}

function Get-BrowserPresence {
  $programFiles = [Environment]::GetFolderPath("ProgramFiles")
  $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  $roamingAppData = [Environment]::GetFolderPath("ApplicationData")

  $browsers = @(
    @{
      name = "Chrome"
      paths = @(
        (Join-PathSafe -Base $programFiles -Child "Google\Chrome\Application\chrome.exe"),
        (Join-PathSafe -Base $programFilesX86 -Child "Google\Chrome\Application\chrome.exe"),
        (Join-PathSafe -Base $localAppData -Child "Google\Chrome\Application\chrome.exe")
      )
      profilePath = (Join-PathSafe -Base $localAppData -Child "Google\Chrome\User Data\Default")
      bookmarksPath = (Join-PathSafe -Base $localAppData -Child "Google\Chrome\User Data\Default\Bookmarks")
    },
    @{
      name = "Edge"
      paths = @(
        (Join-PathSafe -Base $programFilesX86 -Child "Microsoft\Edge\Application\msedge.exe"),
        (Join-PathSafe -Base $programFiles -Child "Microsoft\Edge\Application\msedge.exe")
      )
      profilePath = (Join-PathSafe -Base $localAppData -Child "Microsoft\Edge\User Data\Default")
      bookmarksPath = (Join-PathSafe -Base $localAppData -Child "Microsoft\Edge\User Data\Default\Bookmarks")
    },
    @{
      name = "Firefox"
      paths = @(
        (Join-PathSafe -Base $programFiles -Child "Mozilla Firefox\firefox.exe"),
        (Join-PathSafe -Base $programFilesX86 -Child "Mozilla Firefox\firefox.exe")
      )
      profilePath = (Join-PathSafe -Base $roamingAppData -Child "Mozilla\Firefox\Profiles")
      bookmarksPath = $null
    },
    @{
      name = "Whale"
      paths = @(
        (Join-PathSafe -Base $programFiles -Child "Naver\Naver Whale\Application\whale.exe"),
        (Join-PathSafe -Base $localAppData -Child "Naver\Naver Whale\Application\whale.exe")
      )
      profilePath = (Join-PathSafe -Base $localAppData -Child "Naver\Naver Whale\User Data\Default")
      bookmarksPath = (Join-PathSafe -Base $localAppData -Child "Naver\Naver Whale\User Data\Default\Bookmarks")
    }
  )

  foreach ($browser in $browsers) {
    $installed = [bool]($browser.paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1)
    $profileExists = if ($browser.profilePath) { Test-Path $browser.profilePath } else { $false }
    $bookmarksFileExists = if ($browser.bookmarksPath) { Test-Path $browser.bookmarksPath } else { $false }
    [ordered]@{
      name = $browser.name
      installed = $installed
      profilePath = $browser.profilePath
      profileExists = $profileExists
      bookmarksFileExists = $bookmarksFileExists
    }
  }
}

function Get-AppDataCandidates {
  $roamingAppData = [Environment]::GetFolderPath("ApplicationData")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  $candidates = @(
    @{ app = "KakaoTalk"; path = (Join-PathSafe -Base $roamingAppData -Child "KakaoTalk") },
    @{ app = "KakaoTalk"; path = (Join-PathSafe -Base $localAppData -Child "Kakao\KakaoTalk") }
  ) | Where-Object { $_.path }

  foreach ($candidate in $candidates) {
    $exists = Test-Path $candidate.path
    [ordered]@{
      app = $candidate.app
      path = $candidate.path
      exists = $exists
      sizeGb = if ($exists) { Get-FolderSizeGb -Path $candidate.path } else { $null }
      lastModifiedAt = if ($exists) { Get-FolderLastModifiedIso -Path $candidate.path } else { $null }
    }
  }
}

function Get-MailDataFiles {
  $documents = [Environment]::GetFolderPath("MyDocuments")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  $dirs = @(
    (Join-PathSafe -Base $documents -Child "Outlook Files"),
    (Join-PathSafe -Base $localAppData -Child "Microsoft\Outlook")
  ) | Where-Object { $_ } | Sort-Object -Unique

  foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    try {
      Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue |
        Where-Object { -not $_.PSIsContainer -and $_.Extension -match '^\.(pst|ost)$' } |
        Select-Object -First 25 |
        ForEach-Object {
          [ordered]@{
            path = $_.FullName
            extension = $_.Extension.ToLowerInvariant()
            sizeGb = [Math]::Round($_.Length / 1GB, 2)
            lastModifiedAt = $_.LastWriteTimeUtc.ToString("o")
          }
        }
    } catch {
      Add-Diagnostic -Step "MailDataFiles:$dir" -Message $_.Exception.Message
    }
  }
}

function Get-WingetStatus {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  [ordered]@{
    available = [bool]$winget
    note = if ($winget) { "winget is available. App export captured in wingetExport." } else { "winget is not available on this PC." }
  }
}

function Get-WingetExport {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { return $null }

  $tempBase = [System.IO.Path]::GetTempFileName()
  Remove-Item $tempBase -Force -ErrorAction SilentlyContinue
  $tempJson = "$tempBase.json"

  try {
    $null = & winget export -o $tempJson --accept-source-agreements --disable-interactivity 2>&1
    if (Test-Path $tempJson) {
      $raw = Get-Content -Raw -Path $tempJson -ErrorAction Stop
      return ($raw | ConvertFrom-Json -Depth 16)
    }
  } catch {
    Add-Diagnostic -Step "WingetExport" -Message $_.Exception.Message
  } finally {
    if (Test-Path $tempJson) { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
  }

  return $null
}

function Get-FilesSkippingReparsePoints {
  # Manual recursion so we can skip ReparsePoint directories entirely.
  # Get-ChildItem -Recurse will silently follow junctions/symlinks and can
  # walk into the source tree, system folders, or infinite loops.
  param([string]$Root)

  $results = New-Object System.Collections.Generic.List[object]
  $stack = New-Object System.Collections.Generic.Stack[string]
  $stack.Push($Root)

  while ($stack.Count -gt 0) {
    $current = $stack.Pop()
    Get-ChildItem -LiteralPath $current -Force -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) {
        return
      }
      if ($_ -is [System.IO.DirectoryInfo]) {
        $stack.Push($_.FullName)
      } elseif ($_ -is [System.IO.FileInfo]) {
        $results.Add($_) | Out-Null
      }
    }
  }

  return $results
}

function Get-DiskHealth {
  $physical = @()
  try {
    $physical = @(Get-PhysicalDisk -ErrorAction Stop)
  } catch {
    Add-Diagnostic -Step "DiskHealth" -Message $_.Exception.Message
  }

  foreach ($d in $physical) {
    [ordered]@{
      friendlyName = $d.FriendlyName
      mediaType = "$($d.MediaType)"
      busType = "$($d.BusType)"
      sizeGb = if ($d.Size) { [Math]::Round($d.Size / 1GB, 2) } else { $null }
      healthStatus = "$($d.HealthStatus)"
      operationalStatus = "$($d.OperationalStatus)"
    }
  }
}

function Get-MemoryPressure {
  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
  $pageFiles = Get-SafeCimInstance Win32_PageFileUsage
  $totalKb = if ($os) { $os.TotalVisibleMemorySize } else { 0 }
  $freeKb = if ($os) { $os.FreePhysicalMemory } else { 0 }
  $totalPageFileMb = ($pageFiles | Measure-Object -Property AllocatedBaseSize -Sum).Sum
  $usedPageFileMb = ($pageFiles | Measure-Object -Property CurrentUsage -Sum).Sum
  if ($null -eq $totalPageFileMb) { $totalPageFileMb = 0 }
  if ($null -eq $usedPageFileMb) { $usedPageFileMb = 0 }
  $pageFileUsagePercent = if ($totalPageFileMb -gt 0) { [Math]::Round(($usedPageFileMb / $totalPageFileMb) * 100, 1) } else { 0 }
  $freeMemPercent = if ($totalKb -gt 0) { [Math]::Round(($freeKb / $totalKb) * 100, 1) } else { $null }
  [ordered]@{
    totalMemoryMb = if ($totalKb) { [Math]::Round($totalKb / 1024, 0) } else { $null }
    freeMemoryMb = if ($freeKb) { [Math]::Round($freeKb / 1024, 0) } else { $null }
    freeMemoryPercent = $freeMemPercent
    pageFileTotalMb = $totalPageFileMb
    pageFileUsedMb = $usedPageFileMb
    pageFileUsagePercent = $pageFileUsagePercent
  }
}

function ConvertTo-HotfixDate {
  param($Value)
  if ($null -eq $Value) { return $null }
  if ($Value -is [DateTime]) { return $Value }
  $asString = "$Value"
  if ([string]::IsNullOrWhiteSpace($asString)) { return $null }
  $parsed = [DateTime]::MinValue
  if ([DateTime]::TryParse($asString, [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::AssumeLocal, [ref]$parsed)) { return $parsed }
  if ([DateTime]::TryParse($asString, [Globalization.CultureInfo]::CurrentCulture,
      [Globalization.DateTimeStyles]::AssumeLocal, [ref]$parsed)) { return $parsed }
  return $null
}

function Get-WindowsUpdateStatus {
  $hotfixes = Get-SafeCimInstance Win32_QuickFixEngineering
  $latestDt = $null
  if ($hotfixes) {
    foreach ($h in $hotfixes) {
      $dt = ConvertTo-HotfixDate $h.InstalledOn
      if ($dt -and (-not $latestDt -or $dt -gt $latestDt)) { $latestDt = $dt }
    }
  }
  $latestInstalledOn = if ($latestDt) { $latestDt.ToString("o") } else { $null }
  $daysSinceLatest = if ($latestDt) { [int]((Get-Date) - $latestDt).TotalDays } else { $null }
  [ordered]@{
    installedHotfixCount = if ($hotfixes) { @($hotfixes).Count } else { 0 }
    latestHotfixInstalledOn = $latestInstalledOn
    daysSinceLatestHotfix = $daysSinceLatest
  }
}

function Get-EventLogSummary {
  $since = (Get-Date).AddDays(-7)
  $criticalCount = 0
  $errorCount = 0
  try {
    $events = Get-WinEvent -FilterHashtable @{ LogName = "System"; Level = 1,2; StartTime = $since } -ErrorAction Stop
    foreach ($e in $events) {
      if ($e.Level -eq 1) { $criticalCount++ }
      elseif ($e.Level -eq 2) { $errorCount++ }
    }
  } catch {
    Add-Diagnostic -Step "EventLog" -Message $_.Exception.Message
  }
  [ordered]@{
    windowDays = 7
    criticalCount = $criticalCount
    errorCount = $errorCount
  }
}

function Get-DriverAgeSummary {
  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
  $total = 0
  $olderThan2Years = 0
  $cutoff = (Get-Date).AddYears(-2)
  foreach ($d in $drivers) {
    if ($d.DriverDate) {
      $total++
      try {
        $date = [Management.ManagementDateTimeConverter]::ToDateTime($d.DriverDate)
        if ($date -lt $cutoff) { $olderThan2Years++ }
      } catch { }
    }
  }
  $pct = if ($total -gt 0) { [Math]::Round(($olderThan2Years / $total) * 100, 1) } else { 0 }
  [ordered]@{
    totalWithDate = $total
    olderThan2Years = $olderThan2Years
    olderThan2YearsPercent = $pct
  }
}

function Get-StartupPrograms {
  $items = Get-SafeCimInstance Win32_StartupCommand
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($i in $items) {
    $list.Add([ordered]@{
      name = $i.Name
      command = $i.Command
      location = $i.Location
      user = $i.User
    }) | Out-Null
  }
  [ordered]@{
    count = $list.Count
    items = @($list)
  }
}

function Get-DefenderStatus {
  try {
    $s = Get-MpComputerStatus -ErrorAction Stop
    [ordered]@{
      antivirusEnabled = [bool]$s.AntivirusEnabled
      realTimeProtectionEnabled = [bool]$s.RealTimeProtectionEnabled
      antivirusSignatureAgeDays = $s.AntivirusSignatureAge
      lastQuickScanDaysAgo = $s.QuickScanAge
      lastFullScanDaysAgo = $s.FullScanAge
    }
  } catch {
    Add-Diagnostic -Step "DefenderStatus" -Message $_.Exception.Message
    [ordered]@{
      antivirusEnabled = $null
      realTimeProtectionEnabled = $null
      antivirusSignatureAgeDays = $null
      lastQuickScanDaysAgo = $null
      lastFullScanDaysAgo = $null
    }
  }
}

function Get-StorageWaste {
  function Get-PathSizeGbReparseSafe {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return 0 }
    if (-not (Test-Path $Path)) { return 0 }
    try {
      # Reuse the reparse-point-skipping walk so junctions (e.g. AppData\Local
      # to AppData\LocalLow on some installs, or Windows.old containing links
      # back into the live tree) don't make us hang or overcount.
      $files = Get-FilesSkippingReparsePoints -Root $Path
      $total = ($files | Measure-Object -Property Length -Sum).Sum
      if ($null -eq $total) { return 0 }
      return [Math]::Round($total / 1GB, 2)
    } catch { return 0 }
  }

  # v0.4.1: %TEMP% is usually identical to %LOCALAPPDATA%\Temp on stock
  # Windows profiles. De-duplicate so we don't count the same tree twice.
  $candidates = @($env:TEMP, (Join-PathSafe -Base $env:LOCALAPPDATA -Child "Temp")) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object {
      try { (Resolve-Path -LiteralPath $_ -ErrorAction Stop).Path }
      catch { $_ }
    } |
    ForEach-Object { $_.TrimEnd('\','/').ToLowerInvariant() } |
    Sort-Object -Unique

  $userTempGb = 0
  foreach ($p in $candidates) { $userTempGb += (Get-PathSizeGbReparseSafe -Path $p) }

  $windowsTempGb = Get-PathSizeGbReparseSafe -Path (Join-Path $env:SystemRoot "Temp")
  $windowsOldPath = Join-Path $env:SystemDrive "Windows.old"
  $windowsOldExists = Test-Path $windowsOldPath
  $windowsOldGb = if ($windowsOldExists) { Get-PathSizeGbReparseSafe -Path $windowsOldPath } else { 0 }

  [ordered]@{
    userTempGb = [Math]::Round($userTempGb, 2)
    localAppDataTempGb = 0  # deprecated in v0.4.1 - userTempGb now includes both sources, deduped
    windowsTempGb = $windowsTempGb
    windowsOldExists = $windowsOldExists
    windowsOldGb = $windowsOldGb
  }
}

function Get-BackupManifest {
  param(
    [string[]]$Folders,
    [int64]$MaxFileSize
  )

  $folderResults = New-Object System.Collections.Generic.List[object]

  foreach ($folder in $Folders) {
    if ([string]::IsNullOrWhiteSpace($folder)) { continue }
    if (-not (Test-Path $folder)) {
      $folderResults.Add([ordered]@{
        folder = $folder
        exists = $false
        fileCount = 0
        skippedCount = 0
        totalBytes = 0
        entries = @()
        skipped = @()
      }) | Out-Null
      continue
    }

    $entries = New-Object System.Collections.Generic.List[object]
    $skipped = New-Object System.Collections.Generic.List[object]
    $folderNorm = $folder.TrimEnd('\','/')

    $files = Get-FilesSkippingReparsePoints -Root $folder
    foreach ($file in $files) {
      $rel = $file.FullName
      if ($rel.StartsWith($folderNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
        $rel = $rel.Substring($folderNorm.Length).TrimStart('\','/')
      }

      if ($file.Length -gt $MaxFileSize) {
        $skipped.Add([ordered]@{
          path = $rel
          sizeBytes = $file.Length
          reason = "exceeds-max-size"
        }) | Out-Null
        continue
      }

      try {
        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName -ErrorAction Stop
        $entries.Add([ordered]@{
          path = $rel
          sizeBytes = $file.Length
          sha256 = $hash.Hash
          modifiedAt = $file.LastWriteTimeUtc.ToString("o")
        }) | Out-Null
      } catch {
        $skipped.Add([ordered]@{
          path = $rel
          sizeBytes = $file.Length
          reason = "hash-failed: $($_.Exception.Message)"
        }) | Out-Null
      }
    }

    $totalBytes = ($entries | Measure-Object -Property sizeBytes -Sum).Sum
    if ($null -eq $totalBytes) { $totalBytes = 0 }

    $folderResults.Add([ordered]@{
      folder = $folder
      exists = $true
      fileCount = $entries.Count
      skippedCount = $skipped.Count
      totalBytes = $totalBytes
      entries = @($entries)
      skipped = @($skipped)
    }) | Out-Null
  }

  return @($folderResults)
}

if ($Mode -eq "manifest") {
  $manifestFolders = @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("MyDocuments"),
    [Environment]::GetFolderPath("MyPictures"),
    [Environment]::GetFolderPath("MyMusic"),
    [Environment]::GetFolderPath("MyVideos"),
    (Join-PathSafe -Base $env:USERPROFILE -Child "Downloads")
  ) | Where-Object { $_ }

  $report = [ordered]@{
    schemaVersion = "0.2.0-manifest"
    generatedAt = (Get-Date).ToString("o")
    mode = "manifest"
    privacy = [ordered]@{
      localOnly = $true
      noPasswordCollection = $true
      noPrivateKeyUpload = $true
      noBrowserPasswordExtraction = $true
    }
    maxFileSizeBytes = $ManifestMaxFileSizeBytes
    folders = Get-BackupManifest -Folders $manifestFolders -MaxFileSize $ManifestMaxFileSizeBytes
    diagnostics = @($diagnostics)
  }
} else {
  $computer = Get-SafeCimInstance Win32_ComputerSystem | Select-Object -First 1
  $os = Get-SafeCimInstance Win32_OperatingSystem | Select-Object -First 1
  $bios = Get-SafeCimInstance Win32_BIOS | Select-Object -First 1
  $cpu = Get-SafeCimInstance Win32_Processor | Select-Object -First 1
  $gpu = Get-SafeCimInstance Win32_VideoController
  $disk = Get-SafeCimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
  $printers = Get-SafeCimInstance Win32_Printer
  $drivers = Get-SafeCimInstance Win32_PnPSignedDriver
  $wifiProfiles = @()
  try {
    $wifiProfiles = @(netsh wlan show profiles |
      Where-Object { $_ -match ":" } |
      ForEach-Object {
        $parts = $_ -split ":", 2
        if ($parts.Count -gt 1) { $parts[1].Trim() }
      } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  } catch {
    Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message
  }

  $bitlocker = @()
  try {
    $bitlocker = @(Get-BitLockerVolume |
      Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage)
  } catch {
    Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message
  }

  $report = [ordered]@{
    schemaVersion = "0.4.0-quick"
    generatedAt = (Get-Date).ToString("o")
    mode = "quick"
    privacy = [ordered]@{
      localOnly = $true
      noPasswordCollection = $true
      noPrivateKeyUpload = $true
      noBrowserPasswordExtraction = $true
    }
    system = [ordered]@{
      manufacturer = $computer.Manufacturer
      model = $computer.Model
      serialNumberMasked = if ($bios.SerialNumber) { "***" + $bios.SerialNumber.Substring([Math]::Max(0, $bios.SerialNumber.Length - 4)) } else { $null }
      osCaption = $os.Caption
      osVersion = $os.Version
      cpu = $cpu.Name
      memoryGb = if ($computer.TotalPhysicalMemory) { [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
    }
    disks = @($disk | ForEach-Object {
      [ordered]@{
        drive = $_.DeviceID
        sizeGb = [Math]::Round($_.Size / 1GB, 2)
        freeGb = [Math]::Round($_.FreeSpace / 1GB, 2)
      }
    })
    diskHealth = @(Get-DiskHealth)
    memoryPressure = Get-MemoryPressure
    windowsUpdate = Get-WindowsUpdateStatus
    eventLog = Get-EventLogSummary
    driverAge = Get-DriverAgeSummary
    startupPrograms = Get-StartupPrograms
    defender = Get-DefenderStatus
    appDataCandidates = @(Get-AppDataCandidates)
    mailDataFiles = @(Get-MailDataFiles)
    storageWaste = Get-StorageWaste
    userFolders = @(Get-UserFolders)
    gpu = @($gpu | ForEach-Object { $_.Name })
    installedApps = @(Get-InstalledApps | Sort-Object name -Unique)
    drivers = @($drivers | Select-Object DeviceName, DriverVersion, Manufacturer, DriverDate)
    printers = @($printers | Select-Object Name, DriverName, PortName, Default)
    wifiProfiles = @($wifiProfiles)
    npkiCandidates = @(Test-NpkiLocation)
    bitlocker = @($bitlocker)
    cloudSync = @(Get-CloudSyncCandidates)
    browsers = @(Get-BrowserPresence)
    winget = Get-WingetStatus
    wingetExport = Get-WingetExport
    diagnostics = @($diagnostics)
    checklist = [ordered]@{
      reviewNpkiManually = $true
      exportWifiProfilesManually = $true
      backupDesktopDocumentsDownloads = $true
      verifyCloudSync = $true
      saveReportBeforeFormat = $true
    }
  }
}

$parent = Split-Path -Parent $OutputPath
if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
$json = $report | ConvertTo-Json -Depth 16
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)
Write-Output ("FormatBuddy report saved: {0} (mode={1})" -f $OutputPath, $Mode)
