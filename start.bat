@echo off
setlocal
title RPsec Financeiro - Inicializador

rem Muda para o diretorio onde o script esta localizado
cd /d "%~dp0"

rem Se o ambiente virtual nao existir, direciona para o instalador
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo [INFO] Primeira execucao detectada. Iniciando instalador...
    call "%~dp0install.bat"
    exit /b
)

rem Executa o script PowerShell com bypass de politica de execucao
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] Tentando modo direto via CMD...
    set "PYTHON_EXE=%~dp0backend\.venv\Scripts\python.exe"
    if not exist "%PYTHON_EXE%" (
        echo [ERRO] Python nao encontrado em backend\.venv. Execute install.bat.
        pause
        exit /b 1
    )
    start http://localhost:8000
    cd /d "%~dp0backend"
    "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)
