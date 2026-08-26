# Deal Methods — Escrow Flow Reference

Source of truth for how money and assets move. Derived from the live Discord
FAQ. **Every escrow, payment, or state-transition change must be checked
against this file.**

Common to all methods:
- Payment network: **USDT / USDC on Solana only**
- Buyer always pays: `deal amount + MM fee` (some methods add mint price)
- Both parties submit proof-of-payment tx links; MM verifies on-chain
- Seller collateral is held by the MM alongside buyer funds
- MM never releases funds without explicit confirmation
- After funds are transferred and the deal closes, the MM and platform
  disclaim further responsibility (surface this in the ticket UI)

---

## 1. Discord Surrender
Seller hands over a Discord account that holds the WL role.

**Flow**
1. Buyer → MM wallet: deal amount + MM fee. Submits tx link.
2. Seller → MM wallet: collateral (≈ mint price, or as agreed). Submits tx link.
3. MM confirms both payments.
4. Seller sends the whitelisted Discord account details to the buyer (off-platform).
5. Buyer secures the account and informs the MM.
6. **Funds are held until after the mint** — this method has elevated scam
   risk, so release is deliberately delayed.

**Buyer responsibilities (show in UI)**
- Change the account's email and password, then enable 2FA immediately
- Verify the WL role exists on the account **during** the deal — the MM is not
  responsible for the account after the deal closes

**Platform note:** account credentials must be exchanged off-platform. Do not
build credential fields.

---

## 2. Wallet Surrender
Seller hands over the wallet that holds the WL.

**Flow**
1. Buyer → MM wallet: deal amount + MM fee. Submits tx link.
2. Seller → MM wallet: collateral (≈ mint price, or as agreed). Submits tx link.
3. MM confirms.
4. Seller sends the whitelisted wallet's private key to the buyer (off-platform).
5. After the mint, MM releases **collateral + deal amount** to the seller.
6. Seller confirms receipt to MM and buyer.
7. Buyer may leave a vouch.

**Rules**
- After wallet submission closes, the buyer must check the wallet for WL status
- If not whitelisted → buyer notifies MM with a screenshot
- If the buyer can't mint due to **FCFS over-allocation**, that is not the
  seller's fault → **no refund**
- Both parties must be active on mint day and hold their own proof of WL
- If the buyer does not respond in the ticket, funds release after **24h**

---

## 3. Wallet Submit
Buyer's wallet gets submitted to the project by the seller.

**Flow**
1. Buyer → MM wallet: deal amount + MM fee. Submits tx link.
2. Seller → MM wallet: collateral (≈ mint price, or as agreed). Submits tx link.
3. MM confirms.
4. Buyer sends their wallet's private key to the seller (off-platform).
5. Seller submits the buyer's wallet for the mint.
6. After the mint, MM releases the deal amount to the seller.

**Why collateral exists here:** it stops the seller cancelling unilaterally
after the buyer has already exposed their wallet.

**Post-mint rules**
- Funds may release once wallet submission closes (depends on the deal terms)
- Seller must provide proof of submission **before and after** submission closes
- If funds release after mint, the buyer has **2h max** to confirm

---

## 4. Mint For You
Seller mints on the buyer's behalf and transfers the NFT.

**Flow**
1. Buyer → MM wallet: deal amount + MM fee + **mint price**. Submits tx link.
2. Seller → MM wallet: collateral (≈ mint price, or as agreed). Submits tx link.
3. Seller mints and sends the NFT to the buyer's wallet.
4. Buyer receives the NFT and confirms to the MM.
5. MM releases **deal amount + mint price + collateral** to the seller.

**Rules**
- Seller must send the NFT **within 6h after mint**
- If the seller misses that window → deal is failed, buyer receives all funds
- If the seller backs out or never sends → collateral goes to the buyer as
  compensation
- If the seller is late but still delivers, they owe the buyer some USD in
  compensation (amount agreed case-by-case)
- Both parties must be active on mint day
- Buyer non-response in the ticket → funds release after **24h**

---

## 5. Presale
For presale/allocation deals.

**Flow**
1. Buyer → MM wallet: mint price + presale deal amount + MM fee. Submits tx links.
2. Seller → MM wallet: collateral = **mint price + 50%** (or as agreed).
   Submits tx links.
3. Buyer and seller agree on sub-type: **Wallet Surrender** or **NFT transfer**.
4. Seller sends the wallet to the buyer (off-platform).
5. After mint and NFT transfer to the buyer's wallet, buyer confirms →
   MM releases funds.
6. For the NFT-transfer sub-type, MM releases only after the buyer has
   received the NFTs **and verified they are authentic**.

---

## 6. Code Method
`⚠️ INCOMPLETE — the source FAQ screenshot was cut off.`

Fill this in before building. Presumably: seller provides a mint/access code
rather than a wallet or account. Needs its own answers for:
- What exactly does the buyer receive, and when?
- Is collateral required?
- What proves delivery (code redeemed on-chain? screenshot?)
- What's the confirmation window?

**Do not implement this method until the flow is documented.**

---

## 7. OTC Deal
Direct NFT sale, no mint involved.

**Flow**
1. Buyer → MM wallet: NFT price + MM fee. Submits tx links.
2. MM confirms.
3. Seller sends the NFT to the buyer's wallet.
4. MM and buyer verify the NFT is authentic.
5. MM releases funds.

**Note:** no collateral and no mint dependency, so this is the shortest flow
and the best candidate for a v1 implementation.

---

## Implementation Guidance

Model these as **configuration, not branching code**. Something like:

```ts
type DealMethod = {
  id: 'discord_surrender' | 'wallet_surrender' | 'wallet_submit'
     | 'mint_for_you' | 'presale' | 'code' | 'otc';
  buyerPays: ('deal_amount' | 'mm_fee' | 'mint_price')[];
  requiresCollateral: boolean;
  collateralFormula: 'mint_price' | 'mint_price_plus_50' | 'agreed' | 'none';
  requiresMintEvent: boolean;
  offPlatformHandover: 'discord_account' | 'private_key' | 'nft' | 'none';
  releaseTiming: 'after_mint' | 'after_submission_close' | 'on_buyer_confirm';
  buyerConfirmWindowHours: number | null;   // e.g. 2
  buyerSilenceAutoReleaseHours: number | null; // e.g. 24
  sellerDeliveryDeadlineHours: number | null;  // e.g. 6
  collateralForfeitsTo: 'buyer' | 'seller' | null;
};
```

Then one shared escrow engine reads the config. Adding or tuning a method
becomes a config change, not a rewrite — and the rules stay auditable in
one place.

## Open Questions to Resolve
- **Code method flow** (above) — still undocumented
- **Taxonomy mapping**: the listing form's `type` dropdown has 5 options
  (Any / Mint / Token Transfer / Wallet Submit / Wallet Surrender) but this
  file documents 7 escrow methods. Confirm the intended mapping — especially:
  - Is `Token Transfer` the same as the FAQ's OTC deal?
  - Is `Mint` the same as Mint For You?
  - Do Discord Surrender, Presale, and Code all fall under `Any`?
- The 12th, unidentified optional field on `/buy` and `/sell`
- MM fee: flat, percentage, or tiered? Varies by MM or deal size?
- When `payment` is SOL rather than a stablecoin, how is price volatility
  handled between listing time, funding, and release? (A deal sitting in
  `awaiting_mint` for weeks has real exposure here.)

**Resolved**
- `price-type` = `for_each` | `for_all`
- `payment` = SOL | USDC | USDT (Solana network)
- `collateral`, `quantity`, `project-link`, `offer` are all optional
- Is the MM fee a flat amount, a percentage, or tiered? Does it vary by MM
  or by deal size?
- Who pays gas/network fees on release?
- Is collateral ever partially forfeited, or always all-or-nothing?
- What happens if a project delays its mint indefinitely? (The Discord's
  `ticket-problem` channel shows a real case of a 3+ month delay with buyer
  and seller disagreeing on refund terms — this needs a written policy.)
