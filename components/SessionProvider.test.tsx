import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import { SessionProvider } from './SessionProvider'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

const useSessionMock = vi.mocked(useSession)
const signOutMock = vi.mocked(signOut)

const AUTHENTICATED = {
  data: { user: { email: 'user@example.com' }, expires: '' },
  status: 'authenticated',
  update: vi.fn(),
} as ReturnType<typeof useSession>

describe('SessionProvider idle logout', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    signOutMock.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not sign out when there is no session, no matter how long it waits', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() } as ReturnType<typeof useSession>)
    render(
      <SessionProvider>
        <div>content</div>
      </SessionProvider>
    )

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('signs out after 15 minutes with no activity while a session is active', () => {
    useSessionMock.mockReturnValue(AUTHENTICATED)
    render(
      <SessionProvider>
        <div>content</div>
      </SessionProvider>
    )

    vi.advanceTimersByTime(15 * 60 * 1000)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/login?error=SessionExpired' })
  })

  it('resets the idle timer on activity instead of signing out early', () => {
    useSessionMock.mockReturnValue(AUTHENTICATED)
    render(
      <SessionProvider>
        <div>content</div>
      </SessionProvider>
    )

    vi.advanceTimersByTime(10 * 60 * 1000)
    window.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(signOutMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })
})
