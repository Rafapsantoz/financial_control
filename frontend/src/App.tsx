import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Monitor, Smartphone, Trash2, X } from 'lucide-react'
import { Header } from './components/layout/Header'
import { FamilyCards } from './components/dashboard/FamilyCards'
import { SettlePaymentModal } from './components/dashboard/SettlePaymentModal'
import { InvoiceOverview } from './components/dashboard/InvoiceOverview'
import { TransactionTable } from './components/transactions/TransactionTable'
import { AddTransactionModal } from './components/transactions/AddTransactionModal'
import { EditTransactionModal } from './components/transactions/EditTransactionModal'
import { InvoiceUploaderModal } from './components/invoice-uploader/InvoiceUploaderModal'
import { AdminPanel } from './components/admin/AdminPanel'
import { MacroProjectionGrid } from './components/planning/MacroProjectionGrid'
import { BudgetAnalysisTab } from './components/planning/BudgetAnalysisTab'
import { ConfirmDeleteModal } from './components/common/ConfirmDeleteModal'
import { MobileCompanion } from './components/mobile/MobileCompanion'
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
import { Card, Category, DashboardSummaryResponse, Owner, OwnerSummary, Transaction } from './types'

export function App() {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    return localStorage.getItem('fo_current_month') || '2026-11'
  })
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [forecastFilter, setForecastFilter] = useState<'all' | 'effective' | 'forecast'>('all')
  const [currentView, setCurrentView] = useState<'dashboard' | 'macro' | 'budget' | 'admin'>('dashboard')

  // Mobile Viewport & Companion Management
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false
  })

  // Explicit user preference for mobile vs desktop mode
  const [activeViewMode, setActiveViewMode] = useState<'desktop' | 'mobile'>(() => {
    const saved = localStorage.getItem('fo_view_mode')
    if (saved === 'desktop' || saved === 'mobile') return saved
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'
  })

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      setIsMobileViewport(isMobile)
      const explicit = localStorage.getItem('fo_view_mode')
      if (!explicit) {
        setActiveViewMode(isMobile ? 'mobile' : 'desktop')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSetViewMode = (mode: 'desktop' | 'mobile') => {
    setActiveViewMode(mode)
    localStorage.setItem('fo_view_mode', mode)
  }

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
  const [settlingOwner, setSettlingOwner] = useState<OwnerSummary | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [pastedFilesForModal, setPastedFilesForModal] = useState<File[]>([])
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

  // Global Ctrl + V screenshot listener across dashboard
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isInput) return

      const pasted: File[] = []
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          pasted.push(e.clipboardData.files[i])
        }
      }

      if (pasted.length === 0 && e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i]
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile()
            if (blob) {
              const ext = blob.type.split('/')[1] || 'png'
              const now = new Date()
              const timeStr = `${now.getHours()}h${now.getMinutes()}m${now.getSeconds()}s`
              const file = new File([blob], `print_${timeStr}_${i + 1}.${ext}`, { type: blob.type })
              pasted.push(file)
            }
          }
        }
      }

      if (pasted.length > 0) {
        e.preventDefault()
        setPastedFilesForModal(pasted)
        setIsUploadModalOpen(true)
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
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

  // Render Mobile Companion View when mobile mode is selected or default on small screens
  if (activeViewMode === 'mobile') {
    return (
      <div className="min-h-screen bg-slate-900/95 sm:bg-slate-900/90 flex flex-col items-center justify-start selection:bg-emerald-500 selection:text-white">
        {/* Simulation bar for Desktop displays */}
        <div className="w-full bg-slate-900 border-b border-slate-800 text-slate-300 px-4 py-2 flex items-center justify-between text-xs sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-100">📱 Visualização Mobile de Bolso</span>
            <span className="text-slate-400 hidden sm:inline">(Otimizado para Smartphones)</span>
          </div>
          <button
            onClick={() => handleSetViewMode('desktop')}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg border border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Retornar para o painel completo de desktop"
          >
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Voltar ao Modo Desktop</span>
          </button>
        </div>

        {/* Centralized Mobile Companion Wrapper */}
        <div className="w-full sm:max-w-md bg-white dark:bg-slate-950 sm:shadow-2xl sm:border-x sm:border-slate-200 sm:dark:border-slate-800 min-h-screen flex flex-col">
          <MobileCompanion
            currentMonth={currentMonth}
            onMonthChange={(m) => setCurrentMonth(m)}
            summary={summary}
            transactions={transactions}
            owners={owners}
            cards={cards}
            categories={categories}
            onTogglePaid={handleTogglePaid}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={(tx) => setEditingTransaction(tx)}
            onAddTransaction={handleAddTransaction}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onRefresh={() => loadMonthData(currentMonth)}
            isLoading={isLoading}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSwitchToDesktop={() => handleSetViewMode('desktop')}
          />
        </div>

        {/* Global Modals for Mobile Companion */}
        <EditTransactionModal
          isOpen={!!editingTransaction}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveEditedTransaction}
          onSuccessRefresh={() => loadMonthData(currentMonth)}
          owners={owners}
          cards={cards}
          categories={categories}
        />

        <InvoiceUploaderModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false)
            setPastedFilesForModal([])
          }}
          onSuccess={handleInvoiceUploadSuccess}
          owners={owners}
          cards={cards}
          categories={categories}
          currentMonth={currentMonth}
          initialFiles={pastedFilesForModal}
        />

        <ConfirmDeleteModal
          isOpen={Boolean(txToDelete)}
          title="Excluir Transação da Fatura?"
          subtitle="Esta ação removerá este lançamento do rateio familiar e recalculará os totais."
          warningText="O valor será subtraído da fatura deste mês."
          confirmButtonText="Sim, Excluir Transação"
          isDeleting={isDeletingTx}
          onClose={() => setTxToDelete(null)}
          onConfirm={handleConfirmDeleteTransaction}
        >
          {txToDelete && (
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
            </div>
          )}
        </ConfirmDeleteModal>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Banner de Retorno ao Modo Mobile (quando forçado pelo usuário em tela pequena) */}
      {isMobileViewport && (
        <div className="bg-indigo-600 text-white text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 sticky top-0 z-50">
          <span>Modo Desktop Ativo</span>
          <button
            onClick={() => handleSetViewMode('mobile')}
            className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
          >
            Voltar para Modo Bolso Mobile 📱
          </button>
        </div>
      )}

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
        onToggleMobileMode={() => handleSetViewMode('mobile')}
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
                {(selectedOwnerId !== null || statusFilter !== 'all' || forecastFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedOwnerId(null)
                      setStatusFilter('all')
                      setForecastFilter('all')
                    }}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    Limpar todos os filtros ✕
                  </button>
                )}
              </div>

              <FamilyCards
                ownersSummary={summary?.owners_summary || []}
                selectedOwnerId={selectedOwnerId}
                onSelectOwner={setSelectedOwnerId}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                forecastFilter={forecastFilter}
                onForecastFilterChange={setForecastFilter}
                onOpenSettleModal={(o) => setSettlingOwner(o)}
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
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                forecastFilter={forecastFilter}
                onForecastFilterChange={setForecastFilter}
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
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                forecastFilter={forecastFilter}
                onForecastFilterChange={setForecastFilter}
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
        onSuccessRefresh={() => loadMonthData(currentMonth)}
        owners={owners}
        cards={cards}
        categories={categories}
      />

      <SettlePaymentModal
        isOpen={!!settlingOwner}
        ownerSummary={settlingOwner}
        month={currentMonth}
        transactions={transactions}
        onClose={() => setSettlingOwner(null)}
        onSuccess={() => {
          loadMonthData(currentMonth)
          setSuccessBanner('Quitação processada com sucesso!')
          setTimeout(() => setSuccessBanner(null), 4000)
        }}
      />

      <InvoiceUploaderModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false)
          setPastedFilesForModal([])
        }}
        onSuccess={handleInvoiceUploadSuccess}
        owners={owners}
        cards={cards}
        categories={categories}
        currentMonth={currentMonth}
        initialFiles={pastedFilesForModal}
      />

      {/* MODAL 5: CONFIRM DELETE TRANSACTION */}
      <ConfirmDeleteModal
        isOpen={Boolean(txToDelete)}
        title="Excluir Transação da Fatura?"
        subtitle="Esta ação removerá este lançamento do rateio familiar e recalculará os totais."
        warningText="O valor será subtraído da fatura deste mês."
        confirmButtonText="Sim, Excluir Transação"
        isDeleting={isDeletingTx}
        onClose={() => setTxToDelete(null)}
        onConfirm={handleConfirmDeleteTransaction}
      >
        {txToDelete && (
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
        )}
      </ConfirmDeleteModal>
    </div>
  )
}
