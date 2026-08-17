// API service for location-based searches

// Use Next.js API proxy to avoid client-side CORS / backend availability issues.
const API_BASE_URL = "/api";

export interface NearbySupplier {
    supplier_id: string;
    nickname: string;
    distance_km: number;
    location: {
        lat: number;
        lng: number;
        address?: string;
    };
    rating: number;
    gps_quality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';
}

export interface ProductOffer {
    supplier_id: string;
    nickname: string;
    distance_km: number;
    sale_price: number;
    quantity: number;
    discount: number;
    rating: number;
}

export interface NearbyProduct {
    item_code: string;
    item_name: string;
    best_offer: ProductOffer;
    other_sellers: ProductOffer[];
    total_sellers: number;
}

export interface NearbySearchResponse {
    query: string;
    buyer: { lat: number; lng: number };
    radius_used_km: number;
    results: NearbyProduct[];
    count: number;
}

/**
 * Search for nearby suppliers
 */
export async function searchNearbySuppliers(
    lat: number,
    lng: number,
    radiusKm?: number,
    limit: number = 20
): Promise<{ suppliers: NearbySupplier[]; count: number }> {
    const params = new URLSearchParams({
        action: 'getNearbySuppliers',
        lat: lat.toString(),
        lng: lng.toString(),
        limit: limit.toString(),
    });

    if (radiusKm) {
        params.append('radiusKm', radiusKm.toString());
    }

    const response = await fetch(`${API_BASE_URL}/fetchSuggestions?${params}`, { cache: "no-store" });
    if (!response.ok) {
        return { suppliers: [], count: 0 };
    }
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
        return { suppliers: [], count: 0 };
    }
    return {
        suppliers: Array.isArray((data as any).suppliers) ? (data as any).suppliers : [],
        count: typeof (data as any).count === "number" ? (data as any).count : 0,
    };
}

/**
 * Search for nearby products
 */
export async function searchNearbyProducts(
    query: string,
    lat: number,
    lng: number,
    limit: number = 10
): Promise<NearbySearchResponse> {
    const params = new URLSearchParams({
        action: 'searchNearbyProducts',
        q: query,
        lat: lat.toString(),
        lng: lng.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/fetchSuggestions?${params}`, { cache: "no-store" });
    if (!response.ok) {
        return {
            query,
            buyer: { lat, lng },
            radius_used_km: 0,
            results: [],
            count: 0,
        };
    }
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
        return {
            query,
            buyer: { lat, lng },
            radius_used_km: 0,
            results: [],
            count: 0,
        };
    }
    return {
        query: typeof (data as any).query === "string" ? (data as any).query : query,
        buyer:
            (data as any).buyer && typeof (data as any).buyer === "object"
                ? (data as any).buyer
                : { lat, lng },
        radius_used_km:
            typeof (data as any).radius_used_km === "number" ? (data as any).radius_used_km : 0,
        results: Array.isArray((data as any).results) ? (data as any).results : [],
        count: typeof (data as any).count === "number" ? (data as any).count : 0,
    };
}

/**
 * Clear location cache (admin only)
 */
export async function clearLocationCache(): Promise<{ ok: boolean; message: string }> {
    const response = await fetch(
        `${API_BASE_URL}/fetchSuggestions?action=clearLocationCache`
    );

    if (!response.ok) {
        throw new Error('Failed to clear cache');
    }

    return response.json();
}

/**
 * Get location cache stats (admin/debug)
 */
export async function getLocationCacheStats(): Promise<any> {
    const response = await fetch(
        `${API_BASE_URL}/fetchSuggestions?action=getLocationCacheStats`
    );

    if (!response.ok) {
        throw new Error('Failed to get cache stats');
    }

    return response.json();
}
