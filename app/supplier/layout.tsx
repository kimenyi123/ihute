"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { OrderNotification } from "@/components/order-notification";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menu = [
    { name: "Dashboard", href: "/supplier/dashboard" },
    { name: "My Products", href: "/supplier/products" },
    { name: "Orders", href: "/supplier/orders" },
    { name: "Expenses", href: "/supplier/expenses" },
    { name: "Add Product", href: "/supplier/products/add" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r bg-white p-4">
        <h2 className="text-lg font-semibold mb-4">Supplier Panel</h2>
        <nav className="space-y-2">
          {menu.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100",
                pathname === item.href && "bg-slate-200 font-semibold"
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-6">{children}</main>
      <OrderNotification />
    </div>
  );
}
