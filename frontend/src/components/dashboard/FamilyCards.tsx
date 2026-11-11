import React from 'react'
import {
  CheckCircle2,
  Clock,
  Heart,
  Sparkles,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import { OwnerSummary } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface FamilyCardsProps {
  ownersSummary: OwnerSummary[]
  selectedOwnerId: number | null
  onSelectOwner: (ownerId: number | null) => void
  onOpenSettleModal?: (owner: OwnerSummary) => void
}

export const FamilyCards: React.FC<FamilyCardsProps> = ({
  ownersSummary,
  selectedOwnerId,
  onSelectOwner,
  onOpenSettleModal,
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
    if (lower.includes('renata') || lower.includes('tia')) {
      return {
        color: 'from-amber-500 to-orange-600',
        lightBg: 'bg-amber-50 border-amber-200 text-amber-700',
        badgeBg: 'bg-amber-100 text-amber-800',
        progressBar: 'bg-amber-500',
        icon: User,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Quitado
          </span>
        )
      case 'Parcial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            Parcial
          </span>
        )
      case 'Pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
            <AlertCircle className="w-3 h-3" />
            Pendente
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Sem despesas
          </span>
        )
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectOwner(isSelected ? null : owner.owner_id)
              }
            }}
            className={`bg-white dark:bg-slate-900 rounded-xl border shadow-xs transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              isSelected
                ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md bg-emerald-50/10 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            {/* Top decorative gradient bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${config.color} absolute top-0 left-0`} />

            {/* COMPACT CARD CONTENT */}
            <div className="p-4 pt-4.5">
              {/* Header: Avatar, Name, Role, Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg bg-gradient-to-tr ${config.color} flex items-center justify-center text-white shadow-xs shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {owner.owner_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{config.role}</p>
                  </div>
                </div>
                <div className="shrink-0">{getStatusBadge(owner.status)}</div>
              </div>

              {/* Total Row */}
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block leading-tight">
                    Total na Fatura
                  </span>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {formatCurrency(owner.total_amount)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {owner.transactions_count} {owner.transactions_count === 1 ? 'lançamento' : 'lançamentos'}
                  </span>
                  <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Forecast indicator if member has estimated expenses */}
              {owner.forecast_amount && owner.forecast_amount > 0 ? (
                <div className="mt-2.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between font-medium">
                  <span>Efetivo: {formatCurrency(owner.effective_amount || 0)}</span>
                  <span className="font-bold">Previsto: {formatCurrency(owner.forecast_amount)}</span>
                </div>
              ) : null}
            </div>

            {/* EXPANDABLE DETAILS DRAWER (Visible when clicked / selected) */}
            {isSelected && (
              <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850/60 animate-in fade-in duration-200 space-y-3">
                {/* Details: Paid vs Pending */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/50 rounded-lg p-2 border border-emerald-200/60 dark:border-emerald-900/60">
                    <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">Já Quitado</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {formatCurrency(owner.paid_amount)}
                    </p>
                  </div>
                  <div className="bg-rose-50/80 dark:bg-rose-950/50 rounded-lg p-2 border border-rose-200/60 dark:border-rose-900/60">
                    <p className="text-[10px] font-semibold text-rose-800 dark:text-rose-300">Pendente</p>
                    <p className="text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                      {formatCurrency(owner.pending_amount)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Progresso de Quitação</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{percentPaid}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.progressBar} transition-all duration-500`}
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                {/* Batch Settle Action Button */}
                {owner.pending_amount > 0 && onOpenSettleModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenSettleModal(owner)
                    }}
                    className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xs shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>⚡ Quitar / Abater Valor em Lote</span>
                  </button>
                )}

                {/* Filter indicator & action */}
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Filter className="w-3 h-3" />
                    Filtrando tabela abaixo
                  </span>
                  <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium underline">
                    Fechar detalhes ✕
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
