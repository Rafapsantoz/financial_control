import React, { useState, useEffect } from 'react'
import {
  Compass,
  DollarSign,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  Wallet,
  X,
  Check,
} from 'lucide-react'
import { Goal } from '../../types'
import {
  createGoal,
  deleteGoal,
  fetchGoals,
  updateGoal,
} from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal'

export interface BudgetPocket {
  id: string
  name: string
  percent: number
  color: string
  desc: string
}

// Presets sugeridos de divisão de renda / salário
const BUDGET_PRESETS: {
  id: string
  name: string
  badge: string
  description: string
  pockets: BudgetPocket[]
}[] = [
  {
    id: 'rpsec-equilibrado',
    name: 'RPsec Equilibrado (Recomendado)',
    badge: 'Mais Popular',
    description: 'Equilíbrio ideal entre custos fixos de vida, reserva/liberdade e qualidade de vida.',
    pockets: [
      { id: '1', name: 'Custo Fixo Essencial', percent: 35, color: 'bg-emerald-500', desc: 'Moradia, mercado, saúde, contas fixas e pets' },
      { id: '2', name: 'Liberdade Financeira', percent: 25, color: 'bg-indigo-500', desc: 'Investimentos, reserva de emergência e runway' },
      { id: '3', name: 'Conforto', percent: 15, color: 'bg-teal-500', desc: 'Faz bem para a vida mas não é estritamente obrigatório' },
      { id: '4', name: 'Metas & Projetos', percent: 10, color: 'bg-amber-500', desc: 'Viagens, compras planejadas da casa' },
      { id: '5', name: 'Prazeres & Lazer', percent: 10, color: 'bg-rose-500', desc: 'Shows, jogos, jantares e passeios' },
      { id: '6', name: 'Conhecimento & Carreira', percent: 5, color: 'bg-blue-500', desc: 'Cursos, livros e capacitação profissional' },
    ],
  },
  {
    id: 'regra-50-30-20',
    name: 'Regra Clássica 50-30-20',
    badge: 'Tradicional',
    description: 'Método simples e consolidado: 50% necessidades, 30% desejos e 20% futuro.',
    pockets: [
      { id: '1', name: 'Necessidades Essenciais', percent: 50, color: 'bg-emerald-500', desc: 'Moradia, alimentação, contas básicas e saúde' },
      { id: '2', name: 'Estilo de Vida & Desejos', percent: 30, color: 'bg-indigo-500', desc: 'Lazer, passeios, compras e conforto pessoal' },
      { id: '3', name: 'Investimentos & Futuro', percent: 20, color: 'bg-amber-500', desc: 'Reserva de emergência, aportes e aposentadoria' },
    ],
  },
  {
    id: 'investidor-fire',
    name: 'Investidor FIRE / Acelerado',
    badge: 'Agressivo',
    description: 'Foco no acúmulo acelerado de patrimônio e independência financeira em menos tempo.',
    pockets: [
      { id: '1', name: 'Custos Fixos Enxutos', percent: 40, color: 'bg-emerald-500', desc: 'Moradia e despesas essenciais otimizadas ao máximo' },
      { id: '2', name: 'Aportes & Liberdade (FIRE)', percent: 40, color: 'bg-indigo-500', desc: 'Investimentos em renda passiva e ativos rentáveis' },
      { id: '3', name: 'Metas, Conforto & Lazer', percent: 20, color: 'bg-rose-500', desc: 'Qualidade de vida sem perder o foco financeiro' },
    ],
  },
  {
    id: 'inicio-carreira',
    name: 'Início de Carreira / Blindagem',
    badge: 'Segurança',
    description: 'Foco em pagar as contas do mês, quitar dívidas e montar a primeira reserva de segurança.',
    pockets: [
      { id: '1', name: 'Sobrevivência & Contas Fixas', percent: 60, color: 'bg-emerald-500', desc: 'Tudo o que é vital para manter o mês rodando' },
      { id: '2', name: 'Reserva de Emergência', percent: 20, color: 'bg-indigo-500', desc: 'Poupança ou CDB de liquidez diária para imprevistos' },
      { id: '3', name: 'Crescimento & Estudos', percent: 10, color: 'bg-blue-500', desc: 'Cursos, livros, certificações e ferramentas' },
      { id: '4', name: 'Lazer & Recompensa', percent: 10, color: 'bg-amber-500', desc: 'Pequenos momentos de descanso merecido' },
    ],
  },
]

const COLOR_OPTIONS = [
  { label: 'Esmeralda', value: 'bg-emerald-500' },
  { label: 'Índigo', value: 'bg-indigo-500' },
  { label: 'Teal', value: 'bg-teal-500' },
  { label: 'Âmbar', value: 'bg-amber-500' },
  { label: 'Rosa', value: 'bg-rose-500' },
  { label: 'Azul', value: 'bg-blue-500' },
  { label: 'Roxo', value: 'bg-purple-500' },
  { label: 'Ciano', value: 'bg-cyan-500' },
]

export const BudgetAnalysisTab: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Salário Mensal Informado pelo Usuário
  const [monthlySalary, setMonthlySalary] = useState<string>(() => {
    return localStorage.getItem('fo_monthly_salary') || '5000'
  })

  // Potes de Orçamento
  const [pockets, setPockets] = useState<BudgetPocket[]>(() => {
    try {
      const saved = localStorage.getItem('fo_budget_pockets')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // fallback
    }
    return BUDGET_PRESETS[0].pockets
  })

  // Modal de Personalização dos Potes / Divisão
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false)
  const [tempPockets, setTempPockets] = useState<BudgetPocket[]>(pockets)

  // Wishlist / Goal Form State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newSaved, setNewSaved] = useState('')
  const [newCategory, setNewCategory] = useState('Essencial')
  const [newPriority, setNewPriority] = useState('Média')
  const [newComment, setNewComment] = useState('')

  // Goal Deletion State
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null)
  const [isDeletingGoal, setIsDeletingGoal] = useState<boolean>(false)

  const loadData = async () => {
    try {
      setIsLoading(true)
      const g = await fetchGoals()
      setGoals(g)
    } catch (err) {
      console.error('Erro ao carregar dados do orçamento:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSalaryChange = (val: string) => {
    setMonthlySalary(val)
    localStorage.setItem('fo_monthly_salary', val)
  }

  const handleOpenPocketModal = () => {
    setTempPockets(JSON.parse(JSON.stringify(pockets)))
    setIsPocketModalOpen(true)
  }

  const handleApplyPreset = (presetPockets: BudgetPocket[]) => {
    setTempPockets(JSON.parse(JSON.stringify(presetPockets)))
  }

  const handleUpdateTempPocket = (index: number, field: keyof BudgetPocket, value: any) => {
    setTempPockets((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleAddTempPocket = () => {
    const newId = String(Date.now())
    const nextColor = COLOR_OPTIONS[tempPockets.length % COLOR_OPTIONS.length].value
    setTempPockets((prev) => [
      ...prev,
      { id: newId, name: 'Novo Pote', percent: 10, color: nextColor, desc: 'Descrição do objetivo deste pote' },
    ])
  }

  const handleRemoveTempPocket = (index: number) => {
    if (tempPockets.length <= 1) {
      alert('Você deve manter ao menos um pote de divisão.')
      return
    }
    setTempPockets((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSavePockets = () => {
    setPockets(tempPockets)
    localStorage.setItem('fo_budget_pockets', JSON.stringify(tempPockets))
    setIsPocketModalOpen(false)
  }

  const handleResetToDefault = () => {
    const defaultPockets = BUDGET_PRESETS[0].pockets
    setTempPockets(JSON.parse(JSON.stringify(defaultPockets)))
  }

  // Wishlist Actions
  const handleToggleGoalCompleted = async (goal: Goal) => {
    try {
      await updateGoal(goal.id, {
        is_completed: !goal.is_completed,
        saved_amount: !goal.is_completed ? goal.target_amount : goal.saved_amount,
      })
      await loadData()
    } catch (err: any) {
      alert(`Erro ao atualizar meta: ${err.message}`)
    }
  }

  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete) return
    try {
      setIsDeletingGoal(true)
      await deleteGoal(goalToDelete.id)
      setGoalToDelete(null)
      await loadData()
    } catch (err: any) {
      alert(`Erro ao excluir meta da wishlist: ${err.message}`)
    } finally {
      setIsDeletingGoal(false)
    }
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      await createGoal({
        title: newTitle.trim(),
        target_amount: parseFloat(newTarget) || 0,
        saved_amount: parseFloat(newSaved) || 0,
        category: newCategory,
        priority: newPriority,
        is_completed: false,
        comment: newComment.trim() || undefined,
      })
      setIsGoalModalOpen(false)
      setNewTitle('')
      setNewTarget('')
      setNewSaved('')
      setNewComment('')
      await loadData()
    } catch (err: any) {
      alert(`Erro ao cadastrar meta: ${err.message}`)
    }
  }

  const numericSalary = parseFloat(monthlySalary) || 0
  const totalPercent = pockets.reduce((acc, p) => acc + (Number(p.percent) || 0), 0)
  const tempTotalPercent = tempPockets.reduce((acc, p) => acc + (Number(p.percent) || 0), 0)

  return (
    <div className="space-y-8">
      {/* 1. SEPARANDO O SALÁRIO & DIVISÃO ESTRATÉGICA DOS POTES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        {/* Header com Informações, Salário e Botão de Configuração */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Compass className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Divisão Estratégica do Salário & Potes Financeiros
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Defina como você deseja fatiar a sua renda mensal entre despesas essenciais, liberdade, conforto e projetos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Input do Salário Mensal para cálculo dinâmico */}
            <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Meu Salário: R$
              </span>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="5000"
                value={monthlySalary}
                onChange={(e) => handleSalaryChange(e.target.value)}
                className="w-24 bg-transparent text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            {/* Status da Soma dos % */}
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                totalPercent === 100
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {totalPercent === 100 ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  100% Distribuído
                </>
              ) : (
                `Soma: ${totalPercent}% (${totalPercent < 100 ? `faltam ${100 - totalPercent}%` : `excede ${totalPercent - 100}%`})`
              )}
            </span>

            {/* Botão para Configurar Divisão e Presets */}
            <button
              onClick={handleOpenPocketModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Personalizar divisão de potes ou escolher sugestões prontas"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Configurar Divisão</span>
            </button>
          </div>
        </div>

        {/* Visual Percent Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 mb-6 shadow-inner">
          {pockets.map((p, idx) => (
            <div
              key={p.id || idx}
              style={{ width: `${Math.max(1, p.percent)}%` }}
              className={`${p.color} transition-all relative group cursor-pointer`}
              title={`${p.name}: ${p.percent}% ${numericSalary > 0 ? `(${formatCurrency(numericSalary * (p.percent / 100))})` : ''}`}
            />
          ))}
        </div>

        {/* Pots Grid com % e Valor Calculado em R$ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {pockets.map((pot, idx) => {
            const potValue = numericSalary > 0 ? (numericSalary * pot.percent) / 100 : 0
            return (
              <div
                key={pot.id || idx}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${pot.color}`} />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {pot.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-600/60">
                      {pot.percent}%
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {pot.desc}
                  </p>
                </div>

                {numericSalary > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
                      Valor no Mês
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(potValue)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. LISTA DE COMPRAS & METAS PLANEJADAS (WISHLIST) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Lista de Compras & Metas Planejadas (Wishlist)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Itens e metas financeiras acompanhados com objetivo e progresso de poupança
            </p>
          </div>

          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Meta / Item</span>
          </button>
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((g) => {
            const progress = g.target_amount > 0 ? Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100)) : 0
            return (
              <div
                key={g.id}
                className={`p-4 rounded-xl border transition-all ${
                  g.is_completed
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className={`text-sm font-bold ${g.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {g.title}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {g.category} • Prioridade {g.priority}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleGoalCompleted(g)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        g.is_completed
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600'
                      }`}
                      title={g.is_completed ? 'Marcar como pendente' : 'Marcar como comprado/concluído'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setGoalToDelete(g)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                      title={`Excluir "${g.title}" da lista de desejos`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between text-xs mt-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Guardado: <b className="text-slate-800 dark:text-slate-200">{formatCurrency(g.saved_amount)}</b>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Alvo: {formatCurrency(g.target_amount)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    style={{ width: `${progress}%` }}
                    className={`h-full transition-all duration-300 ${g.is_completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  />
                </div>

                {g.comment && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 italic">
                    "{g.comment}"
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* MODAL: PERSONALIZAR DIVISÃO DO SALÁRIO & SUGESTÕES PRONTAS */}
      {isPocketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Como Você Quer Dividir Seu Salário?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Escolha uma metodologia pronta ou personalize cada pote e porcentagem à vontade.
                </p>
              </div>
              <button
                onClick={() => setIsPocketModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sugestões Prontas (Presets) */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Sugestões Prontas (Clique para aplicar)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BUDGET_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.pockets)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900 group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Potes em Edição */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Potes Atuais & Porcentagens
                </label>
                <button
                  type="button"
                  onClick={handleAddTempPocket}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Pote</span>
                </button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {tempPockets.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                  >
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={p.color}
                        onChange={(e) => handleUpdateTempPocket(idx, 'color', e.target.value)}
                        className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        {COLOR_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdateTempPocket(idx, 'name', e.target.value)}
                        placeholder="Nome do Pote"
                        className="flex-1 sm:w-44 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={p.desc}
                        onChange={(e) => handleUpdateTempPocket(idx, 'desc', e.target.value)}
                        placeholder="O que entra neste pote?"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <div className="flex items-center bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={p.percent}
                          onChange={(e) => handleUpdateTempPocket(idx, 'percent', parseInt(e.target.value) || 0)}
                          className="w-12 text-xs font-bold font-mono text-right bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 ml-1">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveTempPocket(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                        title="Remover este pote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer do Modal com Validação de 100% e Botões */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    tempTotalPercent === 100
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  Soma Total: {tempTotalPercent}% {tempTotalPercent === 100 ? '✓ (100%)' : `(Ajuste para dar 100%)`}
                </span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPocketModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePockets}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Salvar Divisão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA META DA WISHLIST */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              Nova Meta ou Item da Wishlist
            </h3>

            <form onSubmit={handleCreateGoal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Item / Meta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cadeira Ergonômica, Tela mosqueteira"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Preço Alvo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Já Guardado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newSaved}
                    onChange={(e) => setNewSaved(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classificação
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                  >
                    <option value="Essencial">Essencial</option>
                    <option value="Importante">Importante</option>
                    <option value="Conforto">Conforto</option>
                    <option value="Metas">Metas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observação / Justificativa
                </label>
                <input
                  type="text"
                  placeholder="Ex: Melhorar ergonomia no home office"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE GOAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(goalToDelete)}
        title="Excluir da Lista de Desejos?"
        subtitle="Esta ação removerá o objetivo do seu planejamento financeiro."
        warningText="O histórico e o progresso acumulado deste item serão descartados."
        confirmButtonText="Sim, Excluir Objetivo"
        isDeleting={isDeletingGoal}
        onClose={() => setGoalToDelete(null)}
        onConfirm={handleConfirmDeleteGoal}
      >
        {goalToDelete && (
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                {goalToDelete.title}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {goalToDelete.category} • {goalToDelete.priority}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Guardado: <b className="text-slate-700 dark:text-slate-300">{formatCurrency(goalToDelete.saved_amount)}</b>
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Alvo: {formatCurrency(goalToDelete.target_amount)}
              </span>
            </div>
            {goalToDelete.comment && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-1 truncate">
                "{goalToDelete.comment}"
              </p>
            )}
          </div>
        )}
      </ConfirmDeleteModal>
    </div>
  )
}
