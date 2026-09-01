# Feature Map

Every feature below maps to something that already exists in the Discord
server. Screenshots in `docs/screenshots/`.

---

## Public / Marketplace

### Listings Board (`buying-listing`, `selling-listing`, `nft-market`, `prem-listing`)
Two feeds: buyers posting what they **want**, sellers posting what they
**have**.

**Creating a listing.** The Discord `/buy` and `/sell` commands take an
identical field set — see the schema table in `CLAUDE.md`. Build one shared
form component with a `side` toggle (BUY / SELL), not two separate flows.

Required: `item`, `chain`, `price`, `price-type`, `payment`, `specific`, `type`
Optional: `quantity`, `collateral`, `project-link`, `offer`, +1 unidentified

UX notes for the form:
- **Show the resolved total live.** `price-type` (`for_each` vs `for_all`) is
  the single most misreadable field — "3 for $15 for all" vs "3 for $15 for
  each" is a 3× difference. Render "Total: $45" or "Total: $15" as the user
  types.
- `type` should be a select, and choosing it should explain that method's
  flow inline — most disputes trace back to someone not understanding the
  method they agreed to. `Any` should say plainly that the method gets decided
  with the middleman in the ticket.
- `specific = FCFS` should surface a warning that over-allocation is not
  refundable
- `chain` (the project's network) and `payment` (settlement asset) must be
  visually distinct and separately labelled — these get confused constantly
- `chain` should be a combobox with common values (Ethereum, Solana, Base,
  Robinhood…) plus free entry — new chains appear too often for a fixed enum
- Prefill from the user's last listing — sellers post repeatedly

**Actions on a sell listing:** `Offer` · `Quick Buy` · `Delist` (owner) · `View Seller`
**Actions on a buy listing:** `Quick Sell` · `Delist` (owner) · `View Buyer`

The `Offer` button appears only when the poster set `offer` to allow it.
Offers need their own lightweight model (amount, message, status) and should
notify the listing owner.

`Quick Buy` / `Quick Sell` should open a deal ticket pre-filled with the
listing's terms — that's the main funnel into escrow, so it must be one click.

Requirements: filter and sort by chain, spot type, deal method, price range,
project; search by project name; pagination; expiring or stale listings should
auto-archive.

`prem-listing` is a paid/promoted tier — listings need a `promoted` flag with
an expiry, plus an admin surface to grant it.

### Last Sales (`last-sales`)
Public feed of completed deals, marked SOLD, showing price per unit, quantity,
spot type, collateral, and the middleman who secured it. This is social proof —
make it prominent and real-time.

### MM Vouches (`mm-vouches`)
Buyers and sellers leave short public reviews naming a middleman. Needs:
- Vouch tied to a **completed deal** (prevents fake vouches — an improvement
  over the Discord version, where anyone can post)
- Vouch count and rating on every MM profile
- A feed view, and a per-MM view

### Report Scammer (`report-scammer`, `dm-report`)
Users report bad actors. Needs a submission form (accused user, evidence
upload, deal reference), an admin review queue, and a public blacklist page.
`dm-report` specifically covers people who got DM'd by impersonators — keep
that as a distinct report category.

### General Chat (`general`)
Open room where buyers and sellers negotiate before opening a ticket.
Shorthand in use: `B <project>` = buying, `S <project>` = selling.
Needs: realtime chat, mentions, rate limiting, moderation tools.

---

## Deal Rooms (the core)
Private per-transaction rooms. Members: buyer, seller, assigned MM, bot.

Must contain:
- The pinned deal terms card (locked after funding)
- Realtime chat with mentions and unread badges
- A visible **status timeline** showing the current lifecycle state
- **Payment proof submission** — a text field for a Solscan link, plus optional
  screenshot. Renders as a clickable link the MM opens themselves. The server
  never fetches it and never auto-verifies.
- **MM verification panel** — for the assigned MM only: each submitted proof
  with Confirm / Reject buttons and a note field. This is the manual step the
  whole product hinges on; make it fast and unambiguous.
- Countdown timers when a release window is running (2h / 6h / 24h)
- Action buttons gated by role and state (Claim, Confirm Payment, Mark
  Delivered, Confirm Receipt, Release Funds, Refund, Escalate)
- Screenshot/proof upload
- Auto-generated transcript on close

Queue views: unclaimed tickets, per-MM assigned queues, pending payment,
awaiting mint, completed/archived.

---

## Support Tickets (`create-tickets` → `support-XX-username`)
Separate from deal rooms. General help, buying ads/premium, account issues.
Same ticket mechanics, different category, no escrow attached.

---

## Notifications
Discord's mention badges are load-bearing here — people check tickets because
they got pinged. Needs:
- In-app unread and mention badges
- Email and/or push for: ticket claimed, payment confirmed, delivery marked,
  release timer started, timer about to expire, dispute escalated
- **Mint-day reminders** — several methods require both parties to be active
  on mint day, so a scheduled reminder is a real feature, not a nice-to-have

---

## Middleman / Team Tools

### MM Roster & Profiles (`exsa-crew`, `middleman-fees`)
Public page listing each middleman with avatar, **the exact handle, copyable**,
**working hours in UTC** (e.g. `09:00–21:00 UTC`, or `flexible`), trades
secured count, and vouch rating.

**There is no verified badge, deliberately.** The roster IS the verification:
everyone listed is a middleman and nobody else is, so a badge on the page could
only ever say "yes" — and an "unverified middleman" is a contradiction that
undermines the one question the page exists to answer.

This page doubles as the anti-impersonation reference — it's the canonical
"is this person really an MM" check. Make it easy to find and hard to fake.
Membership is `role IN (MIDDLEMAN, MAIN_MIDDLEMAN) AND status = ACTIVE`, and
nothing else.

### Team Chat (`team-chat`)
Internal-only channel for middlemen to coordinate: ticket cleanup, collateral
policy changes, mint scheduling, handoffs.

### Dispute Escalation (`ticket-problem`)
When a deal room can't be resolved, the MM escalates to the wider MM team and
the Main Middleman. Needs:
- Escalate button inside the deal room
- A review queue with the deal reference, both parties' claims, and the full
  ticket history attached
- Decision recording: who ruled, what outcome, why — with the ruling written
  to the audit log
- Common real cases to support: project never launched / delayed months,
  buyer wants refund but seller refuses, wallet possibly drained, wrong item
  purchased, split (50/50) rulings

### Fee & Fund Management (`mm-fee-bot`, `fund-mm`, `refund-mm-fee`, `x-mm-fee-bot`)
Automatic MM fee calculation per deal, fee ledger per middleman, payout
tracking, and refund handling when a fee needs reversing.

### Mint Schedule (`mint-schedule`)
Shared calendar of upcoming mints. Deals link to their project's mint date;
this drives every release timer and mint-day reminder. Needs a calendar view
and the ability to update a date when a project delays.

### Transcripts & Logs (`transcript`, `transcripts`, `support-transcripts`, `logs`, `tickety-transcript`)
Append-only archive of every closed ticket, searchable by user, project, MM,
or date. Plus a system audit log of every fund movement and admin action.

### Alt-Account Detection (`same-person`)
Flag accounts sharing wallets, IPs, or devices. Self-dealing and alt-account
scams are an active problem. Show flags to admins, not publicly.

### Inventory (`gudang`)
Internal stock/holdings tracking. (`gudang` = "warehouse" in Indonesian.)
Confirm intended scope before building.

---

## Information Pages (`announcements`, `guidelines`, `faqs`, `official-links`, `mm-rules`)
Mostly static or lightly CMS-managed:
- Announcements feed
- Guidelines / terms — note the Discord states that **opening a ticket
  constitutes agreement to terms and privacy**; the web version needs an
  explicit checkbox and a recorded timestamp instead
- FAQ (source the deal-method explanations from `docs/deal-methods.md` so
  they never drift out of sync)
- Official links page — also serves as impersonation defense
- MM rules — internal, MM-facing

---

## Ads / Monetization (`ads-premlist`, ADS embeds)
Promoted listings and ad slots, currently sold via support ticket. Needs a
purchase flow, a duration/expiry model, and an admin approval step.

---

## Live Screen (`livescreen`)
Voice/screenshare channel used during live deals. Likely **out of scope for
v1** — recommend keeping this in Discord and linking out.

---

## Suggested Build Order
1. Auth (Discord OAuth) + user profiles + MM roster
2. Listings board with Quick Buy / Quick Sell
3. Deal rooms + lifecycle state machine, starting with **OTC** (simplest
   method, no mint dependency)
4. PaymentProof submission + MM manual verification panel + transaction log
   (no wallet, no RPC — see `CLAUDE.md`)
5. Remaining deal methods via the config-driven engine
6. Timers, notifications, mint schedule
7. Vouches, last-sales feed, scammer reports
8. Dispute escalation queue + admin dashboard
9. Ads / promoted listings

Ship 1–4 before touching anything else. That's a working escrow product.
