# PowerShell Startup Script - RPsec Financeiro
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "RPsec Financeiro - Servidor"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $scriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  RPSEC FINANCEIRO -- CONTROLE FAMILIAR & GESTÃO COM IA" -ForegroundColor Green
Write-Host "  Rafael | Mãe | Irmã -- Extração com Google Gemini AI" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = Join-Path $scriptDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = Join-Path $scriptDir "backend\venv\Scripts\python.exe"
}

if (-not (Test-Path $pythonExe)) {
    Write-Host "[AVISO] Ambiente Python não encontrado em backend\.venv" -ForegroundColor Yellow
    Write-Host "Iniciando instalador automático..." -ForegroundColor Cyan
    & (Join-Path $scriptDir "install.ps1")
    exit 0
}

$distHtml = Join-Path $scriptDir "frontend\dist\index.html"

# Se o build do frontend não existir, compila caso npm esteja presente
if (-not (Test-Path $distHtml)) {
    Write-Host "[INFO] Gerando build de produção do frontend React..." -ForegroundColor Cyan
    cmd /c "npm --prefix `"$scriptDir\frontend`" run build"
}

Write-Host "[OK] Servidor iniciando em http://localhost:8000" -ForegroundColor Green
Write-Host "[OK] Abrindo navegador automaticamente..." -ForegroundColor Cyan

# Abrir navegador com pequena folga
Start-Process "http://localhost:8000"

Set-Location (Join-Path $scriptDir "backend")
& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
