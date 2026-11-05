@echo off
chcp 65001 >nul
title Financial Organizer — Controle Familiar de Cartões

echo ======================================================================
echo   🏦 INICIALIZANDO O FINANCIAL ORGANIZER
echo   Controle de Despesas Familiares (Rafael, Mãe e Irmã)
echo ======================================================================
echo.

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

set PYTHON_EXE=%PROJECT_DIR%backend\.venv\Scripts\python.exe
set NODE_EXE=%PROJECT_DIR%.tools\node\node.exe
set NPM_CMD=%PROJECT_DIR%.tools\node\npm.cmd

if not exist "%PYTHON_EXE%" (
    echo [ERRO] Ambiente virtual Python não encontrado em backend\.venv
    echo Por favor, crie o ambiente virtual executando:
    echo   python -m venv backend\.venv
    echo   backend\.venv\Scripts\pip install -r backend\requirements.txt
    pause
    exit /b 1
)

:: Verifica se o build do frontend já existe, caso contrário executa build
if not exist "%PROJECT_DIR%frontend\dist\index.html" (
    echo [INFO] Compilando frontend React...
    if exist "%NPM_CMD%" (
        set PATH=%PROJECT_DIR%.tools\node;%PATH%
        cd /d "%PROJECT_DIR%frontend"
        call "%NPM_CMD%" run build
        cd /d "%PROJECT_DIR%"
    )
)

echo.
echo [OK] Iniciando servidor unificado (Web + API REST + Banco SQLite)...
echo [OK] Abrindo navegador em http://localhost:8000 ...
echo.

start http://localhost:8000

cd /d "%PROJECT_DIR%backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
