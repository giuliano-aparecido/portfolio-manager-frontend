export const CURRENCIES = ['USD', 'CHF', 'GBP', 'CAD', 'SGD', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]
