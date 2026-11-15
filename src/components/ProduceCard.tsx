import React from 'react';
import { Flame, Sprout, ShoppingBag, Check } from 'lucide-react';
import { ProduceItem } from '../types';
import { buyerUnitPrice } from '../utils/pricing';

/**
 * Order rules (Buyer):
 * - Every product line in an order must be at least 20 kg.
 * - The TOTAL across all products in an order must be at least 60 kg.
 * Products stocked with less than 20 kg therefore cannot be ordered as a
 * line item, so "Add to Cart" is disabled for them.
 */
export const MIN_PRODUCT_KG = 20;
export const MIN_ORDER_KG = 60;

/**
 * Buyer-facing origin — province level only ("Negros Oriental").
 * Farmers are anonymous: no farmer names, farm names, or "(Farmer)" text.
 */
export const getBuyerOriginLabel = (): string => 'Negros Oriental';

/** "Harvested Today" shows only when the admin displayed/stocked the item today. */
export const isStockedToday = (produce: ProduceItem): boolean => {
  const ref = (produce as any).boughtAt || (produce as any).createdAt;
  if (ref) {
    const d = new Date(ref);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
  }
  return (produce.harvestStatus || '') === 'Harvested Today';
};

interface ProduceCardProps {
  produce: ProduceItem;
  onSelect: (produce: ProduceItem) => void;
  /** Buyer action: add THIS crop to the cart for later request building. */
  onAddToCart?: (produce: ProduceItem, e: React.MouseEvent) => void;
  /** Whether this crop is already in the cart (shows a check state). */
  isInCart?: boolean;
  isBuyer?: boolean;
}

export const ProduceCard: React.FC<ProduceCardProps> = ({
  produce,
  onSelect,
  onAddToCart,
  isInCart = false,
  isBuyer = true,
}) => {
  if (!produce) return null;

  const farmerPrice = typeof produce.pricePerUnit === 'number' ? produce.pricePerUnit : parseFloat(produce.pricePerUnit) || 0;
  // Buyers see the FIXED DA-anchored market price per commodity
  // (DA Suggested Direct × 1.10) — never the farmer's asking price, and never
  // changed by which farmers fulfil the order. Farmers and admin procurement
  // views (isBuyer=false) keep the raw farmgate price.
  const price = isBuyer ? buyerUnitPrice(produce) : farmerPrice;
  const stock = typeof produce.stockQuantity === 'number' ? produce.stockQuantity : parseInt(produce.stockQuantity as any, 10) || 0;
  const name = produce.name || 'Fresh Produce';
  const imageUrl = produce.imageUrl || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80';
  // Buyer view: farmer identities are hidden. "Harvested Today" appears only
  // when the admin put the item on display today — otherwise no badge at all.
  const showHarvestedToday = isBuyer ? isStockedToday(produce) : (produce.harvestStatus || '') === 'Harvested Today';
  const originLabel = getBuyerOriginLabel();
  // 20 kg per-product minimum: a shelf with less than 20 kg can never satisfy
  // the rule, so the buyer cannot order this product as a line item.
  const canOrderProduct = stock >= MIN_PRODUCT_KG;

  return (
    <div
      id={`produce-card-${produce.id}`}
      onClick={() => onSelect(produce)}
      className="group bg-white rounded-2xl border border-emerald-200/80 overflow-hidden hover:border-emerald-500 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col shadow-xs"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-emerald-50">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80';
          }}
        />

        {/* Gradient Overlay for badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Harvest Status Badge — buyers see "Harvested Today" only when the
            admin displayed the item today; no badge otherwise. Never shows
            "Fresh Picked on Order" or farmer-side statuses. */}
        {showHarvestedToday && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-xs bg-emerald-600 text-white">
              <Flame className="w-3 h-3 text-amber-300 fill-amber-300" />
              Harvested Today
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          {/* Sourcing — buyers see province-level origin only. Farmer and farm
              names are never shown to buyers (Admin is the middleman). */}
          <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-800 mb-0.5">
            <span className="truncate font-bold">
              {isBuyer ? `Fresh from ${originLabel}` : produce.farmName || 'Local Farm'}
            </span>
          </div>

          {/* Produce Name — variety hidden from buyers */}
          <h3 className="font-bold text-sm text-emerald-950 line-clamp-1 group-hover:text-emerald-700 transition-colors">
            {name}
          </h3>

          {/* Origin line for buyers — province only, farmers anonymous */}
          {isBuyer && (
            <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1.5">
              <Sprout className="w-3 h-3 text-emerald-600" />
              <span className="truncate">Farmer harvest, {originLabel}</span>
            </div>
          )}
        </div>

        {/* Pricing row — price and stock on their own line so the action
            buttons below never get squeezed out of the card border. */}
        <div className="mt-2.5 pt-2 border-t border-emerald-100">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className="text-base font-black text-emerald-950 truncate">
                ₱{price.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-500 font-medium flex-shrink-0">
                /{produce.unit || 'kg'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold flex-shrink-0">
              {stock > 0 ? `${stock} ${produce.unit || 'kg'} left` : 'Sold out'}
            </span>
          </div>

          {/* Action row — the single "Add to Cart" button spans the full card
              interior, so it lines up with the card borders identically on
              EVERY product card. Per-product "Request" buttons were removed:
              purchase requests are raised from the Cart menu ("Request Crops"). */}
          {isBuyer && (
            <div className="mt-2 flex items-stretch">
              <button
                id={`btn-add-to-cart-${produce.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAddToCart) onAddToCart(produce, e);
                }}
                disabled={!canOrderProduct || !onAddToCart}
                className={`w-full min-h-[36px] px-1 rounded-xl flex items-center justify-center gap-1 font-bold text-[10px] transition-all duration-150 active:scale-95 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                  isInCart
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                }`}
                title={
                  !canOrderProduct && stock > 0
                    ? `Needs at least ${MIN_PRODUCT_KG} kg per product — only ${stock} kg left`
                    : isInCart
                      ? 'Already in your cart — manage it in the Cart menu'
                      : 'Add to cart (20 kg minimum per product)'
                }
              >
                {isInCart ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
