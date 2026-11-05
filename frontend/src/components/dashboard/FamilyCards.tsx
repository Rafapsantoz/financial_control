import React from 'react'
import { CheckCircle2, Clock, Heart, Sparkles, User, AlertCircle } from 'lucide-react'
import { OwnerSummary } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface FamilyCardsProps {
  ownersSummary: OwnerSummary[]
  selectedOwnerId: number | null
  onSelectOwner: (ownerId: number | null) => void
}

export const FamilyCards: React.FC<FamilyCardsProps> = ({
  ownersSummary,
  selectedOwnerId,
  onSelectOwner,
}) => {
  const getOwnerConfig = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes('rafael')) {
      return {
        color: 'from-blue-600 to-indigo-600',
        lightBg: 'bg-blue-50 border-blue-200 text-blue-700',
        badgeBg: 'bg-blue-100 text-blue-800',
        progressBar: 'bg-blue-600',
        icon: User,
        role: 'Titular do Cartão',
      }
    }
    if (lower.includes('mãe') || lower.includes('mae')) {
      return {
        color: 'from-rose-500 to-pink-600',
        lightBg: 'bg-rose-50 border-rose-200 text-rose-700',
        badgeBg: 'bg-rose-100 text-rose-800',
        progressBar: 'bg-rose-500',
        icon: Heart,
        role: 'Adicional / Dependente',
      }
    }
    if (lower.includes('irmã') || lower.includes('irma')) {
      return {
        color: 'from-purple-600 to-violet-600',
        lightBg: 'bg-purple-50 border-purple-200 text-purple-700',
        badgeBg: 'bg-purple-100 text-purple-800',
        progressBar: 'bg-purple-600',
        icon: Sparkles,
        role: 'Adicional / Dependente',
      }
    }
    return {
      color: 'from-slate-600 to-gray-700',
      lightBg: 'bg-slate-50 border-slate-200 text-slate-700',
      badgeBg: 'bg-slate-100 text-slate-800',
      progressBar: 'bg-slate-600',
      icon: User,
      role: 'Membro Familiar',
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pago':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Quitado
          </span>
        )
      case 'Parcial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Parcial
          </span>
        )
      case 'Pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
            <AlertCircle className="w-3.5 h-3.5" />
            Pendente
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Sem despesas
          </span>
        )
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {ownersSummary.map((owner) => {
        const config = getOwnerConfig(owner.owner_name)
        const Icon = config.icon
        const isSelected = selectedOwnerId === owner.owner_id
        const percentPaid =
          owner.total_amount > 0 ? Math.round((owner.paid_amount / owner.total_amount) * 100) : 100

        return (
          <div
            key={owner.owner_id}
            onClick={() => onSelectOwner(isSelected ? null : owner.owner_id)}
            className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs transition-all cursor-pointer relative overflow-hidden ${
              isSelected
                ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md scale-[1.01]'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
            }`}
          >
            {/* Top decorative gradient bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${config.color} absolute top-0 left-0`} />

            {/* Header: Name, Avatar, Status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${config.color} flex items-center justify-center text-white shadow-xs`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{owner.owner_name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{config.role}</p>
                </div>
              </div>
              <div>{getStatusBadge(owner.status)}</div>
            </div>

            {/* Total Due */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total na Fatura
              </p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatCurrency(owner.total_amount)}
              </p>
            </div>

            {/* Details: Paid vs Pending */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/40 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-900">
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Já Quitado</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(owner.paid_amount)}
                </p>
              </div>
              <div className="bg-rose-50/60 dark:bg-rose-950/40 rounded-lg p-2.5 border border-rose-100 dark:border-rose-900">
                <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Pendente</p>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                  {formatCurrency(owner.pending_amount)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span>Progresso de Quitação</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{percentPaid}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.progressBar} transition-all duration-500`}
                  style={{ width: `${percentPaid}%` }}
                />
              </div>
            </div>

            {/* Footer with count */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>{owner.transactions_count} lançamentos</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                {isSelected ? 'Limpar filtro' : 'Ver despesas →'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
