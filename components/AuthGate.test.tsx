import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/apiFetch'
import AuthGate from './AuthGate'

// Guards the specific bug this component was built to fix: a
// valid-but-unauthorized session (Google confirms the account, but the
// backend's users table doesn't) must never show a flash of the real page
// content before the 401 is discovered.

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

let currentPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

const useSessionMock = vi.mocked(useSession)
const apiFetchMock = vi.mocked(apiFetch)

describe('AuthGate', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    apiFetchMock.mockReset()
    currentPathname = '/'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders children immediately in development, without calling the backend', () => {
    vi.stubEnv('NODE_ENV', 'development')
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() } as ReturnType<typeof useSession>)

    render(
      <AuthGate>
        <div>real page content</div>
      </AuthGate>
    )

    expect(screen.getByText('real page content')).toBeInTheDocument()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('renders children immediately on the login page, without calling the backend', () => {
    vi.stubEnv('NODE_ENV', 'production')
    currentPathname = '/login'
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() } as ReturnType<typeof useSession>)

    render(
      <AuthGate>
        <div>login form</div>
      </AuthGate>
    )

    expect(screen.getByText('login form')).toBeInTheDocument()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('shows a loading state, not the real content, while the session is still resolving', () => {
    vi.stubEnv('NODE_ENV', 'production')
    useSessionMock.mockReturnValue({ data: null, status: 'loading', update: vi.fn() } as ReturnType<typeof useSession>)

    render(
      <AuthGate>
        <div>real page content</div>
      </AuthGate>
    )

    expect(screen.queryByText('real page content')).not.toBeInTheDocument()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('renders children once /auth/whoami confirms the session is authorized', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    useSessionMock.mockReturnValue({
      data: { user: { email: 'user@example.com' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    } as ReturnType<typeof useSession>)
    apiFetchMock.mockResolvedValue({ ok: true } as Response)

    render(
      <AuthGate>
        <div>real page content</div>
      </AuthGate>
    )

    expect(screen.queryByText('real page content')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('real page content')).toBeInTheDocument())
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/whoami')
  })

  it('never renders children when /auth/whoami rejects the session (unauthorized)', async () => {
    // This is the exact bug report this component fixes: an authenticated
    // (in the NextAuth sense) but unauthorized (not in the backend's users
    // table) session must never show the real page - apiFetch's own 401
    // interceptor handles signing the user out separately.
    vi.stubEnv('NODE_ENV', 'production')
    useSessionMock.mockReturnValue({
      data: { user: { email: 'attacker@example.com' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    } as ReturnType<typeof useSession>)
    apiFetchMock.mockResolvedValue({ ok: false, status: 401 } as Response)

    render(
      <AuthGate>
        <div>real page content</div>
      </AuthGate>
    )

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/auth/whoami'))
    expect(screen.queryByText('real page content')).not.toBeInTheDocument()
  })
})
