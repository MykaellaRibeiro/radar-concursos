# Radar Concursos — working rules

## Product

Build a Brazilian competition radar, historical database and future exam-intelligence platform. It is not a news portal.

## Architecture

- Next.js App Router + TypeScript + Tailwind on Vercel.
- Supabase provides PostgreSQL, Auth and Storage.
- External data access belongs behind provider interfaces in `src/lib/providers`.
- Heavy collectors, browser automation and PDF processing belong in `workers/`, outside Vercel requests.

## Data rules

- Never invent competitions, dates, salaries, vacancies, boards, applicants, cut scores, sources or statistics.
- Development samples must say `MOCK` and must never be used in production.
- Preserve status history in `movimentacoes`; do not replace history with a single current status.
- Normalize and deduplicate by organization, state, title, year, roles and source before inserting.
- Persist source URLs, collection timestamps, content hashes and confidence.

## Security

- Never expose service-role, database or provider secrets to the browser.
- Enable RLS on every exposed table. User-owned rows require `(select auth.uid()) = user_id` policies.
- Do not use user metadata for authorization.
- Public catalog data is read-only to browser roles; writes happen through trusted server processes.

## Design

- Follow `DESIGN.md` and `docs/design-system.md`.
- Prefer calm, dense, evidence-led layouts over generic admin card grids.
- Maintain keyboard access, visible focus, contrast and 375px–1536px responsiveness.

## Quality gate

Before concluding a phase, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
