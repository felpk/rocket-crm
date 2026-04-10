# Core Libraries — src/lib/

Shared utilities and integrations used by all API routes and pages.

## Files

| File | Purpose | Exports |
|------|---------|---------|
| `db.ts` | Prisma client singleton | `prisma` — single PrismaClient instance with better-sqlite3 adapter |
| `auth.ts` | JWT authentication | `hashPassword`, `verifyPassword`, `createToken`, `verifyToken`, `getSession`, `requireAuth`, `requireAdmin` |
| `logger.ts` | Centralized logging factory | `createLogger(module)` — returns `{ info, warn, error, debug }` |
| `evolution.ts` | WhatsApp Evolution API v2 client | `createInstance`, `deleteInstance`, `getConnectionState`, `getQrCode`, `sendTextMessage`, `fetchMessages`, `setWebhook`, `makeInstanceName` |
| `google-ads.ts` | Google Ads API v20 + OAuth 2.0 | `getAuthUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getValidToken`, `refreshAndRetry`, `listAccessibleAccounts`, `getCampaignMetrics`, `getAccountSummary`, `parseGoogleAdsError` |
| `utils.ts` | General utilities | `cn` (classnames), `STAGES` (6 funnel stages), `formatCurrency` (pt-BR BRL), `formatDate` (pt-BR), `StageId` type |

## Patterns

### Database (db.ts)
- Uses global singleton pattern to avoid multiple PrismaClient instances in dev (hot reload).
- `DATABASE_URL` env var stripped of `file:` prefix and passed to better-sqlite3 adapter.
- Falls back to `./dev.db` if `DATABASE_URL` is not set.

### Authentication (auth.ts)
- JWT tokens signed with `NEXTAUTH_SECRET`, expire in 7 days.
- Stored in `auth-token` httpOnly cookie (set by login API route).
- `SessionUser` contains `{ id, name, email, role }`.
- `requireAuth()` throws `"Unauthorized"` if no valid session — catch as 401 in routes.
- `requireAdmin()` extends `requireAuth()` with role check — throws `"Forbidden"` for non-admin.

### Logger (logger.ts)
- Factory pattern: `const log = createLogger("module-name")`.
- Output format: `[ISO-timestamp] [LEVEL] [module] message {JSON-data}`.
- `debug()` only emits in non-production (`NODE_ENV !== "production"`).
- Every new module MUST create its own logger instance.

### Evolution API (evolution.ts)
- Instance names follow pattern: `rocket-{userId}` (via `makeInstanceName()`).
- All calls go through `evoFetch()` helper that adds `apikey` header and error logging.
- Env vars: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`.
- Webhook events: only `MESSAGES_UPSERT` is configured.

### Google Ads (google-ads.ts)
- OAuth flow: `getAuthUrl()` → Google consent → callback → `exchangeCodeForTokens()`.
- Token refresh: `getValidToken()` auto-refreshes if token expires within 5 minutes.
- On refresh failure: connection is deleted from DB (user must reconnect).
- `refreshAndRetry()` wraps any API call with automatic token refresh on auth failures.
- `parseGoogleAdsError()` translates API errors into user-friendly pt-BR messages.
- Env vars: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REDIRECT_URI`.
- API uses Google Ads Query Language (GAQL) for metric queries.

### Utils (utils.ts)
- `STAGES` is the source of truth for funnel stages — 6 fixed stages:
  1. `lead` (Lead) — blue
  2. `qualification` (Qualificacao) — yellow
  3. `meeting` (Reuniao) — purple
  4. `proposal` (Proposta) — orange
  5. `negotiation` (Negociacao) — cyan
  6. `closed` (Fechado) — green
- Currency/date formatting always uses `pt-BR` locale.

## Adding a New Integration

1. Create `src/lib/<integration>.ts`.
2. Add `const log = createLogger("<integration>")` at the top.
3. Create a private `fetch` wrapper that adds auth headers and logs errors.
4. Export public functions for each API operation.
5. Add env vars to `.env.example`.
