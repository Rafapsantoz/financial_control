#!/usr/bin/env bash
# ==============================================================================
#  RPsec Financeiro / Financial Organizer - Inicializador (Linux)
# ==============================================================================

CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}  RPsec Financeiro -- CONTROLE FAMILIAR & GESTÃO COM IA${NC}"
echo -e "${YELLOW}  Rafael | Mãe | Irmã -- Extração com Google Gemini AI${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo ""

VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$SCRIPT_DIR/backend/venv/bin/python"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${RED}[ERRO] Ambiente virtual Python não encontrado em backend/.venv${NC}"
    echo -e "${YELLOW}Por favor, execute primeiro o instalador:${NC} ${BOLD}./install.sh${NC}"
    exit 1
fi

# Se o build do frontend não existir, tenta compilar
if [ ! -f "$SCRIPT_DIR/frontend/dist/index.html" ] && command -v npm &> /dev/null; then
    echo -e "${CYAN}[INFO] Gerando build de produção do frontend React...${NC}"
    npm --prefix "$SCRIPT_DIR/frontend" run build
fi

echo -e "${GREEN}[OK] Servidor iniciando em http://localhost:8000${NC}"

# Tentar abrir navegador em background após breve pausa
(
    sleep 2
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:8000" > /dev/null 2>&1
    elif command -v google-chrome &> /dev/null; then
        google-chrome "http://localhost:8000" > /dev/null 2>&1
    elif command -v firefox &> /dev/null; then
        firefox "http://localhost:8000" > /dev/null 2>&1
    fi
) &

cd "$SCRIPT_DIR/backend"
exec "$VENV_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
