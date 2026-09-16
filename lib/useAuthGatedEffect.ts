import { useEffect, type DependencyList } from 'react'

export function isDevOrAuthenticated(status: string): boolean {
  return process.env.NODE_ENV === 'development' || status === 'authenticated'
}

export function useAuthGatedEffect(status: string, load: () => void, extraDeps: DependencyList = []): void {
  useEffect(() => {
    if (!isDevOrAuthenticated(status)) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ...extraDeps])
}
