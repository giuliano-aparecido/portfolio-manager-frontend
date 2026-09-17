'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { runApiAction } from '@/lib/apiAction'
import { RECURRING_FREQUENCIES } from '@/lib/passive/validation'

export interface ExistingRecurringDeposit {
  id: number
  amountNative: number
  startDate: string
  frequency: string
  endDate: string | null
  notes: string | null
}

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

export default function RecurringDepositForm({
  investmentId,
  currency,
  existing,
  onSaved,
  onCancel,
}: {
  investmentId: number
  currency: string
  existing?: ExistingRecurringDeposit
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!existing
  const [amountNative, setAmountNative] = useState(existing?.amountNative != null ? String(existing.amountNative) : '')
  const [startDate, setStartDate] = useState(() =>
    existing ? toDateInput(existing.startDate) : new Date().toISOString().slice(0, 10)
  )
  const [frequency, setFrequency] = useState(existing?.frequency || RECURRING_FREQUENCIES[0])
  const [endDate, setEndDate] = useState(existing?.endDate ? toDateInput(existing.endDate) : '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      amountNative: Number(amountNative),
      frequency,
      startDate,
      endDate: endDate || undefined,
      notes: notes || undefined,
    }
    setError('')
    setIsSubmitting(true)
    const ok = await runApiAction(
      () =>
        apiFetch(`/passive-investments/${investmentId}/recurring-deposit`, {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      { onError: setError, fallbackErrorMessage: 'Failed to save recurring deposit' }
    )
    if (ok) onSaved()
    setIsSubmitting(false)
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('Delete this recurring deposit rule? Already-generated deposits will remain in the ledger.')) return
    setError('')
    setIsDeleting(true)
    const ok = await runApiAction(
      () => apiFetch(`/passive-investments/${investmentId}/recurring-deposit`, { method: 'DELETE' }),
      { onError: setError, fallbackErrorMessage: 'Failed to delete recurring deposit' }
    )
    if (ok) onSaved()
    else setIsDeleting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {isEdit ? 'Edit recurring deposit' : 'Set up recurring deposit'}
      </h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="recurring-deposit-amount" className="block text-xs font-medium text-gray-600 mb-1">
            Amount ({currency})
          </label>
          <input
            id="recurring-deposit-amount"
            type="number"
            step="any"
            min="0"
            value={amountNative}
            onChange={(e) => setAmountNative(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="recurring-deposit-start-date" className="block text-xs font-medium text-gray-600 mb-1">
            Start date
          </label>
          <input
            id="recurring-deposit-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {isEdit && (
            <p className="text-xs text-gray-500 mt-1">
              Changing the start date to an earlier date won&apos;t backfill deposits already passed.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="recurring-deposit-frequency" className="block text-xs font-medium text-gray-600 mb-1">
            Frequency
          </label>
          <select
            id="recurring-deposit-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="recurring-deposit-end-date" className="block text-xs font-medium text-gray-600 mb-1">
            End date (optional)
          </label>
          <input
            id="recurring-deposit-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="recurring-deposit-notes" className="block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </label>
        <input
          id="recurring-deposit-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || isDeleting}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Set up recurring deposit'}
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
            {isDeleting ? 'Deleting…' : 'Delete recurring deposit'}
          </button>
        )}
      </div>
    </form>
  )
}
