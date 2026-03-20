"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnifiedNotification } from "@/components/unified-notification";
import { useAuthStore } from "@/lib/auth-store";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams?.get("account")?.trim() ?? "";
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const login = useAuthStore((state) => state.login);

  const [preferredCategories, setPreferredCategories] = useState<string>("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const menu = [
    { name: "Dashboard", href: "/supplier/dashboard" },
    // { name: "My Products", href: "/supplier/products" },
    { name: "Orders", href: "/supplier/orders" },
    { name: "Self Ordering", href: "/supplier/self-ordering" },
    { name: "Tables", href: "/supplier/tables" },
    { name: "Ratings", href: "/supplier/ratings" },
    { name: "Rekizisiyo / Kurangura byinshi", href: "/supplier/b2b" },
    { name: "Expenses", href: "/supplier/expenses" },
    { name: "Upload Stock", href: "/supplier/products/add" },
    { name: "Scan Menu", href: "/supplier/scan-menu" },
    { name: "Settings", href: "/supplier/settings/location" },
  ];

  // Hide Self Ordering for business categories that are not bar/restro or bar-resto.
  // We can decide either from `user.businessCategory` OR from the supplier profile preferences
  // (`/api/supplier/profile` → preferredCategories from account_signup.PREFEREDCATEGORIES).
  const businessCategory = (user?.businessCategory ?? "").toString().toLowerCase()
  const allowSelfOrderingByCategories = (categoryString: string) => {
    const s = (categoryString ?? "").toString().toLowerCase()
    if (!s) return false
    // Accept multiple spellings coming from registration and/or admin edits:
    // "bar/restaurant", "bar-resto", "resto-bar", etc.
    const hasBar = s.includes("bar")
    const hasRestaurant = s.includes("restro") || s.includes("restaurant") || s.includes("resto")
    return hasBar && hasRestaurant
  }

  const allowSelfOrdering =
    // If user provides businessCategory, prefer it.
    businessCategory
      ? allowSelfOrderingByCategories(businessCategory)
      : // Otherwise use backend profile preferences if already loaded.
        profileLoaded
        ? allowSelfOrderingByCategories(preferredCategories)
        : false

  useEffect(() => {
    // Best-effort: fetch profile preferences to decide menu visibility.
    // This avoids relying on `user.businessCategory` being present in the login response.
    const account = user?.ishyigaAccount
    if (!account) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/supplier/profile?account=${encodeURIComponent(account)}`, {
          method: "GET",
          cache: "no-store",
        })
        if (!res.ok) return
        const j: any = await res.json().catch(() => ({}))
        if (!cancelled) {
          setPreferredCategories(typeof j?.preferredCategories === "string" ? j.preferredCategories : "")
          setProfileLoaded(true)
        }
      } catch {
        if (!cancelled) setProfileLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.ishyigaAccount])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
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
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Supplier Panel</h1>
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
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            lg:translate-x-0
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
                    {item.href === "/supplier/self-ordering" && !allowSelfOrdering ? null : (
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
                    )}
                  </li>
                ))}
              </ul>
            </nav>

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
        <main className="flex-1 lg:ml-64 lg:overflow-y-auto">
          <div className="p-4 lg:p-8">
            {children}
          </div>
          <UnifiedNotification />
        </main>
      </div>
    </div>
  );
}
