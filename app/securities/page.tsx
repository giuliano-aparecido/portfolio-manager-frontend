'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { apiFetch } from '@/lib/apiFetch'
import InvestmentForm from '@/components/InvestmentForm'
import CategoryBreakdown from '@/components/CategoryBreakdown'

interface OpenTickerRollup {
  ticker: string
  category: string
  nativeCurrency: string
  currentShares: number
  costBasisNative: number
  costBasisCHF: number
  currentPriceNative: number
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

interface ClosedTickerRollup {
  ticker: string
  dividendsCHF: number
  realizedGainCHF: number
}

interface PriceErrorEntry {
  ticker: string
  error: string
}

interface PortfolioRollup {
  openTickers: OpenTickerRollup[]
  closedTickers: ClosedTickerRollup[]
  priceErrors: PriceErrorEntry[]
  totalCostBasisCHF: number
  totalMarketValueCHF: number
  totalUnrealizedGainCHF: number
  totalDividendsCHF: number
  totalRealizedGainCHF: number
}

function fmt(n: number) {
  return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function gainClass(n: number) {
  return n >= 0 ? 'text-green-700' : 'text-red-700'
}

type SortKey = 'ticker' | 'shares' | 'costBasis' | 'price' | 'marketValue' | 'unrealizedGL' | 'portfolio' | 'unrealizedGLPercent' | 'unrealizedGLPercentCHF'
type DailyTableSortKey = 'ticker' | 'dailyChangePercent'
type SortDir = 'asc' | 'desc'

export default function SecuritiesPage() {
  const { status } = useSession()
  const [data, setData] = useState<PortfolioRollup | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAddInvestment, setShowAddInvestment] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('unrealizedGLPercentCHF')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [gainersSort, setGainersSort] = useState<DailyTableSortKey>('dailyChangePercent')
  const [gainersDir, setGainersDir] = useState<SortDir>('desc')
  const [losersSort, setLosersSort] = useState<DailyTableSortKey>('dailyChangePercent')
  const [losersDir, setLosersDir] = useState<SortDir>('asc')
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(180) // 3 minutes in seconds
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showRefreshSettings, setShowRefreshSettings] = useState(false)

  const isDevOrAuthenticated = process.env.NODE_ENV === 'development' || status === 'authenticated'

  useEffect(() => {
    // Middleware already blocks anonymous requests to this page server-side
    // in production, but this avoids a wasted backend round trip during the
    // brief moment useSession() takes to hydrate client-side (and defends
    // against ever firing this call with no session at all). Skipped in
    // development, where there's no sign-in step at all and the backend
    // auto-provisions a fixed user regardless of session state.
    if (!isDevOrAuthenticated) return
    load(false)
  }, [isDevOrAuthenticated])

  useEffect(() => {
    if (!isDevOrAuthenticated || autoRefreshInterval <= 0) return
    const interval = setInterval(() => load(false), autoRefreshInterval * 1000)
    return () => clearInterval(interval)
  }, [isDevOrAuthenticated, autoRefreshInterval])

  async function load(forceRefresh: boolean) {
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/portfolio-rollup${forceRefresh ? '?refresh=true' : ''}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      setData(body)
      setLastUpdated(new Date())
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load portfolio'
      console.error('Portfolio load error:', errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCreated() {
    setShowAddInvestment(false)
    load(false)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function getSortedTickers(tickers: OpenTickerRollup[], total: number) {
    const sorted = [...tickers]
    sorted.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortKey) {
        case 'ticker':
          aVal = a.ticker
          bVal = b.ticker
          break
        case 'shares':
          aVal = a.currentShares
          bVal = b.currentShares
          break
        case 'costBasis':
          aVal = a.costBasisNative
          bVal = b.costBasisNative
          break
        case 'price':
          aVal = a.currentPriceNative
          bVal = b.currentPriceNative
          break
        case 'marketValue':
          aVal = a.marketValueNative
          bVal = b.marketValueNative
          break
        case 'unrealizedGL':
          aVal = a.unrealizedGainNative
          bVal = b.unrealizedGainNative
          break
        case 'portfolio':
          aVal = a.marketValueCHF / total
          bVal = b.marketValueCHF / total
          break
        case 'unrealizedGLPercent':
          aVal = a.costBasisNative > 0 ? (a.unrealizedGainNative / a.costBasisNative) * 100 : 0
          bVal = b.costBasisNative > 0 ? (b.unrealizedGainNative / b.costBasisNative) * 100 : 0
          break
        case 'unrealizedGLPercentCHF':
          aVal = a.costBasisCHF > 0 ? (a.unrealizedGainCHF / a.costBasisCHF) * 100 : 0
          bVal = b.costBasisCHF > 0 ? (b.unrealizedGainCHF / b.costBasisCHF) * 100 : 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }

  function toggleGainersSort(key: DailyTableSortKey) {
    if (gainersSort === key) {
      setGainersDir(gainersDir === 'asc' ? 'desc' : 'asc')
    } else {
      setGainersSort(key)
      setGainersDir('desc')
    }
  }

  function toggleLosersSort(key: DailyTableSortKey) {
    if (losersSort === key) {
      setLosersDir(losersDir === 'asc' ? 'desc' : 'asc')
    } else {
      setLosersSort(key)
      setLosersDir('asc')
    }
  }

  function getSortedDailyTickers(tickers: OpenTickerRollup[], isGainers: boolean) {
    const sorted = [...tickers]
    const sortKeyVal = isGainers ? gainersSort : losersSort
    const sortDirVal = isGainers ? gainersDir : losersDir

    sorted.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortKeyVal) {
        case 'ticker':
          aVal = a.ticker
          bVal = b.ticker
          break
        case 'dailyChangePercent':
          aVal = a.dailyChangePercent
          bVal = b.dailyChangePercent
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirVal === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirVal === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }

  function SortHeader({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) {
    const isActive = sortKey === sortKeyVal
    const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
    return (
      <button
        onClick={() => toggleSort(sortKeyVal)}
        className="text-left font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer"
      >
        {label}
        {arrow}
      </button>
    )
  }

  function DailySortHeader({ label, sortKeyVal, isGainers }: { label: string; sortKeyVal: DailyTableSortKey; isGainers: boolean }) {
    const sortKeyVal_ = isGainers ? gainersSort : losersSort
    const sortDirVal = isGainers ? gainersDir : losersDir
    const isActive = sortKeyVal_ === sortKeyVal
    const arrow = isActive ? (sortDirVal === 'asc' ? ' ↑' : ' ↓') : ''
    return (
      <button
        onClick={() => (isGainers ? toggleGainersSort(sortKeyVal) : toggleLosersSort(sortKeyVal))}
        className="text-right font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer"
      >
        {label}
        {arrow}
      </button>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Securities</h1>
          {lastUpdated && (
            <div className="text-xs text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString('de-CH')}
              {autoRefreshInterval > 0 && ` (auto-refresh every ${autoRefreshInterval}s)`}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddInvestment(!showAddInvestment)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
          >
            Add investment
          </button>
          <button
            onClick={() => setShowRefreshSettings(!showRefreshSettings)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
          >
            ⚙️
          </button>
          <button
            onClick={() => load(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
          >
            {isLoading ? 'Refreshing…' : 'Refresh (live prices)'}
          </button>
        </div>
      </div>

      {showRefreshSettings && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Auto-refresh interval (seconds)</label>
              <input
                type="number"
                min="0"
                max="3600"
                step="30"
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Math.max(0, parseInt(e.target.value) || 0))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-32"
              />
              <div className="text-xs text-gray-600 mt-1">0 = disabled</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefreshInterval(180)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
              >
                3 min
              </button>
              <button
                onClick={() => setAutoRefreshInterval(300)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
              >
                5 min
              </button>
              <button
                onClick={() => setAutoRefreshInterval(0)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddInvestment && <InvestmentForm onSaved={handleCreated} onCancel={() => setShowAddInvestment(false)} />}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      {isLoading && !data && <p className="text-gray-500">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              ['Cost Basis', data.totalCostBasisCHF, null],
              ['Market Value', data.totalMarketValueCHF, null],
              ['Unrealized G/L', data.totalUnrealizedGainCHF, null],
              ['G/L %', data.totalCostBasisCHF > 0 ? (data.totalUnrealizedGainCHF / data.totalCostBasisCHF) * 100 : 0, '%'],
            ].map(([label, value, suffix]) => (
              <div key={label as string} className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500 uppercase">{label}</div>
                <div className={`text-lg font-mono font-semibold ${label === 'Unrealized G/L' || label === 'G/L %' ? gainClass(value as number) : 'text-gray-900'}`}>
                  {fmt(value as number)} {suffix || 'CHF'}
                </div>
              </div>
            ))}
          </div>

          <CategoryBreakdown tickers={data.openTickers} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="px-4 py-2 text-xs font-semibold text-green-700 uppercase border-b bg-green-50">
                Gainers (today)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left"><button onClick={() => toggleGainersSort('ticker')} className="font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer">{gainersSort === 'ticker' ? (gainersDir === 'asc' ? 'Ticker ↑' : 'Ticker ↓') : 'Ticker'}</button></th>
                    <th className="px-4 py-3"><button onClick={() => toggleGainersSort('dailyChangePercent')} className="font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer w-full text-right">{gainersSort === 'dailyChangePercent' ? (gainersDir === 'asc' ? 'Price Change % ↑' : 'Price Change % ↓') : 'Price Change %'}</button></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getSortedDailyTickers(data.openTickers.filter((t) => t.dailyChangePercent > 0), true).map((t) => (
                      <tr key={t.ticker} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          <Link href={`/ticker/${t.ticker}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {t.ticker}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
                          {t.dailyChangePercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="px-4 py-2 text-xs font-semibold text-red-700 uppercase border-b bg-red-50">
                Losers (today)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left"><button onClick={() => toggleLosersSort('ticker')} className="font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer">{losersSort === 'ticker' ? (losersDir === 'asc' ? 'Ticker ↑' : 'Ticker ↓') : 'Ticker'}</button></th>
                    <th className="px-4 py-3"><button onClick={() => toggleLosersSort('dailyChangePercent')} className="font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer w-full text-right">{losersSort === 'dailyChangePercent' ? (losersDir === 'asc' ? 'Price Change % ↑' : 'Price Change % ↓') : 'Price Change %'}</button></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getSortedDailyTickers(data.openTickers.filter((t) => t.dailyChangePercent < 0), false).map((t) => (
                      <tr key={t.ticker} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          <Link href={`/ticker/${t.ticker}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {t.ticker}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">
                          {t.dailyChangePercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left"><SortHeader label="Ticker" sortKeyVal="ticker" /></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Shares" sortKeyVal="shares" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Cost Basis (native)" sortKeyVal="costBasis" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Market Value (CHF)" sortKeyVal="marketValue" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Unrealized G/L (CHF)" sortKeyVal="unrealizedGL" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="G/L % (CHF)" sortKeyVal="unrealizedGLPercentCHF" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Portfolio %" sortKeyVal="portfolio" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedTickers(data.openTickers, data.totalMarketValueCHF).map((t) => {
                  const glPercent = t.costBasisNative > 0 ? (t.unrealizedGainNative / t.costBasisNative) * 100 : 0
                  const glPercentCHF = t.costBasisCHF > 0 ? (t.unrealizedGainCHF / t.costBasisCHF) * 100 : 0
                  const portfolioPercent = (t.marketValueCHF / data.totalMarketValueCHF) * 100
                  return (
                    <tr key={t.ticker} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        <Link href={`/ticker/${t.ticker}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {t.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.category}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">{t.currentShares.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {fmt(t.costBasisNative)} {t.nativeCurrency}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(t.marketValueCHF)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(t.unrealizedGainCHF)}`}>
                        {fmt(t.unrealizedGainCHF)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(glPercentCHF)}`}>
                        {glPercentCHF.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {portfolioPercent.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.closedTickers.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">
                Closed positions (no market value)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Ticker</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Realized Gain (CHF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.closedTickers.map((t) => (
                    <tr key={t.ticker} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        <Link href={`/ticker/${t.ticker}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {t.ticker}
                        </Link>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(t.realizedGainCHF)}`}>
                        {fmt(t.realizedGainCHF)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.priceErrors.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              <div className="font-semibold mb-1">Price fetch failed for {data.priceErrors.length} ticker(s) — excluded from totals above:</div>
              <ul className="list-disc list-inside">
                {data.priceErrors.map((e) => (
                  <li key={e.ticker}>
                    {e.ticker}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
