# Development Guide

## Requirements

- Node.js 18+
- [`portfolio-manager-backend`](https://github.com/giuliano-aparecido/portfolio-manager-backend)
  running locally (see its own `DEVELOPMENT.md`) — this app has no
  database of its own and can't do anything useful without the backend.

## First-time setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` needs:

| Variable | Purpose | Local value |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL | `http://localhost:8000` |
| `NEXTAUTH_SECRET` | Shared HMAC key with the backend's JWT verification — **must match exactly** | any string locally; must match the backend's `NEXTAUTH_SECRET` for auth to actually verify |
| `NEXTAUTH_URL` | This app's own URL | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials | not needed locally — see below |

In development (`npm run dev`, which sets `NODE_ENV=development`), you
never need real Google OAuth credentials: signing in uses a fixed
`dev@local.test` user via a `CredentialsProvider`, and `proxy.ts`
skips route protection entirely. Google OAuth and the full auth flow only
apply in a production build.

## Day-to-day start/stop

After the first-time setup above, `scripts/start.ps1` and `scripts/stop.ps1`
(Windows PowerShell) start/stop the dev server in the background:

```powershell
.\scripts\start.ps1   # npm run dev, backgrounded, logs to .dev-server.log
.\scripts\stop.ps1
```

Needs `portfolio-manager-backend` already running (its own
`scripts/start.ps1`) to actually load any data.

## Type-checking and building

```bash
npm run type-check
npm run build
```

Both should be run before pushing — `npm run build` in particular
catches Edge Runtime incompatibilities in `proxy.ts` that
`type-check` alone won't (e.g. a dependency pulling in a Node-only API
that isn't available in the Edge sandbox Vercel actually deploys
Next.js's proxy/middleware layer to).

## Testing a change that touches auth

Because the session token is a custom HS256 JWT rather than NextAuth's
default encrypted format, it's possible to mint one directly (matching
`authOptions.jwt.encode`'s exact logic) for testing without going through
a full Google OAuth round trip — useful for scripting a check against
`proxy.ts` or `apiFetch.ts` without a browser. See
`lib/auth.ts` for the exact `encode`/`decode` implementation to match.

## Common pitfall: proxy.ts and the JWT decode override

(This file was `middleware.ts` before the Next.js 16 upgrade renamed the
convention — same `withAuth()` call, same pitfall, just a different
filename now.)

`next-auth/middleware`'s `withAuth()` performs its own internal
`getToken()` call, which does **not** automatically inherit
`authOptions.jwt.decode` — it needs to be passed explicitly:

```ts
withAuth(proxy, {
  // ...
  jwt: { decode: authOptions.jwt!.decode },
})
```

Omitting this makes every request look unauthenticated (silently — no
error, no log line, just a redirect to `/login`), because `withAuth()`
falls back to NextAuth's default JWE decode, which can't parse this app's
HS256 tokens. If you ever see every page bounce to `/login` right after a
successful sign-in, check this first.
