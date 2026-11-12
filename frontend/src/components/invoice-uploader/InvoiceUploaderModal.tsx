import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  CreditCard,
  User,
} from 'lucide-react'
import { Card, Category, ExtractedInvoiceItem, ExtractedInvoiceResponse, Owner } from '../../types'
import { confirmInvoiceBatch, extractInvoiceFromPDF } from '../../lib/api'
import { formatCurrency, formatMonthName } from '../../lib/formatters'

interface InvoiceUploaderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (confirmedMonth?: string) => void
  owners: Owner[]
  cards: Card[]
  categories: Category[]
  currentMonth: string
  initialFiles?: File[]
}

export const InvoiceUploaderModal: React.FC<InvoiceUploaderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  owners,
  cards,
  categories,
  currentMonth,
  initialFiles = [],
}) => {
  if (!isOpen) return null

  const [files, setFiles] = useState<File[]>(initialFiles)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(cards[0]?.id || null)
  const [targetMonth, setTargetMonth] = useState<string>(currentMonth)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceResponse | null>(null)
  const [editedItems, setEditedItems] = useState<
    (ExtractedInvoiceItem & { selected: boolean; targetOwnerId: number; targetCategoryId: number })[]
  >([])
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Sync initialFiles when passed
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles((prev) => {
        const existingSignatures = new Set(prev.map((f) => `${f.name}_${f.size}`))
        const fresh = initialFiles.filter((f) => !existingSignatures.has(`${f.name}_${f.size}`))
        return [...prev, ...fresh]
      })
    }
  }, [initialFiles])

  // Helper to add files with validation
  const addFiles = (newFiles: File[]) => {
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.csv', '.xlsx', '.xls']
    const valid = newFiles.filter((f) => {
      const lower = f.name.toLowerCase()
      return validExtensions.some((ext) => lower.endsWith(ext)) || f.type.startsWith('image/')
    })

    if (valid.length === 0) {
      setErrorMsg('Nenhum arquivo válido suportado (suporta prints PNG/JPG, fotos de recibos, PDFs ou planilhas).')
      return
    }

    setFiles((prev) => [...prev, ...valid])
    setReplaceExisting(false)
    setErrorMsg('')
    setSuccessMsg(`📸 ${valid.length} ${valid.length === 1 ? 'imagem/arquivo adicionado' : 'imagens adicionadas'}! (Pode colar mais com Ctrl+V)`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  // Global Ctrl + V listener when modal is open
  useEffect(() => {
    if (!isOpen) return

    const handlePaste = (e: ClipboardEvent) => {
      // If focused inside text input or textarea, only intercept if clipboard has image data
      const target = e.target as HTMLElement
      const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

      const pasted: File[] = []

      // 1. Files copied from file explorer or clipboard
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          pasted.push(e.clipboardData.files[i])
        }
      }

      // 2. Blobs from screenshot (Win+Shift+S / Snipping Tool / WhatsApp print)
      if (pasted.length === 0 && e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i]
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile()
            if (blob) {
              const ext = blob.type.split('/')[1] || 'png'
              const now = new Date()
              const timeStr = `${now.getHours()}h${now.getMinutes()}m${now.getSeconds()}s`
              const file = new File([blob], `print_${timeStr}_${i + 1}.${ext}`, { type: blob.type })
              pasted.push(file)
            }
          }
        }
      }

      if (pasted.length > 0) {
        e.preventDefault()
        addFiles(pasted)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  const handleExtract = async () => {
    if (files.length === 0) {
      setErrorMsg('Adicione ou cole ao menos uma imagem/print (Ctrl + V) para continuar.')
      return
    }

    try {
      setIsExtracting(true)
      setErrorMsg('')
      setReplaceExisting(false)
      const result = await extractInvoiceFromPDF(files, selectedCardId)
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
          entry_type: it.entry_type || 'expense',
          targetOwnerId: matchedOwnerId,
          targetCategoryId: matchedCatId,
        }
      })

      setEditedItems(mapped)
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na extração com a IA Gemini.')
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

      const finalMonth = targetMonth || currentMonth
      const payload = {
        card_id: extractedData?.card_id || selectedCardId,
        target_month: finalMonth,
        project_future_installments: false,
        file_hash: extractedData?.file_hash || undefined,
        filename: files.map((f) => f.name).join(', ') || undefined,
        bank_or_issuer: extractedData?.bank_or_issuer || undefined,
        replace_existing: replaceExisting,
        items: selectedToPersist.map((item) => ({
          purchase_date: item.purchase_date,
          description: item.description,
          amount: item.amount,
          owner_id: item.targetOwnerId,
          type_id: item.targetCategoryId,
          cur_parcs: item.current_installment,
          total_parcs: item.total_installments,
          is_paid: false,
          entry_type: item.entry_type || 'expense',
          comment: `Extraído via IA (${extractedData?.bank_or_issuer || 'Cartão'})`,
        })),
      }

      const res = await confirmInvoiceBatch(payload)
      setSuccessMsg(
        res.message ||
          `${res.confirmed_count} transações confirmadas com sucesso para a fatura de ${formatMonthName(finalMonth)}! Redirecionando...`
      )
      setTimeout(() => {
        onSuccess(finalMonth)
        onClose()
      }, 1200)
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
                  Lançamento Inteligente com IA
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Google Gemini Multimodal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suba fatura em PDF, foto/recibo ou planilha (Excel/CSV) para leitura automática e classificação
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
                    1. Cartão de Crédito ou Conta de Destino
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

              {/* Dropzone & Multi-image Paste Zone */}
              {files.length === 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>2. Arquivos ou Imagens (Suporta Ctrl + V)</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                      Cole prints da tela ou selecione múltiplos arquivos
                    </span>
                  </label>
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        addFiles(Array.from(e.dataTransfer.files))
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-850 text-center"
                  >
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,image/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isExtracting}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 mb-3">
                      <Clipboard className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Pressione <kbd className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">Ctrl + V</kbd> para colar imagens aqui
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                      Tire um print (<kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">Win + Shift + S</kbd>) ou copie fotos de comprovantes e cole diretamente. Você pode colar várias imagens seguidas!
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Ou clique para selecionar fotos, PDFs ou planilhas do computador</span>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {files.length} {files.length === 1 ? 'imagem / arquivo pronto' : 'imagens / arquivos prontos'}
                        </span>
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                        Ctrl + V ativo (cole mais imagens se quiser)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Limpar todas
                    </button>
                  </div>

                  {/* Thumbnail Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {files.map((f, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xs flex flex-col items-center"
                      >
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer opacity-90 hover:opacity-100 transition-all z-10"
                          title="Remover esta foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Image Thumbnail */}
                        {f.type.startsWith('image/') ? (
                          <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-1.5 flex items-center justify-center">
                            <img
                              src={URL.createObjectURL(f)}
                              alt={f.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 mb-1.5">
                            <FileText className="w-8 h-8 text-emerald-600 mb-1" />
                            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                              {f.name.split('.').pop()}
                            </span>
                          </div>
                        )}

                        <div className="w-full text-center px-1">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={f.name}>
                            {f.name.startsWith('print_') ? `Foto / Print #${idx + 1}` : f.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(f.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Add more button */}
                    <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-xl flex flex-col items-center justify-center p-3 cursor-pointer text-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/20 transition-all min-h-[120px]">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isExtracting}
                      />
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold">Colar (Ctrl+V) ou Adicionar</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Extract CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={files.length === 0 || isExtracting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xs shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95 cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        Processando {files.length} {files.length === 1 ? 'arquivo' : 'imagens'} com IA Gemini...
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Analisar e Extrair {files.length > 1 ? `(${files.length} Imagens)` : ''} com IA
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Review & Confirm */}
          {extractedData && (
            <div className="space-y-4">
              {/* Duplicate Invoice Warning Alert (RN02 Protection) */}
              {extractedData.is_already_imported && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs shadow-xs animate-in fade-in duration-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-amber-900 dark:text-amber-100">
                        ⚠️ Esta fatura já foi importada anteriormente!
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        {extractedData.already_imported_message ||
                          'O sistema identificou que este mesmo arquivo PDF já foi confirmado no banco de dados. Para evitar compras duplicadas, a importação direta está bloqueada.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 bg-amber-100/60 dark:bg-amber-900/30 p-2.5 rounded-lg">
                    <input
                      id="replaceExistingCheckbox"
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="replaceExistingCheckbox" className="text-xs text-amber-950 dark:text-amber-100 font-semibold cursor-pointer">
                      Substituir lançamentos anteriores desta fatura
                      <span className="block text-[11px] font-normal text-amber-800 dark:text-amber-300 mt-0.5">
                        Ao marcar esta opção, o sistema atualizará as compras deste cartão no mês sem gerar cobranças repetidas.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Extraction Summary Banner */}
              <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Emissor Detectado:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 ml-1.5">
                    {extractedData.bank_or_issuer || 'Cartão de Crédito'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Mês da Fatura:</span>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    title="Mês/Ano em que as compras serão contabilizadas no rateio"
                  />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                    ({formatMonthName(targetMonth || currentMonth)})
                  </span>
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
                    setReplaceExisting(false)
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
                >
                  Enviar outro arquivo
                </button>
              </div>

              {/* Quick Helper: Bulk Owner Assignment Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 p-3 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 block">
                      Atribuir compras da fatura em massa
                    </span>
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">
                      Ideal quando a fatura inteira pertencer a uma única pessoa (ex: Tia Renata)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-emerald-900 dark:text-emerald-300 font-semibold text-[11px]">
                    Definir todas para:
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      const newOwnerId = Number(e.target.value)
                      setEditedItems((prev) =>
                        prev.map((it) => ({ ...it, targetOwnerId: newOwnerId }))
                      )
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Manter responsáveis individuais...</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                        <th className="py-2.5 px-3 text-center">Tipo</th>
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

                          {/* Tipo: Despesa vs Receita */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditedItems((prev) =>
                                  prev.map((it, idx) =>
                                    idx === index
                                      ? { ...it, entry_type: it.entry_type === 'income' ? 'expense' : 'income' }
                                      : it
                                  )
                                )
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                item.entry_type === 'income'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                              }`}
                              title="Clique para alternar entre Despesa e Receita"
                            >
                              {item.entry_type === 'income' ? '🟢 Receita' : '🔴 Despesa'}
                            </button>
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
                    disabled={
                      isConfirming ||
                      editedItems.filter((i) => i.selected).length === 0 ||
                      Boolean(extractedData?.is_already_imported && !replaceExisting)
                    }
                    className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      extractedData?.is_already_imported && !replaceExisting
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    }`}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando no Banco...</span>
                      </>
                    ) : extractedData?.is_already_imported && !replaceExisting ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Fatura Já Importada (Habilite Substituir)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {replaceExisting ? 'Substituir e Atualizar em ' : 'Confirmar e Salvar em '}
                          {formatMonthName(targetMonth || currentMonth)}
                        </span>
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
