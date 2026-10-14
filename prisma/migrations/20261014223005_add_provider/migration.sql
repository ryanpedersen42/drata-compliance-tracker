-- AlterTable
ALTER TABLE "MonitoringTest" ADD COLUMN "provider" TEXT;

-- AlterTable
ALTER TABLE "NotificationRule" ADD COLUMN "provider" TEXT;

-- CreateIndex
CREATE INDEX "MonitoringTest_provider_idx" ON "MonitoringTest"("provider");
