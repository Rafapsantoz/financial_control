import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit2,
  Home,
  Lightbulb,
  ListChecks,
  MapPin,
  PieChart,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { FinancialPrinciple, Goal, LivingScenario } from '../../types'
import {
  createGoal,
  deleteGoal,
  fetchGoals,
  fetchPrinciples,
  fetchScenarios,
  updateGoal,
} from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal'

export const BudgetAnalysisTab: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([])
  const [scenarios, setScenarios] = useState<LivingScenario[]>([])
  const [principles, setPrinciples] = useState<FinancialPrinciple[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Goal Form State
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

  // Expandable principles
  const [expandedPrinciples, setExpandedPrinciples] = useState<Record<number, boolean>>({})

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [g, s, p] = await Promise.all([
        fetchGoals(),
        fetchScenarios(),
        fetchPrinciples(),
      ])
      setGoals(g)
      setScenarios(s)
      setPrinciples(p)
    } catch (err) {
      console.error('Erro ao carregar dados do orçamento:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

  const togglePrinciple = (step: number) => {
    setExpandedPrinciples((prev) => ({ ...prev, [step]: !prev[step] }))
  }

  // Budget Pots Calculation (Rule of the Spreadsheet)
  const budgetPockets = [
    { name: 'Custo Fixo Essencial', percent: 35, color: 'bg-emerald-500', desc: 'Moradia, mercado, saúde, contas fixas e pets' },
    { name: 'Liberdade Financeira', percent: 25, color: 'bg-indigo-500', desc: 'Investimentos, reserva de emergência e runway' },
    { name: 'Conforto', percent: 15, color: 'bg-teal-500', desc: 'Faz bem para a vida mas não é estritamente obrigatório' },
    { name: 'Metas & Projetos', percent: 10, color: 'bg-amber-500', desc: 'Viagens, compras planejadas da casa' },
    { name: 'Prazeres & Lazer', percent: 10, color: 'bg-rose-500', desc: 'Shows, jogos, jantares e passeios' },
    { name: 'Conhecimento & Carreira', percent: 5, color: 'bg-blue-500', desc: 'Cursos, livros e capacitação profissional' },
  ]

  return (
    <div className="space-y-8">
      {/* 1. SEPARANDO O SALÁRIO & OBJETIVOS (METODOLOGIA DA PLANILHA) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
              Diretriz da sua planilha: alocação percentual balanceada entre presente, segurança e futuro
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800 self-start md:self-auto">
            100% da Renda Distribuída
          </span>
        </div>

        {/* Visual Percent Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 mb-6 shadow-inner">
          {budgetPockets.map((p, idx) => (
            <div
              key={idx}
              style={{ width: `${p.percent}%` }}
              className={`${p.color} transition-all relative group cursor-pointer`}
              title={`${p.name}: ${p.percent}%`}
            />
          ))}
        </div>

        {/* Pots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {budgetPockets.map((pot, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${pot.color}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {pot.name}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {pot.percent}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {pot.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. WISHLIST & METAS DE COMPRAS (DA PLANILHA) */}
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

      {/* 3. SIMULADOR DE MUDANÇA DE CIDADE (BRODOWSKI vs RIBEIRÃO PRETO) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Building className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Simulador de Cenários: Mudança de Cidade & Moradia
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Comparação dos custos fixos planejados na planilha (Brodowski vs Ribeirão Preto) e o impacto no seu orçamento anual
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {sc.city}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.has_home_office ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {sc.has_home_office ? 'Com Home Office' : 'Sem Home Office'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                  {sc.title}
                </h4>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Aluguel Estimado:</span>
                    <b className="text-slate-900 dark:text-slate-100">{formatCurrency(sc.estimated_rent)}/mês</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Contas (Luz, Net, etc.):</span>
                    <b className="text-slate-900 dark:text-slate-100">{formatCurrency(sc.estimated_bills)}/mês</b>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
                    <span>Custo Mensal:</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatCurrency(sc.total_monthly)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="block font-semibold text-slate-700 dark:text-slate-300">
                  Impacto Anual: {formatCurrency(sc.annual_impact)}
                </span>
                <span className="italic mt-1 block">"{sc.notes}"</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. OS 15 PRINCÍPIOS DA PLANILHA (CHECKLIST & METODOLOGIA) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <ListChecks className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Metodologia em 15 Passos: Os Princípios da Sua Planilha
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          As 15 diretrizes estratégicas que você definiu para blindar seu patrimônio e manter o controle financeiro
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {principles.map((pr) => {
            const isExpanded = !!expandedPrinciples[pr.step]
            return (
              <div
                key={pr.step}
                onClick={() => togglePrinciple(pr.step)}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      {pr.step}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {pr.title}
                    </h5>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {pr.description}
                </p>

                {isExpanded && (
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    <p className="leading-relaxed">{pr.description}</p>
                    <span className="inline-block mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      Categoria: {pr.category}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* MODAL: NOVA META */}
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

      {/* Modal Customizado de Exclusão da Wishlist / Meta */}
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
