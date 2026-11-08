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
  comment?: string | null
  created_at: string
  updated_at?: string | null
}

export interface OwnerSummary {
  owner_id: number
  owner_name: string
  total_amount: number
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
  is_duplicate_suspect?: boolean
}

export interface ExtractedInvoiceResponse {
  bank_or_issuer?: string | null
  card_id?: number | null
  invoice_month_year?: string | null
  due_date?: string | null
  total_invoice_amount: number
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
  comment?: string | null
}

export interface InvoiceConfirmRequest {
  card_id?: number | null
  project_future_installments?: boolean
  items: InvoiceConfirmItem[]
}

export interface InvoiceConfirmResponse {
  confirmed_count: number
  total_amount: number
  created_transactions: Transaction[]
  message: string
}
