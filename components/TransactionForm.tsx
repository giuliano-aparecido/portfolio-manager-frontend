'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'

const TYPES = ['BUY', 'SELL', 'DIVIDEND', 'DRIP']

export interface ExistingTransaction {
  id: number
  date: string
  type: string
  quantity: number | null
  pricePerShare: number | null
  cashAmount: number | null
  notes: string | null
}

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

export default function TransactionForm({
  ticker,
  existing,
  onSaved,
  onCancel,
}: {
  ticker: string
  existing?: ExistingTransaction
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!existing
  const [type, setType] = useState(existing?.type || 'BUY')
  const [date, setDate] = useState(() => (existing ? toDateInput(existing.date) : new Date().toISOString().slice(0, 10)))
  const [quantity, setQuantity] = useState(existing?.quantity != null ? String(existing.quantity) : '')
  const [pricePerShare, setPricePerShare] = useState(existing?.pricePerShare != null ? String(existing.pricePerShare) : '')
  const [cashAmount, setCashAmount] = useState(existing?.cashAmount != null ? String(existing.cashAmount) : '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCashType = type === 'DIVIDEND'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = { ticker, type, date, notes: notes || undefined }
      if (isCashType) {
        body.cashAmount = Number(cashAmount)
      } else {
        body.quantity = Number(quantity)
        body.pricePerShare = Number(pricePerShare)
      }

      const url = isEdit ? `/portfolio/transactions/${existing!.id}` : '/portfolio/transactions'
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}))
        throw new Error(responseBody.error || `Request failed: ${res.status}`)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEdit ? 'Edit transaction' : `Add transaction — ${ticker}`}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="transaction-type" className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <select
            id="transaction-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transaction-date" className="block text-xs font-medium text-gray-600 mb-1">
            Date
          </label>
          <input
            id="transaction-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {isCashType ? (
          <div>
            <label htmlFor="transaction-cash-amount" className="block text-xs font-medium text-gray-600 mb-1">
              Cash amount (native currency)
            </label>
            <input
              id="transaction-cash-amount"
              type="number"
              step="any"
              min="0"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="transaction-quantity" className="block text-xs font-medium text-gray-600 mb-1">
                Quantity (shares)
              </label>
              <input
                id="transaction-quantity"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="transaction-price-per-share" className="block text-xs font-medium text-gray-600 mb-1">
                Price per share (native currency)
              </label>
              <input
                id="transaction-price-per-share"
                type="number"
                step="any"
                min="0"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="transaction-notes" className="block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </label>
        <input
          id="transaction-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <p className="text-xs text-gray-500 mb-4">FX rate is fetched automatically for the transaction date — no need to enter it.</p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  )
}
