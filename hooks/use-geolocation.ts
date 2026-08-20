// Geolocation hook for browser location access
// Provides buyer's location for nearby search features

import { useState, useEffect } from 'react';

export interface GeoLocation {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
}

export interface GeoLocationState {
    location: GeoLocation | null;
    loading: boolean;
    error: string | null;
    denied: boolean;
    isFallback: boolean;
}

// Default fallback location (Kigali center)
const DEFAULT_LOCATION: GeoLocation = {
    lat: -1.9536,
    lng: 30.0906
};

export function useGeolocation(options?: PositionOptions) {
    const [state, setState] = useState<GeoLocationState>({
        location: null,
        loading: true,
        error: null,
        denied: false,
        isFallback: false
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !('geolocation' in navigator)) {
            setState({
                location: DEFAULT_LOCATION,
                loading: false,
                error: 'Geolocation not supported',
                denied: false,
                isFallback: true
            });
            return;
        }

        const onSuccess = (position: GeolocationPosition) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                setState({
                    location: DEFAULT_LOCATION,
                    loading: false,
                    error: 'Invalid GPS coordinates received',
                    denied: false,
                    isFallback: true
                });
                return;
            }

            setState({
                location: {
                    lat,
                    lng,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                },
                loading: false,
                error: null,
                denied: false,
                isFallback: false
            });
        };

        const onError = (error: GeolocationPositionError) => {
            console.warn('Geolocation error:', error.message);

            const isDenied = error.code === error.PERMISSION_DENIED;

            setState({
                location: DEFAULT_LOCATION, // Fallback to Kigali
                loading: false,
                error: error.message,
                denied: isDenied,
                isFallback: true
            });
        };

        // Request location
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            options || {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );

        // Optional: Watch position for continuous updates
        // const watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
        // return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return state;
}

/**
 * Calculate distance between two points using Haversine formula (client-side)
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}
