# Modelo de Dados Relacional — PostgreSQL (`appdb`)

O modelo aproveita e expande as tabelas `_fapp` já existentes no seu banco de dados PostgreSQL.

---

## 🗺️ Diagrama de Entidade-Relacionamento (ERD)

```mermaid
erDiagram
    OWNERS_FAPP ||--o{ TRANSACTIONS_FAPP : "possui"
    CARDS_FAPP ||--o{ TRANSACTIONS_FAPP : "registrado_em"
    TYPE_FAPP ||--o{ TRANSACTIONS_FAPP : "categorizado_como"

    OWNERS_FAPP {
        bigint id PK
        varchar name "Ex: Rafael, Mãe, Irmã"
        varchar category "Ex: Familiar, Pessoal"
        varchar phone_number "Opcional (para envio de fatura no WhatsApp)"
    }

    CARDS_FAPP {
        bigint id PK
        varchar card_name "Ex: Nubank, Inter Black, XP"
        timestamp payment_date "Dia de vencimento da fatura"
        numeric total_limit "Limite total cadastrado"
    }

    TYPE_FAPP {
        bigint id PK
        varchar description "Ex: Mercado, Lazer, Farmácia, Restaurante"
    }

    TRANSACTIONS_FAPP {
        bigint id PK
        timestamp dt_lcto "Data da compra/lançamento"
        varchar description "Nome do estabelecimento / item"
        integer owner_id FK "Dono da dívida (Mãe, Irmã, Rafael)"
        integer card_id FK "Cartão utilizado"
        integer type_id FK "Categoria da despesa"
        numeric value "Valor da parcela/compra em R$"
        integer total_parcs "Total de parcelas (ex: 1, 10, 12)"
        integer cur_parcs "Parcela atual (ex: 1, 2, 3)"
        varchar comment "Observação opcional"
        boolean is_paid "Se o dono já pagou este mês"
        boolean is_forecast "Se é previsão ou lançamento consolidado"
    }
```

---

## 📋 Descrição das Tabelas

### 1. `owners_fapp` (Donos da Dívida)
Armazena as pessoas que dividem as despesas do cartão:
- `id` (PK, Serial / BigInt)
- `name` (Nome da pessoa: *Rafael*, *Mãe*, *Irmã*)
- `category` (Classificação: *Familiar*, *Amigo*, etc.)
- `phone_number` (Número para eventual notificação ou lembrete de PIX)

### 2. `cards_fapp` (Cartões de Crédito)
Armazena os cartões cadastrados:
- `id` (PK, Serial / BigInt)
- `card_name` (Nome do cartão: *Nubank*, *Inter*, etc.)
- `payment_date` (Dia do vencimento)
- `total_limit` (Limite de crédito)

### 3. `type_fapp` (Categorias de Gastos)
Categorias de despesas:
- `id` (PK, Serial / BigInt)
- `description` (*Mercado*, *Lazer*, *Farmácia*, *Assinaturas*, *Transporte*, *Roupas*, etc.)

### 4. `transactions_fapp` (Lançamentos / Transações)
Lançamentos de despesas individuais:
- `id` (PK, Serial / BigInt)
- `dt_lcto` (Data do gasto)
- `description` (Nome do estabelecimento comercial)
- `owner_id` (FK -> `owners_fapp.id`)
- `card_id` (FK -> `cards_fapp.id`)
- `type_id` (FK -> `type_fapp.id`)
- `value` (Valor em reais)
- `total_parcs` (Total de parcelas)
- `cur_parcs` (Parcela corrente)
- `comment` (Comentário extra)
- `is_paid` (Se a dívida foi quitada pelo responsável)
- `is_forecast` (Previsão de fatura futura)
