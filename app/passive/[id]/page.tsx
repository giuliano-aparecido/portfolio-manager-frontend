'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/apiFetch'
import { fmt, gainClass } from '@/lib/format'
import type { PassiveInvestmentDetail, PassiveTransactionRow } from '@/lib/passive/types'
import PassiveInvestmentForm from '@/components/PassiveInvestmentForm'
import PassiveTransactionForm from '@/components/PassiveTransactionForm'
import RecurringDepositForm from '@/components/RecurringDepositForm'
import { useAuthGatedEffect } from '@/lib/useAuthGatedEffect'
import { sortRows, useSortState } from '@/lib/sortRows'
import SortHeader from '@/components/SortHeader'

type SortKey = 'date' | 'type' | 'amount'

export default function PassiveInvestmentDetailPage() {
  const { status } = useSession()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)

  const [data, setData] = useState<PassiveInvestmentDetail | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showEditInvestment, setShowEditInvestment] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [editingTxn, setEditingTxn] = useState<PassiveTransactionRow | null>(null)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [txnSortKey, txnSortDir, toggleTxnSort] = useSortState<SortKey>('date', 'desc')

  useAuthGatedEffect(status, load, [id])

  async function load() {
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/passive-investments/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load passive investment')
    } finally {
      setIsLoading(false)
    }
  }

  function handleFormSaved() {
    setShowEditInvestment(false)
    setShowAddTransaction(false)
    setEditingTxn(null)
    setShowRecurringForm(false)
    load()
  }


  async function handleDeleteTransaction(txn: PassiveTransactionRow) {
    if (!confirm(`Delete this ${txn.type} transaction from ${txn.date.slice(0, 10)}?`)) return
    try {
      const res = await apiFetch(`/passive-investments/${id}/transactions/${txn.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete transaction')
    }
  }

  async function handleDeleteRecurring() {
    if (!confirm('Delete this recurring deposit rule? Already-generated deposits will remain in the ledger.')) return
    try {
      const res = await apiFetch(`/passive-investments/${id}/recurring-deposit`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete recurring deposit')
    }
  }

  if (isLoading && !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/passive" className="text-sm text-blue-600">
          ← Back
        </Link>
        <p className="text-gray-500 mt-4">Loading…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/passive" className="text-sm text-blue-600">
          ← Back
        </Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const sortedTransactions = sortRows(data.transactions, txnSortKey, txnSortDir, {
    date: (t: PassiveTransactionRow) => t.date,
    type: (t: PassiveTransactionRow) => t.type,
    amount: (t: PassiveTransactionRow) => t.amountNative,
  })

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link href="/passive" className="text-sm text-blue-600">
        ← Back to passive investments
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-sm text-gray-500">
            {data.type} · {data.currency}
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
        <PassiveInvestmentForm
          existing={{
            id: data.id,
            name: data.name,
            type: data.type,
            currency: data.currency,
            notes: data.notes,
            gainLossPct: data.gainLossPct,
            gainLossUpdatedAt: data.gainLossUpdatedAt,
          }}
          onSaved={handleFormSaved}
          onCancel={() => setShowEditInvestment(false)}
          onDeleted={() => router.push('/passive')}
        />
      )}

      {showAddTransaction && (
        <PassiveTransactionForm
          investmentId={data.id}
          currency={data.currency}
          onSaved={handleFormSaved}
          onCancel={() => setShowAddTransaction(false)}
        />
      )}

      {editingTxn && (
        <PassiveTransactionForm
          investmentId={data.id}
          currency={data.currency}
          existing={{
            id: editingTxn.id,
            date: editingTxn.date,
            type: editingTxn.type,
            amountNative: editingTxn.amountNative,
            notes: editingTxn.notes,
          }}
          onSaved={handleFormSaved}
          onCancel={() => setEditingTxn(null)}
        />
      )}

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase">Cost Basis</div>
          <div className="text-lg font-mono font-semibold text-gray-900">
            {fmt(data.costBasisNative)} {data.currency}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-1">{fmt(data.costBasisCHF)} CHF</div>
        </div>
        {data.gainLossPct != null && (
          <>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">Market Value</div>
              <div className="text-lg font-mono font-semibold text-gray-900">
                {fmt(data.marketValueNative)} {data.currency}
              </div>
              <div className="text-xs text-gray-600 font-mono mt-1">{fmt(data.marketValueCHF)} CHF</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">Unrealized G/L</div>
              <div className={`text-lg font-mono font-semibold ${gainClass(data.unrealizedGainNative)}`}>
                {fmt(data.unrealizedGainNative)} {data.currency}
              </div>
              <div className={`text-xs font-mono mt-1 ${gainClass(data.unrealizedGainCHF)}`}>{fmt(data.unrealizedGainCHF)} CHF</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 uppercase">G/L %</div>
              {data.costBasisNative > 0 ? (
                <>
                  <div className={`text-lg font-mono font-semibold ${gainClass((data.unrealizedGainNative / data.costBasisNative) * 100)}`}>
                    {((data.unrealizedGainNative / data.costBasisNative) * 100).toFixed(2)}%
                  </div>
                  <div className={`text-xs font-mono mt-1 ${gainClass((data.unrealizedGainCHF / data.costBasisCHF) * 100)}`}>
                    CHF: {((data.unrealizedGainCHF / data.costBasisCHF) * 100).toFixed(2)}%
                  </div>
                </>
              ) : (
                <div className="text-lg font-mono font-semibold text-gray-900">—</div>
              )}
            </div>
          </>
        )}
      </div>

      {data.fxError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          Live FX rate unavailable: {data.fxError}
        </div>
      )}

      {showRecurringForm ? (
        <RecurringDepositForm
          investmentId={data.id}
          currency={data.currency}
          existing={
            data.recurringDeposit
              ? {
                  id: data.recurringDeposit.id,
                  amountNative: data.recurringDeposit.amountNative,
                  startDate: data.recurringDeposit.startDate,
                  frequency: data.recurringDeposit.frequency,
                  endDate: data.recurringDeposit.endDate,
                  notes: data.recurringDeposit.notes,
                }
              : undefined
          }
          onSaved={handleFormSaved}
          onCancel={() => setShowRecurringForm(false)}
        />
      ) : data.recurringDeposit ? (
        <div className="mb-6 p-4 bg-white rounded-lg shadow text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 uppercase font-semibold">Recurring Deposit</div>
            <div>
              <button onClick={() => setShowRecurringForm(true)} className="text-blue-600 text-xs mr-3">
                Edit
              </button>
              <button onClick={handleDeleteRecurring} className="text-red-600 text-xs">
                Delete
              </button>
            </div>
          </div>
          <div className="text-gray-900">
            {fmt(data.recurringDeposit.amountNative)} {data.currency} · {data.recurringDeposit.frequency} · starts{' '}
            {data.recurringDeposit.startDate.slice(0, 10)}
            {data.recurringDeposit.endDate && <> · ends {data.recurringDeposit.endDate.slice(0, 10)}</>}
          </div>
          {data.recurringDeposit.notes && <div className="text-gray-600 mt-1">{data.recurringDeposit.notes}</div>}
        </div>
      ) : (
        <div className="mb-6 p-4 bg-white rounded-lg shadow flex items-center justify-between text-sm">
          <span className="text-gray-500">No recurring deposit configured.</span>
          <button
            onClick={() => setShowRecurringForm(true)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700"
          >
            Set up recurring deposit
          </button>
        </div>
      )}

      {data.notes && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow text-sm text-gray-700">{data.notes}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">Transactions</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left"><SortHeader label="Date" active={txnSortKey === 'date'} dir={txnSortDir} onClick={() => toggleTxnSort('date')} /></th>
              <th className="px-4 py-3 text-left"><SortHeader label="Type" active={txnSortKey === 'type'} dir={txnSortDir} onClick={() => toggleTxnSort('type')} /></th>
              <th className="px-4 py-3 text-right"><SortHeader label="Amount" active={txnSortKey === 'amount'} dir={txnSortDir} onClick={() => toggleTxnSort('amount')} align="right" /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Note</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{t.date.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-900">{t.type}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {fmt(t.amountNative)} {data.currency}
                </td>
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
            ))}
            {data.transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
