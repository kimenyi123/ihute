import { Suspense } from "react";
import ShopWithMePage from "@/components/shop-with-me";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Shop With Me | Find Shops & Products",
  description: "Browse a specific shop's products by nickname",
};

function LoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading shop products...</p>
      </div>
    </div>
  );
}

export default function ShopWithMeAINicknamePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShopWithMePage embedInMainLayout />
    </Suspense>
  );
}
