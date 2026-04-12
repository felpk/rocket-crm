# Web App — src/

Next.js 16 web application for the Rocket Marketing CRM. This is the main application — all user-facing features live here.

## Stack
- **Framework**: Next.js 16.2.2 (App Router, Turbopack) — TypeScript
- **DB**: SQLite via Prisma 7 (better-sqlite3 adapter)
- **Auth**: JWT with httpOnly cookies (`lib/auth.ts`)
- **UI**: Tailwind CSS 4, dark theme only (`#121721` background, `#1a1f2e` cards, `#3b6fd4` accent)
- **Icons**: Lucide React
- **Drag-Drop**: @hello-pangea/dnd (React Beautiful DnD fork)

## Directory Structure
```
src/
├── app/                          — Next.js App Router (see app/CLAUDE.md)
│   ├── (auth)/login, register    — Public pages
│   ├── (app)/dashboard, funnel,  — Authenticated pages
│   │        automations, whatsapp,
│   │        google-ads, admin, settings
│   ├── api/                      — REST API routes (see api/CLAUDE.md)
│   ├── layout.tsx                — Root layout (Geist fonts, metadata)
│   └── page.tsx                  — Entry redirect (→ dashboard or login)
├── components/                   — Shared UI (see components/CLAUDE.md)
│   └── Sidebar.tsx               — Navigation sidebar
├── lib/                          — Core libraries (see lib/CLAUDE.md)
│   ├── auth.ts                   — JWT authentication
│   ├── db.ts                     — Prisma client singleton
│   ├── evolution.ts              — WhatsApp Evolution API v2
│   ├── google-ads.ts             — Google Ads API v20 + OAuth
│   ├── logger.ts                 — Centralized logger
│   ├── utils.ts                  — Utilities (stages, formatting)
│   └── automations/              — Automation engine (see automations/CLAUDE.md)
│       ├── types.ts              — Types, labels, colors
│       ├── engine.ts             — Execution engine
│       └── templates.ts          — Message template renderer
└── generated/prisma/             — Prisma client (gitignored, run npx prisma generate)
```

## Key Patterns

### Route Groups
- `(auth)` — Public pages (login, register). No sidebar, centered layout.
- `(app)` — Authenticated pages. Sidebar layout, session check in server component.

### Multi-Tenant Access
- Clients see only their data (`userId` filter in all queries).
- Admin sees everything — can optionally filter by `?userId=` param.
- Authorization checked in every API route with `requireAuth()` / `requireAdmin()`.

### Funnel Stages
6 fixed stages defined in `lib/utils.ts`:
`lead` → `qualification` → `meeting` → `proposal` → `negotiation` → `closed`

### Logging
Every module uses `createLogger("module-name")`. All events logged to terminal.
Format: `[ISO-timestamp] [LEVEL] [module] message {data}`

### Integrations
- **WhatsApp**: Evolution API v2 — instance per user, webhook for incoming messages, QR code auth.
- **Google Ads**: OAuth 2.0 flow, each client connects their own account, auto token refresh.

## Sub-Documentation
- `app/CLAUDE.md` — Pages and frontend patterns
- `app/api/CLAUDE.md` — API routes, patterns, and endpoint reference
- `components/CLAUDE.md` — Shared UI components and design tokens
- `lib/CLAUDE.md` — Core library documentation
- `lib/automations/CLAUDE.md` — Automation engine architecture
