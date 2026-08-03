"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useLanguageStore, type Language } from "@/lib/language-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Package,
  TrendingUp,
  TrendingDown,
  Trophy,
  Sparkles,
  LogOut,
  AlertTriangle,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Share2,
  Copy,
  User,
  Layers,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import AddProductModal, { ProductFormData } from "@/components/supplier/AddProductModal";
import { isRestoBarPreferredCategories } from "@/lib/supplier-sector";
import {
  lineCostPriceFromProductRow,
  lineSellingPriceFromProductRow,
  resolveItemEmballageRaw,
  sellableStockFromPacketEmballage,
} from "@/lib/package-price";
import { formatItemEmballageMultiplierOnly } from "@/lib/cart-display-utils";
import { roundRwfPrice } from "@/lib/parse-rwf-price";
import { parseItemStateBatchExpiry } from "@/lib/item-state-display";
import { SupplierProductTableImage } from "@/components/supplier-product-table-image";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { cn } from "@/lib/utils";
import {
  formatSupplierSyncTimestampOrNull,
} from "@/lib/supplier-sync-datetime";
import { resolveSellerPhotoUrl } from "@/lib/seller-photo-url";
import { QrCodeWithLogo } from "@/components/supplier/qr-code-with-logo";
import {
  buildFmcgShelf,
  FMCG_SECTION_SUBTITLE,
} from "@/lib/fmcg";
import { VELOCITY_LOOKBACK_DAYS } from "@/lib/sales-velocity";
import { lookupUnitsSold } from "@/lib/order-sales-lookup";
import {
  enrichCatalogForInsights,
  buildSlowMovers,
  buildRestockRecommendations,
  RESTOCK_TARGET_DAYS,
} from "@/lib/inventory-insights";

/** Last bulk/excel/Redis upload — not per-row refresh stamps from catalog GET. */
function formatLastStockUploadLabel(uploadAt: string | null | undefined): string | null {
  return formatSupplierSyncTimestampOrNull(uploadAt);
}

function formatProductLastSyncCell(
  lastUploadAt: string | null,
  _product: Record<string, unknown>,
): string {
  return formatLastStockUploadLabel(lastUploadAt) ?? "—";
}

const PRODUCT_TABLE_MIN_WIDTH = "1360px";
const productTh =
  "px-2 py-2.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap align-bottom [hyphens:none]";
const productThCenter = `${productTh} text-center`;

/* ─── supplier-dashboard i18n ─── */
const DASH_UI: Record<Language, {
  loadingProducts: string; error: string; retry: string;
  supplierDashboard: string; supplierPanel: string; myProfile: string;
  myPurchases: string; logout: string;
  dailySales: string; ordersToday: string; totalProducts: string;
  allProducts: string; lastSync: string; inventoryValue: string;
  totalStockValue: string; lowStockItems: string; itemsBelow10Units: string;
  outOfStock: string; itemsWith0Stock: string;
  lowStockAlerts: string; viewAll: string; left: string;
  bestSellingToday: string; rankedByUnitsSold: string; unitsSold: string;
  ofTodaysLineRevenue: string; rwfLineTotal: string;
  noOrdersYetToday: string; weSee: string; ordersTodayNoLines: string;
  topUpSale: string; stockAndRevenueActions: string;
  stockAndCatalog: string; openOrders: string;
  restockPriority: string; ledTodayWith: string; runnerUp: string;
  units: string; lowStockColon: string; only: string;
  topUpBeforeRunsOut: string; ordersRecordedNoLines: string;
  fulfillOrdersTip: string;
  qrCodes: string; qrExpandedDesc: string; qrCollapsedDesc: string;
  shopNicknameLabel: string; barOrRestaurant: string; setFromAccount: string;
  tableName: string; linkForCustomers: string; copyLink: string;
  scanToOpenOrders: string; scanWithPhoneDesc: string;
  myProductsTitle: string; products: string; bulkUpload: string;
  bulkPriceUpdate: string; addStockFromNiki: string; addProduct: string;
  searchByName: string; allCategories: string; allStatus: string;
  activeStockFilter: string; lowStockFilter: string; outOfStockFilter: string;
  noProductsMatchingFilters: string; noProductsFound: string;
  addYourFirstProduct: string;
  thProduct: string; thSellingPrice: string; thCostPrice: string;
  thPackage: string; thBatch: string; thExpiry: string; thStock: string;
  thLastSync: string; thStatus: string; thValue: string; thImage: string;
  thActions: string;
  noPrice: string; expired: string; check: string;
  statusOutOfStock: string; statusLowStock: string; statusActive: string;
  show: string; entries: string; showing: string; to: string; of: string;
  previous: string; next: string;
  bulkPriceTitle: string; bulkPriceDesc: string; percentageChange: string;
  percentageHint: string; cancel: string; updating: string; apply: string;
  showingFirst50: string;
  fmcg: string; fmcgSubtitle: string; fmcgMovers: string;
  fmcgExpandHint: string; fmcgCollapseHint: string; fmcgEmpty: string;
  fmcgUnits30d: string; fmcgPerDay: string; fmcgViewInCatalog: string;
  fmcgFast: string; fmcgMedium: string; fmcgSlow: string; fmcgStock: string;
  fastMoving: string; fastMovingDesc: string;
  slowMoving: string; slowMovingDesc: string; slowMovingEmpty: string;
  recommendedRestock: string; recommendedRestockDesc: string; recommendedRestockEmpty: string;
  insightUnits30d: string; insightPerDay: string; insightInStock: string;
  insightDaysCover: string; insightSuggest: string; insightNoSales: string;
  insightViewCatalog: string;
}> = {
  en: {
    loadingProducts: "Loading products…",
    error: "Error",
    retry: "Retry",
    supplierDashboard: "Supplier Dashboard",
    supplierPanel: "Supplier Panel",
    myProfile: "My profile",
    myPurchases: "My purchases",
    logout: "Logout",
    dailySales: "Daily Sales",
    ordersToday: "orders today",
    totalProducts: "Total Products",
    allProducts: "All products",
    lastSync: "Last sync",
    inventoryValue: "Inventory Value",
    totalStockValue: "Total stock value",
    lowStockItems: "Low Stock Items",
    itemsBelow10Units: "Items below 10 units",
    outOfStock: "Out of Stock",
    itemsWith0Stock: "Items with 0 stock",
    lowStockAlerts: "Low stock alerts",
    viewAll: "View all",
    left: "left",
    bestSellingToday: "Best selling today",
    rankedByUnitsSold: "orders today · ranked by units sold",
    unitsSold: "units sold",
    ofTodaysLineRevenue: "of today\u2019s line revenue",
    rwfLineTotal: "RWF line total",
    noOrdersYetToday: "No orders yet today \u2014 best seller appears when you have sales.",
    weSee: "We see",
    ordersTodayNoLines: "orders today, but no product lines were returned for aggregation. After updating the backend, pull to refresh \u2014 your #1 product name will show here.",
    topUpSale: "Top-up sale",
    stockAndRevenueActions: "Stock and revenue actions for your shop",
    stockAndCatalog: "Stock & catalog",
    openOrders: "Open orders",
    restockPriority: "Restock priority:",
    ledTodayWith: "led today with",
    runnerUp: "Runner-up:",
    units: "units",
    lowStockColon: "Low stock:",
    only: "only",
    topUpBeforeRunsOut: "Top up before it runs out.",
    ordersRecordedNoLines: "Orders are recorded for today, but line items were empty. Deploy the latest backend (SellerOrdersServlet fix) and refresh \u2014 best-selling names will appear here.",
    fulfillOrdersTip: "Fulfill orders and keep fast movers in stock \u2014 tailored tips appear here from your live sales and inventory.",
    qrCodes: "QR Codes",
    qrExpandedDesc: "Customer shop link + scan to open your orders. Click to collapse.",
    qrCollapsedDesc: "Shop link for customers and scan-to-open-orders for you. Click to expand.",
    shopNicknameLabel: "Your shop nickname *",
    barOrRestaurant: "Bar or Restaurant",
    setFromAccount: "(set from your account)",
    tableName: "Table name",
    linkForCustomers: "Link (for customers)",
    copyLink: "Copy link",
    scanToOpenOrders: "Scan to open your orders",
    scanWithPhoneDesc: "Scan with your phone to open this link. Log in with your supplier account \u2014 you\u2019ll be returned here to view only your orders.",
    myProductsTitle: "My Products",
    products: "Products",
    bulkUpload: "Bulk Upload",
    bulkPriceUpdate: "Bulk price update",
    addStockFromNiki: "Add stock from NIKI",
    addProduct: "Add Product",
    searchByName: "Search by name…",
    allCategories: "All Categories",
    allStatus: "All Status",
    activeStockFilter: "Active Stock (>10)",
    lowStockFilter: "Low Stock (1-10)",
    outOfStockFilter: "Out of Stock (0)",
    noProductsMatchingFilters: "No products found matching your filters",
    noProductsFound: "No products found",
    addYourFirstProduct: "Add Your First Product",
    thProduct: "Product",
    thSellingPrice: "Selling Price",
    thCostPrice: "Cost Price",
    thPackage: "Package",
    thBatch: "Batch",
    thExpiry: "Expiry",
    thStock: "Stock",
    thLastSync: "Last sync",
    thStatus: "Status",
    thValue: "Value",
    thImage: "Image",
    thActions: "Actions",
    noPrice: "No price",
    expired: "Expired",
    check: "Check",
    statusOutOfStock: "Out of Stock",
    statusLowStock: "Low Stock",
    statusActive: "Active",
    show: "Show",
    entries: "entries",
    showing: "Showing",
    to: "to",
    of: "of",
    previous: "Previous",
    next: "Next",
    bulkPriceTitle: "Bulk price update",
    bulkPriceDesc: "Select products and apply a percentage change to their prices. Prices are updated via your stock API.",
    percentageChange: "Percentage change (%)",
    percentageHint: "Positive = increase, negative = decrease",
    cancel: "Cancel",
    updating: "Updating\u2026",
    apply: "Apply",
    showingFirst50: "Showing first 50. Use filters to narrow.",
    fmcg: "FMCG",
    fmcgSubtitle: FMCG_SECTION_SUBTITLE,
    fmcgMovers: "movers",
    fmcgExpandHint: "Fast movers & FMCG by units sold (30 days). Click to expand.",
    fmcgCollapseHint: "Click to collapse.",
    fmcgEmpty: "No fast movers yet — items with sales in the last 30 days appear here.",
    fmcgUnits30d: "units / 30d",
    fmcgPerDay: "/day",
    fmcgViewInCatalog: "View in catalog",
    fmcgFast: "Fast",
    fmcgMedium: "Medium",
    fmcgSlow: "Slow",
    fmcgStock: "in stock",
    fastMoving: "Fast moving items",
    fastMovingDesc: "FMCG & top sellers by units sold (last 30 days)",
    slowMoving: "Slow moving items",
    slowMovingDesc: "In stock with little or no sales lately",
    slowMovingEmpty: "No slow movers — your stock is turning over well.",
    recommendedRestock: "Recommended restock",
    recommendedRestockDesc: `Keep ~${RESTOCK_TARGET_DAYS} days of cover on what sells`,
    recommendedRestockEmpty: "Nothing urgent to restock right now.",
    insightUnits30d: "units / 30d",
    insightPerDay: "/day",
    insightInStock: "in stock",
    insightDaysCover: "days cover",
    insightSuggest: "suggest",
    insightNoSales: "No sales / 30d",
    insightViewCatalog: "Open catalog",
  },
  rw: {
    loadingProducts: "Birimo gutangira ibicuruzwa\u2026",
    error: "Ikosa",
    retry: "Ongera ugerageze",
    supplierDashboard: "Ikibaho cy\u2019Umucuruzi",
    supplierPanel: "Ikibaho cy\u2019Umucuruzi",
    myProfile: "Umwirondoro wanjye",
    myPurchases: "Ibyo naguze",
    logout: "Gusohoka",
    dailySales: "Igurisha ry\u2019Umunsi",
    ordersToday: "ibitumijwe uyu munsi",
    totalProducts: "Ibicuruzwa Byose",
    allProducts: "Ibicuruzwa byose",
    lastSync: "Igihe cyanyuma",
    inventoryValue: "Agaciro k\u2019Ibicuruzwa",
    totalStockValue: "Agaciro k\u2019isitoki yose",
    lowStockItems: "Sitoki Nke",
    itemsBelow10Units: "Ibicuruzwa munsi ya 10",
    outOfStock: "Nta Sitoki",
    itemsWith0Stock: "Ibicuruzwa bifite 0",
    lowStockAlerts: "Iburira rya sitoki nke",
    viewAll: "Reba byose",
    left: "bisigaye",
    bestSellingToday: "Ibyagurishijwe cyane uyu munsi",
    rankedByUnitsSold: "ibitumijwe uyu munsi \u00b7 ukurikije ingano zagurishijwe",
    unitsSold: "zagurishijwe",
    ofTodaysLineRevenue: "by\u2019amafaranga y\u2019uyu munsi",
    rwfLineTotal: "RWF igiteranyo",
    noOrdersYetToday: "Nta bitumijwe uyu munsi \u2014 igicuruzwa cyagurishijwe cyane kizagaragara iyo ufite ibyo wagurishije.",
    weSee: "Tubona",
    ordersTodayNoLines: "ibitumijwe uyu munsi, ariko nta micuruzwa igaragara. Nyuma yo gushyiraho uburyo bushya, ongera ukure amakuru \u2014 izina ry\u2019igicuruzwa cya mbere rizagaragara hano.",
    topUpSale: "Ongera sitoki",
    stockAndRevenueActions: "Ibikorwa kuri sitoki n\u2019amafaranga y\u2019iduka ryawe",
    stockAndCatalog: "Sitoki n\u2019ibicuruzwa",
    openOrders: "Ibitumijwe",
    restockPriority: "Ibya mbere yo kwongera sitoki:",
    ledTodayWith: "yayoboye uyu munsi afite",
    runnerUp: "Uwakurikiye:",
    units: "ingano",
    lowStockColon: "Sitoki nke:",
    only: "gusa",
    topUpBeforeRunsOut: "Ongera sitoki mbere yuko irangira.",
    ordersRecordedNoLines: "Ibitumijwe byanditswe uyu munsi, ariko imirongo y\u2019ibicuruzwa nta cyo igaragaza. Shyiraho uburyo bushya maze usubire ukure amakuru \u2014 amazina y\u2019ibicuruzwa bizagaragara hano.",
    fulfillOrdersTip: "Kora ibitumijwe kandi ugumane ibicuruzwa bigurishwa cyane \u2014 inama zihujwe n\u2019ubucuruzi bwawe zizagaragara hano.",
    qrCodes: "Kode QR",
    qrExpandedDesc: "Umuyoboro w\u2019iduka rya klijenti + gusikana kugirango ufungure ibitumijwe byawe. Kanda kugabanya.",
    qrCollapsedDesc: "Umuyoboro w\u2019iduka ku bakoresha na kode yo gufungura ibitumijwe. Kanda kwagura.",
    shopNicknameLabel: "Izina ry\u2019iduka ryawe *",
    barOrRestaurant: "Bari cyangwa Resitora",
    setFromAccount: "(byashyizweho na konti yawe)",
    tableName: "Izina ry\u2019ameza",
    linkForCustomers: "Umuyoboro (ku bakoresha)",
    copyLink: "Gukoporora umuyoboro",
    scanToOpenOrders: "Sikana kugirango ufungure ibitumijwe",
    scanWithPhoneDesc: "Sikana kuri telefoni yawe kugirango ufungure uyu muyoboro. Injira na konti yawe \u2014 uzasubizwa hano kubona ibitumijwe byawe gusa.",
    myProductsTitle: "Ibicuruzwa Byanjye",
    products: "Ibicuruzwa",
    bulkUpload: "Kohereza byinshi",
    bulkPriceUpdate: "Guhindura ibiciro byinshi",
    addStockFromNiki: "Ongeraho sitoki kuva NIKI",
    addProduct: "Ongeraho Igicuruzwa",
    searchByName: "Shakisha izina\u2026",
    allCategories: "Ibyiciro Byose",
    allStatus: "Imimerere Yose",
    activeStockFilter: "Sitoki Nzima (>10)",
    lowStockFilter: "Sitoki Nke (1-10)",
    outOfStockFilter: "Nta Sitoki (0)",
    noProductsMatchingFilters: "Nta bicuruzwa bihuye n\u2019ibyo ushaka",
    noProductsFound: "Nta bicuruzwa byabonetse",
    addYourFirstProduct: "Ongeraho Igicuruzwa cya Mbere",
    thProduct: "Igicuruzwa",
    thSellingPrice: "Igiciro cyo kugurisha",
    thCostPrice: "Igiciro cy'ubuguzi",
    thPackage: "Ipaki",
    thBatch: "Umukumbi",
    thExpiry: "Irangirira",
    thStock: "Sitoki",
    thLastSync: "Sync",
    thStatus: "Imimerere",
    thValue: "Agaciro",
    thImage: "Ishusho",
    thActions: "Ibikorwa",
    noPrice: "Nta giciro",
    expired: "Byarenze igihe",
    check: "Suzuma",
    statusOutOfStock: "Nta sitoki",
    statusLowStock: "Sitoki nke",
    statusActive: "Birimo",
    show: "Erekana",
    entries: "umurongo",
    showing: "Kwerekana",
    to: "kugeza",
    of: "muri",
    previous: "Inyuma",
    next: "Komeza",
    bulkPriceTitle: "Guhindura ibiciro byinshi",
    bulkPriceDesc: "Hitamo ibicuruzwa uhindure ibiciro mu ijanisha. Ibiciro bihindurwa binyuze muri API y\u2019isitoki yawe.",
    percentageChange: "Ihinduka ry\u2019ijanisha (%)",
    percentageHint: "Umubare mwiza = kwiyongera, mubi = kugabanya",
    cancel: "Hagarika",
    updating: "Birimo guhindura\u2026",
    apply: "Shyira mu bikorwa",
    showingFirst50: "Irekanwa 50 za mbere. Koresha ibisasu kugabanya.",
    fmcg: "FMCG",
    fmcgSubtitle: FMCG_SECTION_SUBTITLE,
    fmcgMovers: "bihuze cyane",
    fmcgExpandHint: "Ibicuruzwa bihuze n\u2019FMCG (iminsi 30). Kanda kugira ngo ubone.",
    fmcgCollapseHint: "Kanda kugabanya.",
    fmcgEmpty: "Nta bicuruzwa bihuze — ibicuruzwa byagurishijwe mu minsi 30 bigaragara hano.",
    fmcgUnits30d: "zagurishijwe / iminsi 30",
    fmcgPerDay: "/umunsi",
    fmcgViewInCatalog: "Reba mu kataloge",
    fmcgFast: "Byihuse",
    fmcgMedium: "Hagati",
    fmcgSlow: "Gake",
    fmcgStock: "mu bubiko",
    fastMoving: "Ibicuruzwa byihuse cyane",
    fastMovingDesc: "FMCG n\u2019ibyo byagurishijwe cyane (iminsi 30 ishize)",
    slowMoving: "Ibicuruzwa bigenda gake",
    slowMovingDesc: "Biri mu bubiko ariko ntibigurishwa cyangwa bigurishwa gake",
    slowMovingEmpty: "Nta bicuruzwa bigenda gake — sitoki yawe irimo gukora neza.",
    recommendedRestock: "Ibyo kongera sitoki",
    recommendedRestockDesc: `Bika sitoki y\u2019iminsi ~${RESTOCK_TARGET_DAYS} ku byagurishwa`,
    recommendedRestockEmpty: "Nta byihutirwa byo kongera sitoki ubu.",
    insightUnits30d: "zagurishijwe / iminsi 30",
    insightPerDay: "/umunsi",
    insightInStock: "mu bubiko",
    insightDaysCover: "iminsi isigaye",
    insightSuggest: "sugira",
    insightNoSales: "Nta kugurisha / iminsi 30",
    insightViewCatalog: "Fungura kataloge",
  },
  fr: {
    loadingProducts: "Chargement des produits\u2026",
    error: "Erreur",
    retry: "R\u00e9essayer",
    supplierDashboard: "Tableau de bord Fournisseur",
    supplierPanel: "Panneau Fournisseur",
    myProfile: "Mon profil",
    myPurchases: "Mes achats",
    logout: "D\u00e9connexion",
    dailySales: "Ventes du jour",
    ordersToday: "commandes aujourd\u2019hui",
    totalProducts: "Total Produits",
    allProducts: "Tous les produits",
    lastSync: "Derni\u00e8re synchro",
    inventoryValue: "Valeur du Stock",
    totalStockValue: "Valeur totale du stock",
    lowStockItems: "Stock Faible",
    itemsBelow10Units: "Articles sous 10 unit\u00e9s",
    outOfStock: "Rupture de Stock",
    itemsWith0Stock: "Articles avec 0 en stock",
    lowStockAlerts: "Alertes de stock faible",
    viewAll: "Tout voir",
    left: "restant(s)",
    bestSellingToday: "Meilleures ventes du jour",
    rankedByUnitsSold: "commandes aujourd\u2019hui \u00b7 class\u00e9es par unit\u00e9s vendues",
    unitsSold: "unit\u00e9s vendues",
    ofTodaysLineRevenue: "du chiffre d\u2019affaires du jour",
    rwfLineTotal: "RWF total ligne",
    noOrdersYetToday: "Aucune commande aujourd\u2019hui \u2014 le meilleur vendeur appara\u00eet quand vous avez des ventes.",
    weSee: "Nous voyons",
    ordersTodayNoLines: "commandes aujourd\u2019hui, mais aucun d\u00e9tail de produit n\u2019a \u00e9t\u00e9 retourn\u00e9. Apr\u00e8s la mise \u00e0 jour du backend, actualisez \u2014 le nom de votre produit #1 appara\u00eetra ici.",
    topUpSale: "R\u00e9approvisionnement",
    stockAndRevenueActions: "Actions de stock et de revenus pour votre boutique",
    stockAndCatalog: "Stock & catalogue",
    openOrders: "Commandes ouvertes",
    restockPriority: "Priorit\u00e9 de r\u00e9appro :",
    ledTodayWith: "a men\u00e9 aujourd\u2019hui avec",
    runnerUp: "Deuxi\u00e8me :",
    units: "unit\u00e9s",
    lowStockColon: "Stock faible :",
    only: "seulement",
    topUpBeforeRunsOut: "R\u00e9approvisionnez avant la rupture.",
    ordersRecordedNoLines: "Des commandes ont \u00e9t\u00e9 enregistr\u00e9es aujourd\u2019hui, mais les lignes de produits \u00e9taient vides. Mettez \u00e0 jour le backend et actualisez \u2014 les noms des best-sellers appara\u00eetront ici.",
    fulfillOrdersTip: "Traitez les commandes et gardez vos produits phares en stock \u2014 des conseils adapt\u00e9s apparaissent ici depuis vos ventes et inventaire.",
    qrCodes: "Codes QR",
    qrExpandedDesc: "Lien boutique client + scan pour ouvrir vos commandes. Cliquez pour r\u00e9duire.",
    qrCollapsedDesc: "Lien boutique pour clients et scan pour vos commandes. Cliquez pour agrandir.",
    shopNicknameLabel: "Nom de votre boutique *",
    barOrRestaurant: "Bar ou Restaurant",
    setFromAccount: "(d\u00e9fini depuis votre compte)",
    tableName: "Nom de la table",
    linkForCustomers: "Lien (pour les clients)",
    copyLink: "Copier le lien",
    scanToOpenOrders: "Scannez pour ouvrir vos commandes",
    scanWithPhoneDesc: "Scannez avec votre t\u00e9l\u00e9phone pour ouvrir ce lien. Connectez-vous avec votre compte fournisseur \u2014 vous serez redirig\u00e9 ici pour voir uniquement vos commandes.",
    myProductsTitle: "Mes Produits",
    products: "Produits",
    bulkUpload: "Import en masse",
    bulkPriceUpdate: "Mise \u00e0 jour des prix en masse",
    addStockFromNiki: "Ajouter du stock depuis NIKI",
    addProduct: "Ajouter un Produit",
    searchByName: "Rechercher par nom\u2026",
    allCategories: "Toutes les Cat\u00e9gories",
    allStatus: "Tous les Statuts",
    activeStockFilter: "Stock Actif (>10)",
    lowStockFilter: "Stock Faible (1-10)",
    outOfStockFilter: "Rupture de Stock (0)",
    noProductsMatchingFilters: "Aucun produit ne correspond \u00e0 vos filtres",
    noProductsFound: "Aucun produit trouv\u00e9",
    addYourFirstProduct: "Ajoutez votre Premier Produit",
    thProduct: "Produit",
    thSellingPrice: "Prix vente",
    thCostPrice: "Prix revient",
    thPackage: "Emballage",
    thBatch: "Lot",
    thExpiry: "Expiration",
    thStock: "Stock",
    thLastSync: "Sync",
    thStatus: "Statut",
    thValue: "Valeur",
    thImage: "Image",
    thActions: "Actions",
    noPrice: "Pas de prix",
    expired: "Expir\u00e9",
    check: "V\u00e9rifier",
    statusOutOfStock: "Rupture",
    statusLowStock: "Stock Faible",
    statusActive: "Actif",
    show: "Afficher",
    entries: "entr\u00e9es",
    showing: "Affichage de",
    to: "\u00e0",
    of: "sur",
    previous: "Pr\u00e9c\u00e9dent",
    next: "Suivant",
    bulkPriceTitle: "Mise \u00e0 jour des prix en masse",
    bulkPriceDesc: "S\u00e9lectionnez des produits et appliquez un pourcentage de changement \u00e0 leurs prix. Les prix sont mis \u00e0 jour via votre API de stock.",
    percentageChange: "Variation en pourcentage (%)",
    percentageHint: "Positif = augmentation, n\u00e9gatif = diminution",
    cancel: "Annuler",
    updating: "Mise \u00e0 jour\u2026",
    apply: "Appliquer",
    showingFirst50: "Affichage des 50 premiers. Utilisez les filtres pour affiner.",
    fmcg: "FMCG",
    fmcgSubtitle: FMCG_SECTION_SUBTITLE,
    fmcgMovers: "articles",
    fmcgExpandHint: "Rotation rapide & FMCG (30 jours). Cliquez pour d\u00e9velopper.",
    fmcgCollapseHint: "Cliquez pour r\u00e9duire.",
    fmcgEmpty: "Pas encore de rotation rapide \u2014 les articles vendus sur 30 jours apparaissent ici.",
    fmcgUnits30d: "unit\u00e9s / 30j",
    fmcgPerDay: "/jour",
    fmcgViewInCatalog: "Voir dans le catalogue",
    fmcgFast: "Rapide",
    fmcgMedium: "Moyen",
    fmcgSlow: "Lent",
    fmcgStock: "en stock",
    fastMoving: "Articles \u00e0 rotation rapide",
    fastMovingDesc: "FMCG et meilleures ventes (30 derniers jours)",
    slowMoving: "Articles \u00e0 rotation lente",
    slowMovingDesc: "En stock avec peu ou pas de ventes r\u00e9centes",
    slowMovingEmpty: "Pas de stock dormant \u2014 votre rotation est saine.",
    recommendedRestock: "R\u00e9approvisionnement recommand\u00e9",
    recommendedRestockDesc: `Visez ~${RESTOCK_TARGET_DAYS} jours de couverture sur ce qui se vend`,
    recommendedRestockEmpty: "Rien d\u2019urgent \u00e0 r\u00e9approvisionner pour l\u2019instant.",
    insightUnits30d: "unit\u00e9s / 30j",
    insightPerDay: "/jour",
    insightInStock: "en stock",
    insightDaysCover: "jours de couverture",
    insightSuggest: "sugg\u00e9rer",
    insightNoSales: "Aucune vente / 30j",
    insightViewCatalog: "Ouvrir le catalogue",
  },
};

function SupplierDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, logout } = useAuthStore();
  const language = useLanguageStore((s) => s.language);
  const ui = DASH_UI[language] ?? DASH_UI.en;
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  /** Last bulk/excel/Redis upload time from backend meta — not refreshed on page load */
  const [lastStockUploadAt, setLastStockUploadAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bump to refetch stock silently (interval / tab visible) without full-page spinner */
  const [stockRefreshKey, setStockRefreshKey] = useState(0);

  // Add Product Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);

  // Shop With Me QR (collapsible so it doesn't interrupt the main dashboard)
  const [shopWithMeQROpen, setShopWithMeQROpen] = useState(false);
  /** FMCG shelf — collapsed by default (busy dashboard) */
  const [fmcgOpen, setFmcgOpen] = useState(false);
  const [orderSalesByCode, setOrderSalesByCode] = useState<Record<string, number>>({});
  const [shopNickname, setShopNickname] = useState("");
  const [isBarOrRestaurant, setIsBarOrRestaurant] = useState(false);
  /** When true, Bar or Restaurant was set from account PREFEREDCATEGORIES and must not be edited */
  const [isBarOrRestaurantFromAccount, setIsBarOrRestaurantFromAccount] = useState(false);
  /** Only show Bar or Restaurant checkbox when PREFEREDCATEGORIES is resto-bar/restaurant/bar */
  const [showBarOrRestaurantOption, setShowBarOrRestaurantOption] = useState(false);
  const [tableNameOrNumber, setTableNameOrNumber] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [analytics, setAnalytics] = useState<{
    dailySalesTotal: number;
    dailyOrdersCount: number;
    bestSelling: Array<{ name: string; quantity: number; total: number }>;
  } | null>(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkPriceSelected, setBulkPriceSelected] = useState<Set<string>>(new Set());
  const [bulkPricePercent, setBulkPricePercent] = useState("");
  const [bulkPriceSubmitting, setBulkPriceSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  // Bar/restaurant flag + shop logo + nickname (same photo as /account shop photo upload)
  useEffect(() => {
    if (!user?.ishyigaAccount || user?.role !== "supplier") return;
    const account = user.ishyigaAccount;
    const profileQs = new URLSearchParams({ account });
    if (user.email) profileQs.set("email", user.email);

    Promise.all([
      fetch(`/api/supplier/profile?account=${encodeURIComponent(account)}`).then((res) => res.json()),
      fetch(`/api/account/profile?${profileQs.toString()}`).then((res) => res.json()),
    ])
      .then(([supplierData, accountData]) => {
        const isRestoBar = isRestoBarPreferredCategories(supplierData?.preferredCategories);
        if (isRestoBar) {
          setShowBarOrRestaurantOption(true);
          setIsBarOrRestaurant(true);
          setIsBarOrRestaurantFromAccount(true);
        }
        const photo = accountData?.profile?.photo;
        if (typeof photo === "string" && photo.trim()) {
          setShopLogoUrl(resolveSellerPhotoUrl(photo));
        } else {
          setShopLogoUrl("");
        }
        const nick = String(accountData?.profile?.nickname ?? "").trim().toLowerCase();
        if (nick) setShopNickname((prev) => prev || nick);
      })
      .catch(() => {});
  }, [user?.ishyigaAccount, user?.role, user?.email]);

  const shopWithMeLink = shopNickname.trim()
    ? `${baseUrl}/shop-with-me/${encodeURIComponent(shopNickname.trim().toLowerCase())}?src=qr${
        isBarOrRestaurant && tableNameOrNumber.trim()
          ? `&table=${encodeURIComponent(tableNameOrNumber.trim())}`
          : ""
      }`
    : "";

  // Link for this seller only (like shop-with-me: URL identifies the seller)
  const supplierOrdersLink =
    baseUrl && user?.ishyigaAccount
      ? `${baseUrl}/supplier/orders?account=${encodeURIComponent(user.ishyigaAccount)}`
      : "";

  const copyShopWithMeLink = () => {
    if (!shopWithMeLink) return;
    navigator.clipboard.writeText(shopWithMeLink).then(() => {
      alert("Link copied to clipboard");
      void import("@/lib/activity-tracker").then(({ trackQrShare }) => {
        trackQrShare(shopNickname.trim().toLowerCase(), {
          sellerAccount: user?.ishyigaAccount,
          table: tableNameOrNumber.trim() || undefined,
        });
      });
    });
  };

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) {
      setError("No ishyigaAccount found for user");
      setLoading(false);
      return;
    }

    const showFullLoading = stockRefreshKey === 0;
    if (showFullLoading) {
      setLoading(true);
      setError(null);
    }

    const controller = new AbortController();

    fetch(`/api/supplier/stock?account=${encodeURIComponent(user.ishyigaAccount)}&_=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(async (data) => {
        console.log("=== API Response ===");
        console.log("Full data:", data);
        console.log("Products array:", data.products);
        console.log("Count:", data.count);
        console.log("Source:", data.source);

        if (!data.ok) {
          // Don't crash — show empty dashboard with a warning
          console.warn("[Dashboard] Backend returned ok:false:", data.error)
          setError(data.error || "Could not load products — Tomcat may be starting up")
          setSupplierProducts([])
          setLoading(false)
          return
        }

        setError(null);
        setLastStockUploadAt(() => {
          const fromApi = data.lastStockUploadAt ?? data.last_stock_upload_at ?? null;
          if (fromApi != null && String(fromApi).trim()) {
            return String(fromApi).trim();
          }
          return null;
        });

        const products = data.products || [];
        console.log(`Received ${products.length} products from ${data.source}`);

        // Helper function to parse integers safely
        const parseIntSafe = (value: any): number => {
          if (typeof value === 'number') return Math.floor(value);
          if (typeof value === 'string') {
            const parsed = parseInt(value.trim());
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        // Helper function to parse Redis price format (e.g., "3000RWF")
        const parsePriceFromRedis = (value: unknown): number => roundRwfPrice(value);

        const parsePrice = (value: unknown): number => roundRwfPrice(value);

        // Map products - handle Redis format (your format)
        const buildBatchState = (product: any): string => {
          const batch = String(product?.BATCH ?? product?.batch ?? "").trim();
          const exp = String(product?.DATE_EXP ?? product?.date_exp ?? product?.EXPIRE_DATE ?? "").trim();
          if (!batch && !exp) return "";
          return `Ba:${batch || "NA"}| Ex:${exp || "NA"}`;
        };

        const mappedProducts = products.map((p: any, index: number) => {
          console.log(`Product ${index}:`, p);

          // Check if this is Redis format (your format); item_emballage can be empty
          const isRedisFormat = p.item_commercial_name && p.item_key_words && p.item_packet;

          let mapped;

          if (isRedisFormat) {
            // Handle Redis format: price only from selling_price; stock = item_packet / item_emballage
            const stock = sellableStockFromPacketEmballage(
              p.item_packet,
              resolveItemEmballageRaw(p)
            );
            // Prefer alias retail amounts when CIS left selling_price as package flag (1).
            const price = lineSellingPriceFromProductRow(p as Record<string, unknown>)
              || (p.selling_price != null ? parsePrice(String(p.selling_price)) : 0);

            const catalogCode = String(
              p.ITEM_CODE ?? p.item_code ?? p.itemCode ?? p.item_key_words ?? "",
            ).trim();

            mapped = {
              ...p, // Keep all original Redis fields
              // Normalize for dashboard display
              itemName: p.item_commercial_name,
              ITEM_NAME: p.item_commercial_name,
              itemCode: catalogCode,
              ITEM_CODE: catalogCode,
              item_code: catalogCode || p.item_code,
              stock: stock,
              STOCK: stock,
              price: price,
              UNITY_PRICE: price,
              costPrice: Number(p.cost_price ?? p.cost ?? p.COST_PRICE_INCLUSIVE ?? 0),
              COST_PRICE_INCLUSIVE: Number(p.cost_price ?? p.cost ?? 0),
              category: p.item_category || p.category || "uncategorized",
              sales: 0,
              batchInfo: p.item_state || buildBatchState(p) || "",
              DESCRIPTION: p.item_description || p.item_state || buildBatchState(p) || "",
              UNIT: p.item_unit || "PCS",
              currency: p.currency ?? "RWF",
              imageUrl:
                p.item_image_url || p.IMAGE_URL || p.image_url || (p as { image?: string }).image || "",
              famille: p.famille ?? (p as { FAMILLE?: string }).FAMILLE,
              last_sync_time:
                p.last_sync_time ?? p.LAST_SYNC_TIME ?? p.lastSyncTime ?? p.last_sync ?? "",
            };
          } else {
            // Handle database format (fallback)
            const price = parsePrice(
              p.selling_price ?? (p.price || p.UNITY_PRICE || p.SALE_PRICE_INCLUSIVE || 0)
            );
            const stock = sellableStockFromPacketEmballage(
              p.item_packet ?? p.stock ?? p.STOCK ?? p.QUANTITY ?? 0,
              resolveItemEmballageRaw(p)
            );

            mapped = {
              ...p, // Keep all original fields
              // Normalize field names - handle database, Redis, and API variations
              stock: stock,
              price: price,
              costPrice: Number(
                p.cost_price ??
                p.cost ??
                p.COST_PRICE_INCLUSIVE ??
                0
              ),
              itemName:
                p.ITEM_NAME ||
                p.itemName ||
                p.item_commercial_name ||
                "Unknown",
              itemCode:
                p.ITEM_CODE ||
                p.itemCode ||
                p.item_key_words ||
                "",
              batchInfo: p.item_state || buildBatchState(p) || p.DESCRIPTION || "",
              category: p.category || "uncategorized",
              sales: 0,
              currency: p.currency ?? "RWF",
              imageUrl:
                p.IMAGE_URL || p.image_url || p.item_image_url || (p as { image?: string }).image || "",
              famille: p.famille ?? (p as { FAMILLE?: string }).FAMILLE,
              last_sync_time:
                p.last_sync_time ?? p.LAST_SYNC_TIME ?? p.lastSyncTime ?? p.last_sync ?? "",
            };
          }

          console.log(`Mapped product ${index}:`, mapped);
          return mapped;
        });

        console.log("=== All Mapped Products ===");
        console.log(mappedProducts);
        console.log(`Total: ${mappedProducts.length}`);

        let finalProducts = mappedProducts;
        try {
          const mapRes = await fetch(
            `/api/images/overrides?scope=product&account=${encodeURIComponent(user.ishyigaAccount ?? "")}`,
            { cache: "no-store" }
          );
          const mapData = await mapRes.json().catch(() => ({}));
          const imageMap = (mapData?.map ?? {}) as Record<string, string>;
          if (imageMap && typeof imageMap === "object" && Object.keys(imageMap).length > 0) {
            finalProducts = mappedProducts.map((row: any) => {
              const code = String(row.itemCode || row.ITEM_CODE || "").trim().toUpperCase();
              const override = code ? imageMap[code] : "";
              if (!override) return row;
              return {
                ...row,
                imageUrl: override,
                image_url: override,
                item_image_url: override,
                IMAGE_URL: override,
                image: override,
              };
            });
          }
        } catch {
          // keep backend-provided images when overrides fetch fails
        }

        // Don't filter by stock > 0, show ALL products
        setSupplierProducts(finalProducts);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Error fetching stock:", err);
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [hasHydrated, isAuthenticated, user?.ishyigaAccount, user?.role, router, stockRefreshKey]);

  useEffect(() => {
    if (!user?.ishyigaAccount || user?.role !== "supplier") return;
    const id = window.setInterval(() => setStockRefreshKey((k) => k + 1), 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") setStockRefreshKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.ishyigaAccount, user?.role]);

  useEffect(() => {
    if (!user?.ishyigaAccount || user?.role !== "supplier") return;

    let cancelled = false;

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/supplier/analytics?account=${encodeURIComponent(user.ishyigaAccount ?? "")}`, {
          cache: "no-store",
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (data?.ok) setAnalytics(data)
      } catch {}
    }

    fetchAnalytics()
    const id = window.setInterval(fetchAnalytics, 10_000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user?.ishyigaAccount, user?.role])

  useEffect(() => {
    if (!user?.ishyigaAccount || user?.role !== "supplier") return;

    let cancelled = false;

    const fetchOrderSales = async () => {
      try {
        const qs = new URLSearchParams({
          account: user.ishyigaAccount ?? "",
          days: String(VELOCITY_LOOKBACK_DAYS),
        });
        const nick = shopNickname.trim().toLowerCase();
        if (nick) qs.set("nickname", nick);
        const res = await fetch(`/api/supplier/item-order-sales?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.ok && data.sales && typeof data.sales === "object") {
          setOrderSalesByCode(data.sales as Record<string, number>);
        }
      } catch {
        /* ignore */
      }
    };

    fetchOrderSales();
    const id = window.setInterval(fetchOrderSales, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.ishyigaAccount, user?.role, shopNickname]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Filter products
  const filteredProducts = supplierProducts.filter((p) => {
    const stateFromBatchColumns =
      p.BATCH || p.DATE_EXP ? `Ba:${p.BATCH || "NA"}| Ex:${p.DATE_EXP || "NA"}` : "";
    const stateRaw = String(
      p.item_state ??
      p.batchInfo ??
      (stateFromBatchColumns || p.DESCRIPTION || "")
    );
    const stateHay = stateRaw.toLowerCase();
    const { batch, expiryLabel } = parseItemStateBatchExpiry(
      stateRaw
    );
    const batchHay = (batch ?? "").toLowerCase();
    const expHay = (expiryLabel ?? "").toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      p.itemName?.toLowerCase().includes(q) ||
      p.ITEM_NAME?.toLowerCase().includes(q) ||
      (p.itemCode && String(p.itemCode).toLowerCase().includes(q)) ||
      (p.ITEM_CODE && String(p.ITEM_CODE).toLowerCase().includes(q)) ||
      stateHay.includes(q) ||
      batchHay.includes(q) ||
      expHay.includes(q);
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "low" && p.stock <= 10) ||
      (statusFilter === "out" && p.stock === 0) ||
      (statusFilter === "active" && p.stock > 10);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Get unique categories
  const categories = Array.from(
    new Set(supplierProducts.map((p) => p.category))
  );

  const totalProducts = supplierProducts.length;
  const lowStock = supplierProducts.filter((p) => p.stock <= 10 && p.stock > 0).length;
  const outOfStock = supplierProducts.filter((p) => p.stock === 0).length;
  const totalValue = supplierProducts.reduce((sum, p) => {
    const pr = p as Record<string, unknown>;
    const lineCost = lineCostPriceFromProductRow(pr);
    return sum + lineCost * Number(p.stock ?? 0);
  }, 0);

  const latestInventorySyncLabel = formatLastStockUploadLabel(lastStockUploadAt);

  const bestSellingHero = useMemo(() => {
    if (!analytics?.bestSelling?.length) return null;
    const top = analytics.bestSelling[0];
    const lineTotal = analytics.bestSelling.reduce((s, x) => s + Number(x.total ?? 0), 0);
    const pct =
      lineTotal > 0 ? Math.min(100, Math.round((Number(top.total ?? 0) / lineTotal) * 100)) : null;
    return { top, pct, lineTotal };
  }, [analytics]);

  const fmcgShelf = useMemo(() => {
    const enriched = supplierProducts.map((p) => {
      const row = p as Record<string, unknown>;
      const code = String(
        row.ITEM_CODE ?? row.itemCode ?? row.item_code ?? row.item_key_words ?? "",
      )
        .trim()
        .toUpperCase();
      const sold = lookupUnitsSold(row, orderSalesByCode);
      return {
        ...p,
        ITEM_CODE: code || p.ITEM_CODE,
        item_code: code || p.item_code,
        item_commercial_name: p.item_commercial_name ?? p.itemName ?? p.ITEM_NAME,
        item_name: p.itemName ?? p.ITEM_NAME ?? p.item_name,
        famille: p.famille ?? p.FAMILLE ?? p.category,
        totalSold: sold > 0 ? sold : Number(p.totalSold ?? 0) || 0,
      };
    });
    return buildFmcgShelf(enriched, 24);
  }, [supplierProducts, orderSalesByCode]);

  const fmcgPreview = fmcgShelf.slice(0, 12);

  const inventoryInsights = useMemo(() => {
    const enriched = enrichCatalogForInsights(
      supplierProducts as Record<string, unknown>[],
      orderSalesByCode,
    );
    return {
      slow: buildSlowMovers(enriched),
      restock: buildRestockRecommendations(enriched),
    };
  }, [supplierProducts, orderSalesByCode]);

  const topUpSaleBullets = useMemo(() => {
    const bullets: string[] = [];
    if (analytics?.bestSelling?.[0]) {
      const b = analytics.bestSelling[0];
      bullets.push(
        `${ui.restockPriority} "${b.name}" ${ui.ledTodayWith} ${b.quantity} ${ui.unitsSold} (${Number(b.total ?? 0).toLocaleString()} RWF).`,
      );
    }
    if (analytics?.bestSelling?.[1]) {
      const b = analytics.bestSelling[1];
      bullets.push(
        `${ui.runnerUp} "${b.name}" · ${b.quantity} ${ui.units} · ${Number(b.total ?? 0).toLocaleString()} RWF.`,
      );
    }
    const low = supplierProducts.filter((p) => p.stock <= 10 && p.stock > 0).slice(0, 2);
    for (const p of low) {
      const nm = String(p.itemName || p.ITEM_NAME || ui.thProduct).trim();
      bullets.push(`${ui.lowStockColon} ${nm} — ${ui.only} ${p.stock} ${ui.left}. ${ui.topUpBeforeRunsOut}`);
    }
    if (
      analytics &&
      analytics.dailyOrdersCount > 0 &&
      (!analytics.bestSelling || analytics.bestSelling.length === 0)
    ) {
      bullets.push(
        ui.ordersRecordedNoLines,
      );
    }
    if (bullets.length === 0) {
      bullets.push(
        ui.fulfillOrdersTip,
      );
    }
    return bullets.slice(0, 4);
  }, [analytics, supplierProducts, ui]);

  const handleDelete = async (product: any) => {
    const itemName = product.ITEM_NAME || product.itemName || "this product";
    if (!confirm(`Are you sure you want to delete ${itemName}?`)) return;

    if (!user?.ishyigaAccount) {
      alert("No supplier account found");
      return;
    }

    try {
      const itemCode = product.ITEM_CODE || product.itemCode;
      const params = new URLSearchParams({
        itemCode: String(itemCode),
        account: user.ishyigaAccount,
      });
      const res = await fetch(`/api/supplier/stock?${params.toString()}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSupplierProducts((prev) =>
          prev.filter((prod) =>
            (prod.ITEM_CODE || prod.itemCode) !== itemCode
          )
        );
      } else {
        alert(data.message || data.error || "Failed to delete product");
      }
    } catch {
      alert("Error deleting product");
    }
  };

  const handleSaveProduct = async (productData: ProductFormData) => {
    if (!user?.ishyigaAccount) {
      alert("No account found");
      return;
    }

    try {
      const action = editingProduct ? "updateProduct" : "addProduct";

      const { imageFile: _imageFile, ...productJson } = productData;
      const res = await fetch("/api/supplier/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          account: user.ishyigaAccount,
          ...productJson,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        if (productData.imageFile) {
          const normalizedCode = String(productData.itemCode || "").trim().toUpperCase();
          if (!normalizedCode) {
            throw new Error("Product code is required before image upload");
          }
          const fd = new FormData();
          fd.append("scope", "product");
          fd.append("account", user.ishyigaAccount);
          fd.append("itemCode", normalizedCode);
          fd.append("file", productData.imageFile);
          const imgRes = await fetch("/api/images/overrides", {
            method: "POST",
            body: fd,
          });
          const imgJson = await imgRes.json().catch(() => ({}));
          if (!imgRes.ok || !imgJson?.ok) {
            throw new Error(imgJson?.error || "Product saved but image upload failed");
          }
        }
        // Refresh the products list
        window.location.reload();
      } else {
        alert(data.error || "Failed to save product");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-slate-600">{ui.loadingProducts}</p>
        </div>
      </div>
    );
  }

  if (error && supplierProducts.length === 0 && loading === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">{ui.error}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700">{error}</p>
            <p className="mt-2 text-xs text-slate-500">Make sure Tomcat is running at port 8080</p>
            <Button onClick={() => { setError(null); setStockRefreshKey(k => k + 1); setLoading(true); }} className="mt-4">
              {ui.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="container mx-auto space-y-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">
                {user?.businessName || ui.supplierDashboard}
              </h1>
              <p className="break-words text-sm text-slate-600">
                {user?.businessCategory || ui.supplierPanel} • Account: {user?.ishyigaAccount}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Fast language switcher — compact dropdown */}
              {(() => {
                const langs = [
                  { code: "rw" as const, flag: "🇷🇼", label: "RW", native: "Kinyarwanda" },
                  { code: "en" as const, flag: "🇬🇧", label: "EN", native: "English" },
                  { code: "fr" as const, flag: "🇫🇷", label: "FR", native: "Français" },
                ]
                const current = langs.find((l) => l.code === language) ?? langs[1]
                return (
                  <div className="relative group">
                    <button className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                      <span className="text-sm leading-none">{current.flag}</span>
                      <span>{current.label}</span>
                      <span className="ml-0.5 text-slate-400">▾</span>
                    </button>
                    <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[140px] rounded-lg border border-slate-200 bg-white shadow-lg group-focus-within:block group-hover:block">
                      {langs.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => useLanguageStore.getState().setLanguage(l.code)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            language === l.code ? "font-bold text-blue-600" : "text-slate-700"
                          }`}
                        >
                          <span className="text-sm">{l.flag}</span>
                          <span>{l.native}</span>
                          {language === l.code && <span className="ml-auto text-blue-600">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <Button variant="ghost" asChild className="gap-2">
                <Link href="/account">
                  <User className="h-4 w-4" />
                  {ui.myProfile}
                </Link>
              </Button>
              {user?.dualPharmacyRetail && (
                <Button variant="ghost" asChild className="gap-2">
                  <Link href="/buyer/orders">
                    <Package className="h-4 w-4" />
                    {ui.myPurchases}
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                {ui.logout}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 ">
                {ui.dailySales}
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 ">
                <TrendingUp className="h-5 w-5 text-emerald-600 " />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 ">
                {Number(analytics?.dailySalesTotal ?? 0).toLocaleString()} RWF
              </div>
              <p className="mt-1 text-xs text-slate-500 ">
                {Number(analytics?.dailyOrdersCount ?? 0)} {ui.ordersToday}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 ">
                {ui.totalProducts}
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 ">
                <Package className="h-5 w-5 text-blue-600 " />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 ">
                {totalProducts}
              </div>
              <p className="mt-1 text-xs text-slate-500 ">{ui.allProducts}</p>
              {latestInventorySyncLabel != null && (
                <p className="mt-1.5 border-t border-slate-100 pt-1 text-xs text-slate-500">
                  {ui.lastSync}  {latestInventorySyncLabel}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 ">
                {ui.inventoryValue}
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 ">
                <TrendingUp className="h-5 w-5 text-green-600 " />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 ">
                {totalValue.toLocaleString()} RWF
              </div>
              <p className="mt-1 text-xs text-slate-500 ">{ui.totalStockValue}</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 ">
                {ui.lowStockItems}
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 ">
                <AlertTriangle className="h-5 w-5 text-yellow-600 " />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-700 ">
                {lowStock}
              </div>
              <p className="mt-1 text-xs text-slate-500 ">{ui.itemsBelow10Units}</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 ">
                {ui.outOfStock}
              </CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 ">
                <AlertTriangle className="h-5 w-5 text-red-600 " />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700 ">
                {outOfStock}
              </div>
              <p className="mt-1 text-xs text-slate-500 ">{ui.itemsWith0Stock}</p>
            </CardContent>
          </Card>
        </div>

        {/* Low stock alerts */}
        {(() => {
          const lowStockList = supplierProducts.filter((p) => p.stock <= 10 && p.stock > 0).slice(0, 5);
          if (lowStockList.length === 0) return null;
          return (
            <Card className="mb-6 bg-card shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-yellow-700 ">{ui.lowStockAlerts}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter("low")}>
                  {ui.viewAll} ({lowStock})
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-0 divide-y divide-slate-100 text-sm ">
                  {lowStockList.map((p) => (
                    <li
                      key={p.itemCode || p.ITEM_CODE}
                      className="flex items-start justify-between gap-3 py-2 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-slate-900 ">
                          {p.itemName || p.ITEM_NAME}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 ">
                          {ui.lastSync}: {formatProductLastSyncCell(lastStockUploadAt, p as Record<string, unknown>)}
                        </span>
                      </div>
                      <span className="text-yellow-700 font-medium shrink-0">
                        {p.stock ?? p.STOCK} {ui.left}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })()}

        {/* Best selling + Top-up sale — shop insights */}
        {analytics && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card
              className={cn(
                "relative overflow-hidden border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-md",
              )}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-200/25 blur-2xl"
                aria-hidden
              />
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/20">
                    <Trophy className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-900/80">
                      {ui.bestSellingToday}
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-[11px] font-medium text-slate-600">
                      {analytics.dailyOrdersCount} {ui.rankedByUnitsSold}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {bestSellingHero ? (
                  <>
                    <h3 className="line-clamp-3 text-xl font-black leading-snug tracking-tight text-slate-900">
                      {bestSellingHero.top.name}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm">
                        {bestSellingHero.top.quantity.toLocaleString()}{" "}
                        <span className="ml-1 font-semibold opacity-80">{ui.unitsSold}</span>
                      </span>
                      {bestSellingHero.pct != null ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
                          {bestSellingHero.pct}% {ui.ofTodaysLineRevenue} ·{" "}
                          {Number(bestSellingHero.top.total ?? 0).toLocaleString()} RWF
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-800">
                          {Number(bestSellingHero.top.total ?? 0).toLocaleString()} {ui.rwfLineTotal}
                        </span>
                      )}
                    </div>
                    {analytics.bestSelling.length > 1 ? (
                      <ul className="mt-4 space-y-2 border-t border-amber-100/90 pt-3 text-sm">
                        {analytics.bestSelling.slice(1, 5).map((item, i) => (
                          <li key={i} className="flex justify-between gap-3 text-slate-700">
                            <span className="min-w-0 truncate font-medium">{item.name}</span>
                            <span className="shrink-0 text-right text-xs font-semibold text-slate-600">
                              {item.quantity} · {Number(item.total ?? 0).toLocaleString()} RWF
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-2">
                    {analytics.dailyOrdersCount > 0 ? (
                      <p className="text-sm font-medium leading-relaxed text-amber-900/90">
                        {ui.weSee} {analytics.dailyOrdersCount} {ui.ordersTodayNoLines}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">{ui.noOrdersYetToday}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20">
                    <Sparkles className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-900/80">
                      {ui.topUpSale}
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-[11px] font-medium text-slate-600">
                      {ui.stockAndRevenueActions}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <ul className="space-y-2">
                  {topUpSaleBullets.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-snug text-slate-900">
                      <span
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
                        aria-hidden
                      />
                      <span className="font-medium">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-emerald-100 pt-3">
                  <Button variant="outline" size="sm" className="border-emerald-200 bg-white text-emerald-900" asChild>
                    <a href="#supplier-products">{ui.stockAndCatalog}</a>
                  </Button>
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" asChild>
                    <Link href="/supplier/orders">{ui.openOrders}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Slow movers + Restock */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
                  <TrendingDown className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-700">
                    {ui.slowMoving}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-[11px] font-medium text-slate-600">
                    {ui.slowMovingDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {inventoryInsights.slow.length === 0 ? (
                <p className="text-sm text-slate-600">{ui.slowMovingEmpty}</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {inventoryInsights.slow.map((item) => (
                    <li
                      key={item.itemCode || item.name}
                      className="flex items-start justify-between gap-2 py-2.5 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.stock.toLocaleString()} {ui.insightInStock}
                          {" · "}
                          {item.unitsSold > 0
                            ? `${item.unitsSold.toLocaleString()} ${ui.insightUnits30d}`
                            : ui.insightNoSales}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {ui.fmcgSlow}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-200/80 bg-gradient-to-b from-orange-50/90 to-white shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-md shadow-orange-500/20">
                  <RefreshCw className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-900/80">
                    {ui.recommendedRestock}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-[11px] font-medium text-slate-600">
                    {ui.recommendedRestockDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {inventoryInsights.restock.length === 0 ? (
                <p className="text-sm text-slate-600">{ui.recommendedRestockEmpty}</p>
              ) : (
                <ul className="divide-y divide-orange-100/80 text-sm">
                  {inventoryInsights.restock.map((item) => (
                    <li
                      key={item.itemCode || item.name}
                      className="flex items-start justify-between gap-2 py-2.5 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.stock.toLocaleString()} {ui.insightInStock}
                          {" · "}
                          {Number.isFinite(item.daysCover)
                            ? `${item.daysCover < 10 ? item.daysCover.toFixed(1) : Math.round(item.daysCover)} ${ui.insightDaysCover}`
                            : `— ${ui.insightDaysCover}`}
                          {item.suggestedQty > 0 ? (
                            <>
                              {" · "}
                              {ui.insightSuggest} +{item.suggestedQty.toLocaleString()}
                            </>
                          ) : null}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          item.stock === 0
                            ? "bg-red-100 text-red-800"
                            : "bg-orange-100 text-orange-900",
                        )}
                      >
                        {item.stock === 0 ? ui.outOfStock : ui.statusLowStock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-orange-100 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-200 bg-white text-orange-900"
                  asChild
                >
                  <a href="#supplier-products">{ui.insightViewCatalog}</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fast moving · FMCG — one collapsible */}
        <Card className="mb-8 bg-card shadow-md">
          <CardHeader
            className="cursor-pointer select-none border-b bg-emerald-50/80 transition-colors hover:bg-emerald-50"
            onClick={() => setFmcgOpen((o) => !o)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className="h-6 w-6 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl">{ui.fastMoving}</CardTitle>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                      {ui.fmcg}
                    </span>
                    {fmcgShelf.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {fmcgShelf.length} {ui.fmcgMovers}
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="mt-1">
                    {fmcgOpen ? ui.fmcgCollapseHint : ui.fastMovingDesc}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight
                className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${fmcgOpen ? "rotate-90" : ""}`}
              />
            </div>
          </CardHeader>
          {fmcgOpen && (
            <CardContent className="p-4 sm:p-6 space-y-3">
              <p className="text-xs text-slate-500">{ui.fmcgSubtitle}</p>
              {fmcgPreview.length === 0 ? (
                <p className="text-sm text-slate-600">{ui.fmcgEmpty}</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {fmcgPreview.map((p, i) => {
                    const name = String(
                      p.item_commercial_name ?? p.itemName ?? p.ITEM_NAME ?? p.item_name ?? "—",
                    ).trim();
                    const stock = Number(p.stock ?? p.STOCK ?? 0);
                    const units = Number(p.unitsSold ?? p.totalSold ?? 0);
                    const vel = Number(p.salesVelocity ?? 0);
                    const cls = p.movementClass;
                    const badge =
                      cls === "A"
                        ? { label: ui.fmcgFast, className: "bg-emerald-100 text-emerald-800" }
                        : cls === "B"
                          ? { label: ui.fmcgMedium, className: "bg-amber-100 text-amber-900" }
                          : cls === "C"
                            ? { label: ui.fmcgSlow, className: "bg-slate-100 text-slate-700" }
                            : null;
                    const code = String(p.ITEM_CODE ?? p.itemCode ?? "").trim();
                    return (
                      <li
                        key={code || `${name}-${i}`}
                        className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900">{name}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {stock.toLocaleString()} {ui.fmcgStock}
                            {" · "}
                            {units.toLocaleString()} {ui.fmcgUnits30d}
                            {" · "}
                            {vel > 0 ? `${vel.toFixed(1)}${ui.fmcgPerDay}` : `0${ui.fmcgPerDay}`}
                          </span>
                        </div>
                        {badge ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {fmcgPreview.length > 0 ? (
                <div className="border-t border-slate-100 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const first = fmcgPreview[0];
                      const q = String(
                        first?.item_commercial_name ?? first?.itemName ?? first?.ITEM_NAME ?? "",
                      ).trim();
                      if (q) setSearchTerm(q);
                      setStatusFilter("all");
                      setCategoryFilter("all");
                      setCurrentPage(1);
                      document.getElementById("supplier-products")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    {ui.fmcgViewInCatalog}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          )}
        </Card>

        {/* Shop With Me QR Code — collapsible so original dashboard stays primary */}
        <Card className="mb-8 bg-card shadow-md">
          <CardHeader
            className="cursor-pointer select-none border-b bg-slate-50 transition-colors hover:bg-slate-100"
            onClick={() => setShopWithMeQROpen((o) => !o)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="h-6 w-6 shrink-0 text-blue-600 " />
                <div>
                  <CardTitle className="text-xl">{ui.qrCodes}</CardTitle>
                  <CardDescription className="mt-1">
                    {shopWithMeQROpen
                      ? ui.qrExpandedDesc
                      : ui.qrCollapsedDesc}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {shopNickname.trim() && shopWithMeLink && (
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[140px]" title={shopWithMeLink}>
                    {shopNickname}
                  </span>
                )}
                <ChevronRight
                  className={`h-5 w-5 text-slate-500 transition-transform ${shopWithMeQROpen ? "rotate-90" : ""}`}
                />
              </div>
            </div>
          </CardHeader>
          {shopWithMeQROpen && (
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shop-nickname">{ui.shopNicknameLabel}</Label>
                  <Input
                    id="shop-nickname"
                    placeholder="known as"
                    value={shopNickname}
                    onChange={(e) => setShopNickname(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                {showBarOrRestaurantOption && (
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="bar-restaurant"
                      checked={isBarOrRestaurant}
                      disabled={isBarOrRestaurantFromAccount}
                      onCheckedChange={(checked) => setIsBarOrRestaurant(!!checked)}
                    />
                    <Label
                      htmlFor="bar-restaurant"
                      className={isBarOrRestaurantFromAccount ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}
                    >
                      {ui.barOrRestaurant}
                      {isBarOrRestaurantFromAccount && ` ${ui.setFromAccount}`}
                    </Label>
                  </div>
                )}
              </div>
              {showBarOrRestaurantOption && isBarOrRestaurant && (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="table-name">{ui.tableName}</Label>
                  <Input
                    id="table-name"
                    placeholder="e.g. TEST ISHYIGA2 or Table 5"
                    value={tableNameOrNumber}
                    onChange={(e) => setTableNameOrNumber(e.target.value)}
                  />
                </div>
              )}
              {shopWithMeLink && (
                <div className="flex flex-col items-start gap-4 border-t border-slate-200 pt-4  sm:flex-row">
                  <div className="rounded-lg bg-slate-50 p-4 ">
                    <QrCodeWithLogo value={shopWithMeLink} size={200} logoUrl={shopLogoUrl || undefined} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-slate-600 ">{ui.linkForCustomers}</Label>
                    <p className="break-all font-mono text-sm text-slate-700 ">{shopWithMeLink}</p>
                    <Button variant="outline" size="sm" onClick={copyShopWithMeLink} className="gap-2">
                      <Copy className="h-4 w-4" />
                      {ui.copyLink}
                    </Button>
                  </div>
                </div>
              )}

              {/* Supplier: scan to open my orders (e.g. on phone) */}
              {supplierOrdersLink && (
                <div className="mt-6 flex flex-col items-start gap-4 border-t border-slate-200 pt-6  sm:flex-row">
                  <div className="rounded-lg bg-slate-50 p-4 ">
                    <QrCodeWithLogo value={supplierOrdersLink} size={200} logoUrl={shopLogoUrl || undefined} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-slate-600 ">{ui.scanToOpenOrders}</Label>
                    <p className="text-sm text-slate-700 ">
                      {ui.scanWithPhoneDesc}
                    </p>
                    <p className="break-all font-mono text-sm text-slate-500 ">{supplierOrdersLink}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(supplierOrdersLink).then(() => alert("Link copied"));
                      }}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {ui.copyLink}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Product Management Card */}
        <Card id="supplier-products" className="bg-card scroll-mt-24 shadow-md">
          <CardHeader className="border-b bg-slate-50">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">{ui.myProductsTitle}</CardTitle>
                <CardDescription className="mt-1">
                  {ui.products} ({filteredProducts.length} {ui.of} {totalProducts})
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/supplier/products/add">
                    <Package className="h-4 w-4" />
                    {ui.bulkUpload}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBulkPriceOpen(true);
                    setBulkPriceSelected(new Set());
                    setBulkPricePercent("");
                  }}
                  className="gap-2"
                >
                  {ui.bulkPriceUpdate}
                </Button>
                <Button asChild variant="outline" className="gap-2 border-emerald-200 text-emerald-900 hover:bg-emerald-50">
                  <Link href="/register/seller?step=2">
                    <Layers className="h-4 w-4" />
                    {ui.addStockFromNiki}
                  </Link>
                </Button>
                <Button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowAddModal(true);
                  }}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  {ui.addProduct}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400 " />
                <input
                  type="text"
                  placeholder={ui.searchByName}
                  className="w-full rounded-lg border border-slate-300 bg-background py-2 pl-10 pr-4 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="w-full rounded-lg border border-slate-300 bg-background px-4 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">{ui.allCategories}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-lg border border-slate-300 bg-background px-4 py-2 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">{ui.allStatus}</option>
                <option value="active">{ui.activeStockFilter}</option>
                <option value="low">{ui.lowStockFilter}</option>
                <option value="out">{ui.outOfStockFilter}</option>
              </select>
            </div>

            {/* Table */}
            {paginatedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">
                  {searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                    ? ui.noProductsMatchingFilters
                    : ui.noProductsFound}
                </p>
                {supplierProducts.length === 0 && (
                  <Button asChild className="mt-4">
                    <Link href="/supplier/products/add">{ui.addYourFirstProduct}</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ResponsiveTable className="rounded-lg border border-slate-200" minWidth={PRODUCT_TABLE_MIN_WIDTH}>
                  <table className="w-full border-collapse text-sm">
                    <thead className="border-b border-slate-200 bg-slate-100">
                      <tr>
                        <th className={`${productTh} min-w-[11rem]`} title={ui.thProduct}>
                          {ui.thProduct}
                        </th>
                        <th className={`${productTh} min-w-[6.5rem]`} title={ui.thSellingPrice}>
                          {ui.thSellingPrice}
                        </th>
                        <th className={`${productTh} min-w-[6.5rem]`} title={ui.thCostPrice}>
                          {ui.thCostPrice}
                        </th>
                        <th className={`${productTh} min-w-[4.5rem]`} title={ui.thPackage}>
                          {ui.thPackage}
                        </th>
                        <th className={`${productTh} min-w-[4.5rem]`} title={ui.thBatch}>
                          {ui.thBatch}
                        </th>
                        <th className={`${productTh} min-w-[5.5rem]`} title={ui.thExpiry}>
                          {ui.thExpiry}
                        </th>
                        <th className={`${productThCenter} min-w-[4rem]`} title={ui.thStock}>
                          {ui.thStock}
                        </th>
                        <th className={`${productTh} min-w-[8.5rem]`} title={ui.thLastSync}>
                          {ui.thLastSync}
                        </th>
                        <th className={`${productThCenter} min-w-[5.5rem]`} title={ui.thStatus}>
                          {ui.thStatus}
                        </th>
                        <th className={`${productTh} min-w-[5rem]`} title={ui.thValue}>
                          {ui.thValue}
                        </th>
                        <th className={`${productTh} min-w-[4rem]`} title={ui.thImage}>
                          {ui.thImage}
                        </th>
                        <th className={`${productThCenter} min-w-[5.5rem]`} title={ui.thActions}>
                          {ui.thActions}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 ">
                      {paginatedProducts.map((p, rowIndex) => {
                        const displayName = p.ITEM_NAME || p.itemName || "Unknown";
                        const displayCode = p.ITEM_CODE || p.itemCode || "";
                        const uniqueKey = `${displayCode}-${startIndex + rowIndex}`;
                        const pr = p as Record<string, unknown>;
                        const emballageRaw = resolveItemEmballageRaw(pr);
                        const displaySelling = lineSellingPriceFromProductRow(pr);
                        const displayCost = lineCostPriceFromProductRow(pr);
                        const revenue = displayCost * Number(p.stock ?? 0);
                        const emballageDisplay =
                          formatItemEmballageMultiplierOnly(emballageRaw);

                        const stateFromBatchColumns =
                          p.BATCH || p.DATE_EXP
                            ? `Ba:${p.BATCH || "NA"}| Ex:${p.DATE_EXP || "NA"}`
                            : "";
                        const itemStateRaw =
                          p.item_state ??
                          p.batchInfo ??
                          (stateFromBatchColumns || p.DESCRIPTION || "");
                        const {
                          batch,
                          expiryLabel,
                          isExpired,
                          expiryRaw,
                          exDdMmYyEncoded,
                          expiryAt,
                        } = parseItemStateBatchExpiry(itemStateRaw);
                        const expiryAsEncodedOnly = Boolean(exDdMmYyEncoded && !expiryAt);

                        return (
                          <tr
                            key={uniqueKey}
                            className="transition-colors hover:bg-slate-50 "
                          >
                            <td className="px-2 py-3 min-w-[11rem]">
                              <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 ">
                                  <Package className="h-5 w-5 text-slate-500 " />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 break-words">
                                    {displayName}
                                  </p>
                                  <p className="text-xs text-slate-500 break-all">{displayCode}</p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 tabular-nums">
                              {displaySelling > 0 ? (
                                <span className="whitespace-nowrap font-medium text-slate-900 ">
                                  {displaySelling.toLocaleString()}{" "}
                                  {p.currency ?? "RWF"}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-sm italic">
                                  {ui.noPrice}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 tabular-nums">
                              <span className="font-medium text-slate-900 ">
                                {displayCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{" "}
                                {p.currency ?? "RWF"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700 ">
                              <span title={emballageDisplay}>
                                {emballageDisplay}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700 ">
                              {batch ? (
                                <span className="font-mono text-xs" title={batch}>
                                  {batch}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-sm">
                              {expiryLabel ? (
                                <div>
                                  <span
                                    className={
                                      isExpired
                                        ? "text-red-700 font-medium"
                                        : expiryRaw
                                          ? "text-amber-800"
                                          : "text-slate-800 font-mono"
                                    }
                                    title={
                                      isExpired
                                        ? "Expired (valid calendar date from Ex)"
                                        : expiryRaw
                                          ? "Non-standard Ex value"
                                          : expiryAsEncodedOnly
                                            ? "Shown as dd/mm/yy from Ex (not adjusted)"
                                            : "Ex dd/mm/yy (valid calendar date)"
                                    }
                                  >
                                    {expiryLabel}
                                    {isExpired ? (
                                      <span className="ml-1.5 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                                        {ui.expired}
                                      </span>
                                    ) : null}
                                    {expiryRaw && !isExpired ? (
                                      <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                        {ui.check}
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-center tabular-nums">
                              <span
                                className={`font-semibold ${
                                  p.stock === 0
                                    ? "text-red-600"
                                    : p.stock <= 10
                                    ? "text-yellow-600"
                                    : "text-slate-900 "
                                }`}
                              >
                                {p.stock}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-sm tabular-nums text-slate-600 ">
                              {formatProductLastSyncCell(lastStockUploadAt, p as Record<string, unknown>)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-center">
                              <span
                                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                                  p.stock === 0
                                    ? "bg-red-100 text-red-700"
                                    : p.stock <= 10
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {p.stock === 0 ? ui.statusOutOfStock : p.stock <= 10 ? ui.statusLowStock : ui.statusActive}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 tabular-nums">
                              {revenue > 0 ? (
                                <span className="font-medium text-slate-900 ">
                                  {revenue.toLocaleString()} RWF
                                </span>
                              ) : (
                                <span className="text-slate-400 text-sm italic">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-3 align-top">
                              <SupplierProductTableImage
                                product={p as Record<string, unknown>}
                                alt={displayName}
                              />
                            </td>
                            <td className="whitespace-nowrap px-2 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Link href={`/supplier/products/edit/${displayCode}`}>
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => handleDelete(p)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ResponsiveTable>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{ui.show}</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-background px-3 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-sm text-slate-600">{ui.entries}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      {ui.showing} {startIndex + 1} {ui.to}{" "}
                      {Math.min(endIndex, filteredProducts.length)} {ui.of}{" "}
                      {filteredProducts.length} {ui.entries}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {ui.previous}
                    </Button>

                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                        )
                        .map((page, idx, arr) => (
                          <div key={page} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2 text-slate-400">...</span>
                            )}
                            <Button
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={`h-8 w-8 p-0 ${
                                currentPage === page
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : ""
                              }`}
                            >
                              {page}
                            </Button>
                          </div>
                        ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
                      {ui.next}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bulk price update modal */}
        <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{ui.bulkPriceTitle}</DialogTitle>
              <DialogDescription>
                {ui.bulkPriceDesc}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{ui.percentageChange}</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10 or -5"
                  value={bulkPricePercent}
                  onChange={(e) => setBulkPricePercent(e.target.value)}
                />
                <p className="text-xs text-slate-500">{ui.percentageHint}</p>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
                {filteredProducts.slice(0, 50).map((p) => {
                  const code = p.itemCode || p.ITEM_CODE || "";
                  const selected = bulkPriceSelected.has(code);
                  return (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          setBulkPriceSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(code);
                            else next.delete(code);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm truncate flex-1">{p.itemName || p.ITEM_NAME}</span>
                      <span className="text-xs text-slate-500">{p.price ?? p.UNITY_PRICE} RWF</span>
                    </label>
                  );
                })}
                {filteredProducts.length > 50 && (
                  <p className="text-xs text-slate-500">{ui.showingFirst50}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkPriceOpen(false)}>{ui.cancel}</Button>
              <Button
                disabled={bulkPriceSubmitting || bulkPriceSelected.size === 0 || !bulkPricePercent.trim()}
                onClick={async () => {
                  const percent = parseFloat(bulkPricePercent);
                  if (!Number.isFinite(percent) || !user?.ishyigaAccount) return;
                  setBulkPriceSubmitting(true);
                  try {
                    const res = await fetch("/api/supplier/stock", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "bulkPriceUpdate",
                        account: user.ishyigaAccount,
                        itemCodes: Array.from(bulkPriceSelected),
                        percentChange: percent,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data?.ok) {
                      setBulkPriceOpen(false);
                      setBulkPriceSelected(new Set());
                      setBulkPricePercent("");
                      window.location.reload();
                    } else {
                      alert(data?.error || "Update failed");
                    }
                  } catch (e) {
                    alert("Request failed");
                  } finally {
                    setBulkPriceSubmitting(false);
                  }
                }}
              >
                {bulkPriceSubmitting ? ui.updating : ui.apply}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Product Modal */}
        <AddProductModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveProduct}
          editingProduct={editingProduct}
          existingCodes={supplierProducts
            .map(p => String(p.itemCode || p.ITEM_CODE || ""))
            .filter(Boolean)}
        />
      </div>
    </div>
  );
}
export default function SupplierDashboardPage() {
  return <SupplierDashboard />;
}
