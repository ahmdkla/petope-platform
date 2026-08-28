/**
 * Presentation only: which icon and tint a system message gets in the deal-room
 * activity feed.
 *
 * The bodies are written by `DEAL_METHOD_RULES` transitions, the manual
 * verifier, the timer runner and the admin actions — all first-party strings.
 * Classifying them by keyword is safe *because nothing depends on the result*:
 * an unmatched message still renders, with the neutral bot mark. No state, no
 * money and no permission is ever derived from this. If the feed needs to carry
 * real semantics later, `DealMessage` should gain an event column rather than
 * this file gaining logic.
 */
export type SystemEventTone = 'neutral' | 'money' | 'ok' | 'warn' | 'danger';

export type SystemEvent = {
  tone: SystemEventTone;
  icon: 'bot' | 'shield' | 'receipt' | 'check' | 'clock' | 'alert' | 'undo';
  /** Short label above the message, so the feed scans as events not prose. */
  label: string;
};

const MATCHERS: { test: RegExp; event: SystemEvent }[] = [
  {
    test: /claimed this deal|middleman joined/i,
    event: { tone: 'neutral', icon: 'shield', label: 'Middleman' },
  },
  {
    test: /payment proof was submitted|proof was submitted/i,
    event: { tone: 'money', icon: 'receipt', label: 'Proof submitted' },
  },
  {
    test: /confirmed the payment|checked it personally/i,
    event: { tone: 'ok', icon: 'check', label: 'Payment confirmed' },
  },
  {
    test: /rejected a payment proof/i,
    event: { tone: 'danger', icon: 'alert', label: 'Proof rejected' },
  },
  {
    test: /released|refunded|collateral (was )?returned|fee was refunded/i,
    event: { tone: 'money', icon: 'receipt', label: 'Funds' },
  },
  {
    test: /deadline|timer|auto-release|hours? (left|remaining)|mint (was )?(moved|rescheduled)/i,
    event: { tone: 'warn', icon: 'clock', label: 'Timer' },
  },
  {
    test: /dispute|escalat/i,
    event: { tone: 'danger', icon: 'alert', label: 'Dispute' },
  },
  {
    test: /cancelled/i,
    event: { tone: 'neutral', icon: 'undo', label: 'Cancelled' },
  },
  {
    test: /terms|method|locked|agreed/i,
    event: { tone: 'neutral', icon: 'check', label: 'Terms' },
  },
];

const DEFAULT: SystemEvent = { tone: 'neutral', icon: 'bot', label: 'System' };

export function classifySystemMessage(body: string): SystemEvent {
  return MATCHERS.find((m) => m.test.test(body))?.event ?? DEFAULT;
}
