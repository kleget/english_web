param(
    [string]$ApiBase = "http://127.0.0.1:8000",
    [string]$NativeLang = "ru",
    [string]$TargetLang = "en",
    [int]$DailyNew = 5,
    [int]$DailyReview = 10,
    [int]$LearnBatch = 5,
    [int]$TargetLimit = 500
)

$ts = Get-Date -Format "yyyyMMddHHmmss"
$email = "review+$ts@local"
$password = "demo12345"

Write-Host "Email: $email"
Write-Host "Password: $password"

$authBody = @{
    email = $email
    password = $password
    interface_lang = "ru"
} | ConvertTo-Json

try {
    $token = (Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/register" -ContentType "application/json" -Body $authBody).access_token
} catch {
    $token = (Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" -ContentType "application/json" -Body $authBody).access_token
}

if (-not $token) {
    Write-Host "Failed to get token."
    exit 1
}

$corpora = Invoke-RestMethod -Uri "$ApiBase/corpora?source_lang=$NativeLang&target_lang=$TargetLang"
if (-not $corpora -or $corpora.Count -eq 0) {
    Write-Host "No corpora found for $NativeLang-$TargetLang."
    exit 1
}

$corpusId = $corpora[0].id

$onboardBody = @{
    native_lang = $NativeLang
    target_lang = $TargetLang
    daily_new_words = $DailyNew
    daily_review_words = $DailyReview
    learn_batch_size = $LearnBatch
    corpora = @(
        @{
            corpus_id = [int]$corpusId
            target_word_limit = $TargetLimit
            enabled = $true
        }
    )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "$ApiBase/onboarding" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $onboardBody | Out-Null

Write-Host "Learn start:"
$learnStart = Invoke-RestMethod -Method Post -Uri "$ApiBase/study/learn/start" -Headers @{ Authorization = "Bearer $token" }
$learnStart | ConvertTo-Json -Depth 6 | Write-Host

if ($learnStart.words -and $learnStart.words.Count -gt 0) {
    $answers = $learnStart.words | ForEach-Object { @{ word_id = $_.word_id; answer = $_.translation } }
    $learnSubmitBody = @{
        session_id = $learnStart.session_id
        words = $answers
    } | ConvertTo-Json -Depth 6
    Write-Host "Learn submit:"
    Invoke-RestMethod -Method Post -Uri "$ApiBase/study/learn/submit" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $learnSubmitBody | ConvertTo-Json -Depth 6 | Write-Host
} else {
    Write-Host "No words to learn."
}

Write-Host "Review start:"
$reviewStart = Invoke-RestMethod -Method Post -Uri "$ApiBase/study/review/start" -Headers @{ Authorization = "Bearer $token" }
$reviewStart | ConvertTo-Json -Depth 6 | Write-Host

if (-not $reviewStart.words -or $reviewStart.words.Count -eq 0) {
    Write-Host "No words to review."
    exit 0
}

$reviewAnswers = $reviewStart.words | ForEach-Object { @{ word_id = $_.word_id; answer = $_.translation } }
$reviewSubmitBody = @{
    session_id = $reviewStart.session_id
    words = $reviewAnswers
} | ConvertTo-Json -Depth 6

Write-Host "Review submit:"
Invoke-RestMethod -Method Post -Uri "$ApiBase/study/review/submit" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $reviewSubmitBody | ConvertTo-Json -Depth 6 | Write-Host
