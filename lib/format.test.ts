import { describe, expect, it } from 'vitest'
import { fmt, gainClass } from './format'

describe('fmt', () => {
  it('formats with Swiss thousands separators and 2 decimal places', () => {
    expect(fmt(1234.5)).toBe("1'234.50")
  })

  it('always shows exactly 2 decimal places', () => {
    expect(fmt(1000)).toBe("1'000.00")
    expect(fmt(0.999)).toBe('1.00')
  })

  it('formats negative numbers', () => {
    expect(fmt(-42.1)).toBe('-42.10')
  })
})

describe('gainClass', () => {
  it('returns green for non-negative values', () => {
    expect(gainClass(0)).toBe('text-green-700')
    expect(gainClass(10)).toBe('text-green-700')
  })

  it('returns red for negative values', () => {
    expect(gainClass(-0.01)).toBe('text-red-700')
  })
})
