"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { RotateCcw, History, RefreshCcw } from "lucide-react"
import {
  ShoppingCart,
  User,
  Heart,
  Truck,
  PackageSearch,
  PackageCheck,
  Users,
  BarChart3,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

import { LanguageSelector } from "@/components/language-selector"
import { GlobalSearch } from "@/components/global-search"
import { NotificationBell } from "@/components/notification-bell"

import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { useAuthStore } from "@/lib/auth-store"
import { useOrdersStore } from "@/lib/orders-store"
import { useTranslation } from "@/hooks/use-translation"
import { TableCommandBanner } from "@/components/table-command-banner"
import { LocationBadge } from "@/components/location-badge"

export function Header() {
  const router = useRouter()
  const { t } = useTranslation()

  const totalItems = useCartStore((s) => s.getTotalItems())
  const favoritesCount = useFavoritesStore((s) => s.favorites.length)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const pendingCount = useOrdersStore((s) => s.getPendingCount())
  const [sellerCount, setSellerCount] = useState<number>(0)

  useEffect(() => {
    let ignore = false
    async function fetchOrders() {
      try {
        if (!user?.ishyigaAccount || user.role !== "supplier") return
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: user.ishyigaAccount }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!ignore && res.ok && json?.ok) {
          const orders: any[] = json.orders || []
          const cnt = orders.filter(
            (o) => String(o.ORDER_STATUS || "").toUpperCase() !== "DELIVERED"
          ).length
          setSellerCount(cnt)
        }
      } catch {
        // best-effort only
      }
    }
    fetchOrders()
    return () => {
      ignore = true
    }
  }, [user?.ishyigaAccount, user?.role])

  const handleLogout = () => {
    logout()
    window.location.href = "/"
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/images/ishyiga-logo.png"
              alt="Ishyiga Software"
              width={100}
              height={35}
              className="h-8 w-auto md:h-10"
            />
          </Link>

          {/* Global Search - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-md relative items-center gap-2">
            <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full" />
            <LocationBadge />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            <LanguageSelector />

            {/* Notification Bell - Shows for buyers only (suppliers have unified notification) */}
            {isAuthenticated && user?.role !== "supplier" && <NotificationBell />}

            {isAuthenticated ? (
              <>
                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex h-9 gap-2" aria-label="Open account menu">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="max-w-[120px] truncate">{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{user?.name}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        router.push(
                          user?.role === "supplier"
                            ? "/supplier/dashboard"
                            : "/orders"
                        )
                      }
                    >
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleLogout()
                      }}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      {t("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Supplier Orders */}
                {user?.role === "supplier" && (
                  <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Orders (Seller)">
                    <Link href="/supplier/orders">
                      <PackageSearch className="h-5 w-5" />
                      {sellerCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                          {sellerCount}
                        </span>
                      )}
                    </Link>
                  </Button>
                )}

                {/* Customer Orders */}
                {user?.role !== "supplier" && (
                  <>
                    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Orders">
                      <Link href="/orders">
                        <Truck className="h-5 w-5" />
                        {pendingCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    </Button>

                    {/* Deliveries */}
                    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Deliveries">
                      <Link href="/deliveries">
                        <PackageCheck className="h-5 w-5" />
                      </Link>
                    </Button>

                    {/* Table Commands */}
                    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Table Commands">
                      <Link href="/tables">
                        <Users className="h-5 w-5" />
                      </Link>
                    </Button>
                  </>
                )}

                {/* Payment Dashboard - Admin/Staff only */}
                {(user?.role === "admin" || user?.role === "staff") && (
                  <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Payment Dashboard">
                    <Link href="/payment/dashboard">
                      <BarChart3 className="h-5 w-5" />
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href="/login">
                  <User className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t("login")}</span>
                </Link>
              </Button>
            )}

            {/* Favorites */}
            <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Favorites">
              <Link href="/favorites">
                <Heart className="h-5 w-5" />
                {favoritesCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {favoritesCount}
                  </span>
                )}
              </Link>
            </Button>
            {/* Reorder */}
            <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Reorder Items">
              <Link href="/reorder">
                <RotateCcw className="h-5 w-5" />
              </Link>
            </Button>


            {/* Ratings */}
            <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Ratings">
              <Link href="/ratings">
                <Star className="h-5 w-5" />
              </Link>
            </Button>

            {/* Cart */}
            <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Cart">
              <Link href="/cart">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile Search + Location */}
        <div className="pb-3 space-y-2 lg:hidden">
          <div className="relative w-full">
            <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full" />
          </div>
          <div className="flex items-center justify-center">
            <LocationBadge />
          </div>
        </div>
      </div>
      <TableCommandBanner />
    </header>
  )
}
