'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { runApiAction } from '@/lib/apiAction'
import { CURRENCIES } from '@/lib/portfolio/validation'

const MARKETS = ['NYSE', 'NASDAQ', 'SIX', 'LON', 'TSX', 'SGX', 'CRYPTO']
const CATEGORIES = ['Stock', 'Stock Defensive', 'REITS', 'Gold', 'Crypto', 'Berkshire', 'IBM']

export interface ExistingTicker {
  ticker: string
  market: string
  category: string
  nativeCurrency: string
}

export default function InvestmentForm({
  existing,
  onSaved,
  onCancel,
  onDeleted,
}: {
  existing?: ExistingTicker
  onSaved: (ticker: string) => void
  onCancel: () => void
  onDeleted?: () => void
}) {
  const isEdit = !!existing
  const [ticker, setTicker] = useState(existing?.ticker || '')
  const [market, setMarket] = useState(existing?.market || MARKETS[0])
  const [category, setCategory] = useState(existing?.category || CATEGORIES[0])
  const [nativeCurrency, setNativeCurrency] = useState(existing?.nativeCurrency || CURRENCIES[0])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await runApiAction(
      () =>
        apiFetch(isEdit ? `/portfolio/tickers/${existing!.ticker}` : '/portfolio/tickers', {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({ ticker, market, category, nativeCurrency }),
        }),
      () => onSaved(ticker),
      { setError, setLoading: setIsSubmitting, fallbackErrorMessage: 'Failed to save investment' }
    )
  }

  async function handleDelete() {
    if (!existing) return
    await runApiAction(
      () => apiFetch(`/portfolio/tickers/${existing.ticker}`, { method: 'DELETE' }),
      () => onDeleted?.(),
      {
        confirmMessage: `Delete ${existing.ticker} and all of its transactions? This cannot be undone.`,
        setError,
        setLoading: setIsDeleting,
        resetLoadingOnSuccess: false,
        fallbackErrorMessage: 'Failed to delete investment',
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEdit ? `Edit ${existing!.ticker}` : 'Add investment'}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label htmlFor="investment-ticker" className="block text-xs font-medium text-gray-600 mb-1">
            Ticker
          </label>
          <input
            id="investment-ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AMZN"
            required
            disabled={isEdit}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
        <div>
          <label htmlFor="investment-market" className="block text-xs font-medium text-gray-600 mb-1">
            Stock market
          </label>
          <select
            id="investment-market"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="investment-category" className="block text-xs font-medium text-gray-600 mb-1">
            Category
          </label>
          <select
            id="investment-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="investment-currency" className="block text-xs font-medium text-gray-600 mb-1">
            Currency
          </label>
          <select
            id="investment-currency"
            value={nativeCurrency}
            onChange={(e) => setNativeCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isEdit && (
        <p className="text-xs text-gray-500 mb-4">
          Currency can only be changed if this ticker has no transactions yet.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || isDeleting}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add investment'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700">
          Cancel
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting || isDeleting}
            className="ml-auto px-4 py-2 border border-red-300 text-red-700 rounded-md text-sm disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete investment'}
          </button>
        )}
      </div>
    </form>
  )
}
