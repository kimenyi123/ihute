/**
 * B2B Dashboard Page
 * Task 9 - Requirements 13.1, 13.2, 13.3, 13.4
 */

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { useLanguageStore, type Language } from "@/lib/language-store";

const B2B_UI: Record<Language, {
  pageTitle: string;
  pageSubtitle: string;
  quickBuy: string;
  quickBuyDesc: string;
  bulkImport: string;
  bulkImportDesc: string;
  drafts: string;
  draftsDesc: string;
  outgoingOrders: string;
  outgoingDesc: string;
  incomingOrders: string;
  incomingDesc: string;
  loadingDashboard: string;
}> = {
  en: {
    pageTitle: "Rekizisiyo",
    pageSubtitle: "Manage your business-to-business orders and negotiations",
    quickBuy: "Quick Buy",
    quickBuyDesc: "Search and add products to create orders quickly",
    bulkImport: "Bulk Import",
    bulkImportDesc: "Upload Excel file to create orders in bulk",
    drafts: "Drafts",
    draftsDesc: "View and edit your draft orders",
    outgoingOrders: "Outgoing Orders",
    outgoingDesc: "Orders you've sent to suppliers",
    incomingOrders: "Incoming Orders",
    incomingDesc: "Orders received from buyers",
    loadingDashboard: "Loading dashboard...",
  },
  rw: {
    pageTitle: "Rekizisiyo",
    pageSubtitle: "Gucunga amatumiza hagati y'ubucuruzi n'ibiganiro",
    quickBuy: "Gura byihuse",
    quickBuyDesc: "Shakisha kandi ongeraho ibicuruzwa kugira ngo ukore amatumiza byihuse",
    bulkImport: "Ohereza byinshi",
    bulkImportDesc: "Ohereza dosiye ya Excel kugira ngo ukore amatumiza byinshi",
    drafts: "Inyandiko zitarangiye",
    draftsDesc: "Reba kandi uhindure amatumiza yawe atararangira",
    outgoingOrders: "Amatumiza zoherejwe",
    outgoingDesc: "Amatumiza wohereje ku bagurisha",
    incomingOrders: "Amatumiza zakiriwe",
    incomingDesc: "Amatumiza yakiriwe atuwe n'abaguzi",
    loadingDashboard: "Gutegereza dashboard...",
  },
  fr: {
    pageTitle: "Réquisition",
    pageSubtitle: "Gérez vos commandes et négociations interentreprises",
    quickBuy: "Achat rapide",
    quickBuyDesc: "Recherchez et ajoutez des produits pour créer des commandes rapidement",
    bulkImport: "Import en masse",
    bulkImportDesc: "Téléversez un fichier Excel pour créer des commandes en masse",
    drafts: "Brouillons",
    draftsDesc: "Consultez et modifiez vos brouillons de commandes",
    outgoingOrders: "Commandes sortantes",
    outgoingDesc: "Commandes envoyées aux fournisseurs",
    incomingOrders: "Commandes entrantes",
    incomingDesc: "Commandes reçues des acheteurs",
    loadingDashboard: "Chargement du tableau de bord...",
  },
};

export default function B2BDashboard() {
  const language = useLanguageStore((s) => s.language);
  const ui = B2B_UI[language] ?? B2B_UI.en;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outgoingCount, setOutgoingCount] = useState(0);
  const [incomingCount, setIncomingCount] = useState(0);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user?.ishyigaAccount) {
        setLoading(false);
        return;
      }

      try {
        // Fetch outgoing orders count
        const outgoingRes = await fetch(`/supplier/b2b/api?action=listOutgoing&page=1&limit=1`);
        if (outgoingRes.ok) {
          const outgoingData = await outgoingRes.json();
          setOutgoingCount(outgoingData.total || 0);
        }

        // Fetch incoming orders count
        const incomingRes = await fetch(`/supplier/b2b/api?action=listIncoming&page=1&limit=1`);
        if (incomingRes.ok) {
          const incomingData = await incomingRes.json();
          setIncomingCount(incomingData.total || 0);
        }
      } catch (err) {
        console.error("Error fetching order counts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [user]);

  const cards = [
    {
      title: ui.quickBuy,
      description: ui.quickBuyDesc,
      href: "/supplier/b2b/buy",
      icon: "🛒",
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      badge: null,
    },
    {
      title: ui.bulkImport,
      description: ui.bulkImportDesc,
      href: "/supplier/b2b/bulk",
      icon: "📊",
      color: "bg-green-50 hover:bg-green-100 border-green-200",
      badge: null,
    },
    {
      title: ui.drafts,
      description: ui.draftsDesc,
      href: "/supplier/b2b/drafts",
      icon: "📝",
      color: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200",
      badge: null,
    },
    {
      title: ui.outgoingOrders,
      description: ui.outgoingDesc,
      href: "/supplier/b2b/outgoing",
      icon: "📤",
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
      badge: outgoingCount,
    },
    {
      title: ui.incomingOrders,
      description: ui.incomingDesc,
      href: "/supplier/b2b/incoming",
      icon: "📥",
      color: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
      badge: incomingCount,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message={ui.loadingDashboard} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ErrorMessage message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{ui.pageTitle}</h1>
        <p className="mt-2 text-gray-600">
          {ui.pageSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`${card.color} border-2 rounded-lg p-6 transition-all duration-200 hover:shadow-lg relative`}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{card.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {card.title}
                </h2>
                <p className="text-gray-600 text-sm">{card.description}</p>
              </div>
            </div>
            {card.badge !== null && card.badge > 0 && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {card.badge > 99 ? '99+' : card.badge}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
