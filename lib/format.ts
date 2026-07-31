export function fmt(n: number) {
  return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function gainClass(n: number) {
  return n >= 0 ? 'text-green-700' : 'text-red-700'
}
