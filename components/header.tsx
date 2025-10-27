"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ShoppingCart,
  User,
  MapPin,
  Heart,
  Truck,
  PackageSearch,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { useAuthStore } from "@/lib/auth-store"
import { usePrefsStore } from "@/lib/prefs-store"
import { useOrdersStore } from "@/lib/orders-store"
import { useTranslation } from "@/hooks/use-translation"
import { RWANDA_DISTRICTS } from "@/lib/constants"

export function Header() {
  const router = useRouter()
  const { t } = useTranslation()

  const getTotalItems = useCartStore((s) => s.getTotalItems)
  const totalItems = getTotalItems()
  const favoritesCount = useFavoritesStore((s) => s.favorites.length)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const [selectedLocation, setSelectedLocation] = useState(
    user?.location || t("allLocations")
  )
  const setLoc = usePrefsStore((s) => s.setLocation)

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
    router.replace("/")
    router.refresh()
  }

  const handleLocation = (val: string) => {
    setSelectedLocation(val)
    setLoc(val === t("allLocations") ? null : val)
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

          {/* Location Selector - Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedLocation} onValueChange={handleLocation}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={t("allLocations")}>
                  {t("allLocations")}
                </SelectItem>
                {RWANDA_DISTRICTS.map((dist) => (
                  <SelectItem key={dist} value={dist}>
                    {dist}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Global Search - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-md relative">
            <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            <LanguageSelector />

            {isAuthenticated ? (
              <>
                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden md:flex h-9">
                      <User className="h-4 w-4 mr-2" />
                      {user?.name}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          user?.role === "supplier"
                            ? "/supplier/dashboard"
                            : "/orders"
                        )
                      }
                    >
                      {t("myAccount")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      {t("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Supplier Orders */}
                {user?.role === "supplier" && (
                  <Link href="/supplier/orders">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9"
                      title="My Orders (Seller)"
                    >
                      <PackageSearch className="h-5 w-5" />
                      {sellerCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                          {sellerCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                )}

                {/* Customer Orders */}
                {user?.role !== "supplier" && (
                  <Link href="/orders">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9"
                      title="My Orders"
                    >
                      <Truck className="h-5 w-5" />
                      {pendingCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {pendingCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-9">
                  <User className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t("login")}</span>
                </Button>
              </Link>
            )}

            {/* Favorites */}
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Favorites">
                <Heart className="h-5 w-5" />
                {favoritesCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {favoritesCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Cart">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Search + Location */}
        <div className="pb-3 space-y-2 lg:hidden">
          <div className="relative w-full">
            <GlobalSearch placeholder={t("searchPlaceholder")} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedLocation} onValueChange={handleLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select your district" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={t("allLocations")}>
                  {t("allLocations")}
                </SelectItem>
                {RWANDA_DISTRICTS.map((dist) => (
                  <SelectItem key={dist} value={dist}>
                    {dist}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  )
}
