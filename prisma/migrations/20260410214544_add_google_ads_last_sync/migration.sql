-- AlterTable
ALTER TABLE "GoogleAdsConnection" ADD COLUMN "lastSyncAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'chain',
    "actionConfig" TEXT NOT NULL DEFAULT '{}',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Automation" ("actionConfig", "actionType", "actions", "active", "createdAt", "id", "name", "triggerConfig", "triggerType", "updatedAt", "userId") SELECT "actionConfig", "actionType", "actions", "active", "createdAt", "id", "name", "triggerConfig", "triggerType", "updatedAt", "userId" FROM "Automation";
DROP TABLE "Automation";
ALTER TABLE "new_Automation" RENAME TO "Automation";
CREATE TABLE "new_AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "automationId" TEXT NOT NULL,
    "leadId" TEXT,
    CONSTRAINT "AutomationLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AutomationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AutomationLog" ("automationId", "details", "executedAt", "id", "leadId", "status") SELECT "automationId", "details", "executedAt", "id", "leadId", "status" FROM "AutomationLog";
DROP TABLE "AutomationLog";
ALTER TABLE "new_AutomationLog" RENAME TO "AutomationLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
