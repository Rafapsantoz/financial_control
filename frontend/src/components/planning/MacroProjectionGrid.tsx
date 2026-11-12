import React, { useState, useEffect } from 'react'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  DollarSign,
  Layers,
  PieChart,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  FixedExpenseRow,
  MacroProjectionResponse,
  MonthlyColumnSummary,
} from '../../types'
import { fetchMacroProjection } from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'

interface MacroProjectionGridProps {
  initialYear?: number
}

export const MacroProjectionGrid: React.FC<MacroProjectionGridProps> = ({
  initialYear = 2026,
}) => {
  const [year, setYear] = useState<number>(initialYear)
  const [accountBalance, setAccountBalance] = useState<number>(0.0)
  const [balanceInput, setBalanceInput] = useState<string>('0.00')
  const [data, setData] = useState<MacroProjectionResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<'matrix' | 'owners' | 'categories'>('matrix')
  const [copySuccess, setCopySuccess] = useState<boolean>(false)

  const loadData = async (y = year, bal = accountBalance) => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetchMacroProjection(y, bal)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar macro projeção')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(year, accountBalance)
  }, [year, accountBalance])

  const handleUpdateBalance = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(balanceInput.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) {
      setAccountBalance(parsed)
    }
  }

  const handleCopySummary = () => {
    if (!data) return
    const membersSummary = data.owners_matrix
      ? Object.entries(data.owners_matrix)
          .map(([name, vals]) => `• *${name}:* ${formatCurrency(vals['total'] || 0)}`)
          .join('\n')
      : '• Nenhum membro cadastrado'

    const text = `📊 *RPsec Financeiro — Resumo Anual ${data.year}*\n` +
      `💰 Saldo Atual: ${formatCurrency(data.account_balance)}\n` +
      `🛡️ Runway (Sobrevivência): ${data.runway.months_of_runway} Meses (${data.runway.health_status})\n` +
      `🔥 Queima Média Mensal: ${formatCurrency(data.runway.monthly_fixed_burn)}\n` +
      `📈 Total Projetado no Ano: ${formatCurrency(data.grand_total_year)}\n\n` +
      `*Gastos por Membro no Ano (${data.year}):*\n` +
      membersSummary

    navigator.clipboard.writeText(text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* 1. RUNWAY & FINANCIAL HEALTH BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* RUNWAY CARD */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 border border-indigo-900/50 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Runway de Sobrevivência Financeira
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {data?.runway.health_status || 'Carregando...'}
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80">
                  Quantos meses você sustenta seu padrão de vida na pior das hipóteses
                </p>
              </div>
            </div>

            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all self-start md:self-auto cursor-pointer"
            >
              {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copySuccess ? 'Copiado!' : 'Copiar Resumo'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-indigo-200">Meses de Reserva</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black tracking-tight text-emerald-400">
                  {data?.runway.months_of_runway || 0}
                </span>
                <span className="text-sm font-semibold text-indigo-200">meses</span>
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                {data && data.runway.monthly_fixed_burn > 0
                  ? `Cobertura com queima de ${formatCurrency(data.runway.monthly_fixed_burn)}/mês`
                  : 'Aguardando lançamentos para calcular'}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-indigo-200">Queima Média / Custo Fixo</span>
              <div className="text-2xl font-bold tracking-tight text-white mt-1">
                {data ? formatCurrency(data.runway.monthly_fixed_burn) : 'R$ 0,00'}
              </div>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Gasto mensal fixo médio recorrente
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-indigo-200">Saldo na Conta</span>
              <form onSubmit={handleUpdateBalance} className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1 text-sm bg-black/30 border border-white/20 rounded-lg text-white font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white cursor-pointer"
                  title="Atualizar Saldo"
                >
                  OK
                </button>
              </form>
              <p className="text-[11px] text-indigo-200/70 mt-1">
                Ajuste para simular novos prazos
              </p>
            </div>
          </div>
        </div>

        {/* FAMILY DEBT SUMMARY SPOTLIGHT */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Rateio & Gastos por Membro
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Acumulado {year}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {data && Object.keys(data.owners_matrix).length > 0 ? (
                Object.entries(data.owners_matrix).map(([ownerName, mVals]) => {
                  const total = mVals['total'] || 0
                  return (
                    <div
                      key={ownerName}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span>{ownerName}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {total > 0 ? `Acumulado de ${year}` : 'Sem despesas lançadas'}
                        </p>
                      </div>
                      <span className={`font-mono font-bold text-sm ${total > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {formatCurrency(total)}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-400 italic">
                  Nenhum membro cadastrado.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Total Ano: <b>{formatCurrency(data?.grand_total_year || 0)}</b></span>
            <span>Saldo em Conta: <b>{formatCurrency(data?.account_balance || 0)}</b></span>
          </div>
        </div>
      </div>

      {/* 2. MODE SELECTOR & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveMode('matrix')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeMode === 'matrix'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Matriz Anual (Contas & Cartões)</span>
          </button>

          <button
            onClick={() => setActiveMode('owners')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeMode === 'owners'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>De Quem São as Contas (Donos)</span>
          </button>

          <button
            onClick={() => setActiveMode('categories')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeMode === 'categories'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Por Categoria</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Ano:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-slate-900 dark:text-slate-100"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <button
            onClick={() => loadData(year, accountBalance)}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Atualizar Projeção"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC SPREADSHEET TABLE (12 MONTHS) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Planejamento Anual {year} — Macro Projeção Mês a Mês</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visão horizontal consolidada de Janeiro a Dezembro alimentada 100% pelos dados reais do banco
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Total Anual Projetado</span>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {data ? formatCurrency(data.grand_total_year) : 'R$ 0,00'}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-[1490px] min-w-[1490px] text-left text-xs whitespace-nowrap table-fixed">
            <colgroup>
              <col style={{ width: '240px', minWidth: '240px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '95px', minWidth: '95px' }} />
              <col style={{ width: '110px', minWidth: '110px' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px]">
                  {activeMode === 'matrix' ? 'Descrição da Conta / Cartão' : activeMode === 'owners' ? 'Membro / Dono da Conta' : 'Categoria'}
                </th>
                {data?.months.map((m) => (
                  <th key={m.month_key} className="py-3 px-3 text-right w-[95px] min-w-[95px] max-w-[95px]">
                    {m.month_name.slice(0, 3)}
                  </th>
                ))}
                <th className="py-3 px-4 text-right bg-slate-200/50 dark:bg-slate-700/50 w-[110px] min-w-[110px] max-w-[110px] font-extrabold text-slate-900 dark:text-slate-100">
                  Total Ano
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {/* MODE 1: MATRIX (ACCOUNTS & CARDS) */}
              {activeMode === 'matrix' && (
                <>
                  {/* SEÇÃO 1: CUSTOS FIXOS */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                    <td colSpan={14} className="py-1.5 px-4 font-bold text-slate-400 dark:text-slate-500">
                      📌 Custos Fixos & Recorrentes
                    </td>
                  </tr>

                  {data?.fixed_expenses && data.fixed_expenses.length > 0 ? (
                    data.fixed_expenses.map((row, idx) => (
                      <tr key={`fixed-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px] truncate">
                          {row.name}
                        </td>
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mKey) => {
                          const val = row.monthly_values[mKey] || 0
                          return (
                            <td key={mKey} className={`py-2.5 px-3 text-right w-[95px] min-w-[95px] max-w-[95px] ${val > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                              {val > 0 ? formatCurrency(val) : '-'}
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/40 w-[110px] min-w-[110px] max-w-[110px]">
                          {formatCurrency(row.total_year)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="py-3 px-4 text-slate-400 dark:text-slate-500 italic font-sans text-center">
                        Nenhum custo fixo recorrente lançado ainda. (Despesas diretas sem cartão vinculado aparecerão aqui).
                      </td>
                    </tr>
                  )}

                  {/* SEÇÃO 2: CARTÕES DE CRÉDITO */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                    <td colSpan={14} className="py-1.5 px-4 font-bold text-slate-400 dark:text-slate-500">
                      💳 Faturas de Cartão de Crédito
                    </td>
                  </tr>

                  {data?.card_expenses && data.card_expenses.length > 0 ? (
                    data.card_expenses.map((cRow, idx) => (
                      <tr key={`card-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{cRow.name}</span>
                          </div>
                        </td>
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mKey) => {
                          const val = cRow.monthly_values[mKey] || 0
                          return (
                            <td key={mKey} className={`py-2.5 px-3 text-right w-[95px] min-w-[95px] max-w-[95px] ${val > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                              {val > 0 ? formatCurrency(val) : '-'}
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/40 w-[110px] min-w-[110px] max-w-[110px]">
                          {formatCurrency(cRow.total_year)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="py-3 px-4 text-slate-400 dark:text-slate-500 italic font-sans text-center">
                        Nenhum cartão cadastrado.
                      </td>
                    </tr>
                  )}
                </>
              )}

              {/* MODE 2: OWNERS (DE QUEM SÃO AS CONTAS) */}
              {activeMode === 'owners' && data?.owners_matrix && (
                Object.entries(data.owners_matrix).map(([ownerName, mVals]) => (
                  <tr key={ownerName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px]">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {ownerName[0]}
                        </div>
                        <span className="truncate">{ownerName}</span>
                      </div>
                    </td>
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mKey) => {
                      const val = mVals[mKey] || 0
                      return (
                        <td key={mKey} className={`py-2.5 px-3 text-right w-[95px] min-w-[95px] max-w-[95px] ${val > 0 ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-300 dark:text-slate-600'}`}>
                          {val > 0 ? formatCurrency(val) : '-'}
                        </td>
                      )
                    })}
                    <td className="py-2.5 px-4 text-right font-extrabold text-indigo-600 dark:text-indigo-400 bg-slate-50/80 dark:bg-slate-800/40 w-[110px] min-w-[110px] max-w-[110px]">
                      {formatCurrency(mVals['total'] || 0)}
                    </td>
                  </tr>
                ))
              )}

              {/* MODE 3: CATEGORIES */}
              {activeMode === 'categories' && data?.categories_matrix && (
                Object.entries(data.categories_matrix).map(([catName, mVals]) => (
                  <tr key={catName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px] truncate">
                      {catName}
                    </td>
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mKey) => {
                      const val = mVals[mKey] || 0
                      return (
                        <td key={mKey} className={`py-2.5 px-3 text-right w-[95px] min-w-[95px] max-w-[95px] ${val > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                          {val > 0 ? formatCurrency(val) : '-'}
                        </td>
                      )
                    })}
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/40 w-[110px] min-w-[110px] max-w-[110px]">
                      {formatCurrency(mVals['total'] || 0)}
                    </td>
                  </tr>
                ))
              )}

              {/* LINHA DE TOTAIS POR MÊS */}
              <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                <td className="py-3 px-4 font-sans font-black text-slate-900 dark:text-slate-100 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-xs w-[240px] min-w-[240px] max-w-[240px]">
                  TOTAL MENSAL
                </td>
                {data?.months.map((m) => (
                  <td key={m.month_key} className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 w-[95px] min-w-[95px] max-w-[95px]">
                    {m.grand_total > 0 ? formatCurrency(m.grand_total) : '-'}
                  </td>
                ))}
                <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 text-xs w-[110px] min-w-[110px] max-w-[110px]">
                  {data ? formatCurrency(data.grand_total_year) : 'R$ 0,00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
