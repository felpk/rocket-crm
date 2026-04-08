@AGENTS.md

# Rocket Mídia CRM

## Stack
- **Framework**: Next.js 16 (App Router) — TypeScript
- **DB**: SQLite via Prisma 7 (better-sqlite3 adapter)
- **Auth**: JWT custom com cookies httpOnly (`src/lib/auth.ts`)
- **UI**: Tailwind CSS, tema dark fixo (#0A1628, #1E3A5F, #4A90D9)
- **WhatsApp**: Evolution API v2 (`src/lib/evolution.ts`)
- **Google Ads**: OAuth 2.0 + REST API v19 (`src/lib/google-ads.ts`)

## Comandos
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — build de produção (rodar antes de PR)
- `npx prisma migrate dev --name <nome>` — criar migration
- `npx prisma generate` — regenerar client após alterar schema
- `npx prisma studio` — UI visual do banco

## Estrutura
```
src/
  app/
    (auth)/login, register        — páginas públicas
    (app)/dashboard, funnel,      — páginas autenticadas
          whatsapp, google-ads,
          automations, admin,
          settings
    api/auth/                     — login, register, logout, me
    api/leads/, api/leads/[id]/   — CRUD de leads
    api/whatsapp/                 — status, send, qrcode
    api/google-ads/               — auth, callback, status, disconnect, campaigns, summary
    api/admin/                    — clients, stats
  components/                    — Sidebar, etc.
  lib/                           — db, auth, evolution, google-ads, utils
  generated/prisma/              — client Prisma gerado (gitignored)
```

## Regras de Negócio
- Admin = conta `rocketmidia09@gmail.com` (auto-detectado no cadastro)
- Multi-tenant: cliente vê só seus dados, admin vê tudo
- Funil: 6 etapas fixas (Lead → Qualificação → Reunião → Proposta → Negociação → Fechado)
- Google Ads: cada cliente conecta via OAuth, métricas puxadas da API v19

## Fases
- **Fase 1 (MVP)** — Auth, Dashboard, Funil Kanban, Leads, Admin
- **Fase 2** — Automações, Chat WhatsApp integrado
- **Fase 3** — Google Ads (conectado), Meta Ads, Relatórios avançados

## Git Workflow

### Branches
- `main` — produção, sempre estável. **Nunca commitar direto.**
- `develop` — branch de integração. Features mergeiam aqui.
- `feature/<nome>` — novas funcionalidades (ex: `feature/meta-ads`)
- `fix/<nome>` — correções de bugs (ex: `fix/login-redirect`)
- `hotfix/<nome>` — correções urgentes em produção

### Fluxo
1. Criar branch a partir de `develop`: `git checkout -b feature/xyz develop`
2. Desenvolver e commitar com mensagens descritivas em pt-BR
3. Rodar `npm run build` antes de abrir PR
4. Abrir PR para `develop` com descrição do que foi feito
5. Após validação, merge para `develop`
6. Release: merge `develop` → `main` com tag de versão

### Commits
- Formato: `tipo: descrição curta em pt-BR`
- Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`
- Exemplos:
  - `feat: adicionar dashboard Google Ads`
  - `fix: corrigir refresh de token OAuth`
  - `chore: atualizar dependências`

## Checklist antes de PR
- [ ] `npm run build` sem erros
- [ ] Testar fluxo manualmente no browser
- [ ] Não commitar `.env`, `dev.db` ou `src/generated/`
- [ ] Mensagem de commit segue o padrão
