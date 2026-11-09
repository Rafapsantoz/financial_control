import calendar
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini import call_gemini_structured_extraction
from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.schemas.invoice import (
    ExtractedInvoiceItem,
    ExtractedInvoiceResponse,
    InvoiceConfirmRequest,
    InvoiceConfirmResponse,
)
from app.schemas.transaction import TransactionResponse

logger = logging.getLogger(__name__)


def normalize_text(text: str) -> str:
    """Removes accents, strips, and converts text to uppercase for normalized matching."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_bytes = nfkd.encode("ascii", "ignore")
    return ascii_bytes.decode("utf-8").strip().upper()


def decompose_installments(description: str, cur_parcs: int = 1, total_parcs: int = 1) -> Tuple[int, int]:
    """
    Decomposes installment patterns from the purchase description.
    Handles '01/03', '2/10', 'Parcela 04 de 06', 'PARC 02/05'.
    Falls back to existing values if no pattern is found.
    """
    if total_parcs > 1 and 1 <= cur_parcs <= total_parcs:
        return cur_parcs, total_parcs

    desc = description.strip()

    # Pattern: Parcela 04 de 06 / PARC. 02/10
    match_named = re.search(
        r"(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:de|/)\s*(\d{1,2})",
        desc,
        re.IGNORECASE,
    )
    if match_named:
        c, t = int(match_named.group(1)), int(match_named.group(2))
        if 1 <= c <= t and 1 < t <= 60:
            return c, t

    # Pattern: 01/03 or 2/10 (isolated tokens, not year-month or full date)
    match_tokens = re.finditer(r"\b(\d{1,2})/(\d{1,2})\b", desc)
    for m in match_tokens:
        c, t = int(m.group(1)), int(m.group(2))
        if 1 <= c <= t and 1 < t <= 60:
            return c, t

    # Pattern: 02 de 10
    match_de = re.search(r"\b(\d{1,2})\s+de\s+(\d{1,2})\b", desc, re.IGNORECASE)
    if match_de:
        c, t = int(match_de.group(1)), int(match_de.group(2))
        if 1 <= c <= t and 1 < t <= 60:
            return c, t

    effective_cur = max(1, cur_parcs)
    effective_total = max(effective_cur, total_parcs)
    return effective_cur, effective_total


def assign_heuristic_owner(
    suggested_owner: Optional[str],
    description: str,
    owners_by_norm_name: Dict[str, Owner],
) -> Tuple[str, Optional[int]]:
    """
    Assigns the owner according to priority rules:
    1. Cardholder name printed on additional cards (`suggested_owner`).
    2. Lexical keyword rules on `description`:
       - DROGARIA / FARMACIA -> Mãe
       - ZARA / SHEIN -> Irmã
       - STEAM / IFOOD -> Rafael
    3. Fallback: Rafael (primary titular).
    """
    # 1. Suggested owner from additional card
    if suggested_owner:
        norm_sugg = normalize_text(suggested_owner)
        for norm_name, owner_obj in owners_by_norm_name.items():
            if norm_name in norm_sugg or norm_sugg in norm_name:
                return owner_obj.name, owner_obj.id

    # 2. Lexical keyword rules on description
    norm_desc = normalize_text(description)
    target_name = None

    if "DROGARIA" in norm_desc or "FARMACIA" in norm_desc:
        target_name = "Mãe"
    elif "ZARA" in norm_desc or "SHEIN" in norm_desc:
        target_name = "Irmã"
    elif "STEAM" in norm_desc or "IFOOD" in norm_desc:
        target_name = "Rafael"
    else:
        target_name = "Rafael"

    # Match target_name to owner id in database
    norm_target = normalize_text(target_name)
    matched_owner = owners_by_norm_name.get(norm_target)
    if matched_owner:
        return matched_owner.name, matched_owner.id

    # Fallback to first owner found or None
    fallback_owner = next(iter(owners_by_norm_name.values()), None)
    return target_name, (fallback_owner.id if fallback_owner else None)


CATEGORY_SYNONYMS = {
    # Transporte
    "UBER": "Transporte",
    "99": "Transporte",
    "TAXI": "Transporte",
    "TRANSPORTE": "Transporte",
    "COMBUSTIVEL": "Transporte",
    "POSTO": "Transporte",
    "GASOLINA": "Transporte",
    "PEDAGIO": "Transporte",
    "ESTACIONAMENTO": "Transporte",
    # Farmácia / Saúde
    "FARMACIA": "Farmácia",
    "DROGARIA": "Farmácia",
    "MEDICAMENTO": "Farmácia",
    "REMEDIO": "Farmácia",
    "SAUDE": "Farmácia",
    # Alimentação / Restaurante
    "RESTAURANTE": "Restaurante",
    "ALIMENTACAO": "Restaurante",
    "COMIDA": "Restaurante",
    "IFOOD": "Restaurante",
    "LANCHE": "Restaurante",
    "PADARIA": "Restaurante",
    "PIZZA": "Restaurante",
    "BURGER": "Restaurante",
    # Mercado
    "MERCADO": "Mercado",
    "SUPERMERCADO": "Mercado",
    "ATACADAO": "Mercado",
    "CARREFOUR": "Mercado",
    "PAO DE ACUCAR": "Mercado",
    "COMPRAS": "Mercado",
    # Roupas / Vestuário
    "ROUPAS": "Roupas",
    "MODA": "Roupas",
    "VESTUARIO": "Roupas",
    "ZARA": "Roupas",
    "SHEIN": "Roupas",
    "RENNER": "Roupas",
    "RIACHUELO": "Roupas",
    # Assinaturas / Streaming
    "ASSINATURAS": "Assinaturas",
    "STREAMING": "Assinaturas",
    "NETFLIX": "Assinaturas",
    "SPOTIFY": "Assinaturas",
    "PRIME": "Assinaturas",
    "CLOUD": "Assinaturas",
    "ANUIDADE": "Assinaturas",
    # Lazer
    "LAZER": "Lazer",
    "CINEMA": "Lazer",
    "JOGOS": "Lazer",
    "STEAM": "Lazer",
    "PLAYSTATION": "Lazer",
    "ENTRETENIMENTO": "Lazer",
    # Outros
    "OUTROS": "Outros",
}


def match_category(
    suggested_category: str,
    description: str,
    categories_by_norm_name: Dict[str, Category],
) -> Tuple[str, Optional[int]]:
    """
    Matches the category suggested by Gemini or lexical keywords to database Category entities.
    Falls back to 'Outros'.
    """
    norm_sugg = normalize_text(suggested_category)
    norm_desc = normalize_text(description)

    # 1. Direct match on suggested category
    if norm_sugg in categories_by_norm_name:
        cat = categories_by_norm_name[norm_sugg]
        return cat.description, cat.id

    # 2. Synonym match on suggested category
    if norm_sugg in CATEGORY_SYNONYMS:
        target_name = CATEGORY_SYNONYMS[norm_sugg]
        norm_target = normalize_text(target_name)
        if norm_target in categories_by_norm_name:
            cat = categories_by_norm_name[norm_target]
            return cat.description, cat.id

    # 3. Keyword scan in description
    for keyword, standard_name in CATEGORY_SYNONYMS.items():
        if keyword in norm_desc:
            norm_target = normalize_text(standard_name)
            if norm_target in categories_by_norm_name:
                cat = categories_by_norm_name[norm_target]
                return cat.description, cat.id

    # 4. Fallback to 'Outros'
    norm_outros = normalize_text("Outros")
    if norm_outros in categories_by_norm_name:
        cat = categories_by_norm_name[norm_outros]
        return cat.description, cat.id

    fallback_cat = next(iter(categories_by_norm_name.values()), None)
    return "Outros", (fallback_cat.id if fallback_cat else None)


async def check_duplicate_transaction(
    db: AsyncSession,
    purchase_date: str,
    amount: float,
    description: str,
    card_id: Optional[int] = None,
) -> bool:
    """
    Implements Business Rule RN02 (Invoice Duplicate Prevention).
    Verifies if a transaction with matching date, amount, and description already exists in transactions_fapp.
    """
    try:
        clean_date = purchase_date.strip()
        if len(clean_date) >= 10:
            year = int(clean_date[:4])
            month = int(clean_date[5:7])
            day = int(clean_date[8:10])
            start_dt = datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc)
            end_dt = datetime(year, month, day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        else:
            return False
    except Exception:
        return False

    query = select(Transaction).where(
        Transaction.dt_lcto >= start_dt,
        Transaction.dt_lcto <= end_dt,
    )

    if card_id is not None:
        query = query.where(Transaction.card_id == card_id)

    result = await db.execute(query)
    existing_transactions = result.scalars().all()

    norm_target_desc = normalize_text(description)
    target_value = round(abs(float(amount)), 2)

    for tx in existing_transactions:
        if abs(round(tx.value, 2) - target_value) < 0.01:
            if normalize_text(tx.description) == norm_target_desc:
                return True

    return False


def add_months(dt: datetime, n: int) -> datetime:
    """Safely adds n months to a datetime, respecting month boundaries."""
    new_month = dt.month - 1 + n
    year = dt.year + new_month // 12
    month = new_month % 12 + 1
    max_days = calendar.monthrange(year, month)[1]
    day = min(dt.day, max_days)
    return dt.replace(year=year, month=month, day=day)


def add_months_to_str(month_str: str, n: int) -> str:
    """Safely adds n months to a YYYY-MM string."""
    try:
        y, m = int(month_str[:4]), int(month_str[5:7])
        total_m = m - 1 + n
        new_y = y + total_m // 12
        new_m = total_m % 12 + 1
        return f"{new_y:04d}-{new_m:02d}"
    except Exception:
        return month_str


async def extract_invoice_from_pdf(
    db: AsyncSession,
    pdf_bytes: bytes,
    card_id: Optional[int] = None,
) -> ExtractedInvoiceResponse:
    """
    Core AI ingestion pipeline:
    1. Sends PDF bytes to Gemini API for structured multimodal extraction.
    2. Validates and resolves card ID (from parameter or bank/issuer matching).
    3. Loads active owners and categories from SQLite.
    4. Enriches items with installment parsing, heuristic owner assignment, category normalization,
       and duplicate detection (RN02).
    5. Calculates invoice consolidated total if missing.
    """
    # 1. Structured extraction via Gemini
    extracted = await call_gemini_structured_extraction(pdf_bytes=pdf_bytes)

    # 2. Resolve Card ID
    resolved_card_id = card_id
    if resolved_card_id is not None:
        card = await db.get(Card, resolved_card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão com ID {resolved_card_id} não existe no sistema.",
            )
    elif extracted.bank_or_issuer:
        # Try matching bank_or_issuer against cards in database
        cards_res = await db.execute(select(Card))
        cards = cards_res.scalars().all()
        norm_bank = normalize_text(extracted.bank_or_issuer)
        for c in cards:
            if normalize_text(c.card_name) in norm_bank or norm_bank in normalize_text(c.card_name):
                resolved_card_id = c.id
                break

    extracted.card_id = resolved_card_id

    # 3. Load DB entities for enrichment
    owners_res = await db.execute(select(Owner))
    owners = owners_res.scalars().all()
    owners_by_norm = {normalize_text(o.name): o for o in owners}

    categories_res = await db.execute(select(Category))
    categories = categories_res.scalars().all()
    categories_by_norm = {normalize_text(c.description): c for c in categories}

    # 4. Enrich each item
    for item in extracted.items:
        # Installment decomposition
        cur, tot = decompose_installments(
            description=item.description,
            cur_parcs=item.current_installment,
            total_parcs=item.total_installments,
        )
        item.current_installment = cur
        item.total_installments = tot

        # Heuristic owner assignment
        owner_name, owner_id = assign_heuristic_owner(
            suggested_owner=item.suggested_owner,
            description=item.description,
            owners_by_norm_name=owners_by_norm,
        )
        item.suggested_owner = owner_name
        item.owner_id = owner_id

        # Category normalization
        cat_name, cat_id = match_category(
            suggested_category=item.suggested_category,
            description=item.description,
            categories_by_norm_name=categories_by_norm,
        )
        item.suggested_category = cat_name
        item.category_id = cat_id

        # Card association
        item.card_id = resolved_card_id

        # Duplicate check (RN02)
        is_dup = await check_duplicate_transaction(
            db=db,
            purchase_date=item.purchase_date,
            amount=item.amount,
            description=item.description,
            card_id=resolved_card_id,
        )
        item.is_duplicate = is_dup

    # 5. Consolidate total invoice amount
    if extracted.total_invoice_amount <= 0.0 and extracted.items:
        extracted.total_invoice_amount = round(sum(i.amount for i in extracted.items), 2)

    return extracted


async def confirm_invoice_transactions(
    db: AsyncSession,
    request: InvoiceConfirmRequest,
) -> InvoiceConfirmResponse:
    """
    Batch confirms extracted invoice transactions and persists them to SQLite (`transactions_fapp`).
    Validates foreign key integrity (Owner, Card, Category).
    Supports optional automatic installment projection (RN01) with `is_forecast=True`.
    """
    if not request.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A lista de transações para confirmação não pode estar vazia.",
        )

    # Validate default card if specified
    if request.card_id is not None:
        card = await db.get(Card, request.card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão padrão com ID {request.card_id} não existe no sistema.",
            )

    # Pre-validate unique foreign keys in the request batch
    checked_owners: Dict[int, bool] = {}
    checked_cards: Dict[int, bool] = {}
    checked_categories: Dict[int, bool] = {}

    transactions_to_create: List[Transaction] = []

    for idx, item in enumerate(request.items):
        eff_card_id = item.card_id if item.card_id is not None else request.card_id

        # Validate owner
        if item.owner_id is not None:
            if item.owner_id not in checked_owners:
                owner = await db.get(Owner, item.owner_id)
                if not owner:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Item {idx + 1}: Proprietário com ID {item.owner_id} não existe.",
                    )
                checked_owners[item.owner_id] = True

        # Validate card
        if eff_card_id is not None:
            if eff_card_id not in checked_cards:
                card = await db.get(Card, eff_card_id)
                if not card:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Item {idx + 1}: Cartão com ID {eff_card_id} não existe.",
                    )
                checked_cards[eff_card_id] = True

        # Validate category
        eff_type_id = item.type_id
        if eff_type_id is not None:
            if eff_type_id not in checked_categories:
                category = await db.get(Category, eff_type_id)
                if not category:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Item {idx + 1}: Categoria com ID {eff_type_id} não existe.",
                    )
                checked_categories[eff_type_id] = True

        # Resolve target invoice month for billing cycle
        eff_invoice_month = None
        if request.target_month and re.match(r"^\d{4}-(0[1-9]|1[0-2])$", request.target_month.strip()):
            eff_invoice_month = request.target_month.strip()
        elif item.invoice_month and re.match(r"^\d{4}-(0[1-9]|1[0-2])$", item.invoice_month.strip()):
            eff_invoice_month = item.invoice_month.strip()
        elif item.dt_lcto:
            eff_invoice_month = item.dt_lcto.strftime("%Y-%m")

        tx_dt = item.dt_lcto
        tx_comment = item.comment

        # Create primary transaction for this installment
        primary_tx = Transaction(
            dt_lcto=tx_dt,
            description=item.description,
            value=item.value,
            owner_id=item.owner_id,
            card_id=eff_card_id,
            type_id=eff_type_id,
            total_parcs=item.total_parcs,
            cur_parcs=item.cur_parcs,
            is_paid=item.is_paid,
            is_forecast=item.is_forecast,
            invoice_month=eff_invoice_month,
            comment=tx_comment,
        )
        transactions_to_create.append(primary_tx)

        # Projections for future installments (RN01) if enabled
        if request.project_future_installments and item.total_parcs > item.cur_parcs:
            for p in range(item.cur_parcs + 1, item.total_parcs + 1):
                future_dt = add_months(tx_dt, p - item.cur_parcs)
                future_inv_month = (
                    add_months_to_str(eff_invoice_month, p - item.cur_parcs)
                    if eff_invoice_month
                    else future_dt.strftime("%Y-%m")
                )
                proj_comment = (
                    f"{tx_comment} (Projeção {p}/{item.total_parcs})"
                    if tx_comment
                    else f"Parcela projetada automaticamente ({p}/{item.total_parcs})"
                )
                proj_tx = Transaction(
                    dt_lcto=future_dt,
                    description=item.description,
                    value=item.value,
                    owner_id=item.owner_id,
                    card_id=eff_card_id,
                    type_id=eff_type_id,
                    total_parcs=item.total_parcs,
                    cur_parcs=p,
                    is_paid=False,
                    is_forecast=True,
                    invoice_month=future_inv_month,
                    comment=proj_comment,
                )
                transactions_to_create.append(proj_tx)

    # Persist batch in SQLite
    db.add_all(transactions_to_create)
    await db.commit()

    for tx in transactions_to_create:
        await db.refresh(tx)

    total_confirmed_amount = round(sum(tx.value for tx in transactions_to_create), 2)
    pydantic_responses = [TransactionResponse.model_validate(tx) for tx in transactions_to_create]

    return InvoiceConfirmResponse(
        confirmed_count=len(transactions_to_create),
        total_amount=total_confirmed_amount,
        created_transactions=pydantic_responses,
        message=f"{len(transactions_to_create)} transações confirmadas e salvas com sucesso.",
    )
