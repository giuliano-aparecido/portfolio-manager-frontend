// Validation enums for the Passive Investment (cash/pension/fund) asset
// class — pure constants used for form dropdowns; actual validation
// happens server-side in portfolio-manager-backend.

import { CURRENCIES, type Currency } from '@/lib/portfolio/validation'

export { CURRENCIES, type Currency }

export const PASSIVE_TYPES = ['CASH', 'PENSION_FUND', 'INVESTMENT_FUND', 'OTHER'] as const
export type PassiveType = (typeof PASSIVE_TYPES)[number]

export const PASSIVE_TXN_TYPES = ['DEPOSIT', 'WITHDRAWAL'] as const
export type PassiveTxnType = (typeof PASSIVE_TXN_TYPES)[number]

export const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]
