import { signOut } from 'next-auth/react'

let cachedToken: string | null = null
let cachedAt = 0
const TOKEN_CACHE_MS = 60_000 // re-fetch at most once a minute
let signingOut = false

async function getCachedToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && now - cachedAt < TOKEN_CACHE_MS) {
    return cachedToken
  }
  try {
    const res = await fetch('/api/auth/token')
    if (!res.ok) {
      cachedToken = null
      return null
    }
    const body = await res.json()
    cachedToken = body.token
    cachedAt = now
    return cachedToken
  } catch {
    cachedToken = null
    return null
  }
}

/**
 * Drop-in replacement for fetch() against the FastAPI backend: resolves
 * the base URL from NEXT_PUBLIC_API_BASE_URL and attaches the current
 * session as a Bearer token (see app/api/auth/token/route.ts).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCachedToken()
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers })

  // A valid NextAuth session only means Google confirmed the account -
  // the backend's users table is the actual allowlist. A 401 here means
  // this account isn't authorized at all, so the session shouldn't be
  // treated as "logged in" any further: sign out immediately rather than
  // leaving a half-authenticated shell (nav + email still visible) next
  // to an error banner.
  if (res.status === 401 && !signingOut) {
    signingOut = true
    void signOut({ callbackUrl: '/login?error=AccessDenied' })
  }

  return res
}
