# Screenshot Index

Reference screenshots of the live EXSAVERSE Discord workflow, captured Aug 2026.
Open the relevant image when building the matching feature.

Filenames below are the originals. See `RENAME.ps1` in this folder for an
optional script that renames them to numbered, path-safe versions.

---

## Overview & Navigation

| # | File | Shows |
|---|---|---|
| 01 | `how the discord look.jpg` | Full server layout: sidebar, an open deal ticket with the terms embed (Item / Chain / Price for each / Specific / Type / Quantity / Collateral / Project Link), the roles panel (Main Middleman bot with trades-secured count, Middleman, Customer), and the pinned "VERIFY SERVER ID" anti-impersonation warning |
| 02 | `user on top left.jpg` | User panel / presence indicator in the bottom-left |
| 03 | `of course a notification to let middleman or buyers or seller know that someone tag them.jpg` | Mention badge — the notification pattern that drives people back to their tickets |

## Information Pages

| # | File | Shows |
|---|---|---|
| 04 | `Information Category.jpg` | INFORMATION channels: announcement, official-links, guidelines, exsa-crew, faqs, middleman-fees |
| 05 | `Information about middleman, so buyer or seller can know about the teams.jpg` | **MM roster** — per-middleman cards with avatar, @Middleman role, user ID, and working hours in UTC (e.g. `09:00 AM–09:00 PM UTC`, `flexible`). Doubles as the anti-impersonation reference |

## Marketplace

| # | File | Shows |
|---|---|---|
| 06 | `General Marketplace.jpg` | Marketplace channels: general, dm-report, prem-listing, buying-listing, nft-market, selling-listing, mm-vouches, report-scammer, last-sales, livescreen |
| 07 | `a General chat for Buyer or seller to communicate.jpg` | Open negotiation chat. Note the shorthand: `B <project>` = buying, `S <project>` = selling |
| 08 | `Selling listing for buyer too look at available Whitelists listed by the sellers.jpg` | **Sell listing cards** with action buttons: `Offer` · `Quick Buy` · `Delist` · `View Seller`. Also shows the ADS Available promo block |
| 09 | `Buying listing for Seller too look at any Whitelists demanded listed by the buyer.jpg` | **Buy listing cards** with action buttons: `Quick Sell` · `Delist` · `View Buyer` |
| 10 | `this is what seller need to input when they want to post in selling listing.jpg` | `/sell` command signature — the listing form field set |
| 11 | `this is what buyer need to input when they want to post in buying listing.jpg` | `/buy` command signature — identical field set to `/sell` |
| 12 | `Last sales projects or Whitelists.jpg` | Completed-deal feed marked SOLD, showing price per unit, quantity, spot type, collateral, and the middleman who secured it |
| 13 | `Vouches for seller and Buyer to leave a good review to middlemans so others will trust them more.jpg` | **mm-vouches** — public testimonials naming a middleman. The trust layer |

## Tickets & Deal Rooms

| # | File | Shows |
|---|---|---|
| 14 | `Support Category.jpg` | SUPPORT: create-tickets, then `support-<batch>-<username>` channels. Separate from deal rooms |
| 15 | `The Tickets or Channels to P2P.jpg` | TICKETS 1–5 categories with active deal rooms named `<batch>-<username>-<project>` |
| 16 | `Tickets already have P2P Process.jpg` | PENDING PAYMENT 1–3 categories — deals awaiting buyer funds / seller collateral |
| 17 | `Tickets for all the middleman.jpg` | Per-middleman categories (`MM GURA`, `MM HEX`, `MM AKLA`…), each holding that MM's claimed tickets. Note the `done-` prefix on completed ones and the `<mm>-<batch>-<user>-<project>` naming |

## Team & Admin

| # | File | Shows |
|---|---|---|
| 18 | `Team Category.jpg` | TEAM channels: team-chat, refund-mm-fee, gudang, mm-rules, ticket-problem, mm-fee-bot, fund-mm, ads-premlist, mint-schedule, transcript(s), support-transcripts, logs, same-person |
| 19 | `a Team chat for middleman to communicate.jpg` | Internal MM coordination — ticket cleanup, collateral policy updates (e.g. minimum collateral of $5–$7 even on Wallet Submit), mint scheduling |
| 20 | `A channels that use to report if a problem happened in a ticket that need for other middlemans or the boss middleman to review and make decision.jpg` | **ticket-problem** — dispute escalation. Real cases visible: project delayed 3+ months with buyer wanting refund and seller refusing, cancelled project with collateral dispute, possible wallet drain, wrong item purchased, 50/50 split rulings |

## FAQs — escrow method source of truth

These are the source for `docs/deal-methods.md`. If they conflict, ask.

| # | File | Shows |
|---|---|---|
| 21 | `Faqs 1.jpg` | What is MM · What is Collateral · Can I cancel the deal · intro to Types of Whitelist |
| 22 | `Faqs 2.jpg` | Method 1 **Discord Surrender** · Method 2 **Wallet Surrender** (full flows, tips, buyer responsibilities) |
| 23 | `Faqs 3.jpg` | Method 3 **Wallet Submit** · start of Method 4 **Mint For You** |
| 24 | `Faqs 4.jpg` | Method 4 **Mint For You** (6h delivery rule) · **Presale method** · start of **Code method** |
| 25 | `Faqs 5.jpg` | **OTC deal** · **FAQ after mint** (2h / 24h confirmation windows per method) · accepted payment networks |

---

## Missing / To Capture

- [ ] **Listing `type` dropdown options** — screenshot showing `Any`, `Mint`,
      `Token Transfer`, `Wallet Submit`, `Wallet Surrender`. Referenced in
      `CLAUDE.md` but not saved in this folder.
- [ ] **Code method** — the full flow, cut off between Faqs 4 and 5. Currently
      undocumented and blocked in `docs/deal-methods.md`.
- [ ] **The 12th `/buy` and `/sell` field** — both commands show `+1 optional`
      that is cut off in screenshots 10 and 11.
- [ ] **MM fee structure** — flat, percentage, or tiered? Not visible in any
      screenshot.
- [ ] `middleman-fees` channel contents.
