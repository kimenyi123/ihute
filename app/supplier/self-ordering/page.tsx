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
import { useLanguageStore, type Language } from "@/lib/language-store";

const SELF_ORDER_UI: Record<Language, {
  pageTitle: string;
  pageSubtitle: string;
  selfOrderMenuTitle: string;
  selfOrderMenuDesc: string;
  shopNickname: string;
  shopNicknameHint: string;
  bar: string;
  kitchen: string;
  noKioskCategories: string;
  enterNickname: string;
  copyLink: string;
  customerDisplayTitle: string;
  customerDisplayDesc: string;
  displayLink: string;
  showsBothBoards: string;
  liveKioskOrders: string;
  noKioskConfigured: string;
  setAccountType: string;
}> = {
  en: {
    pageTitle: "Self Ordering",
    pageSubtitle: "Share self-order QR codes with customers and monitor live kiosk orders.",
    selfOrderMenuTitle: "Self-order menu (for customers)",
    selfOrderMenuDesc: "Customers scan this QR to browse your menu and place orders directly — cart, checkout, done.",
    shopNickname: "Your shop nickname",
    shopNicknameHint: "Same nickname you set on the Dashboard QR section (e.g. burrows).",
    bar: "Bar",
    kitchen: "Kitchen",
    noKioskCategories: "No kiosk categories configured on your account (needs Bar or Restaurant type).",
    enterNickname: "Enter your shop nickname above to generate QR codes.",
    copyLink: "Copy link",
    customerDisplayTitle: "Customer display — all kiosk orders",
    customerDisplayDesc: "Open on a second screen or TV to show live order status to customers.",
    displayLink: "Link (for display screen)",
    showsBothBoards: "Shows both BAR + RESTRO boards.",
    liveKioskOrders: "Live kiosk orders",
    noKioskConfigured: "No kiosk categories configured",
    setAccountType: "Set your account to a Bar or Restaurant type to enable live kiosk order management.",
  },
  rw: {
    pageTitle: "Gutumiza ku meza",
    pageSubtitle: "Sangira kode QR zo gutumiza ku meza n'abakiriya kandi ukurikirane amatumiza ya kiosk.",
    selfOrderMenuTitle: "Menyu yo gutumiza (ku bakiriya)",
    selfOrderMenuDesc: "Abakiriya basoma iyi QR kugira ngo barebe menyu yawe kandi batumize — agasanduku, kwishyura, byarangiye.",
    shopNickname: "Izina rigufi ry'iduka ryawe",
    shopNicknameHint: "Izina rimwe washyize mu gice cya QR kuri Dashboard (urugero: burrows).",
    bar: "Bari",
    kitchen: "Igikoni",
    noKioskCategories: "Nta bwoko bwa kiosk bushyizweho kuri konti yawe (bisaba ubwoko bwa Bari cyangwa Resitora).",
    enterNickname: "Andika izina rigufi ry'iduka ryawe hejuru kugira ngo ukore kode QR.",
    copyLink: "Koporora link",
    customerDisplayTitle: "Aho abakiriya bareba — amatumiza yose ya kiosk",
    customerDisplayDesc: "Fungura ku cya kabiri cyangwa TV kugira ngo werekane uko amatumiza agenda ku bakiriya.",
    displayLink: "Link (ku cyo kwereka)",
    showsBothBoards: "Yerekana ibice bya BARI + RESITORA byombi.",
    liveKioskOrders: "Amatumiza ya kiosk y'ubu",
    noKioskConfigured: "Nta bwoko bwa kiosk bushyizweho",
    setAccountType: "Shyira konti yawe ku bwoko bwa Bari cyangwa Resitora kugira ngo ushobore gucunga amatumiza ya kiosk.",
  },
  fr: {
    pageTitle: "Commande en libre-service",
    pageSubtitle: "Partagez les QR codes de commande en libre-service et surveillez les commandes kiosque en direct.",
    selfOrderMenuTitle: "Menu libre-service (pour les clients)",
    selfOrderMenuDesc: "Les clients scannent ce QR pour parcourir votre menu et passer commande directement — panier, paiement, terminé.",
    shopNickname: "Surnom de votre boutique",
    shopNicknameHint: "Le même surnom défini dans la section QR du tableau de bord (ex. burrows).",
    bar: "Bar",
    kitchen: "Cuisine",
    noKioskCategories: "Aucune catégorie kiosque configurée sur votre compte (nécessite le type Bar ou Restaurant).",
    enterNickname: "Entrez le surnom de votre boutique ci-dessus pour générer les QR codes.",
    copyLink: "Copier le lien",
    customerDisplayTitle: "Affichage client — toutes les commandes kiosque",
    customerDisplayDesc: "Ouvrez sur un deuxième écran ou TV pour afficher le statut des commandes en direct aux clients.",
    displayLink: "Lien (pour l'écran d'affichage)",
    showsBothBoards: "Affiche les tableaux BAR + RESTRO.",
    liveKioskOrders: "Commandes kiosque en direct",
    noKioskConfigured: "Aucune catégorie kiosque configurée",
    setAccountType: "Définissez votre compte comme type Bar ou Restaurant pour activer la gestion des commandes kiosque en direct.",
  },
};

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

export default function SupplierSelfOrderingPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const language = useLanguageStore((s) => s.language);
    const ui = SELF_ORDER_UI[language] ?? SELF_ORDER_UI.en;

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
                    {ui.pageTitle}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    {ui.pageSubtitle}
                </p>
            </div>

            {/* ── 1. Self-order menu QR (kiosk) ─────────────────────────────────── */}
            <Card className="bg-white shadow-sm">
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle>{ui.selfOrderMenuTitle}</CardTitle>
                    <CardDescription>
                        {ui.selfOrderMenuDesc}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Nickname input — needed to build the menu URL */}
                    <div className="space-y-1 max-w-xs">
                        <Label htmlFor="menu-nickname">{ui.shopNickname}</Label>
                        <p className="text-xs text-slate-500">
                            {ui.shopNicknameHint}
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
                                        {cat === "BAR" ? `🍺 ${ui.bar}` : cat === "RESTRO" ? `🍽 ${ui.kitchen}` : cat}
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
                                        <Copy className="h-4 w-4" /> {ui.copyLink}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : menuNickname.trim() && selfOrderCategories.length === 0 ? (
                        <p className="text-sm text-slate-500 pt-2 border-t">
                            {ui.noKioskCategories}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 pt-2 border-t">
                            {ui.enterNickname}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── 2. Customer display (kiosk orders on a TV/screen) ─────────────── */}
            {customerDisplayAllOrdersLink && (
                <Card className="bg-white shadow-sm">
                    <CardHeader className="border-b bg-slate-50">
                        <CardTitle>{ui.customerDisplayTitle}</CardTitle>
                        <CardDescription>
                            {ui.customerDisplayDesc}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="bg-slate-50 p-4 rounded-xl border">
                                <QRCode value={customerDisplayAllOrdersLink} size={160} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                                <Label className="text-slate-600">{ui.displayLink}</Label>
                                <p className="text-sm text-slate-700 break-all font-mono bg-slate-50 rounded p-2 border">
                                    {customerDisplayAllOrdersLink}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copy(customerDisplayAllOrdersLink, "Display link copied")}
                                    className="gap-2"
                                >
                                    <Copy className="h-4 w-4" /> {ui.copyLink}
                                </Button>
                                <p className="text-xs text-slate-500">{ui.showsBothBoards}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── 3. Live kiosk order boards ────────────────────────────────────── */}
            {user?.ishyigaAccount && isBarOrRestaurant && selfOrderCategories.length > 0 ? (
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">{ui.liveKioskOrders}</h2>
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
                        <p className="text-sm font-medium">{ui.noKioskConfigured}</p>
                        <p className="text-xs mt-1">
                            {ui.setAccountType}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
