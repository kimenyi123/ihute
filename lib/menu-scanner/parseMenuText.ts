/**
 * Menu text parser — high precision extraction, descriptions supported.
 */

export interface ParsedMenuItem {
  name: string;
  price: number | null;
  currency: string;
  description: string;
  category: string;
  subcategory: string;
  dietary_tags: string[];
}

function normalizeItemName(raw: string): string {
  return raw
    .replace(/\.{2,}/g, "")
    .replace(/_{2,}/g, "")
    .replace(/\s+$/, "")
    .replace(/^\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDescriptionLine(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  if (
    (t.startsWith("(") && t.endsWith(")")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    t = t.slice(1, -1).trim();
  } else if (t.startsWith("(") || t.startsWith("[")) {
    t = t.replace(/^[(\[]/, "").replace(/[)\]]\s*$/, "").trim();
  }
  return t;
}

function toTitleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCommaThousands(priceStr: string): boolean {
  return /\d{1,3},\d{3}/.test(priceStr.replace(/[^\d,]/g, ""));
}

function extractDietaryTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (lower.match(/\(v\)|\bvegetarian\b/)) tags.push("vegetarian");
  if (lower.match(/\(vg\)|\bvegan\b/)) tags.push("vegan");
  if (lower.match(/\(gf\)|\bgluten-free\b|\bgluten free\b/))
    tags.push("gluten-free");
  if (lower.match(/🌶|🔥|\bspicy\b|\bhot\b/)) tags.push("spicy");
  if (lower.match(/\bhalal\b/)) tags.push("halal");
  if (lower.match(/\bkosher\b/)) tags.push("kosher");
  if (lower.match(/\borganic\b/)) tags.push("organic");
  return [...new Set(tags)];
}

function parsePriceValue(str: string): number | null {
  let cleaned = str
    .replace(/[^\d.,\s]/g, "")
    .replace(/\s/g, "")
    .replace(/^[.,]+/, "")
    .replace(/[.,]+$/, "")
    .trim();
  if (!cleaned) return null;
  if (/,\d{3}(?:$|,)/.test(cleaned) || /^\d{1,3}(,\d{3})+\.?\d*$/.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/,/g, ""));
    if (isNaN(num) || num <= 0 || num >= 10_000_000) return null;
    return num;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/\./g, ""));
    if (isNaN(num) || num <= 0 || num >= 10_000_000) return null;
    return num;
  }
  const num = parseFloat(cleaned.replace(",", "."));
  if (isNaN(num) || num <= 0 || num >= 10_000_000) return null;
  return num;
}

function resolveCurrency(priceStr: string): string {
  const sym = priceStr.match(/[₩$€£¥]/)?.[0];
  if (sym) return sym;
  return isCommaThousands(priceStr) ? "RWF" : "RWF";
}

function letterCount(s: string): number {
  return (s.match(/\p{L}/gu) || s.match(/[a-zA-Z]/g) || []).length;
}

function isPriceOnlyLine(line: string): boolean {
  const t = line
    .trim()
    .replace(/^[.,\s₩$€£¥\-]+/, "")
    .replace(/[.,\s₩$€£¥]+$/, "");
  if (!t) return false;
  if (letterCount(t) > 0) return false;
  const digitCount = (t.match(/\d/g) || []).length;
  if (digitCount > 10 || digitCount < 1) return false;
  const val = parsePriceValue(line);
  return val != null && val > 0;
}

function isCategoryLine(
  line: string,
  lines?: string[],
  idx?: number
): boolean {
  const t = line.trim();
  if (t.length > 25 || t.length < 2) return false;
  if (isPriceOnlyLine(line)) return false;
  if (/[$€£¥₩]\s*\d/.test(t)) return false;
  if (t !== t.toUpperCase()) return false;
  if (letterCount(t) < 2) return false;
  const words = t.split(/\s+/).filter((w) => letterCount(w) > 0);
  if (words.length >= 3) return false;
  if (lines != null && idx != null) {
    for (let j = idx + 1; j < Math.min(idx + 3, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (isPriceOnlyLine(next)) return false;
      break;
    }
  }
  return true;
}

function isSubcategoryLine(line: string): boolean {
  const t = line.trim();
  return (
    t.length >= 2 &&
    t.length <= 40 &&
    t === t.toUpperCase() &&
    !isPriceOnlyLine(line)
  );
}

function isDescriptionLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!(t.startsWith("(") || t.startsWith("["))) return false;
  if (isPriceOnlyLine(line) || isCategoryLine(line)) return false;
  return letterCount(t) >= 2;
}

function isFragmentOrDescriptionLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return false;
  if (
    isPriceOnlyLine(line) ||
    isCategoryLine(line) ||
    isSubcategoryLine(line)
  )
    return false;
  if (t.startsWith("(") || t.startsWith("[")) return true;
  const parts = t.split(/\s*,\s*/).filter(Boolean);
  if (
    parts.length >= 4 &&
    parts.every((p) => p.length <= 10 && letterCount(p) >= 1)
  )
    return true;
  return false;
}

function isNameLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 250) return false;
  if (letterCount(t) < 2) return false;
  if (/^[\d.,\s₩$€£¥\-]+$/.test(t)) return false;
  if (/^\d+([.,]\d+)?\s*$/.test(t)) return false;
  if (isPriceOnlyLine(line)) return false;
  if (isDescriptionLine(line)) return false;
  if (isFragmentOrDescriptionLine(line)) return false;
  return true;
}

function isValidItemName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2 || n.length > 250) return false;
  if (letterCount(n) < 2) return false;
  if (/^\d+([.,]\d+)?\s*$/.test(n)) return false;
  if (n.startsWith("(") || n.startsWith("[")) return false;
  if (
    n === n.toUpperCase() &&
    n.length <= 2 &&
    !n.includes(",") &&
    !n.includes(" ")
  )
    return false;
  const parts = n.split(/\s*,\s*/).filter(Boolean);
  if (parts.length >= 4 && parts.every((p) => p.length <= 8)) return false;
  return true;
}

function findPriceInLine(
  line: string
): { priceStr: string; priceValue: number; currency: string; index: number } | null {
  const patterns: (RegExp | { pattern: RegExp; group?: number })[] = [
    /[₩$€£¥]\s*\d{1,6}[.,]?\d{0,2}\s*[₩$€£¥]?/g,
    /\d{1,3}(,\d{3})+(\.\d+)?/g,
    /\d{1,6}[.,]\d{1,2}\s*[₩$€£¥]?/g,
    /\d{1,6}[.,]\d{1,2}/g,
    /\s\d{1,6}[.,]?\d{0,2}\s*$/,
    /[.\s]\d{1,6}[.,]?\d{0,2}\s*$/,
    { pattern: /(?:\.{2,}|\s)(\d{1,3}(?:,\d{3})*|\d{2,7})\s*$/, group: 1 },
  ];

  let best: {
    priceStr: string;
    priceValue: number;
    currency: string;
    index: number;
  } | null = null;

  for (const entry of patterns) {
    const pattern = "pattern" in entry ? entry.pattern : entry;
    const group = "group" in entry ? entry.group : undefined;
    if (pattern instanceof RegExp && pattern.global) {
      const matches = line.match(pattern);
      if (matches && matches.length > 0) {
        const last = matches[matches.length - 1].trim();
        const idx = line.lastIndexOf(last);
        const val = parsePriceValue(last);
        if (
          val != null &&
          val > 0 &&
          val < 10_000_000 &&
          (val >= 10 || !/\d{3,}/.test(line))
        ) {
          const curr = resolveCurrency(last);
          if (!best || idx > best.index)
            best = {
              priceStr: last,
              priceValue: val,
              currency: curr,
              index: idx,
            };
        }
      }
    } else {
      const match = line.match(pattern as RegExp);
      if (match) {
        const full =
          (group != null ? match[group] : match[0])?.trim() ?? "";
        const val = parsePriceValue(full);
        if (
          val != null &&
          val > 0 &&
          val < 10_000_000 &&
          full &&
          (val >= 10 || !/\d{3,}/.test(line))
        ) {
          const index = line.lastIndexOf(full);
          if (
            index >= 0 &&
            (!best || index > best.index)
          )
            best = {
              priceStr: full,
              priceValue: val,
              currency: resolveCurrency(full),
              index,
            };
        }
      }
    }
  }
  return best;
}

export function findDuplicateItemKeys(
  items: ParsedMenuItem[]
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const key = `${(item.name || "").trim().toLowerCase()}|${item.price ?? ""}`;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return duplicates;
}

function filterValidItems(items: ParsedMenuItem[]): ParsedMenuItem[] {
  return items.filter(
    (item) =>
      isValidItemName(item.name) &&
      (item.price == null ||
        (item.price > 0 && item.price < 10_000_000)) &&
      (item.category || "Uncategorized").length <= 120
  );
}

function parseTwoBlockLayout(
  lines: string[],
  currentCategory: string
): { items: ParsedMenuItem[]; restLines: string[] } {
  const items: ParsedMenuItem[] = [];
  let i = 0;
  type NameWithMeta = {
    line: string;
    category: string;
    subcategory: string;
    description?: string;
  };
  const namesWithMeta: NameWithMeta[] = [];
  const priceLines: string[] = [];
  let currentSubcategory = "";

  const pushPairs = (nMeta: NameWithMeta[], pLines: string[]) => {
    const pairs = Math.min(nMeta.length, pLines.length);
    for (let p = 0; p < pairs; p++) {
      const { line, category, subcategory, description } = nMeta[p];
      const name = normalizeItemName(line);
      const priceStr = pLines[p];
      const priceVal = parsePriceValue(priceStr);
      const currency = resolveCurrency(priceStr);
      if (!isValidItemName(name)) continue;
      items.push({
        name,
        price: priceVal,
        currency,
        description: (description || "").trim(),
        category: toTitleCase(category),
        subcategory: toTitleCase(subcategory),
        dietary_tags: extractDietaryTags(line),
      });
    }
    for (let p = pairs; p < nMeta.length; p++) {
      const { line, category, subcategory, description } = nMeta[p];
      const name = normalizeItemName(line);
      if (!isValidItemName(name)) continue;
      items.push({
        name,
        price: null,
        currency: "RWF",
        description: (description || "").trim(),
        category: toTitleCase(category),
        subcategory: toTitleCase(subcategory),
        dietary_tags: extractDietaryTags(line),
      });
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isCategoryLine(line, lines, i)) {
      currentCategory = line.trim();
      currentSubcategory = "";
      i++;
      continue;
    }

    if (
      isSubcategoryLine(line) &&
      namesWithMeta.length === 0 &&
      priceLines.length === 0
    ) {
      let nextIsPrice = false;
      for (let k = i + 1; k < Math.min(i + 3, lines.length); k++) {
        const nxt = lines[k].trim();
        if (!nxt) continue;
        if (isPriceOnlyLine(nxt)) {
          nextIsPrice = true;
        }
        break;
      }
      if (!nextIsPrice) {
        currentSubcategory = line.trim();
        i++;
        continue;
      }
    }

    if (isPriceOnlyLine(line)) {
      if (namesWithMeta.length === 1) {
        const { line: nameLine, category, subcategory } = namesWithMeta[0];
        const name = normalizeItemName(nameLine);
        const priceVal = parsePriceValue(line);
        const currency = resolveCurrency(line);
        if (isValidItemName(name) && priceVal != null && priceVal > 0) {
          items.push({
            name,
            price: priceVal,
            currency,
            description: (namesWithMeta[0].description || "").trim(),
            category: toTitleCase(category),
            subcategory: toTitleCase(subcategory),
            dietary_tags: extractDietaryTags(nameLine),
          });
        }
        namesWithMeta.length = 0;
      } else if (namesWithMeta.length === 0 && items.length > 0) {
        const last = items[items.length - 1];
        if (last.price == null || last.price <= 0) {
          const priceVal = parsePriceValue(line);
          const currency = resolveCurrency(line);
          if (priceVal != null && priceVal > 0) {
            last.price = priceVal;
            last.currency = currency;
          }
        } else {
          priceLines.push(line);
        }
      } else {
        priceLines.push(line);
      }
      i++;
      continue;
    }

    if (isDescriptionLine(line) || isFragmentOrDescriptionLine(line)) {
      const desc =
        line.startsWith("(") || line.startsWith("[")
          ? normalizeDescriptionLine(line)
          : line.trim().replace(/\s+/g, " ");
      if (namesWithMeta.length > 0) {
        const last = namesWithMeta[namesWithMeta.length - 1];
        last.description = last.description
          ? `${last.description} ${desc}`
          : desc;
      } else if (items.length > 0) {
        const last = items[items.length - 1];
        last.description = last.description
          ? `${last.description} ${desc}`
          : desc;
      }
      i++;
      continue;
    }

    if (isNameLine(line)) {
      const priceOnLine = findPriceInLine(line);
      if (priceOnLine) {
        const name = normalizeItemName(
          line.substring(0, priceOnLine.index)
        );
        if (isValidItemName(name) && priceOnLine.priceValue > 0) {
          items.push({
            name,
            price: priceOnLine.priceValue,
            currency: priceOnLine.currency,
            description: "",
            category: toTitleCase(currentCategory),
            subcategory: toTitleCase(currentSubcategory),
            dietary_tags: extractDietaryTags(line),
          });
        }
        i++;
        continue;
      }
      if (priceLines.length > 0) {
        pushPairs(namesWithMeta, priceLines);
        namesWithMeta.length = 0;
        priceLines.length = 0;
      }
      namesWithMeta.push({
        line,
        category: currentCategory,
        subcategory: currentSubcategory,
      });
      i++;
      continue;
    }

    i++;
  }

  if (namesWithMeta.length > 0 && priceLines.length > 0) {
    pushPairs(namesWithMeta, priceLines);
  }

  return { items: filterValidItems(items), restLines: [] };
}

export function parseMenuText(text: string): ParsedMenuItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let currentCategory = "Uncategorized";

  const twoBlock = parseTwoBlockLayout(lines, currentCategory);
  if (twoBlock.items.length > 0) {
    return twoBlock.items;
  }

  const items: ParsedMenuItem[] = [];
  currentCategory = "Uncategorized";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isCategoryLine(line, lines, i)) {
      currentCategory = line.trim();
      continue;
    }

    const priceInfo = findPriceInLine(line);
    if (!priceInfo) continue;

    const { priceValue, currency, index } = priceInfo;
    const priceStr = priceInfo.priceStr;
    const name = normalizeItemName(line.substring(0, index));

    if (!isValidItemName(name)) continue;

    let description = line.substring(index + priceStr.length).trim();
    while (i + 1 < lines.length && isDescriptionLine(lines[i + 1])) {
      i++;
      const extra = normalizeDescriptionLine(lines[i]);
      description = description ? `${description} ${extra}` : extra;
    }

    items.push({
      name,
      price: priceValue,
      currency,
      description: description || "",
      category: toTitleCase(currentCategory),
      subcategory: "",
      dietary_tags: extractDietaryTags(line),
    });
  }

  return filterValidItems(items);
}
