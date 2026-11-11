export function fmt(n: number) {
  return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Annualized return for display; null means "not meaningful" (e.g. under
 * 30 days of history), shown as an em dash rather than a misleading 0. */
export function fmtPct(n: number | null | undefined) {
  return n == null ? '—' : `${fmt(n)} %`
}

/** Caption for an annualized figure resting on under a year of history,
 * where it is a projection of a short period; empty once a year is covered. */
export function historyCaption(spanDays: number | null | undefined) {
  if (spanDays == null || spanDays >= 365) return ''
  const months = Math.max(1, Math.round(spanDays / 30.4))
  return `Based on ${months} month${months === 1 ? '' : 's'} of history`
}

export function gainClass(n: number) {
  return n >= 0 ? 'text-green-700' : 'text-red-700'
}
