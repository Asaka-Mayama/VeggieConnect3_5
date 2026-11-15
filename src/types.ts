export type UserRole = 'buyer' | 'farmer' | 'admin' | 'transporter';

/** DA Admin verification workflow. Every new Farmer/Buyer account starts
 *  'Pending' — approval by the DA Admin Console unlocks full transactional
 *  access (farmers may submit harvests, buyers may place orders). */
export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone: string;
  role: UserRole;
  location: string;
  latitude?: number;
  longitude?: number;
  farmName?: string;
  avatar?: string;
  verified?: boolean;
  status?: 'active' | 'pending' | 'suspended';
  bio?: string;
  isOnline?: boolean;
  lastActive?: string;
  vehicleType?: string;
  plateNumber?: string;
  /** VeggieConnect Pay wallet balance in pesos (buyers top this up via Deposit). */
  walletBalance?: number;
  /** Wallet ledger — deposits, order payments and refunds (newest last). */
  walletTransactions?: WalletTransaction[];
  /** DA verification queue state — 'Pending' right after signup. */
  verificationStatus?: VerificationStatus;
  /** When the registration was submitted (Admin queue sorting). */
  submittedAt?: string;
  /** REQUIRED at signup for both roles — reviewed by the DA Admin. */
  validIdImage?: string;
  /** Farmer only, OPTIONAL — RSBSA registry number (e.g. 07-46-10-001-000001). */
  rsbsaNumber?: string;
  /** Buyer only, OPTIONAL — Barangay Clearance / DTI / Business Permit photo. */
  businessProofImage?: string;
}

export type WalletTransactionType = 'deposit' | 'payment' | 'refund';

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  /** Positive amount in pesos. Direction comes from the type. */
  amount: number;
  /** Wallet balance right after this transaction settled. */
  balanceAfter: number;
  description: string;
  orderId?: string;
  timestamp: string;
}

export type VegetableCategory =
  | 'All'
  | 'Vegetables'
  | 'Leafy Greens'
  | 'Tomatoes & Peppers'
  | 'Root Vegetables'
  | 'Squash & Gourds'
  | 'Herbs & Microgreens'
  | 'Legumes & Pods'
  | 'Organic Certified';

export type FarmingMethod =
  | 'Certified Organic'
  | 'Naturally Grown (Pesticide Free)'
  | 'Hydroponic / Clean Aquaponic'
  | 'GAP Certified (Good Agricultural Practices)'
  | 'Traditional Low-Spray';

export type HarvestStatus =
  | 'Harvested Today'
  | 'Fresh Picked on Order'
  | 'Harvesting Tomorrow AM'
  | 'Curing / Farm Stored';

export interface ProduceItem {
  id: string;
  farmerId: string;
  farmerName: string;
  farmName: string;
  name: string;
  category?: string;
  variety?: string;
  farmgateAskingPrice?: number;
  pricePerUnit: number;
  unit: string;
  stockQuantity: number;
  minOrderQuantity?: number;
  bulkDiscount?: {
    minQty: number;
    discountPercent: number;
  };
  harvestStatus: HarvestStatus;
  harvestDate: string;
  farmingMethod?: FarmingMethod | string;
  imageUrl: string;
  isOrganic: boolean;
  description: string;
  sourcingRegion?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  distanceKm: number;
  rating?: number;
  reviewsCount?: number;
  sellerStatus?: 'submitted' | 'bought_and_stocked' | 'sold_out' | 'archived';
  // Backward compatibility alias
  brokerStatus?: 'pending_review' | 'approved_active' | 'sold_out' | 'archived';
  sellerStoreName?: string;
  boughtQuantity?: number;
  boughtAt?: string;
}

export interface FarmerProfile {
  id: string;
  name: string;
  farmName: string;
  location: string;
  latitude?: number;
  longitude?: number;
  distanceKm: number;
  rating?: number;
  totalReviews?: number;
  bio: string;
  avatar: string;
  coverImage: string;
  phone: string;
  verified: boolean;
  farmingMethods?: string[];
  joinedYear: number;
  totalHarvestsSold: number;
}

export interface CartItem {
  produce: ProduceItem;
  quantity: number;
}

/** One farmer (or warehouse) lot used to fulfil an order line. Kept separate
 *  from order_items: a single buyer line can be split across several farmers
 *  with different farmgate asking prices (multi-farmer split allocation). */
export interface SourcingAllocation {
  id: string;
  /** Farmer listing id this allocation drew stock from. */
  produceId: string;
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  cropName: string;
  /** kg taken from this farmer. */
  quantity: number;
  /** Farmer's farmgate asking price per kg at allocation time. */
  farmgatePrice: number;
  allocatedAt: string;
  /** Warehouse shelf stock (already paid for) vs a fresh farmer purchase. */
  isWarehouse?: boolean;
}

/** Admin's proposal to re-price a crop the farmers sell above the fixed
 *  buyer market price. Buyer approves before the admin buys from farmers:
 *  proposed buyer price = new farmgate × 1.10. */
export interface PriceAdjustmentQuote {
  id: string;
  cropName: string;
  /** The fixed buyer market price currently on the order line. */
  currentBuyerPrice: number;
  /** The farmgate price the admin would have to pay (above the buyer price). */
  proposedFarmgatePrice: number;
  /** proposedFarmgatePrice × 1.10 — what the buyer would pay if approved. */
  proposedBuyerPrice: number;
  reason?: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt?: string;
  respondedAt?: string;
}

export interface OrderItem {
  produceId: string;
  produceName: string;
  pricePerUnit?: number;
  unitPrice?: number;
  /** Farmer's original asking price per unit (before Admin commission). */
  farmgateUnitPrice?: number;
  unit: string;
  quantity: number;
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  imageUrl?: string;
  /** Admin availability ruling for this product line. When 'unavailable', the
   *  line's amount is returned to the buyer's wallet (if already paid) or
   *  removed from the bill (if not yet paid) — the order itself continues. */
  itemStatus?: 'available' | 'unavailable';
  /** Amount returned / not charged for this line when unavailable. */
  refundedAmount?: number;
  refundedAt?: string;
}

export type OrderStatus =
  | 'pending' // Order placed — pickup route NOT started (nothing highlighted yet)
  | 'confirmed' // Owner started the pickup route ('I'll Pick This Up') — farmer fresh-picks now
  | 'harvesting_packing' // LEGACY only (pre-fresh-pick rows). Never assigned to new orders.
  | 'ready_for_pickup_delivery'
  | 'picked_up'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  buyerId?: string;
  buyerName: string;
  buyerPhone: string;
  farmerId: string;
  farmName: string;
  farmerPhone?: string;
  sellerStoreName?: string;
  brokerHubName?: string; // backward compat alias
  farmgateCostTotal?: number;
  sellerMargin?: number;
  /** Admin per-kg commission (10%) collected on this order's items. */
  adminCommissionTotal?: number;
  items: OrderItem[];
  deliveryType: 'farm_pickup' | 'direct_delivery';
  deliveryAddress?: string;
  pickupSlot?: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: string;
  status: OrderStatus;
  transportJobId?: string;
  notes?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  /** Exactly-once guard: request-lot warehouse stock already deducted for this order. */
  requestStockDeducted?: boolean;
  /** Multi-farmer split allocation — WHICH farmers supplied each crop, at
   *  which farmgate price, kept separate from the buyer-facing items. */
  sourcingAllocations?: SourcingAllocation[];
  /** Σ (allocation kg × farmgate price) across farmers (fresh purchases only). */
  sourcingCostTotal?: number;
  /** sourcingCostTotal ÷ farmer-sourced kg — e.g. ₱65.80/kg. */
  weightedAvgSourcingCost?: number;
  /** Buyer revenue − farmer sourcing cost — the Admin's net margin on this order. */
  netAdminProfit?: number;
  /** Price Adjustment Quotes raised when farmers ask above the fixed buyer price. */
  priceQuotes?: PriceAdjustmentQuote[];
  /** Wallet payment lifecycle: the buyer pays AFTER the admin approves the
   *  order and BEFORE the live transaction (transport/pickup) may occur. */
  paymentStatus?: 'unpaid' | 'paid';
  paidAt?: string;
  /** Amount actually charged to the buyer's wallet (total minus pre-payment
   *  refunds for unavailable products). */
  paidAmount?: number;
  /** Total value of products the admin marked unavailable. */
  refundedTotal?: number;
  /** Portion of the payment already credited back to the buyer's wallet. */
  refundedCredited?: number;
  createdAt?: string;
  transporterId?: string;
  transporterName?: string;
  transporterPhone?: string;
  vehicleType?: string;
  rating?: number;
  reviewComment?: string;
  ratedAt?: string;
}

export interface TransportJob {
  id: string;
  orderId: string;
  pickupFarm: string;
  pickupLocation: string;
  dropoffLocation: string;
  buyerName: string;
  buyerPhone: string;
  itemsSummary: string;
  weightKgEst: number;
  earningsPeso: number;
  status: 'available' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  assignedTransporterId?: string;
  assignedTransporterName?: string;
  assignedTransporterPhone?: string;
  cancelReason?: string;
  cancelledAt?: string;
  createdAt?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  text: string;
  timestamp: string;
  produceName?: string;
  orderId?: string;
  isRead?: boolean;
  // Photo attachment (client-compressed JPEG data URL). Messages can be
  // photo-only (text '') or carry a caption alongside the image.
  imageUrl?: string;
  // Legacy backward-compatibility fields
  farmerId?: string;
  farmerName?: string;
  buyerId?: string;
  buyerName?: string;
}

export type DAPriceCategory =
  | 'Highland Vegetables'
  | 'Lowland Vegetables'
  | 'Spices & Aromatics'
  | 'Fruits'
  | 'Root Crops'
  | 'Staples & Rice';

export interface DAPriceItem {
  id: string;
  commodity: string;
  localName?: string;
  variety?: string;
  category: DAPriceCategory;
  unit: string;
  prevailingRetailPrice: number;
  prevailingFarmgatePrice: number;
  priceRangeMin: number;
  priceRangeMax: number;
  trend: 'up' | 'down' | 'stable';
  changeAmount: number;
  changePercent: number;
  marketCenter: string;
  updatedDate: string;
  source: string;
  suggestedDirectFarmPrice: number;
  notes?: string;
}

export interface DABulletinMeta {
  bulletinDate: string;
  lastSynced: string;
  marketCenter: string;
  dataSource: string;
  agency: string;
  totalCommodities: number;
  inflationNote?: string;
}

/**
 * Universal criteria for whether a produce item is currently in Live Supermarket Stock.
 * Must have stockQuantity > 0 and be marked as owned/stocked by VeggieConnect Supermarket.
 */
/** Line total for an order item (quantity × unit price). */
export const orderItemAmount = (item?: OrderItem | null): number =>
  Number((Number(item?.quantity) || 0) * (Number(item?.unitPrice ?? item?.pricePerUnit) || 0)) || 0;

/** What the buyer still owes: order total minus amounts returned for
 *  unavailable products (never below zero). */
export const orderPayable = (order?: Order | null): number => {
  if (!order) return 0;
  const total = Number(order.totalAmount ?? order.subtotal) || 0;
  const refunded = Number(order.refundedTotal) || 0;
  return Math.max(0, Math.round((total - refunded) * 100) / 100);
};

export const isLiveSupermarketStock = (p?: Partial<ProduceItem> | null): boolean => {
  if (!p) return false;
  const isSupermarket =
    p.sellerStoreName === 'VeggieConnect Supermarket' ||
    p.sellerStatus === 'bought_and_stocked' ||
    p.farmName === 'VeggieConnect Supermarket' ||
    p.farmerName === 'VeggieConnect Central Produce Hub' ||
    (typeof p.id === 'string' && p.id.startsWith('sm-'));
  return Boolean(isSupermarket && (p.stockQuantity || 0) > 0);
};

