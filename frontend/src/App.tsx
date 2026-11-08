import React, { useEffect, useState } from 'react'
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
  const [currentMonth, setCurrentMonth] = useState('2026-11')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [currentView, setCurrentView] = useState<'dashboard' | 'macro' | 'budget' | 'admin'>('dashboard')

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
  const loadMonthData = async () => {
    try {
      setIsLoading(true)
      setErrorBanner(null)
      const [sumData, txData] = await Promise.all([
        fetchSummary(currentMonth),
        fetchTransactions(currentMonth),
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
    loadMonthData()
  }, [currentMonth])

  // Toggle transaction paid status
  const handleTogglePaid = async (id: number) => {
    try {
      setIsUpdatingId(id)
      await togglePaid(id)
      await loadMonthData()
    } catch (err: any) {
      alert(`Erro ao atualizar pagamento: ${err.message}`)
    } finally {
      setIsUpdatingId(null)
    }
  }

  // Delete transaction
  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return
    try {
      await deleteTransaction(id)
      await loadMonthData()
    } catch (err: any) {
      alert(`Erro ao excluir transação: ${err.message}`)
    }
  }

  // Add manual transaction
  const handleAddTransaction = async (data: Partial<Transaction>) => {
    await createTransaction(data)
    await loadMonthData()
  }

  // Edit/update transaction
  const handleSaveEditedTransaction = async (id: number, data: Partial<Transaction>) => {
    await updateTransaction(id, data)
    await loadMonthData()
  }

  // Combined refresh when admin actions occur
  const handleRefreshFromAdmin = async () => {
    await loadMasters()
    await loadMonthData()
  }

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
              onClick={loadMonthData}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
            >
              Tentar novamente
            </button>
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
                    Divisão individual dos gastos entre Rafael, Mãe e Irmã (RN03)
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
                totalPaid={summary?.total_paid || 0}
                totalPending={summary?.total_pending || 0}
                categoriesSummary={summary?.category_summary || []}
                cardName={cards[0]?.card_name || 'Nubank Principal'}
              />
            </section>

            {/* 3. Detailed Transactions Table */}
            <section>
              <TransactionTable
                transactions={transactions}
                owners={owners}
                cards={cards}
                categories={categories}
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
          RPsec Financeiro • Backend FastAPI + SQLite • Inteligência Artificial Google Gemini 2.5
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
        onSuccess={loadMonthData}
        owners={owners}
        cards={cards}
        categories={categories}
      />
    </div>
  )
}
