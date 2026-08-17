"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X, LogOut, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnifiedNotification } from "@/components/unified-notification";
import { useAuthStore } from "@/lib/auth-store";
import { isRestoBarPreferredCategories } from "@/lib/supplier-sector";
import { useLanguageStore, type Language } from "@/lib/language-store";

const SUPPLIER_UI: Record<Language, {
  supplierPanel: string; manageProducts: string; dashboard: string
  orders: string; buyerDashboard: string; myPurchases: string
  selfOrdering: string; tables: string; ratings: string
  b2b: string; expenses: string; uploadStock: string
  scanMenu: string; settings: string; grandma: string
  grandmaHint: string; logout: string; closeSidebar: string
  openSidebar: string
}> = {
  en: {
    supplierPanel: "Supplier Panel",
    manageProducts: "Manage your products and orders",
    dashboard: "Dashboard",
    orders: "Orders",
    buyerDashboard: "Buyer Dashboard",
    myPurchases: "My purchases",
    selfOrdering: "Self Ordering",
    tables: "Tables",
    ratings: "Ratings",
    b2b: "B2B / Wholesale",
    expenses: "Expenses",
    uploadStock: "Upload Stock",
    scanMenu: "Scan Menu",
    settings: "Settings",
    grandma: "Grandma",
    grandmaHint: "Mobile shop, best seller & top-up tips (seller mode)",
    logout: "Logout",
    closeSidebar: "Close sidebar",
    openSidebar: "Open sidebar",
  },
  rw: {
    supplierPanel: "Ikibaho cy'Umucuruzi",
    manageProducts: "Gucunga ibicuruzwa n'ibitumijwe",
    dashboard: "Ikibaho",
    orders: "Ibitumijwe",
    buyerDashboard: "Ikibaho cy'Umuguzi",
    myPurchases: "Ibyo naguze",
    selfOrdering: "Gutumiza ku meza",
    tables: "Ameza",
    ratings: "Amanota",
    b2b: "Rekizisiyo / Kurangura byinshi",
    expenses: "Ibyakoreshejwe",
    uploadStock: "Ongeraho sitoki",
    scanMenu: "Soma menyu",
    settings: "Ibigenga",
    grandma: "Grandma",
    grandmaHint: "Iduka kuri telefoni, ibicuruzwa bigurishwa cyane n'inyongera muri sitoki",
    logout: "Sohoka",
    closeSidebar: "Funga urutonde",
    openSidebar: "Fungura urutonde",
  },
  fr: {
    supplierPanel: "Panneau Fournisseur",
    manageProducts: "G\u00e9rer vos produits et commandes",
    dashboard: "Tableau de bord",
    orders: "Commandes",
    buyerDashboard: "Tableau acheteur",
    myPurchases: "Mes achats",
    selfOrdering: "Commande en libre-service",
    tables: "Tables",
    ratings: "\u00c9valuations",
    b2b: "B2B / Grossiste",
    expenses: "D\u00e9penses",
    uploadStock: "Ajouter du stock",
    scanMenu: "Scanner le menu",
    settings: "Param\u00e8tres",
    grandma: "Grandma",
    grandmaHint: "Boutique mobile, meilleures ventes et r\u00e9approvisionnement (mode vendeur)",
    logout: "D\u00e9connexion",
    closeSidebar: "Fermer le menu",
    openSidebar: "Ouvrir le menu",
  },
};

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams?.get("account")?.trim() ?? "";
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const login = useAuthStore((state) => state.login);
  const language = useLanguageStore((s) => s.language);
  const ui = SUPPLIER_UI[language] ?? SUPPLIER_UI.en;

  const [showRestoKioskNav, setShowRestoKioskNav] = useState(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user?.ishyigaAccount || user.role !== "supplier") {
      setShowRestoKioskNav(false);
      return;
    }

    let cancelled = false;
    fetch(`/api/supplier/profile?account=${encodeURIComponent(user.ishyigaAccount)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: { preferredCategories?: string }) => {
        if (cancelled) return;
        setShowRestoKioskNav(isRestoBarPreferredCategories(data?.preferredCategories));
      })
      .catch(() => {
        if (!cancelled) setShowRestoKioskNav(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, isAuthenticated, user?.ishyigaAccount, user?.role]);

  const menu = useMemo(() => {
    const showDualPurchases = !!user?.dualPharmacyRetail;
    const showRestoSupplierLinks = showRestoKioskNav && user?.pharmacySector !== true;

    const items: { name: string; href: string }[] = [
      { name: ui.dashboard, href: "/supplier/dashboard" },
      { name: ui.orders, href: "/supplier/orders" },
    ];
    if (showDualPurchases) {
      items.push(
        { name: ui.buyerDashboard, href: "/buyer/dashboard" },
        { name: ui.myPurchases, href: "/buyer/orders" },
      );
    }
    if (showRestoSupplierLinks) {
      items.push(
        { name: ui.selfOrdering, href: "/supplier/self-ordering" },
        { name: ui.tables, href: "/supplier/tables" },
      );
    }
    items.push(
      { name: "UrubutoPay", href: "/supplier/urubuto" },
      { name: ui.ratings, href: "/supplier/ratings" },
      { name: ui.b2b, href: "/supplier/b2b" },
      { name: ui.expenses, href: "/supplier/expenses" },
      { name: ui.uploadStock, href: "/supplier/products/add" },
      { name: ui.scanMenu, href: "/supplier/scan-menu" },
      { name: ui.settings, href: "/supplier/settings/location" },
    );
    return items;
  }, [user?.dualPharmacyRetail, user?.pharmacySector, showRestoKioskNav, ui]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => setSidebarOpen(mql.matches);
    syncSidebar();
    mql.addEventListener("change", syncSidebar);
    return () => mql.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  const isOrdersPageWithAccount =
    (pathname === "/supplier/orders" || pathname === "/supplier/kiosk-orders") &&
    accountFromUrl.length > 0;
  useEffect(() => {
    if (!hasHydrated || !isOrdersPageWithAccount) return;

    const current = user;
    const hasNiceName =
      !!current?.name &&
      current.name.trim().length > 0 &&
      current.name !== current.ishyigaAccount;
    if (current?.ishyigaAccount === accountFromUrl && hasNiceName) {
      return;
    }

    (async () => {
      let displayName = accountFromUrl;
      try {
        const res = await fetch(`/api/supplier/profile?account=${encodeURIComponent(accountFromUrl)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (res.ok) {
          const j: any = await res.json().catch(() => ({}));
          const owner = (j?.owner || j?.OWNER || "").toString().trim();
          if (owner) {
            displayName = owner;
          }
        }
      } catch {
        // best-effort
      }

      login({
        id: accountFromUrl,
        email: `${accountFromUrl}@supplier`,
        name: displayName,
        role: "supplier",
        phone: "",
        location: "",
        businessName: displayName,
        ishyigaAccount: accountFromUrl,
      });
    })();
  }, [hasHydrated, isOrdersPageWithAccount, accountFromUrl, user, login]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isOrdersPageWithAccount && !isAuthenticated) return;

    if (!isAuthenticated || user?.role !== "supplier") {
      logout();
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, user, isOrdersPageWithAccount, router, logout]);

  if (pathname.startsWith("/supplier/kiosk-orders")) {
    return <div className="min-h-screen bg-slate-900">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 truncate pr-2">
          {user?.businessName || ui.supplierPanel}
        </h1>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={sidebarOpen ? ui.closeSidebar : ui.openSidebar}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50
            w-64 bg-white border-r border-slate-200
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-slate-200 hidden lg:block">
              <h2 className="text-2xl font-bold text-slate-900">
                {user?.businessName || ui.supplierPanel}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {user?.businessCategory || ui.manageProducts}
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {menu.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeSidebar}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200",
                        pathname === item.href
                          ? "bg-slate-200 text-slate-900"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Grandma marketplace */}
            <div className="px-4 pb-2">
              <Link
                href="/grandma"
                onClick={() => {
                  try {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem("grandma:mode", "seller");
                    }
                  } catch {
                    /* ignore */
                  }
                  closeSidebar();
                }}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 text-left text-sm font-semibold text-sky-950 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/90",
                  pathname?.startsWith("/grandma") && "border-sky-400 bg-sky-100 ring-2 ring-sky-200",
                )}
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 shrink-0 text-sky-700" aria-hidden />
                  <span className="leading-tight">{ui.grandma}</span>
                </span>
                <span className="pl-7 text-[11px] font-normal leading-snug text-slate-600">
                  {ui.grandmaHint}
                </span>
              </Link>
            </div>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-slate-200">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                onClick={() => {
                  logout();
                  router.push("/login");
                  closeSidebar();
                }}
              >
                <LogOut size={20} />
                <span>{ui.logout}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Main Content */}
        <main className={cn("flex-1 min-w-0 lg:overflow-y-auto transition-[padding] duration-300", sidebarOpen && "lg:pl-64")}>
          <div className="p-4 lg:p-8">
            {children}
          </div>
          <UnifiedNotification />
        </main>
      </div>
    </div>
  );
}
