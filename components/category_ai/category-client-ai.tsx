// components/category_ai/category-client-ai.tsx
// Browse by shop (main-page style grid → Shop With Me) vs by item (sector product wall, header search only).
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import {
  ShopsForSingleSector,
  mapListSuppliersWithProductsToShops,
  type ShopInfo,
} from "@/components/category_ai/shops-by-sector";
import {
  fetchSectorStatsFromApi,
  normalizeListSuppliersPayload,
  sumProductsInListSuppliersPayload,
} from "@/lib/fetch-suggestions-helpers";
import { usePrefsStore } from "@/lib/prefs-store";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/translations";
import { cn } from "@/lib/utils";

const LIST_SECTOR_SUPPLIERS_LIMIT = 500;

export type CategoryBrowseMode = "shop" | "item";

export function CategoryClientAI({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const setSector = usePrefsStore((s) => s.setSector);
  const setCategoryBrowseMode = usePrefsStore((s) => s.setCategoryBrowseMode);
  const [sectorStats, setSectorStats] = useState<{ shops: number; items: number } | null>(null);
  const [sectorShops, setSectorShops] = useState<ShopInfo[]>([]);
  const [sectorShopsLoading, setSectorShopsLoading] = useState(true);
  /** Single listSuppliersWithProducts payload for badges + shop grid + item grid (avoids two RAND() samples from the servlet). */
  const [sectorListPayload, setSectorListPayload] = useState<unknown[] | null>(null);

  const browseMode: CategoryBrowseMode =
    searchParams.get("browse") === "item" ? "item" : "shop";

  const headerSearchSq = (searchParams.get("sq") ?? "").trim();

  useEffect(() => {
    setSector(categoryId || null);
    return () => {
      setSector(null);
      setCategoryBrowseMode("shop");
    };
  }, [categoryId, setSector, setCategoryBrowseMode]);

  useEffect(() => {
    setCategoryBrowseMode(browseMode === "item" ? "item" : "shop");
  }, [browseMode, setCategoryBrowseMode]);

  /** One listSuppliersWithProducts call: badges (N / I) + shop grid data (no second fetch for cards). */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSectorShopsLoading(true);
      const sid = (categoryId || "").trim().toLowerCase();
      if (!sid) {
        setSectorShops([]);
        setSectorStats({ shops: 0, items: 0 });
        setSectorListPayload([]);
        setSectorShopsLoading(false);
        return;
      }
      setSectorListPayload(null);
      try {
        const listUrl = `/api/sector-list-suppliers?sector=${encodeURIComponent(sid)}&Currency=RWF&limit=${LIST_SECTOR_SUPPLIERS_LIMIT}&productsPerSeller=0`;
        const [stats, listRes] = await Promise.all([
          fetchSectorStatsFromApi(sid),
          fetch(listUrl, { cache: "no-store" }),
        ]);
        const rawPrimary: unknown = listRes.ok ? await listRes.json() : [];
        const mergedRows = normalizeListSuppliersPayload(rawPrimary);
        const mapped = mapListSuppliersWithProductsToShops(mergedRows);
        if (cancelled) return;
        setSectorListPayload(mergedRows);
        setSectorShops(mapped);
        const itemsSum = sumProductsInListSuppliersPayload(mergedRows);
        setSectorStats(
          stats
            ? { shops: stats.shops, items: stats.items }
            : { shops: mapped.length, items: itemsSum }
        );
      } catch {
        if (!cancelled) {
          setSectorShops([]);
          setSectorStats({ shops: 0, items: 0 });
          setSectorListPayload([]);
        }
      } finally {
        if (!cancelled) setSectorShopsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const replaceQuery = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    mutate(params);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const setBrowseMode = (mode: CategoryBrowseMode) => {
    replaceQuery((p) => {
      p.set("browse", mode);
      if (mode === "item") {
        p.delete("supplier");
        p.delete("supplierName");
        if (!p.get("sort")) p.set("sort", "price-low");
      }
    });
  };

  /** Default sort for item browse: stable DB-friendly ordering (not “trending” placeholder). */
  useEffect(() => {
    if (browseMode !== "item") return;
    if (searchParams.get("sort")) return;
    replaceQuery((p) => {
      p.set("sort", "price-low");
    });
  }, [browseMode, categoryId, searchParams]);

  return (
    <>
      <div className="mb-6 rounded-xl border bg-card p-4 md:p-5 shadow-sm">
        <p className="text-sm text-muted-foreground mb-3">
          {t("categoryBrowseByPrefix" as TranslationKey)}{" "}
          <span className="font-semibold text-foreground">{categoryName}</span>{" "}
          {t("categoryBrowseBySuffix" as TranslationKey)}
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Browse mode">
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === "shop"}
            onClick={() => setBrowseMode("shop")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-2",
              browseMode === "shop"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {t("categoryBrowseChooseShop" as TranslationKey)}
            {sectorStats != null && (
              <span
                className={cn(
                  "tabular-nums rounded-full px-2 py-0.5 text-xs font-bold",
                  browseMode === "shop" ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {sectorStats.shops}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === "item"}
            onClick={() => setBrowseMode("item")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-2",
              browseMode === "item"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {t("categoryBrowseChooseItem" as TranslationKey)}
            {sectorStats != null && (
              <span
                className={cn(
                  "tabular-nums rounded-full px-2 py-0.5 text-xs font-bold",
                  browseMode === "item" ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {sectorStats.items}
              </span>
            )}
          </button>
        </div>
      </div>

      <div id="category-ai-grid-section" className="space-y-4">
      {browseMode === "shop" && (
        <ShopsForSingleSector
          shops={sectorShops}
          loading={sectorShopsLoading}
          filterQuery={headerSearchSq}
          className="mb-4"
        />
      )}

      {browseMode === "item" && (
        <section id="products-section" className="mt-2">
          <ProductGrid
            categoryId={categoryId}
            categoryName={categoryName}
            selectedSupplier="all"
            selectedSupplierName="All Suppliers"
            browseMode="item"
            hideInlineSearch
            preloadedSectorListSuppliers={sectorListPayload}
          />
        </section>
      )}
      </div>
    </>
  );
}
