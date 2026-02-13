"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderNotification } from "@/components/order-notification";
import { useAuthStore } from "@/lib/auth-store";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);

  const menu = [
    { name: "Dashboard", href: "/supplier/dashboard" },
    // { name: "My Products", href: "/supplier/products" },
    { name: "Orders", href: "/supplier/orders" },
    // { name: "B2B Procurement / Kurangura byinshi", href: "/supplier/b2b" },
    { name: "Expenses", href: "/supplier/expenses" },
    { name: "Add Product", href: "/supplier/products/add" },
    { name: "Settings", href: "/supplier/settings/location" },
  ];

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

  // Enhanced session protection with automatic redirect
  useEffect(() => {
    if (!hasHydrated) return; // Wait for store to load from localStorage

    if (!isAuthenticated || user?.role !== "supplier") {
      // Clear any existing auth state and redirect
      logout();
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, user, router, logout]);

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
          <OrderNotification />
        </main>
      </div>
    </div>
  );
}
