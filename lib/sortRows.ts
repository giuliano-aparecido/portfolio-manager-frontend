import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

// Record<K, ...> forces an accessor for every key of K at the call site,
// so a forgotten/renamed sort key fails at compile time instead of
// silently sorting nothing (the failure mode a plain switch with no
// default would have).
export function sortRows<T, K extends string>(
  rows: T[],
  key: K,
  dir: SortDir,
  accessors: Record<K, (row: T) => string | number>,
): T[] {
  const accessor = accessors[key]
  const sorted = [...rows]
  sorted.sort((a, b) => {
    const aVal = accessor(a)
    const bVal = accessor(b)
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return dir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
  })
  return sorted
}

export function useSortState<K extends string>(initialKey: K, initialDir: SortDir = 'asc') {
  const [key, setKey] = useState<K>(initialKey)
  const [dir, setDir] = useState<SortDir>(initialDir)

  function toggle(newKey: K, switchDir: SortDir = 'asc') {
    if (key === newKey) {
      setDir(dir === 'asc' ? 'desc' : 'asc')
    } else {
      setKey(newKey)
      setDir(switchDir)
    }
  }

  return [key, dir, toggle] as const
}
