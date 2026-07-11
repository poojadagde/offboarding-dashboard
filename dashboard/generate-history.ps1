$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $root 'offboarding_data/Logs'
$manualDir = Join-Path $root 'offboarding_data/Manual Off-Boardings'
$outputPath = Join-Path $root 'offboarding_data/offboarding-history.json'

$records = @()

if (Test-Path -LiteralPath $logsDir) {
    $logFiles = Get-ChildItem -LiteralPath $logsDir -File -Filter '*.log' | Sort-Object Name
    foreach ($file in $logFiles) {
        $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $employeeName = $nameWithoutExt -replace '^Offboard_', '' -replace '^TERM_', ''
        if ($employeeName -match '^(.*)_(\d{1,2}-[A-Za-z]{3}-\d{4})$') {
            $employeeName = $matches[1]
        }

        $dateTime = ''
        if ($nameWithoutExt -match '(\d{1,2}-[A-Za-z]{3}-\d{4})') {
            $dateTime = $matches[1]
        }

        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($null -eq $content) { $content = '' }

        $offboardedBy = 'Unknown'
        $executionMatches = [regex]::Matches($content, 'Script executed by:\s*(.+?)\s+on\s+', 'IgnoreCase')
        if ($executionMatches.Count -gt 0) {
            $lastMatch = $executionMatches[$executionMatches.Count - 1]
            $offboardedBy = $lastMatch.Groups[1].Value.Trim().Split()[0]
        }

        $records += [pscustomobject]@{
            employeeName = $employeeName.Trim()
            dateTime = $dateTime
            offboardedBy = $offboardedBy
        }
    }
}

if (Test-Path -LiteralPath $manualDir) {
    $manualFiles = Get-ChildItem -LiteralPath $manualDir -File | Sort-Object Name
    foreach ($file in $manualFiles) {
        $records += [pscustomobject]@{
            employeeName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            dateTime = (Get-Date $file.LastWriteTime -Format 'dd-MMM-yyyy')
            offboardedBy = 'Manual'
        }
    }
}

$records = $records | Where-Object { $_.employeeName -or $_.dateTime -or $_.offboardedBy }
$records | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Host "Generated $($records.Count) records at $outputPath"
