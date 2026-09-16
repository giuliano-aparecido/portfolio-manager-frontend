export interface PassiveTransactionRow {
  id: number
  date: string
  type: string
  amountNative: number
  notes: string | null
}

export interface PassiveRecurringDepositInfo {
  id: number
  amountNative: number
  startDate: string
  frequency: string
  endDate: string | null
  notes: string | null
}

export interface PassiveInvestmentDetail {
  id: number
  name: string
  type: string
  currency: string
  costBasisNative: number
  costBasisCHF: number
  marketValueNative: number
  marketValueCHF: number
  unrealizedGainNative: number
  unrealizedGainCHF: number
  gainLossPct: number | null
  gainLossUpdatedAt: string | null
  fxRateToCHF: number | null
  fxError: string | null
  notes: string | null
  transactions: PassiveTransactionRow[]
  recurringDeposit: PassiveRecurringDepositInfo | null
}

export interface PassiveInvestmentRollupRow {
  id: number
  name: string
  type: string
  currency: string
  costBasisNative: number
  costBasisCHF: number
  marketValueNative: number
  marketValueCHF: number
  unrealizedGainNative: number
  unrealizedGainCHF: number
  gainLossPct: number | null
  gainLossUpdatedAt: string | null
  notes: string | null
}

export interface PassiveFxError {
  currency: string
  error: string
  affectedInvestments: string[]
}

export interface PassiveRollup {
  rows: PassiveInvestmentRollupRow[]
  fxErrors: PassiveFxError[]
  totalCostBasisCHF: number
  totalMarketValueCHF: number
  totalUnrealizedGainCHF: number
}
