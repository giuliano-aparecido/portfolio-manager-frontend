'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { runApiAction } from '@/lib/apiAction'
import { PASSIVE_TXN_TYPES } from '@/lib/passive/validation'

export interface ExistingPassiveTransaction {
  id: number
  date: string
  type: string
  amountNative: number
  notes: string | null
}

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

export default function PassiveTransactionForm({
  investmentId,
  currency,
  existing,
  onSaved,
  onCancel,
}: {
  investmentId: number
  currency: string
  existing?: ExistingPassiveTransaction
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!existing
  const [type, setType] = useState(existing?.type || PASSIVE_TXN_TYPES[0])
  const [date, setDate] = useState(() => (existing ? toDateInput(existing.date) : new Date().toISOString().slice(0, 10)))
  const [amountNative, setAmountNative] = useState(existing?.amountNative != null ? String(existing.amountNative) : '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = { type, date, amountNative: Number(amountNative), notes: notes || undefined }
    const url = isEdit
      ? `/passive-investments/${investmentId}/transactions/${existing!.id}`
      : `/passive-investments/${investmentId}/transactions`
    await runApiAction(
      () => apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) }),
      () => onSaved(),
      { setError, setLoading: setIsSubmitting, fallbackErrorMessage: 'Failed to save transaction' }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEdit ? 'Edit transaction' : 'Add transaction'}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="passive-transaction-type" className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <select
            id="passive-transaction-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {PASSIVE_TXN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="passive-transaction-date" className="block text-xs font-medium text-gray-600 mb-1">
            Date
          </label>
          <input
            id="passive-transaction-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="passive-transaction-amount" className="block text-xs font-medium text-gray-600 mb-1">
            Amount ({currency})
          </label>
          <input
            id="passive-transaction-amount"
            type="number"
            step="any"
            min="0"
            value={amountNative}
            onChange={(e) => setAmountNative(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="passive-transaction-notes" className="block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </label>
        <input
          id="passive-transaction-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

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
