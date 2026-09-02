import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SecuritiesPage from './page'

// recharts-heavy child, loaded via next/dynamic — irrelevant to these tests.
vi.mock('@/components/CategoryBreakdown', () => ({ default: () => null }))

const apiFetchMock = vi.fn()
vi.mock('@/lib/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}))

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

function openPosition(ticker: string) {
  return {
    ticker,
    category: 'Stock',
    nativeCurrency: 'USD',
    currentShares: 1,
    costBasisNative: 100,
    costBasisCHF: 90,
    currentPriceNative: 110,
    marketValueNative: 110,
    marketValueCHF: 99,
    unrealizedGainNative: 10,
    unrealizedGainCHF: 9,
    dividendsCHF: 0,
    priceTimestamp: '2026-01-01T00:00:00Z',
    priceSource: 'yahoo',
    dailyChangePercent: 0,
    dailyChange: 0,
  }
}

const EMPTY_ROLLUP: {
  openTickers: ReturnType<typeof openPosition>[]
  closedTickers: { ticker: string; dividendsCHF: number; realizedGainCHF: number }[]
  priceErrors: { ticker: string; error: string }[]
  totalCostBasisCHF: number
  totalMarketValueCHF: number
  totalUnrealizedGainCHF: number
  totalDividendsCHF: number
  totalRealizedGainCHF: number
} = {
  openTickers: [],
  closedTickers: [],
  priceErrors: [],
  totalCostBasisCHF: 0,
  totalMarketValueCHF: 0,
  totalUnrealizedGainCHF: 0,
  totalDividendsCHF: 0,
  totalRealizedGainCHF: 0,
}

function mockLoad({ rollup = EMPTY_ROLLUP, tickers = [] as unknown[] } = {}) {
  apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/portfolio-rollup')) return Promise.resolve(jsonResponse(rollup))
    if (path === '/portfolio/tickers' && !init?.method) return Promise.resolve(jsonResponse(tickers))
    return Promise.resolve(jsonResponse({}, false, 404))
  })
}

beforeEach(() => {
  apiFetchMock.mockReset()
  pushMock.mockReset()
})

describe('SecuritiesPage — registered tickers without transactions', () => {
  it('lists a registered ticker that has no transactions, linking to its detail page in the same tab', async () => {
    mockLoad({ tickers: [{ ticker: 'MNDI', market: 'LON', category: 'Stock', nativeCurrency: 'GBP' }] })

    render(<SecuritiesPage />)

    await waitFor(() => expect(screen.getByText('Registered — no transactions yet')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'MNDI' })
    expect(link).toHaveAttribute('href', '/ticker/MNDI')
    expect(link).not.toHaveAttribute('target')
  })

  it('omits a ticker that already has an open position from the "no transactions" table', async () => {
    mockLoad({
      rollup: { ...EMPTY_ROLLUP, openTickers: [openPosition('AMZN')], totalMarketValueCHF: 99 },
      tickers: [{ ticker: 'AMZN', market: 'NASDAQ', category: 'Stock', nativeCurrency: 'USD' }],
    })

    render(<SecuritiesPage />)

    await waitFor(() => expect(screen.getByRole('link', { name: 'AMZN' })).toBeInTheDocument())
    expect(screen.queryByText('Registered — no transactions yet')).not.toBeInTheDocument()
  })

  it('still renders the page when /portfolio/tickers returns an error status', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/portfolio-rollup')) return Promise.resolve(jsonResponse(EMPTY_ROLLUP))
      return Promise.resolve(jsonResponse({}, false, 500))
    })

    render(<SecuritiesPage />)

    await waitFor(() => expect(screen.getByText('Cost Basis')).toBeInTheDocument())
    expect(screen.queryByText('Registered — no transactions yet')).not.toBeInTheDocument()
  })

  it('still renders the page when the /portfolio/tickers request rejects at the network level', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/portfolio-rollup')) return Promise.resolve(jsonResponse(EMPTY_ROLLUP))
      return Promise.reject(new Error('network down'))
    })

    render(<SecuritiesPage />)

    await waitFor(() => expect(screen.getByText('Cost Basis')).toBeInTheDocument())
    // the rejection was swallowed — no error banner, page still populated
    expect(screen.queryByText('network down')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered — no transactions yet')).not.toBeInTheDocument()
  })

  it('navigates to the new investment after it is created', async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith('/portfolio-rollup')) return Promise.resolve(jsonResponse(EMPTY_ROLLUP))
      if (path === '/portfolio/tickers' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ ticker: 'NVDA' }, true, 201))
      }
      if (path === '/portfolio/tickers') return Promise.resolve(jsonResponse([]))
      return Promise.resolve(jsonResponse({}, false, 404))
    })

    render(<SecuritiesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add investment' }))
    const tickerInput = await screen.findByPlaceholderText('e.g. AMZN')
    fireEvent.change(tickerInput, { target: { value: 'NVDA' } })
    fireEvent.submit(tickerInput.closest('form')!)

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/ticker/NVDA'))
  })

  it('main holdings-table ticker links open in the same tab', async () => {
    mockLoad({
      rollup: { ...EMPTY_ROLLUP, openTickers: [openPosition('AMZN')], totalMarketValueCHF: 99 },
    })

    render(<SecuritiesPage />)

    const link = await screen.findByRole('link', { name: 'AMZN' })
    expect(link).not.toHaveAttribute('target', '_blank')
  })
})
