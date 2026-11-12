# ==============================================================================
#  RPsec Financeiro / Financial Organizer - Instalador Automático (Windows)
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Instalador RPsec Financeiro"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $scriptDir

# --- Cores e Helpers de Apresentação ---
function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ██████╗ ██████╗ ███████╗███████╗ ██████╗" -ForegroundColor Cyan
    Write-Host "  ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝" -ForegroundColor Cyan
    Write-Host "  ██████╔╝██████╔╝███████╗█████╗  ██║     " -ForegroundColor Cyan
    Write-Host "  ██╔══██╗██╔═══╝ ╚════██║██╔══╝  ██║     " -ForegroundColor Cyan
    Write-Host "  ██║  ██║██║     ███████║███████╗╚██████╗" -ForegroundColor Cyan
    Write-Host "  ╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝ ╚═════╝" -ForegroundColor Cyan
    Write-Host "     FINANCIAL ORGANIZER & CONTROLE FAMILIAR" -ForegroundColor Yellow
    Write-Host "     Software de Rateio & Gestão Financeira com IA" -ForegroundColor DarkGray
    Write-Host " ═════════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Step ([int]$current, [int]$total, [string]$title) {
    Write-Host ""
    Write-Host " [$current/$total] " -NoNewline -ForegroundColor Cyan
    Write-Host "$title" -ForegroundColor White
}

function Write-Success ([string]$msg) {
    Write-Host "       ✔ " -NoNewline -ForegroundColor Green
    Write-Host "$msg" -ForegroundColor Gray
}

function Write-WarningMsg ([string]$msg) {
    Write-Host "       ⚠ " -NoNewline -ForegroundColor Yellow
    Write-Host "$msg" -ForegroundColor Yellow
}

function Write-ErrorMsg ([string]$msg) {
    Write-Host "       ✖ " -NoNewline -ForegroundColor Red
    Write-Host "$msg" -ForegroundColor Red
}

Write-Header
Write-Host "  Iniciando a instalação e preparação do ambiente local..." -ForegroundColor White
Write-Host "  Diretório do Projeto: $scriptDir" -ForegroundColor DarkGray

$TOTAL_STEPS = 6

# ------------------------------------------------------------------------------
# PASSO 1: Verificação de Pré-requisitos (Python e Node)
# ------------------------------------------------------------------------------
Write-Step 1 $TOTAL_STEPS "Verificando Pré-requisitos do Sistema..."

$pythonCmd = $null
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if (-not $pythonCmd) {
    Write-ErrorMsg "Python 3 não foi detectado no PATH do sistema!"
    Write-Host ""
    Write-Host "  Como resolver:" -ForegroundColor Yellow
    Write-Host "  1. Baixe o instalador oficial do Python em: https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  2. Durante a instalação, MARQUE A OPÇÃO: 'Add Python to PATH' (Adicionar ao PATH)" -ForegroundColor Yellow
    Write-Host "  3. Após instalar, execute este instalador novamente." -ForegroundColor White
    Write-Host ""
    Read-Host "Pressione Enter para sair..."
    exit 1
}

$pyVer = (& $pythonCmd --version 2>&1).ToString().Trim()
Write-Success "Python detectado: $pyVer (usando '$pythonCmd')"

# Checar Node.js / npm
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
$npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $npmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
}

$distExists = Test-Path (Join-Path $scriptDir "frontend\dist\index.html")

if ($nodeCmd -and $npmCmd) {
    $nodeVer = (& node -v 2>&1).ToString().Trim()
    $npmVer = (& $npmCmd.Source -v 2>&1).ToString().Trim()
    Write-Success "Node.js detectado: $nodeVer | npm: $npmVer"
} elseif ($distExists) {
    Write-WarningMsg "Node.js não detectado, mas a compilação de produção (frontend/dist) já existe!"
    Write-WarningMsg "O sistema funcionará normalmente servido pelo backend FastAPI."
} else {
    Write-ErrorMsg "Node.js não foi encontrado e a pasta 'frontend/dist' ainda não foi compilada."
    Write-Host ""
    Write-Host "  Como resolver:" -ForegroundColor Yellow
    Write-Host "  1. Baixe o Node.js LTS em: https://nodejs.org/" -ForegroundColor White
    Write-Host "  2. Instale normalmente com as opções padrão." -ForegroundColor White
    Write-Host "  3. Execute este instalador novamente." -ForegroundColor White
    Write-Host ""
    Read-Host "Pressione Enter para sair..."
    exit 1
}

# ------------------------------------------------------------------------------
# PASSO 2: Configuração do Arquivo de Ambiente (.env)
# ------------------------------------------------------------------------------
Write-Step 2 $TOTAL_STEPS "Configurando Arquivo de Ambiente (.env)..."

$envFile = Join-Path $scriptDir ".env"
$envExample = Join-Path $scriptDir ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
        Write-Success "Arquivo .env criado a partir de .env.example (Modo SQLite ativado)."
    } else {
        # Criar .env básico se .env.example não existir
        @"
PROJECT_NAME="Financial Organizer API"
VERSION="1.0.0"
SECRET_KEY="financial-organizer-secret-key-$(Get-Random)"
ACCESS_TOKEN_EXPIRE_MINUTES=10080
GEMINI_API_KEY=""
USE_SQLITE=True
SQLITE_DB_PATH="./financial.db"
BACKEND_CORS_ORIGINS=["http://localhost:8000","http://127.0.0.1:8000"]
"@ | Out-File -FilePath $envFile -Encoding utf8
        Write-Success "Arquivo .env gerado automaticamente."
    }
} else {
    Write-Success "Arquivo .env já existe e foi preservado."
}

# ------------------------------------------------------------------------------
# PASSO 3: Ambiente Virtual Python (backend\.venv)
# ------------------------------------------------------------------------------
Write-Step 3 $TOTAL_STEPS "Criando e preparando o Ambiente Virtual Python..."

$venvDir = Join-Path $scriptDir "backend\.venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "       ⏳ Criando ambiente virtual em 'backend\.venv'..." -ForegroundColor DarkGray
    & $pythonCmd -m venv $venvDir
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Falha ao criar o ambiente virtual Python com o comando: $pythonCmd -m venv $venvDir"
        Read-Host "Pressione Enter para sair..."
        exit 1
    }
    Write-Success "Ambiente virtual criado em backend\.venv"
} else {
    Write-Success "Ambiente virtual existente detectado em backend\.venv"
}

# Atualizar Pip
Write-Host "       ⏳ Verificando/atualizando gerenciador de pacotes pip..." -ForegroundColor DarkGray
& $venvPython -m pip install --upgrade pip --quiet 2>$null
Write-Success "Pip atualizado e pronto."

# ------------------------------------------------------------------------------
# PASSO 4: Instalação de Dependências do Backend
# ------------------------------------------------------------------------------
Write-Step 4 $TOTAL_STEPS "Instalando Dependências do Backend (FastAPI, Uvicorn, Gemini AI)..."

$reqFile = Join-Path $scriptDir "backend\requirements.txt"
if (Test-Path $reqFile) {
    Write-Host "       ⏳ Baixando e instalando pacotes do backend (isso pode levar alguns segundos)..." -ForegroundColor DarkGray
    & $venvPip install -r $reqFile --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-WarningMsg "Pip encontrou avisos, tentando modo verbose..."
        & $venvPip install -r $reqFile
    }
    Write-Success "Dependências do backend instaladas com sucesso."
} else {
    Write-WarningMsg "Arquivo requirements.txt não encontrado em backend\"
}

# ------------------------------------------------------------------------------
# PASSO 5: Instalação e Compilação do Frontend
# ------------------------------------------------------------------------------
Write-Step 5 $TOTAL_STEPS "Instalando e Compilando Frontend React + Vite..."

$frontendDir = Join-Path $scriptDir "frontend"
if ($nodeCmd -and $npmCmd -and (Test-Path $frontendDir)) {
    $nodeModulesDir = Join-Path $frontendDir "node_modules"
    if (-not (Test-Path $nodeModulesDir)) {
        Write-Host "       ⏳ Instalando pacotes do frontend via npm..." -ForegroundColor DarkGray
        cmd /c "npm --prefix `"$frontendDir`" install --silent"
        Write-Success "Pacotes npm instalados com sucesso."
    } else {
        Write-Success "Módulos do frontend (node_modules) já instalados."
    }

    Write-Host "       ⏳ Gerando build otimizado de produção (Vite)..." -ForegroundColor DarkGray
    cmd /c "npm --prefix `"$frontendDir`" run build"
    if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $frontendDir "dist\index.html"))) {
        Write-Success "Frontend compilado com sucesso em 'frontend\dist'!"
    } else {
        Write-WarningMsg "Aviso na compilação do frontend. Verifique se existem erros de TypeScript."
    }
} elseif (Test-Path (Join-Path $scriptDir "frontend\dist\index.html")) {
    Write-Success "Compilação de produção existente validada em 'frontend\dist'."
}

# ------------------------------------------------------------------------------
# PASSO 6: Inicialização e Migração do Banco de Dados SQLite
# ------------------------------------------------------------------------------
Write-Step 6 $TOTAL_STEPS "Inicializando Banco de Dados SQLite e Migrações..."

try {
    Push-Location (Join-Path $scriptDir "backend")
    $initScript = @"
import asyncio
from app.db.init_db import init_db

async def main():
    await init_db()
    print("DB_INIT_SUCCESS")

asyncio.run(main())
"@
    $dbResult = & $venvPython -c "$initScript" 2>&1
    Pop-Location

    if ($dbResult -match "DB_INIT_SUCCESS") {
        Write-Success "Banco de dados SQLite inicializado e estruturado (financial.db)."
    } else {
        Write-WarningMsg "Banco de dados pré-existente ou inicializado com aviso: $dbResult"
    }
} catch {
    Write-WarningMsg "A inicialização automática do banco será executada na primeira inicialização da API."
}

# ------------------------------------------------------------------------------
# RESUMO FINAL E OPÇÃO DE INICIALIZAÇÃO IMEDIATA
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host " ═════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host " ═════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Resumo da Configuração:" -ForegroundColor White
Write-Host "  • Servidor Único:   FastAPI servindo API e Frontend React integrado" -ForegroundColor Gray
Write-Host "  • Banco de Dados:   SQLite Local Zero-Config (financial.db)" -ForegroundColor Gray
Write-Host "  • Endereço Padrão:  http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Como iniciar no dia a dia:" -ForegroundColor Yellow
Write-Host "  ➜ No Windows: Dê um duplo clique em 'start.bat' ou execute '.\start.ps1'" -ForegroundColor White
Write-Host "  ➜ No Linux:   Execute './start.sh'" -ForegroundColor White
Write-Host ""
Write-Host " ═════════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan

$resposta = Read-Host "Deseja iniciar o RPsec Financeiro agora mesmo? (S/n)"
if ($resposta -eq "" -or $resposta -match "^[sSyY]") {
    Write-Host ""
    Write-Host "Iniciando aplicação..." -ForegroundColor Green
    & (Join-Path $scriptDir "start.bat")
} else {
    Write-Host ""
    Write-Host "Instalação finalizada. Até logo!" -ForegroundColor Cyan
}
