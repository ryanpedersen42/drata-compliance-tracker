-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "credentialsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "channelType" TEXT,
    "connectionId" TEXT,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationRule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_NotificationRule" ("channelType", "configJson", "createdAt", "enabled", "entityType", "id", "name", "tagId", "updatedAt", "workspaceId") SELECT "channelType", "configJson", "createdAt", "enabled", "entityType", "id", "name", "tagId", "updatedAt", "workspaceId" FROM "NotificationRule";
DROP TABLE "NotificationRule";
ALTER TABLE "new_NotificationRule" RENAME TO "NotificationRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Connection_name_key" ON "Connection"("name");
