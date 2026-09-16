export interface OpenTickerRollup {
  ticker: string
  category: string
  nativeCurrency: string
  currentShares: number
  costBasisNative: number
  costBasisCHF: number
  currentPriceNative: number
  currentFxRateToCHF: number
  marketValueNative: number
  marketValueCHF: number
  unrealizedGainNative: number
  unrealizedGainCHF: number
  dividendsCHF: number
  priceTimestamp: string
  priceSource: string
  dailyChangePercent: number
  dailyChange: number
}

export interface ClosedTickerRollup {
  ticker: string
  dividendsCHF: number
  realizedGainCHF: number
}

export interface TickerPriceError {
  ticker: string
  error: string
}

export interface PortfolioRollup {
  openTickers: OpenTickerRollup[]
  closedTickers: ClosedTickerRollup[]
  priceErrors: TickerPriceError[]
  totalCostBasisCHF: number
  totalMarketValueCHF: number
  totalUnrealizedGainCHF: number
  totalDividendsCHF: number
  totalRealizedGainCHF: number
}
