from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.schemas.transaction import TransactionResponse


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ExtractedInvoiceItem(BaseModel):
    purchase_date: str = Field(..., description="Data da compra no formato AAAA-MM-DD")
    description: str = Field(..., description="Nome do estabelecimento comercial ou descrição da compra")
    amount: float = Field(..., description="Valor da transação em Reais (positivo)")
    current_installment: int = Field(default=1, ge=1, description="Número da parcela atual. Ex: 2 para 02/10, 1 para à vista")
    total_installments: int = Field(default=1, ge=1, description="Total de parcelas. Ex: 10 para 02/10, 1 para à vista")
    suggested_category: str = Field(default="Outros", description="Categoria sugerida: Mercado, Lazer, Farmácia, Restaurante, Assinaturas, Roupas, Transporte, Outros")
    suggested_owner: Optional[str] = Field(default=None, description="Sugestão de dono extraído da fatura")
    owner_id: Optional[int] = Field(default=None, description="ID do responsável resolvido pelo sistema")
    category_id: Optional[int] = Field(default=None, description="ID da categoria resolvida no banco de dados")
    card_id: Optional[int] = Field(default=None, description="ID do cartão associado")
    is_duplicate: bool = Field(default=False, description="Indica se a transação já foi previamente lançada no sistema (RN02)")

    @field_validator("amount", mode="after")
    @classmethod
    def sanitize_amount(cls, v: float) -> float:
        return round(abs(float(v)), 2)

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_desc(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("A descrição do item não pode ser vazia.")
        return trimmed


class ExtractedInvoiceResponse(BaseModel):
    bank_or_issuer: str = Field(default="Não identificado", description="Nome do banco ou emissor identificado na fatura (ex: Nubank, Inter, C6, Itau)")
    invoice_month_year: str = Field(default="", description="Mês e ano de referência da fatura (ex: 2026-11)")
    due_date: Optional[str] = Field(default=None, description="Data de vencimento da fatura")
    total_invoice_amount: float = Field(default=0.0, description="Valor total consolidado da fatura")
    card_id: Optional[int] = Field(default=None, description="ID do cartão associado")
    file_hash: Optional[str] = Field(default=None, description="Hash SHA-256 do arquivo PDF para controle de duplicidade")
    is_already_imported: bool = Field(default=False, description="Indica se este mesmo arquivo ou ciclo de fatura já foi importado")
    already_imported_message: Optional[str] = Field(default=None, description="Mensagem de alerta informando a importação anterior")
    items: List[ExtractedInvoiceItem] = Field(default_factory=list, description="Lista de todas as compras detalhadas na fatura")


class InvoiceConfirmItem(BaseModel):
    purchase_date: Optional[str] = Field(default=None, description="Data da compra YYYY-MM-DD")
    dt_lcto: Optional[datetime] = Field(default=None, description="Data/hora do lançamento")
    description: str = Field(..., min_length=1, max_length=255, description="Descrição do estabelecimento ou item")
    value: Optional[float] = Field(default=None, gt=0.0, description="Valor da transação em R$ (positivo)")
    amount: Optional[float] = Field(default=None, gt=0.0, description="Alias para o valor da transação")
    owner_id: Optional[int] = Field(default=None, description="ID do responsável (owners_fapp)")
    card_id: Optional[int] = Field(default=None, description="ID do cartão de crédito (cards_fapp)")
    type_id: Optional[int] = Field(default=None, description="ID da categoria (type_fapp)")
    category_id: Optional[int] = Field(default=None, description="Alias para type_id")
    total_parcs: int = Field(default=1, ge=1, description="Total de parcelas")
    cur_parcs: int = Field(default=1, ge=1, description="Parcela atual")
    comment: Optional[str] = Field(default=None, max_length=500, description="Observação livre")
    invoice_month: Optional[str] = Field(default=None, description="Mês da fatura de competência (YYYY-MM)")
    is_paid: bool = Field(default=False, description="Status de quitação da dívida pelo responsável")
    is_forecast: bool = Field(default=False, description="Indica se é parcela projetada para faturas futuras")

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_description(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("A descrição do item não pode ser vazia.")
        return trimmed

    @model_validator(mode="after")
    def unify_and_validate(self) -> "InvoiceConfirmItem":
        # Resolve value from amount if needed
        if self.value is None:
            if self.amount is not None:
                self.value = round(float(self.amount), 2)
            else:
                raise ValueError("O valor da transação ('value' ou 'amount') deve ser informado e maior que zero.")
        else:
            self.value = round(float(self.value), 2)

        # Resolve type_id from category_id if needed
        if self.type_id is None and self.category_id is not None:
            self.type_id = self.category_id

        # Resolve dt_lcto from purchase_date if needed
        if self.dt_lcto is None:
            if self.purchase_date:
                try:
                    clean_date = self.purchase_date.strip()
                    if len(clean_date) == 10 and clean_date[4] == "-" and clean_date[7] == "-":
                        parts = clean_date.split("-")
                        self.dt_lcto = datetime(
                            int(parts[0]), int(parts[1]), int(parts[2]), 12, 0, 0, tzinfo=timezone.utc
                        )
                    else:
                        parsed_dt = datetime.fromisoformat(clean_date)
                        if parsed_dt.tzinfo is None:
                            parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
                        self.dt_lcto = parsed_dt
                except Exception:
                    self.dt_lcto = utc_now()
            else:
                self.dt_lcto = utc_now()
        elif self.dt_lcto.tzinfo is None:
            self.dt_lcto = self.dt_lcto.replace(tzinfo=timezone.utc)

        if self.cur_parcs > self.total_parcs:
            raise ValueError(
                f"A parcela atual ({self.cur_parcs}) não pode ser maior que o total de parcelas ({self.total_parcs})."
            )

        return self


class InvoiceConfirmRequest(BaseModel):
    card_id: Optional[int] = Field(default=None, description="ID do cartão padrão para itens sem card_id explícito")
    target_month: Optional[str] = Field(
        default=None,
        description="Mês e ano da fatura de competência (formato YYYY-MM, ex: 2026-11). Se fornecido, alinha os lançamentos à fatura.",
    )
    project_future_installments: bool = Field(
        default=False,
        description="Se True, gera previsões de parcelas futuras (is_forecast=True) para compras parceladas",
    )
    file_hash: Optional[str] = Field(default=None, description="Hash SHA-256 do arquivo original para prevenção de duplicidade")
    filename: Optional[str] = Field(default=None, description="Nome do arquivo PDF original enviado")
    bank_or_issuer: Optional[str] = Field(default=None, description="Nome do emissor identificado")
    replace_existing: bool = Field(
        default=False,
        description="Se True e a fatura já tiver sido importada, remove as transações anteriores da fatura antes de persistir as novas.",
    )
    items: List[InvoiceConfirmItem] = Field(..., min_length=1, description="Lista de itens confirmados da fatura")


class InvoiceConfirmResponse(BaseModel):
    confirmed_count: int = Field(..., description="Número de transações confirmadas e salvas com sucesso")
    total_amount: float = Field(..., description="Valor total consolidado das transações criadas")
    created_transactions: List[TransactionResponse] = Field(
        default_factory=list, description="Lista de transações persistidas no banco"
    )
    message: str = Field(default="Transações confirmadas com sucesso.", description="Mensagem de status")

    model_config = ConfigDict(from_attributes=True)


class InvoiceUploadResponse(BaseModel):
    id: int
    file_hash: str
    filename: str
    card_id: Optional[int] = None
    target_month: str
    bank_or_issuer: Optional[str] = None
    total_amount: float
    items_count: int
    uploaded_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)
