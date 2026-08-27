# Decisions

Running log of settled architectural decisions and the outstanding chores they
create. Newest first. If a decision here conflicts with code, the code is wrong
until this file is updated.

---

## Better Auth over Auth.js (NextAuth), email/password

**Date:** 2026-08-27 · **Migrations:** `20260826175659_switch_to_better_auth`,
`20260826180353_account_issuer`

CLAUDE.md requires asking before changing the auth provider. This was asked and
approved.

**The deciding factor:** Auth.js v5's Credentials provider is **JWT-only and
cannot use database sessions**. That means a `BLACKLISTED` user keeps a working
session until their token expires — there is no server-side revocation. On a
platform whose stated top threat is impersonation, and whose admin surface
includes a blacklist, that is a hole rather than a trade-off.

Better Auth also gives email/password as a first-class flow — scrypt hashing,
verification, reset, change-password — where Auth.js would have each of those
hand-rolled. And Next.js 16's `proxy.ts` (which replaced `middleware.ts`) always
runs on the Node runtime, so the session is validated against the database on
every protected request rather than by reading a cookie.

Verified against the live database, reusing one valid session cookie throughout:

| Test | Result |
|---|---|
| Set `status = BLACKLISTED` | `307` to `/sign-in?reason=account-unavailable` on the next request |
| Restore `status = ACTIVE` | access returns |
| `DELETE` the `Session` row | `307` to `/sign-in` |
| 8 failed sign-ins in a minute | `401` ×5 then `429` ×3, with a real `RateLimit` row |

**Consequences recorded:**

- The three NextAuth-shaped tables were replaced. `Account` gained `password`
  (scrypt hash — never log it, never return it, never copy it into a
  `TransactionLog`) and `issuer`; `Session` gained `token`/`expiresAt`;
  `VerificationToken` became `Verification`.
- `User.discordId` and `discordUsername` are now **nullable**. They were
  required when Discord was the only identity. Discord OAuth stays deferred,
  not designed out.
- Rate limiting uses **database** storage, not Better Auth's in-memory default,
  which would keep a separate counter per serverless instance on Vercel and so
  silently fail to limit anything.
- `tsconfig.json` target moved `ES2017` → `ES2020`: money is `BigInt`
  throughout, and BigInt literals require it.

**Known gap:** email delivery is not wired up. `sendVerificationEmail` and
`sendResetPassword` log to the console under `DEMO_MODE`, and
`requireEmailVerification` is off. Password reset is not usable yet.

---

## Session IP/user-agent are stored raw; alt-account signals stay hashed

**Date:** 2026-08-27

CLAUDE.md says to flag shared wallets, IPs and devices, and the `User` columns
hold **hashed** values for that. Better Auth's `Session.ipAddress` /
`Session.userAgent` are **raw** — a deliberate exception, on two grounds:

- they expire with the session, so nothing long-lived is held in the clear
- session management shows a user their own devices, which needs recognisable
  values to be worth anything

The durable fraud signals remain `User.lastSeenIpHash` /
`User.lastSeenDeviceId`, compared by equality only. Do not "fix" the
inconsistency by hashing the session columns — that breaks device recognition
without improving the fraud detection, which does not read them.

---

## ✅ RESOLVED — ledger immutability and self-dealing constraints are applied

**Date:** 2026-08-27 · **Migration:** `20260826172419_enforce_ledger_immutability`

The previously parked SQL is now **in the migration chain and applied** to the
database. It runs immediately after `20260826172349_init`.

What it installs:

| Object | Table | Effect |
|---|---|---|
| `transaction_log_no_change` (trigger) | `TransactionLog` | `UPDATE`/`DELETE` raise `23001` |
| `payment_proof_no_self_verification` | `PaymentProof` | `verifiedById` ≠ `submittedById` |
| `deal_buyer_is_not_seller` | `Deal` | buyer ≠ seller |
| `deal_middleman_is_not_a_party` | `Deal` | MM is neither buyer nor seller |
| `listing_quantity_remaining_in_range` | `Listing` | `0 <= quantityRemaining <= quantity` |

Verified against the live database — every one fires, and a legitimate
`TransactionLog` INSERT still succeeds. Reproduce with
`node scripts/verify-constraints.mjs`.

The migration is the single source for this SQL. The old parked copy at
`prisma/migrations/manual/transaction_log_immutable.sql` has been **deleted** —
it was byte-identical in its executable statements and would only have drifted.
(It originally had to be moved out of `prisma/migrations/` because Prisma was
treating the `manual/` folder as a malformed migration named `manual`.)

**One follow-up:**

- The verification run left **undeletable test rows** in the database
   (`vt_buyer`, `vt_seller`, `vt_mm`, deal `vt_deal`, logs `vt_log`/`vt_log2`).
   That is the constraints working: the ledger rows cannot be deleted, which
   `onDelete: Restrict` then propagates to the deal and its users. Clearing them
   requires `prisma migrate reset`, which drops the whole database.

**Consequence worth designing around:** there is now no way to delete a user,
deal, or ledger row through ordinary SQL. Any future need to purge data (a GDPR
erasure request, for instance) has to be met by redaction-in-place on the
mutable tables plus a documented exception path — not by `DELETE`.

---

## Release timers are stored as absolute deadlines, not durations

**Date:** 2026-08-27

`Deal` carries `sellerDeliveryDeadline`, `buyerConfirmDeadline`, `autoReleaseAt`
and `timersPausedAt` as timestamps, each with a `@@index([status, <deadline>])`.

Two reasons they are stored rather than derived:

- **Scheduled jobs can index-scan for due work** (`status = X AND deadline <=
  now()`) instead of walking every deal and recomputing windows from the method
  config.
- **A running deadline must not move.** The window lengths (24h / 6h / 2h) are
  admin-tunable per method; resolving them at read time would retroactively
  shift deadlines on deals already in flight. They are resolved once, when the
  timer starts.

`timersPausedAt` exists because deals legitimately stall — an open dispute, or a
project delaying its mint by months. Timer jobs **must** skip deals where it is
set.

---

## Alt-account signals are hashed and admin-only

**Date:** 2026-08-27

`User.lastSeenIpHash` and `User.lastSeenDeviceId` store salted digests, never
raw values. Together with a shared `UserWallet.address`, they are the three
signals behind the Discord's manual `same-person` detection.

They are personal data held only for fraud review: never surface them publicly,
never log them, and compare by equality only.

---

## Listings track `quantityRemaining` separately from `quantity`

**Date:** 2026-08-27

A listing's status alone could not express partial fulfilment — a quantity-20
listing that sold 5 spots was neither `ACTIVE` nor `FULFILLED`. And with no
reserved state, two buyers could Quick Buy the same listing concurrently.

Added `ListingStatus.IN_DEAL` and `Listing.quantityRemaining`. Prisma cannot
default one column from another, so **creating code must set
`quantityRemaining = quantity` explicitly**; a CHECK constraint in
the `listing_quantity_remaining_in_range` CHECK (migration
`20260826172419_enforce_ledger_immutability`) keeps it within `0..quantity`.

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
