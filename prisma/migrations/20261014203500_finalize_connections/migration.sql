-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tagId" TEXT,
    "workspaceId" TEXT,
    "entityType" TEXT,
    "connectionId" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationRule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_NotificationRule" ("configJson", "connectionId", "createdAt", "enabled", "entityType", "id", "name", "tagId", "updatedAt", "workspaceId") SELECT "configJson", "connectionId", "createdAt", "enabled", "entityType", "id", "name", "tagId", "updatedAt", "workspaceId" FROM "NotificationRule";
DROP TABLE "NotificationRule";
ALTER TABLE "new_NotificationRule" RENAME TO "NotificationRule";
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "drataApiKey" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleHour" INTEGER NOT NULL DEFAULT 6,
    "scheduleMinute" INTEGER NOT NULL DEFAULT 0,
    "scheduleTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("drataApiKey", "id", "scheduleEnabled", "scheduleHour", "scheduleMinute", "scheduleTimezone", "updatedAt") SELECT "drataApiKey", "id", "scheduleEnabled", "scheduleHour", "scheduleMinute", "scheduleTimezone", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

