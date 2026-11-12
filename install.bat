@echo off
setlocal
title Instalador RPsec Financeiro

rem Muda para o diretorio do script
cd /d "%~dp0"

echo ======================================================================
echo   Iniciando Instalador do RPsec Financeiro...
echo ======================================================================
echo.

rem Executa o script PowerShell moderno com bypass de politica de execucao
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] O PowerShell encontrou um problema ao executar o instalador.
    pause
)
