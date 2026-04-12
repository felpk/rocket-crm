-- Add lastMessageAt to Lead for followup tracking
ALTER TABLE "Lead" ADD COLUMN "lastMessageAt" DATETIME;

-- Add actions JSON array to Automation (multi-action support)
ALTER TABLE "Automation" ADD COLUMN "actions" TEXT NOT NULL DEFAULT '[]';

-- Update legacy actionType/actionConfig defaults
-- (SQLite doesn't support ALTER COLUMN, but new rows will use schema defaults)

-- Add leadId to AutomationLog for traceability
ALTER TABLE "AutomationLog" ADD COLUMN "leadId" TEXT REFERENCES "Lead"("id") ON DELETE SET NULL;
