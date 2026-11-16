import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Store,
  Truck,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Calendar,
  User,
  Phone,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { CartItem, Order, OrderItem, UserProfile } from '../types';
import { farmerUnitPrice, buyerUnitPrice } from '../utils/pricing';
import { MIN_ORDER_KG, MIN_PRODUCT_KG } from './ProduceCard';
import { BULK_DISCOUNT_MIN_KG, computeBulkDiscount } from '../utils/bulkDiscount';

interface CartDrawerProps {
  cart: CartItem[];
  currentUser?: UserProfile | null;
  /** DA verification workflow: PENDING buyers cannot place orders yet. */
  verificationPending?: boolean;
  onUpdateQuantity: (produceId: string, quantity: number) => void;
  onRemoveItem: (produceId: string) => void;
  onClearCart: () => void;
  onOrderPlaced: (order: Order) => void;
  onClose: () => void;
  /** Opens the Vegetable Purchase Request modal (moved here from the Market). */
  onRequestCrops: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  cart,
  currentUser,
  verificationPending = false,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderPlaced,
  onClose,
  onRequestCrops,
}) => {
  // ── Order rules ─────────────────────────────────────────────────────
  // 1) TOTAL minimum: every product's kg is summed and the total must be
  //    at least 60 kg (single or multi-product orders alike).
  // 2) PER-PRODUCT minimum: each product in the order must be at least
  //    20 kg on its own.
  const [buyerName, setBuyerName] = useState(currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [pickupSlot, setPickupSlot] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name && !buyerName) setBuyerName(currentUser.name);
      if (currentUser.phone && !buyerPhone) setBuyerPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Subtotal calculation — buyers pay the FIXED DA-anchored market price per
  // commodity (DA Suggested Direct × 1.10); wholesale discount applies on top.
  const subtotal = cart.reduce((sum, item) => {
    const marketUnit = buyerUnitPrice(item.produce);
    const unitPrice =
      item.produce.bulkDiscount && item.quantity >= item.produce.bulkDiscount.minQty
        ? Math.round(marketUnit * (1 - item.produce.bulkDiscount.discountPercent / 100) * 100) / 100
        : marketUnit;
    return sum + unitPrice * item.quantity;
  }, 0);

  // Order-level bulk discount: 90 kg or more in ONE order (any mix of
  // products) earns ₱100 off the direct payment. The server re-checks this
  // and remains the source of truth.
  const bulkDiscount = computeBulkDiscount(
    cart.map((item) => ({ quantity: item.quantity, unit: item.produce?.unit }))
  );
  const totalAmount = Math.max(0, Math.round((subtotal - bulkDiscount) * 100) / 100);

  // Total kg across ALL products in the cart — the 60 kg minimum applies to
  // this SUM, so buying more than one product works as long as the combined
  // kg reaches the threshold.
  const totalCartKg = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const meetsTotalMin = totalCartKg >= MIN_ORDER_KG;

  // Per-product rule: every product line must carry at least 20 kg.
  const productsBelowMin = cart.filter((item) => (item.quantity || 0) < MIN_PRODUCT_KG);
  const meetsPerProductMin = productsBelowMin.length === 0;
  const meetsMinOrder = meetsTotalMin && meetsPerProductMin;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setErrorMessage(null);

    // ── DA verification gate: PENDING buyers cannot place orders ──────
    if (verificationPending) {
      setErrorMessage(
        'Pending Admin Approval: your Valid Government ID is still under DA review. You can browse the market and prepare your cart — placing vegetable orders unlocks once the DA Admin approves your registration.'
      );
      return;
    }

    // ── Per-product gate: EACH product must be at least 20 kg ────────
    if (!meetsPerProductMin) {
      setErrorMessage(
        `Each product must be at least ${MIN_PRODUCT_KG} kg — ${productsBelowMin
          .map((item) => `${item.produce.name} (${item.quantity} kg)`)
          .join(', ')} ${productsBelowMin.length === 1 ? 'is' : 'are'} below the minimum. Raise the quantity or remove the product.`
      );
      return;
    }

    // ── Total gate: 60 kg across ALL products ────────────────────────
    if (!meetsTotalMin) {
      setErrorMessage(
        `Minimum order is ${MIN_ORDER_KG} kg in total — your cart currently totals ${totalCartKg} kg. Add ${(MIN_ORDER_KG - totalCartKg).toFixed(0)} more kg (either more of the same product or another product) to reach the minimum.`
      );
      return;
    }

    const trimmedName = buyerName.trim();
    const trimmedPhone = buyerPhone.trim();
    const trimmedPickupSlot = pickupSlot.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter your Name so the Admin knows who submitted this purchase request.');
      return;
    }

    if (!trimmedPhone) {
      setErrorMessage('Please enter your Mobile Phone number for order updates.');
      return;
    }

    if (!trimmedPickupSlot) {
      setErrorMessage('Please type your preferred Pickup Time / Delivery Slot (e.g., Today at 3:00 PM).');
      return;
    }

    setIsSubmitting(true);

    const orderItems: OrderItem[] = cart.map((item) => {
      const farmgateUnit = farmerUnitPrice(item.produce);
      // Buyer pays the FIXED DA-anchored market price per commodity
      // (DA Suggested Direct × 1.10); the wholesale discount, when active,
      // applies on that market price. farmgateUnitPrice is kept only as the
      // Admin's cost basis for margins — it never changes the buyer's price.
      const marketUnit = buyerUnitPrice(item.produce);
      const paidUnit =
        item.produce.bulkDiscount && item.quantity >= item.produce.bulkDiscount.minQty
          ? Math.round(marketUnit * (1 - item.produce.bulkDiscount.discountPercent / 100) * 100) / 100
          : marketUnit;
      return {
        produceId: item.produce.id,
        produceName: item.produce.name,
        imageUrl: item.produce.imageUrl,
        unitPrice: paidUnit,
        pricePerUnit: paidUnit,
        farmgateUnitPrice: farmgateUnit,
        unit: item.produce.unit || 'kg',
        quantity: item.quantity,
        farmName: 'VeggieConnect Central Market',
        farmerId: 'admin-main',
      };
    });

    // Admin commission per kg = market price − farmer asking price.
    const farmgateCostTotal = Math.round(orderItems.reduce((s, it) => s + (it.farmgateUnitPrice || 0) * (it.quantity || 0), 0) * 100) / 100;
    const adminCommissionTotal = Math.round((subtotal - farmgateCostTotal) * 100) / 100;

    // Buyer Request: Buyer submits a request/order to the Admin detailing vegetables & quantities
    const newOrder: Order = {
      id: `VC-REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      buyerId: currentUser?.id || 'user-buyer-1',
      buyerName: trimmedName,
      buyerPhone: trimmedPhone,
      sellerStoreName: 'VeggieConnect Central Market',
      brokerHubName: 'VeggieConnect Central Market',
      deliveryType: 'farm_pickup',
      pickupSlot: trimmedPickupSlot,
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      totalAmount,
      bulkDiscount,
      farmgateCostTotal,
      adminCommissionTotal,
      status: 'pending', // Buyer Request Submitted, waiting for Admin Processing
      createdAt: new Date().toISOString(),
      farmerId: 'admin-main',
      farmName: 'VeggieConnect Central Market',
      paymentMethod: 'Over-the-Counter Cash at Depot',
      notes: `Buyer Purchase Request detailing ${orderItems.length} vegetable item(s) for Admin inventory verification and fulfillment.`,
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onOrderPlaced(newOrder);
      onClearCart();
    }, 450);
  };

  return (
    <div className="flex flex-col min-h-full bg-emerald-50/40 p-3.5 relative">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3 mb-3.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
            <ShoppingBag className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-emerald-950 font-display">
              Vegetable Purchase Request ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </h2>
            <p className="text-[10px] text-emerald-700 font-bold">
              Review your basket before submitting to the Admin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Request Crops — the purchase request trigger lives in the Cart
              menu now (moved out of the Market header). */}
          <button
            id="btn-request-crops-cart"
            onClick={onRequestCrops}
            className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="Open the Vegetable Purchase Request form"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Request Crops</span>
          </button>
          {cart.length > 0 && (
            <button
              id="btn-clear-cart"
              onClick={onClearCart}
              className="min-h-[36px] px-2.5 py-1 text-xs text-neutral-500 hover:text-red-600 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 my-auto bg-white border border-emerald-100 rounded-3xl shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl">
            🧺
          </div>
          <h3 className="text-base font-bold text-emerald-950 font-display">Your Basket is Empty</h3>
          <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
            Browse available vegetables in the catalog and add the specific vegetables and quantities you want to request, or submit a purchase request straight to the Admin.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[240px]">
            <button
              id="btn-request-crops-empty"
              onClick={onRequestCrops}
              className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Request Crops</span>
            </button>
            <button
              id="btn-explore-harvests-empty"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
            >
              Explore Vegetable Catalog
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-3.5 pb-4 flex-1">
          {/* Items listed under VeggieConnect Central Market (Farmer identities anonymous) */}
          <div className="bg-white border border-emerald-200/85 rounded-2xl p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-900">
                <Store className="w-4 h-4 text-emerald-700" />
                <span>VeggieConnect Central Market • Negros Oriental</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                Admin Fulfillment
              </span>
            </div>

            <div className="space-y-2.5">
              {cart.map(({ produce, quantity }) => {
                const bulkActive = Boolean(produce.bulkDiscount && quantity >= produce.bulkDiscount.minQty);
                const marketUnit = buyerUnitPrice(produce);
                const itemUnitPrice = bulkActive
                  ? Math.round(marketUnit * (1 - produce.bulkDiscount!.discountPercent / 100) * 100) / 100
                  : marketUnit;
                const lineTotal = (itemUnitPrice * quantity).toFixed(2);

                return (
                  <div
                    key={produce.id}
                    className="flex items-center justify-between gap-3 text-xs bg-emerald-50/50 p-2 rounded-xl border border-emerald-200/70"
                  >
                      <img
                        src={produce.imageUrl}
                        alt={produce.name}
                        className="w-12 h-12 rounded-xl object-cover bg-emerald-100 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-emerald-950 truncate text-xs">{produce.name}</h4>
                        <div className="text-[11px] text-neutral-500 font-medium mt-0.5">
                          ₱{itemUnitPrice.toFixed(2)} / kg
                          {bulkActive && (
                            <span className="ml-1.5 text-emerald-700 text-[10px] font-bold">
                              ({produce.bulkDiscount!.discountPercent}% Wholesale)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper — cannot go below the 20 kg
                          per-product minimum; use the trash button to remove */}
                      <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-xl p-0.5 shadow-2xs">
                        <button
                          onClick={() => {
                            if (quantity <= MIN_PRODUCT_KG) {
                              return; // 20 kg per-product minimum — remove via trash instead
                            }
                            onUpdateQuantity(produce.id, quantity - 1);
                          }}
                          disabled={quantity <= MIN_PRODUCT_KG}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 text-emerald-900 font-bold cursor-pointer"
                          title={`Minimum ${MIN_PRODUCT_KG} kg per product`}
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <span className="w-6 text-center font-extrabold text-emerald-950 text-xs">{quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(produce.id, quantity + 1)}
                          disabled={quantity >= produce.stockQuantity}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 text-emerald-900 font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Remove product line entirely */}
                      <button
                        onClick={() => onRemoveItem(produce.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
                        title={`Remove ${produce.name} from your cart`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-16 text-right font-black text-emerald-900 text-xs">
                        ₱{lineTotal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          {/* Minimum Order Progress: the cart must total at least 60 kg
              across ALL products (sum of every product's kg), and each
              product must be at least 20 kg on its own. */}
          <div className={`rounded-2xl p-3 border space-y-2 shadow-xs ${meetsMinOrder ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className={meetsMinOrder ? 'text-emerald-900' : 'text-amber-900'}>
                Minimum Order: {MIN_ORDER_KG} kg total • {MIN_PRODUCT_KG} kg per product
              </span>
              <span className={meetsMinOrder ? 'text-emerald-700' : 'text-amber-700'}>
                {meetsTotalMin ? '✓ Total reached' : `${Math.max(0, MIN_ORDER_KG - totalCartKg).toFixed(0)} kg to go`}
              </span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-neutral-200">
              <div
                className={`h-full rounded-full transition-all ${meetsTotalMin ? 'bg-emerald-600' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (totalCartKg / MIN_ORDER_KG) * 100)}%` }}
              />
            </div>
            <p className={`text-[10px] font-semibold ${meetsMinOrder ? 'text-emerald-700' : 'text-amber-700'}`}>
              {meetsMinOrder
                ? `✓ Total ${totalCartKg} kg — minimum order met (${cart.length} product${cart.length === 1 ? '' : 's'}, each ≥ ${MIN_PRODUCT_KG} kg).`
                : `Currently ${totalCartKg} kg across ${cart.length} product${cart.length === 1 ? '' : 's'} — all product kg are added together and the total must reach ${MIN_ORDER_KG} kg, with every product at ${MIN_PRODUCT_KG} kg or more.`}
            </p>
            {!meetsPerProductMin && (
              <p className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-xl px-2.5 py-1.5">
                ⚠ Below {MIN_PRODUCT_KG} kg: {productsBelowMin.map((item) => `${item.produce.name} (${item.quantity} kg)`).join(', ')} — raise the quantity{cart.some((i) => (i.quantity || 0) < MIN_PRODUCT_KG && (i.produce.stockQuantity || 0) < MIN_PRODUCT_KG) ? ' or remove products stocked under 20 kg' : ''}.
              </p>
            )}
          </div>

          {/* Fulfillment Option */}
          <div className="bg-white border border-emerald-200/85 rounded-2xl p-3.5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-700" />
              1. Fulfillment Option
            </h4>
            
            <div className="p-3 bg-emerald-50 border border-emerald-600 rounded-xl text-xs space-y-1 text-emerald-950 font-bold ring-1 ring-emerald-600">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-950">Store Depot Pickup</span>
                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                  FREE PICKUP
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 font-normal">
                Pick up and pay physically at the VeggieConnect Central Supermarket Store Depot.
              </p>
            </div>

            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs space-y-1.5">
              <label className="flex items-center gap-1 text-emerald-900 font-bold">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Pickup Time Window
              </label>
              <input
                type="text"
                value={pickupSlot}
                onChange={(e) => setPickupSlot(e.target.value)}
                placeholder="Type preferred pickup time (e.g. Today at 3:00 PM or Tomorrow 10 AM)"
                className="w-full min-h-[44px] bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-medium"
              />
            </div>
          </div>

          {/* Buyer Details */}
          <div className="bg-white border border-emerald-200/85 rounded-2xl p-3.5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              2. Buyer Contact Information
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-700" /> Full Name / Business Name
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter your name (e.g. Maria Santos)"
                  className="w-full min-h-[44px] bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" /> Mobile / GCash Number
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="0917 123 4567"
                  className="w-full min-h-[44px] bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white border border-emerald-200/85 rounded-2xl p-3.5 space-y-2 text-xs shadow-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Produce Subtotal</span>
              <span className="text-emerald-950 font-bold">₱{subtotal.toFixed(2)}</span>
            </div>
            {bulkDiscount > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span className="font-bold">Bulk Discount (90 kg+)</span>
                <span className="font-black">−₱{bulkDiscount.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-neutral-500">
                <span>Bulk Discount (90 kg+)</span>
                <span>
                  add {Math.ceil(BULK_DISCOUNT_MIN_KG - totalCartKg)} kg more for −₱100
                </span>
              </div>
            )}
            <div className="border-t border-emerald-100 pt-2 flex justify-between text-sm font-black text-emerald-950">
              <span>Total Direct Payment</span>
              <span className="text-emerald-700 font-black">₱{totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium pt-1 border-t border-dashed border-emerald-100">
              💳 Payment: Over-the-Counter Physical Cash upon Pickup at Store Depot.
            </p>
          </div>

          {/* Pending verification notice — order placement locked while the
              DA Admin reviews the buyer's Valid Government ID. */}
          {verificationPending && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-black">Pending Admin Approval — ordering locked</p>
                <p className="text-[10px] leading-relaxed mt-0.5">
                  Your Valid Government ID is under DA review. Preparing your cart is fine, but the Submit Purchase Request button unlocks once the DA Admin approves your registration.
                </p>
              </div>
            </div>
          )}

          {/* Error Message if any */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sticky Bottom Order Bar */}
          <div className="sticky bottom-0 -mx-3.5 -mb-3.5 mt-2 bg-white/95 backdrop-blur-md border-t border-emerald-200/90 p-4 z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 block tracking-wider">
                  Total Direct Payment
                </span>
                <div className="text-xl font-black text-emerald-950">
                  ₱{totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-500 block">Fulfillment</span>
                <span className="text-xs font-bold text-emerald-800">
                  Store Depot Pickup
                </span>
              </div>
            </div>

            <button
              id="btn-confirm-direct-order"
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0 || !meetsMinOrder}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting Request to Admin...
                </span>
              ) : verificationPending ? (
                <>
                  <span>Locked — Pending Admin Approval</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              ) : cart.length > 0 && !meetsPerProductMin ? (
                <>
                  <span>Each product needs {MIN_PRODUCT_KG} kg or more</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              ) : cart.length > 0 && !meetsTotalMin ? (
                <>
                  <span>Need {(MIN_ORDER_KG - totalCartKg).toFixed(0)} more kg to submit</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              ) : (
                <>
                  <span>Submit Purchase Request to Admin • ₱{totalAmount.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
