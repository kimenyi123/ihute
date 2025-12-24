// lib/hooks/useProductPrefetch.ts
import { useEffect } from 'react';

interface PrefetchOptions {
  codes: string[];
  enabled?: boolean;
  delay?: number; // ms to wait before prefetching
}

/**
 * Hook to prefetch popular products in the background
 * This caches products in Redis for instant loading
 *
 * @example
 * useProductPrefetch({
 *   codes: ['BEEFEATER', 'PRIMUS', 'HEINEKEN'],
 *   enabled: true,
 *   delay: 3000, // Wait 3 seconds after mount
 * });
 */
export function useProductPrefetch({
  codes,
  enabled = true,
  delay = 2000
}: PrefetchOptions) {
  useEffect(() => {
    if (!enabled || codes.length === 0) return;

    const timer = setTimeout(async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

      console.log(`[Prefetch] 🚀 Starting prefetch for ${codes.length} products...`);

      // Prefetch in parallel (max 5 at a time to avoid overwhelming server)
      const batchSize = 5;
      for (let i = 0; i < codes.length; i += batchSize) {
        const batch = codes.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (code) => {
            try {
              const params = new URLSearchParams({
                quick_product_code: code,
                Currency: 'RWF',
              });

              const response = await fetch(
                `${API_URL}/api/fetchSuggestions?${params}`,
                {
                  // Low priority fetch - doesn't block user interactions
                  priority: 'low',
                } as RequestInit
              );

              if (response.ok) {
                console.log(`[Prefetch] ✅ Cached: ${code}`);
              } else {
                console.log(`[Prefetch] ⚠️ Failed (${response.status}): ${code}`);
              }
            } catch (error) {
              console.log(`[Prefetch] ❌ Error: ${code}`, error);
            }
          })
        );

        // Small delay between batches to be nice to the server
        if (i + batchSize < codes.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`[Prefetch] ✅ Completed prefetch for ${codes.length} products`);
    }, delay);

    return () => clearTimeout(timer);
  }, [codes, enabled, delay]);
}