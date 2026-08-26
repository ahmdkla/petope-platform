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
5. `funded` — MM has verified both payments on-chain
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

## Suggested Tech Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind + shadcn/ui
- **DB:** PostgreSQL + Prisma
- **Auth:** NextAuth with **Discord OAuth primary** (existing user base already
  has Discord accounts — lowest-friction migration), wallet sign-in secondary
- **Realtime:** Pusher or Ably (deal room chat, listing feed, notifications)
- **Payments:** Solana USDT/USDC. Use `@solana/web3.js` + Helius/QuickNode RPC
  to verify incoming transfers by signature. Verify on-chain — never trust a
  pasted link alone.
- **Jobs/timers:** Inngest or a queue with durable scheduling (24h/6h/2h
  release timers must survive deploys)
- **Uploads:** UploadThing or Cloudflare R2 (proof screenshots)
- **Hosting:** Vercel + managed Postgres (Neon/Supabase/Railway)

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

## Escrow Custody Model — decide explicitly
1. **Custodial** (current model) — platform/MM wallet holds funds, MM releases
   manually. Matches today's process; simplest to build; but the platform
   holds user funds, which carries real legal and regulatory weight.
2. **Smart contract escrow** — funds locked on-chain, released by MM signature
   or multisig. More trustless, more work, needs an audit.

Do not pick silently. If unspecified, assume custodial and say so.

## Conventions
- Money as integers in smallest unit — never floats
- Every fund movement writes an immutable `transaction_log` row: actor, deal
  id, action, amount, before/after state, timestamp, tx signature
- All input validated with Zod, server-side, every route
- API routes in `app/api/`, one folder per resource
- Deal-room components under `components/deal-room/`
- Deal-method rules live in one place as data/config, not scattered `if` chains

## Security Non-Negotiables
- Never log private keys, seed phrases, or session tokens
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

## Working Style
- Ask clarifying questions before architectural changes
- Prefer readable over clever
- If a screenshot or doc conflicts with this file, ask which is authoritative

## Do NOT do without asking
- Change the deal lifecycle states or any deal method's money flow
- Change the custody model (custodial vs on-chain)
- Change accepted payment networks
- Remove or bypass the audit log / transcripts
- Auto-release funds without the method's required confirmation or timer
- Build anything that accepts a private key or seed phrase
