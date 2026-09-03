# Fives Rewards

Loyalty PWA for **Fives Pub & Grill** (South Africa). Mobile-first React app plus a
Cloudflare Worker API, deployed as a single Worker.

Build plan lives in [CHECKLIST.md](CHECKLIST.md) and
[FIVES_REWARDS_MASTER_PROMPT_CLOUDFLARE.md](FIVES_REWARDS_MASTER_PROMPT_CLOUDFLARE.md).

## Stack

| Layer    | Choice                                                          |
| -------- | --------------------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript (strict), React Router, Tailwind v4, TanStack Query, React Hook Form, Zod, Lucide |
| API      | Cloudflare Workers + Hono                                        |
| Data     | Cloudflare D1 + Drizzle ORM                                      |
| Auth     | Better Auth, D1-backed sessions *(Phase 3)*                      |
| Storage  | Cloudflare R2                                                    |
| Shell    | vite-plugin-pwa; Capacitor-ready abstractions                    |

The browser never talks to D1. Every read and write goes through the Worker, which
validates the session, role, business scope and input before touching the database.

```
React SPA  ->  Worker (Hono)  ->  session + role + Zod  ->  D1 / R2
```

## Getting started

```bash
npm install
npm run dev          # Vite + Workers runtime on one origin
```

Open http://localhost:5173 — the landing page calls `/api/health` to prove the SPA
can reach the Worker.

| Script                    | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Dev server (SPA + Worker together)            |
| `npm run build`           | Production build                              |
| `npm run preview`         | Build, then serve via the Workers runtime     |
| `npm run typecheck`       | Typecheck app, Worker and build configs       |
| `npm run cf-typegen`      | Regenerate `worker-configuration.d.ts`        |
| `npm run db:generate`     | Generate Drizzle migrations                   |
| `npm run db:migrate:local`| Apply migrations to the local D1              |
| `npm run db:seed:local`   | Seed development data (dev server must be up) |
| `npm run deploy`          | Build and deploy the Worker                   |

Run `npm run cf-typegen` after any change to `wrangler.jsonc`.

## Database

The schema is Drizzle, split by domain under `worker/db/schema`. It is SQLite-only —
integer millisecond timestamps, integer booleans, text ids, money as integer cents.

```bash
npm run db:generate        # schema -> drizzle/migrations/*.sql
npm run db:migrate:local   # apply to the local D1
npm run dev                # in another terminal
npm run db:seed:local      # POST /api/dev/seed
```

Files under `worker/db/schema` use relative imports rather than the `@worker/*` alias,
because drizzle-kit bundles them without the Worker tsconfig.

Rules the database enforces itself, so no application bug can violate them:

- `loyalty_transactions.idempotency_key` is globally unique — a replayed write fails.
- `customer_rewards.issuance_key` is unique, so a reward can never be issued twice.
- At most one `welcome_reward` per business (partial unique index).
- Loyalty history is append-only. Correct a mistake with a `reversal` row, never an
  `UPDATE` or `DELETE`.

`POST /api/dev/seed` is re-runnable and returns 404 unless `APP_ENV=development`.
It seeds Fives Pub & Grill, Fives Main Branch, Fives Coffee Rewards (stamp,
threshold 10), Free Coffee, the R50 welcome voucher, eight menu categories with
placeholder items, and the Wednesday Burger Special.

Test users are created through Better Auth in Phase 3; the seed deliberately creates
no accounts and no credentials.

## Cloudflare resources

D1 `fives-rewards-db` and R2 `fives-rewards-media` already exist and are wired into
`wrangler.jsonc`. To recreate them in a different account:

```bash
npx wrangler login
npx wrangler d1 create fives-rewards-db      # paste the id into wrangler.jsonc
npx wrangler r2 bucket create fives-rewards-media
npm run cf-typegen
npm run db:migrate:remote
```

Bindings: `DB` (D1), `MEDIA` (R2), `ASSETS` (static assets).

## Environment and secrets

- `.env.example` — frontend-safe `VITE_*` values only. Copy to `.env`.
- `.dev.vars.example` — local Worker secrets. Copy to `.dev.vars` (git-ignored).
- Production secrets: `npx wrangler secret put BETTER_AUTH_SECRET`.

Never put a secret in a `VITE_*` variable; those are compiled into the browser bundle.

## Layout

```
src/            React SPA
  components/ui/  design-system primitives
  features/       feature-scoped hooks and API calls
  pages/          route components
  providers/      React context providers
  routes/         router definition
  lib/            fetch client, query client, helpers
worker/         Cloudflare Worker
  routes/         Hono routers, grouped by audience
  lib/            response envelope, errors
  db/             Drizzle schema, client, development seed
shared/         types shared by SPA and Worker
drizzle/        generated D1 migrations
scripts/        one-off build helpers
```

`shared/api.ts` defines the response envelope used everywhere:

```jsonc
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "forbidden", "message": "…" } }
```

## Money and time

- Money is stored as **integer cents** (`R89.90` → `8990`). Currency `ZAR`.
- Timestamps are UTC in the database, displayed in `Africa/Johannesburg`.

## PWA

Manifest name **Fives Rewards**, short name **Fives**, `display: standalone`.
Icons in `public/icons` are placeholders generated by
`node scripts/generate-placeholder-icons.mjs` — replace with real artwork before launch.

Loyalty mutations are deliberately excluded from offline caching. Earning, redeeming
and code generation must always reach the server.
