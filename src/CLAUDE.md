# Web App — Next.js Frontend

Next.js 16 web application for the Rocket Marketing CRM.

## Stack
- **Framework**: Next.js 16 (App Router) — TypeScript
- **DB**: SQLite via Prisma 7 (better-sqlite3 adapter)
- **Auth**: JWT with httpOnly cookies (`lib/auth.ts`)
- **UI**: Tailwind CSS, dark theme (#121721 background, #1a1f2e cards, #3b6fd4 accent)

## Structure
```
app/
  (auth)/login, register        — public pages
  (app)/dashboard, funnel,      — authenticated pages
        whatsapp, google-ads,
        automations, admin,
        settings
  api/auth/                     — login, register, logout, me
  api/leads/, api/leads/[id]/   — leads CRUD
  api/whatsapp/                 — status, send, qrcode
  api/google-ads/               — OAuth flow, campaigns, metrics
  api/admin/                    — client management, stats
components/                     — Sidebar, reusable UI
lib/
  auth.ts                       — JWT auth helpers
  db.ts                         — Prisma client
  evolution.ts                  — WhatsApp Evolution API v2 client
  google-ads.ts                 — Google Ads API v19 client
  logger.ts                     — centralized logger
  utils.ts                      — general utilities
```

## Key Patterns
- **Route groups**: `(auth)` for public, `(app)` for authenticated pages.
- **Multi-tenant**: clients see only their data, admin sees everything.
- **Funnel**: 6 fixed stages (Lead → Qualificação → Reunião → Proposta → Negociação → Fechado).
- **Logger**: Use `createLogger("module-name")` for all new modules. All events must be logged.
- **WhatsApp**: Evolution API v2 integration for messaging.
- **Google Ads**: OAuth 2.0 flow, each client connects their own account.
