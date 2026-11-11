import { describe, expect, it } from 'vitest'
import { fmt, fmtPct, gainClass, historyCaption } from './format'

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

describe('fmtPct', () => {
  it('formats a percentage with 2 decimals', () => {
    expect(fmtPct(12.345)).toBe('12.35 %')
    expect(fmtPct(-3)).toBe('-3.00 %')
  })

  it('shows an em dash when the value is not meaningful', () => {
    expect(fmtPct(null)).toBe('—')
    expect(fmtPct(undefined)).toBe('—')
  })
})

describe('historyCaption', () => {
  it('says how much history a short-window figure rests on', () => {
    expect(historyCaption(150)).toBe('Based on 5 months of history')
    expect(historyCaption(35)).toBe('Based on 1 month of history')
  })

  it('is empty once a full year is covered, or when unknown', () => {
    expect(historyCaption(365)).toBe('')
    expect(historyCaption(430)).toBe('')
    expect(historyCaption(null)).toBe('')
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
