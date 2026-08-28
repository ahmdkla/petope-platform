import {
  BUYER_PAYS_LABEL,
  DEAL_METHOD_RULES,
  HANDOVER_LABEL,
  type DealMethodRule,
} from './deal-methods';

/**
 * FAQ content.
 *
 * The seven method answers are NOT written here — they are derived from
 * DEAL_METHOD_RULES, which is the transcription of docs/deal-methods.md. That
 * is deliberate: the FAQ is the page people read before trusting the platform
 * with money, and a money flow that changed in the config but not in the FAQ
 * would be worse than no FAQ at all.
 *
 * Only the three general answers are prose. They come from the live Discord
 * FAQ (docs/screenshots/Faqs 1.jpg), reworded for the web but not restated.
 */
export type FaqEntry = { question: string; answer: string[] };

export const GENERAL_FAQ: FaqEntry[] = [
  {
    question: 'What is a middleman?',
    answer: [
      'A middleman (MM) is the person who makes a deal safe by holding the funds. The buyer sends the whitelist cost plus the MM fee to the middleman. The seller sends the account, collateral, or wallet details straight to the buyer, off-platform.',
      'Once the whitelist is secured, the middleman releases the total to the seller.',
      'After the deal closes and the funds are transferred, neither the middleman nor the platform is responsible for what happens to the account or wallet afterwards. Check everything while the deal is still open.',
    ],
  },
  {
    question: 'What is collateral?',
    answer: [
      'Collateral is value the seller pledges to secure the whitelist. It is held by the middleman alongside the buyer\u2019s payment and returned when the deal completes successfully.',
      'On Wallet Surrender and Wallet Submit the seller has access to the wallet the buyer will mint from, so the mint price is taken from the seller as collateral. If the seller drains the buyer, the buyer receives that money instead.',
      'On Mint For You a smaller amount is taken so the seller cannot back out once the deal is agreed, or fail to send the NFT on mint day. If they back out, the collateral goes to the buyer as compensation.',
      'After the mint, the deal amount and the collateral are both sent to the seller.',
    ],
  },
  {
    question: 'Can I cancel a deal?',
    answer: [
      'Yes, if both the buyer and the seller agree.',
      'But not once either of you has received the private data \u2014 a private key, or Discord account credentials. After that point a cancellation is no longer possible and only dispute resolution applies, because a secret that has been shared cannot be un-shared.',
      'Before any handover, cancelling is available right up to the moment the deal is funded and beyond, while nothing sensitive has changed hands.',
    ],
  },
  {
    question: 'How do I know I am talking to a real middleman?',
    answer: [
      'Check the roster. It is the only authoritative list of EXSAVERSE middlemen, and it shows each one\u2019s verified badge and published working hours.',
      'Middlemen never message you first. Anyone who direct-messages you claiming to be staff is an impersonator \u2014 report them.',
    ],
  },
  {
    question: 'How does payment actually work?',
    answer: [
      'All payment happens off-platform, from your own wallet, exactly as it does today. Settlement is in SOL or a stablecoin (USDC or USDT) on Solana, whatever network the project itself mints on.',
      'You then paste the Solscan link into the deal room as proof. The middleman opens that link, checks it personally, and confirms. That human confirmation is what moves the deal forward.',
      'The platform never connects to a wallet, never reads the chain, and never moves money itself. It records what people do.',
    ],
  },
];

export type MethodFaq = {
  rule: DealMethodRule;
  buyerPays: string;
  collateral: string;
  handover: string;
  timers: string[];
};

/** Turns each method's config into the shape the FAQ page renders. */
export function methodFaqs(): MethodFaq[] {
  return Object.values(DEAL_METHOD_RULES).map((rule) => ({
    rule,
    buyerPays: rule.buyerPays.map((p) => BUYER_PAYS_LABEL[p]).join(' + '),
    collateral: rule.requiresCollateral
      ? `Required. ${describeFormula(rule.collateralFormula)}`
      : 'Not used on this method.',
    handover: HANDOVER_LABEL[rule.offPlatformHandover],
    timers: describeTimers(rule),
  }));
}

function describeFormula(formula: DealMethodRule['collateralFormula']): string {
  switch (formula) {
    case 'mint_price':
      return 'Usually the mint price, or as otherwise agreed.';
    case 'mint_price_plus_50':
      return 'The mint price plus 50 percent, or as otherwise agreed.';
    case 'agreed':
      return 'Agreed between the parties, subject to the configured minimum.';
    case 'none':
      return '';
  }
}

function describeTimers(rule: DealMethodRule): string[] {
  const out: string[] = [];
  if (rule.sellerDeliveryDeadlineHours) {
    out.push(
      `The seller must deliver within ${rule.sellerDeliveryDeadlineHours} hours of the mint. Miss it and the deal fails: the buyer receives all funds.`,
    );
  }
  if (rule.buyerConfirmWindowHours) {
    out.push(
      `Once funds are ready to release, the buyer has ${rule.buyerConfirmWindowHours} hours to confirm.`,
    );
  }
  if (rule.buyerSilenceAutoReleaseHours) {
    out.push(
      `If the buyer does not respond in the room, their confirmation stops being required after ${rule.buyerSilenceAutoReleaseHours} hours. The middleman still performs the release by hand.`,
    );
  }
  if (rule.releaseTiming === 'after_mint') {
    out.push('Funds are held until after the mint.');
  }
  if (!rule.requiresMintEvent) {
    out.push('No mint event is involved, so this is the shortest flow.');
  }
  return out;
}
