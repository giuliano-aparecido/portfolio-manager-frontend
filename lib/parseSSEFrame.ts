export interface SSEFrame {
  event: string
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
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}
