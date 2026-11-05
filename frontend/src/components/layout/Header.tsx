import React from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileUp,
  PlusCircle,
  RefreshCw,
} from 'lucide-react'
import { formatMonthName } from '../../lib/formatters'

interface HeaderProps {
  currentMonth: string
  onMonthChange: (month: string) => void
  onRefresh: () => void
  onOpenAddModal: () => void
  onOpenUploadModal: () => void
  isLoading?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  currentMonth,
  onMonthChange,
  onRefresh,
  onOpenAddModal,
  onOpenUploadModal,
  isLoading,
}) => {
  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month - 1
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month + 1
    if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Financial Organizer
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Familiar
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Controle de cartões divididos entre Rafael, Mãe e Irmã
            </p>
          </div>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-center">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all shadow-none hover:shadow-sm"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 font-semibold text-sm text-slate-800">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{formatMonthName(currentMonth)}</span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all shadow-none hover:shadow-sm"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 ml-1 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-white transition-all shadow-none hover:shadow-sm disabled:opacity-50"
            title="Recarregar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Lançamento</span>
          </button>

          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm shadow-emerald-600/25 active:scale-[0.98]"
          >
            <FileUp className="w-4 h-4" />
            <span>Subir Fatura PDF</span>
          </button>
        </div>
      </div>
    </header>
  )
}
