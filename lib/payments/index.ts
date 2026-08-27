import { ManualVerifier } from './manual-verifier';
import type { PaymentVerifier } from './verifier';

/**
 * The single entry point escrow code uses.
 *
 * Typed as the INTERFACE, not the class, so nothing downstream can reach for an
 * implementation detail. Swapping in an automated verifier later is a change to
 * this one line.
 */
export const paymentVerifier: PaymentVerifier = new ManualVerifier();

export * from './verifier';
