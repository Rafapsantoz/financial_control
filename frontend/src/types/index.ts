export interface Owner {
  id: number
  name: string
  category?: string | null
  phone_number?: string | null
  is_active: boolean
}

export interface Card {
  id: number
  card_name: string
  due_day?: number | null
  payment_date?: string | null
  total_limit?: number | null
  is_active: boolean
}

export interface Category {
  id: number
  description: string
  fixed_cost?: number
  is_active: boolean
}

export interface Transaction {
  id: number
  dt_lcto: string
  description: string
  value: number
  owner_id: number
  card_id: number | null
  type_id: number
  cur_parcs: number
  total_parcs: number
  is_paid: boolean
  is_forecast: boolean
  entry_type?: 'expense' | 'income'
  invoice_month?: string | null
  comment?: string | null
  created_at: string
  updated_at?: string | null
}

export interface OwnerSummary {
  owner_id: number
  owner_name: string
  total_amount: number
  effective_amount?: number
  forecast_amount?: number
  paid_amount: number
  pending_amount: number
  status: 'Pago' | 'Pendente' | 'Parcial' | 'Sem despesas'
  transactions_count: number
}

export interface CategorySummary {
  category_id: number
  category_name: string
  total_amount: number
  percentage: number
}

export interface DashboardSummaryResponse {
  month: string
  card_id?: number | null
  total_amount: number
  total_effective?: number
  total_forecast?: number
  total_consolidated?: number
  total_paid: number
  total_pending: number
  owners_summary: OwnerSummary[]
  category_summary: CategorySummary[]
}

export interface ExtractedInvoiceItem {
  purchase_date: string
  description: string
  amount: number
  current_installment: number
  total_installments: number
  suggested_category?: string | null
  category_id?: number | null
  suggested_owner?: string | null
  owner_id?: number | null
  is_duplicate?: boolean
  is_duplicate_suspect?: boolean
  duplicate_reason?: string | null
  entry_type?: 'expense' | 'income'
}

export interface ExtractedInvoiceResponse {
  bank_or_issuer?: string | null
  card_id?: number | null
  invoice_month_year?: string | null
  due_date?: string | null
  total_invoice_amount: number
  file_hash?: string | null
  is_already_imported?: boolean
  already_imported_message?: string | null
  items: ExtractedInvoiceItem[]
}

export interface InvoiceConfirmItem {
  dt_lcto?: string | null
  purchase_date?: string | null
  description: string
  value?: number | null
  amount?: number | null
  owner_id: number
  card_id?: number | null
  type_id?: number | null
  category_id?: number | null
  cur_parcs?: number
  total_parcs?: number
  is_paid?: boolean
  is_forecast?: boolean
  entry_type?: 'expense' | 'income'
  invoice_month?: string | null
  comment?: string | null
}

export interface InvoiceConfirmRequest {
  card_id?: number | null
  target_month?: string | null
  project_future_installments?: boolean
  file_hash?: string | null
  filename?: string | null
  bank_or_issuer?: string | null
  replace_existing?: boolean
  items: InvoiceConfirmItem[]
}

export interface InvoiceConfirmResponse {
  confirmed_count: number
  total_amount: number
  created_transactions: Transaction[]
  message: string
}

export interface InvoiceUpload {
  id: number
  file_hash: string
  filename: string
  card_id?: number | null
  target_month: string
  bank_or_issuer?: string | null
  total_amount: number
  items_count: number
  uploaded_at: string
  status: string
}

// --- PLANNING & SPREADSHEET PROJECTION TYPES ---

export interface Goal {
  id: number
  title: string
  target_amount: number
  saved_amount: number
  category: string
  priority: string
  is_completed: boolean
  comment?: string | null
}

export interface FixedExpenseRow {
  name: string
  category: string
  responsible: string
  monthly_values: Record<string, number>
  total_year: number
}

export interface MonthlyColumnSummary {
  month_key: string
  month_name: string
  fixed_total: number
  cards_total: number
  variable_total: number
  grand_total: number
  paid_total: number
  pending_total: number
}

export interface RunwayMetric {
  account_balance: number
  monthly_fixed_burn: number
  months_of_runway: number
  health_status: 'Excelente' | 'Adequado' | 'Atenção' | 'Crítico'
  comment: string
}

export interface LivingScenario {
  id: string
  title: string
  city: string
  has_home_office: boolean
  estimated_rent: number
  estimated_bills: number
  total_monthly: number
  annual_impact: number
  notes: string
}

export interface FinancialPrinciple {
  step: number
  title: string
  description: string
  category: string
}

export interface MacroProjectionResponse {
  year: number
  account_balance: number
  runway: RunwayMetric
  months: MonthlyColumnSummary[]
  fixed_expenses: FixedExpenseRow[]
  card_expenses: FixedExpenseRow[]
  owners_matrix: Record<string, Record<string, number>>
  categories_matrix: Record<string, Record<string, number>>
  grand_total_year: number
  categories_fixed_total?: number
  bank_accounts_balance?: number
  bank_accounts_owner_balance?: number
  bank_accounts_yield?: number
}

// --- BANK ACCOUNTS & CDI YIELD TYPES ---

export interface BankAccountBalanceItem {
  owner_id: number
  owner_name?: string | null
  balance: number
}

export interface BankAccount {
  id: number
  name: string
  account_type: string
  cdi_rate: number
  cdi_monthly_rate: number
  notes?: string | null
  balances: BankAccountBalanceItem[]
  total_balance: number
  monthly_yield: number
  others_balance: number
  owner_balance: number
  net_with_yield: number
}

export interface BankAccountsSummary {
  accounts: BankAccount[]
  grand_total_balance: number
  grand_total_monthly_yield: number
  grand_total_others: number
  grand_total_owner: number
  grand_total_net_with_yield: number
}

export interface SplitItem {
  owner_id: number
  amount: number
  comment?: string
  is_paid?: boolean
}

export interface TransactionSplitRequest {
  splits: SplitItem[]
}

export interface ReplicateInstallmentsRequest {
  generate_future?: boolean
  generate_past?: boolean
}

export interface OwnerSettleRequest {
  payment_amount: number
  month: string
}

export interface OwnerSettleResponse {
  owner_id: number
  settled_amount: number
  fully_settled_count: number
  partially_settled_count: number
  remaining_pending: number
  message: string
}
