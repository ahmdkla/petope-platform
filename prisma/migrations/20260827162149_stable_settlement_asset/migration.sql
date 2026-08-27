-- AlterEnum
ALTER TYPE "PaymentAsset" ADD VALUE 'STABLE';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Settlement columns move to STABLE: USDC and USDT are interchangeable and the
-- exact coin is not known until payment lands.
UPDATE "Listing" SET "payment" = 'STABLE' WHERE "payment" IN ('USDC', 'USDT');
UPDATE "Offer"   SET "asset"   = 'STABLE' WHERE "asset"   IN ('USDC', 'USDT');
UPDATE "Deal"    SET "asset"   = 'STABLE' WHERE "asset"   IN ('USDC', 'USDT');

-- PaymentProof.claimedAsset and TransactionLog.asset are deliberately NOT
-- migrated. They record what actually moved, and the ledger is append-only:
-- rewriting it to claim a different asset was sent would be falsifying history.

-- Backfill: deals the test suites created before the column existed. Matched on
-- the reference prefixes those suites use. Going forward the suites set it.
UPDATE "Deal" SET "isTest" = true
WHERE "reference" ~ '(LIFECYCLE-TEST|PROOF-TEST|OTC-TEST|CANCEL-TEST|FEE-|WSURR|OTCREL|SILENT|LATE|UI-|Supply )'
   OR "projectName" ~ '^(Fee |Proof |Lifecycle |Cancel |Supply |UI |OTC Test)';
