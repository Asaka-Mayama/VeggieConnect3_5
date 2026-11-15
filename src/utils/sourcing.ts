// VeggieConnect sourcing engine — multi-farmer split-order allocation with
// weighted costing, margin guardrails and loss prevention.
//
// PRICING MODEL
//   buyer price (fixed per commodity) = DA Suggested Direct Price × 1.10
//   farmer cost                       = each farmer's farmgate asking price
//   admin margin                      = buyer revenue − total farmer cost
//
// The buyer price NEVER changes when several farmers with different asking
// prices fulfil one order — the farmer costs only move the admin's margin.
//
// Used by BOTH the Admin console (pre-fulfillment preview, warnings) and the
// backend (authoritative allocation at fulfillment) — keep it framework-free.
import { SourcingAllocation } from '../types';
import { buyerMarketPriceForCrop, withAdminCommission } from './pricing';

/** Markup added to the DA suggested direct price to get the buyer price. */
export const BUYER_MARKUP_RATE = 0.1;
/** Warn when a farmer's asking price leaves less than 5% margin vs buyer price. */
export const LOW_MARGIN_RATE = 0.05;

export interface SourcingLot {
  id: string;
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  cropName: string;
  farmgatePrice: number;
  availableQty: number;
  imageUrl?: string;
  /** Warehouse lots were already bought — their cost is sunk, never re-paid. */
  isWarehouse?: boolean;
}

export interface SourcingMarginFlag {
  farmerName: string;
  farmName?: string;
  farmgatePrice: number;
  buyerPrice: number;
  /** (buyer − farmgate) / buyer — negative when the sale loses money. */
  marginPercent: number;
}

export interface SourcingPlanLine {
  cropName: string;
  requestedQty: number;
  /** Fixed per-commodity buyer price used for revenue and margin checks. */
  buyerPrice: number;
  warehouseQtyUsed: number;
  allocations: SourcingAllocation[];
  totalQty: number;
  shortfallQty: number;
  /** Fresh farmer spend only (warehouse stock is already paid for). */
  totalFarmerCost: number;
  weightedAvgSourcingCost: number;
  totalBuyerRevenue: number;
  netAdminProfit: number;
  /** Allocations under 5% margin but still profitable — warning badges. */
  lowMarginWarnings: SourcingMarginFlag[];
  /** Farmer asks above the fixed buyer price — fulfillment must be blocked. */
  lossRisks: SourcingMarginFlag[];
  blocked: boolean;
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Margin a farmgate price leaves against a buyer price, as 0..1 (can be < 0). */
export function marginRate(buyerPrice: number, farmgatePrice: number): number {
  const bp = Number(buyerPrice) || 0;
  if (bp <= 0) return 0;
  return (bp - (Number(farmgatePrice) || 0)) / bp;
}

/**
 * Builds the sourcing plan for ONE order line (one crop, one quantity).
 *
 * Order of use (lowest cost first, admin behaviour preserved):
 *   1. Warehouse shelf stock (already paid for — sunk cost, no fresh spend).
 *   2. Farmer harvest lots sorted by farmgate price ASC — allocated and
 *      deducted sequentially until the requested quantity is met.
 *
 * Guardrails:
 *   • farmgate > buyer price  → lossRisks + blocked (never auto-fulfil; the
 *     admin must send a Price Adjustment Quote instead).
 *   • 0 ≤ margin < 5%         → lowMarginWarnings (proceed but flag).
 */
export function buildSourcingPlan(
  cropName: string,
  requestedQty: number,
  warehouseLots: SourcingLot[],
  farmerLots: SourcingLot[],
  overrideBuyerPrice?: number
): SourcingPlanLine {
  const name = String(cropName || '').trim();
  const need = Math.max(0, Math.floor(Number(requestedQty) || 0));

  // Buyer price priority: the order line's ACTUAL charge (override — keeps an
  // approved Price Adjustment Quote authoritative) → DA anchor → legacy
  // farmgate + 10% commission fallback from the cheapest available source.
  const override = round2(Number(overrideBuyerPrice) || 0);
  const daPrice = buyerMarketPriceForCrop(name);
  const cheapestFarmgate = [...warehouseLots, ...farmerLots]
    .map((l) => Number(l.farmgatePrice) || 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b)[0];
  const buyerPrice =
    override > 0
      ? override
      : daPrice ??
        round2(withAdminCommission(cheapestFarmgate || 0) || 0);

  const allocations: SourcingAllocation[] = [];
  let remaining = need;

  // 1. Warehouse shelf first (sunk cost — never re-pays farmers).
  const wh = warehouseLots
    .slice()
    .sort((a, b) => (Number(b.availableQty) || 0) - (Number(a.availableQty) || 0))[0];
  let warehouseQtyUsed = 0;
  if (wh && remaining > 0) {
    warehouseQtyUsed = Math.min(Math.max(0, Math.floor(Number(wh.availableQty) || 0)), remaining);
    if (warehouseQtyUsed > 0) {
      remaining -= warehouseQtyUsed;
      allocations.push({
        id: `alloc-wh-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        produceId: wh.id,
        farmerId: wh.farmerId || 'admin-main',
        farmerName: wh.farmerName || 'VeggieConnect Warehouse',
        farmName: wh.farmName || 'VeggieConnect Supermarket',
        cropName: name,
        quantity: warehouseQtyUsed,
        farmgatePrice: round2(Number(wh.farmgatePrice) || 0),
        allocatedAt: new Date().toISOString(),
        isWarehouse: true,
      });
    }
  }

  // 2. Farmer harvest lots — cheapest asking price first, sequential deduct.
  const sortedFarmerLots = farmerLots
    .filter((l) => (Number(l.availableQty) || 0) > 0)
    .slice()
    .sort((a, b) => (Number(a.farmgatePrice) || 0) - (Number(b.farmgatePrice) || 0));

  const lowMarginWarnings: SourcingMarginFlag[] = [];
  const lossRisks: SourcingMarginFlag[] = [];

  for (const lot of sortedFarmerLots) {
    if (remaining <= 0) break;
    const take = Math.min(Math.floor(Number(lot.availableQty) || 0), remaining);
    if (take <= 0) continue;
    const fg = round2(Number(lot.farmgatePrice) || 0);
    const m = marginRate(buyerPrice, fg);

    // LOSS PREVENTION: buying above the fixed buyer price would lose money on
    // every kg — the plan stops here and the admin must quote the buyer.
    if (fg > buyerPrice) {
      lossRisks.push({
        farmerName: lot.farmerName || 'Farmer',
        farmName: lot.farmName,
        farmgatePrice: fg,
        buyerPrice,
        marginPercent: Math.round(m * 10000) / 100,
      });
      break; // never skip past a loss-making lot to a cheaper one — all cheaper lots are exhausted
    }

    if (m < LOW_MARGIN_RATE) {
      lowMarginWarnings.push({
        farmerName: lot.farmerName || 'Farmer',
        farmName: lot.farmName,
        farmgatePrice: fg,
        buyerPrice,
        marginPercent: Math.round(m * 10000) / 100,
      });
    }

    allocations.push({
      id: `alloc-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}-${allocations.length}`,
      produceId: lot.id,
      farmerId: lot.farmerId,
      farmerName: lot.farmerName,
      farmName: lot.farmName,
      cropName: name,
      quantity: take,
      farmgatePrice: fg,
      allocatedAt: new Date().toISOString(),
    });
    remaining -= take;
  }

  const totalQty = allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
  const farmerQty = allocations
    .filter((a) => !a.isWarehouse)
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0);
  const totalFarmerCost = round2(
    allocations.filter((a) => !a.isWarehouse).reduce((s, a) => s + a.quantity * a.farmgatePrice, 0)
  );
  const totalBuyerRevenue = round2(buyerPrice * totalQty);
  // Weighted Average Sourcing Cost = total farmer cost ÷ total farmer-sourced kg.
  // e.g. 12kg @₱65.00 + 8kg @₱67.00 → ₱1,316.00 ÷ 20kg = ₱65.80/kg.
  const weightedAvgSourcingCost = farmerQty > 0 ? round2(totalFarmerCost / farmerQty) : 0;

  return {
    cropName: name,
    requestedQty: need,
    buyerPrice,
    warehouseQtyUsed,
    allocations,
    totalQty,
    shortfallQty: Math.max(0, need - totalQty),
    totalFarmerCost,
    weightedAvgSourcingCost,
    totalBuyerRevenue,
    netAdminProfit: round2(totalBuyerRevenue - totalFarmerCost),
    lowMarginWarnings,
    lossRisks,
    blocked: lossRisks.length > 0,
  };
}

/** Human summary of one plan line, e.g. "12kg @₱65.00 (Farmer A) + 8kg @₱67.00 (Farmer B)". */
export function describeAllocations(plan: SourcingPlanLine): string {
  return plan.allocations
    .map(
      (a) =>
        `${a.quantity}kg @₱${a.farmgatePrice.toFixed(2)} (${a.isWarehouse ? 'Warehouse' : a.farmerName || 'Farmer'})`
    )
    .join(' + ');
}
