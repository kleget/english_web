param(
    [string]$ApiBase = "http://127.0.0.1:8000"
)

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body,
        [hashtable]$Headers
    )
    $json = $null
    if ($Body -ne $null) {
        $json = $Body | ConvertTo-Json -Depth 6
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $json
}

$email = Read-Host "Email (blank = auto)"
if (-not $email) {
    $email = "demo+{0}@local" -f ([DateTime]::Now.ToString("yyyyMMddHHmmss"))
}

$password = Read-Host "Password (blank = demo123)"
if (-not $password) {
    $password = "demo123"
}

$interfaceLang = Read-Host "Interface lang [ru/en] (default ru)"
if (-not $interfaceLang) {
    $interfaceLang = "ru"
}

$authBody = @{
    email = $email
    password = $password
    interface_lang = $interfaceLang
}

try {
    $token = (Invoke-Json -Method Post -Uri "$ApiBase/auth/register" -Body $authBody).access_token
} catch {
    try {
        $token = (Invoke-Json -Method Post -Uri "$ApiBase/auth/login" -Body $authBody).access_token
    } catch {
        Write-Host "Auth failed. Check email/password."
        throw
    }
}

$nativeLang = Read-Host "Native lang [ru/en] (default ru)"
if (-not $nativeLang) {
    $nativeLang = "ru"
}

$targetLang = Read-Host "Target lang [ru/en] (default en)"
if (-not $targetLang) {
    $targetLang = "en"
}

$corpora = Invoke-RestMethod -Uri "$ApiBase/corpora?source_lang=$nativeLang&target_lang=$targetLang"
if (-not $corpora) {
    Write-Host "No corpora found for $nativeLang->$targetLang"
    exit 1
}

Write-Host "Corpora:"
$corpora | ForEach-Object {
    Write-Host ("  {0}: {1} (words: {2})" -f $_.id, $_.name, $_.words_total)
}

$corpusId = Read-Host ("Corpus id (default {0})" -f $corpora[0].id)
if (-not $corpusId) {
    $corpusId = $corpora[0].id
}

$targetLimit = Read-Host "Target word limit (default 500)"
if (-not $targetLimit) {
    $targetLimit = 500
}

$onboardingBody = @{
    native_lang = $nativeLang
    target_lang = $targetLang
    daily_new_words = 5
    daily_review_words = 10
    learn_batch_size = 5
    corpora = @(
        @{
            corpus_id = [int]$corpusId
            target_word_limit = [int]$targetLimit
            enabled = $true
        }
    )
}

Invoke-Json -Method Post -Uri "$ApiBase/onboarding" -Body $onboardingBody -Headers @{
    Authorization = "Bearer $token"
} | Out-Null

Write-Host "Onboarding done."

$importPath = Read-Host "Known words file path (blank to paste or skip)"
$text = $null
if ($importPath) {
    if (-not (Test-Path $importPath)) {
        Write-Host "File not found, skipping import."
    } else {
        $text = Get-Content -Path $importPath -Raw
    }
} else {
    $firstLine = Read-Host "Paste lines 'word-translation'. Empty line to finish (Enter to skip)"
    if ($firstLine) {
        $lines = @()
        $lines += $firstLine
        while ($true) {
            $line = Read-Host
            if (-not $line) {
                break
            }
            $lines += $line
        }
        $text = $lines -join "`n"
    }
}

if ($text) {
    $importBody = @{ text = $text }
    $result = Invoke-Json -Method Post -Uri "$ApiBase/onboarding/known-words" -Body $importBody -Headers @{
        Authorization = "Bearer $token"
    }
    Write-Host "Import result:"
    $result | Format-List | Out-String | Write-Host
} else {
    Write-Host "Import skipped."
}

Write-Host ("Done. Email: {0}" -f $email)
