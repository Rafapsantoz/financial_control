import React, { useState } from 'react'
import { CheckCircle2, DollarSign, Loader2, Sparkles, X, AlertCircle } from 'lucide-react'
import { OwnerSummary, Transaction } from '../../types'
import { settleOwnerDebt } from '../../lib/api'
import { formatCurrency, formatMonthName } from '../../lib/formatters'

interface SettlePaymentModalProps {
  isOpen: boolean
  ownerSummary: OwnerSummary | null
  month: string
  transactions: Transaction[]
  onClose: () => void
  onSuccess: () => void
}

export const SettlePaymentModal: React.FC<SettlePaymentModalProps> = ({
  isOpen,
  ownerSummary,
  month,
  transactions,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !ownerSummary) return null

  // Filter pending transactions for this owner in this month (EXCLUDING forecasts: RN-Previsto)
  const pendingTxs = transactions
    .filter(
      (t) =>
        t.owner_id === ownerSummary.owner_id &&
        !t.is_paid &&
        !t.is_forecast &&
        (t.invoice_month === month || (!t.invoice_month && t.dt_lcto?.startsWith(month)))
    )
    .sort((a, b) => a.value - b.value)

  const totalEffectivePending = Math.round(pendingTxs.reduce((acc, t) => acc + t.value, 0) * 100) / 100

  const [paymentInput, setPaymentInput] = useState<string>(
    String(totalEffectivePending || 0)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const paymentVal = parseFloat(paymentInput.replace(',', '.')) || 0

  // Real-time cascade preview simulation
  let runningPayment = paymentVal
  const cascadePreview = pendingTxs.map((tx) => {
    const txVal = tx.value
    if (runningPayment <= 0) {
      return {
        ...tx,
        action: 'pending' as const,
        paidPortion: 0,
        unpaidPortion: txVal,
      }
    }
    if (runningPayment >= txVal) {
      runningPayment = Math.round((runningPayment - txVal) * 100) / 100
      return {
        ...tx,
        action: 'full' as const,
        paidPortion: txVal,
        unpaidPortion: 0,
      }
    }
    // Partial payment
    const partial = runningPayment
    const remainder = Math.round((txVal - partial) * 100) / 100
    runningPayment = 0
    return {
      ...tx,
      action: 'partial' as const,
      paidPortion: partial,
      unpaidPortion: remainder,
    }
  })

  const fullCount = cascadePreview.filter((p) => p.action === 'full').length
  const partialCount = cascadePreview.filter((p) => p.action === 'partial').length
  const simulatedRemaining = Math.max(
    0,
    Math.round((totalEffectivePending - paymentVal) * 100) / 100
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (paymentVal <= 0) {
      setErrorMsg('Informe um valor de pagamento maior que zero.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMsg('')
      const res = await settleOwnerDebt(ownerSummary.owner_id, {
        payment_amount: paymentVal,
        month,
      })
      setSuccessMsg(res.message)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar quitação de valores.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Quitar / Abater Valores — {ownerSummary.owner_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fechamento de {formatMonthName(month)} com rateio automático em cascata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Pending Debt Summary Banner */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Total Pendente Efetivo</span>
              <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                {formatCurrency(totalEffectivePending)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Novo Saldo Após Quitação</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(simulatedRemaining)}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
            💡 <strong>Gastos previstos/estimados são ignorados:</strong> Eles não entram na quitação automática para forçar o ajuste quando a fatura real chegar.
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Valor Pago pelo Membro (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-base font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                placeholder="0,00"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setPaymentInput(String(totalEffectivePending))}
                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                Quitar Tudo ({formatCurrency(totalEffectivePending)})
              </button>
              {totalEffectivePending > 10 && (
                <button
                  type="button"
                  onClick={() =>
                    setPaymentInput(String(Math.round((totalEffectivePending / 2) * 100) / 100))
                  }
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                >
                  Metade (50%)
                </button>
              )}
            </div>
          </div>

          {/* Cascade Simulation Preview List */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Simulação do Rateio em Cascata ({pendingTxs.length} compras)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {fullCount} integral + {partialCount} parcial
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-850/50 text-xs">
              {cascadePreview.length === 0 ? (
                <p className="text-slate-400 text-center py-4 italic text-[11px]">
                  Nenhuma compra pendente para este membro neste mês.
                </p>
              ) : (
                cascadePreview.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded-lg flex items-center justify-between transition-colors ${
                      item.action === 'full'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60'
                        : item.action === 'partial'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60'
                        : 'bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Valor total: {formatCurrency(item.value)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {item.action === 'full' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          ✓ Quitado ({formatCurrency(item.paidPortion)})
                        </span>
                      )}
                      {item.action === 'partial' && (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 block">
                            Abate {formatCurrency(item.paidPortion)}
                          </span>
                          <span className="text-[9px] text-amber-700 dark:text-amber-300 block">
                            Resta {formatCurrency(item.unpaidPortion)}
                          </span>
                        </div>
                      )}
                      {item.action === 'pending' && (
                        <span className="text-[10px] font-medium text-slate-400">
                          Pendente ({formatCurrency(item.value)})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || paymentVal <= 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando Quitação...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Quitação de {formatCurrency(paymentVal)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
