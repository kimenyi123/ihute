"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Star, Menu, X } from "lucide-react"
import { ScrollText } from "lucide-react"
import {
  ShoppingCart,
  User,
  Heart,
  Eye,
  PackageSearch,
  PackageCheck,
  Users,
  BarChart3,
  LogOut,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { statusIndicatesDelivered } from "@/lib/order-status-map"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet"

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
import { BarcodeAddToCart } from "@/components/barcode-add-to-cart"
import { cn } from "@/lib/utils"

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  /** Hide top "Search products…" when already scoped to a supplier on /search (catalog or item deep link). */
  const hideHeaderGlobalSearch =
    pathname === "/search" && Boolean(searchParams.get("supplier")?.trim())

  const totalItems = useCartStore((s) => s.getTotalItems())
  const favoritesCount = useFavoritesStore((s) => s.favorites.length)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const pendingCount = useOrdersStore((s) => s.getPendingCount())
  const [sellerCount, setSellerCount] = useState<number>(0)
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
            (o) => !statusIndicatesDelivered(String(o.ORDER_STATUS || ""))
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
    // Brief delay so store/localStorage clear completes before redirect
    setTimeout(() => {
      window.location.href = "/"
    }, 0)
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

          {/* Global Search - Desktop (hidden when viewing a supplier-scoped /search?supplier=…) */}
          <div
            className={cn(
              "hidden lg:flex min-w-0 flex-1 max-w-3xl relative items-center gap-2",
              hideHeaderGlobalSearch && "justify-end",
            )}
          >
            {!hideHeaderGlobalSearch && (
              <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full min-w-0" />
            )}
            <LocationBadge />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            <LanguageSelector />

            {/* Notification Bell - Shows for buyers only (suppliers have unified notification) */}
            {isAuthenticated && (user?.role !== "supplier" || user?.dualPharmacyRetail) && <NotificationBell />}

            {isAuthenticated ? (
              <>
                {/* User Dropdown - wrapper so profile is on top and clickable */}
                <div className="relative z-[60]">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      asChild
                      className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                    >
                      <button
                        type="button"
                        className="inline-flex h-9 min-w-0 md:min-w-[120px] items-center gap-1 md:gap-2 rounded-md px-2 md:px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        aria-label="Open account menu"
                      >
                        <User className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline max-w-[80px] md:max-w-[120px] truncate">{user?.name}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 z-[100]" sideOffset={4}>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{user?.name}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user?.role === "supplier" && (
                      <DropdownMenuItem onSelect={() => router.push("/account")}>
                        <User className="mr-2 h-4 w-4" />
                        My profile
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() =>
                        router.push(
                          user?.role === "supplier"
                            ? "/supplier/dashboard"
                            : "/buyer/dashboard"
                        )
                      }
                    >
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => handleLogout()}
                      className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>

                {/* Order icons - hidden on mobile, visible on desktop */}
                <div className="hidden md:flex items-center gap-1">
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
                  {(user?.role !== "supplier" || user?.dualPharmacyRetail) && (
                    <>
                      <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Orders">
                        <Link href="/buyer/orders">
                          <ScrollText className="h-5 w-5" />
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
                </div>
              </>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href="/login">
                  <User className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t("login")}</span>
                </Link>
              </Button>
            )}

            {/* Desktop-only icons - hidden on mobile */}
            <div className="hidden md:flex items-center gap-1">
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
              {/* Watched prices */}
              <Button asChild variant="ghost" size="icon" className="h-9 w-9" title="Watched prices">
                <Link href="/price-watch">
                  <Eye className="h-5 w-5" />
                </Link>
              </Button>
              {/* Reorder (use orders-style icon) */}
              <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="Reorder Items">
                <Link href="/reorder">
                  <PackageSearch className="h-5 w-5" />
                </Link>
              </Button>
              {/* Ratings */}
              <Button asChild variant="ghost" size="icon" className="relative h-9 w-9" title="My Ratings">
                <Link href="/ratings">
                  <Star className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Barcode add to cart */}
            {/*<Button variant="ghost" size="icon" className="h-9 w-9" title="Add by barcode" onClick={() => setBarcodeOpen(true)}>
              <Barcode className="h-5 w-5" />
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

            {/* Mobile Menu Button - shows Menu or X depending on state */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" title={mobileMenuOpen ? "Close menu" : "Menu"}>
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[350px] p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col h-full">
                  {/* Mobile Menu Header */}
                  <div className="p-4 border-b">
                    <span className="font-semibold text-lg">Menu</span>
                  </div>

                  {/* Mobile Menu Content */}
                  <div className="flex-1 overflow-y-auto py-2">
                    {/* Main Navigation */}
                    <div className="px-2 py-2">
                      <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Quick Links
                      </p>

                      {/* Favorites */}
                      <SheetClose asChild>
                        <Link
                          href="/favorites"
                          className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <Heart className="h-5 w-5" />
                          <span>Favorites</span>
                          {favoritesCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                              {favoritesCount}
                            </span>
                          )}
                        </Link>
                      </SheetClose>

                      {/* Price Watch */}
                      <SheetClose asChild>
                        <Link
                          href="/price-watch"
                          className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <Eye className="h-5 w-5" />
                          <span>Price Watch</span>
                        </Link>
                      </SheetClose>

                      {/* Reorder */}
                      <SheetClose asChild>
                        <Link
                          href="/reorder"
                          className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <PackageSearch className="h-5 w-5" />
                          <span>Reorder Items</span>
                        </Link>
                      </SheetClose>

                      {/* Ratings */}
                      <SheetClose asChild>
                        <Link
                          href="/ratings"
                          className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <Star className="h-5 w-5" />
                          <span>My Ratings</span>
                        </Link>
                      </SheetClose>
                    </div>

                    {/* Orders Section */}
                    <div className="px-2 py-2 border-t">
                      <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Orders
                      </p>

                      {isAuthenticated ? (
                        <>
                          {/* My Orders */}
                          <SheetClose asChild>
                            <Link
                              href={user?.role === "supplier" ? "/supplier/orders" : "/buyer/orders"}
                              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                            >
                              <ScrollText className="h-5 w-5" />
                              <span>{user?.role === "supplier" ? "Seller Orders" : "My Orders"}</span>
                              {(user?.role === "supplier" ? sellerCount : pendingCount) > 0 && (
                                <span className={`ml-auto text-white text-xs px-2 py-0.5 rounded-full ${
                                  user?.role === "supplier" ? "bg-amber-600" : "bg-blue-600"
                                }`}>
                                  {user?.role === "supplier" ? sellerCount : pendingCount}
                                </span>
                              )}
                            </Link>
                          </SheetClose>

                          {/* Deliveries */}
                          {(user?.role !== "supplier" || user?.dualPharmacyRetail) && (
                            <SheetClose asChild>
                              <Link
                                href="/deliveries"
                                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                              >
                                <PackageCheck className="h-5 w-5" />
                                <span>My Deliveries</span>
                              </Link>
                            </SheetClose>
                          )}

                          {/* Table Commands */}
                          {(user?.role !== "supplier" || user?.dualPharmacyRetail) && (
                            <SheetClose asChild>
                              <Link
                                href="/tables"
                                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                              >
                                <Users className="h-5 w-5" />
                                <span>Table Commands</span>
                              </Link>
                            </SheetClose>
                          )}
                        </>
                      ) : (
                        <SheetClose asChild>
                          <Link
                            href="/login"
                            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <User className="h-5 w-5" />
                            <span>Login to view orders</span>
                          </Link>
                        </SheetClose>
                      )}
                    </div>

                    {/* Account Section */}
                    {isAuthenticated && (
                      <div className="px-2 py-2 border-t">
                        <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Account
                        </p>

                        <SheetClose asChild>
                          <Link
                            href={user?.role === "supplier" ? "/supplier/dashboard" : "/buyer/dashboard"}
                            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <User className="h-5 w-5" />
                            <span>My Dashboard</span>
                          </Link>
                        </SheetClose>

                        {user?.role === "supplier" && (
                          <SheetClose asChild>
                            <Link
                              href="/account"
                              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
                            >
                              <BarChart3 className="h-5 w-5" />
                              <span>Analytics</span>
                            </Link>
                          </SheetClose>
                        )}

                        <button
                          onClick={() => {
                            handleLogout()
                            setMobileMenuOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors text-left"
                        >
                          <LogOut className="h-5 w-5" />
                          <span>Logout</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mobile Menu Footer */}
                  <div className="p-4 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      © 2026 Ishyiga Software. All rights reserved.
                    </p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Search + Location */}
        <div className={cn("pb-3 space-y-2 lg:hidden", hideHeaderGlobalSearch && "pb-2")}>
          {!hideHeaderGlobalSearch && (
            <div className="relative w-full">
              <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full" />
            </div>
          )}
          <div className="flex items-center justify-center">
            <LocationBadge />
          </div>
        </div>
      </div>
      <TableCommandBanner />
      <BarcodeAddToCart open={barcodeOpen} onOpenChange={setBarcodeOpen} />
    </header>
  )
}
