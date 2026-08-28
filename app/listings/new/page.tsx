import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = { title: "Post a listing" };

export default async function NewListingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/listings/new");

  // Prefill from the author's last listing — sellers post repeatedly.
  const last = await db.listing.findFirst({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { side: true, chain: true, payment: true, specific: true, type: true },
  });

  const chains = await db.listing.findMany({
    select: { chain: true },
    distinct: ["chain"],
    orderBy: { chain: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Post a listing"
        description="Buying and selling use the same form. The side toggle is the only difference."
      />
      <PageBody>
        <ListingForm
          knownChains={chains.map((c) => c.chain)}
          defaults={
            last
              ? {
                  side: last.side,
                  chain: last.chain,
                  payment: last.payment,
                  specific: last.specific,
                  type: last.type,
                }
              : null
          }
        />
      </PageBody>
    </AppShell>
  );
}
