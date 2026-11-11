import {
  Card,
  Category,
  DashboardSummaryResponse,
  ExtractedInvoiceResponse,
  Goal,
  InvoiceConfirmRequest,
  InvoiceConfirmResponse,
  InvoiceUpload,
  LivingScenario,
  MacroProjectionResponse,
  FinancialPrinciple,
  Owner,
  OwnerSettleRequest,
  OwnerSettleResponse,
  ReplicateInstallmentsRequest,
  SplitItem,
  Transaction,
  TransactionSplitRequest,
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

export async function updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar transação' }))
    throw new Error(err.detail || 'Falha ao atualizar transação')
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

export async function splitTransaction(
  id: number,
  splits: SplitItem[]
): Promise<Transaction[]> {
  const res = await fetch(`${BASE_URL}/transactions/${id}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ splits }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao dividir lançamento' }))
    throw new Error(err.detail || 'Falha ao dividir lançamento')
  }
  return res.json()
}

export async function replicateInstallments(
  id: number,
  options?: ReplicateInstallmentsRequest
): Promise<Transaction[]> {
  const res = await fetch(`${BASE_URL}/transactions/${id}/replicate-installments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || { generate_future: true, generate_past: false }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao replicar parcelas' }))
    throw new Error(err.detail || 'Falha ao replicar parcelas')
  }
  return res.json()
}

export async function settleOwnerDebt(
  ownerId: number,
  payload: OwnerSettleRequest
): Promise<OwnerSettleResponse> {
  const res = await fetch(`${BASE_URL}/owners/${ownerId}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao quitar débito' }))
    throw new Error(err.detail || 'Falha ao processar quitação')
  }
  return res.json()
}

export async function fetchOwners(): Promise<Owner[]> {
  const res = await fetch(`${BASE_URL}/owners`)
  if (!res.ok) throw new Error('Falha ao buscar proprietários')
  return res.json()
}

export async function createOwner(data: { name: string; category?: string; phone_number?: string }): Promise<Owner> {
  const res = await fetch(`${BASE_URL}/owners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar proprietário' }))
    throw new Error(err.detail || 'Falha ao cadastrar proprietário')
  }
  return res.json()
}

export async function updateOwner(id: number, data: { name?: string; category?: string; phone_number?: string }): Promise<Owner> {
  const res = await fetch(`${BASE_URL}/owners/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar proprietário' }))
    throw new Error(err.detail || 'Falha ao atualizar proprietário')
  }
  return res.json()
}

export async function deleteOwner(id: number): Promise<{ detail: string }> {
  const res = await fetch(`${BASE_URL}/owners/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao excluir proprietário' }))
    throw new Error(err.detail || 'Falha ao excluir proprietário')
  }
  return res.json()
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch(`${BASE_URL}/cards`)
  if (!res.ok) throw new Error('Falha ao buscar cartões')
  return res.json()
}

export async function createCard(data: { card_name: string; due_day?: number | null; payment_date?: string | null; total_limit?: number }): Promise<Card> {
  const res = await fetch(`${BASE_URL}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar cartão' }))
    throw new Error(err.detail || 'Falha ao cadastrar cartão')
  }
  return res.json()
}

export async function updateCard(id: number, data: { card_name?: string; due_day?: number | null; payment_date?: string | null; total_limit?: number }): Promise<Card> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar cartão' }))
    throw new Error(err.detail || 'Falha ao atualizar cartão')
  }
  return res.json()
}

export async function deleteCard(id: number): Promise<{ detail: string }> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao excluir cartão' }))
    throw new Error(err.detail || 'Falha ao excluir cartão')
  }
  return res.json()
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/categories`)
  if (!res.ok) throw new Error('Falha ao buscar categorias')
  return res.json()
}

export async function createCategory(data: { description: string }): Promise<Category> {
  const res = await fetch(`${BASE_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar categoria' }))
    throw new Error(err.detail || 'Falha ao cadastrar categoria')
  }
  return res.json()
}

export async function updateCategory(id: number, data: { description: string }): Promise<Category> {
  const res = await fetch(`${BASE_URL}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar categoria' }))
    throw new Error(err.detail || 'Falha ao atualizar categoria')
  }
  return res.json()
}

export async function deleteCategory(id: number): Promise<{ detail: string }> {
  const res = await fetch(`${BASE_URL}/categories/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao excluir categoria' }))
    throw new Error(err.detail || 'Falha ao excluir categoria')
  }
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

export async function fetchInvoiceUploads(): Promise<InvoiceUpload[]> {
  const res = await fetch(`${BASE_URL}/invoices/uploads`)
  if (!res.ok) throw new Error('Falha ao carregar histórico de faturas importadas')
  return res.json()
}

// --- PLANNING & SPREADSHEET PROJECTION API ---

export async function fetchMacroProjection(
  year: number = 2026,
  accountBalance: number = 0.0
): Promise<MacroProjectionResponse> {
  const params = new URLSearchParams({
    year: String(year),
    account_balance: String(accountBalance),
  })
  const res = await fetch(`${BASE_URL}/planning/macro-projection?${params.toString()}`)
  if (!res.ok) throw new Error('Falha ao carregar projeção macro anual')
  return res.json()
}

export async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch(`${BASE_URL}/planning/goals`)
  if (!res.ok) throw new Error('Falha ao buscar metas financeiras')
  return res.json()
}

export async function createGoal(data: Omit<Goal, 'id'>): Promise<Goal> {
  const res = await fetch(`${BASE_URL}/planning/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao criar meta' }))
    throw new Error(err.detail || 'Falha ao cadastrar meta')
  }
  return res.json()
}

export async function updateGoal(id: number, data: Partial<Goal>): Promise<Goal> {
  const res = await fetch(`${BASE_URL}/planning/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar meta' }))
    throw new Error(err.detail || 'Falha ao atualizar meta')
  }
  return res.json()
}

export async function deleteGoal(id: number): Promise<{ detail: string }> {
  const res = await fetch(`${BASE_URL}/planning/goals/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Falha ao remover meta')
  return res.json()
}

export async function fetchScenarios(): Promise<LivingScenario[]> {
  const res = await fetch(`${BASE_URL}/planning/scenarios`)
  if (!res.ok) throw new Error('Falha ao buscar cenários')
  return res.json()
}

export async function fetchPrinciples(): Promise<FinancialPrinciple[]> {
  const res = await fetch(`${BASE_URL}/planning/principles`)
  if (!res.ok) throw new Error('Falha ao buscar princípios')
  return res.json()
}
