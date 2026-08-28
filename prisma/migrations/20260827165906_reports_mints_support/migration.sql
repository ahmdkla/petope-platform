-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('SCAM', 'DM_IMPERSONATION', 'ALT_ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UPHELD', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('GENERAL_HELP', 'ACCOUNT_ISSUE', 'ADS_PREMIUM', 'REPORT_PROBLEM');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "mintEventId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blacklistReason" TEXT,
ADD COLUMN     "blacklistedAt" TIMESTAMP(3),
ADD COLUMN     "blacklistedById" TEXT;

-- CreateTable
CREATE TABLE "ScammerReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "accusedUserId" TEXT,
    "accusedHandle" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "evidence" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "dealId" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScammerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MintEvent" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "mintAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "projectLink" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'USER',
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScammerReport_status_createdAt_idx" ON "ScammerReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScammerReport_accusedUserId_idx" ON "ScammerReport"("accusedUserId");

-- CreateIndex
CREATE INDEX "ScammerReport_reporterId_idx" ON "ScammerReport"("reporterId");

-- CreateIndex
CREATE INDEX "MintEvent_mintAt_idx" ON "MintEvent"("mintAt");

-- CreateIndex
CREATE INDEX "MintEvent_chain_idx" ON "MintEvent"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket"("reference");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_openedById_idx" ON "SupportTicket"("openedById");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_authorId_idx" ON "SupportMessage"("authorId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_mintEventId_fkey" FOREIGN KEY ("mintEventId") REFERENCES "MintEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScammerReport" ADD CONSTRAINT "ScammerReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScammerReport" ADD CONSTRAINT "ScammerReport_accusedUserId_fkey" FOREIGN KEY ("accusedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScammerReport" ADD CONSTRAINT "ScammerReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScammerReport" ADD CONSTRAINT "ScammerReport_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MintEvent" ADD CONSTRAINT "MintEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
