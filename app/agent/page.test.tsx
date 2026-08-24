import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentPage from './page'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <>{children}</>,
}))

const apiFetchMock = vi.fn()
vi.mock('@/lib/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

function mockStreamingResponse(sseBody: string) {
  return mockChunkedStreamingResponse([sseBody])
}

function mockChunkedStreamingResponse(chunks: string[]) {
  let index = 0
  const encoder = new TextEncoder()
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const chunk = chunks[index]
            index += 1
            return { done: false, value: encoder.encode(chunk) }
          }
          return { done: true, value: undefined }
        },
      }),
    },
  }
}

describe('AgentPage', () => {
  it('renders the empty-state prompt with no messages sent yet', () => {
    render(<AgentPage />)
    expect(screen.getByText(/ask a question about your portfolio/i)).toBeInTheDocument()
  })

  it('sends a message, renders the user bubble, and streams the assistant reply with a tool-call badge', async () => {
    const sse = [
      'event: token\ndata: {"text":"You "}',
      'event: token\ndata: {"text":"hold AAPL."}',
      'event: tool_call\ndata: {"name":"get_holdings"}',
      'event: done\ndata: {}',
    ].join('\n\n') + '\n\n'
    apiFetchMock.mockResolvedValue(mockStreamingResponse(sse))

    render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), {
      target: { value: 'What do I hold?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText('What do I hold?')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('You hold AAPL.')).toBeInTheDocument())
    expect(screen.getByText('Used: get_holdings')).toBeInTheDocument()

    const [path, init] = apiFetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/agent/ask')
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: 'user', content: 'What do I hold?' }],
    })
  })

  it('shows an error banner when the stream reports an error event', async () => {
    const sse = 'event: error\ndata: {"message":"The assistant hit an unexpected error."}\n\n'
    apiFetchMock.mockResolvedValue(mockStreamingResponse(sse))

    render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText('The assistant hit an unexpected error.')).toBeInTheDocument())
  })

  it('shows an error banner when the backend response is not ok', async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    })

    render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText('Internal server error')).toBeInTheDocument())
  })

  it('flushes a final frame with no trailing blank-line separator', async () => {
    // No "\n\n" after the last event — the stream just ends there, as a
    // real connection close might. Without flushing the leftover buffer,
    // this frame (and thus the visible reply) would be silently dropped.
    const sse = 'event: token\ndata: {"text":"Done, no trailing separator."}'
    apiFetchMock.mockResolvedValue(mockStreamingResponse(sse))

    render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText('Done, no trailing separator.')).toBeInTheDocument())
  })

  it('reassembles a frame split across two chunks at the boundary', async () => {
    // The frame's "\n\n" terminator itself is split across two
    // reader.read() calls - exercises the buffer += accumulation, not
    // just single-chunk parsing.
    const chunks = ['event: token\ndata: {"text":"split"}\n', '\nevent: done\ndata: {}\n\n']
    apiFetchMock.mockResolvedValue(mockChunkedStreamingResponse(chunks))

    render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText('split')).toBeInTheDocument())
  })

  it('aborts the in-flight stream on unmount and does not surface an error banner', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Rejects like a real aborted fetch would, once the signal actually
    // aborts - not just a promise that hangs forever - so this exercises
    // the catch block's controller.signal.aborted early-return, not merely
    // that AbortController.abort() got called somewhere.
    apiFetchMock.mockImplementation(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
    )

    const { unmount } = render(<AgentPage />)

    fireEvent.change(screen.getByPlaceholderText(/ask about your portfolio/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())

    unmount()

    expect(abortSpy).toHaveBeenCalled()
    // No DOM left to assert an error banner's absence against post-unmount,
    // but if the signal.aborted early-return were missing, the rejection
    // above would fall through to setError on the unmounted component -
    // this awaits a tick so any resulting console warning/unhandled
    // rejection has a chance to surface before the assertion below.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consoleErrorSpy).not.toHaveBeenCalled()

    abortSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})
