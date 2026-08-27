-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'SOLD_OUT';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "spotsReservedAt" TIMESTAMP(3);

-- Rewrite rows that used the now-deprecated states.
-- FULFILLED meant quantityRemaining had reached zero, which is what SOLD_OUT
-- means. IN_DEAL was a lock that no longer exists: those listings are simply
-- active again, since spots now reserve at funding rather than at deal creation.
UPDATE "Listing" SET "status" = 'SOLD_OUT' WHERE "status" = 'FULFILLED';
UPDATE "Listing" SET "status" = 'ACTIVE'   WHERE "status" = 'IN_DEAL';
