$host.UI.RawUI.WindowTitle = 'Offboarding Dashboard Server'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $root 'offboarding_data/Logs'
$manualDir = Join-Path $root 'offboarding_data/Manual Off-Boardings'
$historyJsonPath = Join-Path $root 'offboarding_data/offboarding-history.json'
$offboardScriptPath = Join-Path $root 'offboard.ps1'
$prefix = 'http://127.0.0.1:8001/'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Listening on $prefix"

function Get-ContentType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLower()) {
        '.css' { return 'text/css; charset=utf-8' }
        '.js' { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.html' { return 'text/html; charset=utf-8' }
        default { return 'application/octet-stream' }
    }
}

function Get-OffboardingRecords {
    if (Test-Path -LiteralPath $historyJsonPath) {
        try {
            $payload = Get-Content -LiteralPath $historyJsonPath -Raw -ErrorAction Stop | ConvertFrom-Json
            if ($payload -is [System.Array]) {
                return @($payload)
            }
            if ($payload -and $payload.records) {
                return @($payload.records)
            }
        } catch {
            Write-Verbose "Unable to read generated history JSON"
        }
    }

    if (-not (Test-Path -LiteralPath $logsDir) -and -not (Test-Path -LiteralPath $manualDir)) {
        return @()
    }

    $records = @()

    if (Test-Path -LiteralPath $logsDir) {
        $files = Get-ChildItem -LiteralPath $logsDir -File -Filter '*.log' | Sort-Object Name
        foreach ($file in $files) {
            $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            $employeeName = $nameWithoutExt
            $employeeName = $employeeName -replace '^Offboard_', ''
            $employeeName = $employeeName -replace '^TERM_', ''
            if ($employeeName -match '^(.*)_(\d{1,2}-[A-Za-z]{3}-\d{4})$') {
                $employeeName = $matches[1]
            }
            $dateTime = ''
            if ($nameWithoutExt -match '(\d{1,2}-[A-Za-z]{3}-\d{4})') {
                $dateTime = $matches[1]
            }

            $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($null -eq $content) {
                $content = ''
            }

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
        foreach ($file in Get-ChildItem -LiteralPath $manualDir -File | Sort-Object Name) {
            $records += [pscustomobject]@{
                employeeName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                dateTime = (Get-Date $file.LastWriteTime -Format 'dd-MMM-yyyy')
                offboardedBy = 'Manual'
            }
        }
    }

    return $records | Where-Object { $_.employeeName -or $_.dateTime -or $_.offboardedBy }
}

function Invoke-OffboardingScript([hashtable]$payload) {
    if (-not (Test-Path -LiteralPath $offboardScriptPath)) {
        throw "Offboarding script not found at $offboardScriptPath"
    }

    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $offboardScriptPath)
    if ($payload.ContainsKey('username') -and $payload.username) {
        $arguments += @('-Username', $payload.username)
    }
    if ($payload.ContainsKey('managerName') -and $payload.managerName) {
        $arguments += @('-ManagerName', $payload.managerName)
    }
    if ($payload.ContainsKey('expirationConfirmation') -and $payload.expirationConfirmation) {
        $arguments += @('-ExpirationConfirmation', $payload.expirationConfirmation)
    }
    if ($payload.ContainsKey('disableConfirmation') -and $payload.disableConfirmation) {
        $arguments += @('-DisableConfirmation', $payload.disableConfirmation)
    }
    if ($payload.ContainsKey('adminName') -and $payload.adminName) {
        $arguments += @('-AdminName', $payload.adminName)
    }

    $output = & powershell.exe @arguments 2>&1 | Out-String
    return $output.Trim()
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $requestPath = $context.Request.Url.AbsolutePath
        $response = $context.Response
        $response.Headers.Add('Access-Control-Allow-Origin', '*')

        if ($requestPath -eq '/api/offboarding-logs') {
            $json = (Get-OffboardingRecords | ConvertTo-Json -Depth 5)
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            continue
        }

        if ($requestPath -eq '/api/offboard-user') {
            if ($context.Request.HttpMethod -ne 'POST') {
                $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Use POST to submit an offboarding request."}')
                $response.StatusCode = 405
                $response.ContentType = 'application/json; charset=utf-8'
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
                continue
            }

            $reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $payload = @{}
            if ($body) {
                $payload = $body | ConvertFrom-Json -AsHashtable
            }

            if (-not $payload.ContainsKey('username') -or [string]::IsNullOrWhiteSpace($payload.username)) {
                $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Username is required."}')
                $response.StatusCode = 400
                $response.ContentType = 'application/json; charset=utf-8'
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.OutputStream.Close()
                continue
            }

            $message = Invoke-OffboardingScript -payload $payload
            $bodyText = '{"message":"' + ($message -replace '"', '\"') + '"}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($bodyText)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            continue
        }

        $relativePath = $requestPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = 'index.html'
        }

        $filePath = Join-Path $root $relativePath
        if (Test-Path -LiteralPath $filePath -PathType Leaf) {
            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            $response.StatusCode = 200
            $response.ContentType = Get-ContentType -path $filePath
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
        } else {
            $response.StatusCode = 404
            $response.Close()
        }
    } catch {
        $response = $context.Response
        $response.StatusCode = 500
        $response.Close()
    }
}
