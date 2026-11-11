import React, { useState } from 'react'
import { PlusCircle, X, Clock } from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: Partial<Transaction>) => Promise<void>
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  currentMonth: string
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  owners,
  cards,
  categories,
  currentMonth,
}) => {
  if (!isOpen) return null

  const defaultDate = (() => {
    const today = new Date().toISOString().split('T')[0]
    return today.startsWith(currentMonth) ? today : `${currentMonth}-01`
  })()

  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [invoiceMonth, setInvoiceMonth] = useState<string>(currentMonth)
  const [ownerId, setOwnerId] = useState<number>(owners[0]?.id || 1)
  const [cardId, setCardId] = useState<number | null>(cards[0]?.id || null)
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1)
  const [curParcs, setCurParcs] = useState<number>(1)
  const [totalParcs, setTotalParcs] = useState<number>(1)
  const [isForecast, setIsForecast] = useState<boolean>(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleCategoryChange = (catId: number) => {
    setCategoryId(catId)
    const cat = categories.find((c) => c.id === catId)
    if (cat && cat.description.toLowerCase().includes('previst')) {
      setIsForecast(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!description.trim()) {
      setErrorMsg('Informe a descrição da despesa.')
      return
    }

    const numVal = parseFloat(value.replace(',', '.'))
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
        invoice_month: invoiceMonth || currentMonth,
        owner_id: ownerId,
        card_id: cardId,
        type_id: categoryId,
        cur_parcs: curParcs,
        total_parcs: totalParcs,
        is_paid: false,
        is_forecast: isForecast,
        comment: comment.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar despesa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Novo Lançamento Manual</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Compra *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Supermercado Pão de Açúcar, Farmácia, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Amount, Purchase Date & Invoice Month */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Data da Compra *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fatura (Cobrança) *</label>
              <input
                type="month"
                required
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                title="Mês em que esta conta será cobrada/paga na fatura"
              />
            </div>
          </div>

          {/* Owner & Card */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsável (Quem deve?) *
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
              >
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cartão de Crédito</label>
              <select
                value={cardId || ''}
                onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
              >
                <option value="">Sem Cartão (Custo Fixo / Direto)</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Installments */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoria *</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parcelas (Atual / Total)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={totalParcs}
                  value={curParcs}
                  onChange={(e) => setCurParcs(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-400 font-bold">/</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={totalParcs}
                  onChange={(e) => setTotalParcs(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observação / Comentário (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Compra do almoço de domingo"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Is Forecast / Previsão Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="add-is-forecast" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                  Gasto Previsto / Estimativa
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Marque para valores estimados (luz, água, internet, DAS MEI) que podem variar.
                </p>
              </div>
            </div>
            <input
              id="add-is-forecast"
              type="checkbox"
              checked={isForecast}
              onChange={(e) => setIsForecast(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Cadastrar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
