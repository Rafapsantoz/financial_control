import React, { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'
import { FamilyCards } from './components/dashboard/FamilyCards'
import { InvoiceOverview } from './components/dashboard/InvoiceOverview'
import { TransactionTable } from './components/transactions/TransactionTable'
import { AddTransactionModal } from './components/transactions/AddTransactionModal'
import { InvoiceUploaderModal } from './components/invoice-uploader/InvoiceUploaderModal'
import {
  createTransaction,
  deleteTransaction,
  fetchCards,
  fetchCategories,
  fetchOwners,
  fetchSummary,
  fetchTransactions,
  togglePaid,
} from './lib/api'
import { Card, Category, DashboardSummaryResponse, Owner, Transaction } from './types'

export function App() {
  const [currentMonth, setCurrentMonth] = useState('2026-11')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingId, setIsUpdatingId] = useState<number | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Initial load of master records (owners, cards, categories)
  useEffect(() => {
    async function loadMasters() {
      try {
        const [o, c, cat] = await Promise.all([fetchOwners(), fetchCards(), fetchCategories()])
        setOwners(o)
        setCards(c)
        setCategories(cat)
      } catch (err) {
        console.error('Erro ao carregar dados base:', err)
      }
    }
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
      // Refresh to keep strict totals synchronized
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        currentMonth={currentMonth}
        onMonthChange={(m) => setCurrentMonth(m)}
        onRefresh={loadMonthData}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        isLoading={isLoading}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {errorBanner && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
            <span>{errorBanner}</span>
            <button
              onClick={loadMonthData}
              className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* 1. Family Rateio Cards (Rafael, Mãe, Irmã) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Rateio Familiar da Fatura
              </h2>
              <p className="text-xs text-slate-500">
                Divisão individual dos gastos entre Rafael, Mãe e Irmã (RN03)
              </p>
            </div>
            {selectedOwnerId !== null && (
              <button
                onClick={() => setSelectedOwnerId(null)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
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
            isUpdatingId={isUpdatingId}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          Financial Organizer • Backend FastAPI + SQLite • Inteligência Artificial Google Gemini 2.5
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
