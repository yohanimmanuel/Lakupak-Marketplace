import { API_BASE_URL } from './config';
import {
  geocodeAddressLocal,
  type GeocodePrecision,
  type GeocodeResult,
  type MapCoordinates,
} from '../utils/mapboxUtils';

export type { GeocodePrecision, GeocodeResult, MapCoordinates };

type GoogleProxyResponse = {
  coordinates: MapCoordinates | null;
  address: string;
  precision?: GeocodePrecision;
};

async function geocodeViaGoogleProxy(
  address: string,
  token?: string | null,
): Promise<GeocodeResult | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/mobile/geocode`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ address }),
  });

  if (res.status === 503) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as GoogleProxyResponse;
  return {
    coordinates: data.coordinates,
    address: data.address ?? address,
    precision: data.precision,
  };
}

/**
 * Geocode a typed address for map preview.
 * Primary: Google Geocoding via Laku-Dashboard (accurate, especially in Indonesia).
 * Fallback: Mapbox + OpenStreetMap when the proxy is unavailable.
 */
export async function geocodeAddress(
  address: string,
  token?: string | null,
  proximity?: [number, number],
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { coordinates: null, address };
  }

  try {
    const googleResult = await geocodeViaGoogleProxy(trimmed, token);
    if (googleResult?.coordinates) {
      return googleResult;
    }
  } catch {
    // Dashboard unreachable — use local fallback
  }

  return geocodeAddressLocal(trimmed, proximity);
}
