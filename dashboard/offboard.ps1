param(
    [string]$Username,
    [string]$ManagerName,
    [string]$ExpirationConfirmation,
    [string]$DisableConfirmation,
    [string]$AdminName = $env:USERNAME
)

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$excelDirectory = Join-Path $scriptRoot 'offboarding_data'
$excelFilePath = Join-Path $excelDirectory 'Offboard_Users.xlsx'
$logsDirectory = Join-Path $scriptRoot 'offboarding_data/Logs'
$manualDirectory = Join-Path $scriptRoot 'offboarding_data/Manual Off-Boardings'

New-Item -ItemType Directory -Path $excelDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $manualDirectory -Force | Out-Null

if (-not (Test-Path -Path $excelFilePath)) {
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $workbook = $excel.Workbooks.Add()
        $worksheet = $workbook.Worksheets.Item(1)
        $worksheet.Name = 'DataSheet'
        $worksheet.Cells.Item(1, 1) = 'Disabled Username'
        $worksheet.Cells.Item(1, 2) = 'Date'
        $worksheet.Cells.Item(1, 3) = 'Disabled By'
        $workbook.SaveAs($excelFilePath)
        $workbook.Close()
        $excel.Quit()
    } catch {
        Write-Warning "Excel workbook could not be created: $($_.Exception.Message)"
    }
}

if (-not $Username) {
    $username = Read-Host "Please enter the User's name"
} else {
    $username = $Username
}

if (-not $username) {
    throw 'A username is required.'
}

$timestamp = Get-Date -Format 'dd-MMM-yyyy'
$logFileName = '{0}_{1}.log' -f $username, $timestamp
$logFilePath = Join-Path $logsDirectory $logFileName

$null = New-Item -Path $logFilePath -ItemType File -Force

$adminName = if ($AdminName) { $AdminName } else { $env:USERNAME }
$managerName = if ($ManagerName) { $ManagerName } else { 'Not provided' }
$expirationConfirmation = if ($ExpirationConfirmation) { $ExpirationConfirmation } else { 'not provided' }
$disableConfirmation = if ($DisableConfirmation) { $DisableConfirmation } else { 'not provided' }

$message = "Username: $username"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8
$message = "Manager name: $managerName"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8
$message = "Proceed despite expiration?: $expirationConfirmation"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8
$message = "Disable account?: $disableConfirmation"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8
$message = "Script executed by: $adminName on $(Get-Date -Format 'dd-MMM-yyyy HH:mm:ss')"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8
$message = "-----------------------------------------------------------------------------------------------------------------------"
Add-Content -LiteralPath $logFilePath -Value $message -Encoding UTF8

$manualOutputPath = Join-Path $manualDirectory "$username.txt"
Set-Content -LiteralPath $manualOutputPath -Value "Offboarding request recorded for $username" -Encoding UTF8

Write-Host "Offboarding request recorded for $username"
