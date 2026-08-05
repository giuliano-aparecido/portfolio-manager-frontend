# Portfolio Manager — Frontend

Next.js/React UI for a multi-currency investment portfolio tracker (FIFO
cost basis, live Yahoo Finance pricing, a manual-gain/loss passive-investment
ledger with recurring deposits), calling a separate Python/FastAPI backend
— [`portfolio-manager-backend`](https://github.com/GiulianoAparecido/portfolio-manager-backend).

## Documentation

- [`PROJECT.md`](PROJECT.md) — architecture and auth design
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — full local setup, environment variables, a common auth pitfall
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branching, PR expectations, code style

## Stack

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS**
- **NextAuth.js** — Google OAuth in production, a fixed auto-signin dev user
  locally; session tokens are standard HS256 JWTs (not NextAuth's default
  encrypted JWE) so the FastAPI backend can verify them with plain PyJWT

## Auth bridge

NextAuth still does the full Google OAuth handshake, but `authOptions.jwt`
overrides the default `encode`/`decode` to issue/verify a standard
HS256-signed JWT using `NEXTAUTH_SECRET` as the shared key with the backend.
`app/api/auth/token/route.ts` exposes the raw encoded token; `lib/apiFetch.ts`
caches it and attaches `Authorization: Bearer <token>` to every backend call.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in NEXTAUTH_SECRET (same value as the backend), NEXT_PUBLIC_API_BASE_URL
npm run dev
```

Requires `portfolio-manager-backend` running locally (see its README) at
the URL configured in `NEXT_PUBLIC_API_BASE_URL`.

## Tests

```bash
npm run test        # vitest run
npm run test:watch  # vitest, watch mode
```

Vitest + React Testing Library. Coverage is deliberately concentrated on the
auth bridge (`lib/auth.ts`, `lib/apiFetch.ts`, `components/AuthGate.tsx`,
`components/Navigation.tsx`, `components/SessionProvider.tsx`) — the one
area of this app that has already regressed multiple times in real usage
(a missed dev-mode bypass, a duplicate sign-out race, an idle-logout timer
that silently reset on every page reload), not a blanket coverage target.

## Type-check / build

```bash
npm run type-check
npm run build
```
