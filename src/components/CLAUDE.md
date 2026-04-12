# Components — src/components/

Shared React components used across pages.

## Files

| File | Props | Description |
|------|-------|-------------|
| `Sidebar.tsx` | `userRole: string`, `userName: string` | Main navigation sidebar with responsive design |

## Sidebar

The primary navigation component rendered in the authenticated layout (`(app)/layout.tsx`).

### Behavior
- **Desktop**: Fixed left sidebar (width: 256px / `w-64`). Main content offset with `md:ml-64`.
- **Mobile**: Hidden by default, toggled via hamburger menu button (fixed top-left). Overlay darkens background.
- **Navigation**: Role-based link visibility — admin users see all client links plus "Painel Admin".
- **Logout**: Calls `POST /api/auth/logout`, then redirects to `/login` via `window.location.href`.

### Navigation Links
Client links (always visible):
- Dashboard (`/dashboard`) — LayoutDashboard icon
- Funil de Vendas (`/funnel`) — Target icon
- Automacoes (`/automations`) — Zap icon
- WhatsApp (`/whatsapp`) — MessageSquare icon
- Google Ads (`/google-ads`) — BarChart3 icon
- Configuracoes (`/settings`) — Settings icon

Admin-only links (appended when `userRole === "admin"`):
- Painel Admin (`/admin`) — Users icon

### Styling
- Active link: `bg-accent text-white` (accent = `#3b6fd4`).
- Inactive: `text-white/70` with hover `bg-white/5`.
- User avatar: First letter of name in accent-colored circle.
- Role label: "Administrador" or "Cliente".
- Icons: Lucide React icons.

## Design Tokens (used across all components)
- Background: `#121721` (`bg-background`)
- Cards: `#1a1f2e` (`bg-card`)
- Accent: `#3b6fd4` (`bg-accent`)
- Error: red tones (`bg-error`, `text-error`)
- Text: white with opacity variants (`text-white/70`, `text-white/60`, `text-white/50`)
- Borders: `border-white/10`
- Font: Geist Sans / Geist Mono

## Adding a New Component

1. Create `src/components/MyComponent.tsx`.
2. Use `"use client"` directive if the component uses hooks or event handlers.
3. Import `cn` from `@/lib/utils` for conditional classNames.
4. Follow the dark theme tokens above — never use light theme colors.
5. If the component needs auth data, receive it via props (pages fetch and pass down).
