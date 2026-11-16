// ── Order-level bulk discount ────────────────────────────────────────────────
// A buyer whose ORDER reaches 90 kg of produce (summed across every line —
// different products add up together) gets ₱100 off at checkout. Enforced on
// the server as the source of truth and mirrored in the two buyer checkouts
// (Central Market cart + Request Crops) so the buyer sees it before paying.
export const BULK_DISCOUNT_MIN_KG = 90;
export const BULK_DISCOUNT_PESOS = 100;

/** Total kg across order lines (kg lines only — bunch/bundle units don't count). */
export function orderKgTotal(items: { quantity?: number; unit?: string }[] | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const unit = String(it?.unit || 'kg').toLowerCase();
    return unit === 'kg' ? sum + (Number(it?.quantity) || 0) : sum;
  }, 0);
}

/** ₱100 when the order carries at least 90 kg, otherwise ₱0. */
export function computeBulkDiscount(items: { quantity?: number; unit?: string }[] | undefined): number {
  return orderKgTotal(items) >= BULK_DISCOUNT_MIN_KG ? BULK_DISCOUNT_PESOS : 0;
}
