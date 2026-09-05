'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/apiFetch'
import { parseSSEFrame, type SSEFrame } from '@/lib/parseSSEFrame'

// Lazy-loaded like recharts in app/securities/page.tsx — no reason to
// bundle a markdown renderer into every page's initial load.
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Abandon an in-flight stream on navigation away — otherwise the read
    // loop keeps running, keeps calling setMessages/setError on an
    // unmounted page, and the connection never closes.
    return () => abortControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function updateLastMessage(updater: (message: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      const next = [...prev]
      next[next.length - 1] = updater(next[next.length - 1])
      return next
    })
  }

  function appendToLastAssistant(text: string) {
    updateLastMessage((last) => ({ ...last, content: last.content + text }))
  }

  function addToolCallToLastAssistant(name: string) {
    updateLastMessage((last) => ({ ...last, toolCalls: last.toolCalls ? [...last.toolCalls, name] : [name] }))
  }

  // No branch for 'tool_result' or 'done' - both are intentionally inert
  // here. 'tool_result' is the raw tool output for the backend's own use;
  // the UI only ever shows that a tool was called (via 'tool_call'
  // above), not its result, which instead reaches the user through the
  // model's own subsequent 'token' text. 'done' is redundant with the
  // stream's own end-of-body signal, which readStream already detects
  // via reader.read()'s `done` flag - there's nothing left to do once
  // that fires.
  function handleFrame(parsed: SSEFrame) {
    if (parsed.event === 'token' && typeof parsed.data.text === 'string') {
      appendToLastAssistant(parsed.data.text)
    } else if (parsed.event === 'tool_call' && typeof parsed.data.name === 'string') {
      addToolCallToLastAssistant(parsed.data.name)
    } else if (parsed.event === 'error') {
      const message = parsed.data.message
      throw new Error(typeof message === 'string' && message ? message : 'The assistant hit an error.')
    }
  }

  function processFrames(rawFrames: string[]) {
    for (const rawFrame of rawFrames) {
      const parsed = parseSSEFrame(rawFrame)
      if (parsed) handleFrame(parsed)
    }
  }

  async function readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        processFrames(frames)
      }
    } finally {
      // Otherwise a frame that throws mid-loop (e.g. an "error" event)
      // leaves the reader locked forever, since only the done-path above
      // would naturally fall through to release it.
      reader.releaseLock()
    }

    buffer += decoder.decode() // flush a multi-byte UTF-8 sequence split across the last chunk

    // The final chunk isn't guaranteed to end with the "\n\n" separator
    // between frames — without this, a last frame with no trailing
    // blank line (e.g. the server's closing `done`/`error` event) would
    // sit in `buffer` and never get parsed or surfaced.
    if (buffer.trim()) processFrames([buffer])
  }

  async function send() {
    const question = input.trim()
    if (!question || isSending) return

    const userMessage: ChatMessage = { role: 'user', content: question }
    // Whole running conversation is resent every turn — nothing is kept
    // server-side (see PROJECT.md's agent-chat section).
    const requestMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, userMessage, { role: 'assistant', content: '' }])
    setInput('')
    setIsSending(true)
    setError('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await apiFetch('/agent/ask', {
        method: 'POST',
        body: JSON.stringify({ messages: requestMessages }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }

      await readStream(res.body)
    } catch (e) {
      if (controller.signal.aborted) return // navigated away or superseded — not a real error
      setError(e instanceof Error ? e.message : 'Failed to get a response')
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      setIsSending(false)
    }
  }

  function newChat() {
    // Abandon an in-flight stream (if any) before dropping the transcript,
    // so its read loop stops calling setState on a conversation that's
    // gone — same reason the unmount effect aborts.
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setMessages([])
    setInput('')
    setError('')
    setIsSending(false)
    // The button unmounts itself once messages is empty, so focus would
    // otherwise fall to <body>.
    inputRef.current?.focus()
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ask AI</h1>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
          >
            New chat
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">
            Ask a question about your portfolio — e.g. &quot;where am I overweight?&quot; or &quot;what would selling
            5 shares of AAPL do to my allocation?&quot;
          </p>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xl rounded-lg shadow p-4 text-sm ${
                message.role === 'user' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold">
                  <ReactMarkdown>{message.content || '…'}</ReactMarkdown>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.toolCalls.map((name, toolIndex) => (
                    <span
                      key={`${name}-${toolIndex}`}
                      className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
                    >
                      Used: {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your portfolio..."
          aria-label="Ask about your portfolio"
          disabled={isSending}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
