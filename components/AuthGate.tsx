'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { apiFetch } from '@/lib/apiFetch'

/**
 * Middleware already blocks anonymous requests (no session at all), but a
 * session that decodes fine can still belong to an email the backend's
 * users table doesn't recognize - middleware can't tell the difference
 * without calling the backend itself. Without this gate, the app shell
 * (nav, page content) would render immediately and only react to the
 * rejection once a real data call 401s, which is a full second of showing
 * a logged-in-looking page to someone who isn't actually authorized.
 *
 * This calls GET /auth/whoami once per session and holds off rendering
 * anything but a blank loading state until it succeeds. On a 401,
 * apiFetch's own interceptor (see lib/apiFetch.ts) signs the user out and
 * redirects to /login - this component just needs to not render the real
 * page while that happens.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const [verified, setVerified] = useState(false)

  const isLoginPage = pathname === '/login'
  const skipCheck = process.env.NODE_ENV === 'development' || isLoginPage

  useEffect(() => {
    if (skipCheck || status !== 'authenticated') return
    let cancelled = false
    apiFetch('/auth/whoami').then((res) => {
      if (!cancelled && res.ok) setVerified(true)
    })
    return () => {
      cancelled = true
    }
  }, [skipCheck, status])

  if (skipCheck || verified) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  )
}
