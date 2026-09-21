@echo off
chcp 65001 >nul
title Gerla - pubblicazione su GitHub
setlocal enabledelayedexpansion

REM ============================================================
REM  Gerla - pubblica su GitHub i file scaricati da Claude
REM  Copia i file nuovi dalla cartella Download nel deposito,
REM  li invia a GitHub e avvia il flusso di aggiornamento prezzi.
REM  Serve Git installato: https://git-scm.com/download/win
REM ============================================================

set DEPOSITO=%~dp0
set SCARICATI=%USERPROFILE%\Downloads

echo.
echo   GERLA - pubblicazione
echo   ---------------------
echo   deposito : %DEPOSITO%
echo   scaricati: %SCARICATI%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   [!] Git non risulta installato.
  echo       Scaricalo da https://git-scm.com/download/win e riprova.
  pause & exit /b 1
)

cd /d "%DEPOSITO%"
if not exist ".git" (
  echo   [!] Questa cartella non e' un deposito Git.
  echo       Aprila da GitHub Desktop oppure esegui prima:
  echo       git clone https://github.com/TUONOME/gerla.git
  pause & exit /b 1
)

echo   Prendo le novita' gia' pubblicate (listino aggiornato dal flusso)...
git pull --rebase --quiet
if errorlevel 1 echo   [!] Attenzione: il pull ha segnalato un problema, controlla sotto.

set COPIATI=
set FILELIST=
for %%F in (gerla.html gerla-aggiorna.mjs gerla-skrimpers.mjs README.md GUIDA-PROPRIETARIO.md) do (
  if exist "%SCARICATI%\%%F" (
    copy /y "%SCARICATI%\%%F" "%DEPOSITO%%%F" >nul
    echo   + %%F
    set COPIATI=1
    set FILELIST=!FILELIST! "%%F"
  )
)
if exist "%SCARICATI%\gerla-aggiorna.yml" (
  if not exist "%DEPOSITO%.github\workflows" mkdir "%DEPOSITO%.github\workflows"
  copy /y "%SCARICATI%\gerla-aggiorna.yml" "%DEPOSITO%.github\workflows\gerla-aggiorna.yml" >nul
  echo   + gerla-aggiorna.yml  ^(in .github\workflows^)
  set COPIATI=1
  set FILELIST=!FILELIST! ".github\workflows\gerla-aggiorna.yml"
)

if "%COPIATI%"=="" (
  echo.
  echo   Nessun file nuovo trovato in Download. Non c'e' niente da pubblicare.
  echo   ^(Il listino prezzi non si copia mai da qui: si aggiorna da solo ogni mattina.^)
  pause & exit /b 0
)

echo.
git add -- !FILELIST!
git diff --staged --quiet
if errorlevel 1 (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set OGGI=%%a-%%b-%%c
  git commit -m "Gerla: aggiornamento del !OGGI!" --quiet
  echo   Invio a GitHub...
  git push --quiet
  if errorlevel 1 (
    echo   [!] Invio non riuscito. Se chiede le credenziali, accedi con GitHub Desktop una volta sola.
    pause & exit /b 1
  )
  echo   Fatto: il sito si aggiorna entro un paio di minuti.
) else (
  echo   I file erano gia' identici: niente da inviare.
)

echo.
set /p AVVIA=  Vuoi lanciare subito l'aggiornamento dei prezzi? (s/n):
if /i "%AVVIA%"=="s" (
  where gh >nul 2>nul
  if errorlevel 1 (
    echo   Apro la pagina: premi "Run workflow".
    start "" "https://github.com/krastaman85/gerla/actions"
  ) else (
    gh workflow run "Aggiorna listino Gerla"
    echo   Flusso avviato.
  )
)
echo.
echo   Ricorda: dopo il caricamento, sul sito premi Ctrl+Maiusc+R.
pause
