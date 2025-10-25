// app/category/[categoryId]/page.tsx  (SERVER COMPONENT – no "use client")
import { Header } from "@/components/header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Footer } from "@/components/footer";
import { CategoryClient } from "@/components/category-client";

type CategoryParams = { categoryId: string };
type CategoryPageProps =
  | { params: CategoryParams }
  | { params: Promise<CategoryParams> };

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

export default async function CategoryPage(props: CategoryPageProps) {
  const { categoryId } = (await Promise.resolve(
    (props as any).params
  )) as CategoryParams;

  const categoryName = categoryNames[categoryId] || "Products";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-6 flex-1">
        <Breadcrumbs categoryName={categoryName} />
        <CategoryClient categoryId={categoryId} categoryName={categoryName} />
      </main>
      <Footer />
    </div>
  );
}
