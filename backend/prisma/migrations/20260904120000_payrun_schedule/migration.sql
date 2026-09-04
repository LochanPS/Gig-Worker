-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'REVIEWED', 'CONFIRMED', 'COMPLETED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "payRunId" TEXT,
ADD COLUMN     "scheduleId" TEXT;

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "srcCurrency" TEXT NOT NULL,
    "dstCurrency" TEXT NOT NULL,
    "srcAmountMinor" INTEGER NOT NULL,
    "purposeCode" TEXT NOT NULL,
    "cadence" "Cadence" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_payRunId_idx" ON "Payment"("payRunId");

-- CreateIndex
CREATE INDEX "Payment_scheduleId_idx" ON "Payment"("scheduleId");

-- CreateIndex
CREATE INDEX "PayRun_companyId_idx" ON "PayRun"("companyId");

-- CreateIndex
CREATE INDEX "PayoutSchedule_companyId_idx" ON "PayoutSchedule"("companyId");

-- CreateIndex
CREATE INDEX "PayoutSchedule_active_nextRunAt_idx" ON "PayoutSchedule"("active", "nextRunAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PayoutSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutSchedule" ADD CONSTRAINT "PayoutSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutSchedule" ADD CONSTRAINT "PayoutSchedule_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
