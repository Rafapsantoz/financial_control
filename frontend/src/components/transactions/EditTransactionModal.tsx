import React, { useState, useEffect } from 'react'
import { Pencil, X, CheckCircle2, Clock } from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'

interface EditTransactionModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onClose: () => void
  onSave: (id: number, data: Partial<Transaction>) => Promise<void>
  owners: Owner[]
  cards: Card[]
  categories: Category[]
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSave,
  owners,
  cards,
  categories,
}) => {
  if (!isOpen || !transaction) return null

  const [description, setDescription] = useState(transaction.description || '')
  const [value, setValue] = useState(String(transaction.value || ''))
  const [date, setDate] = useState(
    transaction.dt_lcto ? transaction.dt_lcto.split('T')[0] : new Date().toISOString().split('T')[0]
  )
  const [invoiceMonth, setInvoiceMonth] = useState<string>(
    transaction.invoice_month || (transaction.dt_lcto ? transaction.dt_lcto.slice(0, 7) : '')
  )
  const [ownerId, setOwnerId] = useState<number>(transaction.owner_id || owners[0]?.id || 1)
  const [cardId, setCardId] = useState<number | null>(transaction.card_id || null)
  const [categoryId, setCategoryId] = useState<number>(transaction.type_id || categories[0]?.id || 1)
  const [curParcs, setCurParcs] = useState<number>(transaction.cur_parcs || 1)
  const [totalParcs, setTotalParcs] = useState<number>(transaction.total_parcs || 1)
  const [isPaid, setIsPaid] = useState<boolean>(transaction.is_paid || false)
  const [comment, setComment] = useState(transaction.comment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Sync state whenever selected transaction changes
  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '')
      setValue(String(transaction.value || ''))
      setDate(transaction.dt_lcto ? transaction.dt_lcto.split('T')[0] : '')
      setInvoiceMonth(transaction.invoice_month || (transaction.dt_lcto ? transaction.dt_lcto.slice(0, 7) : ''))
      setOwnerId(transaction.owner_id || owners[0]?.id || 1)
      setCardId(transaction.card_id || null)
      setCategoryId(transaction.type_id || categories[0]?.id || 1)
      setCurParcs(transaction.cur_parcs || 1)
      setTotalParcs(transaction.total_parcs || 1)
      setIsPaid(transaction.is_paid || false)
      setComment(transaction.comment || '')
      setErrorMsg('')
    }
  }, [transaction, owners, categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!description.trim()) {
      setErrorMsg('Informe a descrição da despesa.')
      return
    }

    const numVal = parseFloat(String(value).replace(',', '.'))
    if (isNaN(numVal) || numVal <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.')
      return
    }

    if (curParcs > totalParcs) {
      setErrorMsg(`A parcela atual (${curParcs}) não pode ser maior que o total de parcelas (${totalParcs}).`)
      return
    }

    try {
      setIsSubmitting(true)
      await onSave(transaction.id, {
        description: description.trim(),
        value: numVal,
        dt_lcto: `${date}T12:00:00Z`,
        invoice_month: invoiceMonth || date.slice(0, 7),
        owner_id: ownerId,
        card_id: cardId,
        type_id: categoryId,
        cur_parcs: curParcs,
        total_parcs: totalParcs,
        is_paid: isPaid,
        comment: comment.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar alterações.')
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
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Editar Lançamento</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">ID #{transaction.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição do Gasto *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              placeholder="Ex: Supermercado Extra"
            />
          </div>

          {/* Valor, Data da Compra e Fatura de Cobrança */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Total (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100 font-semibold"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data da Compra *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fatura (Cobrança) *
              </label>
              <input
                type="month"
                required
                value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
                title="Mês da fatura em que este valor será cobrado/pago"
              />
            </div>
          </div>

          {/* Responsável e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsável (Quem paga?) *
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoria *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cartão e Parcelamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cartão
              </label>
              <select
                value={cardId ?? ''}
                onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              >
                <option value="">Sem Cartão</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parcela Atual
              </label>
              <input
                type="number"
                min={1}
                max={totalParcs}
                value={curParcs}
                onChange={(e) => setCurParcs(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Parcelas
              </label>
              <input
                type="number"
                min={curParcs}
                max={99}
                value={totalParcs}
                onChange={(e) => setTotalParcs(Math.max(curParcs, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Status de Pagamento (Quitação) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status de Quitação
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isPaid
                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Pago / Quitado
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !isPaid
                    ? 'bg-rose-500 border-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                Pendente
              </button>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observação / Detalhes (Opcional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
              placeholder="Ex: Compra parcelada dividida com a mãe"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
