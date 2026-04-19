"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X, LogOut, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnifiedNotification } from "@/components/unified-notification";
import { useAuthStore } from "@/lib/auth-store";
import { isRestoBarPreferredCategories } from "@/lib/supplier-sector";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams?.get("account")?.trim() ?? "";
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const login = useAuthStore((state) => state.login);

  /**
   * Self Ordering + Tables are restaurant/bar features only (see PREFEREDCATEGORIES).
   * Opt-in when profile looks like bar/restaurant; never show if auth flagged pharmacySector.
   */
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
      { name: "Dashboard", href: "/supplier/dashboard" },
      { name: "Orders", href: "/supplier/orders" },
    ];
    if (showDualPurchases) {
      items.push({ name: "My purchases", href: "/buyer/orders" });
    }
    if (showRestoSupplierLinks) {
      items.push(
        { name: "Self Ordering", href: "/supplier/self-ordering" },
        { name: "Tables", href: "/supplier/tables" },
      );
    }
    items.push(
      { name: "Ratings", href: "/supplier/ratings" },
      { name: "Rekizisiyo / Kurangura byinshi", href: "/supplier/b2b" },
      { name: "Expenses", href: "/supplier/expenses" },
      { name: "Upload Stock", href: "/supplier/products/add" },
      { name: "Scan Menu", href: "/supplier/scan-menu" },
      { name: "Settings", href: "/supplier/settings/location" },
    );
    return items;
  }, [user?.dualPharmacyRetail, user?.pharmacySector, showRestoKioskNav]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Keep supplier navigation reachable on all devices:
  // desktop starts open, smaller screens start closed.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => setSidebarOpen(mql.matches);
    syncSidebar();
    mql.addEventListener("change", syncSidebar);
    return () => mql.removeEventListener("change", syncSidebar);
  }, []);

  // Close sidebar with Escape key when open
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

  // When on orders page with ?account=: ensure session reflects that account (auto-login + real seller name)
  const isOrdersPageWithAccount =
    (pathname === "/supplier/orders" || pathname === "/supplier/kiosk-orders") &&
    accountFromUrl.length > 0;
  useEffect(() => {
    if (!hasHydrated || !isOrdersPageWithAccount) return;

    // If current session already matches this account and has a human-readable name, keep it
    const current = user;
    const hasNiceName =
      !!current?.name &&
      current.name.trim().length > 0 &&
      current.name !== current.ishyigaAccount;
    if (current?.ishyigaAccount === accountFromUrl && hasNiceName) {
      return;
    }

    // Fetch supplier profile to get real owner name for this account, then (re)login
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
        // best-effort only; fall back to account code
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

  // Enhanced session protection with automatic redirect (skip when we're creating session from ?account=)
  useEffect(() => {
    if (!hasHydrated) return; // Wait for store to load from localStorage
    if (isOrdersPageWithAccount && !isAuthenticated) return; // Let the effect above create session first

    if (!isAuthenticated || user?.role !== "supplier") {
      logout();
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, user, isOrdersPageWithAccount, router, logout]);

  // ── Full-screen bypass for kiosk customer display ──────────────────────────
  if (pathname.startsWith("/supplier/kiosk-orders")) {
    return <div className="min-h-screen bg-slate-900">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 truncate pr-2">
          {user?.businessName || "Supplier Panel"}
        </h1>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
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
                {user?.businessName || "Supplier Panel"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {user?.businessCategory || "Manage your products and orders"}
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {menu.map((item) => (
                  <li key={item.name}>
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

            {/* Grandma marketplace (mobile-style app) */}
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
                  "flex w-full items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-950 shadow-sm transition-colors hover:bg-sky-100",
                  pathname?.startsWith("/grandma") && "border-sky-400 bg-sky-100 ring-2 ring-sky-200",
                )}
              >
                <Smartphone className="h-5 w-5 shrink-0 text-sky-700" aria-hidden />
                <span className="leading-tight">Grandma app</span>
              </Link>
              <p className="mt-1.5 px-1 text-[11px] leading-snug text-slate-500">
                Shop and orders in the Grandma experience
              </p>
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
                <span>Logout</span>
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
