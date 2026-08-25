// Matches the SSE frames the backend's POST /agent/ask emits (see its
// PROJECT.md) — a typed union here turns a typo'd or renamed event name
// on either side into a compile-time error at the comparison site
// instead of a silent no-op branch.
export type SSEEventName = 'token' | 'tool_call' | 'tool_result' | 'error' | 'done'

export interface SSEFrame {
  event: SSEEventName
  data: Record<string, unknown>
}

/**
 * Parses one "event: x\ndata: {...}" frame (as split on the blank line
 * between frames by the caller) from the backend's text/event-stream
 * response. Returns null for a malformed/empty frame rather than throwing,
 * since a partial frame can legitimately show up mid-stream before more
 * bytes arrive.
 */
export function parseSSEFrame(frame: string): SSEFrame | null {
  let event = ''
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }

  if (!event || dataLines.length === 0) return null

  try {
    // Cast, not validated against the union: this parses untrusted wire
    // data, so there's no runtime guarantee the server only ever sends a
    // known event name — the type exists to catch mismatches in the
    // *consumer's* comparisons, not to reject an unrecognized one here.
    return { event: event as SSEEventName, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}
