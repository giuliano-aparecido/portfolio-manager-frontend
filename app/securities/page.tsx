'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/apiFetch'
import { fmt, gainClass } from '@/lib/format'
import InvestmentForm, { type ExistingTicker } from '@/components/InvestmentForm'
import { useAuthGatedEffect, isDevOrAuthenticated } from '@/lib/useAuthGatedEffect'
import { sortRows, useSortState } from '@/lib/sortRows'
import SortHeader from '@/components/SortHeader'

// recharts pulls in a sizeable bundle — load it only in the browser, only
// once this page actually renders the chart, instead of in every page's
// initial JS bundle.
const CategoryBreakdown = dynamic(() => import('@/components/CategoryBreakdown'), { ssr: false })

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

// Same shape the backend returns from GET /portfolio/tickers.
type RegisteredTicker = ExistingTicker

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

type SortKey = 'ticker' | 'shares' | 'costBasis' | 'price' | 'marketValue' | 'unrealizedGL' | 'portfolio' | 'unrealizedGLPercent' | 'unrealizedGLPercentCHF'
type DailyTableSortKey = 'ticker' | 'dailyChangePercent'

export default function SecuritiesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<PortfolioRollup | null>(null)
  const [registeredTickers, setRegisteredTickers] = useState<RegisteredTicker[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAddInvestment, setShowAddInvestment] = useState(false)
  const [sortKey, sortDir, toggleSort] = useSortState<SortKey>('unrealizedGLPercentCHF', 'desc')
  const [gainersSort, gainersDir, toggleGainersSort] = useSortState<DailyTableSortKey>('dailyChangePercent', 'desc')
  const [losersSort, losersDir, toggleLosersSort] = useSortState<DailyTableSortKey>('dailyChangePercent', 'asc')
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(180) // 3 minutes in seconds
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showRefreshSettings, setShowRefreshSettings] = useState(false)

  useAuthGatedEffect(status, () => load(false))

  useEffect(() => {
    if (!isDevOrAuthenticated(status) || autoRefreshInterval <= 0) return
    const interval = setInterval(() => load(false), autoRefreshInterval * 1000)
    return () => clearInterval(interval)
  }, [status, autoRefreshInterval])

  async function load(forceRefresh: boolean) {
    setIsLoading(true)
    setError('')
    try {
      const rollupRes = await apiFetch(`/portfolio-rollup${forceRefresh ? '?refresh=true' : ''}`)
      const body = await rollupRes.json().catch(() => ({}))
      if (!rollupRes.ok) {
        throw new Error(body.error || `Request failed: ${rollupRes.status}`)
      }
      setData(body)
      setLastUpdated(new Date())

      // The rollup only lists tickers that have transactions; /portfolio/tickers
      // lists every registered investment, so a freshly-added one with no
      // transactions yet is still shown (and clickable) below. Secondary
      // data — its own try/catch so a failure (even a network-level
      // rejection) can't blank the page the rollup already populated.
      try {
        const tickersRes = await apiFetch('/portfolio/tickers')
        if (tickersRes.ok) {
          setRegisteredTickers(await tickersRes.json().catch(() => []))
        }
      } catch (tickersErr) {
        console.error('Registered-tickers load error:', tickersErr)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load portfolio'
      console.error('Portfolio load error:', errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCreated(ticker: string) {
    setShowAddInvestment(false)
    // Go straight to the new investment so its first transaction can be
    // added — it won't appear in the tables here until it has one.
    router.push(`/ticker/${ticker}`)
  }

  function getSortedTickers(tickers: OpenTickerRollup[], total: number) {
    return sortRows(tickers, sortKey, sortDir, {
      ticker: (t) => t.ticker,
      shares: (t) => t.currentShares,
      costBasis: (t) => t.costBasisNative,
      price: (t) => t.currentPriceNative,
      marketValue: (t) => t.marketValueNative,
      unrealizedGL: (t) => t.unrealizedGainNative,
      portfolio: (t) => t.marketValueCHF / total,
      unrealizedGLPercent: (t) => (t.costBasisNative > 0 ? (t.unrealizedGainNative / t.costBasisNative) * 100 : 0),
      unrealizedGLPercentCHF: (t) => (t.costBasisCHF > 0 ? (t.unrealizedGainCHF / t.costBasisCHF) * 100 : 0),
    })
  }

  function getSortedDailyTickers(tickers: OpenTickerRollup[], isGainers: boolean) {
    const key = isGainers ? gainersSort : losersSort
    const dir = isGainers ? gainersDir : losersDir
    return sortRows(tickers, key, dir, {
      ticker: (t) => t.ticker,
      dailyChangePercent: (t) => t.dailyChangePercent,
    })
  }

  const tickersWithTransactions = new Set([
    ...(data?.openTickers ?? []).map((t) => t.ticker),
    ...(data?.closedTickers ?? []).map((t) => t.ticker),
  ])
  const registeredWithoutTransactions = registeredTickers.filter(
    (t) => !tickersWithTransactions.has(t.ticker),
  )

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
            aria-label="Auto-refresh settings"
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
                    <th className="px-4 py-3 text-left"><SortHeader label="Ticker" active={gainersSort === 'ticker'} dir={gainersDir} onClick={() => toggleGainersSort('ticker', 'desc')} /></th>
                    <th className="px-4 py-3 text-right"><SortHeader label="Price Change %" active={gainersSort === 'dailyChangePercent'} dir={gainersDir} onClick={() => toggleGainersSort('dailyChangePercent', 'desc')} align="right" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getSortedDailyTickers(data.openTickers.filter((t) => t.dailyChangePercent > 0), true).map((t) => (
                      <tr key={t.ticker} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          <Link href={`/ticker/${t.ticker}`} className="hover:underline">
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
                    <th className="px-4 py-3 text-left"><SortHeader label="Ticker" active={losersSort === 'ticker'} dir={losersDir} onClick={() => toggleLosersSort('ticker', 'asc')} /></th>
                    <th className="px-4 py-3 text-right"><SortHeader label="Price Change %" active={losersSort === 'dailyChangePercent'} dir={losersDir} onClick={() => toggleLosersSort('dailyChangePercent', 'asc')} align="right" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getSortedDailyTickers(data.openTickers.filter((t) => t.dailyChangePercent < 0), false).map((t) => (
                      <tr key={t.ticker} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          <Link href={`/ticker/${t.ticker}`} className="hover:underline">
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
                  <th className="px-4 py-3 text-left"><SortHeader label="Ticker" active={sortKey === 'ticker'} dir={sortDir} onClick={() => toggleSort('ticker')} /></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Shares" active={sortKey === 'shares'} dir={sortDir} onClick={() => toggleSort('shares')} align="right" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Cost Basis (native)" active={sortKey === 'costBasis'} dir={sortDir} onClick={() => toggleSort('costBasis')} align="right" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Market Value (CHF)" active={sortKey === 'marketValue'} dir={sortDir} onClick={() => toggleSort('marketValue')} align="right" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Unrealized G/L (CHF)" active={sortKey === 'unrealizedGL'} dir={sortDir} onClick={() => toggleSort('unrealizedGL')} align="right" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="G/L % (CHF)" active={sortKey === 'unrealizedGLPercentCHF'} dir={sortDir} onClick={() => toggleSort('unrealizedGLPercentCHF')} align="right" /></th>
                  <th className="px-4 py-3 text-right"><SortHeader label="Portfolio %" active={sortKey === 'portfolio'} dir={sortDir} onClick={() => toggleSort('portfolio')} align="right" /></th>
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
                        <Link href={`/ticker/${t.ticker}`} className="hover:underline">
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

          {registeredWithoutTransactions.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">
                Registered — no transactions yet
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Ticker</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Market</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {registeredWithoutTransactions.map((t) => (
                    <tr key={t.ticker} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        <Link href={`/ticker/${t.ticker}`} className="hover:underline">
                          {t.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.category}</td>
                      <td className="px-4 py-3 text-gray-600">{t.market}</td>
                      <td className="px-4 py-3 text-gray-600">{t.nativeCurrency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-gray-500 border-t">
                Open one to add its first transaction.
              </div>
            </div>
          )}

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
                        <Link href={`/ticker/${t.ticker}`} className="hover:underline">
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
