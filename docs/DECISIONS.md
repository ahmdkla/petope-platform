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

---

## Neon's free tier suspends compute; the first request after idle is slow

**Date:** 2026-08-29

Neon scales a free-tier project's compute to zero after a few minutes without a
connection, and the next query has to wait for it to resume — typically a few
hundred milliseconds, sometimes seconds. **No amount of application work removes
this.** It is the first thing to suspect when someone reports that the demo "was
slow" once and fine afterwards, and it is why the numbers below are all measured
warm.

Anything that genuinely helps is outside the app: keeping a paid instance warm,
a scheduled ping, or accepting it as a property of a demo deployment. What the
app can do is not make it worse — every measurement in this section was taken
after warming, so the figures reflect code rather than cold start.

---

## One session read per request, not four

**Date:** 2026-08-29

The app felt slow because it was doing the same query repeatedly. Rendering one
protected page hit the database for the *same session* up to four times:
`proxy.ts`, then `app/admin/layout.tsx`, then the page, then `AppShell` — none
of which can see that another already asked.

`getCurrentUser` is now wrapped in React's `cache()`, which dedupes for the
lifetime of one request. That collapses the three render-time reads into one;
the proxy runs before rendering in its own context, so its check stays separate
by design.

This is per-request memoisation, **not** a TTL cache. A revoked or blacklisted
session is still rejected on the very next request — the property database
sessions were chosen for in the first place, and the one that must not be traded
for speed.

Measured, warm, production build, medians over five runs:

| Route | Before | After |
|---|---|---|
| `/listings` | 293ms | 206ms |
| `/deals` | 285ms | 221ms |
| `/` | 223ms | 165ms |
| `/mints` | 186ms | 84ms |
| `/vouches` | 149ms | 80ms |

Nothing now exceeds 300ms server-side. The remaining floor of ~80ms is one
session round trip to Neon plus render.

---

## Public pages cache the query, not the route

**Date:** 2026-08-29

The roster, vouch feed, mint schedule and blacklist do not depend on who is
looking, so they should not query per visitor. `export const revalidate` cannot
deliver that here: every page renders `<AppShell>`, `AppShell` reads the session,
and reading the session opts the whole route into dynamic rendering. The
route-level knob has nothing to act on.

`lib/public-data.ts` caches the **queries** instead, with `unstable_cache`, a
60-second window and a tag per dataset. The session stays per-request and
correct while the database work happens once a minute. Writes call
`revalidateTag(..., 'max')` alongside their existing `revalidatePath`, because
the two caches are separate — busting the route without the tag would re-render
fresh markup from stale rows.

The FAQ page is left alone: it has no database work at all, so its ~90ms is the
session read, and caching nothing would save nothing.

---

## SECURITY: a layout `redirect()` does not stop the page rendering

**Date:** 2026-08-29 · **Found while doing performance work**

`app/admin/layout.tsx` gated the admin subtree with `redirect()`. That is not an
authorization boundary. In the App Router a layout and its child render
together, so the response still carries the child's payload.

Measured on the committed code: a plain `USER` requesting `/admin/settings` got
a 307 whose **body contained 14KB of rendered admin RSC payload, including the
fee configuration**. Adding a `loading.tsx` anywhere above the segment made it
strictly worse — a Suspense boundary means streaming starts before the layout
resolves, so the redirect degraded to a **200 with the full 114KB admin page**.
This surfaced only because the perf work added a root `loading.tsx`; the leak
itself predates it.

Role checks now live in `proxy.ts`, which runs before any rendering, alongside
the existing session and blacklist checks. A rejected request is a 1-byte 307
with no privileged content. The layout check stays as defence in depth.

Verified per role: `USER` → 307 on `/admin/*` and `/queue`; `MIDDLEMAN` → 200 on
`/queue`, 307 on `/admin/*`; `ADMIN` → 200 on both; signed out → 307 on all.

**The rule: authorization belongs in `proxy.ts`. A check inside a layout or page
runs too late to stop the data being rendered.**

---

## The favicon is a redraw below 32px

**Date:** 2026-08-29

The supplied mark is a hexagon with an E carved out of it by two diagonal cuts.
Resampled to 16×16 those cuts smear into single grey pixels and the hexagon's
points round off — the result is a dark blob with texture, not a mark. Checked
by rendering it and magnifying, rather than assumed.

So `app/icon.png` (16×16) is drawn on the pixel grid instead: the hexagon
silhouette keeps four rows of taper at each end, and the middle eight rows spend
themselves on the E as two 2px cuts around a 2px arm. Flat fill, no gradient —
at that size a gradient only lowers contrast.

From 32px up the real artwork holds together, so `app/icon1.png` (32×32) and
`app/apple-icon.png` (180×180) are the supplied mark, resampled. Next emits both
icons with correct `sizes`, and the browser picks.

`app/favicon.ico` — the stock Next placeholder — was deleted. It emitted
`<link rel="icon" sizes="any">`, which wins over a sized PNG in some browsers,
so leaving it would have quietly kept the default icon.

**Icons carry their own tan plate.** A transparent favicon is at the mercy of
whatever the browser paints behind it; the plate means the mark is legible on
light and dark chrome alike, and it matches how the artwork was supplied.

---

## Environment variables are read with truthiness, never `??`

**Date:** 2026-08-29 · **After a failed Vercel build**

`app/layout.tsx` had `process.env.BETTER_AUTH_URL ?? "http://localhost:3000"`
feeding `new URL(...)`. `??` only catches null and undefined, so a variable that
exists but is **blank** — a row added in the Vercel dashboard and never filled
in, or this repo's `.env.example` copied verbatim — passed `""` straight through
to `new URL("")`, which throws `ERR_INVALID_URL` at module scope and failed the
entire build.

Blank is the normal shape of this mistake, not an edge case: the dashboard shows
the row as present, so it reads as configured.

Every env read now uses truthiness plus `.trim()`:

- `app/layout.tsx` — `resolveSiteUrl()` tries `BETTER_AUTH_URL`, then Vercel's
  own `VERCEL_PROJECT_PRODUCTION_URL`, and validates each with `new URL` inside
  a `try` so a *malformed* value is also survivable. A typo in a dashboard field
  should not be a failed deploy.
- `prisma.config.ts` — the same defect, in the same build step. A blank
  `DIRECT_URL` would have been handed to Prisma as the datasource and failed
  `migrate deploy`.
- `scripts/check-overflow.mjs` — `CHROME_PATH`.

`lib/db.ts` was already correct: it throws on a falsy `DATABASE_URL` rather than
carrying on.

**The build no longer dies, but it warns.** Falling back silently would trade a
loud failure for a site that serves `localhost` link previews and a sign-in form
that refuses every attempt. `resolveSiteUrl` logs
`[metadata] BETTER_AUTH_URL is not set` into the build output, and DEPLOY.md now
says a successful deploy is not evidence the variable was configured.

Verified against every branch: unset, `""`, whitespace, malformed,
Vercel-provided fallback, and a trailing slash (normalised).

---

## Theme switching sweeps, at 520ms — an exception to the motion budget

**Date:** 2026-08-30

The Design Direction caps motion at 150-250ms. The theme sweep runs **520ms**,
deliberately. That limit exists for interaction feedback — hovers, state
changes, things a person triggers dozens of times a session, where anything
slower reads as lag. Switching theme is none of those: it happens once, maybe
twice, in a sitting, it changes every pixel on screen, and an instant flip is
the jarring option. The rule is about repeated actions, and this is not one.

Anything else that grows past 250ms should be argued separately, not by pointing
at this entry.

### How the sweep is built

`document.startViewTransition` snapshots the old and new themes; the new one is
revealed along a diagonal from the bottom-right corner to the top-left.

**Not clip-path, and not animated gradient stops.** Three techniques were
measured before choosing:

| Technique | Result |
|---|---|
| `mask-image`, keyframing the gradient stop positions | **Discrete.** Interpolates by jumping at the halfway point — the reveal snaps rather than sweeps. |
| `clip-path: polygon(...)` | Interpolates correctly, but gives a hard cut with no edge treatment. |
| `mask-position` on an oversized fixed gradient | Interpolates correctly *and* the gradient's ramp is the soft edge. **Chosen.** |

**The edge cannot be a drop-shadow.** Filters are applied before clipping and
masking, so `filter: drop-shadow()` on the same element is masked away with
everything outside the shape — verified with a side-by-side probe. Putting it on
an ancestor does work in general, but the only ancestors here
(`::view-transition-image-pair`, `::view-transition-group`) also contain the old
snapshot, whose silhouette is the whole viewport. What the mask ramp gives
instead is a band where the new theme is partially composited over the old —
darker than the light side, lighter than the dark side — which reads as a shaded
edge in both directions.

**The keyframes run 20% → 80%, not 0% → 100%.** At `mask-size: 300%` the element
only sees a third of the gradient at a time, so a full slide spends its first and
last quarter with nothing changing: the visible sweep happened in the middle
~270ms and read as a snap. Those bounds are the positions at which the element is
exactly all-transparent and exactly all-opaque.

**The app's own colour transitions are suppressed during the sweep.** Every
surface carries `transition-colors duration-200`, so a theme flip started a few
hundred simultaneous colour transitions underneath the snapshot — invisible work
that also left elements mid-blend when a transition was interrupted.
`html.theme-sweep * { transition: none }` for the duration.

### KNOWN LIMIT: the first click during the sweep is consumed

A root view transition suppresses painting of everything inside `<html>`, and hit
testing follows painting. Mid-sweep, `elementFromPoint` returns `<html>` rather
than the element under the cursor. This is not a `pointer-events` problem —
`pointer-events` is `auto` on the root throughout, and nothing is `inert`. It is
what capturing the root means, and no CSS fixes it.

This bit the theme toggle itself hardest, and shipped broken: pressing it again
while a sweep was running did **nothing at all**, so every second click was
swallowed. The event trace explains it exactly —

| | no sweep running | sweep running |
|---|---|---|
| `pointerdown` | toggle button | `<html>` |
| `pointerup` | toggle button | **toggle button** (skip restored hit testing) |
| `click` | toggle button | `<html>` (common ancestor of the two above) |

The fix follows from the middle row: the toggle is driven by **`pointerup`**, not
`click`. Keyboard activation is kept on `click` and distinguished by
`event.detail === 0`, which is what Enter and Space report when there are no
pointer events behind them.

Every automated test missed this because they all clicked with
`element.click()`, which bypasses hit testing entirely and therefore could never
reproduce it. Real presses have to go through `Input.dispatchMouseEvent`. **A
synthetic click is not evidence that a control is clickable.**

Mitigated more generally: the first `pointerdown`, `keydown` or `wheel` calls
`skipTransition()`, which restores hit testing **within that same event**.
Measured:

- mid-sweep, `elementFromPoint(120, 98)` → `HTML`
- immediately after that `pointerdown` → `SPAN / Overview`, sweep count 0
- the click carrying that pointerdown does **not** activate the link, because the
  browser resolved its target before the listener ran and `click` fires on the
  common ancestor of the down and up targets
- the next click behaves entirely normally

So the app is responsive again within one input event, but that first click is
lost for every control **except the theme toggle**, which handles it via
pointerup as above. Applying the same trick everywhere is not worth it: it would
mean synthesising clicks from pointerup across the app, and a synthetic click is
untrusted — it would silently break anything gated on user activation, the
clipboard copy in `components/deal-reference.tsx` among them.

Removing the limit entirely would mean not using the View Transitions API for
this — a manual two-layer overlay, which is what the API exists to avoid.

### Browser support

Feature-detected on `document.startViewTransition`, never on the user agent. Any
engine without it switches instantly, which is a perfectly good theme toggle;
verified by deleting the method and re-running the toggle.

**Firefox 152 supports View Transitions** (Gecko shipped them in 144), so it gets
the sweep, not the fallback — confirmed by running the real CSS and toggle logic
in Firefox and reading back `path: VIEW TRANSITION`. The sweep's *rendering* in
Gecko is unverified: headless Firefox fails to composite the top-layer
pseudo-elements (`RenderCompositorSWGL failed mapping default framebuffer`), so
only Chrome frames were captured. Worth one look in a real Firefox window.

`prefers-reduced-motion` was originally honoured by never starting a transition.
**That was reversed on 2026-08-30 — see the entry below.**

---

## The theme change is a direct DOM write, not React state

**Date:** 2026-08-30 · **Investigating a "toggle no longer switches" report**

The suspected cause was `setTheme` being batched by React inside
`startViewTransition`, so the DOM would still hold the old theme when the
browser snapshots the new state — the fix for which is
`flushSync(() => setTheme(next))`.

**That is not what this component does.** There is no `useState` for the theme
anywhere in it. `applyTheme()` writes `document.documentElement.dataset.theme`
directly and synchronously; `useSyncExternalStore` only *reads* the attribute
back to pick the button's icon. Nothing is batched, so `flushSync` would be a
no-op.

Verified rather than argued: wrapping `document.startViewTransition` to inspect
the DOM from inside the callback shows the attribute already flipped **and**
`getComputedStyle(document.body).backgroundColor` already the new theme's value
at snapshot time.

```
[probe] callback: theme dark -> light, body bg now rgb(247, 247, 248)
[probe] callback: theme light -> dark, body bg now rgb(10, 10, 15)
```

The report could not be reproduced. Switching works in a real Chrome window
(both motion settings), a real Firefox window driven over WebDriver BiDi, and
headless, with real trusted clicks at 200ms and 1s spacing.

### What did change: the animation can no longer take the theme down with it

The premise behind the report was sound even though the mechanism was not — the
theme change has to be unconditional. It now is:

- `apply()` is idempotent, so it runs exactly once whichever path reaches it
- `startViewTransition` is called inside `try/catch`; if it throws, the class is
  removed and the theme changes anyway
- `updateCallbackDone`/`finished` both route to `apply()`
- a 1s `setTimeout` failsafe covers a transition that never settles at all,
  cleared on the normal path

Proven by breaking the API on purpose, in a real browser:

| Injected failure | Result |
|---|---|
| `startViewTransition` throws | theme still switches |
| callback never invoked, nothing settles | theme still switches (failsafe) |
| `finished` rejects | theme still switches |
| API deleted entirely | instant switch |

### This machine reports `prefers-reduced-motion: reduce`

A real Chrome window here reports `matchMedia("(prefers-reduced-motion: reduce)")`
as **true** — Windows Settings › Accessibility › Visual effects › Animation
effects is off. On this machine the sweep is therefore skipped by design and the
theme switches instantly. That is correct behaviour, and worth knowing before
concluding the animation is broken.

---

## The theme sweep ignores `prefers-reduced-motion`

**Date:** 2026-08-30 · **Owner's decision, against my recommendation**

The sweep originally skipped itself entirely when
`prefers-reduced-motion: reduce` was set, as specified. On the development
machine that meant it never played at all: Windows has animation effects
switched off (`HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate = 0`), so
both Chrome and Firefox report `reduce`, and the theme switched instantly.
Two rounds of "the theme is not working" traced to exactly this.

Four resolutions were put to the owner: change the OS setting, add a site-level
override that defaults to following the OS, degrade to a short cross-fade
instead of nothing, or ignore the preference outright. **The owner chose to
ignore it**, with the accessibility cost stated in the question.

So the sweep now plays for everyone, including people whose operating system has
asked for less motion. `prefers-reduced-motion` is a real accessibility signal —
motion sensitivity, vestibular disorders and migraine are the reasons it exists —
and a 520ms full-viewport wipe is squarely the kind of motion it is meant to
suppress. Recording that here because a future reader will otherwise assume the
omission is a bug and "fix" it.

**Scope.** Only the theme sweep. Reduced-motion handling elsewhere is untouched:
the `motion-reduce:animate-none` on button spinners, and the global rule in
`globals.css` that damps `*`, `::before` and `::after`. That global rule never
reached the sweep anyway — view-transition pseudo-elements match none of those
selectors — which is why removing the sweep's own `@media` block is what
actually changed the behaviour.

**Reverting** is two small edits: restore the `matchMedia` guard in
`components/theme-toggle.tsx`, and the `@media (prefers-reduced-motion: reduce)`
block at the end of `globals.css`. A site-level override with an OS-following
default remains the better answer if this ever ships to real users.

**Verified after the change**, in real browser windows with the machine's own
setting left as it is (`reduce` reported by both engines):

| | result |
|---|---|
| Chrome, real window | sweep runs, sampled `[0,1,1,1,1,1,1,1,1,0,…]`, renders correctly mid-scrub |
| Firefox 152, real window over WebDriver BiDi | sweep runs, sampled `[1,1,1,1,1,1,1,1,1,0,0,0]` |
| both, rapid clicks 200ms apart | every click switches, no stacking, no stuck class |
