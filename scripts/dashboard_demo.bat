@echo off
setlocal

set API_BASE=http://127.0.0.1:8000

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMddHHmmss'"`) do set TS=%%i
set EMAIL=demo+%TS%@local
set PASSWORD=demo12345
set NATIVE_LANG=ru
set TARGET_LANG=en
set DAILY_NEW=5
set DAILY_REVIEW=10
set LEARN_BATCH=5
set TARGET_LIMIT=500

echo Email: %EMAIL%
echo Password: %PASSWORD%

for /f "usebackq delims=" %%t in (`
  powershell -NoProfile -Command "$body = @{ email = '%EMAIL%'; password = '%PASSWORD%'; interface_lang = 'ru' } | ConvertTo-Json; try { (Invoke-RestMethod -Method Post -Uri '%API_BASE%/auth/register' -ContentType 'application/json' -Body $body).access_token } catch { (Invoke-RestMethod -Method Post -Uri '%API_BASE%/auth/login' -ContentType 'application/json' -Body $body).access_token }"
`) do set TOKEN=%%t

if "%TOKEN%"=="" (
  echo Failed to get token.
  exit /b 1
)

for /f "usebackq delims=" %%c in (`
  powershell -NoProfile -Command "$corpora = Invoke-RestMethod -Uri '%API_BASE%/corpora?source_lang=%NATIVE_LANG%&target_lang=%TARGET_LANG%'; if (-not $corpora -or $corpora.Count -eq 0) { exit 2 }; $corpora[0].id"
`) do set CORPUS_ID=%%c

if "%CORPUS_ID%"=="" (
  echo No corpora found for %NATIVE_LANG%-%TARGET_LANG%.
  exit /b 1
)

powershell -NoProfile -Command "$body = @{ native_lang = '%NATIVE_LANG%'; target_lang = '%TARGET_LANG%'; daily_new_words = %DAILY_NEW%; daily_review_words = %DAILY_REVIEW%; learn_batch_size = %LEARN_BATCH%; corpora = @(@{ corpus_id = [int]%CORPUS_ID%; target_word_limit = %TARGET_LIMIT%; enabled = $true }) } | ConvertTo-Json -Depth 6; Invoke-RestMethod -Method Post -Uri '%API_BASE%/onboarding' -Headers @{ Authorization = 'Bearer %TOKEN%' } -ContentType 'application/json' -Body $body | Out-Null"

echo Token received. Dashboard:
powershell -NoProfile -Command "Invoke-RestMethod -Uri '%API_BASE%/dashboard' -Headers @{ Authorization = 'Bearer %TOKEN%' } | ConvertTo-Json -Depth 6"

endlocal
