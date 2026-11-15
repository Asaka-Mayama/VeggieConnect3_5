// Order date grouping + money helpers shared by the Farmer and Admin order
// ledgers. Transactions are grouped per calendar day so the farmer can read
// "total sales for the selected date" and the admin can split buyer sales
// from farmer-procurement cost on every date.
import { Order, orderPayable } from '../types';

/** Bucket key for orders whose creation timestamp is missing/unparsable. */
export const UNRECORDED_DATE_KEY = 'no-date';

/** Local YYYY-MM-DD key for an order timestamp ('no-date' when unusable). */
export function getOrderDateKey(createdAt?: string): string {
  if (!createdAt) return UNRECORDED_DATE_KEY;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) {
    // ISO dates parse reliably; anything else (e.g. 'Just now') is unrecorded.
    return UNRECORDED_DATE_KEY;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Chip label for a date key — 'Nov 14'. */
export function formatDateKeyShort(key: string): string {
  if (key === UNRECORDED_DATE_KEY) return 'No Date';
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return key;
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

/** Section header label for a date key — 'November 14, 2026'. */
export function formatDateKeyLabel(key: string): string {
  if (key === UNRECORDED_DATE_KEY) return 'Unrecorded Date';
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return key;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** 'Nov 14, 2026, 3:05 PM' — empty string when the order has no real date. */
export function formatOrderDateTime(createdAt?: string): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${formatDateKeyShort(getOrderDateKey(createdAt))}, ${d.getFullYear()}, ${time}`;
}

/** Newest day first; the 'no-date' bucket always sorts last. */
export function sortDateKeysDesc(keys: string[]): string[] {
  return keys.slice().sort((a, b) => {
    if (a === UNRECORDED_DATE_KEY && b !== UNRECORDED_DATE_KEY) return 1;
    if (b === UNRECORDED_DATE_KEY && a !== UNRECORDED_DATE_KEY) return -1;
    if (a === b) return 0;
    return a < b ? 1 : -1;
  });
}

/** What the buyer pays for this order (total minus refunded unavailable lines). */
export function orderAmount(order: Order): number {
  if (!order) return 0;
  if (order.refundedTotal !== undefined) return orderPayable(order);
  return Math.round((Number(order.totalAmount ?? order.subtotal) || 0) * 100) / 100;
}

/** What the Admin pays farmers for a procurement (TX-ADM) transaction. */
export function orderFarmgateCost(order: Order): number {
  if (!order) return 0;
  const stored = Number(order.farmgateCostTotal);
  if (isFinite(stored) && stored > 0) return Math.round(stored * 100) / 100;
  const itemCost = (order.items || []).reduce(
    (s, it) => s + (Number(it.farmgateUnitPrice) || 0) * (Number(it.quantity) || 0),
    0
  );
  if (itemCost > 0) return Math.round(itemCost * 100) / 100;
  return Math.round((Number(order.subtotal) || 0) * 100) / 100;
}

/**
 * Farmer-procurement transactions (Admin buying from farmers): TX-ADM-* ids,
 * the admin desk as buyer, or a buyer literally named like the admin desk.
 * Mirrors the server's own classification in POST /api/orders.
 */
export function isFarmerProcurementOrder(order: Order): boolean {
  if (!order) return false;
  const id = String(order.id || '');
  if (id.startsWith('TX-ADM-')) return true;
  if (order.buyerId === 'admin-main') return true;
  const name = String(order.buyerName || '').toLowerCase();
  return name.includes('admin');
}
