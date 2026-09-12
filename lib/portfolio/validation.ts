// Currency options shared across Securities and Passive Investment forms —
// pure constants, no backend dependency (validation itself happens
// server-side in portfolio-manager-backend).

export const CURRENCIES = ['USD', 'CHF', 'GBP', 'CAD', 'SGD', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]
