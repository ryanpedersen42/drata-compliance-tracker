-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Control" (
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
    "policyId" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Control_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "testTemplateId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checkResultStatus" TEXT,
    "checkStatus" TEXT,
    "source" TEXT,
    "lastCheckedAt" DATETIME,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonitoringTest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControlTest" (
    "controlId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,

    PRIMARY KEY ("controlId", "testId"),
    CONSTRAINT "ControlTest_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MonitoringTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "currentVersion" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drataId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "renewalDate" DATETIME,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControlEvidence" (
    "controlId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    PRIMARY KEY ("controlId", "evidenceId"),
    CONSTRAINT "ControlEvidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TagAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "controlId" TEXT,
    "testId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagAssignment_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagAssignment_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MonitoringTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "controlId" TEXT,
    "testId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasonCode" TEXT,
    "reasonDetail" TEXT,
    "checkRunId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusSnapshot_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusSnapshot_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MonitoringTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusSnapshot_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "CheckRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL'
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tagId" TEXT,
    "workspaceId" TEXT,
    "entityType" TEXT,
    "channelType" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "controlId" TEXT,
    "testId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "externalRef" TEXT,
    "lastNotifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationLog_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "CheckRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "drataApiKey" TEXT,
    "slackBotToken" TEXT,
    "jiraBaseUrl" TEXT,
    "jiraEmail" TEXT,
    "jiraApiToken" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleHour" INTEGER NOT NULL DEFAULT 6,
    "scheduleMinute" INTEGER NOT NULL DEFAULT 0,
    "scheduleTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_drataId_key" ON "Workspace"("drataId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_drataId_key" ON "Control"("drataId");

-- CreateIndex
CREATE INDEX "Control_workspaceId_idx" ON "Control"("workspaceId");

-- CreateIndex
CREATE INDEX "Control_code_idx" ON "Control"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringTest_drataId_key" ON "MonitoringTest"("drataId");

-- CreateIndex
CREATE INDEX "MonitoringTest_workspaceId_idx" ON "MonitoringTest"("workspaceId");

-- CreateIndex
CREATE INDEX "ControlTest_testId_idx" ON "ControlTest"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_drataId_key" ON "Policy"("drataId");

-- CreateIndex
CREATE INDEX "Policy_workspaceId_idx" ON "Policy"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_drataId_key" ON "Evidence"("drataId");

-- CreateIndex
CREATE INDEX "Evidence_workspaceId_idx" ON "Evidence"("workspaceId");

-- CreateIndex
CREATE INDEX "ControlEvidence_evidenceId_idx" ON "ControlEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "TagAssignment_entityType_idx" ON "TagAssignment"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_controlId_key" ON "TagAssignment"("tagId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_testId_key" ON "TagAssignment"("tagId", "testId");

-- CreateIndex
CREATE INDEX "StatusSnapshot_controlId_createdAt_idx" ON "StatusSnapshot"("controlId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusSnapshot_testId_createdAt_idx" ON "StatusSnapshot"("testId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusSnapshot_workspaceId_createdAt_idx" ON "StatusSnapshot"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_ruleId_controlId_key" ON "NotificationLog"("ruleId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_ruleId_testId_key" ON "NotificationLog"("ruleId", "testId");
