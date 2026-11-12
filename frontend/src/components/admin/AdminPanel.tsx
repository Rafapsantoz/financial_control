import React, { useEffect, useState } from 'react'
import {
  CreditCard,
  Edit2,
  Phone,
  PlusCircle,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Check,
  AlertTriangle,
  Calendar,
  FileCheck2,
  ShieldCheck,
  RefreshCw,
  Landmark,
  PiggyBank,
  DollarSign,
  Calculator,
  TrendingUp,
  Percent,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  BankAccount,
  BankAccountBalanceItem,
  BankAccountsSummary,
  Card,
  Category,
  InvoiceUpload,
  Owner,
} from '../../types'
import {
  createBankAccount,
  createCard,
  createCategory,
  createOwner,
  deleteBankAccount,
  deleteCard,
  deleteCategory,
  deleteInvoiceUpload,
  deleteOwner,
  fetchBankAccountsSummary,
  fetchInvoiceUploads,
  updateBankAccount,
  updateBankAccountBalances,
  updateCard,
  updateCategory,
  updateOwner,
} from '../../lib/api'
import { formatCurrency, formatDate, formatMonthName } from '../../lib/formatters'
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal'

interface AdminPanelProps {
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  onRefreshMasters: () => Promise<void>
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  owners,
  cards,
  categories,
  onRefreshMasters,
}) => {
  const [activeTab, setActiveTab] = useState<'owners' | 'cards' | 'categories' | 'bank_accounts' | 'uploads'>('owners')
  const [invoiceUploads, setInvoiceUploads] = useState<InvoiceUpload[]>([])
  const [loadingUploads, setLoadingUploads] = useState(false)

  // Unified Delete Modals State
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null)

  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null)
  const [isDeletingOwner, setIsDeletingOwner] = useState(false)
  const [deleteOwnerError, setDeleteOwnerError] = useState<string | null>(null)

  const [cardToDelete, setCardToDelete] = useState<Card | null>(null)
  const [isDeletingCard, setIsDeletingCard] = useState(false)
  const [deleteCardError, setDeleteCardError] = useState<string | null>(null)

  const [bankToDelete, setBankToDelete] = useState<BankAccount | null>(null)
  const [isDeletingBank, setIsDeletingBank] = useState(false)
  const [deleteBankError, setDeleteBankError] = useState<string | null>(null)

  const [uploadToDelete, setUploadToDelete] = useState<InvoiceUpload | null>(null)
  const [deleteTransactionsWithUpload, setDeleteTransactionsWithUpload] = useState<boolean>(true)
  const [isDeletingUpload, setIsDeletingUpload] = useState<boolean>(false)
  const [deleteUploadError, setDeleteUploadError] = useState<string | null>(null)

  // Bank Accounts & CDI Yield State
  const [bankSummary, setBankSummary] = useState<BankAccountsSummary | null>(null)
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false)
  const [isBankModalOpen, setIsBankModalOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [bankName, setBankName] = useState('')
  const [bankAccountType, setBankAccountType] = useState('Conta Pagamento / CDI')
  const [bankCdiRate, setBankCdiRate] = useState('100')
  const [bankCdiMonthlyRate, setBankCdiMonthlyRate] = useState('0.85')
  const [bankNotes, setBankNotes] = useState('')

  // Member Balances Distribution Modal State
  const [isBalancesModalOpen, setIsBalancesModalOpen] = useState(false)
  const [managingBankForBalances, setManagingBankForBalances] = useState<BankAccount | null>(null)
  const [balancesMap, setBalancesMap] = useState<Record<number, string>>({})

  const loadUploadsHistory = async () => {
    try {
      setLoadingUploads(true)
      const data = await fetchInvoiceUploads()
      setInvoiceUploads(data)
    } catch (err: any) {
      console.error('Erro ao buscar histórico de uploads:', err)
    } finally {
      setLoadingUploads(false)
    }
  }

  const handleConfirmDeleteUpload = async () => {
    if (!uploadToDelete) return
    try {
      setIsDeletingUpload(true)
      setDeleteUploadError(null)
      clearFeedback()
      const res = await deleteInvoiceUpload(uploadToDelete.id, deleteTransactionsWithUpload)
      setSuccessMsg(
        `${res.detail} (${res.deleted_transactions_count} transação(ões) correspondente(s) removida(s) no mês ${uploadToDelete.target_month})`
      )
      setUploadToDelete(null)
      await loadUploadsHistory()
      await onRefreshMasters()
    } catch (err: any) {
      setDeleteUploadError(err.message || 'Erro ao excluir registro de fatura.')
    } finally {
      setIsDeletingUpload(false)
    }
  }

  const loadBankSummary = async () => {
    try {
      setLoadingBankAccounts(true)
      const data = await fetchBankAccountsSummary()
      setBankSummary(data)
    } catch (err: any) {
      console.error('Erro ao buscar resumo de contas bancárias:', err)
    } finally {
      setLoadingBankAccounts(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'uploads') {
      loadUploadsHistory()
    } else if (activeTab === 'bank_accounts') {
      loadBankSummary()
    }
  }, [activeTab])

  // Owner Form State
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [ownerCategory, setOwnerCategory] = useState('Familiar')
  const [ownerPhone, setOwnerPhone] = useState('')

  // Card Form State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardDueDay, setCardDueDay] = useState('')
  const [cardLimit, setCardLimit] = useState('')

  // Category Form State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryDesc, setCategoryDesc] = useState('')
  const [categoryFixedCost, setCategoryFixedCost] = useState('')

  const [loadingAction, setLoadingAction] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const clearFeedback = () => {
    setErrorMsg('')
    setSuccessMsg('')
  }

  // --- OWNERS HANDLERS ---
  const handleOpenOwnerModal = (owner?: Owner) => {
    clearFeedback()
    if (owner) {
      setEditingOwner(owner)
      setOwnerName(owner.name)
      setOwnerCategory(owner.category || 'Familiar')
      setOwnerPhone(owner.phone_number || '')
    } else {
      setEditingOwner(null)
      setOwnerName('')
      setOwnerCategory('Familiar')
      setOwnerPhone('')
    }
    setIsOwnerModalOpen(true)
  }

  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerName.trim()) {
      setErrorMsg('Nome do responsável é obrigatório.')
      return
    }

    try {
      setLoadingAction(true)
      clearFeedback()
      if (editingOwner) {
        await updateOwner(editingOwner.id, {
          name: ownerName.trim(),
          category: ownerCategory.trim(),
          phone_number: ownerPhone.trim() || undefined,
        })
        setSuccessMsg(`Proprietário "${ownerName}" atualizado com sucesso!`)
      } else {
        await createOwner({
          name: ownerName.trim(),
          category: ownerCategory.trim(),
          phone_number: ownerPhone.trim() || undefined,
        })
        setSuccessMsg(`Novo responsável "${ownerName}" cadastrado com sucesso!`)
      }
      setIsOwnerModalOpen(false)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar proprietário.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirmDeleteOwner = async () => {
    if (!ownerToDelete) return
    try {
      setIsDeletingOwner(true)
      setDeleteOwnerError(null)
      clearFeedback()
      await deleteOwner(ownerToDelete.id)
      setSuccessMsg(`Participante "${ownerToDelete.name}" removido com sucesso.`)
      setOwnerToDelete(null)
      await onRefreshMasters()
    } catch (err: any) {
      setDeleteOwnerError(err.message || 'Não foi possível excluir o participante.')
    } finally {
      setIsDeletingOwner(false)
    }
  }

  // --- CARDS HANDLERS ---
  const handleOpenCardModal = (card?: Card) => {
    clearFeedback()
    if (card) {
      setEditingCard(card)
      setCardName(card.card_name)
      setCardDueDay(
        card.due_day !== undefined && card.due_day !== null
          ? String(card.due_day)
          : card.payment_date
          ? String(new Date(card.payment_date).getUTCDate())
          : ''
      )
      setCardLimit(card.total_limit !== undefined && card.total_limit !== null ? String(card.total_limit) : '')
    } else {
      setEditingCard(null)
      setCardName('')
      setCardDueDay('')
      setCardLimit('')
    }
    setIsCardModalOpen(true)
  }

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardName.trim()) {
      setErrorMsg('Nome do cartão é obrigatório.')
      return
    }

    const dueDayNum = cardDueDay ? parseInt(cardDueDay, 10) : null
    if (dueDayNum !== null && (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      setErrorMsg('O dia de vencimento deve estar entre 1 e 31.')
      return
    }

    try {
      setLoadingAction(true)
      clearFeedback()
      const limitVal = cardLimit ? parseFloat(cardLimit) : 0

      if (editingCard) {
        await updateCard(editingCard.id, {
          card_name: cardName.trim(),
          due_day: dueDayNum,
          total_limit: limitVal,
        })
        setSuccessMsg(`Cartão "${cardName}" atualizado com sucesso!`)
      } else {
        await createCard({
          card_name: cardName.trim(),
          due_day: dueDayNum,
          total_limit: limitVal,
        })
        setSuccessMsg(`Cartão "${cardName}" cadastrado com sucesso!`)
      }
      setIsCardModalOpen(false)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar cartão.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirmDeleteCard = async () => {
    if (!cardToDelete) return
    try {
      setIsDeletingCard(true)
      setDeleteCardError(null)
      clearFeedback()
      await deleteCard(cardToDelete.id)
      setSuccessMsg(`Cartão "${cardToDelete.card_name}" removido com sucesso.`)
      setCardToDelete(null)
      await onRefreshMasters()
    } catch (err: any) {
      setDeleteCardError(err.message || 'Não foi possível excluir o cartão.')
    } finally {
      setIsDeletingCard(false)
    }
  }

  // --- CATEGORIES HANDLERS ---
  const handleOpenCategoryModal = (cat?: Category) => {
    clearFeedback()
    if (cat) {
      setEditingCategory(cat)
      setCategoryDesc(cat.description)
      setCategoryFixedCost(
        cat.fixed_cost !== undefined && cat.fixed_cost !== null ? String(cat.fixed_cost) : ''
      )
    } else {
      setEditingCategory(null)
      setCategoryDesc('')
      setCategoryFixedCost('')
    }
    setIsCategoryModalOpen(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryDesc.trim()) {
      setErrorMsg('Descrição da categoria é obrigatória.')
      return
    }

    try {
      setLoadingAction(true)
      clearFeedback()
      const fixedCostVal = categoryFixedCost ? parseFloat(categoryFixedCost.replace(',', '.')) : 0.0

      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          description: categoryDesc.trim(),
          fixed_cost: isNaN(fixedCostVal) ? 0.0 : fixedCostVal,
        })
        setSuccessMsg(`Categoria "${categoryDesc}" atualizada com sucesso!`)
      } else {
        await createCategory({
          description: categoryDesc.trim(),
          fixed_cost: isNaN(fixedCostVal) ? 0.0 : fixedCostVal,
        })
        setSuccessMsg(`Categoria "${categoryDesc}" criada com sucesso!`)
      }
      setIsCategoryModalOpen(false)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar categoria.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return
    try {
      setIsDeletingCategory(true)
      setDeleteCategoryError(null)
      clearFeedback()
      await deleteCategory(categoryToDelete.id)
      setSuccessMsg(`Categoria "${categoryToDelete.description}" removida com sucesso.`)
      setCategoryToDelete(null)
      await onRefreshMasters()
    } catch (err: any) {
      setDeleteCategoryError(err.message || 'Não foi possível excluir a categoria.')
    } finally {
      setIsDeletingCategory(false)
    }
  }

  // --- BANK ACCOUNTS & CDI YIELD HANDLERS ---
  const handleOpenBankModal = (bank?: BankAccount) => {
    clearFeedback()
    if (bank) {
      setEditingBank(bank)
      setBankName(bank.name)
      setBankAccountType(bank.account_type || 'Conta Pagamento / CDI')
      setBankCdiRate(String(bank.cdi_rate ?? 100))
      setBankCdiMonthlyRate(String(bank.cdi_monthly_rate ?? 0.85))
      setBankNotes(bank.notes || '')
    } else {
      setEditingBank(null)
      setBankName('')
      setBankAccountType('Conta Pagamento / CDI')
      setBankCdiRate('100')
      setBankCdiMonthlyRate('0.85')
      setBankNotes('')
    }
    setIsBankModalOpen(true)
  }

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim()) {
      setErrorMsg('Nome da conta bancária é obrigatório.')
      return
    }

    try {
      setLoadingAction(true)
      clearFeedback()
      const cdiRateNum = parseFloat(bankCdiRate.replace(',', '.')) || 100.0
      const cdiMonthlyNum = parseFloat(bankCdiMonthlyRate.replace(',', '.')) || 0.85

      if (editingBank) {
        await updateBankAccount(editingBank.id, {
          name: bankName.trim(),
          account_type: bankAccountType.trim(),
          cdi_rate: cdiRateNum,
          cdi_monthly_rate: cdiMonthlyNum,
          notes: bankNotes.trim() || undefined,
        })
        setSuccessMsg(`Conta bancária "${bankName}" atualizada com sucesso!`)
      } else {
        await createBankAccount({
          name: bankName.trim(),
          account_type: bankAccountType.trim(),
          cdi_rate: cdiRateNum,
          cdi_monthly_rate: cdiMonthlyNum,
          notes: bankNotes.trim() || undefined,
        })
        setSuccessMsg(`Conta bancária "${bankName}" cadastrada com sucesso!`)
      }
      setIsBankModalOpen(false)
      await loadBankSummary()
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar conta bancária.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirmDeleteBankAccount = async () => {
    if (!bankToDelete) return
    try {
      setIsDeletingBank(true)
      setDeleteBankError(null)
      clearFeedback()
      await deleteBankAccount(bankToDelete.id)
      setSuccessMsg(`Conta bancária "${bankToDelete.name}" removida com sucesso.`)
      setBankToDelete(null)
      await loadBankSummary()
      await onRefreshMasters()
    } catch (err: any) {
      setDeleteBankError(err.message || 'Não foi possível excluir a conta bancária.')
    } finally {
      setIsDeletingBank(false)
    }
  }

  // --- BALANCES DISTRIBUTION HANDLERS ---
  const handleOpenBalancesModal = (bank: BankAccount) => {
    clearFeedback()
    setManagingBankForBalances(bank)
    const map: Record<number, string> = {}
    owners.forEach((o) => {
      const existing = bank.balances.find((b) => b.owner_id === o.id)
      map[o.id] = existing ? String(existing.balance) : '0'
    })
    setBalancesMap(map)
    setIsBalancesModalOpen(true)
  }

  const handleSaveBalances = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!managingBankForBalances) return

    try {
      setLoadingAction(true)
      clearFeedback()
      const payload: BankAccountBalanceItem[] = []
      owners.forEach((o) => {
        const raw = balancesMap[o.id] || '0'
        const val = parseFloat(raw.replace(',', '.'))
        if (!isNaN(val) && val > 0) {
          payload.push({
            owner_id: o.id,
            owner_name: o.name,
            balance: val,
          })
        }
      })

      await updateBankAccountBalances(managingBankForBalances.id, payload)
      setSuccessMsg(`Saldos por membro da conta "${managingBankForBalances.name}" atualizados com sucesso!`)
      setIsBalancesModalOpen(false)
      await loadBankSummary()
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar saldos da conta.')
    } finally {
      setLoadingAction(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Admin Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Painel de Administração
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie participantes familiares, cartões de crédito e tipos de despesas do sistema
          </p>
        </div>

        {/* Action button corresponding to active tab */}
        <div>
          {activeTab === 'owners' && (
            <button
              onClick={() => handleOpenOwnerModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Responsável</span>
            </button>
          )}
          {activeTab === 'cards' && (
            <button
              onClick={() => handleOpenCardModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Cartão</span>
            </button>
          )}
          {activeTab === 'categories' && (
            <button
              onClick={() => handleOpenCategoryModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Categoria</span>
            </button>
          )}
          {activeTab === 'bank_accounts' && (
            <button
              onClick={() => handleOpenBankModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Conta Bancária</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts inside Admin */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('owners')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'owners'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Donos das Dívidas ({owners.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cards')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'cards'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cartões de Crédito ({cards.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('categories')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categorias & Custos Fixos ({categories.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('bank_accounts')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'bank_accounts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Contas Bancárias & CDI ({bankSummary?.accounts.length || 0})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('uploads')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'uploads'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Faturas Importadas & Duplicidades ({invoiceUploads.length})</span>
        </button>
      </div>

      {/* TAB 1: OWNERS */}
      {activeTab === 'owners' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Participantes Familiares e Donos de Dívida
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pessoas que dividem os cartões de crédito. Cada participante possui rateio e status individual.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Tipo / Vínculo</th>
                  <th className="py-3 px-4">Telefone / WhatsApp</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {owners.map((owner) => (
                  <tr
                    key={owner.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">#{owner.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                        {owner.name.charAt(0)}
                      </div>
                      <span>{owner.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        {owner.category || 'Familiar'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">
                      {owner.phone_number ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {owner.phone_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Não informado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenOwnerModal(owner)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar participante"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setOwnerToDelete(owner)
                          setDeleteOwnerError(null)
                        }}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remover participante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CARDS */}
      {activeTab === 'cards' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Cartões de Crédito Cadastrados
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cartões cujas faturas são divididas entre os membros familiares.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Nome do Cartão</th>
                  <th className="py-3 px-4">Data / Dia de Vencimento</th>
                  <th className="py-3 px-4 text-right">Limite Total (R$)</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {cards.map((card) => (
                  <tr
                    key={card.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">#{card.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span>{card.card_name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                      {card.due_day ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          Todo dia {card.due_day}
                        </span>
                      ) : card.payment_date ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          Dia {new Date(card.payment_date).getUTCDate()}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Vencimento flexível</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {card.total_limit ? formatCurrency(card.total_limit) : 'R$ 0,00'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenCardModal(card)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar cartão"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setCardToDelete(card)
                          setDeleteCardError(null)
                        }}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remover cartão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES & FIXED COSTS */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Somatória de Custos Fixos em Destaque */}
          {(() => {
            const totalFixed = categories.reduce((sum, c) => sum + (c.fixed_cost || 0), 0)
            const countWithFixed = categories.filter((c) => (c.fixed_cost || 0) > 0).length
            return (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900/90 via-slate-900 to-indigo-950 border border-teal-500/30 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-teal-200 uppercase tracking-wider block">
                      Somatória de Custos Fixos Cadastrados
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      {formatCurrency(totalFixed)}
                      <span className="text-sm font-semibold text-teal-300/80 ml-1.5">/ mês</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-teal-100/80 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10">
                  <div>
                    <span className="font-bold text-white block">{countWithFixed} de {categories.length}</span>
                    <span>Categorias com custo fixo</span>
                  </div>
                  <div className="h-6 w-px bg-white/20" />
                  <div>
                    <span className="font-bold text-white block">
                      {countWithFixed > 0 ? formatCurrency(totalFixed / countWithFixed) : 'R$ 0,00'}
                    </span>
                    <span>Média por categoria</span>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                Tipos de Despesas & Custos Fixos por Categoria
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre a previsão orçamentária fixa de cada categoria para alimentar automaticamente a queima mensal e a macro projeção.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-16">ID</th>
                    <th className="py-3 px-4">Descrição da Categoria</th>
                    <th className="py-3 px-4 text-right">Custo Fixo Mensal (R$)</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {categories.map((cat) => {
                    const fixedVal = cat.fixed_cost || 0
                    return (
                      <tr
                        key={cat.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-xs font-mono text-slate-400">#{cat.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                            <Tag className="w-3.5 h-3.5" />
                          </div>
                          <span>{cat.description}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {fixedVal > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              {formatCurrency(fixedVal)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-normal">
                              R$ 0,00
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenCategoryModal(cat)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar categoria e custo fixo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setCategoryToDelete(cat)
                              setDeleteCategoryError(null)
                            }}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Remover categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BANK ACCOUNTS & CDI YIELD */}
      {activeTab === 'bank_accounts' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* 1. Global Financial Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Saldo Total em Contas */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Saldo Total em Conta (Tot)</span>
                <PiggyBank className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(bankSummary?.grand_total_balance || 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Soma de todos os saldos</p>
            </div>

            {/* Saldo de Outros / Família */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Total de Outros</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                {formatCurrency(bankSummary?.grand_total_others || 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Mãe, Irmã e dependentes</p>
            </div>

            {/* Saldo Próprio do Rafael */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Saldo Próprio (Rafael)</span>
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(bankSummary?.grand_total_owner || 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Tot - Total de Outros</p>
            </div>

            {/* Rendimento CDI Mensal Estimado */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-500/30 shadow-xs">
              <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
                <span>Rendimento CDI (Mês)</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(bankSummary?.grand_total_monthly_yield || 0)}
              </div>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                Tot × %CDI (fica para Rafael)
              </p>
            </div>

            {/* Patrimônio Rafael com Rendimento */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white border border-indigo-700/50 shadow-md">
              <div className="flex items-center justify-between text-xs text-indigo-200 mb-1">
                <span className="font-semibold">Rafael Líquido Final</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-black text-emerald-300">
                {formatCurrency(bankSummary?.grand_total_net_with_yield || 0)}
              </div>
              <p className="text-[10px] text-indigo-300/80 mt-0.5">
                Tot × Rendimento - Outros
              </p>
            </div>
          </div>

          {/* 2. Banner Didático da Fórmula */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <p className="font-bold text-sm">
                Fórmula de Rateio do Rendimento CDI Aplicada:
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                <code className="bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded font-mono font-bold text-indigo-700 dark:text-indigo-300">
                  Rafael Disponível = (Tot × Rendimento CDI) + Saldo Próprio Rafael
                </code>
                {' '}— Como o rendimento incide sobre todo o montante depositado na conta (inclusive a cota da sua mãe), esse ganho fica integralmente com você, enquanto o capital nominal dela permanece protegido para quando ela solicitar.
              </p>
            </div>
          </div>

          {/* 3. Listagem das Contas Bancárias */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  <span>Contas Bancárias & Titularidade dos Saldos</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cadastre cada conta separadamente, informe quanto ela rende do CDI e defina a quem pertence cada parte do saldo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadBankSummary}
                  disabled={loadingBankAccounts}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  title="Atualizar saldos e rendimentos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBankAccounts ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
                <button
                  onClick={() => handleOpenBankModal()}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Nova Conta Bancária</span>
                </button>
              </div>
            </div>

            {/* Listagem de contas */}
            {!bankSummary || bankSummary.accounts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Landmark className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhuma conta bancária cadastrada ainda.</p>
                <p className="mt-1">Clique em "Nova Conta Bancária" para adicionar contas como Nubank, PicPay ou Inter e simular o rendimento do CDI.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {bankSummary.accounts.map((acc) => (
                  <div key={acc.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Lado Esquerdo: Identificação da Conta */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                                {acc.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                {acc.account_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Percent className="w-3 h-3" />
                                {acc.cdi_rate}% do CDI (~{acc.cdi_monthly_rate}% a.m.)
                              </span>
                              <span>•</span>
                              <span>Rendimento Mensal Estimado: <b className="text-emerald-600 dark:text-emerald-400 font-mono">+{formatCurrency(acc.monthly_yield)}</b></span>
                            </div>
                          </div>
                        </div>

                        {acc.notes && (
                          <p className="text-xs text-slate-400 italic pl-11">
                            {acc.notes}
                          </p>
                        )}
                      </div>

                      {/* Lado Direito: Métricas Financeiras e Botões */}
                      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                        {/* Tot Saldo */}
                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-slate-400 block">Saldo Total (Tot)</span>
                          <span className="font-extrabold text-base text-slate-900 dark:text-slate-100 font-mono">
                            {formatCurrency(acc.total_balance)}
                          </span>
                        </div>

                        {/* Saldo Outros */}
                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-purple-500 block">Total de Outros</span>
                          <span className="font-bold text-sm text-purple-600 dark:text-purple-400 font-mono">
                            {formatCurrency(acc.others_balance)}
                          </span>
                        </div>

                        {/* Rafael Líquido */}
                        <div className="text-left lg:text-right bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block uppercase tracking-wider">
                            Rafael c/ Rendimento
                          </span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatCurrency(acc.net_with_yield)}
                          </span>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenBalancesModal(acc)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer transition-colors"
                            title="Distribuir saldo por membro (Rafael, Mãe, etc.)"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Dividir Saldo</span>
                          </button>
                          <button
                            onClick={() => handleOpenBankModal(acc)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar conta bancária"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setBankToDelete(acc)
                              setDeleteBankError(null)
                            }}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Excluir conta bancária"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento dos Membros que possuem saldo nesta conta */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">Distribuição do Saldo:</span>
                      {acc.balances.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Nenhum saldo rateado ainda. Clique em "Dividir Saldo".</span>
                      ) : (
                        acc.balances.map((b) => {
                          const isRaf = (b.owner_name || '').toLowerCase().includes('rafael')
                          return (
                            <span
                              key={b.owner_id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                isRaf
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              }`}
                            >
                              <span className="font-bold">{b.owner_name}:</span>
                              <span className="font-mono font-bold">{formatCurrency(b.balance)}</span>
                              {isRaf && <span className="text-[10px] text-blue-500 font-bold">(+ rendimento)</span>}
                            </span>
                          )
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INVOICE UPLOADS & DUPLICATE PROTECTION */}
      {activeTab === 'uploads' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  Histórico de Faturas Importadas & Blindagem contra Duplicidades
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cada fatura importada gera uma assinatura SHA-256 única para impedir que a mesma fatura seja enviada mais de uma vez.
              </p>
            </div>
            <button
              onClick={loadUploadsHistory}
              disabled={loadingUploads}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              title="Atualizar lista de uploads"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUploads ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {invoiceUploads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nenhuma fatura em PDF foi registrada ainda. As faturas confirmadas via IA aparecerão aqui com hash SHA-256 de proteção.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12">ID</th>
                    <th className="py-3 px-4">Arquivo PDF / Imagem</th>
                    <th className="py-3 px-4">Emissor / Cartão</th>
                    <th className="py-3 px-4">Mês Competência</th>
                    <th className="py-3 px-4 text-center">Compras</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4">Data do Upload</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoiceUploads.map((up) => {
                    const card = cards.find((c) => c.id === up.card_id)
                    return (
                      <tr
                        key={up.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{up.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-[220px]" title={up.filename}>
                              {up.filename}
                            </span>
                          </div>
                          <span
                            className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-[220px]"
                            title={`Hash SHA-256: ${up.file_hash}`}
                          >
                            Hash: {up.file_hash.slice(0, 16)}...
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {card?.card_name || up.bank_or_issuer || 'Cartão Padrão'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {formatMonthName(up.target_month)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {up.items_count}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400 text-sm font-mono">
                          {formatCurrency(up.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {formatDate(up.uploaded_at)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            Protegida
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setUploadToDelete(up)
                              setDeleteTransactionsWithUpload(true)
                              setDeleteUploadError(null)
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Excluir fatura para permitir reimportação limpa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: OWNER FORM */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editingOwner ? 'Editar Participante' : 'Novo Participante / Dono'}
              </h3>
              <button
                onClick={() => setIsOwnerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOwner} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Participante *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rafael, Mãe, Irmã, Tio, etc."
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vínculo / Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Familiar, Pessoal, Amigo"
                  value={ownerCategory}
                  onChange={(e) => setOwnerCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOwnerModalOpen(false)}
                  disabled={loadingAction}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Participante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CARD FORM */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editingCard ? 'Editar Cartão' : 'Novo Cartão de Crédito'}
              </h3>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCard} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Cartão / Emissor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank Mastercard, Inter Black, Itaú Click"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dia de Vencimento
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 10 (todo dia 10)"
                  value={cardDueDay}
                  onChange={(e) => setCardDueDay(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Dia do mês em que a fatura vence (1 a 31). O dia se repete todos os meses.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Limite Total de Crédito (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  disabled={loadingAction}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CATEGORY FORM */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria de Despesa'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercado, Farmácia, Assinaturas, Combustível"
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Custo Fixo Mensal Estimado (R$)</span>
                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-normal">Opcional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00 (Ex: 1200.00)"
                  value={categoryFixedCost}
                  onChange={(e) => setCategoryFixedCost(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100 font-mono"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Gasto fixo recorrente esperado para esta categoria. Alimenta a queima mensal e o Runway de sobrevivência.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={loadingAction}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BANK ACCOUNT FORM */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {editingBank ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                </h3>
              </div>
              <button
                onClick={() => setIsBankModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBankAccount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Conta / Instituição *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank Reserva, PicPay Pagamentos, Inter CDI"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Conta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Conta Pagamento / CDI, Conta Corrente, Investimento"
                  value={bankAccountType}
                  onChange={(e) => setBankAccountType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    % do CDI
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="100"
                      value={bankCdiRate}
                      onChange={(e) => setBankCdiRate(e.target.value)}
                      className="w-full px-3.5 py-2 pr-7 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100 font-mono"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Ex: 100% ou 105%</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rendimento Mensal (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.85"
                      value={bankCdiMonthlyRate}
                      onChange={(e) => setBankCdiMonthlyRate(e.target.value)}
                      className="w-full px-3.5 py-2 pr-7 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100 font-mono"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Taxa mensal manual</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Finalidade (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Conta de liquidez diária onde guardo dinheiro pessoal e da minha mãe."
                  value={bankNotes}
                  onChange={(e) => setBankNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  disabled={loadingAction}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: BALANCES DISTRIBUTION BY MEMBER */}
      {isBalancesModalOpen && managingBankForBalances && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Distribuir Saldos — {managingBankForBalances.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Defina quanto do saldo desta conta pertence a cada membro da família.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBalancesModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBalances} className="p-5 space-y-4">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {owners.map((owner) => {
                  const isRaf = owner.name.toLowerCase().includes('rafael')
                  const currentVal = balancesMap[owner.id] || ''
                  return (
                    <div
                      key={owner.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isRaf
                          ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isRaf
                              ? 'bg-blue-600 text-white'
                              : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          {owner.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">
                            {owner.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isRaf ? 'Titular da Conta (Recebe o Rendimento)' : 'Familiar / Dependente'}
                          </span>
                        </div>
                      </div>

                      <div className="relative w-36 shrink-0">
                        <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={currentVal}
                          onChange={(e) => {
                            const val = e.target.value
                            setBalancesMap((prev) => ({ ...prev, [owner.id]: val }))
                          }}
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-slate-100 font-mono font-bold text-right"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preview dinâmico dos cálculos */}
              {(() => {
                let simulatedTot = 0
                let simulatedOthers = 0
                let simulatedOwner = 0

                owners.forEach((o) => {
                  const val = parseFloat((balancesMap[o.id] || '0').replace(',', '.')) || 0
                  simulatedTot += val
                  if (o.name.toLowerCase().includes('rafael')) {
                    simulatedOwner += val
                  } else {
                    simulatedOthers += val
                  }
                })

                const rate = (managingBankForBalances.cdi_monthly_rate || 0.85) / 100.0
                const simulatedYield = simulatedTot * rate
                const simulatedNet = simulatedOwner + simulatedYield

                return (
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs space-y-2 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Saldo Total Digitado:</span>
                      <b className="font-mono text-white text-sm">{formatCurrency(simulatedTot)}</b>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Saldo Pertencente aos Outros (Mãe/Família):</span>
                      <b className="font-mono text-purple-300">{formatCurrency(simulatedOthers)}</b>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Rendimento CDI ({managingBankForBalances.cdi_monthly_rate}% a.m. fica para Rafael):</span>
                      <b className="font-mono text-emerald-400">+{formatCurrency(simulatedYield)}/mês</b>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-emerald-300 font-bold">
                      <span>Rafael Líquido com Rendimento:</span>
                      <span className="font-mono text-sm">{formatCurrency(simulatedNet)}</span>
                    </div>
                  </div>
                )
              })()}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBalancesModalOpen(false)}
                  disabled={loadingAction}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loadingAction ? 'Salvando...' : 'Salvar Divisão de Saldos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIFIED DELETE MODAL: CATEGORY */}
      <ConfirmDeleteModal
        isOpen={Boolean(categoryToDelete)}
        title="Excluir Categoria?"
        subtitle="Esta ação removerá a categoria do catálogo de lançamentos e orçamentos."
        warningText="Se houver transações vinculadas a esta categoria, a exclusão será impedida pelo banco de dados para proteger seu histórico."
        confirmButtonText="Sim, Excluir Categoria"
        isDeleting={isDeletingCategory}
        errorMsg={deleteCategoryError}
        onClose={() => {
          setCategoryToDelete(null)
          setDeleteCategoryError(null)
        }}
        onConfirm={handleConfirmDeleteCategory}
      >
        {categoryToDelete && (
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                {categoryToDelete.description}
              </h4>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  (categoryToDelete.fixed_cost || 0) > 0
                    ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {(categoryToDelete.fixed_cost || 0) > 0 ? 'Custo Fixo Recorrente' : 'Despesa Variável'}
              </span>
            </div>
            {(categoryToDelete.fixed_cost || 0) > 0 ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>Custo Fixo Mensal:</span>
                <b className="text-indigo-700 dark:text-indigo-300 font-mono text-sm">
                  {formatCurrency(categoryToDelete.fixed_cost || 0)} / mês
                </b>
              </div>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                Nenhum valor fixo recorrente vinculado.
              </div>
            )}
          </div>
        )}
      </ConfirmDeleteModal>

      {/* UNIFIED DELETE MODAL: OWNER */}
      <ConfirmDeleteModal
        isOpen={Boolean(ownerToDelete)}
        title="Excluir Participante / Dono?"
        subtitle="Esta ação removerá o participante do rateio familiar e das despesas."
        warningText="Se existirem transações vinculadas a este participante, a exclusão será bloqueada para manter a integridade dos saldos."
        confirmButtonText="Sim, Excluir Participante"
        isDeleting={isDeletingOwner}
        errorMsg={deleteOwnerError}
        onClose={() => {
          setOwnerToDelete(null)
          setDeleteOwnerError(null)
        }}
        onConfirm={handleConfirmDeleteOwner}
      >
        {ownerToDelete && (
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                {ownerToDelete.name}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {ownerToDelete.category || 'Familiar'}
              </span>
            </div>
            {ownerToDelete.phone_number ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>Telefone / WhatsApp:</span>
                <b className="text-slate-700 dark:text-slate-300">{ownerToDelete.phone_number}</b>
              </div>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                Sem telefone cadastrado.
              </div>
            )}
          </div>
        )}
      </ConfirmDeleteModal>

      {/* UNIFIED DELETE MODAL: CARD */}
      <ConfirmDeleteModal
        isOpen={Boolean(cardToDelete)}
        title="Excluir Cartão de Crédito?"
        subtitle="Esta ação removerá o cartão e seus parâmetros de faturamento do sistema."
        warningText="Se houver compras ou faturas registradas neste cartão, a exclusão será bloqueada pelo banco de dados."
        confirmButtonText="Sim, Excluir Cartão"
        isDeleting={isDeletingCard}
        errorMsg={deleteCardError}
        onClose={() => {
          setCardToDelete(null)
          setDeleteCardError(null)
        }}
        onConfirm={handleConfirmDeleteCard}
      >
        {cardToDelete && (
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                {cardToDelete.card_name}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                Vencimento Dia {cardToDelete.due_day || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
              <span>Limite Total Cadastrado:</span>
              <b className="text-slate-800 dark:text-slate-200 font-mono">
                {cardToDelete.total_limit ? formatCurrency(cardToDelete.total_limit) : 'R$ 0,00'}
              </b>
            </div>
          </div>
        )}
      </ConfirmDeleteModal>

      {/* UNIFIED DELETE MODAL: BANK ACCOUNT */}
      <ConfirmDeleteModal
        isOpen={Boolean(bankToDelete)}
        title="Excluir Conta Bancária?"
        subtitle="Esta ação removerá a conta e todos os saldos e rendimentos vinculados."
        warningText="Todos os saldos cadastrados e o cálculo de rendimentos CDI atrelados a esta conta serão removidos permanentemente."
        confirmButtonText="Sim, Excluir Conta Bancária"
        isDeleting={isDeletingBank}
        errorMsg={deleteBankError}
        onClose={() => {
          setBankToDelete(null)
          setDeleteBankError(null)
        }}
        onConfirm={handleConfirmDeleteBankAccount}
      >
        {bankToDelete && (
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                {bankToDelete.name}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {bankToDelete.cdi_rate}% CDI
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
              <span>Tipo da Conta:</span>
              <b className="text-slate-700 dark:text-slate-300">{bankToDelete.account_type || 'Conta Pagamento'}</b>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span>Saldo Total na Conta:</span>
              <b className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                {formatCurrency(bankToDelete.balances?.reduce((sum, b) => sum + b.balance, 0) || 0)}
              </b>
            </div>
          </div>
        )}
      </ConfirmDeleteModal>

      {/* UNIFIED DELETE MODAL: INVOICE UPLOAD & ALLOW RE-IMPORT */}
      <ConfirmDeleteModal
        isOpen={Boolean(uploadToDelete)}
        title="Excluir Fatura e Liberar Reimportação?"
        subtitle="Esta ação removerá a blindagem de hash SHA-256 permitindo que este arquivo seja reimportado novamente."
        confirmButtonText="Sim, Excluir e Liberar"
        isDeleting={isDeletingUpload}
        errorMsg={deleteUploadError}
        onClose={() => {
          setUploadToDelete(null)
          setDeleteUploadError(null)
        }}
        onConfirm={handleConfirmDeleteUpload}
      >
        {uploadToDelete && (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[240px]">
                  {uploadToDelete.filename}
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                  {formatCurrency(uploadToDelete.total_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>Mês: <b className="text-slate-700 dark:text-slate-300">{formatMonthName(uploadToDelete.target_month)}</b></span>
                <span>Compras: <b className="text-slate-700 dark:text-slate-300">{uploadToDelete.items_count}</b></span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteTransactionsWithUpload}
                onChange={(e) => setDeleteTransactionsWithUpload(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 mt-0.5 cursor-pointer"
              />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold block">Excluir também as transações geradas no mês</span>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed block mt-0.5">
                  Recomendado: limpa os lançamentos desse cartão no mês de {formatMonthName(uploadToDelete.target_month)} para evitar títulos duplicados ao reimportar.
                </span>
              </div>
            </label>
          </div>
        )}
      </ConfirmDeleteModal>
    </div>
  )
}
