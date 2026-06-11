param(
  [Parameter(Mandatory = $true)]
  [string]$CupsSoatPath,

  [Parameter(Mandatory = $true)]
  [string]$MedicamentosPath,

  [string]$SuperhomologadorPath = "",

  [Parameter(Mandatory = $true)]
  [string]$Output
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Clean-Text($value) {
  if ($null -eq $value) { return "" }
  return ([string]$value -replace "\s+", " ").Trim()
}

function Clean-Code($value) {
  return (Clean-Text $value).Trim()
}

function Add-Item($items, $seen, $kind, $description, $serviceCode, $cups, $soat, $cums, $source) {
  $description = Clean-Text $description
  $serviceCode = Clean-Code $serviceCode
  $cups = Clean-Code $cups
  $soat = Clean-Code $soat
  $cums = Clean-Code $cums
  if ($kind -eq "procedimiento" -and (-not $cups -or $cups.Length -gt 6)) { return }
  if ($description.Length -gt 200) {
    $description = $description.Substring(0, 200).Trim()
  }
  if (-not $description -or -not ($serviceCode -or $cups -or $soat -or $cums)) { return }

  $serviceType = if ($kind -eq "medicamento") { "1" } else { "2" }
  $key = "$kind|$serviceCode|$cups|$soat|$cums|$description".ToUpperInvariant()
  if ($seen.ContainsKey($key)) { return }
  $seen[$key] = $true

  $codeParts = @()
  if ($cums) { $codeParts += "CUMS $cums" }
  if ($cups) { $codeParts += "CUPS $cups" }
  if ($soat) { $codeParts += "SOAT $soat" }
  $codeLabel = if ($codeParts.Count) { " (" + ($codeParts -join " / ") + ")" } else { "" }
  $prefix = if ($kind -eq "medicamento") { "MEDICAMENTO" } else { "PROCEDIMIENTO" }

  $items.Add([ordered]@{
      kind = $kind
      description = $description
      serviceCode = $serviceCode
      cups = $cups
      soat = $soat
      cums = $cums
      serviceType = $serviceType
      source = $source
      label = "$prefix - $description$codeLabel"
    }) | Out-Null
}

function Open-Workbook($excel, $path) {
  $resolved = (Resolve-Path -LiteralPath $path).Path
  return $excel.Workbooks.Open($resolved, 0, $true)
}

function Read-CupsSoat($excel, $path, $items, $seen) {
  $wb = Open-Workbook $excel $path
  try {
    $ws = $wb.Worksheets.Item(1)
    $used = $ws.UsedRange
    for ($row = 2; $row -le $used.Rows.Count; $row++) {
      $cups = Clean-Code $used.Cells.Item($row, 1).Text
      $soat = Clean-Code $used.Cells.Item($row, 2).Text
      $name = Clean-Text $used.Cells.Item($row, 3).Text
      $serviceCode = if ($soat) { $soat } else { $cups }
      Add-Item $items $seen "procedimiento" $name $serviceCode $cups $soat "" "hospital_cups_soat"
    }
  } finally {
    $wb.Close($false)
  }
}

function Read-Medicamentos($excel, $path, $items, $seen) {
  $wb = Open-Workbook $excel $path
  try {
    $ws = $wb.Worksheets.Item(1)
    $used = $ws.UsedRange
    for ($row = 2; $row -le $used.Rows.Count; $row++) {
      $name = Clean-Text $used.Cells.Item($row, 1).Text
      $cums = Clean-Code $used.Cells.Item($row, 2).Text
      Add-Item $items $seen "medicamento" $name $cums "" "" $cums "hospital_medicamentos"
    }
  } finally {
    $wb.Close($false)
  }
}

function Read-Superhomologador($excel, $path, $items, $seen) {
  if (-not $path) { return }
  $resolved = (Resolve-Path -LiteralPath $path).Path
  $openPath = $resolved
  $tempCopy = ""
  if ([IO.Path]::GetExtension($resolved).ToLowerInvariant() -eq ".xlsm") {
    $tempCopy = Join-Path ([IO.Path]::GetTempPath()) ("superhomologador-" + [guid]::NewGuid().ToString("N") + ".xls")
    Copy-Item -LiteralPath $resolved -Destination $tempCopy -Force
    $openPath = $tempCopy
  }
  $wb = Open-Workbook $excel $openPath
  try {
    $ws = $wb.Worksheets.Item("HOMOLOGADOR")
    $used = $ws.UsedRange
    for ($row = 4; $row -le $used.Rows.Count; $row++) {
      $cups = Clean-Code $used.Cells.Item($row, 4).Text
      if (-not $cups) { $cups = Clean-Code $used.Cells.Item($row, 1).Text }
      $soat = Clean-Code $used.Cells.Item($row, 2).Text
      $desc = Clean-Text $used.Cells.Item($row, 5).Text
      if (-not $desc) { $desc = Clean-Text $used.Cells.Item($row, 3).Text }
      $serviceCode = if ($soat) { $soat } else { $cups }
      Add-Item $items $seen "procedimiento" $desc $serviceCode $cups $soat "" "superhomologador"
    }
  } finally {
    $wb.Close($false)
    if ($tempCopy -and (Test-Path -LiteralPath $tempCopy)) {
      Remove-Item -LiteralPath $tempCopy -Force
    }
  }
}

$items = New-Object System.Collections.ArrayList
$seen = @{}
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AutomationSecurity = 3

try {
  Read-CupsSoat $excel $CupsSoatPath $items $seen
  Read-Medicamentos $excel $MedicamentosPath $items $seen
  if ($SuperhomologadorPath) {
    Read-Superhomologador $excel $SuperhomologadorPath $items $seen
  }
} finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$sorted = $items | Sort-Object @{ Expression = "kind"; Descending = $false }, description, serviceCode
$outputPath = Join-Path (Get-Location) $Output
$outputDir = Split-Path -Parent $outputPath
if ($outputDir) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
$json = $sorted | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, $utf8NoBom)
Write-Output ("Total servicios: {0}" -f $sorted.Count)
Write-Output ("Archivo generado: {0}" -f $outputPath)
