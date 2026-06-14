import { getMapboxAccessToken, hasMapboxAccessToken } from './mapboxConfig';

export interface MapCoordinates {
  longitude: number;
  latitude: number;
}

export interface GeocodeResult {
  coordinates: MapCoordinates | null;
  address: string;
}

/**
 * Get map marker color based on order status
 * Colors match the UI badge color scheme
 */
export function getOrderStatusMarkerColor(status: string): string {
  switch (status) {
    case 'Pending':
      return '#fbbf24'; // Yellow
    case 'Confirmed':
      return '#3b82f6'; // Blue
    case 'Packed':
      return '#a855f7'; // Purple
    case 'Shipped':
      return '#6366f1'; // Indigo
    case 'Delivered':
      return '#22c55e'; // Green
    case 'Cancelled':
      return '#ef4444'; // Red
    case 'Returned':
      return '#f97316'; // Orange
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Forward-geocodes an address using Mapbox Geocoding v5.
 * Global — no country restriction. Optional proximity biases toward a region
 * when multiple places share the same name (same approach as Laku-Driver).
 */
export async function geocodeAddress(
  address: string,
  proximity?: [number, number],
): Promise<GeocodeResult> {
  if (!hasMapboxAccessToken()) {
    return { coordinates: null, address };
  }

  const accessToken = getMapboxAccessToken();

  try {
    const cleanedAddress = address.trim().replace(/\s+/g, ' ');
    if (!cleanedAddress) {
      return { coordinates: null, address };
    }

    const encodedAddress = encodeURIComponent(cleanedAddress);
    const proximityParam = proximity
      ? `&proximity=${proximity[0]},${proximity[1]}`
      : '';
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json` +
      `?access_token=${accessToken}&limit=1${proximityParam}`;

    const response = await fetch(url);

    if (!response.ok) {
      return { coordinates: null, address };
    }

    interface MapboxFeature {
      center?: [number, number];
      geometry?: { coordinates: [number, number] };
      place_name?: string;
    }

    interface MapboxGeocodingResponse {
      features?: MapboxFeature[];
    }

    const data: MapboxGeocodingResponse = await response.json();
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates ?? feature?.center;

    if (!feature || !coords) {
      return { coordinates: null, address };
    }

    const [longitude, latitude] = coords;

    return {
      coordinates: { longitude, latitude },
      address: feature.place_name || address,
    };
  } catch {
    return { coordinates: null, address };
  }
}
