import React, { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
  CreditCard,
  User,
  Users,
} from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'
import { formatCurrency, formatDate } from '../../lib/formatters'
import { exportTransactionsExcel } from '../../lib/api'

interface TransactionTableProps {
  transactions: Transaction[]
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  currentMonth?: string
  selectedOwnerId: number | null
  onSelectOwner: (ownerId: number | null) => void
  statusFilter?: 'all' | 'pending' | 'paid'
  onStatusFilterChange?: (status: 'all' | 'pending' | 'paid') => void
  forecastFilter?: 'all' | 'effective' | 'forecast'
  onForecastFilterChange?: (forecast: 'all' | 'effective' | 'forecast') => void
  onTogglePaid: (id: number) => void
  onDeleteTransaction: (id: number) => void
  onEditTransaction: (tx: Transaction) => void
  isUpdatingId?: number | null
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

const formatInvoiceBadge = (invoiceMonth: string) => {
  const parts = invoiceMonth.split('-')
  if (parts.length >= 2) {
    const idx = parseInt(parts[1], 10) - 1
    return `Fatura ${MONTH_NAMES_SHORT[idx] || parts[1]}/${parts[0].slice(2)}`
  }
  return `Fatura ${invoiceMonth}`
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  owners,
  cards,
  categories,
  currentMonth,
  selectedOwnerId,
  onSelectOwner,
  statusFilter: statusFilterProp,
  onStatusFilterChange: onStatusFilterChangeProp,
  forecastFilter: forecastFilterProp,
  onForecastFilterChange: onForecastFilterChangeProp,
  onTogglePaid,
  onDeleteTransaction,
  onEditTransaction,
  isUpdatingId,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [internalStatusFilter, setInternalStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [internalForecastFilter, setInternalForecastFilter] = useState<'all' | 'effective' | 'forecast'>('all')
  const [isExporting, setIsExporting] = useState(false)

  const statusFilter = statusFilterProp ?? internalStatusFilter
  const setStatusFilter = onStatusFilterChangeProp ?? setInternalStatusFilter

  const forecastFilter = forecastFilterProp ?? internalForecastFilter
  const setForecastFilter = onForecastFilterChangeProp ?? setInternalForecastFilter

  const ownersMap = new Map(owners.map((o) => [o.id, o]))
  const cardsMap = new Map(cards.map((c) => [c.id, c]))
  const categoriesMap = new Map(categories.map((cat) => [cat.id, cat]))

  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      const blob = await exportTransactionsExcel({
        month: currentMonth,
        owner_id: selectedOwnerId,
        is_paid: statusFilter === 'pending' ? false : statusFilter === 'paid' ? true : null,
        is_forecast: forecastFilter === 'effective' ? false : forecastFilter === 'forecast' ? true : null,
        search: searchTerm.trim() || undefined,
      })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `transacoes_${currentMonth || 'geral'}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      console.error('Erro na exportação:', err)
      alert(err.message || 'Erro ao exportar planilha Excel')
    } finally {
      setIsExporting(false)
    }
  }

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    // Owner filter
    if (selectedOwnerId !== null && tx.owner_id !== selectedOwnerId) {
      return false
    }
    // Status filter
    if (statusFilter === 'pending' && tx.is_paid) return false
    if (statusFilter === 'paid' && !tx.is_paid) return false

    // Forecast filter
    if (forecastFilter === 'effective' && tx.is_forecast) return false
    if (forecastFilter === 'forecast' && !tx.is_forecast) return false

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const descMatch = tx.description.toLowerCase().includes(term)
      const commentMatch = (tx.comment || '').toLowerCase().includes(term)
      const owner = ownersMap.get(tx.owner_id)?.name.toLowerCase() || ''
      const ownerMatch = owner.includes(term)
      return descMatch || commentMatch || ownerMatch
    }
    return true
  })

  const getOwnerBadge = (ownerId: number) => {
    const owner = ownersMap.get(ownerId)
    const name = owner?.name || 'Desconhecido'
    const lower = name.toLowerCase()

    if (lower.includes('rafael')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          Rafael
        </span>
      )
    }
    if (lower.includes('mãe') || lower.includes('mae')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          Mãe
        </span>
      )
    }
    if (lower.includes('irmã') || lower.includes('irma')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          Irmã
        </span>
      )
    }
    if (lower.includes('renata') || lower.includes('tia')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          {name}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        {name}
      </span>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Transações da Fatura</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {filtered.length}
            </span>
            {(selectedOwnerId !== null || statusFilter !== 'all' || forecastFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  onSelectOwner(null)
                  setStatusFilter('all')
                  setForecastFilter('all')
                  setSearchTerm('')
                }}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900 cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Clique no status de pagamento para alternar entre quitado ou pendente
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar compra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-52 text-slate-900 dark:text-slate-100"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Owner Quick Filter Dropdown/Pills */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => onSelectOwner(null)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                selectedOwnerId === null
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Todos
            </button>
            {owners.map((owner) => (
              <button
                key={owner.id}
                onClick={() => onSelectOwner(owner.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedOwnerId === owner.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {owner.name}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              Pagos
            </button>
          </div>

          {/* Forecast Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setForecastFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                forecastFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setForecastFilter('effective')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                forecastFilter === 'effective'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              Efetivos
            </button>
            <button
              onClick={() => setForecastFilter('forecast')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                forecastFilter === 'forecast'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              Previstos
            </button>
          </div>

          {/* Export XLS / Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ml-auto sm:ml-0"
            title="Exportar lançamentos filtrados para planilha Excel (.xls / .xlsx)"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            )}
            <span>{isExporting ? 'Gerando...' : 'Exportar .XLS'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100/80 dark:bg-slate-800">
            <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <th className="py-3 px-4">Data</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4">Responsável</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4 text-center">Parcelas</th>
              <th className="py-3 px-4 text-right">Valor</th>
              <th className="py-3 px-4 text-center">Status Quitação</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">Nenhuma transação encontrada</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {searchTerm || selectedOwnerId || statusFilter !== 'all'
                        ? 'Tente ajustar os filtros acima.'
                        : 'Cadastre despesas manuais ou suba uma fatura em PDF.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const isToggling = isUpdatingId === tx.id
                const category = categoriesMap.get(tx.type_id)?.description || 'Outros'

                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                      tx.is_paid ? 'bg-white dark:bg-slate-900' : 'bg-rose-50/20 dark:bg-rose-950/20'
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(tx.dt_lcto)}
                      </div>
                      {tx.invoice_month && tx.dt_lcto && tx.dt_lcto.slice(0, 7) !== tx.invoice_month && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            title={`Compra realizada em ${formatDate(tx.dt_lcto)}, cobrada na fatura de ${formatInvoiceBadge(tx.invoice_month)}`}
                          >
                            {formatInvoiceBadge(tx.invoice_month)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{tx.description}</span>
                        {tx.is_forecast && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            title="Gasto previsto / estimado (pode ser ajustado quando a conta fechar)"
                          >
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Previsto
                          </span>
                        )}
                        {tx.comment && tx.comment.includes('Rateio') && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            title="Despesa dividida entre mais de uma pessoa"
                          >
                            <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            Rateado
                          </span>
                        )}
                      </div>
                      {tx.comment && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{tx.comment}</div>
                      )}
                    </td>

                    {/* Owner Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">{getOwnerBadge(tx.owner_id)}</td>

                    {/* Category */}
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {category}
                      </span>
                    </td>

                    {/* Installments */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.total_parcs > 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {tx.cur_parcs}/{tx.total_parcs}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">À vista</span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                      {tx.entry_type === 'income' ? (
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                            + {formatCurrency(tx.value)}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Receita
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-900 dark:text-slate-100">
                          {formatCurrency(tx.value)}
                        </span>
                      )}
                    </td>

                    {/* Status Button (Toggle Paid or Define Real for Forecasts) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.is_forecast && !tx.is_paid ? (
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          title="Gasto previsto: clique para lançar o valor real da fatura e torná-lo efetivo"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-xs bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Definir Real</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onTogglePaid(tx.id)}
                          disabled={isToggling}
                          title="Clique para alternar status de pagamento"
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                            tx.is_paid
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800'
                          } disabled:opacity-50 active:scale-95`}
                        >
                          {tx.is_paid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Pago</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          title="Editar lançamento"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Excluir lançamento"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
