@echo off
setlocal

set "RUN_DIR=%~1"
if "%RUN_DIR%"=="" exit /b 64

set "SCRAPER_ONLY="
set "SCRAPER_START_AT="
set "SCRAPER_START_AFTER="
set "SCRAPER_FAILURE_ABORT_THRESHOLD=1000"
set "WORKDAY_SCRAPER_TIMEOUT_MS=210000"
set "WORKDAY_REQUEST_TIMEOUT_MS=20000"
set "WORKDAY_DETAIL_FETCH_CONCURRENCY=1"
set "NODE_OPTIONS=--use-system-ca"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0runDetachedLocalScrape.ps1" -RunDir "%RUN_DIR%" -Parallel -DryRun
exit /b %ERRORLEVEL%
