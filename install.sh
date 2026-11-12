#!/usr/bin/env bash
# ==============================================================================
#  RPsec Financeiro / Financial Organizer - Instalador Automático (Linux)
# ==============================================================================

set -e

# Cores ANSI
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
GRAY='\033[0;37m'
DARKGRAY='\033[1;30m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Diretório raiz do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear || true

echo -e "${CYAN}"
echo "  ██████╗ ██████╗ ███████╗███████╗ ██████╗"
echo "  ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝"
echo "  ██████╔╝██████╔╝███████╗█████╗  ██║     "
echo "  ██╔══██╗██╔═══╝ ╚════██║██╔══╝  ██║     "
echo "  ██║  ██║██║     ███████║███████╗╚██████╗"
echo "  ╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝ ╚═════╝"
echo -e "${YELLOW}     FINANCIAL ORGANIZER & CONTROLE FAMILIAR${NC}"
echo -e "${DARKGRAY}     Software de Rateio & Gestão Financeira com IA${NC}"
echo -e "${CYAN} ═════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Iniciando a instalação e preparação do ambiente local..."
echo -e "  ${DARKGRAY}Diretório do Projeto: ${SCRIPT_DIR}${NC}"
echo ""

TOTAL_STEPS=6

step() {
    echo ""
    echo -e " ${CYAN}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
}

success() {
    echo -e "       ${GREEN}✔${NC} ${GRAY}$1${NC}"
}

warning() {
    echo -e "       ${YELLOW}⚠${NC} ${YELLOW}$1${NC}"
}

error() {
    echo -e "       ${RED}✖${NC} ${RED}$1${NC}"
}

# ------------------------------------------------------------------------------
# PASSO 1: Verificação de Pré-requisitos (Python 3 e Node.js)
# ------------------------------------------------------------------------------
step 1 "Verificando Pré-requisitos do Sistema..."

# Checar Python 3
if ! command -v python3 &> /dev/null; then
    error "Python 3 não foi encontrado!"
    echo ""
    echo -e "${YELLOW}  Como resolver:${NC}"
    echo -e "  Ubuntu/Debian:  ${BOLD}sudo apt update && sudo apt install -y python3 python3-venv python3-pip${NC}"
    echo -e "  Fedora/RHEL:    ${BOLD}sudo dnf install -y python3 python3-pip${NC}"
    echo -e "  Arch Linux:     ${BOLD}sudo pacman -S python python-pip${NC}"
    echo ""
    exit 1
fi

PY_VER=$(python3 --version 2>&1)
success "Python detectado: $PY_VER"

# Checar suporte a venv no Debian/Ubuntu
if ! python3 -c "import venv" &> /dev/null; then
    error "O módulo 'python3-venv' não está instalado."
    echo ""
    echo -e "${YELLOW}  Para instalar no Debian/Ubuntu execute:${NC}"
    echo -e "  ${BOLD}sudo apt update && sudo apt install -y python3-venv${NC}"
    echo ""
    exit 1
fi
success "Módulo python3-venv validado com sucesso."

# Checar Node.js e npm
DIST_EXISTS=false
if [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    DIST_EXISTS=true
fi

if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VER=$(node -v 2>&1)
    NPM_VER=$(npm -v 2>&1)
    success "Node.js detectado: $NODE_VER | npm: $NPM_VER"
elif [ "$DIST_EXISTS" = true ]; then
    warning "Node.js não detectado, mas a compilação do frontend (frontend/dist) já existe!"
    warning "O sistema funcionará normalmente servido pelo backend FastAPI."
else
    error "Node.js não foi encontrado e a pasta 'frontend/dist' não está compilada."
    echo ""
    echo -e "${YELLOW}  Como instalar Node.js LTS no Linux:${NC}"
    echo -e "  Ubuntu/Debian:  ${BOLD}sudo apt install -y nodejs npm${NC} (ou via NVM / NodeSource)"
    echo -e "  Fedora:         ${BOLD}sudo dnf install -y nodejs npm${NC}"
    echo -e "  Arch Linux:     ${BOLD}sudo pacman -S nodejs npm${NC}"
    echo ""
    exit 1
fi

# ------------------------------------------------------------------------------
# PASSO 2: Configuração do Arquivo de Ambiente (.env)
# ------------------------------------------------------------------------------
step 2 "Configurando Arquivo de Ambiente (.env)..."

if [ ! -f "$SCRIPT_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        success "Arquivo .env criado a partir de .env.example (Modo SQLite ativado)."
    else
        cat << 'EOF' > "$SCRIPT_DIR/.env"
PROJECT_NAME="Financial Organizer API"
VERSION="1.0.0"
SECRET_KEY="financial-organizer-secret-key"
ACCESS_TOKEN_EXPIRE_MINUTES=10080
GEMINI_API_KEY=""
USE_SQLITE=True
SQLITE_DB_PATH="./financial.db"
BACKEND_CORS_ORIGINS=["http://localhost:8000","http://127.0.0.1:8000"]
EOF
        success "Arquivo .env gerado automaticamente."
    fi
else
    success "Arquivo .env já existe e foi preservado."
fi

# ------------------------------------------------------------------------------
# PASSO 3: Criação do Ambiente Virtual Python (.venv)
# ------------------------------------------------------------------------------
step 3 "Criando e preparando o Ambiente Virtual Python..."

VENV_DIR="$SCRIPT_DIR/backend/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "       ${DARKGRAY}⏳ Criando ambiente virtual em 'backend/.venv'...${NC}"
    python3 -m venv "$VENV_DIR"
    success "Ambiente virtual criado em backend/.venv"
else
    success "Ambiente virtual existente detectado em backend/.venv"
fi

echo -e "       ${DARKGRAY}⏳ Atualizando gerenciador de pacotes pip...${NC}"
"$VENV_PYTHON" -m pip install --upgrade pip --quiet 2>/dev/null || true
success "Pip atualizado e pronto."

# ------------------------------------------------------------------------------
# PASSO 4: Instalação de Dependências do Backend
# ------------------------------------------------------------------------------
step 4 "Instalando Dependências do Backend (FastAPI, Uvicorn, Gemini AI)..."

if [ -f "$SCRIPT_DIR/backend/requirements.txt" ]; then
    echo -e "       ${DARKGRAY}⏳ Baixando e instalando pacotes Python...${NC}"
    "$VENV_PIP" install -r "$SCRIPT_DIR/backend/requirements.txt" --quiet
    success "Dependências do backend instaladas com sucesso."
else
    warning "Arquivo backend/requirements.txt não encontrado."
fi

# ------------------------------------------------------------------------------
# PASSO 5: Instalação e Compilação do Frontend
# ------------------------------------------------------------------------------
step 5 "Instalando e Compilando Frontend React + Vite..."

if command -v npm &> /dev/null && [ -d "$SCRIPT_DIR/frontend" ]; then
    if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
        echo -e "       ${DARKGRAY}⏳ Instalando pacotes do frontend via npm...${NC}"
        npm --prefix "$SCRIPT_DIR/frontend" install --silent
        success "Pacotes npm instalados com sucesso."
    else
        success "Módulos do frontend (node_modules) já instalados."
    fi

    echo -e "       ${DARKGRAY}⏳ Gerando build otimizado de produção (Vite)...${NC}"
    npm --prefix "$SCRIPT_DIR/frontend" run build
    if [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
        success "Frontend compilado com sucesso em 'frontend/dist'!"
    else
        warning "Build gerado com avisos. Verifique a pasta 'frontend/dist'."
    fi
elif [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    success "Compilação de produção existente validada em 'frontend/dist'."
fi

# ------------------------------------------------------------------------------
# PASSO 6: Inicialização e Migração do Banco de Dados SQLite
# ------------------------------------------------------------------------------
step 6 "Inicializando Banco de Dados SQLite e Migrações..."

cd "$SCRIPT_DIR/backend"
if "$VENV_PYTHON" -c "import asyncio; from app.db.init_db import init_db; asyncio.run(init_db()); print('DB_OK')" 2>/dev/null | grep -q "DB_OK"; then
    success "Banco de dados SQLite inicializado e estruturado (financial.db)."
else
    warning "A inicialização automática do banco será executada na primeira subida do servidor."
fi
cd "$SCRIPT_DIR"

# Garantir permissão de execução nos scripts
chmod +x "$SCRIPT_DIR/install.sh" 2>/dev/null || true
if [ -f "$SCRIPT_DIR/start.sh" ]; then
    chmod +x "$SCRIPT_DIR/start.sh" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# RESUMO FINAL
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN} ═════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN} ═════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Resumo da Configuração:${NC}"
echo -e "  • Servidor Único:   FastAPI servindo API e Frontend React integrado"
echo -e "  • Banco de Dados:   SQLite Local Zero-Config (financial.db)"
echo -e "  • Endereço Padrão:  ${CYAN}http://localhost:8000${NC}"
echo ""
echo -e "  ${YELLOW}Como iniciar no dia a dia:${NC}"
echo -e "  ➜ Execute no terminal:  ${BOLD}./start.sh${NC}"
echo ""
echo -e "${CYAN} ═════════════════════════════════════════════════════════════════════${NC}"

echo -n "Deseja iniciar o RPsec Financeiro agora mesmo? (S/n): "
read -r RESP
if [[ "$RESP" =~ ^[sSyY]?$ ]]; then
    echo ""
    echo -e "${GREEN}Iniciando aplicação...${NC}"
    exec "$SCRIPT_DIR/start.sh"
else
    echo ""
    echo -e "${CYAN}Instalação finalizada. Até logo!${NC}"
fi
