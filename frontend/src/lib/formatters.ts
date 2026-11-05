export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

export function formatDate(dateString: string): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) {
      // Handles YYYY-MM-DD
      const parts = dateString.split('-')
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
      return dateString
    }
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  } catch {
    return dateString
  }
}

export function formatMonthName(monthStr: string): string {
  // input: "2026-11" -> "Novembro de 2026"
  if (!monthStr || !monthStr.includes('-')) return monthStr
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' })
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`
}
