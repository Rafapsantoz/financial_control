# PowerShell Startup Script — Financial Organizer
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  🏦 FINANCIAL ORGANIZER — CONTROLE FAMILIAR DE CARTÕES" -ForegroundColor Green
Write-Host "  Rafael • Mãe • Irmã | Extração com Google Gemini AI" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = Join-Path $scriptDir "backend\.venv\Scripts\python.exe"
$nodeDir = Join-Path $scriptDir ".tools\node"
$distHtml = Join-Path $scriptDir "frontend\dist\index.html"

if (-not (Test-Path $pythonExe)) {
    Write-Host "[ERRO] Ambiente Python não encontrado em backend\.venv" -ForegroundColor Red
    exit 1
}

# Se o build do frontend não existir, compila
if (-not (Test-Path $distHtml)) {
    Write-Host "[INFO] Gerando build de produção do frontend React..." -ForegroundColor Cyan
    $env:PATH = "$nodeDir;" + $env:PATH
    Set-Location (Join-Path $scriptDir "frontend")
    & (Join-Path $nodeDir "npm.cmd") run build
    Set-Location $scriptDir
}

Write-Host "[OK] Servidor iniciando em http://localhost:8000" -ForegroundColor Green
Write-Host "[OK] Abrindo navegador automaticamente..." -ForegroundColor Cyan
Start-Process "http://localhost:8000"

Set-Location (Join-Path $scriptDir "backend")
& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
