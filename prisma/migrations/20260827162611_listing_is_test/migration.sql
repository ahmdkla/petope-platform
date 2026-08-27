-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Backfill listings the supply suite created before the column existed.
UPDATE "Listing" SET "isTest" = true WHERE "item" LIKE 'Supply %';
