export interface ApiActionOptions {
  confirmMessage?: string
  setError: (message: string) => void
  clearErrorBeforeStart?: boolean
  setLoading?: (loading: boolean) => void
  resetLoadingOnSuccess?: boolean
  fallbackErrorMessage: string
}

export async function runApiAction(
  request: () => Promise<Response>,
  onSuccess: (res: Response) => void | Promise<void>,
  options: ApiActionOptions
): Promise<void> {
  const {
    confirmMessage,
    setError,
    clearErrorBeforeStart = true,
    setLoading,
    resetLoadingOnSuccess = true,
    fallbackErrorMessage,
  } = options

  if (confirmMessage && !confirm(confirmMessage)) return

  if (clearErrorBeforeStart) setError('')
  setLoading?.(true)
  try {
    const res = await request()
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed: ${res.status}`)
    }
    await onSuccess(res)
    if (resetLoadingOnSuccess) setLoading?.(false)
  } catch (err) {
    setError(err instanceof Error ? err.message : fallbackErrorMessage)
    setLoading?.(false)
  }
}
