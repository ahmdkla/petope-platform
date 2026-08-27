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

**Replaces the previous version entirely.** The old direction aimed at
"trading terminal, boring like professional tools." That was wrong for this
audience. EXSAVERSE users are web3 traders who live in Discord — the product
should feel like somewhere they want to be, not a spreadsheet.

Target: a marketplace with **character and energy** that still reads as
trustworthy enough to move money through.

**Reference points:** Magic Eden, Blur, Tensor, Discord, Figma, Raycast, Arc.
**Anti-reference:** generic AI-generated SaaS landing pages — and equally,
austere enterprise dashboards. Avoid both extremes.

---

### Readability comes first
The current build fails on this. Fix before anything else.

**Type scale — everything moves up.**
- Body text: **15px minimum**. Never 12px or 13px anywhere.
- Table cells and form inputs: 15px
- Secondary/meta text: 14px floor
- Section headings: 20–24px
- Page titles: 28–36px, and they may be bold
- Numbers in tables: 15–16px, tabular figures

**Contrast — no more grey-on-grey.**
- Primary text on dark: near-white (`zinc-100`), not `zinc-400`
- Secondary text: `zinc-300` minimum, never below `zinc-400`
- Every text/background pair must clear **WCAG AA (4.5:1)**. Check it, don't
  eyeball it.
- Muted text is a rare accent, not the default

**Density — loosen up.**
- Table rows: **48–52px**, not 36px
- Card padding: 20–24px
- Section spacing: 32–48px between blocks
- Form fields: 44px tall minimum

---

### Both themes, user-switchable
Ship **dark and light**, with a toggle in the top bar, persisted per user
(localStorage plus the user record once profiles support it). Dark is the
default — the audience skews that way.

Use CSS variables so a theme swap never means rewriting components. Both
themes must pass the same contrast rules; a light theme with washed-out grey
text is the same failure in reverse.

---

### Colour — use it
The old rule ("nothing is coloured unless it carries meaning") produced
something lifeless. Colour is allowed to make the product feel alive.

**Accent:** amber/gold as the brand anchor (matches EXSAVERSE), used
confidently — primary buttons, active nav, focus rings, key highlights. Not
rationed to a single badge.

**Semantic colours** stay meaningful and consistent:
- Deal states each get their own colour, used everywhere that state appears
- Green for confirmed/completed, red for rejected/disputed, amber for pending
- BUY and SELL listings visually distinguishable at a glance

**Surfaces:** at least three background levels (page → card → raised) so
sections separate without relying on hairline borders. Subtle tints are fine —
a card can carry a faint colour wash tied to its state.

**Still banned:** purple-to-blue gradients, mesh gradient blobs, rainbow
palettes. Flat colour and *subtle* single-hue gradients are fine; the banned
thing is the specific AI-template look, not gradients as a category.

---

### Structure and depth
- **Cards are encouraged.** Group related content into distinct surfaces
  rather than floating everything on one flat plane.
- **Borders and elevation both allowed.** Cards may carry a soft shadow.
  Overlays carry a stronger one.
- **Border radius up to `rounded-lg`** (8px), `rounded-xl` (12px) for large
  cards. Still no pill-shaped containers.
- **Icons throughout** (lucide-react) — nav, buttons, empty states, status
  indicators. They aid scanning.
- **Motion is allowed, sparingly:** hover transitions, state changes, page
  transitions. 150–250ms. No scroll-triggered reveals, no parallax, no
  animation libraries.

---

### Making it feel like a marketplace, not a form
- **Listing cards** should look like things you'd want to buy — clear item
  name, prominent price, chain badge, spot-type badge, seller identity.
  Card grid, not a bare table.
- **Deal states** get colour-coded pills, not plain text.
- **Middleman profiles** get avatars and visible trust signals — vouch count,
  trades secured, verified badge — presented with some weight.
- **Empty states** get an icon and a helpful line, not one grey sentence.
- **Dashboard** shows activity: recent listings, your open deals, recent
  completed sales. Something is always happening.

---

### Still banned (the actual AI tells)
These are what make a site read as AI-generated. Everything above is
permitted; these are not:

- Purple-to-blue gradients, mesh gradient blobs
- Emoji in UI chrome — headings, buttons, nav, labels. (User-written content
  is theirs; icons are fine.)
- Glassmorphism / `backdrop-blur` frosted panels
- Hero sections with giant centered type on **application** pages (a marketing
  landing page for signed-out visitors is a different thing and may have one)
- Feature grids with icon circles, testimonial cards, "Trusted by" strips
- Motivational microcopy — "Let's get started!", "You're all set", exclamation
  marks in system messages
- Indigo/violet as the primary accent (Tailwind default, reads as untouched
  template)
- Text above 36px in the application
- Scroll-triggered animation, parallax, GSAP

---

### Typography
- **UI:** one strong sans — Geist, Inter, or similar
- **Mono:** for amounts, transaction references, deal references, wallet
  addresses, timestamps. Money in a proportional font misaligns in tables.
- Weight carries hierarchy: 400 body, 500–600 emphasis, 700 headings

---

### The test
Would a Discord-native NFT trader find this pleasant to spend time in, and
would they trust it with $200?

Both halves matter. Too austere fails the first. Too flashy fails the second.

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
