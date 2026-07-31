# Contributing

This is a personal project, but the workflow below applies to any change,
human or AI-assisted.

## Branching

- Never commit directly to `main`. Every change goes on a feature branch
  cut from an up-to-date `main`.
- Branch prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- Only the repository owner pushes to `main` — that happens by merging a
  reviewed pull request, not by pushing directly.

```bash
git checkout main
git pull origin main
git checkout -b fix/short-description
```

## Before opening a pull request

```bash
npm run type-check
npm run build
```

`npm run build` is not optional here — it catches a category of bug
`type-check` can't: Edge Runtime incompatibilities in `middleware.ts`
(e.g. a dependency that only works in Node, not the Edge sandbox Vercel
actually runs middleware in).

If the change touches sign-in, `middleware.ts`, or anything under
`lib/auth.ts`/`lib/apiFetch.ts`, do a manual end-to-end check: build in
production mode (`npm run build && npm run start`), and confirm both that
an unauthenticated request redirects to `/login` *and* that a real
session gets through — it's easy to accidentally "fix" one direction
while silently breaking the other.

## What a good PR description covers

- What changed and why (the "why" matters more than the "what" — the diff
  already shows what changed).
- For an auth-related fix in particular: what the actual failure mode
  was and how you confirmed the fix addresses it, since these bugs
  characteristically produce no error message at all.

## Code style

- Every page under `app/` is a client component (`'use client'`) that
  calls the backend via `apiFetch()` — there is no server-side data
  fetching layer to route around. Keep new pages consistent with this.
- Don't add speculative abstractions, config flags, or error handling for
  cases that can't occur given how a component is actually used. Validate
  at real boundaries (a form submission, an API response) — trust your
  own internal call graph.
- Shared TypeScript types/constants belong in `lib/portfolio/` or
  `lib/passive/`, not duplicated per-component. Some page components do
  still declare their own local interfaces mirroring the backend response
  shape (matching the original app's own pattern) — that's an accepted
  inconsistency, not something to "fix" opportunistically in an unrelated
  PR.
