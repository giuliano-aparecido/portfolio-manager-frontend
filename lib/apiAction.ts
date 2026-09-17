export interface ApiActionOptions {
  onError: (message: string) => void
  fallbackErrorMessage: string
}

/**
 * Runs an API request and normalizes its failure into one `onError` message:
 * a non-2xx response reports the body's `error` (or `Request failed: <status>`),
 * a thrown Error reports its message, anything else reports the fallback.
 * Returns whether the request succeeded, so the caller decides what state to
 * change on each outcome.
 */
export async function runApiAction(
  request: () => Promise<Response>,
  { onError, fallbackErrorMessage }: ApiActionOptions
): Promise<boolean> {
  try {
    const res = await request()
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed: ${res.status}`)
    }
    return true
  } catch (err) {
    onError(err instanceof Error ? err.message : fallbackErrorMessage)
    return false
  }
}
