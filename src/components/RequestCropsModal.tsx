import React, { useMemo, useState, useEffect } from 'react';
import { ClipboardList, X, Plus, Trash2, Info, ShoppingBasket, Sprout } from 'lucide-react';
import { Order, OrderItem, ProduceItem, UserProfile } from '../types';
import { buyerUnitPrice, farmerUnitPrice } from '../utils/pricing';
import { MIN_PRODUCT_KG, MIN_ORDER_KG } from './ProduceCard';

interface RequestCropsModalProps {
  isOpen: boolean;
  /** Market crop to pre-fill the request with (from a product-level request tap). */
  presetProduct: ProduceItem | null;
  preferredQty?: number;
  /** Available Market products — the request options mirror the Market menu. */
  produceList: ProduceItem[];
  currentUser: UserProfile | null;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
}

interface RequestLine {
  produceId: string;
  quantity: number;
}

/**
 * Buyer Vegetable Purchase Request — opened from the Cart menu's "Request
 * Crops" button (and pre-filled from product-level request taps). The buyer
 * picks vegetables FROM THE MARKET LISTING and states how many kg they need;
 * the Admin reviews, fulfils from farmer sourcing, and the stock is deducted
 * when the Admin fulfils the request (request-lot items `req-prod-*`).
 */
export const RequestCropsModal: React.FC<RequestCropsModalProps> = ({
  isOpen,
  presetProduct,
  preferredQty,
  produceList,
  currentUser,
  onClose,
  onOrderPlaced,
}) => {
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [pickupSlot, setPickupSlot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only crops actually available on the Market shelf can be requested.
  const availableProduce = useMemo(
    () =>
      (produceList || []).filter(
        (p) =>
          (Number(p.stockQuantity) || 0) > 0 &&
          p.sellerStatus !== 'sold_out' &&
          p.sellerStatus !== 'archived'
      ),
    [produceList]
  );

  // Fresh state each time the modal opens; pre-fill the preset product tap.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSubmitting(false);
    setBuyerName(currentUser?.name || '');
    setBuyerPhone(currentUser?.phone || '');
    if (presetProduct) {
      const cap = Math.max(MIN_PRODUCT_KG, Math.floor(Number(presetProduct.stockQuantity) || 0));
      setLines([{ produceId: presetProduct.id, quantity: Math.min(preferredQty || MIN_PRODUCT_KG, cap) }]);
    } else {
      setLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetProduct, preferredQty]);

  if (!isOpen) return null;

  const produceById = (id: string) => availableProduce.find((p) => p.id === id);

  const addLine = () => {
    const first = availableProduce.find((p) => !lines.some((l) => l.produceId === p.id));
    if (!first) {
      setError('Every available market vegetable is already on this request.');
      return;
    }
    setError(null);
    setLines((prev) => [...prev, { produceId: first.id, quantity: MIN_PRODUCT_KG }]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const updateLine = (index: number, patch: Partial<RequestLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setError(null);
  };

  // Money view — buyers always see the fixed Market price per crop.
  const lineTotal = (l: RequestLine) => {
    const prod = produceById(l.produceId);
    if (!prod) return 0;
    return Math.round(buyerUnitPrice(prod) * l.quantity * 100) / 100;
  };

  const totalKg = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const subtotal = Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
  const deliveryFee = 0;
  const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;
  const farmgateCostTotal =
    Math.round(
      lines.reduce((s, l) => {
        const prod = produceById(l.produceId);
        return s + (prod ? farmerUnitPrice(prod) * (Number(l.quantity) || 0) : 0);
      }, 0) * 100
    ) / 100;
  const adminCommissionTotal = Math.round((subtotal - farmgateCostTotal) * 100) / 100;

  const productsBelowMin = lines.filter((l) => (Number(l.quantity) || 0) < MIN_PRODUCT_KG);
  const meetsPerProductMin = productsBelowMin.length === 0;
  const meetsTotalMin = totalKg >= MIN_ORDER_KG;

  const handleSubmit = () => {
    if (lines.length === 0) {
      setError('Add at least one vegetable to your request.');
      return;
    }
    if (!meetsPerProductMin) {
      setError(
        `Each vegetable must be at least ${MIN_PRODUCT_KG} kg — ${productsBelowMin
          .map((l) => produceById(l.produceId)?.name || 'item')
          .join(', ')} ${productsBelowMin.length === 1 ? 'is' : 'are'} below the minimum.`
      );
      return;
    }
    if (!meetsTotalMin) {
      setError(
        `Minimum request is ${MIN_ORDER_KG} kg in total — your request currently totals ${totalKg} kg. Add ${(MIN_ORDER_KG - totalKg).toFixed(0)} more kg to reach the minimum.`
      );
      return;
    }
    const trimmedName = buyerName.trim();
    const trimmedPhone = buyerPhone.trim();
    const trimmedPickupSlot = pickupSlot.trim();
    if (!trimmedName) {
      setError('Please enter your Name so the Admin knows who submitted this request.');
      return;
    }
    if (!trimmedPhone) {
      setError('Please enter your Mobile Phone number for order updates.');
      return;
    }
    if (!trimmedPickupSlot) {
      setError('Please type your preferred Pickup Time / Delivery Slot (e.g., Today at 3:00 PM).');
      return;
    }

    setIsSubmitting(true);
    const stamp = Date.now();
    const orderItems: OrderItem[] = lines.map((l, i) => {
      const prod = produceById(l.produceId);
      // farmgateUnitPrice = Admin's cost basis only; the buyer line stays at
      // the fixed DA-anchored market price.
      const farmgateUnit = prod ? farmerUnitPrice(prod) : 0;
      const marketUnit = buyerUnitPrice(prod);
      return {
        // Request-lot marker: the server deducts these from the shelf when
        // the Admin FULFILS the request, not when the request is submitted.
        produceId: `req-prod-${stamp}-${i}`,
        produceName: prod?.name || 'Vegetable',
        imageUrl: prod?.imageUrl || '',
        unitPrice: marketUnit,
        pricePerUnit: marketUnit,
        farmgateUnitPrice: farmgateUnit,
        unit: prod?.unit || 'kg',
        quantity: Number(l.quantity) || 0,
        farmName: 'VeggieConnect Central Market',
        farmerId: 'admin-main',
      };
    });

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
      deliveryFee,
      totalAmount,
      farmgateCostTotal,
      adminCommissionTotal,
      status: 'pending',
      createdAt: new Date().toISOString(),
      farmerId: 'admin-main',
      farmName: 'VeggieConnect Central Market',
      paymentMethod: 'Over-the-Counter Cash at Depot',
      notes: `Buyer Crop Request from the Cart menu — ${orderItems.length} vegetable line(s), Admin fulfils from farmer sourcing.`,
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onOrderPlaced(newOrder);
      onClose();
    }, 450);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 animate-in fade-in duration-200">
      <div
        id="request-crops-modal"
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-h-[92%] overflow-y-auto shadow-2xl flex flex-col text-neutral-900 border-t sm:border border-neutral-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold bg-emerald-100 text-emerald-800">
              <ClipboardList className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 font-display">Request Crops</h3>
              <p className="text-[10px] text-emerald-700 font-medium">
                Tell the Admin what you need — choose from the Market's available vegetables
              </p>
            </div>
          </div>
          <button
            id="btn-close-request-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Request lines */}
          {lines.length === 0 ? (
            <div className="text-center py-6 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
              <Sprout className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-emerald-900">No vegetables added yet</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Tap “Add Vegetable” to choose from the Market's available crops.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const prod = produceById(line.produceId);
                if (!prod) return null;
                const stock = Math.floor(Number(prod.stockQuantity) || 0);
                return (
                  <div
                    key={line.produceId + idx}
                    className="bg-neutral-50/90 border border-neutral-200 rounded-2xl p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">
                          Choose a Vegetable
                        </label>
                        <select
                          value={line.produceId}
                          onChange={(e) => {
                            const next = produceById(e.target.value);
                            updateLine(idx, {
                              produceId: e.target.value,
                              quantity: Math.min(line.quantity, Math.max(MIN_PRODUCT_KG, Math.floor(Number(next?.stockQuantity) || 0))),
                            });
                          }}
                          className="w-full min-h-[42px] bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-sm font-bold text-neutral-900 focus:outline-none focus:border-emerald-600"
                        >
                          {availableProduce.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — ₱{buyerUnitPrice(p).toFixed(2)}/kg ({Math.floor(Number(p.stockQuantity) || 0)} kg available)
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeLine(idx)}
                        className="mt-5 w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center hover:bg-rose-100 transition-colors cursor-pointer flex-shrink-0"
                        title="Remove this vegetable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">
                          Quantity needed (kg) — min {MIN_PRODUCT_KG}
                        </label>
                        <input
                          type="number"
                          min={MIN_PRODUCT_KG}
                          step="1"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(idx, {
                              quantity: Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, stock)),
                            })
                          }
                          className="w-full min-h-[42px] bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-sm font-extrabold text-neutral-900 focus:outline-none focus:border-emerald-600"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">
                          {stock} kg on the shelf • fixed Market price ₱{buyerUnitPrice(prod).toFixed(2)}/kg
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 mt-5">
                        <p className="text-[10px] font-bold text-neutral-500 uppercase">Line total</p>
                        <p className="text-sm font-black text-emerald-800">₱{lineTotal(line).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            id="btn-request-add-line"
            onClick={addLine}
            className="w-full min-h-[44px] rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-800 font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-50/70 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vegetable</span>
          </button>

          {/* Running totals + min rules */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900">Total quantity</span>
              <span className={`font-black ${meetsTotalMin ? 'text-emerald-800' : 'text-amber-700'}`}>
                {totalKg} kg / min {MIN_ORDER_KG} kg
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900">Estimated total</span>
              <span className="font-black text-emerald-800">₱{totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-neutral-500 flex items-start gap-1.5 pt-0.5">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>
                Final billing is confirmed by the Admin when the request is fulfilled — each
                product needs at least {MIN_PRODUCT_KG} kg and the whole request at least{' '}
                {MIN_ORDER_KG} kg.
              </span>
            </p>
          </div>

          {/* Buyer details */}
          <div className="grid grid-cols-1 gap-2.5">
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Your name"
              className="w-full min-h-[44px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:border-emerald-600"
            />
            <input
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="Mobile phone number"
              inputMode="tel"
              className="w-full min-h-[44px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:border-emerald-600"
            />
            <input
              value={pickupSlot}
              onChange={(e) => setPickupSlot(e.target.value)}
              placeholder="Preferred pickup / delivery slot (e.g., Today at 3:00 PM)"
              className="w-full min-h-[44px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {error && (
            <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            id="btn-submit-request-crops"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full min-h-[50px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting request…</span>
              </>
            ) : (
              <>
                <ShoppingBasket className="w-4 h-4" />
                <span>Submit Crop Request ({totalKg} kg • ₱{totalAmount.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
