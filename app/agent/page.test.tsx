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
  let sent = false
  const encoder = new TextEncoder()
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (!sent) {
            sent = true
            return { done: false, value: encoder.encode(sseBody) }
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
})
