import * as XLSX from "xlsx";
import type { MenuItem, EnrichedMenuItem } from "@/types/menu-scanner";

/** Required DB/Redis column names for bulk upload (CODE = product code, auto-generated on upload if blank) */
export const REQUIRED_DB_COLUMNS = {
  NAME: "NAME",
  QTE: "QTE",
  CODE: "CODE",
  DESCRIPTION: "DESCRIPTION",
} as const;

/** Generate CODE for product (used in template/export; server can regenerate on upload if blank) */
function generateCode(name: string, index: number): string {
  const prefix = name
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "X");
  const pad = prefix.length < 3 ? prefix + "X".repeat(3 - prefix.length) : prefix.slice(0, 3);
  const timestamp = Date.now().toString().slice(-6);
  return `${pad}-${timestamp}-${String(index + 1).padStart(3, "0")}`;
}

export function enrichMenuItemForDatabase(
  item: MenuItem,
  index: number
): EnrichedMenuItem {
  const price = item.price ?? 0;
  return {
    ...item,
    qte: 1,
    sales_code: generateCode(item.name, index),
    sku: "",
    unit: "serving",
    selling_price: price,
    tax_rate: 0,
    stock_qty: 0,
    min_stock: 0,
    is_active: true,
    supplier_id: "",
    barcode: "",
    max_stock: undefined,
    reorder_level: undefined,
    location: "",
    expiry_date: "",
    batch_number: "",
    supplier_product_code: "",
    notes: item.description || "",
  };
}

export function validateForBulkUpload(items: MenuItem[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  items.forEach((item, index) => {
    if (!item.name || String(item.name).trim() === "") {
      errors.push(`Row ${index + 1}: NAME is required`);
    }
    if (!("supplier_id" in item) || !item.supplier_id || String(item.supplier_id).trim() === "") {
      warnings.push(`Row ${index + 1}: SUPPLIER_ID is empty (recommended to fill before upload)`);
    }
    const costPrice = "cost_price" in item ? (item as EnrichedMenuItem).cost_price : undefined;
    if (costPrice == null || costPrice <= 0) {
      warnings.push(`Row ${index + 1}: COST_PRICE is empty (recommended for profit tracking)`);
    }
  });
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function addExcelFormatting(
  ws: XLSX.WorkSheet,
  _rowCount: number
): void {
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
}

function addInstructionsSheet(wb: XLSX.WorkBook): void {
  const instructions = [
    ["BULK UPLOAD INSTRUCTIONS"],
    [""],
    ["Required: NAME, QTE, SALES (price), DESCRIPTION. CODE is optional (generated on upload if blank)."],
    [""],
    ["Upload Steps:"],
    ["1. Review and fill in optional fields"],
    ["2. Save this Excel file"],
    ["3. Go to: http://localhost:3000/supplier/products/add"],
    ["4. Upload this file using bulk upload"],
    ["5. Verify data and confirm import"],
    [""],
    ["Column Definitions:"],
    ["NAME - Product name (required)"],
    ["QTE - Quantity (1 = one item)"],
    ["SALES - Price from menu"],
    ["CODE - Product code (optional; generated on upload if blank)"],
    ["DESCRIPTION - Product description"],
    ["CURRENCY - Currency (e.g. RWF)"],
    ["CATEGORY - Menu category"],
    ["SUBCATEGORY - Menu subcategory"],
    ["DIETARY_TAGS - Vegetarian, Vegan, etc."],
    ["IMAGE - Image URL (optional)"],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
}

/** Column order for bulk-upload Excel (NAME, QTE, SALES, CODE, DESCRIPTION + scan-menu columns) */
const BULK_UPLOAD_HEADERS = [
  "NAME",
  "QTE",
  "SALES",
  "CODE",
  "DESCRIPTION",
  "CURRENCY",
  "CATEGORY",
  "SUBCATEGORY",
  "DIETARY_TAGS",
  "IMAGE",
] as const;

export function exportToExcelForBulkUpload(menuItems: MenuItem[]): void {
  const enrichedItems = menuItems.map((item, index) =>
    enrichMenuItemForDatabase(item, index)
  );

  const worksheetData = enrichedItems.map((item) => {
    const row: Record<string, string | number> = {};
    row.NAME = item.name;
    row.QTE = item.qte;
    row.SALES = item.price ?? item.selling_price ?? 0;
    row.CODE = ""; // Leave empty — generated on upload at /supplier/products/add
    row.DESCRIPTION = item.description || "";
    row.CURRENCY = item.currency || "";
    row.CATEGORY = item.category || "";
    row.SUBCATEGORY = item.subcategory || "";
    row.DIETARY_TAGS = Array.isArray(item.dietary_tags)
      ? item.dietary_tags.join(", ")
      : "";
    row.IMAGE = item.image_url ?? "";
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(worksheetData, {
    header: [...BULK_UPLOAD_HEADERS],
  });

  ws["!cols"] = [
    { wch: 30 },
    { wch: 8 },
    { wch: 12 },
    { wch: 20 },
    { wch: 50 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 60 },
  ];

  addExcelFormatting(ws, enrichedItems.length);
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  addInstructionsSheet(wb);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `bulk_upload_products_${timestamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/** Legacy simple export (Category, Item, Price, etc.) */
export function downloadMenuExcel(menuData: MenuItem[]): void {
  const currencyLabel =
    menuData.length > 0 && menuData[0]?.currency === "RWF"
      ? "Price (RWF)"
      : "Price";
  const rows = menuData.map((item) => ({
    Category: item.category || "Uncategorized",
    Subcategory: item.subcategory || "",
    Item: item.name,
    [currencyLabel]: item.price ?? "",
    Description: item.description || "",
    "Image URL": item.image_url || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 40 },
    { wch: 14 },
    { wch: 40 },
    { wch: 60 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Menu Items");

  const metadata = [
    { Key: "Extraction Date", Value: new Date().toISOString() },
    { Key: "Total Items", Value: menuData.length },
    {
      Key: "Pages Processed",
      Value: Math.max(...menuData.map((i) => i.page_number), 0) || 1,
    },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metadata);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `menu_extraction_${timestamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}
