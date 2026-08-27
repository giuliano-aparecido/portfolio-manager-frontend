import { describe, expect, it } from 'vitest'
import { parseSSEFrame } from './parseSSEFrame'

describe('parseSSEFrame', () => {
  it('parses an event/data frame', () => {
    const result = parseSSEFrame('event: token\ndata: {"text":"hello"}')
    expect(result).toEqual({ event: 'token', data: { text: 'hello' } })
  })

  it('parses a frame with an empty data object', () => {
    const result = parseSSEFrame('event: done\ndata: {}')
    expect(result).toEqual({ event: 'done', data: {} })
  })

  it('joins multiple data: lines before parsing (SSE multi-line data)', () => {
    const result = parseSSEFrame('event: token\ndata: {"text":\ndata: "hello"}')
    expect(result).toEqual({ event: 'token', data: { text: 'hello' } })
  })

  it('returns null when there is no event line', () => {
    expect(parseSSEFrame('data: {"text":"hello"}')).toBeNull()
  })

  it('returns null when there is no data line', () => {
    expect(parseSSEFrame('event: done')).toBeNull()
  })

  it('returns null for malformed JSON rather than throwing', () => {
    expect(parseSSEFrame('event: token\ndata: not json')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseSSEFrame('')).toBeNull()
  })
})
