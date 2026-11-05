import React, { useState } from 'react'
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
} from 'lucide-react'
import { Card, Category, Owner } from '../../types'
import {
  createCard,
  createCategory,
  createOwner,
  deleteCard,
  deleteCategory,
  deleteOwner,
  updateCard,
  updateCategory,
  updateOwner,
} from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/formatters'

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
  const [activeTab, setActiveTab] = useState<'owners' | 'cards' | 'categories'>('owners')

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
  const [cardPaymentDate, setCardPaymentDate] = useState('')
  const [cardLimit, setCardLimit] = useState('')

  // Category Form State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryDesc, setCategoryDesc] = useState('')

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

  const handleDeleteOwner = async (owner: Owner) => {
    if (!window.confirm(`Deseja realmente remover o responsável "${owner.name}"?`)) return
    try {
      setLoadingAction(true)
      clearFeedback()
      await deleteOwner(owner.id)
      setSuccessMsg(`Proprietário "${owner.name}" removido com sucesso.`)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível excluir o proprietário.')
    } finally {
      setLoadingAction(false)
    }
  }

  // --- CARDS HANDLERS ---
  const handleOpenCardModal = (card?: Card) => {
    clearFeedback()
    if (card) {
      setEditingCard(card)
      setCardName(card.card_name)
      setCardPaymentDate(card.payment_date ? card.payment_date.split('T')[0] : '')
      setCardLimit(card.total_limit !== undefined && card.total_limit !== null ? String(card.total_limit) : '')
    } else {
      setEditingCard(null)
      setCardName('')
      setCardPaymentDate('')
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

    try {
      setLoadingAction(true)
      clearFeedback()
      const limitVal = cardLimit ? parseFloat(cardLimit) : 0
      const dateVal = cardPaymentDate ? `${cardPaymentDate}T00:00:00Z` : null

      if (editingCard) {
        await updateCard(editingCard.id, {
          card_name: cardName.trim(),
          payment_date: dateVal,
          total_limit: limitVal,
        })
        setSuccessMsg(`Cartão "${cardName}" atualizado com sucesso!`)
      } else {
        await createCard({
          card_name: cardName.trim(),
          payment_date: dateVal,
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

  const handleDeleteCard = async (card: Card) => {
    if (!window.confirm(`Deseja realmente remover o cartão "${card.card_name}"?`)) return
    try {
      setLoadingAction(true)
      clearFeedback()
      await deleteCard(card.id)
      setSuccessMsg(`Cartão "${card.card_name}" removido com sucesso.`)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível excluir o cartão.')
    } finally {
      setLoadingAction(false)
    }
  }

  // --- CATEGORIES HANDLERS ---
  const handleOpenCategoryModal = (cat?: Category) => {
    clearFeedback()
    if (cat) {
      setEditingCategory(cat)
      setCategoryDesc(cat.description)
    } else {
      setEditingCategory(null)
      setCategoryDesc('')
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
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          description: categoryDesc.trim(),
        })
        setSuccessMsg(`Categoria "${categoryDesc}" atualizada com sucesso!`)
      } else {
        await createCategory({
          description: categoryDesc.trim(),
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

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Deseja realmente remover a categoria "${cat.description}"?`)) return
    try {
      setLoadingAction(true)
      clearFeedback()
      await deleteCategory(cat.id)
      setSuccessMsg(`Categoria "${cat.description}" removida com sucesso.`)
      await onRefreshMasters()
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível excluir a categoria.')
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
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => {
            setActiveTab('owners')
            clearFeedback()
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
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
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'categories'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categorias & Tipos ({categories.length})</span>
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
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
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
                        onClick={() => handleDeleteOwner(owner)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
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
                      {card.payment_date ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          Vencimento: {formatDate(card.payment_date)}
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
                        onClick={() => handleDeleteCard(card)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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

      {/* TAB 3: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Tipos de Dívidas e Categorias
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Categorias utilizadas para classificação das compras e desdobramento proporcional no dashboard.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Descrição da Categoria</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {categories.map((cat) => (
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
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenCategoryModal(cat)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar categoria"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Remover categoria"
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
                  Data de Vencimento / Fechamento
                </label>
                <input
                  type="date"
                  value={cardPaymentDate}
                  onChange={(e) => setCardPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
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
                  {loadingAction ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
