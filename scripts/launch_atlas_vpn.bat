@echo off
REM Ventana de escritorio Windows (WebView2). Sin --browser = no abre Chrome/Edge como app de navegador.
cd /d "%~dp0.."
python -m atlasvpn
if errorlevel 1 pause
