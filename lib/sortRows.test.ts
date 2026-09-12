import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { sortRows, useSortState } from './sortRows'

interface Row {
  name: string
  value: number
}

const accessors = {
  name: (r: Row) => r.name,
  value: (r: Row) => r.value,
}

describe('sortRows', () => {
  const rows: Row[] = [
    { name: 'banana', value: 2 },
    { name: 'apple', value: 3 },
    { name: 'cherry', value: 1 },
  ]

  it('sorts by a string accessor ascending', () => {
    expect(sortRows(rows, 'name', 'asc', accessors).map((r) => r.name)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('sorts by a string accessor descending', () => {
    expect(sortRows(rows, 'name', 'desc', accessors).map((r) => r.name)).toEqual(['cherry', 'banana', 'apple'])
  })

  it('sorts by a number accessor ascending', () => {
    expect(sortRows(rows, 'value', 'asc', accessors).map((r) => r.value)).toEqual([1, 2, 3])
  })

  it('sorts by a number accessor descending', () => {
    expect(sortRows(rows, 'value', 'desc', accessors).map((r) => r.value)).toEqual([3, 2, 1])
  })

  it('does not mutate the input array', () => {
    const original = [...rows]
    sortRows(rows, 'value', 'asc', accessors)
    expect(rows).toEqual(original)
  })

  it('returns an empty array unchanged', () => {
    expect(sortRows([], 'value', 'asc', accessors)).toEqual([])
  })
})

describe('useSortState', () => {
  it('flips direction when toggling the same key', () => {
    const { result } = renderHook(() => useSortState<'a' | 'b'>('a'))
    expect(result.current[0]).toBe('a')
    expect(result.current[1]).toBe('asc')

    act(() => result.current[2]('a'))
    expect(result.current[0]).toBe('a')
    expect(result.current[1]).toBe('desc')

    act(() => result.current[2]('a'))
    expect(result.current[1]).toBe('asc')
  })

  it('switches to a new key with the default asc direction', () => {
    const { result } = renderHook(() => useSortState<'a' | 'b'>('a'))
    act(() => result.current[2]('b'))
    expect(result.current[0]).toBe('b')
    expect(result.current[1]).toBe('asc')
  })

  it('switches to a new key with an overridden direction', () => {
    const { result } = renderHook(() => useSortState<'a' | 'b'>('a'))
    act(() => result.current[2]('b', 'desc'))
    expect(result.current[0]).toBe('b')
    expect(result.current[1]).toBe('desc')
  })
})
