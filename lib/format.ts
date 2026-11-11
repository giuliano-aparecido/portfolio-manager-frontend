export function fmt(n: number) {
  return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Annualized return for display; null means "not meaningful" (e.g. under
 * 180 days of history), shown as an em dash rather than a misleading 0. */
export function fmtPct(n: number | null | undefined) {
  return n == null ? '—' : `${fmt(n)} %`
}

export function gainClass(n: number) {
  return n >= 0 ? 'text-green-700' : 'text-red-700'
}
