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
import {
  isPharmacyCategoryId,
  PharmacyErxInput,
  type ErxUnlockKey,
} from "@/components/category_ai/pharmacy-erx-input"
import { PharmacyErxResult } from "@/components/category_ai/pharmacy-erx-result"
import type { MohErxDrugLineDTO } from "@/lib/erx/moh-erx-types";
import { ERX_MARKET_ENABLED } from "@/lib/erx/erx-market-flags";
import { ErxMarketFlow } from "@/components/erx-market/erx-market-flow";

const LIST_SECTOR_SUPPLIERS_LIMIT = 500;

export type CategoryBrowseMode = "shop" | "item" | "erx";

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
  const [erxLookup, setErxLookup] = useState<{
    loading: boolean;
    errorCode: string | null;
    patientDisplayName: string | null;
    drugs: MohErxDrugLineDTO[] | null;
  }>({ loading: false, errorCode: null, patientDisplayName: null, drugs: null });

  const isPharmacy = isPharmacyCategoryId(categoryId);
  const browseParam = searchParams.get("browse");
  const browseMode: CategoryBrowseMode =
    browseParam === "item" ? "item" : browseParam === "erx" && isPharmacy ? "erx" : "shop";
  const erxCode = (searchParams.get("erx") ?? "").trim();
  const erxPhone = (searchParams.get("erxPhone") ?? "").trim();
  const erxNames = (searchParams.get("erxNames") ?? "").trim();
  const erxNationalId = (searchParams.get("erxNid") ?? "").trim();

  const headerSearchSq = (searchParams.get("sq") ?? "").trim();

  useEffect(() => {
    setSector(categoryId || null);
    return () => {
      setSector(null);
      setCategoryBrowseMode("shop");
    };
  }, [categoryId, setSector, setCategoryBrowseMode]);

  useEffect(() => {
    setCategoryBrowseMode(browseMode === "shop" ? "shop" : "item");
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

  /** Fetches + identity-validates the eRx code whenever the eRx tab's URL state changes. */
  useEffect(() => {
    if (browseMode !== "erx" || !erxCode) {
      setErxLookup({ loading: false, errorCode: null, patientDisplayName: null, drugs: null });
      return;
    }
    let cancelled = false;
    async function lookup() {
      setErxLookup((prev) => ({ ...prev, loading: true, errorCode: null }));
      try {
        const qs = new URLSearchParams({ code: erxCode });
        if (erxPhone) qs.set("phone", erxPhone);
        if (erxNames) qs.set("names", erxNames);
        if (erxNationalId) qs.set("nationalId", erxNationalId);
        const res = await fetch(`/api/pharmacy/erx-lookup?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setErxLookup({
          loading: false,
          errorCode: json.ok ? null : json.code || "ERX_UPSTREAM_ERROR",
          patientDisplayName: json.ok ? json.patientDisplayName : null,
          drugs: json.ok ? json.drugs : null,
        });
      } catch {
        if (!cancelled) {
          setErxLookup({ loading: false, errorCode: "ERX_UPSTREAM_ERROR", patientDisplayName: null, drugs: null });
        }
      }
    }
    lookup();
    return () => {
      cancelled = true;
    };
  }, [browseMode, erxCode, erxPhone, erxNames, erxNationalId]);

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
      if (mode !== "erx") {
        p.delete("erx");
      }
    });
  };

  const applyErxLookup = (code: string, unlock?: ErxUnlockKey) => {
    replaceQuery((p) => {
      p.set("browse", "erx");
      p.set("erx", code);
      p.set("sq", code);
      if (unlock?.phone) p.set("erxPhone", unlock.phone);
      else p.delete("erxPhone");
      if (unlock?.names) p.set("erxNames", unlock.names);
      else p.delete("erxNames");
      if (unlock?.nationalId) p.set("erxNid", unlock.nationalId);
      else p.delete("erxNid");
      p.delete("supplier");
      p.delete("supplierName");
      if (!p.get("sort")) p.set("sort", "price-low");
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
          {isPharmacy && (
            <button
              type="button"
              role="tab"
              aria-selected={browseMode === "erx"}
              onClick={() => setBrowseMode("erx")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-2",
                browseMode === "erx"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {t("categoryBrowseErxLabel" as TranslationKey)}
            </button>
          )}
        </div>
        {isPharmacy && browseMode === "erx" && !ERX_MARKET_ENABLED && (
          <PharmacyErxInput
            initialCode={erxCode}
            initialPhone={erxPhone}
            initialNames={erxNames}
            initialNationalId={erxNationalId}
            onLookup={applyErxLookup}
          />
        )}
      </div>

      {/* eRx market (NEXT_PUBLIC_ERX_MARKET=1): clicking the eRx tab opens the
          full 5-step MoH flow; flag off keeps today's inline lookup below. */}
      {isPharmacy && browseMode === "erx" && ERX_MARKET_ENABLED && (
        <ErxMarketFlow
          initialCode={erxCode || undefined}
          onClose={() => setBrowseMode("shop")}
        />
      )}

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

      {browseMode === "erx" && !ERX_MARKET_ENABLED && (
        <section id="products-section" className="mt-2">
          {!erxCode ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
              {t("categoryBrowseErxHint" as TranslationKey)}
            </p>
          ) : (
            <PharmacyErxResult
              loading={erxLookup.loading}
              errorCode={erxLookup.errorCode}
              patientDisplayName={erxLookup.patientDisplayName}
              drugs={erxLookup.drugs}
            />
          )}
        </section>
      )}
      </div>
    </>
  );
}
