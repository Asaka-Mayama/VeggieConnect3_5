import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Truck,
  Store,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  FileText,
  Phone,
  X,
  ShieldCheck,
  MapPin,
  XCircle,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  Wallet,
  BadgeCheck,
} from 'lucide-react';
import { Order, OrderStatus, UserRole, UserProfile } from '../types';
import {
  UNRECORDED_DATE_KEY,
  getOrderDateKey,
  formatDateKeyLabel,
  formatDateKeyShort,
  formatOrderDateTime,
  sortDateKeysDesc,
  orderAmount,
} from '../utils/orderDates';
import { FarmRouteMap } from './FarmRouteMap';
import {
  getAdminProfileForLocationFallback,
  resolveLiveTransactionAdminLocation,
  resolveFarmHouseCoordinates,
  useAdminLocationSyncTick,
} from '../utils/farmRoute';
import { calculateDistanceKm } from '../utils/geoDistance';

interface OrdersViewProps {
  orders: Order[];
  userRole: UserRole;
  currentUser?: UserProfile | null;
  registeredUsers?: UserProfile[];
  initialFilter?: 'all' | 'active' | 'completed' | 'cancelled';
  onUpdateOrderStatus?: (
    orderId: string,
    newStatus: OrderStatus,
    cancelReason?: string,
    cancelledBy?: string
  ) => void;
  onChatWithParty?: (order: Order) => void;
  /** Buyer wallet payment: pays an admin-approved order from VeggieConnect Pay. */
  onPayOrder?: (orderId: string) => void;
  /** Buyer approves / declines a Price Adjustment Quote on a pending order. */
  onRespondPriceQuote?: (orderId: string, quoteId: string, approve: boolean) => void;
  /** Opens the buyer's Wallet tab (e.g. to deposit after insufficient balance). */
  onNavigateToWallet?: () => void;
}

/** Sales total for a list of orders — cancelled transactions never count as sales. */
const salesSum = (list: Order[]) =>
  list.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + orderAmount(o), 0);

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  userRole,
  currentUser,
  registeredUsers = [],
  initialFilter,
  onUpdateOrderStatus,
  onChatWithParty,
  onPayOrder,
  onRespondPriceQuote,
  onNavigateToWallet,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>(
    initialFilter || 'all'
  );
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  // Distance / ETA reported by each live route map (supermarket hub ➔ farmer's house)
  const [routeStatsByOrder, setRouteStatsByOrder] = useState<Record<string, { km: number; durationText: string }>>({});

  // DATE CATEGORY (Farmer Orders): 'all' or a local YYYY-MM-DD day key.
  // Lets the farmer browse transactions per date and read that day's total sales.
  const [selectedDateKey, setSelectedDateKey] = useState<string>('all');

  // Order cards stay collapsed to a compact summary until the user expands them.
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  const roleFilteredOrders = orders.filter((order) => {
    if (userRole === 'admin') return true;

    if (userRole === 'farmer') {
      if (!currentUser) return false;
      return (
        order.farmerId === currentUser.id ||
        (order.farmName &&
          currentUser.farmName &&
          order.farmName.trim().toLowerCase() === currentUser.farmName.trim().toLowerCase())
      );
    }

    // Buyer role
    if (!currentUser) return true; // Show placed orders in guest session
    return (
      order.buyerId === currentUser.id ||
      (order.buyerPhone && currentUser.phone && order.buyerPhone === currentUser.phone) ||
      (order.buyerName &&
        currentUser.name &&
        order.buyerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );
  });

  const filteredOrders = roleFilteredOrders.filter((order) => {
    if (filter === 'active') {
      return order.status !== 'completed' && order.status !== 'cancelled';
    }
    if (filter === 'completed') {
      return order.status === 'completed';
    }
    if (filter === 'cancelled') {
      return order.status === 'cancelled';
    }
    return true;
  });

  // ===== DATE CATEGORY (Farmer Orders) =====
  // Buckets every transaction of this farmer under its LOCAL calendar day so the
  // Orders menu can be browsed per date and show that day's total sales.
  const farmerDateBuckets = useMemo(() => {
    if (userRole !== 'farmer') return null;
    const map = new Map<string, Order[]>();
    roleFilteredOrders.forEach((o) => {
      const key = getOrderDateKey(o.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return { keys: sortDateKeysDesc([...map.keys()]), map };
  }, [userRole, roleFilteredOrders]);

  const farmerDateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!farmerDateBuckets) return counts;
    farmerDateBuckets.keys.forEach((key) => {
      counts[key] = (farmerDateBuckets.map.get(key) || []).length;
    });
    return counts;
  }, [farmerDateBuckets]);

  // Total-sales summary for the selected date (or All Dates). ONLY completed
  // transactions count as sales — the admin must have actually bought the
  // product and the transaction must be finished before a peso amount becomes
  // a sale (matching the Farmer dashboard's "Total Sales"). Cancelled and
  // still-in-progress transactions are excluded from the headline figure; the
  // in-progress peso value stays visible as an informational line.
  const farmerSummary = useMemo(() => {
    if (!farmerDateBuckets) return null;
    const inScope =
      selectedDateKey === 'all'
        ? roleFilteredOrders
        : roleFilteredOrders.filter((o) => getOrderDateKey(o.createdAt) === selectedDateKey);
    return {
      label: selectedDateKey === 'all' ? 'All Dates' : formatDateKeyLabel(selectedDateKey),
      total: salesSum(inScope.filter((o) => o.status === 'completed')),
      delivered: salesSum(inScope.filter((o) => o.status === 'completed')),
      inProgress: salesSum(
        inScope.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
      ),
      txCount: inScope.length,
      completedCount: inScope.filter((o) => o.status === 'completed').length,
      cancelledCount: inScope.filter((o) => o.status === 'cancelled').length,
    };
  }, [farmerDateBuckets, roleFilteredOrders, selectedDateKey]);

  // Orders actually listed: honours the status tab AND the selected date,
  // sorted newest day first (unrecorded dates last) so per-date sections
  // render as clean consecutive groups.
  const displayOrders = useMemo(() => {
    if (userRole !== 'farmer') return filteredOrders;
    const scoped =
      selectedDateKey === 'all'
        ? filteredOrders
        : filteredOrders.filter((o) => getOrderDateKey(o.createdAt) === selectedDateKey);
    return [...scoped].sort((a, b) => {
      const ka = getOrderDateKey(a.createdAt);
      const kb = getOrderDateKey(b.createdAt);
      if (ka === UNRECORDED_DATE_KEY && kb !== UNRECORDED_DATE_KEY) return 1;
      if (kb === UNRECORDED_DATE_KEY && ka !== UNRECORDED_DATE_KEY) return -1;
      if (ka !== kb) return kb.localeCompare(ka);
      return 0;
    });
  }, [userRole, filteredOrders, selectedDateKey]);

  // Origin of the live route map — the admin/supermarket location saved from
  // Admin > Profile (with the registered admin account as a safe fallback).
  const adminLocationSyncTick = useAdminLocationSyncTick();
  const adminProfile = useMemo(
    () => getAdminProfileForLocationFallback(null, registeredUsers),
    [registeredUsers, adminLocationSyncTick]
  );
  const supermarket = resolveLiveTransactionAdminLocation(registeredUsers, adminProfile);
  const supermarketHub = { lat: supermarket.latitude, lng: supermarket.longitude };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return userRole === 'buyer' ? (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>Request Submitted — Awaiting Admin</span>
          </span>
        ) : (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Buyer Request Placed — Awaiting Review</span>
        );
      case 'confirmed':
        return userRole === 'buyer' ? (
          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-700" />
            <span>Admin Reviewing &amp; Checking Stocks</span>
          </span>
        ) : (
          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Confirmed — Admin Processing</span>
        );
      case 'harvesting_packing':
        return <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Checking Warehouse Stocks</span>;
      case 'ready_for_pickup_delivery':
        return (
          <span className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-white" />
            <span>{userRole === 'buyer' ? 'Request Fulfilled from Stock!' : 'Ready for Depot Pickup / Delivery'}</span>
          </span>
        );
      case 'picked_up':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Store className="w-3 h-3 text-amber-700" />
            <span>Ready at Store Depot</span>
          </span>
        );
      case 'in_transit':
        return (
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Store className="w-3 h-3 text-emerald-700" />
            <span>Fulfilled — On the Way / Ready for Pickup</span>
          </span>
        );
      case 'completed':
        return <span className="bg-neutral-100 text-neutral-800 border border-neutral-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Fulfilled &amp; Received ✓</span>;
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-900 border border-red-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-600" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  const getStepNumber = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 1; // Buyer Request Submitted
      case 'confirmed': return 2; // Admin Processing
      case 'harvesting_packing': return 3; // Admin Checking Stocks
      case 'ready_for_pickup_delivery': return 4; // Fulfillment
      case 'picked_up': return 4;
      case 'in_transit': return 4;
      case 'completed': return 4;
      default: return 1;
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-3.5 pb-8 w-full">
      {/* Header & Filter Pills */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-emerald-950 font-display">
            {userRole === 'buyer' ? 'My VeggieConnect Orders' : 'Store Procurements'}
          </h2>
          <p className="text-xs text-neutral-500 font-medium">
            {userRole === 'buyer'
              ? 'Track the status of each order and view receipts'
              : 'Vegetables purchased & fulfilled by VeggieConnect Store'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-emerald-200/80 pb-2.5 overflow-x-auto no-scrollbar">
        {(['all', 'active', 'completed', 'cancelled'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-orders-${tab}`}
            onClick={() => setFilter(tab)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer shrink-0 ${
              filter === tab
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 hover:text-emerald-950 bg-white border border-emerald-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* DATE CATEGORY CHIPS + TOTAL SALES SUMMARY (Farmer Orders) */}
      {userRole === 'farmer' && farmerDateBuckets && farmerDateBuckets.keys.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              id="chip-farmer-dates-all"
              onClick={() => setSelectedDateKey('all')}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                selectedDateKey === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-950 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>All Dates</span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  selectedDateKey === 'all' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {roleFilteredOrders.length}
              </span>
            </button>
            {farmerDateBuckets.keys.map((key) => (
              <button
                key={key}
                id={`chip-farmer-date-${key}`}
                onClick={() => setSelectedDateKey(key)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  selectedDateKey === key
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-emerald-950 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{formatDateKeyShort(key)}</span>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    selectedDateKey === key ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {farmerDateCounts[key] || 0}
                </span>
              </button>
            ))}
          </div>

          {farmerSummary && (
            <div
              id="farmer-date-sales-summary"
              className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-2xl p-3.5 shadow-sm border border-emerald-700/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
                  <span className="truncate">Total Sales — {farmerSummary.label}</span>
                </span>
                <span className="text-[9px] bg-emerald-500/80 text-white font-extrabold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0">
                  {farmerSummary.txCount} Transaction{farmerSummary.txCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingUp className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span className="text-2xl font-black font-mono">
                  ₱{farmerSummary.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-emerald-200/90 mt-1">
                {farmerSummary.completedCount} completed sale
                {farmerSummary.completedCount === 1 ? '' : 's'} counted · In Progress ₱
                {farmerSummary.inProgress.toFixed(2)} not yet sales (admin has not completed the buy)
                {farmerSummary.cancelledCount > 0
                  ? ` · ${farmerSummary.cancelledCount} cancelled not counted`
                  : ''}
              </p>
            </div>
          )}
        </>
      )}

      {displayOrders.length > 0 && (
        <p className="text-[10px] text-neutral-400 font-medium -mt-2 px-1">
          Tap an order to view full details, map &amp; actions
        </p>
      )}

      {displayOrders.length === 0 ? (
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto text-2xl">
            📦
          </div>
          <h3 className="text-sm font-extrabold text-emerald-950">No Orders in this View</h3>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            {userRole === 'buyer'
              ? 'Place an order in the market to connect directly with your local farmers.'
              : userRole === 'farmer' && selectedDateKey !== 'all'
              ? 'No transactions recorded on the selected date.'
              : 'No orders match this filter right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map((order, orderIdx) => {
            const step = getStepNumber(order.status);
            const isOrderExpanded = expandedOrderIds.has(order.id);

            // DATE CATEGORY (Farmer Orders): a section header is rendered above
            // the FIRST transaction of every calendar day, carrying that day's
            // own sales total so each date is self-explanatory.
            const orderDateKey = getOrderDateKey(order.createdAt);
            const prevOrder = orderIdx > 0 ? displayOrders[orderIdx - 1] : undefined;
            const showDateHeader =
              userRole === 'farmer' &&
              (!prevOrder || getOrderDateKey(prevOrder.createdAt) !== orderDateKey);
            const sameDayOrders =
              userRole === 'farmer'
                ? displayOrders.filter((o) => getOrderDateKey(o.createdAt) === orderDateKey)
                : [];
            const dateSectionHeader = showDateHeader ? (
              <div
                id={`date-section-${orderDateKey}`}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-emerald-950 truncate">
                      {formatDateKeyLabel(orderDateKey)}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-medium">
                      {sameDayOrders.length} transaction{sameDayOrders.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-black flex-shrink-0 whitespace-nowrap ${
                    sameDayOrders.some((o) => o.status === 'cancelled') &&
                    sameDayOrders.every((o) => o.status === 'cancelled')
                      ? 'text-red-600'
                      : 'text-emerald-800'
                  }`}
                >
                  Sales: ₱{salesSum(sameDayOrders).toFixed(2)}
                </span>
              </div>
            ) : null;

            // LIVE ROUTE (farmer): supermarket hub ➔ the supplying farm's house while the order is active.
            // Resolve strictly from THIS order (item farmer first, then order farmer/account) so two
            // active orders can never inherit the viewer's coordinates or each other's route.
            const isLiveTransaction = order.status !== 'completed' && order.status !== 'cancelled';
            // Buyer rule: the live route map stays HIDDEN (no placeholder box
            // is rendered) until the Admin presses "Fulfill Buyer Request" —
            // the only action that moves a buyer request out of 'pending' (to
            // 'confirmed'). From that moment the map AND the digital Receipt
            // become available. Chat Seller & Cancel Order remain the only
            // actions while the request is still awaiting fulfillment.
            const isBuyerMapUnlocked = userRole !== 'buyer' || order.status !== 'pending';
            const supplyItem = order.items[0];
            const orderFarmer =
              (currentUser?.role === 'farmer' && (
                (order.farmerId && currentUser.id === order.farmerId) ||
                (order.farmName && currentUser.farmName && order.farmName.trim().toLowerCase() === currentUser.farmName.trim().toLowerCase()) ||
                userRole === 'farmer'
              ))
                ? currentUser
                : registeredUsers.find(
                    (u) =>
                      u.role === 'farmer' &&
                      ((order.farmerId && u.id === order.farmerId) ||
                        (order.farmName &&
                          u.farmName &&
                          order.farmName.trim().toLowerCase() === u.farmName.trim().toLowerCase()))
                  );

            // Textual farm address: must represent the farm, never the supermarket delivery address
            const farmLocation =
              orderFarmer?.location ||
              (userRole === 'farmer' && currentUser?.location ? currentUser.location : '') ||
              (order.pickupSlot && !order.pickupSlot.includes('Supermarket') ? order.pickupSlot : '');

            const farmHouse =
              isLiveTransaction && isBuyerMapUnlocked && (orderFarmer || supplyItem || userRole === 'farmer')
                ? resolveFarmHouseCoordinates({
                    latitude: orderFarmer?.latitude || (userRole === 'farmer' ? currentUser?.latitude : undefined),
                    longitude: orderFarmer?.longitude || (userRole === 'farmer' ? currentUser?.longitude : undefined),
                    farmerId: order.farmerId || orderFarmer?.id,
                    farmName: order.farmName || orderFarmer?.farmName || (userRole === 'farmer' ? currentUser?.farmName : undefined),
                    farmerName: supplyItem?.farmerName || orderFarmer?.name || (userRole === 'farmer' ? currentUser?.name : undefined),
                    locationText: farmLocation,
                    registeredUsers,
                    itemFarmerId: supplyItem?.farmerId,
                    itemFarmerName: supplyItem?.farmerName,
                    itemFarmName: supplyItem?.farmName,
                  })
                : null;
            const routeStats = routeStatsByOrder[order.id];
            const straightLineKm = farmHouse
              ? Math.round(
                  calculateDistanceKm(
                    supermarketHub.lat,
                    supermarketHub.lng,
                    farmHouse.coords.lat,
                    farmHouse.coords.lng
                  ) * 10
                ) / 10
              : 0;

            return (
              <React.Fragment key={order.id}>
                {dateSectionHeader}
              <div
                id={`order-card-${order.id}`}
                className="bg-white border border-emerald-200/85 rounded-2xl p-4 space-y-3 shadow-xs"
              >
                {/* Collapsed summary header — tap to expand full details */}
                <button
                  onClick={() => toggleOrderExpanded(order.id)}
                  className="w-full flex items-center gap-2 text-left cursor-pointer"
                  aria-expanded={isOrderExpanded}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-emerald-950 truncate">{order.id}</span>
                      <span className="flex-shrink-0">{getStatusBadge(order.status)}</span>
                    </div>
                    {formatOrderDateTime(order.createdAt) && (
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{formatOrderDateTime(order.createdAt)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-neutral-500 truncate">
                        {order.items[0]
                          ? `${order.items[0].produceName} × ${order.items[0].quantity} ${order.items[0].unit || 'kg'}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}`
                          : 'View order details'}
                      </span>
                      <span className="font-black text-emerald-950 flex-shrink-0">
                        ₱{(Number(order.totalAmount ?? order.subtotal) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-emerald-700 transition-transform flex-shrink-0 ${isOrderExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOrderExpanded && (
                <div className="space-y-3 pt-3 border-t border-emerald-100 mt-3">
                {order.status === 'cancelled' ? (
                  <div className="bg-red-50/80 border border-red-200/90 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-red-800">
                        <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>Order Cancelled {order.cancelledAt ? `(${order.cancelledAt})` : ''}</span>
                      </span>
                    </div>
                    {order.cancelReason && (
                      <p className="text-[11px] text-red-900 leading-snug">
                        <strong>Reason:</strong> {order.cancelReason}
                      </p>
                    )}
                    {order.cancelledBy && (
                      <p className="text-[10px] text-neutral-500">
                        Cancelled by: {order.cancelledBy}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Progress bar — live farmer ↔ supermarket tracker.
                     Confirmed lights up ONLY after the owner starts the pickup
                     route ('I'll Pick This Up'), never right after Buy Produce. */
                  <div className="space-y-1.5 py-1">
                    <div className="flex justify-between text-[10px] text-neutral-500 font-medium">
                      <span className={step >= 1 ? 'text-emerald-700 font-bold' : ''}>
                        {userRole === 'buyer' ? '1. Request Sent' : '1. Order Placed'}
                      </span>
                      <span className={step >= 2 ? 'text-emerald-700 font-bold' : ''}>
                        {userRole === 'buyer' ? '2. Admin Review' : '2. Confirmed'}
                      </span>
                      <span className={step >= 3 ? 'text-emerald-700 font-bold' : ''}>
                        {userRole === 'buyer' ? '3. Checking Stocks' : (order.deliveryType === 'farm_pickup' ? '3. Ready at Depot' : '3. On Route')}
                      </span>
                      <span className={step >= 4 ? 'text-emerald-700 font-bold' : ''}>
                        {userRole === 'buyer' ? '4. Fulfilled ✓' : '4. Delivered'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (step / 4) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Order Items Preview */}
                <div className="space-y-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/70 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-neutral-700">
                      <div className="flex items-center gap-2 truncate">
                        <img
                          src={item.imageUrl}
                          alt={item.produceName}
                          className={`w-8 h-8 rounded-lg object-cover bg-emerald-100 ${item.itemStatus === 'unavailable' ? 'opacity-40 grayscale' : ''}`}
                        />
                        <span className={`truncate text-xs font-bold ${item.itemStatus === 'unavailable' ? 'text-neutral-400 line-through' : 'text-emerald-950'}`}>
                          {item.produceName}
                        </span>
                        <span className="text-neutral-500 text-[11px]">
                          × {item.quantity} kg
                        </span>
                        {item.itemStatus === 'unavailable' && (
                          <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5 flex-shrink-0">
                            Unavailable{item.refundedAmount ? ` • ₱${Number(item.refundedAmount).toFixed(2)}` : ''}
                          </span>
                        )}
                        {/* Partial fulfillment (v4.11): the admin fulfilled this
                            line with less stock than requested — show what was
                            delivered and what was returned to the buyer. */}
                        {(item.shortfallKg || 0) > 0 && item.itemStatus !== 'unavailable' && (
                          <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 flex-shrink-0">
                            {item.quantity} of {item.originalQuantity ?? (Number(item.quantity) || 0) + (Number(item.shortfallKg) || 0)} kg fulfilled{item.refundedAmount ? ` • ₱${Number(item.refundedAmount).toFixed(2)} returned` : ''}
                          </span>
                        )}
                      </div>
                      <span className={`font-bold flex-shrink-0 ${item.itemStatus === 'unavailable' ? 'text-neutral-400 line-through' : 'text-emerald-950'}`}>
                        ₱{(Number((item.unitPrice || item.pricePerUnit || 0) * (item.quantity || 1)) || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {/* Fulfillment Details */}
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-neutral-600">
                    <span className="flex items-center gap-1">
                      {order.deliveryType === 'farm_pickup' ? (
                        <>
                          <Store className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Pickup: {order.pickupSlot || 'At Farm Gate'}</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="truncate max-w-[200px]">Delivery: {order.deliveryAddress}</span>
                        </>
                      )}
                    </span>
                    <span className="text-right">
                      {Number(order.refundedTotal) > 0 && (
                        <span className="block text-[10px] text-red-600 font-bold">
                          Refunded: −₱{Number(order.refundedTotal).toFixed(2)}
                        </span>
                      )}
                      <span className="font-black text-emerald-950 text-xs">
                        {order.paymentStatus === 'paid' && Number(order.paidAmount) >= 0
                          ? `Paid: ₱${Number(order.paidAmount).toFixed(2)}`
                          : `Total: ₱${(Number(order.totalAmount ?? order.subtotal) || 0).toFixed(2)}`}
                      </span>
                    </span>
                  </div>
                </div>

                {/* PRICE ADJUSTMENT QUOTES (buyer): when farmers ask above the
                    fixed market price, the Admin blocks fulfillment and sends
                    a quote — the buyer approves the new price (farmgate × 1.10)
                    before the Admin buys from farmers. */}
                {userRole === 'buyer' && order.status === 'pending' && (order.priceQuotes || []).length > 0 && (
                  <div className="space-y-2">
                    {(order.priceQuotes || []).map((quote) => {
                      if (quote.status !== 'pending') {
                        return (
                          <div
                            key={quote.id}
                            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[11px] font-bold border ${
                              quote.status === 'approved'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-neutral-100 border-neutral-200 text-neutral-600'
                            }`}
                          >
                            {quote.status === 'approved' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                            )}
                            <span>
                              Price quote {quote.status} — {quote.cropName}{' '}
                              {quote.status === 'approved'
                                ? `now ₱${quote.proposedBuyerPrice.toFixed(2)}/kg`
                                : `stays ₱${quote.currentBuyerPrice.toFixed(2)}/kg`}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={quote.id}
                          id={`quote-card-${quote.id}`}
                          className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2"
                        >
                          <div className="flex items-start gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-amber-950">
                                Price Adjustment Quote — {quote.cropName}
                              </p>
                              <p className="text-[10px] text-amber-900 font-medium leading-relaxed mt-0.5">{quote.reason}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-2.5 py-1.5">
                            <span className="text-[10px] font-bold text-neutral-500 line-through">₱{quote.currentBuyerPrice.toFixed(2)}/kg</span>
                            <span className="text-[10px] font-black text-amber-800">→</span>
                            <span className="text-xs font-black text-emerald-800">₱{quote.proposedBuyerPrice.toFixed(2)}/kg</span>
                          </div>
                          <div className="flex gap-2">
                            {onRespondPriceQuote && (
                              <>
                                <button
                                  id={`btn-decline-quote-${quote.id}`}
                                  onClick={() => onRespondPriceQuote(order.id, quote.id, false)}
                                  className="flex-1 min-h-[40px] rounded-xl bg-white border border-neutral-300 text-neutral-700 text-[11px] font-extrabold cursor-pointer hover:bg-neutral-50 active:scale-95 transition-all"
                                >
                                  Decline
                                </button>
                                <button
                                  id={`btn-approve-quote-${quote.id}`}
                                  onClick={() => onRespondPriceQuote(order.id, quote.id, true)}
                                  className="flex-1 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer active:scale-95 transition-all shadow-sm"
                                >
                                  Approve & Pay New Price
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* WALLET PAYMENT (buyer): pay AFTER admin approval, BEFORE the
                    live transaction. Pending orders show an approval notice;
                    approved unpaid orders show the Pay Now action; paid orders
                    show a settled badge. */}
                {userRole === 'buyer' && order.status !== 'cancelled' && (() => {
                  const payable = Math.max(0, (Number(order.totalAmount ?? order.subtotal) || 0) - (Number(order.refundedTotal) || 0));
                  const isPaid = order.paymentStatus === 'paid';
                  const isApproved = order.status !== 'pending';
                  if (isPaid) {
                    return (
                      <div className="flex items-center justify-between gap-2 bg-emerald-600/10 border border-emerald-600/40 rounded-2xl px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                          <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Paid via Wallet{order.paidAmount !== undefined ? ` — ₱${Number(order.paidAmount).toFixed(2)}` : ''}</span>
                        </span>
                        {Number(order.refundedCredited) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-800">
                            Refunded to wallet: ₱{Number(order.refundedCredited).toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (!isApproved) {
                    return (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-[11px] font-bold text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          Awaiting Admin approval — pay ₱{payable.toFixed(2)} from your wallet once approved. The live transaction starts after payment.
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                          <Wallet className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                          <span>Order approved — pay to start the transaction</span>
                        </span>
                        <span className="text-sm font-black text-emerald-900 font-mono">₱{payable.toFixed(2)}</span>
                      </div>
                      {(Number(order.refundedTotal) || 0) > 0 && (
                        <p className="text-[10px] font-bold text-emerald-800">
                          Includes −₱{Number(order.refundedTotal).toFixed(2)} returned for unavailable products.
                        </p>
                      )}
                      {onPayOrder && (
                        <button
                          id={`btn-pay-order-${order.id}`}
                          onClick={() => onPayOrder(order.id)}
                          className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] transition-all"
                        >
                          <Wallet className="w-4 h-4" />
                          <span>Pay Now from Wallet • ₱{payable.toFixed(2)}</span>
                        </button>
                      )}
                      {onNavigateToWallet && (
                        <button
                          onClick={onNavigateToWallet}
                          className="w-full text-[10px] font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                        >
                          Balance low? Open Wallet to deposit
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* LIVE ROUTE MAP: Farmer's House (Left) ➔ Supermarket Hub (Right).
                    Buyers only see it AFTER Admin confirms the request — while
                    pending, a locked-map notice is shown instead. */}
                {farmHouse ? (
                  <div className="border border-red-200 bg-red-50/40 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-gradient-to-r from-red-700 to-red-600 text-white">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-wide truncate">
                          Live Procurement Route: {farmHouse.label} ➔ {supermarket.storeName}
                        </span>
                      </div>
                      <span className="text-[9px] bg-white/20 font-extrabold px-1.5 py-0.5 rounded flex-shrink-0">
                        RED ROUTE
                      </span>
                    </div>

                    <FarmRouteMap
                      routeKey={order.id}
                      origin={farmHouse.coords}
                      destination={supermarketHub}
                      originLabel={farmHouse.label}
                      destinationLabel={supermarket.storeName}
                      originEmoji="🌱"
                      destinationEmoji="🏪"
                      heightClassName="h-60"
                      onRouteCalculated={(km, durationText) => {
                        setRouteStatsByOrder((prev) =>
                          prev[order.id] &&
                          prev[order.id].km === km &&
                          prev[order.id].durationText === durationText
                            ? prev
                            : { ...prev, [order.id]: { km, durationText } }
                        );
                      }}
                    />
                  </div>
                ) : null}

                {/* Bottom Actions */}
                <div className="space-y-2 pt-1">
                  {/* Informational Status Banner for Direct Delivery Farmer */}
                  {userRole === 'farmer' && order.deliveryType === 'direct_delivery' && (
                    <div className="w-full">
                      {order.status === 'pending' && (
                        <div className="space-y-2">
                          {onUpdateOrderStatus ? (
                            <button
                              id={`btn-farmer-confirm-procurement-${order.id}`}
                              onClick={() => onUpdateOrderStatus(order.id, 'confirmed')}
                              className="w-full h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">Confirm Order (Fresh-Pick & Ready for Pickup)</span>
                            </button>
                          ) : null}
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                            <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span>
                              The supermarket can only start the pickup route AFTER you confirm this order. Please
                              confirm so the live transport can begin.
                            </span>
                          </div>
                        </div>
                      )}
                      {order.status === 'confirmed' && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl">
                          <Truck className="w-3.5 h-3.5 text-blue-600 animate-pulse flex-shrink-0" />
                          <span>Confirmed — transport is on the way to your farm. Please fresh-pick the order.</span>
                        </div>
                      )}
                      {(order.status === 'picked_up' || order.status === 'ready_for_pickup_delivery' || order.status === 'in_transit') && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                          <Truck className="w-3.5 h-3.5 text-emerald-600 animate-pulse flex-shrink-0" />
                          <span>Admin will mark delivered</span>
                        </div>
                      )}
                      {order.status === 'completed' && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 bg-neutral-100 border border-neutral-300 px-3 py-2 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>Delivered ✓</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Aligned Action Buttons Grid/Flex Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Digital Receipt Button — buyers see it only AFTER the Admin
                        fulfills the request (never while pending / cancelled). */}
                    {(userRole !== 'buyer' || (order.status !== 'pending' && order.status !== 'cancelled')) && (
                      <button
                        id={`btn-receipt-${order.id}`}
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="flex-1 min-w-[90px] h-10 px-2 sm:px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-200 cursor-pointer transition-all active:scale-95 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                        <span className="truncate">Receipt</span>
                      </button>
                    )}

                    {/* Chat with Farmer / Customer */}
                    {onChatWithParty && (() => {
                      if (userRole === 'farmer') {
                        const isCustomerMe = Boolean(
                          currentUser &&
                            (order.buyerId === currentUser.id ||
                              (order.buyerName && currentUser.name && order.buyerName.toLowerCase() === currentUser.name.toLowerCase()))
                        );
                        if (isCustomerMe) return null;
                        return (
                          <button
                            id={`btn-chat-order-${order.id}`}
                            onClick={() => onChatWithParty(order)}
                            className="flex-1 min-w-[110px] h-10 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Message Buyer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Chat Buyer</span>
                          </button>
                        );
                      } else {
                        const isFarmerMe = Boolean(
                          currentUser &&
                            (order.farmerId === currentUser.id ||
                              (order.farmName && currentUser.farmName && order.farmName.toLowerCase() === currentUser.farmName.toLowerCase()))
                        );
                        if (isFarmerMe) return null;
                        return (
                          <button
                            id={`btn-chat-order-${order.id}`}
                            onClick={() => onChatWithParty(order)}
                            className="flex-1 min-w-[105px] h-10 px-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Message Seller (Admin)"
                          >
                            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Chat Seller</span>
                          </button>
                        );
                      }
                    })()}

                    {/* Chat with Transporter removed — the admin acts as the transporter */}

                    {/* Farmer mode direct actions.
                        Farm-pickup orders (buyer collects at the gate): farmer
                        approves, then hands over — no harvesting step (lots are
                        fresh-picked on order confirmation).
                        Supermarket procurement (direct_delivery): the OWNER
                        drives the whole tracker. The farmer has no buttons here —
                        'Confirmed' lights up only when the owner starts the
                        pickup route ('I'll Pick This Up'), then the owner
                        advances picked_up → in_transit → delivered. */}
                    {userRole === 'farmer' && onUpdateOrderStatus && order.deliveryType !== 'direct_delivery' && (
                      <>
                        {order.status === 'pending' && (
                          <button
                            id={`btn-farmer-approve-${order.id}`}
                            onClick={() => onUpdateOrderStatus(order.id, 'confirmed')}
                            className="flex-1 min-w-[110px] h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Approve</span>
                          </button>
                        )}
                        {order.status === 'ready_for_pickup_delivery' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'completed')}
                            className="flex-1 min-w-[110px] h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Handed Over ✓</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Buyer can confirm receipt if ready for farm_pickup AND
                        the order is paid — payment gates every completion. */}
                    {userRole === 'buyer' && order.deliveryType === 'farm_pickup' && order.status === 'ready_for_pickup_delivery' && order.paymentStatus === 'paid' && onUpdateOrderStatus && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'completed')}
                        className="flex-1 min-w-[130px] h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Confirm Received</span>
                      </button>
                    )}

                    {/* Cancellation Action: Available only for Buyer and Admin accounts (Farmer account removed) */}
                    {userRole !== 'farmer' && (order.status === 'pending' || order.status === 'confirmed') && onUpdateOrderStatus && (
                      <button
                        id={`btn-cancel-order-${order.id}`}
                        onClick={() => {
                          setOrderToCancel(order);
                          setCancelReasonInput('');
                        }}
                        className="flex-1 min-w-[105px] h-10 px-2 sm:px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-red-200 cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="Cancel this order"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                        <span className="truncate">Cancel Order</span>
                      </button>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Farm-Gate Digital Receipt Modal */}
      {selectedReceiptOrder && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-emerald-200 rounded-3xl w-full max-w-sm max-h-[92%] overflow-y-auto p-5 space-y-4 text-emerald-950 shadow-2xl relative">
            <button
              onClick={() => setSelectedReceiptOrder(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center hover:bg-emerald-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Receipt Header */}
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-emerald-950 font-display">
                Farm-Gate Direct Receipt
              </h3>
              <p className="text-[11px] text-neutral-500 font-medium">Order ID: {selectedReceiptOrder.id}</p>
            </div>

            {/* Farm & Buyer details */}
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Producer / Sourced From:</span>
                <span className="font-bold text-emerald-900">
                  {userRole === 'buyer' ? 'VeggieConnect Central Market • Negros Oriental' : selectedReceiptOrder.farmName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Buyer:</span>
                <span className="font-bold text-emerald-950">{selectedReceiptOrder.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Method:</span>
                <span className="font-bold text-emerald-950 capitalize">
                  {selectedReceiptOrder.deliveryType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Payment:</span>
                <span className="font-bold text-emerald-950">{selectedReceiptOrder.paymentMethod}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-emerald-900 pb-1 border-b border-emerald-100">
                Harvest Items
              </div>
              {selectedReceiptOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-neutral-700">
                  <span>
                    {item.produceName} ({item.quantity} {item.unit})
                    {(item.shortfallKg || 0) > 0 && (
                      <span className="text-amber-700 font-bold"> — {item.shortfallKg} {item.unit} unavailable</span>
                    )}
                  </span>
                  <span className="font-bold text-emerald-950">
                    ₱{(Number((item.unitPrice || item.pricePerUnit || 0) * (item.quantity || 1)) || 0).toFixed(2)}
                  </span>
                </div>
              ))}
              {(Number(selectedReceiptOrder.refundedTotal) || 0) > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Unavailable / shortfall returned:</span>
                  <span>−₱{Number(selectedReceiptOrder.refundedTotal).toFixed(2)}</span>
                </div>
              )}
              {(Number(selectedReceiptOrder.bulkDiscount) || 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Bulk Discount (90 kg+):</span>
                  <span>−₱{Number(selectedReceiptOrder.bulkDiscount).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-emerald-100 pt-2 flex justify-between font-extrabold text-sm text-emerald-950">
                <span>Total Paid Directly:</span>
                <span className="text-emerald-700">₱{(Number(selectedReceiptOrder.totalAmount ?? selectedReceiptOrder.subtotal) || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Zero Middleman Stamp */}
            <div className="bg-emerald-100/70 border border-emerald-300 rounded-2xl p-3 text-center text-xs text-emerald-950">
              <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-emerald-700" />
              <div className="font-bold">100% Direct Agricultural Exchange</div>
              <div className="text-[10px] text-emerald-800 font-medium">Direct fair farm-gate pricing</div>
            </div>

            <button
              onClick={() => setSelectedReceiptOrder(null)}
              className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* Order Cancellation Confirmation Modal */}
      {orderToCancel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-red-200 rounded-3xl w-full max-w-sm max-h-[92%] overflow-y-auto p-5 space-y-4 text-neutral-900 shadow-2xl relative">
            <button
              onClick={() => {
                setOrderToCancel(null);
                setCancelReasonInput('');
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-neutral-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 text-red-700">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-neutral-900 truncate">Cancel Order</h3>
                <p className="text-[11px] text-neutral-500 font-mono">Order ID: {orderToCancel.id}</p>
              </div>
            </div>

            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Your request will be withdrawn and the Admin will be notified. No payment has been taken — orders are paid over-the-counter at the depot.
            </p>

            {/* Direct Cancellation Reason Input (No multiple choice / radio buttons) */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-800 block">
                Reason for Cancellation:
              </label>
              <textarea
                rows={3}
                placeholder="Type your cancellation reason here (e.g., buyer requested change, incorrect address, etc.)..."
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500 bg-neutral-50 focus:bg-white resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-neutral-200">
              <button
                onClick={() => {
                  const finalReason = cancelReasonInput.trim() || 'Cancelled upon request';
                  const cancellerName =
                    currentUser?.name || (userRole === 'admin' ? 'Admin' : 'Buyer');
                  if (onUpdateOrderStatus) {
                    onUpdateOrderStatus(orderToCancel.id, 'cancelled', finalReason, cancellerName);
                  }
                  setOrderToCancel(null);
                  setCancelReasonInput('');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirm Cancellation</span>
              </button>

              <button
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReasonInput('');
                }}
                className="w-full py-2 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs text-center cursor-pointer transition-colors"
              >
                Keep Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
