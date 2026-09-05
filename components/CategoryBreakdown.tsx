'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

interface Ticker {
  ticker: string
  category: string
  marketValueCHF: number
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#6366f1', '#84cc16', '#f97316', '#14b8a6', '#d946ef',
  '#0ea5e9', '#fb7185', '#4ade80', '#facc15', '#a855f7', '#22c55e',
]

export default function CategoryBreakdown({ tickers }: { tickers: Ticker[] }) {
  const categoryData = tickers.reduce(
    (acc, ticker) => {
      const existing = acc.find((item) => item.name === ticker.category)
      if (existing) {
        existing.value += ticker.marketValueCHF
      } else {
        acc.push({ name: ticker.category, value: ticker.marketValueCHF })
      }
      return acc
    },
    [] as Array<{ name: string; value: number }>
  )

  // The pie's <Cell> and the legend's swatch below both key their fill
  // color off COLORS[index % COLORS.length] against this same array — if
  // the pie and legend ever sorted it independently, a category's pie
  // slice and its legend swatch could silently end up different colors.
  categoryData.sort((a, b) => b.value - a.value)

  const totalValue = categoryData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Portfolio by Category</h2>
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-shrink-0" style={{ width: '300px', height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${(value as number).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {categoryData.map((item, index) => {
              const percentage = ((item.value / totalValue) * 100).toFixed(1)
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-600">
                      {item.value.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CHF ({percentage}%)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
