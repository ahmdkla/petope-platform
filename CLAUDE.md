# Project: EXSAVERSE — WL Marketplace + Middleman Escrow Platform

## Overview
Web platform replacing/extending an existing Discord-based whitelist (WL)
marketplace and middleman escrow service. Buyers and sellers trade NFT
whitelist spots, presale allocations, and NFTs. A **Middleman (MM)** holds
funds and collateral in trust until delivery is verified.

Existing scale: ~21.7k members, ~5.9k customers, ~$2.4M volume,
~15.7k trades secured. **This is a live business — the website must digitize
the workflow that already works, not reinvent it.**

## Read these before building
- `docs/deal-methods.md` — the 7 deal types and their exact money flows.
  **Read this before touching any escrow, payment, or deal-state code.**
- `docs/features.md` — full feature map derived from the Discord server
- `docs/DECISIONS.md` — running log of settled architectural decisions, and the
  database constraints currently applied
- `docs/screenshots/` — screenshots of the live Discord workflow

## Domain Vocabulary (use these exact terms in code and UI)
- **WL** — whitelist spot for an NFT mint
- **MM** — middleman; the escrow party who holds funds
- **MM fee** — the middleman's commission, paid by the buyer on top of deal amount
- **GTD** — guaranteed mint spot
- **FCFS** — first come, first served spot; buyer may fail to mint due to
  over-allocation, and that is **not** the seller's fault (no refund)
- **Collateral** — value the seller locks up as insurance against backing out
  or draining the buyer
- **Deal amount** — the WL price itself, excluding MM fee and mint price
- **Mint price** — what the project charges to mint (separate from deal amount)
- **Ticket / Deal Room** — one private space per transaction
- **Vouch** — public post-deal testimonial for a middleman
- **Transcript** — permanent archived log of a closed ticket
- **Solscan link** — payment proof; buyer/seller submit tx links as evidence

## Payment Facts (do not change without asking)
- **All payment happens off-platform and is verified manually by a middleman.**
  See "Payment Verification Is Manual" below — read it before any payment code.
- Accepted settlement assets: **SOL, USDC, USDT — Solana network**
  (the older FAQ says USDT/USDC only; SOL now appears in the listing form, so
  the FAQ text needs updating on the new platform)
- The **project chain** (Base, Ethereum, Solana, Robinhood…) is a separate
  field from the **payment asset**. A deal for a Base project is still settled
  on Solana. Never conflate these two.
- `price` is denominated in whatever `payment` says — `15` means $15 if
  payment is USDC, or 15 SOL if payment is SOL. Store the asset alongside the
  amount; never store a bare number.
- Collateral minimums are configurable per-server/tier (currently ~$5–$7
  minimum even on Wallet Submit deals). Make this an admin setting, not a
  hardcoded value.

## Core Concept: Deal Rooms
Discord → website mapping:

| Discord | Website |
|---|---|
| Server | The platform |
| Category (TICKETS, PENDING PAYMENT, MM `<NAME>`) | Deal status / MM queue |
| Channel `08-buyer-project` | A single **Deal Room** |
| Prefix `akla-08-...` | Assigned middleman |
| Prefix `done-...` | Archived / completed deal |

A Deal Room contains exactly: Buyer, Seller, assigned Middleman, system bot.
Nobody else can read it. Admin audit access is permitted but always logged.

Current naming is `<mm>-<batch>-<username>-<project>`. On the web, use real
fields (`deal.id`, `deal.batchNumber`, `deal.middlemanId`, `deal.buyerId`,
`deal.projectName`) and generate a display `deal.reference` from them.
**Never parse the reference string for logic.**

## Listing / Deal Terms Schema
These are the exact fields the Discord `/buy` and `/sell` commands take. Both
commands share an identical signature — the only difference is listing side
(`BUY` vs `SELL`). Build **one** form component and one `Listing` model with a
`side` field; do not duplicate.

**Required**

| Field | Values / Notes |
|---|---|
| `item` | Project / item name |
| `chain` | **Project's** network: Ethereum, Solana, Base, Robinhood, etc. Not the payment network. Free-text or a growing enum — new chains appear constantly, so don't hardcode a closed list. |
| `price` | Numeric amount. Denomination follows `payment` (e.g. `15` = $15 USDC, or 15 SOL). |
| `priceType` | `for_each` \| `for_all`. Critical: "3 for $15 for all" ≠ "3 for $15 for each". Always render the resolved total in the UI so this can't be misread. |
| `payment` | Settlement asset: `SOL` \| `USDC` \| `USDT` (Solana network) |
| `specific` | `GTD` \| `FCFS` |
| `type` | Listing-level method — see the taxonomy note below |

**Optional**

| Field | Values / Notes |
|---|---|
| `quantity` | How many wanted (buy) or available (sell). Default 1. |
| `collateral` | Amount the seller pledges for buyer safety. May be `None`. |
| `projectLink` | External URL (usually x.com) |
| `offer` | Whether the poster accepts offers. Sellers use it to negotiate **up**, buyers to negotiate **down**. |
| *(1 more optional)* | **Unidentified — confirm before finalizing the schema.** |

Derived/system fields not in the command: `id`, `side`, `authorId`, `status`,
`promoted`, `promotedUntil`, `createdAt`, `expiresAt`.

### Two taxonomies — do not merge them
The listing `type` dropdown offers 5 values:
`Any` · `Mint` · `Token Transfer` · `Wallet Submit` · `Wallet Surrender`

The FAQ documents 7 **escrow methods** (see `docs/deal-methods.md`):
Discord Surrender, Wallet Surrender, Wallet Submit, Mint For You, Presale,
Code, OTC.

These are different layers:
- **`listing.type`** — a coarse, browsable filter set at posting time
- **`deal.method`** — the precise escrow flow, finalized inside the ticket

`Any` explicitly means "open to negotiation", and Discord Surrender, Presale,
and Code have no listing-level equivalent at all. So model them as **two
separate fields**, with a mapping table for defaults:

| listing.type | likely deal.method |
|---|---|
| `Mint` | Mint For You |
| `Token Transfer` | OTC |
| `Wallet Submit` | Wallet Submit |
| `Wallet Surrender` | Wallet Surrender |
| `Any` | unset — MM and parties choose in the ticket |

`deal.method` must be explicitly confirmed by both parties before
`terms_locked`, regardless of what the listing said. Never auto-derive escrow
behavior from `listing.type` alone.

Additional fields the **deal** carries beyond the listing:
- Mint date/time — drives the verification window and release timers
- Assigned middleman, lifecycle state, payment proofs, confirmed `deal.method`

Terms lock at funding. Post-funding changes need both parties' re-confirmation
and an audit log entry.

**Validation rules to enforce**
- `collateral` must respect the configured minimum for the method/tier
  (currently ~$5–$7 even on Wallet Submit) — see Payment Facts above
- The confirmed `deal.method` determines whether collateral is required at all
- `payment` must be on the allowlist; reject anything outside it
- Display total price prominently, resolved from `price` × `priceType` ×
  `quantity`

## Deal Lifecycle (state machine — keep exactly)
1. `open` — ticket created, terms being negotiated
2. `claimed` — a middleman took the deal and joined the room
3. `terms_locked` — both parties agreed to the terms
4. `awaiting_payment` — buyer must send deal amount + MM fee (+ mint price on
   some methods); seller must send collateral. Mirrors PENDING PAYMENT.
5. `funded` — the assigned MM has **manually confirmed** both `PaymentProof`
   rows (buyer payment and seller collateral) by opening each Solscan link
   and checking it personally. Nothing on-chain is read by the platform.
6. `delivering` — credentials/wallet/NFT being handed over per the deal method
7. `awaiting_mint` — deal is waiting on the project's mint event. **Many deals
   sit here for days or weeks. This is normal and must be supported.**
8. `awaiting_confirmation` — post-mint; release timers running (see method rules)
9. `completed` — funds released, collateral returned, MM fee taken
10. `disputed` — escalated; goes to the MM team review queue
11. `refunded` — buyer refunded; collateral may be forfeited to buyer
12. `cancelled` — closed before funding, or by mutual agreement (see rule below)

**Cancellation rule:** a deal can be cancelled if both parties agree — but
**NOT** once private data (private key, Discord credentials) has been handed
over. After that point, only dispute resolution applies.

Never move funds outside an explicit transition. Never let a client request
set state directly — the server derives it.

## Release Timers (must be enforced by scheduled jobs)
- Buyer non-response after mint: funds auto-release to seller after **24h**
  (Wallet Surrender, Mint For You)
- Wallet Submit with post-mint release: buyer has **2h max** to confirm
- Mint For You: seller must deliver the NFT within **6h** after mint, or the
  deal fails and the buyer receives all funds
Make these values configurable per deal method, not hardcoded in logic.

## Roles
- **Buyer** — funds the deal, confirms receipt
- **Seller** — posts listings, locks collateral, delivers
- **Middleman (MM)** — claims tickets, verifies payments, releases or refunds,
  arbitrates. Each MM has a personal queue, a public profile, published
  working hours (UTC), and a vouch/trade count.
- **Main Middleman / Boss MM** — reviews escalated disputes, final say
- **Admin** — MM management, fee config, blacklist, full audit access
- **System bot** — deal embeds, fee calc, timers, transcripts

Permissions are per-deal, not global. Every deal-scoped query goes through one
shared `assertDealParticipant()` helper — never hand-roll the check.

## Tech Stack (in use)

### Installed and working
- **Framework:** Next.js 16.3.3 (App Router) + TypeScript 5
- **Styling:** Tailwind CSS v4
- **DB:** PostgreSQL (Neon) + **Prisma 7.10**
  - Prisma 7 removed `url` from the schema's `datasource` block. The connection
    string lives in **`prisma.config.ts`**, which loads `.env` via
    `dotenv/config`. `prisma/schema.prisma` declares only the provider.
  - Prisma 7 requires a **driver adapter** to construct `PrismaClient` — bare
    `new PrismaClient()` will not connect. Add `@prisma/adapter-pg` before
    writing the first query.
  - Two migrations are applied: `20260826172349_init` and
    `20260826172419_enforce_ledger_immutability`.
- **Validation:** Zod 4.4 — server-side, every route
- **Env loading:** `dotenv`
- **Payments:** none, and none planned. No SDK, no RPC, no wallet library.
  Payment proofs are text references confirmed by a human middleman — see the
  manual verification section below.
- **Hosting:** Vercel + Neon Postgres
- *(dev only)* `pg`, used by `scripts/verify-constraints.mjs` to prove the
  database constraints fire

### Auth — Better Auth, email/password
**Installed and wired up.** `better-auth` 1.7, email/password only.

Chosen over Auth.js (NextAuth) for one reason above all: **Auth.js's Credentials
provider is JWT-only and cannot do database sessions**, so a `BLACKLISTED` user
would keep a working session until their token expired. Sessions here live in
the database and are revoked on the next request. Full reasoning in
`docs/DECISIONS.md`.

- `lib/auth.ts` — server config. `lib/auth-client.ts` — React client.
- `app/api/auth/[...all]/route.ts` — the handler mount.
- `proxy.ts` — Next 16 replaces `middleware.ts` with `proxy.ts`, which always
  runs on the Node runtime. It validates the session **against the database**
  and rejects `BLACKLISTED` / `SUSPENDED` accounts. Never downgrade this to
  Better Auth's `getSessionCookie()`, which its own docs mark as not secure.
- Rate limiting is on, stored in the database (`RateLimit`): 5 sign-ins/min,
  3 sign-ups/hour. The in-memory default would silently not apply on Vercel.
- Password hashes are scrypt and live on **`Account.password`**, never on `User`.

**Discord OAuth is deferred, not abandoned** — this is a university project
with no real users, so the OAuth app registration is not worth the friction
yet. Add `socialProviders.discord` and the existing `User.discordId` /
`discordUsername` columns (now nullable) fill in.

**No wallet sign-in**, under any auth scheme.

⚠️ **Email delivery is not wired up.** `sendVerificationEmail` and
`sendResetPassword` log to the console under `DEMO_MODE`, and
`requireEmailVerification` is off. Do not present password reset as working.

### Not yet installed — choose when the feature is actually built
- **Realtime:** *(not installed)* Pusher or Ably — deal room chat, listing
  feed, notifications
- **Jobs/timers:** *(not installed)* Inngest or a queue with durable
  scheduling. The 24h/6h/2h release timers must survive deploys; `Deal` already
  carries the indexed deadline columns these jobs will scan.
- **Uploads:** *(not installed)* UploadThing or Cloudflare R2 — proof
  screenshots
- **Serialization:** *(not installed)* `superjson` — BigInt money fields will
  not survive `JSON.stringify` without it. Needed as soon as a money value
  crosses a server/client boundary.
- **UI components:** *(not installed)* shadcn/ui — the handful of primitives in
  `components/ui.tsx` are hand-rolled for now
- **Email delivery:** *(not installed)* needed before verification or password
  reset can be turned on

Ask before changing the payment layer, auth provider, or job scheduler.

## CRITICAL: Private Key Handling
Several deal methods currently involve a private key or Discord credentials
being sent between users **in Discord DMs**.

**The platform must NEVER transmit, store, log, or accept a private key or
seed phrase — not in chat, not in a form, not in an upload, not encrypted.**

If key exchange must happen, it stays off-platform (as it does today in DMs).
On-platform, only record that a handover was *declared* to have happened, with
timestamps and both parties' acknowledgement. Any code that would accept a key
into the system is a bug — flag it, don't build it.

If asked to build an in-platform key handover feature, stop and raise this
first. There are safer alternatives worth discussing (delegated mint
authority, burner-wallet flows, on-chain allowlist transfer) depending on
the project.

## DECIDED: Payment Verification Is Manual — No Wallet Integration

**This is settled. Do not propose wallet connection, RPC verification, or a
payment SDK unless explicitly asked.**

The platform **never connects a wallet, never holds keys, never touches an
on-chain API, and never moves money itself.** It records what humans do
off-platform — exactly as the Discord workflow does today.

### How payment works
1. Buyer sends funds to the middleman's wallet **outside the platform**
   (their own wallet app, as they do today)
2. Buyer pastes the **Solscan link** (or tx signature) into the deal room as a
   `PaymentProof`
3. Seller does the same for collateral
4. The **middleman opens the link, verifies it themselves, and clicks
   Confirm** — a human decision, recorded with their user id and timestamp
5. That confirmation is what advances the deal state and writes to
   `TransactionLog`

The same applies in reverse for release and refund: the MM sends funds
off-platform, pastes the proof, and marks it done.

### Why this is correct, not a shortcut
This mirrors current operations exactly. There is no automated payment
verification in the live Discord service today — a middleman reads a Solscan
link and decides. Automated verification would be an *addition* to the
business process, not a port of it. The platform's job is the escrow state
machine, timers, collateral rules, disputes, and audit trail — not payment
rails.

### Hard rules
- No wallet connect (no Phantom, no wagmi, no `@solana/web3.js`, no WalletConnect)
- No RPC provider, no on-chain lookups, no signature verification
- Never store a private key or seed phrase — unchanged from the rule above
- Wallet addresses are stored only as **plain text reference strings** that
  humans read; the platform never derives meaning from them
- A `PaymentProof` is **unverified data** until a middleman confirms it. Never
  auto-advance state from a submitted proof.
- The MM who confirms must be recorded on the proof and in the ledger. No
  anonymous confirmations.

### Keep it swappable
Put verification behind one interface so a future automated verifier is a
swap, not a rewrite:

```ts
interface PaymentVerifier {
  submitProof(dealId: string, reference: string, kind: ProofKind): Promise<PaymentProof>;
  verify(proofId: string, verifierId: string, decision: 'confirm' | 'reject', note?: string): Promise<void>;
}

// v1 — the only implementation that exists
class ManualVerifier implements PaymentVerifier {}
```

No escrow code may call a verifier implementation directly — only this
interface.

### Demo / academic context
This build is a **university project**. There are no real users and no real
funds. Add a `DEMO_MODE` env flag that, when on, shows a persistent banner
stating no real payments are processed, and relaxes proof-format validation so
test data can be entered freely. Never let demo mode silently auto-confirm
payments — the manual MM confirmation step is the thing being demonstrated.

## Conventions
- Money as integers in smallest unit — never floats
- Every fund movement writes an immutable `transaction_log` row: actor, deal
  id, action, amount, before/after state, timestamp, tx signature
- That ledger is **enforced append-only by a database trigger**
  (`transaction_log_no_change` on `TransactionLog`): `UPDATE` and `DELETE`
  raise SQLSTATE `23001` rather than silently no-opping. Do not try to correct
  a ledger row — write a compensating row instead. Applied constraints and the
  reasoning behind them are logged in `docs/DECISIONS.md`.
- All input validated with Zod, server-side, every route
- API routes in `app/api/`, one folder per resource
- Deal-room components under `components/deal-room/`
- Deal-method rules live in one place as data/config, not scattered `if` chains

## Security Non-Negotiables
- Never log private keys, seed phrases, or session tokens
- Never log, return from an API, or copy into a `TransactionLog` the
  **`Account.password`** column — it holds the scrypt password hash
- Fund release and refund require an explicit confirmation step — no
  single-click irreversible money movement
- Rate-limit auth, ticket creation, and every fund endpoint
- **Impersonation is the top threat** (the Discord runs a standing "verify
  server ID" warning and members carry "beware of impersonator" notes). Build:
  verified MM badges, a canonical public MM roster page, unique per-deal
  verification links, and a visible warning that MMs never DM first.
- Append-only transcript for every deal room, exportable
- Alt-account / same-person detection: flag shared wallets, IPs, devices

## Commands
```bash
npm run dev              # local dev server
npm run build            # production build
npm run lint             # lint
npm run test             # tests
npx prisma migrate dev   # apply schema changes
npx prisma studio        # inspect DB
```

## Design Direction

This is a **financial trust product**. People hand over real money and private
credentials on the strength of how credible it looks. It should feel like a
trading terminal or a bank's back office — dense, calm, boring in the way
professional tools are boring. It should not feel like a landing page.

Reference points: Linear, Stripe Dashboard, Vercel, GitHub, Discord itself.
Anti-reference: template SaaS marketing pages.

### Banned outright
Do not use any of these. If a design instinct produces one, it is wrong.

- **Gradients.** No gradient backgrounds, buttons, borders, or text. Especially
  no purple-to-blue, no "mesh gradient" blobs. Flat colour only.
- **Emoji in the UI.** Not in headings, buttons, empty states, nav, or section
  labels. Use icons (lucide-react) or nothing. Emoji in user-written content is
  fine — that is the user's text, not ours.
- **Glassmorphism** — no `backdrop-blur` frosted panels.
- **Decorative shadows.** Shadows indicate elevation on overlays only (modals,
  dropdowns, popovers). Cards do not float.
- **Large border radii.** Max `rounded-md` (6px). No pill-shaped cards.
- **Centered marketing layouts** on application pages. Content is left-aligned
  and starts at the top.
- **Hero sections, feature grids with icon circles, testimonial cards,
  "Trusted by" strips** — none of this belongs in a logged-in application.
- **Motivational or salesy microcopy.** No "Let's get started!", no "You're all
  set 🎉", no exclamation marks. State what happened.
- **Full-width max-w-7xl centered containers** everywhere. Dense tables and
  queues should use the available width.

### What to do instead

**Colour.** Dark theme, since the audience lives in Discord. One neutral ramp
(zinc or neutral) doing 90% of the work, plus a small set of semantic colours
used *only* to carry meaning:
- Deal states get colour because state is the most important thing on screen
- Success/danger for confirm/reject actions
- Nothing else is coloured. A button is not coloured because it is a button.

Avoid indigo/violet as the accent — it is the Tailwind default and reads as
"untouched template". Given the existing brand, a muted amber/gold works and
matches the Discord server's identity.

**Typography.** One sans for UI (Inter, or the Geist that ships with the
scaffold). One mono (Geist Mono, JetBrains Mono) — used for every amount,
transaction reference, deal reference, wallet address, and timestamp. Money in
a proportional font looks amateur and misaligns in tables.

Size range stays narrow: 12/13/14/16px covers the whole app. Hierarchy comes
from weight and colour, not size jumps. No text larger than 24px anywhere.

**Density.** Tighter than default Tailwind. Table rows ~36px, not 56px. A
middleman reviewing a queue wants twenty rows visible, not six. Generous
whitespace is a marketing-site value; this is a work tool.

**Structure.** Persistent left sidebar for navigation (mirrors Discord's
model and is what the users already know). Main content area. Deal rooms get a
three-pane layout: nav / conversation / deal state panel.

**Empty states.** One line of plain text explaining what will appear here.
No illustration, no emoji, no encouragement.

**Numbers.** Right-align in tables. Always show the asset. Always show the
resolved total next to per-unit pricing.

### The test
Before shipping a screen, ask: *would this look out of place inside Stripe's
dashboard?* If it would, it is too decorated.

If a design choice cannot be justified by what it helps the user understand or
do, remove it.

## Working Style

- Ask clarifying questions before architectural changes
- Prefer readable over clever
- If a screenshot or doc conflicts with this file, ask which is authoritative

## Do NOT do without asking
- Change the deal lifecycle states or any deal method's money flow
- **Add wallet connection, a payment SDK, RPC calls, or automated on-chain
  verification** — manual MM verification is a settled decision
- Auto-confirm or auto-verify a payment proof for any reason, including in
  demo mode
- Change accepted payment assets
- Remove or bypass the audit log / transcripts
- Auto-release funds without the method's required confirmation or timer
- Build anything that accepts a private key or seed phrase
