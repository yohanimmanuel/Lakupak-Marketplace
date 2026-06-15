import { getMapboxAccessToken, hasMapboxAccessToken } from './mapboxConfig';

export interface MapCoordinates {
  longitude: number;
  latitude: number;
}

export type GeocodePrecision = 'exact' | 'approximate' | 'area';

export interface GeocodeResult {
  coordinates: MapCoordinates | null;
  address: string;
  precision?: GeocodePrecision;
}

const MAPBOX_PRECISION: Record<string, number> = {
  address: 100,
  poi: 95,
  postcode: 75,
  district: 55,
  neighborhood: 45,
  locality: 35,
  place: 30,
  region: 15,
  country: 5,
};

const NOMINATIM_PRECISION: Record<string, number> = {
  house: 100,
  building: 100,
  apartments: 98,
  retail: 95,
  commercial: 95,
  yes: 90,
  residential: 82,
  road: 78,
  neighbourhood: 48,
  suburb: 38,
  city: 25,
  administrative: 20,
};

const STREET_LEVEL = 75;

type MapboxFeature = {
  geometry: { coordinates: [number, number] };
  place_name?: string;
  place_type?: string[];
  relevance?: number;
};

type ScoredResult = {
  coordinates: MapCoordinates;
  address: string;
  score: number;
  precision: GeocodePrecision;
};

/**
 * Get map marker color based on order status
 * Colors match the UI badge color scheme
 */
export function getOrderStatusMarkerColor(status: string): string {
  switch (status) {
    case 'Pending':
      return '#fbbf24';
    case 'Confirmed':
      return '#3b82f6';
    case 'Packed':
      return '#a855f7';
    case 'Shipped':
      return '#6366f1';
    case 'Delivered':
      return '#22c55e';
    case 'Cancelled':
      return '#ef4444';
    case 'Returned':
      return '#f97316';
    default:
      return '#6b7280';
  }
}

function looksLikeStreetAddress(query: string): boolean {
  return (
    /\b(no\.?|nomor|blk\.?|blok|#)\s*[\w-]+/i.test(query) ||
    /\b\d{1,5}\s*,/i.test(query) ||
    /(?:Jl\.?|Jalan)\s+\S+/i.test(query)
  );
}

const ID_LOCALITY_CITIES =
  /\b(jakarta|surabaya|bandung|medan|bali|jawa|yogyakarta|semarang|malang|depok|bekasi|tangerang|batam|makassar)\b/i;

function inferCountryCode(address: string): string | undefined {
  const lower = address.toLowerCase();
  if (/\bindonesia\b/.test(lower)) return 'id';
  if (/\bsingapore\b/.test(lower)) return 'sg';

  // City names only in locality segments (after the first comma), not in street names.
  const localitySegments = address
    .split(',')
    .slice(1)
    .map((segment) => segment.trim());
  if (localitySegments.some((segment) => ID_LOCALITY_CITIES.test(segment))) {
    return 'id';
  }

  return undefined;
}

function buildQueryVariants(address: string): string[] {
  const trimmed = address.trim().replace(/\s+/g, ' ');
  const variants = new Set<string>([trimmed]);

  const noRtRw = trimmed
    .replace(/\bRT\.?\s*[\d/]+\s*\/?\s*RW\.?\s*[\d/]+/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/g, '')
    .trim();
  if (noRtRw) variants.add(noRtRw);

  const street = trimmed.match(/(?:Jl\.?|Jalan)\s+([^,]+)/i)?.[1]?.trim();
  const city = trimmed.match(
    /\b(Surabaya|Jakarta|Bandung|Medan|Singapore|Bali|Yogyakarta|Semarang|Malang|Depok|Tangerang|Bekasi|Batam|Makassar)\b/i,
  )?.[0];
  const country = trimmed.match(/\b(Indonesia|Singapore|Malaysia)\b/i)?.[0];

  if (street && city) {
    variants.add(`${street}, ${city}${country ? `, ${country}` : ''}`);
    variants.add(`Jalan ${street}, ${city}${country ? `, ${country}` : ''}`);
  }

  if (/\d{5,6}/.test(trimmed) && city) {
    const postal = trimmed.match(/\b\d{5,6}\b/)?.[0];
    if (postal) {
      variants.add(`${trimmed.split(',')[0]}, ${city}, ${postal}`);
    }
  }

  return [...variants].filter(Boolean);
}

function scoreToPrecision(score: number): GeocodePrecision {
  if (score >= STREET_LEVEL) return 'exact';
  if (score >= 50) return 'approximate';
  return 'area';
}

function pickBestMapboxFeature(
  features: MapboxFeature[],
  query: string,
): ScoredResult | null {
  if (!features.length) return null;

  const wantsStreet = looksLikeStreetAddress(query);
  let best: ScoredResult | null = null;

  for (const feature of features) {
    const types = feature.place_type ?? [];
    const typeScore = Math.max(...types.map((t) => MAPBOX_PRECISION[t] ?? 0), 0);
    let score = typeScore + (feature.relevance ?? 0) * 50;

    if (wantsStreet && typeScore < STREET_LEVEL) {
      score -= 30;
    }

    const candidate: ScoredResult = {
      coordinates: {
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
      },
      address: feature.place_name ?? query,
      score,
      precision: scoreToPrecision(typeScore),
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

async function mapboxGeocode(
  query: string,
  proximity?: [number, number],
): Promise<ScoredResult | null> {
  const tk = getMapboxAccessToken();
  if (!tk) return null;

  const country = inferCountryCode(query);
  const proximityParam = proximity ? `&proximity=${proximity[0]},${proximity[1]}` : '';
  const countryParam = country ? `&country=${country}` : '';
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${tk}&limit=5&autocomplete=false${countryParam}${proximityParam}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as { features?: MapboxFeature[] };
  return pickBestMapboxFeature(data.features ?? [], query);
}

async function nominatimGeocode(query: string): Promise<ScoredResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&format=json&limit=3&addressdetails=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'LakuMarketplace/1.0 (address preview)' },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    type?: string;
    class?: string;
    importance?: number;
  }>;

  if (!data.length) return null;

  let best: ScoredResult | null = null;
  for (const item of data) {
    const typeKey = item.type ?? item.class ?? '';
    const typeScore = NOMINATIM_PRECISION[typeKey] ?? 60;
    const score = typeScore + (item.importance ?? 0) * 10;

    const candidate: ScoredResult = {
      coordinates: {
        longitude: Number.parseFloat(item.lon),
        latitude: Number.parseFloat(item.lat),
      },
      address: item.display_name,
      score,
      precision: scoreToPrecision(typeScore),
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

function pickBestResult(candidates: Array<ScoredResult | null>): ScoredResult | null {
  return candidates.reduce<ScoredResult | null>((best, cur) => {
    if (!cur) return best;
    if (!best || cur.score > best.score) return cur;
    return best;
  }, null);
}

/**
 * Local fallback: Mapbox + OpenStreetMap. Used when Google proxy is unavailable.
 */
export async function geocodeAddressLocal(
  address: string,
  proximity?: [number, number],
): Promise<GeocodeResult> {
  if (!hasMapboxAccessToken()) {
    return { coordinates: null, address };
  }

  const variants = buildQueryVariants(address);
  const wantsStreet = looksLikeStreetAddress(address);

  try {
    let best: ScoredResult | null = null;

    for (const query of variants) {
      const mapboxResult = await mapboxGeocode(query, proximity);
      best = pickBestResult([best, mapboxResult]);
      if (best && best.score >= STREET_LEVEL) break;
    }

    const needsFallback =
      !best ||
      (wantsStreet && best.score < STREET_LEVEL) ||
      best.precision === 'area';

    if (needsFallback) {
      for (const query of variants) {
        const osmResult = await nominatimGeocode(query);
        best = pickBestResult([best, osmResult]);
        if (best && best.score >= STREET_LEVEL) break;
      }
    }

    if (!best) {
      return { coordinates: null, address };
    }

    return {
      coordinates: best.coordinates,
      address: best.address,
      precision: best.precision,
    };
  } catch {
    return { coordinates: null, address };
  }
}
