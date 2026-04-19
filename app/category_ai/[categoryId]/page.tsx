// app/category_ai/[categoryId]/page.tsx
// Enhanced category page – copy of app/category/[categoryId] for AI/enhancements.
// See docs/category_ai.md for what changed and how to upgrade.
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CategoryClientAI } from "@/components/category_ai/category-client-ai";

type CategoryParams = { categoryId: string }

const categoryNames: Record<string, string> = {
  pharmacy: "Pharmacy",
  "liquor-store": "Liquor Store",
  boutique: "Boutique",
  "bar-resto": "Bar & Restaurant",
  supermarket: "Supermarket",
  "coffee-shop": "Coffee Shop",
  beauty: "Beauty & Cosmetics",
  general: "General Store",
};

export default async function CategoryAIPage({
  params,
}: {
  params: Promise<CategoryParams>
}) {
  const { categoryId } = await params

  const categoryName = categoryNames[categoryId] || "Products";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-6 flex-1">
        <CategoryClientAI categoryId={categoryId} categoryName={categoryName} />
      </main>
      <Footer />
    </div>
  );
}
