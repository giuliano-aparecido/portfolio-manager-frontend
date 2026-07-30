// Validation enums for the Passive Investment (cash/pension/fund) asset
// class — pure constants used for form dropdowns; actual validation
// happens server-side in portfolio-manager-backend.

import { CURRENCIES, isValidCurrency, type Currency } from '@/lib/portfolio/validation'

export { CURRENCIES, isValidCurrency, type Currency }

export const PASSIVE_TYPES = ['CASH', 'PENSION_FUND', 'INVESTMENT_FUND', 'OTHER'] as const
export type PassiveType = (typeof PASSIVE_TYPES)[number]

export function isValidPassiveType(value: unknown): value is PassiveType {
  return typeof value === 'string' && PASSIVE_TYPES.includes(value as PassiveType)
}

export const PASSIVE_TXN_TYPES = ['DEPOSIT', 'WITHDRAWAL'] as const
export type PassiveTxnType = (typeof PASSIVE_TXN_TYPES)[number]

export function isValidPassiveTxnType(value: unknown): value is PassiveTxnType {
  return typeof value === 'string' && PASSIVE_TXN_TYPES.includes(value as PassiveTxnType)
}

export const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export function isValidRecurringFrequency(value: unknown): value is RecurringFrequency {
  return typeof value === 'string' && RECURRING_FREQUENCIES.includes(value as RecurringFrequency)
}

export const MIN_GAIN_LOSS_PCT = -100

export function isValidGainLossPct(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_GAIN_LOSS_PCT
}
