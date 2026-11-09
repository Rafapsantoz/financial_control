import React, { useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
  X,
  CreditCard,
  User,
} from 'lucide-react'
import { Card, Category, ExtractedInvoiceItem, ExtractedInvoiceResponse, Owner } from '../../types'
import { confirmInvoiceBatch, extractInvoiceFromPDF } from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'

interface InvoiceUploaderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  currentMonth: string
}

export const InvoiceUploaderModal: React.FC<InvoiceUploaderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  owners,
  cards,
  categories,
  currentMonth,
}) => {
  if (!isOpen) return null

  const [file, setFile] = useState<File | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(cards[0]?.id || null)
  const [targetMonth, setTargetMonth] = useState<string>(currentMonth)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceResponse | null>(null)
  const [editedItems, setEditedItems] = useState<
    (ExtractedInvoiceItem & { selected: boolean; targetOwnerId: number; targetCategoryId: number })[]
  >([])
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Por favor, selecione um arquivo no formato PDF.')
        return
      }
      setFile(selected)
      setErrorMsg('')
    }
  }

  const handleExtract = async () => {
    if (!file) {
      setErrorMsg('Selecione um arquivo PDF de fatura para continuar.')
      return
    }

    try {
      setIsExtracting(true)
      setErrorMsg('')
      const result = await extractInvoiceFromPDF(file, selectedCardId)
      setExtractedData(result)
      if (result.invoice_month_year && /^\d{4}-(0[1-9]|1[0-2])$/.test(result.invoice_month_year)) {
        setTargetMonth(result.invoice_month_year)
      } else {
        setTargetMonth(currentMonth)
      }

      // Initialize review items with heuristics
      const defaultOwner = owners[0]?.id || 1
      const defaultCat = categories[0]?.id || 1

      const mapped = result.items.map((it) => {
        // Match owner id by suggested name
        let matchedOwnerId = it.owner_id || defaultOwner
        if (!it.owner_id && it.suggested_owner) {
          const found = owners.find((o) =>
            o.name.toLowerCase().includes(it.suggested_owner!.toLowerCase())
          )
          if (found) matchedOwnerId = found.id
        }

        // Match category id by suggested name
        let matchedCatId = it.category_id || defaultCat
        if (!it.category_id && it.suggested_category) {
          const found = categories.find((c) =>
            c.description.toLowerCase().includes(it.suggested_category!.toLowerCase())
          )
          if (found) matchedCatId = found.id
        }

        return {
          ...it,
          selected: true,
          targetOwnerId: matchedOwnerId,
          targetCategoryId: matchedCatId,
        }
      })

      setEditedItems(mapped)
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na extração da fatura com a IA Gemini.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleConfirm = async () => {
    const selectedToPersist = editedItems.filter((i) => i.selected)
    if (selectedToPersist.length === 0) {
      setErrorMsg('Selecione ao menos um item da fatura para salvar.')
      return
    }

    try {
      setIsConfirming(true)
      setErrorMsg('')

      const payload = {
        card_id: extractedData?.card_id || selectedCardId,
        target_month: targetMonth || currentMonth,
        project_future_installments: false,
        items: selectedToPersist.map((item) => ({
          purchase_date: item.purchase_date,
          description: item.description,
          amount: item.amount,
          owner_id: item.targetOwnerId,
          type_id: item.targetCategoryId,
          cur_parcs: item.current_installment,
          total_parcs: item.total_installments,
          is_paid: false,
          comment: `Extraído via PDF (${extractedData?.bank_or_issuer || 'Cartão'})`,
        })),
      }

      const res = await confirmInvoiceBatch(payload)
      setSuccessMsg(res.message || `${res.confirmed_count} transações confirmadas com sucesso!`)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao persistir transações.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Extração Inteligente de Fatura PDF
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Google Gemini 3.5 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sobe o PDF da fatura do cartão para leitura automática de compras e rateio familiar
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

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload & Extract */}
          {!extractedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    1. Cartão de Crédito de Destino
                  </label>
                  <select
                    value={selectedCardId || ''}
                    onChange={(e) => setSelectedCardId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3.5 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.card_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Arquivo PDF da Fatura
                </label>
                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-850 text-center">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isExtracting}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                    <FileUp className="w-6 h-6" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB — Clique para trocar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Clique para selecionar ou arraste o arquivo PDF aqui
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Formatos suportados: Faturas Nubank, Inter, Itaú, C6, Bradesco em PDF nativo
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Extract CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!file || isExtracting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xs shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando com IA Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analisar e Extrair Fatura</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Review & Confirm */}
          {extractedData && (
            <div className="space-y-4">
              {/* Extraction Summary Banner */}
              <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Emissor Detectado:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 ml-1.5">
                    {extractedData.bank_or_issuer || 'Cartão de Crédito'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500">Mês da Fatura:</span>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    title="Mês/Ano em que as compras serão contabilizadas no rateio"
                  />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Total Fatura:</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 ml-1.5 text-sm">
                    {formatCurrency(extractedData.total_invoice_amount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Itens Extraídos:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 ml-1.5">
                    {editedItems.length} compras
                  </span>
                </div>
                <button
                  onClick={() => {
                    setExtractedData(null)
                    setEditedItems([])
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
                >
                  Enviar outro arquivo
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={editedItems.every((i) => i.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setEditedItems((prev) => prev.map((it) => ({ ...it, selected: checked })))
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Descrição da Compra</th>
                        <th className="py-2.5 px-3 text-center">Parcelas</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3">Responsável (Heurística)</th>
                        <th className="py-2.5 px-3">Categoria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {editedItems.map((item, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                            !item.selected
                              ? 'opacity-40 bg-slate-50/50 dark:bg-slate-900/50'
                              : 'bg-white dark:bg-slate-900'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setEditedItems((prev) =>
                                  prev.map((it, idx) =>
                                    idx === index ? { ...it, selected: checked } : it
                                  )
                                )
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-2 px-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            <input
                              type="date"
                              value={item.purchase_date}
                              onChange={(e) => {
                                const newDate = e.target.value
                                setEditedItems((prev) =>
                                  prev.map((it, idx) => (idx === index ? { ...it, purchase_date: newDate } : it))
                                )
                              }}
                              className="px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                            />
                          </td>

                          {/* Description */}
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                            {item.description}
                            {item.is_duplicate_suspect && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                Duplicata?
                              </span>
                            )}
                          </td>

                          {/* Installments */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                            {item.current_installment}/{item.total_installments}
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.amount)}
                          </td>

                          {/* Owner Selection */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <select
                              value={item.targetOwnerId}
                              onChange={(e) => {
                                const newId = Number(e.target.value)
                                setEditedItems((prev) =>
                                  prev.map((it, idx) =>
                                    idx === index ? { ...it, targetOwnerId: newId } : it
                                  )
                                )
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            >
                              {owners.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Category Selection */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <select
                              value={item.targetCategoryId}
                              onChange={(e) => {
                                const newId = Number(e.target.value)
                                setEditedItems((prev) =>
                                  prev.map((it, idx) =>
                                    idx === index ? { ...it, targetCategoryId: newId } : it
                                  )
                                )
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.description}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editedItems.filter((i) => i.selected).length} de {editedItems.length} compras
                  selecionadas para salvar
                </p>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isConfirming}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isConfirming || editedItems.filter((i) => i.selected).length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/30 transition-all disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando no Banco...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmar e Salvar no SQLite</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
