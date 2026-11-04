---
name: financial-organizer
description: |
  Especialista na gestão, automação, consulta e testes do Financial Organizer.
  Permite gerenciar despesas de cartão de crédito divididas entre Rafael, Mãe e Irmã,
  consultar fechamento mensal de faturas com rateio familiar, gerenciar quitação de dívidas,
  extrair transações de faturas em PDF via Google Gemini API e executar a validação e testes da API.

  Use esta skill sempre que:
  - O usuário perguntar sobre fechamento de fatura, rateio familiar ou saldo devedor de Rafael, Mãe ou Irmã.
  - Precisar consultar, listar, cadastrar ou dar baixa (toggle-paid) em compras e parcelas.
  - Precisar extrair transações de faturas de cartão de crédito em PDF usando IA (Google Gemini API).
  - Precisar iniciar o servidor backend FastAPI, auditar rotas ou rodar testes automatizados da aplicação.
license: MIT
metadata:
  version: v1
  author: Antigravity Team
---

# Financial Organizer — Skill & Manual de Operação

Esta skill fornece instruções completas, comandos CLI e automações para operar, manter e expandir o **Financial Organizer**, sistema de controle financeiro familiar com divisão de cartões entre **Rafael**, **Mãe** e **Irmã**, e extração de faturas via **Google Gemini API**.

---

## 🛠️ 1. Comandos Rápidos da CLI (`fo_cli.py`)

O utilitário `fo_cli.py` está disponível na pasta `scripts/` do projeto (`C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py`). Utilize sempre o interpretador do ambiente virtual:
`C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe`

### A. Resumo Mensal & Rateio Familiar (Rafael, Mãe, Irmã)
```powershell
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" summary --month 2026-11
```
*Exibe a tabela consolidada com Total da Fatura, Total Quitado, Total Pendente, status individual de cada membro (`Pago`, `Pendente`, `Parcial`, `Sem despesas`) e gastos por categoria.*

### B. Listar Transações Cadastradas
```powershell
# Todas as transações do mês
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" list --month 2026-11

# Apenas transações pendentes de pagamento
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" list --pending-only
```

### C. Cadastrar Despesa Manual
```powershell
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" add `
  --desc "Supermercado Pão de Açúcar" `
  --value 350.50 `
  --owner "Rafael" `
  --cat "Mercado" `
  --parcs "1/1" `
  --comment "Compras da semana"
```

### D. Dar Baixa / Alternar Status de Pagamento (`toggle-paid`)
Quando a Mãe ou Irmã pagar a sua parte da fatura:
```powershell
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" toggle-paid <ID_DA_TRANSACAO>
```

### E. Extrair Itens de Fatura em PDF com Gemini
```powershell
# Apenas extrair e inspecionar os itens na tela
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" extract "C:\caminho\para\fatura.pdf"

# Extrair e salvar automaticamente no banco de dados SQLite
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" extract "C:\caminho\para\fatura.pdf" --confirm
```

### F. Auditoria e Validação Completa das Rotas
```powershell
& "C:\Antigravity\programs\financial_organizer\backend\.venv\Scripts\python.exe" "C:\Antigravity\programs\financial_organizer\scripts\fo_cli.py" validate
```

---

## 🚀 2. Inicialização do Servidor Backend

Para iniciar o servidor FastAPI localmente na porta 8000:
```powershell
cd C:\Antigravity\programs\financial_organizer\backend
& ".\.venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Swagger UI Interativo: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Healthcheck: `http://127.0.0.1:8000/health`

---

## 📡 3. Mapa Completo de Endpoints REST (API v1)

Base URL: `http://127.0.0.1:8000/api/v1`

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Verificação de integridade do serviço |
| `GET` | `/api/v1/dashboard/summary?month=YYYY-MM` | Fechamento mensal com rateio por membro e categorias |
| `GET` | `/api/v1/owners` | Lista membros cadastrados (Rafael, Mãe, Irmã) |
| `POST` | `/api/v1/owners` | Cadastra novo membro |
| `GET` | `/api/v1/owners/{id}` | Busca membro por ID |
| `PUT` | `/api/v1/owners/{id}` | Atualiza membro |
| `DELETE` | `/api/v1/owners/{id}` | Remove membro |
| `GET` | `/api/v1/cards` | Lista cartões de crédito cadastrados |
| `POST` | `/api/v1/cards` | Cadastra novo cartão |
| `GET` | `/api/v1/cards/{id}` | Busca cartão por ID |
| `PUT` | `/api/v1/cards/{id}` | Atualiza cartão |
| `DELETE` | `/api/v1/cards/{id}` | Remove cartão |
| `GET` | `/api/v1/categories` | Lista categorias de despesa (Mercado, Lazer, etc.) |
| `POST` | `/api/v1/categories` | Cadastra nova categoria |
| `GET` | `/api/v1/categories/{id}` | Busca categoria por ID |
| `PUT` | `/api/v1/categories/{id}` | Atualiza categoria |
| `DELETE` | `/api/v1/categories/{id}` | Remove categoria |
| `GET` | `/api/v1/transactions?month=YYYY-MM` | Lista transações com filtros de mês e quitação |
| `POST` | `/api/v1/transactions` | Cadastra nova transação manual |
| `GET` | `/api/v1/transactions/{id}` | Busca transação por ID |
| `PATCH` | `/api/v1/transactions/{id}/toggle-paid` | Alterna status de quitação (pago/pendente) |
| `DELETE` | `/api/v1/transactions/{id}` | Remove transação |
| `POST` | `/api/v1/invoices/extract` | Upload de PDF e extração estruturada via Gemini |
| `POST` | `/api/v1/invoices/confirm` | Confirmação em lote e persistência das transações no banco |

---

## 🧠 4. Regras de Negócio Implementadas

- **RN01 - Parcelamento de Compras:** Compras parceladas (`cur_parcs`/`total_parcs`) podem gerar projeções futuras opcionais (`is_forecast = True`). No fechamento do mês, apenas compras reais daquele mês são somadas.
- **RN02 - Detecção de Duplicidade:** Faturas que contenham compras com mesma data, valor e estabelecimento são sinalizadas para evitar cobrança duplicada.
- **RN03 - Status Individual de Quitação:** Cada membro tem seu saldo calculado de forma 100% independente:
  - `Pago`: `pending_amount == 0` e `total_amount > 0`
  - `Pendente`: `paid_amount == 0` e `total_amount > 0`
  - `Parcial`: `paid_amount > 0` e `pending_amount > 0`
  - `Sem despesas`: `total_amount == 0`
- **RN04 - Heurísticas Familiares:** O Gemini analisa automaticamente menções a cartões adicionais e estabelecimentos típicos (ex: farmácias e drogaria atribuídas à Mãe, lojas de vestuário e cosméticos à Irmã, games e delivery a Rafael).

---

## 🧪 5. Execução de Testes Automatizados

O projeto conta com mais de 105 testes automatizados (unitários, integração, rateio, fluxo de ponta a ponta e casos adversários):
```powershell
cd C:\Antigravity\programs\financial_organizer\backend
& ".\.venv\Scripts\python.exe" -m pytest
```
