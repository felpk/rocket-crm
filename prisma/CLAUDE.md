# Database — prisma/

SQLite database managed by Prisma 7 with better-sqlite3 adapter.

## Schema (schema.prisma)

### Models

#### User
Primary account model. Supports two roles: `admin` and `client`.
- Admin auto-detected by email `rocketmidia09@gmail.com` during registration.
- Has one-to-many: `leads`, `automations`.
- Has one-to-one: `whatsappConnection`, `googleAdsConnection`.
- Password hashed with bcrypt (12 rounds).

#### Lead
Contact/prospect in the sales funnel.
- `stage`: One of 6 fixed values — `lead`, `qualification`, `meeting`, `proposal`, `negotiation`, `closed`.
- `value`: Float, monetary value in BRL.
- `origin`: Free text (e.g., "whatsapp", "manual", "google-ads").
- `lastMessageAt`: Updated when WhatsApp message is received (used by follow-up automations).
- Cascade deletes: deleting a lead removes its messages and automation logs.

#### Automation
User-defined automation rule with trigger + action chain.
- `triggerType`: `new_lead`, `stage_change`, `keyword`, `followup`.
- `triggerConfig`: JSON string with trigger-specific parameters.
- `actions`: JSON array of `{ type, config }` objects (action chain).
- `actionType` / `actionConfig`: Legacy fields, kept for backward compat. Default values, not used.
- `active`: Boolean toggle.

#### AutomationLog
Execution log entry for an automation run.
- `status`: `success`, `error`, or `skipped`.
- `details`: Human-readable description of what happened.
- `leadId`: Optional FK (SetNull on lead delete).

#### WhatsappConnection
One-to-one link between user and Evolution API instance.
- `instanceName`: Format `rocket-{userId}`.
- `status`: `connected` or `disconnected`.
- `userId`: Unique — one connection per user.

#### GoogleAdsConnection
One-to-one link between user and Google Ads account.
- Stores OAuth tokens (`accessToken`, `refreshToken`, `tokenExpiry`).
- `customerId`: Google Ads customer ID (numbers only, no dashes).
- `userId`: Unique — one connection per user.
- Deleted automatically when token refresh fails.

#### Message
WhatsApp message history linked to a lead.
- `fromMe`: Boolean — outgoing (true) vs incoming (false).
- `timestamp`: When the message was sent/received.

## Migrations

| Migration | Description |
|-----------|-------------|
| `init` | Initial schema: User, Lead, WhatsappConnection, Message |
| `add_google_ads` | Added GoogleAdsConnection model |
| `automations_v2` | Added Automation, AutomationLog models; added `actions` column |

## Commands

```bash
npx prisma generate          # Regenerate client after schema changes (outputs to src/generated/prisma/)
npx prisma migrate dev       # Create and apply migration in development
npx prisma migrate deploy    # Apply pending migrations (production)
npx prisma studio            # Visual database browser (port 5555)
npx tsx prisma/seed.ts       # Create admin user (requires ADMIN_PASSWORD env var)
```

## Important Notes

- **Generated client location**: `src/generated/prisma/` (gitignored).
- **Import path**: `import { prisma } from "@/lib/db"` — never import PrismaClient directly.
- **SQLite path**: Set via `DATABASE_URL` env var (e.g., `file:./dev.db` or `file:/app/data/dev.db` in Docker).
- **Docker migrations**: Run automatically on container startup via `start.sh` — see `Dockerfile`.
- **Seed**: Creates admin user with email `rocketmidia09@gmail.com` and password from `ADMIN_PASSWORD` env var.
