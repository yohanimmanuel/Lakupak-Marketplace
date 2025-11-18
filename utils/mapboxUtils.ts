export interface MapCoordinates {
  longitude: number;
  latitude: number;
}

export interface GeocodeResult {
  coordinates: MapCoordinates | null;
  address: string;
}

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

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
 * Geocode a single address using Mapbox Geocoding API with improved accuracy
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!MAPBOX_ACCESS_TOKEN) {
    return { coordinates: null, address };
  }

  try {
    const cleanedAddress = address.trim().replace(/\s+/g, ' ');
    const encodedAddress = encodeURIComponent(cleanedAddress);
    
    // Use country bias for Indonesia and proximity bias for better accuracy
    // Proximity: Surabaya, Indonesia (longitude, latitude)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&country=ID&types=address,poi,place,locality,neighborhood,district,postcode&proximity=112.7521,-7.2575`;

    const response = await fetch(url);
    
    if (!response.ok) {
      return { coordinates: null, address };
    }

    interface MapboxFeature {
      center: [number, number];
      place_name: string;
      place_type?: string[];
    }

    interface MapboxGeocodingResponse {
      features?: MapboxFeature[];
    }

    const data: MapboxGeocodingResponse = await response.json();

    if (data.features && data.features.length > 0) {
      // Find the best match (prefer address type, then highest relevance)
      const addressMatch = data.features.find((feature) => 
        feature.place_type?.includes('address') || feature.place_type?.includes('poi')
      );
      
      const bestMatch = addressMatch || data.features[0];
      const [longitude, latitude] = bestMatch.center;
      
      return {
        coordinates: { longitude, latitude },
        address: bestMatch.place_name || address,
      };
    }

    return { coordinates: null, address };
  } catch {
    return { coordinates: null, address };
  }
}

