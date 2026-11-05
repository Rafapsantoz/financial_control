import React from 'react'
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  PieChart,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { CategorySummary } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface InvoiceOverviewProps {
  totalAmount: number
  totalPaid: number
  totalPending: number
  categoriesSummary: CategorySummary[]
  cardName?: string
}

export const InvoiceOverview: React.FC<InvoiceOverviewProps> = ({
  totalAmount,
  totalPaid,
  totalPending,
  categoriesSummary,
  cardName = 'Nubank Principal',
}) => {
  const percentPaid = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0

  const getCategoryColor = (name: string, index: number) => {
    const palette = [
      'bg-emerald-500',
      'bg-indigo-500',
      'bg-rose-500',
      'bg-amber-500',
      'bg-purple-500',
      'bg-teal-500',
      'bg-blue-500',
      'bg-slate-500',
    ]
    return palette[index % palette.length]
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Total Consolidation Banner */}
      <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Fechamento Consolidado
                </p>
                <h4 className="text-sm font-medium text-slate-200">{cardName}</h4>
              </div>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {percentPaid}% Quitado
              </span>
            </div>
          </div>

          <div className="my-3">
            <p className="text-xs text-slate-400 font-medium">Valor Total da Fatura</p>
            <p className="text-4xl font-extrabold tracking-tight text-white mt-0.5">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        <div>
          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden my-3">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
              style={{ width: `${percentPaid}%` }}
            />
          </div>

          {/* Subtotals */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700/60 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">Total Quitado</p>
                <p className="font-bold text-emerald-300">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div>
                <p className="text-xs text-slate-400">Total Pendente</p>
                <p className="font-bold text-rose-300">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Gastos por Categoria</h3>
            </div>
            <span className="text-xs text-slate-400">{categoriesSummary.length} categorias</span>
          </div>

          {categoriesSummary.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma despesa registrada neste mês.
            </div>
          ) : (
            <div className="space-y-3">
              {categoriesSummary.slice(0, 5).map((cat, idx) => (
                <div key={cat.category_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[140px]">
                      {cat.category_name}
                    </span>
                    <span className="text-slate-500 font-semibold">
                      {formatCurrency(cat.total_amount)}{' '}
                      <span className="text-slate-400 font-normal">({cat.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getCategoryColor(cat.category_name, idx)}`}
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {categoriesSummary.length > 5 && (
          <p className="text-[11px] text-slate-400 text-right mt-2">
            + {categoriesSummary.length - 5} outras categorias
          </p>
        )}
      </div>
    </div>
  )
}
