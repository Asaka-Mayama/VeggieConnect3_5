// VeggieConnect buyer Market catalog builder.
//
// The buyer Market shows ONE anonymized entry per crop — buyers browse and
// submit purchase requests per crop, never per farmer. When several farmers
// list the same crop, that entry's "kg left" is the SUM of every farmer's
// available stock (e.g. Farmer A 50 kg + Farmer B 50 kg of Calamansi → the
// Market shows 100 kg), with the best-stocked listing kept as the display
// base (photo, freshness status, price). Fulfillment still allocates across
// each farmer's actual lot via the sourcing plan, so the combined figure is
// always truly available.
import { ProduceItem } from '../types';

export interface MarketCatalogFarmerKeys {
  /** Registered farmer account ids allowed to surface crops in the Market. */
  validFarmerIds: Set<string>;
  validFarmNames: Set<string>;
  validFarmerNames: Set<string>;
}

export interface MarketCatalogHub {
  location: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export const marketStockOf = (v?: ProduceItem | null): number =>
  v ? (typeof v.stockQuantity === 'number' ? v.stockQuantity : parseInt(String(v.stockQuantity), 10) || 0) : 0;

/** Admin/supermarket warehouse records never enter the buyer Market. */
export const isAdminStockRecord = (p: ProduceItem): boolean =>
  p.sellerStoreName === 'VeggieConnect Supermarket' ||
  p.sellerStatus === 'bought_and_stocked' ||
  p.farmName === 'VeggieConnect Supermarket' ||
  p.farmerName === 'VeggieConnect Central Produce Hub' ||
  p.farmerId === 'admin-main' ||
  (typeof p.id === 'string' && p.id.startsWith('sm-'));

export function buildBuyerMarketCatalog(
  produceList: ProduceItem[],
  keys: MarketCatalogFarmerKeys,
  hub: MarketCatalogHub
): ProduceItem[] {
  const isOwnedByRegisteredFarmer = (p: ProduceItem): boolean =>
    Boolean(
      (p.farmerId && keys.validFarmerIds.has(p.farmerId)) ||
        (p.farmName && keys.validFarmNames.has(p.farmName.trim().toLowerCase())) ||
        (p.farmerName && keys.validFarmerNames.has(p.farmerName.trim().toLowerCase()))
    );

  // One combined entry per crop: stock is summed across every farmer's
  // available listing of that crop; the best-stocked listing remains the
  // display base and the loosest minimum order wins.
  interface CropAggregate {
    base: ProduceItem;
    totalStock: number;
    minOrder: number;
  }
  const byName = new Map<string, CropAggregate>();
  produceList.forEach((item) => {
    if (!item) return;
    if (isAdminStockRecord(item)) return; // Admin warehouse stock is never listed
    if (!isOwnedByRegisteredFarmer(item)) return; // Not a current farmer's listed crop
    if (item.sellerStatus === 'archived' || item.sellerStatus === 'sold_out') return;
    if (marketStockOf(item) <= 0) return; // Stock 0 = hidden from Market
    const normName = (item.name || '').trim().toLowerCase();
    if (!normName) return;
    const itemMinOrder = item.minOrderQuantity && item.minOrderQuantity > 0 ? item.minOrderQuantity : 1;
    const agg = byName.get(normName);
    if (!agg) {
      byName.set(normName, { base: item, totalStock: marketStockOf(item), minOrder: itemMinOrder });
    } else {
      agg.totalStock += marketStockOf(item);
      agg.minOrder = Math.min(agg.minOrder, itemMinOrder);
      if (marketStockOf(item) > marketStockOf(agg.base)) {
        agg.base = item; // best-stocked listing stays the display base
      }
    }
  });

  const anonymizedList: ProduceItem[] = [];
  byName.forEach(({ base, totalStock, minOrder }) => {
    anonymizedList.push({
      ...base,
      stockQuantity: totalStock,
      minOrderQuantity: minOrder,
      farmerName: 'VeggieConnect Central Market',
      farmName: 'VeggieConnect Central Market',
      farmerId: 'admin-main',
      sellerStoreName: 'VeggieConnect Central Market',
      sourcingRegion: 'Negros Oriental',
      location: hub.location,
      latitude: hub.lat,
      longitude: hub.lng,
      distanceKm: hub.distanceKm,
    });
  });

  return anonymizedList;
}
