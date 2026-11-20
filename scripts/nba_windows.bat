@echo off
rem NBA-Daten auf einem Windows-PC erzeugen. Doppelklick genuegt (Anleitung: NBA-WINDOWS.md).
rem Ohne Zusatz werden alle Spieler geladen; Zusaetze wie --limit 20 werden an nba_import.py weitergegeben.

chcp 65001 >nul
rem Sonderzeichen in Namen brechen sonst die Windows-Konsole ab
set PYTHONUTF8=1
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
    echo Richte Python einmalig ein ...
    py -m venv .venv 2>nul || python -m venv .venv
    if not exist .venv\Scripts\python.exe goto nopython
)

.venv\Scripts\python -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto failed

.venv\Scripts\python nba_import.py %*
if errorlevel 1 goto failed

echo.
echo Fertig. Die neuen Dateien liegen in web\public\data\nba - jetzt zu GitHub hochladen (Anleitung Schritt 4).
pause
exit /b 0

:nopython
echo.
echo Python wurde nicht gefunden. Bitte Python von python.org installieren
echo und dabei "Add python.exe to PATH" anhaken (Anleitung Schritt 1).
pause
exit /b 1

:failed
echo.
echo Abgebrochen. Einfach nochmals doppelklicken: Bereits geladene Spieler werden nicht nochmals abgefragt.
pause
exit /b 1
