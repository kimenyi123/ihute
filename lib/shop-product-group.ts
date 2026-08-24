/** Product group deep links from GQ QR (?group=imiti|ibiryo). */

export type ShopProductGroup = "imiti" | "ibiryo";

export function normalizeShopGroup(raw: string): ShopProductGroup | "" {
  const g = raw.trim().toLowerCase();
  if (g === "imiti" || g === "medicine" || g === "medicines" || g === "pharma" || g === "pharmacy") {
    return "imiti";
  }
  if (
    g === "ibiryo" ||
    g === "food" ||
    g === "groceries" ||
    g === "grocery" ||
    g === "supermarket" ||
    g === "boutique" ||
    g === "butike"
  ) {
    return "ibiryo";
  }
  return "";
}

const GROUP_MATCHERS: Record<ShopProductGroup, RegExp> = {
  imiti: /imiti|medicine|medicament|pharma|drug|vitamin|supplement|health|pain|tablet|capsule|syrup/i,
  ibiryo:
    /ibiryo|food|grocery|groceries|snack|beverage|drink|bakery|bread|rice|pasta|juice|coffee|tea|meat|vegetable|fruit|dairy|milk|oil|flour|sugar|salt/i,
};

/** Pick the best category name for a group, or null to fall back to keyword search. */
export function matchCategoryForGroup(group: ShopProductGroup, categoryNames: string[]): string | null {
  const matcher = GROUP_MATCHERS[group];
  const hit = categoryNames.find((name) => matcher.test(name));
  if (hit) return hit;
  const exact = categoryNames.find((name) => normalizeShopGroup(name) === group);
  return exact ?? null;
}

export function groupSearchFallback(group: ShopProductGroup): string {
  return group === "imiti" ? "imiti" : "ibiryo";
}

export function groupDisplayLabel(group: ShopProductGroup): string {
  return group === "imiti" ? "Imiti" : "Ibiryo";
}

/** Filter products when no category section matches the group name. */
export function productMatchesGroup(group: ShopProductGroup, product: Record<string, unknown>): boolean {
  const matcher = GROUP_MATCHERS[group];
  const parts = [
    product.item_commercial_name,
    product.item_name,
    product.item_key_words,
    product.item_key_words_kinyarwanda,
    product.item_key_words_french,
    product.famille,
    product.FAMILLE,
    product.category,
    product.item_department,
  ];
  return parts.some((p) => p != null && matcher.test(String(p)));
}
