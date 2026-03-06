export interface MenuItem {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  description: string;
  category: string;
  subcategory: string;
  dietary_tags: string[];
  page_number: number;
  image_url?: string | null;
}

/** Enriched item with DB/supplier fields for bulk upload Excel export */
export interface EnrichedMenuItem extends MenuItem {
  qte: number;
  sales_code: string;
  sku: string;
  unit: string;
  selling_price: number;
  tax_rate: number;
  stock_qty: number;
  min_stock: number;
  is_active: boolean;
  supplier_id?: string;
  barcode?: string;
  cost_price?: number;
  max_stock?: number;
  reorder_level?: number;
  location?: string;
  expiry_date?: string;
  batch_number?: string;
  supplier_product_code?: string;
  notes?: string;
}

export interface ExtractionPageResult {
  items: Omit<MenuItem, "id" | "page_number">[];
  pageIndex: number;
}

export const EXTRACTED_ITEM_FIELDS = [
  "name",
  "price",
  "currency",
  "description",
  "category",
  "subcategory",
  "dietary_tags",
  "image_url",
] as const;
