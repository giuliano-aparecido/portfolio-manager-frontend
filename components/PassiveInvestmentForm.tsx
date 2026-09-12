'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { PASSIVE_TYPES } from '@/lib/passive/validation'
import { CURRENCIES } from '@/lib/portfolio/validation'

export interface ExistingPassiveInvestment {
  id: number
  name: string
  type: string
  currency: string
  notes: string | null
  gainLossPct: number | null
  gainLossUpdatedAt: string | null
}

export default function PassiveInvestmentForm({
  existing,
  onSaved,
  onCancel,
  onDeleted,
}: {
  existing?: ExistingPassiveInvestment
  onSaved: () => void
  onCancel: () => void
  onDeleted?: () => void
}) {
  const isEdit = !!existing
  const [name, setName] = useState(existing?.name || '')
  const [type, setType] = useState(existing?.type || PASSIVE_TYPES[0])
  const [currency, setCurrency] = useState(existing?.currency || CURRENCIES[0])
  const [notes, setNotes] = useState(existing?.notes || '')
  const [gainLossPct, setGainLossPct] = useState(existing?.gainLossPct != null ? String(existing.gainLossPct) : '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const url = isEdit ? `/passive-investments/${existing!.id}` : '/passive-investments'
      // Number('') is 0, not NaN, so the empty-string check must come first;
      // Number.isFinite guards a leftover invalid intermediate value (e.g. a
      // lone "-" or ".") from serializing as NaN -> null indistinguishably
      // from an intentional blank field.
      const parsedGainLossPct = gainLossPct === '' ? null : Number(gainLossPct)
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          type,
          currency,
          notes,
          gainLossPct: Number.isFinite(parsedGainLossPct) ? parsedGainLossPct : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save passive investment')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm(`Delete "${existing.name}"? This cannot be undone.`)) return
    setError('')
    setIsDeleting(true)
    try {
      const res = await apiFetch(`/passive-investments/${existing.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      onDeleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete passive investment')
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {isEdit ? `Edit ${existing!.name}` : 'Add passive investment'}
      </h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="passive-investment-name" className="block text-xs font-medium text-gray-600 mb-1">
            Name
          </label>
          <input
            id="passive-investment-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency bucket"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="passive-investment-type" className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <select
            id="passive-investment-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {PASSIVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="passive-investment-currency" className="block text-xs font-medium text-gray-600 mb-1">
            Currency
          </label>
          <select
            id="passive-investment-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div>
            <label htmlFor="passive-investment-gain-loss-pct" className="block text-xs font-medium text-gray-600 mb-1">
              Gain/Loss %
            </label>
            <input
              id="passive-investment-gain-loss-pct"
              type="number"
              step="0.01"
              value={gainLossPct}
              onChange={(e) => setGainLossPct(e.target.value)}
              placeholder="e.g. 5.3"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            {existing?.gainLossUpdatedAt ? (
              <p className="text-[10px] text-gray-400 mt-1">Last updated: {existing.gainLossUpdatedAt.slice(0, 10)}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Leave blank if unknown — defaults to 0% (market value = cost basis).</p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="passive-investment-notes" className="block text-xs font-medium text-gray-600 mb-1">
            Notes (optional)
          </label>
          <input
            id="passive-investment-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

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
