# Decisions

Running log of settled architectural decisions and the outstanding chores they
create. Newest first. If a decision here conflicts with code, the code is wrong
until this file is updated.

---

## ⚠️ OPEN CHORE — fold `prisma/migrations/manual/` into the first real migration

**Status:** outstanding. Blocks nothing today; silently weakens the system if
forgotten.

`prisma/migrations/manual/transaction_log_immutable.sql` is **not in the
migration chain and has never been applied.** It contains the two rules that
make the audit trail trustworthy:

- the trigger that makes `TransactionLog` append-only
- the CHECK constraint stopping a middleman confirming their own payment proof

Until it is applied, **the ledger is freely editable and self-verification is
only blocked in application code.**

It sits outside the chain because it has to run *after* the tables exist, and
no initial migration had been generated when it was written. Prisma applies
migrations in lexicographic folder order, so a hand-picked timestamp could have
sorted before the init migration and failed against a missing table.

**To resolve:**

1. `npx prisma migrate dev --name init`
2. Move the file to
   `prisma/migrations/<timestamp-after-init>_transaction_log_immutable/migration.sql`
3. `npx prisma migrate dev` to apply it
4. Verify it bites — an `UPDATE "TransactionLog" SET action = 'ADMIN_OVERRIDE'`
   must raise `TransactionLog is append-only`, not report success
5. Delete this section

---

## Append-only enforced by a trigger, not a Postgres RULE

**Date:** 2026-08-27

The ledger's immutability was originally specced as
`CREATE RULE ... DO INSTEAD NOTHING`. Rejected: that makes an `UPDATE` report
success while changing nothing. A buggy code path mutating the ledger would
look like it worked, and `deleteMany()` would return `{ count: 0 }` with no
error at all.

A `BEFORE UPDATE OR DELETE` trigger that `RAISE`s an exception fails loudly and
leaves a traceable error. For an academic build, an error you can screenshot is
also better evidence than a silent no-op.

---

## Payment verification is manual — no wallet integration

**Date:** 2026-08-26 · **Authority:** `CLAUDE.md`, "DECIDED: Payment
Verification Is Manual"

The platform never connects a wallet, never calls an RPC, never holds keys, and
never moves money. Buyers and sellers pay off-platform, paste a Solscan link as
a `PaymentProof`, and a middleman opens the link, verifies it personally, and
clicks Confirm. That human decision is what advances deal state.

This is a **port of the live Discord workflow, not a downgrade of it** — there
is no automated verification in the business today, so building one would be a
change to operations rather than a digitization of them.

Consequences carried into the schema:

- No wallet/RPC/SDK dependency anywhere in the project
- `UserWallet.address` and `PaymentProof.reference` are opaque human-read
  strings; the server never parses, resolves, or fetches them
- A `SUBMITTED` proof is unverified data and advances nothing — never
  auto-confirm, including in `DEMO_MODE`
- Verification sits behind the `PaymentVerifier` interface so a future
  automated verifier is a swap, not a rewrite

---

## `Vouch.rating` is a new product decision

**Date:** 2026-08-27 · **Status:** needs product-owner confirmation

The Discord's `mm-vouches` channel is **freeform text with no rating scale**. A
numeric rating is an addition to the business process, not something being
ported.

Modelled as `Int?` (optional) so vouches migrated from Discord stay valid.
Confirm before making it required or showing an aggregate score on MM profiles
— an average computed from partially-rated vouches would misrepresent MMs.

---

## Prisma 7: connection URL moved to `prisma.config.ts`

**Date:** 2026-08-27

Prisma 7 removed `url` from the schema's `datasource` block. The connection
string now lives in `prisma.config.ts` (with `dotenv/config` loading `.env`).
Not a choice — a requirement of the installed version. `prisma/schema.prisma`
declares only `provider = "postgresql"`.

---

## Users are never hard deleted

**Date:** 2026-08-27

Every deal-related relation carries `onDelete: Restrict`, including the
optional ones. Prisma defaults optional relations to `SetNull`, which would
silently null `Deal.middlemanId` or `Deal.escalatedById` when a user row went
away — quietly corrupting the audit trail rather than refusing the delete.

The consequence is intended: nothing carrying deal history can be hard deleted.
Removing a user is a `UserStatus` change (`SUSPENDED` / `BLACKLISTED`), which
is why that enum exists.

The three NextAuth models (`Account`, `Session`, `VerificationToken`) keep
`onDelete: Cascade` — transient auth state, not audit data.
