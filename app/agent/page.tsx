'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/apiFetch'
import { parseSSEFrame } from '@/lib/parseSSEFrame'

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

  function appendToLastAssistant(text: string) {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, content: last.content + text }
      return next
    })
  }

  function addToolCallToLastAssistant(name: string) {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      const toolCalls = last.toolCalls ? [...last.toolCalls, name] : [name]
      next[next.length - 1] = { ...last, toolCalls }
      return next
    })
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

    try {
      const res = await apiFetch('/agent/ask', {
        method: 'POST',
        body: JSON.stringify({ messages: requestMessages }),
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const rawFrame of frames) {
          const parsed = parseSSEFrame(rawFrame)
          if (!parsed) continue

          if (parsed.event === 'token' && typeof parsed.data.text === 'string') {
            appendToLastAssistant(parsed.data.text)
          } else if (parsed.event === 'tool_call' && typeof parsed.data.name === 'string') {
            addToolCallToLastAssistant(parsed.data.name)
          } else if (parsed.event === 'error') {
            throw new Error(typeof parsed.data.message === 'string' ? parsed.data.message : 'The assistant hit an error.')
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get a response')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ask AI</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

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
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your portfolio..."
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
