@echo off
setlocal
title Financial Organizer

rem Executa o script PowerShell com bypass de politica de execucao
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] Tentando modo direto via CMD...
    cd /d "%~dp0"
    set "PYTHON_EXE=%~dp0backend\.venv\Scripts\python.exe"
    if not exist "%PYTHON_EXE%" (
        echo [ERRO] Python nao encontrado em backend\.venv
        pause
        exit /b 1
    )
    start http://localhost:8000
    cd /d "%~dp0backend"
    "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)
