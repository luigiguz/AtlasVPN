@echo off
REM Alias histórico — usa AtlasVPN
cd /d "%~dp0.."
python -m atlasvpn
if errorlevel 1 pause
