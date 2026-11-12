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
  statusFilter?: 'all' | 'pending' | 'paid'
  onStatusFilterChange?: (status: 'all' | 'pending' | 'paid') => void
  forecastFilter?: 'all' | 'effective' | 'forecast'
  onForecastFilterChange?: (forecast: 'all' | 'effective' | 'forecast') => void
  onOpenSettleModal?: (owner: OwnerSummary) => void
}

export const FamilyCards: React.FC<FamilyCardsProps> = ({
  ownersSummary,
  selectedOwnerId,
  onSelectOwner,
  statusFilter = 'all',
  onStatusFilterChange,
  forecastFilter = 'all',
  onForecastFilterChange,
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
              {/* Forecast indicator if member has estimated expenses */}
              {owner.forecast_amount && owner.forecast_amount > 0 ? (
                <div className="mt-2.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-md border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between font-medium">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOwner(owner.owner_id)
                      onForecastFilterChange?.(
                        isSelected && forecastFilter === 'effective' ? 'all' : 'effective'
                      )
                    }}
                    title="Filtrar apenas gastos efetivos (confirmados)"
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                      isSelected && forecastFilter === 'effective'
                        ? 'bg-amber-200 dark:bg-amber-900 font-extrabold ring-1 ring-amber-400'
                        : 'hover:bg-amber-100/80 dark:hover:bg-amber-900/50'
                    }`}
                  >
                    Efetivo: {formatCurrency(owner.effective_amount || 0)}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOwner(owner.owner_id)
                      onForecastFilterChange?.(
                        isSelected && forecastFilter === 'forecast' ? 'all' : 'forecast'
                      )
                    }}
                    title="Filtrar apenas gastos previstos / estimativas deste membro"
                    className={`px-1.5 py-0.5 rounded transition-all font-bold cursor-pointer ${
                      isSelected && forecastFilter === 'forecast'
                        ? 'bg-amber-300 text-amber-950 dark:bg-amber-800 dark:text-amber-100 font-extrabold ring-1 ring-amber-500'
                        : 'hover:bg-amber-100/80 dark:hover:bg-amber-900/50'
                    }`}
                  >
                    Previsto: {formatCurrency(owner.forecast_amount)}
                  </button>
                </div>
              ) : null}
            </div>

            {/* EXPANDABLE DETAILS DRAWER (Visible when clicked / selected) */}
            {isSelected && (
              <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850/60 animate-in fade-in duration-200 space-y-3">
                {/* Details: Paid vs Pending - Clickable interactive filters */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Green Box: Já Quitado */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOwner(owner.owner_id)
                      onStatusFilterChange?.(statusFilter === 'paid' ? 'all' : 'paid')
                    }}
                    title="Clique para filtrar apenas o que já foi quitado na tabela abaixo"
                    className={`rounded-lg p-2.5 border text-left transition-all duration-150 cursor-pointer ${
                      statusFilter === 'paid'
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/60 scale-[1.02]'
                        : 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-[10px] font-bold ${
                        statusFilter === 'paid' ? 'text-white' : 'text-emerald-800 dark:text-emerald-300'
                      }`}>
                        Já Quitado
                      </p>
                      {statusFilter === 'paid' && (
                        <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-extrabold text-white">
                          Ativo ✓
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-extrabold mt-0.5 ${
                      statusFilter === 'paid' ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {formatCurrency(owner.paid_amount)}
                    </p>
                  </button>

                  {/* Red Box: Pendente */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOwner(owner.owner_id)
                      onStatusFilterChange?.(statusFilter === 'pending' ? 'all' : 'pending')
                    }}
                    title="Clique para filtrar apenas tudo o que você / este membro deve (pendente) na tabela"
                    className={`rounded-lg p-2.5 border text-left transition-all duration-150 cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-rose-600 border-rose-700 text-white shadow-sm ring-2 ring-rose-400/60 scale-[1.02]'
                        : 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-100/80 dark:hover:bg-rose-950/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-[10px] font-bold ${
                        statusFilter === 'pending' ? 'text-white' : 'text-rose-800 dark:text-rose-300'
                      }`}>
                        Pendente
                      </p>
                      {statusFilter === 'pending' && (
                        <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-extrabold text-white">
                          Ativo ✓
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-extrabold mt-0.5 ${
                      statusFilter === 'pending' ? 'text-white' : 'text-rose-700 dark:text-rose-400'
                    }`}>
                      {formatCurrency(owner.pending_amount)}
                    </p>
                  </button>
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
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Filter className="w-3 h-3 text-emerald-500" />
                    {statusFilter === 'pending' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        Filtrando: Apenas Pendentes (o que deve)
                      </span>
                    ) : statusFilter === 'paid' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Filtrando: Apenas Quitados
                      </span>
                    ) : forecastFilter === 'forecast' ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        Filtrando: Apenas Previstos
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Filtrando tabela abaixo
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOwner(null)
                      onStatusFilterChange?.('all')
                      onForecastFilterChange?.('all')
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium underline cursor-pointer"
                  >
                    Fechar detalhes ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
