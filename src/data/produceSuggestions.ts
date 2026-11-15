// VeggieConnect — Farmer "List Vegetable for Sale" autocomplete catalog.
//
// Suggestions are anchored to the DA Bantay Presyo bulletin (Negros Oriental)
// so that picking a suggested crop automatically links the listing to the
// correct DA commodity (which in turn fixes the buyer market price at
// DA Suggested Direct × 1.10 via src/utils/pricing.ts).
//
// Matching mirrors what a farmer would type: the common/local crop name
// (e.g. "Sitaw"), the English commodity name (e.g. "String Beans"), and the
// English alias inside the DA label (e.g. "Sponge Gourd" for Patola).
import { DA_DAILY_PRICES } from './daPricesData';

export interface ProduceSuggestion {
  /** Display name filled into the Produce Name field. */
  name: string;
  /** Local/English alias hint shown under the name. */
  alias: string;
  /** DA Suggested Direct farm price (₱/kg) when covered by the bulletin. */
  daSuggested?: number;
  /** True when the crop is part of the DA bulletin (price guide available). */
  daListed: boolean;
}

// Common Negros Oriental backyard crops that the current DA bulletin sheet
// does not cover. Farmers can still list them; pricing falls back to the
// farmgate + 10% admin commission rule (no DA anchor).
const EXTRA_SUGGESTIONS: Array<{ name: string; alias: string }> = [
  { name: 'Mustasa (Mustard Greens)', alias: 'Mustasa Native' },
  { name: 'Talbos ng Kamote (Camote Tops)', alias: 'Sweet Potato Leaves' },
  { name: 'Alugbati (Malabar Spinach)', alias: 'Alogbati / Vine Spinach' },
  { name: 'Saluyot (Jute Leaves)', alias: 'Saluyot Native' },
  { name: 'Singkamas (Jicama)', alias: 'Sinkamas / Mexican Turnip' },
  { name: 'Malunggay (Moringa)', alias: 'Kalamungay / Moringa Leaves' },
  { name: 'Pako (Fiddlehead Fern)', alias: 'Pako Salad Fern' },
  { name: 'Ubod ng Niyog (Coconut Heart)', alias: 'Palm Heart / Ubod' },
];

export const PRODUCE_SUGGESTIONS: ProduceSuggestion[] = [
  ...DA_DAILY_PRICES.map((item) => ({
    name: item.commodity,
    alias: item.localName || item.variety || item.commodity,
    daSuggested: item.suggestedDirectFarmPrice,
    daListed: true,
  })),
  ...EXTRA_SUGGESTIONS.map((item) => ({ ...item, daListed: false })),
];

/** Splits a crop name/alias into lowercase words for word-start ranking. */
const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[\s(),/:\-–—&.]+/)
    .filter(Boolean);

/**
 * Filters + ranks produce suggestions for a typed query.
 * Farmers think in local crop names ("Sitaw", "Sayote"), so a match on the
 * parenthesized local/English alias inside the DA label (e.g. "(Sitaw)",
 * "(Sponge Gourd)") outranks the formal commodity name. Typing "S" surfaces
 * Sitaw (String Beans), Sayote and Patola (Sponge Gourd) among the first rows.
 */
export function getProduceSuggestions(query: string, limit: number = 8): ProduceSuggestion[] {
  const q = query.toLowerCase().trim();
  const ranked = PRODUCE_SUGGESTIONS.map((item) => {
    if (!q) {
      // Empty input: surface the everyday lowland crops first (DA order).
      return { item, rank: item.daListed ? 1 : 0 };
    }
    const primary = item.name.toLowerCase();
    const alias = item.alias.toLowerCase();

    // Local term inside the formal name, e.g. "String Beans (Sitaw)" -> "sitaw"
    const parenMatch = item.name.match(/\(([^)]+)\)/);
    const parenWords = parenMatch ? words(parenMatch[1]) : [];

    let rank = 0;
    if (parenWords.some((w) => w.startsWith(q))) rank = 6;
    else if (primary.startsWith(q)) rank = 5;
    else if (words(item.name).some((w) => w.startsWith(q))) rank = 4;
    else if (words(item.alias).some((w) => w.startsWith(q))) rank = 3;
    else if (primary.includes(q) || alias.includes(q)) rank = 2;
    return { item, rank };
  }).filter((r) => r.rank > 0);

  ranked.sort((a, b) => b.rank - a.rank || a.item.name.localeCompare(b.item.name));
  return ranked.slice(0, limit).map((r) => r.item);
}
