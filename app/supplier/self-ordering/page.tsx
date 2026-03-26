"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
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
import { Copy, QrCode } from "lucide-react";
import { SupplierKioskOrdersBoard } from "@/src/modules/self-order/components/SupplierKioskOrdersBoard";
import type { KioskCategory } from "@/src/modules/self-order/types";
import { isRestoBarPreferredCategories } from "@/lib/supplier-sector";

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

export default function SupplierSelfOrderingPage() {
    const { user } = useAuthStore();
    const router = useRouter();

    const [preferredCategoriesRaw, setPreferredCategoriesRaw] = useState("");
    const [isBarOrRestaurant, setIsBarOrRestaurant] = useState(false);
    const [profileChecked, setProfileChecked] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");

    // Nickname used only to build self-order menu QRs
    const [menuNickname, setMenuNickname] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") setBaseUrl(window.location.origin);
    }, []);

    // Load preferred categories + derive a suggested nickname from owner name
    useEffect(() => {
        if (!user?.ishyigaAccount || user?.role !== "supplier") return;
        fetch(`/api/supplier/profile?account=${encodeURIComponent(user.ishyigaAccount)}`)
            .then((res) => res.json())
            .then((data) => {
                const raw = (data?.preferredCategories ?? "").trim().toLowerCase();
                setPreferredCategoriesRaw(raw);
                setIsBarOrRestaurant(isRestoBarPreferredCategories(data?.preferredCategories));

                // Suggest a clean nickname from owner name (strip apostrophes, lowercase last word)
                if (data?.owner && !menuNickname) {
                    const suggested = data.owner
                        .replace(/'/g, "")          // remove apostrophes
                        .trim()
                        .toLowerCase()
                        .split(/\s+/)
                        .pop() ?? "";               // take last word
                    setMenuNickname(suggested);
                }
                setProfileChecked(true);
            })
            .catch(() => {
                setProfileChecked(true);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.ishyigaAccount, user?.role]);

    useEffect(() => {
        if (!profileChecked) return;
        if (!user?.ishyigaAccount) return;
        if (user?.role !== "supplier") return;
        if (isBarOrRestaurant) return;
        router.replace("/supplier/dashboard");
    }, [profileChecked, isBarOrRestaurant, router, user?.ishyigaAccount, user?.role]);

    // ── Derived values ──────────────────────────────────────────────────────────
    const selfOrderCategories: KioskCategory[] = (() => {
        if (!isBarOrRestaurant) return [];
        const raw = preferredCategoriesRaw.toLowerCase();
        const cats = new Set<KioskCategory>();
        if (raw.includes("bar")) cats.add("BAR");
        if (raw.includes("resto") || raw.includes("restaurant")) cats.add("RESTRO");
        if (cats.size === 0) cats.add("BAR");
        return Array.from(cats);
    })();

    // Self-order menu links — go directly to /self-order/menu so customer sees products + cart immediately
    const selfOrderMenuLinks: { cat: KioskCategory; url: string }[] =
        baseUrl && menuNickname.trim()
            ? selfOrderCategories.map((cat) => ({
                cat,
                url: `${baseUrl}/self-order/menu?nickname=${encodeURIComponent(
                    menuNickname.trim().toLowerCase()
                )}&kioskCategory=${encodeURIComponent(cat)}`,
            }))
            : [];

    const customerDisplayAllOrdersLink =
        baseUrl && user?.ishyigaAccount
            ? `${baseUrl}/supplier/kiosk-orders?account=${encodeURIComponent(user.ishyigaAccount)}`
            : "";

    const copy = (text: string, label = "Link copied") =>
        navigator.clipboard.writeText(text).then(() => alert(label));

    // ── UI ─────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <QrCode className="h-6 w-6 text-blue-600" />
                    Self Ordering
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Share self-order QR codes with customers and monitor live kiosk orders.
                </p>
            </div>

            {/* ── 1. Self-order menu QR (kiosk) ─────────────────────────────────── */}
            <Card className="bg-white shadow-sm">
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle>Self-order menu (for customers)</CardTitle>
                    <CardDescription>
                        Customers scan this QR to browse your menu and place orders directly — cart, checkout, done.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Nickname input — needed to build the menu URL */}
                    <div className="space-y-1 max-w-xs">
                        <Label htmlFor="menu-nickname">Your shop nickname</Label>
                        <p className="text-xs text-slate-500">
                            Same nickname you set on the Dashboard QR section (e.g. <span className="font-mono">burrows</span>).
                        </p>
                        <Input
                            id="menu-nickname"
                            placeholder="e.g. burrows"
                            value={menuNickname}
                            onChange={(e) => setMenuNickname(e.target.value)}
                            className="max-w-xs"
                        />
                    </div>

                    {menuNickname.trim() && selfOrderMenuLinks.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-2 border-t">
                            {selfOrderMenuLinks.map(({ cat, url }) => (
                                <div key={cat} className="flex flex-col gap-3">
                                    <div className="text-sm font-semibold text-slate-700">
                                        {cat === "BAR" ? "🍺 Bar" : cat === "RESTRO" ? "🍽 Kitchen" : cat}
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border w-fit">
                                        <QRCode value={url} size={180} />
                                    </div>
                                    <p className="text-xs text-slate-600 break-all font-mono bg-slate-50 rounded p-2 border">
                                        {url}
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copy(url, "Self-order link copied")}
                                        className="gap-2 w-fit"
                                    >
                                        <Copy className="h-4 w-4" /> Copy link
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : menuNickname.trim() && selfOrderCategories.length === 0 ? (
                        <p className="text-sm text-slate-500 pt-2 border-t">
                            No kiosk categories configured on your account (needs Bar or Restaurant type).
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 pt-2 border-t">
                            Enter your shop nickname above to generate QR codes.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── 2. Customer display (kiosk orders on a TV/screen) ─────────────── */}
            {customerDisplayAllOrdersLink && (
                <Card className="bg-white shadow-sm">
                    <CardHeader className="border-b bg-slate-50">
                        <CardTitle>Customer display — all kiosk orders</CardTitle>
                        <CardDescription>
                            Open on a second screen or TV to show live order status to customers.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="bg-slate-50 p-4 rounded-xl border">
                                <QRCode value={customerDisplayAllOrdersLink} size={160} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                                <Label className="text-slate-600">Link (for display screen)</Label>
                                <p className="text-sm text-slate-700 break-all font-mono bg-slate-50 rounded p-2 border">
                                    {customerDisplayAllOrdersLink}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copy(customerDisplayAllOrdersLink, "Display link copied")}
                                    className="gap-2"
                                >
                                    <Copy className="h-4 w-4" /> Copy link
                                </Button>
                                <p className="text-xs text-slate-500">Shows both BAR + RESTRO boards.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── 3. Live kiosk order boards ────────────────────────────────────── */}
            {user?.ishyigaAccount && isBarOrRestaurant && selfOrderCategories.length > 0 ? (
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Live kiosk orders</h2>
                    <div className="flex flex-col gap-10">
                        {selfOrderCategories
                            .filter((c) => c === "BAR" || c === "RESTRO")
                            .map((cat) => (
                                <SupplierKioskOrdersBoard
                                    key={cat}
                                    sellerAccount={String(user.ishyigaAccount)}
                                    kioskCategory={cat}
                                />
                            ))}
                    </div>
                </div>
            ) : (
                <Card className="bg-slate-50 border-dashed">
                    <CardContent className="p-8 text-center text-slate-500">
                        <QrCode className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No kiosk categories configured</p>
                        <p className="text-xs mt-1">
                            Set your account to a Bar or Restaurant type to enable live kiosk order management.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
