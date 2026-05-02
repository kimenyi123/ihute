// @ts-nocheck — dynamic react-leaflet / Leaflet patterns exceed strict route typings; refactor in a follow-up.
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Navigation, Save, History, ArrowLeft, Loader2, Search } from "lucide-react";
import dynamic from "next/dynamic";

const SupplierLocationMap = dynamic(
    () => import("@/components/supplier-location-map").then((mod) => mod.SupplierLocationMap),
    { ssr: false },
);

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    lastUpdated: string | null;
    notes: string;
    address: string;
    nickname: string;
    locationSource?: string;
    // Profile fields
    owner?: string;
    preferredCategories?: string;
    momo?: string;
    preferredPay?: string;
    locProvince?: string;
    locDistrict?: string;
    locCell?: string;
    preferredSellerNickname?: string;
    ratingStar?: number;
}

interface LocationHistoryEntry {
    latitude: number;
    longitude: number;
    address: string;
    updatedAt: string;
}

interface Landmark {
    name: string;
    latitude: number;
    longitude: number;
    type?: string;
    distance?: number;
}

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function SupplierLocationSettings() {
    const router = useRouter();
    const { user, isAuthenticated, hasHydrated } = useAuthStore();
    const ENABLE_NEARBY_LANDMARKS = false;

    const [location, setLocation] = useState<LocationData | null>(null);
    const [selectedLat, setSelectedLat] = useState<number>(-1.9441);
    const [selectedLng, setSelectedLng] = useState<number>(30.0619);
    const [accuracy, setAccuracy] = useState<number>(0);
    const [notes, setNotes] = useState<string>("");
    const [history, setHistory] = useState<LocationHistoryEntry[]>([]);
    const [addressSearch, setAddressSearch] = useState<string>("");
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Profile fields
    const [owner, setOwner] = useState<string>("");
    const [preferredCategories, setPreferredCategories] = useState<string>("");
    const [momo, setMomo] = useState<string>("");
    const [preferredPay, setPreferredPay] = useState<string>("");
    const [locProvince, setLocProvince] = useState<string>("");
    const [locDistrict, setLocDistrict] = useState<string>("");
    const [locCell, setLocCell] = useState<string>("");
    const [preferredSellerNickname, setPreferredSellerNickname] = useState<string>("");
    const [ratingStar, setRatingStar] = useState<number>(0);
    const [nickname, setNickname] = useState<string>("");
    const [shopImageUrl, setShopImageUrl] = useState<string>("");
    const [shopImageFile, setShopImageFile] = useState<File | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    const [categories, setCategories] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [searching, setSearching] = useState(false);
    const [fetchingLandmarks, setFetchingLandmarks] = useState(false);
    const [nearbyLandmarks, setNearbyLandmarks] = useState<Landmark[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Fetch nearby landmarks when coordinates change
    useEffect(() => {
        if (!ENABLE_NEARBY_LANDMARKS) return;
        if (selectedLat && selectedLng) {
            fetchNearbyLandmarks(selectedLat, selectedLng);
        }
    }, [selectedLat, selectedLng]);


    const fetchNearbyLandmarks = async (lat: number, lng: number) => {
        if (!ENABLE_NEARBY_LANDMARKS) return;
        setFetchingLandmarks(true);

        try {
            // Using Overpass API to find nearby points of interest
            // Reduced radius and simplified query for better performance
            const radius = 2000; // 2km radius (balanced between coverage and performance)

            // Simplified query - only fetch most important landmarks
            const query = `
[out:json][timeout:10];
(
  node["amenity"~"marketplace|bank|school|hospital|restaurant|cafe"](around:${radius},${lat},${lng});
  node["shop"](around:${radius},${lat},${lng});
  node["tourism"~"attraction|hotel|museum|information"](around:${radius},${lat},${lng});
);
out body 15;
            `;

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.elements && data.elements.length > 0) {
                const landmarks: Landmark[] = data.elements
                    .filter((el: any) => el.tags && el.tags.name)
                    .map((el: any) => {
                        const distance = calculateDistance(lat, lng, el.lat, el.lon);
                        return {
                            name: el.tags.name,
                            latitude: el.lat,
                            longitude: el.lon,
                            type: el.tags.amenity || el.tags.shop || el.tags.tourism || 'place',
                            distance
                        };
                    })
                    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
                    .slice(0, 12); // Show top 12 landmarks

                setNearbyLandmarks(landmarks);
            } else {
                setNearbyLandmarks([]);
            }
        } catch (error: any) {
            console.warn('Unable to fetch nearby landmarks:', error.name === 'AbortError' ? 'Request timeout' : error.message);
            // Silently fail - this is a non-critical feature
            setNearbyLandmarks([]);
        } finally {
            setFetchingLandmarks(false);
        }
    };

    // Debounced search effect
    useEffect(() => {
        if (!addressSearch.trim() || addressSearch.length < 3) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            performSearch(addressSearch);
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [addressSearch]);

    const performSearch = async (query: string) => {
        setSearching(true);
        setSearchResults([]);

        try {
            // Try multiple search strategies
            let results: any[] = [];

            // Strategy 1: Search as-is
            results = await searchNominatim(query);

            // Strategy 2: Add Rwanda if not included
            if (results.length === 0 && !query.toLowerCase().includes('rwanda')) {
                results = await searchNominatim(`${query}, Rwanda`);
            }

            // Strategy 3: Add Kigali if still no results
            if (results.length === 0 && !query.toLowerCase().includes('kigali')) {
                results = await searchNominatim(`${query}, Kigali`);
            }

            // Strategy 4: Try with each district
            if (results.length === 0) {
                const districts = ['Gasabo', 'Kicukiro', 'Nyarugenge'];
                for (const district of districts) {
                    results = await searchNominatim(`${query}, ${district}, Kigali`);
                    if (results.length > 0) break;
                }
            }

            // Strategy 5: Split query and try parts
            if (results.length === 0 && query.includes(' ')) {
                const parts = query.split(' ');
                for (const part of parts) {
                    if (part.length > 3) {
                        results = await searchNominatim(`${part}, Kigali, Rwanda`);
                        if (results.length > 0) break;
                    }
                }
            }

            setSearchResults(results);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setSearching(false);
        }
    };

    // Helper function to search Nominatim
    const searchNominatim = async (query: string): Promise<any[]> => {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10`;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'SupplierLocationApp/1.0' }
        });

        return await res.json();
    };

    useEffect(() => {
        if (!hasHydrated) return;

        if (!isAuthenticated || user?.role !== "supplier") {
            router.push("/login");
            return;
        }

        if (!user?.ishyigaAccount) {
            setError("No account ID found");
            setLoading(false);
            return;
        }

        fetchLocation();
        fetchHistory();
        fetchCategories();
    }, [isAuthenticated, user, router, hasHydrated]);

    useEffect(() => {
        if (!user?.ishyigaAccount) return;
        fetch(`/api/images/overrides?scope=shop&account=${encodeURIComponent(user.ishyigaAccount)}`, {
            cache: "no-store",
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.ok && typeof data.imageUrl === "string") {
                    setShopImageUrl(data.imageUrl);
                }
            })
            .catch(() => {});
    }, [user?.ishyigaAccount]);

    const fetchLocation = async () => {
        if (!user?.ishyigaAccount) return;

        try {
            const res = await fetch(`/api/supplier/location?action=getLocation&account=${user.ishyigaAccount}`);
            const data = await res.json();

            console.log('[LOCATION] Fetched data:', data);

            if (data.ok && data.location) {
                setLocation(data.location);
                if (data.location.latitude && data.location.longitude) {
                    setSelectedLat(data.location.latitude);
                    setSelectedLng(data.location.longitude);
                }
                setNotes(data.location.notes || "");
                setAccuracy(data.location.accuracy || 0);

                // Populate profile fields
                console.log('[LOCATION] Setting owner:', data.location.owner);
                console.log('[LOCATION] Setting rating:', data.location.ratingStar);

                setOwner(data.location.owner || "");
                setNickname(data.location.nickname || "");
                setPreferredCategories(data.location.preferredCategories || "");
                setMomo(data.location.momo || "");
                setPreferredPay(data.location.preferredPay || "");
                setLocProvince(data.location.locProvince || "");
                setLocDistrict(data.location.locDistrict || "");
                setLocCell(data.location.locCell || "");
                setPreferredSellerNickname(data.location.preferredSellerNickname || "");

                // Ensure ratingStar is a number
                const rating = Number(data.location.ratingStar) || 0;
                console.log('[LOCATION] Setting ratingStar state to:', rating, 'type:', typeof rating);
                setRatingStar(rating);
            } else {
                console.error('[LOCATION] Invalid response:', data);
            }
            setLoading(false);
        } catch (err) {
            console.error("Error fetching location:", err);
            setError("Failed to load location");
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!user?.ishyigaAccount) return;

        try {
            const res = await fetch(`/api/supplier/location?action=getHistory&account=${user.ishyigaAccount}`);
            const data = await res.json();

            if (data.ok && data.history) {
                setHistory(data.history);
            }
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if (Array.isArray(data)) {
                setCategories(data);
            }
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };

    const handleGetCurrentLocation = () => {
        setGettingLocation(true);

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setSelectedLat(position.coords.latitude);
                    setSelectedLng(position.coords.longitude);
                    setAccuracy(position.coords.accuracy);
                    setGettingLocation(false);
                    alert(`✅ Current location detected!\nAccuracy: ${Math.round(position.coords.accuracy)}m`);
                },
                (error) => {
                    setGettingLocation(false);
                    alert("❌ Failed to get location: " + error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            setGettingLocation(false);
            alert("❌ Geolocation not supported by your browser");
        }
    };

    const handleSelectSearchResult = (result: any) => {
        setSelectedLat(parseFloat(result.lat));
        setSelectedLng(parseFloat(result.lon));
        setSearchResults([]);
        setAddressSearch(result.display_name);
    };

    const handleSaveLocation = async () => {
        if (!user?.ishyigaAccount) return;

        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/supplier/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "updateLocation",
                    account: user.ishyigaAccount,
                    latitude: selectedLat,
                    longitude: selectedLng,
                    accuracy: accuracy,
                    notes: notes,
                    address: addressSearch || location?.address || "",
                    // Include profile fields for convenience (optional)
                    owner,
                    preferredCategories,
                    momo,
                    preferredPay,
                    locProvince,
                    locDistrict,
                    locCell,
                    preferredSellerNickname,
                    nickname
                })
            });

            const data = await res.json();

            if (data.ok) {
                alert("✅ Location saved successfully!");
                fetchLocation();
                fetchHistory();
            } else {
                setError(data.error || "Failed to save location");
            }
        } catch (err) {
            setError("Failed to save location");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user?.ishyigaAccount) return;

        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/supplier/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "updateProfile",
                    account: user.ishyigaAccount,
                    owner,
                    preferredCategories,
                    momo,
                    preferredPay,
                    locProvince,
                    locDistrict,
                    locCell,
                    preferredSellerNickname,
                    nickname
                })
            });

            const data = await res.json();

            if (data.ok) {
                alert("✅ Profile saved successfully!");
                fetchLocation();
            } else {
                setError(data.error || "Failed to save profile");
            }
        } catch (err) {
            setError("Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    const handleShopImageUpload = async () => {
        if (!user?.ishyigaAccount || !shopImageFile) return;
        setUploadingImage(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append("scope", "shop");
            fd.append("account", user.ishyigaAccount);
            fd.append("file", shopImageFile);
            const res = await fetch("/api/images/overrides", {
                method: "POST",
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || "Failed to upload shop image");
            }
            setShopImageUrl(String(data.imageUrl || ""));
            setShopImageFile(null);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to upload shop image");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleMapClick = (lat: number, lng: number) => {
        setSelectedLat(lat);
        setSelectedLng(lng);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600">Loading location settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-0 bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.push("/supplier/dashboard")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">Location Settings</h1>
                        <p className="text-sm text-slate-600">
                            Update your business location for better customer visibility
                        </p>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map Section */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Address Search Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Search className="h-5 w-5" />
                                    Search Address
                                </CardTitle>
                                <CardDescription>
                                    Start typing to search for your location (min 3 characters)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={addressSearch}
                                        onChange={(e) => setAddressSearch(e.target.value)}
                                        placeholder="Type location: Kimironko, Rusororo, KN 3 Ave..."
                                        className="w-full px-4 py-2 pr-12 border rounded-lg text-sm"
                                    />
                                    {searching && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        </div>
                                    )}
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="mt-3 border rounded-lg max-h-64 overflow-y-auto">
                                        {searchResults.map((result, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectSearchResult(result)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 text-sm transition-colors"
                                            >
                                                <div className="font-medium flex items-center gap-2">
                                                    <MapPin className="h-3 w-3 text-blue-600" />
                                                    {result.display_name}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 ml-5">
                                                    {parseFloat(result.lat).toFixed(6)}, {parseFloat(result.lon).toFixed(6)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {addressSearch.length >= 3 && !searching && searchResults.length === 0 && (
                                    <div className="mt-3 text-sm text-slate-500 text-center py-2">
                                        No results found. Try different spelling or nearby landmarks.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Map Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Set Your Location
                                </CardTitle>
                                <CardDescription>
                                    Click on the map or use your current location
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 rounded-lg overflow-hidden border">
                                    <SupplierLocationMap
                                        lat={selectedLat}
                                        lng={selectedLng}
                                        onLocationSelect={handleMapClick}
                                    />
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <Button
                                        onClick={handleGetCurrentLocation}
                                        disabled={gettingLocation}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        {gettingLocation ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Getting Location...
                                            </>
                                        ) : (
                                            <>
                                                <Navigation className="h-4 w-4 mr-2" />
                                                Use Current Location
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={handleSaveLocation}
                                        disabled={saving}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Location
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar: Info, Landmarks & History */}
                    <div className="space-y-6">
                        {/* Rating Display */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Your Rating</CardTitle>
                            </CardHeader>
                            <CardContent>
                               
                                {ratingStar > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <span
                                                    key={star}
                                                    className={`text-2xl ${star <= Math.round(ratingStar) ? 'text-yellow-500' : 'text-gray-300'
                                                        }`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-xl font-bold text-slate-900">
                                            {ratingStar.toFixed(1)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-center py-2">
                                        <div className="flex justify-center mb-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <span key={star} className="text-2xl text-gray-300">★</span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-slate-600">No ratings yet</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Current Location Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Current Coordinates</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Latitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={selectedLat}
                                        onChange={(e) => setSelectedLat(Number(e.target.value))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Longitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={selectedLng}
                                        onChange={(e) => setSelectedLng(Number(e.target.value))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Accuracy (meters)</label>
                                    <input
                                        type="number"
                                        value={accuracy}
                                        readOnly
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        rows={3}
                                        placeholder="Optional notes about this location..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Profile Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Business Profile</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 flex items-center justify-between">
                                        <span>Business Name (OWNER)</span>
                                        {loading && <span className="text-xs text-blue-600">Loading...</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={owner}
                                        onChange={(e) => setOwner(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder={loading ? "Loading..." : "Enter business name"}
                                        disabled={loading}
                                    />
                                    {!loading && !owner && (
                                        <p className="text-xs text-amber-600 mt-1">
                                            ⚠️ No business name saved yet
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Shop profile image</label>
                                    <div className="mt-2 flex items-center gap-3">
                                        <img
                                            src={shopImageUrl || "/img/shops/default.png"}
                                            alt="Shop profile"
                                            className="h-16 w-16 rounded-md border border-slate-200 bg-white object-cover"
                                        />
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setShopImageFile(e.target.files?.[0] ?? null)}
                                                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleShopImageUpload}
                                                disabled={!shopImageFile || uploadingImage}
                                            >
                                                {uploadingImage ? "Uploading..." : "Upload image"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Preferred Categories</label>
                                    <select
                                        value={preferredCategories}
                                        onChange={(e) => setPreferredCategories(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Mobile Money Number</label>
                                    <input
                                        type="tel"
                                        value={momo}
                                        onChange={(e) => setMomo(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder="07xxxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Preferred Payment Method</label>
                                    <select
                                        value={preferredPay}
                                        onChange={(e) => setPreferredPay(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                    >
                                        <option value="">Select method</option>
                                        <option value="MOMO">Mobile Money</option>
                                        <option value="BANK">Bank Transfer</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Province</label>
                                    <input
                                        type="text"
                                        value={locProvince}
                                        onChange={(e) => setLocProvince(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder="e.g., Kigali City"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">District</label>
                                    <input
                                        type="text"
                                        value={locDistrict}
                                        onChange={(e) => setLocDistrict(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder="e.g., Gasabo"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Cell/Sector</label>
                                    <input
                                        type="text"
                                        value={locCell}
                                        onChange={(e) => setLocCell(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder="e.g., Kimironko"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Seller Nickname</label>
                                    <input
                                        type="text"
                                        value={preferredSellerNickname}
                                        onChange={(e) => setPreferredSellerNickname(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                        placeholder="Display name"
                                    />
                                </div>

                                {/* Save Profile Button */}
                                <div className="pt-2">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={saving}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving Profile...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Profile
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        Save business profile without changing location
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Nearby Landmarks - Temporarily disabled due to Overpass API reliability issues */}
                        {/* 
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPinned className="h-4 w-4" />
                                    Nearby Landmarks
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {fetchingLandmarks ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                                        <span className="text-sm text-slate-600">Finding nearby places...</span>
                                    </div>
                                ) : nearbyLandmarks.length > 0 ? (
                                    <div className="space-y-2">
                                        {nearbyLandmarks.slice(0, 8).map((landmark, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between items-center text-xs py-2 px-3 bg-slate-50 rounded hover:bg-blue-50 transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium">{landmark.name}</div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        {landmark.type}
                                                    </div>
                                                </div>
                                                <span className="text-slate-600 font-medium ml-2">
                                                    {(landmark.distance || 0) < 1
                                                        ? `${((landmark.distance || 0) * 1000).toFixed(0)}m`
                                                        : `${(landmark.distance || 0).toFixed(1)}km`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-500 text-center py-4">
                                        No nearby landmarks found in this area
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        */}


                        {/* Location History */}
                        {history.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        Recent Updates
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {history.map((entry, idx) => (
                                            <div
                                                key={idx}
                                                className="text-xs border-l-2 border-blue-500 pl-3 py-2 bg-slate-50 rounded"
                                            >
                                                <div className="font-medium">
                                                    {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                                                </div>
                                                <div className="text-slate-600 mt-1">
                                                    {new Date(entry.updatedAt).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SupplierLocationPage() {
    return <SupplierLocationSettings />;
}
