/*
  Warnings:

  - You are about to drop the column `policyId` on the `Control` table. All the data in the column will be lost.
  - You are about to drop the column `isApproved` on the `Policy` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Policy` table. All the data in the column will be lost.
  - You are about to drop the column `workspaceId` on the `Policy` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "hasPolicy" BOOLEAN NOT NULL DEFAULT false,
    "hasPassingTest" BOOLEAN NOT NULL DEFAULT false,
    "hasEvidence" BOOLEAN NOT NULL DEFAULT false,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "ownersJson" TEXT,
    "frameworkTagsJson" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Control_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Control" ("code", "createdAt", "description", "drataId", "frameworkTagsJson", "hasEvidence", "hasPassingTest", "hasPolicy", "id", "isMonitored", "isReady", "name", "ownersJson", "rawJson", "updatedAt", "workspaceId") SELECT "code", "createdAt", "description", "drataId", "frameworkTagsJson", "hasEvidence", "hasPassingTest", "hasPolicy", "id", "isMonitored", "isReady", "name", "ownersJson", "rawJson", "updatedAt", "workspaceId" FROM "Control";
DROP TABLE "Control";
ALTER TABLE "new_Control" RENAME TO "Control";
CREATE UNIQUE INDEX "Control_drataId_key" ON "Control"("drataId");
CREATE INDEX "Control_workspaceId_idx" ON "Control"("workspaceId");
CREATE INDEX "Control_code_idx" ON "Control"("code");
CREATE TABLE "new_Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "renewalDate" DATETIME,
    "currentVersion" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Policy" ("approvedAt", "createdAt", "currentVersion", "drataId", "id", "name", "publishedAt", "rawJson", "updatedAt") SELECT "approvedAt", "createdAt", "currentVersion", "drataId", "id", "name", "publishedAt", "rawJson", "updatedAt" FROM "Policy";
DROP TABLE "Policy";
ALTER TABLE "new_Policy" RENAME TO "Policy";
CREATE UNIQUE INDEX "Policy_drataId_key" ON "Policy"("drataId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
