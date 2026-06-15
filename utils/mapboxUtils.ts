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
 * Forward-geocodes an address — same Mapbox call as Laku-Driver `mapboxApi.geocodeAddress`.
 * Converts typed address text → [lng, lat]. No GPS required.
 */
export async function geocodeAddress(
  address: string,
  proximity?: [number, number],
): Promise<GeocodeResult> {
  const tk = getMapboxAccessToken();
  if (!tk) {
    return { coordinates: null, address };
  }

  try {
    const query = encodeURIComponent(address.trim());
    if (!query) {
      return { coordinates: null, address };
    }

    const proximityParam = proximity
      ? `&proximity=${proximity[0]},${proximity[1]}`
      : '';
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json` +
      `?access_token=${tk}&limit=1${proximityParam}`;

    const res = await fetch(url);
    if (!res.ok) {
      return { coordinates: null, address };
    }

    const data = (await res.json()) as {
      features?: {
        geometry: { coordinates: [number, number] };
        place_name?: string;
      }[];
    };

    const feature = data.features?.[0];
    const coords = feature?.geometry.coordinates;
    if (!coords) {
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
