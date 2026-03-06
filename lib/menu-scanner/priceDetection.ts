/**
 * Intelligent price detection: OCR error correction and statistical validation.
 */

export interface PriceWarning {
  itemName: string;
  price: number;
  currency: string;
  message: string;
  suggestedFix?: number;
}

export interface ItemWithPrice {
  name: string;
  price: number | null;
  currency?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  dietary_tags?: string[];
  page_number?: number;
  id?: string;
}

export function preprocessOCRText(rawText: string): string {
  let cleaned = rawText;
  const fixes: { pattern: RegExp; replace: string }[] = [
    { pattern: /(\d)[oO](\d)/g, replace: "$10$2" },
    { pattern: /(\d)l(\d)/g, replace: "$11$2" },
    { pattern: /(\d)[S](\d)/gi, replace: "$15$2" },
    { pattern: /(\d)I(\d)/g, replace: "$11$2" },
  ];
  fixes.forEach(({ pattern, replace }) => {
    cleaned = cleaned.replace(pattern, replace);
  });
  return cleaned;
}

const DIGIT_SUBSTITUTIONS: [string, string][] = [
  ["6", "2"],
  ["6", "0"],
  ["8", "0"],
  ["6", "1"],
  ["9", "0"],
  ["3", "8"],
];

function ocrCandidates(price: number): number[] {
  const priceStr = String(Math.round(price));
  const seen = new Set<number>();
  const candidates: number[] = [];
  for (const [wrong, correct] of DIGIT_SUBSTITUTIONS) {
    if (!priceStr.includes(wrong)) continue;
    const firstOnly = priceStr.replace(wrong, correct);
    const v1 = parseFloat(firstOnly);
    if (!isNaN(v1) && v1 > 0 && v1 !== price && !seen.has(v1)) {
      seen.add(v1);
      candidates.push(v1);
    }
    const allOccurrences = priceStr.replaceAll(wrong, correct);
    const v2 = parseFloat(allOccurrences);
    if (!isNaN(v2) && v2 > 0 && v2 !== price && !seen.has(v2)) {
      seen.add(v2);
      candidates.push(v2);
    }
  }
  return candidates;
}

export function fixCommonOCRErrors(price: number, median?: number): number {
  if (!median || median <= 0) return price;
  const reasonableMin = median * 0.05;
  const reasonableMax = median * 8;
  const candidates = ocrCandidates(price);
  if (candidates.length === 0) return price;
  const distanceToMedian = (v: number) => Math.abs(v - median);
  const originalDist = distanceToMedian(price);
  let bestCandidate = price;
  let bestDist = originalDist;
  for (const c of candidates) {
    if (c < reasonableMin || c > reasonableMax) continue;
    const d = distanceToMedian(c);
    if (d < bestDist * 0.7) {
      bestDist = d;
      bestCandidate = c;
    }
  }
  return bestCandidate;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function computeIQR(values: number[]): {
  q1: number;
  q3: number;
  iqr: number;
} {
  const s = [...values].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length / 4)] ?? s[0];
  const q3 = s[Math.floor((s.length * 3) / 4)] ?? s[s.length - 1];
  return { q1, q3, iqr: q3 - q1 };
}

function categoryMedians(items: ItemWithPrice[]): Map<string, number> {
  const byCat = new Map<string, number[]>();
  for (const i of items) {
    if (i.price == null || i.price <= 0) continue;
    const cat = (i.category || "Uncategorized").trim();
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(i.price);
  }
  const out = new Map<string, number>();
  byCat.forEach((prices, cat) => {
    const med = computeMedian(prices);
    if (med > 0) out.set(cat, med);
  });
  return out;
}

export function validateAndCleanPrices<T extends ItemWithPrice>(
  items: T[]
): { items: T[]; warnings: PriceWarning[] } {
  const withPrice = items.filter(
    (i) => i.price != null && i.price > 0
  ) as (T & { price: number })[];
  if (withPrice.length === 0) return { items, warnings: [] };
  const prices = withPrice.map((i) => i.price);
  const globalMedian = computeMedian(prices);
  const catMedians = categoryMedians(items);
  const highThreshold = globalMedian > 0 ? globalMedian * 5 : Infinity;
  const lowThreshold = globalMedian > 0 ? globalMedian / 5 : 0;
  const warnings: PriceWarning[] = [];
  const result = items.map((item): T => {
    const p = item.price;
    if (p == null || p <= 0) return item;
    let price = p;
    const currency = item.currency ?? "RWF";
    const cat = (item.category || "Uncategorized").trim();
    const catMedian = catMedians.get(cat) ?? globalMedian;
    const median = catMedian > 0 ? catMedian : globalMedian;
    const corrected = fixCommonOCRErrors(price, median);
    const catHighThreshold = median > 0 ? median * 4 : Infinity;
    if (median > 0 && price > catHighThreshold) {
      if (corrected !== price) price = corrected;
      const typical = Math.round(median).toLocaleString();
      warnings.push({
        itemName: item.name,
        price: p,
        currency,
        message: `Unusually high for "${cat}" (others ~${typical}). Please check the menu.`,
        suggestedFix: corrected !== p ? corrected : undefined,
      });
    } else if (globalMedian > 0 && price > highThreshold) {
      if (corrected !== price) price = corrected;
      warnings.push({
        itemName: item.name,
        price: p,
        currency,
        message: "Unusually high — please verify (possible OCR error).",
        suggestedFix: corrected !== p ? corrected : undefined,
      });
    } else if (lowThreshold > 0 && price < lowThreshold) {
      const tenX = price * 10;
      const suggestedFix =
        tenX <= highThreshold && tenX >= lowThreshold ? tenX : undefined;
      warnings.push({
        itemName: item.name,
        price,
        currency,
        message: "Unusually low — please verify (e.g. missing digit).",
        suggestedFix,
      });
    } else if (corrected !== price) {
      warnings.push({
        itemName: item.name,
        price: p,
        currency,
        message: `Possible OCR misread — ${currency} ${p.toLocaleString()} vs suggested ${currency} ${corrected.toLocaleString()}. Please verify.`,
        suggestedFix: corrected,
      });
      price = corrected;
    }
    const qtyMatch =
      item.name.match(/(\d+)\s*pcs?\.?/i) || item.name.match(/\b(\d+)\b/);
    if (qtyMatch && parseFloat(qtyMatch[1]) === price) {
      warnings.push({
        itemName: item.name,
        price,
        currency,
        message:
          "Price may be confused with quantity in name — please verify.",
      });
    }
    return { ...item, price } as T;
  });
  return { items: result, warnings };
}

export function generatePriceWarnings(
  items: ItemWithPrice[]
): PriceWarning[] {
  const withPrice = items.filter((i) => i.price != null && i.price > 0);
  if (withPrice.length < 2) return [];
  const catMedians = categoryMedians(items);
  const prices = withPrice.map((i) => i.price as number);
  const globalMedian = computeMedian(prices);
  const { q1, iqr } = computeIQR(prices);
  const highThreshold = globalMedian * 5;
  const lowByMedian = globalMedian / 10;
  const lowByIqr = iqr > 0 ? q1 - 1.5 * iqr : 0;
  const lowThreshold = Math.max(
    0,
    Math.min(lowByMedian, lowByIqr > 0 ? lowByIqr : lowByMedian)
  );
  const warnings: PriceWarning[] = [];
  const seen = new Set<string>();
  const add = (w: PriceWarning, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(w);
  };
  items.forEach((item) => {
    const price = item.price;
    if (price == null || price <= 0) return;
    const currency = item.currency ?? "RWF";
    const name = item.name;
    const cat = (item.category || "Uncategorized").trim();
    const catMedian = catMedians.get(cat) ?? globalMedian;
    const median = catMedian > 0 ? catMedian : globalMedian;
    const catHigh = median * 4;
    if (median > 0 && price > catHigh) {
      const corrected = fixCommonOCRErrors(price, median);
      const typical = Math.round(median).toLocaleString();
      const suggestedFix =
        corrected !== price
          ? corrected
          : median >= 500 && median <= 50000
            ? Math.round(median)
            : undefined;
      add(
        {
          itemName: name,
          price,
          currency,
          message: `Very high for "${cat}" (others ~${typical}). Likely wrong — check menu.`,
          suggestedFix,
        },
        `cat|${name}|${price}`
      );
      return;
    }
    if (globalMedian > 0 && price > highThreshold) {
      const corrected = fixCommonOCRErrors(price, globalMedian);
      add(
        {
          itemName: name,
          price,
          currency,
          message: "Price seems very high — please verify.",
          suggestedFix: corrected !== price ? corrected : undefined,
        },
        `high|${name}|${price}`
      );
      return;
    }
    if (globalMedian > 0 && lowThreshold > 0 && price < lowThreshold) {
      const tenX = price * 10;
      add(
        {
          itemName: name,
          price,
          currency,
          message: "Price seems very low (possible missing digit).",
          suggestedFix:
            tenX >= lowThreshold && tenX <= highThreshold ? tenX : undefined,
        },
        `low|${name}|${price}`
      );
      return;
    }
    const corrected = fixCommonOCRErrors(price, median);
    if (corrected !== price) {
      add(
        {
          itemName: name,
          price,
          currency,
          message: `Possible OCR misread — suggested ${currency} ${corrected.toLocaleString()}. Please verify.`,
          suggestedFix: corrected,
        },
        `ocr|${name}|${price}`
      );
    }
    const qtyMatch = item.name.match(/(\d+)\s*pcs?\.?/i);
    if (qtyMatch && parseFloat(qtyMatch[1]) === price) {
      add(
        {
          itemName: name,
          price,
          currency,
          message: "Price may be confused with quantity (e.g. 2pcs).",
        },
        `qty|${name}|${price}`
      );
    }
  });
  return warnings;
}
