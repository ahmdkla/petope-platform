"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { LISTING_TYPE_TO_METHOD } from "@/lib/listing-meta";
import { resolveTotal } from "@/lib/money";

const ASSETS = ["SOL", "USDC", "USDT"] as const;

/** Server-side validation on every route. Never trust the client. */
const createListingSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  item: z.string().trim().min(1, "Item is required").max(120),
  chain: z.string().trim().min(1, "Chain is required").max(60),
  price: z.bigint().positive("Price must be greater than zero"),
  priceType: z.enum(["FOR_EACH", "FOR_ALL"]),
  // Allowlist only — reject anything outside it.
  payment: z.enum(ASSETS),
  specific: z.enum(["GTD", "FCFS"]),
  type: z.enum(["ANY", "MINT", "TOKEN_TRANSFER", "WALLET_SUBMIT", "WALLET_SURRENDER"]),
  quantity: z.number().int().min(1).max(10_000),
  collateral: z.bigint().nonnegative().nullable(),
  projectLink: z.string().trim().url("Project link must be a URL").nullable(),
  acceptsOffers: z.boolean(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createListing(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to post a listing." };
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "Your account cannot post listings." };
  }
  if (!(await hasAcceptedTerms(user.id))) {
    return { ok: false, error: "Accept the guidelines before posting a listing." };
  }

  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid listing." };
  }
  const data = parsed.data;

  // Collateral minimum is an admin setting, never a hardcoded value.
  if (data.side === "SELL" && data.collateral !== null) {
    const min = await collateralMinimum();
    if (min && data.collateral < min.amount && data.collateral > 0n) {
      return {
        ok: false,
        error: `Collateral is below the configured minimum for ${min.asset}.`,
      };
    }
  }

  await db.listing.create({
    data: {
      ...data,
      authorId: user.id,
      // Prisma cannot default one column from another.
      quantityRemaining: data.quantity,
    },
  });

  revalidatePath("/listings");
  return { ok: true };
}

async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { termsAcceptedAt: true },
  });
  return Boolean(u?.termsAcceptedAt);
}

async function collateralMinimum(): Promise<{ amount: bigint; asset: string } | null> {
  const row = await db.adminSetting.findUnique({ where: { key: "collateral.minimum" } });
  if (!row) return null;
  const v = row.value as { amount?: number; asset?: string };
  if (typeof v.amount !== "number" || !v.asset) return null;
  return { amount: BigInt(v.amount), asset: v.asset };
}

export async function delistListing(listingId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { authorId: true, status: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.authorId !== user.id) {
    return { ok: false, error: "Only the author can delist this listing." };
  }
  if (listing.status === "IN_DEAL") {
    return { ok: false, error: "This listing has an open deal and cannot be delisted." };
  }

  await db.listing.update({
    where: { id: listingId },
    data: { status: "DELISTED" },
  });

  revalidatePath("/listings");
  return { ok: true };
}

const offerSchema = z.object({
  listingId: z.string().min(1),
  amount: z.bigint().positive("Offer must be greater than zero"),
  message: z.string().trim().max(500).nullable(),
});

export async function makeOffer(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to make an offer." };

  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid offer." };
  }

  const listing = await db.listing.findUnique({
    where: { id: parsed.data.listingId },
    select: { authorId: true, acceptsOffers: true, status: true, payment: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (!listing.acceptsOffers) {
    return { ok: false, error: "This listing does not accept offers." };
  }
  if (listing.status !== "ACTIVE") {
    return { ok: false, error: "This listing is no longer active." };
  }
  if (listing.authorId === user.id) {
    return { ok: false, error: "You cannot make an offer on your own listing." };
  }

  await db.offer.create({
    data: {
      listingId: parsed.data.listingId,
      offererId: user.id,
      amount: parsed.data.amount,
      asset: listing.payment,
      message: parsed.data.message,
    },
  });

  revalidatePath("/listings");
  return { ok: true };
}

/**
 * Quick Buy / Quick Sell — the main funnel into escrow, so it is one action.
 *
 * Opens a Deal in `open` state pre-filled from the listing. Deliberately does
 * NOT set deal.method: the listing's `type` only supplies a UI default, and the
 * method must be explicitly confirmed by both parties before terms_locked.
 * No middleman is assigned yet — that happens at `claimed`.
 */
export async function quickDeal(listingId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to open a deal." };
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "Your account cannot open deals." };
  }
  if (!(await hasAcceptedTerms(user.id))) {
    return { ok: false, error: "Accept the guidelines before opening a deal." };
  }

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.status !== "ACTIVE") {
    return { ok: false, error: "This listing is no longer available." };
  }
  // The database CHECK would reject this anyway; fail with a readable message.
  if (listing.authorId === user.id) {
    return { ok: false, error: "You cannot open a deal on your own listing." };
  }
  if (listing.quantityRemaining < 1) {
    return { ok: false, error: "There are no spots left on this listing." };
  }

  // On a SELL listing the author is the seller and the actor is buying.
  const buyerId = listing.side === "SELL" ? user.id : listing.authorId;
  const sellerId = listing.side === "SELL" ? listing.authorId : user.id;

  const dealAmount = resolveTotal(listing.price, listing.priceType, listing.quantity);

  const deal = await db.$transaction(async (tx) => {
    const batchNumber = await nextBatchNumber(tx);

    const created = await tx.deal.create({
      data: {
        reference: buildReference(batchNumber, user.displayName ?? user.email, listing.item),
        batchNumber,
        listingId: listing.id,
        buyerId,
        sellerId,
        status: "OPEN",
        // method intentionally left null — confirmed by both parties in the room.
        projectName: listing.item,
        chain: listing.chain,
        dealAmount,
        // MM fee is calculated when a middleman claims and terms are set.
        mmFee: 0n,
        collateralAmount: listing.collateral,
        asset: listing.payment,
        quantity: listing.quantity,
        specific: listing.specific,
        priceType: listing.priceType,
      },
    });

    // Reserve the listing so a second buyer cannot claim the same spots.
    await tx.listing.update({
      where: { id: listing.id },
      data: { status: "IN_DEAL" },
    });

    await tx.transactionLog.create({
      data: {
        dealId: created.id,
        actorId: user.id,
        action: "DEAL_CREATED",
        toStatus: "OPEN",
        metadata: {
          via: listing.side === "SELL" ? "quick_buy" : "quick_sell",
          listingId: listing.id,
          suggestedMethod: LISTING_TYPE_TO_METHOD[listing.type],
        },
      },
    });

    return created;
  });

  revalidatePath("/listings");
  redirect(`/deals/${deal.id}`);
}

/** Batch numbers group concurrent tickets and are deliberately not unique. */
type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function nextBatchNumber(tx: TxClient): Promise<number> {
  const result = await tx.deal.aggregate({ _max: { batchNumber: true } });
  return (result._max.batchNumber ?? 0) + 1;
}

/**
 * Display string only. Built from real fields and NEVER parsed for logic —
 * read deal.batchNumber / buyerId / projectName instead.
 */
function buildReference(batchNumber: number, handle: string, project: string): string {
  const slug = (s: string) =>
    s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "NA";
  return `${String(batchNumber).padStart(2, "0")}-${slug(handle)}-${slug(project)}`;
}
