/**
 * Deal references are display strings built from real fields
 * (`115-TAKA-BASECAMPFOUN`). They are never parsed for logic — read
 * `deal.batchNumber`, `deal.buyerId` and `deal.projectName` instead.
 *
 * The full string overflows in a table cell or a chat header, so it is
 * shortened for display and the whole thing is available on demand.
 */
export function shortReference(reference: string): string {
  const parts = reference.split('-');
  if (parts.length < 3) return reference;

  const [batch, who, ...project] = parts;
  // Keep the batch whole — it is what groups concurrent tickets — and clip the
  // two human-readable halves, which are the parts that run long.
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  return `${batch}-${clip(who, 6)}-${clip(project.join('-'), 8)}`;
}
