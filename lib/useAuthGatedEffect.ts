import { useEffect, type DependencyList } from 'react'

// Middleware already blocks anonymous requests to these pages server-side
// in production, but this avoids a wasted backend round trip during the
// brief moment useSession() takes to hydrate client-side (and defends
// against ever firing this call with no session at all). Skipped in
// development, where there's no sign-in step at all and the backend
// auto-provisions a fixed user regardless of session state.
export function isDevOrAuthenticated(status: string): boolean {
  return process.env.NODE_ENV === 'development' || status === 'authenticated'
}

export function useAuthGatedEffect(status: string, load: () => void, extraDeps: DependencyList = []): void {
  useEffect(() => {
    if (!isDevOrAuthenticated(status)) return
    load()
    // `load` is intentionally omitted: callers pass a new closure each render,
    // and only status/extraDeps should re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ...extraDeps])
}
