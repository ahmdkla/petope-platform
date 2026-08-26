-- ============================================================================
-- Append-only ledger + no-self-verification, enforced at the database.
--
-- ⚠️  NOT YET IN THE MIGRATION CHAIN. Nothing in this file is applied.
--     Until it is folded into a real migration, the TransactionLog is freely
--     editable and a middleman can confirm their own payment proof at the
--     database level. See docs/DECISIONS.md.
--
-- To apply, after `prisma migrate dev --name init` has generated the initial
-- migration, move this file into a migration folder timestamped AFTER it:
--     prisma/migrations/<later-timestamp>_transaction_log_immutable/migration.sql
-- Ordering matters — both statements below need their tables to already exist.
--
-- Notes:
--   * A trigger is used rather than a Postgres RULE. `CREATE RULE ... DO
--     INSTEAD NOTHING` would make an UPDATE report success while silently
--     changing nothing, which hides bugs: a code path that wrongly mutates the
--     ledger would look like it worked. Raising is loud and traceable.
--   * The trigger fires for every role including the table owner and superuser,
--     so the application's DB user cannot bypass it.
--   * Prisma's PSL cannot express CHECK constraints, so the no-self-verification
--     rule lives here. Because migrations are replayed into the shadow database,
--     `migrate dev` will not report it as drift once this file is in the chain.
--   * The CHECK is a BACKSTOP. The same rule is enforced in the service layer
--     (lib/payments/verifier.ts), which is what actually protects the flow
--     while this file sits unapplied.
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
