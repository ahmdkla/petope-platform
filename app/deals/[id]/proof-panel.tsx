"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  ShieldCheck,
  Clock,
  CircleCheck,
  CircleX,
  Image as ImageIcon,
} from "lucide-react";
import type { PaymentAsset, ProofKind, ProofStatus } from "@prisma/client";
import { submitProof, verifyProof } from "./proof-actions";
import {
  Badge,
  Button,
  Card,
  FormError,
  Hint,
  Input,
  Label,
  Note,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { Modal } from "@/components/modal";
import { ASSET_LABEL, parseAmount } from "@/lib/money";
import type { ActorRole } from "@/lib/deal-transitions";

export type ProofView = {
  id: string;
  kind: ProofKind;
  status: ProofStatus;
  reference: string;
  claimedAmount: string | null;
  claimedAsset: PaymentAsset | null;
  screenshotUrl: string | null;
  submittedAt: string;
  submittedById: string;
  submittedByName: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  verifierNote: string | null;
};

export type RequiredProof = {
  kind: ProofKind;
  label: string;
  submitter: "BUYER" | "SELLER" | "MIDDLEMAN";
  expectedAmount: string | null;
};

const STATUS_META: Record<
  ProofStatus,
  { tone: "warn" | "ok" | "danger"; label: string; icon: typeof Clock }
> = {
  SUBMITTED: { tone: "warn", label: "Awaiting review", icon: Clock },
  CONFIRMED: { tone: "ok", label: "Confirmed", icon: CircleCheck },
  REJECTED: { tone: "danger", label: "Rejected", icon: CircleX },
};

export function ProofPanel({
  dealId,
  role,
  asset,
  proofs,
  required,
  currentUserId,
  open,
}: {
  dealId: string;
  role: ActorRole;
  asset: PaymentAsset;
  proofs: ProofView[];
  required: RequiredProof[];
  currentUserId: string;
  open: boolean;
}) {
  const isMm = role === "MIDDLEMAN" || role === "ADMIN";

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle>Payments</SectionTitle>
        {isMm ? (
          <Badge tone="accent">
            <ShieldCheck aria-hidden className="size-3.5" strokeWidth={2} />
            You verify these
          </Badge>
        ) : null}
      </div>

      <Note>
        Payments happen off-platform. Send funds from your own wallet, then paste
        the Solscan link here. The platform never fetches or reads the link —
        the middleman opens it and checks it personally.
      </Note>

      <ul className="space-y-3">
        {required.map((req) => {
          const forKind = proofs.filter((p) => p.kind === req.kind);
          const settled = forKind.find((p) => p.status === "CONFIRMED");
          const pending = forKind.find((p) => p.status === "SUBMITTED");
          const canSubmit =
            open && !settled && !pending && (role === req.submitter || role === "ADMIN");

          return (
            <li
              key={req.kind}
              className="rounded-lg border border-line bg-raised p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-body font-semibold text-ink">{req.label}</span>
                {settled ? (
                  <StatusBadge status="CONFIRMED" />
                ) : pending ? (
                  <StatusBadge status="SUBMITTED" />
                ) : (
                  <Badge tone="neutral">Not submitted</Badge>
                )}
              </div>

              {req.expectedAmount ? (
                <p className="mt-1 font-mono tnum text-meta text-ink-muted">
                  Expected: {req.expectedAmount}
                </p>
              ) : null}

              <div className="mt-3 space-y-3">
                {forKind.map((p) => (
                  <ProofRow
                    key={p.id}
                    dealId={dealId}
                    proof={p}
                    isMm={isMm}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>

              {canSubmit ? (
                <SubmitForm dealId={dealId} kind={req.kind} asset={asset} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StatusBadge({ status }: { status: ProofStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {meta.label}
    </Badge>
  );
}

function ProofRow({
  dealId,
  proof,
  isMm,
  currentUserId,
}: {
  dealId: string;
  proof: ProofView;
  isMm: boolean;
  currentUserId: string;
}) {
  const [decision, setDecision] = useState<"confirm" | "reject" | null>(null);
  const isOwnSubmission = proof.submittedById === currentUserId;
  const awaiting = proof.status === "SUBMITTED";

  return (
    <div className="space-y-2.5 rounded-md border border-line bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta text-ink-muted">
          Submitted by{" "}
          <span className="font-mono text-ink">{proof.submittedByName ?? "unknown"}</span>{" "}
          <time className="font-mono text-ink-faint">{proof.submittedAt}</time>
        </span>
        <StatusBadge status={proof.status} />
      </div>

      {/* Opaque reference. rel=noreferrer so opening it leaks nothing back. */}
      <a
        href={proof.reference.startsWith("http") ? proof.reference : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 break-all font-mono text-meta ${
          proof.reference.startsWith("http")
            ? "text-accent-text underline underline-offset-2"
            : "text-ink"
        }`}
      >
        {proof.reference}
        {proof.reference.startsWith("http") ? (
          <ExternalLink aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
        ) : null}
      </a>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-meta">
        <div className="flex gap-2">
          <dt className="text-ink-faint">Claimed</dt>
          <dd className="font-mono tnum text-ink">
            {proof.claimedAmount ?? "not stated"}
          </dd>
        </div>
        {proof.screenshotUrl ? (
          <div className="flex gap-2">
            <dt className="text-ink-faint">
              <ImageIcon aria-hidden className="size-3.5" strokeWidth={2} />
              <span className="sr-only">Screenshot</span>
            </dt>
            <dd>
              <a
                href={proof.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                Screenshot
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {awaiting ? (
        <p className="text-meta text-warn">
          Unverified. This changes nothing until the middleman confirms it.
        </p>
      ) : (
        <p className="text-meta text-ink-muted">
          {proof.status === "CONFIRMED" ? "Confirmed" : "Rejected"} by{" "}
          <span className="font-mono text-ink">{proof.verifiedByName ?? "unknown"}</span>{" "}
          <time className="font-mono text-ink-faint">{proof.verifiedAt}</time>
          {proof.verifierNote ? (
            <>
              {" — "}
              <span className="text-ink">{proof.verifierNote}</span>
            </>
          ) : null}
        </p>
      )}

      {isMm && awaiting ? (
        isOwnSubmission ? (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-meta text-danger">
            You submitted this proof, so you cannot verify it. Another middleman
            or an admin has to decide.
          </p>
        ) : (
          <div className="flex gap-2 border-t border-line pt-3">
            <Button size="sm" onClick={() => setDecision("confirm")}>
              Confirm
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDecision("reject")}>
              Reject
            </Button>
          </div>
        )
      ) : null}

      {decision ? (
        <VerifyDialog
          dealId={dealId}
          proof={proof}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      ) : null}
    </div>
  );
}

function VerifyDialog({
  dealId,
  proof,
  decision,
  onClose,
}: {
  dealId: string;
  proof: ProofView;
  decision: "confirm" | "reject";
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirming = decision === "confirm";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await verifyProof(dealId, {
        proofId: proof.id,
        decision,
        note: note.trim() || null,
      });
      if (!res.ok) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Modal
      title={confirming ? "Confirm this payment" : "Reject this proof"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={confirming ? "primary" : "danger"}
            disabled={pending}
            onClick={submit}
          >
            {pending ? "Recording" : confirming ? "Confirm payment" : "Reject proof"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-ink-muted">
          {confirming
            ? "Open the reference and check it yourself before confirming. This records your decision against your name and advances the deal."
            : "Rejecting leaves the deal awaiting payment. The submitter can post a new proof; this one is kept as a record."}
        </p>

        <div className="rounded-md border border-line bg-raised p-3">
          <p className="text-meta text-ink-faint">Reference</p>
          <a
            href={proof.reference.startsWith("http") ? proof.reference : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-2 break-all font-mono text-meta text-accent-text underline underline-offset-2"
          >
            {proof.reference}
            <ExternalLink aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          </a>
          <p className="mt-2 font-mono tnum text-meta text-ink-muted">
            Claimed: {proof.claimedAmount ?? "not stated"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="verify-note">
            Note {confirming ? "(optional)" : "(required)"}
          </Label>
          <Textarea
            id="verify-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder={
              confirming ? "Anything worth recording" : "Why does this not check out?"
            }
          />
          <Hint>Stored on the proof and in the audit log against your name.</Hint>
        </div>

        <FormError message={error} />
      </div>
    </Modal>
  );
}

function SubmitForm({
  dealId,
  kind,
  asset,
}: {
  dealId: string;
  kind: ProofKind;
  asset: PaymentAsset;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [coin, setCoin] = useState<"USDC" | "USDT">("USDC");
  const [screenshot, setScreenshot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reference.trim()) {
      setError("Paste the Solscan link or transaction signature.");
      return;
    }
    const parsedAmount = amount.trim() === "" ? null : parseAmount(amount, asset);
    if (amount.trim() !== "" && parsedAmount === null) {
      setError(`The amount must be a number in ${ASSET_LABEL[asset]}.`);
      return;
    }

    startTransition(async () => {
      const res = await submitProof(dealId, {
        kind,
        reference: reference.trim(),
        claimedAmount: parsedAmount,
        claimedCoin: asset === "STABLE" ? coin : null,
        screenshotUrl: screenshot.trim() || null,
      });
      if (!res.ok) setError(res.error);
      else {
        setReference("");
        setAmount("");
        setScreenshot("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="space-y-1.5">
        <Label htmlFor={`ref-${kind}`}>Solscan link or transaction signature</Label>
        <Input
          id={`ref-${kind}`}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="https://solscan.io/tx/..."
          className="font-mono"
        />
        <Hint>Stored exactly as pasted. The server never opens it.</Hint>
      </div>

      {asset === "STABLE" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`coin-${kind}`}>Which stablecoin did you send?</Label>
          <Select
            id={`coin-${kind}`}
            value={coin}
            onChange={(e) => setCoin(e.target.value as "USDC" | "USDT")}
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </Select>
          <Hint>
            Terms were agreed in USDC/USDT because they are interchangeable. The
            middleman needs to know which one to look for.
          </Hint>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`amt-${kind}`}>
            Amount sent ({ASSET_LABEL[asset]}, optional)
          </Label>
          <Input
            id={`amt-${kind}`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Hint>A claim, not proof. The middleman checks the real amount.</Hint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`shot-${kind}`}>Screenshot URL (optional)</Label>
          <Input
            id={`shot-${kind}`}
            type="url"
            value={screenshot}
            onChange={(e) => setScreenshot(e.target.value)}
            placeholder="https://..."
          />
          <Hint>File upload is not wired up yet — paste a link for now.</Hint>
        </div>
      </div>

      <p className="rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-meta text-warn">
        Never paste a private key, seed phrase, or password. Only the
        transaction reference belongs here.
      </p>

      <FormError message={error} />

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting" : "Submit for review"}
      </Button>
    </form>
  );
}
