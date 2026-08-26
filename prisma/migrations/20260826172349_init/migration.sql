-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MIDDLEMAN', 'MAIN_MIDDLEMAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ListingSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('ANY', 'MINT', 'TOKEN_TRANSFER', 'WALLET_SUBMIT', 'WALLET_SURRENDER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'IN_DEAL', 'DELISTED', 'FULFILLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FOR_EACH', 'FOR_ALL');

-- CreateEnum
CREATE TYPE "PaymentAsset" AS ENUM ('SOL', 'USDC', 'USDT');

-- CreateEnum
CREATE TYPE "SpotType" AS ENUM ('GTD', 'FCFS');

-- CreateEnum
CREATE TYPE "DealMethod" AS ENUM ('DISCORD_SURRENDER', 'WALLET_SURRENDER', 'WALLET_SUBMIT', 'MINT_FOR_YOU', 'PRESALE', 'CODE', 'OTC');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'CLAIMED', 'TERMS_LOCKED', 'AWAITING_PAYMENT', 'FUNDED', 'DELIVERING', 'AWAITING_MINT', 'AWAITING_CONFIRMATION', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProofKind" AS ENUM ('BUYER_PAYMENT', 'SELLER_COLLATERAL', 'MM_RELEASE', 'MM_REFUND', 'MM_COLLATERAL_RETURN', 'SELLER_NFT_TRANSFER');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionAction" AS ENUM ('DEAL_CREATED', 'DEAL_CLAIMED', 'TERMS_LOCKED', 'PROOF_SUBMITTED', 'PROOF_CONFIRMED', 'PROOF_REJECTED', 'DEAL_FUNDED', 'HANDOVER_DECLARED', 'DELIVERY_MARKED', 'RECEIPT_CONFIRMED', 'FUNDS_RELEASED', 'COLLATERAL_RETURNED', 'COLLATERAL_FORFEITED', 'REFUND_ISSUED', 'MM_FEE_TAKEN', 'MM_FEE_REFUNDED', 'DEAL_CANCELLED', 'DEAL_ESCALATED', 'DISPUTE_RULED', 'ADMIN_OVERRIDE', 'AUDIT_ACCESS');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "workingHoursUtc" TEXT,
    "isVerifiedMm" BOOLEAN NOT NULL DEFAULT false,
    "tradesSecured" INTEGER NOT NULL DEFAULT 0,
    "termsAcceptedAt" TIMESTAMP(3),
    "lastSeenIpHash" TEXT,
    "lastSeenDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "side" "ListingSide" NOT NULL,
    "authorId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "payment" "PaymentAsset" NOT NULL,
    "specific" "SpotType" NOT NULL,
    "type" "ListingType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityRemaining" INTEGER NOT NULL,
    "collateral" BIGINT,
    "projectLink" TEXT,
    "acceptsOffers" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "promotedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "offererId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "asset" "PaymentAsset" NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "listingId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "middlemanId" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "projectName" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "method" "DealMethod",
    "methodConfirmedByBuyerAt" TIMESTAMP(3),
    "methodConfirmedBySellerAt" TIMESTAMP(3),
    "dealAmount" BIGINT NOT NULL,
    "mmFee" BIGINT NOT NULL,
    "mintPrice" BIGINT,
    "collateralAmount" BIGINT,
    "asset" "PaymentAsset" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "specific" "SpotType" NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "mintAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "termsLockedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "sellerDeliveryDeadline" TIMESTAMP(3),
    "buyerConfirmDeadline" TIMESTAMP(3),
    "autoReleaseAt" TIMESTAMP(3),
    "timersPausedAt" TIMESTAMP(3),
    "privateDataHandedOverAt" TIMESTAMP(3),
    "escalatedById" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" "ProofKind" NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT NOT NULL,
    "claimedAmount" BIGINT,
    "claimedAsset" "PaymentAsset",
    "screenshotUrl" TEXT,
    "status" "ProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifierNote" TEXT,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealMessage" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'USER',
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "TransactionAction" NOT NULL,
    "amount" BIGINT,
    "asset" "PaymentAsset",
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus",
    "proofId" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vouch" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "middlemanId" TEXT NOT NULL,
    "rating" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_role_isVerifiedMm_idx" ON "User"("role", "isVerifiedMm");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "UserWallet_address_idx" ON "UserWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_address_key" ON "UserWallet"("userId", "address");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Listing_side_status_idx" ON "Listing"("side", "status");

-- CreateIndex
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_status_promoted_promotedUntil_idx" ON "Listing"("status", "promoted", "promotedUntil");

-- CreateIndex
CREATE INDEX "Listing_chain_idx" ON "Listing"("chain");

-- CreateIndex
CREATE INDEX "Listing_type_idx" ON "Listing"("type");

-- CreateIndex
CREATE INDEX "Listing_authorId_idx" ON "Listing"("authorId");

-- CreateIndex
CREATE INDEX "Offer_listingId_status_idx" ON "Offer"("listingId", "status");

-- CreateIndex
CREATE INDEX "Offer_offererId_idx" ON "Offer"("offererId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_reference_key" ON "Deal"("reference");

-- CreateIndex
CREATE INDEX "Deal_status_createdAt_idx" ON "Deal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Deal_middlemanId_status_idx" ON "Deal"("middlemanId", "status");

-- CreateIndex
CREATE INDEX "Deal_buyerId_idx" ON "Deal"("buyerId");

-- CreateIndex
CREATE INDEX "Deal_sellerId_idx" ON "Deal"("sellerId");

-- CreateIndex
CREATE INDEX "Deal_batchNumber_idx" ON "Deal"("batchNumber");

-- CreateIndex
CREATE INDEX "Deal_status_mintAt_idx" ON "Deal"("status", "mintAt");

-- CreateIndex
CREATE INDEX "Deal_status_autoReleaseAt_idx" ON "Deal"("status", "autoReleaseAt");

-- CreateIndex
CREATE INDEX "Deal_status_sellerDeliveryDeadline_idx" ON "Deal"("status", "sellerDeliveryDeadline");

-- CreateIndex
CREATE INDEX "Deal_status_buyerConfirmDeadline_idx" ON "Deal"("status", "buyerConfirmDeadline");

-- CreateIndex
CREATE INDEX "PaymentProof_dealId_kind_idx" ON "PaymentProof"("dealId", "kind");

-- CreateIndex
CREATE INDEX "PaymentProof_status_submittedAt_idx" ON "PaymentProof"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentProof_submittedById_idx" ON "PaymentProof"("submittedById");

-- CreateIndex
CREATE INDEX "DealMessage_dealId_createdAt_idx" ON "DealMessage"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DealMessage_authorId_idx" ON "DealMessage"("authorId");

-- CreateIndex
CREATE INDEX "TransactionLog_dealId_createdAt_idx" ON "TransactionLog"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_actorId_createdAt_idx" ON "TransactionLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_action_createdAt_idx" ON "TransactionLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_proofId_idx" ON "TransactionLog"("proofId");

-- CreateIndex
CREATE INDEX "Vouch_middlemanId_createdAt_idx" ON "Vouch"("middlemanId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vouch_dealId_authorId_key" ON "Vouch"("dealId", "authorId");

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_offererId_fkey" FOREIGN KEY ("offererId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_middlemanId_fkey" FOREIGN KEY ("middlemanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealMessage" ADD CONSTRAINT "DealMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealMessage" ADD CONSTRAINT "DealMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "PaymentProof"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_middlemanId_fkey" FOREIGN KEY ("middlemanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSetting" ADD CONSTRAINT "AdminSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
