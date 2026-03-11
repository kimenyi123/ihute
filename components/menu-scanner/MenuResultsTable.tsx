"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/types/menu-scanner";
import {
  exportToExcelForBulkUpload,
  validateForBulkUpload,
} from "@/lib/menu-scanner/excel";
import { findDuplicateItemKeys } from "@/lib/menu-scanner/parseMenuText";
import { generatePriceWarnings } from "@/lib/menu-scanner/priceDetection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface ScanStats {
  total: number;
  missingPrice: number;
  missingPricePct: number;
  warningCount: number;
  warningPct: number;
  dupCount: number;
  dupPct: number;
  perPage: { page: number; count: number }[];
  qualityScore: number;
}

function computeScanStats(
  items: MenuItem[],
  warningCount: number,
  dupKeys: Set<string>
): ScanStats {
  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      missingPrice: 0,
      missingPricePct: 0,
      warningCount: 0,
      warningPct: 0,
      dupCount: 0,
      dupPct: 0,
      perPage: [],
      qualityScore: 0,
    };
  }
  const missingPrice = items.filter(
    (i) => i.price == null || i.price <= 0
  ).length;
  const missingPricePct = Math.round((missingPrice / total) * 100);
  const warningPct = Math.round((warningCount / total) * 100);
  const dupCount = items.filter((i) => {
    const k = `${(i.name || "").trim().toLowerCase()}|${i.price ?? ""}`;
    return dupKeys.has(k);
  }).length;
  const dupPct = Math.round((dupCount / total) * 100);
  const pageMap = new Map<number, number>();
  items.forEach((i) => {
    const p = i.page_number ?? 1;
    pageMap.set(p, (pageMap.get(p) ?? 0) + 1);
  });
  const perPage = Array.from(pageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([page, count]) => ({ page, count }));
  const score = Math.max(
    0,
    Math.round(
      100 -
        missingPricePct * 0.5 -
        warningPct * 0.3 -
        dupPct * 0.2
    )
  );
  return {
    total,
    missingPrice,
    missingPricePct,
    warningCount,
    warningPct,
    dupCount,
    dupPct,
    perPage,
    qualityScore: score,
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 55) return "#d97706";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 55) return "Fair";
  return "Poor";
}

interface MenuResultsTableProps {
  items: MenuItem[];
  onItemsChange: (items: MenuItem[]) => void;
  onStartOver: () => void;
}

export function MenuResultsTable({
  items,
  onItemsChange,
  onStartOver,
}: MenuResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [qualityPanelOpen, setQualityPanelOpen] = useState(false);
  const [priceWarningsOpen, setPriceWarningsOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      const sub = (item.subcategory || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      return (
        name.includes(q) ||
        cat.includes(q) ||
        sub.includes(q) ||
        desc.includes(q)
      );
    });
  }, [items, debouncedSearch]);

  const updateItem = (
    id: string,
    field: keyof MenuItem,
    value: string | number | string[] | null
  ) => {
    onItemsChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    onItemsChange(nextItems);
    const totalPages = Math.ceil(nextItems.length / PAGE_SIZE);
    if (currentPage > totalPages && totalPages > 0)
      setCurrentPage(totalPages);
  };

  const handleExport = () => {
    const validation = validateForBulkUpload(items);
    if (!validation.valid) {
      alert(
        "Please fix errors before exporting:\n\n" +
          validation.errors.join("\n")
      );
      return;
    }
    if (validation.warnings.length > 0) {
      console.warn("Validation warnings:", validation.warnings);
    }
    exportToExcelForBulkUpload(items);
    alert(
      `Excel file downloaded!\n\n` +
        `Total items: ${items.length}\n` +
        `Columns: NAME, QTE, SALES, CODE, DESCRIPTION (+ optional Category, French, Kinyarwanda, Image, etc.)\n\n` +
        `Next steps:\n` +
        `1. Open the Excel file\n` +
        `2. Review and fill optional fields if needed\n` +
        `3. Upload at Supplier → Add products (Excel/CSV)\n\n` +
        `The file is ready for bulk upload.`
    );
  };

  const categories = useMemo(() => {
    const set = new Set(
      items.map((i) => i.category || "Uncategorized")
    );
    return Array.from(set).sort();
  }, [items]);

  const duplicateKeys = useMemo(() => findDuplicateItemKeys(items), [items]);
  const priceWarnings = useMemo(() => generatePriceWarnings(items), [items]);
  const scanStats = useMemo(
    () => computeScanStats(items, priceWarnings.length, duplicateKeys),
    [items, priceWarnings.length, duplicateKeys]
  );

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredItems.length / PAGE_SIZE)
    );
    if (currentPage > totalPages) setCurrentPage(1);
  }, [filteredItems.length, currentPage]);

  const itemDuplicateKey = (item: MenuItem) =>
    `${(item.name || "").trim().toLowerCase()}|${item.price ?? ""}`;

  const applySuggestedPrice = (itemName: string, newPrice: number) => {
    const target = items.find(
      (i) => (i.name || "").trim() === itemName.trim()
    );
    if (target) updateItem(target.id, "price", newPrice);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);
  const goTo = (p: number) =>
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  const pageNumbers = useMemo(() => {
    const pages = new Set(
      [1, totalPages, safePage, safePage - 1, safePage + 1].filter(
        (p) => p >= 1 && p <= totalPages
      )
    );
    return Array.from(pages).sort((a, b) => a - b);
  }, [safePage, totalPages]);

  if (items.length === 0) return null;

  const qColor = scoreColor(scanStats.qualityScore);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Extracted menu items ({items.length})
        </h2>
        <div className="flex gap-2">
          <span className="flex items-center gap-2">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items (name, category…)"
              className="min-w-[200px]"
              aria-label="Search menu items"
            />
            {debouncedSearch && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredItems.length} of {items.length} match
              </span>
            )}
          </span>
          <Button onClick={handleExport}>
            Download Excel
          </Button>
          <Button variant="outline" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setQualityPanelOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted transition-colors"
          aria-expanded={qualityPanelOpen}
        >
          <span className="font-medium text-foreground">Scan Quality</span>
          <span className="flex items-center gap-2 text-sm">
            <span
              className="font-semibold"
              style={{ color: qColor }}
            >
              {scanStats.qualityScore}% {scoreLabel(scanStats.qualityScore)}
            </span>
            <span className="text-muted-foreground" aria-hidden>
              {qualityPanelOpen ? "▼" : "▶"}
            </span>
          </span>
        </button>
        {qualityPanelOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-border">
            <div className="flex flex-wrap items-start gap-6 pt-4">
              <div className="flex flex-col items-center gap-1 min-w-[72px]">
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold text-white"
                  style={{ background: qColor }}
                >
                  {scanStats.qualityScore}%
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: qColor }}
                >
                  {scoreLabel(scanStats.qualityScore)}
                </span>
                <span className="text-xs text-muted-foreground">Scan Quality</span>
              </div>
              <div className="flex flex-wrap gap-3 flex-1">
                <div className="rounded-md border border-border bg-white p-3 min-w-[140px] flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Missing Prices
                    </span>
                    <span
                      className={`text-sm font-bold ${scanStats.missingPrice > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {scanStats.missingPricePct}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${scanStats.missingPricePct}%`,
                        background:
                          scanStats.missingPrice > 0 ? "#dc2626" : "#16a34a",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scanStats.missingPrice} of {scanStats.total} items
                  </p>
                </div>
                <div className="rounded-md border border-border bg-white p-3 min-w-[140px] flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Price Warnings
                    </span>
                    <span
                      className={`text-sm font-bold ${scanStats.warningCount > 0 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {scanStats.warningPct}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${scanStats.warningPct}%`,
                        background:
                          scanStats.warningCount > 0 ? "#d97706" : "#16a34a",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scanStats.warningCount} of {scanStats.total} items
                  </p>
                </div>
                <div className="rounded-md border border-border bg-white p-3 min-w-[140px] flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Duplicates
                    </span>
                    <span
                      className={`text-sm font-bold ${scanStats.dupCount > 0 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {scanStats.dupPct}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${scanStats.dupPct}%`,
                        background:
                          scanStats.dupCount > 0 ? "#d97706" : "#16a34a",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scanStats.dupCount} of {scanStats.total} items
                  </p>
                </div>
                {scanStats.perPage.length > 1 && (
                  <div className="rounded-md border border-border bg-white p-3 min-w-[160px] flex-1">
                    <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Items per Image
                    </span>
                    <div className="space-y-1">
                      {scanStats.perPage.map(({ page, count }) => {
                        const max = Math.max(
                          ...scanStats.perPage.map((p) => p.count)
                        );
                        const pct =
                          max > 0 ? Math.round((count / max) * 100) : 0;
                        const avg =
                          scanStats.total / scanStats.perPage.length;
                        const low = count < avg * 0.5;
                        return (
                          <div
                            key={page}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-muted-foreground w-12 shrink-0">
                              Page {page}
                            </span>
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: low ? "#dc2626" : "#16a34a",
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium w-6 text-right ${low ? "text-red-600" : "text-muted-foreground"}`}
                            >
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {scanStats.perPage.some(
                      ({ count }) =>
                        count <
                        (scanStats.total / scanStats.perPage.length) * 0.5
                    ) && (
                      <p className="text-xs text-red-500 mt-1.5">
                        ⚠ Some pages may have missed items
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
              Quality score = 100% − (50% × missing-price rate) − (30% ×
              warning rate) − (20% × duplicate rate). Review items in red/amber
              above and use the price warning panel below to fix issues.
            </p>
          </div>
        )}
      </div>

      {priceWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setPriceWarningsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-amber-100/80 transition-colors"
            aria-expanded={priceWarningsOpen}
          >
            <span className="font-semibold text-amber-800">
              ⚠️ Please review these prices
            </span>
            <span className="flex items-center gap-2 text-sm text-amber-700">
              {priceWarnings.length} item
              {priceWarnings.length !== 1 ? "s" : ""}
              <span className="text-amber-600" aria-hidden>
                {priceWarningsOpen ? "▼" : "▶"}
              </span>
            </span>
          </button>
          {priceWarningsOpen && (
            <div className="px-4 pb-4 pt-0 border-t border-amber-200">
              <p className="text-sm text-amber-700 pt-3">
                These items may have OCR errors. Verify and edit in the table if
                needed.
              </p>
              <ul className="mt-3 space-y-2">
                {priceWarnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {w.itemName}
                    </span>
                    <span className="text-muted-foreground">
                      {w.currency} {w.price.toLocaleString()}
                    </span>
                    <span className="text-amber-700">{w.message}</span>
                    {w.suggestedFix != null && (
                      <button
                        type="button"
                        onClick={() =>
                          applySuggestedPrice(w.itemName, w.suggestedFix!)
                        }
                        className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-xs font-medium"
                      >
                        Apply {w.currency}{" "}
                        {w.suggestedFix.toLocaleString()}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-2 font-semibold">Category</th>
              <th className="text-left p-2 font-semibold">Subcategory</th>
              <th className="text-left p-2 font-semibold">Item</th>
              <th className="text-left p-2 font-semibold">Price</th>
              <th className="text-left p-2 font-semibold">Currency</th>
              <th className="text-left p-2 font-semibold">Description</th>
              <th className="text-left p-2 font-semibold">Dietary</th>
              <th className="text-left p-2 font-semibold">Image</th>
              <th className="text-left p-2 font-semibold">Page</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => {
              const isDup = duplicateKeys.has(itemDuplicateKey(item));
              const missingPx = item.price == null || item.price <= 0;
              return (
                <tr
                  key={item.id}
                  className={`border-t border-border hover:bg-muted/50
                    ${isDup ? "bg-amber-50/60" : ""}
                    ${missingPx ? "bg-red-50/70" : ""}
                  `}
                >
                  <td className="p-2">
                    {isDup && (
                      <span
                        className="text-xs text-amber-700 font-medium mr-1"
                        title="Same item name and price as another row — review or remove duplicate"
                      >
                        Dup
                      </span>
                    )}
                    <select
                      value={item.category || "Uncategorized"}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        updateItem(item.id, "category", e.target.value)
                      }
                      className="w-full min-w-[110px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1 text-sm cursor-pointer"
                    >
                      {["Uncategorized", ...categories]
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      value={item.subcategory ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item.id, "subcategory", e.target.value)
                      }
                      className="w-full min-w-[80px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={item.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item.id, "name", e.target.value)
                      }
                      className="w-full min-w-[140px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.price ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value.trim();
                        updateItem(
                          item.id,
                          "price",
                          v === "" ? null : Number(v) || null
                        );
                      }}
                      placeholder={missingPx ? "Enter price" : "—"}
                      className={`w-24 bg-transparent border-b focus:outline-none py-1
                        ${missingPx ? "border-red-400 placeholder-red-400 text-red-600 font-semibold" : "border-transparent hover:border-border focus:border-primary"}`}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={item.currency}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item.id, "currency", e.target.value)
                      }
                      className="w-14 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1"
                    />
                  </td>
                  <td className="p-2 max-w-[200px]">
                    <input
                      value={item.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      placeholder=""
                      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={
                        Array.isArray(item.dietary_tags)
                          ? item.dietary_tags.join(", ")
                          : ""
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(
                          item.id,
                          "dietary_tags",
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder=""
                      className="w-full min-w-[80px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-1"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 min-w-[160px]">
                      <input
                        type="url"
                        value={item.image_url ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateItem(
                            item.id,
                            "image_url",
                            e.target.value.trim() || ""
                          )
                        }
                        placeholder={
                          item.image_url ? "" : "Paste image URL (optional)"
                        }
                        className={`flex-1 min-w-0 text-xs bg-transparent border-b focus:outline-none py-1 truncate
                          ${item.image_url ? "border-transparent hover:border-border focus:border-primary" : "border-transparent text-muted-foreground italic"}`}
                      />
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground">{item.page_number}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, items.length)} of {items.length}{" "}
            items
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(safePage - 1)}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {pageNumbers.map((p, idx) => {
              const prev = pageNumbers[idx - 1];
              const showEllipsis = prev != null && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsis && (
                    <span className="px-1 text-muted-foreground text-sm select-none">
                      …
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => goTo(p)}
                    className={`min-w-[34px] px-2 py-1.5 rounded-md border text-sm font-medium transition-colors
                      ${p === safePage ? "bg-primary border-primary text-white" : "border-border text-foreground hover:bg-muted"}`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => goTo(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <datalist id="categories">
        {categories.map((c: string) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
