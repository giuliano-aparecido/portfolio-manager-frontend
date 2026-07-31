import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Navigation from './Navigation'

// This exact dev-mode bypass was missed twice in this codebase's history:
// once in the page-level data-fetching gate, and once here in Navigation
// itself (both assumed useSession() would resolve to 'authenticated', which
// never happens in local dev since there's no real sign-in step there).
// These tests exist specifically to catch a third regression.

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

const useSessionMock = vi.mocked(useSession)

describe('Navigation', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders nothing outside development when there is no authenticated session', () => {
    vi.stubEnv('NODE_ENV', 'production')
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() } as ReturnType<typeof useSession>)

    const { container } = render(<Navigation />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the nav outside development once the session is authenticated', () => {
    vi.stubEnv('NODE_ENV', 'production')
    useSessionMock.mockReturnValue({
      data: { user: { email: 'user@example.com' }, expires: '' },
      status: 'authenticated',
      update: vi.fn(),
    } as ReturnType<typeof useSession>)

    render(<Navigation />)
    expect(screen.getByText('Portfolio Manager')).toBeInTheDocument()
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('renders the nav in development even with no session at all', () => {
    // Local dev has no sign-in step - useSession() never resolves to
    // 'authenticated' there, so the nav must still render regardless.
    vi.stubEnv('NODE_ENV', 'development')
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() } as ReturnType<typeof useSession>)

    render(<Navigation />)
    expect(screen.getByText('Portfolio Manager')).toBeInTheDocument()
  })
})
