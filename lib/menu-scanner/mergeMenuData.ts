import type { MenuItem } from "@/types/menu-scanner";

export function mergeMenuData(
  pagesData: { items: MenuItem[] }[]
): Omit<MenuItem, "id">[] {
  const allItems: Omit<MenuItem, "id">[] = [];

  pagesData.forEach((pageData, index) => {
    (pageData.items || []).forEach((item) => {
      const { id: _id, ...rest } = item as MenuItem;
      allItems.push({
        ...rest,
        subcategory: rest.subcategory ?? "",
        page_number: rest.page_number ?? index + 1,
      });
    });
  });

  const unique = removeDuplicates(allItems);
  return unique.sort((a, b) => {
    const catA = (a.category || "Uncategorized").toLowerCase();
    const catB = (b.category || "Uncategorized").toLowerCase();
    if (catA !== catB) return catA.localeCompare(catB);
    const subA = (a.subcategory || "").toLowerCase();
    const subB = (b.subcategory || "").toLowerCase();
    if (subA !== subB) return subA.localeCompare(subB);
    return (a.name || "").localeCompare(b.name || "");
  });
}

function normalizeKey(name: string, price: number | null): string {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  const p = price != null ? String(price) : "none";
  return `${n}_${p}`;
}

export function removeDuplicates(
  items: Omit<MenuItem, "id">[]
): Omit<MenuItem, "id">[] {
  const seen = new Map<string, boolean>();
  return items.filter((item) => {
    const key = normalizeKey(item.name, item.price);
    if (seen.get(key)) return false;
    seen.set(key, true);
    return true;
  });
}

export function addIds(items: Omit<MenuItem, "id">[]): MenuItem[] {
  return items.map((item, i) => ({
    ...item,
    id: `item-${i}-${Date.now()}`,
  }));
}
