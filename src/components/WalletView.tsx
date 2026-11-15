import React, { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  History,
  Info,
  CircleDollarSign,
  ClipboardList,
  Store,
} from 'lucide-react';
import { UserProfile, WalletTransaction } from '../types';

interface WalletViewProps {
  currentUser: UserProfile;
  /** Credits the wallet by the given amount (prototype deposit). */
  onDeposit: (amount: number) => void;
  onNavigateTab?: (tab: string) => void;
}

// Prototype rule: every deposit must load at least ₱100 into the wallet.
const MIN_DEPOSIT = 100;
const PRESET_AMOUNTS = [100, 500, 1000, 5000];

const formatPeso = (value: number) =>
  `₱${(Number(value) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const txMeta: Record<
  WalletTransaction['type'],
  { label: string; Icon: React.FC<any>; positive: boolean; color: string }
> = {
  deposit: {
    label: 'Deposit',
    Icon: ArrowDownLeft,
    positive: true,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  payment: {
    label: 'Order Payment',
    Icon: ArrowUpRight,
    positive: false,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  refund: {
    label: 'Refund',
    Icon: ArrowDownLeft,
    positive: true,
    color: 'bg-sky-100 text-sky-800 border-sky-200',
  },
};

export const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  onDeposit,
  onNavigateTab,
}) => {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [preset, setPreset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const balance = Number(currentUser?.walletBalance ?? 0);
  const transactions = (currentUser?.walletTransactions || [])
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const openDeposit = () => {
    setPreset(null);
    setCustomAmount('');
    setError(null);
    setIsDepositOpen(true);
  };

  const resolveAmount = (): number | null => {
    const raw = preset !== null ? String(preset) : customAmount.trim().replace(/[^0-9.]/g, '');
    const value = Math.round((parseFloat(raw) || 0) * 100) / 100;
    if (!value || value <= 0) return null;
    return value;
  };

  const handleDeposit = () => {
    const value = resolveAmount();
    if (value === null) {
      setError(`Enter a deposit amount of at least ₱${MIN_DEPOSIT.toLocaleString()} (e.g. 500).`);
      return;
    }
    if (value < MIN_DEPOSIT) {
      setError(`Minimum deposit amount is ₱${MIN_DEPOSIT.toLocaleString()}. Please enter ₱${MIN_DEPOSIT.toLocaleString()} or more.`);
      return;
    }
    setIsProcessing(true);
    // Simulated gateway processing (prototype) then credit the wallet.
    setTimeout(() => {
      setIsProcessing(false);
      setIsDepositOpen(false);
      onDeposit(value);
    }, 550);
  };

  return (
    <div className="flex flex-col space-y-4 p-3.5 pb-8 w-full bg-white text-neutral-900">
      {/* View Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-emerald-950 font-display">My Wallet</h2>
          <p className="text-xs text-emerald-800/80 font-medium">
            VeggieConnect Pay — deposit money, then pay approved orders before pickup
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
          wallet
        </span>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-600 text-white p-5 shadow-lg shadow-emerald-600/25">
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-black/10" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
            <Wallet className="w-4 h-4" />
            <span>VeggieConnect Pay Balance</span>
          </div>
          <div className="mt-2 text-4xl font-black tracking-tight">{formatPeso(balance)}</div>
          <p className="mt-1.5 text-[11px] font-medium text-emerald-100">
            {currentUser.name} • {currentUser.phone || 'no phone on file'}
          </p>

          <button
            id="btn-wallet-deposit"
            onClick={openDeposit}
            className="mt-4 w-full min-h-[48px] rounded-2xl bg-white text-emerald-800 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform cursor-pointer hover:bg-emerald-50"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Deposit</span>
          </button>
        </div>
      </div>

      {/* Deposit Panel */}
      {isDepositOpen && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
              <CircleDollarSign className="w-4 h-4 text-emerald-700" />
              Deposit Money
            </h3>
            <button
              onClick={() => setIsDepositOpen(false)}
              className="text-[11px] font-bold text-neutral-500 hover:text-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setPreset(amount);
                  setCustomAmount('');
                  setError(null);
                }}
                className={`min-h-[44px] rounded-xl text-xs font-extrabold border transition-all cursor-pointer active:scale-95 ${
                  preset === amount
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/60'
                }`}
              >
                ₱{amount.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">
              Or enter a custom amount (minimum ₱{MIN_DEPOSIT.toLocaleString()})
            </label>
            <input
              id="input-wallet-deposit-amount"
              type="number"
              min={String(MIN_DEPOSIT)}
              step="1"
              inputMode="decimal"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setPreset(null);
                setError(null);
              }}
              placeholder={`e.g. 500 (min ₱${MIN_DEPOSIT.toLocaleString()})`}
              className="w-full min-h-[44px] bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-950 font-bold focus:outline-none focus:border-emerald-600"
            />
          </div>

          {error && (
            <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            id="btn-wallet-deposit-confirm"
            onClick={handleDeposit}
            disabled={isProcessing}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing deposit…</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Deposit {(() => {
                  const v = resolveAmount();
                  return v !== null ? formatPeso(v) : 'to Wallet';
                })()}</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-neutral-500 flex items-start gap-1.5 leading-relaxed">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>
              Prototype mode: deposits are simulated for demonstration — no real money is
              charged. Minimum deposit is ₱{MIN_DEPOSIT.toLocaleString()}. Use the balance to pay
              approved orders before the live transaction.
            </span>
          </p>
        </div>
      )}

      {/* How payment works */}
      <div className="bg-white border border-emerald-200/90 rounded-3xl p-4 space-y-2">
        <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-emerald-700" />
          How wallet payment works
        </h3>
        <ol className="text-[11px] text-neutral-600 space-y-1.5 list-decimal pl-4">
          <li>Deposit money here so your wallet has a balance.</li>
          <li>Place your order from the Market — it goes to the Admin for approval.</li>
          <li>
            Once the Admin <strong>approves</strong> your order, pay it from this wallet in{' '}
            <strong>Orders ▸ Pay Now</strong>.
          </li>
          <li>The live transaction (pickup / transport) only starts after you pay.</li>
          <li>
            If a product becomes unavailable, the Admin returns its amount here as a refund —
            the order itself is not cancelled.
          </li>
        </ol>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onNavigateTab && onNavigateTab('market')}
            className="flex-1 min-h-[40px] rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-100/70 transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Go to Market</span>
          </button>
          <button
            onClick={() => onNavigateTab && onNavigateTab('orders')}
            className="flex-1 min-h-[40px] rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-100/70 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>My Orders</span>
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white border border-emerald-200/90 rounded-3xl p-4">
        <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5 mb-3">
          <History className="w-4 h-4 text-emerald-700" />
          Wallet History
        </h3>
        {transactions.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Wallet className="w-8 h-8 text-neutral-300 mx-auto stroke-[1.5]" />
            <p className="text-xs font-bold text-neutral-700">No wallet activity yet</p>
            <p className="text-[11px] text-neutral-500">
              Tap <strong>Deposit</strong> to load your VeggieConnect Pay balance.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const meta = txMeta[tx.type] || txMeta.deposit;
              const { Icon } = meta;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-2.5 bg-neutral-50/80 border border-neutral-200/80 rounded-2xl px-3 py-2.5"
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">
                      {tx.description}
                      {tx.orderId ? (
                        <span className="ml-1 font-mono text-[10px] text-neutral-500">
                          #{tx.orderId}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(tx.timestamp).toLocaleString()} • Balance {formatPeso(tx.balanceAfter)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-black flex-shrink-0 ${
                      meta.positive ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {meta.positive ? '+' : '−'}
                    {formatPeso(tx.amount).replace('₱', '₱')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
