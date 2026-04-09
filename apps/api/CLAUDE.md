# API — @pedro/api

Fastify 5 backend for the Rocket Marketing platform.

## Stack
- **Runtime**: Node.js + TypeScript (tsx for dev, tsc for build)
- **Framework**: Fastify 5 with CORS and rate limiting
- **DB**: Drizzle ORM — supports PostgreSQL or in-memory mode
- **Auth**: JWT middleware (`src/modules/auth/auth.middleware.ts`)
- **Testing**: Vitest

## Commands
```bash
pnpm dev              # dev server with hot reload (tsx watch)
pnpm build            # compile TypeScript
pnpm start            # run compiled output
pnpm test             # run tests (vitest)
pnpm test:watch       # tests in watch mode
pnpm test:consistency # data consistency checks
pnpm db:generate      # generate Drizzle migrations
pnpm db:migrate       # apply migrations
pnpm db:seed          # seed database
```

## Structure
```
src/
  index.ts              — entry point, Fastify server setup
  config/               — env vars, memory store config
  db/                   — Drizzle schema, migrations, seed
  middleware/            — errorHandler, roleGuard
  modules/
    auth/               — login, register, JWT middleware
    clients/            — client management
    ad-accounts/        — ad account linking
    reporting/          — campaign metrics & reports
  platforms/
    platform.interface.ts   — adapter interface
    platform.registry.ts    — registry pattern for ad platforms
    google-ads/             — Google Ads adapter
    meta-ads/               — Meta Ads adapter
    demo/                   — demo adapter (no credentials needed)
  utils/                — logger, helpers
tests/                  — Vitest test files
```

## Key Patterns
- **Platform adapters**: Ad platforms implement `platform.interface.ts` and register via `platform.registry.ts`. Supports demo mode when no credentials are configured.
- **Memory mode**: Runs without PostgreSQL using an in-memory store — controlled by env config.
- **Role guard**: Middleware for admin-only routes (`middleware/roleGuard.ts`).
- Uses `@pedro/shared` for validators, types, and constants.
