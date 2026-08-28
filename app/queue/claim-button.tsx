"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runTransition } from "@/app/deals/[id]/actions";
import { Button } from "@/components/ui";

export function ClaimButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function claim() {
    setError(null);
    startTransition(async () => {
      const res = await runTransition(dealId, "claim");
      // A lost race (another middleman claimed first) surfaces here as an
      // ordinary message rather than a crash.
      if (!res.ok) setError(res.error);
      else router.push(`/deals/${dealId}`);
    });
  }

  return (
    <div className="text-right">
      <Button pending={pending} onClick={claim}>
        {pending ? "Claiming…" : "Claim"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1.5 max-w-48 text-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
