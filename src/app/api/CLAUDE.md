# API Routes — src/app/api/

Next.js 16 Route Handlers implementing the REST API.

## Route Map

### Auth (`/api/auth/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Email + password login, sets `auth-token` httpOnly cookie |
| POST | `/auth/register` | Public | Create user account (auto-detects admin by email `rocketmidia09@gmail.com`) |
| POST | `/auth/logout` | Public | Clears auth cookie |
| GET | `/auth/me` | Required | Returns current session user |

### Leads (`/api/leads/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leads` | Required | List leads. Admin: all leads (or filter by `?userId=`). Client: own leads only |
| POST | `/leads` | Required | Create lead. Fires `new_lead` automations (5s timeout) |
| PATCH | `/leads/[id]` | Required | Update lead. Fires `stage_change` automations if stage changed |
| DELETE | `/leads/[id]` | Required | Delete lead. Owner or admin only |

### Automations (`/api/automations/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/automations` | Required | List user's automations with execution log counts |
| POST | `/automations` | Required | Create automation with trigger config + action chain |
| PATCH | `/automations/[id]` | Required | Update automation |
| DELETE | `/automations/[id]` | Required | Delete automation |
| GET | `/automations/[id]/logs` | Required | Fetch execution logs for an automation |
| POST | `/automations/tick` | Required | Run follow-up scan for the current user |

### WhatsApp (`/api/whatsapp/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/whatsapp/status` | Required | Check WhatsApp connection state via Evolution API |
| GET | `/whatsapp/qrcode` | Required | Generate/retrieve QR code (creates instance if needed) |
| POST | `/whatsapp/send` | Required | Send text message, saves to Message table |
| POST | `/whatsapp/webhook` | Public | Evolution API webhook receiver — creates leads, saves messages, fires keyword automations |

### Google Ads (`/api/google-ads/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/google-ads/auth` | Required | Generate OAuth consent URL (state contains JWT) |
| GET | `/google-ads/callback` | Required | OAuth callback — exchanges code for tokens, lists accounts, saves connection |
| GET | `/google-ads/status` | Required | Check if user has active Google Ads connection |
| POST | `/google-ads/disconnect` | Required | Remove Google Ads connection |
| GET | `/google-ads/campaigns` | Required | Fetch campaign metrics (last 30 days, auto-refreshes token) |
| GET | `/google-ads/summary` | Required | Fetch account summary metrics |

### Dashboard (`/api/dashboard/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | Required | Comprehensive dashboard data: KPIs, stages, origins, recent leads, daily trend, automations, integrations, messages. Multi-tenant: clients see own data, admin sees all. All queries run in parallel via Promise.all. |

### Admin (`/api/admin/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/clients` | Admin | List all client accounts |
| GET | `/admin/stats` | Admin | Global statistics (total clients, leads, active automations) |

## API Patterns

### Authentication
```typescript
const session = await requireAuth();  // throws "Unauthorized" → 401
const session = await requireAdmin(); // throws "Forbidden" → 403
```

### Multi-tenant Access Control
- Clients see only resources where `userId === session.id`.
- Admins can query all resources or filter by `?userId=<id>`.
- Ownership check on mutations: verify `resource.userId === session.id || session.role === "admin"`.

### Response Format
- Success: `Response.json(data)` or `Response.json(data, { status: 201 })`.
- Error: `Response.json({ error: "message" }, { status: 4xx/5xx })`.
- Webhook: Always returns `Response.json({ ok: true })` to prevent Evolution API retries.

### Logging
Every route follows this pattern:
```typescript
const log = createLogger("module-name");

export async function GET(req: Request) {
  log.info("GET /api/path");
  try {
    // ... business logic
    log.info("Operation result", { key: value });
    return Response.json(result);
  } catch (err) {
    log.error("Error description", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

### Automation Triggers in API Routes
Automations fire with a 5-second timeout to prevent blocking the response:
```typescript
await Promise.race([
  runAutomations(triggerType, userId, context, matchFn),
  new Promise(resolve => setTimeout(resolve, 5000)),
]).catch(err => log.error("Automacao falhou", { error: String(err) }));
```

### Dynamic Route Params (Next.js 16)
Params are accessed as a Promise — must be awaited:
```typescript
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

## Adding a New API Route

1. Create `src/app/api/<module>/route.ts`.
2. Add `const log = createLogger("<module>")` at the top.
3. Use `requireAuth()` or `requireAdmin()` for protected routes.
4. Log every entry point: `log.info("METHOD /api/path")`.
5. Wrap everything in try/catch, log errors, return structured JSON.
6. If the route should fire automations, call `runAutomations()` with a timeout.
