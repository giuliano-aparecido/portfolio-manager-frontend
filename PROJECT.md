# Project Overview

## What this is

The web UI for a multi-currency personal investment portfolio tracker,
with CHF as the base currency, calling a separate Python/FastAPI backend —
[`portfolio-manager-backend`](https://github.com/GiulianoAparecido/portfolio-manager-backend).

Two portfolio types are tracked, with separate pages because they behave
differently:

- **Securities** (`/securities`, `/ticker/[ticker]`) — stocks/ETFs/crypto
  positions with live market prices, FIFO cost basis, realized/unrealized
  gains.
- **Passive investments** (`/passive`, `/passive/[id]`) — cash accounts,
  pension funds, investment funds with no live price; valued via a
  deposit/withdrawal ledger plus an optional manually-entered gain/loss
  percentage.

`/` (Overview) shows both portfolios' totals side by side.

## Architecture

```
app/
  layout.tsx              Root layout: session provider + navigation
  page.tsx                Overview (both portfolios' totals)
  login/page.tsx           Sign-in page (Google OAuth in production)
  securities/page.tsx       Securities table, sorting, gainers/losers
  ticker/[ticker]/page.tsx  Single ticker's transactions + realized sales
  passive/page.tsx          Passive investments table
  passive/[id]/page.tsx     Single passive investment's ledger + recurring deposit
  api/auth/[...nextauth]/route.ts   NextAuth handler (Google OAuth / dev credentials)
  api/auth/token/route.ts           Exposes the raw session JWT for apiFetch
components/                Forms (add/edit) and shared display components
lib/
  auth.ts                  NextAuth config, including the custom JWT encode/decode
  apiFetch.ts              fetch() wrapper: attaches the session as a Bearer token
  portfolio/, passive/     Shared TypeScript types + validation constants
components/
  SessionProvider.tsx      NextAuth session context + idle-logout watcher (below)
proxy.ts                   Page-level route protection (redirects to /login) -
                            named middleware.ts before the Next.js 16 upgrade;
                            Next 16 renamed the convention, next-auth's
                            withAuth() itself didn't need any change
```

Every page is a client component that calls the backend directly via
`apiFetch()` — there's no server-side data fetching or same-origin API
route standing in between. This frontend has **no database access at
all**; every piece of data comes from the FastAPI backend.

## Auth architecture

Google OAuth happens entirely through NextAuth, a standard login flow.
What's less standard is the session token format: NextAuth's default is
an encrypted JWE, which isn't
practical to verify from a separate Python service. `authOptions.jwt`
overrides the default `encode`/`decode` to issue/verify a standard
HS256-signed JWT instead, using `NEXTAUTH_SECRET` as a key shared with
the backend (which verifies it with plain PyJWT — see the backend's
`PROJECT.md`).

Because `useSession()`/`getServerSession()` only expose the *decoded*
session payload (and the session cookie is httpOnly, invisible to client
JS), `app/api/auth/token/route.ts` is a small dedicated route that
extracts the raw encoded token so `lib/apiFetch.ts` can attach it as
`Authorization: Bearer <token>` on every backend call.

`proxy.ts`'s `withAuth()` call must be given the same custom `jwt.decode`
function `authOptions` uses — otherwise it silently falls back to
NextAuth's default JWE decode, which can't read this app's HS256 tokens,
and every request looks unauthenticated regardless of a real session. If
pages ever start bouncing back to `/login` right after a successful
sign-in with no visible error, this is the first thing to check.

**Allowlist enforcement lives entirely backend-side.** The frontend's
`signIn` callback only asserts that Google returned an email address — it
never checks a database. Every actual authorization decision (is this
email allowed to use the app at all) happens on every single backend
request, via the backend's own `users` table. This avoids having two
separate, potentially-diverging copies of the same allowlist check.

## Local vs. production auth

In development (`NODE_ENV=development`), a `CredentialsProvider` lets you
sign in instantly as a fixed `dev@local.test` user — no real Google
credentials needed locally, and `proxy.ts` skips its own auth check
entirely in dev. Production requires a real Google OAuth app and enforces
the backend's allowlist.

## Idle logout

`components/SessionProvider.tsx` signs a user out after 15 minutes of no
mouse/keyboard/scroll/touch activity, redirecting to
`/login?error=SessionExpired`. This matters more here than in a typical
app: real portfolio/transaction data sits on screen the whole time a tab
is left open and idle.

The naive version of this (a plain in-memory `setTimeout`) doesn't
actually work on mobile: a fresh page load — which is exactly what
happens when a mobile browser discards a backgrounded tab and reloads it
later — resets the timer to a full 15 minutes with no memory of how long
the user was actually away. The fix persists a last-activity timestamp to
`localStorage` and checks elapsed wall-clock time against it on mount and
on `visibilitychange`, signing out immediately if the threshold has
already passed rather than always granting a fresh grace period. See the
component's own comments and `components/SessionProvider.test.tsx` for
the specific regression this covers.

Deliberately not touched: the underlying session/JWT lifetime
(`SESSION_MAX_AGE_SECONDS` in `lib/auth.ts`, currently NextAuth's 30-day
default). That token doubles as the bearer token the backend verifies
directly, so shortening it is a separate, more consequential call than an
idle-timer addition should make as a side effect.
