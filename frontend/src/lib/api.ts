import {
  Card,
  Category,
  DashboardSummaryResponse,
  ExtractedInvoiceResponse,
  InvoiceConfirmRequest,
  InvoiceConfirmResponse,
  Owner,
  Transaction,
} from '../types'

const BASE_URL = '/api/v1'

export async function fetchSummary(month: string, cardId?: number | null): Promise<DashboardSummaryResponse> {
  const params = new URLSearchParams({ month })
  if (cardId) params.append('card_id', String(cardId))
  const res = await fetch(`${BASE_URL}/dashboard/summary?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao carregar resumo' }))
    throw new Error(err.detail || 'Falha ao buscar resumo do dashboard')
  }
  return res.json()
}

export async function fetchTransactions(
  month?: string,
  cardId?: number | null,
  isPaid?: boolean | null
): Promise<Transaction[]> {
  const params = new URLSearchParams()
  if (month) params.append('month', month)
  if (cardId) params.append('card_id', String(cardId))
  if (isPaid !== undefined && isPaid !== null) params.append('is_paid', String(isPaid))

  const res = await fetch(`${BASE_URL}/transactions?${params.toString()}`)
  if (!res.ok) throw new Error('Falha ao listar transações')
  return res.json()
}

export async function createTransaction(data: Partial<Transaction>): Promise<Transaction> {
  const res = await fetch(`${BASE_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar transação' }))
    throw new Error(err.detail || 'Falha ao cadastrar transação')
  }
  return res.json()
}

export async function togglePaid(id: number): Promise<Transaction> {
  const res = await fetch(`${BASE_URL}/transactions/${id}/toggle-paid`, {
    method: 'PATCH',
  })
  if (!res.ok) throw new Error('Falha ao alternar status de pagamento')
  return res.json()
}

export async function deleteTransaction(id: number): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Falha ao excluir transação')
  return res.json()
}

export async function fetchOwners(): Promise<Owner[]> {
  const res = await fetch(`${BASE_URL}/owners`)
  if (!res.ok) throw new Error('Falha ao buscar proprietários')
  return res.json()
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch(`${BASE_URL}/cards`)
  if (!res.ok) throw new Error('Falha ao buscar cartões')
  return res.json()
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/categories`)
  if (!res.ok) throw new Error('Falha ao buscar categorias')
  return res.json()
}

export async function extractInvoiceFromPDF(
  file: File,
  cardId?: number | null
): Promise<ExtractedInvoiceResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (cardId) formData.append('card_id', String(cardId))

  const res = await fetch(`${BASE_URL}/invoices/extract`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao extrair fatura com IA' }))
    throw new Error(err.detail || 'Falha no processamento da fatura')
  }
  return res.json()
}

export async function confirmInvoiceBatch(
  payload: InvoiceConfirmRequest
): Promise<InvoiceConfirmResponse> {
  const res = await fetch(`${BASE_URL}/invoices/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao confirmar transações' }))
    throw new Error(err.detail || 'Falha ao confirmar transações')
  }
  return res.json()
}
