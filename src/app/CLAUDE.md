# App Router — src/app/

Next.js 16 App Router with route groups for authentication boundary.

## Route Groups

### `(auth)/` — Public Pages
Pages accessible without authentication (login, register).
- Layout: Centered card on dark background, no sidebar.
- Pattern: Client components (`"use client"`) with local form state, direct `fetch()` to auth APIs.

### `(app)/` — Authenticated Pages
Pages requiring a valid JWT session.
- Layout (`layout.tsx`): Server component that calls `getSession()`. Redirects to `/login` if no session. Renders `<Sidebar>` + main content area.
- Main content offset: `md:ml-64` (sidebar width).

## Pages

| Path | Type | Description |
|------|------|-------------|
| `/` | Server | Redirects to `/dashboard` (authenticated) or `/login` (unauthenticated) |
| `/login` | Client | Email/password form, sets JWT cookie, redirects to `/dashboard` |
| `/register` | Client | Registration form, creates account, redirects to `/login` |
| `/dashboard` | Client | KPI cards (total leads, conversions, funnel value, rate) + stage breakdown |
| `/funnel` | Client | Kanban board with drag-drop (@hello-pangea/dnd), lead CRUD modals |
| `/automations` | Client | Automation builder: CRUD, trigger/action config, execution log viewer |
| `/whatsapp` | Client | QR code display, connection status polling, message sending |
| `/google-ads` | Client | Campaign metrics table, account summary (impressions, clicks, CTR, CPC, spend) |
| `/settings` | Client | Google Ads connection toggle, account info |
| `/admin` | Client | Client list, global stats (admin-only, role checked in API) |

## Frontend Patterns

### State Management
- `useState` + `useEffect` — no external state library.
- Data fetched via `fetch()` directly in `useEffect` or event handlers.
- No dedicated API client layer — all calls are inline.

### Polling
- WhatsApp pages poll `/api/whatsapp/status` every 5 seconds for connection state.
- QR code refreshed periodically while status is "connecting".

### Drag-and-Drop (Funnel)
- Uses `@hello-pangea/dnd` (React Beautiful DnD fork).
- On drop: calls `PATCH /api/leads/[id]` with new `stage` value.
- Stages defined in `src/lib/utils.ts` (`STAGES` array).

### Error Handling
- Errors shown in red alert boxes (`bg-error/20 border-error/30`).
- Loading states with disabled buttons showing "...ando" suffix (e.g., "Entrando...", "Salvando...").

### Modals
- Inline modal components within page files (not separate components).
- Overlay pattern: `fixed inset-0 bg-black/50 z-50` + centered card.

## Adding a New Page

1. Create `src/app/(app)/my-page/page.tsx`.
2. Add `"use client"` if using hooks/interactivity.
3. Add a link entry in `src/components/Sidebar.tsx` (`clientLinks` or `adminLinks`).
4. Follow the dark theme tokens: `bg-card` for containers, `bg-accent` for primary buttons.
5. Use `createLogger("my-page")` if the page has server-side logic.
