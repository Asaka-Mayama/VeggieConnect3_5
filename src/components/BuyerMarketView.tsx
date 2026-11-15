import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Flame,
  MapPin,
  ArrowUpDown,
} from 'lucide-react';
import { ProduceItem, HarvestStatus } from '../types';
import { ProduceCard } from './ProduceCard';
import { buyerUnitPrice } from '../utils/pricing';

interface BuyerMarketViewProps {
  produceList: ProduceItem[];
  onSelectProduce: (produce: ProduceItem) => void;
  /** Buyer action: add THIS crop to the cart for later request building. */
  onAddToCart?: (produce: ProduceItem, e: React.MouseEvent) => void;
  cartItemIds?: Set<string>;
  isBuyer?: boolean;
}

export const BuyerMarketView: React.FC<BuyerMarketViewProps> = ({
  produceList,
  onSelectProduce,
  onAddToCart,
  cartItemIds,
  isBuyer = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyHarvestToday, setOnlyHarvestToday] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number>(100);
  const [sortBy, setSortBy] = useState<'stock_high' | 'freshness' | 'price_low' | 'distance'>('stock_high');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filtered & Sorted Produce - all marketplace catalog vegetables (farmer identities anonymous)
  const filteredProduce = useMemo(() => {
    if (!Array.isArray(produceList)) return [];
    return produceList
      .filter((item) => {
        if (!item) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (item.name || '').toLowerCase().includes(q);
          const matchCategory = (item.category || '').toLowerCase().includes(q);
          const matchVar = (item.variety || '').toLowerCase().includes(q);
          if (!matchName && !matchCategory && !matchVar) return false;
        }

        // Harvest Today filter
        if (onlyHarvestToday && item.harvestStatus !== 'Harvested Today') {
          return false;
        }

        // Distance filter: only filter if user manually lowered the distance slider below 100 km
        if (maxDistance < 100) {
          const dist = typeof item.distanceKm === 'number' ? item.distanceKm : parseFloat(item.distanceKm as any) || 0;
          if (dist > maxDistance) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Price sorting uses the buyer market price (farmer price + Admin commission)
        const priceA = buyerUnitPrice(a);
        const priceB = buyerUnitPrice(b);
        if (sortBy === 'price_low') {
          return priceA - priceB;
        }
        // Default: highest stock quantity first (freshest as tiebreaker)
        const stockOf = (v: ProduceItem) =>
          typeof v.stockQuantity === 'number' ? v.stockQuantity : parseInt(String(v.stockQuantity), 10) || 0;
        const stockDiff = stockOf(b) - stockOf(a);
        if (sortBy === 'stock_high') {
          return stockDiff;
        }
        const distA = typeof a.distanceKm === 'number' ? a.distanceKm : parseFloat(a.distanceKm as any) || 0;
        const distB = typeof b.distanceKm === 'number' ? b.distanceKm : parseFloat(b.distanceKm as any) || 0;
        if (sortBy === 'distance') {
          return distA - distB;
        }
        // freshness default: Harvested Today first, then highest stock
        const score = (status?: HarvestStatus) => {
          if (status === 'Harvested Today') return 3;
          if (status === 'Fresh Picked on Order') return 2;
          if (status === 'Harvesting Tomorrow AM') return 1;
          return 0;
        };
        const freshnessDiff = score(b.harvestStatus) - score(a.harvestStatus);
        if (freshnessDiff !== 0) {
          return freshnessDiff;
        }
        return stockDiff;
      });
  }, [produceList, searchQuery, onlyHarvestToday, maxDistance, sortBy]);

  return (
    <div className="flex flex-col space-y-4 p-3.5 pb-8 w-full">
      {/* Compact Market Header — purchase requests are now raised from the
          CART menu ("Request Crops"), so the Market itself has no request
          trigger here anymore. */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-emerald-950 font-display leading-tight">
            Today&apos;s Market
          </h2>
          <p className="text-[11px] text-neutral-500 font-medium truncate">
            {produceList.length} crops available today
          </p>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-emerald-700/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-market-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog: spinach, tomatoes, carrots, cabbage..."
            className="w-full min-h-[46px] bg-white border border-emerald-200/90 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-emerald-950 placeholder-emerald-800/40 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-sm p-1 cursor-pointer font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <button
          id="btn-toggle-filters"
          onClick={() => setShowFilterDrawer(!showFilterDrawer)}
          className={`min-h-[46px] min-w-[46px] p-2.5 rounded-2xl border text-xs flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer ${
            showFilterDrawer || onlyHarvestToday || maxDistance < 100
              ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
              : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
          }`}
          title="Filter and Sort options"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Expandable Quick Filter Panel */}
      {showFilterDrawer && (
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-4 space-y-3.5 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
            <span>Market Filters</span>
            <button
              onClick={() => {
                setOnlyHarvestToday(false);
                setMaxDistance(100);
                setSortBy('freshness');
              }}
              className="text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {/* Harvested Today Quick Toggle */}
            <button
              id="btn-filter-harvest-today"
              onClick={() => setOnlyHarvestToday(!onlyHarvestToday)}
              className={`min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                onlyHarvestToday
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200/70 hover:bg-emerald-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Harvested Today Only
            </button>
          </div>

          {/* Distance Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-emerald-900">
              <span className="flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Max Sourcing Distance
              </span>
              <span className="font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                {maxDistance >= 100 ? 'All Negros Oriental (Any distance)' : `${maxDistance} km`}
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-100 rounded-lg"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 text-xs text-emerald-900 pt-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-[11px]">Sort:</span>
            <div className="flex gap-1.5">
              {(['stock_high', 'freshness', 'price_low', 'distance'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    sortBy === s
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100'
                  }`}
                >
                  {s === 'stock_high' ? 'Stock: High' : s === 'freshness' ? 'Freshness' : s === 'price_low' ? 'Price: Low' : 'Distance'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Produce Results Header */}
      <div className="flex items-center justify-between text-xs text-emerald-900 pt-1 px-1">
        <span>
          Showing <strong className="text-emerald-950 font-bold">{filteredProduce.length}</strong> vegetables in catalog
        </span>
        {onlyHarvestToday && (
          <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full">
            <Flame className="w-3 h-3 fill-emerald-600 text-emerald-600" /> Morning Harvests
          </span>
        )}
      </div>

      {/* Produce Grid */}
      {filteredProduce.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredProduce.map((produce) => (
            <ProduceCard
              key={produce.id}
              produce={produce}
              onSelect={onSelectProduce}
              onAddToCart={onAddToCart}
              isInCart={cartItemIds ? cartItemIds.has(produce.id) : false}
              isBuyer={isBuyer}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-emerald-100 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
            🥬
          </div>
          <h3 className="text-base font-bold text-emerald-950 font-display">No Farmer Crops Available Right Now</h3>
          <p className="text-xs text-neutral-600 max-w-xs mx-auto leading-relaxed">
            No crops match your filters right now. Open the Cart menu and tap &quot;Request Crops&quot; to submit the exact vegetables and quantities you need.
          </p>
        </div>
      )}
    </div>
  );
};
