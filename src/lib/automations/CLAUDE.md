# Automation Engine — src/lib/automations/

Event-driven automation system that executes action chains in response to CRM triggers.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript types, UI labels, and color mappings for triggers and actions |
| `templates.ts` | `renderTemplate()` — replaces `{nome}`, `{empresa}`, `{telefone}`, `{email}`, `{etapa}` placeholders |
| `engine.ts` | Core execution: `runAutomations()` (event-driven) and `runFollowupScan()` (time-driven) |

## Architecture

### Trigger Types
| Type | Fired By | Match Logic |
|------|----------|-------------|
| `new_lead` | `POST /api/leads` (lead creation) | Optional origin filter |
| `stage_change` | `PATCH /api/leads/[id]` (stage update) | `toStage` required, optional `fromStage` |
| `keyword` | `POST /api/whatsapp/webhook` (incoming message) | Message contains any/all keywords (case-insensitive) |
| `followup` | `POST /api/automations/tick` (scheduled scan) | Time-based: delay after creation or last message |

### Action Types
| Type | What It Does | Requirements |
|------|-------------|--------------|
| `send_message` | Sends WhatsApp message to lead's phone | Lead must have phone + WhatsApp connected |
| `move_stage` | Updates lead's funnel stage | Lead must exist in context |
| `create_lead` | Creates lead from phone number (deduplicates) | Phone must be available (from context or sender) |
| `notify` | Sends WhatsApp message to the user (owner) | User must have phone + WhatsApp connected |

### Execution Flow
1. Trigger event fires (e.g., new lead created).
2. `runAutomations(triggerType, userId, context, matchFn)` queries active automations.
3. `matchFn` filters automations by trigger config (optional).
4. For each matching automation, actions execute sequentially.
5. Each action result is logged to `AutomationLog` (success/error/skipped).

### Follow-up Scan
- `runFollowupScan(userId)` is called via `POST /api/automations/tick`.
- Queries leads matching time threshold (`delayHours` since creation or last message).
- Deduplicates: skips leads that already had a successful execution within the threshold window.
- Should be called periodically by an external scheduler (e.g., cron every hour).

### Template Variables
Templates use `{variable}` syntax (case-insensitive):
- `{nome}` — lead name
- `{empresa}` — lead company
- `{telefone}` — lead phone
- `{email}` — lead email
- `{etapa}` — lead stage
- Unknown variables are left as-is.

## Data Model

Automations are stored with JSON fields:
- `triggerConfig` — JSON string of trigger parameters (typed per trigger type).
- `actions` — JSON array of `{ type, config }` objects (action chain).
- Legacy fields `actionType` and `actionConfig` exist for backward compat but are not used.

## Adding a New Trigger Type

1. Add the type to `TriggerType` union in `types.ts`.
2. Create a config type (e.g., `MyTriggerConfig`).
3. Add label/color entries to `TRIGGER_LABELS` and `TRIGGER_COLORS`.
4. Call `runAutomations("my_trigger", userId, context, matchFn)` at the appropriate place.
5. Add the trigger to the UI builder in `src/app/(app)/automations/page.tsx`.

## Adding a New Action Type

1. Add the type to `ActionType` union in `types.ts`.
2. Create a config type (e.g., `MyActionConfig`).
3. Add a `case` in `executeAction()` in `engine.ts`.
4. Add label/color entries to `ACTION_LABELS` and `ACTION_COLORS`.
5. Add the action to the UI builder in `src/app/(app)/automations/page.tsx`.
