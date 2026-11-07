import React from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileUp,
  LayoutDashboard,
  Moon,
  PlusCircle,
  RefreshCw,
  Settings,
  Sun,
} from 'lucide-react'
import { formatMonthName } from '../../lib/formatters'

interface HeaderProps {
  currentMonth: string
  onMonthChange: (month: string) => void
  onRefresh: () => void
  onOpenAddModal: () => void
  onOpenUploadModal: () => void
  isLoading?: boolean
  currentView: 'dashboard' | 'admin'
  onViewChange: (view: 'dashboard' | 'admin') => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export const Header: React.FC<HeaderProps> = ({
  currentMonth,
  onMonthChange,
  onRefresh,
  onOpenAddModal,
  onOpenUploadModal,
  isLoading,
  currentView,
  onViewChange,
  theme,
  onToggleTheme,
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
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & View Switcher */}
        <div className="flex items-center justify-between md:justify-start gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  RPsec Financeiro
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Familiar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rafael • Mãe • Irmã
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Dashboard vs Admin) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => onViewChange('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Administração</span>
            </button>
          </div>
        </div>

        {/* Month Selector & Controls (shown in dashboard view) */}
        {currentView === 'dashboard' && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 self-center">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-none hover:shadow-xs"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 font-semibold text-sm text-slate-800 dark:text-slate-200">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{formatMonthName(currentMonth)}</span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-none hover:shadow-xs"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 ml-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-none hover:shadow-xs disabled:opacity-50"
              title="Recarregar Dados"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`}
              />
            </button>
          </div>
        )}

        {/* Action Buttons & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {currentView === 'dashboard' && (
            <>
              <button
                onClick={onOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Lançamento</span>
              </button>

              <button
                onClick={onOpenUploadModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-xs shadow-emerald-600/25 active:scale-95"
              >
                <FileUp className="w-4 h-4" />
                <span>Subir Fatura PDF</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
