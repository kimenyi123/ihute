import { Suspense } from "react";
import ShopWithMePage from "@/components/shop-with-me";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Shop With Me | Find Shops & Products",
  description: "Search for shops by nickname and browse their products",
};

function LoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading shop search...</p>
      </div>
    </div>
  );
}

export default function ShopWithMeRoutePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShopWithMePage />
    </Suspense>
  );
}