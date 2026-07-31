'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { apiFetch } from '@/lib/apiFetch'
import { fmt, gainClass } from '@/lib/format'
import type { PassiveRollup, PassiveInvestmentRollupRow } from '@/lib/passive/types'
import PassiveInvestmentForm, { ExistingPassiveInvestment } from '@/components/PassiveInvestmentForm'

export default function PassiveInvestmentPage() {
  const { status } = useSession()
  const [data, setData] = useState<PassiveRollup | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRow, setEditingRow] = useState<PassiveInvestmentRollupRow | null>(null)

  useEffect(() => {
    // Middleware already blocks anonymous requests to this page server-side
    // in production, but this avoids a wasted backend round trip during the
    // brief moment useSession() takes to hydrate client-side (and defends
    // against ever firing this call with no session at all). Skipped in
    // development, where there's no sign-in step at all and the backend
    // auto-provisions a fixed user regardless of session state.
    if (process.env.NODE_ENV !== 'development' && status !== 'authenticated') return
    load(false)
  }, [status])

  async function load(forceRefresh: boolean) {
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/passive-rollup${forceRefresh ? '?refresh=true' : ''}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      setData(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load passive investments')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSaved() {
    setShowAddForm(false)
    setEditingRow(null)
    load(false)
  }

  function toExisting(row: PassiveInvestmentRollupRow): ExistingPassiveInvestment {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      notes: row.notes,
      gainLossPct: row.gainLossPct,
      gainLossUpdatedAt: row.gainLossUpdatedAt ? String(row.gainLossUpdatedAt) : null,
    }
  }

  async function handleDelete(row: PassiveInvestmentRollupRow) {
    if (!confirm(`Delete "${row.name}" and all of its transactions? This cannot be undone.`)) return
    try {
      const res = await apiFetch(`/passive-investments/${row.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      load(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete passive investment')
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Passive Investment</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingRow(null)
              setShowAddForm(!showAddForm)
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
          >
            Add investment
          </button>
          <button
            onClick={() => load(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
          >
            {isLoading ? 'Refreshing…' : 'Refresh (FX rates)'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <PassiveInvestmentForm
          onSaved={handleSaved}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingRow && (
        <PassiveInvestmentForm
          existing={toExisting(editingRow)}
          onSaved={handleSaved}
          onCancel={() => setEditingRow(null)}
          onDeleted={handleSaved}
        />
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      {isLoading && !data && <p className="text-gray-500">Loading…</p>}

      {data && (
        <>
          <div className="flex gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4 max-w-xs">
              <div className="text-xs text-gray-500 uppercase">Market Value</div>
              <div className="text-lg font-mono font-semibold text-gray-900">{fmt(data.totalMarketValueCHF)} CHF</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 max-w-xs">
              <div className="text-xs text-gray-500 uppercase">Total Unrealized G/L</div>
              <div className={`text-lg font-mono font-semibold ${data.rows.some((r) => r.gainLossPct != null) ? gainClass(data.totalUnrealizedGainCHF) : 'text-gray-900'}`}>
                {data.rows.some((r) => r.gainLossPct != null) ? `${fmt(data.totalUnrealizedGainCHF)} CHF` : '—'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Currency</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Market Value (native)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Market Value (CHF)</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Unrealized G/L (CHF)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-blue-600">
                      <Link href={`/passive/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.type}</td>
                    <td className="px-4 py-3 text-gray-600">{r.currency}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(r.marketValueNative)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(r.marketValueCHF)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${r.gainLossPct != null ? gainClass(r.unrealizedGainCHF) : 'text-gray-400'}`}>
                      {r.gainLossPct != null ? fmt(r.unrealizedGainCHF) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.notes || ''}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setShowAddForm(false)
                          setEditingRow(r)
                        }}
                        className="text-blue-600 text-xs mr-3"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r)} className="text-red-600 text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                      No passive investments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.fxErrors.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              <div className="font-semibold mb-1">
                FX rate fetch failed for {data.fxErrors.length} currenc{data.fxErrors.length === 1 ? 'y' : 'ies'} — excluded from totals above:
              </div>
              <ul className="list-disc list-inside">
                {data.fxErrors.map((e) => (
                  <li key={e.currency}>
                    {e.currency}: {e.error}
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
