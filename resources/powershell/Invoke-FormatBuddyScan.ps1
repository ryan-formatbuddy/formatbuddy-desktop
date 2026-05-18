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
    "$env:USERPROFILE\AppData\LocalLow\NPKI",
    "$env:USERPROFILE\AppData\Roaming\NPKI",
    "$env:SystemDrive\NPKI"
  )

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
    $sum = Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum

    if ($null -eq $sum.Sum) { return 0 }
    return [Math]::Round($sum.Sum / 1GB, 2)
  } catch {
    Add-Diagnostic -Step "FolderSize:$Path" -Message $_.Exception.Message
    return $null
  }
}

function Get-UserFolders {
  $folders = @(
    @{ name = "Desktop"; path = [Environment]::GetFolderPath("Desktop") },
    @{ name = "Documents"; path = [Environment]::GetFolderPath("MyDocuments") },
    @{ name = "Pictures"; path = [Environment]::GetFolderPath("MyPictures") },
    @{ name = "Music"; path = [Environment]::GetFolderPath("MyMusic") },
    @{ name = "Videos"; path = [Environment]::GetFolderPath("MyVideos") },
    @{ name = "Downloads"; path = Join-Path $env:USERPROFILE "Downloads" }
  )

  foreach ($folder in $folders) {
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
  $candidates = @(
    @{ provider = "OneDrive"; path = $env:OneDrive },
    @{ provider = "OneDrive"; path = Join-Path $env:USERPROFILE "OneDrive" },
    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "Google Drive" },
    @{ provider = "Google Drive"; path = Join-Path $env:USERPROFILE "My Drive" },
    @{ provider = "Dropbox"; path = Join-Path $env:USERPROFILE "Dropbox" }
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
  $browsers = @(
    @{ name = "Chrome"; paths = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe") },
    @{ name = "Edge"; paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe") },
    @{ name = "Firefox"; paths = @("${env:ProgramFiles}\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe") },
    @{ name = "Whale"; paths = @("${env:ProgramFiles}\Naver\Naver Whale\Application\whale.exe", "${env:LOCALAPPDATA}\Naver\Naver Whale\Application\whale.exe") }
  )

  foreach ($browser in $browsers) {
    [ordered]@{
      name = $browser.name
      installed = [bool]($browser.paths | Where-Object { Test-Path $_ } | Select-Object -First 1)
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
    (Join-Path $env:USERPROFILE "Downloads")
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
  $wifiProfiles = try { netsh wlan show profiles | Select-String "All User Profile|모든 사용자 프로필" | ForEach-Object { ($_ -split ":", 2)[1].Trim() } } catch { Add-Diagnostic -Step "WiFiProfiles" -Message $_.Exception.Message; @() }
  $bitlocker = try { Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus, EncryptionPercentage } catch { Add-Diagnostic -Step "BitLocker" -Message $_.Exception.Message; @() }

  $report = [ordered]@{
    schemaVersion = "0.2.0-quick"
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
$report | ConvertTo-Json -Depth 16 | Out-File -FilePath $OutputPath -Encoding utf8
Write-Host "FormatBuddy report saved: $OutputPath (mode=$Mode)"
