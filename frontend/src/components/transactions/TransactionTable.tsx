import React, { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Trash2,
  X,
  CreditCard,
  User,
} from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'
import { formatCurrency, formatDate } from '../../lib/formatters'

interface TransactionTableProps {
  transactions: Transaction[]
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  selectedOwnerId: number | null
  onSelectOwner: (ownerId: number | null) => void
  onTogglePaid: (id: number) => void
  onDeleteTransaction: (id: number) => void
  isUpdatingId?: number | null
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  owners,
  cards,
  categories,
  selectedOwnerId,
  onSelectOwner,
  onTogglePaid,
  onDeleteTransaction,
  isUpdatingId,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')

  const ownersMap = new Map(owners.map((o) => [o.id, o]))
  const cardsMap = new Map(cards.map((c) => [c.id, c]))
  const categoriesMap = new Map(categories.map((cat) => [cat.id, cat]))

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    // Owner filter
    if (selectedOwnerId !== null && tx.owner_id !== selectedOwnerId) {
      return false
    }
    // Status filter
    if (statusFilter === 'pending' && tx.is_paid) return false
    if (statusFilter === 'paid' && !tx.is_paid) return false

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
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Rafael
        </span>
      )
    }
    if (lower.includes('mãe') || lower.includes('mae')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Mãe
        </span>
      )
    }
    if (lower.includes('irmã') || lower.includes('irma')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Irmã
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {name}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">Transações da Fatura</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
              {filtered.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Clique no status de pagamento para alternar entre quitado ou pendente
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar compra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-52"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Owner Quick Filter Dropdown/Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => onSelectOwner(null)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedOwnerId === null
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            {owners.map((owner) => (
              <button
                key={owner.id}
                onClick={() => onSelectOwner(owner.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedOwnerId === owner.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {owner.name}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              Pagos
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
          <tbody className="divide-y divide-slate-100 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <CreditCard className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Nenhuma transação encontrada</p>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                    className={`hover:bg-slate-50/80 transition-colors ${
                      tx.is_paid ? 'bg-white' : 'bg-rose-50/20'
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(tx.dt_lcto)}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{tx.description}</div>
                      {tx.comment && (
                        <div className="text-[11px] text-slate-400 font-normal">{tx.comment}</div>
                      )}
                    </td>

                    {/* Owner Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">{getOwnerBadge(tx.owner_id)}</td>

                    {/* Category */}
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {category}
                      </span>
                    </td>

                    {/* Installments */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.total_parcs > 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {tx.cur_parcs}/{tx.total_parcs}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">À vista</span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(tx.value)}
                    </td>

                    {/* Status Button (Toggle Paid) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => onTogglePaid(tx.id)}
                        disabled={isToggling}
                        title="Clique para alternar status de pagamento"
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-xs ${
                          tx.is_paid
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                        } disabled:opacity-50 active:scale-95`}
                      >
                        {tx.is_paid ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pago</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-rose-600" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Excluir lançamento"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
