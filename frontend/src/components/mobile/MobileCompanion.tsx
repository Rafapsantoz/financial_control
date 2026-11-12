import React, { useState, useMemo } from 'react'
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Home,
  ListOrdered,
  User,
  Sun,
  Moon,
  Search,
  Check,
  Edit2,
  Trash2,
  Share2,
  Monitor,
  RefreshCw,
  AlertCircle,
  Users,
} from 'lucide-react'
import {
  Card,
  Category,
  DashboardSummaryResponse,
  Owner,
  OwnerSummary,
  Transaction,
} from '../../types'
import { formatCurrency, formatDate, formatMonthName } from '../../lib/formatters'
import { MobileQuickAddModal } from './MobileQuickAddModal'

interface MobileCompanionProps {
  currentMonth: string
  onMonthChange: (month: string) => void
  summary: DashboardSummaryResponse | null
  transactions: Transaction[]
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  onTogglePaid: (id: number) => Promise<void>
  onDeleteTransaction: (id: number) => void
  onEditTransaction: (tx: Transaction) => void
  onAddTransaction: (data: Partial<Transaction>) => Promise<void>
  onOpenUploadModal: () => void
  onRefresh: () => void
  isLoading: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onSwitchToDesktop: () => void
}

export const MobileCompanion: React.FC<MobileCompanionProps> = ({
  currentMonth,
  onMonthChange,
  summary,
  transactions,
  owners,
  cards,
  categories,
  onTogglePaid,
  onDeleteTransaction,
  onEditTransaction,
  onAddTransaction,
  onOpenUploadModal,
  onRefresh,
  isLoading,
  theme,
  onToggleTheme,
  onSwitchToDesktop,
}) => {
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'dashboard' | 'feed' | 'profile'>('dashboard')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  // Active Member Selection (Individual companion view)
  const [activeOwnerId, setActiveOwnerId] = useState<number>(() => {
    const saved = localStorage.getItem('fo_mobile_active_owner_id')
    return saved ? Number(saved) : (owners[0]?.id || 1)
  })

  const handleSelectActiveOwner = (id: number) => {
    setActiveOwnerId(id)
    localStorage.setItem('fo_mobile_active_owner_id', String(id))
  }

  const activeOwner = useMemo(() => {
    return owners.find((o) => o.id === activeOwnerId) || owners[0] || { id: 1, name: 'Rafael' }
  }, [owners, activeOwnerId])

  // Month navigation
  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month - 1
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month + 1
    if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  // Filtered transactions for active owner
  const ownerTransactions = useMemo(() => {
    return transactions.filter((t) => t.owner_id === activeOwner.id)
  }, [transactions, activeOwner.id])

  // Individual Financial Calculations (Entradas vs Saídas & Saldo Livre)
  const myTotalIncome = useMemo(() => {
    return ownerTransactions
      .filter((t) => t.entry_type === 'income')
      .reduce((sum, t) => sum + t.value, 0)
  }, [ownerTransactions])

  const myTotalExpenses = useMemo(() => {
    return ownerTransactions
      .filter((t) => t.entry_type === 'expense' || !t.entry_type)
      .reduce((sum, t) => sum + t.value, 0)
  }, [ownerTransactions])

  const myNetBalance = myTotalIncome - myTotalExpenses

  // User Invoice Quota from Summary
  const myInvoiceSummary = useMemo(() => {
    return summary?.owners_summary.find((o) => o.owner_id === activeOwner.id) || null
  }, [summary, activeOwner.id])

  // Family Members Debts to Active User (Rateio a receber)
  const familyDebts = useMemo(() => {
    if (!summary?.owners_summary) return []
    return summary.owners_summary.filter((o) => o.owner_id !== activeOwner.id)
  }, [summary, activeOwner.id])

  // Feed Tab Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [feedStatusFilter, setFeedStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | 'expense' | 'income'>('all')

  const filteredFeedTransactions = useMemo(() => {
    return ownerTransactions.filter((tx) => {
      // Status filter
      if (feedStatusFilter === 'pending' && tx.is_paid) return false
      if (feedStatusFilter === 'paid' && !tx.is_paid) return false

      // Type filter
      if (feedTypeFilter === 'expense' && tx.entry_type === 'income') return false
      if (feedTypeFilter === 'income' && tx.entry_type !== 'income') return false

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const descMatch = tx.description.toLowerCase().includes(term)
        const cat = categories.find((c) => c.id === tx.type_id)?.description.toLowerCase() || ''
        const catMatch = cat.includes(term)
        if (!descMatch && !catMatch) return false
      }

      return true
    })
  }, [ownerTransactions, feedStatusFilter, feedTypeFilter, searchTerm, categories])

  // Group transactions by day for feed
  const groupedFeed = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {}
    const sorted = [...filteredFeedTransactions].sort(
      (a, b) => new Date(b.dt_lcto).getTime() - new Date(a.dt_lcto).getTime()
    )

    const todayStr = new Date().toISOString().split('T')[0]
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

    sorted.forEach((tx) => {
      const dateKey = tx.dt_lcto.split('T')[0]
      let displayDate = formatDate(tx.dt_lcto)
      if (dateKey === todayStr) displayDate = 'Hoje'
      else if (dateKey === yesterdayStr) displayDate = 'Ontem'

      if (!groups[displayDate]) groups[displayDate] = []
      groups[displayDate].push(tx)
    })

    return groups
  }, [filteredFeedTransactions])

  // Copy WhatsApp summary helper
  const [copiedShare, setCopiedShare] = useState(false)
  const handleCopyWhatsAppShare = () => {
    if (familyDebts.length === 0) return
    let text = `💳 *Fechamento de Fatura - ${formatMonthName(currentMonth)}*\n\n`
    familyDebts.forEach((f) => {
      text += `👤 *${f.owner_name}*:\n`
      text += `• Total da cota: ${formatCurrency(f.total_amount)}\n`
      text += `• Já quitado: ${formatCurrency(f.paid_amount)}\n`
      text += `• Pendente a pagar: *${formatCurrency(f.pending_amount)}*\n\n`
    })
    text += `Para conferir os lançamentos detalhados, acesse o painel.`
    navigator.clipboard.writeText(text)
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 1. TOP MOBILE APP BAR */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Pocket Badge */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                  RPsec
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Bolso
                </span>
              </div>
            </div>
          </div>

          {/* Seletor de Mês Compacto */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold px-1.5 min-w-[75px] text-center text-slate-800 dark:text-slate-200">
              {formatMonthName(currentMonth).split(' ')[0]}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ações Topo: Refresh & Perfil Avatar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              onClick={() => setMobileTab('profile')}
              className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer"
              title={`Perfil ativo: ${activeOwner.name}`}
            >
              {activeOwner.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        {/* Barra de Perfil Ativo com Troca Rápida */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">
            Vendo finanças de:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {owners.map((o) => (
              <button
                key={o.id}
                onClick={() => handleSelectActiveOwner(o.id)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  o.id === activeOwner.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 2. CONTEÚDO PRINCIPAL (TABS) */}
      <main className="flex-1 p-4 pb-24 max-w-lg mx-auto w-full space-y-4">
        {/* ================= TAB 1: DASHBOARD INICIAL ================= */}
        {mobileTab === 'dashboard' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* HERO CARD: SALDO LIVRE / BALANÇO INDIVIDUAL */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />

              <div className="flex items-center justify-between text-xs text-indigo-200/80 mb-1">
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  Balanço Pessoal ({activeOwner.name})
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold">
                  {formatMonthName(currentMonth)}
                </span>
              </div>

              {/* Saldo Líquido ou Total de Gastos */}
              <div className="my-2">
                {myTotalIncome > 0 ? (
                  <>
                    <span className="text-xs text-slate-400 block font-medium">
                      {myNetBalance >= 0 ? 'Saldo Livre Disponível' : 'Déficit no Mês'}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-3xl font-black font-mono tracking-tight ${
                          myNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {myNetBalance >= 0
                          ? `+ ${formatCurrency(myNetBalance)}`
                          : formatCurrency(Math.abs(myNetBalance))}
                      </span>
                      {myNetBalance < 0 && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Acima da Renda
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-indigo-200/80 block font-medium">
                      Total de Gastos no Mês
                    </span>
                    <div className="text-3xl font-black font-mono tracking-tight text-white">
                      {formatCurrency(myTotalExpenses)}
                    </div>
                  </>
                )}
              </div>

              {/* Entradas vs Saídas */}
              <div className="grid grid-cols-2 gap-2.5 pt-3 mt-3 border-t border-white/10">
                <div className="bg-white/5 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Entradas</span>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-slate-100">
                    {formatCurrency(myTotalIncome)}
                  </span>
                </div>

                <div className="bg-white/5 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold mb-0.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Saídas</span>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-slate-100">
                    {formatCurrency(myTotalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* MINHA COTA NA FATURA ATUAL (CARTÕES) */}
            {myInvoiceSummary && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Minha Cota na Fatura
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Total atribuído a você nos cartões
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    {formatCurrency(myInvoiceSummary.total_amount)}
                  </span>
                </div>

                {/* Barra de Progresso de Quitação */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          myInvoiceSummary.total_amount > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (myInvoiceSummary.paid_amount / myInvoiceSummary.total_amount) * 100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Quitado: {formatCurrency(myInvoiceSummary.paid_amount)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      Pendente: {formatCurrency(myInvoiceSummary.pending_amount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD A RECEBER DA FAMÍLIA (RATEIO PARA O TITULAR) */}
            {familyDebts.length > 0 && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Rateio Familiar a Receber
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Cotas da fatura para cobrança
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyWhatsAppShare}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-lg active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>{copiedShare ? 'Copiado!' : 'WhatsApp'}</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {familyDebts.map((m) => (
                    <div key={m.owner_id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {m.owner_name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {m.transactions_count} compras na fatura
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                          {formatCurrency(m.total_amount)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            m.pending_amount > 0 ? 'text-rose-500' : 'text-emerald-500'
                          }`}
                        >
                          {m.pending_amount > 0
                            ? `Pendente: ${formatCurrency(m.pending_amount)}`
                            : 'Quitado ✔'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AÇÕES RÁPIDAS DE BOLSO */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Gasto Rápido</span>
              </button>

              <button
                onClick={onOpenUploadModal}
                className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Foto de Fatura (IA)</span>
              </button>
            </div>

            {/* FEED RECENTE (ÚLTIMOS 5 LANÇAMENTOS DO USUÁRIO) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Últimos Gastos de {activeOwner.name}
                </h4>
                <button
                  onClick={() => setMobileTab('feed')}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Ver extrato completo ➜
                </button>
              </div>

              {ownerTransactions.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  Nenhum lançamento registrado para {activeOwner.name} neste mês.
                </div>
              ) : (
                <div className="space-y-2">
                  {ownerTransactions.slice(0, 5).map((tx) => {
                    const cat = categories.find((c) => c.id === tx.type_id)
                    const isIncome = tx.entry_type === 'income'
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              isIncome
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isIncome ? '↓' : '↑'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block">
                              {tx.description}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {formatDate(tx.dt_lcto)} • {cat?.description || 'Despesa'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-bold text-xs block ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {isIncome ? `+ ${formatCurrency(tx.value)}` : formatCurrency(tx.value)}
                          </span>
                          <button
                            onClick={() => onTogglePaid(tx.id)}
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full cursor-pointer transition-colors ${
                              tx.is_paid
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {tx.is_paid ? 'Quitado ✔' : 'Pendente ⏳'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: EXTRATO COMPLETO DO USUÁRIO ================= */}
        {mobileTab === 'feed' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Barra de Busca & Filtros Táteis */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar lançamento ou categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              {/* Filtros em Pílulas */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setFeedStatusFilter('all')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    feedStatusFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Todos ({ownerTransactions.length})
                </button>
                <button
                  onClick={() => setFeedStatusFilter('pending')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    feedStatusFilter === 'pending'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                  }`}
                >
                  Pendentes
                </button>
                <button
                  onClick={() => setFeedStatusFilter('paid')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    feedStatusFilter === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                  }`}
                >
                  Pagos
                </button>
                <button
                  onClick={() =>
                    setFeedTypeFilter((prev) =>
                      prev === 'all' ? 'income' : prev === 'income' ? 'expense' : 'all'
                    )
                  }
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Tipo: {feedTypeFilter === 'all' ? 'Todos' : feedTypeFilter === 'income' ? '🟢 Entradas' : '🔴 Saídas'}
                </button>
              </div>
            </div>

            {/* Lista Agrupada por Dia */}
            {Object.keys(groupedFeed).length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedFeed).map(([dayLabel, dayTxs]) => (
                  <div key={dayLabel} className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 px-1 uppercase tracking-wider">
                      {dayLabel}
                    </span>
                    <div className="space-y-1.5">
                      {dayTxs.map((tx) => {
                        const cat = categories.find((c) => c.id === tx.type_id)
                        const isIncome = tx.entry_type === 'income'
                        return (
                          <div
                            key={tx.id}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block">
                                {tx.description}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>{cat?.description || 'Despesa'}</span>
                                {tx.total_parcs > 1 && (
                                  <span>• Parc. {tx.cur_parcs}/{tx.total_parcs}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <span
                                  className={`font-mono font-bold text-xs block ${
                                    isIncome
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {isIncome ? `+ ${formatCurrency(tx.value)}` : formatCurrency(tx.value)}
                                </span>
                                <button
                                  onClick={() => onTogglePaid(tx.id)}
                                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full cursor-pointer transition-colors ${
                                    tx.is_paid
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                                  }`}
                                >
                                  {tx.is_paid ? 'Pago' : 'Pendente'}
                                </button>
                              </div>

                              {/* Ações: Editar e Excluir */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => onEditTransaction(tx)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteTransaction(tx.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: PERFIL & AJUSTES ================= */}
        {mobileTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Card do Usuário Ativo */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Perfil Ativo no Celular
              </h4>
              <div className="space-y-2">
                {owners.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleSelectActiveOwner(o.id)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      o.id === activeOwner.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          o.id === activeOwner.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {o.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                          {o.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {o.category || 'Membro Familiar'}
                        </span>
                      </div>
                    </div>
                    {o.id === activeOwner.id && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferências Visuais */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Aparência
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tema do Sistema
                </span>
                <button
                  onClick={onToggleTheme}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-600" />
                      <span>Escuro</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Alternar para Desktop */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 to-indigo-50 dark:from-slate-800/80 dark:to-indigo-950/40 border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-indigo-600" />
                <span>Visualização Completa (Desktop)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Precisa acessar a Matriz Anual de 12 meses, Gestão de Contas Bancárias/CDI ou o Painel de Administração familiar?
              </p>
              <button
                onClick={onSwitchToDesktop}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                Abrir Painel Familiar Completo
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. BOTTOM NAVIGATION BAR TÁTIL FIXA */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Aba Início */}
          <button
            onClick={() => setMobileTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              mobileTab === 'dashboard'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Início</span>
          </button>

          {/* Botão Central de Lançamento Flutuante */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer border-2 border-white dark:border-slate-900"
            title="Lançamento Rápido"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Aba Extrato */}
          <button
            onClick={() => setMobileTab('feed')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              mobileTab === 'feed'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-[10px]">Extrato</span>
          </button>

          {/* Aba Perfil */}
          <button
            onClick={() => setMobileTab('profile')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              mobileTab === 'profile'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Perfil</span>
          </button>
        </div>
      </nav>

      {/* MODAL DE LANÇAMENTO RÁPIDO DE BOLSO */}
      <MobileQuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={onAddTransaction}
        activeOwner={activeOwner}
        cards={cards}
        categories={categories}
        currentMonth={currentMonth}
        onOpenAiUploader={onOpenUploadModal}
      />
    </div>
  )
}
