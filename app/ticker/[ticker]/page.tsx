'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/apiFetch'
import { fmt, gainClass } from '@/lib/format'
import InvestmentForm from '@/components/InvestmentForm'
import TransactionForm, { ExistingTransaction } from '@/components/TransactionForm'

interface TransactionRow {
  id: number
  date: string
  type: string
  nativeCurrency: string
  quantity: number | null
  pricePerShare: number | null
  cashAmount: number | null
  fxRateToCHF: number
  notes: string | null
}

interface RealizedGainRow {
  date: string
  qtySold: number
  proceedsNative: number
  costBasisNative: number
  gainNative: number
  gainCHF: number
}

interface TickerDetail {
  ticker: string
  market: string
  category: string
  nativeCurrency: string
  currentShares: number
  costBasisNative: number
  costBasisCHF: number
  averageCostPerShareNative: number
  currentPriceNative: number | null
  currentFxRateToCHF: number | null
  marketValueNative: number | null
  marketValueCHF: number | null
  unrealizedGainNative: number | null
  unrealizedGainCHF: number | null
  priceError: string | null
  dividendsNative: number
  dividendsCHF: number
  totalRealizedGainNative: number
  totalRealizedGainCHF: number
  realizedGains: RealizedGainRow[]
  transactions: TransactionRow[]
}

type SortKey = 'date' | 'type' | 'quantity' | 'price' | 'fx'
type SortDir = 'asc' | 'desc'

export default function TickerDetailPage() {
  const { status } = useSession()
  const params = useParams<{ ticker: string }>()
  const router = useRouter()
  const ticker = decodeURIComponent(params.ticker)

  const [data, setData] = useState<TickerDetail | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showEditInvestment, setShowEditInvestment] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [editingTxn, setEditingTxn] = useState<TransactionRow | null>(null)
  const [txnSortKey, setTxnSortKey] = useState<SortKey>('date')
  const [txnSortDir, setTxnSortDir] = useState<SortDir>('desc')
  const [salesSortKey, setSalesSortKey] = useState<'date' | 'qty' | 'proceeds' | 'costbasis' | 'gain'>('date')
  const [salesSortDir, setSalesSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    // Middleware already blocks anonymous requests to this page server-side
    // in production, but this avoids a wasted backend round trip during the
    // brief moment useSession() takes to hydrate client-side (and defends
    // against ever firing this call with no session at all). Skipped in
    // development, where there's no sign-in step at all and the backend
    // auto-provisions a fixed user regardless of session state.
    if (process.env.NODE_ENV !== 'development' && status !== 'authenticated') return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ticker])

  async function load() {
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/portfolio/tickers/${ticker}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticker')
    } finally {
      setIsLoading(false)
    }
  }

  function handleFormSaved() {
    setShowEditInvestment(false)
    setShowAddTransaction(false)
    setEditingTxn(null)
    load()
  }

  function toggleTxnSort(key: SortKey) {
    if (txnSortKey === key) {
      setTxnSortDir(txnSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setTxnSortKey(key)
      setTxnSortDir('asc')
    }
  }

  function toggleSalesSort(key: 'date' | 'qty' | 'proceeds' | 'costbasis' | 'gain') {
    if (salesSortKey === key) {
      setSalesSortDir(salesSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSalesSortKey(key)
      setSalesSortDir('asc')
    }
  }

  function getSortedTransactions(txns: TransactionRow[]) {
    const sorted = [...txns]
    sorted.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (txnSortKey) {
        case 'date':
          aVal = a.date
          bVal = b.date
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'quantity':
          aVal = a.quantity ?? 0
          bVal = b.quantity ?? 0
          break
        case 'price':
          aVal = a.pricePerShare ?? 0
          bVal = b.pricePerShare ?? 0
          break
        case 'fx':
          aVal = a.fxRateToCHF
          bVal = b.fxRateToCHF
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return txnSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return txnSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }

  function getSortedSales(sales: RealizedGainRow[]) {
    const sorted = [...sales]
    sorted.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (salesSortKey) {
        case 'date':
          aVal = a.date
          bVal = b.date
          break
        case 'qty':
          aVal = a.qtySold
          bVal = b.qtySold
          break
        case 'proceeds':
          aVal = a.proceedsNative
          bVal = b.proceedsNative
          break
        case 'costbasis':
          aVal = a.costBasisNative
          bVal = b.costBasisNative
          break
        case 'gain':
          aVal = a.gainCHF
          bVal = b.gainCHF
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return salesSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return salesSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }

  function SortHeader({ label, sortKeyVal, isSales }: { label: string; sortKeyVal: SortKey | 'date' | 'qty' | 'proceeds' | 'costbasis' | 'gain'; isSales?: boolean }) {
    const isActive = isSales ? (salesSortKey === sortKeyVal) : (txnSortKey === sortKeyVal)
    const dir = isSales ? salesSortDir : txnSortDir
    const arrow = isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
    const handleClick = isSales ? () => toggleSalesSort(sortKeyVal as any) : () => toggleTxnSort(sortKeyVal as any)
    return (
      <button
        onClick={handleClick}
        className="text-left font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer"
      >
        {label}
        {arrow}
      </button>
    )
  }

  async function handleDeleteTransaction(txn: TransactionRow) {
    if (!confirm(`Delete this ${txn.type} transaction from ${txn.date.slice(0, 10)}?`)) return
    try {
      const res = await apiFetch(`/portfolio/transactions/${txn.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete transaction')
    }
  }

  if (isLoading && !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/securities" className="text-sm text-blue-600">
          ← Back
        </Link>
        <p className="text-gray-500 mt-4">Loading…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/securities" className="text-sm text-blue-600">
          ← Back
        </Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const hasPosition = data.currentShares > 1e-9

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link href="/securities" className="text-sm text-blue-600">
        ← Back to portfolio
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.ticker}</h1>
          <p className="text-sm text-gray-500">
            {data.category} · {data.market} · {data.nativeCurrency}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditInvestment(!showEditInvestment)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
          >
            Edit investment
          </button>
          <button
            onClick={() => {
              setEditingTxn(null)
              setShowAddTransaction(!showAddTransaction)
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm"
          >
            Add transaction
          </button>
        </div>
      </div>

      {showEditInvestment && (
        <InvestmentForm
          existing={{ ticker: data.ticker, market: data.market, category: data.category, nativeCurrency: data.nativeCurrency }}
          onSaved={handleFormSaved}
          onCancel={() => setShowEditInvestment(false)}
          onDeleted={() => router.push('/')}
        />
      )}

      {showAddTransaction && (
        <TransactionForm ticker={data.ticker} onSaved={handleFormSaved} onCancel={() => setShowAddTransaction(false)} />
      )}

      {editingTxn && (
        <TransactionForm
          ticker={data.ticker}
          existing={{
            id: editingTxn.id,
            date: editingTxn.date,
            type: editingTxn.type,
            quantity: editingTxn.quantity,
            pricePerShare: editingTxn.pricePerShare,
            cashAmount: editingTxn.cashAmount,
            notes: editingTxn.notes,
          }}
          onSaved={handleFormSaved}
          onCancel={() => setEditingTxn(null)}
        />
      )}

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase">Shares</div>
          <div className="text-lg font-mono font-semibold text-gray-900">{data.currentShares.toFixed(4)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase">Cost Basis</div>
          <div className="text-lg font-mono font-semibold text-gray-900">{fmt(data.costBasisNative)} {data.nativeCurrency}</div>
          <div className="text-xs text-gray-600 font-mono mt-1">{fmt(data.costBasisCHF)} CHF</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase">Avg Cost Per Share</div>
          <div className="text-lg font-mono font-semibold text-gray-900">{fmt(data.averageCostPerShareNative)} {data.nativeCurrency}</div>
        </div>
        {hasPosition && data.currentPriceNative != null ? (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 uppercase">Current Price</div>
            <div className="text-lg font-mono font-semibold text-gray-900">{data.currentPriceNative.toFixed(4)} {data.nativeCurrency}</div>
            <div className="text-xs text-gray-600 font-mono mt-1">FX: {data.currentFxRateToCHF?.toFixed(4)}</div>
          </div>
        ) : null}
        {hasPosition ? (
          <>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">Market Value</div>
              <div className="text-lg font-mono font-semibold text-gray-900">
                {data.marketValueNative != null ? `${fmt(data.marketValueNative)} ${data.nativeCurrency}` : '—'}
              </div>
              <div className="text-xs text-gray-600 font-mono mt-1">{data.marketValueCHF != null ? `${fmt(data.marketValueCHF)} CHF` : '—'}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">Unrealized G/L</div>
              <div className={`text-lg font-mono font-semibold ${data.unrealizedGainNative != null ? gainClass(data.unrealizedGainNative) : 'text-gray-900'}`}>
                {data.unrealizedGainNative != null ? fmt(data.unrealizedGainNative) : '—'} {data.nativeCurrency}
              </div>
              <div className="text-xs text-gray-600 font-mono mt-1">{data.unrealizedGainCHF != null ? fmt(data.unrealizedGainCHF) : '—'} CHF</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">G/L %</div>
              {data.costBasisNative > 0 && data.unrealizedGainNative != null ? (
                <>
                  <div className={`text-lg font-mono font-semibold ${gainClass((data.unrealizedGainNative / data.costBasisNative) * 100)}`}>
                    {((data.unrealizedGainNative / data.costBasisNative) * 100).toFixed(2)}%
                  </div>
                  <div className={`text-xs font-mono mt-1 ${gainClass((data.unrealizedGainCHF ?? 0) / data.costBasisCHF * 100)}`}>
                    CHF: {((data.unrealizedGainCHF ?? 0) / data.costBasisCHF * 100).toFixed(2)}%
                  </div>
                </>
              ) : (
                <div className="text-lg font-mono font-semibold text-gray-900">—</div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-4 col-span-2">
            <div className="text-xs text-gray-500 uppercase">Status</div>
            <div className="text-lg font-semibold text-gray-500">Closed position</div>
          </div>
        )}
        {(data.dividendsNative > 1e-9 || data.dividendsCHF > 1e-9) && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 uppercase">Dividends</div>
            <div className="text-lg font-mono font-semibold text-gray-900">{fmt(data.dividendsNative)} {data.nativeCurrency}</div>
            <div className="text-xs text-gray-600 font-mono mt-1">{fmt(data.dividendsCHF)} CHF</div>
          </div>
        )}
        {(data.totalRealizedGainNative > 1e-9 || data.totalRealizedGainCHF > 1e-9) && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 uppercase">Realized Gain</div>
            <div className={`text-lg font-mono font-semibold ${gainClass(data.totalRealizedGainNative)}`}>{fmt(data.totalRealizedGainNative)} {data.nativeCurrency}</div>
            <div className={`text-xs font-mono mt-1 ${gainClass(data.totalRealizedGainCHF)}`}>{fmt(data.totalRealizedGainCHF)} CHF</div>
          </div>
        )}
      </div>

      {data.priceError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          Live price unavailable: {data.priceError}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">Transactions</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left"><SortHeader label="Date" sortKeyVal="date" /></th>
              <th className="px-4 py-3 text-left"><SortHeader label="Type" sortKeyVal="type" /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="Quantity" sortKeyVal="quantity" /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="Price/share" sortKeyVal="price" /></th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Total Amount</th>
              <th className="px-4 py-3 text-right"><SortHeader label="FX to CHF" sortKeyVal="fx" /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Note</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {getSortedTransactions(data.transactions).map((t) => {
              const totalAmount = t.quantity != null && t.pricePerShare != null ? t.quantity * t.pricePerShare : t.cashAmount
              return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{t.date.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-900">{t.type}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{t.quantity != null ? t.quantity.toFixed(4) : '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{t.pricePerShare != null ? t.pricePerShare.toFixed(4) : '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{totalAmount != null ? fmt(totalAmount) : '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{t.fxRateToCHF.toFixed(4)}</td>
                <td className="px-4 py-3 text-gray-600">{t.notes || ''}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setShowAddTransaction(false)
                      setEditingTxn(t)
                    }}
                    className="text-blue-600 text-xs mr-3"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteTransaction(t)} className="text-red-600 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
              )
            })}
            {data.transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.realizedGains.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">Realized sales</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left"><SortHeader label="Date" sortKeyVal="date" isSales /></th>
                <th className="px-4 py-3 text-right"><SortHeader label="Qty sold" sortKeyVal="qty" isSales /></th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">Sell Price</th>
                <th className="px-4 py-3 text-right"><SortHeader label="Proceeds" sortKeyVal="proceeds" isSales /></th>
                <th className="px-4 py-3 text-right"><SortHeader label="Cost basis" sortKeyVal="costbasis" isSales /></th>
                <th className="px-4 py-3 text-right"><SortHeader label="Gain" sortKeyVal="gain" isSales /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {getSortedSales(data.realizedGains).map((r) => (
                <tr key={`${r.date}-${r.qtySold}-${r.proceedsNative}-${r.costBasisNative}`}>
                  <td className="px-4 py-3 text-gray-900">{r.date.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{r.qtySold.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {r.qtySold > 0 ? (r.proceedsNative / r.qtySold).toFixed(4) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(r.proceedsNative)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(r.costBasisNative)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(r.gainCHF)}`}>{fmt(r.gainCHF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
