// API service for location-based searches

// Use environment variable for backend URL (client-side needs NEXT_PUBLIC_ prefix)
// Prefer NEXT_PUBLIC_API_BASE so it stays consistent with the rest of the app.
// If NEXT_PUBLIC_API_BASE is not set, fall back to the older JAVA_BACKEND_BASE-style default.
const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE ||
  "http://localhost:8080/Trading"

// If NEXT_PUBLIC_API_BASE already points directly to the Kaos path, you can set it to
// e.g. http://localhost:8080/Trading/Kaos and this will just append `/fetchSuggestions`.
const API_BASE_URL = BACKEND_BASE.endsWith("/Kaos") ? BACKEND_BASE : `${BACKEND_BASE}/Kaos`;

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

    const response = await fetch(`${API_BASE_URL}/fetchSuggestions?${params}`);

    if (!response.ok) {
        throw new Error('Failed to fetch nearby suppliers');
    }

    return response.json();
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

    const response = await fetch(`${API_BASE_URL}/fetchSuggestions?${params}`);

    if (!response.ok) {
        throw new Error('Failed to search nearby products');
    }

    return response.json();
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
