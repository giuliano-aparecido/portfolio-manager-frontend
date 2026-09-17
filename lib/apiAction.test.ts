import { describe, expect, it, vi } from 'vitest'
import { runApiAction } from './apiAction'

const options = () => ({ onError: vi.fn(), fallbackErrorMessage: 'Fallback' })

describe('runApiAction', () => {
  it('returns true and reports nothing for a 2xx response', async () => {
    const opts = options()
    const ok = await runApiAction(() => Promise.resolve(new Response('{}', { status: 200 })), opts)
    expect(ok).toBe(true)
    expect(opts.onError).not.toHaveBeenCalled()
  })

  it("reports the body's error field for a non-2xx response", async () => {
    const opts = options()
    const res = new Response(JSON.stringify({ error: 'Ticker already exists' }), { status: 409 })
    expect(await runApiAction(() => Promise.resolve(res), opts)).toBe(false)
    expect(opts.onError).toHaveBeenCalledWith('Ticker already exists')
  })

  it('reports the status when a non-2xx response has no usable error body', async () => {
    const opts = options()
    expect(await runApiAction(() => Promise.resolve(new Response('not json', { status: 500 })), opts)).toBe(false)
    expect(opts.onError).toHaveBeenCalledWith('Request failed: 500')
  })

  it('reports a thrown Error by its message', async () => {
    const opts = options()
    expect(await runApiAction(() => Promise.reject(new Error('Network down')), opts)).toBe(false)
    expect(opts.onError).toHaveBeenCalledWith('Network down')
  })

  it('reports the fallback message for a non-Error rejection', async () => {
    const opts = options()
    expect(await runApiAction(() => Promise.reject('boom'), opts)).toBe(false)
    expect(opts.onError).toHaveBeenCalledWith('Fallback')
  })
})
