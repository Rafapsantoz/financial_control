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
- **Inteligência Artificial:** Google Gemini 2.0 / 1.5 Flash via SDK oficial `google-genai`.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts.
