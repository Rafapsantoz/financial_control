# Especificação de Requisitos — MVP Financial Organizer

## 1. Personas e Atores
- **Administrador (Rafael):** Titular dos cartões, responsável por importar faturas, cadastrar despesas e auditar o fechamento do mês.
- **Participantes / Donos da Dívida:**
  - Rafael
  - Mãe
  - Irmã

---

## 2. Requisitos Funcionais (RF)

### 💳 Módulo 1: Cadastros Base
- **RF01 - Gestão de Cartões:** Cadastrar cartões de crédito com nome (ex: *Nubank Ultravioleta*, *Inter Black*, *XP Visa Infinite*), limite total e dia de fechamento/vencimento.
- **RF02 - Gestão de Donos da Dívida:** Cadastrar as pessoas que utilizam os cartões (Rafael, Mãe, Irmã).
- **RF03 - Gestão de Tipos de Dívida / Categorias:** Categorizar gastos (Mercado, Lazer, Farmácia/Saúde, Roupas, Alimentação/Restaurante, Serviços/Assinaturas, Outros).

### ✍️ Módulo 2: Entrada e Ingestão de Transações
- **RF04 - Cadastro Manual de Lançamento:**
  - Data da compra.
  - Cartão utilizado.
  - Descrição do estabelecimento.
  - Dono da dívida (Mãe, Irmã, Rafael).
  - Tipo de despesa (Mercado, Lazer, etc.).
  - Valor total e número de parcelas (ex: 1/1, 3/10).
  - Campo opcional de observação.
- **RF05 - Importação de Fatura via PDF (Gemini API):**
  - O usuário faz upload do arquivo PDF da fatura do cartão.
  - O sistema seleciona o cartão e o mês de referência.
  - A API do Gemini analisa o PDF e extrai cada lançamento em formato estruturado (Data, Estabelecimento, Valor, Parcela Atual, Total de Parcelas).
  - O Gemini sugere a categoria e, por semelhança histórica, o provável dono da dívida.
- **RF06 - Tela de Conciliação e Aprovação em Lote:**
  - Após a extração do PDF, o usuário visualiza uma tabela prévia com todas as linhas extraídas.
  - O usuário pode alterar em lote o dono de itens específicos (ex: selecionar 3 compras da farmácia e marcar "Mãe").
  - Ao clicar em "Confirmar Importação", todos os lançamentos são persistidos no banco de dados.

### 📊 Módulo 3: Dashboard e Fechamento Mensal
- **RF07 - Resumo da Fatura Atual:**
  - Seletor de mês/ano e seletor de cartão (ou visão "Todos os Cartões").
  - Valor total consolidado da fatura.
- **RF08 - Rateio por Pessoa (O Core do MVP):**
  - **Card Mãe:** Total devido no mês + lista de compras + botão de alternar status (*Pendente / Pago*).
  - **Card Irmã:** Total devido no mês + lista de compras + botão de alternar status (*Pendente / Pago*).
  - **Card Rafael:** Total devido no mês + lista de compras.
- **RF09 - Gráfico de Gastos por Categoria:**
  - Visualização gráfica de para onde foi o dinheiro no mês (Mercado, Lazer, etc.) com filtro geral e por pessoa.
- **RF10 - Projeção de Parcelas Futuras:**
  - Tabela/gráfico mostrando o impacto de compras parceladas nos próximos meses para cada participante.

---

## 3. Regras de Negócio (RN)

- **RN01 - Parcelamento Automático:** Quando uma compra parcelada é importada (ex: R$ 300 em 3x de R$ 100 com parcela 1/3 no mês atual), o sistema deve permitir projetar automaticamente as parcelas 2/3 e 3/3 para os meses subsequentes.
- **RN02 - Não Duplicação de Fatura:** O sistema deve verificar por data + valor + descrição para alertar compras que já foram lançadas previamente.
- **RN03 - Independência de Pagamento:** O status de quitação (`is_paid`) é individual por pessoa e por fatura. A mãe pode ter pago a parte dela enquanto a da irmã continua pendente.

---

## 4. Requisitos Não-Funcionais (RNF)

- **RNF01 - Stack Recomendada:**
  - **Backend:** Python + FastAPI (mesmo padrão robusto com SQLAlchemy e Pydantic).
  - **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Lucide Icons + Recharts (para os gráficos do dashboard).
- **RNF02 - Banco de Dados:** PostgreSQL (`appdb`) rodando no Docker do WSL.
- **RNF03 - IA Multimodal:** Google Gemini 1.5 Flash / 2.0 Flash via Google GenAI SDK para extração ultra-rápida e de baixo custo dos PDFs.
- **RNF04 - Privacidade:** Nenhum dado bancário sensível (CVV, número completo do cartão) é armazenado. Apenas o extrato de compras e os últimos 4 dígitos ou apelido do cartão.
