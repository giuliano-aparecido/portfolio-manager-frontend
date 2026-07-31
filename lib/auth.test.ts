// jose's WebCrypto-backed signing does an `instanceof Uint8Array` check
// internally; jsdom's global realm has its own Uint8Array distinct from
// Node's, so under the jsdom environment (this project's default, for
// component tests) that check fails with a confusing "payload must be an
// instance of Uint8Array". This file doesn't touch the DOM at all, so run
// it under plain Node instead.
// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// lib/auth.ts computes IS_DEV and validates NEXTAUTH_SECRET at *module load
// time*, so every test needs a fresh module instance (vi.resetModules) with
// env vars set beforehand - reusing one import across tests would just
// reuse whatever secret/IS_DEV the first import happened to see.

describe('lib/auth NEXTAUTH_SECRET fail-fast guard', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws outside development when NEXTAUTH_SECRET is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    await expect(import('./auth')).rejects.toThrow(/NEXTAUTH_SECRET/)
  })

  it('throws outside development when NEXTAUTH_SECRET is still the insecure placeholder', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'dev-only-insecure-secret-change-me')
    await expect(import('./auth')).rejects.toThrow(/NEXTAUTH_SECRET/)
  })

  it('does not throw outside development with a real secret configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'a-real-production-secret')
    await expect(import('./auth')).resolves.toBeDefined()
  })

  it('does not throw in development even with no secret configured', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    await expect(import('./auth')).resolves.toBeDefined()
  })
})

describe('lib/auth session JWT encode/decode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'a-real-production-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips an email through encode then decode', async () => {
    const { authOptions } = await import('./auth')
    const token = await authOptions.jwt!.encode!({ token: { email: 'test@example.com' }, secret: '', maxAge: 3600 })
    const decoded = await authOptions.jwt!.decode!({ token, secret: '' })
    expect(decoded?.email).toBe('test@example.com')
  })

  it('rejects a token signed with a different secret', async () => {
    const forgedModule = await import('./auth')
    const forged = await forgedModule.authOptions.jwt!.encode!({
      token: { email: 'attacker@example.com' },
      secret: '',
      maxAge: 3600,
    })

    vi.resetModules()
    vi.stubEnv('NEXTAUTH_SECRET', 'a-different-secret-entirely')
    const wrongSecretModule = await import('./auth')
    const decoded = await wrongSecretModule.authOptions.jwt!.decode!({ token: forged, secret: '' })

    expect(decoded).toBeNull()
  })

  it('returns null for a garbage token string instead of throwing', async () => {
    const { authOptions } = await import('./auth')
    const decoded = await authOptions.jwt!.decode!({ token: 'not-a-real-jwt', secret: '' })
    expect(decoded).toBeNull()
  })

  it('returns null when there is no token at all', async () => {
    const { authOptions } = await import('./auth')
    const decoded = await authOptions.jwt!.decode!({ token: undefined, secret: '' })
    expect(decoded).toBeNull()
  })
})
