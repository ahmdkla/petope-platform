"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { updateSettings } from "./actions";
import { Button, Card, FormError, Hint, Input, Label, SectionTitle } from "@/components/ui";

type Values = {
  feePercent: number;
  feeFloorStable: number;
  feeFloorSol: number;
  refundWindowHours: number;
  collateralMinimum: number;
  maxConcurrentDeals: number;
};

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Record<keyof Values, string>>({
    feePercent: String(initial.feePercent),
    feeFloorStable: String(initial.feeFloorStable),
    feeFloorSol: String(initial.feeFloorSol),
    refundWindowHours: String(initial.refundWindowHours),
    collateralMinimum: String(initial.collateralMinimum),
    maxConcurrentDeals: String(initial.maxConcurrentDeals),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(key: keyof Values, value: string) {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateSettings({
        feePercent: Number(v.feePercent),
        feeFloorStable: Number(v.feeFloorStable),
        feeFloorSol: Number(v.feeFloorSol),
        refundWindowHours: Number(v.refundWindowHours),
        collateralMinimum: Number(v.collateralMinimum),
        maxConcurrentDeals: Number(v.maxConcurrentDeals),
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4">
          <SectionTitle>Middleman fee</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="feePercent"
              label="Percentage"
              value={v.feePercent}
              onChange={(x) => set("feePercent", x)}
              hint="Of deal amount plus collateral."
            />
            <Field
              id="refundWindowHours"
              label="Refund window (hours)"
              value={v.refundWindowHours}
              onChange={(x) => set("refundWindowHours", x)}
              hint="How long after a deal closes the fee can be refunded."
            />
            <Field
              id="feeFloorStable"
              label="Minimum fee (USDC/USDT)"
              value={v.feeFloorStable}
              onChange={(x) => set("feeFloorStable", x)}
              hint="Charged when the percentage comes out lower."
            />
            <Field
              id="feeFloorSol"
              label="Minimum fee (SOL)"
              value={v.feeFloorSol}
              onChange={(x) => set("feeFloorSol", x)}
              hint="Set by hand: there is no price feed, so this drifts as SOL moves."
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-6">
          <SectionTitle>Deals and listings</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="collateralMinimum"
              label="Minimum collateral (USDC/USDT)"
              value={v.collateralMinimum}
              onChange={(x) => set("collateralMinimum", x)}
              hint="Applies to every method that requires collateral."
            />
            <Field
              id="maxConcurrentDeals"
              label="Max concurrent deals per listing"
              value={v.maxConcurrentDeals}
              onChange={(x) => set("maxConcurrentDeals", x)}
              hint="Deals do not reserve spots until funding, so this caps competition."
            />
          </div>
        </section>

        <FormError message={error} />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save settings"}
          </Button>
          {saved ? (
            <span className="flex items-center gap-1.5 text-meta text-ok">
              <CheckCircle2 aria-hidden className="size-4" strokeWidth={2} />
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="font-mono tnum"
      />
      <Hint>{hint}</Hint>
    </div>
  );
}
