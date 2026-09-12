import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { isDevOrAuthenticated, useAuthGatedEffect } from './useAuthGatedEffect'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isDevOrAuthenticated', () => {
  it('is true in development regardless of session status', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isDevOrAuthenticated('unauthenticated')).toBe(true)
    expect(isDevOrAuthenticated('loading')).toBe(true)
  })

  it('outside development, is true only when authenticated', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isDevOrAuthenticated('authenticated')).toBe(true)
    expect(isDevOrAuthenticated('unauthenticated')).toBe(false)
    expect(isDevOrAuthenticated('loading')).toBe(false)
  })
})

describe('useAuthGatedEffect', () => {
  it('does not call load when not authenticated outside development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const load = vi.fn()
    renderHook(() => useAuthGatedEffect('loading', load))
    expect(load).not.toHaveBeenCalled()
  })

  it('calls load once authenticated', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const load = vi.fn()
    const { rerender } = renderHook(({ status }) => useAuthGatedEffect(status, load), {
      initialProps: { status: 'loading' },
    })
    expect(load).not.toHaveBeenCalled()

    rerender({ status: 'authenticated' })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('re-fires when an extra dependency changes', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const load = vi.fn()
    const { rerender } = renderHook(({ id }) => useAuthGatedEffect('authenticated', load, [id]), {
      initialProps: { id: 'AAPL' },
    })
    expect(load).toHaveBeenCalledTimes(1)

    rerender({ id: 'AAPL' })
    expect(load).toHaveBeenCalledTimes(1)

    rerender({ id: 'MSFT' })
    expect(load).toHaveBeenCalledTimes(2)
  })
})
