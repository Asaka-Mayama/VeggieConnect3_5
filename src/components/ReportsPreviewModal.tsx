import React, { useEffect, useMemo, useState } from 'react';
import { X, BarChart3, Users, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Order, UserProfile } from '../types';

// ── Admin Reports Preview (in-app, phone-sized) ──────────────────────────────
// Panels usually ask for reports — this renders them INSIDE the app instead of
// downloading a CSV file: pick the report type and a date range, and the rows
// appear right here with an exit button. All filtering happens client-side
// from the data the console already has (no extra server load).
type ReportType = 'users' | 'orders';

interface Props {
  users: UserProfile[];
  orders: Order[];
  onClose: () => void;
}

const peso = (n: number) =>
  `₱${(Math.round(n * 100) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function dayKey(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const ReportsPreviewModal: React.FC<Props> = ({ users, orders, onClose }) => {
  const [reportType, setReportType] = useState<ReportType>('users');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inRange = (iso?: string): boolean => {
    const key = dayKey(iso);
    if (!key) return false; // rows without a usable date are never reported
    if (fromDate && key < fromDate) return false;
    if (toDate && key > toDate) return false;
    return true;
  };

  const filteredUsers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'farmer' || u.role === 'buyer')
        .filter((u) => inRange(u.submittedAt || u.approvedAt))
        .sort((a, b) =>
          String(a.submittedAt || a.approvedAt || '').localeCompare(String(b.submittedAt || b.approvedAt || ''))
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, fromDate, toDate]
  );

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((o) => inRange(o.createdAt || o.paidAt))
        .sort((a, b) =>
          String(a.createdAt || a.paidAt || '').localeCompare(String(b.createdAt || b.paidAt || ''))
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, fromDate, toDate]
  );

  const ordersTotal = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
    [filteredOrders]
  );

  const farmersCount = filteredUsers.filter((u) => u.role === 'farmer').length;
  const buyersCount = filteredUsers.filter((u) => u.role === 'buyer').length;

  const statusChip = (s?: string) => {
    const v = String(s || '').toLowerCase();
    const cls =
      v === 'approved' || v === 'completed'
        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        : v === 'rejected' || v === 'cancelled'
        ? 'bg-rose-100 text-rose-800 border border-rose-200'
        : v === 'pending'
        ? 'bg-amber-100 text-amber-800 border border-amber-200'
        : 'bg-sky-100 text-sky-800 border border-sky-200';
    return (
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${cls}`}>
        {String(s || '').replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-0 min-[460px]:p-4 bg-neutral-950/70 backdrop-blur-[2px]">
      {/* Same phone shell as the app itself (AdminApp frame): 430px wide,
          same height formula, 44px rounding and bezel border. */}
      <div className="w-full max-w-[430px] h-[100dvh] min-[460px]:h-[min(920px,calc(100dvh_-_2rem))] bg-white min-[460px]:rounded-[44px] min-[460px]:border-[10px] min-[460px]:border-neutral-800/10 min-[460px]:shadow-[0_20px_50px_rgba(0,0,0,0.12)] relative flex flex-col overflow-hidden">
        {/* Header (pinned, exit button on the right) */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
              Reports Preview · DA Admin Console
            </p>
            <h3 className="text-sm font-black mt-0.5">
              {reportType === 'users' ? 'Registered Users Report' : 'Orders Report'}
            </h3>
            <p className="text-[10px] text-emerald-100/90 mt-0.5">
              {fromDate || toDate
                ? `Period: ${fromDate || '…'} to ${toDate || '…'}`
                : 'Period: all time'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors flex-shrink-0"
            title="Exit report"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 pb-2 space-y-2.5 flex-shrink-0">
          {/* Report type segmented control */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReportType('users')}
              className={`py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                reportType === 'users'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Registered Users
            </button>
            <button
              type="button"
              onClick={() => setReportType('orders')}
              className={`py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                reportType === 'orders'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Orders
            </button>
          </div>

          {/* Date range — "all time" when left empty */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wide">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-0.5 w-full px-2 py-2 rounded-xl border border-neutral-300 text-[12px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wide">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-0.5 w-full px-2 py-2 rounded-xl border border-neutral-300 text-[12px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Clear dates (show all time)
            </button>
          )}

          {/* Summary chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {reportType === 'users' ? `${filteredUsers.length} users` : `${filteredOrders.length} orders`}
            </span>
            {reportType === 'users' && (
              <>
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {farmersCount} farmers
                </span>
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  {buyersCount} buyers
                </span>
              </>
            )}
            {reportType === 'orders' && (
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-600 text-white">
                Total value: {peso(ordersTotal)}
              </span>
            )}
          </div>
        </div>

        {/* Table (scrollable body) */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {reportType === 'users' ? (
            filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500 mt-2">
                No registrations in this period. Adjust the dates or press "Clear dates".
              </div>
            ) : (
              <table className="w-full border-collapse text-left mt-1">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Name</th>
                    <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Role</th>
                    <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Location</th>
                    <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Status</th>
                    <th className="py-1.5 text-[9px] font-black text-neutral-500 uppercase">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-100 align-top">
                      <td className="py-1.5 pr-2 text-[11px] font-bold text-neutral-800">{u.name}</td>
                      <td className="py-1.5 pr-2 text-[10px] text-neutral-600 capitalize">{u.role}</td>
                      <td className="py-1.5 pr-2 text-[10px] text-neutral-600">{u.location}</td>
                      <td className="py-1.5 pr-2">{statusChip(u.verificationStatus || 'Approved')}</td>
                      <td className="py-1.5 text-[10px] text-neutral-500 whitespace-nowrap">
                        {new Date(u.submittedAt || u.approvedAt || Date.now()).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500 mt-2">
              No orders in this period. Adjust the dates or press "Clear dates".
            </div>
          ) : (
            <table className="w-full border-collapse text-left mt-1">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Order</th>
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Buyer</th>
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Farm</th>
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Disc.</th>
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Total</th>
                  <th className="py-1.5 pr-2 text-[9px] font-black text-neutral-500 uppercase">Status</th>
                  <th className="py-1.5 text-[9px] font-black text-neutral-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2 text-[10px] font-bold text-neutral-800 whitespace-nowrap">#{String(o.id).replace('#', '')}</td>
                    <td className="py-1.5 pr-2 text-[10px] text-neutral-600">{o.buyerName}</td>
                    <td className="py-1.5 pr-2 text-[10px] text-neutral-600">{o.farmName}</td>
                    <td className="py-1.5 pr-2 text-[10px] whitespace-nowrap">
                      {(Number(o.bulkDiscount) || 0) > 0 ? (
                        <span className="font-bold text-emerald-700">−{peso(Number(o.bulkDiscount))}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-[10px] font-black text-emerald-700 whitespace-nowrap">{peso(Number(o.totalAmount) || 0)}</td>
                    <td className="py-1.5 pr-2">{statusChip(o.status)}</td>
                    <td className="py-1.5 text-[10px] text-neutral-500 whitespace-nowrap">
                      {new Date(o.createdAt || o.paidAt || Date.now()).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="flex items-center gap-1 text-[9px] text-neutral-400 mt-3">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Rendered live from the app database — press ✕ (or Esc) to exit the report.
          </p>
        </div>
      </div>
    </div>
  );
};
