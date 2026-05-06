@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0run-local-vertical-slice.ps1" %*
exit /b %errorlevel%
