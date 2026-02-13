/**
 * B2B Dashboard Page
 * Task 9 - Requirements 13.1, 13.2, 13.3, 13.4
 */

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";

export default function B2BDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const cards = [
    {
      title: "Quick Buy",
      description: "Search and add products to create orders quickly",
      href: "/supplier/b2b/buy",
      icon: "🛒",
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    },
    {
      title: "Bulk Import",
      description: "Upload Excel file to create orders in bulk",
      href: "/supplier/b2b/bulk",
      icon: "📊",
      color: "bg-green-50 hover:bg-green-100 border-green-200",
    },
    {
      title: "Drafts",
      description: "View and edit your draft orders",
      href: "/supplier/b2b/drafts",
      icon: "📝",
      color: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200",
    },
    {
      title: "Outgoing Orders",
      description: "Orders you've sent to suppliers",
      href: "/supplier/b2b/outgoing",
      icon: "📤",
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
    },
    {
      title: "Incoming Orders",
      description: "Orders received from buyers",
      href: "/supplier/b2b/incoming",
      icon: "📥",
      color: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading dashboard..." />
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
        <h1 className="text-3xl font-bold text-gray-900">B2B Procurement</h1>
        <p className="mt-2 text-gray-600">
          Manage your business-to-business orders and negotiations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`${card.color} border-2 rounded-lg p-6 transition-all duration-200 hover:shadow-lg`}
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
          </Link>
        ))}
      </div>
    </div>
  );
}
