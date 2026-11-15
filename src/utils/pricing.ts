// VeggieConnect pricing model — DA-anchored buyer market prices.
//
// BUYER PRICE (fixed per commodity):
//   buyer_price = DA Suggested Direct Price × 1.10
//   e.g. Ampalaya: DA suggested direct ₱65.00/kg → buyer pays ₱71.50/kg,
//   which stays under the ₱80.00/kg wet-market retail price.
// The buyer price is anchored to the DA bulletin and stays FIXED no matter
// which farmers (and which farmgate asking prices) fulfil the order — farmer
// costs only move the Admin's margin, never the buyer's price.
//
// Farmers always keep their full farmgate asking price — it is shown untouched
// on the farmer's own dashboard and in admin procurement flows. For crops that
// match no DA bulletin commodity, the legacy rule applies: farmgate + 10%
// admin commission.
import { findMatchingDAPrice } from '../data/daPricesData';

/** Markup added on top of the DA suggested direct price (10%). */
export const ADMIN_COMMISSION_RATE = 0.1;

/** Parses a price that may arrive as a number or a MySQL DECIMAL string. */
export function parseUnitPrice(value: unknown): number {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? ''));
  return isFinite(parsed) ? parsed : 0;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** DA Suggested Direct Price → fixed buyer market price (× 1.10, centavos). */
export function withDAMarkup(suggestedDirectPrice: number): number {
  return round2(parseUnitPrice(suggestedDirectPrice) * (1 + ADMIN_COMMISSION_RATE));
}

/**
 * Fixed buyer market price for a crop, anchored to the DA bulletin.
 * Returns null when the crop matches no DA commodity — callers fall back to
 * the legacy farmgate + 10% commission behaviour.
 */
export function buyerMarketPriceForCrop(cropName: string): number | null {
  const da = findMatchingDAPrice(String(cropName || ''));
  if (!da || !(parseUnitPrice(da.suggestedDirectFarmPrice) > 0)) return null;
  return withDAMarkup(da.suggestedDirectFarmPrice);
}

/**
 * Legacy fallback: farmgate asking price + Admin commission. Still used for
 * crops the DA bulletin does not cover.
 */
export function withAdminCommission(farmerPrice: number): number {
  return round2(parseUnitPrice(farmerPrice) * (1 + ADMIN_COMMISSION_RATE));
}

/**
 * Per-kg price a buyer sees in the Market for a listed crop.
 * DA-anchored and FIXED per commodity — independent of this listing's
 * farmgate asking price.
 */
export function buyerUnitPrice(produce: { name?: string; pricePerUnit: unknown } | null | undefined): number {
  if (!produce) return 0;
  const daAnchored = buyerMarketPriceForCrop(String(produce.name || ''));
  if (daAnchored !== null) return daAnchored;
  return withAdminCommission(parseUnitPrice(produce.pricePerUnit));
}

/** The farmer's own asking price (no commission) — used for payouts. */
export function farmerUnitPrice(produce: { pricePerUnit: unknown } | null | undefined): number {
  if (!produce) return 0;
  return parseUnitPrice(produce.pricePerUnit);
}
