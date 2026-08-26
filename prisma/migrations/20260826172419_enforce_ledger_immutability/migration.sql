-- ============================================================================
-- Append-only ledger, no self-verification, no self-dealing.
--
-- Applied as migration 20260826172419_enforce_ledger_immutability, immediately
-- after 20260826172349_init. Ordering matters: every statement below needs its
-- table to already exist.
--
-- Notes:
--   * A trigger is used rather than a Postgres RULE. `CREATE RULE ... DO
--     INSTEAD NOTHING` would make an UPDATE report success while silently
--     changing nothing, which hides bugs: a code path that wrongly mutates the
--     ledger would look like it worked. Raising is loud and traceable.
--   * The trigger fires for every role including the table owner and superuser,
--     so the application's DB user cannot bypass it.
--   * Prisma's PSL cannot express CHECK constraints, which is why these live in
--     a hand-written migration. Because migrate replays the whole chain into the
--     shadow database, they are not reported as drift.
--   * The no-self-verification CHECK is a BACKSTOP. The same rule is enforced in
--     the service layer (lib/payments/verifier.ts). Keep both.
-- ============================================================================

-- --- TransactionLog is append-only -----------------------------------------

CREATE OR REPLACE FUNCTION transaction_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TransactionLog is append-only (attempted % on row %)',
    TG_OP, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_log_no_change
  BEFORE UPDATE OR DELETE ON "TransactionLog"
  FOR EACH ROW EXECUTE FUNCTION transaction_log_immutable();

-- --- A middleman may never verify their own submission ----------------------

ALTER TABLE "PaymentProof"
  ADD CONSTRAINT "payment_proof_no_self_verification"
  CHECK ("verifiedById" IS NULL OR "verifiedById" <> "submittedById");

-- --- No self-dealing on a deal ---------------------------------------------
-- Alt-account and self-dealing scams are an active problem (the Discord runs a
-- `same-person` channel for exactly this). These block the degenerate cases
-- outright; they do NOT catch one person operating two accounts, which is what
-- the UserWallet.address / lastSeenIpHash / lastSeenDeviceId flags are for.

ALTER TABLE "Deal"
  ADD CONSTRAINT "deal_buyer_is_not_seller"
  CHECK ("buyerId" <> "sellerId");

ALTER TABLE "Deal"
  ADD CONSTRAINT "deal_middleman_is_not_a_party"
  CHECK (
    "middlemanId" IS NULL
    OR ("middlemanId" <> "buyerId" AND "middlemanId" <> "sellerId")
  );

-- --- Listing quantity accounting -------------------------------------------
-- NOT IN THE ORIGINAL REQUEST — added because it guards the invariant that
-- Listing.quantityRemaining exists to create. Drop it if you'd rather keep
-- this file to the constraints you specified.

ALTER TABLE "Listing"
  ADD CONSTRAINT "listing_quantity_remaining_in_range"
  CHECK ("quantityRemaining" >= 0 AND "quantityRemaining" <= "quantity");
