import { z } from 'zod';
import type {
  PaymentAsset,
  PaymentProof,
  ProofKind,
  ProofStatus,
} from '@prisma/client';

/**
 * Payment verification is MANUAL. The platform never connects a wallet, calls
 * an RPC, or resolves a transaction reference — a middleman opens the Solscan
 * link, checks it personally, and confirms. See "DECIDED: Payment Verification
 * Is Manual" in CLAUDE.md.
 *
 * Escrow code must depend on this interface only, never on an implementation,
 * so a future automated verifier is a swap rather than a rewrite.
 */
export type SubmitProofArgs = {
  dealId: string;
  /** Who is submitting. Read from the session — never from client input. */
  submittedById: string;
  kind: ProofKind;
  /**
   * Solscan URL or raw tx signature, exactly as pasted. Stored verbatim and
   * treated as an opaque human-readable reference: the server NEVER parses,
   * resolves, or fetches it.
   */
  reference: string;
  /** What the submitter CLAIMS was sent. Not authoritative until confirmed. */
  claimedAmount?: bigint | null;
  claimedAsset?: PaymentAsset | null;
  screenshotUrl?: string | null;
};

export type VerifyArgs = {
  proofId: string;
  /** The middleman personally making the decision. */
  verifierId: string;
  decision: 'confirm' | 'reject';
  note?: string | null;
};

export type VerifyResult = {
  proof: PaymentProof;
  /** True when this decision left the deal fully funded. */
  dealFunded: boolean;
};

/**
 * NOTE ON THE SHAPE: CLAUDE.md sketches this interface as
 * `submitProof(dealId, reference, kind)`. That sketch cannot record WHO
 * submitted the proof, which the no-self-verification rule depends on, so both
 * methods take an argument object instead. The contract is otherwise unchanged:
 * submission records a claim, verification is a separate human decision.
 */
export interface PaymentVerifier {
  submitProof(args: SubmitProofArgs): Promise<PaymentProof>;
  verify(args: VerifyArgs): Promise<VerifyResult>;
}

/** Thrown when someone tries to verify a proof they submitted themselves. */
export class SelfVerificationError extends Error {
  constructor(readonly proofId: string, readonly userId: string) {
    super('A payment proof cannot be verified by the user who submitted it');
    this.name = 'SelfVerificationError';
  }
}

/**
 * A middleman may never confirm or reject their own submission.
 *
 * This mirrors the `payment_proof_no_self_verification` CHECK constraint in
 * migration 20260826172419_enforce_ledger_immutability, which IS applied.
 * Keep both: the database is the backstop that catches anything bypassing the
 * service layer, this one produces a usable error before the query is issued.
 *
 * Call before any state change, on the proof as loaded from the database —
 * never on a submitter id supplied by the client.
 */
export function assertNotSelfVerification(
  proof: Pick<PaymentProof, 'id' | 'submittedById'>,
  verifierId: string,
): void {
  if (proof.submittedById === verifierId) {
    throw new SelfVerificationError(proof.id, verifierId);
  }
}

/**
 * Input schema for the verify endpoint. The refinement catches the obvious
 * case early; `assertNotSelfVerification` still has to run against the stored
 * proof, since a client-supplied `submittedById` proves nothing.
 */
export const verifyProofInput = z
  .object({
    proofId: z.string().min(1),
    verifierId: z.string().min(1),
    submittedById: z.string().min(1).optional(),
    decision: z.enum(['confirm', 'reject']),
    note: z.string().max(2000).optional(),
  })
  .refine(
    (input) =>
      input.submittedById === undefined ||
      input.submittedById !== input.verifierId,
    {
      message: 'A payment proof cannot be verified by the user who submitted it',
      path: ['verifierId'],
    },
  );

export type VerifyProofInput = z.infer<typeof verifyProofInput>;

/**
 * Input schema for submitting a proof.
 *
 * `reference` is stored verbatim as an opaque human-readable string. It is
 * never parsed, resolved, or fetched by the server, so it is validated for
 * shape only — and in DEMO_MODE not even that, so test data can be entered
 * freely. Demo mode NEVER auto-confirms: the manual confirmation step is the
 * thing being demonstrated.
 */
export const submitProofInput = z.object({
  dealId: z.string().min(1),
  kind: z.custom<ProofKind>(),
  reference: z.string().trim().min(1).max(500),
  claimedAmount: z.bigint().positive().optional(),
  screenshotUrl: z.string().url().optional(),
});

export type SubmitProofInput = z.infer<typeof submitProofInput>;

/**
 * A proof only ever leaves SUBMITTED through an explicit middleman decision.
 * Never advance deal state from a submitted proof, on a timer or otherwise.
 */
export const PROOF_REQUIRES_MANUAL_CONFIRMATION: ProofStatus = 'SUBMITTED';
