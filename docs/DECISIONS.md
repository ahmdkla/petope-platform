# Decisions

Running log of settled architectural decisions and the outstanding chores they
create. Newest first. If a decision here conflicts with code, the code is wrong
until this file is updated.

---

## MM fee: computed server-side, non-refundable by default

**Date:** 2026-08-27

```
base = dealAmount + collateral
fee  = max(floor[asset], base x 5%)
```

Stored in `AdminSetting` under `mmFee.config` — the percentage as **basis
points** so the arithmetic stays integer, and the floor **per settlement
asset**. Per-asset because the platform has no price feed and CLAUDE.md forbids
adding one: a single "$5" minimum cannot be converted for a SOL deal. The SOL
floor is therefore a hand-set approximation that drifts as SOL moves, and an
admin retunes it. That is a real limitation, recorded rather than hidden.

**The fee was previously client-supplied.** `termsSchema` accepted `mmFee` from
the request and wrote it straight through, so a middleman could set any value
including zero. `mmFee` is now absent from the schema entirely and recomputed on
every terms write from values the server already holds. The terms form shows a
read-only preview computed from the same config; nothing it sends is trusted.

**Non-refundable by default.** The `refund` transition previously wrote
`MM_FEE_REFUNDED` unconditionally, so every refund returned the fee. It no
longer writes it at all. The single path that does is
`app/admin/fee-refunds/`, gated on: admin or main middleman, a written reason,
the deal being closed, and within `refundWindowHours` (24) of it closing. The
ledger is the record of whether a fee was already refunded — no separate column
to fall out of step with it.

---

## Spots reserve at funding, not at deal creation

**Date:** 2026-08-27

A listing used to flip to `IN_DEAL` on the first Quick Buy, locking every other
buyer out until that one deal resolved. One buyer who never paid could freeze a
listing indefinitely.

Now up to 7 deals (configurable) compete for one listing, one per user, and
**spots leave supply only at funding**. First to pay wins.

That makes oversubscription an ordinary state rather than a bug, so it is
surfaced rather than prevented: the listing card and deal room show spots
remaining against deals competing, and the buyer is warned before paying when
demand exceeds supply. The backstop is in `mark_funded`'s guard, which re-reads
supply **inside the transaction** and refuses with a message naming the
shortfall. Two middlemen funding competing deals at the same moment is exactly
the case that re-read catches.

`Deal.spotsReservedAt` records whether a deal is holding spots, so the release
path cannot return supply for a deal that never took any. Cancelling an unfunded
deal invents nothing.

`ListingStatus.IN_DEAL` and `FULFILLED` are deprecated but kept: Postgres cannot
drop enum values cleanly, and historical rows must stay readable. The migration
rewrote existing rows to `ACTIVE` and `SOLD_OUT`.

---

## The lifecycle is displayed as five stages, not twelve states

**Date:** 2026-08-27

The database keeps all 12 states — this is presentation only. A buyer does not
need to distinguish `awaiting_mint` from `awaiting_confirmation`; they need to
know which of five things is happening and who is holding it up. Each stage
carries a sentence naming the party being waited on.

`disputed`, `refunded` and `cancelled` **replace** the timeline with a status
panel rather than appearing as a step, because they were never on the path. The
panel shows which stages the deal did reach before it left.

The header status pill keeps the precise state: "Awaiting payment" is not
jargon, and it is the most informative single element on the page.

---

## Funding auto-advances; release never does

**Date:** 2026-08-27

These look like the same kind of step. They are not, and the asymmetry is
deliberate.

**Funding auto-advances.** When the last required `PaymentProof` is confirmed,
the deal moves to `FUNDED` without anyone pressing another button. That is not
an auto-advance *from a submission* — it is the consequence of two explicit
human decisions that already happened. The middleman opened each Solscan link,
checked it personally, and confirmed. Requiring a third click to acknowledge
their own two confirmations would be ceremony, not a control. A `SUBMITTED`
proof still advances nothing: the funding guard reads confirmed proofs only.

**Release never auto-advances.** `release_funds` is always an explicit action by
the middleman, is marked destructive, and is confirmed in a dialog. The reason
is simple: confirming a payment records something that already happened, while
releasing funds causes something to happen. CLAUDE.md's rule — *"Fund release
and refund require an explicit confirmation step, no single-click irreversible
money movement"* — applies to the second, not the first.

### What the 24-hour "auto-release" actually means

CLAUDE.md says funds auto-release to the seller after 24 hours of buyer
silence. That does **not** mean the platform moves money — the platform never
moves money at all. It means the buyer's confirmation stops being *required*.

Concretely, `release_funds` needs either `receiptConfirmedAt` or an elapsed
`autoReleaseAt`. Once the window passes, buyer silence no longer blocks the
release; a middleman still has to send the funds off-platform, record an
`MM_RELEASE` proof, and press the button. Timers change what is permitted, never
what is executed.

`sellerDeliveryDeadline` elapsing is the one timer that changes state on its
own — it escalates to `DISPUTED`, because the method says the deal has failed.
That moves no money either; it routes the deal to a human ruling.

---

## Release deadlines are stored, not derived

**Date:** 2026-08-27

`sellerDeliveryDeadline`, `buyerConfirmDeadline` and `autoReleaseAt` are
resolved from the method config **once**, when the timer starts, and written as
absolute timestamps. Two reasons:

- An admin retuning a method's window must not retroactively move a deadline on
  a deal already running.
- A scheduled job can index-scan for due work rather than walking every deal and
  recomputing.

The seller's delivery window is measured from `mintAt`, not from now — it starts
when the mint happens. The other two run from the moment the deal enters
`AWAITING_CONFIRMATION`.

---

## `MM_RELEASE` is evidence, not a verified proof

**Date:** 2026-08-27

`BUYER_PAYMENT` and `SELLER_COLLATERAL` are verified by a third party: the
middleman checks them. The middleman's own outgoing records — `MM_RELEASE`,
`MM_REFUND`, `MM_COLLATERAL_RETURN` — cannot be, because
`payment_proof_no_self_verification` forbids anyone verifying their own
submission and nobody else is positioned to check them.

They are therefore required to **exist** before release or refund, not to be
confirmed. That is exactly what the Discord workflow produces today: the
middleman pastes the payout transaction as their record. The audit trail keeps
it; no automated check exists to validate it, and inventing one would be a
change to the business process rather than a port of it.

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

---

## The deal room has one chronological record, not two

**Date:** 2026-08-28

The deal room previously carried a stamped step-by-step timeline in the sidebar
*and* system messages in the conversation, describing the same events in two
orderings. The sidebar copy was the less useful of the two — it could show that
funding happened but not what was said around it.

System events are now the record. Every transition, proof submission, middleman
verification, timer run and admin ruling already writes a `SYSTEM` `DealMessage`
at the moment it happens, so the feed is a plain `createdAt` sort of one table
rather than a merge of two sources that could disagree.

The sidebar keeps the five-stage indicator — *where the deal is now*, plus one
sentence naming who is holding it up. That is a status readout, not a history.

`lib/deal-events.ts` picks an icon and tint per system message by matching its
text. **Nothing depends on the result**: an unmatched message still renders with
the neutral bot mark, and no state, money or permission is derived from it. If
the feed ever needs real semantics, `DealMessage` gets an event column — that
file does not get logic.

---

## Mobile: one component per surface, not a mobile variant

**Date:** 2026-08-28

Below `md` the sidebar rides in a drawer, modals become bottom sheets, the
floating chat becomes a full-screen sheet, and the deal list renders as cards.
In every case the *same* component or data set feeds both shapes —
`components/shell/mobile-nav.tsx` renders the one `<Sidebar>`, and
`app/deals/deal-list.tsx` maps its rows once before rendering them twice. A
separate mobile component would be a second definition to keep in step, and the
one that drifts is always the one fewer people look at.

Touch targets are 44px on phones, including `Button size="sm"` — several of
those are confirm/reject on a payment proof.

**Verified:** `scratchpad/overflow.mjs` drives headless Chrome over CDP and
asserts no element's right edge exceeds the viewport, across every page, both a
buyer and a main-middleman session, at 375 / 768 / 1024 / 1280 / 1440 / 1920.
It reports the offending element, not just that the page scrolls. Two real bugs
came out of it that reading the markup had missed.

---

## Card grids follow the container, not the viewport

**Date:** 2026-08-28

The listings grid used `sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`. Tailwind
breakpoints are **viewport** widths, but the grid lives in a column that is 240px
narrower than the viewport because of the sidebar. At 1280px it asked for three
312px tracks while the card's action row — two `h-field` buttons that could not
wrap — needed ~360px. A grid item's automatic minimum size is its min-content, so
the card refused to shrink into its track, overflowed the grid, and took the
whole page into horizontal scroll: cards clipped, "Post a listing" cut off.

Three changes, in order of how general they are:

1. `grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))]` — column count now
   follows the width the grid actually has. `min(100%, …)` keeps the track from
   exceeding a narrow container. 21rem is the width the card needs before its
   fee table starts wrapping mid-row; 19rem was tried and looked broken.
2. The card's action row and footer wrap, so its min-content is a button rather
   than a row of them.
3. `min-w-0` on `Card` and on the dashboard's two grid columns. Below `lg` those
   two share one implicit `auto` track whose minimum is the widest item's
   min-content — one wide row inside either column widened the track past the
   viewport.

**The lesson is (1).** Any grid inside the app shell is container-constrained, so
viewport breakpoints are the wrong tool for it.

---

## The deal table appears at `xl`, not `md`

**Date:** 2026-08-28

Six columns need roughly 1100px. At exactly 768px the sidebar appears (`md`) *and*
the table appeared (`md`), leaving the table 480px and pushing the amount — the
column people are looking for — out of view behind a scrollbar. The card list now
runs to `xl`. The rows are still mapped once and rendered twice, so the two
shapes cannot disagree.

---

## `STABLE` is a settlement class and must never reach the UI

**Date:** 2026-08-28

A listing card read "35 STABLE each" above "35 USDC/USDT": the per-unit line
printed `listing.payment` directly instead of going through `ASSET_LABEL`.
`STABLE` means "USDC or USDT, coin chosen at payment time" — it is not something
anyone can send.

Every place an asset reaches a user now goes through `ASSET_LABEL`, including
validation messages ("Enter an amount in USDC/USDT"), the offer form, and the fee
hints. `SOL` is unaffected because there the enum value *is* the display name,
which is exactly why the bug survived review for so long — it only showed on
stablecoin listings.

`getCollateralMinimum()` also narrows its JSON `asset` string to `PaymentAsset`
instead of casting, so a mistyped admin setting is refused at the read rather
than rendering as an unrecognised label.

---

## The seed never runs on a deploy

**Date:** 2026-08-28

`prisma.config.ts` registers the seed under `migrations.seed`, which is invoked
only by `prisma db seed`, `prisma migrate dev` and `prisma migrate reset`. The
Vercel build runs `prisma migrate deploy`, which is none of those. Verified by
running `migrate deploy` three times against the seeded database and watching
every row count stay identical.

The stake is higher than tidiness: the seed creates fifteen accounts with a
known shared password through `auth.api.signUpEmail`. Running on every deploy
would either fail on the unique email constraint or silently re-create
sign-in-able accounts on a live site.

Seeding is therefore a **manual, first-deploy-only** step, and it is not
idempotent — a second run fails on duplicate emails rather than quietly
producing a second cast. Steps are in `docs/DEPLOY.md`.

---

## `DATABASE_URL` is pooled; migrations may need `DIRECT_URL`

**Date:** 2026-08-28

The running app uses Neon's **pooled** endpoint with `sslmode=verify-full`:
serverless opens a connection per invocation and a direct endpoint runs out.
`verify-full` rather than `require` because `require` encrypts the link but
authenticates nothing, so it does not stop an interception.

Prisma Migrate is the awkward case. It takes a session-scoped advisory lock, and
Neon's pooler is PgBouncer in transaction mode, which can drop one. All ten
migrations do apply through the pooled endpoint on this project, so
`prisma.config.ts` falls back to `DATABASE_URL` and `DIRECT_URL` is optional —
documented as the fix if a deploy ever fails on a lock, rather than a required
second variable nobody understands the reason for.

---

## Client-bundle leaks are checked, not reasoned about

**Date:** 2026-08-28

`scripts/check-client-bundle.mjs` scans the built client chunks for server-only
markers (`PrismaClient`, `next/headers`, Node built-ins) and for the literal
value of every non-`NEXT_PUBLIC_` variable in `.env`. It exits non-zero on a
find, and it was tested against a planted marker so it is known to actually
fail rather than being a check that always passes.

The audit it replaces found no leak: every `@/lib` import from a client
component is either a leaf module or `import type`, which is erased. But that is
exactly the state the project was in when `computeMmFee` sat beside a database
reader and pulled `dns` into a client bundle — `tsc` and `next build` both
passed then too. Reading imports is not a check.

One fragile boundary was removed rather than documented: `SearchHit` moved from
`app/api/search/route.ts` (which imports the database) to `lib/search-types.ts`,
so the command palette's type import no longer points at a server module at all.
Two others remain type-only by necessity — `CurrentUser` from `lib/session` and
`TimerOutcome` from `lib/deal-timers` — and the script is what guards them.
