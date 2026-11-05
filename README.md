# 💳 Financial Organizer (Controle Financeiro Familiar)

Sistema moderno e portátil para **controle de gastos, divisão de faturas de cartão de crédito entre familiares (Rafael, Mãe e Irmã) e conciliação inteligente de PDFs de extratos via Google Gemini AI**.

---

## 🌟 Principais Recursos

- 👨‍👩‍👧 **Rateio Familiar Preciso:** Saiba exatamente quanto a **Mãe**, a **Irmã** e o **Rafael** devem pagar na fatura de cada cartão no mês.
- 🤖 **Leitura Inteligente de Faturas em PDF (Gemini AI):** Basta arrastar a fatura do cartão (PDF) e a inteligência artificial extrai automaticamente todas as compras, detecta parcelas (ex: `02/10`) e sugere categorias.
- ⚡ **Tela de Conferência em Lote:** Revise os itens extraídos pelo Gemini e atribua os donos das compras com poucos cliques antes de salvar no banco.
- ✍️ **Cadastro Manual Rápido:** Adicione gastos avulsos facilmente com data, valor, cartão e parcelas.
- 📊 **Dashboard Financeiro Interativo:** Gráficos de distribuição por categoria e controle de status de pagamento (*Pago* / *Pendente*).
- 🚀 **Portabilidade Máxima (Sem Docker):** Utiliza **SQLite nativo** (`financial.db`), pronto para ser executado em qualquer máquina sem precisar instalar ou configurar servidores de banco de dados.

---

## 📂 Documentação e Especificações

- 📘 [PROJECT_BLUEPRINT.md](file:///C:/Antigravity/programs/financial_organizer/PROJECT_BLUEPRINT.md): Arquitetura completa e roadmap de implementação passo a passo.
- 📋 [docs/SPEC.md](file:///C:/Antigravity/programs/financial_organizer/docs/SPEC.md): Requisitos funcionais, regras de negócio e casos de uso.
- 🗄️ [docs/DATA_MODEL.md](file:///C:/Antigravity/programs/financial_organizer/docs/DATA_MODEL.md): Mapeamento de entidades e tabelas relacionais.
- 🤖 [docs/GEMINI_PDF_PIPELINE.md](file:///C:/Antigravity/programs/financial_organizer/docs/GEMINI_PDF_PIPELINE.md): Pipeline multimodal de extração e schema Pydantic para o Gemini.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (assíncrono), Pydantic v2.
- **Banco de Dados:** SQLite nativo com `aiosqlite`.
- **Inteligência Artificial:** Google Gemini 2.5 Flash via SDK oficial `google-genai`.
- **Frontend:** React 18/19, TypeScript, Vite, Tailwind CSS, Lucide Icons.

---

## 🚀 Como Executar o Projeto (1 Clique)

### Opção 1: Clique Duplo no Windows
Basta dar um duplo clique no arquivo [`start.bat`](file:///C:/Antigravity/programs/financial_organizer/start.bat).
O script inicializa o backend FastAPI, conecta o banco SQLite, serve o frontend React e abre o navegador automaticamente em **`http://localhost:8000`**.

### Opção 2: Via Terminal PowerShell
```powershell
# Execução direta pelo script
.\start.ps1

# Ou iniciando via CLI utilitário
& ".\backend\.venv\Scripts\python.exe" "scripts\fo_cli.py" server
```

---

## 🛠️ Comandos Rápidos da CLI (`fo_cli.py`)

```powershell
$py = ".\backend\.venv\Scripts\python.exe"
$cli = ".\scripts\fo_cli.py"

# Resumo mensal e rateio familiar (Rafael, Mãe, Irmã)
& $py $cli summary --month 2026-11

# Listar contas pendentes de pagamento
& $py $cli list --pending-only

# Alternar status de pagamento (dar baixa na dívida)
& $py $cli toggle-paid <ID>

# Cadastrar despesa manual
& $py $cli add --desc "Mercado" --value 150.0 --owner "Rafael" --cat "Mercado"

# Extrair fatura PDF usando o Gemini IA
& $py $cli extract "caminho\fatura.pdf" --confirm

# Rodar auditoria completa de rotas
& $py $cli validate
```

---

## 🧪 Testes Automatizados

```powershell
cd backend
& ".\.venv\Scripts\python.exe" -m pytest
& ".\.venv\Scripts\python.exe" tests\validate_all_routes.py
```

