'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { apiFetch } from '@/lib/apiFetch'
import { fmt, gainClass } from '@/lib/format'
import type { PortfolioRollup } from '@/lib/portfolio/types'
import type { PassiveRollup } from '@/lib/passive/types'
import { useAuthGatedEffect } from '@/lib/useAuthGatedEffect'

export default function OverviewPage() {
  const { status } = useSession()
  const [securities, setSecurities] = useState<PortfolioRollup | null>(null)
  const [passive, setPassive] = useState<PassiveRollup | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useAuthGatedEffect(status, () => load(false))

  async function load(forceRefresh: boolean) {
    setIsLoading(true)
    setError('')
    try {
      const suffix = forceRefresh ? '?refresh=true' : ''
      const [securitiesRes, passiveRes] = await Promise.all([
        apiFetch(`/portfolio-rollup${suffix}`),
        apiFetch(`/passive-rollup${suffix}`),
      ])
      const securitiesBody = await securitiesRes.json().catch(() => ({}))
      const passiveBody = await passiveRes.json().catch(() => ({}))
      if (!securitiesRes.ok) {
        throw new Error(securitiesBody.error || `Securities request failed: ${securitiesRes.status}`)
      }
      if (!passiveRes.ok) {
        throw new Error(passiveBody.error || `Passive investment request failed: ${passiveRes.status}`)
      }
      setSecurities(securitiesBody)
      setPassive(passiveBody)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !securities && !passive) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error && !securities && !passive) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      </div>
    )
  }

  if (!securities || !passive) return null

  // Purely sums the pre-computed totals each rollup already returns — no
  // FIFO recompute and no re-fetching of live prices/FX here.
  const combinedCostBasisCHF = securities.totalCostBasisCHF + passive.totalCostBasisCHF
  const combinedMarketValueCHF = securities.totalMarketValueCHF + passive.totalMarketValueCHF
  const combinedUnrealizedGainCHF = securities.totalUnrealizedGainCHF + passive.totalUnrealizedGainCHF
  const combinedGLPercent = combinedCostBasisCHF > 0 ? (combinedUnrealizedGainCHF / combinedCostBasisCHF) * 100 : 0

  const priceErrorCount = securities.priceErrors.length
  const fxErrorCount = passive.fxErrors.length

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <button
          onClick={() => load(true)}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          ['Cost Basis', combinedCostBasisCHF, null],
          ['Market Value', combinedMarketValueCHF, null],
          ['Unrealized G/L', combinedUnrealizedGainCHF, null],
          ['G/L %', combinedGLPercent, '%'],
        ].map(([label, value, suffix]) => (
          <div key={label as string} className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 uppercase">{label}</div>
            <div
              className={`text-lg font-mono font-semibold ${
                label === 'Unrealized G/L' || label === 'G/L %' ? gainClass(value as number) : 'text-gray-900'
              }`}
            >
              {fmt(value as number)} {suffix || 'CHF'}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Asset Class</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Cost Basis (CHF)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Market Value (CHF)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">Unrealized G/L (CHF)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-900">G/L %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold text-blue-600">
                <Link href="/securities" className="hover:underline">
                  Securities
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(securities.totalCostBasisCHF)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(securities.totalMarketValueCHF)}</td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(securities.totalUnrealizedGainCHF)}`}>
                {fmt(securities.totalUnrealizedGainCHF)}
              </td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(securities.totalUnrealizedGainCHF)}`}>
                {securities.totalCostBasisCHF > 0
                  ? ((securities.totalUnrealizedGainCHF / securities.totalCostBasisCHF) * 100).toFixed(2)
                  : '0.00'}
                %
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold text-blue-600">
                <Link href="/passive" className="hover:underline">
                  Passive Investment
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(passive.totalCostBasisCHF)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(passive.totalMarketValueCHF)}</td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(passive.totalUnrealizedGainCHF)}`}>
                {fmt(passive.totalUnrealizedGainCHF)}
              </td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${gainClass(passive.totalUnrealizedGainCHF)}`}>
                {passive.totalCostBasisCHF > 0
                  ? ((passive.totalUnrealizedGainCHF / passive.totalCostBasisCHF) * 100).toFixed(2)
                  : '0.00'}
                %
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {(priceErrorCount > 0 || fxErrorCount > 0) && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          <div className="font-semibold mb-1">
            {priceErrorCount > 0 && `Price fetch failed for ${priceErrorCount} ticker(s) on Securities. `}
            {fxErrorCount > 0 && `FX rate fetch failed for ${fxErrorCount} currenc${fxErrorCount === 1 ? 'y' : 'ies'} on Passive Investment. `}
            Excluded from totals above.
          </div>
        </div>
      )}
    </div>
  )
}
