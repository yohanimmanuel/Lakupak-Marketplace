import { API_BASE_URL } from './config';
import {
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
 * Uses Google Geocoding via Laku-Dashboard — same source as saved buyer addresses.
 * Does not fall back to Mapbox/OSM (those can return inaccurate pins in Indonesia).
 */
export async function geocodeAddress(
  address: string,
  token?: string | null,
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { coordinates: null, address };
  }

  try {
    const googleResult = await geocodeViaGoogleProxy(trimmed, token);
    if (googleResult !== null) {
      return googleResult;
    }
  } catch {
    // Dashboard unreachable
  }

  return { coordinates: null, address: trimmed, precision: 'area' };
}

/**
 * Reverse-geocode device GPS coordinates into a formatted delivery address.
 * Powers the "Use current location" button on the edit-address screen.
 * Returns null when the dashboard proxy is unreachable or unconfigured so the
 * caller can fall back to keeping the manually typed address.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  token?: string | null,
): Promise<GeocodeResult | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/mobile/geocode/reverse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ latitude, longitude }),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as GoogleProxyResponse;
    return {
      coordinates: data.coordinates ?? { latitude, longitude },
      address: data.address ?? '',
      precision: data.precision,
    };
  } catch {
    return null;
  }
}
