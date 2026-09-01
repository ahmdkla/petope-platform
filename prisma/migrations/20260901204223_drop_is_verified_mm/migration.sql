-- Remove the middleman verification flag.
--
-- The roster page is the authoritative anti-impersonation reference, so listing
-- an "unverified" middleman defeated its purpose: anyone on the roster is by
-- definition a real middleman. Membership is now role + status alone, and being
-- listed IS the verification.

-- The old index paired role with the flag; the roster query is now role+status.
DROP INDEX IF EXISTS "User_role_isVerifiedMm_idx";

ALTER TABLE "User" DROP COLUMN "isVerifiedMm";

CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
