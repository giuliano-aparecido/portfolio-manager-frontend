import { beforeEach, describe, expect, it, vi } from 'vitest'

// apiFetch keeps its token cache and signingOut flag as module-level state,
// so each test needs a fresh module instance (vi.resetModules + a fresh
// dynamic import) to avoid one test's 401 leaking into the next.
const signOutMock = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

function mockFetchResponses(backendResponse: { ok: boolean; status: number; body?: unknown }) {
  return vi.fn((url: string, _init?: RequestInit) => {
    if (url === '/api/auth/token') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'test-token' }) })
    }
    return Promise.resolve({
      ok: backendResponse.ok,
      status: backendResponse.status,
      json: () => Promise.resolve(backendResponse.body ?? {}),
    })
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetModules()
    signOutMock.mockClear()
  })

  it('attaches the token fetched from /api/auth/token as a Bearer header', async () => {
    const fetchMock = mockFetchResponses({ ok: true, status: 200 })
    // @ts-expect-error - simplified mock, not a full Fetch Response
    global.fetch = fetchMock

    const { apiFetch } = await import('./apiFetch')
    await apiFetch('/portfolio-rollup')

    const backendCall = fetchMock.mock.calls.find(([url]) => url !== '/api/auth/token')
    expect(backendCall).toBeDefined()
    const [, init] = backendCall as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('does not sign out on a successful response', async () => {
    // @ts-expect-error - simplified mock
    global.fetch = mockFetchResponses({ ok: true, status: 200 })

    const { apiFetch } = await import('./apiFetch')
    await apiFetch('/portfolio-rollup')

    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('does not sign out on a non-401 error response', async () => {
    // @ts-expect-error - simplified mock
    global.fetch = mockFetchResponses({ ok: false, status: 500 })

    const { apiFetch } = await import('./apiFetch')
    await apiFetch('/portfolio-rollup')

    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('signs out with the AccessDenied redirect on a 401', async () => {
    // @ts-expect-error - simplified mock
    global.fetch = mockFetchResponses({ ok: false, status: 401 })

    const { apiFetch } = await import('./apiFetch')
    await apiFetch('/portfolio-rollup')

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/login?error=AccessDenied' })
  })

  it('signs out exactly once when two requests both 401 concurrently', async () => {
    // Regression coverage: a naive "if 401, signOut()" with no guard would
    // fire signOut() twice when e.g. Promise.all([...]) issues several
    // requests at once and the session has already been revoked - annoying
    // at best (duplicate redirects), and the reason the signingOut flag
    // exists in the first place.
    // @ts-expect-error - simplified mock
    global.fetch = mockFetchResponses({ ok: false, status: 401 })

    const { apiFetch } = await import('./apiFetch')
    await Promise.all([apiFetch('/portfolio-rollup'), apiFetch('/passive-rollup')])

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('returns the backend response unchanged', async () => {
    // @ts-expect-error - simplified mock
    global.fetch = mockFetchResponses({ ok: true, status: 200, body: { hello: 'world' } })

    const { apiFetch } = await import('./apiFetch')
    const res = await apiFetch('/portfolio-rollup')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ hello: 'world' })
  })
})
