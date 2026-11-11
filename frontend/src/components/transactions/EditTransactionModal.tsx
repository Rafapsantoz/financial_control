import React, { useState, useEffect } from 'react'
import {
  Pencil,
  X,
  CheckCircle2,
  Clock,
  Scissors,
  Repeat,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Users,
} from 'lucide-react'
import { Card, Category, Owner, Transaction } from '../../types'
import { splitTransaction, replicateInstallments } from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'

interface EditTransactionModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onClose: () => void
  onSave: (id: number, data: Partial<Transaction>) => Promise<void>
  onSuccessRefresh?: () => void
  owners: Owner[]
  cards: Card[]
  categories: Category[]
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSave,
  onSuccessRefresh,
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
  const [isForecast, setIsForecast] = useState<boolean>(transaction.is_forecast || false)
  const [comment, setComment] = useState(transaction.comment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successBanner, setSuccessBanner] = useState('')

  // Split state
  const [isSplitOpen, setIsSplitOpen] = useState(false)
  const [splits, setSplits] = useState<{ owner_id: number; amount: string }[]>([
    { owner_id: transaction.owner_id || owners[0]?.id || 1, amount: String((transaction.value / 2).toFixed(2)) },
    {
      owner_id: owners.find((o) => o.id !== transaction.owner_id)?.id || owners[1]?.id || owners[0]?.id || 1,
      amount: String((transaction.value / 2).toFixed(2)),
    },
  ])
  const [isSplitting, setIsSplitting] = useState(false)

  // Replicate state
  const [isReplicating, setIsReplicating] = useState(false)

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
      setIsForecast(transaction.is_forecast || false)
      setComment(transaction.comment || '')
      setErrorMsg('')
      setSuccessBanner('')
      setIsSplitOpen(false)

      const half = Math.round((transaction.value / 2) * 100) / 100
      const otherHalf = Math.round((transaction.value - half) * 100) / 100
      setSplits([
        { owner_id: transaction.owner_id || owners[0]?.id || 1, amount: String(half) },
        {
          owner_id: owners.find((o) => o.id !== transaction.owner_id)?.id || owners[1]?.id || owners[0]?.id || 1,
          amount: String(otherHalf),
        },
      ])
    }
  }, [transaction, owners])

  const totalSplitValue = splits.reduce((acc, s) => acc + (parseFloat(s.amount.replace(',', '.')) || 0), 0)
  const origNumVal = parseFloat(value.replace(',', '.')) || transaction.value
  const splitDiff = Math.round((origNumVal - totalSplitValue) * 100) / 100
  const isSplitBalanced = Math.abs(splitDiff) <= 0.01

  const handle5050 = () => {
    if (splits.length < 2) return
    const perPerson = Math.round((origNumVal / splits.length) * 100) / 100
    const remainder = Math.round((origNumVal - perPerson * (splits.length - 1)) * 100) / 100
    setSplits(
      splits.map((s, idx) => ({
        ...s,
        amount: idx === splits.length - 1 ? String(remainder) : String(perPerson),
      }))
    )
  }

  const handleExecuteSplit = async () => {
    if (!isSplitBalanced) {
      setErrorMsg(`A soma das partes (R$ ${totalSplitValue.toFixed(2)}) deve ser igual ao valor total (R$ ${origNumVal.toFixed(2)}). Diferença: R$ ${splitDiff.toFixed(2)}`)
      return
    }

    try {
      setIsSplitting(true)
      setErrorMsg('')
      await splitTransaction(
        transaction.id,
        splits.map((s) => ({
          owner_id: s.owner_id,
          amount: parseFloat(s.amount.replace(',', '.')) || 0,
        }))
      )
      setSuccessBanner('Lançamento dividido com sucesso em títulos individuais!')
      setTimeout(() => {
        if (onSuccessRefresh) onSuccessRefresh()
        onClose()
      }, 1000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao dividir lançamento.')
    } finally {
      setIsSplitting(false)
    }
  }

  const handleReplicate = async () => {
    try {
      setIsReplicating(true)
      setErrorMsg('')
      const created = await replicateInstallments(transaction.id, {
        generate_future: true,
        generate_past: false,
      })
      setSuccessBanner(`${created.length} parcelas subsequentes geradas com sucesso nos meses futuros!`)
      setTimeout(() => {
        if (onSuccessRefresh) onSuccessRefresh()
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao replicar parcelas.')
    } finally {
      setIsReplicating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const numValue = parseFloat(value.replace(',', '.'))
    if (isNaN(numValue) || numValue <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSave(transaction.id, {
        description: description.trim(),
        value: numValue,
        dt_lcto: `${date}T12:00:00Z`,
        invoice_month: invoiceMonth,
        owner_id: ownerId,
        card_id: cardId,
        type_id: categoryId,
        cur_parcs: curParcs,
        total_parcs: totalParcs,
        is_paid: isPaid,
        is_forecast: isForecast,
        comment: comment.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar alterações.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xs">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Editar Lançamento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ID #{transaction.id}
              </p>
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
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successBanner}</span>
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

          {/* Valor, Data da Compra e Mês da Fatura */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Total (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
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
                <option value="">Sem Cartão (Custo Fixo / Direto)</option>
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

          {/* Is Forecast / Previsão Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="edit-is-forecast" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                  Gasto Previsto / Estimativa
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Desmarque quando o valor real da fatura chegar para torná-lo efetivo.
                </p>
              </div>
            </div>
            <input
              id="edit-is-forecast"
              type="checkbox"
              checked={isForecast}
              onChange={(e) => setIsForecast(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>

          {/* ======================================================== */}
          {/* FEATURE 1: DIVIDIR LANÇAMENTO (SPLIT DE DESPESA) */}
          {/* ======================================================== */}
          <div className="border border-indigo-200 dark:border-indigo-900/60 rounded-xl overflow-hidden bg-indigo-50/40 dark:bg-indigo-950/20">
            <button
              type="button"
              onClick={() => setIsSplitOpen(!isSplitOpen)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Dividir Lançamento (Rateio Familiar)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cria títulos vinculados para pessoas diferentes (ex: {formatCurrency(origNumVal)} dividido entre Irmã e Rafael)
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {isSplitOpen ? 'Recolher ▲' : 'Configurar Divisão ▼'}
              </span>
            </button>

            {isSplitOpen && (
              <div className="p-3 border-t border-indigo-100 dark:border-indigo-900/60 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Distribua o valor total:</span>
                  <button
                    type="button"
                    onClick={handle5050}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline"
                  >
                    Dividir Meio a Meio (50% / 50%)
                  </button>
                </div>

                {/* Split Participants List */}
                <div className="space-y-2">
                  {splits.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={s.owner_id}
                        onChange={(e) => {
                          const newOwnerId = Number(e.target.value)
                          setSplits((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, owner_id: newOwnerId } : item))
                          )
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>

                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={s.amount}
                          onChange={(e) => {
                            const valStr = e.target.value
                            setSplits((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, amount: valStr } : item))
                            )
                          }}
                          className="w-full pl-7 pr-2 py-1.5 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      {splits.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const unusedOwner = owners.find((o) => !splits.some((s) => s.owner_id === o.id)) || owners[0]
                      setSplits((prev) => [...prev, { owner_id: unusedOwner?.id || 1, amount: '0.00' }])
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar outra pessoa</span>
                  </button>

                  <div className="text-right text-xs">
                    <span className="text-slate-400 text-[11px]">Soma: </span>
                    <span
                      className={`font-extrabold ${
                        isSplitBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(totalSplitValue)} / {formatCurrency(origNumVal)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteSplit}
                  disabled={isSplitting || !isSplitBalanced}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSplitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dividindo lançamento...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Confirmar Divisão de Lançamento</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* FEATURE 3: REPLICAR PARCELAS NOS MESES SUBSEQUENTES */}
          {/* ======================================================== */}
          {totalParcs > 1 && (
            <div className="border border-teal-200 dark:border-teal-900/60 rounded-xl p-3 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 shrink-0">
                  <Repeat className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Projeção Automática de Parcelas
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Compra em {curParcs}/{totalParcs}x. Replicar parcelas restantes nos próximos meses.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReplicate}
                disabled={isReplicating}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-teal-800 dark:text-teal-200 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/60 dark:hover:bg-teal-800 border border-teal-300 dark:border-teal-700 transition-all flex items-center gap-1.5"
              >
                {isReplicating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Repeat className="w-3.5 h-3.5" />
                )}
                <span>Gerar Parcelas</span>
              </button>
            </div>
          )}

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
