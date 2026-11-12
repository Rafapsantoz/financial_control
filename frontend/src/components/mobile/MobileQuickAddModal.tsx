import React, { useState } from 'react'
import {
  X,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Tag,
  Calendar,
  CreditCard,
  Sparkles,
  Check,
} from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface MobileQuickAddModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: Partial<Transaction>) => Promise<void>
  activeOwner: Owner
  cards: Card[]
  categories: Category[]
  currentMonth: string
  onOpenAiUploader?: () => void
}

const COMMON_TAGS = [
  'Mercado',
  'Almoço / Lanche',
  'Combustível',
  'Farmácia',
  'Padaria',
  'Uber / Transporte',
  'Café',
  'Pix Enviado',
  'Salário / Receita',
]

export const MobileQuickAddModal: React.FC<MobileQuickAddModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  activeOwner,
  cards,
  categories,
  currentMonth,
  onOpenAiUploader,
}) => {
  if (!isOpen) return null

  const defaultDate = (() => {
    const today = new Date().toISOString().split('T')[0]
    return today.startsWith(currentMonth) ? today : `${currentMonth}-01`
  })()

  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense')
  const [valueStr, setValueStr] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1)
  const [cardId, setCardId] = useState<number | null>(cards[0]?.id || null)
  const [date, setDate] = useState(defaultDate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSelectQuickTag = (tag: string) => {
    setDescription(tag)
    // Tenta associar categoria correspondente
    const foundCat = categories.find((c) =>
      tag.toLowerCase().includes(c.description.toLowerCase()) ||
      c.description.toLowerCase().includes(tag.toLowerCase())
    )
    if (foundCat) {
      setCategoryId(foundCat.id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!description.trim()) {
      setErrorMsg('Informe o nome da despesa ou toque em uma sugestão.')
      return
    }

    const numVal = parseFloat(valueStr.replace(',', '.'))
    if (isNaN(numVal) || numVal <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.')
      return
    }

    try {
      setIsSubmitting(true)
      await onAdd({
        description: description.trim(),
        value: numVal,
        dt_lcto: `${date}T12:00:00Z`,
        invoice_month: currentMonth,
        owner_id: activeOwner.id, // Auto-atribuído ao usuário logado
        card_id: cardId,
        type_id: categoryId,
        cur_parcs: 1,
        total_parcs: 1,
        is_paid: false,
        is_forecast: false,
        entry_type: entryType,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar lançamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header com Puxador Mobile */}
        <div className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              entryType === 'income' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              {entryType === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {entryType === 'income' ? 'Nova Entrada / Receita' : 'Novo Gasto de Bolso'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lançando para: <b className="text-emerald-600 dark:text-emerald-400">{activeOwner.name}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Toggle Despesa vs Receita */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setEntryType('expense')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryType === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Saída (Despesa)</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryType === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Entrada (Receita)</span>
            </button>
          </div>

          {/* Input Gigante de Valor */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Valor em Reais
            </span>
            <div className="flex items-center justify-center gap-1 text-slate-900 dark:text-slate-100">
              <span className="text-xl font-bold text-slate-400">R$</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                required
                placeholder="0,00"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                className="text-3xl font-black bg-transparent w-44 text-center focus:outline-none border-b-2 border-emerald-500 font-mono tracking-tight"
              />
            </div>
          </div>

          {/* Sugestões Rápidas de Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Sugestões Rápidas (Toque para preencher):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleSelectQuickTag(tag)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    description === tag
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Descrição Livre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição / Nome do Estabelecimento *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Padaria Bela Vista, Café na esquina, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
            />
          </div>

          {/* Categoria & Cartão */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cartão / Conta
              </label>
              <select
                value={cardId ?? ''}
                onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data do Lançamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Data do Lançamento
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
            />
          </div>

          {/* Botão de Lançar com IA (Câmera do Celular / Print) */}
          {onOpenAiUploader && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenAiUploader()
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ou fotografe um comprovante com IA</span>
            </button>
          )}

          {/* Botão Salvar Gigante */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${
                entryType === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
              }`}
            >
              <Check className="w-5 h-5" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Lançamento Agora'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
