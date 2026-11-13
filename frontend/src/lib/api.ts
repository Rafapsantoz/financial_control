import {
  AuditLog,
  AuditLogListResponse,
  BankAccount,
  BankAccountBalanceItem,
  BankAccountsSummary,
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

export async function createCategory(data: { description: string; fixed_cost?: number }): Promise<Category> {
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

export async function updateCategory(id: number, data: { description?: string; fixed_cost?: number }): Promise<Category> {
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
  fileOrFiles: File | File[],
  cardId?: number | null
): Promise<ExtractedInvoiceResponse> {
  const formData = new FormData()
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach((f) => formData.append('files', f))
    if (fileOrFiles.length > 0) {
      formData.append('file', fileOrFiles[0])
    }
  } else {
    formData.append('file', fileOrFiles)
    formData.append('files', fileOrFiles)
  }
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

export async function deleteInvoiceUpload(
  id: number,
  deleteTransactions = true
): Promise<{ detail: string; upload_id: number; deleted_transactions_count: number }> {
  const res = await fetch(`${BASE_URL}/invoices/uploads/${id}?delete_transactions=${deleteTransactions}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao excluir registro de fatura' }))
    throw new Error(err.detail || 'Falha ao excluir fatura importada')
  }
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

export async function exportTransactionsExcel(params: {
  month?: string
  owner_id?: number | null
  card_id?: number | null
  is_paid?: boolean | null
  is_forecast?: boolean | null
  search?: string
}): Promise<Blob> {
  const q = new URLSearchParams()
  if (params.month) q.append('month', params.month)
  if (params.owner_id !== undefined && params.owner_id !== null) q.append('owner_id', String(params.owner_id))
  if (params.card_id !== undefined && params.card_id !== null) q.append('card_id', String(params.card_id))
  if (params.is_paid !== undefined && params.is_paid !== null) q.append('is_paid', String(params.is_paid))
  if (params.is_forecast !== undefined && params.is_forecast !== null) q.append('is_forecast', String(params.is_forecast))
  if (params.search) q.append('search', params.search)

  const res = await fetch(`${BASE_URL}/transactions/export?${q.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao exportar planilha' }))
    throw new Error(err.detail || 'Falha ao exportar planilha Excel')
  }
  return res.blob()
}

// --- BANK ACCOUNTS & CDI YIELD API ---

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const res = await fetch(`${BASE_URL}/bank-accounts`)
  if (!res.ok) throw new Error('Falha ao buscar contas bancárias')
  return res.json()
}

export async function fetchBankAccountsSummary(): Promise<BankAccountsSummary> {
  const res = await fetch(`${BASE_URL}/bank-accounts/summary`)
  if (!res.ok) throw new Error('Falha ao buscar resumo de contas bancárias')
  return res.json()
}

export async function createBankAccount(data: {
  name: string
  account_type?: string
  cdi_rate?: number
  cdi_monthly_rate?: number
  notes?: string
  initial_balances?: BankAccountBalanceItem[]
}): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/bank-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar conta bancária' }))
    throw new Error(err.detail || 'Falha ao cadastrar conta bancária')
  }
  return res.json()
}

export async function updateBankAccount(
  id: number,
  data: {
    name?: string
    account_type?: string
    cdi_rate?: number
    cdi_monthly_rate?: number
    notes?: string
  }
): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/bank-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar conta bancária' }))
    throw new Error(err.detail || 'Falha ao atualizar conta bancária')
  }
  return res.json()
}

export async function updateBankAccountBalances(
  id: number,
  balances: BankAccountBalanceItem[]
): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/bank-accounts/${id}/balances`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balances }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao atualizar saldos da conta' }))
    throw new Error(err.detail || 'Falha ao atualizar saldos da conta')
  }
  return res.json()
}

export async function deleteBankAccount(id: number): Promise<{ detail: string }> {
  const res = await fetch(`${BASE_URL}/bank-accounts/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro ao excluir conta bancária' }))
    throw new Error(err.detail || 'Falha ao excluir conta bancária')
  }
  return res.json()
}

export async function fetchFixedCostsSummary(): Promise<{
  total_fixed_cost: number
  count_with_fixed: number
  total_categories: number
  categories: { id: number; description: string; fixed_cost: number }[]
}> {
  const res = await fetch(`${BASE_URL}/categories/summary/fixed-costs`)
  if (!res.ok) throw new Error('Falha ao buscar resumo de custos fixos')
  return res.json()
}

// --- AUDIT LOGS API ---

export async function fetchAuditLogs(params?: {
  entity_type?: string
  action?: string
  entity_id?: number
  search?: string
  skip?: number
  limit?: number
}): Promise<AuditLogListResponse> {
  const q = new URLSearchParams()
  if (params?.entity_type) q.append('entity_type', params.entity_type)
  if (params?.action) q.append('action', params.action)
  if (params?.entity_id !== undefined && params.entity_id !== null) q.append('entity_id', String(params.entity_id))
  if (params?.search) q.append('search', params.search)
  if (params?.skip !== undefined) q.append('skip', String(params.skip))
  if (params?.limit !== undefined) q.append('limit', String(params.limit))

  const res = await fetch(`${BASE_URL}/audit-logs?${q.toString()}`)
  if (!res.ok) throw new Error('Falha ao buscar logs de auditoria')
  return res.json()
}

export async function fetchAuditStats(): Promise<{
  total_logs: number
  by_action: Record<string, number>
  by_entity: Record<string, number>
}> {
  const res = await fetch(`${BASE_URL}/audit-logs/stats`)
  if (!res.ok) throw new Error('Falha ao buscar estatísticas de auditoria')
  return res.json()
}
