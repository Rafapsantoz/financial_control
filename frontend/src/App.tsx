import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react'
import { Header } from './components/layout/Header'
import { FamilyCards } from './components/dashboard/FamilyCards'
import { InvoiceOverview } from './components/dashboard/InvoiceOverview'
import { TransactionTable } from './components/transactions/TransactionTable'
import { AddTransactionModal } from './components/transactions/AddTransactionModal'
import { EditTransactionModal } from './components/transactions/EditTransactionModal'
import { InvoiceUploaderModal } from './components/invoice-uploader/InvoiceUploaderModal'
import { AdminPanel } from './components/admin/AdminPanel'
import { MacroProjectionGrid } from './components/planning/MacroProjectionGrid'
import { BudgetAnalysisTab } from './components/planning/BudgetAnalysisTab'
import { formatCurrency, formatDate, formatMonthName } from './lib/formatters'
import {
  createTransaction,
  deleteTransaction,
  fetchCards,
  fetchCategories,
  fetchOwners,
  fetchSummary,
  fetchTransactions,
  togglePaid,
  updateTransaction,
} from './lib/api'
import { Card, Category, DashboardSummaryResponse, Owner, Transaction } from './types'

export function App() {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    return localStorage.getItem('fo_current_month') || '2026-11'
  })
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [currentView, setCurrentView] = useState<'dashboard' | 'macro' | 'budget' | 'admin'>('dashboard')

  useEffect(() => {
    localStorage.setItem('fo_current_month', currentMonth)
  }, [currentMonth])

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('fo_theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    localStorage.setItem('fo_theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingId, setIsUpdatingId] = useState<number | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [isDeletingTx, setIsDeletingTx] = useState(false)

  // Master records reload function (shared with Admin Panel)
  const loadMasters = async () => {
    try {
      const [o, c, cat] = await Promise.all([fetchOwners(), fetchCards(), fetchCategories()])
      setOwners(o)
      setCards(c)
      setCategories(cat)
    } catch (err) {
      console.error('Erro ao carregar dados base:', err)
    }
  }

  // Initial load
  useEffect(() => {
    loadMasters()
  }, [])

  // Load monthly summary & transactions
  const loadMonthData = async (monthToLoad: string = currentMonth) => {
    try {
      setIsLoading(true)
      setErrorBanner(null)
      const [sumData, txData] = await Promise.all([
        fetchSummary(monthToLoad),
        fetchTransactions(monthToLoad),
      ])
      setSummary(sumData)
      setTransactions(txData)
    } catch (err: any) {
      console.error('Erro ao carregar dados do mês:', err)
      setErrorBanner(err.message || 'Falha ao conectar com o backend local.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMonthData(currentMonth)
  }, [currentMonth])

  // Handle invoice upload confirmation & auto-navigate to confirmed month
  const handleInvoiceUploadSuccess = (confirmedMonth?: string) => {
    const target = confirmedMonth || currentMonth
    setSelectedOwnerId(null)
    setCurrentMonth(target)
    loadMonthData(target)
    setSuccessBanner(`Fatura de ${formatMonthName(target)} sincronizada e carregada com sucesso!`)
    setTimeout(() => setSuccessBanner(null), 5000)
  }

  // Toggle transaction paid status
  const handleTogglePaid = async (id: number) => {
    try {
      setIsUpdatingId(id)
      await togglePaid(id)
      await loadMonthData(currentMonth)
    } catch (err: any) {
      alert(`Erro ao atualizar pagamento: ${err.message}`)
    } finally {
      setIsUpdatingId(null)
    }
  }

  // Request transaction deletion (opens sleek modal)
  const handleDeleteTransaction = (id: number) => {
    const found = transactions.find((t) => t.id === id)
    if (found) {
      setTxToDelete(found)
    }
  }

  // Confirm delete transaction
  const handleConfirmDeleteTransaction = async () => {
    if (!txToDelete) return
    try {
      setIsDeletingTx(true)
      await deleteTransaction(txToDelete.id)
      setTxToDelete(null)
      await loadMonthData(currentMonth)
    } catch (err: any) {
      alert(`Erro ao excluir transação: ${err.message}`)
    } finally {
      setIsDeletingTx(false)
    }
  }

  // Add manual transaction
  const handleAddTransaction = async (data: Partial<Transaction>) => {
    await createTransaction(data)
    await loadMonthData(currentMonth)
  }

  // Edit/update transaction
  const handleSaveEditedTransaction = async (id: number, data: Partial<Transaction>) => {
    await updateTransaction(id, data)
    await loadMonthData(currentMonth)
  }

  // Combined refresh when admin actions occur
  const handleRefreshFromAdmin = async () => {
    await loadMasters()
    await loadMonthData()
  }

  // Determine active card names in the current view for dynamic title
  const activeCardIds = Array.from(new Set(transactions.map((t) => t.card_id).filter(Boolean)))
  const activeCardNames = activeCardIds
    .map((cid) => cards.find((c) => c.id === cid)?.card_name)
    .filter(Boolean) as string[]

  const displayedCardName =
    activeCardNames.length === 1
      ? activeCardNames[0]
      : activeCardNames.length > 1
      ? `Consolidado (${activeCardNames.join(', ')})`
      : cards[0]?.card_name || 'Cartão de Crédito'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation */}
      <Header
        currentMonth={currentMonth}
        onMonthChange={(m) => setCurrentMonth(m)}
        onRefresh={loadMonthData}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        isLoading={isLoading}
        currentView={currentView}
        onViewChange={setCurrentView}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {errorBanner && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between shadow-xs">
            <span>{errorBanner}</span>
            <button
              onClick={() => loadMonthData(currentMonth)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {successBanner && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
        )}

        {/* VIEW 1: DASHBOARD */}
        {currentView === 'dashboard' && (
          <>
            {/* 1. Family Rateio Cards (Rafael, Mãe, Irmã) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Rateio Familiar da Fatura
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Divisão individual dos gastos entre os membros cadastrados (RN03)
                  </p>
                </div>
                {selectedOwnerId !== null && (
                  <button
                    onClick={() => setSelectedOwnerId(null)}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    Limpar filtro do membro
                  </button>
                )}
              </div>

              <FamilyCards
                ownersSummary={summary?.owners_summary || []}
                selectedOwnerId={selectedOwnerId}
                onSelectOwner={setSelectedOwnerId}
              />
            </section>

            {/* 2. Invoice Totals & Categories Breakdown */}
            <section>
              <InvoiceOverview
                totalAmount={summary?.total_amount || 0}
                totalEffective={summary?.total_effective || 0}
                totalForecast={summary?.total_forecast || 0}
                totalConsolidated={summary?.total_consolidated || 0}
                totalPaid={summary?.total_paid || 0}
                totalPending={summary?.total_pending || 0}
                categoriesSummary={summary?.category_summary || []}
                cardName={displayedCardName}
              />
            </section>

            {/* 3. Detailed Transactions Table */}
            <section>
              <TransactionTable
                transactions={transactions}
                owners={owners}
                cards={cards}
                categories={categories}
                currentMonth={currentMonth}
                selectedOwnerId={selectedOwnerId}
                onSelectOwner={setSelectedOwnerId}
                onTogglePaid={handleTogglePaid}
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={(tx) => setEditingTransaction(tx)}
                isUpdatingId={isUpdatingId}
              />
            </section>
          </>
        )}

        {/* VIEW 2: MACRO PROJECTION & RUNWAY */}
        {currentView === 'macro' && (
          <section className="animate-in fade-in duration-200">
            <MacroProjectionGrid />
          </section>
        )}

        {/* VIEW 3: BUDGET ANALYSIS & GOALS */}
        {currentView === 'budget' && (
          <section className="animate-in fade-in duration-200">
            <BudgetAnalysisTab />
          </section>
        )}

        {/* VIEW 4: ADMINISTRATION PANEL */}
        {currentView === 'admin' && (
          <section className="animate-in fade-in duration-200">
            <AdminPanel
              owners={owners}
              cards={cards}
              categories={categories}
              onRefreshMasters={handleRefreshFromAdmin}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 mt-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 dark:text-slate-500">
          RPsec Financeiro • Backend FastAPI + SQLite • Inteligência Artificial Google Gemini 3.5 Flash
        </div>
      </footer>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddTransaction}
        owners={owners}
        cards={cards}
        categories={categories}
        currentMonth={currentMonth}
      />

      <EditTransactionModal
        isOpen={!!editingTransaction}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveEditedTransaction}
        owners={owners}
        cards={cards}
        categories={categories}
      />

      <InvoiceUploaderModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleInvoiceUploadSuccess}
        owners={owners}
        cards={cards}
        categories={categories}
        currentMonth={currentMonth}
      />

      {/* Modal Customizado de Exclusão de Transação */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 pb-4 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Excluir Transação da Fatura?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Esta ação removerá este lançamento do rateio familiar e recalculará os totais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details Preview */}
            <div className="px-6 py-3">
              <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                    {txToDelete.description}
                  </h4>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 shrink-0">
                    {formatCurrency(txToDelete.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Data: <b className="text-slate-700 dark:text-slate-300">{formatDate(txToDelete.dt_lcto)}</b></span>
                  <span>Parcela: <b className="text-slate-700 dark:text-slate-300">{txToDelete.cur_parcs}/{txToDelete.total_parcs}</b></span>
                </div>
                {txToDelete.comment && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate">
                    "{txToDelete.comment}"
                  </p>
                )}
              </div>

              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-3 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                O valor será subtraído da fatura deste mês.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                disabled={isDeletingTx}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTransaction}
                disabled={isDeletingTx}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-xs shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingTx ? 'Excluindo...' : 'Sim, Excluir Transação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
