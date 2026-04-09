@AGENTS.md

# Rocket Marketing CRM

## Stack
- **Framework**: Next.js 16 (App Router) — TypeScript
- **DB**: SQLite via Prisma 7 (better-sqlite3 adapter)
- **Auth**: JWT custom com cookies httpOnly (`src/lib/auth.ts`)
- **UI**: Tailwind CSS, tema dark fixo (#121721 fundo, #1a1f2e cards, #3b6fd4 accent)
- **WhatsApp**: Evolution API v2 (`src/lib/evolution.ts`)
- **Google Ads**: OAuth 2.0 + REST API v19 (`src/lib/google-ads.ts`)
- **Logging**: Logger centralizado (`src/lib/logger.ts`) — todos os eventos logados no terminal

## Comandos
```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # build de produção (rodar antes de PR)
npm run test:api     # testes E2E (requer dev server rodando)
npm run db:seed      # criar admin (definir ADMIN_PASSWORD no .env)
npm run db:migrate   # aplicar migrations do Prisma
npm run db:studio    # UI visual do banco
npx prisma generate  # regenerar client após alterar schema
```

## Setup em novo computador
```bash
git clone https://github.com/felpk/rocket-crm.git
cd rocket-crm
npm install
cp .env.example .env           # editar com suas credenciais
npx prisma generate
npx prisma migrate dev
ADMIN_PASSWORD=suaSenha npx tsx prisma/seed.ts
npm run dev
```

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
  lib/                           — db, auth, evolution, google-ads, logger, utils
  generated/prisma/              — client Prisma gerado (gitignored)
scripts/
  test-api.ts                    — testes E2E de todas as APIs
```

## Logging
Todos os eventos são logados no terminal com formato:
```
[2026-04-08T14:51:20.379Z] [INFO] [auth/login] Login bem-sucedido {"userId":"abc","role":"admin"}
```
- **INFO**: operações normais (login, criar lead, etc.)
- **WARN**: falhas esperadas (credenciais inválidas, lead não encontrado)
- **ERROR**: falhas inesperadas (DB error, API externa falhou)
- **DEBUG**: detalhes internos (queries, payloads) — só em dev

Para criar logger em novo módulo: `const log = createLogger("nome-modulo");`

## Regras de Negócio
- Admin = conta `rocketmidia09@gmail.com` (auto-detectado no cadastro)
- Multi-tenant: cliente vê só seus dados, admin vê tudo
- Funil: 6 etapas fixas (Lead → Qualificação → Reunião → Proposta → Negociação → Fechado)
- Google Ads: cada cliente conecta via OAuth, métricas puxadas da API v19

## Fases
- **Fase 1 (MVP)** — Auth, Dashboard, Funil Kanban, Leads, Admin ✅
- **Fase 2** — Automações, Chat WhatsApp integrado
- **Fase 3** — Google Ads (integrado, falta OAuth credentials), Meta Ads, Relatórios

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

## Mandatory Practices for Claude Code

### Keep CLAUDE.md Files Updated
- Each part of the monorepo has its own `CLAUDE.md` — update them when changing architecture, adding modules, or modifying patterns.
- Locations: `apps/api/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `packages/shared/CLAUDE.md`, `src/CLAUDE.md`

### Frequent Git Commits
- Commit after each meaningful unit of work — never accumulate everything at the end.
- Small, incremental commits that are easy to understand and revert.
- Descriptive commit messages in pt-BR following the convention (`type: description`).
- Keep documentation (CLAUDE.md) up-to-date when there are changes to architecture, features, or structure.

### Tests with Error Tracing
- Always write tests that cover error scenarios — not just the happy path.
- Test: invalid input, auth failures, resource not found, DB errors, external API failures.
- Error messages and assertions must include enough context (module, function, expected vs actual values) to trace the exact origin in the code.
- Use the project's logger (`createLogger`) to ensure errors are logged with module context.
- Tests are written alongside the feature — never deferred to later.

## Checklist antes de PR
- [ ] `npm run build` sem erros
- [ ] `npm run test:api` passa (com dev server rodando)
- [ ] Testar fluxo manualmente no browser
- [ ] Não commitar `.env`, `dev.db` ou `src/generated/`
- [ ] Mensagem de commit segue o padrão
