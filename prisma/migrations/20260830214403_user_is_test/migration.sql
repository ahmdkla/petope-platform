-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- One-time cleanup of existing test debris.
--
-- The report suites create throwaway accounts and blacklist them, and before
-- this column existed every one of them was published on the public /blacklist
-- page as a named scammer — 13 of the 14 entries were test-created.
--
-- Every suite suffixes a run id after a dot in the local part
-- ("scammer.mtg63q0x@invalid.test", "supplybuyer0.mtg63q0x@exsaverse.demo");
-- no seeded account has a dot there. Going forward the suites set isTest
-- themselves, so this backfill is only for rows that predate the column.
UPDATE "User"
SET "isTest" = true
WHERE "email" LIKE '%@invalid.test'
   OR ("email" LIKE '%@exsaverse.demo' AND split_part("email", '@', 1) LIKE '%.%');
